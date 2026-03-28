import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Duel, UserProfile, Card as GameCard, CardEffect, UserCard, Fanz, FanzTemplate, DuelConfig, FanzStats } from '../types';
import { Card, Button } from './Layout';
import { motion, AnimatePresence } from 'motion/react';
import { Swords, ChevronLeft, EyeOff, Ghost, Minimize2, Move, ChevronUp, Shield, RefreshCw, Activity, Lock, Flame, Brain, Star, Users, Search, Trophy, Target, CreditCard, Layers } from 'lucide-react';
import { BASE_CARDS } from '../constants/cards';
import { LOGOS } from '../constants';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, updateDoc, setDoc, collection, getDocs, increment, query, where } from 'firebase/firestore';

export function DuelManager({ user, matchId, teamA, teamB, onExit }: { user: UserProfile; matchId: string; teamA: string; teamB: string; onExit: () => void }) {
  const [activeDuel, setActiveDuel] = useState<Duel | null>(null);
  const [selectedFanzId, setSelectedFanzId] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [userFanzs, setUserFanzs] = useState<Fanz[]>([]);
  const [duelConfig, setDuelConfig] = useState<DuelConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const configSnap = await getDoc(doc(db, 'global_configs', 'duel_config'));
        if (configSnap.exists()) setDuelConfig(configSnap.data() as DuelConfig);

        const fanzSnap = await getDocs(query(collection(db, 'fanz'), where('ownerUid', '==', user.uid)));
        setUserFanzs(fanzSnap.docs.map(d => ({ ...d.data(), id: d.id } as Fanz)));
      } catch (err) {
        console.error("Error fetching duel data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user.uid]);

  const handleStartDuel = async (type: Duel['type']) => {
    if (!selectedFanzId || !duelConfig || !selectedTeam) {
      alert("Veuillez sélectionner un Fanz et une équipe !");
      return;
    }

    const cost = duelConfig.costs[type as keyof typeof duelConfig.costs] || { money: 0, energy: 0 };
    if (user.money < cost.money || user.energy < cost.energy) {
      alert("Fonds ou énergie insuffisants !");
      return;
    }

    try {
      // Deduct costs
      await updateDoc(doc(db, 'users', user.uid), {
        money: increment(-cost.money),
        energy: increment(-cost.energy)
      });

      const duelId = type === 'training' ? `training_${user.uid}_${Date.now()}` : `${matchId}_${type}`;
      
      setActiveDuel({
        id: duelId,
        type,
        status: 'waiting',
        matchId,
        teamA: selectedTeam,
        teamB: selectedTeam === teamA ? teamB : teamA,
        progress: 50,
        participants: [],
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error starting duel", err);
    }
  };

  if (activeDuel) {
    return <DuelScreen duel={activeDuel} user={user} fanzId={selectedFanzId!} onExit={() => setActiveDuel(null)} />;
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col p-6 overflow-y-auto">
      <div className="flex justify-between items-center mb-8">
        <button onClick={onExit} className="p-2 hover:bg-white/10 rounded-full">
          <ChevronLeft />
        </button>
        <h2 className="text-2xl font-black italic uppercase tracking-tighter">Salon des Duels</h2>
        <div className="w-10" />
      </div>

      <div className="max-w-4xl mx-auto w-full space-y-8">
        {/* Fanz Selection */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Choisir mon FANZ</h3>
          <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
            {userFanzs.map(fanz => (
              <button
                key={fanz.id}
                onClick={() => setSelectedFanzId(fanz.id)}
                className={`min-w-[120px] p-3 rounded-xl border-2 transition-all ${
                  selectedFanzId === fanz.id ? 'border-orange-500 bg-orange-600/20' : 'border-white/10 bg-white/5'
                }`}
              >
                <img src={fanz.imageUrl} alt={fanz.name} className="w-full aspect-square object-contain mb-2" />
                <p className="text-[10px] font-black uppercase truncate">{fanz.name}</p>
                <p className="text-[8px] text-gray-500">Niv.{fanz.level}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Team Selection */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Choisir mon Équipe à soutenir</h3>
          <div className="flex gap-4">
            {[teamA, teamB].map(team => (
              <button
                key={team}
                onClick={() => setSelectedTeam(team)}
                className={`flex-1 p-4 rounded-xl border-2 transition-all font-black uppercase italic ${
                  selectedTeam === team ? 'border-orange-500 bg-orange-600/20' : 'border-white/10 bg-white/5'
                }`}
              >
                {team}
              </button>
            ))}
          </div>
        </section>

        {/* Duel Types */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { id: 'training', name: 'Entraînement', icon: Target, desc: 'Contre un bot miroir' },
            { id: '1v1', name: 'Duel 1v1', icon: Swords, desc: 'Contre un autre supporter' },
            { id: '2v2', name: 'Duel 2v2', icon: Users, desc: 'Match en équipe' },
            { id: '5v5', name: 'Duel 5v5', icon: Layers, desc: 'Grosse mêlée' },
            { id: 'war_of_kops', name: 'Guerre des KOPs', icon: Flame, desc: 'Ouvert à tous' }
          ].map(type => {
            const cost = duelConfig?.costs[type.id as keyof typeof duelConfig.costs] || { money: 0, energy: 0 };
            return (
              <button
                key={type.id}
                disabled={!selectedFanzId || !selectedTeam}
                onClick={() => handleStartDuel(type.id as any)}
                className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-left disabled:opacity-50"
              >
                <div className="p-3 bg-orange-600 rounded-xl">
                  <type.icon size={24} />
                </div>
                <div className="flex-1">
                  <h4 className="font-black italic uppercase text-lg">{type.name}</h4>
                  <p className="text-xs text-gray-400">{type.desc}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-xs font-bold text-orange-500">
                    <CreditCard size={12} /> {cost.money}$
                  </div>
                  <div className="flex items-center gap-1 text-xs font-bold text-yellow-500">
                    <Activity size={12} /> {cost.energy}
                  </div>
                </div>
              </button>
            );
          })}
        </section>
      </div>
    </div>
  );
}

export function DuelScreen({ duel, user, onExit, fanzId }: { duel: Duel; user: UserProfile; onExit: () => void, fanzId: string }) {
  const [progress, setProgress] = useState(50);
  const [excitement, setExcitement] = useState(5);
  const maxExcitement = 10;
  const [socket, setSocket] = useState<Socket | null>(null);
  const [winner, setWinner] = useState<string | null>(null);
  const [status, setStatus] = useState<'waiting' | 'starting' | 'active' | 'finished'>(duel.status);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [participants, setParticipants] = useState<any[]>(duel.participants || []);
  
  const [hand, setHand] = useState<GameCard[]>([]);
  const [deck, setDeck] = useState<GameCard[]>([]);
  const [userCards, setUserCards] = useState<Record<string, UserCard>>({});
  const [allCards, setAllCards] = useState<GameCard[]>([]);
  const [fanz, setFanz] = useState<Fanz | null>(null);
  const [duelConfig, setDuelConfig] = useState<DuelConfig | null>(null);

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
  const [buttonVisibilityDuration, setButtonVisibilityDuration] = useState(3000);
  const [buttonHiddenDuration, setButtonHiddenDuration] = useState(2000);

  // Calculate Stat Bonuses
  const getStatEffectValue = (effectType: string) => {
    if (!duelConfig || !fanz) return 0;
    const effect = duelConfig.statEffects.find(e => e.effectType === effectType);
    if (!effect) return 0;
    const statLevel = fanz.stats[effect.statName] || 1;
    return effect.baseValue + (statLevel * effect.multiplierPerLevel);
  };

  const fanzRank = fanz?.rank ?? 0;
  const rankBonus = fanzRank * 0.02; // 2% per rank
  const forceBonus = getStatEffectValue('click_power');
  const baseExcitementMultiplier = (fanz?.baseExcitement || 5) / 5;
  const multiplier = baseExcitementMultiplier + rankBonus + forceBonus;

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
        // Fetch Duel Config
        const configSnap = await getDoc(doc(db, 'global_configs', 'duel_config'));
        if (configSnap.exists()) {
          const configData = configSnap.data() as DuelConfig;
          setDuelConfig(configData);
        }

        const cardsSnap = await getDocs(collection(db, 'cards'));
        const fetchedCards = cardsSnap.docs.map(d => ({ id: d.id, ...d.data() } as GameCard));
        const initialCards = fetchedCards.length > 0 ? fetchedCards : BASE_CARDS;
        
        const fanzSnap = await getDoc(doc(db, 'fanz', fanzId));
        if (fanzSnap.exists()) {
          const fanzData = fanzSnap.data() as Fanz;
          setFanz(fanzData);
          
          // Filter all available cards for this Fanz template
          const fanzAvailableCards = initialCards.filter(c => {
            const isAllowed = !c.fanzIds || c.fanzIds.length === 0 || c.fanzIds.includes(fanzData.templateId);
            const isBlocked = c.blockedFanzIds && c.blockedFanzIds.includes(fanzData.templateId);
            return isAllowed && !isBlocked;
          });
          setAllCards(fanzAvailableCards);

          if (fanzData.equippedCards && fanzData.equippedCards.length > 0) {
            cardsToUse = fanzAvailableCards.filter(c => fanzData.equippedCards?.includes(c.id));
          } else {
            cardsToUse = fanzAvailableCards;
          }

          // Setup energy based on stats
          const configSnap = await getDoc(doc(db, 'global_configs', 'duel_config'));
          if (configSnap.exists()) {
            const config = configSnap.data() as DuelConfig;
            const getStatValue = (type: string, stats: FanzStats) => {
              const effect = config.statEffects.find(e => e.effectType === type);
              if (!effect) return 0;
              return effect.baseValue + (stats[effect.statName] * effect.multiplierPerLevel);
            };
            const visD = getStatValue('button_visibility', fanzData.stats) || 3000;
            const hidD = getStatValue('button_hidden', fanzData.stats) || 2000;
            setExcitement(fanzData.baseExcitement || 5);
            setButtonVisibilityDuration(visD);
            setButtonHiddenDuration(hidD);
          }
        }

        const userCardsSnap = await getDocs(collection(db, 'users', user.uid, 'user_cards'));
        const ucData: Record<string, UserCard> = {};
        userCardsSnap.docs.forEach(d => ucData[d.id] = d.data() as UserCard);
        setUserCards(ucData);

        const shuffled = [...cardsToUse].sort(() => Math.random() - 0.5);
        setDeck(shuffled);
        setHand(shuffled.slice(0, 4));
      } catch (err) {
        console.error("Error initializing duel data", err);
      }
    };

    initDuel();
  }, [fanzId, user.uid]);

  const drawCard = () => {
    setHand(prev => {
      if (prev.length >= 4) return prev;
      const available = deck.filter(c => !prev.find(p => p.id === c.id));
      if (available.length === 0) return prev;
      const next = available[Math.floor(Math.random() * available.length)];
      return [...prev, next];
    });
  };

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join-duel', { duelId: duel.id, user, fanz, type: duel.type });
    });

    newSocket.on('duel-update', (state: { progress: number; status: any; participants?: any[] }) => {
      setProgress(state.progress);
      setStatus(state.status);
      if (state.participants) {
        setParticipants(state.participants);
      }
    });

    newSocket.on('duel-starting', ({ startTime }: { startTime: number }) => {
      setStatus('starting');
      const updateCountdown = () => {
        const remaining = Math.ceil((startTime - Date.now()) / 1000);
        if (remaining > 0) {
          setCountdown(remaining);
          setTimeout(updateCountdown, 1000);
        } else {
          setCountdown(null);
        }
      };
      updateCountdown();
    });

    newSocket.on('duel-started', () => {
      setStatus('active');
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
            
            // Base gain + rank bonus (2% per rank) + social bonus
            const rankBonus = 1 + (fanzData.rank ?? 0) * 0.02;
            const socialBonus = getStatEffectValue('ferveur_bonus');
            const ferveurGain = Math.round(10 * (rankBonus + socialBonus));
            
            let newPoints = (fanzData.ferveurPoints || 0) + ferveurGain;
            let newLevel = fanzData.ferveurLevel || 1;
            
            if (template?.ferveurPath) {
              // Check if we reached a new level
              const nextLevel = template.ferveurPath.find(p => p.level === newLevel + 1);
              if (nextLevel && newPoints >= nextLevel.pointsRequired) {
                newLevel += 1;
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
        const mentalBonus = getStatEffectValue('malus_duration');
        const bluffBonus = getStatEffectValue('visual_malus_duration');
        
        switch (effect.type) {
          case 'blur_view':
            setIsBlurred(true);
            setTimeout(() => setIsBlurred(false), (effect.duration || 5) * 1000 * bluffBonus);
            break;
          case 'hide_button':
            setIsButtonHidden(true);
            setTimeout(() => setIsButtonHidden(false), (effect.duration || 4) * 1000 * mentalBonus);
            break;
          case 'shrink_button':
            setIsButtonShrunk(true);
            setTimeout(() => setIsButtonShrunk(false), (effect.duration || 6) * 1000 * bluffBonus);
            break;
          case 'move_button':
            setIsButtonMoving(true);
            setTimeout(() => setIsButtonMoving(false), (effect.duration || 8) * 1000 * bluffBonus);
            break;
          case 'hide_score':
            setIsScoreHidden(true);
            setTimeout(() => setIsScoreHidden(false), (effect.duration || 7) * 1000 * bluffBonus);
            break;
          case 'drain_energy':
            setExcitement(prev => Math.max(0, prev - (effect.value || 0)));
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
            setTimeout(() => setIsButtonHidden(false), (effect.duration || 3) * 1000 * mentalBonus);
            break;
          case 'earthquake':
            setIsEarthquake(true);
            setTimeout(() => setIsEarthquake(false), (effect.duration || 3) * 1000 * bluffBonus);
            break;
          case 'fake_buttons':
            setIsFakeButtons(true);
            setTimeout(() => setIsFakeButtons(false), (effect.duration || 5) * 1000 * bluffBonus);
            break;
          case 'card_lock':
            setIsCardLocked(true);
            setTimeout(() => setIsCardLocked(false), (effect.duration || 5) * 1000 * mentalBonus);
            break;
        }
      });
    });

    return () => {
      newSocket.disconnect();
    };
  }, [duel.id]);

  // Button visibility cycle (Mental stat)
  useEffect(() => {
    if (status !== 'active' || !!winner) return;

    const toggle = () => {
      setIsButtonHidden(prev => !prev);
    };

    const timeout = setTimeout(toggle, isButtonHidden ? buttonHiddenDuration : buttonVisibilityDuration);
    return () => clearTimeout(timeout);
  }, [status, isButtonHidden, buttonVisibilityDuration, buttonHiddenDuration, winner]);

  const handleAction = () => {
    if (winner || isButtonHidden) return;
    
    // Find the user's actual team
    const myParticipant = participants.find(p => p.uid === user.uid);
    const myTeam = myParticipant?.team || 'A';
    
    console.log('Action clicked!', { duelId: duel.id, team: myTeam, multiplier });
    socket?.emit('click-ferveur', { duelId: duel.id, team: myTeam, multiplier });
    
    if (isDoublePoints) {
      socket?.emit('click-ferveur', { duelId: duel.id, team: myTeam, multiplier });
    }
  };

  const playCard = async (card: GameCard) => {
    const actualCost = card.energyCost > 10 ? Math.max(1, Math.round(card.energyCost / 10)) : card.energyCost;
    if (winner || excitement < actualCost || isCardLocked) return;
    
    // Remove from hand
    setHand(prev => prev.filter(c => c.id !== card.id));
    setTimeout(drawCard, 3000); // Draw new card after 3s

    setExcitement(prev => prev - actualCost);
    
    // XP Gain and Leveling
    try {
      const cardRef = doc(db, 'users', user.uid, 'user_cards', card.id);
      const cardSnap = await getDoc(cardRef);
      let currentLevel = 1;
      let currentXp = 0;
      
      const socialBonus = getStatEffectValue('xp_gain');
      const xpGain = Math.round(1 * (1 + socialBonus));

      if (cardSnap.exists()) {
        const data = cardSnap.data() as UserCard;
        currentLevel = data.level;
        currentXp = data.xp + xpGain;
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
            xp: increment(xpGain)
          });
          // Update local state
          setUserCards(prev => ({ ...prev, [card.id]: { ...data, xp: currentXp } }));
        }
      } else {
        const newCardData = {
          id: card.id,
          ownerUid: user.uid,
          level: 1,
          xp: xpGain
        };
        await setDoc(cardRef, newCardData);
        setUserCards(prev => ({ ...prev, [card.id]: newCardData }));
      }

      // Apply level bonus to effects
      const levelBonus = 1 + (currentLevel - 1) * 0.2; // 20% per level
      const charismaBonus = getStatEffectValue('card_power');
      const creativityBonus = getStatEffectValue('card_cost_reduction');
      
      const boostedCard = {
        ...card,
        energyCost: Math.max(1, Math.round(card.energyCost * (1 - creativityBonus))),
        fervorValue: card.fervorValue ? Math.round(card.fervorValue * levelBonus * (1 + charismaBonus)) : card.fervorValue,
        effects: card.effects.map(e => ({
          ...e,
          value: e.value ? Math.round(e.value * levelBonus * (1 + charismaBonus)) : e.value,
          duration: e.duration ? Math.round(e.duration * levelBonus * (1 + charismaBonus)) : e.duration
        }))
      };

      // Apply self-effects immediately
      boostedCard.effects.forEach(effect => {
        if (effect.type === 'refill_energy') {
          setExcitement(prev => Math.min(maxExcitement, prev + (effect.value || 0)));
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
          const intelligenceBonus = getStatEffectValue('rarity_chance');
          const legendaryCards = allCards.filter(c => c.rarity === 'legendary');
          const epicCards = allCards.filter(c => c.rarity === 'epic');
          
          if (Math.random() < (0.1 + intelligenceBonus) && legendaryCards.length > 0) {
            const randomLegendary = legendaryCards[Math.floor(Math.random() * legendaryCards.length)];
            setHand(prev => {
              const newHand = [...prev];
              const index = Math.floor(Math.random() * newHand.length);
              newHand[index] = { ...randomLegendary, instanceId: Math.random().toString(36).substr(2, 9) };
              return newHand;
            });
          } else if (epicCards.length > 0) {
            const randomEpic = epicCards[Math.floor(Math.random() * epicCards.length)];
            setHand(prev => {
              const newHand = [...prev];
              const index = Math.floor(Math.random() * newHand.length);
              newHand[index] = { ...randomEpic, instanceId: Math.random().toString(36).substr(2, 9) };
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

      const myParticipant = participants.find(p => p.uid === user.uid);
      const myTeam = myParticipant?.team || 'A';

      socket?.emit('play-card', { duelId: duel.id, team: myTeam, card: boostedCard });
    } catch (err) {
      console.error("Error playing card and updating XP", err);
    }
  };

  // Excitement regeneration
  useEffect(() => {
    if (status !== 'active') return;
    const interval = setInterval(() => {
      const baseRegen = isEnergyRegenBoosted ? 2 : 1;
      const enduranceBonus = getStatEffectValue('energy_regen');
      setExcitement(prev => Math.min(maxExcitement, prev + (baseRegen + enduranceBonus) * 0.5));
    }, 500);
    return () => clearInterval(interval);
  }, [isEnergyRegenBoosted, duelConfig, fanz, status]);

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
        <div className="flex gap-2">
          <div className="flex items-center gap-2 bg-yellow-600/20 px-3 py-1 rounded-full border border-yellow-500" title="Excitation">
            <span className="text-yellow-500 font-black text-sm">⚡ {Math.floor(excitement)}/10</span>
          </div>
        </div>
      </div>

      {/* Countdown Overlay */}
      <AnimatePresence>
        {status === 'waiting' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 z-40 flex flex-col items-center justify-center text-center p-6"
          >
            <div className="w-20 h-20 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-6" />
            <h3 className="text-2xl font-black italic uppercase mb-2">En attente d'adversaires...</h3>
            <p className="text-gray-400 text-sm">Le duel commencera dès que le salon sera complet.</p>
          </motion.div>
        )}
        {status === 'starting' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 z-40 flex flex-col items-center justify-center text-center p-6"
          >
            <motion.span 
              key={countdown}
              initial={{ scale: 2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-9xl font-black italic text-orange-500"
            >
              {countdown}
            </motion.span>
            <h3 className="text-2xl font-black italic uppercase mt-4">Préparez-vous !</h3>
          </motion.div>
        )}
      </AnimatePresence>

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
        {isDoublePoints && <div className="flex items-center gap-1 text-xs font-bold text-orange-500 uppercase"><img src={LOGOS.energy} alt="Energy" className="w-3.5 h-3.5 object-contain" /> Double Ferveur</div>}
        {hasShield && <div className="flex items-center gap-1 text-xs font-bold text-blue-500 uppercase"><Shield size={14} /> Bouclier Actif</div>}
        {hasMirror && <div className="flex items-center gap-1 text-xs font-bold text-purple-500 uppercase"><RefreshCw size={14} /> Miroir Actif</div>}
        {isEnergyRegenBoosted && <div className="flex items-center gap-1 text-xs font-bold text-yellow-500 uppercase"><img src={LOGOS.energy} alt="Energy" className="w-3.5 h-3.5 object-contain" /> Regen Boost</div>}
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
              const actualCost = card.energyCost > 10 ? Math.max(1, Math.round(card.energyCost / 10)) : card.energyCost;

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
                    excitement >= actualCost ? 'border-yellow-500 bg-yellow-600/10' : 'border-white/10 bg-white/5 opacity-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] uppercase font-bold text-yellow-500">{card.rarity}</span>
                    <div className="flex items-center gap-1 text-xs font-bold text-yellow-500">
                      ⚡ {actualCost}
                    </div>
                  </div>
                  <h5 className="font-black italic uppercase text-sm leading-tight mb-2">{card.name}</h5>
                  <p className="text-[10px] text-gray-400 flex-1 line-clamp-2">{card.description}</p>
                  
                  <div className="mt-2 space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-0.5 text-[8px] font-black text-yellow-500 uppercase">
                        <img src={LOGOS.level} alt="Level" className="w-2 h-2 object-contain" /> Niv.{userCard.level}
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
