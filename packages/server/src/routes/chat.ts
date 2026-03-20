import { Router } from 'express';
import type { Request, Response } from 'express';
import type { AppConfig } from '../types/config.js';
import type { ChatDB } from '../db.js';
import type { GatewayClient } from '../gateway/client.js';
import type { ChatStreamService } from '../services/chat-streaming.js';
import crypto from 'crypto';

interface ChatDeps {
  config: AppConfig;
  db: ChatDB;
  gateway: GatewayClient;
  streaming: ChatStreamService;
}

const SYSTEM_MESSAGE_PATTERNS = /^(ANNOUNCE_SKIP|NO_REPLY|NO_?|SKIP|ACK|HEARTBEAT|PING|PONG)$/i;

function getAgentKey(req: Request): string {
  const key = req.params.agentKey;
  return Array.isArray(key) ? key[0] : key;
}

function validateAgent(config: AppConfig, agentKey: string, res: Response): boolean {
  if (!config.agents[agentKey]) {
    res.status(404).json({ error: `Agent '${agentKey}' not found` });
    return false;
  }
  return true;
}

export function createChatRouter({ config, db, gateway, streaming }: ChatDeps): Router {
  const router = Router();

  // SSE subscription
  router.get('/chat-stream/:agentKey', (req: Request, res: Response) => {
    const agentKey = getAgentKey(req);
    if (!validateAgent(config, agentKey, res)) return;
    streaming.subscribe(agentKey, res);
  });

  // Send message
  router.post('/chat/:agentKey', async (req: Request, res: Response) => {
    const agentKey = getAgentKey(req);
    if (!validateAgent(config, agentKey, res)) return;

    interface ChatAttachmentInput {
      type?: string;
      mimeType?: string;
      fileName?: string;
      content: string; // base64
    }

    const { content, idempotencyKey, metadata, attachments } = req.body as {
      content?: string;
      idempotencyKey?: string;
      metadata?: Record<string, unknown>;
      attachments?: ChatAttachmentInput[];
    };

    const hasText = typeof content === 'string' && content.trim().length > 0;
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

    if (!hasText && !hasAttachments) {
      res.status(400).json({ error: 'content or attachments required' });
      return;
    }

    const timestamp = Date.now();
    const key = idempotencyKey || crypto.randomUUID();
    const result = db.addMessage(agentKey, 'user', content ?? '', timestamp, key, metadata);

    if (result.duplicate) {
      res.json({ seq: result.seq, duplicate: true });
      return;
    }

    // Forward to gateway
    const sessionKey = `agent:${agentKey}:webchat:user`;

    try {
      if (gateway.isConnected) {
        await gateway.request('chat.send', {
          sessionKey,
          message: content ?? '',
          idempotencyKey: key,
          ...(hasAttachments ? { attachments } : {}),
        });
      }
    } catch (err) {
      // Log but don't fail the request -- message is persisted
      console.error(`Gateway forward failed for ${agentKey}:`, err);
    }

    res.json({ seq: result.seq, duplicate: false, idempotencyKey: key });
  });

  // Get chat history
  // Query params:
  //   ?since=<seq>   — return only messages after this seq (for polling new messages)
  //   ?before=<seq>  — return up to `limit` messages before this seq (for "load older")
  //   ?limit=<n>     — cap results (default 100 for initial load, ignored when ?since is set)
  router.get('/chat-history/:agentKey', (req: Request, res: Response) => {
    const agentKey = getAgentKey(req);
    if (!validateAgent(config, agentKey, res)) return;

    const sinceParam = req.query.since;
    const beforeParam = req.query.before;
    const limitParam = req.query.limit;
    const since = sinceParam ? Number(sinceParam) : undefined;
    const before = beforeParam ? Number(beforeParam) : undefined;
    const limit = limitParam ? Number(limitParam) : 100;

    const filterSystem = (msgs: Record<string, unknown>[]) =>
      msgs.filter((m) => !SYSTEM_MESSAGE_PATTERNS.test(String(m.content).trim()));

    if (since !== undefined && since > 0) {
      // New messages only — no limit needed
      res.json(filterSystem(db.getMessagesSince(agentKey, since)));
    } else if (before !== undefined && before > 0) {
      // Pagination: load older messages before a given seq
      res.json(filterSystem(db.getMessagesBefore(agentKey, before, limit)));
    } else {
      // Initial load: return last N messages
      res.json(filterSystem(db.getMessages(agentKey, limit)));
    }
  });

  // Clear chat history
  router.delete('/chat/:agentKey', (req: Request, res: Response) => {
    const agentKey = getAgentKey(req);
    if (!validateAgent(config, agentKey, res)) return;

    db.clearMessages(agentKey);
    res.json({ cleared: true });
  });

  // Interrupt/abort response
  router.post('/chat/:agentKey/interrupt', async (req: Request, res: Response) => {
    const agentKey = getAgentKey(req);
    if (!validateAgent(config, agentKey, res)) return;

    const sessionKey = `agent:${agentKey}:webchat:user`;

    // Always broadcast abort to the UI so the streaming state clears,
    // even if the gateway call fails (method unsupported, timeout, etc.)
    let gatewayOk = false;
    try {
      if (gateway.isConnected) {
        await gateway.request('chat.abort', { sessionKey });
        gatewayOk = true;
      }
    } catch (err) {
      console.error(`Gateway interrupt failed for ${agentKey}:`, (err as Error).message);
    }

    // Always clear streaming state on the client
    streaming.broadcastAbort(agentKey, '', 'User interrupted');
    res.json({ interrupted: true, gatewayAck: gatewayOk });
  });

  return router;
}
