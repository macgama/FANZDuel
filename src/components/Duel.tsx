import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Duel, UserProfile, Card as GameCard } from '../types';
import { Card, Button } from './Layout';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Swords, ChevronLeft } from 'lucide-react';

export function DuelScreen({ duel, user, onExit }: { duel: Duel; user: UserProfile; onExit: () => void }) {
  const [progress, setProgress] = useState(50);
  const [energy, setEnergy] = useState(100);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [winner, setWinner] = useState<string | null>(null);

  // Mock deck
  const deck: GameCard[] = [
    { id: '1', name: 'Cri de Guerre', type: 'common', power: 5, energyCost: 20, description: 'Pousse la corde de 5%' },
    { id: '2', name: 'Fumigène', type: 'common', power: 10, energyCost: 40, description: 'Pousse la corde de 10%' },
    { id: '3', name: 'Tifo Géant', type: 'specific', power: 20, energyCost: 70, description: 'Pousse la corde de 20%' },
    { id: '4', name: 'Chant Ultras', type: 'common', power: 3, energyCost: 10, description: 'Pousse la corde de 3%' },
  ];

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.emit('join-duel', duel.id);

    newSocket.on('duel-update', (state: { progress: number }) => {
      setProgress(state.progress);
    });

    newSocket.on('duel-finished', ({ winner }: { winner: string }) => {
      setWinner(winner);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [duel.id]);

  const handleAction = () => {
    if (winner) return;
    socket?.emit('click-ferveur', { duelId: duel.id, team: 'A' });
  };

  const playCard = (card: GameCard) => {
    if (winner || energy < card.energyCost) return;
    setEnergy(prev => prev - card.energyCost);
    socket?.emit('play-card', { duelId: duel.id, team: 'A', cardPower: card.power });
  };

  // Energy regeneration
  useEffect(() => {
    const interval = setInterval(() => {
      setEnergy(prev => Math.min(100, prev + 2));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col p-4">
      <div className="flex justify-between items-center mb-8">
        <button onClick={onExit} className="p-2 hover:bg-white/10 rounded-full">
          <ChevronLeft />
        </button>
        <div className="text-center">
          <h2 className="text-xl font-black italic uppercase tracking-tighter">{duel.type.replace('_', ' ')}</h2>
          <p className="text-xs text-gray-500">{duel.teamA} vs {duel.teamB}</p>
        </div>
        <div className="flex items-center gap-2 bg-orange-600/20 px-3 py-1 rounded-full border border-orange-500">
          <Zap size={16} className="text-orange-500" />
          <span className="font-black">{energy}</span>
        </div>
      </div>

      {/* Tug of War */}
      <div className="flex-1 flex flex-col justify-center items-center gap-12">
        <div className="w-full max-w-2xl relative h-8 bg-white/10 rounded-full border-2 border-white/20 overflow-hidden">
          {/* Center line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-white/50 z-10" />
          
          {/* Progress bar */}
          <motion.div 
            animate={{ width: `${progress}%` }}
            className="h-full bg-orange-600 shadow-[0_0_20px_rgba(255,102,0,0.5)]"
          />

          {/* Rope indicator */}
          <motion.div 
            animate={{ left: `${progress}%` }}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-12 h-12 bg-white rounded-full flex items-center justify-center border-4 border-orange-500 z-20"
          >
            <Swords className="text-orange-600" size={24} />
          </motion.div>
        </div>

        <div className="flex justify-between w-full max-w-2xl text-4xl font-black italic uppercase">
          <span className={progress > 50 ? 'text-orange-500' : 'text-white/20'}>{duel.teamA}</span>
          <span className={progress < 50 ? 'text-orange-500' : 'text-white/20'}>{duel.teamB}</span>
        </div>

        <AnimatePresence>
          {winner && (
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-6xl font-black italic uppercase text-orange-500 text-center"
            >
              {winner === 'A' ? 'Victoire !' : 'Défaite'}
            </motion.div>
          )}
        </AnimatePresence>

        <button 
          onClick={handleAction}
          disabled={!!winner}
          className="w-48 h-48 rounded-full bg-orange-600 hover:bg-orange-700 border-8 border-white/10 shadow-2xl flex flex-col items-center justify-center transition-transform active:scale-90 disabled:opacity-50"
        >
          <span className="font-black italic text-2xl uppercase">Cliquer</span>
          <span className="text-xs uppercase font-bold opacity-70">Ferveur +0.5%</span>
        </button>
      </div>

      {/* Cards Deck */}
      <div className="mt-auto pt-8">
        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
          {deck.map(card => (
            <motion.div
              key={card.id}
              whileHover={{ y: -10 }}
              onClick={() => playCard(card)}
              className={`min-w-[140px] h-[200px] rounded-xl border-2 p-4 flex flex-col cursor-pointer transition-colors ${
                energy >= card.energyCost ? 'border-orange-500 bg-orange-600/10' : 'border-white/10 bg-white/5 opacity-50'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] uppercase font-bold text-orange-500">{card.type}</span>
                <div className="flex items-center gap-1 text-xs font-bold">
                  <Zap size={10} /> {card.energyCost}
                </div>
              </div>
              <h5 className="font-black italic uppercase text-sm leading-tight mb-2">{card.name}</h5>
              <p className="text-[10px] text-gray-400 flex-1">{card.description}</p>
              <div className="mt-auto pt-2 border-t border-white/10 text-center font-black text-orange-500">
                +{card.power}%
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
