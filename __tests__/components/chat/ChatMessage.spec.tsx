import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ChatMessage } from '@/components/chat/ChatMessage';
import type { ChatMessageData } from '@/components/chat/types';

// Mock react-markdown to avoid ESM issues in Jest
jest.mock('react-markdown', () => {
  return function MockReactMarkdown({ children }: { children: string }) {
    return <div data-testid="markdown">{children}</div>;
  };
});

jest.mock('remark-gfm', () => () => {});

describe('ChatMessage', () => {
  const baseUserMessage: ChatMessageData = {
    id: 'msg-1',
    thread_id: 'thread-1',
    sender: 'USER',
    text: 'Hello, I have a question about the course.',
    citations: [],
    created_at: new Date().toISOString(),
  };

  const baseAssistantMessage: ChatMessageData = {
    id: 'msg-2',
    thread_id: 'thread-1',
    sender: 'ASSISTANT',
    text: 'Sure, I can help you with that.',
    answer_mode: 'COURSE_GROUNDED',
    citations: [],
    created_at: new Date().toISOString(),
  };

  it('renders user message correctly', () => {
    render(<ChatMessage message={baseUserMessage} />);
    
    expect(screen.getByText('Hello, I have a question about the course.')).toBeInTheDocument();
  });

  it('renders assistant message correctly', () => {
    render(<ChatMessage message={baseAssistantMessage} />);
    
    expect(screen.getByText('Sure, I can help you with that.')).toBeInTheDocument();
  });

  it('shows outside material badge when answer_mode is OUTSIDE_MATERIAL', () => {
    const outsideMessage: ChatMessageData = {
      ...baseAssistantMessage,
      answer_mode: 'OUTSIDE_MATERIAL',
    };

    render(<ChatMessage message={outsideMessage} />);
    
    expect(screen.getByText('Outside Course Material')).toBeInTheDocument();
  });

  it('does not show outside material badge for grounded answers', () => {
    render(<ChatMessage message={baseAssistantMessage} />);
    
    expect(screen.queryByText('Outside Course Material')).not.toBeInTheDocument();
  });

  it('shows citation toggle when citations are present', () => {
    const messageWithCitations: ChatMessageData = {
      ...baseAssistantMessage,
      citations: [
        {
          chunk_id: 'chunk-1',
          content_file_id: 'file-1',
          source_title: 'Lecture 3',
          page_number: 12,
          section_heading: 'Introduction',
          snippet: 'This is a snippet from the lecture.',
        },
      ],
    };

    render(<ChatMessage message={messageWithCitations} />);
    
    expect(screen.getByText(/Show 1 source/)).toBeInTheDocument();
  });

  it('toggles citation visibility on click', () => {
    const messageWithCitations: ChatMessageData = {
      ...baseAssistantMessage,
      citations: [
        {
          chunk_id: 'chunk-1',
          content_file_id: 'file-1',
          source_title: 'Lecture 3',
          page_number: 12,
          section_heading: 'Introduction',
          snippet: 'This is a snippet from the lecture.',
        },
      ],
    };

    render(<ChatMessage message={messageWithCitations} />);
    
    const toggleButton = screen.getByText(/Show 1 source/);
    fireEvent.click(toggleButton);
    
    expect(screen.getByText('Lecture 3')).toBeInTheDocument();
  });

  it('displays timestamp correctly', () => {
    const fixedDate = new Date('2024-01-15T10:30:00Z');
    const messageWithFixedTime: ChatMessageData = {
      ...baseUserMessage,
      created_at: fixedDate.toISOString(),
    };

    render(<ChatMessage message={messageWithFixedTime} />);
    
    // The time should be displayed in HH:MM format
    // Note: exact format depends on user's locale
    const timeRegex = /\d{1,2}:\d{2}/;
    const timeElement = screen.getByText(timeRegex);
    expect(timeElement).toBeInTheDocument();
  });
});
