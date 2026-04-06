import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, GlobalFervorConfig, FerveurLevel } from '../types';
import { Card, Button } from './Layout';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs, updateDoc, arrayUnion, setDoc } from 'firebase/firestore';
import { ArrowLeft, Lock, Check, Gift, Star, Zap, Flame, Trophy } from 'lucide-react';
import { getImageUrl, cn } from '../lib/utils';
import { motion } from 'motion/react';
import { LOGOS } from '../constants';
import { useAlert } from '../context/AlertContext';
import { useReward } from '../context/RewardContext';
import { generateFervorPath } from '../utils/fervorPath';

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
  const [globalConfig, setGlobalConfig] = useState<GlobalFervorConfig | undefined>(undefined);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const fanzSnapshot = await getDocs(collection(db, 'fanz_templates'));
        const fanzData = fanzSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFanzTemplates(fanzData.filter(f => (f as any).isActive !== false));

        const configDoc = await getDoc(doc(db, 'global_configs', 'user_fervor'));
        if (configDoc.exists()) {
          const data = configDoc.data() as GlobalFervorConfig;
          if (!data.ranges || data.ranges.length === 0) {
            setGlobalConfig({
              id: 'user_fervor',
              ranges: [
                { level: 1, min: 0, max: 499, step: 10, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 50 } },
                { level: 2, min: 500, max: 1549, step: 15, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 50 } },
                { level: 3, min: 1550, max: 5099, step: 50, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 50 } },
                { level: 4, min: 5100, max: 10099, step: 100, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 50 } },
                { level: 5, min: 10100, max: 15099, step: 100, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 50 } },
                { level: 6, min: 15100, max: 20099, step: 100, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 50 } },
                { level: 7, min: 20100, max: 25099, step: 100, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 50 } },
                { level: 8, min: 25100, max: 30199, step: 100, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 50 } },
                { level: 9, min: 30200, max: 40199, step: 100, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 50 } },
                { level: 10, min: 40200, max: 50199, step: 100, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 50 } },
                { level: 11, min: 50200, max: 60199, step: 100, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 50 } },
                { level: 12, min: 60200, max: 70199, step: 100, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 50 } },
                { level: 13, min: 70200, max: 80199, step: 100, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 50 } },
                { level: 14, min: 80200, max: 90199, step: 100, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 50 } },
                { level: 15, min: 90200, max: 99999, step: 100, levelReward: { type: 'money', amount: 1000 }, intermediateReward: { type: 'money', amount: 50 } },
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
          await setDoc(fanzRef, {
            id: `${profile.uid}_${level.reward.fanzId}`,
            templateId: level.reward.fanzId,
            ownerUid: profile.uid,
            level: 1,
            xp: 0,
            ferveurPoints: 0,
            ferveurLevel: 1,
            stats: { force: 10, endurance: 10, mental: 10, bluff: 10, creativity: 10, social: 10, intelligence: 10, charisma: 10 }
          });
        }
      }
      
      showReward({
        title: `Palier ${level.level} atteint !`,
        type: level.reward.type as any,
        amount: level.reward.amount,
        card: level.reward.cardId,
        skin: level.reward.skinId,
        emote: level.reward.emoteId,
        action: level.reward.actionId
      });
    } catch (err) {
      console.error("Error claiming reward", err);
      showAlert({ title: "Erreur", subtitle: "Impossible de récupérer la récompense", type: "error" });
    } finally {
      setClaiming(null);
    }
  };

  const currentPoints = profile.ferveurPoints || 0;
  const activeFanzCount = fanzTemplates.length;
  const maxPoints = activeFanzCount > 0 ? activeFanzCount * 1000 : 100000;
  const levels = useMemo(() => generateFervorPath(maxPoints, globalConfig), [maxPoints, globalConfig]);

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

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] overflow-y-auto no-scrollbar relative">
      <div className="flex flex-col gap-6 pb-20 pt-6">
        {/* Progress Bar */}
        <div className="px-6">
          <div className="relative h-10 bg-black/40 rounded-xl border border-white/5 overflow-hidden shadow-2xl">
            {/* Progress Fill */}
            <div 
              className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-1000 ease-out"
              style={{ width: `${Math.min(100, (currentPoints / maxPoints) * 100)}%` }}
            />
            {/* Text Overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-black italic uppercase tracking-tighter text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]">
                {currentPoints} / {maxPoints} POINTS DE FERVEUR
              </span>
            </div>
          </div>
        </div>

        {/* Sticky Tier Navigation */}
        {reachableMajorLevels.length > 0 && (
          <div className="sticky top-0 z-50 px-4 py-2 bg-[#0a0a0a]/90 backdrop-blur-sm border-b border-white/5">
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
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
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-black italic text-sm transition-all ${
                      isCurrentTier 
                        ? 'bg-orange-500 text-white shadow-[0_0_10px_rgba(249,115,22,0.5)]' 
                        : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
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
        <div className="relative mt-6 px-4">
          {/* Central Line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-orange-500/50 via-orange-500/20 to-transparent -translate-x-1/2" />

          <div className="space-y-20 relative">
            {levels.map((level, idx) => {
              const isUnlocked = currentPoints >= level.pointsRequired;
              const slotId = `ferveur-level-${level.level}`;
              const isClaimed = profile.claimedFervorRewards?.includes(slotId);
              const isLeft = idx % 2 === 0;

              return (
                <div key={idx} id={`ferveur-node-${level.level}`} className="relative flex items-center justify-center">
                  {/* Milestone Node */}
                  <div className={`relative z-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                    level.isIntermediate ? 'w-10 h-10' : 'w-16 h-16'
                  } ${
                    isClaimed 
                      ? 'bg-green-500/20 border-green-500 text-green-500' 
                      : isUnlocked 
                        ? 'bg-orange-500/20 border-orange-500 text-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.4)]' 
                        : 'bg-[#1a1a1a] border-white/10 text-gray-600'
                  }`}>
                    {isClaimed ? (
                      <Check className={level.isIntermediate ? "w-5 h-5" : "w-8 h-8"} />
                    ) : level.reward?.type === 'money' ? (
                      <img src={LOGOS.money} alt="Money" className={`${level.isIntermediate ? "w-6 h-6" : "w-10 h-10"} object-contain`} />
                    ) : level.reward?.type === 'gems' ? (
                      <img src={LOGOS.gems} alt="Gems" className={`${level.isIntermediate ? "w-6 h-6" : "w-10 h-10"} object-contain`} />
                    ) : (
                      <Trophy className={level.isIntermediate ? "w-5 h-5" : "w-8 h-8"} />
                    )}

                    {/* Points Label */}
                    <div className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap ${isLeft ? (level.isIntermediate ? 'left-14 text-left' : 'left-20 text-left') : (level.isIntermediate ? 'right-14 text-right' : 'right-20 text-right')}`}>
                      <div className={`text-sm font-black italic uppercase tracking-tighter ${isUnlocked ? 'text-orange-500' : 'text-gray-600'}`}>
                        {level.pointsRequired} PTS
                      </div>
                      {!level.isIntermediate && (
                        <div className="text-[10px] font-black uppercase tracking-tighter text-gray-500">
                          Palier {level.displayLevel}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Reward Box */}
                  <div className={`absolute top-1/2 -translate-y-1/2 ${level.isIntermediate ? 'w-[130px]' : 'w-[160px]'} ${isLeft ? (level.isIntermediate ? 'right-[calc(50%+35px)]' : 'right-[calc(50%+45px)]') : (level.isIntermediate ? 'left-[calc(50%+35px)]' : 'left-[calc(50%+45px)]')}`}>
                    <div className={`p-4 rounded-2xl border transition-all duration-500 ${
                      isClaimed 
                        ? 'bg-black/40 border-white/5 opacity-50' 
                        : isUnlocked 
                          ? 'bg-[#1a1614] border-orange-500/30' 
                          : 'bg-black/20 border-white/5 opacity-30'
                    }`}>
                      <div className="text-center">
                        <div className={`text-base font-black italic uppercase tracking-tighter mb-2 ${isUnlocked && !isClaimed ? 'text-green-500' : 'text-gray-400'}`}>
                          +{level.reward?.amount} {level.reward?.type === 'money' ? '$' : level.reward?.type}
                        </div>
                        {isUnlocked && !isClaimed ? (
                          <Button 
                            size="sm" 
                            className="w-full h-8 text-xs bg-orange-500 hover:bg-orange-600 font-black italic uppercase tracking-tighter"
                            onClick={() => handleClaimReward(level)}
                            disabled={claiming === slotId}
                          >
                            {claiming === slotId ? '...' : 'Récupérer'}
                          </Button>
                        ) : (
                          <div className="text-xs font-black uppercase tracking-tighter text-gray-500 flex items-center justify-center gap-1">
                            {isClaimed ? null : <Lock className="w-3 h-3" />}
                            {isClaimed ? 'RÉCUPÉRÉ' : 'BLOQUÉ'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
