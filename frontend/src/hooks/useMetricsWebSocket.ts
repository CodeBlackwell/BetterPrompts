import { useEffect, useRef, useState, useCallback } from 'react';

interface MetricsWebSocketOptions {
  url?: string;
  channels?: string[];
  onMessage?: (data: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'metric' | 'ping' | 'pong';
  channel?: string;
  channels?: string[];
  data?: any;
  timestamp: string;
}

export function useMetricsWebSocket({
  url = 'ws://localhost:3000/ws',
  channels = ['performance', 'usage', 'technique_stats'],
  onMessage,
  onConnect,
  onDisconnect,
  onError,
  reconnectDelay = 3000,
  maxReconnectAttempts = 5,
}: MetricsWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [metrics, setMetrics] = useState<Record<string, any>>({});
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        reconnectCountRef.current = 0;
        
        // Subscribe to channels
        const subscribeMsg: WebSocketMessage = {
          type: 'subscribe',
          channels: channels,
          timestamp: new Date().toISOString(),
        };
        ws.send(JSON.stringify(subscribeMsg));
        
        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          if (message.type === 'metric' && message.channel && message.data) {
            setMetrics(prev => ({
              ...prev,
              [message.channel]: message.data,
            }));
            setLastUpdate(new Date(message.timestamp));
            onMessage?.(message);
          } else if (message.type === 'ping') {
            // Respond to ping
            const pongMsg: WebSocketMessage = {
              type: 'pong',
              timestamp: new Date().toISOString(),
            };
            ws.send(JSON.stringify(pongMsg));
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        onError?.(error);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        wsRef.current = null;
        onDisconnect?.();
        
        // Attempt to reconnect
        if (reconnectCountRef.current < maxReconnectAttempts) {
          reconnectCountRef.current++;
          console.log(`Reconnecting in ${reconnectDelay}ms... (attempt ${reconnectCountRef.current})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay);
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
    }
  }, [url, channels, onMessage, onConnect, onDisconnect, onError, reconnectDelay, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      // Unsubscribe before closing
      if (wsRef.current.readyState === WebSocket.OPEN) {
        const unsubscribeMsg: WebSocketMessage = {
          type: 'unsubscribe',
          channels: channels,
          timestamp: new Date().toISOString(),
        };
        wsRef.current.send(JSON.stringify(unsubscribeMsg));
      }
      
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, [channels]);

  const send = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    metrics,
    lastUpdate,
    connect,
    disconnect,
    send,
  };
}