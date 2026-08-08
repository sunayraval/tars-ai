'use client';

import React from 'react';
import type { ChatMessage as ChatMessageType } from '@/lib/firebase/firestore';

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
}

import { motion } from 'framer-motion';

export default function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const { role, content, timestamp } = message;

  const time =
    timestamp instanceof Date
      ? timestamp
      : typeof timestamp === 'string'
        ? new Date(timestamp)
        : (timestamp as any)?.toDate?.()
          ? (timestamp as any).toDate()
          : new Date();

  const timeStr = time.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (role === 'system') {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-center my-2 px-4"
      >
        <div className="max-w-md rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-xs text-white/50 text-center">
          <RenderMarkdown text={content} />
          <span className="block mt-1 text-[10px] opacity-60 text-white/30">{timeStr}</span>
        </div>
      </motion.div>
    );
  }

  const isUser = role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3 px-4`}
    >
      {!isUser && (
        <div className="flex-shrink-0 mr-2 mt-1">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold glow-violet">
            AI
          </div>
        </div>
      )}

      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-br-md glow-violet'
            : 'glass bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-bl-md'
        }`}
      >
        <RenderMarkdown text={content} />

        {isStreaming && (
          <span className="inline-block ml-0.5 w-1.5 h-4 bg-current animate-pulse rounded-sm" />
        )}

        <span
          className={`block mt-1 text-[10px] ${
            isUser ? 'text-white/60' : 'text-white/40'
          }`}
        >
          {timeStr}
        </span>
      </div>

      {isUser && (
        <div className="flex-shrink-0 ml-2 mt-1">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold shadow-lg">
            U
          </div>
        </div>
      )}
    </motion.div>
  );
}

function RenderMarkdown({ text }: { text: string }) {
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const code = part.slice(3, -3).replace(/^\w*\n/, '');
          return (
            <pre
              key={i}
              className="my-2 rounded-md bg-black/40 text-white/90 p-3 text-xs overflow-x-auto font-mono scrollbar-glass"
            >
              <code>{code}</code>
            </pre>
          );
        }
        return <InlinePart key={i} text={part} />;
      })}
    </>
  );
}

function InlinePart({ text }: { text: string }) {
  const lines = text.split('\n');

  return (
    <>
      {lines.map((line, li) => {
        const trimmed = line.trim();

        if (/^[-•*]\s/.test(trimmed)) {
          return (
            <div key={li} className="flex gap-1.5 ml-2">
              <span className="select-none">•</span>
              <span>{formatInline(trimmed.replace(/^[-•*]\s/, ''))}</span>
            </div>
          );
        }

        if (/^\d+[.)]\s/.test(trimmed)) {
          const match = trimmed.match(/^(\d+[.)]\s)(.*)/);
          return (
            <div key={li} className="flex gap-1.5 ml-2">
              <span className="select-none">{match?.[1]}</span>
              <span>{formatInline(match?.[2] ?? '')}</span>
            </div>
          );
        }

        return (
          <React.Fragment key={li}>
            {li > 0 && <br />}
            {formatInline(line)}
          </React.Fragment>
        );
      })}
    </>
  );
}

function formatInline(text: string): React.ReactNode {
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);

  return tokens.map((token, i) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('*') && token.endsWith('*')) {
      return <em key={i} className="text-white/90">{token.slice(1, -1)}</em>;
    }
    if (token.startsWith('`') && token.endsWith('`')) {
      return (
        <code
          key={i}
          className="mx-0.5 rounded bg-black/30 border border-white/10 px-1 py-0.5 text-xs font-mono text-violet-300"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    return token;
  });
}
