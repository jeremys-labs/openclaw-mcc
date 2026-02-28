import { useEffect, useMemo, useState } from 'react';
import { useChannelStore } from '../stores/channelStore';
import { useAgentStore } from '../stores/agentStore';

export function ChannelsView() {
  const { interactions, loading, fetch: fetchChannels } = useChannelStore();
  const agents = useAgentStore((s) => s.agents);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);

  useEffect(() => { fetchChannels(); }, [fetchChannels]);

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
    <div className="flex h-full">
      <div className="w-56 border-r border-white/10 overflow-y-auto">
        <div className="p-3 text-xs font-semibold text-text-secondary uppercase tracking-wide">Agent Channels</div>
        {channels.length === 0 && (
          <div className="px-3 text-xs text-text-secondary">No interactions yet</div>
        )}
        {channels.map((ch) => (
          <button
            key={ch.key}
            onClick={() => setActiveChannel(ch.key)}
            className={`w-full text-left px-3 py-2 text-sm ${
              activeChannel === ch.key ? 'bg-accent/20' : 'hover:bg-surface-overlay'
            }`}
          >
            {ch.agents.map((a) => agents[a]?.emoji || a).join(' ')}
            <span className="ml-2 text-text-secondary">
              {ch.agents.map((a) => agents[a]?.name || a).join(' & ')}
            </span>
            <span className="ml-1 text-xs text-text-secondary">({ch.messages.length})</span>
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {active ? (
          <div className="space-y-3">
            {active.messages.map((msg, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-sm shrink-0">{agents[msg.from]?.emoji || msg.from}</span>
                <div>
                  <div className="text-xs text-text-secondary">
                    {agents[msg.from]?.name || msg.from} → {agents[msg.to]?.name || msg.to}
                    <span className="ml-2">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-sm text-text-primary">
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
        ) : (
          <div className="text-text-secondary text-sm">
            {channels.length > 0 ? 'Select a channel to view agent-to-agent conversations' : 'Agent interactions will appear here'}
          </div>
        )}
      </div>
    </div>
  );
}
