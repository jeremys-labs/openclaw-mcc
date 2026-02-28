import { useCallback } from 'react';
import { useChatStore } from '../stores/chatStore';

export function useChat(agentKey: string) {
  const { addMessage, drafts, setDraft } = useChatStore();

  const sendMessage = useCallback(async (content: string) => {
    const _idempotencyKey = crypto.randomUUID();
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
      body: JSON.stringify({ content, idempotencyKey: _idempotencyKey }),
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
