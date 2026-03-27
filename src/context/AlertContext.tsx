import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Zap, Coins, Gem, Flame, Star, Trophy, CheckCircle2, X, Activity, Users, Database } from 'lucide-react';
import { getImageUrl } from '../lib/utils';

export interface Reward {
  type: 'money' | 'gems' | 'boost' | 'xp' | 'energy' | 'card' | 'team' | 'fanz';
  amount?: number;
  label?: string;
  stat?: string;
}

export interface GameAlert {
  id: string;
  title: string;
  subtitle?: string;
  videoUrl?: string;
  imageUrl?: string;
  rewards?: Reward[];
  type: 'success' | 'unlock' | 'level-up';
}

interface AlertContextType {
  showAlert: (alert: Omit<GameAlert, 'id'>) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alertQueue, setAlertQueue] = useState<GameAlert[]>([]);

  const showAlert = useCallback((alert: Omit<GameAlert, 'id'>) => {
    setAlertQueue(prev => [...prev, { ...alert, id: Math.random().toString(36).substring(7) }]);
  }, []);

  const closeAlert = () => {
    setAlertQueue(prev => prev.slice(1));
  };

  const activeAlert = alertQueue[0] || null;

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <AnimatePresence>
        {activeAlert && (
          <FullScreenAlert key={activeAlert.id} alert={activeAlert} onClose={closeAlert} />
        )}
      </AnimatePresence>
    </AlertContext.Provider>
  );
}

function FullScreenAlert({ alert, onClose }: { alert: GameAlert; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 overflow-hidden"
    >
      {/* Background Video or Image */}
      <div className="absolute inset-0 z-0">
        {alert.videoUrl ? (
          <video
            key={getImageUrl(alert.videoUrl)}
            src={getImageUrl(alert.videoUrl)}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover opacity-60"
          />
        ) : alert.imageUrl ? (
          <img
            src={getImageUrl(alert.imageUrl)}
            alt=""
            className="w-full h-full object-cover opacity-60"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-900/20 to-black" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-2xl px-6 text-center">
        <motion.div
          initial={{ scale: 0.8, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: "spring", damping: 15, stiffness: 100, delay: 0.2 }}
          className="space-y-8"
        >
          {/* Icon/Badge */}
          <div className="flex justify-center">
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 bg-orange-500/20 rounded-full blur-2xl scale-150"
              />
              <div className="relative w-24 h-24 rounded-full bg-orange-600 border-4 border-white flex items-center justify-center shadow-[0_0_50px_rgba(249,115,22,0.5)]">
                {alert.type === 'level-up' ? (
                  <Trophy className="w-12 h-12 text-white" />
                ) : alert.type === 'unlock' ? (
                  <Star className="w-12 h-12 text-white fill-current" />
                ) : (
                  <CheckCircle2 className="w-12 h-12 text-white" />
                )}
              </div>
            </div>
          </div>

          {/* Titles */}
          <div className="space-y-2">
            <motion.h2
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter text-white drop-shadow-[0_5px_15px_rgba(0,0,0,0.5)]"
            >
              {alert.title}
            </motion.h2>
            {alert.subtitle && (
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-xl md:text-2xl font-bold text-orange-500 uppercase tracking-widest italic"
              >
                {alert.subtitle}
              </motion.p>
            )}
          </div>

          {/* Rewards */}
          {alert.rewards && alert.rewards.length > 0 && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex flex-wrap justify-center gap-4 py-8"
            >
              {alert.rewards.map((reward, idx) => (
                <motion.div
                  key={idx}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.7 + idx * 0.1, type: "spring" }}
                  className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 min-w-[120px] flex flex-col items-center gap-2 shadow-xl"
                >
                  <RewardIcon type={reward.type} stat={reward.stat} />
                  <div className="text-2xl font-black text-white">
                    {reward.amount ? `+${reward.amount}` : ''}
                  </div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {reward.label || reward.type}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Action Button */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="pt-8"
          >
            <button
              onClick={onClose}
              className="px-12 py-4 bg-white text-black font-black italic uppercase tracking-widest rounded-full hover:bg-orange-500 hover:text-white transition-all transform hover:scale-110 active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.3)]"
            >
              Continuer
            </button>
          </motion.div>
        </motion.div>
      </div>

      {/* Close button (optional, for safety) */}
      <button
        onClick={onClose}
        className="absolute top-8 right-8 p-2 text-white/50 hover:text-white transition-colors"
      >
        <X className="w-8 h-8" />
      </button>
    </motion.div>
  );
}

function RewardIcon({ type, stat }: { type: Reward['type']; stat?: string }) {
  switch (type) {
    case 'money': return <Coins className="w-8 h-8 text-yellow-400" />;
    case 'gems': return <Gem className="w-8 h-8 text-pink-400" />;
    case 'boost': return <Flame className="w-8 h-8 text-orange-500" />;
    case 'energy': return <Zap className="w-8 h-8 text-yellow-500" />;
    case 'xp': return <Activity className="w-8 h-8 text-blue-400" />;
    case 'card': return <Database className="w-8 h-8 text-orange-500" />;
    case 'team': return <Users className="w-8 h-8 text-green-500" />;
    case 'fanz': return <Trophy className="w-8 h-8 text-yellow-500" />;
    default: return <Star className="w-8 h-8 text-white" />;
  }
}
