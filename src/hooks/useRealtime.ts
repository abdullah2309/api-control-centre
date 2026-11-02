import { useEffect, useState, useRef } from 'react';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export interface RealtimeEvent {
  type: string;
  data: any;
  timestamp: string;
}

export function useRealtime(onEvent?: (event: RealtimeEvent) => void) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const callbackRef = useRef(onEvent);

  useEffect(() => {
    callbackRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;

    function connect() {
      setStatus('connecting');
      const es = new EventSource('/api/v1/realtime');
      eventSourceRef.current = es;

      es.onopen = () => {
        setStatus('connected');
      };

      es.onmessage = (e) => {
        try {
          const parsed: RealtimeEvent = JSON.parse(e.data);
          setLastEvent(parsed);
          if (callbackRef.current) {
            callbackRef.current(parsed);
          }
        } catch {
          // Ignore invalid JSON
        }
      };

      es.onerror = () => {
        setStatus('disconnected');
        es.close();
        // Reconnect after 3 seconds
        reconnectTimeout = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return { status, lastEvent };
}
