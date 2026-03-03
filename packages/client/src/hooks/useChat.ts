import { useCallback } from 'react';
import { useChatStore } from '../stores/chatStore';

/** Generate a UUID, falling back to a manual implementation in insecure contexts (plain HTTP). */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // Falls through to fallback — crypto.randomUUID() requires a secure context
    }
  }
  // Fallback using crypto.getRandomValues (available in all modern browsers regardless of context)
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function useChat(agentKey: string) {
  const addMessage = useChatStore((s) => s.addMessage);
  const setDraftAction = useChatStore((s) => s.setDraft);
  const draft = useChatStore((s) => s.drafts[agentKey] ?? '');

  const sendMessage = useCallback(async (content: string) => {
    const idempotencyKey = generateUUID();
    const seq = Date.now();
    addMessage(agentKey, {
      seq,
      role: 'user',
      content,
      timestamp: Date.now(),
    });
    setDraftAction(agentKey, '');

    try {
      const res = await fetch(`/api/chat/${agentKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, idempotencyKey }),
      });
      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to send message';
      addMessage(agentKey, {
        seq: Date.now(),
        role: 'assistant',
        content: `Failed to send: ${errorMsg}`,
        timestamp: Date.now(),
        error: errorMsg,
      });
    }
  }, [agentKey, addMessage, setDraftAction]);

  const retryMessage = useCallback(async (originalContent: string, errorSeq: number) => {
    // Remove the error message from the store
    const currentMessages = useChatStore.getState().messages[agentKey] || [];
    const filtered = currentMessages.filter((m) => m.seq !== errorSeq);
    useChatStore.getState().setMessages(agentKey, filtered);

    // Resend
    const idempotencyKey = generateUUID();
    try {
      const res = await fetch(`/api/chat/${agentKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: originalContent, idempotencyKey }),
      });
      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to send message';
      addMessage(agentKey, {
        seq: Date.now(),
        role: 'assistant',
        content: `Failed to send: ${errorMsg}`,
        timestamp: Date.now(),
        error: errorMsg,
      });
    }
  }, [agentKey, addMessage]);

  const loadHistory = useCallback(async () => {
    const res = await fetch(`/api/chat-history/${agentKey}`);
    const messages = await res.json();
    useChatStore.getState().setMessages(agentKey, messages);
  }, [agentKey]);

  const interrupt = useCallback(async () => {
    await fetch(`/api/chat/${agentKey}/interrupt`, { method: 'POST' });
  }, [agentKey]);

  const setDraft = useCallback((text: string) => {
    setDraftAction(agentKey, text);
  }, [agentKey, setDraftAction]);

  return {
    draft,
    setDraft,
    sendMessage,
    retryMessage,
    loadHistory,
    interrupt,
  };
}
