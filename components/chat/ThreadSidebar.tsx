import { PlusIcon, ChatBubbleLeftIcon, TrashIcon } from '@heroicons/react/24/outline';
import { ChatThread } from './types';
import { formatDistanceToNow } from 'date-fns';

interface ThreadSidebarProps {
  threads: ChatThread[];
  activeThreadId?: string;
  onNewChat: () => void;
  onSelectThread: (threadId: string) => void;
  onDeleteThread: (threadId: string) => void;
  isLoading?: boolean;
}

export const ThreadSidebar = ({
  threads,
  activeThreadId,
  onNewChat,
  onSelectThread,
  onDeleteThread,
  isLoading = false,
}: ThreadSidebarProps) => {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Chat History
        </h2>
      </div>

      {/* New Chat Button */}
      <div className="p-4">
        <button
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          New Chat
        </button>
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto px-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : threads.length === 0 ? (
          <div className="text-center py-8 px-4">
            <ChatBubbleLeftIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              No conversations yet
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Start a new chat to begin
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {threads.map((thread) => (
              <div
                key={thread.id}
                className={`
                  group relative flex items-start gap-3 rounded-lg px-3 py-3 cursor-pointer
                  transition-colors
                  ${
                    activeThreadId === thread.id
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300'
                  }
                `}
                onClick={() => onSelectThread(thread.id)}
              >
                <ChatBubbleLeftIcon className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {thread.title || 'New conversation'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                    {thread.last_message_preview || 'No messages yet'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteThread(thread.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-all"
                  title="Delete conversation"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3">
        <p className="text-xs text-center text-gray-500 dark:text-gray-400">
          AI Course Tutor v1.0
        </p>
      </div>
    </div>
  );
};
