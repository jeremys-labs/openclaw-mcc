import { useEffect, useState } from 'react';
import { useAgentStore } from '../stores/agentStore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  agentKey: string;
}

export function AgentInfoTabs({ agentKey }: Props) {
  const agent = useAgentStore((s) => s.agents[agentKey]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [tabData, setTabData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const tabs = agent?.tabs || [];

  useEffect(() => {
    if (tabs.length > 0 && !activeTab) setActiveTab(tabs[0].id);
  }, [tabs, activeTab]);

  useEffect(() => {
    if (!activeTab) return;
    setLoading(true);
    fetch(`/api/agent-data/${agentKey}/${activeTab}`)
      .then((r) => r.headers.get('content-type')?.includes('json') ? r.json() : r.text())
      .then((data) => { setTabData(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [agentKey, activeTab]);

  if (tabs.length === 0) return null;

  const currentTab = tabs.find((t) => t.id === activeTab);
  const renderer = currentTab?.renderer || 'default';

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-white/10 shrink-0 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs whitespace-nowrap ${
              activeTab === tab.id ? 'border-b-2 border-accent text-accent' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="text-text-secondary text-sm">Loading...</div>
        ) : renderer === 'markdown' && typeof tabData === 'string' ? (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{tabData}</ReactMarkdown>
          </div>
        ) : (
          <pre className="text-xs text-text-primary whitespace-pre-wrap">
            {typeof tabData === 'string' ? tabData : JSON.stringify(tabData, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
