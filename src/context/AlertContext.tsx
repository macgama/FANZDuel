import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Zap, Coins, Gem, Flame, Star, Trophy, CheckCircle2, X, Activity, Users, Database } from 'lucide-react';
import { getImageUrl } from '../lib/utils';
import { LOGOS } from '../constants';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

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
  type: 'success' | 'unlock' | 'level-up' | 'error';
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
  const [dataSaver, setDataSaver] = useState(false);

  React.useEffect(() => {
    if (auth.currentUser) {
      getDoc(doc(db, 'users', auth.currentUser.uid)).then(d => {
        if (d.exists() && d.data().dataSaver) {
          setDataSaver(true);
        }
      });
    }
  }, [alertQueue]);

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
          <FullScreenAlert key={activeAlert.id} alert={activeAlert} onClose={closeAlert} dataSaver={dataSaver} />
        )}
      </AnimatePresence>
    </AlertContext.Provider>
  );
}

function FullScreenAlert({ alert, onClose, dataSaver }: { alert: GameAlert; onClose: () => void; dataSaver: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-[600px] z-[9999] flex items-center justify-center bg-black/90 overflow-hidden border-x border-white/5"
    >
      {/* Background Video or Image */}
      <div className="absolute inset-0 z-0">
        {alert.videoUrl && !dataSaver ? (
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

      {/* Content Container - Constrained for 9:16 feel on desktop, full on mobile */}
      <div className="relative z-10 w-full lg:max-w-[450px] h-full flex flex-col items-center justify-center px-6 py-12 text-center overflow-y-auto no-scrollbar">
        <motion.div
          initial={{ scale: 0.8, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: "spring", damping: 15, stiffness: 100, delay: 0.2 }}
          className="w-full space-y-6 md:space-y-8 my-auto"
        >
          {/* Icon/Badge */}
          <div className="flex justify-center">
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 bg-orange-500/20 rounded-full blur-2xl scale-150"
              />
              <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full bg-orange-600 border-4 border-white flex items-center justify-center shadow-[0_0_50px_rgba(249,115,22,0.5)]">
                {alert.type === 'level-up' ? (
                  <Trophy className="w-10 h-10 md:w-12 md:h-12 text-white" />
                ) : alert.type === 'unlock' ? (
                  <Star className="w-10 h-10 md:w-12 md:h-12 text-white fill-current" />
                ) : alert.type === 'error' ? (
                  <X className="w-10 h-10 md:w-12 md:h-12 text-white" />
                ) : (
                  <CheckCircle2 className="w-10 h-10 md:w-12 md:h-12 text-white" />
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
              className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-white drop-shadow-[0_5px_15px_rgba(0,0,0,0.5)] leading-none"
            >
              {alert.title}
            </motion.h2>
            {alert.subtitle && (
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-lg md:text-xl font-bold text-orange-500 uppercase tracking-widest italic"
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
              className="grid grid-cols-2 gap-3 md:gap-4 py-4 md:py-8"
            >
              {alert.rewards.map((reward, idx) => (
                <motion.div
                  key={idx}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.7 + idx * 0.1, type: "spring" }}
                  className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-3 md:p-4 flex flex-col items-center gap-1 md:gap-2 shadow-xl"
                >
                  <RewardIcon type={reward.type} stat={reward.stat} />
                  <div className="text-xl md:text-2xl font-black text-white">
                    {reward.amount ? `+${reward.amount}` : ''}
                  </div>
                  <div className="text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest">
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
            className="pt-4 md:pt-8"
          >
            <button
              onClick={onClose}
              className="w-full md:w-auto px-12 py-4 bg-white text-black font-black italic uppercase tracking-widest rounded-full hover:bg-orange-500 hover:text-white transition-all transform hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.3)]"
            >
              Continuer
            </button>
          </motion.div>
        </motion.div>
      </div>

      {/* Close button (top right) */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-[10000] border border-white/10"
      >
        <X className="w-6 h-6" />
      </button>
    </motion.div>
  );
}

function RewardIcon({ type, stat }: { type: Reward['type']; stat?: string }) {
  switch (type) {
    case 'money': return <img src={LOGOS.money} alt="Money" className="w-8 h-8 object-contain" />;
    case 'gems': return <img src={LOGOS.gems} alt="Gems" className="w-8 h-8 object-contain" />;
    case 'boost': return <img src={LOGOS.boost} alt="Boost" className="w-8 h-8 object-contain" />;
    case 'energy': return <img src={LOGOS.energy} alt="Energy" className="w-8 h-8 object-contain" />;
    case 'xp': return <Activity className="w-8 h-8 text-blue-400" />;
    case 'card': return <Database className="w-8 h-8 text-orange-500" />;
    case 'team': return <Users className="w-8 h-8 text-green-500" />;
    case 'fanz': return <Trophy className="w-8 h-8 text-yellow-500" />;
    default: return <Star className="w-8 h-8 text-white" />;
  }
}
