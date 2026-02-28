import { useEffect, useRef } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useChat } from '../hooks/useChat';
import { useSSE } from '../hooks/useSSE';
import { useChatStore } from '../stores/chatStore';
import { useAgentStore } from '../stores/agentStore';

interface Props {
  agentKey: string;
}

export function ChatPanel({ agentKey }: Props) {
  const { draft, setDraft, sendMessage, loadHistory, interrupt } = useChat(agentKey);
  const messages = useChatStore((s) => s.messages[agentKey] || []);
  const isStreaming = useChatStore((s) => s.streaming[agentKey] || false);
  const streamBuffer = useChatStore((s) => s.streamBuffer[agentKey] || '');
  const agent = useAgentStore((s) => s.agents[agentKey]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useSSE(agentKey);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streamBuffer]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="p-3 border-b border-white/10 shrink-0"
        style={{
          background: agent ? `linear-gradient(135deg, ${agent.color.from}20, ${agent.color.to}20)` : undefined,
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{agent?.emoji}</span>
          <div>
            <div className="text-sm font-semibold">{agent?.name}</div>
            <div className="text-xs text-text-secondary">{agent?.role}</div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {messages.map((msg, i) => (
          <ChatMessage
            key={msg.seq || i}
            role={msg.role}
            content={msg.content}
            agentName={msg.role === 'assistant' ? agent?.name : undefined}
          />
        ))}
        {isStreaming && streamBuffer && (
          <ChatMessage role="assistant" content={streamBuffer} agentName={agent?.name} streaming />
        )}
      </div>

      {/* Input */}
      <ChatInput
        value={draft}
        onChange={setDraft}
        onSend={sendMessage}
        onInterrupt={interrupt}
        isStreaming={isStreaming}
        placeholder={`Message ${agent?.name || 'agent'}...`}
      />
    </div>
  );
}
