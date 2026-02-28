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
              <div className="absolute top-2 right-2 w-56 md:top-4 md:right-4 md:w-72 z-10">
                <StandupWidget />
              </div>
            </>
          )}
          {activeView === 'channels' && <ChannelsView />}
          {activeView === 'files' && <FileReview />}
        </div>

        {/* Agent side panel - sidebar on desktop, slide-up sheet on mobile */}
        {panelOpen && activeAgent && (
          <>
            {/* Mobile overlay backdrop */}
            <div
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => closePanel()}
            />
            <aside
              className={[
                // Mobile: slide-up full-height sheet
                'fixed inset-x-0 bottom-0 z-50 bg-surface-raised flex flex-col',
                'h-[85vh] rounded-t-2xl',
                'transition-transform duration-300 ease-out',
                // Desktop: static sidebar
                'md:static md:inset-auto md:z-auto md:w-96 md:h-auto md:rounded-none',
                'md:border-l md:border-white/10 md:shrink-0',
              ].join(' ')}
            >
              {/* Mobile drag handle */}
              <div className="flex items-center justify-center pt-2 pb-1 md:hidden">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
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
          </>
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
