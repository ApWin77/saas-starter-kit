import { useState } from 'react';
import {
  UserCircleIcon,
  AcademicCapIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { ChatMessageData } from './types';
import { CitationList } from './CitationList';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMessageProps {
  message: ChatMessageData;
}

export const ChatMessage = ({ message }: ChatMessageProps) => {
  const [showCitations, setShowCitations] = useState(false);
  const isUser = message.sender === 'USER';
  const isOutsideMaterial = message.answer_mode === 'OUTSIDE_MATERIAL';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`flex items-start gap-3 max-w-3xl ${isUser ? 'flex-row-reverse' : ''}`}
      >
        {/* Avatar */}
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            isUser
              ? 'bg-gray-200 dark:bg-gray-700'
              : 'bg-gradient-to-br from-blue-500 to-indigo-600'
          }`}
        >
          {isUser ? (
            <UserCircleIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          ) : (
            <AcademicCapIcon className="h-5 w-5 text-white" />
          )}
        </div>

        {/* Message bubble */}
        <div className="flex flex-col gap-2">
          {/* Outside material badge */}
          {!isUser && isOutsideMaterial && (
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <ExclamationTriangleIcon className="h-4 w-4" />
              <span className="text-xs font-medium">
                Outside Course Material
              </span>
            </div>
          )}

          {/* Message content */}
          <div
            className={`rounded-2xl px-4 py-3 ${
              isUser
                ? 'rounded-tr-none bg-blue-500 text-white'
                : 'rounded-tl-none bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            }`}
          >
            {isUser ? (
              <p className="text-sm whitespace-pre-wrap">{message.text}</p>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    // Custom styling for code blocks
                    code({ node, inline, className, children, ...props }) {
                      return inline ? (
                        <code
                          className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-sm"
                          {...props}
                        >
                          {children}
                        </code>
                      ) : (
                        <code
                          className="block bg-gray-200 dark:bg-gray-700 p-3 rounded-lg overflow-x-auto text-sm"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    },
                    // Custom styling for links
                    a({ node, children, ...props }) {
                      return (
                        <a
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                          target="_blank"
                          rel="noopener noreferrer"
                          {...props}
                        >
                          {children}
                        </a>
                      );
                    },
                  }}
                >
                  {message.text}
                </ReactMarkdown>
              </div>
            )}
          </div>

          {/* Citations */}
          {!isUser && message.citations && message.citations.length > 0 && (
            <div>
              <button
                onClick={() => setShowCitations(!showCitations)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <span>
                  {showCitations ? 'Hide' : 'Show'} {message.citations.length}{' '}
                  source
                  {message.citations.length > 1 ? 's' : ''}
                </span>
              </button>
              {showCitations && (
                <div className="mt-2">
                  <CitationList citations={message.citations} />
                </div>
              )}
            </div>
          )}

          {/* Timestamp */}
          <p
            className={`text-xs text-gray-400 dark:text-gray-500 ${isUser ? 'text-right' : ''}`}
          >
            {new Date(message.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      </div>
    </div>
  );
};
