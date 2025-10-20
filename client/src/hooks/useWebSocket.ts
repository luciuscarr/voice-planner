import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Task, WebSocketMessage } from '@voice-planner/shared';

// Establishes websocket connection.

interface UseWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
}

export function useWebSocket(
  onTaskUpdate: (message: WebSocketMessage) => void
): UseWebSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
    const newSocket = io(wsUrl);

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket server');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
      setIsConnected(false);
    });

    newSocket.on('task_update', (message: WebSocketMessage) => {
      onTaskUpdate(message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [onTaskUpdate]);

  return { socket, isConnected };
}
