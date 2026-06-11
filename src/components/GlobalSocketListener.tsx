import React, { useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { safeLocalStorage } from '../lib/utils';
import { useAlert } from '../context/AlertContext';

interface GlobalSocketListenerProps {
  onDuelStarting: (duelId: string, duelData: any) => void;
  onInvitationReceived: (invitation: { duelId: string; type: string; matchId: number; hostPseudo: string }) => void;
}

export const GlobalSocketListener: React.FC<GlobalSocketListenerProps> = ({ onDuelStarting, onInvitationReceived }) => {
  const { socket } = useSocket();
  const { showAlert } = useAlert();

  useEffect(() => {
    if (!socket) return;

    const handleDuelStarting = ({ startTime, duelId, duel }: { startTime: number, duelId: string, duel: any }) => {
      onDuelStarting(duelId, duel);
    };

    const handleDuelUpdate = ({ duelId, status, participants }: { duelId: string, status: string, participants: any[] }) => {
      if (participants && participants.length > 1) {
        const bgStr = safeLocalStorage.getItem('tbfo_background_duel');
        if (bgStr) {
          try {
            const bg = JSON.parse(bgStr);
            if (bg.duelId === duelId) {
              safeLocalStorage.removeItem('tbfo_background_duel');
              onDuelStarting(duelId, { matchId: bg.matchId, type: bg.type, isPrivate: bg.isPrivate });
            }
          } catch(e) {}
        }
      }
    };

    const handleDuelError = ({ message }: { message: string }) => {
      showAlert({ type: 'error', title: message });
    };

    const handleDuelInvitation = ({ duelId, type, trainingType, hostPseudo, matchId }: { duelId: string, type: string, trainingType?: string, hostPseudo: string, matchId: number }) => {
      onInvitationReceived({ 
        duelId, 
        type: (type === 'training' && trainingType === '1v1') ? 'training_1v1' : type, 
        matchId, 
        hostPseudo 
      });
    };

    socket.on('duel-starting', handleDuelStarting);
    socket.on('duel-update', handleDuelUpdate);
    socket.on('duel-error', handleDuelError);
    socket.on('duel-invitation', handleDuelInvitation);

    return () => {
      socket.off('duel-starting', handleDuelStarting);
      socket.off('duel-update', handleDuelUpdate);
      socket.off('duel-error', handleDuelError);
      socket.off('duel-invitation', handleDuelInvitation);
    };
  }, [socket, onDuelStarting, onInvitationReceived, showAlert]);

  return null;
};
