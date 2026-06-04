import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Star, Sparkles, X, Activity, MessageCircle } from 'lucide-react';
import { getImageUrl, cn } from '../lib/utils';
import { LOGOS } from '../constants';
import { OptimizedMedia } from './OptimizedMedia';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

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
  const [dataSaver, setDataSaver] = useState(false);

  React.useEffect(() => {
    if (auth.currentUser && reward) {
      getDoc(doc(db, 'users', auth.currentUser.uid)).then(d => {
        if (d.exists() && d.data().dataSaver) {
          setDataSaver(true);
        }
      });
    }
  }, [reward]);

  const [flyingTexts, setFlyingTexts] = useState<Array<{id: number, text: string, x: number, y: number, color: string, rotate: number}>>([]);

  if (!reward) return null;

  const CRAZY_TEXTS = ["WAOUW !", "YES !", "GO GO GO !!!", "INCROYABLE !", "BIM !", "CRAZY !", "BOOM !", "OUF !", "MAGNIFIQUE !", "BINGO !", "C'EST FOU !!!", "MÉGA !"];
  const FLYING_COLORS = ['text-yellow-400', 'text-orange-500', 'text-red-500', 'text-green-400', 'text-blue-400', 'text-purple-500', 'text-pink-500', 'text-cyan-400'];

  const playSound = (type: 'click' | 'reveal' | 'crazy') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      if (type === 'click') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(400 + Math.random() * 600, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(800 + Math.random() * 600, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.1);

        // Add a small little "pop"
        const clickOsc = audioCtx.createOscillator();
        const clickGain = audioCtx.createGain();
        clickOsc.type = 'square';
        clickOsc.frequency.setValueAtTime(150 + Math.random() * 100, audioCtx.currentTime);
        clickOsc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.05);
        clickGain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        clickGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
        clickOsc.connect(clickGain);
        clickGain.connect(audioCtx.destination);
        clickOsc.start(audioCtx.currentTime);
        clickOsc.stop(audioCtx.currentTime + 0.05);

      } else if (type === 'reveal') {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
        oscillator.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.2);
        oscillator.frequency.linearRampToValueAtTime(1200, audioCtx.currentTime + 0.5);
        gainNode.gain.setValueAtTime(0.8, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.5);
        
        const oscillator2 = audioCtx.createOscillator();
        oscillator2.type = 'square';
        oscillator2.frequency.setValueAtTime(400, audioCtx.currentTime);
        oscillator2.frequency.linearRampToValueAtTime(600, audioCtx.currentTime + 0.5);
        const gainNode2 = audioCtx.createGain();
        gainNode2.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.5);
        oscillator2.connect(gainNode2);
        gainNode2.connect(audioCtx.destination);
        
        // Add a chord effect
        const oscillator3 = audioCtx.createOscillator();
        oscillator3.type = 'sine';
        oscillator3.frequency.setValueAtTime(800, audioCtx.currentTime);
        oscillator3.frequency.linearRampToValueAtTime(1000, audioCtx.currentTime + 0.4);
        const gainNode3 = audioCtx.createGain();
        gainNode3.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gainNode3.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.5);
        oscillator3.connect(gainNode3);
        gainNode3.connect(audioCtx.destination);

        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 1.5);
        oscillator2.start(audioCtx.currentTime);
        oscillator2.stop(audioCtx.currentTime + 1.5);
        oscillator3.start(audioCtx.currentTime);
        oscillator3.stop(audioCtx.currentTime + 1.5);
      }
    } catch (e) {}
  };

  const handleRevealClick = () => {
    if (isRevealed) return;
    
    playSound('click');
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 200);

    const text = CRAZY_TEXTS[Math.floor(Math.random() * CRAZY_TEXTS.length)];
    const color = FLYING_COLORS[Math.floor(Math.random() * FLYING_COLORS.length)];
    const currentId = clickCount;
    setFlyingTexts(prev => [...prev, {
      id: currentId,
      text,
      x: 10 + Math.random() * 80,
      y: 10 + Math.random() * 80,
      color,
      rotate: -40 + Math.random() * 80
    }]);

    const nextCount = clickCount + 1;
    setClickCount(nextCount);
    
    if (nextCount >= 3) {
      playSound('reveal');
      setTimeout(() => setIsRevealed(true), 200);
    }
  };

  const handleGlobalClick = () => {
    if (isRevealed) {
      onClose();
    }
  };

  const getRewardImage = () => {
    switch (reward.type) {
      case 'money': return 'https://thebestfan.online/img/public/logo/imageMoney.png';
      case 'gems': return 'https://thebestfan.online/img/public/logo/imageGemme.png';
      case 'boost': return 'https://thebestfan.online/img/public/logo/imageBoost.png';
      case 'energy': return 'https://thebestfan.online/img/public/logo/imageEnergy.png';
      case 'xp': return 'https://thebestfan.online/img/public/logo/imageLevel.png';
      case 'card': return getImageUrl(reward.card?.imageUrl || 'https://thebestfan.online/img/public/logo/imageMydeck.png');
      case 'skin': return getImageUrl(reward.skin?.imageUrl || 'https://thebestfan.online/img/public/logo/imageMyfan.png');
      case 'emote': return getImageUrl(reward.emote?.imageUrl || 'https://thebestfan.online/img/public/logo/imageSocial.png');
      case 'action': return getImageUrl(reward.action?.image || 'https://thebestfan.online/img/public/logo/imageForce.png');
      default: return 'https://thebestfan.online/img/public/logo/chest.png';
    }
  };

  const getRewardVideo = () => {
    switch (reward.type) {
      case 'money': return 'https://thebestfan.online/img/public/logo/videoMoney.mp4';
      case 'energy': return 'https://thebestfan.online/img/public/logo/videoEnergy.mp4';
      case 'xp': return 'https://thebestfan.online/img/public/logo/videoLevel.mp4';
      case 'gems': return 'https://thebestfan.online/img/public/logo/videoGemme.mp4';
      case 'boost': return 'https://thebestfan.online/img/public/logo/videoBoost.mp4';
      case 'emote': return 'https://thebestfan.online/img/public/logo/videoSocial.mp4';
      case 'action': return 'https://thebestfan.online/img/public/logo/videoForce.mp4';
      case 'card': return 'https://thebestfan.online/img/public/logo/videoTBFO.mp4';
      case 'skin': return 'https://thebestfan.online/img/public/logo/videoToken.mp4';
      default: return null;
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
          "fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-[600px] border-x border-white/5 z-[100] flex items-center justify-center p-4 overflow-hidden select-none",
          ['money', 'gems', 'boost', 'energy', 'xp', 'emote', 'action', 'card', 'skin'].includes(reward.type) && isRevealed ? "bg-black/80" : "bg-black/95 backdrop-blur-xl"
        )}
      >
        {/* Background Particles/Glow */}
        <div className="absolute inset-0 pointer-events-none z-0">
          {isRevealed && getRewardVideo() && !dataSaver ? (
            <motion.div 
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="w-full h-full relative"
            >
              <video 
                src={getRewardVideo()!} 
                poster={getRewardImage()}
                autoPlay 
                onEnded={() => {}} 
                muted 
                playsInline 
                className="w-full h-full object-cover" 
              />
              <div className="absolute inset-0 bg-black/40" />
            </motion.div>
          ) : isRevealed && getRewardImage() ? (
            <motion.div 
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="w-full h-full relative border-green"
            >
              <img src={getRewardImage()} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40" />
            </motion.div>
          ) : (
            <>
              <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/20 blur-[120px] rounded-full animate-pulse" />
              <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 blur-[120px] rounded-full animate-pulse delay-1000" />
            </>
          )}
        </div>

        {/* Close Button if revealed */}
        {isRevealed && (
          <motion.button
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1 }}
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="absolute top-6 right-6 p-4 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-50 border border-white/10 flex items-center justify-center backdrop-blur-md"
          >
            <X size={24} />
          </motion.button>
        )}

        <div className="w-full max-w-lg h-full flex flex-col items-center justify-center text-center space-y-4 md:space-y-8 relative z-10 overflow-hidden py-10 px-4">
          
          {!isRevealed ? (
            <motion.div
              animate={isAnimating ? { scale: [1, 1.2, 0.9, 1.1], rotate: [0, 5, -5, 0] } : { scale: [1, 1.05, 1] }}
              transition={isAnimating ? { duration: 0.3 } : { repeat: Infinity, duration: 2, ease: "easeInOut" }}
              onClick={(e) => { e.stopPropagation(); handleRevealClick(); }}
              className="fixed inset-y-0 left-1/2 -translate-x-1/2 w-full max-w-[600px] border-x border-white/5 z-[110] flex items-center justify-center cursor-pointer overflow-hidden bg-black"
            >
              <img 
                src={getRewardImage()} 
                alt="Reward" 
                className={cn(
                  "w-full h-[120%] object-cover opacity-80 mix-blend-screen scale-110 blur-xl",
                  ['money', 'gems', 'boost', 'energy', 'xp', 'emote', 'action', 'card', 'skin'].includes(reward.type) ? "filter drop-shadow-[0_15px_50px_rgba(249,115,22,0.8)] blur-none opacity-90 h-[150%] md:h-[120%]" : ""
                )} 
              />
              <div className="absolute inset-0 bg-black/20 pointer-events-none" />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-20">
                
                {!['money', 'gems', 'boost', 'energy', 'xp', 'emote', 'action', 'skin', 'card'].includes(reward.type) && (
                  <div className="w-48 h-48 md:w-64 md:h-64 mb-10 flex items-center justify-center">
                    <img src="https://thebestfan.online/img/public/logo/chest.png" alt="Chest" className="w-full h-full object-contain filter drop-shadow-[0_0_30px_rgba(249,115,22,0.8)]" />
                  </div>
                )}

                <motion.p 
                  animate={isAnimating ? { scale: [1, 1.5, 1], rotate: [0, -10, 10, 0] } : {}}
                  className="text-white font-black italic uppercase text-4xl md:text-6xl bg-orange-600/95 px-10 md:px-14 py-6 md:py-8 rounded-full shadow-[0_0_80px_rgba(249,115,22,1)] border-4 border-white"
                >
                  Cliquez ! ({3 - clickCount})
                </motion.p>
              </div>

              <AnimatePresence>
                {flyingTexts.map(t => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, scale: 0, x: '-50%', y: '-50%', rotate: 0 }}
                    animate={{ opacity: 1, scale: 1.5, rotate: t.rotate, y: ['0%', '-150%'] }}
                    exit={{ opacity: 0, scale: 2 }}
                    transition={{ type: 'spring', damping: 10, duration: 0.8 }}
                    className={cn("absolute pointer-events-none text-5xl md:text-8xl font-black italic tracking-tighter drop-shadow-[0_10px_20px_rgba(0,0,0,1)] z-50", t.color)}
                    style={{ left: `${t.x}%`, top: `${t.y}%` }}
                  >
                    {t.text}
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            <>
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

              <motion.div
                initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                className={cn(
                  "relative flex justify-center w-full items-center",
                  ['money', 'gems', 'boost', 'energy', 'xp'].includes(reward.type) ? "" : "max-h-[50vh]"
                )}
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

                {['money', 'gems', 'boost', 'energy', 'xp'].includes(reward.type) && (
                  <motion.div 
                    initial={{ scale: 0.5, opacity: 0, y: 100 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    transition={{ type: "spring", damping: 15 }}
                    className="text-center z-50 flex flex-col items-center justify-center p-4"
                  >
                    <div className="text-8xl md:text-[10rem] font-black italic text-white tracking-tighter drop-shadow-[0_0_50px_rgba(249,115,22,0.8)]">
                      +{reward.amount} {reward.type === 'money' && '$'}
                    </div>
                    <p className="text-white font-black uppercase tracking-widest text-xs md:text-base mt-6 flex items-center justify-center gap-3 bg-black/50 px-6 py-3 rounded-full border border-white/20 backdrop-blur-md">
                      <Sparkles size={18} className="text-orange-500" />
                      {reward.type === 'money' && "Argent ajouté à votre compte"}
                      {reward.type === 'gems' && "Gemmes ajoutées à votre compte"}
                      {reward.type === 'boost' && "Boost ajouté à votre compte"}
                      {reward.type === 'energy' && "Énergie ajoutée à votre compte"}
                      {reward.type === 'xp' && "Points d'expérience gagnés"}
                      <Sparkles size={18} className="text-orange-500" />
                    </p>
                  </motion.div>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
                className="flex flex-col items-center gap-4 w-full"
              >
                {!['money', 'gems', 'boost', 'energy', 'xp'].includes(reward.type) ? (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); onClose(); }}
                      className="w-full md:w-auto px-16 py-4 bg-white text-black font-black italic uppercase tracking-widest rounded-2xl hover:bg-orange-500 hover:text-white transition-all active:scale-95 shadow-2xl shadow-white/10"
                    >
                      Continuer
                    </button>
                    <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest animate-pulse">Appuyez pour fermer</p>
                  </>
                ) : (
                  <p className="text-gray-400 text-xs font-black uppercase tracking-[0.2em] animate-pulse mt-8">
                    Cliquez n'importe où pour continuer
                  </p>
                )}
              </motion.div>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

