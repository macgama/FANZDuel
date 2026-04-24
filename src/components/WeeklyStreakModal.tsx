import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, getDocs, doc, updateDoc, increment, arrayUnion, query, where } from 'firebase/firestore';
import { logTransaction } from '../services/transactionService';
import { WeeklyStreakConfig, UserProfile, WeeklyStreakCycle, Card, FanzSkin, FanzEmote, LifeAction } from '../types';
import { useReward } from '../context/RewardContext';
import { Gift, CheckCircle2, Lock, Star, Sparkles, X, Shield, Smile, Activity, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LOGOS } from '../constants';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

interface WeeklyStreakModalProps {
  profile: UserProfile;
  onClose: () => void;
}

export const WeeklyStreakModal: React.FC<WeeklyStreakModalProps> = ({ profile, onClose }) => {
  const { showReward } = useReward();
  const [configs, setConfigs] = useState<WeeklyStreakConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const message = error instanceof Error ? error.message : String(error);
    const errInfo: FirestoreErrorInfo = {
      error: message,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    setError("Erreur de permission ou de connexion. Veuillez réessayer.");
  };

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const q = query(collection(db, 'weekly_streak_cycles'), where('isActive', '==', true));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const activeCycle = querySnapshot.docs[0].data() as WeeklyStreakCycle;
          setConfigs(activeCycle.days.sort((a, b) => a.day - b.day));
        } else {
          setConfigs([]);
        }
      } catch (error) {
        console.error('Error fetching streak configs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConfigs();
  }, []);

  const currentDay = profile.streak || 1;
  const isAlreadyClaimed = profile.claimedStreakDays?.includes(currentDay);

  const handleClaim = async () => {
    if (isAlreadyClaimed || claiming) return;
    setClaiming(true);

    const userId = profile.uid || auth.currentUser?.uid;
    if (!userId) {
      console.error('No user ID found');
      setClaiming(false);
      return;
    }

    try {
      const config = configs.find(c => c.day === currentDay);
      if (!config) {
        setError("Aucune récompense configurée pour ce jour.");
        setClaiming(false);
        return;
      }

      const userRef = doc(db, 'users', userId);
      const updates: any = {
        claimedStreakDays: arrayUnion(currentDay),
        lastLoginDate: new Date().toISOString().split('T')[0]
      };

      let cardToCreate = null;

      // Apply rewards
      if (config.reward) {
        switch (config.reward.type) {
          case 'money':
            updates.money = increment(config.reward.amount || 0);
            break;
          case 'gems':
            updates.gems = increment(config.reward.amount || 0);
            break;
          case 'boost':
            updates.boostPoints = increment(config.reward.amount || 0);
            break;
          case 'energy':
            updates.energy = Math.min(100, profile.energy + (config.reward.amount || 0));
            break;
          case 'card':
            if (config.reward.cardId) {
              updates.cards = arrayUnion(config.reward.cardId);
              cardToCreate = config.reward.cardId;
            }
            break;
          case 'skin':
            if (config.reward.skinId) updates.skins = arrayUnion(config.reward.skinId);
            break;
          case 'emote':
            if (config.reward.emoteId) updates.emotes = arrayUnion(config.reward.emoteId);
            break;
          case 'xp':
            // TODO: Implement XP distribution logic
            break;
          case 'action':
            if (config.reward.actionId) updates.unlockedActions = arrayUnion(config.reward.actionId);
            break;
        }
      }

      await updateDoc(userRef, updates);

      if (config.reward) {
        const amount = config.reward.amount || 0;
        if (amount > 0) {
          switch (config.reward.type) {
            case 'money':
              await logTransaction(userId, 'money', amount, `Récompense journalière (Jour ${currentDay})`);
              break;
            case 'gems':
              await logTransaction(userId, 'gems', amount, `Récompense journalière (Jour ${currentDay})`);
              break;
            case 'boost':
              await logTransaction(userId, 'boost', amount, `Récompense journalière (Jour ${currentDay})`);
              break;
            case 'energy':
              await logTransaction(userId, 'energy', amount, `Récompense journalière (Jour ${currentDay})`);
              break;
          }
        }
      }
      
      if (config.reward) {
        const reward = config.reward;
        let rewardData: any = {
          type: reward.type,
          amount: reward.amount || 1
        };

        if (reward.type === 'card' && reward.cardId) {
          const cardsSnap = await getDocs(collection(db, 'cards'));
          const cardData = cardsSnap.docs.find(d => d.id === reward.cardId)?.data() as Card;
          if (cardData) rewardData.card = cardData;
        } else if (reward.type === 'skin' && reward.skinId) {
          const skinsSnap = await getDocs(collection(db, 'skins'));
          const skinData = skinsSnap.docs.find(d => d.id === reward.skinId)?.data() as FanzSkin;
          if (skinData) rewardData.skin = skinData;
        } else if (reward.type === 'emote' && reward.emoteId) {
          const emotesSnap = await getDocs(collection(db, 'emotes'));
          const emoteData = emotesSnap.docs.find(d => d.id === reward.emoteId)?.data() as FanzEmote;
          if (emoteData) rewardData.emote = emoteData;
        } else if (reward.type === 'action' && reward.actionId) {
          const actionsSnap = await getDocs(collection(db, 'life_actions'));
          const actionData = actionsSnap.docs.find(d => d.id === reward.actionId)?.data() as LifeAction;
          if (actionData) rewardData.action = actionData;
        }

        showReward(rewardData);
      }

      // Close modal after a short delay to show success
      setTimeout(onClose, 1500);
    } catch (error) {
      setClaiming(false);
      handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
    }
  };

  if (loading) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-gray-900 border border-gray-800 rounded-2xl w-full lg:max-w-[450px] h-full max-h-[85vh] overflow-hidden shadow-2xl relative flex flex-col"
      >
        {/* Header */}
        <div className="relative shrink-0 h-32 bg-gradient-to-br from-orange-600 to-red-700 flex items-center justify-center overflow-hidden">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 rounded-full text-white transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
          </div>
          <div className="relative text-center">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 4 }}
            >
              <Gift className="w-12 h-12 text-white mx-auto mb-2" />
            </motion.div>
            <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">Série Hebdomadaire</h2>
            <p className="text-orange-100 text-sm font-medium">Connectez-vous chaque jour pour des bonus exclusifs !</p>
          </div>
        </div>

        <div className="p-6 overflow-y-auto no-scrollbar flex-1">
          {/* Days Grid */}
          {configs.length === 0 ? (
            <div className="text-center py-8 text-gray-500 italic">
              Aucune récompense configurée pour le moment.
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              {configs.map((config) => {
                const isPast = config.day < currentDay;
                const isCurrent = config.day === currentDay;
                const isFuture = config.day > currentDay;
                const claimed = profile.claimedStreakDays?.includes(config.day);

                return (
                  <div 
                    key={config.day}
                    className={`w-[calc(33.333%-8px)] sm:w-[calc(25%-9px)] relative flex flex-col items-center p-3 rounded-xl border transition-all ${
                      isCurrent 
                        ? 'bg-orange-500/10 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.2)]' 
                        : claimed || isPast
                        ? 'bg-gray-800/50 border-gray-700 opacity-60'
                        : 'bg-gray-800/30 border-gray-800'
                    }`}
                  >
                    <span className="text-[10px] font-bold text-gray-400 uppercase mb-2">Jour {config.day}</span>
                    
                    <div className="mb-2">
                      {config.reward.type === 'money' && <img src={LOGOS.money} alt="Money" className={`w-6 h-6 object-contain ${isCurrent ? '' : 'grayscale opacity-50'}`} />}
                      {config.reward.type === 'gems' && <img src={LOGOS.gems} alt="Gems" className={`w-6 h-6 object-contain ${isCurrent ? '' : 'grayscale opacity-50'}`} />}
                      {config.reward.type === 'boost' && <img src={LOGOS.boost} alt="Boost" className={`w-6 h-6 object-contain ${isCurrent ? '' : 'grayscale opacity-50'}`} />}
                      {config.reward.type === 'energy' && <img src={LOGOS.energy} alt="Energy" className={`w-6 h-6 object-contain ${isCurrent ? '' : 'grayscale opacity-50'}`} />}
                      {config.reward.type === 'xp' && <Star className={`w-6 h-6 ${isCurrent ? 'text-purple-400' : 'text-gray-500'}`} />}
                      {config.reward.type === 'card' && <Layers className={`w-6 h-6 ${isCurrent ? 'text-indigo-400' : 'text-gray-500'}`} />}
                      {config.reward.type === 'skin' && <Shield className={`w-6 h-6 ${isCurrent ? 'text-pink-400' : 'text-gray-500'}`} />}
                      {config.reward.type === 'emote' && <Smile className={`w-6 h-6 ${isCurrent ? 'text-yellow-300' : 'text-gray-500'}`} />}
                      {config.reward.type === 'action' && <Activity className={`w-6 h-6 ${isCurrent ? 'text-red-400' : 'text-gray-500'}`} />}
                    </div>

                    <span className={`text-xs font-black text-center ${isCurrent ? 'text-white' : 'text-gray-400'}`}>
                      {['money', 'gems', 'boost', 'energy', 'xp'].includes(config.reward.type) 
                        ? config.reward.amount 
                        : config.reward.type === 'card' ? 'Carte'
                        : config.reward.type === 'skin' ? 'Skin'
                        : config.reward.type === 'emote' ? 'Emote'
                        : config.reward.type === 'action' ? 'Action'
                        : ''}
                    </span>

                    {claimed && (
                      <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-0.5 shadow-lg">
                        <CheckCircle2 className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Action Area */}
          <div className="flex flex-col items-center gap-4">
            {error && (
              <p className="text-red-500 text-sm font-bold bg-red-500/10 p-3 rounded-lg border border-red-500/20 w-full text-center">
                {error}
              </p>
            )}
            {isAlreadyClaimed ? (
              <div className="text-center">
                <p className="text-green-400 font-bold flex items-center justify-center gap-2 mb-1">
                  <CheckCircle2 className="w-5 h-5" />
                  Récompense récupérée !
                </p>
                <p className="text-gray-500 text-sm italic">Revenez demain pour le jour {currentDay + 1}</p>
                <button 
                  onClick={onClose}
                  className="mt-6 px-8 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-black uppercase italic tracking-wider transition-all"
                >
                  Continuer
                </button>
              </div>
            ) : (
              <div className="w-full">
                <button
                  onClick={handleClaim}
                  disabled={claiming || configs.length === 0}
                  className="w-full py-4 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white rounded-xl font-black uppercase italic tracking-widest shadow-xl shadow-orange-900/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {claiming ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-6 h-6" />
                      Récupérer mon gain
                      <Sparkles className="w-6 h-6" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="bg-gray-950/50 p-4 border-t border-gray-800 text-center">
          <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold">
            Série actuelle : <span className="text-orange-500">{currentDay} jours consécutifs</span>
          </p>
        </div>
      </motion.div>
    </div>
  );
};
