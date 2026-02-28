import { useRef, useCallback } from 'react';

interface Props {
  value: string;
  onChange: (text: string) => void;
  onSend: (text: string) => void;
  onInterrupt?: () => void;
  isStreaming: boolean;
  placeholder?: string;
}

export function ChatInput({ value, onChange, onSend, onInterrupt, isStreaming, placeholder }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (isStreaming && onInterrupt) {
          onInterrupt();
        } else if (value.trim()) {
          onSend(value.trim());
        }
      }
    },
    [value, onSend, onInterrupt, isStreaming]
  );

  return (
    <div className="border-t border-white/10 p-3 bg-surface-raised">
      <div className="flex gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Type a message...'}
          rows={1}
          className="flex-1 bg-surface-overlay text-text-primary rounded-lg px-3 py-2 resize-none text-sm focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          onClick={() => {
            if (isStreaming && onInterrupt) onInterrupt();
            else if (value.trim()) onSend(value.trim());
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            isStreaming
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-accent hover:bg-accent/80 text-white'
          }`}
        >
          {isStreaming ? 'Stop' : 'Send'}
        </button>
      </div>
    </div>
  );
}
