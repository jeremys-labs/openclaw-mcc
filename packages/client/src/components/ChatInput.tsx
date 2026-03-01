import { useRef, useCallback, useEffect } from 'react';

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
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea to fit content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        // Shift+Enter or Ctrl+Enter or Alt/Option+Enter → insert newline
        if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) {
          return; // let the browser insert the newline naturally
        }
        // Plain Enter → send
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

  // Scroll input into view when mobile keyboard opens (focus event)
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const handleFocus = () => {
      // Small delay lets the mobile keyboard finish animating
      setTimeout(() => {
        containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 300);
    };
    textarea.addEventListener('focus', handleFocus);
    return () => textarea.removeEventListener('focus', handleFocus);
  }, []);

  return (
    <div ref={containerRef} className="border-t border-white/10 p-3 bg-surface-raised">
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Type a message...'}
          rows={1}
          enterKeyHint="send"
          className="flex-1 bg-surface-overlay text-text-primary rounded-lg px-3 py-2 resize-none text-sm focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          onClick={() => {
            if (isStreaming && onInterrupt) onInterrupt();
            else if (value.trim()) {
              onSend(value.trim());
              // Blur on mobile after send to dismiss keyboard
              textareaRef.current?.blur();
            }
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium shrink-0 ${
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
