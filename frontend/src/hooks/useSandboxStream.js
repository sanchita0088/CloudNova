import { useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export function useSandboxStream(onStateReceived) {
  useEffect(() => {
    let eventSource;
    try {
      eventSource = new EventSource(`${API_BASE_URL}/sandbox/stream`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && !data.error && onStateReceived) {
            onStateReceived(data);
          }
        } catch (err) {
          console.error("Failed to parse SSE event data:", err);
        }
      };

      eventSource.onerror = (err) => {
        console.warn("SSE connection error, EventSource will automatically retry:", err);
      };
    } catch (e) {
      console.error("Failed to initialize EventSource:", e);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [onStateReceived]);
}
