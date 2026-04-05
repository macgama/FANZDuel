import React, { useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

interface GlobalSocketListenerProps {
  onDuelStarting: (duelId: string, duelData: any) => void;
}

export const GlobalSocketListener: React.FC<GlobalSocketListenerProps> = ({ onDuelStarting }) => {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleDuelStarting = ({ startTime, duelId, duel }: { startTime: number, duelId: string, duel: any }) => {
      onDuelStarting(duelId, duel);
    };

    socket.on('duel-starting', handleDuelStarting);

    return () => {
      socket.off('duel-starting', handleDuelStarting);
    };
  }, [socket, onDuelStarting]);

  return null;
};
