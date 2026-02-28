import { useState } from 'react';
import { useConfig } from './hooks/useConfig';
import { useUIStore } from './stores/uiStore';
import { useAgentStore } from './stores/agentStore';
import { DashboardLayout } from './layouts/DashboardLayout';
import { OfficeCanvas } from './canvas/OfficeCanvas';
import { ChatPanel } from './components/ChatPanel';
import { AgentInfoTabs } from './components/AgentInfoTabs';
import { ChannelsView } from './components/ChannelsView';
import { FileReview } from './components/FileReview';
import { StandupWidget } from './components/StandupWidget';

export default function App() {
  useConfig();
  const { activeView, activeAgent, panelOpen, closePanel } = useUIStore();
  const { loading, error } = useAgentStore();

  if (loading) {
    return (
      <div className="h-screen w-screen bg-surface flex items-center justify-center text-text-secondary">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-screen bg-surface flex items-center justify-center text-red-400">
        Error: {error}
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex h-full w-full">
        {/* Main content area */}
        <div className="flex-1 relative overflow-hidden">
          {activeView === 'office' && (
            <>
              <OfficeCanvas />
              <div className="absolute top-4 right-4 w-72 z-10">
                <StandupWidget />
              </div>
            </>
          )}
          {activeView === 'channels' && <ChannelsView />}
          {activeView === 'files' && <FileReview />}
        </div>

        {/* Agent side panel */}
        {panelOpen && activeAgent && (
          <aside className="w-96 bg-surface-raised border-l border-white/10 flex flex-col shrink-0">
            <div className="flex border-b border-white/10">
              <button
                onClick={() => closePanel()}
                className="ml-auto px-3 py-2 text-xs text-text-secondary hover:text-text-primary"
              >
                Close
              </button>
            </div>
            {/* Panel tabs: Chat and Info */}
            <PanelTabs agentKey={activeAgent} />
          </aside>
        )}
      </div>
    </DashboardLayout>
  );
}

function PanelTabs({ agentKey }: { agentKey: string }) {
  const [tab, setTab] = useState<'chat' | 'info'>('chat');
  const agent = useAgentStore((s) => s.agents[agentKey]);
  const hasTabs = agent?.tabs && agent.tabs.length > 0;

  return (
    <>
      {hasTabs && (
        <div className="flex border-b border-white/10 shrink-0">
          <button
            onClick={() => setTab('chat')}
            className={`flex-1 px-3 py-2 text-xs ${tab === 'chat' ? 'text-accent border-b-2 border-accent' : 'text-text-secondary'}`}
          >
            Chat
          </button>
          <button
            onClick={() => setTab('info')}
            className={`flex-1 px-3 py-2 text-xs ${tab === 'info' ? 'text-accent border-b-2 border-accent' : 'text-text-secondary'}`}
          >
            Info
          </button>
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        {tab === 'chat' ? <ChatPanel agentKey={agentKey} /> : <AgentInfoTabs agentKey={agentKey} />}
      </div>
    </>
  );
}
