import express from 'express';
import cors from 'cors';
import path from 'path';
import { loadConfig, resolveContentRoot } from './config.js';
import { ensureContentDirs } from './content.js';
import { createChatDB } from './db.js';
import { GatewayClient } from './gateway/client.js';
import { ChatStreamService } from './services/chat-streaming.js';
import { createChatRouter } from './routes/chat.js';
import { createConfigRouter } from './routes/config.js';
import { createHealthRouter } from './routes/health.js';
import { createFileRoutes } from './routes/files.js';
import { createStandupRoutes } from './routes/standup.js';
import { createChannelRoutes } from './routes/channels.js';
import { createAgentDataRoutes } from './routes/agent-data.js';
import { createVoiceRouter, startVoiceHealthChecks, stopVoiceHealthChecks } from './routes/voice.js';

const PORT = parseInt(process.env.SERVER_PORT || '8081', 10);

// Load config and ensure directories
const contentRoot = resolveContentRoot();
const config = loadConfig(contentRoot);
ensureContentDirs(contentRoot);

// Database
const dbPath = path.join(contentRoot, 'databases', 'chat.db');
const db = createChatDB(dbPath);

// Gateway client
const gateway = new GatewayClient(config.gateway.url, config.gateway.token);

// Chat streaming service
const streaming = new ChatStreamService();

// Build reverse lookup: sessionKey -> agentKey
const sessionToAgent: Record<string, string> = {};
for (const key of Object.keys(config.agents)) {
  sessionToAgent[`agent:${key}:webchat:user`] = key;
}

// Extract text content from Gateway message object
function extractMessageText(message: Record<string, unknown>): string | null {
  const content = message.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((block: Record<string, unknown>) => block.type === 'text')
      .map((block: Record<string, unknown>) => block.text as string)
      .join('');
  }
  if (typeof message.text === 'string') return message.text;
  return null;
}

// Handle gateway events
// Gateway sends: { type: 'event', event: 'chat', payload: { state, sessionKey, message } }
gateway.on('event', (frame: Record<string, unknown>) => {
  const event = frame.event as string;

  if (event === 'chat') {
    const payload = frame.payload as Record<string, unknown>;
    if (!payload) return;

    const sessionKey = payload.sessionKey as string;
    const agent = sessionToAgent[sessionKey];
    if (!agent) return;

    const state = payload.state as string;
    const message = payload.message as Record<string, unknown> | undefined;

    if (state === 'delta' && message) {
      const text = extractMessageText(message);
      if (text) {
        streaming.broadcastDelta(agent, '', text);
      }
    } else if (state === 'final' && message) {
      const text = extractMessageText(message);
      if (text) {
        const timestamp = Date.now();
        const result = db.addMessage(agent, 'assistant', text, timestamp);
        streaming.broadcastFinal(agent, '', text, result.seq);
      }
    } else if (state === 'error') {
      const error = (payload.error || 'Unknown error') as string;
      streaming.broadcastError(agent, '', error);
    }
  }
});

gateway.on('state', (state: string) => {
  console.log(`[Gateway] State: ${state}`);
});

gateway.on('error', (err: Error) => {
  console.error('[Gateway] Error:', err.message);
});

// Express app
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Mount routes
app.use('/api', createHealthRouter(gateway));
app.use('/api', createConfigRouter(config));
app.use('/api', createChatRouter({ config, db, gateway, streaming }));
app.use('/api', createFileRoutes(contentRoot));
app.use('/api', createStandupRoutes(contentRoot));
app.use('/api', createChannelRoutes(contentRoot));
app.use('/api', createAgentDataRoutes(config, contentRoot));
app.use('/api', createVoiceRouter(config));

// Start server
const server = app.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
  console.log(`[Server] Content root: ${contentRoot}`);
  console.log(`[Server] Agents: ${Object.keys(config.agents).join(', ')}`);

  // Start voice service health checks
  startVoiceHealthChecks();

  // Connect to gateway
  gateway.connect();
});

// Graceful shutdown
function shutdown() {
  console.log('[Server] Shutting down...');
  stopVoiceHealthChecks();
  gateway.disconnect();
  db.close();
  server.close(() => {
    console.log('[Server] Stopped');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
