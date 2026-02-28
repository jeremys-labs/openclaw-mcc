import { describe, it, expect } from 'vitest';
import { GatewayClient } from './client.js';

describe('GatewayClient', () => {
  it('can instantiate with url and token', () => {
    const client = new GatewayClient('ws://localhost:18789', 'test-token');
    expect(client).toBeInstanceOf(GatewayClient);
  });

  it('isConnected starts false', () => {
    const client = new GatewayClient('ws://localhost:18789', 'test-token');
    expect(client.isConnected).toBe(false);
  });

  it('buildConnectPayload returns correct structure', () => {
    const client = new GatewayClient('ws://localhost:18789', 'my-secret');
    const payload = client.buildConnectPayload();

    expect(payload.method).toBe('connect');
    expect(payload.id).toBeTypeOf('number');
    expect(payload.params).toEqual({
      token: 'my-secret',
      role: 'operator',
      scopes: ['operator.read', 'operator.write', 'operator.admin'],
    });
  });

  it('nextId increments', () => {
    const client = new GatewayClient('ws://localhost:18789', 'test-token');
    const id1 = client.nextId();
    const id2 = client.nextId();
    const id3 = client.nextId();

    expect(id2).toBe(id1 + 1);
    expect(id3).toBe(id2 + 1);
  });
});
