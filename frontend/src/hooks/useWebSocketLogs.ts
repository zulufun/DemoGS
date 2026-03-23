import { useState, useEffect, useRef, useCallback } from 'react';

interface LogUpdate {
  type: string;
  data: any;
  timestamp: string;
}

interface WebSocketHookOptions {
  severityFilter?: string;
  maxMessagesPerSecond?: number;
}

export const useWebSocketLogs = (
  token: string | null,
  options: WebSocketHookOptions = {}
) => {
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const messageQueueRef = useRef<LogUpdate[]>([]);
  const processQueueRef = useRef<NodeJS.Timeout | null>(null);
  const messageCountRef = useRef<number>(0);
  const secondTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const maxMessages = options.maxMessagesPerSecond || 60; // 60 messages/sec default
  const severityFilter = options.severityFilter;

  // Process message queue with rate limiting
  const processMessageQueue = useCallback(() => {
    if (messageQueueRef.current.length === 0) return;

    const message = messageQueueRef.current.shift();
    if (message && message.type === 'log_update') {
      // Filter if needed
      if (severityFilter && message.data.level !== severityFilter) {
        // Skip this message if it doesn't match filter
      } else {
        setLogs(prev => {
          const updated = [message.data, ...prev];
          // Keep only last 1000 logs in memory
          return updated.slice(0, 1000);
        });
      }
    }

    // Check if we can process next message
    if (messageCountRef.current < maxMessages && messageQueueRef.current.length > 0) {
      messageCountRef.current++;
      processQueueRef.current = setTimeout(processMessageQueue, 1000 / maxMessages);
    }
  }, [severityFilter, maxMessages]);

  useEffect(() => {
    if (!token) {
      setError('No authentication token provided');
      return;
    }

    // Reset message counter every second
    secondTimerRef.current = setInterval(() => {
      messageCountRef.current = 0;
      if (messageQueueRef.current.length > 0) {
        processMessageQueue();
      }
    }, 1000);

    // Connect to WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws/logs?token=${token}`;

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        setError(null);
        
        // Send subscription message
        if (wsRef.current) {
          wsRef.current.send(JSON.stringify({
            type: 'subscribe',
            severity_filter: severityFilter
          }));
        }

        console.log('WebSocket connected for logs');
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: LogUpdate = JSON.parse(event.data);

          if (message.type === 'pong') {
            // Handle ping/pong
            return;
          }

          if (message.type === 'subscribed') {
            console.log('Subscribed to log updates');
            return;
          }

          // Queue the message for rate-limited processing
          messageQueueRef.current.push(message);

          // If we haven't hit rate limit, process immediately
          if (messageCountRef.current < maxMessages && !processQueueRef.current) {
            messageCountRef.current++;
            processMessageQueue();
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };

      wsRef.current.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('WebSocket connection error');
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
        console.log('WebSocket disconnected');
      };
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to connect to WebSocket';
      setError(errorMsg);
      console.error('Error creating WebSocket:', e);
    }

    return () => {
      // Cleanup
      if (secondTimerRef.current) {
        clearInterval(secondTimerRef.current);
      }
      if (processQueueRef.current) {
        clearTimeout(processQueueRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [token, severityFilter, maxMessages, processMessageQueue]);

  // Send ping to keep connection alive
  useEffect(() => {
    if (!isConnected || !wsRef.current) return;

    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => clearInterval(pingInterval);
  }, [isConnected]);

  const clearLogs = useCallback(() => {
    setLogs([]);
    messageQueueRef.current = [];
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
  }, []);

  return {
    isConnected,
    logs,
    error,
    clearLogs,
    disconnect,
    logCount: logs.length,
    queuedMessages: messageQueueRef.current.length
  };
};
