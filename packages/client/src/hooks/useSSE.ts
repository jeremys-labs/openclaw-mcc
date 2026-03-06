import { useEffect, useRef } from 'react';
import { useChatStore } from '../stores/chatStore';

const BASE_RETRY_MS = 3000;
const MAX_RETRY_MS = 30000;

export function useSSE(agentKey: string | null) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasConnectedRef = useRef(false);
  const appendStreamBuffer = useChatStore((s) => s.appendStreamBuffer);
  const finalizeStream = useChatStore((s) => s.finalizeStream);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const setMessages = useChatStore((s) => s.setMessages);

  useEffect(() => {
    if (!agentKey) return;

    // Reload chat history from DB to catch any messages missed during SSE downtime
    async function reloadHistory() {
      try {
        const res = await fetch(`/api/chat-history/${agentKey}`);
        const messages = await res.json();
        setMessages(agentKey!, messages);
      } catch { /* ignore, will retry on next reconnect */ }
    }

    function connect() {
      const es = new EventSource(`/api/chat-stream/${agentKey}`);
      eventSourceRef.current = es;

      es.addEventListener('connected', () => {
        // Reload history on every connect (including first) to catch any missed messages.
        // On mobile (especially iPad over Tailscale), the SSE can silently drop during
        // keyboard open/close or network transitions, causing the first response to be lost.
        reloadHistory();
        hasConnectedRef.current = true;
        retryCountRef.current = 0;
      });

      es.addEventListener('message.delta', (e) => {
        const data = JSON.parse(e.data);
        retryCountRef.current = 0;
        setStreaming(agentKey!, true);
        appendStreamBuffer(agentKey!, data.content);
      });

      es.addEventListener('message.final', (e) => {
        const data = JSON.parse(e.data);
        retryCountRef.current = 0;
        finalizeStream(agentKey!, data.content);
      });

      es.addEventListener('message.aborted', () => {
        retryCountRef.current = 0;
        // Keep any partial content that was already streamed
        const store = useChatStore.getState();
        const buffer = store.streamBuffer[agentKey!] ?? '';
        if (buffer.trim()) {
          finalizeStream(agentKey!, buffer + '\n\n*[stopped]*');
        } else {
          // Always clear streaming state, even with no buffer
          finalizeStream(agentKey!, '');
        }
      });

      es.addEventListener('message.error', (e) => {
        console.error('SSE error:', JSON.parse(e.data));
        retryCountRef.current = 0;
        setStreaming(agentKey!, false);
      });

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;

        const delay = Math.min(
          BASE_RETRY_MS * Math.pow(2, retryCountRef.current),
          MAX_RETRY_MS,
        );
        retryCountRef.current += 1;

        retryTimerRef.current = setTimeout(() => {
          connect();
        }, delay);
      };
    }

    connect();

    return () => {
      hasConnectedRef.current = false;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [agentKey, appendStreamBuffer, finalizeStream, setStreaming, setMessages]);
}
