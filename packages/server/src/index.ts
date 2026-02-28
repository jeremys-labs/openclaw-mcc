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

// Handle gateway events for chat deltas/finals
gateway.on('event', (frame: Record<string, unknown>) => {
  const event = (frame.event || frame.type) as string;
  const data = (frame.data || frame.params || frame) as Record<string, unknown>;
  const agent = data.agent as string | undefined;

  if (!agent) return;

  const messageId = (data.messageId || data.id || '') as string;

  if (event === 'chat.delta' || event === 'message.delta') {
    streaming.broadcastDelta(agent, messageId, data.content as string);
  } else if (event === 'chat.final' || event === 'message.final') {
    const content = (data.content || data.fullContent) as string;
    const timestamp = Date.now();
    const result = db.addMessage(agent, 'assistant', content, timestamp);
    streaming.broadcastFinal(agent, messageId, content, result.seq);
  } else if (event === 'chat.error' || event === 'message.error') {
    streaming.broadcastError(agent, messageId, (data.error || data.message) as string);
  } else if (event === 'context.update') {
    streaming.broadcastContextUpdate(
      agent,
      data.tokens as number,
      data.maxTokens as number,
    );
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

// Start server
const server = app.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
  console.log(`[Server] Content root: ${contentRoot}`);
  console.log(`[Server] Agents: ${Object.keys(config.agents).join(', ')}`);

  // Connect to gateway
  gateway.connect();
});

// Graceful shutdown
function shutdown() {
  console.log('[Server] Shutting down...');
  gateway.disconnect();
  db.close();
  server.close(() => {
    console.log('[Server] Stopped');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
