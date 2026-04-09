import { footballApi } from '../services/footballApi';
import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { useSocket } from '../context/SocketContext';
import { Duel, UserProfile, Card as GameCard, CardEffect, UserCard, Fanz, FanzTemplate, DuelConfig, FanzStats, FanzEmote } from '../types';
import { Card, Button } from './Layout';
import { motion, AnimatePresence } from 'motion/react';
import { Swords, ChevronLeft, EyeOff, Ghost, Minimize2, Move, ChevronUp, Shield, RefreshCw, Activity, Lock, Flame, Brain, Star, Users, Search, Trophy, Target, CreditCard, Layers, Snowflake, MessageCircle, AlertCircle } from 'lucide-react';
import { BASE_CARDS } from '../constants/cards';
import { LOGOS } from '../constants';
import { getImageUrl } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, updateDoc, setDoc, collection, getDocs, increment, query, where } from 'firebase/firestore';
import { logTransaction } from '../services/transactionService';
import { ErrorBoundary } from './ErrorBoundary';
import { useAlert } from '../context/AlertContext';

export function DuelManager({ user, matchId, teamA, teamB, teamAId, teamBId, teamALogo, teamBLogo, onExit, initialDuelId, initialDuelType, isLiveMatch = true, isPrivate = false, onNavigateToFanz }: { user: UserProfile; matchId: string; teamA: string; teamB: string; teamAId?: string; teamBId?: string; teamALogo?: string; teamBLogo?: string; onExit: () => void; initialDuelId?: string; initialDuelType?: string; isLiveMatch?: boolean; isPrivate?: boolean; onNavigateToFanz?: (fanzId: string) => void }) {
  const { showAlert } = useAlert();
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
  const [showDeckError, setShowDeckError] = useState(false);

  useEffect(() => {
    if (joiningDuelId) {
      const fetchDuelData = async () => {
        try {
          const res = await fetch(`/api/duels`);
          if (res.ok) {
            const allDuels = await res.json();
            const duel = allDuels.find((d: any) => d.id === joiningDuelId);
            if (duel) {
              // Check if user is already a participant
              const existingParticipant = duel.participants.find((p: any) => p.uid === user.uid);
              if (existingParticipant) {
                // User is already in this duel, jump straight to it
                setActiveDuel({
                  id: duel.id,
                  type: duel.type,
                  status: duel.status,
                  matchId: duel.matchId,
                  teamA: teamA,
                  teamB: teamB,
                  progress: duel.progress,
                  participants: duel.participants,
                  createdAt: duel.createdAt,
                  isPrivate: duel.isPrivate,
                  inviteCode: duel.inviteCode
                });
                return;
              }

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
  }, [joiningDuelId, teamA, teamB, user.uid]);

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
        const templatesSnap = await getDocs(collection(db, 'fanz_templates'));
        const templatesMap = new Map(templatesSnap.docs.map(d => [d.id, d.data()]));

        const fanzList = fanzSnap.docs.map(d => {
          const data = d.data() as Fanz;
          const template = templatesMap.get(data.templateId) as any;
          return {
            ...data,
            id: d.id,
            name: data.name || template?.name || 'Unknown Fanz',
            imageUrl: data.imageUrl || template?.image || null,
          };
        });
        setUserFanzs(fanzList);
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
      showAlert({ type: 'error', title: 'Veuillez sélectionner un Fanz et une équipe !' });
      return;
    }

    const selectedFanz = userFanzs.find(f => f.id === selectedFanzId);
    if (!selectedFanz || !selectedFanz.equippedCards || selectedFanz.equippedCards.length < 8) {
      setShowDeckError(true);
      return;
    }

    const cost = duelConfig.costs[type as keyof typeof duelConfig.costs] || { money: 0, energy: 0 };
    if (user.money < cost.money || user.energy < cost.energy) {
      showAlert({ type: 'error', title: 'Fonds ou énergie insuffisants !' });
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
    return (
      <ErrorBoundary onReset={() => setActiveDuel(null)}>
        <DuelScreen 
          duel={activeDuel} 
          user={user} 
          fanzId={selectedFanzId!} 
          teamA={teamA} 
          teamB={teamB} 
          teamAId={teamAId} 
          teamBId={teamBId} 
          teamALogo={teamALogo} 
          teamBLogo={teamBLogo} 
          selectedTeam={selectedTeam!} 
          onExit={(status) => {
            onExit(); // Always exit completely back to MatchDetails
          }} 
        />
      </ErrorBoundary>
    );
  }

  return (
    <div className="absolute inset-0 z-50 flex justify-center bg-[#1a1a1a] overflow-y-auto">
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
              <Star size={16} className="sm:w-5 sm:h-5" />
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-gray-300">0. Choisir votre FANZ</h3>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar snap-x">
              {userFanzs.map(fanz => (
                <button
                  key={fanz.id}
                  onClick={() => setSelectedFanzId(fanz.id)}
                  className={`flex-none w-[calc(50%-6px)] sm:w-[calc(33.333%-8px)] p-0 overflow-hidden rounded-xl border-2 transition-all flex flex-col snap-start ${
                    selectedFanzId === fanz.id ? 'border-[#f97316] bg-[#f97316]/10' : 'border-white/5 bg-white/5'
                  }`}
                >
                  <div className="w-full aspect-square p-0 bg-black/40">
                    <img src={getImageUrl(fanz.imageUrl)} alt={fanz.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-2 text-center">
                    <p className="text-[10px] sm:text-xs font-black uppercase truncate text-white">{fanz.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Team Selection */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-[#f97316] mb-2">
              <Trophy size={16} className="sm:w-5 sm:h-5" />
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-gray-300">1. Choisir votre camp</h3>
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
                    className={`flex-1 flex flex-col items-center justify-center p-4 sm:p-6 rounded-2xl border-2 transition-all relative ${
                      selectedTeam === team.name ? 'border-[#f97316] bg-[#f97316]/10' : isFull ? 'border-white/5 bg-black/20 opacity-50' : 'border-white/5 bg-[#1e1e1e]'
                    }`}
                  >
                    {isFull && (
                      <div className="absolute top-2 right-2 bg-red-600 text-[8px] sm:text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest text-white shadow-lg">
                        Complet
                      </div>
                    )}
                    {team.logo ? (
                      <img src={team.logo} alt={team.name} className="w-12 h-12 sm:w-16 sm:h-16 object-contain mb-2" />
                    ) : (
                      <Shield className="w-12 h-12 sm:w-16 sm:h-16 text-gray-600 mb-2" />
                    )}
                    <span className="text-[10px] sm:text-xs font-black uppercase text-center text-white">{team.name}</span>
                    {joiningDuelData && (
                      <div className="mt-2 text-[8px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-widest">
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
                <Target size={16} className="sm:w-5 sm:h-5" />
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-gray-300">2. Sélectionner l'arène</h3>
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
                      className={`relative overflow-hidden rounded-xl border-2 transition-all text-left min-h-[110px] sm:min-h-[130px] group p-0 ${
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
                      
                      <div className="relative z-10 p-3 sm:p-4 h-full flex flex-col justify-between">
                        <div>
                          <h4 className="font-black text-white text-[11px] sm:text-xs uppercase leading-tight">{arena.title}</h4>
                          <p className="text-[9px] sm:text-[10px] font-bold text-gray-300 uppercase mt-0.5">{arena.subtitle}</p>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <div className="flex items-center gap-1 text-yellow-500 font-black text-xs sm:text-sm">
                            {cost.energy} ⚡
                          </div>
                          <div className="flex items-center gap-1 text-green-500 font-black text-xs sm:text-sm">
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
              <Activity size={16} className="sm:w-5 sm:h-5" />
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-gray-300">Votre impact estimé</h3>
            </div>
            <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl p-5 sm:p-6">
              <div className="space-y-3 sm:space-y-4 mb-5 sm:mb-6">
                <div className="flex justify-between items-center text-[10px] sm:text-xs font-bold uppercase">
                  <span className="text-gray-400">Base Arène</span>
                  <span className="text-white">{baseArena.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] sm:text-xs font-bold uppercase">
                  <span className="text-gray-400">Bonus Joueur (Excitation)</span>
                  <span className={Number(bonusJoueurPct) >= 0 ? "text-green-500" : "text-red-500"}>
                    {Number(bonusJoueurPct) > 0 ? '+' : ''}{bonusJoueurPct}%
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] sm:text-xs font-bold uppercase">
                  <span className="text-[#f97316]">Maitrise Fan (L.{selectedFanz?.level || 1})</span>
                  <span className="text-[#f97316]">+{maitriseFanPct}%</span>
                </div>
                <div className="flex justify-between items-center text-[10px] sm:text-xs font-bold uppercase">
                  <span className="text-gray-400">Équipement & Synergie</span>
                  <span className="text-gray-500">+0%</span>
                </div>
              </div>
              <div className="pt-5 sm:pt-6 border-t border-white/10 text-center">
                <div className="text-3xl sm:text-4xl font-black text-white mb-1">{totalImpact}</div>
                <div className="text-[10px] sm:text-xs font-bold text-[#f97316] uppercase tracking-widest">Pts par clic</div>
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

      {/* Deck Error Modal */}
      <AnimatePresence>
        {showDeckError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-gray-900 border-2 border-red-500 rounded-3xl p-8 max-w-sm w-full text-center shadow-[0_0_50px_rgba(239,68,68,0.3)]"
            >
              <div className="w-20 h-20 mx-auto bg-red-500/20 rounded-full flex items-center justify-center mb-6">
                <AlertCircle className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-2xl font-black italic uppercase mb-4 text-white">
                Deck Incomplet
              </h2>
              <p className="text-gray-400 font-bold mb-8">
                Votre Fanz doit avoir 8 cartes dans son deck pour lancer un duel !
              </p>
              
              <div className="flex flex-col gap-3">
                <Button 
                  onClick={() => {
                    setShowDeckError(false);
                    if (onNavigateToFanz && selectedFanzId) {
                      onNavigateToFanz(selectedFanzId);
                    } else {
                      onExit();
                    }
                  }}
                  className="w-full py-4 text-lg bg-orange-600 hover:bg-orange-500"
                >
                  Mettre à jour mon deck
                </Button>
                <Button 
                  onClick={() => setShowDeckError(false)}
                  variant="outline"
                  className="w-full py-4 text-lg border-gray-700 text-gray-400 hover:bg-gray-800"
                >
                  Annuler
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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

export function DuelScreen({ duel, user, onExit, fanzId, teamA, teamB, teamAId, teamBId, teamALogo, teamBLogo, selectedTeam }: { duel: Duel; user: UserProfile; onExit: (status?: string) => void, fanzId: string, teamA?: string, teamB?: string, teamAId?: string, teamBId?: string, teamALogo?: string, teamBLogo?: string, selectedTeam: string }) {
  const { showAlert } = useAlert();
  const [progress, setProgress] = useState(50);
  const [excitement, setExcitement] = useState(5);
  const maxExcitement = 10;
  const { socket } = useSocket();
  const [winner, setWinner] = useState<string | null>(null);
  const [duelResult, setDuelResult] = useState<{ winner: string, ferveurGain: number, teamGain: number, scoreA?: number, scoreB?: number, details?: any } | null>(null);
  const [status, setStatus] = useState<'waiting' | 'starting' | 'active' | 'finished'>(duel.status);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [inviteCode, setInviteCode] = useState(duel.inviteCode);
  const [participants, setParticipants] = useState<any[]>(duel.participants || []);
  const [currentDuelId, setCurrentDuelIdState] = useState<string>(duel.id);
  const currentDuelIdRef = useRef(duel.id);
  const [floatingEffects, setFloatingEffects] = useState<FloatingEffect[]>([]);
  const [matchDetails, setMatchDetails] = useState<any>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [playedCardAnim, setPlayedCardAnim] = useState<{ card: GameCard, id: string } | null>(null);
  const [enemyPlayedCardAnim, setEnemyPlayedCardAnim] = useState<{ card: GameCard, id: string } | null>(null);

  const handleExitRequest = () => {
    if (status === 'finished') {
      onExit(status);
    } else {
      setShowExitConfirm(true);
    }
  };

  const confirmExit = () => {
    socket?.emit('leave-duel', { duelId: currentDuelIdRef.current, userId: user.uid });
    onExit(status);
  };

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

  // Emotes State
  const [allEmotes, setAllEmotes] = useState<FanzEmote[]>([]);
  const [showEmotes, setShowEmotes] = useState(false);
  const [activeEmotes, setActiveEmotes] = useState<{id: string, emoteId: string, team: string, x: number, y: number}[]>([]);

  // Preload card images
  useEffect(() => {
    if (allCards.length > 0) {
      allCards.forEach(card => {
        if (card.imageUrl) {
          const img = new Image();
          img.src = getImageUrl(card.imageUrl);
        }
      });
    }
  }, [allCards]);

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

        // Fetch Emotes
        const templatesSnap = await getDocs(collection(db, 'fanz_templates'));
        const emotes: FanzEmote[] = [];
        templatesSnap.forEach(doc => {
          const template = doc.data() as FanzTemplate;
          if (template.emotes) {
            emotes.push(...template.emotes);
          }
        });
        
        try {
          const emotesSnap = await getDocs(collection(db, 'emotes'));
          emotesSnap.forEach(doc => {
            emotes.push({ id: doc.id, ...doc.data() } as FanzEmote);
          });
        } catch (e) {
          console.warn("Could not fetch from emotes collection", e);
        }
        
        setAllEmotes(emotes);

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
  const myTeamRef = useRef<'A' | 'B' | null>(null);
  const participantsRef = useRef<any[]>(duel.participants || []);
  const fanzRef = useRef<Fanz | null>(null);
  const duelConfigRef = useRef<DuelConfig | null>(null);

  // Update refs when state changes
  useEffect(() => { myTeamRef.current = myTeam; }, [myTeam]);
  useEffect(() => { participantsRef.current = participants; }, [participants]);
  useEffect(() => { fanzRef.current = fanz; }, [fanz]);
  useEffect(() => { duelConfigRef.current = duelConfig; }, [duelConfig]);

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
    if (!socket) return;

    const joinDuel = () => {
      socket.emit('join-duel', { 
        duelId: currentDuelIdRef.current, 
        user, 
        fanz, 
        type: duel.type,
        matchId: duel.matchId,
        team: selectedTeam === teamA ? 'A' : 'B',
        isPrivate: duel.isPrivate,
        inviteCode: duel.inviteCode
      });
    };

    if (socket.connected) {
      joinDuel();
    } else {
      socket.on('connect', joinDuel);
    }

    const handleDuelJoined = ({ team, duelId: serverDuelId, participants: serverParticipants, inviteCode: serverInviteCode }: { team: 'A' | 'B', duelId: string, participants: any[], inviteCode?: string }) => {
      setMyTeam(team);
      setCurrentDuelId(serverDuelId);
      if (serverParticipants) setParticipants(serverParticipants);
      if (serverInviteCode) setInviteCode(serverInviteCode);
    };
    socket.on('duel-joined', handleDuelJoined);

    const handleDuelUpdate = (state: { duelId?: string; progress: number; status: any; participants?: any[]; inviteCode?: string }) => {
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
    };
    socket.on('duel-update', handleDuelUpdate);

    const handleDuelStarting = ({ startTime }: { startTime: number }) => {
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
    };
    socket.on('duel-starting', handleDuelStarting);

    const handleDuelStarted = () => {
      setStatus('active');
    };
    socket.on('duel-started', handleDuelStarted);

    const handleDuelFinished = async ({ winner, scoreA, scoreB, details }: { winner: string, scoreA: number, scoreB: number, details?: any }) => {
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
            
            const currentParticipants = participantsRef.current;
            const myParticipant = currentParticipants.find(p => p.uid === user.uid);
            const currentMyTeam = myTeamRef.current || myParticipant?.team || 'A';
            const isWin = winner === currentMyTeam;
            const duelType = duel.type as keyof NonNullable<DuelConfig['rewards']>;
            
            // Get base rewards from config or use defaults
            const baseWinXp = configData?.rewards?.[duelType]?.winXp ?? (duelType === 'training' ? 5 : duelType === '1v1' ? 10 : duelType === '2v2' ? 20 : duelType === '5v5' ? 300 : 10);
            const baseLoseXp = configData?.rewards?.[duelType]?.loseXp ?? (duelType === 'training' ? 5 : duelType === '1v1' ? 10 : duelType === '2v2' ? 20 : duelType === '5v5' ? 30 : 10);
            
            let ferveurGainFanz = 0;
            let ferveurGainGeneral = 0;
            
            if (isWin) {
              const rankBonus = 1 + (fanzData.rank ?? 0) * 0.02;
              
              // Calculate socialBonus using configData and fanzData directly instead of getStatEffectValue
              let socialBonus = 0;
              if (configData && fanzData) {
                const effect = configData.statEffects.find(e => e.effectType === 'ferveur_bonus');
                if (effect) {
                  const statLevel = (fanzData.stats as any)[effect.statName] || 1;
                  socialBonus = effect.baseValue + (statLevel * effect.multiplierPerLevel);
                }
              }
              
              // Favorite team bonus
              const isFavoriteTeam = (selectedTeam === teamA && userData.favoriteTeams?.includes(teamAId || teamA)) || 
                                     (selectedTeam === teamB && userData.favoriteTeams?.includes(teamBId || teamB));
              const favoriteBonus = isFavoriteTeam ? 1.2 : 1.0; // +20% bonus

              ferveurGainFanz = Math.round(baseWinXp * (rankBonus + socialBonus) * favoriteBonus);
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
            const myScore = currentMyTeam === 'A' ? scoreA : scoreB;
            if (ferveurGainGeneral > 0 || myScore > 0) {
              let newUserPoints = (userData.ferveurPoints || 0) + ferveurGainGeneral;
              const updates: any = {
                ferveurPoints: newUserPoints,
                totalScoreGiven: increment(myScore),
                matchesParticipated: increment(1)
              };
              if (userData.purchasedPasses && userData.purchasedPasses.length > 0 && ferveurGainGeneral > 0) {
                updates.passPoints = increment(ferveurGainGeneral);
              }
              await updateDoc(userRef, updates);
              if (ferveurGainGeneral > 0) {
                await logTransaction(
                  user.uid,
                  'ferveur_general',
                  ferveurGainGeneral,
                  'Victoire en duel'
                );
              }
            }

            // Update Team Stats
            const myTeamId = currentMyTeam === 'A' ? teamAId || teamA : teamBId || teamB;
            if (myTeamId) {
              const teamRef = doc(db, 'teams', myTeamId);
              const teamDoc = await getDoc(teamRef);
              if (teamDoc.exists()) {
                await updateDoc(teamRef, {
                  ferveurEarned: increment(ferveurGainGeneral),
                  totalScoreGiven: increment(myScore),
                  matchesPlayed: increment(1)
                });
              } else {
                // Fetch leagues for this team
                let leagueIds: number[] = [];
                if (!isNaN(Number(myTeamId))) {
                  try {
                    const { footballApi } = await import('../services/footballApi');
                    const leaguesData = await footballApi.getLeaguesByTeam(Number(myTeamId));
                    leagueIds = leaguesData.map((l: any) => l.league.id);
                  } catch (e) {
                    console.error("Failed to fetch leagues for team", e);
                  }
                }

                await setDoc(teamRef, {
                  name: currentMyTeam === 'A' ? teamA : teamB,
                  logo: currentMyTeam === 'A' ? teamALogo : teamBLogo,
                  userCount: 0,
                  averageFerveur: 0,
                  ferveurEarned: ferveurGainGeneral,
                  totalScoreGiven: myScore,
                  matchesPlayed: 1,
                  leagueIds: leagueIds
                });
              }
            }

            // Update Rankings (Season & League)
            try {
              const { runTransaction } = await import('firebase/firestore');
              
              // Fetch match details here if not available in state to ensure we have league info
              let currentMatchDetails = matchDetails;
              if (!currentMatchDetails && duel.matchId && duel.matchId !== 'global') {
                try {
                  const { footballApi } = await import('../services/footballApi');
                  currentMatchDetails = await footballApi.getFixtureDetails(parseInt(duel.matchId));
                } catch (e) {
                  console.error("Failed to fetch match details for ranking", e);
                }
              }

              const season = currentMatchDetails?.league?.season?.toString() || new Date().getFullYear().toString();
              const leagueId = currentMatchDetails?.league?.id?.toString() || 'global';

              const updateRanking = async (collectionName: string, entityIdField: string, entityId: string, seasonStr: string, leagueIdStr: string, scoreToAdd: number) => {
                const docId = `${entityId}_${seasonStr}_${leagueIdStr}`;
                const docRef = doc(db, collectionName, docId);

                await runTransaction(db, async (transaction) => {
                  const docSnap = await transaction.get(docRef);
                  let totalScore = scoreToAdd;
                  let matches = 1;

                  if (docSnap.exists()) {
                    const data = docSnap.data();
                    totalScore = (data.totalScore || 0) + scoreToAdd;
                    matches = (data.matches || 0) + 1;
                  }

                  const averageScore = totalScore / matches;

                  transaction.set(docRef, {
                    [entityIdField]: entityId,
                    season: seasonStr,
                    leagueId: leagueIdStr,
                    totalScore,
                    matches,
                    averageScore,
                    updatedAt: new Date().toISOString()
                  }, { merge: true });
                });
              };

              // User Rankings
              await updateRanking('ranking_users', 'userId', user.uid, season, 'global', myScore);
              if (leagueId !== 'global') {
                await updateRanking('ranking_users', 'userId', user.uid, season, leagueId, myScore);
              }

              // Team Rankings
              if (myTeamId) {
                await updateRanking('ranking_teams', 'teamId', myTeamId, season, 'global', myScore);
                if (leagueId !== 'global') {
                  await updateRanking('ranking_teams', 'teamId', myTeamId, season, leagueId, myScore);
                }
              }

              // Record opponent team score if it's a bot (to ensure all teams get ranked)
              const opponentTeam = currentMyTeam === 'A' ? 'B' : 'A';
              const isOpponentBot = !currentParticipants.some(p => p.team === opponentTeam);
              if (isOpponentBot) {
                const opponentTeamId = opponentTeam === 'A' ? (teamAId || teamA) : (teamBId || teamB);
                const opponentScore = opponentTeam === 'A' ? scoreA : scoreB;
                if (opponentTeamId) {
                  await updateRanking('ranking_teams', 'teamId', opponentTeamId, season, 'global', opponentScore);
                  if (leagueId !== 'global') {
                    await updateRanking('ranking_teams', 'teamId', opponentTeamId, season, leagueId, opponentScore);
                  }
                }
              }
            } catch (rankingError) {
              console.error("Error updating rankings", rankingError);
            }
            
            ferveurGain = ferveurGainFanz;
            teamGain = ferveurGainGeneral;
          }
        } catch (e) {
          console.error("Error updating ferveur", e);
        }
      }
      
      setDuelResult({ winner, ferveurGain, teamGain, scoreA, scoreB, details });
    };
    socket.on('duel-finished', handleDuelFinished);

    const handleEnemyCardPlayed = ({ card }: { team: string, card: GameCard }) => {
      setLastEnemyCard(card);
      setEnemyPlayedCardAnim({ card, id: Math.random().toString() });
      setTimeout(() => setEnemyPlayedCardAnim(null), 2000);
      addFloatingEffect(`⚠️ ${card.name}`, window.innerWidth / 2, 100, 'text-red-500 font-black scale-125');

      const isMalus = card.effects.some(e => 
        ['drain_energy', 'hide_button', 'shrink_button', 'move_button', 'blur_view', 'hide_score', 'discard_enemy_cards', 'shuffle_deck', 'freeze_button', 'earthquake', 'fake_buttons', 'card_lock'].includes(e.type)
      );

      if (isMalus) {
        if (hasMirror) {
          setHasMirror(false);
          addFloatingEffect('✨ Miroir: Attaque renvoyée!', window.innerWidth / 2, 150, 'text-purple-400 font-black');
          socket?.emit('play-card', { duelId: currentDuelIdRef.current, team: myTeam || 'A', card, reflected: true });
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
    };
    socket.on('enemy-card-played', handleEnemyCardPlayed);

    const handleSwapHandsRequest = ({ fromTeam, opponentHand }: { fromTeam: string, opponentHand: GameCard[] }) => {
      const myParticipant = participants.find(p => p.uid === user.uid);
      const myTeam = myParticipant?.team || 'A';
      
      if (fromTeam !== myTeam) {
        // We are the target, we receive the opponent's hand and send ours
        const myCurrentHand = [...hand];
        setHand(opponentHand);
        socket.emit('swap-hands-response', { duelId: currentDuelIdRef.current, team: myTeam, hand: myCurrentHand });
        addFloatingEffect('🔄 Mains Échangées!', window.innerWidth / 2, 250, 'text-blue-400 font-black');
      }
    };
    socket.on('swap-hands-request', handleSwapHandsRequest);

    const handleSwapHandsComplete = ({ newHand }: { newHand: GameCard[] }) => {
      setHand(newHand);
      addFloatingEffect('🔄 Mains Échangées!', window.innerWidth / 2, 250, 'text-blue-400 font-black');
    };
    socket.on('swap-hands-complete', handleSwapHandsComplete);

    const handleReceiveEmote = ({ team, emoteId, senderId }: { team: string, emoteId: string, senderId: string }) => {
      const id = Math.random().toString(36).substring(7);
      // Random position roughly in the middle of the screen
      const x = window.innerWidth / 2 + (Math.random() * 100 - 50);
      const y = window.innerHeight / 2 + (Math.random() * 100 - 50);
      
      setActiveEmotes(prev => [...prev, { id, emoteId, team, x, y }]);
      setTimeout(() => {
        setActiveEmotes(prev => prev.filter(e => e.id !== id));
      }, 3000);
    };
    socket.on('receive-emote', handleReceiveEmote);

    return () => {
      socket.off('connect', joinDuel);
      socket.off('duel-joined', handleDuelJoined);
      socket.off('duel-update', handleDuelUpdate);
      socket.off('duel-starting', handleDuelStarting);
      socket.off('duel-started', handleDuelStarted);
      socket.off('duel-finished', handleDuelFinished);
      socket.off('enemy-card-played', handleEnemyCardPlayed);
      socket.off('swap-hands-request', handleSwapHandsRequest);
      socket.off('swap-hands-complete', handleSwapHandsComplete);
      socket.off('receive-emote', handleReceiveEmote);
    };
  }, [socket, duel.id]);

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
    
    setPlayedCardAnim({ card, id: Math.random().toString() });
    setTimeout(() => setPlayedCardAnim(null), 1500);

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
    <div className="absolute inset-0 z-50 flex justify-center bg-[#0a0a0a]">
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
        <div className="flex justify-between items-center mb-2 relative z-50">
          <button onClick={handleExitRequest} className="p-2 hover:bg-white/10 rounded-full">
            <ChevronLeft />
          </button>
          <div className="text-[10px] text-yellow-500 font-black uppercase tracking-widest">
            {duel.type.replace('_', ' ')}
          </div>
          <div className="relative">
            <button 
              onClick={() => setShowEmotes(!showEmotes)}
              className="p-2 hover:bg-white/10 rounded-full text-white"
            >
              <MessageCircle className="w-5 h-5" />
            </button>
            {showEmotes && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-gray-900 border border-white/10 rounded-xl p-2 grid grid-cols-4 gap-2 max-h-48 overflow-y-auto shadow-2xl z-[100]">
                {allEmotes.filter(e => user.emotes?.includes(e.id)).length > 0 ? (
                  allEmotes.filter(e => user.emotes?.includes(e.id)).map(emote => (
                    <button 
                      key={emote.id}
                      onClick={() => {
                        setShowEmotes(false);
                        const myTeam = participants.find(p => p.uid === user.uid)?.team || 'A';
                        socket?.emit('send-emote', { duelId: currentDuelIdRef.current, team: myTeam, emoteId: emote.id, senderId: user.uid });
                        // Show locally
                        const id = Math.random().toString(36).substring(7);
                        const x = window.innerWidth / 2 + (Math.random() * 100 - 50);
                        const y = window.innerHeight / 2 + (Math.random() * 100 - 50);
                        setActiveEmotes(prev => [...prev, { id, emoteId: emote.id, team: myTeam, x, y }]);
                        setTimeout(() => setActiveEmotes(prev => prev.filter(e => e.id !== id)), 3000);
                      }}
                      className="p-1.5 bg-white/5 rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center"
                    >
                      <img src={getImageUrl(emote.imageUrl)} alt={emote.name} className="w-8 h-8 object-contain" />
                    </button>
                  ))
                ) : (
                  <div className="col-span-4 text-center py-4 text-gray-500 text-[10px] font-bold">
                    Aucune emote débloquée.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Active Emotes Overlay */}
        <div className="absolute inset-0 pointer-events-none z-[70] overflow-hidden">
          <AnimatePresence>
            {activeEmotes.map(emote => {
              const emoteData = allEmotes.find(e => e.id === emote.emoteId);
              if (!emoteData) return null;
              return (
                <motion.div
                  key={emote.id}
                  initial={{ opacity: 0, scale: 0.5, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 1.5, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="absolute"
                  style={{ left: emote.x, top: emote.y }}
                >
                  <div className={`p-2 rounded-2xl ${emote.team === (participants.find(p => p.uid === user.uid)?.team || 'A') ? 'bg-blue-600/40' : 'bg-red-600/40'} backdrop-blur-sm shadow-lg`}>
                    <img src={getImageUrl(emoteData.imageUrl)} alt={emoteData.name} className="w-16 h-16 object-contain" />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

      {/* Enemy Played Card Animation */}
      <AnimatePresence>
        {enemyPlayedCardAnim && (
          <motion.div
            key={`enemy-${enemyPlayedCardAnim.id}`}
            initial={{ opacity: 0, scale: 0.5, y: -100 }}
            animate={{ opacity: 1, scale: 0.8, y: 0 }}
            exit={{ opacity: 0, scale: 1.2, y: 100 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 z-[90] pointer-events-none"
          >
            <div className="relative w-32 h-48 rounded-xl overflow-hidden border-2 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.5)] bg-[#1a1a1a]">
              {enemyPlayedCardAnim.card.imageUrl && (
                <img 
                  src={getImageUrl(enemyPlayedCardAnim.card.imageUrl)} 
                  alt={enemyPlayedCardAnim.card.name} 
                  className="absolute inset-0 w-full h-full object-cover opacity-80"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-2">
                <div className="text-[10px] font-black text-white text-center uppercase leading-tight drop-shadow-md">
                  {enemyPlayedCardAnim.card.name}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
            className="absolute inset-0 bg-[#0a0a0a] z-[60] flex flex-col overflow-hidden"
          >
            {/* Back Button */}
            <button 
              onClick={handleExitRequest} 
              className="absolute left-4 top-8 z-50 p-3 bg-black/50 hover:bg-white/10 rounded-full text-white backdrop-blur-md"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* VS Background Split */}
            <div className="absolute inset-0 flex flex-col">
              <div className="flex-1 bg-gradient-to-br from-blue-900/40 to-blue-900/10 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay"></div>
              </div>
              <div className="flex-1 bg-gradient-to-tl from-red-900/40 to-red-900/10 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay"></div>
              </div>
            </div>

            {/* VS Badge */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
              <div className="w-24 h-24 bg-black rounded-full border-4 border-orange-500 flex items-center justify-center shadow-[0_0_30px_rgba(249,115,22,0.5)]">
                <span className="text-4xl font-black italic text-orange-500">VS</span>
              </div>
            </div>

            {/* Teams Container */}
            <div className="absolute inset-0 flex flex-col z-10">
              {/* Team A (Top) */}
              <div className="flex-1 flex flex-col items-center justify-center p-4">
                <div className="flex flex-wrap justify-center gap-4 w-full max-w-lg">
                  {Array.from({ length: { '1v1': 1, '2v2': 2, '5v5': 5 }[duel.type as '1v1' | '2v2' | '5v5'] || 1 }).map((_, i) => {
                    const p = participants.filter(p => p.team === 'A')[i];
                    return (
                      <div key={`A-${i}`} className="w-28 h-40 bg-black/60 border-2 border-blue-500/50 rounded-xl overflow-hidden relative flex flex-col items-center justify-center shadow-lg backdrop-blur-sm">
                        {p ? (
                          <>
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80 z-0" />
                            <div className="relative z-10 flex flex-col items-center w-full p-2">
                              <img src={getImageUrl(p.fanz?.imageUrl) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.uid}`} className="w-16 h-16 object-contain mb-1 drop-shadow-lg" />
                              <span className="text-xs font-black text-white text-center px-1 truncate w-full">{p.pseudo}</span>
                              <span className="text-[9px] text-blue-300 font-bold uppercase mb-1">{p.fanz?.name}</span>
                              <div className="flex items-center gap-1 bg-black/50 px-2 py-1 rounded-full border border-white/10 w-full justify-center">
                                {teamALogo && <img src={teamALogo} className="w-3 h-3 object-contain" />}
                                <span className="text-[8px] font-bold text-white truncate">{teamA}</span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center opacity-50">
                            <div className="w-8 h-8 border-2 border-blue-500/50 border-t-blue-400 rounded-full animate-spin mb-2" />
                            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest text-center">En attente</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Team B (Bottom) */}
              <div className="flex-1 flex flex-col items-center justify-center p-4">
                <div className="flex flex-wrap justify-center gap-4 w-full max-w-lg">
                  {Array.from({ length: { '1v1': 1, '2v2': 2, '5v5': 5 }[duel.type as '1v1' | '2v2' | '5v5'] || 1 }).map((_, i) => {
                    const p = participants.filter(p => p.team === 'B')[i];
                    return (
                      <div key={`B-${i}`} className="w-28 h-40 bg-black/60 border-2 border-red-500/50 rounded-xl overflow-hidden relative flex flex-col items-center justify-center shadow-lg backdrop-blur-sm">
                        {p ? (
                          <>
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80 z-0" />
                            <div className="relative z-10 flex flex-col items-center w-full p-2">
                              <img src={getImageUrl(p.fanz?.imageUrl) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.uid}`} className="w-16 h-16 object-contain mb-1 drop-shadow-lg" />
                              <span className="text-xs font-black text-white text-center px-1 truncate w-full">{p.pseudo}</span>
                              <span className="text-[9px] text-red-300 font-bold uppercase mb-1">{p.fanz?.name}</span>
                              <div className="flex items-center gap-1 bg-black/50 px-2 py-1 rounded-full border border-white/10 w-full justify-center">
                                {teamBLogo && <img src={teamBLogo} className="w-3 h-3 object-contain" />}
                                <span className="text-[8px] font-bold text-white truncate">{teamB}</span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center opacity-50">
                            <div className="w-8 h-8 border-2 border-red-500/50 border-t-red-400 rounded-full animate-spin mb-2" />
                            <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest text-center">En attente</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Info & Invite */}
            <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center z-20 px-4">
              <div className="text-center mb-4">
                <h3 className="text-xl font-black italic uppercase text-white drop-shadow-md">En attente d'adversaires...</h3>
                <p className="text-gray-300 text-xs font-bold uppercase tracking-widest">Le duel commencera dès que le salon sera complet.</p>
              </div>
              
              {inviteCode && (
                <div className="bg-black/60 backdrop-blur-md p-3 rounded-xl border border-white/10 flex flex-col items-center w-full max-w-xs">
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Code d'invitation</span>
                  <div className="text-2xl font-black text-orange-500 tracking-[0.2em] mb-2">{inviteCode}</div>
                  <div className="flex gap-2 w-full">
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(inviteCode);
                        showAlert({ type: 'success', title: 'Code copié !' });
                      }}
                      className="flex-1 text-[10px] text-white bg-white/10 hover:bg-white/20 py-2 rounded-lg transition-colors font-bold uppercase"
                    >
                      Copier
                    </button>
                    {navigator.share && (
                      <button 
                        onClick={() => {
                          navigator.share({
                            title: 'Rejoins mon duel The Best Fan !',
                            text: `Rejoins mon duel avec le code: ${inviteCode}`,
                          }).catch(console.error);
                        }}
                        className="flex-1 text-[10px] text-white bg-orange-600 hover:bg-orange-500 py-2 rounded-lg transition-colors font-bold uppercase"
                      >
                        Partager
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
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
                  className={`min-w-[85px] w-[85px] h-[135px] snap-center shrink-0 rounded-lg border-2 flex flex-col cursor-pointer transition-colors relative overflow-hidden ${
                    excitement >= actualCost ? 'border-yellow-500 bg-yellow-600/10' : 'border-white/10 bg-white/5 opacity-50'
                  }`}
                >
                  {/* Background Image */}
                  {card.imageUrl && (
                    <img 
                      src={getImageUrl(card.imageUrl)} 
                      alt={card.name} 
                      className="absolute inset-0 w-full h-full object-cover z-0 opacity-50"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  {/* Gradient Overlay for readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/30 z-0" />

                  {/* Card Content */}
                  <div className="relative z-10 flex flex-col h-full p-2">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[8px] uppercase font-bold text-yellow-500 truncate pr-1 drop-shadow-md">{card.rarity.substring(0, 3)}</span>
                      <div className="flex items-center gap-0.5 text-[10px] font-black text-yellow-500 drop-shadow-md">
                        ⚡{actualCost}
                      </div>
                    </div>
                    <h5 className="font-black italic uppercase text-[10px] leading-tight mb-1 line-clamp-2 drop-shadow-md">{card.name}</h5>
                    <p className="text-[8px] text-gray-300 flex-1 line-clamp-3 leading-tight drop-shadow-md">{card.description}</p>
                    
                    <div className="mt-1 flex justify-between items-center">
                      <div className="flex items-center gap-0.5 text-[8px] font-black text-yellow-500 uppercase drop-shadow-md">
                        Niv.{userCard.level}
                      </div>
                    </div>
                    <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden mt-1">
                      <div 
                        className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(xpProgress, 100)}%` }}
                      />
                    </div>

                    <div className="mt-1 pt-1 border-t border-white/20 text-center font-black text-orange-400 drop-shadow-md">
                      {card.effects.map(e => (
                        <div key={e.type} className="text-[8px] uppercase truncate">
                          {e.type === 'push_rope' ? `+${Math.round(e.value * (1 + (userCard.level - 1) * 0.2))}%` : e.type.replace('_', ' ')}
                        </div>
                      ))}
                    </div>
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
            className="absolute inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
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
                    <div className="flex justify-between items-center mb-4">
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
                    
                    {/* Detailed Calculation */}
                    {duelResult.details && (
                      <div className="text-left border-t border-gray-700 pt-3 mt-3">
                        <p className="text-[10px] text-gray-500 font-bold uppercase mb-2 text-center">Détail du calcul</p>
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Bonus Victoire (10 pts)</span>
                            <span className="font-bold text-white">
                              {duelResult.winner === 'A' ? teamA || 'Équipe A' : teamB || 'Équipe B'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Actions (Clics + Cartes)</span>
                            <span className="font-bold text-white">{duelResult.details.totalActions}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Points proportionnels (90 pts)</span>
                            <span className="font-bold text-white">
                              {duelResult.details.proportionalPointsA} - {duelResult.details.proportionalPointsB}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <Button 
                  onClick={() => onExit(status)}
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

      {/* Played Card Animation */}
      <AnimatePresence>
        {playedCardAnim && (
          <motion.div
            key={playedCardAnim.id}
            initial={{ scale: 0.5, y: 100, opacity: 0, rotate: -10 }}
            animate={{ scale: 1.5, y: 0, opacity: 1, rotate: 0 }}
            exit={{ scale: 2, opacity: 0, filter: 'blur(10px)' }}
            transition={{ type: 'spring', damping: 15, stiffness: 200 }}
            className="absolute inset-0 z-[90] flex items-center justify-center pointer-events-none"
          >
            <div className="relative w-[120px] h-[180px] rounded-xl border-4 border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.8)] overflow-hidden bg-black">
              {playedCardAnim.card.imageUrl && (
                <img 
                  src={getImageUrl(playedCardAnim.card.imageUrl)} 
                  alt={playedCardAnim.card.name} 
                  className="absolute inset-0 w-full h-full object-cover z-0"
                  referrerPolicy="no-referrer"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-0" />
              <div className="relative z-10 flex flex-col justify-end h-full p-3 text-center">
                <h3 className="text-white font-black italic uppercase text-sm leading-tight drop-shadow-lg">
                  {playedCardAnim.card.name}
                </h3>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exit Confirmation Modal */}
      <AnimatePresence>
        {showExitConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            >
              <h3 className="text-xl font-black italic uppercase tracking-tighter text-white mb-4 text-center">
                Êtes-vous sûr de vouloir quitter ?
              </h3>
              
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
                <p className="text-sm text-red-400 text-center font-medium">
                  {duel.type === 'training' 
                    ? "Vous perdrez l'énergie et l'argent dépensé pour cet entraînement."
                    : "Vous perdrez l'énergie, l'argent et perdrez le match par forfait. Le résultat n'est pas pris en compte."}
                </p>
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button 
                  onClick={confirmExit}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white"
                >
                  Quitter
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </div>
  );
}
