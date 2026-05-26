import React, { useState, useEffect } from 'react';
import { LifeAction, UserProfile, Fanz, FanzStats } from '../types';
import { Card } from './Layout';
import { Clock, Trash2, FastForward, Activity, Star, Flame, Shield, Brain, Eye, Users, Info } from 'lucide-react';
import { getImageUrl } from '../lib/utils';
import { LOGOS } from '../constants';
import { OptimizedMedia } from './OptimizedMedia';
import { db } from '../firebase';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { logTransaction } from '../services/transactionService';
import { useAlert, Reward } from '../context/AlertContext';
import { progressMission } from '../services/missionService';

interface LifeActionCardProps {
  action: LifeAction;
  fanz: Fanz;
  userProfile: UserProfile;
  fanzTemplate?: any;
}

export function LifeActionCard({ action, fanz, userProfile, fanzTemplate }: LifeActionCardProps) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const { showAlert } = useAlert();

  let resolvedImage = action.image;
  let resolvedVideoUrl = action.videoUrl;
  if (fanz.equippedSkin && action.skinOverrides && action.skinOverrides[fanz.equippedSkin]) {
    const override = action.skinOverrides[fanz.equippedSkin];
    if (override.image) resolvedImage = override.image;
    if (override.videoUrl) resolvedVideoUrl = override.videoUrl;
  }

  // Find skin modifiers
  let moneyBonusMod = 0;
  let gemsBonusMod = 0;
  let boostBonusMod = 0;
  let energyCostReduction = 0;
  let moneyCostReduction = 0;
  let gemsCostReduction = 0;
  let boostCostReduction = 0;
  if (fanzTemplate && fanz.equippedSkin) {
    const skin = (fanzTemplate.skins || []).find((s: any) => s.id === fanz.equippedSkin);
    if (skin) {
      moneyBonusMod = skin.moneyBonus || 0;
      gemsBonusMod = skin.gemsBonus || 0;
      boostBonusMod = skin.boostBonus || 0;
      energyCostReduction = skin.energyCostReduction || 0;
      moneyCostReduction = skin.moneyCostReduction || 0;
      gemsCostReduction = skin.gemsCostReduction || 0;
      boostCostReduction = skin.boostCostReduction || 0;
    }
  }

  const activeAction = userProfile.activeAction;
  const isThisActionActive = activeAction?.actionId === action.id && activeAction?.fanzId === fanz.id;
  const isAnyActionActive = !!activeAction;

  const actionProgress = fanz.lifeActionProgress?.[action.id] || { level: 1, xp: 0 };
  const currentLevel = actionProgress.level;

  // Calculate scaled costs and gains based on level
  const scaleFactor = 1 + (currentLevel - 1) * 0.2; // 20% increase per level
  
  const now = new Date();
  const isInfiniteEnergyActive = userProfile.infiniteEnergyUntil && new Date(userProfile.infiniteEnergyUntil) > now;
  const isXpBoostActive = userProfile.boostXpUntil && new Date(userProfile.boostXpUntil) > now;

  const rawCostEnergy = Math.floor((action.energyCost || 0) * scaleFactor);
  const costEnergy = isInfiniteEnergyActive ? 0 : Math.max(0, Math.round(rawCostEnergy * (1 - energyCostReduction / 100)));
  
  const rawCostMoney = Math.floor((action.moneyCost || 0) * scaleFactor);
  const costMoney = Math.max(0, Math.round(rawCostMoney * (1 - moneyCostReduction / 100)));
  
  const rawCostGems = Math.floor((action.gemsCost || 0) * scaleFactor);
  const costGems = Math.max(0, Math.round(rawCostGems * (1 - gemsCostReduction / 100)));
  
  const rawCostBoost = Math.floor((action.boostCost || 0) * scaleFactor);
  const costBoost = Math.max(0, Math.round(rawCostBoost * (1 - boostCostReduction / 100)));
  
  const gainEnergy = Math.floor((action.energyGain || 0) * scaleFactor);
  const gainMoney = Math.floor((action.moneyGain || 0) * scaleFactor * (1 + moneyBonusMod / 100));
  const gainGems = Math.floor((action.gemsGain || 0) * scaleFactor * (1 + gemsBonusMod / 100));
  const gainBoost = Math.floor((action.boostGain || 0) * scaleFactor * (1 + boostBonusMod / 100));
  const gainXp = Math.floor((action.xpGain || 0) * scaleFactor);

  const statIcons = {
    force: <img src="https://thebestfan.online/img/public/logo/logoForce.png" alt="Force" className="w-6 h-6 object-contain" referrerPolicy="no-referrer" />,
    endurance: <img src="https://thebestfan.online/img/public/logo/logoEndurance.png" alt="Endurance" className="w-6 h-6 object-contain" referrerPolicy="no-referrer" />,
    mental: <img src="https://thebestfan.online/img/public/logo/logoMental.png" alt="Mental" className="w-6 h-6 object-contain" referrerPolicy="no-referrer" />,
    bluff: <img src="https://thebestfan.online/img/public/logo/logoBluff.png" alt="Bluff" className="w-6 h-6 object-contain" referrerPolicy="no-referrer" />,
    creativity: <img src="https://thebestfan.online/img/public/logo/logoCreativity.png" alt="Créativité" className="w-6 h-6 object-contain" referrerPolicy="no-referrer" />,
    social: <img src="https://thebestfan.online/img/public/logo/logoSocial.png" alt="Social" className="w-6 h-6 object-contain" referrerPolicy="no-referrer" />,
    intelligence: <img src="https://thebestfan.online/img/public/logo/logoIntelligence.png" alt="Intelligence" className="w-6 h-6 object-contain" referrerPolicy="no-referrer" />,
    charisma: <img src="https://thebestfan.online/img/public/logo/logoCharisme.png" alt="Charisme" className="w-6 h-6 object-contain" referrerPolicy="no-referrer" />
  };

  useEffect(() => {
    if (!isThisActionActive || !activeAction) {
      setTimeLeft(null);
      return;
    }

    const calculateTimeLeft = () => {
      const startTime = new Date(activeAction.startTime).getTime();
      // 1 minute in game = 1 second in real life (for testing/gameplay as requested)
      const endTime = startTime + activeAction.durationMinutes * 1000;
      const now = new Date().getTime();
      const remaining = Math.max(0, endTime - now);
      
      if (remaining === 0) {
        handleCompleteAction();
      } else {
        setTimeLeft(remaining);
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [isThisActionActive, activeAction]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleStartAction = async () => {
    if (isAnyActionActive || isStarting) return;
    if (
      userProfile.energy < costEnergy || 
      userProfile.money < costMoney ||
      (userProfile.gems || 0) < costGems ||
      (userProfile.boostPoints || 0) < costBoost
    ) {
      showAlert({ type: 'error', title: 'Ressources insuffisantes !' });
      return;
    }

    setIsStarting(true);
    try {
      const userRef = doc(db, 'users', userProfile.uid);
      await updateDoc(userRef, {
        energy: userProfile.energy - costEnergy,
        money: userProfile.money - costMoney,
        gems: (userProfile.gems || 0) - costGems,
        boostPoints: (userProfile.boostPoints || 0) - costBoost,
        activeAction: {
          fanzId: fanz.id,
          actionId: action.id,
          startTime: new Date().toISOString(),
          durationMinutes: action.durationMinutes
        }
      });

      if (costEnergy > 0) await logTransaction(userProfile.uid, 'energy', -costEnergy, `Démarrage action: ${action.name}`);
      if (costMoney > 0) await logTransaction(userProfile.uid, 'money', -costMoney, `Démarrage action: ${action.name}`);
      if (costGems > 0) await logTransaction(userProfile.uid, 'gems', -costGems, `Démarrage action: ${action.name}`);
      if (costBoost > 0) await logTransaction(userProfile.uid, 'boost', -costBoost, `Démarrage action: ${action.name}`);
    } catch (error) {
      console.error("Erreur lors du lancement de l'action:", error);
    } finally {
      setIsStarting(false);
    }
  };

  const handleCancelAction = async () => {
    if (!isThisActionActive) return;
    try {
      const userRef = doc(db, 'users', userProfile.uid);
      await updateDoc(userRef, {
        activeAction: deleteField()
      });
    } catch (error) {
      console.error("Erreur lors de l'annulation:", error);
    }
  };

  const handleCompleteAction = async () => {
    if (!isThisActionActive) return;
    try {
      const userRef = doc(db, 'users', userProfile.uid);
      const fanzRef = doc(db, 'fanz', fanz.id);

      const unlockedActions = userProfile.unlockedActions || [];
      const skinSpecificActionId = action.id + '-' + (fanz.equippedSkin || '000');
      let newUnlockedActions = [...unlockedActions];
      if (!newUnlockedActions.includes(skinSpecificActionId)) {
        newUnlockedActions.push(skinSpecificActionId);
      }
      if (!fanz.equippedSkin || fanz.equippedSkin === '000') {
        if (!newUnlockedActions.includes(action.id)) {
          newUnlockedActions.push(action.id);
        }
      }

      // Update User
      await updateDoc(userRef, {
        energy: Math.min(100, userProfile.energy + gainEnergy),
        money: userProfile.money + gainMoney,
        gems: (userProfile.gems || 0) + gainGems,
        boostPoints: (userProfile.boostPoints || 0) + gainBoost,
        activeAction: deleteField(),
        unlockedActions: newUnlockedActions
      });

      if (gainEnergy > 0) await logTransaction(userProfile.uid, 'energy', gainEnergy, `Fin action: ${action.name}`);
      if (gainMoney > 0) await logTransaction(userProfile.uid, 'money', gainMoney, `Fin action: ${action.name}`);
      if (gainGems > 0) await logTransaction(userProfile.uid, 'gems', gainGems, `Fin action: ${action.name}`);
      if (gainBoost > 0) await logTransaction(userProfile.uid, 'boost', gainBoost, `Fin action: ${action.name}`);

      await progressMission(userProfile, 'life_action', 1);

      // Update Fanz
      const newActionXp = actionProgress.xp + 10; // Fixed XP per action for leveling up the action itself
      let newActionLevel = actionProgress.level;
      const hasLeveledUp = newActionXp >= newActionLevel * 50;
      if (hasLeveledUp) {
        newActionLevel += 1;
      }

      const newFanzStats = { ...fanz.stats };
      const xpMultiplier = isXpBoostActive ? 2 : 1;
      if (action.targetStat) {
        newFanzStats[action.targetStat] += gainXp * xpMultiplier;
      }
      if (action.xpGains) {
        Object.entries(action.xpGains).forEach(([stat, gain]) => {
          if (gain) {
            const statKey = stat as keyof FanzStats;
            newFanzStats[statKey] += Math.floor(gain * scaleFactor * xpMultiplier);
          }
        });
      }

      await updateDoc(fanzRef, {
        stats: newFanzStats,
        [`lifeActionProgress.${action.id}`]: {
          level: newActionLevel,
          xp: newActionXp
        }
      });

      // Show Alert
      const rewards: Reward[] = [];
      if (gainEnergy > 0) rewards.push({ type: 'energy', amount: gainEnergy, label: 'Énergie' });
      if (gainMoney > 0) rewards.push({ type: 'money', amount: gainMoney, label: 'Argent' });
      if (gainGems > 0) rewards.push({ type: 'gems', amount: gainGems, label: 'Gemmes' });
      if (gainBoost > 0) rewards.push({ type: 'boost', amount: gainBoost, label: 'Boost' });
      
      if (action.targetStat && gainXp > 0) {
        const xpAmount = gainXp * (isXpBoostActive ? 2 : 1);
        rewards.push({ type: 'xp', amount: xpAmount, label: `XP ${action.targetStat}${isXpBoostActive ? ' (x2)' : ''}`, stat: action.targetStat });
      }
      
      if (action.xpGains) {
        Object.entries(action.xpGains).forEach(([stat, gain]) => {
          if (gain) {
            const xpAmount = Math.floor(gain * scaleFactor * (isXpBoostActive ? 2 : 1));
            rewards.push({ type: 'xp', amount: xpAmount, label: `XP ${stat}${isXpBoostActive ? ' (x2)' : ''}`, stat });
          }
        });
      }

      showAlert({
        title: action.name,
        subtitle: hasLeveledUp ? `Niveau ${newActionLevel} débloqué !` : "Activité terminée !",
        videoUrl: resolvedVideoUrl,
        imageUrl: resolvedImage,
        rewards,
        type: hasLeveledUp ? 'level-up' : 'success'
      });

    } catch (error) {
      console.error("Erreur lors de la complétion:", error);
    }
  };

  const handleAccelerate = async () => {
    if (!isThisActionActive) return;
    if (userProfile.gems < 1) {
      showAlert({ type: 'error', title: 'Pas assez de gemmes !' });
      return;
    }
    try {
      const userRef = doc(db, 'users', userProfile.uid);
      const fanzRef = doc(db, 'fanz', fanz.id);

      const unlockedActions = userProfile.unlockedActions || [];
      const skinSpecificActionId = action.id + '-' + (fanz.equippedSkin || '000');
      let newUnlockedActions = [...unlockedActions];
      if (!newUnlockedActions.includes(skinSpecificActionId)) {
        newUnlockedActions.push(skinSpecificActionId);
      }
      if (!fanz.equippedSkin || fanz.equippedSkin === '000') {
        if (!newUnlockedActions.includes(action.id)) {
          newUnlockedActions.push(action.id);
        }
      }

      // Update User (Gems + Rewards + clear active action)
      await updateDoc(userRef, {
        gems: userProfile.gems - 1 + gainGems,
        energy: Math.min(100, userProfile.energy + gainEnergy),
        money: userProfile.money + gainMoney,
        boostPoints: (userProfile.boostPoints || 0) + gainBoost,
        activeAction: deleteField(),
        unlockedActions: newUnlockedActions
      });

      await logTransaction(userProfile.uid, 'gems', -1, `Accélération action: ${action.name}`);
      if (gainEnergy > 0) await logTransaction(userProfile.uid, 'energy', gainEnergy, `Fin action: ${action.name}`);
      if (gainMoney > 0) await logTransaction(userProfile.uid, 'money', gainMoney, `Fin action: ${action.name}`);
      if (gainGems > 0) await logTransaction(userProfile.uid, 'gems', gainGems, `Fin action: ${action.name}`);
      if (gainBoost > 0) await logTransaction(userProfile.uid, 'boost', gainBoost, `Fin action: ${action.name}`);

      await progressMission(userProfile, 'life_action', 1);

      // Update Fanz
      const newActionXp = actionProgress.xp + 10; // Fixed XP per action for leveling up the action itself
      let newActionLevel = actionProgress.level;
      const hasLeveledUp = newActionXp >= newActionLevel * 50;
      if (hasLeveledUp) {
        newActionLevel += 1;
      }

      const newFanzStats = { ...fanz.stats };
      const xpMultiplier = isXpBoostActive ? 2 : 1;
      if (action.targetStat) {
        newFanzStats[action.targetStat] += gainXp * xpMultiplier;
      }
      if (action.xpGains) {
        Object.entries(action.xpGains).forEach(([stat, gain]) => {
          if (gain) {
            const statKey = stat as keyof FanzStats;
            newFanzStats[statKey] += Math.floor(gain * scaleFactor * xpMultiplier);
          }
        });
      }

      await updateDoc(fanzRef, {
        stats: newFanzStats,
        [`lifeActionProgress.${action.id}`]: {
          level: newActionLevel,
          xp: newActionXp
        }
      });

      // Show Alert
      const rewards: Reward[] = [];
      if (gainEnergy > 0) rewards.push({ type: 'energy', amount: gainEnergy, label: 'Énergie' });
      if (gainMoney > 0) rewards.push({ type: 'money', amount: gainMoney, label: 'Argent' });
      if (gainGems > 0) rewards.push({ type: 'gems', amount: gainGems, label: 'Gemmes' });
      if (gainBoost > 0) rewards.push({ type: 'boost', amount: gainBoost, label: 'Boost' });
      
      if (action.targetStat && gainXp > 0) {
        const xpAmount = gainXp * (isXpBoostActive ? 2 : 1);
        rewards.push({ type: 'xp', amount: xpAmount, label: `XP ${action.targetStat}${isXpBoostActive ? ' (x2)' : ''}`, stat: action.targetStat });
      }
      
      if (action.xpGains) {
        Object.entries(action.xpGains).forEach(([stat, gain]) => {
          if (gain) {
            const xpAmount = Math.floor(gain * scaleFactor * (isXpBoostActive ? 2 : 1));
            rewards.push({ type: 'xp', amount: xpAmount, label: `XP ${stat}${isXpBoostActive ? ' (x2)' : ''}`, stat });
          }
        });
      }

      showAlert({
        title: action.name,
        subtitle: hasLeveledUp ? `Niveau ${newActionLevel} débloqué !` : "Accélération réussie !",
        videoUrl: resolvedVideoUrl,
        imageUrl: resolvedImage,
        rewards,
        type: hasLeveledUp ? 'level-up' : 'success'
      });

    } catch (error) {
      console.error("Erreur lors de l'accélération:", error);
    }
  };

  if (isThisActionActive) {
    return (
      <Card className="p-0 border-orange-500 relative overflow-hidden bg-black min-h-[380px] flex flex-col justify-end">
        {/* Background Image (No video when active as requested) */}
        <div className="absolute inset-0 z-0">
          {resolvedImage ? (
            <img src={getImageUrl(resolvedImage)} alt={action.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
              <Activity className="w-12 h-12 text-gray-700" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
        </div>

        <div className="absolute inset-0 bg-orange-900/10 animate-pulse z-0"></div>
        <div className="relative z-10 p-5 flex flex-col h-full justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 pr-2">
              <div className="text-orange-500 font-bold text-[10px] tracking-widest uppercase mb-1 drop-shadow-md">Activité en cours</div>
              <h4 className="text-xl font-black text-white uppercase tracking-tighter drop-shadow-md leading-tight">{action.name}</h4>
              <div className="flex items-center gap-1 text-orange-500 mb-1 drop-shadow-md">
                <Star className="w-3 h-3 fill-current" />
                <span className="font-black text-[10px] uppercase">Niveau {currentLevel}</span>
                {currentLevel > 1 && (
                  <span className="font-black text-[9px] text-green-400 uppercase bg-black/50 px-1.5 py-0.5 rounded ml-1 border border-green-500/30">
                    +{Math.round((scaleFactor - 1) * 100)}% Bonus
                  </span>
                )}
              </div>
              <div className="w-full sm:w-32 bg-black/80 rounded-lg p-1 border border-white/10 shadow-lg">
                <div className="text-[10px] text-blue-400 font-black uppercase text-center mb-0.5 tracking-widest leading-none">XP Action</div>
                <div className="w-full h-2 bg-gray-900 rounded-full overflow-hidden relative" title={`${(actionProgress.xp || 0) % 50} / 50 XP`}>
                  <div 
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${((actionProgress.xp || 0) % 50) / 50 * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="w-14 h-14 rounded-full border-2 border-orange-500 flex items-center justify-center bg-black/80 backdrop-blur-md shadow-[0_0_15px_rgba(249,115,22,0.3)] shrink-0">
              <span className="font-black text-white text-[10px] tracking-widest">
                {timeLeft !== null ? formatTime(timeLeft) : '...'}
              </span>
            </div>
          </div>

          <div>
            <div className="bg-black/60 backdrop-blur-md rounded-xl p-4 mb-3 border border-white/10 text-center">
              <div className="text-xs font-black text-blue-400/80 uppercase tracking-widest mb-3">Butin prévu</div>
              <div className="flex flex-wrap items-center justify-center gap-4 text-xs sm:text-sm">
                {gainEnergy > 0 && <span className="text-yellow-500 font-black flex items-center gap-1.5"><img src={LOGOS.energy} alt="Energy" className="w-5 h-5 object-contain" /> +{gainEnergy}</span>}
                {gainMoney > 0 && <span className="text-yellow-400 font-black flex items-center gap-1.5"><img src={LOGOS.money} alt="Money" className="w-5 h-5 object-contain" /> +{gainMoney}</span>}
                {gainGems > 0 && <span className="text-pink-400 font-black flex items-center gap-1.5"><img src={LOGOS.gems} alt="Gems" className="w-5 h-5 object-contain" /> +{gainGems}</span>}
                {gainBoost > 0 && <span className="text-orange-500 font-black flex items-center gap-1.5"><img src={LOGOS.boost} alt="Boost" className="w-5 h-5 object-contain" /> +{gainBoost}</span>}
                
                {action.targetStat && gainXp > 0 && (
                  <span className="text-blue-400 font-black flex items-center gap-1.5">
                    {statIcons[action.targetStat as keyof typeof statIcons] || <Activity className="w-5 h-5" />}
                    +{gainXp}
                  </span>
                )}
                
                {action.xpGains && Object.entries(action.xpGains).map(([stat, gain]) => {
                  if (!gain) return null;
                  const scaledGain = Math.floor(gain * scaleFactor);
                  if (scaledGain <= 0) return null;
                  return (
                    <span key={stat} className="text-blue-400 font-black flex items-center gap-1.5">
                      {statIcons[stat as keyof typeof statIcons] || <Activity className="w-5 h-5" />}
                      +{scaledGain}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="bg-black/60 backdrop-blur-md rounded-xl p-3 mb-4 border border-white/10 text-center flex justify-center items-center gap-3">
              <span className="text-xs font-black text-blue-400/80 uppercase tracking-widest">Coût :</span>
              {costEnergy > 0 && <span className="text-yellow-500 font-black text-xs sm:text-sm flex items-center gap-1.5"><img src={LOGOS.energy} alt="Energy" className="w-5 h-5 object-contain" /> {costEnergy}</span>}
              {costMoney > 0 && <span className="text-yellow-400 font-black text-xs sm:text-sm flex items-center gap-1.5"><img src={LOGOS.money} alt="Money" className="w-5 h-5 object-contain" /> {costMoney}</span>}
              {costEnergy === 0 && costMoney === 0 && <span className="text-yellow-500 font-black text-xs sm:text-sm flex items-center gap-1.5"><img src={LOGOS.energy} alt="Energy" className="w-5 h-5 object-contain" /> 0</span>}
            </div>

            <div className="flex gap-3">
              <button 
                onClick={handleCancelAction}
                className="flex-1 py-3 rounded-xl border border-white/10 bg-black/60 backdrop-blur-md text-blue-200 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-white/10 hover:text-white transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Abandon
              </button>
              <button 
                onClick={handleAccelerate}
                className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20"
              >
                <FastForward className="w-4 h-4 fill-current" /> Finir (1 TOK)
              </button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`p-0 overflow-hidden relative group min-h-[380px] flex flex-col justify-end ${isAnyActionActive ? 'opacity-50 grayscale pointer-events-none' : 'cursor-pointer hover:border-orange-500 transition-colors'}`} onClick={handleStartAction}>
      {/* Background Video/Image */}
      <div className="absolute inset-0 z-0">
        {resolvedVideoUrl ? (
          <OptimizedMedia
            type="video"
            src={resolvedVideoUrl}
            poster={resolvedImage}
            dataSaver={userProfile.dataSaver}
            className="w-full h-full object-cover"
          />
        ) : resolvedImage ? (
          <OptimizedMedia
            type="image"
            src={resolvedImage}
            alt={action.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
            <Activity className="w-12 h-12 text-gray-700" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      </div>

      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1 w-24">
        <div className="bg-black/80 backdrop-blur-sm px-2 py-1 rounded-lg text-white font-black text-[10px] border border-white/10 flex items-center justify-center gap-1 shadow-lg">
          <img src={LOGOS.level} alt="Level" className="w-3 h-3 object-contain" /> NIVEAU {currentLevel}
        </div>
        <div className="w-full bg-black/80 rounded-lg p-1 border border-white/10 shadow-lg">
          <div className="text-[10px] text-blue-400 font-black uppercase text-center mb-0.5 tracking-widest leading-none">XP Action</div>
          <div className="w-full h-2 bg-gray-900 rounded-full overflow-hidden relative" title="La montée de niveau augmente les récompenses (et les coûts) de 20%">
            <div 
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${((actionProgress.xp || 0) % 50) / 50 * 100}%` }}
            />
          </div>
        </div>
      </div>
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
        <div className="bg-black/80 backdrop-blur-sm px-2.5 py-1.5 rounded-lg text-yellow-500 font-black text-xs border border-white/10 flex items-center justify-center gap-2 shadow-lg">
          <img src={LOGOS.energy} alt="Energy" className="w-5 h-5 object-contain" /> {costEnergy}
        </div>
        {costMoney > 0 && (
          <div className="bg-black/80 backdrop-blur-sm px-2.5 py-1.5 rounded-lg text-yellow-400 font-black text-xs border border-white/10 flex items-center justify-center gap-2 shadow-lg">
            <img src={LOGOS.money} alt="Money" className="w-5 h-5 object-contain" /> {costMoney}
          </div>
        )}
        <div className="bg-black/80 backdrop-blur-sm px-2.5 py-1.5 rounded-lg text-orange-500 font-black text-xs border border-white/10 flex items-center justify-center gap-2 shadow-lg">
          <Clock className="w-5 h-5" /> {action.durationMinutes >= 60 ? `${action.durationMinutes / 60}H` : `${action.durationMinutes}M`}
        </div>
      </div>

      <div className="relative z-10 p-4 flex flex-col justify-end mt-auto bg-gradient-to-t from-black/90 via-black/40 to-transparent">
        <div>
          <h4 className="font-black text-white uppercase tracking-tighter text-center text-lg mb-3 drop-shadow-md">{action.name}</h4>
          <div className="flex flex-wrap justify-center items-center gap-4 text-xs sm:text-sm font-black mb-4 drop-shadow-md">
            {gainEnergy > 0 && <span className="text-yellow-500 flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded border border-white/5"><img src={LOGOS.energy} alt="Energy" className="w-5 h-5 object-contain" /> +{gainEnergy}</span>}
            {gainMoney > 0 && <span className="text-yellow-400 flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded border border-white/5"><img src={LOGOS.money} alt="Money" className="w-5 h-5 object-contain" /> +{gainMoney}</span>}
            {gainGems > 0 && <span className="text-pink-400 flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded border border-white/5"><img src={LOGOS.gems} alt="Gems" className="w-5 h-5 object-contain" /> +{gainGems}</span>}
            {gainBoost > 0 && <span className="text-orange-500 flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded border border-white/5"><img src={LOGOS.boost} alt="Boost" className="w-5 h-5 object-contain" /> +{gainBoost}</span>}
            
            {action.targetStat && gainXp > 0 && (
              <span className="text-blue-400 flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded border border-white/5">
                {statIcons[action.targetStat as keyof typeof statIcons] || <Activity className="w-5 h-5" />}
                +{gainXp}
              </span>
            )}

            {action.xpGains && Object.entries(action.xpGains).map(([stat, gain]) => {
              if (!gain) return null;
              const scaledGain = Math.floor(gain * scaleFactor);
              if (scaledGain <= 0) return null;
              return (
                <span key={stat} className="text-blue-400 flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded border border-white/5">
                  {statIcons[stat as keyof typeof statIcons] || <Activity className="w-5 h-5" />}
                  +{scaledGain}
                </span>
              );
            })}
          </div>
        </div>
        <button 
          className="w-full py-3 rounded-xl bg-white text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors shadow-lg"
        >
          Lancer l'action
        </button>
      </div>
    </Card>
  );
}
