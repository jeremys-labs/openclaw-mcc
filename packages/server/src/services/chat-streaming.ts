import { EventEmitter } from 'events';
import type { Response } from 'express';
import type { SSEEventType } from '../types/chat.js';

interface Subscriber {
  res: Response;
  agentKey: string;
}

export class ChatStreamService extends EventEmitter {
  private subscribers = new Map<string, Set<Subscriber>>();

  subscribe(agentKey: string, res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const subscriber: Subscriber = { res, agentKey };

    if (!this.subscribers.has(agentKey)) {
      this.subscribers.set(agentKey, new Set());
    }
    this.subscribers.get(agentKey)!.add(subscriber);

    // Send connected event
    this.sendSSE(res, 'connected', { agent: agentKey });

    // Clean up on close
    res.on('close', () => {
      const subs = this.subscribers.get(agentKey);
      if (subs) {
        subs.delete(subscriber);
        if (subs.size === 0) {
          this.subscribers.delete(agentKey);
        }
      }
    });
  }

  broadcastDelta(agent: string, messageId: string, content: string, seq?: number): void {
    const data: Record<string, unknown> = { messageId, content };
    if (seq !== undefined) data.seq = seq;
    this.broadcast(agent, 'message.delta', data);
  }

  broadcastFinal(agent: string, messageId: string, fullContent: string, seq?: number): void {
    const data: Record<string, unknown> = { messageId, content: fullContent, complete: true };
    if (seq !== undefined) data.seq = seq;
    this.broadcast(agent, 'message.final', data);
  }

  broadcastError(agent: string, messageId: string, error: string, seq?: number): void {
    const data: Record<string, unknown> = { messageId, error };
    if (seq !== undefined) data.seq = seq;
    this.broadcast(agent, 'message.error', data);
  }

  broadcastAbort(agent: string, messageId: string, reason: string): void {
    this.broadcast(agent, 'message.aborted', { messageId, reason });
  }

  broadcastContextUpdate(agent: string, tokens: number, maxTokens: number): void {
    const percentUsed = maxTokens > 0 ? Math.round((tokens / maxTokens) * 100) : 0;
    this.broadcast(agent, 'context.update', { tokens, maxTokens, percentUsed });
  }

  getSubscriberCount(agent: string): number {
    return this.subscribers.get(agent)?.size ?? 0;
  }

  private broadcast(agent: string, eventType: SSEEventType, data: Record<string, unknown>): void {
    const subs = this.subscribers.get(agent);
    if (!subs) return;

    for (const sub of subs) {
      this.sendSSE(sub.res, eventType, data);
    }

    this.emit(eventType, { agent, ...data });
  }

  private sendSSE(res: Response, event: string, data: Record<string, unknown>): void {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}
