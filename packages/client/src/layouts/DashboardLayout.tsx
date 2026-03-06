import { useUIStore } from '../stores/uiStore';
import { useConnectionStore } from '../stores/connectionStore';

const NAV_ICONS: Record<string, string> = {
  office: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4',
  files: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
};

function ConnectionBanner() {
  const gatewayStatus = useConnectionStore((s) => s.gatewayStatus);

  if (gatewayStatus === 'connected') return null;

  if (gatewayStatus === 'disconnected') {
    return (
      <div className="bg-red-700 text-white text-xs text-center py-1.5 px-4 shrink-0">
        Gateway disconnected — messages may not be delivered
      </div>
    );
  }

  return (
    <div className="bg-yellow-600 text-white text-xs text-center py-1.5 px-4 shrink-0">
      Reconnecting to gateway...
    </div>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { activeView, setView } = useUIStore();

  return (
    <div className="h-screen w-screen bg-surface text-text-primary flex flex-col overflow-hidden">
      <ConnectionBanner />
      {/* Desktop top nav */}
      <header className="h-12 bg-surface-raised border-b border-white/10 hidden md:flex items-center px-4 shrink-0">
        <h1 className="text-sm font-semibold">OpenClaw Office</h1>
        <nav className="ml-auto flex gap-2">
          {(['office', 'files'] as const).map((view) => (
            <button
              key={view}
              onClick={() => setView(view)}
              className={`px-3 py-1 text-xs rounded capitalize ${
                activeView === view ? 'bg-accent/20 text-accent' : 'bg-surface-overlay hover:bg-accent/10 text-text-secondary'
              }`}
            >
              {view}
            </button>
          ))}
        </nav>
      </header>

      {/* Mobile top bar - minimal branding only */}
      <header className="h-10 bg-surface-raised border-b border-white/10 flex md:hidden items-center px-4 shrink-0">
        <h1 className="text-sm font-semibold">OpenClaw Office</h1>
      </header>

      {/* Main content - add bottom padding on mobile for bottom nav */}
      <div className="flex-1 flex overflow-hidden relative pb-14 md:pb-0">
        {children}
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-14 bg-surface-raised border-t border-white/10 flex items-center justify-around px-4 z-50 md:hidden safe-area-pb">
        {(['office', 'files'] as const).map((view) => (
          <button
            key={view}
            onClick={() => setView(view)}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 ${
              activeView === view ? 'text-accent' : 'text-text-secondary'
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={NAV_ICONS[view]} />
            </svg>
            <span className="text-[10px] capitalize">{view}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
