'use client';

/**
 * ChatContext
 *
 * Manages the chat conversation state: message history, SSE streaming,
 * Firestore persistence, and system message injection.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type { ChatMessage, Task } from '@/lib/firebase/firestore';
import { getChatHistory, addChatMessage, getUserTasks, addTask } from '@/lib/firebase/firestore';
import { useAuthContext } from './AuthContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatContextValue {
  messages: ChatMessage[];
  isStreaming: boolean;
  currentStreamedText: string;
  sendMessage: (content: string) => Promise<void>;
  sendSystemMessage: (content: string) => Promise<void>;
  clearHistory: () => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

// Maximum number of messages to include in the AI context window
const MAX_CONTEXT_MESSAGES = 20;

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, userPreferences } = useAuthContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamedText, setCurrentStreamedText] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  // Load chat history from Firestore on mount / user change
  useEffect(() => {
    if (!user) {
      setMessages([]);
      return;
    }

    let cancelled = false;

    getChatHistory(user.uid)
      .then((history) => {
        if (!cancelled) setMessages(history);
      })
      .catch((err) => console.error('Failed to load chat history:', err));

    return () => {
      cancelled = true;
    };
  }, [user]);

  // ------------------------------------------------------------------
  // Send a user message and stream the AI response
  // ------------------------------------------------------------------
  const sendMessage = useCallback(
    async (content: string) => {
      if (!user || isStreaming) return;

      // 1. Append user message optimistically and persist
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // Fire and forget persistence
      addChatMessage(user.uid, { role: 'user', content }).catch((err) => {
        console.error('Failed to persist user message:', err);
      });

      // 2. Start streaming UI immediately (optimistic UI)
      setIsStreaming(true);
      setCurrentStreamedText('');

      const controller = new AbortController();
      abortRef.current = controller;

      // 3. Fetch current tasks to build context
      let currentTasks: Task[] = [];
      try {
        currentTasks = await getUserTasks(user.uid);
      } catch (err) {
        console.error('Failed to get tasks for context:', err);
      }

      const systemPromptContent = `You are TARS-AI, an intelligent time-management and productivity assistant.
You have access to the user's current tasks.
CURRENT TASKS:
${JSON.stringify(currentTasks.map(t => ({ id: t.id, title: t.title, status: t.status })), null, 2)}

CRITICAL INSTRUCTION: You can manage the user's tasks by outputting XML commands. 
If the user asks you to add a task, schedule something, or add something to their agenda, you MUST output the following command exactly as shown:
<ADD_TASK>{"title": "Task Name", "description": "Details", "estimatedDuration": 120}</ADD_TASK>

RULES FOR COMMANDS:
1. You must output the command in raw text anywhere in your response.
2. Do NOT wrap the command in markdown code blocks (e.g. no \`\`\`xml).
3. Always include a title. 
4. estimatedDuration must be a number in minutes (e.g., 2 hrs = 120).
5. If the user asks you to add a task, ALWAYS output the command!
`;

      const systemPromptMsg = { role: 'system', content: systemPromptContent };

      const contextMessages = [
        systemPromptMsg,
        ...messages.slice(-MAX_CONTEXT_MESSAGES),
        userMsg,
      ].map((m) => ({ role: m.role, content: m.content }));

      try {
        const apiKey = localStorage.getItem('openRouterApiKey');
        const model = userPreferences?.model || 'openrouter/free'; // wait, model is stored in userPreferences or settings?

        // We will pass the model and apiKey
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: contextMessages,
            uid: user.uid,
            apiKey: apiKey || '',
            model: model,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          let parsedError = errorText;
          try {
            parsedError = JSON.parse(errorText).error || errorText;
          } catch {}
          throw new Error(`API error ${response.status}: ${parsedError}`);
        }

        const contentType = response.headers.get('content-type') ?? '';

        if (contentType.includes('text/event-stream') && response.body) {
          // SSE streaming path
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let accumulated = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (data === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(data);
                  
                  if (parsed.error) {
                    throw new Error(parsed.error);
                  }
                  
                  const token =
                    parsed.choices?.[0]?.delta?.content ?? parsed.content ?? '';
                  if (token) {
                    accumulated += token;
                    setCurrentStreamedText(accumulated);
                  }
                } catch (e: any) {
                  if (e.message && data.includes('"error":')) {
                    throw e; // Bubble up OpenRouter error
                  }
                  // Non-JSON data line — may be a raw token
                  if (data && data !== '[DONE]') {
                    accumulated += data;
                    setCurrentStreamedText(accumulated);
                  }
                }
              }
            }
          }

          // Process Agent Commands
          const processAgentCommands = async (text: string) => {
            let cleanedText = text;
            const addTaskRegex = /<ADD_TASK>([\s\S]*?)<\/ADD_TASK>/g;
            let match;
            
            while ((match = addTaskRegex.exec(text)) !== null) {
              try {
                const jsonStr = match[1].trim();
                const payload = JSON.parse(jsonStr);
                
                if (payload.title) {
                   await addTask(user.uid, {
                     title: payload.title,
                     description: payload.description || '',
                     status: 'todo',
                     estimatedDuration: payload.estimatedDuration || 30,
                   });
                   
                   cleanedText = cleanedText.replace(match[0], `\n> ✅ **Added Task:** ${payload.title}\n`);
                }
              } catch (e) {
                 console.error("Failed to parse ADD_TASK command", e);
                 cleanedText = cleanedText.replace(match[0], `\n> ❌ **Failed to parse task command**\n`);
              }
            }
            return cleanedText;
          };

          // Persist the complete assistant message
          if (accumulated) {
            const cleanContent = await processAgentCommands(accumulated);
            
            const assistantMsg: ChatMessage = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: cleanContent,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, assistantMsg]);
            setCurrentStreamedText(cleanContent); // Update UI with cleaned text

            addChatMessage(user.uid, {
              role: 'assistant',
              content: cleanContent,
            }).catch((err) => {
              console.error('Failed to persist assistant message:', err);
            });
          }
        } else {
          // Non-streaming JSON response
          const data = await response.json();
          
          if (data.error) {
            throw new Error(data.error);
          }
          
          const assistantContent =
            data.choices?.[0]?.message?.content ?? data.content ?? '';

          if (assistantContent) {
            // Process Agent Commands for non-streaming
            const processAgentCommands = async (text: string) => {
              let cleanedText = text;
              const addTaskRegex = /<ADD_TASK>([\s\S]*?)<\/ADD_TASK>/g;
              let match;
              while ((match = addTaskRegex.exec(text)) !== null) {
                try {
                  const payload = JSON.parse(match[1].trim());
                  if (payload.title) {
                     await addTask(user.uid, {
                       title: payload.title,
                       description: payload.description || '',
                       status: 'todo',
                       estimatedDuration: payload.estimatedDuration || 30,
                     });
                     cleanedText = cleanedText.replace(match[0], `\n> ✅ **Added Task:** ${payload.title}\n`);
                  }
                } catch (e) {
                   cleanedText = cleanedText.replace(match[0], `\n> ❌ **Failed to parse task command**\n`);
                }
              }
              return cleanedText;
            };

            const cleanContent = await processAgentCommands(assistantContent);

            const assistantMsg: ChatMessage = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: cleanContent,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, assistantMsg]);
            setCurrentStreamedText(cleanContent);

            addChatMessage(user.uid, {
              role: 'assistant',
              content: cleanContent,
            }).catch((err) => {
              console.error('Failed to persist assistant message:', err);
            });
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Chat stream error:', err);
          const errorMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'system',
            content: `Error: ${err.message || 'Something went wrong. Please check your API key.'}`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMsg]);
        }
      } finally {
        setIsStreaming(false);
        setCurrentStreamedText('');
        abortRef.current = null;
      }
    },
    [user, isStreaming, messages]
  );

  // ------------------------------------------------------------------
  // System messages (schedule notifications, etc.)
  // ------------------------------------------------------------------
  const sendSystemMessage = useCallback(
    async (content: string) => {
      if (!user) return;

      const sysMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'system',
        content,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, sysMsg]);

      addChatMessage(user.uid, { role: 'system', content }).catch((err) => {
        console.error('Failed to persist system message:', err);
      });
    },
    [user]
  );

  // ------------------------------------------------------------------
  // Clear chat
  // ------------------------------------------------------------------
  const clearHistory = useCallback(() => {
    setMessages([]);
    setCurrentStreamedText('');
  }, []);

  return (
    <ChatContext.Provider
      value={{
        messages,
        isStreaming,
        currentStreamedText,
        sendMessage,
        sendSystemMessage,
        clearHistory,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useChatContext must be used inside <ChatProvider>');
  }
  return ctx;
}
