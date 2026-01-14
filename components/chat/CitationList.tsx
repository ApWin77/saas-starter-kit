import { useState } from 'react';
import { DocumentTextIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { Citation } from './types';

interface CitationListProps {
  citations: Citation[];
}

export const CitationList = ({ citations }: CitationListProps) => {
  return (
    <div className="space-y-2">
      {citations.map((citation, index) => (
        <CitationItem key={citation.chunk_id} citation={citation} index={index + 1} />
      ))}
    </div>
  );
};

interface CitationItemProps {
  citation: Citation;
  index: number;
}

const CitationItem = ({ citation, index }: CitationItemProps) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        {/* Index badge */}
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50 text-xs font-medium text-blue-700 dark:text-blue-300">
          {index}
        </span>

        {/* Source info */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <DocumentTextIcon className="h-4 w-4 text-gray-400 shrink-0" />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {citation.source_title}
          </span>
          {citation.page_number && (
            <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
              Page {citation.page_number}
            </span>
          )}
        </div>

        {/* Expand icon */}
        {expanded ? (
          <ChevronUpIcon className="h-4 w-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronDownIcon className="h-4 w-4 text-gray-400 shrink-0" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3">
          {citation.section_heading && (
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              Section: {citation.section_heading}
            </p>
          )}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-md p-3">
            <p className="text-sm text-gray-700 dark:text-gray-300 italic">
              &quot;{citation.snippet}&quot;
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// Inline citation badge for use within text
export const InlineCitation = ({
  index,
  onClick,
}: {
  index: number;
  onClick?: () => void;
}) => {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center h-5 min-w-[1.25rem] px-1 rounded-full bg-blue-100 dark:bg-blue-900/50 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
    >
      {index}
    </button>
  );
};
