import { useRef, useEffect } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ChatMessageData } from './types';
import { AcademicCapIcon, ChatBubbleBottomCenterTextIcon } from '@heroicons/react/24/outline';

interface ChatAreaProps {
  messages: ChatMessageData[];
  onSendMessage: (text: string) => void;
  isLoading?: boolean;
  error?: string | null;
  threadTitle?: string;
}

export const ChatArea = ({
  messages,
  onSendMessage,
  isLoading = false,
  error = null,
  threadTitle,
}: ChatAreaProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="hidden lg:flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600">
            <AcademicCapIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              {threadTitle || 'AI Course Tutor'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Ask questions about your course materials
            </p>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-6"
      >
        {messages.length === 0 ? (
          <EmptyState onSendMessage={onSendMessage} />
        ) : (
          <>
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isLoading && <LoadingIndicator />}
            {error && <ErrorMessage message={error} />}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-4">
        <ChatInput
          onSend={onSendMessage}
          isLoading={isLoading}
          placeholder="Ask a question about the course..."
        />
      </div>
    </div>
  );
};

const EmptyState = ({ onSendMessage }: { onSendMessage: (text: string) => void }) => {
  const suggestions = [
    'Explain the main concepts from today\'s lecture',
    'Help me understand the homework assignment',
    'What are the key takeaways from this week?',
    'Can you summarize the reading material?',
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full py-12 px-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 mb-6">
        <AcademicCapIcon className="h-10 w-10 text-white" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Welcome to AI Course Tutor
      </h2>
      <p className="text-gray-600 dark:text-gray-400 text-center max-w-md mb-8">
        I&apos;m here to help you understand your course materials. Ask me anything about the lectures, assignments, or concepts you&apos;re studying.
      </p>
      
      <div className="w-full max-w-lg">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Try asking:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => onSendMessage(suggestion)}
              className="flex items-center gap-2 px-4 py-3 text-left text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors"
            >
              <ChatBubbleBottomCenterTextIcon className="h-4 w-4 text-gray-400 shrink-0" />
              <span className="line-clamp-2">{suggestion}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const LoadingIndicator = () => (
  <div className="flex justify-start">
    <div className="flex items-start gap-3 max-w-3xl">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600">
        <AcademicCapIcon className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1 rounded-2xl rounded-tl-none bg-gray-100 dark:bg-gray-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  </div>
);

const ErrorMessage = ({ message }: { message: string }) => (
  <div className="flex justify-center">
    <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
      {message}
    </div>
  </div>
);
