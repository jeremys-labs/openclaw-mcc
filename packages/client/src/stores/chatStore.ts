import { create } from 'zustand';

const SYSTEM_MSG_RE = /^(ANNOUNCE_SKIP|NO_REPLY|NO_?|SKIP|ACK|HEARTBEAT|PING|PONG)$/i;

interface Message {
  seq: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  streaming?: boolean;
  error?: string;
}

interface ChatState {
  messages: Record<string, Message[]>;
  drafts: Record<string, string>;
  streaming: Record<string, boolean>;
  streamBuffer: Record<string, string>;
  addMessage: (agent: string, msg: Message) => void;
  setMessages: (agent: string, msgs: Message[]) => void;
  setDraft: (agent: string, text: string) => void;
  setStreaming: (agent: string, streaming: boolean) => void;
  appendStreamBuffer: (agent: string, content: string) => void;
  finalizeStream: (agent: string, content: string) => void;
  clearMessages: (agent: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: {},
  drafts: {},
  streaming: {},
  streamBuffer: {},
  addMessage: (agent, msg) =>
    set((s) => {
      if (SYSTEM_MSG_RE.test(msg.content.trim())) return s;
      const existing = s.messages[agent] || [];
      // Deduplicate: skip if an identical message (same role + content) already exists
      const isDuplicate = existing.some(
        (m) => m.role === msg.role && m.content === msg.content
      );
      if (isDuplicate) return s;
      return {
        messages: { ...s.messages, [agent]: [...existing, msg] },
      };
    }),
  setMessages: (agent, msgs) =>
    set((s) => ({
      messages: { ...s.messages, [agent]: msgs.filter((m) => !SYSTEM_MSG_RE.test(m.content.trim())) },
    })),
  setDraft: (agent, text) =>
    set((s) => ({ drafts: { ...s.drafts, [agent]: text } })),
  setStreaming: (agent, streaming) =>
    set((s) => ({
      streaming: { ...s.streaming, [agent]: streaming },
      ...(streaming ? { streamBuffer: { ...s.streamBuffer, [agent]: '' } } : {}),
    })),
  appendStreamBuffer: (agent, content) =>
    set((s) => ({
      streamBuffer: { ...s.streamBuffer, [agent]: (s.streamBuffer[agent] || '') + content },
    })),
  finalizeStream: (agent, content) =>
    set((s) => {
      // Skip adding empty or system messages — just clear streaming state
      if (!content.trim() || SYSTEM_MSG_RE.test(content.trim())) {
        return { streaming: { ...s.streaming, [agent]: false }, streamBuffer: { ...s.streamBuffer, [agent]: '' } };
      }
      const existing = s.messages[agent] || [];
      const isDuplicate = existing.some(
        (m) => m.role === 'assistant' && m.content === content
      );
      return {
        streaming: { ...s.streaming, [agent]: false },
        streamBuffer: { ...s.streamBuffer, [agent]: '' },
        messages: isDuplicate
          ? s.messages
          : { ...s.messages, [agent]: [...existing, { seq: Date.now(), role: 'assistant' as const, content, timestamp: Date.now() }] },
      };
    }),
  clearMessages: (agent) =>
    set((s) => ({ messages: { ...s.messages, [agent]: [] } })),
}));

// Expose for Playwright tests
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__chatStore = useChatStore;
}
