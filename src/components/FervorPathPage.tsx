import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, GlobalFervorConfig, FerveurLevel, Card as DuelCard, LifeAction } from '../types';
import { Card, Button } from './Layout';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs, updateDoc, arrayUnion, setDoc } from 'firebase/firestore';
import { ArrowLeft, Lock, Check, Gift, Star, Zap, Flame, Trophy, ChevronRight, Layers, Shield, Smile, Activity } from 'lucide-react';
import { getImageUrl, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { LOGOS } from '../constants';
import { useAlert } from '../context/AlertContext';
import { useReward } from '../context/RewardContext';
import { generateFervorPath } from '../utils/fervorPath';
import { OptimizedMedia } from './OptimizedMedia';

interface FervorPathPageProps {
  profile: UserProfile;
  onBack: () => void;
}

export function FervorPathPage({ profile, onBack }: FervorPathPageProps) {
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const { showAlert } = useAlert();
  const { showReward } = useReward();

  const [fanzTemplates, setFanzTemplates] = useState<any[]>([]);
  const [cards, setCards] = useState<DuelCard[]>([]);
  const [actions, setActions] = useState<LifeAction[]>([]);
  const [globalConfig, setGlobalConfig] = useState<GlobalFervorConfig | undefined>(undefined);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const [fanzSnap, configSnap, cardsSnap, actionsSnap] = await Promise.all([
          getDocs(collection(db, 'fanz_templates')),
          getDoc(doc(db, 'global_configs', 'user_fervor')),
          getDocs(collection(db, 'cards')),
          getDocs(collection(db, 'life_actions'))
        ]);
        
        const fanzData = fanzSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFanzTemplates(fanzData.filter(f => (f as any).isActive !== false));
        
        setCards(cardsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as DuelCard[]);
        setActions(actionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LifeAction[]);

        if (configSnap.exists()) {
          const data = configSnap.data() as GlobalFervorConfig;
          if (!data.ranges || data.ranges.length === 0) {
            setGlobalConfig({
              id: 'user_fervor',
              ranges: [
                { level: 1, min: 0, max: 99999, step: 5000, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 50 } },
                { level: 2, min: 100000, max: 499999, step: 10000, levelReward: { type: 'gems', amount: 100 }, intermediateReward: { type: 'money', amount: 100 } },
                { level: 3, min: 500000, max: 999999, step: 25000, levelReward: { type: 'boost', amount: 5 }, intermediateReward: { type: 'money', amount: 200 } },
                { level: 4, min: 1000000, max: 1999999, step: 50000, levelReward: { type: 'gems', amount: 500 }, intermediateReward: { type: 'money', amount: 500 } },
                { level: 5, min: 2000000, max: 2999999, step: 50000, levelReward: { type: 'money', amount: 10000 }, intermediateReward: { type: 'gems', amount: 10 } },
                { level: 6, min: 3000000, max: 3999999, step: 100000, levelReward: { type: 'boost', amount: 10 }, intermediateReward: { type: 'money', amount: 1000 } },
                { level: 7, min: 4000000, max: 4999999, step: 100000, levelReward: { type: 'gems', amount: 1000 }, intermediateReward: { type: 'money', amount: 1000 } },
                { level: 8, min: 5000000, max: 5999999, step: 100000, levelReward: { type: 'money', amount: 50000 }, intermediateReward: { type: 'gems', amount: 20 } },
                { level: 9, min: 6000000, max: 6999999, step: 200000, levelReward: { type: 'boost', amount: 20 }, intermediateReward: { type: 'money', amount: 2000 } },
                { level: 10, min: 7000000, max: 7999999, step: 200000, levelReward: { type: 'gems', amount: 2000 }, intermediateReward: { type: 'money', amount: 2000 } },
                { level: 11, min: 8000000, max: 8999999, step: 200000, levelReward: { type: 'money', amount: 100000 }, intermediateReward: { type: 'gems', amount: 50 } },
                { level: 12, min: 9000000, max: 9999999, step: 250000, levelReward: { type: 'boost', amount: 50 }, intermediateReward: { type: 'money', amount: 5000 } },
                { level: 13, min: 10000000, max: 11999999, step: 250000, levelReward: { type: 'gems', amount: 5000 }, intermediateReward: { type: 'money', amount: 5000 } },
                { level: 14, min: 12000000, max: 14999999, step: 500000, levelReward: { type: 'money', amount: 500000 }, intermediateReward: { type: 'gems', amount: 100 } },
                { level: 15, min: 15000000, max: 15000000, step: 1000000, levelReward: { type: 'boost', amount: 100 }, intermediateReward: { type: 'money', amount: 10000 } },
              ]
            });
          } else {
            setGlobalConfig(data);
          }
        }
      } catch (err) {
        console.error("Error fetching fervor config", err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleClaimReward = async (level: FerveurLevel) => {
    if (!level.reward || !profile.uid || claiming) return;
    
    const slotId = `ferveur-level-${level.level}`;
    if (profile.claimedFervorRewards?.includes(slotId)) return;

    setClaiming(slotId);
    try {
      const userRef = doc(db, 'users', profile.uid);
      const updates: any = {
        claimedFervorRewards: arrayUnion(slotId)
      };

      if (level.reward.type === 'money') updates.money = (profile.money || 0) + (level.reward.amount || 0);
      if (level.reward.type === 'gems') updates.gems = (profile.gems || 0) + (level.reward.amount || 0);
      if (level.reward.type === 'boost') updates.boostPoints = (profile.boostPoints || 0) + (level.reward.amount || 0);
      if (level.reward.type === 'energy') updates.energy = Math.min(profile.maxEnergy || 100, (profile.energy || 0) + (level.reward.amount || 0));
      if (level.reward.type === 'team_slot') updates.teamSlots = (profile.teamSlots || 2) + 1;

      await updateDoc(userRef, updates);

      if (level.reward.type === 'fanz' && level.reward.fanzId) {
        const fanzRef = doc(db, 'fanz', `${profile.uid}_${level.reward.fanzId}`);
        const fanzDoc = await getDoc(fanzRef);
        if (!fanzDoc.exists()) {
          const templateDoc = await getDoc(doc(db, 'fanz_templates', level.reward.fanzId));
          if (templateDoc.exists()) {
            const templateData = templateDoc.data();
            await setDoc(fanzRef, {
              id: `${profile.uid}_${level.reward.fanzId}`,
              templateId: level.reward.fanzId,
              ownerUid: profile.uid,
              name: templateData.name || 'Unknown Fanz',
              sport: templateData.sport || 'Football',
              imageUrl: templateData.image || null,
              videoUrl: templateData.video || null,
              baseExcitement: templateData.baseExcitement || 5,
              level: 1,
              xp: 0,
              rank: 1,
              ferveurPoints: 0,
              ferveurLevel: 1,
              energy: 100,
              equippedCards: [],
              deck: [],
              unlockedSkins: [],
              unlockedEmotes: [],
              stats: templateData.baseStats || { force: 10, endurance: 10, mental: 10, bluff: 10, creativity: 10, social: 10, intelligence: 10, charisma: 10 },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }
        }
      }
      
      showReward({
        title: `Palier ${level.level} atteint !`,
        type: level.reward.type as any,
        amount: level.reward.amount,
        card: cards.find(c => c.id === level.reward?.cardId),
        skin: fanzTemplates.flatMap(t => t.skins?.map((s: any) => ({ ...s, templateName: t.name })) || []).find(s => s.id === level.reward?.skinId),
        emote: fanzTemplates.flatMap(t => t.emotes?.map((e: any) => ({ ...e, templateName: t.name })) || []).find(e => e.id === level.reward?.emoteId),
        action: actions.find(a => a.id === level.reward?.actionId)
      });
    } catch (err) {
      console.error("Error claiming reward", err);
      showAlert({ title: "Erreur", subtitle: "Impossible de récupérer la récompense", type: "error" });
    } finally {
      setClaiming(null);
    }
  };

  const currentPoints = profile.ferveurPoints || 0;
  
  const maxPoints = useMemo(() => {
    let calculatedMax = 0;
    fanzTemplates.forEach(f => {
      const fMax = f.ferveurConfig?.ranges?.[f.ferveurConfig.ranges.length - 1]?.max || 150000;
      calculatedMax += fMax;
    });
    return calculatedMax > 0 ? calculatedMax : 150000;
  }, [fanzTemplates]);
  
  const levels = useMemo(() => generateFervorPath(maxPoints, globalConfig), [maxPoints, globalConfig]);

  const allSkins = useMemo(() => fanzTemplates.flatMap(t => t.skins?.map((s: any) => ({ ...s, templateName: t.name })) || []), [fanzTemplates]);
  const allEmotes = useMemo(() => fanzTemplates.flatMap(t => t.emotes?.map((e: any) => ({ ...e, templateName: t.name })) || []), [fanzTemplates]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-orange-500"></div>
        <p className="text-gray-500 font-bold animate-pulse">Chargement du chemin...</p>
      </div>
    );
  }

  const majorLevels = levels.filter(l => !l.isIntermediate);
  const reachableMajorLevels = majorLevels.filter(l => currentPoints >= l.pointsRequired);
  
  // Find next unreached level
  const nextLevel = levels.find(l => currentPoints < l.pointsRequired);
  const nextMajorLevel = majorLevels.find(l => currentPoints < l.pointsRequired);

  const generateProgressHeight = () => {
    if (levels.length === 0) return 0;
    const pts = currentPoints;
    const lastStep = levels[levels.length - 1];
    if (pts >= lastStep.pointsRequired) return 100;
    
    for (let i = 0; i < levels.length; i++) {
        const step = levels[i];
        if (pts < step.pointsRequired) {
            const prevPoints = i === 0 ? 0 : levels[i-1].pointsRequired;
            const segmentProgress = (pts - prevPoints) / (step.pointsRequired - prevPoints);
            const heightPerSegment = 100 / levels.length;
            return Math.min(100, Math.max(0, (i * heightPerSegment) + (segmentProgress * heightPerSegment)));
        }
    }
    return 0;
  };

  return (
    <div className="flex flex-col bg-transparent relative min-h-full">
      <div className="flex flex-col gap-6 pb-20 pt-6 relative z-10">
        
        {/* Header Title */}
        <div className="px-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white drop-shadow-md flex items-center gap-2">
              <Flame className="w-8 h-8 text-orange-500" />
              Chemin de Ferveur
            </h1>
            <p className="text-sm text-gray-400 font-medium mt-1">
              Gagne des duels pour accumuler de la ferveur et débloquer des récompenses épiques !
            </p>
          </div>
        </div>

        {/* Next Reward Highlight */}
        {nextLevel && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-6"
          >
            <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-2xl p-4 sm:p-6 flex items-center justify-between shadow-[0_0_30px_rgba(249,115,22,0.25)] relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-48 h-48 bg-orange-500/30 blur-[60px] rounded-full" />
              
              <div className="z-10">
                <div className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-orange-400 mb-1 flex items-center gap-1">
                  <Star className="w-3 h-3 sm:w-4 sm:h-4" /> Prochain Objectif
                </div>
                <div className="text-2xl sm:text-4xl font-black italic uppercase tracking-tighter text-white drop-shadow-[0_2px_10px_rgba(249,115,22,0.8)]">
                  {nextLevel.pointsRequired.toLocaleString()} PTS
                </div>
                {!nextLevel.isIntermediate && (
                  <div className="text-sm sm:text-base text-orange-300 font-bold uppercase tracking-widest mt-1">
                    Palier {nextLevel.displayLevel}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 z-10">
                <div className="text-right">
                  <div className="text-lg sm:text-2xl font-black italic uppercase text-green-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    {['money', 'gems', 'boost', 'energy', 'xp'].includes(nextLevel.reward?.type || '') ? `+${nextLevel.reward?.amount} ${nextLevel.reward?.type === 'money' ? '$' : nextLevel.reward?.type}` : nextLevel.reward?.type === 'skin' ? 'Skin' : nextLevel.reward?.type === 'emote' ? 'Emote' : nextLevel.reward?.type === 'card' ? 'Carte' : nextLevel.reward?.type === 'action' ? 'Action' : nextLevel.reward?.type}
                  </div>
                </div>
                <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-2xl bg-black/50 border-2 border-orange-500/40 flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.3)] overflow-hidden">
                  {nextLevel.reward?.type === 'money' ? (
                    <img src={LOGOS.money} alt="Money" className="w-10 h-10 sm:w-16 sm:h-16 object-contain" />
                  ) : nextLevel.reward?.type === 'gems' ? (
                    <img src={LOGOS.gems} alt="Gems" className="w-10 h-10 sm:w-16 sm:h-16 object-contain" />
                  ) : nextLevel.reward?.type === 'skin' && nextLevel.reward?.skinId ? (
                    <OptimizedMedia 
                      type={allSkins.find(s => s.id === nextLevel.reward!.skinId)?.videoUrl ? 'video' : 'image'} 
                      src={allSkins.find(s => s.id === nextLevel.reward!.skinId)?.videoUrl || allSkins.find(s => s.id === nextLevel.reward!.skinId)?.imageUrl || null} 
                      poster={allSkins.find(s => s.id === nextLevel.reward!.skinId)?.imageUrl} 
                      className="w-full h-full object-cover" 
                    />
                  ) : nextLevel.reward?.type === 'emote' && nextLevel.reward?.emoteId ? (
                    <OptimizedMedia 
                      type={allEmotes.find(e => e.id === nextLevel.reward!.emoteId)?.videoUrl ? 'video' : 'image'} 
                      src={allEmotes.find(e => e.id === nextLevel.reward!.emoteId)?.videoUrl || allEmotes.find(e => e.id === nextLevel.reward!.emoteId)?.imageUrl || null} 
                      poster={allEmotes.find(e => e.id === nextLevel.reward!.emoteId)?.imageUrl} 
                      className="w-full h-full object-contain p-2" 
                    />
                  ) : nextLevel.reward?.type === 'card' && nextLevel.reward?.cardId ? (
                    <img src={getImageUrl(cards.find(c => c.id === nextLevel.reward!.cardId)?.imageUrl)} className="w-full h-full object-cover" />
                  ) : nextLevel.reward?.type === 'action' && nextLevel.reward?.actionId ? (
                    <img src={getImageUrl(actions.find(a => a.id === nextLevel.reward!.actionId)?.image)} className="w-full h-full object-cover" />
                  ) : (
                    <Gift className="w-8 h-8 sm:w-12 sm:h-12 text-orange-400" />
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Progress Tracker (Neon) */}
        <div className="px-6 relative cursor-pointer group" onClick={() => {
          if (nextLevel) {
            const el = document.getElementById(`ferveur-node-${nextLevel.level}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else if (levels.length > 0) {
            const el = document.getElementById(`ferveur-node-${levels[levels.length - 1].level}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }}>
          <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors rounded-xl -m-2 opacity-0 group-hover:opacity-100 pointer-events-none" />
          <div className="flex justify-between items-end mb-2 relative z-10">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest group-hover:text-gray-300 transition-colors">Ma progression</h3>
            <span className="text-sm font-black text-orange-400 group-hover:text-orange-300 transition-colors">{currentPoints.toLocaleString()} <span className="text-xs text-orange-500/50">/ {maxPoints.toLocaleString()} PTS</span></span>
          </div>
          <div className="h-4 w-full bg-gray-900/80 rounded-full overflow-hidden border border-gray-800 relative z-10">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(0, (currentPoints / maxPoints) * 100))}%` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-orange-700 via-orange-500 to-yellow-500 shadow-[0_0_15px_rgba(249,115,22,0.6)] rounded-full"
            />
            {/* Pattern overlay on progress */}
            <div className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiNmZmYiLz48L3N2Zz4=')] pointer-events-none" />
          </div>
        </div>

        {/* Sticky Tier Navigation */}
        {reachableMajorLevels.length > 0 && (
          <div className="sticky top-0 z-50 px-4 py-3 bg-[#050505]/95 backdrop-blur-md border-b border-white/5 shadow-lg">
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 items-center">
              <div className="text-xs font-black uppercase tracking-widest text-gray-500 mr-2 shrink-0">
                Paliers
              </div>
              {reachableMajorLevels.map(level => {
                const isCurrentTier = currentPoints >= level.pointsRequired && 
                  (!majorLevels[majorLevels.indexOf(level) + 1] || currentPoints < majorLevels[majorLevels.indexOf(level) + 1].pointsRequired);
                
                return (
                  <button
                    key={level.level}
                    onClick={() => {
                      const el = document.getElementById(`ferveur-node-${level.level}`);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-black italic text-lg transition-all duration-300 ${
                      isCurrentTier 
                        ? 'bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-[0_0_15px_rgba(249,115,22,0.6)] border border-orange-400/50 scale-110' 
                        : 'bg-gray-900 text-gray-400 border border-gray-800 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    {level.displayLevel}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Vertical Path */}
        <div className="relative mt-8 px-4">
          {/* Progress Bar Container */}
          <div 
            className="absolute left-1/2 top-0 bottom-0 w-6 sm:w-8 bg-gray-900 border-x border-white/10 -translate-x-1/2 rounded-full overflow-hidden cursor-pointer shadow-inner"
            onClick={() => {
               const nextStep = levels.find(l => currentPoints < l.pointsRequired);
               if (nextStep) {
                  const el = document.getElementById(`ferveur-node-${nextStep.level}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
               }
            }}
            title="Cliquez pour aller à votre progression"
          >
            {/* Active Neon Progress Line */}
            <div 
              className="w-full bg-gradient-to-b from-orange-400 to-orange-600 shadow-[0_0_30px_rgba(249,115,22,1)] rounded-full transition-all duration-1000 relative" 
              style={{ 
                height: `${generateProgressHeight()}%` 
              }}
            >
              <div className="absolute inset-0 opacity-30 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiNmZmYiLz48L3N2Zz4=')] pointer-events-none" />
            </div>
            {/* Pattern for empty part */}
            <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiNmZmYiLz48L3N2Zz4=')] pointer-events-none" />
          </div>

          <div className="space-y-32 sm:space-y-40 relative">
            {levels.map((level, idx) => {
              const isUnlocked = currentPoints >= level.pointsRequired;
              const slotId = `ferveur-level-${level.level}`;
              const isClaimed = profile.claimedFervorRewards?.includes(slotId);
              const isLeft = idx % 2 === 0;
              const isCurrentTarget = nextLevel?.level === level.level;

              return (
                <motion.div 
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: idx * 0.05 }}
                  key={idx} 
                  id={`ferveur-node-${level.level}`} 
                  className="relative flex items-center justify-center"
                >
                  {/* Milestone Node */}
                  <div className={`relative z-10 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 ${
                    level.isIntermediate ? 'w-16 h-16 sm:w-20 sm:h-20 rotate-45' : 'w-24 h-24 sm:w-32 sm:h-32'
                  } ${
                    isClaimed 
                      ? 'bg-green-900/40 border-green-500 text-green-400 shadow-[0_0_30px_rgba(34,197,94,0.3)]' 
                      : isUnlocked 
                        ? 'bg-orange-600 border-orange-300 text-white shadow-[0_0_40px_rgba(249,115,22,0.8)]' 
                        : isCurrentTarget
                          ? 'bg-gray-900 border-orange-500/50 text-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.4)] animate-[pulse_2s_ease-in-out_infinite]'
                          : 'bg-[#111] border-white/10 text-gray-600'
                  }`}>
                    <div className={level.isIntermediate ? '-rotate-45 block w-full h-full' : 'w-full h-full'}>
                      {isClaimed ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <Check className={level.isIntermediate ? "w-8 h-8 sm:w-10 sm:h-10" : "w-12 h-12 sm:w-16 sm:h-16"} />
                        </div>
                      ) : level.reward?.type === 'money' ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <img src={LOGOS.money} alt="Money" className={`${level.isIntermediate ? "w-10 h-10 sm:w-12 sm:h-12" : "w-14 h-14 sm:w-20 sm:h-20"} object-contain drop-shadow-lg`} />
                        </div>
                      ) : level.reward?.type === 'gems' ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <img src={LOGOS.gems} alt="Gems" className={`${level.isIntermediate ? "w-10 h-10 sm:w-12 sm:h-12" : "w-14 h-14 sm:w-20 sm:h-20"} object-contain drop-shadow-lg`} />
                        </div>
                      ) : level.reward?.type === 'skin' && level.reward?.skinId ? (
                        <div className="w-full h-full rounded-[inherit] overflow-hidden">
                          <OptimizedMedia 
                            type={allSkins.find(s => s.id === level.reward!.skinId)?.videoUrl ? 'video' : 'image'} 
                            src={allSkins.find(s => s.id === level.reward!.skinId)?.videoUrl || allSkins.find(s => s.id === level.reward!.skinId)?.imageUrl || null} 
                            poster={allSkins.find(s => s.id === level.reward!.skinId)?.imageUrl} 
                            className="w-full h-full object-cover scale-[1.2]" 
                            autoPlay
                            loop
                          />
                        </div>
                      ) : level.reward?.type === 'emote' && level.reward?.emoteId ? (
                        <div className="w-full h-full rounded-[inherit] overflow-hidden p-2 flex items-center justify-center bg-black/40">
                          <OptimizedMedia 
                            type={allEmotes.find(e => e.id === level.reward!.emoteId)?.videoUrl ? 'video' : 'image'} 
                            src={allEmotes.find(e => e.id === level.reward!.emoteId)?.videoUrl || allEmotes.find(e => e.id === level.reward!.emoteId)?.imageUrl || null} 
                            poster={allEmotes.find(e => e.id === level.reward!.emoteId)?.imageUrl} 
                            className="w-full h-full object-contain" 
                            autoPlay
                            loop
                          />
                        </div>
                      ) : level.reward?.type === 'card' && level.reward?.cardId ? (
                        <div className="w-full h-full rounded-[inherit] overflow-hidden p-1 sm:p-2 bg-black/40">
                          <img src={getImageUrl(cards.find(c => c.id === level.reward!.cardId)?.imageUrl)} className="w-full h-full object-cover rounded-[inherit] border border-white/20" />
                        </div>
                      ) : level.reward?.type === 'action' && level.reward?.actionId ? (
                        <div className="w-full h-full rounded-[inherit] overflow-hidden p-1 sm:p-2 bg-black/40">
                          <img src={getImageUrl(actions.find(a => a.id === level.reward!.actionId)?.image)} className="w-full h-full object-cover rounded-[inherit] border border-white/20" />
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Trophy className={level.isIntermediate ? "w-8 h-8 sm:w-10 sm:h-10" : "w-12 h-12 sm:w-16 sm:h-16"} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Points Label */}
                  <div className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap z-20 flex flex-col ${!isLeft ? (level.isIntermediate ? 'left-[calc(50%+35px)] sm:left-[calc(50%+55px)] origin-bottom-left -rotate-[45deg] items-start' : 'left-[calc(50%+50px)] sm:left-[calc(50%+75px)] items-start text-left') : (level.isIntermediate ? 'right-[calc(50%+35px)] sm:right-[calc(50%+55px)] origin-bottom-right rotate-[45deg] items-end' : 'right-[calc(50%+50px)] sm:right-[calc(50%+75px)] items-end text-right')}`}>
                    <div className={`text-lg sm:text-2xl font-black italic uppercase tracking-tighter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${isUnlocked ? 'text-orange-400' : 'text-gray-500'}`}>
                      {level.pointsRequired.toLocaleString()} PTS
                    </div>
                    {!level.isIntermediate && (
                      <div className="text-xs sm:text-sm font-black uppercase tracking-widest text-gray-400 bg-black/80 px-2 sm:px-3 py-1 rounded-full inline-block mt-1 border border-white/10 shadow-lg">
                        Palier {level.displayLevel}
                      </div>
                    )}
                  </div>

                  {/* Reward Box */}
                  <div className={`absolute top-1/2 -translate-y-1/2 ${level.isIntermediate ? 'w-[120px] sm:w-[160px]' : 'w-[140px] sm:w-[200px]'} ${isLeft ? (level.isIntermediate ? 'right-[calc(50%+30px)] sm:right-[calc(50%+50px)]' : 'right-[calc(50%+45px)] sm:right-[calc(50%+75px)]') : (level.isIntermediate ? 'left-[calc(50%+30px)] sm:left-[calc(50%+50px)]' : 'left-[calc(50%+45px)] sm:left-[calc(50%+75px)]')}`}>
                    <div className={`p-3 sm:p-5 rounded-xl sm:rounded-2xl border backdrop-blur-md transition-all duration-500 shadow-xl ${
                      isClaimed 
                        ? 'bg-black/60 border-green-500/20 opacity-70' 
                        : isUnlocked 
                          ? 'bg-gradient-to-br from-orange-900/60 to-black/80 border-orange-500/50 shadow-[0_0_25px_rgba(249,115,22,0.25)] scale-105' 
                          : isCurrentTarget
                            ? 'bg-gray-900/90 border-orange-500/40 z-20'
                            : 'bg-black/60 border-white/5 opacity-60'
                    }`}>
                      <div className="text-center">
                        <div className={`text-base sm:text-xl font-black italic uppercase tracking-tighter sm:mb-4 mb-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${isUnlocked && !isClaimed ? 'text-green-400' : 'text-gray-400'}`}>
                          {['money', 'gems', 'boost', 'energy', 'xp'].includes(level.reward?.type || '') ? `+${level.reward?.amount} ${level.reward?.type === 'money' ? '$' : level.reward?.type}` : level.reward?.type === 'skin' ? 'Skin' : level.reward?.type === 'emote' ? 'Emote' : level.reward?.type === 'card' ? 'Carte' : level.reward?.type === 'action' ? 'Action' : level.reward?.type}
                        </div>
                        {isUnlocked && !isClaimed ? (
                          <Button 
                            className="w-full h-10 sm:h-12 text-sm sm:text-base bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white font-black italic uppercase tracking-widest shadow-[0_4px_15px_rgba(249,115,22,0.5)] border border-orange-400/50 px-2 sm:px-4"
                            onClick={() => handleClaimReward(level)}
                            disabled={claiming === slotId}
                          >
                            {claiming === slotId ? '...' : 'Récupérer'}
                          </Button>
                        ) : (
                          <div className={`text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 sm:gap-2 ${isClaimed ? 'text-green-500/60' : 'text-gray-500'}`}>
                            {isClaimed ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : <Lock className="w-4 h-4 sm:w-5 sm:h-5" />}
                            {isClaimed ? 'RÉCUPÉRÉ' : 'BLOQUÉ'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

