export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-screen bg-surface text-text-primary flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="h-12 bg-surface-raised border-b border-white/10 flex items-center px-4 shrink-0">
        <h1 className="text-sm font-semibold">OpenClaw Office</h1>
        <nav className="ml-auto flex gap-2">
          <button className="px-3 py-1 text-xs rounded bg-surface-overlay hover:bg-accent/20">Office</button>
          <button className="px-3 py-1 text-xs rounded bg-surface-overlay hover:bg-accent/20">Channels</button>
          <button className="px-3 py-1 text-xs rounded bg-surface-overlay hover:bg-accent/20">Files</button>
        </nav>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative">
        <main className="flex-1 relative">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <footer className="h-14 bg-surface-raised border-t border-white/10 flex items-center justify-around px-4 md:hidden">
        <button className="text-xs text-text-secondary">Office</button>
        <button className="text-xs text-text-secondary">Chat</button>
        <button className="text-xs text-text-secondary">Files</button>
      </footer>
    </div>
  );
}
