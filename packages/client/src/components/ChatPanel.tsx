import { useEffect, useRef, useCallback } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { BtwOverlay } from './BtwOverlay';
import { VoiceMode } from './VoiceMode';
import { useChat } from '../hooks/useChat';
import { useVoice } from '../hooks/useVoice';
import { useSSE } from '../hooks/useSSE';
import { useChatStore } from '../stores/chatStore';
import { useVoiceStore } from '../stores/voiceStore';
import { useAgentStore } from '../stores/agentStore';
import { ChevronUp, Loader2 } from 'lucide-react';

const EMPTY_MESSAGES: { seq: number; role: 'user' | 'assistant'; content: string; timestamp: number }[] = [];

interface Props {
  agentKey: string;
}

export function ChatPanel({ agentKey }: Props) {
  const { draft, setDraft, sendMessage, sendBtw, retryMessage, loadHistory, loadOlderMessages, interrupt } = useChat(agentKey);
  const { speak } = useVoice();
  const messages = useChatStore((s) => s.messages[agentKey] ?? EMPTY_MESSAGES);
  const isStreaming = useChatStore((s) => !!s.streaming[agentKey]);
  const streamBuffer = useChatStore((s) => s.streamBuffer[agentKey] ?? '');
  const hasOlderMessages = useChatStore((s) => !!s.hasOlderMessages[agentKey]);
  const loadingOlder = useChatStore((s) => !!s.loadingOlder[agentKey]);
  const sideResult = useChatStore((s) => s.sideResults[agentKey] ?? null);
  const setSideResult = useChatStore((s) => s.setSideResult);
  const activeVoiceAgent = useVoiceStore((s) => s.activeAgent);
  const agent = useAgentStore((s) => s.agents[agentKey]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef(0);
  // Track scroll position before prepending older messages so we can restore it
  const scrollAnchorRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);

  // Keep speak ref stable to avoid re-render loops
  const speakRef = useRef(speak);
  speakRef.current = speak;

  // When voice mode is active and a new assistant message arrives, speak it
  useEffect(() => {
    if (activeVoiceAgent !== agentKey) {
      prevMsgCountRef.current = messages.length;
      return;
    }
    if (messages.length > prevMsgCountRef.current) {
      const last = messages[messages.length - 1];
      if (last && last.role === 'assistant' && last.content) {
        const text = last.content.length > 500 ? last.content.slice(0, 500) : last.content;
        speakRef.current(text, agentKey);
      }
    }
    prevMsgCountRef.current = messages.length;
  }, [messages, activeVoiceAgent, agentKey]);

  const handleVoiceTranscript = useCallback(
    (text: string) => {
      sendMessage(text);
    },
    [sendMessage]
  );

  useSSE(agentKey);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Auto-scroll to bottom when new messages arrive (but not when loading older ones)
  useEffect(() => {
    if (scrollAnchorRef.current) {
      // We just prepended older messages — restore scroll position
      const el = scrollRef.current;
      if (el) {
        const { scrollHeight, scrollTop } = scrollAnchorRef.current;
        el.scrollTop = el.scrollHeight - scrollHeight + scrollTop;
      }
      scrollAnchorRef.current = null;
    } else {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, streamBuffer]);

  const handleLoadOlder = useCallback(() => {
    // Snapshot scroll position before the prepend
    if (scrollRef.current) {
      scrollAnchorRef.current = {
        scrollHeight: scrollRef.current.scrollHeight,
        scrollTop: scrollRef.current.scrollTop,
      };
    }
    loadOlderMessages();
  }, [loadOlderMessages]);

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
          {agent?.model && (
            <span className="ml-auto text-xs text-text-secondary">{agent.model}</span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {/* Load older messages button */}
        {hasOlderMessages && (
          <div className="flex justify-center mb-3">
            <button
              onClick={handleLoadOlder}
              disabled={loadingOlder}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary bg-surface-overlay hover:bg-surface-raised rounded-full border border-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingOlder ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <ChevronUp className="w-3 h-3" />
              )}
              {loadingOlder ? 'Loading…' : 'Load older messages'}
            </button>
          </div>
        )}
        {messages.map((msg, i) => {
          // For error messages, find the preceding user message to get the original content for retry
          const prevUserMsg = msg.error
            ? messages.slice(0, i).reverse().find((m) => m.role === 'user')
            : null;

          return (
            <ChatMessage
              key={msg.seq || i}
              role={msg.role}
              content={msg.content}
              agentName={msg.role === 'assistant' ? agent?.name : undefined}
              timestamp={msg.timestamp}
              error={msg.error}
              onRetry={
                msg.error && prevUserMsg
                  ? () => retryMessage(prevUserMsg.content, msg.seq)
                  : undefined
              }
            />
          );
        })}
        {isStreaming && streamBuffer && (
          <ChatMessage role="assistant" content={streamBuffer} agentName={agent?.name} streaming />
        )}
      </div>

      {/* BTW side result overlay */}
      {sideResult && (
        <BtwOverlay
          content={sideResult}
          onDismiss={() => setSideResult(agentKey, null)}
        />
      )}

      {/* Input */}
      <ChatInput
        value={draft}
        onChange={setDraft}
        onSend={sendMessage}
        onBtw={sendBtw}
        onInterrupt={interrupt}
        isStreaming={isStreaming}
        placeholder={`Message ${agent?.name || 'agent'}...`}
      />

      {/* Voice */}
      <div className="border-t border-white/5 bg-surface-raised pb-14 md:pb-0">
        <VoiceMode agentKey={agentKey} onTranscript={handleVoiceTranscript} />
      </div>
    </div>
  );
}
