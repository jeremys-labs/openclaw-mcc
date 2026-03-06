import { useEffect, useState } from 'react';
import { useAgentStore } from '../stores/agentStore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';

interface Props {
  agentKey: string;
}

// ---------------------------------------------------------------------------
// Status badge colors
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  complete: 'bg-green-500/20 text-green-400',
  completed: 'bg-green-500/20 text-green-400',
  merged: 'bg-green-500/20 text-green-400',
  approved: 'bg-green-500/20 text-green-400',
  'on track': 'bg-green-500/20 text-green-400',
  active: 'bg-blue-500/20 text-blue-400',
  'in progress': 'bg-blue-500/20 text-blue-400',
  investigating: 'bg-yellow-500/20 text-yellow-400',
  planning: 'bg-yellow-500/20 text-yellow-400',
  planned: 'bg-yellow-500/20 text-yellow-400',
  scheduled: 'bg-yellow-500/20 text-yellow-400',
  pending: 'bg-yellow-500/20 text-yellow-400',
  open: 'bg-orange-500/20 text-orange-400',
  backlog: 'bg-gray-500/20 text-gray-400',
};

function StatusBadge({ status }: { status: string }) {
  const colorClass = STATUS_COLORS[status.toLowerCase()] || 'bg-gray-500/20 text-gray-400';
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${colorClass}`}>
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Priority indicator
// ---------------------------------------------------------------------------

const PRIORITY_COLORS: Record<string, string> = {
  high: 'text-red-400',
  medium: 'text-yellow-400',
  low: 'text-gray-400',
  critical: 'text-red-500',
};

// ---------------------------------------------------------------------------
// Smart JSON renderer — cards for arrays, key-value for objects
// ---------------------------------------------------------------------------

function findTitle(obj: Record<string, unknown>): string {
  for (const key of ['title', 'name', 'item', 'type', 'day']) {
    if (typeof obj[key] === 'string') return obj[key] as string;
  }
  return '';
}

function findSubtitle(obj: Record<string, unknown>): string | null {
  for (const key of ['repo', 'channel', 'focus', 'assignee', 'reporter', 'author', 'lead']) {
    if (typeof obj[key] === 'string') return obj[key] as string;
  }
  return null;
}

const SKIP_KEYS = new Set(['id', 'title', 'name', 'item', 'type', 'status', 'priority', 'severity', 'repo', 'channel', 'focus', 'assignee', 'reporter', 'author', 'lead', 'day']);

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const currentYear = new Date().getFullYear();
  if (y === currentYear) {
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(v => formatValue(v)).join(', ');
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'string' && ISO_DATE_RE.test(value)) return formatDate(value);
  if (value != null && typeof value === 'object') {
    const entries = Object.values(value as Record<string, unknown>);
    return entries.map(v => formatValue(v)).join(' · ');
  }
  return String(value ?? '');
}

function formatLabel(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

function CardItem({ obj }: { obj: Record<string, unknown> }) {
  const title = findTitle(obj);
  const subtitle = findSubtitle(obj);
  const status = typeof obj.status === 'string' ? obj.status : null;
  const priority = typeof obj.priority === 'string' ? obj.priority : null;
  const severity = typeof obj.severity === 'string' ? obj.severity : null;
  const id = obj.id != null ? String(obj.id) : null;

  const extraFields = Object.entries(obj).filter(
    ([k, v]) => !SKIP_KEYS.has(k) && v != null && v !== '',
  );

  return (
    <div className="border border-white/10 rounded-lg p-3 hover:border-white/20 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {id && <span className="text-[10px] text-text-secondary font-mono shrink-0">{id}</span>}
            {(priority || severity) && (
              <span className={`text-[10px] font-medium ${PRIORITY_COLORS[(priority || severity || '').toLowerCase()] || 'text-gray-400'}`}>
                {priority || severity}
              </span>
            )}
          </div>
          <div className="text-sm text-text-primary mt-0.5">{title}</div>
          {subtitle && <div className="text-xs text-text-secondary mt-0.5">{subtitle}</div>}
        </div>
        {status && <StatusBadge status={status} />}
      </div>
      {extraFields.length > 0 && (
        <div className="mt-2 pt-2 border-t border-white/5 grid grid-cols-2 gap-x-3 gap-y-1">
          {extraFields.map(([k, v]) => (
            <div key={k} className="text-[11px]">
              <span className="text-text-secondary">{formatLabel(k)}: </span>
              <span className="text-text-primary">{formatValue(v)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ObjectSection({ label, data }: { label: string; data: Record<string, unknown> }) {
  return (
    <div className="border border-white/10 rounded-lg p-3">
      <div className="text-xs font-medium text-accent mb-2">{formatLabel(label)}</div>
      <div className="space-y-1">
        {Object.entries(data).map(([k, v]) => {
          if (v != null && typeof v === 'object' && !Array.isArray(v)) {
            return <ObjectSection key={k} label={k} data={v as Record<string, unknown>} />;
          }
          return (
            <div key={k} className="flex justify-between gap-3 text-xs">
              <span className="text-text-secondary shrink-0">{formatLabel(k)}</span>
              <span className="text-text-primary font-mono text-right">
                {formatValue(v)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function JsonRenderer({ data }: { data: unknown }) {
  // Array of objects → card list
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
    return (
      <div className="space-y-2">
        {data.map((item, i) => (
          <CardItem key={item?.id ?? i} obj={item as Record<string, unknown>} />
        ))}
      </div>
    );
  }

  // Object with nested sections (like budget)
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    const hasNestedObjects = Object.values(obj).some(v => v && typeof v === 'object' && !Array.isArray(v));

    if (hasNestedObjects) {
      return (
        <div className="space-y-3">
          {Object.entries(obj).map(([k, v]) => {
            if (v && typeof v === 'object' && !Array.isArray(v)) {
              return <ObjectSection key={k} label={k} data={v as Record<string, unknown>} />;
            }
            return (
              <div key={k} className="flex justify-between gap-3 text-sm px-1">
                <span className="text-text-secondary shrink-0">{formatLabel(k)}</span>
                <span className="text-text-primary text-right">{formatValue(v)}</span>
              </div>
            );
          })}
        </div>
      );
    }

    // Flat object → simple key-value list
    return (
      <div className="border border-white/10 rounded-lg p-3 space-y-1.5">
        {Object.entries(obj).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 text-xs">
            <span className="text-text-secondary shrink-0">{formatLabel(k)}</span>
            <span className="text-text-primary text-right">{formatValue(v)}</span>
          </div>
        ))}
      </div>
    );
  }

  // Fallback
  return (
    <pre className="text-xs text-text-primary whitespace-pre-wrap">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AgentInfoTabs({ agentKey }: Props) {
  const agent = useAgentStore((s) => s.agents[agentKey]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [tabData, setTabData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  // Track which cron-sourced tabs have been pre-fetched and returned empty.
  // null = still checking, Set = resolved
  const [emptyCronTabs, setEmptyCronTabs] = useState<Set<string> | null>(null);

  const allTabs = agent?.tabs || [];
  const cronTabs = allTabs.filter((t) => t.source === 'crons');

  // Pre-fetch all cron tabs on mount/agent change to know upfront which are empty
  useEffect(() => {
    setEmptyCronTabs(null);
    setActiveTab(null);
    setTabData(null);

    if (cronTabs.length === 0) {
      setEmptyCronTabs(new Set());
      return;
    }

    Promise.all(
      cronTabs.map((t) =>
        fetch(`/api/agent-data/${agentKey}/${t.id}`)
          .then((r) => r.json())
          .then((data) => ({ id: t.id, empty: Array.isArray(data) && data.length === 0 }))
          .catch(() => ({ id: t.id, empty: false }))
      )
    ).then((results) => {
      setEmptyCronTabs(new Set(results.filter((r) => r.empty).map((r) => r.id)));
    });
  }, [agentKey]);

  // Filter out cron tabs confirmed empty; show all others (including unresolved)
  const tabs = emptyCronTabs === null
    ? allTabs.filter((t) => t.source !== 'crons')   // still loading: hide cron tabs temporarily
    : allTabs.filter((t) => t.source !== 'crons' || !emptyCronTabs.has(t.id));

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
        ) : (renderer === 'markdown' || typeof tabData === 'string') && typeof tabData === 'string' ? (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkFrontmatter]}>{tabData}</ReactMarkdown>
          </div>
        ) : (
          <JsonRenderer data={tabData} />
        )}
      </div>
    </div>
  );
}
