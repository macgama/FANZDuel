import React, { useState, useEffect } from 'react';
import { LifeAction, UserProfile, Fanz, FanzStats } from '../types';
import { Card } from './Layout';
import { Clock, Trash2, FastForward, Activity, Star, Flame, Shield, Brain, Eye, Users, Info } from 'lucide-react';
import { getImageUrl } from '../lib/utils';
import { LOGOS } from '../constants';
import { db } from '../firebase';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { logTransaction } from '../services/transactionService';
import { useAlert, Reward } from '../context/AlertContext';

interface LifeActionCardProps {
  action: LifeAction;
  fanz: Fanz;
  userProfile: UserProfile;
}

export function LifeActionCard({ action, fanz, userProfile }: LifeActionCardProps) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const { showAlert } = useAlert();

  const activeAction = userProfile.activeAction;
  const isThisActionActive = activeAction?.actionId === action.id && activeAction?.fanzId === fanz.id;
  const isAnyActionActive = !!activeAction;

  const actionProgress = fanz.lifeActionProgress?.[action.id] || { level: 1, xp: 0 };
  const currentLevel = actionProgress.level;

  // Calculate scaled costs and gains based on level
  const scaleFactor = 1 + (currentLevel - 1) * 0.2; // 20% increase per level
  const costEnergy = Math.floor((action.energyCost || 0) * scaleFactor);
  const costMoney = Math.floor((action.moneyCost || 0) * scaleFactor);
  const costGems = Math.floor((action.gemsCost || 0) * scaleFactor);
  const costBoost = Math.floor((action.boostCost || 0) * scaleFactor);
  
  const gainEnergy = Math.floor((action.energyGain || 0) * scaleFactor);
  const gainMoney = Math.floor((action.moneyGain || 0) * scaleFactor);
  const gainGems = Math.floor((action.gemsGain || 0) * scaleFactor);
  const gainBoost = Math.floor((action.boostGain || 0) * scaleFactor);
  const gainXp = Math.floor((action.xpGain || 0) * scaleFactor);

  const statIcons = {
    force: <img src={LOGOS.energy} alt="Force" className="w-4 h-4 object-contain" />,
    endurance: <Shield className="w-4 h-4 text-green-500" />,
    mental: <Brain className="w-4 h-4 text-purple-500" />,
    bluff: <Eye className="w-4 h-4 text-blue-500" />,
    creativity: <Star className="w-4 h-4 text-pink-500" />,
    social: <Users className="w-4 h-4 text-cyan-500" />,
    intelligence: <Info className="w-4 h-4 text-indigo-500" />,
    charisma: <Flame className="w-4 h-4 text-red-500" />
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
      alert("Ressources insuffisantes !");
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

      // Update User
      await updateDoc(userRef, {
        energy: Math.min(100, userProfile.energy + gainEnergy),
        money: userProfile.money + gainMoney,
        gems: (userProfile.gems || 0) + gainGems,
        boostPoints: (userProfile.boostPoints || 0) + gainBoost,
        activeAction: deleteField()
      });

      if (gainEnergy > 0) await logTransaction(userProfile.uid, 'energy', gainEnergy, `Fin action: ${action.name}`);
      if (gainMoney > 0) await logTransaction(userProfile.uid, 'money', gainMoney, `Fin action: ${action.name}`);
      if (gainGems > 0) await logTransaction(userProfile.uid, 'gems', gainGems, `Fin action: ${action.name}`);
      if (gainBoost > 0) await logTransaction(userProfile.uid, 'boost', gainBoost, `Fin action: ${action.name}`);

      // Update Fanz
      const newActionXp = actionProgress.xp + 10; // Fixed XP per action for leveling up the action itself
      let newActionLevel = actionProgress.level;
      const hasLeveledUp = newActionXp >= newActionLevel * 50;
      if (hasLeveledUp) {
        newActionLevel += 1;
      }

      const newFanzStats = { ...fanz.stats };
      if (action.targetStat) {
        newFanzStats[action.targetStat] += gainXp;
      }
      if (action.xpGains) {
        Object.entries(action.xpGains).forEach(([stat, gain]) => {
          if (gain) {
            const statKey = stat as keyof FanzStats;
            newFanzStats[statKey] += Math.floor(gain * scaleFactor);
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
        rewards.push({ type: 'xp', amount: gainXp, label: `XP ${action.targetStat}`, stat: action.targetStat });
      }
      
      if (action.xpGains) {
        Object.entries(action.xpGains).forEach(([stat, gain]) => {
          if (gain) {
            rewards.push({ type: 'xp', amount: Math.floor(gain * scaleFactor), label: `XP ${stat}`, stat });
          }
        });
      }

      showAlert({
        title: action.name,
        subtitle: hasLeveledUp ? `Niveau ${newActionLevel} débloqué !` : "Activité terminée !",
        videoUrl: action.videoUrl,
        imageUrl: action.image,
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
      alert("Pas assez de gemmes !");
      return;
    }
    try {
      const userRef = doc(db, 'users', userProfile.uid);
      const fanzRef = doc(db, 'fanz', fanz.id);

      // Update User (Gems + Rewards + clear active action)
      await updateDoc(userRef, {
        gems: userProfile.gems - 1 + gainGems,
        energy: Math.min(100, userProfile.energy + gainEnergy),
        money: userProfile.money + gainMoney,
        boostPoints: (userProfile.boostPoints || 0) + gainBoost,
        activeAction: deleteField()
      });

      await logTransaction(userProfile.uid, 'gems', -1, `Accélération action: ${action.name}`);
      if (gainEnergy > 0) await logTransaction(userProfile.uid, 'energy', gainEnergy, `Fin action: ${action.name}`);
      if (gainMoney > 0) await logTransaction(userProfile.uid, 'money', gainMoney, `Fin action: ${action.name}`);
      if (gainGems > 0) await logTransaction(userProfile.uid, 'gems', gainGems, `Fin action: ${action.name}`);
      if (gainBoost > 0) await logTransaction(userProfile.uid, 'boost', gainBoost, `Fin action: ${action.name}`);

      // Update Fanz
      const newActionXp = actionProgress.xp + 10; // Fixed XP per action for leveling up the action itself
      let newActionLevel = actionProgress.level;
      const hasLeveledUp = newActionXp >= newActionLevel * 50;
      if (hasLeveledUp) {
        newActionLevel += 1;
      }

      const newFanzStats = { ...fanz.stats };
      if (action.targetStat) {
        newFanzStats[action.targetStat] += gainXp;
      }
      if (action.xpGains) {
        Object.entries(action.xpGains).forEach(([stat, gain]) => {
          if (gain) {
            const statKey = stat as keyof FanzStats;
            newFanzStats[statKey] += Math.floor(gain * scaleFactor);
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
        rewards.push({ type: 'xp', amount: gainXp, label: `XP ${action.targetStat}`, stat: action.targetStat });
      }
      
      if (action.xpGains) {
        Object.entries(action.xpGains).forEach(([stat, gain]) => {
          if (gain) {
            rewards.push({ type: 'xp', amount: Math.floor(gain * scaleFactor), label: `XP ${stat}`, stat });
          }
        });
      }

      showAlert({
        title: action.name,
        subtitle: hasLeveledUp ? `Niveau ${newActionLevel} débloqué !` : "Accélération réussie !",
        videoUrl: action.videoUrl,
        imageUrl: action.image,
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
          {action.image ? (
            <img src={getImageUrl(action.image)} alt={action.name} className="w-full h-full object-cover" />
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
              <div className="flex items-center gap-1 text-orange-500 mt-1 drop-shadow-md">
                <Star className="w-3 h-3 fill-current" />
                <span className="font-bold text-xs">{currentLevel}</span>
              </div>
            </div>
            <div className="w-14 h-14 rounded-full border-2 border-orange-500 flex items-center justify-center bg-black/80 backdrop-blur-md shadow-[0_0_15px_rgba(249,115,22,0.3)] shrink-0">
              <span className="font-black text-white text-xs tracking-widest">
                {timeLeft !== null ? formatTime(timeLeft) : '...'}
              </span>
            </div>
          </div>

          <div>
            <div className="bg-black/60 backdrop-blur-md rounded-xl p-4 mb-3 border border-white/10 text-center">
              <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Butin prévu</div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {gainEnergy > 0 && <span className="text-yellow-500 font-black flex items-center gap-1"><img src={LOGOS.energy} alt="Energy" className="w-4 h-4 object-contain" /> +{gainEnergy}</span>}
                {gainMoney > 0 && <span className="text-yellow-400 font-black flex items-center gap-1"><img src={LOGOS.money} alt="Money" className="w-4 h-4 object-contain" /> +{gainMoney}</span>}
                {gainGems > 0 && <span className="text-pink-400 font-black flex items-center gap-1"><img src={LOGOS.gems} alt="Gems" className="w-4 h-4 object-contain" /> +{gainGems}</span>}
                {gainBoost > 0 && <span className="text-orange-500 font-black flex items-center gap-1"><img src={LOGOS.boost} alt="Boost" className="w-4 h-4 object-contain" /> +{gainBoost}</span>}
                
                {action.targetStat && gainXp > 0 && (
                  <span className="text-blue-400 font-black flex items-center gap-1">
                    {statIcons[action.targetStat as keyof typeof statIcons] || <Activity className="w-4 h-4" />}
                    +{gainXp}
                  </span>
                )}
                
                {action.xpGains && Object.entries(action.xpGains).map(([stat, gain]) => {
                  if (!gain) return null;
                  const scaledGain = Math.floor(gain * scaleFactor);
                  if (scaledGain <= 0) return null;
                  return (
                    <span key={stat} className="text-blue-400 font-black flex items-center gap-1">
                      {statIcons[stat as keyof typeof statIcons] || <Activity className="w-4 h-4" />}
                      +{scaledGain}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="bg-black/60 backdrop-blur-md rounded-xl p-3 mb-4 border border-white/10 text-center flex justify-center items-center gap-2">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Coût :</span>
              {costEnergy > 0 && <span className="text-yellow-500 font-black text-sm flex items-center gap-1"><img src={LOGOS.energy} alt="Energy" className="w-4 h-4 object-contain" /> {costEnergy}</span>}
              {costMoney > 0 && <span className="text-yellow-400 font-black text-sm flex items-center gap-1"><img src={LOGOS.money} alt="Money" className="w-4 h-4 object-contain" /> {costMoney}</span>}
              {costEnergy === 0 && costMoney === 0 && <span className="text-yellow-500 font-black text-sm flex items-center gap-1"><img src={LOGOS.energy} alt="Energy" className="w-4 h-4 object-contain" /> 0</span>}
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
        {action.videoUrl ? (
          <video 
            key={getImageUrl(action.videoUrl)}
            src={getImageUrl(action.videoUrl)}
            poster={getImageUrl(action.image)}
            autoPlay 
            loop 
            muted 
            playsInline 
            className="w-full h-full object-cover" 
          />
        ) : action.image ? (
          <img src={getImageUrl(action.image)} alt={action.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
            <Activity className="w-12 h-12 text-gray-700" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      </div>

      <div className="absolute top-3 left-3 z-10 bg-black/80 backdrop-blur-sm px-3 py-1.5 rounded-lg text-white font-black text-sm border border-white/10 flex items-center gap-1">
        <img src={LOGOS.level} alt="Level" className="w-4 h-4 object-contain" /> L.{currentLevel}
      </div>
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
        <div className="bg-black/80 backdrop-blur-sm px-3 py-1.5 rounded-lg text-yellow-500 font-black text-sm border border-white/10 flex items-center gap-2">
          <img src={LOGOS.energy} alt="Energy" className="w-4 h-4 object-contain" /> {costEnergy}
        </div>
        <div className="bg-black/80 backdrop-blur-sm px-3 py-1.5 rounded-lg text-orange-500 font-black text-sm border border-white/10 flex items-center gap-2">
          <Clock className="w-4 h-4" /> {action.durationMinutes >= 60 ? `${action.durationMinutes / 60}H` : `${action.durationMinutes}M`}
        </div>
      </div>

      <div className="relative z-10 p-4 flex flex-col justify-end mt-auto">
        <div>
          <h4 className="font-black text-white uppercase tracking-tighter text-center text-lg mb-2 drop-shadow-md">{action.name}</h4>
          <div className="flex flex-wrap justify-center items-center gap-3 text-sm font-black mb-4 drop-shadow-md">
            {gainEnergy > 0 && <span className="text-yellow-500 flex items-center gap-1"><img src={LOGOS.energy} alt="Energy" className="w-4 h-4 object-contain" /> +{gainEnergy}</span>}
            {gainMoney > 0 && <span className="text-yellow-400 flex items-center gap-1"><img src={LOGOS.money} alt="Money" className="w-4 h-4 object-contain" /> +{gainMoney}</span>}
            {gainGems > 0 && <span className="text-pink-400 flex items-center gap-1"><img src={LOGOS.gems} alt="Gems" className="w-4 h-4 object-contain" /> +{gainGems}</span>}
            {gainBoost > 0 && <span className="text-orange-500 flex items-center gap-1"><img src={LOGOS.boost} alt="Boost" className="w-4 h-4 object-contain" /> +{gainBoost}</span>}
            
            {action.targetStat && gainXp > 0 && (
              <span className="text-blue-400 flex items-center gap-1">
                {statIcons[action.targetStat as keyof typeof statIcons] || <Activity className="w-4 h-4" />}
                +{gainXp}
              </span>
            )}

            {action.xpGains && Object.entries(action.xpGains).map(([stat, gain]) => {
              if (!gain) return null;
              const scaledGain = Math.floor(gain * scaleFactor);
              if (scaledGain <= 0) return null;
              return (
                <span key={stat} className="text-blue-400 flex items-center gap-1">
                  {statIcons[stat as keyof typeof statIcons] || <Activity className="w-4 h-4" />}
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
