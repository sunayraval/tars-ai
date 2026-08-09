'use client';

/**
 * ChatContext
 *
 * Manages the chat conversation state: message history, SSE streaming,
 * Firestore persistence, system message injection, and AI command extraction.
 *
 * Performance: Uses in-memory tasks from TasksContext instead of blocking
 * on Firestore reads before every AI request.
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
import { getChatHistory, addChatMessage, addTask } from '@/lib/firebase/firestore';
import { useAuthContext } from './AuthContext';
import { useTasksContext } from './TasksContext';

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

  // Access in-memory tasks (NO Firestore round-trip per message)
  let tasksCtx: { tasks: Task[]; updateTask: (id: string, u: Partial<Task>) => Promise<void>; deleteTask: (id: string) => Promise<void>; refreshTasks: () => Promise<void> } | null = null;
  try {
    tasksCtx = useTasksContext();
  } catch {
    // TasksContext may not be mounted yet during SSR
  }

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
  // Build the AI system prompt with full context
  // ------------------------------------------------------------------
  const buildSystemPrompt = useCallback(() => {
    const now = new Date();
    const currentTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const currentDate = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const userName = user?.displayName?.split(' ')[0] ?? 'there';

    const currentTasks = tasksCtx?.tasks ?? [];
    const taskListStr = currentTasks.length > 0
      ? currentTasks.map(t => `- [${t.status}] "${t.title}" (id: ${t.id})${t.category ? ` [${t.category}]` : ''}${t.estimatedDuration ? ` ~${t.estimatedDuration}min` : ''}`).join('\n')
      : '(no tasks yet)';

    return `You are TARS-AI, ${userName}'s intelligent personal productivity assistant.
CURRENT TIME: ${currentTime}
CURRENT DATE: ${currentDate}

YOUR USER'S TASKS:
${taskListStr}

You can manage tasks by outputting XML command tags in your response. The system reads these tags and executes them automatically. YOU MUST output the tag for the action to happen — just saying "I added it" does nothing.

AVAILABLE COMMANDS:

1. ADD A TASK:
<ADD_TASK>{"title": "Task Name", "description": "optional details", "estimatedDuration": 60, "category": "study"}</ADD_TASK>
- estimatedDuration is in minutes (2 hrs = 120)
- category must be one of: work, study, personal, health, errand, other

2. COMPLETE A TASK:
<COMPLETE_TASK>{"id": "the-task-id"}</COMPLETE_TASK>

3. DELETE A TASK:
<DELETE_TASK>{"id": "the-task-id"}</DELETE_TASK>

4. UPDATE A TASK:
<UPDATE_TASK>{"id": "the-task-id", "title": "New Title", "estimatedDuration": 90, "category": "work"}</UPDATE_TASK>

RULES:
1. Output commands as raw text — do NOT wrap in markdown code blocks.
2. You MUST output the XML tag for any action. If you don't output the tag, nothing happens.
3. When the user asks to add a task, ALWAYS output <ADD_TASK>. When they ask to remove one, ALWAYS output <DELETE_TASK>. When they ask to complete one, ALWAYS output <COMPLETE_TASK>.
4. You can output multiple commands in one response.
5. Be concise, friendly, and personalized. Use ${userName}'s name occasionally. Reference the current time when relevant.
6. If the user asks about their schedule or tasks, refer to the data above — don't say you can't access it.
7. NEVER output safety labels, metadata, or "User Safety: safe" text.`;
  }, [user, tasksCtx?.tasks]);

  // ------------------------------------------------------------------
  // Process AI command tags from the response
  // ------------------------------------------------------------------
  const processAgentCommands = useCallback(async (text: string): Promise<string> => {
    if (!user) return text;
    let cleanedText = text;

    // ADD_TASK
    const addTaskRegex = /<ADD_TASK>([\s\S]*?)<\/ADD_TASK>/g;
    let match;
    while ((match = addTaskRegex.exec(text)) !== null) {
      try {
        const payload = JSON.parse(match[1].trim());
        if (payload.title) {
          if (tasksCtx) {
            await tasksCtx.refreshTasks(); // Sync before adding
          }
          await addTask(user.uid, {
            title: payload.title,
            description: payload.description || '',
            status: 'todo',
            category: payload.category || 'other',
            estimatedDuration: payload.estimatedDuration || 30,
          });
          if (tasksCtx) await tasksCtx.refreshTasks();
          cleanedText = cleanedText.replace(match[0], `\n> ✅ **Added Task:** ${payload.title}${payload.category ? ` [${payload.category}]` : ''}\n`);
        }
      } catch (e) {
        console.error('Failed to parse ADD_TASK command', e);
        cleanedText = cleanedText.replace(match[0], `\n> ❌ **Failed to add task**\n`);
      }
    }

    // COMPLETE_TASK
    const completeRegex = /<COMPLETE_TASK>([\s\S]*?)<\/COMPLETE_TASK>/g;
    while ((match = completeRegex.exec(text)) !== null) {
      try {
        const payload = JSON.parse(match[1].trim());
        if (payload.id && tasksCtx) {
          await tasksCtx.updateTask(payload.id, { status: 'done' });
          cleanedText = cleanedText.replace(match[0], `\n> ✅ **Completed task**\n`);
        }
      } catch (e) {
        console.error('Failed to parse COMPLETE_TASK command', e);
        cleanedText = cleanedText.replace(match[0], `\n> ❌ **Failed to complete task**\n`);
      }
    }

    // DELETE_TASK
    const deleteRegex = /<DELETE_TASK>([\s\S]*?)<\/DELETE_TASK>/g;
    while ((match = deleteRegex.exec(text)) !== null) {
      try {
        const payload = JSON.parse(match[1].trim());
        if (payload.id && tasksCtx) {
          await tasksCtx.deleteTask(payload.id);
          cleanedText = cleanedText.replace(match[0], `\n> 🗑️ **Deleted task**\n`);
        }
      } catch (e) {
        console.error('Failed to parse DELETE_TASK command', e);
        cleanedText = cleanedText.replace(match[0], `\n> ❌ **Failed to delete task**\n`);
      }
    }

    // UPDATE_TASK
    const updateRegex = /<UPDATE_TASK>([\s\S]*?)<\/UPDATE_TASK>/g;
    while ((match = updateRegex.exec(text)) !== null) {
      try {
        const payload = JSON.parse(match[1].trim());
        if (payload.id && tasksCtx) {
          const { id, ...updates } = payload;
          await tasksCtx.updateTask(id, updates);
          cleanedText = cleanedText.replace(match[0], `\n> ✏️ **Updated task**\n`);
        }
      } catch (e) {
        console.error('Failed to parse UPDATE_TASK command', e);
        cleanedText = cleanedText.replace(match[0], `\n> ❌ **Failed to update task**\n`);
      }
    }

    return cleanedText;
  }, [user, tasksCtx]);

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

      // 2. Start streaming UI immediately (NO Firestore blocking)
      setIsStreaming(true);
      setCurrentStreamedText('');

      const controller = new AbortController();
      abortRef.current = controller;

      // 3. Build system prompt from IN-MEMORY data (instant, no network)
      const systemPromptContent = buildSystemPrompt();
      const systemPromptMsg = { role: 'system', content: systemPromptContent };

      const contextMessages = [
        systemPromptMsg,
        ...messages.slice(-MAX_CONTEXT_MESSAGES),
        userMsg,
      ].map((m) => ({ role: m.role, content: m.content }));

      try {
        const apiKey = localStorage.getItem('openRouterApiKey');
        const model = userPreferences?.model || 'openrouter/free';

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
          let isFinished = false;

          while (!isFinished) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (data === '[DONE]') {
                  isFinished = true;
                  break;
                }

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
                    throw e;
                  }
                  if (data && data !== '[DONE]') {
                    accumulated += data;
                    setCurrentStreamedText(accumulated);
                  }
                }
              }
            }
          }

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
            setCurrentStreamedText(cleanContent);

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
    [user, isStreaming, messages, buildSystemPrompt, processAgentCommands, userPreferences?.model]
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
