import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Star, Sparkles, X, Activity, MessageCircle } from 'lucide-react';
import { getImageUrl } from '../lib/utils';
import { LOGOS } from '../constants';
import { OptimizedMedia } from './OptimizedMedia';

export interface RewardData {
  type: 'money' | 'gems' | 'boost' | 'energy' | 'xp' | 'card' | 'skin' | 'emote' | 'action' | 'choice';
  amount?: number;
  card?: any;
  skin?: any;
  emote?: any;
  action?: any;
  title?: string;
  subtitle?: string;
}

interface RewardAlertProps {
  reward: RewardData | null;
  onClose: () => void;
}

export function RewardAlert({ reward, onClose }: RewardAlertProps) {
  if (!reward) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 overflow-hidden"
      >
        {/* Background Particles/Glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/20 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 blur-[120px] rounded-full animate-pulse delay-1000" />
        </div>

        <motion.button
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1 }}
          onClick={onClose}
          className="absolute top-6 right-6 p-4 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-50 border border-white/10"
        >
          <X size={24} />
        </motion.button>

        <div className="w-full max-w-[450px] h-full flex flex-col items-center justify-center text-center space-y-8 md:space-y-12 relative z-10 overflow-y-auto no-scrollbar py-12">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", damping: 15 }}
            className="space-y-4 w-full"
          >
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring" }}
              className="inline-flex items-center gap-2 px-4 py-1 bg-orange-500 text-white text-[10px] font-black italic uppercase tracking-widest rounded-full shadow-lg shadow-orange-500/40"
            >
              <Sparkles size={12} />
              Récompense Débloquée !
            </motion.div>
            <h1 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-white drop-shadow-2xl leading-none">
              {reward.title || 'Félicitations !'}
            </h1>
            {reward.subtitle && (
              <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] md:text-xs">{reward.subtitle}</p>
            )}
          </motion.div>

          <motion.div
            initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className="relative flex justify-center w-full"
          >
            {reward.type === 'card' && reward.card && (
              <div className="w-64 md:w-72 aspect-[3/4] rounded-3xl border-4 border-orange-500 overflow-hidden shadow-2xl shadow-orange-500/40 bg-gray-900 group">
                <img src={getImageUrl(reward.card.imageUrl)} className="w-full h-full object-cover" alt={reward.card.name} />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                <div className="absolute bottom-0 inset-x-0 p-6 text-left">
                  <p className="text-orange-500 text-[10px] font-black uppercase tracking-widest mb-1">Nouvelle Carte</p>
                  <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">{reward.card.name}</h3>
                </div>
              </div>
            )}

            {reward.type === 'skin' && reward.skin && (
              <div className="w-64 md:w-72 aspect-[3/4] rounded-3xl border-4 border-blue-500 overflow-hidden shadow-2xl shadow-blue-500/40 bg-gray-900">
                {reward.skin.videoUrl ? (
                  <OptimizedMedia
                    type="video"
                    src={reward.skin.videoUrl}
                    poster={reward.skin.imageUrl}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <OptimizedMedia
                    type="image"
                    src={reward.skin.imageUrl}
                    alt={reward.skin.name}
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                <div className="absolute bottom-0 inset-x-0 p-6 text-left">
                  <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest mb-1">Nouveau Skin</p>
                  <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">{reward.skin.name}</h3>
                </div>
              </div>
            )}

            {reward.type === 'emote' && reward.emote && (
              <div className="w-64 md:w-72 aspect-square rounded-3xl border-4 border-purple-500 overflow-hidden shadow-2xl shadow-purple-500/40 bg-gray-900 flex items-center justify-center p-8">
                {reward.emote.videoUrl ? (
                  <OptimizedMedia
                    type="video"
                    src={reward.emote.videoUrl}
                    poster={reward.emote.imageUrl}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <OptimizedMedia
                    type="image"
                    src={reward.emote.imageUrl}
                    alt={reward.emote.name}
                    className="w-full h-full object-contain"
                  />
                )}
                <div className="absolute bottom-0 inset-x-0 p-6 text-center">
                  <p className="text-purple-400 text-[10px] font-black uppercase tracking-widest mb-1">Nouvel Emote</p>
                  <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">{reward.emote.name}</h3>
                </div>
              </div>
            )}

            {reward.type === 'action' && reward.action && (
              <div className="w-64 md:w-72 aspect-square rounded-3xl border-4 border-green-500 overflow-hidden shadow-2xl shadow-green-500/40 bg-gray-900 flex items-center justify-center p-8">
                {reward.action.videoUrl ? (
                  <OptimizedMedia
                    type="video"
                    src={reward.action.videoUrl}
                    poster={reward.action.image}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <OptimizedMedia
                    type="image"
                    src={reward.action.image}
                    alt={reward.action.name}
                    className="w-full h-full object-contain"
                  />
                )}
                <div className="absolute bottom-0 inset-x-0 p-6 text-center">
                  <p className="text-green-400 text-[10px] font-black uppercase tracking-widest mb-1">Nouvelle Action</p>
                  <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">{reward.action.name}</h3>
                </div>
              </div>
            )}

            {(reward.type === 'money' || reward.type === 'gems' || reward.type === 'boost' || reward.type === 'energy' || reward.type === 'xp') && (
              <div className="w-56 h-56 md:w-64 md:h-64 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center shadow-2xl shadow-orange-500/40 border-8 border-white/20">
                <div className="text-center">
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  >
                    {reward.type === 'money' && <img src={LOGOS.money} alt="Money" className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-2 object-contain" />}
                    {reward.type === 'gems' && <img src={LOGOS.gems} alt="Gems" className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-2 object-contain" />}
                    {reward.type === 'boost' && <img src={LOGOS.boost} alt="Boost" className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-2 object-contain" />}
                    {reward.type === 'energy' && <img src={LOGOS.energy} alt="Energy" className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-2 object-contain" />}
                    {reward.type === 'xp' && <Trophy size={64} className="text-white mx-auto mb-2" />}
                  </motion.div>
                  <div className="text-5xl md:text-6xl font-black italic text-white tracking-tighter">+{reward.amount}</div>
                  <div className="text-xs md:text-sm font-black uppercase tracking-widest text-white/80">{reward.type}</div>
                </div>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="flex flex-col items-center gap-6 w-full"
          >
            <button
              onClick={onClose}
              className="w-full md:w-auto px-16 py-5 bg-white text-black font-black italic uppercase tracking-widest rounded-2xl hover:bg-orange-500 hover:text-white transition-all active:scale-95 shadow-2xl shadow-white/10"
            >
              Continuer
            </button>
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest animate-bounce">Appuyez pour fermer</p>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
