import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { useCallback } from 'react';
import fetcher from '@/lib/fetcher';
import type { ChatThread } from '@/components/chat/types';

interface ThreadsResponse {
  threads: ChatThread[];
  total: number;
  has_more: boolean;
}

async function deleteThreadRequest(
  url: string
): Promise<{ success: boolean }> {
  const response = await fetch(url, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete thread');
  }

  return response.json();
}

export const useChatThreads = (courseId?: string) => {
  const queryParams = courseId ? `?course_id=${courseId}` : '';

  // Fetch threads
  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR<ThreadsResponse>(
    `/api/chat/threads${queryParams}`,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
    }
  );

  const threads = data?.threads || [];
  const total = data?.total || 0;
  const hasMore = data?.has_more || false;

  // Delete thread handler
  const deleteThread = useCallback(
    async (threadId: string) => {
      // Optimistic update
      const previousData = data;
      mutate(
        {
          threads: threads.filter((t) => t.id !== threadId),
          total: total - 1,
          has_more: hasMore,
        },
        false
      );

      try {
        await fetch(`/api/chat/threads/${threadId}`, {
          method: 'DELETE',
        });
        // Revalidate after deletion
        mutate();
      } catch (error) {
        // Rollback on error
        mutate(previousData, false);
        throw error;
      }
    },
    [data, threads, total, hasMore, mutate]
  );

  return {
    threads,
    total,
    hasMore,
    isLoading,
    error,
    deleteThread,
    mutate,
  };
};

// Hook for loading more threads (pagination)
export const useChatThreadsPaginated = (
  courseId?: string,
  limit: number = 20
) => {
  const queryParams = new URLSearchParams();
  if (courseId) queryParams.set('course_id', courseId);
  queryParams.set('limit', String(limit));

  const {
    data,
    error,
    isLoading,
    size,
    setSize,
    mutate,
  } = useSWR<ThreadsResponse>(
    `/api/chat/threads?${queryParams.toString()}`,
    fetcher
  );

  const threads = data?.threads || [];
  const hasMore = data?.has_more || false;

  const loadMore = useCallback(() => {
    // For infinite loading, we'd use useSWRInfinite
    // For now, this is a placeholder
  }, []);

  return {
    threads,
    isLoading,
    error,
    hasMore,
    loadMore,
    mutate,
  };
};
