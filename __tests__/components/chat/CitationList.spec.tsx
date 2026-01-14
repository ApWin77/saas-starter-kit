import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CitationList, InlineCitation } from '@/components/chat/CitationList';
import type { Citation } from '@/components/chat/types';

describe('CitationList', () => {
  const mockCitations: Citation[] = [
    {
      chunk_id: 'chunk-1',
      content_file_id: 'file-1',
      source_title: 'Lecture 3: Introduction to Algorithms',
      page_number: 12,
      section_heading: 'Binary Search',
      snippet: 'Binary search is an efficient algorithm for finding an item in a sorted list...',
    },
    {
      chunk_id: 'chunk-2',
      content_file_id: 'file-2',
      source_title: 'Lecture 4: Data Structures',
      page_number: 5,
      section_heading: 'Hash Tables',
      snippet: 'A hash table is a data structure that implements an associative array...',
    },
  ];

  it('renders all citations', () => {
    render(<CitationList citations={mockCitations} />);
    
    expect(screen.getByText('Lecture 3: Introduction to Algorithms')).toBeInTheDocument();
    expect(screen.getByText('Lecture 4: Data Structures')).toBeInTheDocument();
  });

  it('displays citation indices', () => {
    render(<CitationList citations={mockCitations} />);
    
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('displays page numbers', () => {
    render(<CitationList citations={mockCitations} />);
    
    expect(screen.getByText('Page 12')).toBeInTheDocument();
    expect(screen.getByText('Page 5')).toBeInTheDocument();
  });

  it('expands citation on click', () => {
    render(<CitationList citations={mockCitations} />);
    
    // Citation snippet should not be visible initially
    expect(screen.queryByText(/Binary search is an efficient/)).not.toBeInTheDocument();
    
    // Click to expand
    const firstCitation = screen.getByText('Lecture 3: Introduction to Algorithms');
    fireEvent.click(firstCitation);
    
    // Now snippet should be visible
    expect(screen.getByText(/Binary search is an efficient/)).toBeInTheDocument();
  });

  it('shows section heading when expanded', () => {
    render(<CitationList citations={mockCitations} />);
    
    // Expand the first citation
    const firstCitation = screen.getByText('Lecture 3: Introduction to Algorithms');
    fireEvent.click(firstCitation);
    
    expect(screen.getByText('Section: Binary Search')).toBeInTheDocument();
  });

  it('collapses citation on second click', () => {
    render(<CitationList citations={mockCitations} />);
    
    const firstCitation = screen.getByText('Lecture 3: Introduction to Algorithms');
    
    // Expand
    fireEvent.click(firstCitation);
    expect(screen.getByText(/Binary search is an efficient/)).toBeInTheDocument();
    
    // Collapse
    fireEvent.click(firstCitation);
    expect(screen.queryByText(/Binary search is an efficient/)).not.toBeInTheDocument();
  });

  it('handles citations without page numbers', () => {
    const citationsWithoutPage: Citation[] = [
      {
        ...mockCitations[0],
        page_number: undefined,
      },
    ];
    
    render(<CitationList citations={citationsWithoutPage} />);
    
    expect(screen.queryByText(/Page/)).not.toBeInTheDocument();
  });

  it('handles citations without section headings', () => {
    const citationsWithoutSection: Citation[] = [
      {
        ...mockCitations[0],
        section_heading: undefined,
      },
    ];
    
    render(<CitationList citations={citationsWithoutSection} />);
    
    // Expand citation
    const citation = screen.getByText('Lecture 3: Introduction to Algorithms');
    fireEvent.click(citation);
    
    expect(screen.queryByText(/Section:/)).not.toBeInTheDocument();
  });
});

describe('InlineCitation', () => {
  it('renders with correct index', () => {
    render(<InlineCitation index={5} />);
    
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const mockOnClick = jest.fn();
    render(<InlineCitation index={3} onClick={mockOnClick} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('renders as a button', () => {
    render(<InlineCitation index={1} />);
    
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
