'use client';

import React, { useEffect, useRef } from 'react';
import { useChatContext } from '@/contexts/ChatContext';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';

export default function ChatPanel() {
  const {
    messages,
    isStreaming,
    currentStreamedText,
    sendMessage,
  } = useChatContext();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStreamedText]);

  return (
    <div className="flex flex-col h-full glass overflow-hidden border border-white/20">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <h2 className="text-sm font-semibold text-white">
          AI Assistant
        </h2>
        {isStreaming && (
          <span className="ml-auto text-xs text-white/50">typing…</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-1 bg-transparent scrollbar-glass">
        {messages.length === 0 && !isStreaming && (
          <div className="flex items-center justify-center h-full text-white/50 text-sm">
            <div className="text-center px-8">
              <div className="text-3xl mb-3">💬</div>
              <p className="font-medium">Start a conversation</p>
              <p className="text-xs mt-1 opacity-70">
                Ask me to plan your day, adjust your schedule, or anything else.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {isStreaming && currentStreamedText && (
          <ChatMessage
            message={{
              id: '__streaming__',
              role: 'assistant',
              content: currentStreamedText,
              timestamp: new Date(),
            }}
            isStreaming
          />
        )}

        {isStreaming && !currentStreamedText && (
          <div className="flex items-center gap-2 px-4 ml-9">
            <div className="flex gap-1">
              <span className="h-2 w-2 rounded-full bg-white/40 animate-bounce [animation-delay:0ms]" />
              <span className="h-2 w-2 rounded-full bg-white/40 animate-bounce [animation-delay:150ms]" />
              <span className="h-2 w-2 rounded-full bg-white/40 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <ChatInput onSend={sendMessage} disabled={isStreaming} />
    </div>
  );
}
