import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Star, Sparkles, X, Activity, MessageCircle } from 'lucide-react';
import { getImageUrl, cn } from '../lib/utils';
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
  const [clickCount, setClickCount] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  if (!reward) return null;

  const handleMoneyClick = () => {
    if (isRevealed) return;
    
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 200);

    const nextCount = clickCount + 1;
    setClickCount(nextCount);
    
    if (nextCount >= 3) {
      setTimeout(() => setIsRevealed(true), 200);
    }
  };

  const handleGlobalClick = () => {
    if (reward.type === 'money' && isRevealed) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleGlobalClick}
        className={cn(
          "fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden select-none",
          reward.type === 'money' && isRevealed ? "bg-black/80" : "bg-black/95 backdrop-blur-xl"
        )}
      >
        {/* Background Particles/Glow */}
        <div className="absolute inset-0 pointer-events-none">
          {reward.type === 'money' ? (
            isRevealed && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full h-full relative"
              >
                <video 
                  src="https://thebestfan.online/img/public/logo/videoMoney.mp4" 
                  poster="https://thebestfan.online/img/public/logo/imageMoney.png"
                  autoPlay 
                  onEnded={() => {}} // User can close anytime after reveal
                  muted 
                  playsInline 
                  className="w-full h-full object-cover opacity-80" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/60" />
              </motion.div>
            )
          ) : (
            <>
              <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/20 blur-[120px] rounded-full animate-pulse" />
              <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 blur-[120px] rounded-full animate-pulse delay-1000" />
            </>
          )}
        </div>

        {(!isRevealed || reward.type !== 'money') && (
          <motion.button
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1 }}
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="absolute top-6 right-6 p-4 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-50 border border-white/10"
          >
            <X size={24} />
          </motion.button>
        )}

        <div className="w-full max-w-lg h-full flex flex-col items-center justify-center text-center space-y-4 md:space-y-8 relative z-10 overflow-hidden py-10 px-4">
          
          {(reward.type !== 'money' || isRevealed) && (
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
              <h1 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-white drop-shadow-2xl leading-tight">
                {reward.title || 'Félicitations !'}
              </h1>
              {reward.subtitle && (
                <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] md:text-xs">{reward.subtitle}</p>
              )}
            </motion.div>
          )}

          <motion.div
            initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className="relative flex justify-center w-full max-h-[50vh] items-center"
          >
            {reward.type === 'card' && reward.card && (
              <div className="w-56 md:w-64 aspect-[3/4] rounded-3xl border-4 border-orange-500 overflow-hidden shadow-2xl shadow-orange-500/40 bg-gray-900 group relative">
                <img src={getImageUrl(reward.card.imageUrl)} className="w-full h-full object-cover" alt={reward.card.name} />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                <div className="absolute bottom-0 inset-x-0 p-4 text-left">
                  <p className="text-orange-500 text-[9px] font-black uppercase tracking-widest mb-1">Nouvelle Carte</p>
                  <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">{reward.card.name}</h3>
                </div>
              </div>
            )}

            {reward.type === 'skin' && reward.skin && (
              <div className="w-56 md:w-64 aspect-[3/4] rounded-3xl border-4 border-blue-500 overflow-hidden shadow-2xl shadow-blue-500/40 bg-gray-900 relative">
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
                <div className="absolute bottom-0 inset-x-0 p-4 text-left">
                  <p className="text-blue-400 text-[9px] font-black uppercase tracking-widest mb-1">Nouveau Skin</p>
                  <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">{reward.skin.name}</h3>
                </div>
              </div>
            )}

            {reward.type === 'emote' && reward.emote && (
              <div className="w-56 h-56 md:w-64 md:h-64 rounded-3xl border-4 border-purple-500 overflow-hidden shadow-2xl shadow-purple-500/40 bg-gray-900 flex items-center justify-center p-6 relative">
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
                <div className="absolute bottom-0 inset-x-0 p-4 text-center">
                  <p className="text-purple-400 text-[9px] font-black uppercase tracking-widest mb-1">Nouvel Emote</p>
                  <h3 className="text-lg font-black italic uppercase tracking-tighter text-white">{reward.emote.name}</h3>
                </div>
              </div>
            )}

            {reward.type === 'action' && reward.action && (
              <div className="w-56 h-56 md:w-64 md:h-64 rounded-3xl border-4 border-green-500 overflow-hidden shadow-2xl shadow-green-500/40 bg-gray-900 flex items-center justify-center p-6 relative">
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
                <div className="absolute bottom-0 inset-x-0 p-4 text-center">
                  <p className="text-green-400 text-[9px] font-black uppercase tracking-widest mb-1">Nouvelle Action</p>
                  <h3 className="text-lg font-black italic uppercase tracking-tighter text-white">{reward.action.name}</h3>
                </div>
              </div>
            )}

            {reward.type === 'money' && (
              <div className="w-full flex flex-col items-center justify-center">
                {!isRevealed ? (
                  <motion.div
                    animate={isAnimating ? { scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] } : { y: [-10, 10, -10] }}
                    transition={isAnimating ? { duration: 0.2 } : { repeat: Infinity, duration: 4, ease: "easeInOut" }}
                    onClick={(e) => { e.stopPropagation(); handleMoneyClick(); }}
                    className="w-64 h-64 md:w-80 md:h-80 cursor-pointer active:scale-95 transition-transform"
                  >
                    <img 
                      src="https://thebestfan.online/img/public/logo/imageMoney.png" 
                      alt="Money Bag" 
                      className="w-full h-full object-contain filter drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)]" 
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <p className="text-white font-black italic uppercase text-lg bg-orange-500 px-4 py-1 rounded-full shadow-xl animate-pulse">
                        Cliquez ! ({3 - clickCount})
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center"
                  >
                    <div className="text-7xl md:text-9xl font-black italic text-white tracking-tighter drop-shadow-[0_0_30px_rgba(0,0,0,0.8)]">
                      +{reward.amount} $
                    </div>
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mt-4 flex items-center justify-center gap-2">
                      <Sparkles size={14} className="text-orange-500" />
                      Argent ajouté à votre compte
                      <Sparkles size={14} className="text-orange-500" />
                    </p>
                  </motion.div>
                )}
              </div>
            )}

            {(reward.type === 'gems' || reward.type === 'boost' || reward.type === 'energy' || reward.type === 'xp') && (
              <div className="w-48 h-48 md:w-64 md:h-64 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center shadow-2xl shadow-orange-500/40 border-8 border-white/20">
                <div className="text-center">
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  >
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
            className="flex flex-col items-center gap-4 w-full"
          >
            {reward.type !== 'money' ? (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); onClose(); }}
                  className="w-full md:w-auto px-16 py-4 bg-white text-black font-black italic uppercase tracking-widest rounded-2xl hover:bg-orange-500 hover:text-white transition-all active:scale-95 shadow-2xl shadow-white/10"
                >
                  Continuer
                </button>
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest animate-pulse">Appuyez pour fermer</p>
              </>
            ) : isRevealed && (
              <p className="text-gray-400 text-xs font-black uppercase tracking-[0.2em] animate-pulse mt-8">
                Cliquez n'importe où pour continuer
              </p>
            )}
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

