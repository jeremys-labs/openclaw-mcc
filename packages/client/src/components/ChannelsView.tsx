import { useEffect, useMemo, useState } from 'react';
import { useChannelStore } from '../stores/channelStore';
import { useAgentStore } from '../stores/agentStore';

export function ChannelsView() {
  const { interactions, loading, fetch: fetchChannels } = useChannelStore();
  const agents = useAgentStore((s) => s.agents);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);

  useEffect(() => {
    fetchChannels();
    const interval = setInterval(fetchChannels, 30000);
    return () => clearInterval(interval);
  }, [fetchChannels]);

  const channels = useMemo(() => {
    const channelMap = new Map<string, typeof interactions>();
    for (const msg of interactions) {
      const key = [msg.from, msg.to].sort().join('-');
      if (!channelMap.has(key)) channelMap.set(key, []);
      channelMap.get(key)!.push(msg);
    }
    return Array.from(channelMap.entries()).map(([key, msgs]) => ({
      key,
      agents: key.split('-'),
      messages: msgs.sort((a, b) => a.timestamp - b.timestamp),
    }));
  }, [interactions]);

  if (loading) return <div className="p-4 text-text-secondary">Loading channels...</div>;

  const active = channels.find((c) => c.key === activeChannel);

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* Channel list — full width on mobile, sidebar on desktop */}
      {(!activeChannel || active === undefined) && (
        <div className="md:w-56 md:border-r border-b md:border-b-0 border-white/10 overflow-y-auto shrink-0">
          <div className="p-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">Agent Channels</div>
          {channels.length === 0 && (
            <div className="px-3 pb-3 text-xs text-text-secondary">No interactions yet</div>
          )}
          {channels.map((ch) => (
            <button
              key={ch.key}
              onClick={() => setActiveChannel(ch.key)}
              className={`w-full text-left px-3 py-2.5 text-sm border-b border-white/5 last:border-b-0 ${
                activeChannel === ch.key ? 'bg-accent/20' : 'hover:bg-surface-overlay'
              }`}
            >
              <span>{ch.agents.map((a) => agents[a]?.emoji || a).join(' ')}</span>
              <span className="ml-2 text-text-secondary">
                {ch.agents.map((a) => agents[a]?.name || a).join(' & ')}
              </span>
              <span className="ml-1 text-xs text-text-secondary">({ch.messages.length})</span>
            </button>
          ))}
        </div>
      )}

      {/* Desktop: always show sidebar + detail. Mobile: show detail when channel selected */}
      {activeChannel && (
        <div className="hidden md:block md:w-56 md:border-r border-white/10 overflow-y-auto shrink-0">
          <div className="p-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">Agent Channels</div>
          {channels.map((ch) => (
            <button
              key={ch.key}
              onClick={() => setActiveChannel(ch.key)}
              className={`w-full text-left px-3 py-2 text-sm ${
                activeChannel === ch.key ? 'bg-accent/20' : 'hover:bg-surface-overlay'
              }`}
            >
              <span>{ch.agents.map((a) => agents[a]?.emoji || a).join(' ')}</span>
              <span className="ml-2 text-text-secondary">
                {ch.agents.map((a) => agents[a]?.name || a).join(' & ')}
              </span>
              <span className="ml-1 text-xs text-text-secondary">({ch.messages.length})</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {active ? (
          <>
            {/* Mobile back button */}
            <button
              onClick={() => setActiveChannel(null)}
              className="md:hidden flex items-center gap-1 text-xs text-accent mb-3"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              All channels
            </button>
            <div className="space-y-3">
              {active.messages.map((msg, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-sm shrink-0">{agents[msg.from]?.emoji || msg.from}</span>
                  <div className="min-w-0">
                    <div className="text-xs text-text-secondary">
                      {agents[msg.from]?.name || msg.from} → {agents[msg.to]?.name || msg.to}
                      <span className="ml-2">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-sm text-text-primary break-words">
                      {msg.type && (
                        <span className="text-[10px] uppercase px-1 py-0.5 rounded bg-surface-overlay text-text-secondary mr-1.5">
                          {msg.type}
                        </span>
                      )}
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-text-secondary text-sm">
            {channels.length > 0 ? 'Select a channel to view agent-to-agent conversations' : 'Agent interactions will appear here'}
          </div>
        )}
      </div>
    </div>
  );
}
