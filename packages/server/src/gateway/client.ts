import { EventEmitter } from 'events';
import WebSocket from 'ws';

export type GatewayState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

const PING_INTERVAL_MS = 25_000;
const REQUEST_TIMEOUT_MS = 30_000;
const RECONNECT_BASE_MS = 3_000;
const RECONNECT_MAX_MS = 30_000;

export class GatewayClient extends EventEmitter {
  private url: string;
  private token: string;
  private ws: WebSocket | null = null;
  private state: GatewayState = 'disconnected';
  private requestId = 0;
  private pendingRequests = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private shouldReconnect = true;

  constructor(url: string, token: string) {
    super();
    this.url = url;
    this.token = token;
  }

  get isConnected(): boolean {
    return this.state === 'connected';
  }

  nextId(): number {
    return ++this.requestId;
  }

  buildConnectPayload(): Record<string, unknown> {
    return {
      id: this.nextId(),
      method: 'connect',
      params: {
        token: this.token,
        role: 'operator',
        scopes: ['operator.read', 'operator.write', 'operator.admin'],
      },
    };
  }

  connect(): void {
    this.shouldReconnect = true;
    this.setState('connecting');

    this.ws = new WebSocket(this.url);

    this.ws.on('open', () => {
      // Wait for connect.challenge before sending auth
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const frame = JSON.parse(data.toString());
        this.handleFrame(frame);
      } catch {
        // Ignore unparseable frames
      }
    });

    this.ws.on('close', () => {
      this.cleanup();
      this.setState('disconnected');
      this.scheduleReconnect();
    });

    this.ws.on('error', (err: Error) => {
      this.emit('error', err);
    });

    this.ws.on('pong', () => {
      // Keepalive acknowledged
    });
  }

  async request(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.ws || this.state !== 'connected') {
      throw new Error('Not connected to gateway');
    }

    const id = this.nextId();
    const payload = JSON.stringify({ id, method, params });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${id} timed out after ${REQUEST_TIMEOUT_MS}ms`));
      }, REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this.ws!.send(payload);
    });
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.cleanup();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setState('disconnected');
  }

  private handleFrame(frame: Record<string, unknown>): void {
    // Challenge event
    if (frame.event === 'connect.challenge') {
      const connectPayload = this.buildConnectPayload();
      this.ws!.send(JSON.stringify(connectPayload));
      return;
    }

    // Response frame
    if (frame.type === 'res' || (typeof frame.id === 'number' && frame.result !== undefined)) {
      const id = frame.id as number;
      const pending = this.pendingRequests.get(id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(id);
        if (frame.error) {
          pending.reject(new Error(String(frame.error)));
        } else {
          pending.resolve(frame.result);
        }
      }

      // If this is a connect response, mark as connected
      if (frame.result && typeof frame.result === 'object' && 'connected' in (frame.result as Record<string, unknown>)) {
        this.reconnectAttempts = 0;
        this.setState('connected');
        this.startPing();
      }
      return;
    }

    // Auth success response (connect method response without pending request)
    if (frame.method === 'connect' && frame.result) {
      this.reconnectAttempts = 0;
      this.setState('connected');
      this.startPing();
      return;
    }

    // Event frame
    if (frame.event || frame.type === 'event') {
      this.emit('event', frame);
      return;
    }
  }

  private setState(newState: GatewayState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.emit('state', newState);
    }
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private cleanup(): void {
    this.stopPing();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Connection closed'));
      this.pendingRequests.delete(id);
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;

    this.setState('reconnecting');
    const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempts), RECONNECT_MAX_MS);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }
}
