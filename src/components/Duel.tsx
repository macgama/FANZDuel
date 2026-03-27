import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Duel, UserProfile, Card as GameCard, CardEffect, UserCard, Fanz, FanzTemplate } from '../types';
import { Card, Button } from './Layout';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Swords, ChevronLeft, EyeOff, Ghost, Minimize2, Move, ChevronUp, Shield, RefreshCw, Activity, Lock } from 'lucide-react';
import { BASE_CARDS } from '../constants/cards';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, updateDoc, setDoc, collection, getDocs, increment } from 'firebase/firestore';

export function DuelScreen({ duel, user, onExit, fanzId }: { duel: Duel; user: UserProfile; onExit: () => void, fanzId?: string }) {
  const [progress, setProgress] = useState(50);
  const [energy, setEnergy] = useState(100);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [winner, setWinner] = useState<string | null>(null);
  const [hand, setHand] = useState<GameCard[]>([]);
  const [userCards, setUserCards] = useState<Record<string, UserCard>>({});
  const [allCards, setAllCards] = useState<GameCard[]>([]);
  const [fanz, setFanz] = useState<Fanz | null>(null);

  // Visual Effects State
  const [isBlurred, setIsBlurred] = useState(false);
  const [isButtonHidden, setIsButtonHidden] = useState(false);
  const [isButtonShrunk, setIsButtonShrunk] = useState(false);
  const [isButtonMoving, setIsButtonMoving] = useState(false);
  const [isScoreHidden, setIsScoreHidden] = useState(false);
  const [isDoublePoints, setIsDoublePoints] = useState(false);
  const [hasShield, setHasShield] = useState(false);
  const [hasMirror, setHasMirror] = useState(false);
  const [isEnergyRegenBoosted, setIsEnergyRegenBoosted] = useState(false);

  const fanzRank = fanz?.rank || 1;
  const rankBonus = (fanzRank - 1) * 0.02; // 2% per rank above 1
  const multiplier = 1 + rankBonus;
  const [isEarthquake, setIsEarthquake] = useState(false);
  const [isFakeButtons, setIsFakeButtons] = useState(false);
  const [isCardLocked, setIsCardLocked] = useState(false);
  const [lastEnemyCard, setLastEnemyCard] = useState<GameCard | null>(null);
  const [buttonPosition, setButtonPosition] = useState({ x: 0, y: 0 });

  // Initialize hand and fetch fanz/user cards
  useEffect(() => {
    const initDuel = async () => {
      let cardsToUse = [...BASE_CARDS];
      
      try {
        const cardsSnap = await getDocs(collection(db, 'cards'));
        const fetchedCards = cardsSnap.docs.map(d => ({ id: d.id, ...d.data() } as GameCard));
        const initialCards = fetchedCards.length > 0 ? fetchedCards : BASE_CARDS;
        
        if (fanzId) {
          const fanzSnap = await getDoc(doc(db, 'fanz', fanzId));
          if (fanzSnap.exists()) {
            const fanzData = fanzSnap.data() as Fanz;
            setFanz(fanzData);
            
            // Filter all available cards for this Fanz template
            const fanzAvailableCards = initialCards.filter(c => 
              !c.fanzIds || c.fanzIds.length === 0 || c.fanzIds.includes(fanzData.templateId)
            );
            setAllCards(fanzAvailableCards);

            if (fanzData.equippedCards && fanzData.equippedCards.length > 0) {
              cardsToUse = fanzAvailableCards.filter(c => fanzData.equippedCards?.includes(c.id));
            } else {
              cardsToUse = fanzAvailableCards;
            }
          } else {
            setAllCards(initialCards);
            cardsToUse = initialCards;
          }

          const userCardsSnap = await getDocs(collection(db, 'users', user.uid, 'user_cards'));
          const ucData: Record<string, UserCard> = {};
          userCardsSnap.docs.forEach(d => ucData[d.id] = d.data() as UserCard);
          setUserCards(ucData);
        }
      } catch (err) {
        console.error("Error initializing duel data", err);
      }

      const shuffled = [...cardsToUse].sort(() => Math.random() - 0.5);
      setHand(shuffled.slice(0, 4));
    };

    initDuel();
  }, [fanzId, user.uid]);

  const drawCard = () => {
    setHand(prev => {
      if (prev.length >= 4) return prev;
      let cardsToUse = allCards.length > 0 ? [...allCards] : [...BASE_CARDS];
      if (fanz?.equippedCards && fanz.equippedCards.length > 0) {
        cardsToUse = cardsToUse.filter(c => fanz.equippedCards?.includes(c.id));
      }
      const available = cardsToUse.filter(c => !prev.find(p => p.id === c.id));
      if (available.length === 0) return prev;
      const next = available[Math.floor(Math.random() * available.length)];
      return [...prev, next];
    });
  };

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.emit('join-duel', duel.id);

    newSocket.on('duel-update', (state: { progress: number }) => {
      setProgress(state.progress);
    });

    newSocket.on('duel-finished', async ({ winner }: { winner: string }) => {
      setWinner(winner);
      
      if (winner === 'A' && fanzId) {
        try {
          const fanzRef = doc(db, 'fanz', fanzId);
          const fanzSnap = await getDoc(fanzRef);
          if (fanzSnap.exists()) {
            const fanzData = fanzSnap.data() as Fanz;
            const tplSnap = await getDoc(doc(db, 'fanz_templates', fanzData.templateId));
            const template = tplSnap.exists() ? tplSnap.data() as FanzTemplate : null;
            
            // Base gain + rank bonus (2% per rank)
            const rankBonus = 1 + ((fanzData.rank || 1) - 1) * 0.02;
            const ferveurGain = Math.round(10 * rankBonus);
            
            let newPoints = (fanzData.ferveurPoints || 0) + ferveurGain;
            let newLevel = fanzData.ferveurLevel || 1;
            
            if (template?.ferveurPath) {
              // Check if we reached a new level
              const nextLevel = template.ferveurPath.find(p => p.level === newLevel + 1);
              if (nextLevel && newPoints >= nextLevel.pointsRequired) {
                newLevel += 1;
              }
            }

            // Handle recurring rewards
            if (template?.recurringReward) {
              const pointsPerReward = template.recurringReward.points;
              const oldRewardsCount = Math.floor((fanzData.ferveurPoints || 0) / pointsPerReward);
              const newRewardsCount = Math.floor(newPoints / pointsPerReward);

              if (newRewardsCount > oldRewardsCount) {
                const rewardAmount = (newRewardsCount - oldRewardsCount) * template.recurringReward.amount;
                const userRef = doc(db, 'users', fanzData.ownerUid);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                  const userData = userSnap.data();
                  if (template.recurringReward.type === 'money') {
                    await updateDoc(userRef, { money: (userData.money || 0) + rewardAmount });
                  } else if (template.recurringReward.type === 'boost') {
                    await updateDoc(userRef, { boostPoints: (userData.boostPoints || 0) + rewardAmount });
                  }
                }
              }
            }
            
            await updateDoc(fanzRef, {
              ferveurPoints: newPoints,
              ferveurLevel: newLevel
            });
            
            setFanz(prev => prev ? { ...prev, ferveurPoints: newPoints, ferveurLevel: newLevel } : null);
          }
        } catch (e) {
          console.error("Error updating ferveur", e);
        }
      }
    });

    newSocket.on('enemy-card-played', ({ card }: { team: string, card: GameCard }) => {
      setLastEnemyCard(card);

      const isMalus = card.effects.some(e => 
        ['drain_energy', 'hide_button', 'shrink_button', 'move_button', 'blur_view', 'hide_score', 'discard_enemy_cards', 'shuffle_deck', 'freeze_button', 'earthquake', 'fake_buttons', 'card_lock'].includes(e.type)
      );

      if (isMalus) {
        if (hasMirror) {
          setHasMirror(false);
          socket?.emit('play-card', { duelId: duel.id, team: 'A', card, reflected: true });
          return;
        }
        if (hasShield) {
          setHasShield(false);
          return;
        }
      }

      card.effects.forEach((effect: CardEffect) => {
        switch (effect.type) {
          case 'blur_view':
            setIsBlurred(true);
            setTimeout(() => setIsBlurred(false), (effect.duration || 5) * 1000);
            break;
          case 'hide_button':
            setIsButtonHidden(true);
            setTimeout(() => setIsButtonHidden(false), (effect.duration || 4) * 1000);
            break;
          case 'shrink_button':
            setIsButtonShrunk(true);
            setTimeout(() => setIsButtonShrunk(false), (effect.duration || 6) * 1000);
            break;
          case 'move_button':
            setIsButtonMoving(true);
            setTimeout(() => setIsButtonMoving(false), (effect.duration || 8) * 1000);
            break;
          case 'hide_score':
            setIsScoreHidden(true);
            setTimeout(() => setIsScoreHidden(false), (effect.duration || 7) * 1000);
            break;
          case 'drain_energy':
            setEnergy(prev => Math.max(0, prev - (effect.value || 0)));
            break;
          case 'discard_enemy_cards':
            setHand(prev => prev.slice(1));
            setTimeout(drawCard, 2000);
            break;
          case 'shuffle_deck':
            setHand(prev => [...prev].sort(() => Math.random() - 0.5));
            break;
          case 'freeze_button':
            setIsButtonHidden(true);
            setTimeout(() => setIsButtonHidden(false), (effect.duration || 3) * 1000);
            break;
          case 'earthquake':
            setIsEarthquake(true);
            setTimeout(() => setIsEarthquake(false), (effect.duration || 3) * 1000);
            break;
          case 'fake_buttons':
            setIsFakeButtons(true);
            setTimeout(() => setIsFakeButtons(false), (effect.duration || 5) * 1000);
            break;
          case 'card_lock':
            setIsCardLocked(true);
            setTimeout(() => setIsCardLocked(false), (effect.duration || 5) * 1000);
            break;
        }
      });
    });

    return () => {
      newSocket.disconnect();
    };
  }, [duel.id]);

  const handleAction = () => {
    if (winner || isButtonHidden) return;
    socket?.emit('click-ferveur', { duelId: duel.id, team: 'A', multiplier });
    if (isDoublePoints) {
      socket?.emit('click-ferveur', { duelId: duel.id, team: 'A', multiplier });
    }
  };

  const playCard = async (card: GameCard) => {
    if (winner || energy < card.energyCost || isCardLocked) return;
    
    // Remove from hand
    setHand(prev => prev.filter(c => c.id !== card.id));
    setTimeout(drawCard, 3000); // Draw new card after 3s

    setEnergy(prev => prev - card.energyCost);
    
    // XP Gain and Leveling
    try {
      const cardRef = doc(db, 'users', user.uid, 'user_cards', card.id);
      const cardSnap = await getDoc(cardRef);
      let currentLevel = 1;
      let currentXp = 0;

      if (cardSnap.exists()) {
        const data = cardSnap.data() as UserCard;
        currentLevel = data.level;
        currentXp = data.xp + 1;
        const xpForNextLevel = currentLevel * 10;

        if (currentXp >= xpForNextLevel && currentLevel < 5) {
          await updateDoc(cardRef, {
            xp: 0,
            level: increment(1)
          });
          currentLevel += 1;
          currentXp = 0;
          // Update local state
          setUserCards(prev => ({ ...prev, [card.id]: { ...data, level: currentLevel, xp: 0 } }));
        } else {
          await updateDoc(cardRef, {
            xp: increment(1)
          });
          // Update local state
          setUserCards(prev => ({ ...prev, [card.id]: { ...data, xp: currentXp } }));
        }
      } else {
        const newCardData = {
          id: card.id,
          ownerUid: user.uid,
          level: 1,
          xp: 1
        };
        await setDoc(cardRef, newCardData);
        setUserCards(prev => ({ ...prev, [card.id]: newCardData }));
      }

      // Apply level bonus to effects
      const levelBonus = 1 + (currentLevel - 1) * 0.2; // 20% per level
      const boostedCard = {
        ...card,
        effects: card.effects.map(e => ({
          ...e,
          value: e.value ? Math.round(e.value * levelBonus) : e.value,
          duration: e.duration ? Math.round(e.duration * levelBonus) : e.duration
        }))
      };

      // Apply self-effects immediately
      boostedCard.effects.forEach(effect => {
        if (effect.type === 'refill_energy') {
          setEnergy(prev => Math.min(100, prev + (effect.value || 0)));
        }
        if (effect.type === 'double_points') {
          setIsDoublePoints(true);
          setTimeout(() => setIsDoublePoints(false), (effect.duration || 5) * 1000);
        }
        if (effect.type === 'shield') {
          setHasShield(true);
        }
        if (effect.type === 'mirror') {
          setHasMirror(true);
        }
        if (effect.type === 'energy_regen_boost') {
          setIsEnergyRegenBoosted(true);
          setTimeout(() => setIsEnergyRegenBoosted(false), (effect.duration || 10) * 1000);
        }
        if (effect.type === 'lucky_draw') {
          const legendaryCards = allCards.filter(c => c.rarity === 'legendary');
          if (legendaryCards.length > 0) {
            const randomLegendary = legendaryCards[Math.floor(Math.random() * legendaryCards.length)];
            setHand(prev => {
              const newHand = [...prev];
              const index = Math.floor(Math.random() * newHand.length);
              newHand[index] = { ...randomLegendary, instanceId: Math.random().toString(36).substr(2, 9) };
              return newHand;
            });
          }
        }
        if (effect.type === 'mimic') {
          if (lastEnemyCard) {
            setHand(prev => [...prev, { ...lastEnemyCard, instanceId: Math.random().toString(36).substr(2, 9) }]);
          }
        }
        if (effect.type === 'swap_hands') {
          // This would ideally be handled by the server to get the actual enemy hand
          // For now, let's just shuffle our own hand as a placeholder or wait for server implementation
          setHand(prev => [...prev].sort(() => Math.random() - 0.5));
        }
      });

      socket?.emit('play-card', { duelId: duel.id, team: 'A', card: boostedCard });
    } catch (err) {
      console.error("Error playing card and updating XP", err);
    }
  };

  // Energy regeneration
  useEffect(() => {
    const interval = setInterval(() => {
      const regenAmount = isEnergyRegenBoosted ? 4 : 2;
      setEnergy(prev => Math.min(100, prev + regenAmount));
    }, 1000);
    return () => clearInterval(interval);
  }, [isEnergyRegenBoosted]);

  // Button movement effect
  useEffect(() => {
    if (!isButtonMoving) {
      setButtonPosition({ x: 0, y: 0 });
      return;
    }
    const interval = setInterval(() => {
      setButtonPosition({
        x: (Math.random() - 0.5) * 200,
        y: (Math.random() - 0.5) * 200
      });
    }, 500);
    return () => clearInterval(interval);
  }, [isButtonMoving]);

  return (
    <div className={`fixed inset-0 bg-black z-50 flex flex-col p-4 transition-all duration-500 ${isBlurred ? 'blur-xl' : ''} ${isEarthquake ? 'animate-bounce' : ''}`}>
      <div className="flex justify-between items-center mb-8">
        <button onClick={onExit} className="p-2 hover:bg-white/10 rounded-full">
          <ChevronLeft />
        </button>
        <div className={`text-center transition-opacity duration-500 ${isScoreHidden ? 'opacity-0' : 'opacity-100'}`}>
          <h2 className="text-xl font-black italic uppercase tracking-tighter">{duel.type.replace('_', ' ')}</h2>
          <p className="text-xs text-gray-500">{duel.teamA} vs {duel.teamB}</p>
        </div>
        <div className="flex items-center gap-2 bg-orange-600/20 px-3 py-1 rounded-full border border-orange-500">
          <Zap size={16} className="text-orange-500" />
          <span className="font-black">{energy}</span>
        </div>
      </div>

      {/* Tug of War */}
      <div className="flex-1 flex flex-col justify-center items-center gap-12">
        <div className={`w-full max-w-2xl relative h-8 bg-white/10 rounded-full border-2 border-white/20 overflow-hidden transition-opacity duration-500 ${isScoreHidden ? 'opacity-0' : 'opacity-100'}`}>
          {/* Center line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-white/50 z-10" />
          
          {/* Progress bar */}
          <motion.div 
            animate={{ width: `${progress}%` }}
            className="h-full bg-orange-600 shadow-[0_0_20px_rgba(255,102,0,0.5)]"
          />

          {/* Rope indicator */}
          <motion.div 
            animate={{ left: `${progress}%` }}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-12 h-12 bg-white rounded-full flex items-center justify-center border-4 border-orange-500 z-20"
          >
            <Swords className="text-orange-600" size={24} />
          </motion.div>
        </div>

        <div className={`flex justify-between w-full max-w-2xl text-4xl font-black italic uppercase transition-opacity duration-500 ${isScoreHidden ? 'opacity-0' : 'opacity-100'}`}>
          <span className={progress > 50 ? 'text-orange-500' : 'text-white/20'}>{duel.teamA}</span>
          <span className={progress < 50 ? 'text-orange-500' : 'text-white/20'}>{duel.teamB}</span>
        </div>

        <AnimatePresence>
          {winner && (
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-6xl font-black italic uppercase text-orange-500 text-center"
            >
              {winner === 'A' ? 'Victoire !' : 'Défaite'}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative">
          <motion.button 
            onClick={handleAction}
            disabled={!!winner}
            animate={{ 
              x: buttonPosition.x, 
              y: buttonPosition.y,
              scale: isButtonShrunk ? 0.5 : isButtonHidden ? 0 : 1,
              opacity: isButtonHidden ? 0 : 1
            }}
            className="w-48 h-48 rounded-full bg-orange-600 hover:bg-orange-700 border-8 border-white/10 shadow-2xl flex flex-col items-center justify-center transition-transform active:scale-90 disabled:opacity-50 relative z-10"
          >
            <span className="font-black italic text-2xl uppercase">Cliquer</span>
            <span className="text-xs uppercase font-bold opacity-70">Ferveur +0.5%</span>
          </motion.button>

          {isFakeButtons && (
            <>
              <motion.button 
                initial={{ x: -100, y: -100, opacity: 0 }}
                animate={{ x: -150, y: -100, opacity: 0.8 }}
                className="absolute w-32 h-32 rounded-full bg-orange-600/50 border-4 border-white/10 flex items-center justify-center z-0"
              >
                <span className="font-black italic text-xs uppercase">Cliquer</span>
              </motion.button>
              <motion.button 
                initial={{ x: 100, y: 100, opacity: 0 }}
                animate={{ x: 150, y: 100, opacity: 0.8 }}
                className="absolute w-32 h-32 rounded-full bg-orange-600/50 border-4 border-white/10 flex items-center justify-center z-0"
              >
                <span className="font-black italic text-xs uppercase">Cliquer</span>
              </motion.button>
            </>
          )}
        </div>
      </div>

      {/* Status Indicators */}
      <div className="flex flex-wrap justify-center gap-4 mb-4">
        {isBlurred && <div className="flex items-center gap-1 text-xs font-bold text-gray-400 uppercase"><EyeOff size={14} /> Vue Troublée</div>}
        {isButtonHidden && <div className="flex items-center gap-1 text-xs font-bold text-gray-400 uppercase"><Ghost size={14} /> Bouton Invisible</div>}
        {isButtonShrunk && <div className="flex items-center gap-1 text-xs font-bold text-gray-400 uppercase"><Minimize2 size={14} /> Bouton Réduit</div>}
        {isButtonMoving && <div className="flex items-center gap-1 text-xs font-bold text-gray-400 uppercase"><Move size={14} /> Bouton Fou</div>}
        {isDoublePoints && <div className="flex items-center gap-1 text-xs font-bold text-orange-500 uppercase"><Zap size={14} /> Double Ferveur</div>}
        {hasShield && <div className="flex items-center gap-1 text-xs font-bold text-blue-500 uppercase"><Shield size={14} /> Bouclier Actif</div>}
        {hasMirror && <div className="flex items-center gap-1 text-xs font-bold text-purple-500 uppercase"><RefreshCw size={14} /> Miroir Actif</div>}
        {isEnergyRegenBoosted && <div className="flex items-center gap-1 text-xs font-bold text-yellow-500 uppercase"><Zap size={14} /> Regen Boost</div>}
        {isEarthquake && <div className="flex items-center gap-1 text-xs font-bold text-red-500 uppercase"><Activity size={14} /> Séisme</div>}
        {isCardLocked && <div className="flex items-center gap-1 text-xs font-bold text-red-500 uppercase"><Lock size={14} /> Cartes Bloquées</div>}
      </div>

      {/* Cards Hand */}
      <div className="mt-auto pt-8">
        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
          <AnimatePresence>
            {hand.map(card => {
              const userCard = userCards[card.id] || { level: 1, xp: 0 };
              const xpForNextLevel = userCard.level * 10;
              const progress = (userCard.xp / xpForNextLevel) * 100;

              return (
                <motion.div
                  key={card.id}
                  layout
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -50, opacity: 0 }}
                  whileHover={{ y: -10 }}
                  onClick={() => playCard(card)}
                  className={`min-w-[140px] h-[220px] rounded-xl border-2 p-4 flex flex-col cursor-pointer transition-colors relative ${
                    energy >= card.energyCost ? 'border-orange-500 bg-orange-600/10' : 'border-white/10 bg-white/5 opacity-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] uppercase font-bold text-orange-500">{card.rarity}</span>
                    <div className="flex items-center gap-1 text-xs font-bold">
                      <Zap size={10} /> {card.energyCost}
                    </div>
                  </div>
                  <h5 className="font-black italic uppercase text-sm leading-tight mb-2">{card.name}</h5>
                  <p className="text-[10px] text-gray-400 flex-1 line-clamp-2">{card.description}</p>
                  
                  <div className="mt-2 space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-0.5 text-[8px] font-black text-yellow-500 uppercase">
                        <ChevronUp size={8} /> Niv.{userCard.level}
                      </div>
                      <div className="text-[8px] font-bold text-gray-500">{userCard.xp}/{xpForNextLevel} XP</div>
                    </div>
                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-white/10 text-center font-black text-orange-500">
                    {card.effects.map(e => (
                      <div key={e.type} className="text-[10px] uppercase">
                        {e.type === 'push_rope' ? `+${Math.round(e.value * (1 + (userCard.level - 1) * 0.2))}%` : e.type.replace('_', ' ')}
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
