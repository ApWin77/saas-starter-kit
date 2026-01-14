import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';

interface ChatInputProps {
  onSend: (text: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  maxLength?: number;
}

export const ChatInput = ({
  onSend,
  isLoading = false,
  placeholder = 'Type your message...',
  maxLength = 4000,
}: ChatInputProps) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [text]);

  const handleSubmit = () => {
    const trimmedText = text.trim();
    if (trimmedText && !isLoading) {
      onSend(trimmedText);
      setText('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const remainingChars = maxLength - text.length;
  const isNearLimit = remainingChars <= 100;
  const isOverLimit = remainingChars < 0;

  return (
    <div className="relative">
      <div className="flex items-end gap-2 rounded-2xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-colors">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          rows={1}
          className="flex-1 resize-none bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none disabled:opacity-50 text-sm leading-6"
          style={{ maxHeight: '200px' }}
        />
        
        <button
          onClick={handleSubmit}
          disabled={isLoading || !text.trim() || isOverLimit}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <PaperAirplaneIcon className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Character count */}
      <div className="flex items-center justify-between mt-2 px-2">
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Press Enter to send, Shift+Enter for new line
        </p>
        <p
          className={`text-xs ${
            isOverLimit
              ? 'text-red-500'
              : isNearLimit
              ? 'text-amber-500'
              : 'text-gray-400 dark:text-gray-500'
          }`}
        >
          {remainingChars.toLocaleString()} / {maxLength.toLocaleString()}
        </p>
      </div>
    </div>
  );
};
