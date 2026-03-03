# Agent Model Display — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show each agent's configured LLM model as text in the ChatPanel header, right-aligned next to the name/role.

**Architecture:** Server reads `openclaw.json` at startup, resolves each agent's primary model (per-agent override or global default), and includes a `model` string in the agent config sent to the client. Client displays it in the ChatPanel header.

**Tech Stack:** Express 5, Vitest, React 19, Tailwind v4, Zustand 5

---

### Task 1: Server — model resolver utility

**Files:**
- Create: `packages/server/src/models.ts`
- Create: `packages/server/src/models.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/server/src/models.test.ts
import { describe, it, expect } from 'vitest';
import { resolveAgentModels, formatModelName } from './models.js';

describe('formatModelName', () => {
  it('formats anthropic claude model IDs', () => {
    expect(formatModelName('anthropic/claude-haiku-4-5')).toBe('Haiku 4.5');
    expect(formatModelName('anthropic/claude-sonnet-4-6')).toBe('Sonnet 4.6');
    expect(formatModelName('anthropic/claude-opus-4-5')).toBe('Opus 4.5');
  });

  it('formats openai model IDs', () => {
    expect(formatModelName('openai-codex/gpt-5.2')).toBe('GPT 5.2');
    expect(formatModelName('openai/gpt-5.3-codex')).toBe('GPT 5.3 Codex');
  });

  it('returns the raw model part for unknown formats', () => {
    expect(formatModelName('custom/some-model')).toBe('some-model');
  });
});

describe('resolveAgentModels', () => {
  it('returns global default when agent has no override', () => {
    const result = resolveAgentModels(
      ['isla', 'marcus'],
      {
        defaults: { model: { primary: 'anthropic/claude-haiku-4-5' } },
        list: [
          { id: 'isla' },
          { id: 'marcus' },
        ],
      }
    );
    expect(result.isla).toBe('Haiku 4.5');
    expect(result.marcus).toBe('Haiku 4.5');
  });

  it('returns per-agent override when present', () => {
    const result = resolveAgentModels(
      ['eli'],
      {
        defaults: { model: { primary: 'anthropic/claude-haiku-4-5' } },
        list: [
          { id: 'eli', model: { primary: 'anthropic/claude-sonnet-4-6' } },
        ],
      }
    );
    expect(result.eli).toBe('Sonnet 4.6');
  });

  it('returns empty string when no model config exists', () => {
    const result = resolveAgentModels(
      ['alice'],
      { list: [{ id: 'alice' }] }
    );
    expect(result.alice).toBe('');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:server -- --run packages/server/src/models.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// packages/server/src/models.ts
import fs from 'fs';
import path from 'path';

interface OpenClawModelConfig {
  defaults?: {
    model?: { primary?: string };
  };
  list?: Array<{
    id: string;
    model?: { primary?: string };
  }>;
}

/**
 * Turn "anthropic/claude-sonnet-4-6" into "Sonnet 4.6"
 */
export function formatModelName(modelId: string): string {
  // Strip provider prefix
  const raw = modelId.includes('/') ? modelId.split('/').pop()! : modelId;

  // Claude models: "claude-haiku-4-5" → "Haiku 4.5"
  const claudeMatch = raw.match(/^claude-(\w+)-([\d]+)-([\d]+)$/);
  if (claudeMatch) {
    const name = claudeMatch[1].charAt(0).toUpperCase() + claudeMatch[1].slice(1);
    return `${name} ${claudeMatch[2]}.${claudeMatch[3]}`;
  }

  // GPT models: "gpt-5.2" → "GPT 5.2", "gpt-5.3-codex" → "GPT 5.3 Codex"
  const gptMatch = raw.match(/^gpt-([\d.]+)(?:-(.+))?$/);
  if (gptMatch) {
    const suffix = gptMatch[2]
      ? ' ' + gptMatch[2].charAt(0).toUpperCase() + gptMatch[2].slice(1)
      : '';
    return `GPT ${gptMatch[1]}${suffix}`;
  }

  return raw;
}

/**
 * For each agentKey, resolve its primary model from openclaw.json
 * and return a Record<agentKey, friendlyModelName>.
 */
export function resolveAgentModels(
  agentKeys: string[],
  agentsSection: OpenClawModelConfig
): Record<string, string> {
  const globalPrimary = agentsSection.defaults?.model?.primary ?? '';
  const agentList = agentsSection.list ?? [];

  const result: Record<string, string> = {};
  for (const key of agentKeys) {
    const entry = agentList.find((a) => a.id === key);
    const modelId = entry?.model?.primary ?? globalPrimary;
    result[key] = modelId ? formatModelName(modelId) : '';
  }
  return result;
}

/**
 * Load openclaw.json and resolve models for the given agent keys.
 */
export function loadAgentModels(contentRoot: string, agentKeys: string[]): Record<string, string> {
  const jsonPath = path.join(contentRoot, 'openclaw.json');
  if (!fs.existsSync(jsonPath)) return {};

  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const agentsSection = raw.agents as OpenClawModelConfig | undefined;
  if (!agentsSection) return {};

  return resolveAgentModels(agentKeys, agentsSection);
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:server -- --run packages/server/src/models.test.ts`
Expected: PASS (all 6 tests)

**Step 5: Commit**

```bash
git add packages/server/src/models.ts packages/server/src/models.test.ts
git commit -m "feat: add model resolver for openclaw.json agent model config"
```

---

### Task 2: Server — add model to agent config in /api/config

**Files:**
- Modify: `packages/server/src/types/agent.ts:20-33` (add `model` field)
- Modify: `packages/server/src/index.ts:22-24` (load models at startup)
- Modify: `packages/server/src/routes/config.ts:7-10` (inject models into response)

**Step 1: Add `model` field to AgentConfig**

In `packages/server/src/types/agent.ts`, add to the `AgentConfig` interface:

```typescript
export interface AgentConfig {
  name: string;
  fullName?: string;
  role: string;
  emoji: string;
  sprite?: string;
  color: AgentColor;
  channel: string;
  greeting: string;
  quote?: string;
  voice?: string;
  model?: string;           // <-- add this line
  position: AgentPosition;
  tabs: AgentTab[];
}
```

**Step 2: Load models at startup in index.ts**

After line 24 (`ensureContentDirs(contentRoot);`), add:

```typescript
import { loadAgentModels } from './models.js';

// Resolve agent models from openclaw.json
const agentModels = loadAgentModels(contentRoot, Object.keys(config.agents));

// Inject model into each agent config
for (const [key, model] of Object.entries(agentModels)) {
  if (config.agents[key] && model) {
    config.agents[key].model = model;
  }
}
```

**Step 3: Run existing tests to verify nothing breaks**

Run: `npm run test:server -- --run`
Expected: All 24 tests PASS

**Step 4: Commit**

```bash
git add packages/server/src/types/agent.ts packages/server/src/index.ts
git commit -m "feat: inject resolved model name into agent config at startup"
```

---

### Task 3: Client — add model to type and display in ChatPanel

**Files:**
- Modify: `packages/client/src/types/agent.ts:20-33` (add `model` field)
- Modify: `packages/client/src/components/ChatPanel.tsx:69-82` (display model)

**Step 1: Add `model` field to client AgentConfig**

In `packages/client/src/types/agent.ts`, add to the `AgentConfig` interface:

```typescript
  model?: string;           // <-- add after voice?: string;
```

**Step 2: Display model in ChatPanel header**

Replace the header div (lines 69-82) with:

```tsx
      {/* Header */}
      <div
        className="p-3 border-b border-white/10 shrink-0"
        style={{
          background: agent ? `linear-gradient(135deg, ${agent.color.from}20, ${agent.color.to}20)` : undefined,
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{agent?.emoji}</span>
          <div>
            <div className="text-sm font-semibold">{agent?.name}</div>
            <div className="text-xs text-text-secondary">{agent?.role}</div>
          </div>
          {agent?.model && (
            <span className="ml-auto text-xs text-text-secondary">{agent.model}</span>
          )}
        </div>
      </div>
```

**Step 3: Verify in browser**

Run: `npm run dev`
Open the dashboard, click an agent, confirm the model name appears right-aligned in the chat header.

**Step 4: Commit**

```bash
git add packages/client/src/types/agent.ts packages/client/src/components/ChatPanel.tsx
git commit -m "feat: display agent model name in chat panel header"
```
