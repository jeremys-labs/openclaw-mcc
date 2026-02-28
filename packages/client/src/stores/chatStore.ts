import { create } from 'zustand';

interface Message {
  seq: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  streaming?: boolean;
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
    set((s) => ({
      messages: { ...s.messages, [agent]: [...(s.messages[agent] || []), msg] },
    })),
  setMessages: (agent, msgs) =>
    set((s) => ({ messages: { ...s.messages, [agent]: msgs } })),
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
    set((s) => ({
      streaming: { ...s.streaming, [agent]: false },
      streamBuffer: { ...s.streamBuffer, [agent]: '' },
      messages: {
        ...s.messages,
        [agent]: [...(s.messages[agent] || []), { seq: Date.now(), role: 'assistant', content, timestamp: Date.now() }],
      },
    })),
  clearMessages: (agent) =>
    set((s) => ({ messages: { ...s.messages, [agent]: [] } })),
}));
