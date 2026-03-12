import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * LLMs occasionally emit GFM tables with all rows collapsed onto a single line
 * (no newlines between header, separator, and data rows). remark-gfm requires
 * each row on its own line to parse correctly, so we normalize before rendering.
 *
 * Detects the pattern:  | cells | <space> |---|---| <space> | cells |
 * and splits at row boundaries. Already-correct multi-line tables are unchanged.
 */
function normalizeMarkdownTables(content: string): string {
  return content.replace(
    /(\|[^\n]+\|)\s+(\|[-| :]+\|)\s+(\|[^\n]+(?:\s+\|[^\n]+\|)*)/g,
    (match) => match.split(/(?<=\|)\s+(?=\|)/).join('\n')
  );
}

interface Props {
  role: 'user' | 'assistant';
  content: string;
  agentName?: string;
  streaming?: boolean;
  error?: string;
  onRetry?: () => void;
}

export const ChatMessage = memo(function ChatMessage({ role, content, agentName, streaming, error, onRetry }: Props) {
  const isUser = role === 'user';

  if (error) {
    return (
      <div className="flex justify-start mb-3">
        <div className="max-w-[80%] rounded-lg px-4 py-2 overflow-hidden bg-red-900/60 border border-red-500/40 text-red-200">
          <div className="text-xs text-red-400 mb-1 font-medium">Error</div>
          <div className="text-sm">{content}</div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 px-3 py-1 text-xs rounded bg-red-700 hover:bg-red-600 text-white transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 overflow-hidden ${
          isUser
            ? 'bg-accent text-white'
            : 'bg-surface-overlay text-text-primary'
        }`}
      >
        {!isUser && agentName && (
          <div className="text-xs text-text-secondary mb-1 font-medium">{agentName}</div>
        )}
        <div className="prose prose-invert prose-sm max-w-none break-words [overflow-wrap:anywhere] [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_code]:break-all">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{normalizeMarkdownTables(content)}</ReactMarkdown>
        </div>
        {streaming && (
          <span className="inline-block w-2 h-4 bg-accent animate-pulse ml-1" />
        )}
      </div>
    </div>
  );
});
