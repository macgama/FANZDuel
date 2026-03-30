import { footballApi } from '../services/footballApi';
import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Duel, UserProfile, Card as GameCard, CardEffect, UserCard, Fanz, FanzTemplate, DuelConfig, FanzStats } from '../types';
import { Card, Button } from './Layout';
import { motion, AnimatePresence } from 'motion/react';
import { Swords, ChevronLeft, EyeOff, Ghost, Minimize2, Move, ChevronUp, Shield, RefreshCw, Activity, Lock, Flame, Brain, Star, Users, Search, Trophy, Target, CreditCard, Layers, Snowflake } from 'lucide-react';
import { BASE_CARDS } from '../constants/cards';
import { LOGOS } from '../constants';
import { getImageUrl } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, updateDoc, setDoc, collection, getDocs, increment, query, where } from 'firebase/firestore';
import { logTransaction } from '../services/transactionService';

export function DuelManager({ user, matchId, teamA, teamB, teamALogo, teamBLogo, onExit, initialDuelId, initialDuelType, isLiveMatch = true, isPrivate = false }: { user: UserProfile; matchId: string; teamA: string; teamB: string; teamALogo?: string; teamBLogo?: string; onExit: () => void; initialDuelId?: string; initialDuelType?: string; isLiveMatch?: boolean; isPrivate?: boolean }) {
  const [activeDuel, setActiveDuel] = useState<Duel | null>(null);
  const [selectedFanzId, setSelectedFanzId] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [selectedArena, setSelectedArena] = useState<string | null>(initialDuelType && !initialDuelId ? initialDuelType : null);
  const [userFanzs, setUserFanzs] = useState<Fanz[]>([]);
  const [duelConfig, setDuelConfig] = useState<DuelConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [joiningDuelId, setJoiningDuelId] = useState<string | null>(initialDuelId || null);
  const [joiningDuelData, setJoiningDuelData] = useState<any | null>(null);
  const [inviteCode, setInviteCode] = useState('');

  useEffect(() => {
    if (joiningDuelId) {
      const fetchDuelData = async () => {
        try {
          const res = await fetch(`/api/duels`);
          if (res.ok) {
            const allDuels = await res.json();
            const duel = allDuels.find((d: any) => d.id === joiningDuelId);
            if (duel) {
              setJoiningDuelData(duel);
              // Auto-select team if only one is available
              const maxPlayersPerTeam = { '1v1': 1, '2v2': 2, '5v5': 5 }[duel.type as '1v1' | '2v2' | '5v5'] || 999;
              const countA = duel.participants.filter((p: any) => p.team === 'A').length;
              const countB = duel.participants.filter((p: any) => p.team === 'B').length;
              
              if (countA >= maxPlayersPerTeam && countB < maxPlayersPerTeam) {
                setSelectedTeam(teamB);
              } else if (countB >= maxPlayersPerTeam && countA < maxPlayersPerTeam) {
                setSelectedTeam(teamA);
              }
            }
          }
        } catch (err) {
          console.error("Error fetching joining duel data", err);
        }
      };
      fetchDuelData();
    }
  }, [joiningDuelId, teamA, teamB]);

  // Calculate Stat Bonuses for Impact Estimation
  const getStatEffectValue = (effectType: string, fanz: Fanz | null) => {
    if (!duelConfig || !fanz) return 0;
    const effect = duelConfig.statEffects.find(e => e.effectType === effectType);
    if (!effect) return 0;
    const statLevel = (fanz.stats as any)[effect.statName] || 1;
    return effect.baseValue + (statLevel * effect.multiplierPerLevel);
  };

  const selectedFanz = userFanzs.find(f => f.id === selectedFanzId) || null;
  const fanzRank = selectedFanz?.rank ?? 0;
  const rankBonus = fanzRank * 0.02; // 2% per rank
  const forceBonus = getStatEffectValue('click_power', selectedFanz);
  const baseExcitementMultiplier = (selectedFanz?.baseExcitement || 5) / 5;
  const multiplier = baseExcitementMultiplier + rankBonus + forceBonus;
  
  const baseArena = 0.5;
  const totalImpact = selectedFanz ? (baseArena * multiplier).toFixed(2) : "0.00";
  const bonusJoueurPct = ((baseExcitementMultiplier - 1) * 100).toFixed(0);
  const maitriseFanPct = ((rankBonus + forceBonus) * 100).toFixed(1);

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

    const selectedFanz = userFanzs.find(f => f.id === selectedFanzId);
    if (!selectedFanz || !selectedFanz.equippedCards || selectedFanz.equippedCards.length < 8) {
      alert("Votre Fanz doit avoir 8 cartes dans son deck pour lancer un duel !");
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

      if (cost.money > 0) await logTransaction(user.uid, 'money', -cost.money, `Inscription duel: ${type}`);
      if (cost.energy > 0) await logTransaction(user.uid, 'energy', -cost.energy, `Inscription duel: ${type}`);

      const duelId = joiningDuelId || (type === 'training' ? `training_${user.uid}_${Date.now()}` : type === 'war_of_kops' ? `war_of_kops_${matchId}` : `duel_${Math.random().toString(36).substring(7)}`);
      
      setJoiningDuelId(null);
      setActiveDuel({
        id: duelId,
        type,
        status: 'waiting',
        matchId,
        teamA: selectedTeam,
        teamB: selectedTeam === teamA ? teamB : teamA,
        progress: 50,
        participants: [],
        createdAt: new Date().toISOString(),
        isPrivate,
        inviteCode: inviteCode || undefined
      });
    } catch (err) {
      console.error("Error starting duel", err);
    }
  };

  if (activeDuel) {
    return <DuelScreen duel={activeDuel} user={user} fanzId={selectedFanzId!} teamA={teamA} teamB={teamB} selectedTeam={selectedTeam!} onExit={() => setActiveDuel(null)} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-[#1a1a1a] overflow-y-auto">
      <div className="w-full max-w-md relative flex flex-col min-h-full">
        {/* Header */}
        <div className="pt-8 pb-6 px-6 text-center relative z-10">
          <button onClick={onExit} className="absolute left-4 top-8 p-2 hover:bg-white/10 rounded-full text-gray-400">
            <ChevronLeft />
          </button>
          <h2 className="text-4xl font-black text-[#f97316] uppercase tracking-tighter mb-1">Hub de Duel</h2>
        </div>

        <div className="flex-1 px-4 pb-28 space-y-8 relative z-10">
          
          {/* Fanz Selection */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-[#f97316] mb-2">
              <Star size={16} />
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-300">0. Choisir votre FANZ</h3>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar snap-x">
              {userFanzs.map(fanz => (
                <button
                  key={fanz.id}
                  onClick={() => setSelectedFanzId(fanz.id)}
                  className={`flex-none w-[calc(50%-6px)] p-0 overflow-hidden rounded-xl border-2 transition-all flex flex-col snap-start ${
                    selectedFanzId === fanz.id ? 'border-[#f97316] bg-[#f97316]/10' : 'border-white/5 bg-white/5'
                  }`}
                >
                  <div className="w-full aspect-square p-0 bg-black/40">
                    <img src={getImageUrl(fanz.imageUrl)} alt={fanz.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-2 text-center">
                    <p className="text-[10px] font-black uppercase truncate text-white">{fanz.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Team Selection */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-[#f97316] mb-2">
              <Trophy size={16} />
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-300">1. Choisir votre camp</h3>
            </div>
            <div className="flex gap-3">
              {[
                { name: teamA, id: 'A', logo: teamALogo },
                { name: teamB, id: 'B', logo: teamBLogo }
              ].map(team => {
                const maxPlayersPerTeam = joiningDuelData ? ({ '1v1': 1, '2v2': 2, '5v5': 5 }[joiningDuelData.type as '1v1' | '2v2' | '5v5'] || 999) : 999;
                const currentCount = joiningDuelData ? joiningDuelData.participants.filter((p: any) => p.team === team.id).length : 0;
                const isFull = currentCount >= maxPlayersPerTeam;

                return (
                  <button
                    key={team.name}
                    onClick={() => !isFull && setSelectedTeam(team.name)}
                    disabled={isFull}
                    className={`flex-1 flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all relative ${
                      selectedTeam === team.name ? 'border-[#f97316] bg-[#f97316]/10' : isFull ? 'border-white/5 bg-black/20 opacity-50' : 'border-white/5 bg-[#1e1e1e]'
                    }`}
                  >
                    {isFull && (
                      <div className="absolute top-2 right-2 bg-red-600 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest text-white shadow-lg">
                        Complet
                      </div>
                    )}
                    {team.logo ? (
                      <img src={team.logo} alt={team.name} className="w-12 h-12 object-contain mb-2" />
                    ) : (
                      <Shield className="w-12 h-12 text-gray-600 mb-2" />
                    )}
                    <span className="text-[10px] font-black uppercase text-center text-white">{team.name}</span>
                    {joiningDuelData && (
                      <div className="mt-2 text-[8px] font-bold text-gray-500 uppercase tracking-widest">
                        {currentCount} / {maxPlayersPerTeam}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Arena Selection */}
          {!joiningDuelId && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-[#f97316] mb-2">
                <Target size={16} />
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-300">2. Sélectionner l'arène</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'training', title: 'Entraînement Solo', subtitle: '1 VS BOT', bg: 'gs://thebestfanonlinegas.firebasestorage.app/public/background/back1v1.png', fullWidth: false },
                  { id: '1v1', title: 'Duel devant ta télé', subtitle: '1 VS 1', bg: 'gs://thebestfanonlinegas.firebasestorage.app/public/background/back1v1.png', fullWidth: false },
                  { id: '2v2', title: 'Soirée au pub', subtitle: '2 VS 2', bg: 'gs://thebestfanonlinegas.firebasestorage.app/public/background/back2v2.png', fullWidth: false },
                  { id: '5v5', title: 'Fanzone survoltée', subtitle: '5 VS 5', bg: 'gs://thebestfanonlinegas.firebasestorage.app/public/background/back5v5.png', fullWidth: false },
                  { id: 'war_of_kops', title: 'Guerre des KOPs', subtitle: 'XX VS XX', bg: 'gs://thebestfanonlinegas.firebasestorage.app/public/background/backKOP.png', fullWidth: true }
                ].filter(arena => isLiveMatch || arena.id === 'training').map(arena => {
                  const cost = duelConfig?.costs[arena.id as keyof typeof duelConfig.costs] || { money: 0, energy: 0 };
                  const bgUrl = getImageUrl(arena.bg);
                  
                  return (
                    <button
                      key={arena.id}
                      onClick={() => setSelectedArena(arena.id)}
                      className={`relative overflow-hidden rounded-xl border-2 transition-all text-left min-h-[110px] group p-0 ${
                        arena.fullWidth ? 'col-span-2' : 'col-span-1'
                      } ${
                        selectedArena === arena.id ? 'border-[#f97316] shadow-[0_0_15px_rgba(249,115,22,0.3)]' : 'border-transparent'
                      }`}
                    >
                      <div 
                        className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
                        style={{ backgroundImage: `url('${bgUrl}')` }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
                      
                      <div className="relative z-10 p-3 h-full flex flex-col justify-between">
                        <div>
                          <h4 className="font-black text-white text-[11px] uppercase leading-tight">{arena.title}</h4>
                          <p className="text-[9px] font-bold text-gray-300 uppercase mt-0.5">{arena.subtitle}</p>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <div className="flex items-center gap-1 text-yellow-500 font-black text-xs">
                            {cost.energy} ⚡
                          </div>
                          <div className="flex items-center gap-1 text-green-500 font-black text-xs">
                            {cost.money} $
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Impact Estimé */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-[#f97316] mb-2">
              <Activity size={16} />
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-300">Votre impact estimé</h3>
            </div>
            <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl p-5">
              <div className="space-y-3 mb-5">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase">
                  <span className="text-gray-400">Base Arène</span>
                  <span className="text-white">{baseArena.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold uppercase">
                  <span className="text-gray-400">Bonus Joueur (Excitation)</span>
                  <span className={Number(bonusJoueurPct) >= 0 ? "text-green-500" : "text-red-500"}>
                    {Number(bonusJoueurPct) > 0 ? '+' : ''}{bonusJoueurPct}%
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold uppercase">
                  <span className="text-[#f97316]">Maitrise Fan (L.{selectedFanz?.level || 1})</span>
                  <span className="text-[#f97316]">+{maitriseFanPct}%</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold uppercase">
                  <span className="text-gray-400">Équipement & Synergie</span>
                  <span className="text-gray-500">+0%</span>
                </div>
              </div>
              <div className="pt-5 border-t border-white/10 text-center">
                <div className="text-3xl font-black text-white mb-1">{totalImpact}</div>
                <div className="text-[10px] font-bold text-[#f97316] uppercase tracking-widest">Pts par clic</div>
              </div>
            </div>
          </section>
        </div>

        {/* Bottom Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#1a1a1a] via-[#1a1a1a] to-transparent z-20 flex justify-center">
          <div className="w-full max-w-md">
            <button 
              onClick={() => handleStartDuel((joiningDuelId ? initialDuelType : selectedArena) as any)}
              disabled={!selectedFanzId || !selectedTeam || (!joiningDuelId && !selectedArena)}
              className="w-full py-4 text-sm font-black uppercase tracking-widest bg-[#b45309] hover:bg-[#92400e] text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {joiningDuelId ? "Rejoindre ce duel" : "Rejoindre l'arène"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface FloatingEffect {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
}

export function DuelScreen({ duel, user, onExit, fanzId, teamA, teamB, selectedTeam }: { duel: Duel; user: UserProfile; onExit: () => void, fanzId: string, teamA?: string, teamB?: string, selectedTeam: string }) {
  const [progress, setProgress] = useState(50);
  const [excitement, setExcitement] = useState(5);
  const maxExcitement = 10;
  const [socket, setSocket] = useState<Socket | null>(null);
  const [winner, setWinner] = useState<string | null>(null);
  const [duelResult, setDuelResult] = useState<{ winner: string, ferveurGain: number, teamGain: number, scoreA?: number, scoreB?: number } | null>(null);
  const [status, setStatus] = useState<'waiting' | 'starting' | 'active' | 'finished'>(duel.status);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [inviteCode, setInviteCode] = useState(duel.inviteCode);
  const [participants, setParticipants] = useState<any[]>(duel.participants || []);
  const [currentDuelId, setCurrentDuelIdState] = useState<string>(duel.id);
  const currentDuelIdRef = useRef(duel.id);
  const [floatingEffects, setFloatingEffects] = useState<FloatingEffect[]>([]);
  const [matchDetails, setMatchDetails] = useState<any>(null);

  useEffect(() => {
    if (duel.matchId && duel.matchId !== 'global') {
      const fetchMatch = async () => {
        try {
          const details = await footballApi.getFixtureDetails(parseInt(duel.matchId!));
          setMatchDetails(details);
        } catch (err) {
          console.error('Failed to fetch match details', err);
        }
      };
      fetchMatch();
      const interval = setInterval(fetchMatch, 60000);
      return () => clearInterval(interval);
    }
  }, [duel.matchId]);

  const addFloatingEffect = (text: string, x: number, y: number, color: string = 'text-white') => {
    const id = Math.random().toString(36).substring(7);
    
    // Clamp coordinates to keep text on screen (assuming ~200px width for text)
    const padding = 20;
    const textWidth = 150; // Estimate
    const clampedX = Math.max(padding, Math.min(x - textWidth / 2, window.innerWidth - textWidth - padding));
    const clampedY = Math.max(padding + 100, Math.min(y, window.innerHeight - padding));

    setFloatingEffects(prev => [...prev, { id, text, x: clampedX, y: clampedY, color }]);
    setTimeout(() => {
      setFloatingEffects(prev => prev.filter(e => e.id !== id));
    }, 1500);
  };

  const setCurrentDuelId = (id: string) => {
    setCurrentDuelIdState(id);
    currentDuelIdRef.current = id;
  };
  
  const [hand, setHand] = useState<GameCard[]>([]);
  const [deck, setDeck] = useState<GameCard[]>([]);
  const [userCards, setUserCards] = useState<Record<string, UserCard>>({});
  const [allCards, setAllCards] = useState<GameCard[]>([]);
  const [fanz, setFanz] = useState<Fanz | null>(null);
  const [duelConfig, setDuelConfig] = useState<DuelConfig | null>(null);

  // Visual Effects State
  const [isBlurred, setIsBlurred] = useState(false);
  const [isButtonHidden, setIsButtonHidden] = useState(false);
  const [isButtonFrozen, setIsButtonFrozen] = useState(false);
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
  const getStatEffectValue = (effectType: string, isMultiplier = false) => {
    if (!duelConfig || !fanz) return isMultiplier ? 1 : 0;
    const effect = duelConfig.statEffects.find(e => e.effectType === effectType);
    if (!effect) return isMultiplier ? 1 : 0;
    const statLevel = (fanz.stats as any)[effect.statName] || 1;
    const val = effect.baseValue + (statLevel * effect.multiplierPerLevel);
    return isMultiplier ? Math.max(0.1, val) : val;
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

  const [myTeam, setMyTeam] = useState<'A' | 'B' | null>(null);

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
    if (isButtonHidden) {
      const timer = setTimeout(() => setIsButtonHidden(false), 8000); // Max 8s safety
      return () => clearTimeout(timer);
    }
  }, [isButtonHidden]);

  useEffect(() => {
    if (isButtonFrozen) {
      const timer = setTimeout(() => setIsButtonFrozen(false), 8000); // Max 8s safety
      return () => clearTimeout(timer);
    }
  }, [isButtonFrozen]);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join-duel', { 
        duelId: currentDuelIdRef.current, 
        user, 
        fanz, 
        type: duel.type,
        matchId: duel.matchId,
        team: selectedTeam === teamA ? 'A' : 'B',
        isPrivate: duel.isPrivate,
        inviteCode: duel.inviteCode
      });
    });

    newSocket.on('duel-joined', ({ team, duelId: serverDuelId, participants: serverParticipants, inviteCode: serverInviteCode }: { team: 'A' | 'B', duelId: string, participants: any[], inviteCode?: string }) => {
      setMyTeam(team);
      setCurrentDuelId(serverDuelId);
      if (serverParticipants) setParticipants(serverParticipants);
      if (serverInviteCode) setInviteCode(serverInviteCode);
    });

    newSocket.on('duel-update', (state: { duelId?: string; progress: number; status: any; participants?: any[]; inviteCode?: string }) => {
      setProgress(state.progress);
      setStatus(state.status);
      if (state.duelId) {
        setCurrentDuelId(state.duelId);
      }
      if (state.participants) {
        setParticipants(state.participants);
      }
      if (state.inviteCode) {
        setInviteCode(state.inviteCode);
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

    newSocket.on('duel-finished', async ({ winner, scoreA, scoreB }: { winner: string, scoreA: number, scoreB: number }) => {
      setWinner(winner);
      let ferveurGain = 0;
      let teamGain = 0;
      
      // Save match score to Firestore
      if (duel.matchId && duel.matchId !== 'global' && duel.type !== 'training') {
        try {
          await setDoc(doc(db, 'match_scores', currentDuelIdRef.current), {
            matchId: duel.matchId,
            scoreA,
            scoreB,
            timestamp: new Date().toISOString()
          }, { merge: true });
        } catch (e) {
          console.error("Error saving match score", e);
        }
      }

      if (fanzId) {
        try {
          const fanzRef = doc(db, 'fanz', fanzId);
          const userRef = doc(db, 'users', user.uid);
          
          const [fanzSnap, userSnap, configSnap] = await Promise.all([
            getDoc(fanzRef),
            getDoc(userRef),
            getDoc(doc(db, 'global_configs', 'duel_config'))
          ]);

          if (fanzSnap.exists() && userSnap.exists()) {
            const fanzData = fanzSnap.data() as Fanz;
            const userData = userSnap.data() as UserProfile;
            const configData = configSnap.exists() ? configSnap.data() as DuelConfig : null;
            
            const tplSnap = await getDoc(doc(db, 'fanz_templates', fanzData.templateId));
            const template = tplSnap.exists() ? tplSnap.data() as FanzTemplate : null;
            
            const myParticipant = duel.participants?.find(p => p.uid === user.uid);
            const myTeam = myParticipant?.team || 'A';
            const isWin = winner === myTeam;
            const duelType = duel.type as keyof NonNullable<DuelConfig['rewards']>;
            
            // Get base rewards from config or use defaults
            const baseWinXp = configData?.rewards?.[duelType]?.winXp ?? (duelType === 'training' ? 5 : duelType === '1v1' ? 10 : duelType === '2v2' ? 20 : duelType === '5v5' ? 300 : 10);
            const baseLoseXp = configData?.rewards?.[duelType]?.loseXp ?? (duelType === 'training' ? 5 : duelType === '1v1' ? 10 : duelType === '2v2' ? 20 : duelType === '5v5' ? 30 : 10);
            
            let ferveurGainFanz = 0;
            let ferveurGainGeneral = 0;
            
            if (isWin) {
              const rankBonus = 1 + (fanzData.rank ?? 0) * 0.02;
              const socialBonus = getStatEffectValue('ferveur_bonus');
              ferveurGainFanz = Math.round(baseWinXp * (rankBonus + socialBonus));
              ferveurGainGeneral = ferveurGainFanz;
            } else {
              ferveurGainFanz = -baseLoseXp;
              ferveurGainGeneral = 0;
            }
            
            // Update FANZ
            let newFanzPoints = Math.max(0, (fanzData.ferveurPoints || 0) + ferveurGainFanz);
            let newFanzLevel = fanzData.ferveurLevel || 1;
            
            if (template?.ferveurPath) {
              const nextLevel = template.ferveurPath.find(p => p.level === newFanzLevel + 1);
              if (nextLevel && newFanzPoints >= nextLevel.pointsRequired) {
                newFanzLevel += 1;
              }
            }
            
            await updateDoc(fanzRef, {
              ferveurPoints: newFanzPoints,
              ferveurLevel: newFanzLevel
            });
            
            if (ferveurGainFanz !== 0) {
              await logTransaction(
                user.uid,
                'ferveur_fanz',
                ferveurGainFanz,
                isWin ? 'Victoire en duel' : 'Défaite en duel',
                fanzId
              );
            }
            
            setFanz(prev => prev ? { ...prev, ferveurPoints: newFanzPoints, ferveurLevel: newFanzLevel } : null);
            
            // Update User General
            if (ferveurGainGeneral > 0) {
              let newUserPoints = (userData.ferveurPoints || 0) + ferveurGainGeneral;
              await updateDoc(userRef, {
                ferveurPoints: newUserPoints
              });
              await logTransaction(
                user.uid,
                'ferveur_general',
                ferveurGainGeneral,
                'Victoire en duel'
              );
            }
            
            ferveurGain = ferveurGainFanz;
            teamGain = ferveurGainGeneral;
          }
        } catch (e) {
          console.error("Error updating ferveur", e);
        }
      }
      
      setDuelResult({ winner, ferveurGain, teamGain, scoreA, scoreB });
    });

    newSocket.on('enemy-card-played', ({ card }: { team: string, card: GameCard }) => {
      setLastEnemyCard(card);
      addFloatingEffect(`⚠️ ${card.name}`, window.innerWidth / 2, 100, 'text-red-500 font-black scale-125');

      const isMalus = card.effects.some(e => 
        ['drain_energy', 'hide_button', 'shrink_button', 'move_button', 'blur_view', 'hide_score', 'discard_enemy_cards', 'shuffle_deck', 'freeze_button', 'earthquake', 'fake_buttons', 'card_lock'].includes(e.type)
      );

      if (isMalus) {
        if (hasMirror) {
          setHasMirror(false);
          addFloatingEffect('✨ Miroir: Attaque renvoyée!', window.innerWidth / 2, 150, 'text-purple-400 font-black');
          newSocket.emit('play-card', { duelId: currentDuelIdRef.current, team: myTeam || 'A', card, reflected: true });
          return;
        }
        if (hasShield) {
          setHasShield(false);
          addFloatingEffect('🛡️ Bouclier: Attaque bloquée!', window.innerWidth / 2, 150, 'text-blue-300 font-black');
          return;
        }
      }

      card.effects.forEach((effect: CardEffect) => {
        // Resistance stats: higher value means shorter duration
        const mentalResistance = getStatEffectValue('malus_duration', true);
        const bluffResistance = getStatEffectValue('visual_malus_duration', true);
        
        // Duration reduction: duration / resistance (if resistance is > 1)
        // Or duration * resistance (if resistance is < 1)
        // Let's assume the stat returns a multiplier where 1.0 is neutral, > 1 is better resistance
        const getEffectiveDuration = (base: number, res: number) => (base * 1000) / Math.max(0.1, res);

        switch (effect.type) {
          case 'blur_view':
            setIsBlurred(true);
            setTimeout(() => setIsBlurred(false), getEffectiveDuration(effect.duration || 5, bluffResistance));
            addFloatingEffect('💨 Vue Troublée!', window.innerWidth / 2, 200, 'text-red-400 font-black');
            break;
          case 'hide_button':
            setIsButtonHidden(true);
            setTimeout(() => setIsButtonHidden(false), getEffectiveDuration(effect.duration || 4, mentalResistance));
            addFloatingEffect('👻 Bouton Invisible!', window.innerWidth / 2, 200, 'text-red-400');
            break;
          case 'shrink_button':
            setIsButtonShrunk(true);
            setTimeout(() => setIsButtonShrunk(false), getEffectiveDuration(effect.duration || 6, bluffResistance));
            addFloatingEffect('🤏 Bouton Rétréci!', window.innerWidth / 2, 200, 'text-red-400');
            break;
          case 'move_button':
            setIsButtonMoving(true);
            setTimeout(() => setIsButtonMoving(false), getEffectiveDuration(effect.duration || 8, bluffResistance));
            addFloatingEffect('🌪️ Bouton Fou!', window.innerWidth / 2, 200, 'text-red-400');
            break;
          case 'hide_score':
            setIsScoreHidden(true);
            setTimeout(() => setIsScoreHidden(false), getEffectiveDuration(effect.duration || 7, bluffResistance));
            addFloatingEffect('🙈 Score Caché!', window.innerWidth / 2, 200, 'text-red-400');
            break;
          case 'drain_energy':
            setExcitement(prev => Math.max(0, prev - (effect.value || 0)));
            addFloatingEffect(`⚡ -${effect.value} Énergie!`, window.innerWidth / 2, 200, 'text-red-400');
            break;
          case 'discard_enemy_cards':
            setHand(prev => {
              if (prev.length === 0) return prev;
              const newHand = [...prev];
              newHand.splice(Math.floor(Math.random() * newHand.length), 1);
              return newHand;
            });
            setTimeout(drawCard, 2000);
            addFloatingEffect('🃏 Carte Défaussée!', window.innerWidth / 2, 200, 'text-red-400');
            break;
          case 'shuffle_deck':
            setHand(prev => [...prev].sort(() => Math.random() - 0.5));
            addFloatingEffect('🔀 Main Mélangée!', window.innerWidth / 2, 200, 'text-red-400');
            break;
          case 'freeze_button':
            setIsButtonFrozen(true);
            setTimeout(() => setIsButtonFrozen(false), getEffectiveDuration(effect.duration || 3, mentalResistance));
            addFloatingEffect('❄️ Bouton Gelé!', window.innerWidth / 2, 200, 'text-blue-400');
            break;
          case 'earthquake':
            setIsEarthquake(true);
            setTimeout(() => setIsEarthquake(false), getEffectiveDuration(effect.duration || 3, bluffResistance));
            addFloatingEffect('🌋 Tremblement de Terre!', window.innerWidth / 2, 200, 'text-red-400');
            break;
          case 'fake_buttons':
            setIsFakeButtons(true);
            setTimeout(() => setIsFakeButtons(false), getEffectiveDuration(effect.duration || 5, bluffResistance));
            addFloatingEffect('🎭 Faux Boutons!', window.innerWidth / 2, 200, 'text-red-400');
            break;
          case 'card_lock':
            setIsCardLocked(true);
            setTimeout(() => setIsCardLocked(false), getEffectiveDuration(effect.duration || 5, mentalResistance));
            addFloatingEffect('🔒 Cartes Bloquées!', window.innerWidth / 2, 200, 'text-red-400');
            break;
        }
      });
    });

    newSocket.on('swap-hands-request', ({ fromTeam, opponentHand }: { fromTeam: string, opponentHand: GameCard[] }) => {
      const myParticipant = participants.find(p => p.uid === user.uid);
      const myTeam = myParticipant?.team || 'A';
      
      if (fromTeam !== myTeam) {
        // We are the target, we receive the opponent's hand and send ours
        const myCurrentHand = [...hand];
        setHand(opponentHand);
        newSocket.emit('swap-hands-response', { duelId: currentDuelIdRef.current, team: myTeam, hand: myCurrentHand });
        addFloatingEffect('🔄 Mains Échangées!', window.innerWidth / 2, 250, 'text-blue-400 font-black');
      }
    });

    newSocket.on('swap-hands-complete', ({ newHand }: { newHand: GameCard[] }) => {
      setHand(newHand);
      addFloatingEffect('🔄 Mains Échangées!', window.innerWidth / 2, 250, 'text-blue-400 font-black');
    });

    return () => {
      newSocket.disconnect();
    };
  }, [duel.id]);

  // Button visibility cycle (Mental stat) - REMOVED automatic cycle as it was confusing
  // Only cards should trigger invisible button now

  const handleAction = (e: React.MouseEvent) => {
    if (winner || isButtonHidden) return;
    
    // Find the user's actual team
    const myParticipant = participants.find(p => p.uid === user.uid);
    const myTeam = myParticipant?.team || 'A';
    
    console.log('Action clicked!', { duelId: currentDuelIdRef.current, team: myTeam, multiplier });
    socket?.emit('click-ferveur', { duelId: currentDuelIdRef.current, team: myTeam, multiplier });
    
    const ferveurGain = (0.5 * multiplier).toFixed(1);
    addFloatingEffect(`+${ferveurGain} Ferveur`, e.clientX, e.clientY, 'text-yellow-400');

    if (isDoublePoints) {
      socket?.emit('click-ferveur', { duelId: currentDuelIdRef.current, team: myTeam, multiplier });
      addFloatingEffect(`+${ferveurGain} Ferveur (x2)`, e.clientX, e.clientY - 20, 'text-yellow-400');
    }
  };

  const playCard = async (card: GameCard, e?: React.MouseEvent) => {
    const actualCost = card.energyCost > 10 ? Math.max(1, Math.round(card.energyCost / 10)) : card.energyCost;
    if (winner || excitement < actualCost || isCardLocked) return;
    
    // Remove from hand
    setHand(prev => prev.filter(c => c.id !== card.id));
    setTimeout(drawCard, 3000); // Draw new card after 3s

    setExcitement(prev => prev - actualCost);
    
    const x = e ? e.clientX : window.innerWidth / 2;
    const y = e ? e.clientY - 50 : window.innerHeight / 2;
    addFloatingEffect(`Carte jouée: ${card.name}`, x, y, 'text-blue-400 font-bold');
    
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
      const rawCharismaBonus = getStatEffectValue('card_power'); // Base is 1
      const charismaBonus = 1 + (rawCharismaBonus - 1) * 0.2; // Scale down to 20% effectiveness
      const creativityBonus = getStatEffectValue('card_cost_reduction'); // Base is 0
      
      const boostedCard = {
        ...card,
        energyCost: Math.max(1, Math.round(card.energyCost * (1 - creativityBonus))),
        fervorValue: card.fervorValue ? Math.round(card.fervorValue * levelBonus * charismaBonus) : card.fervorValue,
        effects: card.effects.map(e => ({
          ...e,
          value: e.value ? Math.round(e.value * levelBonus * charismaBonus) : e.value,
          duration: e.duration ? Math.round(e.duration * levelBonus * charismaBonus) : e.duration
        }))
      };

      // Apply self-effects immediately
      boostedCard.effects.forEach(effect => {
        if (effect.type === 'refill_energy') {
          setExcitement(prev => Math.min(maxExcitement, prev + (effect.value || 0)));
          addFloatingEffect(`+${effect.value} Énergie!`, x, y - 30, 'text-yellow-400');
        }
        if (effect.type === 'double_points') {
          setIsDoublePoints(true);
          setTimeout(() => setIsDoublePoints(false), (effect.duration || 5) * 1000);
          addFloatingEffect('Points x2!', x, y - 30, 'text-orange-400');
        }
        if (effect.type === 'shield') {
          setHasShield(true);
          addFloatingEffect('Bouclier Actif!', x, y - 30, 'text-blue-300');
        }
        if (effect.type === 'mirror') {
          setHasMirror(true);
          addFloatingEffect('Miroir Actif!', x, y - 30, 'text-purple-400');
        }
        if (effect.type === 'energy_regen_boost') {
          setIsEnergyRegenBoosted(true);
          setTimeout(() => setIsEnergyRegenBoosted(false), (effect.duration || 10) * 1000);
          addFloatingEffect('Régénération Boostée!', x, y - 30, 'text-green-400');
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
            addFloatingEffect('Carte Légendaire!', x, y - 30, 'text-yellow-400');
          } else if (epicCards.length > 0) {
            const randomEpic = epicCards[Math.floor(Math.random() * epicCards.length)];
            setHand(prev => {
              const newHand = [...prev];
              const index = Math.floor(Math.random() * newHand.length);
              newHand[index] = { ...randomEpic, instanceId: Math.random().toString(36).substr(2, 9) };
              return newHand;
            });
            addFloatingEffect('Carte Épique!', x, y - 30, 'text-purple-400');
          }
        }
        if (effect.type === 'mimic') {
          if (lastEnemyCard && lastEnemyCard.id !== 'mimic') {
            addFloatingEffect(`🎭 Mimic: ${lastEnemyCard.name}`, x, y - 80, 'text-purple-400 font-bold');
            // Play the mimicked card immediately for free (already paid mimic cost)
            socket?.emit('play-card', { duelId: currentDuelIdRef.current, team: myTeam, card: lastEnemyCard });
          } else {
            addFloatingEffect('❌ Rien à imiter', x, y - 80, 'text-gray-500');
          }
        }
        if (effect.type === 'swap_hands') {
          addFloatingEffect('🔄 Échange de Mains!', x, y - 80, 'text-blue-400 font-bold');
          socket?.emit('swap-hands-init', { duelId: currentDuelIdRef.current, team: myTeam, hand });
        }
      });

      const myParticipant = participants.find(p => p.uid === user.uid);
      const myTeam = myParticipant?.team || 'A';

      if (boostedCard.fervorValue) {
        addFloatingEffect(`+${boostedCard.fervorValue}% Ferveur!`, x, y - 60, 'text-yellow-400 font-black');
      }

      socket?.emit('play-card', { duelId: currentDuelIdRef.current, team: myTeam, card: boostedCard });
    } catch (err) {
      console.error("Error playing card and updating XP", err);
    }
  };

  // Excitement regeneration
  useEffect(() => {
    if (status !== 'active') return;
    const interval = setInterval(() => {
      // Base time in seconds to regenerate 1 point
      const baseRegenTime = duelConfig?.baseExcitementRegenTime || 5;
      
      // If boosted, regenerate twice as fast
      const effectiveRegenTime = isEnergyRegenBoosted ? baseRegenTime / 2 : baseRegenTime;
      
      // Endurance bonus reduces the time needed (e.g., enduranceBonus of 2 means 2% faster)
      const enduranceBonus = getStatEffectValue('energy_regen');
      const timeReductionMultiplier = 1 - (enduranceBonus * 0.01);
      
      const finalRegenTime = Math.max(0.5, effectiveRegenTime * timeReductionMultiplier);
      
      // Interval is 500ms (0.5s), so amount per tick is 0.5 / finalRegenTime
      const regenAmount = 0.5 / finalRegenTime;
      
      setExcitement(prev => Math.min(maxExcitement, prev + regenAmount));
    }, 500);
    return () => clearInterval(interval);
  }, [isEnergyRegenBoosted, duelConfig, fanz, status, maxExcitement]);

  // Button movement effect
  useEffect(() => {
    if (!isButtonMoving) {
      setButtonPosition({ x: 0, y: 0 });
      return;
    }
    const interval = setInterval(() => {
      setButtonPosition({
        x: (Math.random() - 0.5) * 240,
        y: (Math.random() - 0.5) * 240
      });
    }, 400);
    return () => clearInterval(interval);
  }, [isButtonMoving]);

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-[#0a0a0a]">
      <div className={`w-full h-full max-w-[450px] relative flex flex-col p-4 bg-black border-x border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.5)] transition-all duration-500 overflow-hidden ${isEarthquake ? 'animate-bounce' : ''}`}>
        {/* Blur Overlay */}
        <AnimatePresence>
          {isBlurred && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[60] backdrop-blur-[40px] bg-black/60 pointer-events-none flex items-center justify-center border-4 border-red-500/20"
            >
              <div className="flex flex-col items-center gap-4">
                <EyeOff className="w-16 h-16 text-red-500 animate-pulse" />
                <div className="text-white font-black italic text-3xl uppercase tracking-tighter text-center">
                  Vue Troublée !
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex justify-between items-center mb-2">
          <button onClick={onExit} className="p-2 hover:bg-white/10 rounded-full">
            <ChevronLeft />
          </button>
          <div className="text-[10px] text-yellow-500 font-black uppercase tracking-widest">
            {duel.type.replace('_', ' ')}
          </div>
          <div className="w-10"></div>
        </div>

      {/* Floating Effects */}
      <AnimatePresence>
        {floatingEffects.map(effect => (
          <motion.div
            key={effect.id}
            initial={{ opacity: 1, y: effect.y, x: effect.x, scale: 0.5 }}
            animate={{ opacity: 0, y: effect.y - 100, scale: 1.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className={`fixed pointer-events-none z-[100] font-black text-2xl drop-shadow-lg ${effect.color}`}
            style={{ left: 0, top: 0 }}
          >
            {effect.text}
          </motion.div>
        ))}
      </AnimatePresence>

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
            <p className="text-gray-400 text-sm mb-6">Le duel commencera dès que le salon sera complet.</p>
            
            {inviteCode && (
              <div className="bg-white/10 p-4 rounded-xl border border-white/20 flex flex-col items-center">
                <span className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">Code d'invitation</span>
                <div className="text-3xl font-black text-orange-500 tracking-[0.2em]">{inviteCode}</div>
                <div className="flex gap-2 mt-3">
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(inviteCode);
                      alert('Code copié !');
                    }}
                    className="text-xs text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Copier le code
                  </button>
                  {navigator.share && (
                    <button 
                      onClick={() => {
                        navigator.share({
                          title: 'Rejoins mon duel The Best Fan !',
                          text: `Rejoins mon duel avec le code: ${inviteCode}`,
                        }).catch(console.error);
                      }}
                      className="text-xs text-white bg-orange-600 hover:bg-orange-500 px-3 py-1.5 rounded-lg transition-colors font-bold"
                    >
                      Partager
                    </button>
                  )}
                </div>
              </div>
            )}
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

      {/* Middle Section: Match Info, Tug of War, Action Button */}
      <div className="flex-1 flex flex-col justify-center items-center gap-6">
        
        {/* Match Info (Teams, Logos, Score) */}
        <div className={`w-full flex flex-col items-center transition-opacity duration-500 ${isScoreHidden ? 'opacity-0' : 'opacity-100'}`}>
          {matchDetails ? (
            <div className="flex justify-between items-center w-full px-2">
              <div className="flex flex-col items-center gap-2 flex-1">
                <img src={matchDetails.teams.home.logo} alt={matchDetails.teams.home.name} className="w-12 h-12 object-contain drop-shadow-lg" />
                <span className={`text-lg font-black italic uppercase text-center leading-tight ${progress > 50 ? 'text-orange-500' : 'text-white/80'}`}>{duel.teamA}</span>
              </div>
              <div className="flex flex-col items-center px-2">
                <span className="font-black text-4xl drop-shadow-md">{matchDetails.goals.home ?? 0} - {matchDetails.goals.away ?? 0}</span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">
                  {matchDetails.fixture.status.elapsed ? `${matchDetails.fixture.status.elapsed}${matchDetails.fixture.status.extra ? `+${matchDetails.fixture.status.extra}` : ''}'` : matchDetails.fixture.status.short}
                </span>
              </div>
              <div className="flex flex-col items-center gap-2 flex-1">
                <img src={matchDetails.teams.away.logo} alt={matchDetails.teams.away.name} className="w-12 h-12 object-contain drop-shadow-lg" />
                <span className={`text-lg font-black italic uppercase text-center leading-tight ${progress < 50 ? 'text-orange-500' : 'text-white/80'}`}>{duel.teamB}</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-center w-full px-4 text-2xl font-black italic uppercase">
              <span className={`text-center flex-1 leading-tight ${progress > 50 ? 'text-orange-500' : 'text-white/80'}`}>{duel.teamA}</span>
              <span className="text-gray-500 px-4 text-sm">VS</span>
              <span className={`text-center flex-1 leading-tight ${progress < 50 ? 'text-orange-500' : 'text-white/80'}`}>{duel.teamB}</span>
            </div>
          )}
        </div>

        {/* Tug of War Bar */}
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

        {/* Action Button */}
        <div className="relative mt-2">
          <motion.button 
            onClick={handleAction}
            disabled={!!winner || isButtonFrozen}
            animate={{ 
              x: buttonPosition.x, 
              y: buttonPosition.y,
              scale: isButtonShrunk ? 0.5 : isButtonHidden ? 0 : 1,
              opacity: isButtonHidden ? 0 : 1,
              filter: isButtonFrozen ? 'hue-rotate(180deg) brightness(1.2)' : 'none'
            }}
            className={`w-40 h-40 sm:w-48 sm:h-48 rounded-full border-8 border-white/10 shadow-2xl flex flex-col items-center justify-center transition-transform active:scale-95 disabled:opacity-50 relative z-10 ${isButtonFrozen ? 'bg-blue-400' : 'bg-orange-600 hover:bg-orange-700'}`}
          >
            {isButtonFrozen ? (
              <>
                <Snowflake className="w-12 h-12 text-white animate-pulse" />
                <span className="font-black italic text-xl uppercase mt-2">GELÉ !</span>
              </>
            ) : (
              <>
                <span className="font-black italic text-2xl uppercase">Cliquer</span>
                <span className="text-xs uppercase font-bold opacity-70">Ferveur +0.5%</span>
              </>
            )}
          </motion.button>

          {isFakeButtons && (
            <>
              <motion.button 
                initial={{ x: -100, y: -100, opacity: 0 }}
                animate={{ x: -150, y: -100, opacity: 0.8 }}
                className="absolute w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-orange-600/50 border-4 border-white/10 flex items-center justify-center z-0"
              >
                <span className="font-black italic text-[10px] uppercase">Cliquer</span>
              </motion.button>
              <motion.button 
                initial={{ x: 100, y: 100, opacity: 0 }}
                animate={{ x: 150, y: 100, opacity: 0.8 }}
                className="absolute w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-orange-600/50 border-4 border-white/10 flex items-center justify-center z-0"
              >
                <span className="font-black italic text-[10px] uppercase">Cliquer</span>
              </motion.button>
            </>
          )}
        </div>
      </div>

      {/* Bottom Section: Status, Cards, Excitement */}
      <div className="mt-auto pt-4 flex flex-col gap-3">
        {/* Status Indicators */}
        <div className="flex flex-wrap justify-center gap-2">
          {isBlurred && <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase"><EyeOff size={12} /> Vue Troublée</div>}
          {isButtonHidden && <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase"><Ghost size={12} /> Bouton Invisible</div>}
          {isButtonFrozen && <div className="flex items-center gap-1 text-[10px] font-bold text-blue-400 uppercase"><Snowflake size={12} /> Bouton Gelé</div>}
          {isButtonShrunk && <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase"><Minimize2 size={12} /> Bouton Réduit</div>}
          {isButtonMoving && <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase"><Move size={12} /> Bouton Fou</div>}
          {isDoublePoints && <div className="flex items-center gap-1 text-[10px] font-bold text-orange-500 uppercase"><img src={LOGOS.energy} alt="Energy" className="w-3 h-3 object-contain" /> Double Ferveur</div>}
          {hasShield && <div className="flex items-center gap-1 text-[10px] font-bold text-blue-500 uppercase"><Shield size={12} /> Bouclier Actif</div>}
          {hasMirror && <div className="flex items-center gap-1 text-[10px] font-bold text-purple-500 uppercase"><RefreshCw size={12} /> Miroir Actif</div>}
          {isEnergyRegenBoosted && <div className="flex items-center gap-1 text-[10px] font-bold text-yellow-500 uppercase"><img src={LOGOS.energy} alt="Energy" className="w-3 h-3 object-contain" /> Regen Boost</div>}
          {isEarthquake && <div className="flex items-center gap-1 text-[10px] font-bold text-red-500 uppercase"><Activity size={12} /> Séisme</div>}
          {isCardLocked && <div className="flex items-center gap-1 text-[10px] font-bold text-red-500 uppercase"><Lock size={12} /> Cartes Bloquées</div>}
        </div>

        {/* Cards Hand */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar snap-x justify-center">
          <AnimatePresence>
            {hand.map(card => {
              const userCard = userCards[card.id] || { level: 1, xp: 0 };
              const xpForNextLevel = userCard.level * 10;
              const xpProgress = (userCard.xp / xpForNextLevel) * 100;
              const actualCost = card.energyCost > 10 ? Math.max(1, Math.round(card.energyCost / 10)) : card.energyCost;

              return (
                <motion.div
                  key={card.id}
                  layout
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -50, opacity: 0 }}
                  whileHover={{ y: -5 }}
                  onClick={(e) => playCard(card, e)}
                  className={`min-w-[85px] w-[85px] h-[135px] snap-center shrink-0 rounded-lg border-2 p-2 flex flex-col cursor-pointer transition-colors relative ${
                    excitement >= actualCost ? 'border-yellow-500 bg-yellow-600/10' : 'border-white/10 bg-white/5 opacity-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[8px] uppercase font-bold text-yellow-500 truncate pr-1">{card.rarity.substring(0, 3)}</span>
                    <div className="flex items-center gap-0.5 text-[10px] font-black text-yellow-500">
                      ⚡{actualCost}
                    </div>
                  </div>
                  <h5 className="font-black italic uppercase text-[10px] leading-tight mb-1 line-clamp-2">{card.name}</h5>
                  <p className="text-[8px] text-gray-400 flex-1 line-clamp-3 leading-tight">{card.description}</p>
                  
                  <div className="mt-1 flex justify-between items-center">
                    <div className="flex items-center gap-0.5 text-[8px] font-black text-yellow-500 uppercase">
                      Niv.{userCard.level}
                    </div>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-1">
                    <div 
                      className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(xpProgress, 100)}%` }}
                    />
                  </div>

                  <div className="mt-1 pt-1 border-t border-white/10 text-center font-black text-orange-500">
                    {card.effects.map(e => (
                      <div key={e.type} className="text-[8px] uppercase truncate">
                        {e.type === 'push_rope' ? `+${Math.round(e.value * (1 + (userCard.level - 1) * 0.2))}%` : e.type.replace('_', ' ')}
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Excitement Gauge */}
        <div className="flex flex-col items-center gap-1 px-2 pb-2">
          <div className="flex justify-between w-full px-1">
            <span className="text-yellow-500 font-black text-[10px] italic uppercase tracking-wider">Excitation</span>
            <span className="text-yellow-400 font-black text-xs">{Math.floor(excitement)}/10</span>
          </div>
          <div className="flex gap-1 w-full justify-center">
            {Array.from({ length: 10 }).map((_, i) => (
              <div 
                key={i} 
                className={`flex-1 h-3 rounded-sm skew-x-[-15deg] transition-all duration-300 ${
                  i < Math.floor(excitement) 
                    ? 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)]' 
                    : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Duel Result Modal */}
      <AnimatePresence>
        {duelResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-gray-900 border-2 border-orange-500 rounded-3xl p-8 max-w-sm w-full text-center shadow-[0_0_50px_rgba(255,102,0,0.3)]"
            >
              <h2 className={`text-5xl font-black italic uppercase mb-2 ${duelResult.winner === (myTeam || participants.find(p => p.uid === user.uid)?.team || 'A') ? 'text-orange-500' : 'text-gray-500'}`}>
                {duelResult.winner === (myTeam || participants.find(p => p.uid === user.uid)?.team || 'A') ? 'Victoire !' : 'Défaite'}
              </h2>
              
              <div className="space-y-4 my-8">
                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                  <p className="text-sm text-gray-400 font-bold uppercase mb-1">Gains du Fanz</p>
                  <p className="text-3xl font-black text-yellow-400">+{duelResult.ferveurGain} XP</p>
                </div>
                
                {duelResult.teamGain > 0 && (
                  <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                    <p className="text-sm text-gray-400 font-bold uppercase mb-1">Gains de l'Équipe</p>
                    <p className="text-3xl font-black text-orange-400">+{duelResult.teamGain} XP</p>
                  </div>
                )}
                
                {duelResult.scoreA !== undefined && duelResult.scoreB !== undefined && (
                  <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 col-span-2">
                    <p className="text-sm text-gray-400 font-bold uppercase mb-2 text-center">Score du Duel</p>
                    <div className="flex justify-between items-center">
                      <div className="text-center">
                        <p className="text-sm text-gray-400">{teamA || 'Équipe A'}</p>
                        <p className={`text-2xl font-black ${duelResult.scoreA > duelResult.scoreB ? 'text-green-400' : 'text-white'}`}>{duelResult.scoreA}</p>
                      </div>
                      <div className="text-2xl font-black text-gray-600">-</div>
                      <div className="text-center">
                        <p className="text-sm text-gray-400">{teamB || 'Équipe B'}</p>
                        <p className={`text-2xl font-black ${duelResult.scoreB > duelResult.scoreA ? 'text-green-400' : 'text-white'}`}>{duelResult.scoreB}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <Button 
                  onClick={onExit}
                  className="w-full py-4 text-lg"
                >
                  {duel.matchId === 'global' ? 'Quitter' : 'Retour au match'}
                </Button>
                {duel.type === 'training' && (
                  <Button 
                    onClick={() => window.location.reload()}
                    variant="outline"
                    className="w-full py-4 text-lg border-orange-500/50 text-orange-500"
                  >
                    Rejouer
                  </Button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </div>
  );
}
