import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  role: 'user' | 'assistant';
  content: string;
  agentName?: string;
  streaming?: boolean;
}

export function ChatMessage({ role, content, agentName, streaming }: Props) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-accent text-white'
            : 'bg-surface-overlay text-text-primary'
        }`}
      >
        {!isUser && agentName && (
          <div className="text-xs text-text-secondary mb-1 font-medium">{agentName}</div>
        )}
        <div className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
        {streaming && (
          <span className="inline-block w-2 h-4 bg-accent animate-pulse ml-1" />
        )}
      </div>
    </div>
  );
}
