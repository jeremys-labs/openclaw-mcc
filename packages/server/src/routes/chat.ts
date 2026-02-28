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

    const { content, idempotencyKey, metadata } = req.body as {
      content?: string;
      idempotencyKey?: string;
      metadata?: Record<string, unknown>;
    };

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({ error: 'content is required and must be a non-empty string' });
      return;
    }

    const timestamp = Date.now();
    const key = idempotencyKey || crypto.randomUUID();
    const result = db.addMessage(agentKey, 'user', content, timestamp, key, metadata);

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
          message: content,
          idempotencyKey: key,
        });
      }
    } catch (err) {
      // Log but don't fail the request -- message is persisted
      console.error(`Gateway forward failed for ${agentKey}:`, err);
    }

    res.json({ seq: result.seq, duplicate: false, idempotencyKey: key });
  });

  // Get chat history
  router.get('/chat-history/:agentKey', (req: Request, res: Response) => {
    const agentKey = getAgentKey(req);
    if (!validateAgent(config, agentKey, res)) return;

    const sinceParam = req.query.since;
    const since = sinceParam ? Number(sinceParam) : undefined;

    if (since !== undefined && since > 0) {
      res.json(db.getMessagesSince(agentKey, since));
    } else {
      res.json(db.getMessages(agentKey));
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

    try {
      if (gateway.isConnected) {
        await gateway.request('chat.interrupt', { sessionKey });
      }
      streaming.broadcastAbort(agentKey, '', 'User interrupted');
      res.json({ interrupted: true });
    } catch (err) {
      console.error(`Interrupt failed for ${agentKey}:`, err);
      res.status(502).json({ error: 'Gateway interrupt failed' });
    }
  });

  return router;
}
