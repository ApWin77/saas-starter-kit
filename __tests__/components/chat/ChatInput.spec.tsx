import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ChatInput } from '@/components/chat/ChatInput';

describe('ChatInput', () => {
  const mockOnSend = jest.fn();

  beforeEach(() => {
    mockOnSend.mockClear();
  });

  it('renders correctly', () => {
    render(<ChatInput onSend={mockOnSend} />);
    
    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
  });

  it('renders with custom placeholder', () => {
    render(<ChatInput onSend={mockOnSend} placeholder="Ask a question..." />);
    
    expect(screen.getByPlaceholderText('Ask a question...')).toBeInTheDocument();
  });

  it('calls onSend when submit button is clicked', () => {
    render(<ChatInput onSend={mockOnSend} />);
    
    const textarea = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    
    const submitButton = screen.getByRole('button');
    fireEvent.click(submitButton);
    
    expect(mockOnSend).toHaveBeenCalledWith('Hello');
  });

  it('calls onSend when Enter is pressed without Shift', () => {
    render(<ChatInput onSend={mockOnSend} />);
    
    const textarea = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(textarea, { target: { value: 'Test message' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    
    expect(mockOnSend).toHaveBeenCalledWith('Test message');
  });

  it('does not call onSend when Enter is pressed with Shift', () => {
    render(<ChatInput onSend={mockOnSend} />);
    
    const textarea = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(textarea, { target: { value: 'Test message' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    
    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it('does not call onSend with empty text', () => {
    render(<ChatInput onSend={mockOnSend} />);
    
    const submitButton = screen.getByRole('button');
    fireEvent.click(submitButton);
    
    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it('does not call onSend with whitespace-only text', () => {
    render(<ChatInput onSend={mockOnSend} />);
    
    const textarea = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(textarea, { target: { value: '   ' } });
    
    const submitButton = screen.getByRole('button');
    fireEvent.click(submitButton);
    
    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it('clears input after sending', () => {
    render(<ChatInput onSend={mockOnSend} />);
    
    const textarea = screen.getByPlaceholderText('Type your message...') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    
    const submitButton = screen.getByRole('button');
    fireEvent.click(submitButton);
    
    expect(textarea.value).toBe('');
  });

  it('disables input when isLoading is true', () => {
    render(<ChatInput onSend={mockOnSend} isLoading={true} />);
    
    const textarea = screen.getByPlaceholderText('Type your message...');
    expect(textarea).toBeDisabled();
  });

  it('shows character count', () => {
    render(<ChatInput onSend={mockOnSend} maxLength={100} />);
    
    expect(screen.getByText('100 / 100')).toBeInTheDocument();
    
    const textarea = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    
    expect(screen.getByText('95 / 100')).toBeInTheDocument();
  });

  it('shows warning when near character limit', () => {
    render(<ChatInput onSend={mockOnSend} maxLength={100} />);
    
    const textarea = screen.getByPlaceholderText('Type your message...');
    // Type 95 characters to leave only 5 remaining (near limit)
    fireEvent.change(textarea, { target: { value: 'a'.repeat(95) } });
    
    // Character count should show warning color (amber)
    const charCount = screen.getByText('5 / 100');
    expect(charCount).toHaveClass('text-amber-500');
  });

  it('disables submit when over character limit', () => {
    render(<ChatInput onSend={mockOnSend} maxLength={10} />);
    
    const textarea = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(textarea, { target: { value: 'This is too long' } });
    
    const submitButton = screen.getByRole('button');
    expect(submitButton).toBeDisabled();
  });
});
