import { useEffect, useRef } from 'react';
import { useChatStore } from '../stores/chatStore';

const BASE_RETRY_MS = 3000;
const MAX_RETRY_MS = 30000;

export function useSSE(agentKey: string | null) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appendStreamBuffer = useChatStore((s) => s.appendStreamBuffer);
  const finalizeStream = useChatStore((s) => s.finalizeStream);
  const setStreaming = useChatStore((s) => s.setStreaming);

  useEffect(() => {
    if (!agentKey) return;

    function connect() {
      const es = new EventSource(`/api/chat-stream/${agentKey}`);
      eventSourceRef.current = es;

      es.addEventListener('message.delta', (e) => {
        const data = JSON.parse(e.data);
        retryCountRef.current = 0;
        setStreaming(agentKey, true);
        appendStreamBuffer(agentKey, data.content);
      });

      es.addEventListener('message.final', (e) => {
        const data = JSON.parse(e.data);
        retryCountRef.current = 0;
        finalizeStream(agentKey, data.content);
      });

      es.addEventListener('message.aborted', () => {
        retryCountRef.current = 0;
        // Keep any partial content that was already streamed
        const buffer = useChatStore.getState().streamBuffer[agentKey!] ?? '';
        if (buffer) {
          finalizeStream(agentKey!, buffer + '\n\n*[stopped]*');
        } else {
          setStreaming(agentKey!, false);
        }
      });

      es.addEventListener('message.error', (e) => {
        console.error('SSE error:', JSON.parse(e.data));
        retryCountRef.current = 0;
        setStreaming(agentKey, false);
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
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [agentKey, appendStreamBuffer, finalizeStream, setStreaming]);
}
