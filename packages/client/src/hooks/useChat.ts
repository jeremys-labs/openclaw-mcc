import { useCallback } from 'react';
import { useChatStore } from '../stores/chatStore';

export function useChat(agentKey: string) {
  const addMessage = useChatStore((s) => s.addMessage);
  const setDraftAction = useChatStore((s) => s.setDraft);
  const draft = useChatStore((s) => s.drafts[agentKey] ?? '');

  const sendMessage = useCallback(async (content: string) => {
    const idempotencyKey = crypto.randomUUID();
    addMessage(agentKey, {
      seq: Date.now(),
      role: 'user',
      content,
      timestamp: Date.now(),
    });
    setDraftAction(agentKey, '');

    await fetch(`/api/chat/${agentKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, idempotencyKey }),
    });
  }, [agentKey, addMessage, setDraftAction]);

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
    loadHistory,
    interrupt,
  };
}
