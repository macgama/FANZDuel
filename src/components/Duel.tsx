import { PublicProfileModal } from './PublicProfileModal';
import { footballApi } from '../services/footballApi';
import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { useSocket } from '../context/SocketContext';
import { Duel, UserProfile, Card as GameCard, CardEffect, UserCard, Fanz, FanzTemplate, DuelConfig, FanzStats, FanzEmote, GlobalFervorConfig, Pass } from '../types';
import { Card, Button } from './Layout';
import { motion, AnimatePresence } from 'motion/react';
import { Swords, ChevronLeft, EyeOff, Ghost, Minimize2, Move, ChevronUp, Shield, RefreshCw, Activity, Lock, Flame, Brain, Star, Users, Search, Trophy, Target, CreditCard, Layers, Snowflake, MessageCircle, AlertCircle } from 'lucide-react';
import { BASE_CARDS } from '../constants/cards';
import { OptimizedMedia } from './OptimizedMedia';
import { LOGOS } from '../constants';
import { getImageUrl, getOptimizedVideoUrl } from '../lib/utils';
import { audioManager } from '../lib/audio';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, updateDoc, setDoc, collection, getDocs, increment, query, where, runTransaction, serverTimestamp } from 'firebase/firestore';
import { logTransaction } from '../services/transactionService';
import { progressMission } from '../services/missionService';
import { ErrorBoundary } from './ErrorBoundary';
import { useAlert } from '../context/AlertContext';
import { generateFervorPath } from '../utils/fervorPath';

const DEFAULT_DUEL_CONFIG: DuelConfig = {
  id: 'duel_config',
  baseExcitementRegenTime: 5,
  statEffects: [
    { statName: 'force', effectType: 'click_power', baseValue: 0.005, multiplierPerLevel: 0.001, description: 'Force : Augmente la puissance du clic (Ferveur +X%)' },
    { statName: 'endurance', effectType: 'energy_regen', baseValue: 2, multiplierPerLevel: 0.5, description: 'Endurance : Augmente la régénération d\'excitation par seconde' },
    { statName: 'mental', effectType: 'malus_duration', baseValue: 1, multiplierPerLevel: 0.1, description: 'Mental : Augmente la durée des malus infligés à l\'adversaire' },
    { statName: 'bluff', effectType: 'visual_malus_duration', baseValue: 1, multiplierPerLevel: 0.1, description: 'Bluff : Augmente la durée des effets visuels' },
    { statName: 'creativity', effectType: 'card_cost_reduction', baseValue: 0, multiplierPerLevel: 0.02, description: 'Créativité' },
    { statName: 'social', effectType: 'ferveur_bonus', baseValue: 0, multiplierPerLevel: 0.05, description: 'Social' },
    { statName: 'intelligence', effectType: 'rarity_chance', baseValue: 0, multiplierPerLevel: 0.02, description: 'Intelligence' },
    { statName: 'charisma', effectType: 'card_power', baseValue: 1, multiplierPerLevel: 0.05, description: 'Charisme' },
    { statName: 'endurance', effectType: 'max_energy', baseValue: 10, multiplierPerLevel: 1, description: 'Max Excitation' },
    { statName: 'force', effectType: 'start_energy', baseValue: 5, multiplierPerLevel: 1, description: 'Excitation départ' },
    { statName: 'mental', effectType: 'button_visibility', baseValue: 3000, multiplierPerLevel: 200, description: 'Visibilité bouton' },
    { statName: 'mental', effectType: 'button_hidden', baseValue: 2000, multiplierPerLevel: -100, description: 'Caché bouton' },
  ],
  costs: {
    training: { money: 0, energy: 0 },
    '1v1': { money: 0, energy: 0 },
    '2v2': { money: 0, energy: 0 },
    '5v5': { money: 0, energy: 0 },
    war_of_kops: { money: 0, energy: 0 }
  },
  rewards: {
    training: { winXp: 5, loseXp: 2 },
    '1v1': { winXp: 10, loseXp: 5 },
    '2v2': { winXp: 25, loseXp: 10 },
    '5v5': { winXp: 100, loseXp: 50 },
    war_of_kops: { winXp: 50, loseXp: 20 }
  }
};

const BOT_PROFILES = [
  { pseudo: 'Fan_Alpha_92', level: 5, photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bot1' },
  { pseudo: 'Goal_Digger', level: 8, photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bot2' },
  { pseudo: 'Kop_Warrior', level: 12, photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bot3' },
  { pseudo: 'Ultra_Fan_FR', level: 3, photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bot4' },
  { pseudo: 'Stade_Master', level: 15, photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bot5' },
  { pseudo: 'Foot_Addict', level: 7, photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bot6' },
  { pseudo: 'Supporter_One', level: 10, photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bot7' },
  { pseudo: 'Yellow_Wall_Fan', level: 20, photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bot8' }
];

export function DuelManager({ user, matchId, teamA, teamB, teamAId, teamBId, teamALogo, teamBLogo, onExit, initialDuelId, initialDuelType, isLiveMatch = true, isPrivate = false, onNavigateToFanz, duelLeagueId, duelSeason }: { user: UserProfile; matchId: string; teamA: string; teamB: string; teamAId?: string; teamBId?: string; teamALogo?: string; teamBLogo?: string; onExit: () => void; initialDuelId?: string; initialDuelType?: string; isLiveMatch?: boolean; isPrivate?: boolean; onNavigateToFanz?: (fanzId: string) => void; duelLeagueId?: string; duelSeason?: string }) {
  const { showAlert } = useAlert();
  const [activeDuel, setActiveDuel] = useState<Duel | null>(null);
  
  const isXpBoostActive = user.boostXpUntil && new Date(user.boostXpUntil) > new Date();
  const isInfiniteEnergyActive = user.infiniteEnergyUntil && new Date(user.infiniteEnergyUntil) > new Date();
  const [selectedFanzId, setSelectedFanzId] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [selectedArena, setSelectedArena] = useState<string | null>(initialDuelType && !initialDuelId ? initialDuelType : null);
  const [isPrivateMode, setIsPrivateMode] = useState<boolean>(isPrivate);
  const [userFanzs, setUserFanzs] = useState<Fanz[]>([]);
  const [duelConfig, setDuelConfig] = useState<DuelConfig>(DEFAULT_DUEL_CONFIG);
  const [loading, setLoading] = useState(true);
  const [joiningDuelId, setJoiningDuelId] = useState<string | null>(initialDuelId || null);
  const [joiningDuelData, setJoiningDuelData] = useState<any | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [showDeckError, setShowDeckError] = useState(false);

  useEffect(() => {
    if (joiningDuelId) {
      const fetchDuelData = async () => {
        try {
          const res = await fetch(`/api/duels/id/${joiningDuelId}`);
          if (res.ok) {
            const duel = await res.json();
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
    if (!selectedFanzId || !selectedTeam) {
      showAlert({ type: 'error', title: 'Veuillez sélectionner un Fanz et une équipe !' });
      return;
    }

    const selectedFanz = userFanzs.find(f => f.id === selectedFanzId);
    if (!selectedFanz || !selectedFanz.equippedCards || selectedFanz.equippedCards.length < 8) {
      setShowDeckError(true);
      return;
    }

    const cost = duelConfig.costs[type as keyof typeof duelConfig.costs] || { money: 0, energy: 0 };
    const effectiveEnergyCost = isInfiniteEnergyActive ? 0 : cost.energy;
    
    if (user.money < cost.money || user.energy < effectiveEnergyCost) {
      showAlert({ type: 'error', title: 'Fonds ou énergie insuffisants !' });
      return;
    }

    try {
      // Deduct costs
      await updateDoc(doc(db, 'users', user.uid), {
        money: increment(-cost.money),
        energy: increment(-effectiveEnergyCost)
      });

      if (cost.money > 0) await logTransaction(user.uid, 'money', -cost.money, `Inscription duel: ${type}`);
      if (effectiveEnergyCost > 0) await logTransaction(user.uid, 'energy', -effectiveEnergyCost, `Inscription duel: ${type}`);

      const duelId = joiningDuelId || (type === 'training' ? `training_${user.uid}_${Date.now()}` : `${type}_${matchId}_${Math.random().toString(36).substring(7)}`);
      
      setJoiningDuelId(null);
      setActiveDuel({
        id: duelId,
        type,
        status: 'waiting',
        matchId,
        teamA: teamA,
        teamB: teamB,
        progress: 50,
        participants: [],
        createdAt: new Date().toISOString(),
        isPrivate: isPrivateMode,
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
          duelLeagueId={duelLeagueId}
          duelSeason={duelSeason}
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
                    <img src={getImageUrl(fanz.imageUrl)} alt={fanz.name} className="w-full h-full object-cover pointer-events-none" data-viewer-ignore="true" />
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
                      <img src={getImageUrl(team.logo, 100)} alt={team.name} className="w-12 h-12 sm:w-16 sm:h-16 object-contain mb-2 pointer-events-none" referrerPolicy="no-referrer" data-viewer-ignore="true" />
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
                  { id: 'training', title: 'Entraînement Solo', subtitle: '1 VS BOT', bg: 'background1v1.png', video: 'videoBackground1v1.mp4', fullWidth: false },
                  { id: '1v1', title: 'Duel devant ta télé', subtitle: '1 VS 1', bg: 'background1v1.png', video: 'videoBackground1v1.mp4', fullWidth: false },
                  { id: '2v2', title: 'Soirée au pub', subtitle: '2 VS 2', bg: 'background2v2.png', video: 'videoBackground2v2.mp4', fullWidth: false },
                  { id: '5v5', title: 'Fanzone survoltée', subtitle: '5 VS 5', bg: 'background5v5.png', video: 'videoBackground5v5.mp4', fullWidth: false },
                  { id: 'war_of_kops', title: 'Guerre des KOPs', subtitle: 'XX VS XX', bg: 'backgroundKOP.png', video: 'videoBackgroundKOP.mp4', fullWidth: true }
                ].filter(arena => isLiveMatch || arena.id === 'training').map(arena => {
                  const cost = duelConfig?.costs[arena.id as keyof typeof duelConfig.costs] || { money: 0, energy: 0 };
                  const baseUrl = 'https://thebestfan.online/img/public/background/';
                  const bgUrl = `${baseUrl}${arena.bg}`;
                  const videoUrl = arena.video ? `${baseUrl}${arena.video}` : null;
                  
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
                        className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110 opacity-60"
                        style={{ backgroundImage: `url('${bgUrl}')` }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 transition-opacity group-hover:opacity-60" />
                      
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
              
              {selectedArena && selectedArena !== 'training' && (
                <div className="mt-4 p-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-black text-white">Duel Privé</h4>
                    <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-widest">Jouez uniquement avec des amis</p>
                  </div>
                  <button 
                    onClick={() => setIsPrivateMode(!isPrivateMode)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${isPrivateMode ? 'bg-orange-500' : 'bg-gray-600'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-[4px] transition-transform ${isPrivateMode ? 'left-[26px]' : 'left-[4px]'}`} />
                  </button>
                </div>
              )}
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

export function DuelScreen({ duel, user, onExit, fanzId, teamA, teamB, teamAId, teamBId, teamALogo, teamBLogo, selectedTeam, duelLeagueId, duelSeason }: { duel: Duel; user: UserProfile; onExit: (status?: string) => void, fanzId: string, teamA?: string, teamB?: string, teamAId?: string, teamBId?: string, teamALogo?: string, teamBLogo?: string, selectedTeam: string, duelLeagueId?: string, duelSeason?: string }) {
  const { showAlert } = useAlert();
  const [progress, setProgress] = useState(50);
  const [excitement, setExcitement] = useState(5);
  const maxExcitement = 10;
  const { socket } = useSocket();
  const [winner, setWinner] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState<boolean>(duel.isPrivate || false);
  const [duelResult, setDuelResult] = useState<{ winner: string, ferveurGain: number, teamGain: number, scoreA?: number, scoreB?: number, details?: any } | null>(null);
  const [status, setStatus] = useState<'waiting' | 'starting' | 'active' | 'finished'>(duel.status);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [inviteCode, setInviteCode] = useState(duel.inviteCode);
  const [participants, setParticipants] = useState<any[]>(duel.participants || []);
  const [currentDuelId, setCurrentDuelIdState] = useState<string>(duel.id);
  const currentDuelIdRef = useRef(duel.id);
  const initialDuelType = useRef(duel.type).current;
  const [floatingEffects, setFloatingEffects] = useState<FloatingEffect[]>([]);
  const botEnergyRef = useRef<Record<string, number>>({});
  const [matchDetails, setMatchDetails] = useState<any>(null);
  const previousMatchDetailsRef = useRef<any>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Persistence: Store/Clear current duel
  useEffect(() => {
    if (duel.id) {
      localStorage.setItem('tbfo_current_duel', JSON.stringify({
        id: duel.id,
        type: duel.type,
        matchId: parseInt(duel.matchId || '0')
      }));
    }
  }, [duel.id, duel.type, duel.matchId]);

  const clearDuelPersistence = () => {
    console.log("[Duel] Clearing duel persistence");
    localStorage.removeItem('tbfo_current_duel');
  };

  const onExitHandler = (status?: string) => {
    if (status === 'background') {
      localStorage.setItem('tbfo_background_duel', JSON.stringify({
        duelId: currentDuelIdRef.current,
        matchId: duel.matchId,
        type: duel.type,
        isPrivate: duel.isPrivate
      }));
    } else {
      clearDuelPersistence();
      localStorage.removeItem('tbfo_background_duel');
    }
    onExit();
  };

  const [playedCardAnim, setPlayedCardAnim] = useState<{ card: GameCard, id: string } | null>(null);
  const [enemyPlayedCardAnim, setEnemyPlayedCardAnim] = useState<{ card: GameCard, id: string } | null>(null);

  const handleExitRequest = () => {
    if (status === 'finished') {
      onExitHandler('finished');
    } else {
      setShowExitConfirm(true);
    }
  };

  const confirmExit = () => {
    socket?.emit('leave-duel', { duelId: currentDuelIdRef.current, userId: user.uid });
    onExitHandler(status);
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

  // Goal alert detection
  useEffect(() => {
    if (!matchDetails) return;
    
    // First setup
    if (!previousMatchDetailsRef.current) {
        previousMatchDetailsRef.current = matchDetails;
        return;
    }

    const prevHome = previousMatchDetailsRef.current?.goals?.home ?? 0;
    const prevAway = previousMatchDetailsRef.current?.goals?.away ?? 0;
    const currentHome = matchDetails?.goals?.home ?? 0;
    const currentAway = matchDetails?.goals?.away ?? 0;

    let scoredTeam = '';
    if (currentHome > prevHome) {
        scoredTeam = matchDetails.teams?.home?.name || 'DOMICILE';
    } else if (currentAway > prevAway) {
        scoredTeam = matchDetails.teams?.away?.name || 'EXTÉRIEUR';
    }

    if (scoredTeam) {
        const x = window.innerWidth / 2;
        const y = window.innerHeight / 3;
        addFloatingEffect(`⚽ BUT POUR ${scoredTeam.toUpperCase()} !!!`, x, y, 'text-orange-500 font-black scale-150 drop-shadow-[0_0_15px_rgba(255,102,0,0.8)] z-[200]');
        setIsRealMatchGoal(true);
        setTimeout(() => setIsRealMatchGoal(false), 5000);
    }

    previousMatchDetailsRef.current = matchDetails;
  }, [matchDetails]);

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
  const [allCards, setAllCards] = useState<GameCard[]>([]);
  const allCardsRef = useRef<GameCard[]>([]);
  useEffect(() => { allCardsRef.current = allCards; }, [allCards]);
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
  const [isVampirism, setIsVampirism] = useState(false);
  const [isFogOfWar, setIsFogOfWar] = useState(false);
  const [isFrenzy, setIsFrenzy] = useState(false);
  const [isSabotaged, setIsSabotaged] = useState(false);
  const [isTradingStickers, setIsTradingStickers] = useState(false);
  const [selectedStickers, setSelectedStickers] = useState<string[]>([]);
  const [isImmune, setIsImmune] = useState(false);
  const [isCriticalStrike, setIsCriticalStrike] = useState(false);
  const [isMomentum, setIsMomentum] = useState(false);
  const [isRealMatchGoal, setIsRealMatchGoal] = useState(false);
  const [isBlackout, setIsBlackout] = useState(false);
  const [isFlare, setIsFlare] = useState(false);
  const [isCursed, setIsCursed] = useState(false);
  const [isBlessed, setIsBlessed] = useState(false);
  const [isConfetti, setIsConfetti] = useState(false);
  const [isGoldenGoal, setIsGoldenGoal] = useState(false);
  const [isHypnotized, setIsHypnotized] = useState(false);
  const [lastEnemyCard, setLastEnemyCard] = useState<GameCard | null>(null);
  const [buttonPosition, setButtonPosition] = useState({ x: 0, y: 0 });

  const playSound = (url?: string) => {
    if (url) {
      const audio = new Audio(getImageUrl(url));
      audio.play().catch(e => console.log('Audio play failed', e));
    }
  };

  // Emotes State
  const [allEmotes, setAllEmotes] = useState<FanzEmote[]>([]);
  const [unlockedEmoteIds, setUnlockedEmoteIds] = useState<string[]>(user.emotes || []);
  const [showEmotes, setShowEmotes] = useState(false);
  const [activeEmotes, setActiveEmotes] = useState<{id: string, emoteId: string, team: string, x: number | string, y: number | string}[]>([]);
  const [botFillTimer, setBotFillTimer] = useState<number>(30); // Countdown to auto-fill bots
  const isMaster = participants[0]?.uid === user.uid || duel.type === 'training'; // Only the first player manages bots (always master in training)

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
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        // Fetch Duel Config
        const configSnap = await getDoc(doc(db, 'global_configs', 'duel_config'));
        if (configSnap.exists()) {
          const configData = configSnap.data() as DuelConfig;
          setDuelConfig(configData);
        }

        const cardsSnap = await getDocs(collection(db, 'cards'));
        const fetchedCards = cardsSnap.docs.map(d => ({ id: d.id, ...d.data() } as GameCard));
        
        // Ensure we always have BASE_CARDS even if Firestore is empty
        // Merge them avoiding duplicates by ID (Firestore version wins if ID exists in both)
        const initialCards = [...BASE_CARDS];
        fetchedCards.forEach(fc => {
          const index = initialCards.findIndex(bc => bc.id === fc.id);
          if (index !== -1) {
            initialCards[index] = fc;
          } else {
            initialCards.push(fc);
          }
        });
        
        const fanzSnap = await getDoc(doc(db, 'fanz', fanzId));
        if (fanzSnap.exists()) {
          const fanzData = fanzSnap.data() as Fanz;
          
          // Load template and skin image
          let imageUrl = fanzData.imageUrl;
          let equippedSkinUrl = null;
          let equippedSkinVideoUrl = null;
          if (fanzData.templateId) {
            const tplSnap = await getDoc(doc(db, 'fanz_templates', fanzData.templateId));
            if (tplSnap.exists()) {
              const tplData = tplSnap.data() as FanzTemplate;
              if (!imageUrl) imageUrl = tplData.image || null;
              
              if (fanzData.equippedSkin) {
                const skin = tplData.skins?.find(s => s.id === fanzData.equippedSkin);
                if (skin) {
                  equippedSkinUrl = skin.imageUrl;
                  equippedSkinVideoUrl = skin.videoUrl || null;
                }
              }
            }
          }
          
          const finalFanz = { ...fanzData, imageUrl, equippedSkinUrl, equippedSkinVideoUrl };
          setFanz(finalFanz);
          
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

        // Fetch User Fanz Emotes to sync
        if (userSnap.exists()) {
          const userData = userSnap.data() as UserProfile;
          
          // Filter emotes: user global emotes + current FANZ emotes
          let fanzEmotes: string[] = [];
          if (fanzSnap && fanzSnap.exists()) {
            const fanzData = fanzSnap.data() as Fanz;
            setFanz(fanzData);
            if (fanzData.unlockedEmotes) {
              fanzEmotes = fanzData.unlockedEmotes;
            }
          }

          const combinedEmotes = Array.from(new Set([
            ...(userData.emotes || []),
            ...fanzEmotes
          ]));
          setUnlockedEmoteIds(combinedEmotes);

          const shuffled = [...cardsToUse].sort(() => Math.random() - 0.5);
          setDeck(shuffled);
          setHand(shuffled.slice(0, 4));
        }
      } catch (err) {
        console.error("Error initializing duel data", err);
      }
    };

    initDuel();
  }, [fanzId, user.uid]);

  const [myTeam, setMyTeam] = useState<'A' | 'B' | null>(null);
  const [selectedTargetUid, setSelectedTargetUid] = useState<string | null>(null);
  const myTeamRef = useRef<'A' | 'B' | null>(null);
  const participantsRef = useRef<any[]>(duel.participants || []);
  const fanzRef = useRef<Fanz | null>(null);
  const duelConfigRef = useRef<DuelConfig | null>(null);
  const handRef = useRef<GameCard[]>([]);

  // Update refs when state changes
  useEffect(() => { myTeamRef.current = myTeam; }, [myTeam]);
  useEffect(() => { participantsRef.current = participants; }, [participants]);
  useEffect(() => { fanzRef.current = fanz; }, [fanz]);
  useEffect(() => { duelConfigRef.current = duelConfig; }, [duelConfig]);
  useEffect(() => { handRef.current = hand; }, [hand]);

  const drawCard = (ignoreMax = false, count = 1) => {
    setHand(prev => {
      if (!ignoreMax && prev.length >= 4) return prev;
      let newHand = [...prev];
      for (let i = 0; i < count; i++) {
        if (!ignoreMax && newHand.length >= 4) break;
        const available = deck.filter(c => !newHand.find(p => p.id === c.id));
        if (available.length === 0) break;
        const next = available[Math.floor(Math.random() * available.length)];
        // Assign a unique instance ID to allow multiple copies of the same card in edge cases, or just standard play
        newHand.push({ ...next, instanceId: Math.random().toString(36).substr(2, 9) });
      }
      return newHand;
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
    if (!socket || !fanz || !user) return;

    const joinDuel = () => {
      socket.emit('join-duel', { 
        duelId: currentDuelIdRef.current, 
        user: { uid: user.uid, pseudo: user.pseudo, photoURL: user.photoURL, level: user.level }, 
        fanz, 
        type: duel.type,
        matchId: duel.matchId,
        team: selectedTeam === teamA ? 'A' : 'B',
        isPrivate: duel.isPrivate,
        inviteCode: duel.inviteCode,
        teamAId,
        teamBId,
        teamA,
        teamB,
        leagueId: duelLeagueId,
        season: duelSeason
      });
    };

    if (socket.connected) {
      joinDuel();
    }
    
    socket.on('connect', joinDuel);

    return () => {
      socket.off('connect', joinDuel);
    };
  }, [socket, fanz, user, duel.type, duel.matchId, duel.isPrivate, duel.inviteCode, teamAId, teamBId, teamA, teamB, duelLeagueId, duelSeason, selectedTeam]);

  useEffect(() => {
    if (!socket) return;
    
    // Bot Auto-Fill Logic
    let botTimerId: any;
    if (status === 'waiting' && isMaster && !duel.isPrivate) {
      botTimerId = setInterval(() => {
        setBotFillTimer(prev => {
          if (prev <= 1) {
            fillWithBots();
            return duelConfig?.botFillTimer || 30;
          }
          return prev - 1;
        });
      }, 1000);
    }

    // Bot Simulation Logic (Clicks & Cards)
    let botSimulationInterval: any;
    if (status === 'active' && isMaster) {
      botSimulationInterval = setInterval(() => {
        const bots = participants.filter(p => p.isBot);
        
        const clickRate = (duelConfig?.botClickRatePerSec || 8) * (duel.type === 'training' ? 1.5 : 1); 
        const cardChance = duelConfig?.botCardPlayChance ? (duelConfig.botCardPlayChance / 100) : (duel.type === 'training' ? 0.8 : 0.6);

        bots.forEach(bot => {
          // 1. Simulate Clicks (Multi-clicks based on config)
          const numClicks = Math.floor(clickRate) + (Math.random() < (clickRate % 1) ? 1 : 0);
          
          for (let c = 0; c < numClicks; c++) {
            // Use same multiplier logic as humans for fairness
            const botFanz = bot.fanz || fanz;
            const rankLevel = (botFanz?.rank || 0);
            const rankBonus = rankLevel * 0.02;
            const forceLevel = botFanz?.stats?.force || 1;
            const forceBonus = 0.005 + (forceLevel * 0.001);
            const baseExcitementMultiplier = (botFanz?.baseExcitement || 5) / 5;
            const botMultiplier = baseExcitementMultiplier + rankBonus + forceBonus;

            socket.emit('click-ferveur', { 
              duelId: currentDuelIdRef.current, 
              team: bot.team, 
              userId: bot.uid, 
              multiplier: botMultiplier 
            });
          }

          // 2. Simulate Card Playing
          const currentEnergy = botEnergyRef.current[bot.uid] || 5;
          // Increase energy regen for bots significantly (0.8 or 1.2 for training)
          botEnergyRef.current[bot.uid] = Math.min(10, currentEnergy + (duel.type === 'training' ? 1.2 : 0.8)); 

          // Random chance to play a card if enough energy
          if (currentEnergy >= 2 && Math.random() < cardChance && allCards.length > 0) {
            // Pick a card from the mirrored deck (if available) or all cards
            const deckIds = bot.fanz?.equippedCards || fanz?.equippedCards || [];
            const availableCards = allCards.filter(c => deckIds.includes(c.id));
            const cardsToPickFrom = availableCards.length > 0 ? availableCards : allCards;
            
            const card = cardsToPickFrom[Math.floor(Math.random() * cardsToPickFrom.length)];
            const cost = card.energyCost > 10 ? Math.max(1, Math.round(card.energyCost / 10)) : card.energyCost;

            if (currentEnergy >= cost) {
              botEnergyRef.current[bot.uid] -= cost;
              socket.emit('play-card', { 
                duelId: currentDuelIdRef.current, 
                team: bot.team, 
                card,
                userId: bot.uid
              });
            }
          }
        });
      }, 1000);
    }

    return () => {
      if (botTimerId) clearInterval(botTimerId);
      if (botSimulationInterval) clearInterval(botSimulationInterval);
    };
  }, [socket, status, isMaster, participants.length, allCards.length]);

  const fillWithBots = () => {
    if (!socket || !isMaster) return;
    
    const maxPlayers = { '1v1': 1, '2v2': 2, '5v5': 5 }[duel.type as '1v1' | '2v2' | '5v5'] || 1;
    const countA = participants.filter(p => p.team === 'A').length;
    const countB = participants.filter(p => p.team === 'B').length;
    
    // Copy current user fanz and deck state for bots to mirror player strength
    const mirroredFanz = fanz ? {
      ...fanz,
      equippedCards: fanz.equippedCards || [],
      stats: fanz.stats,
      level: fanz.level,
      rank: fanz.rank,
      baseExcitement: fanz.baseExcitement
    } : null;

    const botsToAdd: any[] = [];
    
    // Fill Team A
    for (let i = countA; i < maxPlayers; i++) {
      const profile = BOT_PROFILES[Math.floor(Math.random() * BOT_PROFILES.length)];
      botsToAdd.push({ 
        ...profile, 
        uid: `bot_A_${Math.random().toString(36).substr(2, 9)}`, 
        team: 'A', 
        isBot: true,
        level: user.level, // Mirror user level
        fanz: mirroredFanz // Mirror user fanz
      });
    }
    
    // Fill Team B
    for (let i = countB; i < maxPlayers; i++) {
      const profile = BOT_PROFILES[Math.floor(Math.random() * BOT_PROFILES.length)];
      botsToAdd.push({ 
        ...profile, 
        uid: `bot_B_${Math.random().toString(36).substr(2, 9)}`, 
        team: 'B', 
        isBot: true,
        level: user.level, // Mirror user level
        fanz: mirroredFanz // Mirror user fanz
      });
    }
    
    botsToAdd.forEach(bot => {
      socket.emit('join-duel', { 
        duelId: currentDuelIdRef.current, 
        user: { uid: bot.uid, pseudo: bot.pseudo, photoURL: bot.photoURL, level: bot.level }, 
        team: bot.team,
        fanz: bot.fanz,
        isBot: true 
      });
    });
  };

  useEffect(() => {
    if (!socket) return;

    const handleDuelUpdate = (state: { duelId?: string; progress: number; status: any; participants?: any[]; inviteCode?: string; isPrivate?: boolean }) => {
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
      if (state.isPrivate !== undefined) {
        setIsPrivate(state.isPrivate);
      }
    };

    const handleDuelJoined = ({ status, participants, team, duelId: serverDuelId, inviteCode: serverInviteCode }: any) => {
      if (status) setStatus(status);
      if (participants) setParticipants(participants);
      if (team) setMyTeam(team);
      if (serverDuelId) setCurrentDuelId(serverDuelId);
      if (serverInviteCode) setInviteCode(serverInviteCode);
    };

    socket.on('duel-joined', handleDuelJoined);
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
      audioManager.playReady();
    };
    socket.on('duel-started', handleDuelStarted);

    const handleDuelFinished = async ({ winner, scoreA, scoreB, details }: { winner: string, scoreA: number, scoreB: number, details?: any }) => {
      setWinner(winner);
      let ferveurGain = 0;
      let teamGain = 0;
      
      // Normalize scores for match history (scoreA = virtual team A, scoreB = virtual team B)
      // props.teamA is the official Home Team name of the match
      const isSideAHome = duel.teamA === teamA;
      
      // Fetch match details EARLY to use for the fixture logs
      let currentMatchDetails = matchDetails;
      if (!currentMatchDetails && duel.matchId && duel.matchId !== 'global') {
        try {
          const { footballApi } = await import('../services/footballApi');
          currentMatchDetails = await footballApi.getFixtureDetails(parseInt(duel.matchId));
        } catch (e) {
          console.error("Failed to fetch match details for ranking", e);
        }
      }
      
      const matchSeason = currentMatchDetails?.league?.season?.toString() || new Date().getFullYear().toString();
      const currentYear = new Date().getFullYear().toString();
      const leagueId = currentMatchDetails?.league?.id?.toString() || 'global';
      const safeLeagueId = duelLeagueId || leagueId;
      const safeSeason = duelSeason || matchSeason;
      const globalScoreA = isSideAHome ? Number(scoreA) : Number(scoreB);
      const globalScoreB = isSideAHome ? Number(scoreB) : Number(scoreA);
      const safeTeamAId = teamAId || teamA;
      const safeTeamBId = teamBId || teamB;

      const currentParticipants = participantsRef.current;
      const myParticipant = currentParticipants.find(p => p.uid === user.uid);
      const currentMyTeam = myTeamRef.current || myParticipant?.team || 'A';
      
      // Save legacy match score and fixture_results to Firestore
      if (duel.matchId && duel.matchId !== 'global' && duel.type !== 'training') {
        try {
          const matchIdStr = duel.matchId.toString();
          
          await setDoc(doc(db, 'match_scores', duel.id), {
            matchId: matchIdStr,
            scoreA: Number(globalScoreA),
            scoreB: Number(globalScoreB),
            timestamp: serverTimestamp()
          }, { merge: true });
          
          // Save a purely detailed breakdown by participant for historic tracking:
          await setDoc(doc(db, 'fixture_results', duel.id), {
            fixtureId: matchIdStr,
            leagueId: safeLeagueId,
            season: safeSeason,
            duelId: duel.id,
            type: duel.type,
            teamHome: {
              id: safeTeamAId,
              name: teamA,
              score: Number(globalScoreA)
            },
            teamAway: {
              id: safeTeamBId,
              name: teamB,
              score: Number(globalScoreB)
            },
            winnerVirtualTeam: winner,
            users: currentParticipants.reduce((acc: any, p: any) => {
              const userVirtualTeam = p.team || 'A';
              const userPoints = userVirtualTeam === 'A' ? Number(scoreA) : Number(scoreB);
              // if user is 'A' and sideA is home -> user is Home
              const isUserHome = userVirtualTeam === 'A' ? isSideAHome : !isSideAHome;
              
              acc[p.uid] = {
                pseudo: p.pseudo || 'Unknown',
                virtualTeam: userVirtualTeam,
                teamSide: isUserHome ? 'Home' : 'Away',
                realTeamName: isUserHome ? teamA : teamB,
                score: userPoints
              };
              return acc;
            }, {}),
            timestamp: serverTimestamp()
          }, { merge: true });
          
          console.log(`[Duel] SUCCESS! fixture_results ${duel.id} recorded for ${matchIdStr}`);
        } catch (e) {
          console.error("[Duel] ERROR saving fixture_results to Firestore:", e);
        }
      }

      try {
        const userRef = doc(db, 'users', user.uid);
        const configRef = doc(db, 'global_configs', 'duel_config');
        
        const [userSnap, configSnap, fanzFervorSnap] = await Promise.all([
          getDoc(userRef),
          getDoc(configRef),
          getDoc(doc(db, 'global_configs', 'fanz_fervor'))
        ]);

        if (userSnap.exists()) {
          const userData = userSnap.data() as UserProfile;
          const configData = configSnap.exists() ? configSnap.data() as DuelConfig : null;
          const fanzFervorConfig = fanzFervorSnap.exists() ? fanzFervorSnap.data() as GlobalFervorConfig : undefined;
          
          const currentParticipants = participantsRef.current;
          const myParticipant = currentParticipants.find(p => p.uid === user.uid);
          const currentMyTeam = myTeamRef.current || myParticipant?.team || 'A';
          const isWin = winner === currentMyTeam;
          const duelType = duel.type as keyof NonNullable<DuelConfig['rewards']>;
          
          const xpMultiplier = (userData.boostXpUntil && new Date(userData.boostXpUntil) > new Date()) ? 2 : 1;

          // Progress missions
          await progressMission(userData, 'duel_count', 1);
          if (isWin) {
            await progressMission(userData, 'win_count', 1);
          }

          
          // Get base rewards from config or use defaults
          const baseWinXp = configData?.rewards?.[duelType]?.winXp ?? (duelType === 'training' ? 5 : duelType === '1v1' ? 10 : duelType === '2v2' ? 20 : duelType === '5v5' ? 300 : 10);
          const baseLoseXp = configData?.rewards?.[duelType]?.loseXp ?? (duelType === 'training' ? 5 : duelType === '1v1' ? 10 : duelType === '2v2' ? 20 : duelType === '5v5' ? 30 : 10);
          
          const myScore = Number(currentMyTeam === 'A' ? scoreA : scoreB);
          const opponentScore = Number(currentMyTeam === 'A' ? scoreB : scoreA);
          
          let duelMultiplier = 1;
          if (duel.type === '2v2') duelMultiplier = 2;
          else if (duel.type === '5v5') duelMultiplier = 5;
          else if (duel.type === 'war_of_kops') duelMultiplier = 10;
          
          let ferveurGainFanz = 0;
          let ferveurGainGeneral = 0;
          
          if (duelType === 'training') {
            // Pour l'entraînement, gain fixe de 5 points (ne dépend pas du score ni du résultat)
            ferveurGainFanz = 5 * xpMultiplier;
            ferveurGainGeneral = 5 * xpMultiplier;
          } else if (isWin) {
            // L'XP gagnée est basée sur le score multiplié par le type de duel
            ferveurGainFanz = myScore * duelMultiplier * xpMultiplier;
            ferveurGainGeneral = myScore * duelMultiplier * xpMultiplier;
          } else {
            // En cas de défaite, on gagne la moitié
            ferveurGainFanz = Math.round((myScore / 2) * duelMultiplier * xpMultiplier);
            ferveurGainGeneral = Math.round((myScore / 2) * duelMultiplier * xpMultiplier);
          }
          
          // Update FANZ
          if (fanzId) {
            const fanzRef = doc(db, 'fanz', fanzId);
            const fanzSnap = await getDoc(fanzRef);
            if (fanzSnap.exists()) {
              const fanzData = fanzSnap.data() as Fanz;
              const tplSnap = await getDoc(doc(db, 'fanz_templates', fanzData.templateId));
              const template = tplSnap.exists() ? tplSnap.data() as FanzTemplate : null;
              
              let newFanzPoints = Math.max(0, (fanzData.ferveurPoints || 0) + ferveurGainFanz);
              let newFanzLevel = fanzData.ferveurLevel || 1;
              
              const ferveurPath = fanzFervorConfig 
                ? generateFervorPath(fanzFervorConfig.ranges?.[fanzFervorConfig.ranges.length - 1]?.max || 50000, fanzFervorConfig)
                : template?.ferveurPath || [];

              const nextLevel = ferveurPath.find(p => p.level === newFanzLevel + 1);
              if (nextLevel && newFanzPoints >= nextLevel.pointsRequired) {
                newFanzLevel += 1;
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
                  duelType === 'training' ? 'Entraînement' : (isWin ? 'Victoire en duel' : 'Défaite en duel'),
                  fanzId
                );
              }
              
              setFanz(prev => prev ? { ...prev, ferveurPoints: newFanzPoints, ferveurLevel: newFanzLevel } : null);
              ferveurGain = ferveurGainFanz;
            }
          }
          
          // Update User General
          if (ferveurGainGeneral > 0 || myScore > 0) {
            let newUserPoints = (userData.ferveurPoints || 0) + ferveurGainGeneral;
            
            // Recalculate user level
            let newUserLevel = 1;
            const FERVOR_RANGES = [
              { level: 1, min: 0 },
              { level: 2, min: 100000 },
              { level: 3, min: 500000 },
              { level: 4, min: 1000000 },
              { level: 5, min: 2000000 },
              { level: 6, min: 3000000 },
              { level: 7, min: 4000000 },
              { level: 8, min: 5000000 },
              { level: 9, min: 6000000 },
              { level: 10, min: 7000000 },
              { level: 11, min: 8000000 },
              { level: 12, min: 9000000 },
              { level: 13, min: 10000000 },
              { level: 14, min: 12000000 },
              { level: 15, min: 15000000 }
            ];
            for (const range of FERVOR_RANGES) {
              if (newUserPoints >= range.min) {
                newUserLevel = range.level;
              }
            }

            const updates: any = {
              ferveurPoints: newUserPoints,
              level: newUserLevel,
              totalScore: increment(myScore),
              matchesPlayed: increment(1)
            };
            if (isWin) {
              updates.matchesWon = increment(1);
            }
            if (ferveurGainGeneral > 0) {
              try {
                const passesSnap = await getDocs(query(collection(db, 'passes'), where('isActive', '==', true)));
                const activePasses = passesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Pass));
                
                let appliedGlobal = false;
                for (const pass of activePasses) {
                  let matchesCondition = false;
                  const cType = pass.conditionType;
                  const cVal = pass.conditionValue?.toString();
                  
                  // Base condition check
                  if (!cType || cType === 'global') {
                    matchesCondition = true;
                  } else if (cType === 'league' && safeLeagueId && cVal === safeLeagueId) {
                    matchesCondition = true;
                  } else if (cType === 'team' && cVal && (cVal === teamAId || cVal === teamBId || cVal === teamA || cVal === teamB)) {
                    matchesCondition = true;
                  } else if (cType === 'season' && safeSeason && (cVal === safeSeason || pass.conditionSeason === safeSeason)) {
                    matchesCondition = true;
                  } else if (cType === 'country') {
                    // Extended contexts can be matched here later
                    matchesCondition = true;
                  }

                  // If there is an explicit secondary season condition, enforce it
                  if (matchesCondition && pass.conditionSeason && pass.conditionSeason !== '') {
                    if (safeSeason !== pass.conditionSeason) {
                      matchesCondition = false;
                    }
                  }

                  if (matchesCondition) {
                    if (!cType || cType === 'global') {
                      if (!appliedGlobal) {
                        updates.passPoints = increment(ferveurGainGeneral);
                        appliedGlobal = true;
                      }
                    } else {
                      updates[`passProgress.${pass.id}`] = increment(ferveurGainGeneral);
                    }
                  }
                }
              } catch (err) {
                console.error('Error applying pass points with conditions:', err);
                updates.passPoints = increment(ferveurGainGeneral); // Fallback
              }
            }
            await updateDoc(userRef, updates);
            if (ferveurGainGeneral > 0) {
              await logTransaction(
                user.uid,
                'ferveur_general',
                ferveurGainGeneral,
                duelType === 'training' ? 'Entraînement' : (isWin ? 'Victoire en duel' : 'Défaite en duel')
              );
            }
          }

          // Rankings and Duel history are now securely processed server-side.
          
          ferveurGain = ferveurGainFanz;
          teamGain = ferveurGainGeneral;
        }
      } catch (e) {
        console.error("Error updating ferveur", e);
      }
      
      setDuelResult({ winner, ferveurGain, teamGain, scoreA, scoreB, details });
      
      const isWinner = (winner === 'A' && myTeamRef.current === 'A') || (winner === 'B' && myTeamRef.current === 'B');
      if (isWinner) {
        audioManager.playVictory();
      } else {
        audioManager.playDefeat();
      }
    };
    socket.on('duel-finished', handleDuelFinished);

    const handleEnemyCardPlayed = ({ team, card }: { team: string, card: GameCard }) => {
      const currentMyTeam = myTeamRef.current || participantsRef.current.find(p => p.uid === user.uid)?.team || 'A';
      
      // Upgrade the card with correct image from allCards if available, but respect server image if it's explicitly sent (e.g. bots)
      const realCard = allCardsRef.current.find(c => c.id === card.id) || card;
      const enhancedCard = { 
        ...card, 
        imageUrl: card.imageUrl || realCard.imageUrl, 
        videoUrl: card.videoUrl || realCard.videoUrl 
      };

      if (team === currentMyTeam) {
        // Teammate played a card
        setEnemyPlayedCardAnim({ card: enhancedCard, id: Math.random().toString() });
        setTimeout(() => setEnemyPlayedCardAnim(null), 2000);
        if (enhancedCard.soundUrl) { playSound(enhancedCard.soundUrl); } else { audioManager.playCardPlay(); }
        addFloatingEffect(`🤝 Allié: ${enhancedCard.name}`, window.innerWidth / 2, 100, 'text-blue-400 font-black scale-125');
        return;
      }

      setLastEnemyCard(enhancedCard);
      setEnemyPlayedCardAnim({ card: enhancedCard, id: Math.random().toString() });
      setTimeout(() => setEnemyPlayedCardAnim(null), 2000);

      const isMalus = enhancedCard.effects.some(e => 
        ['drain_energy', 'hide_button', 'shrink_button', 'move_button', 'blur_view', 'hide_score', 'discard_enemy_cards', 'discard_random_cards', 'shuffle_deck', 'freeze_button', 'earthquake', 'fake_buttons', 'card_lock', 'fog_of_war', 'sabotage', 'steal_energy', 'blackout', 'curse', 'confetti', 'hypnosis', 'pacifier_drama', 'mascot_bazooka', 'steal_best_card'].includes(e.type)
      );
      
      if (enhancedCard.soundUrl) { playSound(enhancedCard.soundUrl); } 
      else if (isMalus) { audioManager.playDebuff(); }
      else { audioManager.playMagic(); }

      addFloatingEffect(`⚠️ ${enhancedCard.name}`, window.innerWidth / 2, 100, 'text-red-500 font-black scale-125');

      if (isMalus) {
        if (isImmune) {
          addFloatingEffect('🛡️ Immunité Active!', window.innerWidth / 2, 150, 'text-green-300 font-black');
          return;
        }
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
          case 'trade_stickers':
            setIsTradingStickers(true);
            setSelectedStickers([]);
            addFloatingEffect('🔄 Échange de Doubles!', window.innerWidth / 2, 200, 'text-blue-400 font-bold max-w-[200px] text-center');
            break;
          case 'card_lock':
            setIsCardLocked(true);
            setTimeout(() => setIsCardLocked(false), getEffectiveDuration(effect.duration || 5, mentalResistance));
            addFloatingEffect('🔒 Cartes Bloquées!', window.innerWidth / 2, 200, 'text-red-400');
            break;
          case 'steal_energy':
            setExcitement(prev => Math.max(0, prev - (effect.value || 0)));
            addFloatingEffect(`⚡ -${effect.value} Énergie Volée!`, window.innerWidth / 2, 200, 'text-red-400');
            break;
          case 'fog_of_war':
            setIsFogOfWar(true);
            setTimeout(() => setIsFogOfWar(false), getEffectiveDuration(effect.duration || 6, bluffResistance));
            addFloatingEffect('🌫️ Brouillard de Guerre!', window.innerWidth / 2, 200, 'text-gray-500 font-black');
            break;
          case 'sabotage':
            setIsSabotaged(true);
            addFloatingEffect('💣 Sabotage Actif!', window.innerWidth / 2, 200, 'text-red-500 font-black');
            break;
          case 'blackout':
            setIsBlackout(true);
            setTimeout(() => setIsBlackout(false), getEffectiveDuration(effect.duration || 8, bluffResistance));
            addFloatingEffect('💡 Coupure de Courant !', window.innerWidth / 2, 200, 'text-yellow-100 font-black');
            break;
          case 'curse':
            setIsCursed(true);
            addFloatingEffect('💀 Maudit! (+3 Coût)', window.innerWidth / 2, 200, 'text-purple-500 font-black');
            break;
          case 'confetti':
            setIsConfetti(true);
            setTimeout(() => setIsConfetti(false), getEffectiveDuration(effect.duration || 7, bluffResistance));
            addFloatingEffect('🎉 Confettis!', window.innerWidth / 2, 200, 'text-pink-400 font-black');
            break;
          case 'hypnosis':
            setIsHypnotized(true);
            setTimeout(() => setIsHypnotized(false), getEffectiveDuration(effect.duration || 4, mentalResistance));
            addFloatingEffect('🌀 Hypnotisé!', window.innerWidth / 2, 200, 'text-purple-600 font-black scale-150');
            break;
          case 'pacifier_drama':
            setHand(prev => {
              if (prev.length === 0) return prev;
              const newHand = [...prev];
              newHand.splice(Math.floor(Math.random() * newHand.length), 1);
              return newHand;
            });
            setTimeout(drawCard, 2000);
            setExcitement(prev => Math.max(0, prev - (effect.value || 1)));
            addFloatingEffect('🍼 DRAME DE LA TÉTINE ! (-1 Carte, -1 PA)', window.innerWidth / 2, 200, 'text-blue-500 font-black scale-125 drop-shadow-md z-[200]');
            break;
          case 'mascot_bazooka':
            setHand(prev => prev.filter(c => c.name.toLowerCase().includes("enfant de la mascotte")));
            setTimeout(() => drawCard(true, 3), 100);
            addFloatingEffect('🎁 BAZOOKA À GOODIES ! (Défausse + 3 Cartes)', window.innerWidth / 2, 250, 'text-pink-500 font-black scale-125 drop-shadow-md z-[200]');
            break;
        }
      });
    };
    socket.on('enemy-card-played', handleEnemyCardPlayed);

    const handleSwapHandsRequest = ({ fromTeam, opponentHand }: { fromTeam: string, opponentHand: GameCard[] }) => {
      const myParticipant = participantsRef.current.find(p => p.uid === user.uid);
      const myTeam = myParticipant?.team || 'A';
      
      if (fromTeam !== myTeam) {
        // We are the target, we receive the opponent's hand and send ours
        const myCurrentHand = [...handRef.current];
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

    const handleStealCardRequest = ({ fromTeam }: { fromTeam: string }) => {
      const myParticipant = participantsRef.current.find(p => p.uid === user.uid);
      const myTeam = myParticipant?.team || 'A';
      if (fromTeam !== myTeam) {
        if (handRef.current.length > 0) {
           const bestCard = handRef.current.reduce((prev, curr) => (prev.fervorValue || 0) > (curr.fervorValue || 0) ? prev : curr);
           setHand(prev => prev.filter(c => c.instanceId !== bestCard.instanceId));
           socket.emit('steal-card-response', { duelId: currentDuelIdRef.current, team: myTeam, card: bestCard });
           addFloatingEffect('😭 Meilleure Carte Volée!', window.innerWidth / 2, 250, 'text-red-500 font-black scale-125 drop-shadow-md z-[200]');
        }
      }
    };
    socket.on('steal-card-request', handleStealCardRequest);

    const handleStealCardComplete = ({ stolenCard }: { stolenCard: GameCard }) => {
       setHand(prev => {
         let newHand = [...prev];
         newHand.push({ ...stolenCard, instanceId: Math.random().toString(36).substr(2, 9) });
         return newHand;
       });
       addFloatingEffect(`✨ ${stolenCard.name} obtenue!`, window.innerWidth / 2, 250, 'text-yellow-400 font-black scale-125 drop-shadow-md z-[200]');
    };
    socket.on('steal-card-complete', handleStealCardComplete);

    const handleReceiveEmote = ({ team, emoteId, senderId }: { team: string, emoteId: string, senderId: string }) => {
      const id = Math.random().toString(36).substring(7);
      // Random position roughly in the middle of the container
      const x = `${40 + Math.random() * 20}%`;
      const y = `${40 + Math.random() * 20}%`;
      
      setActiveEmotes(prev => [...prev, { id, emoteId, team, x, y }]);
      setTimeout(() => {
        setActiveEmotes(prev => prev.filter(e => e.id !== id));
      }, 3000);
    };
    socket.on('receive-emote', handleReceiveEmote);

    return () => {
      socket.off('duel-joined', handleDuelJoined);
      socket.off('duel-update', handleDuelUpdate);
      socket.off('duel-starting', handleDuelStarting);
      socket.off('duel-started', handleDuelStarted);
      socket.off('duel-finished', handleDuelFinished);
      socket.off('enemy-card-played', handleEnemyCardPlayed);
      socket.off('swap-hands-request', handleSwapHandsRequest);
      socket.off('swap-hands-complete', handleSwapHandsComplete);
      socket.off('steal-card-request', handleStealCardRequest);
      socket.off('steal-card-complete', handleStealCardComplete);
      socket.off('receive-emote', handleReceiveEmote);
    };
  }, [socket, duel.id]);

  // Button visibility cycle (Mental stat) - REMOVED automatic cycle as it was confusing
  // Only cards should trigger invisible button now

  const handleAction = (e: React.MouseEvent) => {
    if (winner || isButtonHidden || isButtonFrozen) return;
    
    // Find the user's actual team
    const myParticipant = participants.find(p => p.uid === user.uid);
    const myTeam = myParticipant?.team || 'A';
    
    let currentMultiplier = multiplier;
    if (isFlare) {
      currentMultiplier *= 3;
    }
    if (isGoldenGoal) {
      currentMultiplier *= 15;
      setIsGoldenGoal(false);
      addFloatingEffect('⚽ ACTION EN OR !', e.clientX, e.clientY - 40, 'text-yellow-500 font-black scale-150 drop-shadow-lg');
    }
    if (isCriticalStrike) {
      currentMultiplier *= 5;
      setIsCriticalStrike(false);
      addFloatingEffect('💥 Coup Critique!', e.clientX, e.clientY - 20, 'text-red-500 font-black scale-150');
    }

    if (isHypnotized) {
       currentMultiplier = -currentMultiplier; // Benefits the opponent
       addFloatingEffect('😵 Oups!', e.clientX, e.clientY + 20, 'text-purple-600 font-black drop-shadow-md');
    }

    // Play impact sound based on action
    if (isCriticalStrike || isGoldenGoal) {
      audioManager.playImpact();
    } else {
      audioManager.playCardSelect(); // Soft pull sound
    }

    console.log('Action clicked!', { duelId: currentDuelIdRef.current, team: myTeam, multiplier: currentMultiplier });
    socket?.emit('click-ferveur', { duelId: currentDuelIdRef.current, team: myTeam, multiplier: currentMultiplier });
    
    const ferveurGain = (0.5 * currentMultiplier).toFixed(1);
    addFloatingEffect(`+${ferveurGain} Ferveur`, e.clientX, e.clientY, 'text-yellow-400');

    if (isDoublePoints) {
      socket?.emit('click-ferveur', { duelId: currentDuelIdRef.current, team: myTeam, multiplier: currentMultiplier });
      addFloatingEffect(`+${ferveurGain} Ferveur (x2)`, e.clientX, e.clientY - 40, 'text-yellow-400');
    }

    if (isVampirism) {
      socket?.emit('click-ferveur', { duelId: currentDuelIdRef.current, team: myTeam === 'A' ? 'B' : 'A', multiplier: -0.2 });
      addFloatingEffect(`🩸 Vampire`, e.clientX, e.clientY + 20, 'text-red-500');
    }
  };

  const playCard = async (card: GameCard, e?: React.MouseEvent) => {
    let actualCost = card.energyCost > 10 ? Math.max(1, Math.round(card.energyCost / 10)) : card.energyCost;
    
    if (isFrenzy) {
      actualCost = 0;
    } else {
      if (isSabotaged) {
        actualCost *= 2;
        setIsSabotaged(false); // remove after one use
      }
      if (isCursed) {
        actualCost += 3;
        setIsCursed(false); // remove after one use
      }
      if (isBlessed) {
        actualCost = Math.max(0, actualCost - 2);
      }
    }
    
    if (winner || status !== 'active' || excitement < actualCost || isCardLocked) return;
    
    // Remove from hand and deduct excitement immediately
    setHand(prev => prev.filter(c => c.id !== card.id));
    setExcitement(prev => Math.max(0, prev - actualCost));
    setTimeout(drawCard, 3000);

    // Visual feedback
    setPlayedCardAnim({ card, id: Math.random().toString() });
    setTimeout(() => setPlayedCardAnim(null), 1500);
    if (card.soundUrl) { playSound(card.soundUrl); } else { audioManager.playCardPlay(); }

    const x = e ? e.clientX : window.innerWidth / 2;
    const y = e ? e.clientY - 50 : window.innerHeight / 2;
    addFloatingEffect(`Carte jouée: ${card.name}`, x, y, 'text-blue-400 font-bold');

    // Calculate boosted card stats immediately for use in effects and emission
    let currentCardLevel = fanz?.cardProgress?.[card.id]?.level || 1;
    const levelBonus = 1 + (currentCardLevel - 1) * 0.05;
    const rawCharismaBonus = getStatEffectValue('card_power');
    const charismaBonus = 1 + (rawCharismaBonus - 1) * 0.2;
    const creativityBonus = getStatEffectValue('card_cost_reduction');

    const boostedCard: GameCard = {
      ...card,
      energyCost: Math.max(1, Math.round(card.energyCost * (1 - creativityBonus))),
      fervorValue: card.fervorValue ? Math.round(card.fervorValue * levelBonus * charismaBonus) : card.fervorValue,
      effects: (card.effects || []).map(e => ({
        ...e,
        value: e.value ? Math.round(e.value * levelBonus * charismaBonus) : e.value,
        duration: e.duration ? Math.round(e.duration * levelBonus * charismaBonus) : e.duration
      }))
    };

    // XP Gain and Leveling (Async, Non-blocking)
    const updateStats = async () => {
      try {
        if (fanz) {
          const fanzRef = doc(db, 'fanz', fanzId);
          const currentProgress = fanz.cardProgress?.[card.id] || { level: 1, xp: 0 };
          const socialBonus = getStatEffectValue('xp_gain');
          const xpGain = Math.round(1 * (1 + socialBonus));
          
          let newLevel = currentProgress.level;
          let newXp = currentProgress.xp + xpGain;
          const xpForNextLevel = newLevel * 10;

          if (newXp >= xpForNextLevel && newLevel < 5) {
            newLevel += 1;
            newXp = 0;
          }

          const updatedProgress = {
            ...fanz.cardProgress,
            [card.id]: { level: newLevel, xp: newXp }
          };

          // Firestore update in background
          updateDoc(fanzRef, { cardProgress: updatedProgress }).catch(err => 
            console.error("Firestore card XP update failed", err)
          );

          setFanz(prev => prev ? { ...prev, cardProgress: updatedProgress } : null);
        }
      } catch (err) {
        console.error("Error in card stat update logic", err);
      }
    };
    updateStats();

    const myParticipant = participants.find(p => p.uid === user.uid);
    const myTeam = myParticipant?.team || 'A';

    // Apply self-effects (on client)
    boostedCard.effects.forEach(effect => {
      if (effect.type === 'cleanse') {
        setIsBlurred(false);
        setIsButtonHidden(false);
        setIsButtonFrozen(false);
        setIsButtonShrunk(false);
        setIsButtonMoving(false);
        setIsScoreHidden(false);
        setIsEarthquake(false);
        setIsFakeButtons(false);
        setIsCardLocked(false);
        setIsFogOfWar(false);
        setIsSabotaged(false);
        setIsBlackout(false);
        setIsCursed(false);
        setIsConfetti(false);
        setIsHypnotized(false);
        addFloatingEffect('✨ Purifié!', x, y - 30, 'text-yellow-400 font-black');
      }
      if (effect.type === 'immunity') {
        setIsImmune(true);
        setTimeout(() => setIsImmune(false), (effect.duration || 8) * 1000);
        addFloatingEffect('🛡️ Immunité Actuelle!', x, y - 30, 'text-green-300 font-black');
      }
      if (effect.type === 'frenzy') {
        setIsFrenzy(true);
        setTimeout(() => setIsFrenzy(false), (effect.duration || 3) * 1000);
        addFloatingEffect('🔥 Frénésie!', x, y - 30, 'text-red-500 font-black');
      }
      if (effect.type === 'critical_strike') {
        setIsCriticalStrike(true);
        addFloatingEffect('💥 Frappe Critique prête!', x, y - 30, 'text-orange-500 font-black');
      }
      if (effect.type === 'momentum') {
        setIsMomentum(true);
        // We'll let a useEffect handle the passive pull
        setTimeout(() => setIsMomentum(false), (effect.duration || 5) * 1000);
        addFloatingEffect('💨 Momentum Actif!', x, y - 30, 'text-blue-300 font-black');
      }
      if (effect.type === 'vampirism') {
        setIsVampirism(true);
        setTimeout(() => setIsVampirism(false), (effect.duration || 5) * 1000);
        addFloatingEffect('🧛 Vampirisme Actif!', x, y - 30, 'text-purple-500 font-black');
      }
      if (effect.type === 'overload') {
        setExcitement(maxExcitement);
        addFloatingEffect('⚡ Surcharge!', x, y - 30, 'text-yellow-400 font-black');
      }
      if (effect.type === 'steal_energy') {
        setExcitement(prev => Math.min(maxExcitement, prev + (effect.value || 0)));
        addFloatingEffect(`+${effect.value} Énergie Volée!`, x, y - 30, 'text-yellow-400 font-black');
      }

      if (effect.type === 'refill_energy') {
        setExcitement(prev => Math.min(maxExcitement, prev + (effect.value || 0)));
        addFloatingEffect(`+${effect.value} Énergie!`, x, y - 30, 'text-yellow-400');
      }
      if (effect.type === 'draw_cards') {
        const amount = effect.value || 1;
        drawCard(true, amount);
        addFloatingEffect(`+${amount} Carte(s)!`, x, y - 30, 'text-blue-300 font-black');
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
          socket?.emit('play-card', { duelId: currentDuelIdRef.current, team: myTeam, card: lastEnemyCard });
        } else {
          addFloatingEffect('❌ Rien à imiter', x, y - 80, 'text-gray-500');
        }
      }
      if (effect.type === 'swap_hands') {
        addFloatingEffect('🔄 Échange de Mains!', x, y - 80, 'text-blue-400 font-bold');
        socket?.emit('swap-hands-init', { duelId: currentDuelIdRef.current, team: myTeam, hand });
      }
      if (effect.type === 'trade_stickers') {
        setIsTradingStickers(true);
        setSelectedStickers([]);
        addFloatingEffect('🔄 Échange de Doubles!', x, y - 80, 'text-blue-400 font-bold');
      }
      if (effect.type === 'steal_best_card') {
        addFloatingEffect('✨ Vol du Saint Graal !', x, y - 80, 'text-yellow-400 font-bold');
        socket?.emit('steal-card-init', { duelId: currentDuelIdRef.current, team: myTeam });
      }
      if (effect.type === 'blessing') {
        setIsBlessed(true);
        setTimeout(() => setIsBlessed(false), (effect.duration || 10) * 1000);
        addFloatingEffect('✨ Béni!', x, y - 30, 'text-yellow-200 font-black');
      }
      if (effect.type === 'golden_goal') {
        setIsGoldenGoal(true);
        addFloatingEffect('⚽ Balle de Match prête!', x, y - 30, 'text-yellow-500 font-black scale-125');
      }
      if (effect.type === 'pacifier_drama') {
        setHand(prev => {
          if (prev.length === 0) return prev;
          const newHand = [...prev];
          newHand.splice(Math.floor(Math.random() * newHand.length), 1);
          return newHand;
        });
        setTimeout(drawCard, 2000);
        setExcitement(prev => Math.max(0, prev - (effect.value || 1)));
        addFloatingEffect('🍼 TÉTINE PERDUE !', window.innerWidth / 2, 200, 'text-blue-500 font-black scale-125 drop-shadow-md z-[200]');
      }
      if (effect.type === 'mascot_bazooka') {
        setHand(prev => prev.filter(c => c.name.toLowerCase().includes("enfant de la mascotte")));
        setTimeout(() => drawCard(true, 3), 100);
        addFloatingEffect('🎁 BAZOOKA À GOODIES !', window.innerWidth / 2, 250, 'text-pink-500 font-black scale-125 drop-shadow-md z-[200]');
      }
      if (effect.type === 'discard_random_cards') {
        const nbCardsToDiscard = effect.value || 2;
        setHand(prev => {
          let newHand = [...prev];
          for(let i = 0; i < nbCardsToDiscard; i++) {
            if (newHand.length > 0) {
              newHand.splice(Math.floor(Math.random() * newHand.length), 1);
            }
          }
          return newHand;
        });
        setTimeout(() => drawCard(false, nbCardsToDiscard), 2000);
        addFloatingEffect(`🃏 ${nbCardsToDiscard} Carte(s) Défaussée(s)!`, x, y - 80, 'text-red-500 font-black scale-125 drop-shadow-md z-[200]');
      }
    });

    if (boostedCard.fervorValue) {
      addFloatingEffect(`+${boostedCard.fervorValue}% Ferveur!`, x, y - 60, 'text-yellow-400 font-black');
    }

    // Emission to server
    socket?.emit('play-card', { duelId: currentDuelIdRef.current, team: myTeam, card: boostedCard });
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

  // Flare (Fumigènes) random event
  useEffect(() => {
    if (status !== 'active') return;
    
    // Check every 10 seconds if a flare should trigger (5% chance)
    const interval = setInterval(() => {
      if (Math.random() < 0.05 && !isFlare) {
        setIsFlare(true);
        const x = window.innerWidth / 2;
        const y = window.innerHeight / 4;
        addFloatingEffect('🔥 FUMIGÈNES ! (Ferveur x3) 🔥', x, y, 'text-red-500 font-black scale-150 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)] z-[200]');
        
        // Remove flare after 10 seconds
        setTimeout(() => {
          setIsFlare(false);
        }, 10000);
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, [status, isFlare]);
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

  // Momentum passive pull effect
  useEffect(() => {
    if (!isMomentum || status !== 'active' || winner || !socket || !duel.id) return;
    
    const interval = setInterval(() => {
      const myParticipant = participants.find(p => p.uid === user.uid);
      const myTeam = myParticipant?.team || 'A';
      socket.emit('click-ferveur', { duelId: duel.id, team: myTeam, multiplier: 1 });
      
      const x = window.innerWidth / 2 + (Math.random() * 100 - 50);
      const y = window.innerHeight / 2 + (Math.random() * 100 - 50);
      addFloatingEffect(`+0.5 Auto`, x, y, 'text-blue-300 text-xs font-bold font-mono');
    }, 1000); 
    
    return () => clearInterval(interval);
  }, [isMomentum, status, winner, participants, user.uid, socket, duel.id]);

  const getArenaBackground = () => {
    const type = duel.type;
    const baseUrl = 'https://thebestfan.online/img/public/background/';
    switch(type) {
      case '1v1':
      case 'training':
        return { 
          video: `${baseUrl}videoBackground1v1.mp4`,
          image: `${baseUrl}background1v1.png`
        };
      case '2v2':
        return { 
          video: `${baseUrl}videoBackground2v2.mp4`,
          image: `${baseUrl}background2v2.png`
        };
      case '5v5':
        return { 
          video: `${baseUrl}videoBackground5v5.mp4`,
          image: `${baseUrl}background5v5.png` 
        };
      case 'war_of_kops':
        return { 
          video: `${baseUrl}videoBackgroundKOP.mp4`,
          image: `${baseUrl}backgroundKOP.png`
        };
      default:
        return { image: `${baseUrl}background1v1.png` };
    }
  };

  const arenaBg = getArenaBackground();

  return (
    <div className="absolute inset-0 z-50 flex justify-center bg-[#0a0a0a]">
      <div className={`w-full lg:max-w-[450px] h-full relative flex flex-col p-4 bg-black lg:border-x border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.5)] transition-all duration-500 overflow-hidden ${isEarthquake || isRealMatchGoal ? 'animate-bounce' : ''}`}>
        {/* Arena Background */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <img 
            src={getImageUrl(arenaBg.image)} 
            className="w-full h-full object-cover opacity-40 sm:opacity-50" 
            alt="" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
        </div>
        {/* Goal Overlay */}
        <AnimatePresence>
          {isRealMatchGoal && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center bg-orange-500/20 mix-blend-overlay"
            >
              <div className="w-full h-full border-8 border-orange-500 animate-pulse" />
            </motion.div>
          )}
        </AnimatePresence>
        {/* Blackout Overlay */}
        <AnimatePresence>
          {isBlackout && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 bg-black pointer-events-none"
            />
          )}
        </AnimatePresence>
        {/* Flare Overlay */}
        <AnimatePresence>
          {isFlare && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 pointer-events-none mix-blend-overlay bg-gradient-to-t from-red-600/80 via-orange-500/20 to-transparent"
            >
              {/* Animated smoke effect using a CSS trick with box-shadows / pseudo elements, but simplified to a glowing orb */}
              <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-red-600/50 blur-[100px] rounded-full"
              />
            </motion.div>
          )}
        </AnimatePresence>
        {/* Fog of War Overlay */}
        <AnimatePresence>
          {isFogOfWar && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 bg-black/80 backdrop-blur-xl pointer-events-none flex items-center justify-center mix-blend-saturation"
            >
              <span className="text-white/20 font-black text-6xl tracking-widest uppercase rotate-45 mix-blend-overlay">CHAOS</span>
            </motion.div>
          )}
        </AnimatePresence>

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
                {allEmotes.filter(e => unlockedEmoteIds.includes(e.id) && (!e.fanzId || e.fanzId === fanz?.templateId)).length > 0 ? (
                  allEmotes.filter(e => unlockedEmoteIds.includes(e.id) && (!e.fanzId || e.fanzId === fanz?.templateId)).map((emote, idx) => (
                    <button 
                      key={`${emote.id}-${idx}`}
                      onClick={() => {
                        setShowEmotes(false);
                        const myTeam = participants.find(p => p.uid === user.uid)?.team || 'A';
                        socket?.emit('send-emote', { duelId: currentDuelIdRef.current, team: myTeam, emoteId: emote.id, senderId: user.uid });
                        // Show locally
                        const id = Math.random().toString(36).substring(7);
                        const x = `${40 + Math.random() * 20}%`;
                        const y = `${40 + Math.random() * 20}%`;
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
                  <div className={`p-2 rounded-2xl ${emote.team === (participants.find(p => p.uid === user.uid)?.team || 'A') ? 'bg-blue-600/40' : 'bg-red-600/40'} backdrop-blur-sm shadow-lg -translate-x-1/2 -translate-y-1/2`}>
                    <img src={getImageUrl(emoteData.imageUrl)} alt={emoteData.name} className="w-16 h-16 object-contain" />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Float participants skins on active duel */}
        {status === 'active' && participants.length > 1 && (
          <>
            {/* Left side (Team A) */}
            <div className="absolute left-1 top-1/4 bottom-1/4 w-12 sm:w-16 flex flex-col justify-center gap-2 pointer-events-none z-[45]">
              {participants.filter(p => p.team === 'A').map((p, idx) => (
                <div 
                  key={p.uid} 
                  onClick={() => setSelectedTargetUid(p.uid)}
                  className="relative w-full aspect-square rounded-full border-2 border-blue-500/50 overflow-hidden bg-black/60 shadow-[0_0_15px_rgba(59,130,246,0.3)] backdrop-blur-sm pointer-events-auto cursor-pointer hover:border-white transition-colors duration-200"
                >
                  {p.fanz?.equippedSkinVideoUrl && p.fanz.equippedSkinVideoUrl !== "undefined" ? (
                    <video src={getOptimizedVideoUrl(p.fanz.equippedSkinVideoUrl)} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover scale-[1.3] -translate-y-1" data-viewer-ignore="true" />
                  ) : p.fanz?.videoUrl && p.fanz.videoUrl !== "undefined" ? (
                    <video src={getOptimizedVideoUrl(p.fanz.videoUrl)} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover scale-[1.3] -translate-y-1" data-viewer-ignore="true" />
                  ) : p.fanz?.equippedSkinUrl && p.fanz.equippedSkinUrl !== "undefined" ? (
                     <img src={getImageUrl(p.fanz.equippedSkinUrl)} className="absolute inset-0 w-full h-full object-cover scale-[1.3] -translate-y-1" />
                  ) : p.fanz?.imageUrl && p.fanz.imageUrl !== "undefined" ? (
                     <img src={getImageUrl(p.fanz.imageUrl)} className="absolute inset-0 w-full h-full object-cover scale-[1.3] -translate-y-1" />
                  ) : p.photoURL && p.photoURL !== "undefined" ? (
                     <img src={p.photoURL} referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover" />
                  ) : null}
                </div>
              ))}
            </div>

            {/* Right side (Team B) */}
            <div className="absolute right-1 top-1/4 bottom-1/4 w-12 sm:w-16 flex flex-col justify-center gap-2 pointer-events-none z-[45]">
              {participants.filter(p => p.team === 'B').map((p, idx) => (
                <div 
                  key={p.uid} 
                  onClick={() => setSelectedTargetUid(p.uid)}
                  className="relative w-full aspect-square rounded-full border-2 border-red-500/50 overflow-hidden bg-black/60 shadow-[0_0_15px_rgba(239,68,68,0.3)] backdrop-blur-sm pointer-events-auto cursor-pointer hover:border-white transition-colors duration-200"
                >
                  {p.fanz?.equippedSkinVideoUrl && p.fanz.equippedSkinVideoUrl !== "undefined" ? (
                    <video src={getOptimizedVideoUrl(p.fanz.equippedSkinVideoUrl)} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover scale-[1.3] -translate-y-1 scale-x-[-1]" data-viewer-ignore="true" />
                  ) : p.fanz?.videoUrl && p.fanz.videoUrl !== "undefined" ? (
                    <video src={getOptimizedVideoUrl(p.fanz.videoUrl)} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover scale-[1.3] -translate-y-1 scale-x-[-1]" data-viewer-ignore="true" />
                  ) : p.fanz?.equippedSkinUrl && p.fanz.equippedSkinUrl !== "undefined" ? (
                     <img src={getImageUrl(p.fanz.equippedSkinUrl)} className="absolute inset-0 w-full h-full object-cover scale-[1.3] -translate-y-1 scale-x-[-1]" />
                  ) : p.fanz?.imageUrl && p.fanz.imageUrl !== "undefined" ? (
                     <img src={getImageUrl(p.fanz.imageUrl)} className="absolute inset-0 w-full h-full object-cover scale-[1.3] -translate-y-1 scale-x-[-1]" />
                  ) : p.photoURL && p.photoURL !== "undefined" ? (
                     <img src={p.photoURL} referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover" />
                  ) : null}
                </div>
              ))}
            </div>
          </>
        )}

      {/* Enemy Played Card Animation */}
      <AnimatePresence>
        {enemyPlayedCardAnim && (
          <motion.div
            key={`enemy-${enemyPlayedCardAnim.id}`}
            initial={{ opacity: 0, scale: 0.5, y: -100 }}
            animate={{ opacity: 1, scale: 0.8, y: 0 }}
            exit={{ opacity: 0, scale: 1.2, y: 100 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 z-[90] pointer-events-none flex justify-center items-center"
          >
            {/* Same design as user deck cards, just slightly larger */}
            <div className="min-w-[85px] w-[85px] h-[135px] scale-125 rounded-lg border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] flex flex-col relative overflow-hidden bg-[#1a1a1a]">
              {/* Background Image / Video */}
              {enemyPlayedCardAnim.card.videoUrl ? (
                <video src={getOptimizedVideoUrl(enemyPlayedCardAnim.card.videoUrl)} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover z-0 opacity-50" data-viewer-ignore="true" />
              ) : enemyPlayedCardAnim.card.imageUrl && (
                <img 
                  src={getImageUrl(enemyPlayedCardAnim.card.imageUrl)} 
                  alt={enemyPlayedCardAnim.card.name} 
                  className="absolute inset-0 w-full h-full object-cover z-0 opacity-50" data-viewer-ignore="true"
                  referrerPolicy="no-referrer"
                />
              )}
              {/* Gradient Overlay for readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/30 z-0" />

              {/* Card Content */}
              <div className="relative z-10 flex flex-col h-full p-2">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[8px] uppercase font-bold text-yellow-500 truncate pr-1 drop-shadow-md">{enemyPlayedCardAnim.card.rarity.substring(0, 3)}</span>
                  <div className="flex items-center gap-0.5 text-[10px] font-black text-yellow-500 drop-shadow-md">
                    ⚡{enemyPlayedCardAnim.card.energyCost > 10 ? Math.max(1, Math.round(enemyPlayedCardAnim.card.energyCost / 10)) : enemyPlayedCardAnim.card.energyCost}
                  </div>
                </div>
                <h5 className="font-black italic uppercase text-[10px] leading-tight mb-1 line-clamp-2 drop-shadow-md">{enemyPlayedCardAnim.card.name}</h5>
                <p className="text-[8px] text-gray-300 flex-1 line-clamp-3 leading-tight drop-shadow-md">{enemyPlayedCardAnim.card.description}</p>
                
                <div className="mt-1 flex justify-between items-center">
                  <div className="flex items-center gap-0.5 text-[8px] font-black text-yellow-500 uppercase drop-shadow-md">
                    Niv.1
                  </div>
                </div>
                <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all duration-500" style={{ width: '0%' }} />
                </div>

                <div className="mt-1 pt-1 border-t border-white/20 text-center font-black text-orange-400 drop-shadow-md">
                  {(enemyPlayedCardAnim.card.effects || []).map(e => (
                    <div key={e.type} className="text-[8px] uppercase truncate">
                      {e.type === 'push_rope' ? `+${Math.round(e.value)}%` : e.type.replace('_', ' ')}
                    </div>
                  ))}
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
            <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 bg-black/40 px-3 py-1.5 rounded-xl backdrop-blur-sm text-center whitespace-nowrap">
              <h3 className="text-[10px] md:text-xs font-black italic uppercase text-white drop-shadow-md">En attente d'adversaires...</h3>
              <p className="text-gray-300 text-[7px] md:text-[8px] font-bold uppercase tracking-widest mt-0.5">Le duel commencera dès que le salon sera complet.</p>
            </div>

            {/* VS Background Split */}
            <div className="absolute inset-0 flex flex-col overflow-hidden">
              <div className="absolute inset-0">
                {arenaBg.video ? (
                  <video src={getOptimizedVideoUrl(arenaBg.video)} autoPlay loop muted playsInline className="w-full h-full object-cover opacity-60" />
                ) : (
                  <img src={getImageUrl(arenaBg.image)} className="w-full h-full object-cover opacity-60" />
                )}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black z-[5]" />
            </div>

            {/* Huge Diagonal VS Separator */}
            <div className="absolute top-1/2 left-[-20%] right-[-20%] h-4 bg-orange-600 -translate-y-1/2 -rotate-6 z-[15] shadow-[0_0_30px_rgba(249,115,22,1)] border-t-2 border-b-2 border-yellow-400"></div>

            {/* VS Badge */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
              <div className="w-28 h-28 bg-black rounded-full border-4 border-orange-500 flex items-center justify-center shadow-[0_0_50px_rgba(249,115,22,0.8)] transform -rotate-12">
                <span className="text-5xl font-black italic text-orange-500 tracking-tighter drop-shadow-md">VS</span>
              </div>
            </div>

            {/* Teams Container */}
            <div className="absolute inset-0 flex flex-col justify-between pt-36 pb-40 z-10 pointer-events-none px-2">
              {/* Team A (Top) */}
              <div className="flex-1 flex flex-col items-center justify-end pb-8">
                <div className="flex justify-center gap-2 w-full max-w-lg mb-2">
                  <div className="flex items-center gap-2 bg-black/70 px-4 py-2 rounded-full border border-blue-500/30 backdrop-blur-md shadow-md z-[11]">
                    {teamALogo && <img src={getImageUrl(teamALogo, 60)} className="w-6 h-6 object-contain" referrerPolicy="no-referrer" />}
                    <span className="text-sm font-black text-blue-400 uppercase tracking-widest">{teamA}</span>
                  </div>
                </div>
                <div className="flex justify-center flex-wrap gap-2 w-full max-w-lg relative z-[11]">
                  {Array.from({ length: { '1v1': 1, '2v2': 2, '5v5': 5 }[duel.type as '1v1' | '2v2' | '5v5'] || 1 }).map((_, i) => {
                    const p = participants.filter(p => p.team === 'A')[i];
                    return (
                      <div 
                        key={`A-${i}`} 
                        onClick={() => p && setSelectedTargetUid(p.uid)}
                        className={`w-24 h-36 bg-black/40 border-b-4 border-blue-500/80 rounded-t-xl overflow-hidden relative flex flex-col items-center shadow-lg backdrop-blur-sm pointer-events-auto ${p ? 'cursor-pointer hover:border-white transition-colors duration-200' : ''}`}
                      >
                        {p ? (
                          <>
                            {p.fanz?.equippedSkinVideoUrl && p.fanz.equippedSkinVideoUrl !== "undefined" ? (
                              <video src={getOptimizedVideoUrl(p.fanz.equippedSkinVideoUrl)} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover z-0 opacity-80" data-viewer-ignore="true" />
                            ) : p.fanz?.videoUrl && p.fanz.videoUrl !== "undefined" ? (
                               <video src={getOptimizedVideoUrl(p.fanz.videoUrl)} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover z-0 opacity-80" data-viewer-ignore="true" />
                            ) : p.fanz?.equippedSkinUrl && p.fanz.equippedSkinUrl !== "undefined" ? (
                               <img src={getImageUrl(p.fanz.equippedSkinUrl)} className="absolute inset-0 w-full h-full object-cover z-0 opacity-80" />
                            ) : p.fanz?.imageUrl && p.fanz.imageUrl !== "undefined" ? (
                               <img src={getImageUrl(p.fanz.imageUrl)} className="absolute inset-0 w-full h-full object-cover z-0 opacity-80" />
                            ) : p.photoURL && p.photoURL !== "undefined" && (
                               <img src={p.photoURL} referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover z-0 opacity-80" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent z-0" />
                            
                            <div className="relative z-10 flex flex-col items-center justify-end w-full p-2 h-full">
                              <span className="text-[8px] text-blue-300 font-bold uppercase truncate w-full content-center text-center">{p.fanz?.name}</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full opacity-50 space-y-2">
                            <div className="w-6 h-6 border-2 border-blue-500/50 border-t-blue-400 rounded-full animate-spin" />
                            <span className="text-[8px] font-bold text-blue-400 uppercase tracking-widest text-center">En attente</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Team B (Bottom) */}
              <div className="flex-1 flex flex-col items-center justify-start pt-8">
                <div className="flex justify-center flex-wrap gap-2 w-full max-w-lg relative z-[11]">
                  {Array.from({ length: { '1v1': 1, '2v2': 2, '5v5': 5 }[duel.type as '1v1' | '2v2' | '5v5'] || 1 }).map((_, i) => {
                    const p = participants.filter(p => p.team === 'B')[i];
                    return (
                      <div 
                        key={`B-${i}`} 
                        onClick={() => p && setSelectedTargetUid(p.uid)}
                        className={`w-24 h-36 bg-black/40 border-t-4 border-red-500/80 rounded-b-xl overflow-hidden relative flex flex-col items-center shadow-lg backdrop-blur-sm pointer-events-auto ${p ? 'cursor-pointer hover:border-white transition-colors duration-200' : ''}`}
                      >
                        {p ? (
                          <>
                            {p.fanz?.equippedSkinVideoUrl && p.fanz.equippedSkinVideoUrl !== "undefined" ? (
                              <video src={getOptimizedVideoUrl(p.fanz.equippedSkinVideoUrl)} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover z-0 opacity-80 scale-x-[-1]" data-viewer-ignore="true" />
                            ) : p.fanz?.videoUrl && p.fanz.videoUrl !== "undefined" ? (
                               <video src={getOptimizedVideoUrl(p.fanz.videoUrl)} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover z-0 opacity-80 scale-x-[-1]" data-viewer-ignore="true" />
                            ) : p.fanz?.equippedSkinUrl && p.fanz.equippedSkinUrl !== "undefined" ? (
                               <img src={getImageUrl(p.fanz.equippedSkinUrl)} className="absolute inset-0 w-full h-full object-cover z-0 opacity-80" />
                            ) : p.fanz?.imageUrl && p.fanz.imageUrl !== "undefined" ? (
                               <img src={getImageUrl(p.fanz.imageUrl)} className="absolute inset-0 w-full h-full object-cover z-0 opacity-80" />
                            ) : p.photoURL && p.photoURL !== "undefined" && (
                               <img src={p.photoURL} referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover z-0 opacity-80" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-b from-black/90 to-transparent z-0" />
                            <div className="relative z-10 flex flex-col items-center justify-start w-full p-2 h-full">
                              <span className="text-[8px] text-red-300 font-bold uppercase truncate w-full text-center">{p.fanz?.name}</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full opacity-50 space-y-2">
                            <div className="w-6 h-6 border-2 border-red-500/50 border-t-red-400 rounded-full animate-spin" />
                            <span className="text-[8px] font-bold text-red-400 uppercase tracking-widest text-center">En attente</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-center gap-2 w-full max-w-lg mt-2">
                  <div className="flex items-center gap-2 bg-black/70 px-4 py-2 rounded-full border border-red-500/30 backdrop-blur-md shadow-md z-[11]">
                    {teamBLogo && <img src={getImageUrl(teamBLogo, 60)} className="w-6 h-6 object-contain" referrerPolicy="no-referrer" />}
                    <span className="text-sm font-black text-red-400 uppercase tracking-widest">{teamB}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Info & Invite */}
            <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center z-20 px-4 gap-4">
              <div className="w-full max-w-xs flex flex-col gap-2">
                {isMaster && (
                  <div className="w-full flex flex-col items-center gap-1.5 mb-1">
                    <button 
                      onClick={fillWithBots}
                      className="px-4 py-1.5 bg-blue-600/80 hover:bg-blue-500 text-white rounded-full font-black uppercase tracking-widest italic text-[8px] shadow-sm backdrop-blur-sm transition-all flex items-center justify-center gap-1.5 border border-blue-400/30"
                    >
                      <Users className="w-2.5 h-2.5" />
                      Lancer avec des Bots
                    </button>
                    {!isPrivate && (
                      <p className="text-[7px] md:text-[8px] font-black uppercase text-orange-500/80 italic text-center text-shadow-sm">
                        Remplissage auto dans {botFillTimer}s
                      </p>
                    )}
                  </div>
                )}

                {inviteCode && (
                  <div className="bg-black/60 backdrop-blur-md p-3 rounded-xl border border-white/10 flex flex-col items-center w-full">
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
                          const shareUrl = `${window.location.origin}/?join=${inviteCode}`;
                          navigator.share({
                            title: 'Rejoins mon duel The Best Fan !',
                            text: `Rejoins mon duel avec le code: ${inviteCode}\nClique ici pour rejoindre : ${shareUrl}`,
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

        {/* Confetti Overlay */}
        <AnimatePresence>
          {isConfetti && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 pointer-events-none flex flex-wrap gap-2 p-4 justify-around mix-blend-screen overflow-hidden"
            >
              {Array.from({ length: 50 }).map((_, i) => (
                <motion.div
                  key={`confetti-${i}`}
                  className={`w-3 h-3 ${['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500'][Math.floor(Math.random() * 6)]}`}
                  initial={{ y: -50, x: Math.random() * window.innerWidth, rotate: Math.random() * 360 }}
                  animate={{ y: window.innerHeight + 50, rotate: Math.random() * 720 }}
                  transition={{ duration: 1 + Math.random() * 2, repeat: Infinity, ease: 'linear' }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

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
          {isVampirism && <div className="flex items-center gap-1 text-[10px] font-bold text-purple-500 uppercase">🧛 Vampirisme</div>}
          {isFrenzy && <div className="flex items-center gap-1 text-[10px] font-bold text-red-500 uppercase">🔥 Frénésie</div>}
          {isSabotaged && <div className="flex items-center gap-1 text-[10px] font-bold text-red-600 uppercase">💣 Saboté</div>}
          {isImmune && <div className="flex items-center gap-1 text-[10px] font-bold text-green-400 uppercase">🛡️ Immunisé</div>}
          {isCriticalStrike && <div className="flex items-center gap-1 text-[10px] font-bold text-orange-500 uppercase">💥 Coup Critique</div>}
          {isMomentum && <div className="flex items-center gap-1 text-[10px] font-bold text-blue-300 uppercase">💨 Momentum</div>}
        </div>
        
        {/* Trade Stickers Confirm Block */}
        <AnimatePresence>
          {isTradingStickers && (
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="absolute bottom-[160px] left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-50 w-full max-w-sm px-4"
            >
              <div className="bg-blue-900/90 border-2 border-blue-400 p-3 rounded-xl shadow-[0_0_20px_blue] w-full text-center backdrop-blur-md">
                <p className="text-white font-bold mb-2">Sélectionnez jusqu'à 3 doubles ({selectedStickers.length}/3)</p>
                <div className="flex gap-2 w-full">
                  <button 
                    onClick={() => setIsTradingStickers(false)}
                    className="flex-1 py-2 rounded-lg bg-gray-700 text-white font-bold border border-gray-500 hover:bg-gray-600"
                  >
                    Ignorer
                  </button>
                  <button 
                    onClick={() => {
                      if (selectedStickers.length > 0) {
                        setHand(prev => prev.filter(c => !selectedStickers.includes(c.instanceId || c.id)));
                        setTimeout(() => drawCard(true, selectedStickers.length), 500);
                        addFloatingEffect(`🔄 ${selectedStickers.length} Carte(s) Échangée(s)!`, window.innerWidth / 2, 200, 'text-blue-400 font-bold max-w-[200px] text-center');
                      }
                      setIsTradingStickers(false);
                    }}
                    className={`flex-1 py-2 rounded-lg font-bold border ${selectedStickers.length > 0 ? 'bg-blue-600 text-white border-blue-400 hover:bg-blue-500' : 'bg-blue-900/50 text-blue-300/50 border-blue-800 cursor-not-allowed'}`}
                    disabled={selectedStickers.length === 0}
                  >
                    Échanger
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cards Hand */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar snap-x justify-center">
          <AnimatePresence>
            {hand.map(card => {
              const userCard = fanz?.cardProgress?.[card.id] || { level: 1, xp: 0 };
              const xpForNextLevel = userCard.level * 10;
              const xpProgress = (userCard.xp / xpForNextLevel) * 100;
              const actualCost = card.energyCost > 10 ? Math.max(1, Math.round(card.energyCost / 10)) : card.energyCost;

              return (
                <motion.div
                  key={card.instanceId || card.id}
                  layout
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -50, opacity: 0 }}
                  whileHover={{ y: -5 }}
                  onClick={(e) => {
                    if (isTradingStickers) {
                      const id = card.instanceId || card.id;
                      if (selectedStickers.includes(id)) {
                        setSelectedStickers(prev => prev.filter(s => s !== id));
                      } else if (selectedStickers.length < 3) {
                        setSelectedStickers(prev => [...prev, id]);
                      }
                    } else {
                      playCard(card, e);
                    }
                  }}
                  className={`min-w-[85px] w-[85px] h-[135px] snap-center shrink-0 rounded-lg border-2 flex flex-col cursor-pointer transition-all relative overflow-hidden ${
                    isTradingStickers 
                      ? (selectedStickers.includes(card.instanceId || card.id) ? 'border-blue-500 shadow-[0_0_15px_blue] scale-110 z-20' : 'border-gray-500 opacity-50')
                      : (excitement >= actualCost ? 'border-yellow-500 bg-yellow-600/10' : 'border-white/10 bg-white/5 opacity-50')
                  }`}
                >
                  {/* Background Image */}
                  {card.imageUrl && (
                    <img 
                      src={getImageUrl(card.imageUrl)} 
                      alt={card.name} 
                      className="absolute inset-0 w-full h-full object-cover z-0 opacity-50" data-viewer-ignore="true"
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
                      {(card.effects || []).map(e => (
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
                  onClick={() => onExitHandler('finished')}
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
              
              <div className={`border rounded-xl p-4 mb-6 ${duel.type === 'war_of_kops' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                <p className={`text-sm text-center font-medium ${duel.type === 'war_of_kops' ? 'text-blue-400' : 'text-red-400'}`}>
                  {status === 'waiting'
                    ? "Souhaitez-vous annuler votre recherche d'adversaire ou patienter en arrière-plan ?"
                    : duel.type === 'training' 
                    ? "Vous perdrez l'énergie et l'argent dépensé pour cet entraînement."
                    : duel.type === 'war_of_kops'
                    ? "Vous pouvez quitter la Guerre des KOPs pour faire autre chose ! Les points donnés à votre équipe sont sauvegardés. Vous recevrez de la Ferveur à la fin du match en fonction du résultat."
                    : "Vous perdrez l'énergie, l'argent et perdrez le match par forfait. Le résultat n'est pas pris en compte."}
                </p>
              </div>

              <div className="flex flex-col gap-3">
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
                {status === 'waiting' && (
                  <Button 
                    onClick={() => onExitHandler('background')}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white"
                  >
                    Mettre en arrière-plan
                  </Button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {selectedTargetUid && (
        <PublicProfileModal
          targetUid={selectedTargetUid}
          currentUser={user}
          onClose={() => setSelectedTargetUid(null)}
        />
      )}
    </div>
    </div>
  );
}
