import { useCallback } from 'react';
import { useChatStore } from '../stores/chatStore';

export function useChat(agentKey: string) {
  const addMessage = useChatStore((s) => s.addMessage);
  const setDraftAction = useChatStore((s) => s.setDraft);
  const draft = useChatStore((s) => s.drafts[agentKey] ?? '');

  const sendMessage = useCallback(async (content: string) => {
    const idempotencyKey = crypto.randomUUID();
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
    const idempotencyKey = crypto.randomUUID();
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
