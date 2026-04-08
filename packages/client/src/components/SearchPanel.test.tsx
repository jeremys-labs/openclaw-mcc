// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchPanel } from './SearchPanel';

const mockUseSearch = vi.fn();

vi.mock('../hooks/useSearch', () => ({
  useSearch: (agentKey: string) => mockUseSearch(agentKey),
}));

vi.mock('./ChatMessage', () => ({
  ChatMessage: ({ content, highlightedText, emphasis }: { content: string; highlightedText?: string; emphasis?: boolean }) => (
    <div>
      <div>{content}</div>
      {highlightedText ? <div>highlight:{highlightedText}</div> : null}
      {emphasis ? <div>emphasis:on</div> : null}
    </div>
  ),
}));

describe('SearchPanel', () => {
  const search = vi.fn();
  const clearSearch = vi.fn();
  const onClose = vi.fn();
  const onJumpToMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSearch.mockReturnValue({
      query: 'learning',
      isSearching: false,
      totalResults: 1,
      error: null,
      search,
      clearSearch,
      results: [
        {
          seq: 7,
          role: 'assistant',
          content: 'Machine learning is a subset of artificial intelligence.',
          snippet: 'Machine learning is a subset of artificial intelligence.',
          timestamp: Date.now(),
          matchCount: 1,
        },
      ],
    });
  });

  it('renders snippets with highlighted search text and lets users jump to the message', () => {
    render(<SearchPanel agentKey="marcus" onClose={onClose} onJumpToMessage={onJumpToMessage} />);

    expect(screen.getByText(/Found 1 message matching/i)).toBeTruthy();
    expect(screen.getByText('highlight:learning')).toBeTruthy();
    expect(screen.getByText('emphasis:on')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /jump to message/i }));

    expect(onJumpToMessage).toHaveBeenCalledWith(7);
  });
});
