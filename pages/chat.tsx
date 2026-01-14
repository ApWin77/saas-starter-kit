import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { getSession } from 'next-auth/react';
import toast from 'react-hot-toast';

import { ChatLayout, ThreadSidebar, ChatArea } from '@/components/chat';
import { useChat, useCreateThread } from 'hooks/useChat';
import { useChatThreads } from 'hooks/useChatThreads';
import type { NextPageWithLayout } from 'types';

const ChatPage: NextPageWithLayout = () => {
  const router = useRouter();
  const { threadId } = router.query;
  const currentThreadId = typeof threadId === 'string' ? threadId : undefined;

  const [activeThreadId, setActiveThreadId] = useState<string | undefined>(currentThreadId);

  // Fetch threads
  const {
    threads,
    isLoading: threadsLoading,
    deleteThread,
    mutate: mutateThreads,
  } = useChatThreads();

  // Fetch current chat
  const {
    thread,
    messages,
    isLoading: chatLoading,
    isSending,
    error: chatError,
    sendMessage,
  } = useChat(activeThreadId);

  // Create thread mutation
  const { createThread, isCreating } = useCreateThread();

  // Sync URL with active thread
  useEffect(() => {
    if (currentThreadId && currentThreadId !== activeThreadId) {
      setActiveThreadId(currentThreadId);
    }
  }, [currentThreadId, activeThreadId]);

  // Handle new chat
  const handleNewChat = useCallback(async () => {
    try {
      const newThread = await createThread({});
      setActiveThreadId(newThread.id);
      mutateThreads();
      router.push(`/chat?threadId=${newThread.id}`, undefined, { shallow: true });
    } catch (error) {
      toast.error('Failed to create new chat');
    }
  }, [createThread, mutateThreads, router]);

  // Handle thread selection
  const handleSelectThread = useCallback(
    (id: string) => {
      setActiveThreadId(id);
      router.push(`/chat?threadId=${id}`, undefined, { shallow: true });
    },
    [router]
  );

  // Handle thread deletion
  const handleDeleteThread = useCallback(
    async (id: string) => {
      if (!confirm('Are you sure you want to delete this conversation?')) {
        return;
      }

      try {
        await deleteThread(id);
        toast.success('Conversation deleted');

        // If we deleted the active thread, clear the selection
        if (id === activeThreadId) {
          setActiveThreadId(undefined);
          router.push('/chat', undefined, { shallow: true });
        }
      } catch (error) {
        toast.error('Failed to delete conversation');
      }
    },
    [deleteThread, activeThreadId, router]
  );

  // Handle sending a message
  const handleSendMessage = useCallback(
    async (text: string) => {
      // If no active thread, create one first
      if (!activeThreadId) {
        try {
          const newThread = await createThread({ title: text.slice(0, 50) });
          setActiveThreadId(newThread.id);
          mutateThreads();
          router.push(`/chat?threadId=${newThread.id}`, undefined, { shallow: true });

          // Wait a moment for state to update, then send message
          // We need to use the new thread ID directly since state hasn't updated yet
          const response = await fetch(`/api/chat/threads/${newThread.id}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
          });

          if (!response.ok) {
            throw new Error('Failed to send message');
          }

          // Refresh the threads list
          mutateThreads();
        } catch (error) {
          toast.error('Failed to start conversation');
        }
        return;
      }

      try {
        await sendMessage(text);
        mutateThreads(); // Update thread list to show latest message preview
      } catch (error: any) {
        if (error.message.includes('budget')) {
          toast.error('Daily message limit reached. Please try again tomorrow.');
        } else {
          toast.error(error.message || 'Failed to send message');
        }
      }
    },
    [activeThreadId, sendMessage, createThread, mutateThreads, router]
  );

  return (
    <ChatLayout
      sidebar={
        <ThreadSidebar
          threads={threads}
          activeThreadId={activeThreadId}
          onNewChat={handleNewChat}
          onSelectThread={handleSelectThread}
          onDeleteThread={handleDeleteThread}
          isLoading={threadsLoading}
        />
      }
    >
      <ChatArea
        messages={messages}
        onSendMessage={handleSendMessage}
        isLoading={chatLoading || isSending || isCreating}
        error={chatError?.message}
        threadTitle={thread?.title}
      />
    </ChatLayout>
  );
};

// No layout wrapper - ChatLayout handles its own layout
ChatPage.getLayout = (page) => page;

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const session = await getSession(context);

  if (!session) {
    return {
      redirect: {
        destination: '/auth/login',
        permanent: false,
      },
    };
  }

  return {
    props: {
      ...(context.locale
        ? await serverSideTranslations(context.locale, ['common'])
        : {}),
    },
  };
}

export default ChatPage;
