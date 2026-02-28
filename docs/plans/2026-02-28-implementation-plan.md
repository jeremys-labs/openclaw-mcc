# OpenClaw MCC Dashboard - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a React/TypeScript web dashboard with an isometric pixel office, real-time agent chat, voice communication, file review, and standup tracking — all config-driven and content-separated.

**Architecture:** Monorepo with `packages/client` (React + Vite + PixiJS) and `packages/server` (Express + WebSocket middleware). The server connects to an existing OpenClaw Gateway via a challenge-response WebSocket protocol. All user content lives in an external `CONTENT_ROOT` directory (default `~/.openclaw`).

**Tech Stack:** React 19, TypeScript 5.x, Vite 6, Tailwind CSS 4, PixiJS 8, Zustand, Express 5, better-sqlite3, ws, node-edge-tts, vite-plugin-pwa, Vitest, Playwright

---

## Phase 1: Project Scaffolding & Config System

### Task 1: Initialize monorepo with npm workspaces

**Files:**
- Create: `package.json` (workspace root)
- Create: `packages/client/package.json`
- Create: `packages/server/package.json`
- Create: `tsconfig.base.json`
- Create: `packages/client/tsconfig.json`
- Create: `packages/server/tsconfig.json`
- Create: `.gitignore`
- Create: `.env.example`

**Step 1: Create root package.json**

```json
{
  "name": "openclaw-mcc",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev": "npm run dev --workspace=packages/server & npm run dev --workspace=packages/client",
    "build": "npm run build --workspace=packages/client",
    "test": "npm run test --workspace=packages/server && npm run test --workspace=packages/client",
    "lint": "eslint packages/*/src"
  }
}
```

**Step 2: Create client package.json and scaffold with Vite**

```bash
cd packages/client
npm create vite@latest . -- --template react-ts
```

Then add dependencies:
```bash
npm install --workspace=packages/client pixi.js@^8 zustand @tanstack/react-query tailwindcss @tailwindcss/vite recharts react-markdown remark-gfm react-syntax-highlighter vite-plugin-pwa
npm install --workspace=packages/client -D @types/react @types/react-dom vitest @testing-library/react @testing-library/jest-dom jsdom
```

**Step 3: Create server package.json**

```json
{
  "name": "@openclaw/server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest"
  }
}
```

```bash
npm install --workspace=packages/server express ws better-sqlite3 yaml multer node-edge-tts web-push cors
npm install --workspace=packages/server -D tsx typescript @types/express @types/ws @types/better-sqlite3 @types/multer @types/cors vitest
```

**Step 4: Create shared tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true
  }
}
```

**Step 5: Create .gitignore**

```
node_modules/
dist/
.env
*.db
*.db-wal
*.db-shm
.vite/
```

**Step 6: Create .env.example**

```bash
CONTENT_ROOT=~/.openclaw
GATEWAY_PORT=18789
GATEWAY_TOKEN=your-token-here
SERVER_PORT=8081
CLIENT_PORT=3001
```

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold monorepo with client and server workspaces"
```

---

### Task 2: Shared TypeScript types

**Files:**
- Create: `packages/server/src/types/agent.ts`
- Create: `packages/server/src/types/config.ts`
- Create: `packages/server/src/types/chat.ts`
- Create: `packages/client/src/types/agent.ts`
- Create: `packages/client/src/types/config.ts`
- Create: `packages/client/src/types/chat.ts`

**Step 1: Define agent types (server)**

```typescript
// packages/server/src/types/agent.ts
export interface AgentColor {
  from: string;
  to: string;
}

export interface AgentTab {
  id: string;
  label: string;
  icon: string;
  source: string; // "file:<path>" | "api:<endpoint>" | "memory"
  renderer?: 'default' | 'chart' | 'markdown' | 'table';
}

export interface AgentPosition {
  zone: string;
  x: number;
  y: number;
}

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
  position: AgentPosition;
  tabs: AgentTab[];
}
```

**Step 2: Define config types (server)**

```typescript
// packages/server/src/types/config.ts
import type { AgentConfig } from './agent.js';

export interface BrandingConfig {
  name: string;
  shortName: string;
  description?: string;
}

export interface GatewayConfig {
  url: string;
  token: string;
}

export interface AppConfig {
  branding: BrandingConfig;
  gateway: GatewayConfig;
  agents: Record<string, AgentConfig>;
}
```

**Step 3: Define chat types (server)**

```typescript
// packages/server/src/types/chat.ts
export interface ChatMessage {
  seq: number;
  agent: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export type SSEEventType =
  | 'connected'
  | 'message.delta'
  | 'message.final'
  | 'message.error'
  | 'message.aborted'
  | 'context.update';

export interface SSEEvent {
  type: SSEEventType;
  data: Record<string, unknown>;
}
```

**Step 4: Mirror types to client** (duplicate for now — can extract to shared package later if needed)

Copy the same type definitions to `packages/client/src/types/`. The client types are identical but imported locally to avoid cross-package build complexity at this stage.

**Step 5: Commit**

```bash
git add packages/*/src/types/
git commit -m "feat: add shared TypeScript type definitions for agents, config, and chat"
```

---

### Task 3: Config loader (server reads CONTENT_ROOT/config.yaml)

**Files:**
- Create: `packages/server/src/config.ts`
- Create: `packages/server/src/config.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/server/src/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from './config.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('loadConfig', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcc-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('loads a valid config.yaml', () => {
    const yaml = `
branding:
  name: Test Office
  shortName: TO

gateway:
  url: http://localhost:18789
  token: test-token

agents:
  alice:
    name: Alice
    role: Tester
    emoji: "🧪"
    color:
      from: "#ff0000"
      to: "#00ff00"
    channel: "#test"
    greeting: Hello
    position:
      zone: desk
      x: 1
      y: 1
    tabs: []
`;
    fs.writeFileSync(path.join(tmpDir, 'config.yaml'), yaml);
    const config = loadConfig(tmpDir);
    expect(config.branding.name).toBe('Test Office');
    expect(config.agents.alice.name).toBe('Alice');
    expect(config.gateway.token).toBe('test-token');
  });

  it('throws if config.yaml is missing', () => {
    expect(() => loadConfig(tmpDir)).toThrow(/config\.yaml not found/);
  });

  it('throws if agents section is missing', () => {
    fs.writeFileSync(path.join(tmpDir, 'config.yaml'), 'branding:\n  name: X\n');
    expect(() => loadConfig(tmpDir)).toThrow(/agents/);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run packages/server/src/config.test.ts
```
Expected: FAIL — `loadConfig` not defined

**Step 3: Write minimal implementation**

```typescript
// packages/server/src/config.ts
import fs from 'fs';
import path from 'path';
import { parse as parseYaml } from 'yaml';
import type { AppConfig } from './types/config.js';

export function resolveContentRoot(): string {
  const raw = process.env.CONTENT_ROOT || '~/.openclaw';
  return raw.startsWith('~') ? raw.replace('~', process.env.HOME || '') : raw;
}

export function loadConfig(contentRoot?: string): AppConfig {
  const root = contentRoot || resolveContentRoot();
  const configPath = path.join(root, 'config.yaml');

  if (!fs.existsSync(configPath)) {
    throw new Error(`config.yaml not found at ${configPath}`);
  }

  const raw = fs.readFileSync(configPath, 'utf-8');
  const config = parseYaml(raw) as AppConfig;

  if (!config.agents || Object.keys(config.agents).length === 0) {
    throw new Error('config.yaml must define at least one agent in the agents section');
  }

  return config;
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run packages/server/src/config.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/config.ts packages/server/src/config.test.ts
git commit -m "feat: add YAML config loader with CONTENT_ROOT resolution"
```

---

### Task 4: Content directory initialization

**Files:**
- Create: `packages/server/src/content.ts`
- Create: `packages/server/src/content.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/server/src/content.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ensureContentDirs, getContentPath } from './content.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('content directory', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcc-content-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('creates required subdirectories', () => {
    ensureContentDirs(tmpDir);
    expect(fs.existsSync(path.join(tmpDir, 'data'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'files', 'inbox'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'files', 'approved'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'files', 'archive'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'databases'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'memory', 'agents'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'assets'))).toBe(true);
  });

  it('resolves paths relative to content root', () => {
    ensureContentDirs(tmpDir);
    expect(getContentPath(tmpDir, 'data', 'standup.json'))
      .toBe(path.join(tmpDir, 'data', 'standup.json'));
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run packages/server/src/content.test.ts
```

**Step 3: Write minimal implementation**

```typescript
// packages/server/src/content.ts
import fs from 'fs';
import path from 'path';

const REQUIRED_DIRS = [
  'data',
  'data/token-usage',
  'files/inbox',
  'files/approved',
  'files/archive',
  'databases',
  'memory/agents',
  'assets',
];

export function ensureContentDirs(contentRoot: string): void {
  for (const dir of REQUIRED_DIRS) {
    fs.mkdirSync(path.join(contentRoot, dir), { recursive: true });
  }
}

export function getContentPath(contentRoot: string, ...segments: string[]): string {
  return path.join(contentRoot, ...segments);
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run packages/server/src/content.test.ts
```

**Step 5: Commit**

```bash
git add packages/server/src/content.ts packages/server/src/content.test.ts
git commit -m "feat: add content directory initialization and path resolution"
```

---

## Phase 2: Server Middleware — Gateway Connection & Chat

### Task 5: SQLite database layer

**Files:**
- Create: `packages/server/src/db.ts`
- Create: `packages/server/src/db.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/server/src/db.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, type ChatDB } from './db.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('ChatDB', () => {
  let tmpDir: string;
  let db: ChatDB;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcc-db-'));
    db = createDatabase(path.join(tmpDir, 'chat.db'));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('inserts and retrieves messages', () => {
    const result = db.addMessage('isla', 'user', 'hello', Date.now());
    expect(result.duplicate).toBe(false);
    expect(result.seq).toBeGreaterThan(0);

    const messages = db.getMessages('isla');
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('hello');
  });

  it('detects idempotency key duplicates', () => {
    db.addMessage('isla', 'user', 'hello', Date.now(), 'key-1');
    const dupe = db.addMessage('isla', 'user', 'hello', Date.now(), 'key-1');
    expect(dupe.duplicate).toBe(true);
  });

  it('detects content duplicates within 10s window', () => {
    const now = Date.now();
    db.addMessage('isla', 'user', 'hello', now);
    const dupe = db.addMessage('isla', 'user', 'hello', now + 5000);
    expect(dupe.duplicate).toBe(true);
  });

  it('clears messages for an agent', () => {
    db.addMessage('isla', 'user', 'hello', Date.now());
    db.clearMessages('isla');
    expect(db.getMessages('isla')).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run packages/server/src/db.test.ts
```

**Step 3: Write implementation**

```typescript
// packages/server/src/db.ts
import Database from 'better-sqlite3';

export interface ChatDB {
  addMessage(agent: string, role: string, content: string, timestamp: number, idempotencyKey?: string, metadata?: Record<string, unknown>): { seq: number; duplicate: boolean };
  getMessages(agent: string): Array<{ seq: number; agent: string; role: string; content: string; timestamp: number; metadata?: string }>;
  getMessagesSince(agent: string, sinceSeq: number): Array<{ seq: number; agent: string; role: string; content: string; timestamp: number }>;
  clearMessages(agent: string): void;
  close(): void;
}

export function createDatabase(dbPath: string): ChatDB {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      agent TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      idempotency_key TEXT UNIQUE,
      metadata TEXT
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_messages_agent ON messages(agent, seq)');

  const insertStmt = db.prepare(
    'INSERT INTO messages (agent, role, content, timestamp, idempotency_key, metadata) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const getByAgentStmt = db.prepare('SELECT * FROM messages WHERE agent = ? ORDER BY seq');
  const getByAgentSinceStmt = db.prepare('SELECT * FROM messages WHERE agent = ? AND seq > ? ORDER BY seq');
  const checkIdempotencyStmt = db.prepare('SELECT seq FROM messages WHERE idempotency_key = ?');
  const checkContentDupeStmt = db.prepare('SELECT seq FROM messages WHERE agent = ? AND role = ? AND content = ? AND ABS(timestamp - ?) < 10000');
  const clearStmt = db.prepare('DELETE FROM messages WHERE agent = ?');

  return {
    addMessage(agent, role, content, timestamp, idempotencyKey, metadata) {
      if (idempotencyKey) {
        const existing = checkIdempotencyStmt.get(idempotencyKey) as { seq: number } | undefined;
        if (existing) return { seq: existing.seq, duplicate: true };
      }

      const contentDupe = checkContentDupeStmt.get(agent, role, content, timestamp) as { seq: number } | undefined;
      if (contentDupe) return { seq: contentDupe.seq, duplicate: true };

      try {
        const result = insertStmt.run(agent, role, content, timestamp, idempotencyKey ?? null, metadata ? JSON.stringify(metadata) : null);
        return { seq: Number(result.lastInsertRowid), duplicate: false };
      } catch (e: unknown) {
        if (e instanceof Error && e.message.includes('UNIQUE constraint')) {
          const existing = checkIdempotencyStmt.get(idempotencyKey!) as { seq: number } | undefined;
          return { seq: existing?.seq ?? 0, duplicate: true };
        }
        throw e;
      }
    },

    getMessages(agent) {
      return getByAgentStmt.all(agent) as Array<{ seq: number; agent: string; role: string; content: string; timestamp: number; metadata?: string }>;
    },

    getMessagesSince(agent, sinceSeq) {
      return getByAgentSinceStmt.all(agent, sinceSeq) as Array<{ seq: number; agent: string; role: string; content: string; timestamp: number }>;
    },

    clearMessages(agent) {
      clearStmt.run(agent);
    },

    close() {
      db.close();
    },
  };
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run packages/server/src/db.test.ts
```

**Step 5: Commit**

```bash
git add packages/server/src/db.ts packages/server/src/db.test.ts
git commit -m "feat: add SQLite database layer for chat message persistence"
```

---

### Task 6: Gateway WebSocket client

**Files:**
- Create: `packages/server/src/gateway/client.ts`
- Create: `packages/server/src/gateway/client.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/server/src/gateway/client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GatewayClient } from './client.js';

// We'll test the protocol logic, not actual WebSocket connections
describe('GatewayClient', () => {
  it('can be instantiated with url and token', () => {
    const client = new GatewayClient('ws://localhost:18789', 'test-token');
    expect(client).toBeDefined();
    expect(client.isConnected).toBe(false);
  });

  it('builds correct connect payload', () => {
    const client = new GatewayClient('ws://localhost:18789', 'test-token');
    const payload = client.buildConnectPayload();
    expect(payload.method).toBe('connect');
    expect(payload.params.auth.token).toBe('test-token');
    expect(payload.params.role).toBe('operator');
    expect(payload.params.minProtocol).toBe(3);
  });

  it('generates incrementing request IDs', () => {
    const client = new GatewayClient('ws://localhost:18789', 'test-token');
    const id1 = client.nextId();
    const id2 = client.nextId();
    expect(id2).toBeGreaterThan(id1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run packages/server/src/gateway/client.test.ts
```

**Step 3: Write implementation**

The Gateway client implements the protocol observed in the existing codebase:
1. Connect to WebSocket
2. Wait for `connect.challenge` event
3. Send `connect` request with auth token
4. Handle `res` frames (request responses) and `event` frames (chat events)
5. Keepalive ping/pong every 25s
6. Auto-reconnect with exponential backoff (3s-30s)

```typescript
// packages/server/src/gateway/client.ts
import WebSocket from 'ws';
import { EventEmitter } from 'events';

interface GatewayFrame {
  type: 'req' | 'res' | 'event';
  id?: number;
  method?: string;
  event?: string;
  ok?: boolean;
  payload?: Record<string, unknown>;
  params?: Record<string, unknown>;
  error?: unknown;
}

type PendingRequest = {
  resolve: (payload: Record<string, unknown>) => void;
  reject: (error: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class GatewayClient extends EventEmitter {
  private url: string;
  private token: string;
  private ws: WebSocket | null = null;
  private _connected = false;
  private _idCounter = 0;
  private pendingRequests = new Map<number, PendingRequest>();
  private reconnectDelay = 3000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private shouldReconnect = true;

  constructor(url: string, token: string) {
    super();
    this.url = url;
    this.token = token;
  }

  get isConnected(): boolean {
    return this._connected;
  }

  nextId(): number {
    return ++this._idCounter;
  }

  buildConnectPayload(): GatewayFrame {
    return {
      type: 'req',
      id: this.nextId(),
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: { id: 'openclaw-mcc', version: '1.0.0', platform: 'web', mode: 'ui' },
        role: 'operator',
        scopes: ['operator.read', 'operator.write', 'operator.admin'],
        auth: { token: this.token },
      },
    };
  }

  connect(): void {
    if (this.ws && this.ws.readyState <= WebSocket.CONNECTING) return;

    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.terminate();
    }

    this.ws = new WebSocket(this.url, {
      headers: { Origin: this.url.replace('ws:', 'http:') },
    });

    this.ws.on('open', () => {
      this.emit('state', 'connecting');
      this.reconnectDelay = 3000;
    });

    this.ws.on('message', (data) => {
      let frame: GatewayFrame;
      try {
        frame = JSON.parse(data.toString());
      } catch {
        return;
      }

      if (frame.type === 'event' && frame.event === 'connect.challenge') {
        this.sendConnect();
        return;
      }

      if (frame.type === 'res' && frame.id) {
        const pending = this.pendingRequests.get(frame.id);
        if (pending) {
          this.pendingRequests.delete(frame.id);
          clearTimeout(pending.timer);
          if (frame.ok) pending.resolve(frame.payload || {});
          else pending.reject(frame.error);
        }
        return;
      }

      if (frame.type === 'event') {
        this.emit('event', frame.event, frame.payload);
      }
    });

    this.ws.on('close', () => {
      this.cleanup();
      this.emit('state', 'disconnected');
      if (this.shouldReconnect) this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      this.emit('error', err);
    });
  }

  private sendConnect(): void {
    const payload = this.buildConnectPayload();
    const id = payload.id!;

    this.send(payload);

    const timer = setTimeout(() => {
      this.pendingRequests.delete(id);
      this.ws?.close();
    }, 10000);

    this.pendingRequests.set(id, {
      resolve: () => {
        this._connected = true;
        this.emit('state', 'connected');
        this.startPing();
      },
      reject: (err) => {
        this.emit('error', err);
        this.ws?.close();
      },
      timer,
    });
  }

  private send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  request(method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Gateway not connected'));
        return;
      }
      const id = this.nextId();
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Gateway request timeout'));
      }, 30000);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this.send({ type: 'req', id, method, params });
    });
  }

  private startPing(): void {
    this.stopPing();
    let pongReceived = true;
    this.pingInterval = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      if (!pongReceived) {
        this.ws.terminate();
        return;
      }
      pongReceived = false;
      this.ws.ping();
      this.ws.once('pong', () => { pongReceived = true; });
    }, 25000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private cleanup(): void {
    this._connected = false;
    this.stopPing();
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.emit('state', 'reconnecting');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30000);
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.cleanup();
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run packages/server/src/gateway/client.test.ts
```

**Step 5: Commit**

```bash
git add packages/server/src/gateway/
git commit -m "feat: add Gateway WebSocket client with challenge-response auth and auto-reconnect"
```

---

### Task 7: SSE chat streaming service

**Files:**
- Create: `packages/server/src/services/chat-streaming.ts`
- Create: `packages/server/src/services/chat-streaming.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/server/src/services/chat-streaming.test.ts
import { describe, it, expect, vi } from 'vitest';
import { ChatStreamService } from './chat-streaming.js';

describe('ChatStreamService', () => {
  it('tracks subscribers per agent', () => {
    const service = new ChatStreamService();
    expect(service.getSubscriberCount('isla')).toBe(0);
  });

  it('emits message events to listeners', () => {
    const service = new ChatStreamService();
    const handler = vi.fn();
    service.on('message', handler);

    service.broadcastDelta('isla', 'msg-1', 'hello');
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: 'isla',
        type: 'message.delta',
      })
    );
  });

  it('emits final events', () => {
    const service = new ChatStreamService();
    const handler = vi.fn();
    service.on('message', handler);

    service.broadcastFinal('isla', 'msg-1', 'full content');
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: 'isla',
        type: 'message.final',
        data: expect.objectContaining({ complete: true }),
      })
    );
  });

  it('emits abort events', () => {
    const service = new ChatStreamService();
    const handler = vi.fn();
    service.on('message', handler);

    service.broadcastAbort('isla', 'msg-1', 'user cancelled');
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'message.aborted',
      })
    );
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run packages/server/src/services/chat-streaming.test.ts
```

**Step 3: Write implementation**

```typescript
// packages/server/src/services/chat-streaming.ts
import { EventEmitter } from 'events';
import type { Response } from 'express';

interface StreamEvent {
  agent: string;
  type: string;
  data: Record<string, unknown>;
}

export class ChatStreamService extends EventEmitter {
  private subscriptions = new Map<string, Set<Response>>();

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  subscribe(agentKey: string, res: Response): void {
    if (!this.subscriptions.has(agentKey)) {
      this.subscriptions.set(agentKey, new Set());
    }
    const subs = this.subscriptions.get(agentKey)!;
    subs.add(res);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    this.sendSSE(res, 'connected', { agent: agentKey, timestamp: new Date().toISOString() });

    const messageHandler = (event: StreamEvent) => {
      if (event.agent === agentKey) {
        this.sendSSE(res, event.type, event.data);
      }
    };
    this.on('message', messageHandler);

    res.on('close', () => {
      this.removeListener('message', messageHandler);
      subs.delete(res);
      res.end();
    });
  }

  private sendSSE(res: Response, eventType: string, data: Record<string, unknown>): void {
    try {
      if (!res.writable) return;
      res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      // Client disconnected
    }
  }

  broadcastDelta(agent: string, messageId: string, content: string, seq?: number): void {
    this.emit('message', {
      agent,
      type: 'message.delta',
      data: { id: messageId, seq: seq ?? Date.now(), content, timestamp: new Date().toISOString() },
    });
  }

  broadcastFinal(agent: string, messageId: string, fullContent: string, seq?: number): void {
    this.emit('message', {
      agent,
      type: 'message.final',
      data: { id: messageId, seq: seq ?? Date.now(), content: fullContent, complete: true, timestamp: new Date().toISOString() },
    });
  }

  broadcastError(agent: string, messageId: string, error: string, seq?: number): void {
    this.emit('message', {
      agent,
      type: 'message.error',
      data: { id: messageId, seq: seq ?? Date.now(), error, timestamp: new Date().toISOString() },
    });
  }

  broadcastAbort(agent: string, messageId: string, reason: string): void {
    this.emit('message', {
      agent,
      type: 'message.aborted',
      data: { id: messageId, reason, timestamp: new Date().toISOString() },
    });
  }

  broadcastContextUpdate(agent: string, tokens: number, maxTokens: number): void {
    this.emit('message', {
      agent,
      type: 'context.update',
      data: {
        tokens,
        maxTokens,
        percentUsed: Math.round((tokens / maxTokens) * 100),
        warning: tokens > maxTokens * 0.8,
        timestamp: new Date().toISOString(),
      },
    });
  }

  getSubscriberCount(agent: string): number {
    return this.subscriptions.get(agent)?.size ?? 0;
  }
}
```

**Step 4: Run test, Step 5: Commit**

```bash
npx vitest run packages/server/src/services/chat-streaming.test.ts
git add packages/server/src/services/
git commit -m "feat: add SSE chat streaming service for real-time message delivery"
```

---

### Task 8: Express server with chat, config, and health routes

**Files:**
- Create: `packages/server/src/index.ts`
- Create: `packages/server/src/routes/chat.ts`
- Create: `packages/server/src/routes/config.ts`
- Create: `packages/server/src/routes/health.ts`

**Step 1: Write the server entry point**

```typescript
// packages/server/src/index.ts
import express from 'express';
import cors from 'cors';
import { loadConfig, resolveContentRoot } from './config.js';
import { ensureContentDirs } from './content.js';
import { createDatabase } from './db.js';
import { GatewayClient } from './gateway/client.js';
import { ChatStreamService } from './services/chat-streaming.js';
import { createChatRoutes } from './routes/chat.js';
import { createConfigRoutes } from './routes/config.js';
import { createHealthRoutes } from './routes/health.js';
import path from 'path';

const contentRoot = resolveContentRoot();
const config = loadConfig(contentRoot);
ensureContentDirs(contentRoot);

const db = createDatabase(path.join(contentRoot, 'databases', 'chat.db'));
const gateway = new GatewayClient(config.gateway.url.replace('http:', 'ws:'), config.gateway.token);
const chatStream = new ChatStreamService();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api', createHealthRoutes(gateway));
app.use('/api', createConfigRoutes(config));
app.use('/api', createChatRoutes(db, gateway, chatStream, config));

const PORT = parseInt(process.env.SERVER_PORT || '8081', 10);
app.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
  console.log(`[Server] Content root: ${contentRoot}`);
  gateway.connect();
});

// Handle gateway chat events
gateway.on('event', (event: string, payload: Record<string, unknown>) => {
  if (event === 'chat') {
    // Route chat events to streaming service
    const agentKey = payload.agent as string;
    if (payload.delta) {
      chatStream.broadcastDelta(agentKey, payload.messageId as string, payload.delta as string);
    }
    if (payload.final) {
      chatStream.broadcastFinal(agentKey, payload.messageId as string, payload.content as string);
      db.addMessage(agentKey, 'assistant', payload.content as string, Date.now());
    }
  }
});

gateway.on('state', (state: string) => {
  console.log(`[Gateway] ${state}`);
});

process.on('SIGTERM', () => {
  gateway.disconnect();
  db.close();
  process.exit(0);
});
```

**Step 2: Write chat routes**

```typescript
// packages/server/src/routes/chat.ts
import { Router } from 'express';
import crypto from 'crypto';
import type { ChatDB } from '../db.js';
import type { GatewayClient } from '../gateway/client.js';
import type { ChatStreamService } from '../services/chat-streaming.js';
import type { AppConfig } from '../types/config.js';

export function createChatRoutes(db: ChatDB, gateway: GatewayClient, stream: ChatStreamService, config: AppConfig): Router {
  const router = Router();

  // SSE stream for real-time updates
  router.get('/chat-stream/:agentKey', (req, res) => {
    const { agentKey } = req.params;
    if (!config.agents[agentKey]) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    stream.subscribe(agentKey, res);
  });

  // Send message to agent
  router.post('/chat/:agentKey', async (req, res) => {
    const { agentKey } = req.params;
    const { content, idempotencyKey } = req.body;

    if (!config.agents[agentKey]) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    if (!content?.trim()) {
      res.status(400).json({ error: 'Message content required' });
      return;
    }

    const key = idempotencyKey || crypto.randomUUID();
    const result = db.addMessage(agentKey, 'user', content, Date.now(), key);
    if (result.duplicate) {
      res.json({ seq: result.seq, duplicate: true });
      return;
    }

    // Forward to Gateway
    const sessionKey = `agent:${agentKey}:webchat:user`;
    try {
      await gateway.request('chat.send', { session: sessionKey, content });
      res.json({ seq: result.seq, duplicate: false });
    } catch (err) {
      res.status(502).json({ error: 'Gateway error', details: (err as Error).message });
    }
  });

  // Get chat history
  router.get('/chat-history/:agentKey', (req, res) => {
    const { agentKey } = req.params;
    if (!config.agents[agentKey]) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    const sinceSeq = parseInt(req.query.since as string, 10) || 0;
    const messages = sinceSeq > 0 ? db.getMessagesSince(agentKey, sinceSeq) : db.getMessages(agentKey);
    res.json(messages);
  });

  // Clear chat history
  router.delete('/chat/:agentKey', (req, res) => {
    const { agentKey } = req.params;
    if (!config.agents[agentKey]) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    db.clearMessages(agentKey);
    res.json({ ok: true });
  });

  // Interrupt agent response
  router.post('/chat/:agentKey/interrupt', async (req, res) => {
    const { agentKey } = req.params;
    try {
      await gateway.request('chat.interrupt', { session: `agent:${agentKey}:webchat:user` });
      stream.broadcastAbort(agentKey, 'interrupt', 'user cancelled');
      res.json({ ok: true });
    } catch (err) {
      res.status(502).json({ error: 'Gateway error', details: (err as Error).message });
    }
  });

  return router;
}
```

**Step 3: Write config and health routes**

```typescript
// packages/server/src/routes/config.ts
import { Router } from 'express';
import type { AppConfig } from '../types/config.js';

export function createConfigRoutes(config: AppConfig): Router {
  const router = Router();

  router.get('/config', (_req, res) => {
    // Send config without sensitive fields
    const { gateway: _gw, ...safe } = config;
    res.json(safe);
  });

  return router;
}
```

```typescript
// packages/server/src/routes/health.ts
import { Router } from 'express';
import type { GatewayClient } from '../gateway/client.js';

export function createHealthRoutes(gateway: GatewayClient): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      gateway: gateway.isConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
```

**Step 4: Commit**

```bash
git add packages/server/src/
git commit -m "feat: add Express server with chat, config, and health API routes"
```

---

## Phase 3: React Frontend — Shell & State

### Task 9: Vite + React app shell with Tailwind

**Files:**
- Modify: `packages/client/src/App.tsx`
- Create: `packages/client/src/index.css`
- Modify: `packages/client/vite.config.ts`
- Create: `packages/client/src/layouts/DashboardLayout.tsx`

**Step 1: Configure Vite with Tailwind and proxy**

```typescript
// packages/client/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3001,
    proxy: {
      '/api': 'http://localhost:8081',
      '/ws': { target: 'ws://localhost:8081', ws: true },
    },
  },
});
```

**Step 2: Set up Tailwind v4 entry CSS**

```css
/* packages/client/src/index.css */
@import "tailwindcss";

@theme {
  --color-surface: #1a1a2e;
  --color-surface-raised: #25253e;
  --color-surface-overlay: #2d2d4a;
  --color-accent: #0ea5e9;
  --color-text-primary: #f1f5f9;
  --color-text-secondary: #94a3b8;
}
```

**Step 3: Create dashboard layout shell**

```tsx
// packages/client/src/layouts/DashboardLayout.tsx
import { useState } from 'react';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidePanel, setSidePanel] = useState<string | null>(null);

  return (
    <div className="h-screen w-screen bg-surface text-text-primary flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="h-12 bg-surface-raised border-b border-white/10 flex items-center px-4 shrink-0">
        <h1 className="text-sm font-semibold">OpenClaw Office</h1>
        <nav className="ml-auto flex gap-2">
          <button className="px-3 py-1 text-xs rounded bg-surface-overlay hover:bg-accent/20">
            Office
          </button>
          <button className="px-3 py-1 text-xs rounded bg-surface-overlay hover:bg-accent/20">
            Channels
          </button>
          <button className="px-3 py-1 text-xs rounded bg-surface-overlay hover:bg-accent/20">
            Files
          </button>
        </nav>
      </header>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Office canvas area */}
        <main className="flex-1 relative">
          {children}
        </main>

        {/* Side panel (agent chat/info) */}
        {sidePanel && (
          <aside className="w-96 bg-surface-raised border-l border-white/10 flex flex-col">
            <div className="p-4">
              <button onClick={() => setSidePanel(null)} className="text-text-secondary hover:text-text-primary">
                Close
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* Bottom bar for mobile */}
      <footer className="h-14 bg-surface-raised border-t border-white/10 flex items-center justify-around px-4 md:hidden">
        <button className="text-xs text-text-secondary">Office</button>
        <button className="text-xs text-text-secondary">Chat</button>
        <button className="text-xs text-text-secondary">Files</button>
      </footer>
    </div>
  );
}
```

**Step 4: Wire up App.tsx**

```tsx
// packages/client/src/App.tsx
import { DashboardLayout } from './layouts/DashboardLayout';

export default function App() {
  return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-full text-text-secondary">
        Office canvas will render here
      </div>
    </DashboardLayout>
  );
}
```

**Step 5: Commit**

```bash
git add packages/client/
git commit -m "feat: add React app shell with Tailwind v4 and dashboard layout"
```

---

### Task 10: Zustand stores (agents, chat, UI)

**Files:**
- Create: `packages/client/src/stores/agentStore.ts`
- Create: `packages/client/src/stores/chatStore.ts`
- Create: `packages/client/src/stores/uiStore.ts`

**Step 1: Agent store**

```typescript
// packages/client/src/stores/agentStore.ts
import { create } from 'zustand';
import type { AgentConfig } from '../types/agent';

interface AgentState {
  agents: Record<string, AgentConfig>;
  loading: boolean;
  error: string | null;
  setAgents: (agents: Record<string, AgentConfig>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  agents: {},
  loading: true,
  error: null,
  setAgents: (agents) => set({ agents, loading: false }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
}));
```

**Step 2: Chat store**

```typescript
// packages/client/src/stores/chatStore.ts
import { create } from 'zustand';

interface Message {
  seq: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  streaming?: boolean;
}

interface ChatState {
  messages: Record<string, Message[]>;       // agentKey -> messages
  drafts: Record<string, string>;            // agentKey -> draft text
  streaming: Record<string, boolean>;        // agentKey -> is streaming
  streamBuffer: Record<string, string>;      // agentKey -> partial content

  addMessage: (agent: string, msg: Message) => void;
  setMessages: (agent: string, msgs: Message[]) => void;
  setDraft: (agent: string, text: string) => void;
  setStreaming: (agent: string, streaming: boolean) => void;
  appendStreamBuffer: (agent: string, content: string) => void;
  finalizeStream: (agent: string, content: string) => void;
  clearMessages: (agent: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: {},
  drafts: {},
  streaming: {},
  streamBuffer: {},

  addMessage: (agent, msg) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [agent]: [...(s.messages[agent] || []), msg],
      },
    })),

  setMessages: (agent, msgs) =>
    set((s) => ({ messages: { ...s.messages, [agent]: msgs } })),

  setDraft: (agent, text) =>
    set((s) => ({ drafts: { ...s.drafts, [agent]: text } })),

  setStreaming: (agent, streaming) =>
    set((s) => ({
      streaming: { ...s.streaming, [agent]: streaming },
      ...(streaming ? { streamBuffer: { ...s.streamBuffer, [agent]: '' } } : {}),
    })),

  appendStreamBuffer: (agent, content) =>
    set((s) => ({
      streamBuffer: {
        ...s.streamBuffer,
        [agent]: (s.streamBuffer[agent] || '') + content,
      },
    })),

  finalizeStream: (agent, content) =>
    set((s) => ({
      streaming: { ...s.streaming, [agent]: false },
      streamBuffer: { ...s.streamBuffer, [agent]: '' },
      messages: {
        ...s.messages,
        [agent]: [
          ...(s.messages[agent] || []),
          { seq: Date.now(), role: 'assistant', content, timestamp: Date.now() },
        ],
      },
    })),

  clearMessages: (agent) =>
    set((s) => ({ messages: { ...s.messages, [agent]: [] } })),
}));
```

**Step 3: UI store**

```typescript
// packages/client/src/stores/uiStore.ts
import { create } from 'zustand';

type View = 'office' | 'channels' | 'files';

interface UIState {
  activeView: View;
  activeAgent: string | null;
  panelOpen: boolean;
  setView: (view: View) => void;
  openAgentPanel: (agentKey: string) => void;
  closePanel: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeView: 'office',
  activeAgent: null,
  panelOpen: false,
  setView: (view) => set({ activeView: view }),
  openAgentPanel: (agentKey) => set({ activeAgent: agentKey, panelOpen: true }),
  closePanel: () => set({ panelOpen: false }),
}));
```

**Step 4: Commit**

```bash
git add packages/client/src/stores/
git commit -m "feat: add Zustand stores for agents, chat, and UI state"
```

---

### Task 11: API hooks (useConfig, useChat, useSSE)

**Files:**
- Create: `packages/client/src/hooks/useConfig.ts`
- Create: `packages/client/src/hooks/useChat.ts`
- Create: `packages/client/src/hooks/useSSE.ts`

**Step 1: Config hook**

```typescript
// packages/client/src/hooks/useConfig.ts
import { useEffect } from 'react';
import { useAgentStore } from '../stores/agentStore';

export function useConfig() {
  const { setAgents, setError, loading } = useAgentStore();

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((data) => setAgents(data.agents))
      .catch((err) => setError(err.message));
  }, [setAgents, setError]);

  return { loading };
}
```

**Step 2: SSE hook**

```typescript
// packages/client/src/hooks/useSSE.ts
import { useEffect, useRef } from 'react';
import { useChatStore } from '../stores/chatStore';

export function useSSE(agentKey: string | null) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const { appendStreamBuffer, finalizeStream, setStreaming } = useChatStore();

  useEffect(() => {
    if (!agentKey) return;

    const es = new EventSource(`/api/chat-stream/${agentKey}`);
    eventSourceRef.current = es;

    es.addEventListener('message.delta', (e) => {
      const data = JSON.parse(e.data);
      setStreaming(agentKey, true);
      appendStreamBuffer(agentKey, data.content);
    });

    es.addEventListener('message.final', (e) => {
      const data = JSON.parse(e.data);
      finalizeStream(agentKey, data.content);
    });

    es.addEventListener('message.aborted', () => {
      setStreaming(agentKey, false);
    });

    es.addEventListener('message.error', (e) => {
      console.error('SSE error:', JSON.parse(e.data));
      setStreaming(agentKey, false);
    });

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [agentKey, appendStreamBuffer, finalizeStream, setStreaming]);
}
```

**Step 3: Chat hook**

```typescript
// packages/client/src/hooks/useChat.ts
import { useCallback } from 'react';
import { useChatStore } from '../stores/chatStore';

export function useChat(agentKey: string) {
  const { addMessage, drafts, setDraft } = useChatStore();

  const sendMessage = useCallback(async (content: string) => {
    const idempotencyKey = crypto.randomUUID();
    addMessage(agentKey, {
      seq: Date.now(),
      role: 'user',
      content,
      timestamp: Date.now(),
    });
    setDraft(agentKey, '');

    await fetch(`/api/chat/${agentKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, idempotencyKey }),
    });
  }, [agentKey, addMessage, setDraft]);

  const loadHistory = useCallback(async () => {
    const res = await fetch(`/api/chat-history/${agentKey}`);
    const messages = await res.json();
    useChatStore.getState().setMessages(agentKey, messages);
  }, [agentKey]);

  const interrupt = useCallback(async () => {
    await fetch(`/api/chat/${agentKey}/interrupt`, { method: 'POST' });
  }, [agentKey]);

  return {
    draft: drafts[agentKey] || '',
    setDraft: (text: string) => setDraft(agentKey, text),
    sendMessage,
    loadHistory,
    interrupt,
  };
}
```

**Step 4: Commit**

```bash
git add packages/client/src/hooks/
git commit -m "feat: add React hooks for config loading, SSE streaming, and chat operations"
```

---

## Phase 4: Chat UI Components

### Task 12: Chat panel component

**Files:**
- Create: `packages/client/src/components/ChatPanel.tsx`
- Create: `packages/client/src/components/ChatMessage.tsx`
- Create: `packages/client/src/components/ChatInput.tsx`

**Step 1: ChatMessage component**

```tsx
// packages/client/src/components/ChatMessage.tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  role: 'user' | 'assistant';
  content: string;
  agentName?: string;
  streaming?: boolean;
}

export function ChatMessage({ role, content, agentName, streaming }: Props) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-accent text-white'
            : 'bg-surface-overlay text-text-primary'
        }`}
      >
        {!isUser && agentName && (
          <div className="text-xs text-text-secondary mb-1 font-medium">{agentName}</div>
        )}
        <div className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
        {streaming && (
          <span className="inline-block w-2 h-4 bg-accent animate-pulse ml-1" />
        )}
      </div>
    </div>
  );
}
```

**Step 2: ChatInput component**

```tsx
// packages/client/src/components/ChatInput.tsx
import { useState, useRef, useCallback } from 'react';

interface Props {
  value: string;
  onChange: (text: string) => void;
  onSend: (text: string) => void;
  onInterrupt?: () => void;
  isStreaming: boolean;
  placeholder?: string;
}

export function ChatInput({ value, onChange, onSend, onInterrupt, isStreaming, placeholder }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (isStreaming && onInterrupt) {
          onInterrupt();
        } else if (value.trim()) {
          onSend(value.trim());
        }
      }
    },
    [value, onSend, onInterrupt, isStreaming]
  );

  return (
    <div className="border-t border-white/10 p-3 bg-surface-raised">
      <div className="flex gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Type a message...'}
          rows={1}
          className="flex-1 bg-surface-overlay text-text-primary rounded-lg px-3 py-2 resize-none text-sm focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          onClick={() => {
            if (isStreaming && onInterrupt) onInterrupt();
            else if (value.trim()) onSend(value.trim());
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            isStreaming
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-accent hover:bg-accent/80 text-white'
          }`}
        >
          {isStreaming ? 'Stop' : 'Send'}
        </button>
      </div>
    </div>
  );
}
```

**Step 3: ChatPanel composition**

```tsx
// packages/client/src/components/ChatPanel.tsx
import { useEffect, useRef } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useChat } from '../hooks/useChat';
import { useSSE } from '../hooks/useSSE';
import { useChatStore } from '../stores/chatStore';
import { useAgentStore } from '../stores/agentStore';

interface Props {
  agentKey: string;
}

export function ChatPanel({ agentKey }: Props) {
  const { draft, setDraft, sendMessage, loadHistory, interrupt } = useChat(agentKey);
  const messages = useChatStore((s) => s.messages[agentKey] || []);
  const isStreaming = useChatStore((s) => s.streaming[agentKey] || false);
  const streamBuffer = useChatStore((s) => s.streamBuffer[agentKey] || '');
  const agent = useAgentStore((s) => s.agents[agentKey]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useSSE(agentKey);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streamBuffer]);

  return (
    <div className="flex flex-col h-full">
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
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {messages.map((msg, i) => (
          <ChatMessage
            key={msg.seq || i}
            role={msg.role}
            content={msg.content}
            agentName={msg.role === 'assistant' ? agent?.name : undefined}
          />
        ))}
        {isStreaming && streamBuffer && (
          <ChatMessage role="assistant" content={streamBuffer} agentName={agent?.name} streaming />
        )}
      </div>

      {/* Input */}
      <ChatInput
        value={draft}
        onChange={setDraft}
        onSend={sendMessage}
        onInterrupt={interrupt}
        isStreaming={isStreaming}
        placeholder={`Message ${agent?.name || 'agent'}...`}
      />
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add packages/client/src/components/
git commit -m "feat: add ChatPanel, ChatMessage, and ChatInput components with streaming support"
```

---

## Phase 5: Isometric Office (PixiJS)

### Task 13: PixiJS application wrapper as React component

**Files:**
- Create: `packages/client/src/canvas/OfficeCanvas.tsx`
- Create: `packages/client/src/canvas/IsometricScene.ts`
- Create: `packages/client/src/canvas/tiles.ts`

**Step 1: Create the React wrapper for PixiJS**

```tsx
// packages/client/src/canvas/OfficeCanvas.tsx
import { useEffect, useRef } from 'react';
import { Application } from 'pixi.js';
import { IsometricScene } from './IsometricScene';
import { useAgentStore } from '../stores/agentStore';
import { useUIStore } from '../stores/uiStore';

export function OfficeCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const sceneRef = useRef<IsometricScene | null>(null);
  const agents = useAgentStore((s) => s.agents);
  const openAgentPanel = useUIStore((s) => s.openAgentPanel);

  useEffect(() => {
    if (!containerRef.current) return;

    const app = new Application();
    appRef.current = app;

    (async () => {
      await app.init({
        resizeTo: containerRef.current!,
        background: 0x1a1a2e,
        antialias: true,
      });
      containerRef.current!.appendChild(app.canvas);

      const scene = new IsometricScene(app, agents);
      sceneRef.current = scene;

      scene.on('agentClick', (agentKey: string) => {
        openAgentPanel(agentKey);
      });

      scene.render();
    })();

    return () => {
      sceneRef.current?.destroy();
      appRef.current?.destroy(true);
    };
  }, [agents, openAgentPanel]);

  return <div ref={containerRef} className="w-full h-full" />;
}
```

**Step 2: Create isometric scene class**

This is a placeholder that renders a tile grid and agent markers. Full sprite loading comes in Task 14.

```typescript
// packages/client/src/canvas/IsometricScene.ts
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { EventEmitter } from 'events';
import type { AgentConfig } from '../types/agent';
import { TILE_WIDTH, TILE_HEIGHT, isoToScreen } from './tiles';

export class IsometricScene extends EventEmitter {
  private app: Application;
  private world: Container;
  private agents: Record<string, AgentConfig>;
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private worldStart = { x: 0, y: 0 };

  constructor(app: Application, agents: Record<string, AgentConfig>) {
    super();
    this.app = app;
    this.agents = agents;
    this.world = new Container();
    this.app.stage.addChild(this.world);
    this.setupPanZoom();
  }

  render(): void {
    this.drawFloor(12, 10);
    this.drawAgents();
    // Center the world
    this.world.x = this.app.screen.width / 2;
    this.world.y = 100;
  }

  private drawFloor(cols: number, rows: number): void {
    const floor = new Graphics();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const { x, y } = isoToScreen(c, r);
        const color = (r + c) % 2 === 0 ? 0x2d2d4a : 0x25253e;
        floor.poly([
          { x, y },
          { x: x + TILE_WIDTH / 2, y: y + TILE_HEIGHT / 2 },
          { x, y: y + TILE_HEIGHT },
          { x: x - TILE_WIDTH / 2, y: y + TILE_HEIGHT / 2 },
        ]);
        floor.fill(color);
        floor.stroke({ width: 1, color: 0x3d3d5a, alpha: 0.3 });
      }
    }
    this.world.addChild(floor);
  }

  private drawAgents(): void {
    for (const [key, agent] of Object.entries(this.agents)) {
      const pos = agent.position || { x: 1, y: 1 };
      const { x, y } = isoToScreen(pos.x, pos.y);

      const container = new Container();
      container.x = x;
      container.y = y;
      container.eventMode = 'static';
      container.cursor = 'pointer';

      // Placeholder: colored circle + emoji
      const circle = new Graphics();
      circle.circle(0, -16, 20);
      circle.fill(parseInt(agent.color.from.replace('#', ''), 16));
      container.addChild(circle);

      const label = new Text({
        text: agent.emoji,
        style: new TextStyle({ fontSize: 24 }),
      });
      label.anchor.set(0.5, 0.5);
      label.y = -16;
      container.addChild(label);

      const nameText = new Text({
        text: agent.name,
        style: new TextStyle({ fontSize: 10, fill: 0xf1f5f9 }),
      });
      nameText.anchor.set(0.5, 0);
      nameText.y = 8;
      container.addChild(nameText);

      container.on('pointerdown', () => this.emit('agentClick', key));
      this.world.addChild(container);
    }
  }

  private setupPanZoom(): void {
    const stage = this.app.stage;
    stage.eventMode = 'static';
    stage.hitArea = this.app.screen;

    stage.on('pointerdown', (e) => {
      this.isDragging = true;
      this.dragStart = { x: e.global.x, y: e.global.y };
      this.worldStart = { x: this.world.x, y: this.world.y };
    });

    stage.on('pointermove', (e) => {
      if (!this.isDragging) return;
      this.world.x = this.worldStart.x + (e.global.x - this.dragStart.x);
      this.world.y = this.worldStart.y + (e.global.y - this.dragStart.y);
    });

    stage.on('pointerup', () => { this.isDragging = false; });
    stage.on('pointerupoutside', () => { this.isDragging = false; });

    this.app.canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      const scale = this.world.scale.x;
      const newScale = Math.max(0.3, Math.min(3, scale - e.deltaY * 0.001));
      this.world.scale.set(newScale);
    });
  }

  destroy(): void {
    this.world.destroy({ children: true });
  }
}
```

**Step 3: Tile math utility**

```typescript
// packages/client/src/canvas/tiles.ts
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

export function isoToScreen(col: number, row: number): { x: number; y: number } {
  return {
    x: (col - row) * (TILE_WIDTH / 2),
    y: (col + row) * (TILE_HEIGHT / 2),
  };
}

export function screenToIso(screenX: number, screenY: number): { col: number; row: number } {
  return {
    col: Math.round((screenX / (TILE_WIDTH / 2) + screenY / (TILE_HEIGHT / 2)) / 2),
    row: Math.round((screenY / (TILE_HEIGHT / 2) - screenX / (TILE_WIDTH / 2)) / 2),
  };
}
```

**Step 4: Commit**

```bash
git add packages/client/src/canvas/
git commit -m "feat: add PixiJS isometric office scene with tile grid, agent markers, and pan/zoom"
```

---

### Task 14: Sprite loading system

**Files:**
- Create: `packages/client/src/canvas/SpriteManager.ts`
- Create: `packages/client/public/sprites/placeholder/` (placeholder sprites)

**Step 1: Create sprite manager**

```typescript
// packages/client/src/canvas/SpriteManager.ts
import { Assets, Spritesheet, Texture } from 'pixi.js';

export type SpriteState = 'idle' | 'working' | 'walking' | 'talking' | 'meeting';

interface SpriteConfig {
  texture: Texture;
  animations: Record<SpriteState, Texture[]>;
}

export class SpriteManager {
  private sprites = new Map<string, SpriteConfig>();
  private fallbackTexture: Texture | null = null;

  async loadPlaceholders(): Promise<void> {
    // Load a simple colored circle as fallback
    this.fallbackTexture = Texture.WHITE;
  }

  async loadAgentSprite(agentKey: string, spritePath?: string): Promise<void> {
    if (!spritePath) return;
    try {
      const texture = await Assets.load(spritePath);
      this.sprites.set(agentKey, {
        texture,
        animations: {
          idle: [texture],
          working: [texture],
          walking: [texture],
          talking: [texture],
          meeting: [texture],
        },
      });
    } catch {
      console.warn(`Failed to load sprite for ${agentKey}, using fallback`);
    }
  }

  getTexture(agentKey: string, state: SpriteState = 'idle'): Texture {
    const config = this.sprites.get(agentKey);
    if (config?.animations[state]?.[0]) return config.animations[state][0];
    if (config?.texture) return config.texture;
    return this.fallbackTexture || Texture.WHITE;
  }

  hasSprite(agentKey: string): boolean {
    return this.sprites.has(agentKey);
  }
}
```

**Step 2: Commit**

```bash
git add packages/client/src/canvas/SpriteManager.ts
git commit -m "feat: add sprite manager for loading and managing agent sprite sheets"
```

---

## Phase 6: Additional Features

### Task 15: File review routes and UI

**Files:**
- Create: `packages/server/src/routes/files.ts`
- Create: `packages/client/src/components/FileReview.tsx`
- Create: `packages/client/src/components/FileViewer.tsx`

**Step 1: Server file routes**

```typescript
// packages/server/src/routes/files.ts
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';

export function createFileRoutes(contentRoot: string): Router {
  const router = Router();
  const filesDir = path.join(contentRoot, 'files');

  // List files in inbox/approved/archive
  router.get('/files', (_req, res) => {
    const result: Record<string, string[]> = {};
    for (const folder of ['inbox', 'approved', 'archive']) {
      const dir = path.join(filesDir, folder);
      try {
        result[folder] = fs.readdirSync(dir).filter((f) => !f.startsWith('.'));
      } catch {
        result[folder] = [];
      }
    }
    res.json(result);
  });

  // Get file content
  router.get('/files/:folder/:filename', (req, res) => {
    const { folder, filename } = req.params;
    if (!['inbox', 'approved', 'archive'].includes(folder)) {
      res.status(400).json({ error: 'Invalid folder' });
      return;
    }
    const filePath = path.join(filesDir, folder, filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    res.sendFile(filePath);
  });

  // Move file between folders (approve, archive)
  router.post('/files/:folder/:filename/move', (req, res) => {
    const { folder, filename } = req.params;
    const { to } = req.body;
    if (!['inbox', 'approved', 'archive'].includes(to)) {
      res.status(400).json({ error: 'Invalid destination' });
      return;
    }
    const src = path.join(filesDir, folder, filename);
    const dest = path.join(filesDir, to, filename);
    try {
      fs.renameSync(src, dest);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Upload file (for image attachments in chat)
  const upload = multer({ dest: path.join(filesDir, 'inbox') });
  router.post('/files/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    // Rename from multer temp name to original name
    const dest = path.join(filesDir, 'inbox', req.file.originalname);
    fs.renameSync(req.file.path, dest);
    res.json({ filename: req.file.originalname, path: `inbox/${req.file.originalname}` });
  });

  return router;
}
```

**Step 2: Wire file routes into server index.ts** — add `app.use('/api', createFileRoutes(contentRoot))` to `packages/server/src/index.ts`

**Step 3: Create FileReview React component**

```tsx
// packages/client/src/components/FileReview.tsx
import { useEffect, useState } from 'react';
import { FileViewer } from './FileViewer';

interface FileList {
  inbox: string[];
  approved: string[];
  archive: string[];
}

export function FileReview() {
  const [files, setFiles] = useState<FileList>({ inbox: [], approved: [], archive: [] });
  const [activeFolder, setActiveFolder] = useState<'inbox' | 'approved' | 'archive'>('inbox');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/files').then((r) => r.json()).then(setFiles);
  }, []);

  const moveFile = async (filename: string, from: string, to: string) => {
    await fetch(`/api/files/${from}/${filename}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to }),
    });
    const updated = await fetch('/api/files').then((r) => r.json());
    setFiles(updated);
  };

  return (
    <div className="flex h-full">
      {/* File list sidebar */}
      <div className="w-64 border-r border-white/10 flex flex-col">
        <div className="flex border-b border-white/10">
          {(['inbox', 'approved', 'archive'] as const).map((folder) => (
            <button
              key={folder}
              onClick={() => setActiveFolder(folder)}
              className={`flex-1 px-2 py-2 text-xs capitalize ${
                activeFolder === folder ? 'bg-accent/20 text-accent' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {folder} ({files[folder]?.length || 0})
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {files[activeFolder]?.map((filename) => (
            <button
              key={filename}
              onClick={() => setSelectedFile(filename)}
              className={`w-full text-left px-2 py-1.5 rounded text-sm ${
                selectedFile === filename ? 'bg-accent/20' : 'hover:bg-surface-overlay'
              }`}
            >
              {filename}
            </button>
          ))}
        </div>
      </div>

      {/* File viewer */}
      <div className="flex-1">
        {selectedFile ? (
          <div className="flex flex-col h-full">
            <div className="p-3 border-b border-white/10 flex items-center gap-2">
              <span className="text-sm font-medium">{selectedFile}</span>
              <div className="ml-auto flex gap-2">
                {activeFolder === 'inbox' && (
                  <button
                    onClick={() => moveFile(selectedFile, 'inbox', 'approved')}
                    className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 rounded text-white"
                  >
                    Approve
                  </button>
                )}
                <button
                  onClick={() => moveFile(selectedFile, activeFolder, 'archive')}
                  className="px-3 py-1 text-xs bg-surface-overlay hover:bg-surface rounded text-text-secondary"
                >
                  Archive
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <FileViewer folder={activeFolder} filename={selectedFile} />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-text-secondary text-sm">
            Select a file to review
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Create FileViewer component**

```tsx
// packages/client/src/components/FileViewer.tsx
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  folder: string;
  filename: string;
}

export function FileViewer({ folder, filename }: Props) {
  const [content, setContent] = useState<string>('');
  const ext = filename.split('.').pop()?.toLowerCase();

  useEffect(() => {
    fetch(`/api/files/${folder}/${filename}`)
      .then((r) => r.text())
      .then(setContent);
  }, [folder, filename]);

  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext || '')) {
    return <img src={`/api/files/${folder}/${filename}`} alt={filename} className="max-w-full" />;
  }

  if (ext === 'md') {
    return (
      <div className="prose prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    );
  }

  if (ext === 'json') {
    try {
      const formatted = JSON.stringify(JSON.parse(content), null, 2);
      return <pre className="text-xs text-text-primary font-mono whitespace-pre-wrap">{formatted}</pre>;
    } catch {
      return <pre className="text-xs text-text-primary font-mono whitespace-pre-wrap">{content}</pre>;
    }
  }

  return <pre className="text-xs text-text-primary font-mono whitespace-pre-wrap">{content}</pre>;
}
```

**Step 5: Commit**

```bash
git add packages/server/src/routes/files.ts packages/client/src/components/FileReview.tsx packages/client/src/components/FileViewer.tsx
git commit -m "feat: add file review system with inbox/approved/archive workflow"
```

---

### Task 16: Standup routes and dashboard widget

**Files:**
- Create: `packages/server/src/routes/standup.ts`
- Create: `packages/client/src/components/StandupWidget.tsx`
- Create: `packages/client/src/stores/standupStore.ts`

**Step 1: Server standup routes**

```typescript
// packages/server/src/routes/standup.ts
import { Router } from 'express';
import fs from 'fs';
import path from 'path';

export function createStandupRoutes(contentRoot: string): Router {
  const router = Router();
  const standupPath = path.join(contentRoot, 'data', 'standup.json');

  router.get('/standup', (_req, res) => {
    try {
      if (fs.existsSync(standupPath)) {
        const data = JSON.parse(fs.readFileSync(standupPath, 'utf-8'));
        res.json(data);
      } else {
        res.json({ date: null, agents: {} });
      }
    } catch {
      res.json({ date: null, agents: {} });
    }
  });

  return router;
}
```

**Step 2: Standup Zustand store**

```typescript
// packages/client/src/stores/standupStore.ts
import { create } from 'zustand';

interface AgentStandup {
  status: 'completed' | 'pending' | 'blocked';
  yesterday?: string;
  today?: string;
  blockers?: string;
  completedAt?: string;
}

interface StandupState {
  date: string | null;
  agents: Record<string, AgentStandup>;
  loading: boolean;
  fetch: () => Promise<void>;
}

export const useStandupStore = create<StandupState>((set) => ({
  date: null,
  agents: {},
  loading: true,
  fetch: async () => {
    try {
      const res = await fetch('/api/standup');
      const data = await res.json();
      set({ date: data.date, agents: data.agents || {}, loading: false });
    } catch {
      set({ loading: false });
    }
  },
}));
```

**Step 3: Standup widget component**

```tsx
// packages/client/src/components/StandupWidget.tsx
import { useEffect } from 'react';
import { useStandupStore } from '../stores/standupStore';
import { useAgentStore } from '../stores/agentStore';

export function StandupWidget() {
  const { date, agents: standupAgents, loading, fetch: fetchStandup } = useStandupStore();
  const agents = useAgentStore((s) => s.agents);

  useEffect(() => {
    fetchStandup();
    const interval = setInterval(fetchStandup, 60000);
    return () => clearInterval(interval);
  }, [fetchStandup]);

  if (loading) return null;

  const completed = Object.values(standupAgents).filter((a) => a.status === 'completed').length;
  const total = Object.keys(standupAgents).length;

  return (
    <div className="bg-surface-raised rounded-lg border border-white/10 p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-text-secondary uppercase">Standup</h3>
        <span className="text-xs text-text-secondary">{date || 'No data'}</span>
      </div>
      <div className="text-sm mb-2">
        {completed}/{total} completed
      </div>
      <div className="space-y-1.5">
        {Object.entries(standupAgents).map(([key, standup]) => {
          const agent = agents[key];
          return (
            <details key={key} className="group">
              <summary className="flex items-center gap-2 cursor-pointer text-sm hover:text-text-primary">
                <span
                  className={`w-2 h-2 rounded-full ${
                    standup.status === 'completed'
                      ? 'bg-green-500'
                      : standup.status === 'blocked'
                        ? 'bg-red-500'
                        : 'bg-yellow-500'
                  }`}
                />
                <span>{agent?.emoji}</span>
                <span className="text-text-secondary">{agent?.name || key}</span>
              </summary>
              <div className="ml-6 mt-1 text-xs text-text-secondary space-y-1">
                {standup.yesterday && <div><strong>Yesterday:</strong> {standup.yesterday}</div>}
                {standup.today && <div><strong>Today:</strong> {standup.today}</div>}
                {standup.blockers && <div className="text-red-400"><strong>Blockers:</strong> {standup.blockers}</div>}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add packages/server/src/routes/standup.ts packages/client/src/components/StandupWidget.tsx packages/client/src/stores/standupStore.ts
git commit -m "feat: add standup routes, store, and dashboard widget"
```

---

### Task 17: Agent-to-agent channels view

**Files:**
- Create: `packages/server/src/routes/channels.ts`
- Create: `packages/client/src/components/ChannelsView.tsx`
- Create: `packages/client/src/stores/channelStore.ts`

**Step 1: Server channel routes**

```typescript
// packages/server/src/routes/channels.ts
import { Router } from 'express';
import fs from 'fs';
import path from 'path';

export function createChannelRoutes(contentRoot: string): Router {
  const router = Router();
  const interactionsPath = path.join(contentRoot, 'memory', 'agent-interactions.json');

  router.get('/channels', (_req, res) => {
    try {
      if (fs.existsSync(interactionsPath)) {
        const data = JSON.parse(fs.readFileSync(interactionsPath, 'utf-8'));
        res.json(data);
      } else {
        res.json({ channels: [], interactions: [] });
      }
    } catch {
      res.json({ channels: [], interactions: [] });
    }
  });

  return router;
}
```

**Step 2: Channel store**

```typescript
// packages/client/src/stores/channelStore.ts
import { create } from 'zustand';

interface ChannelMessage {
  from: string;
  to: string;
  content: string;
  timestamp: number;
}

interface ChannelState {
  interactions: ChannelMessage[];
  loading: boolean;
  fetch: () => Promise<void>;
}

export const useChannelStore = create<ChannelState>((set) => ({
  interactions: [],
  loading: true,
  fetch: async () => {
    try {
      const res = await fetch('/api/channels');
      const data = await res.json();
      set({ interactions: data.interactions || [], loading: false });
    } catch {
      set({ loading: false });
    }
  },
}));
```

**Step 3: Channels view component**

```tsx
// packages/client/src/components/ChannelsView.tsx
import { useEffect, useMemo } from 'react';
import { useChannelStore } from '../stores/channelStore';
import { useAgentStore } from '../stores/agentStore';

export function ChannelsView() {
  const { interactions, loading, fetch: fetchChannels } = useChannelStore();
  const agents = useAgentStore((s) => s.agents);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Group interactions into channels (pairs of agents)
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

  return (
    <div className="flex h-full">
      <div className="w-56 border-r border-white/10 overflow-y-auto">
        <div className="p-3 text-xs font-semibold text-text-secondary uppercase">Agent Channels</div>
        {channels.map((ch) => (
          <button key={ch.key} className="w-full text-left px-3 py-2 text-sm hover:bg-surface-overlay">
            {ch.agents.map((a) => agents[a]?.emoji || a).join(' ')}
            <span className="ml-2 text-text-secondary">
              {ch.agents.map((a) => agents[a]?.name || a).join(' & ')}
            </span>
          </button>
        ))}
      </div>
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="text-text-secondary text-sm">
          Select a channel to view agent-to-agent conversations
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add packages/server/src/routes/channels.ts packages/client/src/components/ChannelsView.tsx packages/client/src/stores/channelStore.ts
git commit -m "feat: add agent-to-agent channels view with grouped interactions"
```

---

### Task 18: Agent info tabs (dynamic per-agent content)

**Files:**
- Create: `packages/server/src/routes/agent-data.ts`
- Create: `packages/client/src/components/AgentInfoTabs.tsx`
- Create: `packages/client/src/components/renderers/ChartRenderer.tsx`
- Create: `packages/client/src/components/renderers/MarkdownRenderer.tsx`
- Create: `packages/client/src/components/renderers/TableRenderer.tsx`

**Step 1: Server agent-data route** (resolves tab sources)

```typescript
// packages/server/src/routes/agent-data.ts
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import type { AppConfig } from '../types/config.js';

export function createAgentDataRoutes(config: AppConfig, contentRoot: string): Router {
  const router = Router();

  router.get('/agent-data/:agentKey/:tabId', (req, res) => {
    const { agentKey, tabId } = req.params;
    const agent = config.agents[agentKey];
    if (!agent) { res.status(404).json({ error: 'Agent not found' }); return; }

    const tab = agent.tabs.find((t) => t.id === tabId);
    if (!tab) { res.status(404).json({ error: 'Tab not found' }); return; }

    const source = tab.source;

    if (source.startsWith('file:')) {
      const filePath = path.join(contentRoot, 'data', source.slice(5));
      if (!fs.existsSync(filePath)) {
        res.json(null);
        return;
      }
      const ext = path.extname(filePath);
      if (ext === '.json') {
        res.json(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
      } else {
        res.type('text/plain').send(fs.readFileSync(filePath, 'utf-8'));
      }
      return;
    }

    if (source === 'memory') {
      const memPath = path.join(contentRoot, 'memory', 'agents', `${agentKey}.md`);
      if (fs.existsSync(memPath)) {
        res.type('text/plain').send(fs.readFileSync(memPath, 'utf-8'));
      } else {
        res.type('text/plain').send('');
      }
      return;
    }

    res.status(400).json({ error: `Unsupported source type: ${source}` });
  });

  return router;
}
```

**Step 2: AgentInfoTabs component**

```tsx
// packages/client/src/components/AgentInfoTabs.tsx
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

  const currentTab = tabs.find((t) => t.id === activeTab);
  const renderer = currentTab?.renderer || 'default';

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-white/10 shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs ${
              activeTab === tab.id ? 'border-b-2 border-accent text-accent' : 'text-text-secondary'
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
        ) : renderer === 'chart' ? (
          <div className="text-text-secondary text-sm">Chart renderer (recharts) - data loaded</div>
          // TODO: Implement with Recharts in a follow-up
        ) : (
          <pre className="text-xs text-text-primary whitespace-pre-wrap">
            {typeof tabData === 'string' ? tabData : JSON.stringify(tabData, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add packages/server/src/routes/agent-data.ts packages/client/src/components/AgentInfoTabs.tsx
git commit -m "feat: add config-driven agent info tabs with file/memory/api data sources"
```

---

### Task 19: PWA configuration

**Files:**
- Modify: `packages/client/vite.config.ts`
- Create: `packages/client/public/manifest.json` (Vite PWA generates this, but we configure it)
- Create: `packages/client/public/icons/` (placeholder icons)

**Step 1: Add PWA plugin config to vite.config.ts**

Add to the existing `vite.config.ts`:

```typescript
import { VitePWA } from 'vite-plugin-pwa';

// Add to plugins array:
VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'OpenClaw Office',
    short_name: 'MCC',
    description: 'OpenClaw Agent Dashboard',
    theme_color: '#0ea5e9',
    background_color: '#1a1a2e',
    display: 'standalone',
    scope: '/',
    start_url: '/',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    navigateFallback: '/index.html',
    runtimeCaching: [
      {
        urlPattern: /^\/api\//,
        handler: 'NetworkFirst',
        options: { cacheName: 'api-cache', expiration: { maxEntries: 50, maxAgeSeconds: 300 } },
      },
    ],
  },
})
```

**Step 2: Add Apple PWA meta tags to index.html**

In `packages/client/index.html`, add:
```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="MCC">
<link rel="apple-touch-icon" href="/icons/icon-192.png">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
```

**Step 3: Commit**

```bash
git add packages/client/
git commit -m "feat: configure PWA with vite-plugin-pwa, manifest, and Apple meta tags"
```

---

### Task 20: Wire up all views in App.tsx with routing

**Files:**
- Modify: `packages/client/src/App.tsx`
- Modify: `packages/client/src/layouts/DashboardLayout.tsx`

**Step 1: Update App.tsx to render views based on uiStore**

```tsx
// packages/client/src/App.tsx
import { useEffect } from 'react';
import { DashboardLayout } from './layouts/DashboardLayout';
import { OfficeCanvas } from './canvas/OfficeCanvas';
import { ChatPanel } from './components/ChatPanel';
import { ChannelsView } from './components/ChannelsView';
import { FileReview } from './components/FileReview';
import { AgentInfoTabs } from './components/AgentInfoTabs';
import { StandupWidget } from './components/StandupWidget';
import { useConfig } from './hooks/useConfig';
import { useUIStore } from './stores/uiStore';

export default function App() {
  useConfig();
  const { activeView, activeAgent, panelOpen } = useUIStore();

  return (
    <DashboardLayout>
      {/* Main content by view */}
      {activeView === 'office' && (
        <div className="relative w-full h-full">
          <OfficeCanvas />
          {/* Standup widget overlay */}
          <div className="absolute top-4 right-4 w-72 z-10">
            <StandupWidget />
          </div>
        </div>
      )}
      {activeView === 'channels' && <ChannelsView />}
      {activeView === 'files' && <FileReview />}

      {/* Agent side panel */}
      {panelOpen && activeAgent && (
        <aside className="w-96 bg-surface-raised border-l border-white/10 flex flex-col shrink-0">
          <ChatPanel agentKey={activeAgent} />
        </aside>
      )}
    </DashboardLayout>
  );
}
```

**Step 2: Update DashboardLayout nav to use uiStore**

Wire the nav buttons to call `setView()` from `useUIStore`.

**Step 3: Commit**

```bash
git add packages/client/src/
git commit -m "feat: wire up all views (office, channels, files) with agent side panel"
```

---

## Phase 7: Voice Communication (Phase 2 feature — implement after core is working)

### Task 21: Voice routes on server (TTS + STT)

**Files:**
- Create: `packages/server/src/routes/voice.ts`
- Create: `packages/server/src/services/voice.ts`

Implementation: Port the existing TTS (edge-tts) and STT (whisper) logic from `gateway-api.js` lines 86-150 into typed services. Expose `/api/voice/tts`, `/api/voice/stt`, and `/api/voice/stream` endpoints.

### Task 22: Voice UI component

**Files:**
- Create: `packages/client/src/components/VoiceMode.tsx`
- Create: `packages/client/src/hooks/useVoice.ts`
- Create: `packages/client/src/stores/voiceStore.ts`

Implementation: Browser MediaRecorder API for audio capture, streaming to server for STT, playing back TTS audio responses. Push-to-talk button in chat panel.

---

## Phase 8: Polish & Integration Testing

### Task 23: End-to-end integration test

**Files:**
- Create: `packages/client/e2e/dashboard.test.ts`

Use Playwright to test: page loads, config fetches, agent click opens panel, send message flow (mocked Gateway).

### Task 24: Mobile responsive refinements

Test on iPad/iPhone viewport sizes. Ensure:
- Bottom nav works on mobile
- Panels slide up as modals
- PixiJS canvas handles touch events
- PWA installs correctly from Safari

---

## Summary of Phases

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-4 | Project scaffolding, types, config, content dirs |
| 2 | 5-8 | Server middleware: DB, Gateway client, SSE, Express routes |
| 3 | 9-11 | React shell, Zustand stores, API hooks |
| 4 | 12 | Chat UI components |
| 5 | 13-14 | Isometric office (PixiJS) |
| 6 | 15-19 | Files, standup, channels, agent tabs, PWA |
| 7 | 20 | Wire all views together |
| 8 | 21-22 | Voice communication |
| 9 | 23-24 | Testing and mobile polish |
