export function ChannelsView() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <div className="text-4xl mb-4">💬</div>
      <h2 className="text-lg font-semibold text-text-primary mb-2">Agent Channels</h2>
      <p className="text-sm text-text-secondary max-w-md">
        Agent-to-agent conversations will be visible here once channel monitoring is implemented.
      </p>
      <span className="mt-4 px-3 py-1 text-xs rounded-full bg-accent/10 text-accent">
        Coming Soon
      </span>
    </div>
  );
}
