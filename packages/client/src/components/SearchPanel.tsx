import { useState, useCallback } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { useSearch } from '../hooks/useSearch';
import { ChatMessage } from './ChatMessage';

interface Props {
  agentKey: string;
  onClose: () => void;
}

export function SearchPanel({ agentKey, onClose }: Props) {
  const { query, isSearching, results, totalResults, error, search, clearSearch } = useSearch(agentKey);
  const [inputValue, setInputValue] = useState('');

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      search(inputValue);
    },
    [inputValue, search]
  );

  const handleClear = useCallback(() => {
    setInputValue('');
    clearSearch();
  }, [clearSearch]);

  return (
    <div className="flex flex-col h-full bg-surface-raised border-l border-white/10">
      {/* Header */}
      <div className="p-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-text-secondary" />
          <h3 className="text-sm font-semibold">Search Messages</h3>
          <button
            onClick={onClose}
            className="ml-auto p-1 hover:bg-surface-overlay rounded transition-colors"
            aria-label="Close search"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search input */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search messages..."
            className="flex-1 px-3 py-2 text-sm bg-surface-input border border-white/10 rounded focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20"
            disabled={isSearching}
          />
          <button
            type="submit"
            disabled={isSearching || !inputValue.trim()}
            className="px-3 py-2 text-sm bg-primary hover:bg-primary/90 disabled:bg-primary/50 rounded font-medium transition-colors disabled:cursor-not-allowed"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
          </button>
        </form>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-200 mb-4">
            {error}
          </div>
        )}

        {query && totalResults === 0 && !isSearching && (
          <div className="text-center py-8">
            <p className="text-text-secondary text-sm">No messages found for "{query}"</p>
          </div>
        )}

        {totalResults > 0 && (
          <div className="mb-3">
            <p className="text-xs text-text-secondary">
              Found {totalResults} message{totalResults !== 1 ? 's' : ''} matching "{query}"
            </p>
          </div>
        )}

        {results.map((msg) => (
          <ChatMessage
            key={msg.seq}
            role={msg.role}
            content={msg.content}
            timestamp={msg.timestamp}
          />
        ))}

        {isSearching && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-text-secondary" />
          </div>
        )}
      </div>

      {/* Footer with clear button */}
      {query && (
        <div className="p-3 border-t border-white/10 shrink-0">
          <button
            onClick={handleClear}
            className="w-full px-3 py-2 text-sm text-text-secondary hover:text-text-primary bg-surface-overlay hover:bg-surface-raised rounded transition-colors"
          >
            Clear search
          </button>
        </div>
      )}
    </div>
  );
}
