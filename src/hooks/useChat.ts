/**
 * useChat Hook
 *
 * Convenience wrapper around useChatContext for cleaner imports.
 */

import { useChatContext } from '@/contexts/ChatContext';

export function useChat() {
  const {
    messages,
    isStreaming,
    currentStreamedText,
    sendMessage,
    clearHistory,
  } = useChatContext();

  return {
    messages,
    isStreaming,
    currentStreamedText,
    sendMessage,
    clearHistory,
  };
}
