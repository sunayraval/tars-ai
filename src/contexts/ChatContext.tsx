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
import type { ChatMessage } from '@/lib/firebase/firestore';
import { getChatHistory, addChatMessage } from '@/lib/firebase/firestore';
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
  const { user } = useAuthContext();
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

      try {
        await addChatMessage(user.uid, { role: 'user', content });
      } catch (err) {
        console.error('Failed to persist user message:', err);
      }

      // 2. Build context from the last N messages
      const contextMessages = [...messages, userMsg]
        .slice(-MAX_CONTEXT_MESSAGES)
        .map((m) => ({ role: m.role, content: m.content }));

      // 3. Stream AI response
      setIsStreaming(true);
      setCurrentStreamedText('');

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: contextMessages,
            uid: user.uid,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Chat API error: ${response.status}`);
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
                  const token =
                    parsed.choices?.[0]?.delta?.content ?? parsed.content ?? '';
                  if (token) {
                    accumulated += token;
                    setCurrentStreamedText(accumulated);
                  }
                } catch {
                  // Non-JSON data line — may be a raw token
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
            const assistantMsg: ChatMessage = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: accumulated,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, assistantMsg]);

            try {
              await addChatMessage(user.uid, {
                role: 'assistant',
                content: accumulated,
              });
            } catch (err) {
              console.error('Failed to persist assistant message:', err);
            }
          }
        } else {
          // Non-streaming JSON response
          const data = await response.json();
          const assistantContent =
            data.choices?.[0]?.message?.content ?? data.content ?? '';

          if (assistantContent) {
            const assistantMsg: ChatMessage = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: assistantContent,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, assistantMsg]);
            setCurrentStreamedText(assistantContent);

            try {
              await addChatMessage(user.uid, {
                role: 'assistant',
                content: assistantContent,
              });
            } catch (err) {
              console.error('Failed to persist assistant message:', err);
            }
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Chat stream error:', err);
          const errorMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'system',
            content: 'Sorry, something went wrong. Please try again.',
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

      try {
        await addChatMessage(user.uid, { role: 'system', content });
      } catch (err) {
        console.error('Failed to persist system message:', err);
      }
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
