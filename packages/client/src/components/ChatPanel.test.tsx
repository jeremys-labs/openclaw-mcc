// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatPanel } from './ChatPanel';

const mockUseChat = vi.fn();
const mockUseVoice = vi.fn();
const mockUseSSE = vi.fn();
const mockChatStore = vi.fn();
const mockVoiceStore = vi.fn();
const mockAgentStore = vi.fn();

vi.mock('../hooks/useChat', () => ({
  useChat: (agentKey: string) => mockUseChat(agentKey),
}));

vi.mock('../hooks/useVoice', () => ({
  useVoice: () => mockUseVoice(),
}));

vi.mock('../hooks/useSSE', () => ({
  useSSE: (agentKey: string) => mockUseSSE(agentKey),
}));

vi.mock('../stores/chatStore', () => ({
  useChatStore: (selector: (state: any) => any) => mockChatStore(selector),
}));

vi.mock('../stores/voiceStore', () => ({
  useVoiceStore: (selector: (state: any) => any) => mockVoiceStore(selector),
}));

vi.mock('../stores/agentStore', () => ({
  useAgentStore: (selector: (state: any) => any) => mockAgentStore(selector),
}));

vi.mock('./ChatMessage', () => ({
  ChatMessage: ({ content }: { content: string }) => <div>{content}</div>,
}));

vi.mock('./ChatInput', () => ({
  ChatInput: () => <div>chat-input</div>,
}));

vi.mock('./BtwOverlay', () => ({
  BtwOverlay: () => <div>btw-overlay</div>,
}));

vi.mock('./VoiceMode', () => ({
  VoiceMode: () => <div>voice-mode</div>,
}));

vi.mock('./SearchPanel', () => ({
  SearchPanel: ({ onClose }: { onClose: () => void }) => (
    <div>
      <div>search-panel</div>
      <button onClick={onClose}>Close search</button>
    </div>
  ),
}));

describe('ChatPanel search', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    });

    mockUseChat.mockReturnValue({
      draft: '',
      setDraft: vi.fn(),
      sendMessage: vi.fn(),
      sendBtw: vi.fn(),
      retryMessage: vi.fn(),
      loadHistory: vi.fn(),
      loadOlderMessages: vi.fn(),
      interrupt: vi.fn(),
    });

    mockUseVoice.mockReturnValue({ speak: vi.fn() });
    mockUseSSE.mockReturnValue(undefined);

    const chatState = {
      messages: {
        marcus: [{ seq: 1, role: 'assistant', content: 'hello world', timestamp: Date.now() }],
      },
      streaming: {},
      streamBuffer: {},
      hasOlderMessages: {},
      loadingOlder: {},
      sideResults: {},
      setSideResult: vi.fn(),
    };
    mockChatStore.mockImplementation((selector: (state: any) => any) => selector(chatState));
    mockVoiceStore.mockImplementation((selector: (state: any) => any) => selector({ activeAgent: null }));
    mockAgentStore.mockImplementation((selector: (state: any) => any) =>
      selector({
        agents: {
          marcus: {
            name: 'Marcus',
            role: 'Architect',
            emoji: '🔧',
            model: 'gpt-5.4',
            color: { from: '#111111', to: '#222222' },
          },
        },
      })
    );
  });

  it('opens the search panel from the header and closes back to chat', () => {
    render(<ChatPanel agentKey="marcus" />);

    expect(screen.getByText('hello world')).toBeTruthy();
    expect(screen.queryByText('search-panel')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /search messages/i }));

    expect(screen.getByText('search-panel')).toBeTruthy();
    expect(screen.queryByText('hello world')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /close search/i }));

    expect(screen.getByText('hello world')).toBeTruthy();
    expect(screen.queryByText('search-panel')).toBeNull();
  });
});
