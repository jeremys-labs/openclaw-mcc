import { useEffect, useRef } from 'react';
import { useChatStore } from '../stores/chatStore';

export function useSSE(agentKey: string | null) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const appendStreamBuffer = useChatStore((s) => s.appendStreamBuffer);
  const finalizeStream = useChatStore((s) => s.finalizeStream);
  const setStreaming = useChatStore((s) => s.setStreaming);

  useEffect(() => {
    if (!agentKey) return;

    const es = new EventSource(`/api/chat-stream/${agentKey}`);
    eventSourceRef.current = es;

    es.addEventListener('message.delta', (e) => {
      const data = JSON.parse(e.data);
      setStreaming(agentKey, true);
      appendStreamBuffer(agentKey, data.content);
    });

    es.addEventListener('message.final', (e) => {
      const data = JSON.parse(e.data);
      finalizeStream(agentKey, data.content);
    });

    es.addEventListener('message.aborted', () => {
      setStreaming(agentKey, false);
    });

    es.addEventListener('message.error', (e) => {
      console.error('SSE error:', JSON.parse(e.data));
      setStreaming(agentKey, false);
    });

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [agentKey, appendStreamBuffer, finalizeStream, setStreaming]);
}
