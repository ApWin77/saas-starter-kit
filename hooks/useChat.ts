import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { useState, useCallback } from 'react';
import fetcher from '@/lib/fetcher';
import type {
  ChatMessageData,
  ChatThread,
  SendMessageResponse,
} from '@/components/chat/types';

interface MessagesResponse {
  messages: ChatMessageData[];
  total: number;
  has_more: boolean;
}

interface ThreadResponse extends ChatThread {}

async function sendMessage(
  url: string,
  { arg }: { arg: { text: string } }
): Promise<SendMessageResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(arg),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to send message');
  }

  return response.json();
}

export const useChat = (threadId?: string) => {
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessageData[]>([]);

  // Fetch thread details
  const {
    data: thread,
    error: threadError,
    isLoading: threadLoading,
    mutate: mutateThread,
  } = useSWR<ThreadResponse>(
    threadId ? `/api/chat/threads/${threadId}` : null,
    fetcher
  );

  // Fetch messages
  const {
    data: messagesData,
    error: messagesError,
    isLoading: messagesLoading,
    mutate: mutateMessages,
  } = useSWR<MessagesResponse>(
    threadId ? `/api/chat/threads/${threadId}/messages` : null,
    fetcher,
    {
      refreshInterval: 0, // Don't auto-refresh
      revalidateOnFocus: false,
    }
  );

  // Send message mutation
  const {
    trigger: triggerSend,
    isMutating: isSending,
    error: sendError,
  } = useSWRMutation(
    threadId ? `/api/chat/threads/${threadId}/messages` : null,
    sendMessage
  );

  // Combined messages (fetched + optimistic)
  const messages = messagesData?.messages || [];
  const allMessages = [...messages, ...optimisticMessages];

  // Send message handler
  const sendMessageHandler = useCallback(
    async (text: string) => {
      if (!threadId) return null;

      // Add optimistic user message
      const optimisticUserMsg: ChatMessageData = {
        id: `temp-${Date.now()}`,
        thread_id: threadId,
        sender: 'USER',
        text,
        citations: [],
        created_at: new Date().toISOString(),
      };
      setOptimisticMessages((prev) => [...prev, optimisticUserMsg]);

      try {
        const response = await triggerSend({ text });

        // Clear optimistic messages and revalidate
        setOptimisticMessages([]);
        await mutateMessages();
        await mutateThread();

        return response;
      } catch (error) {
        // Remove failed optimistic message
        setOptimisticMessages((prev) =>
          prev.filter((m) => m.id !== optimisticUserMsg.id)
        );
        throw error;
      }
    },
    [threadId, triggerSend, mutateMessages, mutateThread]
  );

  return {
    thread,
    messages: allMessages,
    isLoading: threadLoading || messagesLoading,
    isSending,
    error: threadError || messagesError || sendError,
    sendMessage: sendMessageHandler,
    mutateMessages,
    mutateThread,
  };
};

// Hook for creating a new thread
async function createThread(
  url: string,
  { arg }: { arg: { course_id?: string; title?: string } }
): Promise<ChatThread> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(arg),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create thread');
  }

  return response.json();
}

export const useCreateThread = () => {
  const {
    trigger,
    isMutating: isCreating,
    error,
  } = useSWRMutation('/api/chat/threads', createThread);

  return {
    createThread: trigger,
    isCreating,
    error,
  };
};
