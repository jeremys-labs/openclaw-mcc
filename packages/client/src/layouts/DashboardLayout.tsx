import { useUIStore } from '../stores/uiStore';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { activeView, setView } = useUIStore();

  return (
    <div className="h-screen w-screen bg-surface text-text-primary flex flex-col overflow-hidden">
      <header className="h-12 bg-surface-raised border-b border-white/10 flex items-center px-4 shrink-0">
        <h1 className="text-sm font-semibold">OpenClaw Office</h1>
        <nav className="ml-auto flex gap-2">
          {(['office', 'channels', 'files'] as const).map((view) => (
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
      <div className="flex-1 flex overflow-hidden relative">
        {children}
      </div>
      <footer className="h-14 bg-surface-raised border-t border-white/10 flex items-center justify-around px-4 md:hidden">
        {(['office', 'channels', 'files'] as const).map((view) => (
          <button
            key={view}
            onClick={() => setView(view)}
            className={`text-xs capitalize ${activeView === view ? 'text-accent' : 'text-text-secondary'}`}
          >
            {view}
          </button>
        ))}
      </footer>
    </div>
  );
}
