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

    const handleDuelUpdate = ({ duelId, status, participants }: { duelId: string, status: string, participants: any[] }) => {
      if (participants && participants.length > 1) {
        const bgStr = localStorage.getItem('tbfo_background_duel');
        if (bgStr) {
          try {
            const bg = JSON.parse(bgStr);
            if (bg.duelId === duelId) {
              localStorage.removeItem('tbfo_background_duel');
              onDuelStarting(duelId, { matchId: bg.matchId, type: bg.type, isPrivate: bg.isPrivate });
            }
          } catch(e) {}
        }
      }
    };

    socket.on('duel-starting', handleDuelStarting);
    socket.on('duel-update', handleDuelUpdate);

    return () => {
      socket.off('duel-starting', handleDuelStarting);
      socket.off('duel-update', handleDuelUpdate);
    };
  }, [socket, onDuelStarting]);

  return null;
};
