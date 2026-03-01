import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  role: 'user' | 'assistant';
  content: string;
  agentName?: string;
  streaming?: boolean;
  error?: string;
  onRetry?: () => void;
}

export function ChatMessage({ role, content, agentName, streaming, error, onRetry }: Props) {
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
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
        {streaming && (
          <span className="inline-block w-2 h-4 bg-accent animate-pulse ml-1" />
        )}
      </div>
    </div>
  );
}
