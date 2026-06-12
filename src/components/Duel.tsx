import { PublicProfileModal } from './PublicProfileModal';
import { footballApi } from '../services/footballApi';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { useSocket } from '../context/SocketContext';
import { Duel, UserProfile, Card as GameCard, CardEffect, UserCard, Fanz, FanzTemplate, DuelConfig, FanzStats, FanzEmote, GlobalFervorConfig, Pass } from '../types';
import { Card, Button } from './Layout';
import { motion, AnimatePresence } from 'motion/react';
import { Swords, ChevronLeft, EyeOff, Ghost, Minimize2, Move, ChevronUp, Shield, RefreshCw, Activity, Lock, Flame, Brain, Star, Users, Search, Trophy, Target, CreditCard, Layers, Snowflake, MessageCircle, AlertCircle, Zap } from 'lucide-react';
import { BASE_CARDS } from '../constants/cards';
import { OptimizedMedia } from './OptimizedMedia';
import { LOGOS } from '../constants';
import { getImageUrl, getOptimizedVideoUrl, safeLocalStorage } from '../lib/utils';
import { audioManager } from '../lib/audio';
import { useMediaViewer } from '../context/MediaViewerContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, updateDoc, setDoc, collection, getDocs, increment, query, where, runTransaction, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { logTransaction } from '../services/transactionService';
import { progressMission } from '../services/missionService';
import { ErrorBoundary } from './ErrorBoundary';
import { useAlert } from '../context/AlertContext';
import { generateFervorPath } from '../utils/fervorPath';

import { getEffectiveFanz } from '../utils/skinModifiers';

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

const getDistinctTeamColors = (teamA: string, teamB: string) => {
  const hash = (str: string) => str.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
  
  const colors = [
    { text: 'text-blue-500', bg: 'bg-blue-600', border: 'border-blue-500', shadow: 'shadow-[0_0_20px_rgba(37,99,235,0.8)]', lg: 'from-blue-600', to: 'to-blue-600' },
    { text: 'text-red-500', bg: 'bg-red-600', border: 'border-red-500', shadow: 'shadow-[0_0_20px_rgba(220,38,38,0.8)]', lg: 'from-red-600', to: 'to-red-600' },
    { text: 'text-green-500', bg: 'bg-green-600', border: 'border-green-500', shadow: 'shadow-[0_0_20px_rgba(22,163,74,0.8)]', lg: 'from-green-600', to: 'to-green-600' },
    { text: 'text-purple-500', bg: 'bg-purple-600', border: 'border-purple-500', shadow: 'shadow-[0_0_20px_rgba(147,51,234,0.8)]', lg: 'from-purple-600', to: 'to-purple-600' },
    { text: 'text-orange-500', bg: 'bg-orange-600', border: 'border-orange-500', shadow: 'shadow-[0_0_20px_rgba(234,88,12,0.8)]', lg: 'from-orange-600', to: 'to-orange-600' },
    { text: 'text-teal-500', bg: 'bg-teal-600', border: 'border-teal-500', shadow: 'shadow-[0_0_20px_rgba(13,148,136,0.8)]', lg: 'from-teal-600', to: 'to-teal-600' },
    { text: 'text-pink-500', bg: 'bg-pink-600', border: 'border-pink-500', shadow: 'shadow-[0_0_20px_rgba(219,39,119,0.8)]', lg: 'from-pink-600', to: 'to-pink-600' },
    { text: 'text-yellow-500', bg: 'bg-yellow-600', border: 'border-yellow-500', shadow: 'shadow-[0_0_20px_rgba(202,138,4,0.8)]', lg: 'from-yellow-600', to: 'to-yellow-600' },
  ];
  
  let indexA = Math.abs(hash(teamA)) % colors.length;
  let indexB = Math.abs(hash(teamB)) % colors.length;
  
  if (indexA === indexB) {
    indexB = (indexB + 1) % colors.length;
  }
  
  return { colorA: colors[indexA], colorB: colors[indexB] };
};

export function DuelManager({ user, matchId, teamA, teamB, teamAId, teamBId, teamALogo, teamBLogo, onExit, initialDuelId, initialDuelType, isLiveMatch = true, isPrivate = false, onNavigateToFanz, duelLeagueId, duelSeason, initialInvitedFriend }: { user: UserProfile; matchId: string; teamA: string; teamB: string; teamAId?: string; teamBId?: string; teamALogo?: string; teamBLogo?: string; onExit: () => void; initialDuelId?: string; initialDuelType?: string; isLiveMatch?: boolean; isPrivate?: boolean; onNavigateToFanz?: (fanzId: string) => void; duelLeagueId?: string; duelSeason?: string; initialInvitedFriend?: UserProfile }) {
  const { showAlert } = useAlert();
  const [activeDuel, setActiveDuel] = useState<Duel | null>(null);
  
  const isXpBoostActive = user.boostXpUntil && new Date(user.boostXpUntil) > new Date();
  const isInfiniteEnergyActive = user.infiniteEnergyUntil && new Date(user.infiniteEnergyUntil) > new Date();
  const [selectedFanzId, setSelectedFanzId] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [selectedArena, setSelectedArena] = useState<string | null>(
    initialDuelType && !initialDuelId 
      ? (initialDuelType === 'training' && isPrivate ? 'training_1v1' : initialDuelType) 
      : null
  );
  const [isPrivateMode, setIsPrivateMode] = useState<boolean>(isPrivate);
  const [friendsList, setFriendsList] = useState<UserProfile[]>([]);
  const [invitedFriend, setInvitedFriend] = useState<UserProfile | null>(initialInvitedFriend || null);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [userFanzs, setUserFanzs] = useState<Fanz[]>([]);
  const [duelConfig, setDuelConfig] = useState<DuelConfig>(DEFAULT_DUEL_CONFIG);
  const [loading, setLoading] = useState(true);
  const [joiningDuelId, setJoiningDuelId] = useState<string | null>(initialDuelId || null);
  const [joiningDuelData, setJoiningDuelData] = useState<any | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [showDeckError, setShowDeckError] = useState(false);

  useEffect(() => {
    if (isPrivateMode && friendsList.length === 0) {
      const fetchFriendsList = async () => {
        setLoadingFriends(true);
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData?.friends && userData.friends.length > 0) {
              const fetchedFriends = await Promise.all(
                userData.friends.map(async (fuid: string) => {
                  try {
                    const friendDoc = await getDoc(doc(db, 'users', fuid));
                    if (friendDoc.exists()) {
                      return { uid: fuid, ...friendDoc.data() } as UserProfile;
                    }
                  } catch (err) {
                    console.error("Error fetching friend data:", err);
                  }
                  return null;
                })
              );
              setFriendsList(fetchedFriends.filter(Boolean) as UserProfile[]);
            }
          }
        } catch (err) {
          console.error("Error listing friends for duel manager:", err);
        } finally {
          setLoadingFriends(false);
        }
      };
      fetchFriendsList();
    }
  }, [isPrivateMode, user.uid, friendsList.length]);

  useEffect(() => {
    if (joiningDuelId) {
      const fetchDuelData = async () => {
        try {
          const res = await fetch(`/api/duels/id/${joiningDuelId}`, { headers: { 'Accept': 'application/json' }});
          if (res.ok) {
            const contentType = res.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const duel = await res.json();
              if (duel) {
              // Check if user is already a participant
              const existingParticipant = duel.participants.find((p: any) => p.uid === user.uid);
              if (existingParticipant) {
                // User is already in this duel, jump straight to it
                if (existingParticipant.fanz?.id) {
                  setSelectedFanzId(existingParticipant.fanz.id);
                } else if (existingParticipant.fanzId) {
                  setSelectedFanzId(existingParticipant.fanzId);
                }
                
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
                  inviteCode: duel.inviteCode,
                  invitedUids: duel.invitedUids
                });
                return;
              }

              setJoiningDuelData(duel);
              // Auto-select team if only one is available
              const maxPlayersPerTeam = (duel.type === 'training' && duel.trainingType === '1v1') ? 1 : ({ '1v1': 1, '2v2': 2, '5v5': 5 }[duel.type as '1v1' | '2v2' | '5v5'] || 999);
              const countA = duel.participants.filter((p: any) => p.team === 'A').length;
              const countB = duel.participants.filter((p: any) => p.team === 'B').length;
              
              if (countA >= maxPlayersPerTeam && countB < maxPlayersPerTeam) {
                setSelectedTeam(teamB);
              } else if (countB >= maxPlayersPerTeam && countA < maxPlayersPerTeam) {
                setSelectedTeam(teamA);
              }
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
    if (!duelConfig || !fanz || !fanz.stats) return 0;
    const effect = duelConfig.statEffects.find(e => e.effectType === effectType);
    if (!effect) return 0;
    const statXp = (fanz.stats as any)[effect.statName] || 1;
    const statLevel = Math.min(10, Math.floor(statXp / 100) + 1);
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
          const template = templatesMap.get(data.templateId) as FanzTemplate;
          let effectiveFanzData = data;
          if (template) {
             effectiveFanzData = getEffectiveFanz(data, template);
          }
          const skin = template?.skins?.find(s => s.id === data.equippedSkin);
          return {
            ...effectiveFanzData,
            id: d.id,
            name: effectiveFanzData.name || template?.name || 'Unknown Fanz',
            imageUrl: effectiveFanzData.imageUrl || template?.image || null,
            _skinBonus: skin || null
          } as any;
        });
        setUserFanzs(fanzList);
        setSelectedFanzId(prev => prev || (fanzList.length > 0 ? fanzList[0].id : null));
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

    const finalType = type as any === 'training_1v1' ? 'training' : type;
    const trainingType = type as any === 'training_1v1' ? '1v1' : (type === 'training' ? 'solo' : undefined);

    const baseCost = duelConfig.costs[finalType as keyof typeof duelConfig.costs] || { money: 0, energy: 0 };
    const skinBonus = (selectedFanz as any)._skinBonus;
    const energyReductionPct = skinBonus?.energyCostReduction || 0;
    const moneyReductionPct = skinBonus?.moneyCostReduction || 0;
    
    const costMoney = Math.max(0, Math.round(baseCost.money * (1 - moneyReductionPct / 100)));
    const costEnergy = Math.max(0, Math.round(baseCost.energy * (1 - energyReductionPct / 100)));
    
    const effectiveEnergyCost = isInfiniteEnergyActive ? 0 : costEnergy;
    
    if (user.money < costMoney || user.energy < effectiveEnergyCost) {
      showAlert({ type: 'error', title: 'Fonds ou énergie insuffisants !' });
      return;
    }

    try {
      // Deduct costs
      await updateDoc(doc(db, 'users', user.uid), {
        money: increment(-costMoney),
        energy: increment(-effectiveEnergyCost)
      });

      if (costMoney > 0) await logTransaction(user.uid, 'money', -costMoney, `Inscription duel: ${finalType}`);
      if (effectiveEnergyCost > 0) await logTransaction(user.uid, 'energy', -effectiveEnergyCost, `Inscription duel: ${finalType}`);

      const duelId = joiningDuelId || (finalType === 'training' ? `training_${user.uid}_${Date.now()}` : `${finalType}_${matchId}_${Math.random().toString(36).substring(7)}`);
      
      setJoiningDuelId(null);
      setActiveDuel({
        id: duelId,
        type: finalType,
        trainingType,
        status: 'waiting',
        matchId,
        teamA: teamA,
        teamB: teamB,
        progress: 50,
        participants: [],
        createdAt: new Date().toISOString(),
        isPrivate: joiningDuelData ? joiningDuelData.isPrivate : isPrivateMode,
        inviteCode: (joiningDuelData && joiningDuelData.inviteCode) ? joiningDuelData.inviteCode : (inviteCode || undefined),
        invitedUids: joiningDuelData ? joiningDuelData.invitedUids : (isPrivateMode && invitedFriend ? [invitedFriend.uid] : undefined)
      } as any);
    } catch (err) {
      console.error("Error starting duel", err);
    }
  };

  if (activeDuel) {
    if (!selectedFanzId) {
      return (
        <div className="flex h-screen items-center justify-center bg-black text-white">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
            <p className="text-sm font-bold uppercase tracking-widest text-gray-400">Préparation du Fanz...</p>
          </div>
        </div>
      );
    }

    return (
      <ErrorBoundary onReset={() => setActiveDuel(null)}>
        <DuelScreen 
          duel={activeDuel} 
          user={user} 
          fanzId={selectedFanzId} 
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
                const maxPlayersPerTeam = joiningDuelData 
                  ? ((joiningDuelData.type === 'training' && joiningDuelData.trainingType === '1v1') ? 1 : ({ '1v1': 1, '2v2': 2, '5v5': 5 }[joiningDuelData.type as '1v1' | '2v2' | '5v5'] || 999)) 
                  : 999;
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
                  { id: 'training_1v1', title: 'Entraînement 1v1', subtitle: '1 VS 1 Amical', bg: 'background1v1.png', video: 'videoBackground1v1.mp4', fullWidth: false },
                  { id: '1v1', title: 'Duel devant ta télé', subtitle: '1 VS 1', bg: 'background1v1.png', video: 'videoBackground1v1.mp4', fullWidth: false },
                  { id: '2v2', title: 'Soirée au pub', subtitle: '2 VS 2', bg: 'background2v2.png', video: 'videoBackground2v2.mp4', fullWidth: false },
                  { id: '5v5', title: 'Fanzone survoltée', subtitle: '5 VS 5', bg: 'background5v5.png', video: 'videoBackground5v5.mp4', fullWidth: false },
                  { id: 'war_of_kops', title: 'Guerre des KOPs', subtitle: 'XX VS XX', bg: 'backgroundKOP.png', video: 'videoBackgroundKOP.mp4', fullWidth: false }
                ].filter(arena => {
                  if (isLiveMatch) {
                    return arena.id !== 'training' && arena.id !== 'training_1v1';
                  } else {
                    return arena.id === 'training' || arena.id === 'training_1v1';
                  }
                }).map(arena => {
                  const baseCost = (duelConfig?.costs[arena.id as keyof typeof duelConfig.costs] || 
                                    (arena.id === 'training_1v1' ? duelConfig?.costs['training'] : null) || 
                                    { money: 0, energy: 0 });
                  
                  const skinBonus = (selectedFanz as any)?._skinBonus;
                  const energyReductionPct = skinBonus?.energyCostReduction || 0;
                  const moneyReductionPct = skinBonus?.moneyCostReduction || 0;
                  
                  const costEnergy = Math.max(0, Math.round(baseCost.energy * (1 - energyReductionPct / 100)));
                  const costMoney = Math.max(0, Math.round(baseCost.money * (1 - moneyReductionPct / 100)));

                  const baseUrl = 'https://thebestfan.online/img/public/background/';
                  const bgUrl = `${baseUrl}${arena.bg}`;
                  
                  return (
                    <button
                      key={arena.id}
                      onClick={() => {
                        setSelectedArena(arena.id);
                        if (arena.id === 'training') {
                          setIsPrivateMode(false);
                          setInvitedFriend(null);
                        } else if (arena.id === 'training_1v1') {
                          // training 1v1 can be public or private
                        }
                      }}
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
                            {costEnergy} ⚡
                          </div>
                          <div className="flex items-center gap-1 text-green-500 font-black text-xs sm:text-sm">
                            {costMoney} $
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              
              {selectedArena && selectedArena !== 'training' && (
                <div className="space-y-3 mt-4">
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-white">Duel Privé</h4>
                      <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-widest">Jouez uniquement avec un ami</p>
                    </div>
                    <button 
                      onClick={() => {
                        const nextMode = !isPrivateMode;
                        setIsPrivateMode(nextMode);
                        if (!nextMode) setInvitedFriend(null);
                      }}
                      className={`w-12 h-6 rounded-full transition-colors relative ${isPrivateMode ? 'bg-orange-500' : 'bg-gray-600'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-[4px] transition-transform ${isPrivateMode ? 'left-[26px]' : 'left-[4px]'}`} />
                    </button>
                  </div>

                  {isPrivateMode && (
                    <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                      <h4 className="text-xs font-black uppercase text-gray-300 tracking-wider">Inviter un Ami (Notification directe)</h4>
                      {loadingFriends ? (
                         <div className="text-xs text-gray-500 font-bold uppercase animate-pulse">Chargement de tes amis...</div>
                      ) : friendsList.length === 0 ? (
                         <div className="text-xs text-gray-500 font-bold uppercase italic">Tu n'as pas encore d'amis ajoutés dans l'onglet social.</div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1 no-scrollbar">
                          {friendsList.map((friend) => {
                            const isSelected = invitedFriend?.uid === friend.uid;
                            return (
                              <div key={friend.uid} className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-white/5">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-orange-500/15 border border-orange-500/30 flex items-center justify-center font-extrabold text-xs text-orange-500">
                                    {friend.pseudo?.substring(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="text-xs font-black text-white">{friend.pseudo}</div>
                                    <div className="text-[8px] font-bold text-gray-400 uppercase">Niveau {friend.level || 1}</div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setInvitedFriend(isSelected ? null : friend)}
                                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                                    isSelected 
                                      ? 'bg-green-600 text-white shadow-md shadow-green-600/20' 
                                      : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                                  }`}
                                >
                                  {isSelected ? 'Invité ✓' : 'Inviter'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {invitedFriend && (
                        <div className="p-2.5 rounded-lg bg-green-500/10 border border-green-500/20 text-[10px] font-bold uppercase text-green-400">
                          👉 Une notification directe sera envoyée à <strong className="font-extrabold">{invitedFriend.pseudo}</strong> dès le lancement !
                        </div>
                      )}
                    </div>
                  )}
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
  const { openMedia } = useMediaViewer();
  const [progress, setProgress] = useState(50);
  const [excitement, setExcitement] = useState(5);
  const maxExcitement = 10;
  const { socket } = useSocket();
  const [winner, setWinner] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState<boolean>(duel.isPrivate || false);
  const [duelResult, setDuelResult] = useState<{ winner: string, ferveurGain: number, teamGain: number, scoreA?: number, scoreB?: number, details?: any, isBotMatch?: boolean, videoUrl?: string | null, imageUrl?: string | null, isWin?: boolean } | null>(null);
  const [showDuelResultDetails, setShowDuelResultDetails] = useState<boolean>(false);
  const [status, setStatus] = useState<'waiting' | 'room_full' | 'starting' | 'active' | 'finished'>(duel.status as any);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [inviteCode, setInviteCode] = useState(duel.inviteCode);
  const [invitedUids, setInvitedUids] = useState<string[]>(duel.invitedUids || []);
  const [participants, setParticipants] = useState<any[]>(duel.participants || []);
  const [currentDuelId, setCurrentDuelIdState] = useState<string>(duel.id);
  const currentDuelIdRef = useRef(duel.id);
  const initialDuelType = useRef(duel.type).current;
  const [floatingEffects, setFloatingEffects] = useState<FloatingEffect[]>([]);
  const botEnergyRef = useRef<Record<string, number>>({});
  const [matchDetails, setMatchDetails] = useState<any>(null);
  const previousMatchDetailsRef = useRef<any>(null);
  const clicksCountRef = useRef(0);
  const cardsPlayedCountRef = useRef(0);
  const emotesSentCountRef = useRef(0);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const { colorA, colorB } = React.useMemo(() => getDistinctTeamColors(duel.teamA || 'Team A', duel.teamB || 'Team B'), [duel.teamA, duel.teamB]);

  // Persistence: Store/Clear current duel
  useEffect(() => {
    if (duel.id) {
      safeLocalStorage.setItem('tbfo_current_duel', JSON.stringify({
        id: duel.id,
        type: duel.type,
        matchId: parseInt(duel.matchId || '0')
      }));
    }
  }, [duel.id, duel.type, duel.matchId]);

  const clearDuelPersistence = () => {
    console.log("[Duel] Clearing duel persistence");
    safeLocalStorage.removeItem('tbfo_current_duel');
  };

  const onExitHandler = (status?: string) => {
    if (status === 'background') {
      safeLocalStorage.setItem('tbfo_background_duel', JSON.stringify({
        duelId: currentDuelIdRef.current,
        matchId: duel.matchId,
        type: duel.type,
        isPrivate: duel.isPrivate
      }));
    } else {
      clearDuelPersistence();
      safeLocalStorage.removeItem('tbfo_background_duel');
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

  const confirmExit = async () => {
    // Client-side refund if leaving while waiting
    if ((status === 'waiting' || status === 'room_full') && duelConfig && duelConfig.costs) {
      const type = duel.type;
      const baseCost = duelConfig.costs[type as keyof typeof duelConfig.costs] || { money: 0, energy: 0 };
      
      const participantFanzId = duel.participants.find((p: any) => p.uid === user.uid)?.fanzId || fanzId;
      try {
        const fanzSnap = await getDoc(doc(db, 'fanz', participantFanzId));
        if (fanzSnap.exists()) {
          const fanzData = fanzSnap.data();
          const targetSkin = fanzData.equippedSkin;
          let skinBonus = { energyCostReduction: 0, moneyCostReduction: 0 };
          if (targetSkin) {
             const skinSnap = await getDoc(doc(db, 'skins', targetSkin));
             if (skinSnap.exists()) {
                const skinRes = skinSnap.data();
                if (skinRes.bonus) {
                  skinBonus = {
                     energyCostReduction: skinRes.bonus.energyCostReduction || 0,
                     moneyCostReduction: skinRes.bonus.moneyCostReduction || 0
                  };
                }
             }
          }
          
          const energyReductionPct = skinBonus.energyCostReduction || 0;
          const moneyReductionPct = skinBonus.moneyCostReduction || 0;
          
          const costMoney = Math.max(0, Math.round(baseCost.money * (1 - moneyReductionPct / 100)));
          const costEnergy = Math.max(0, Math.round(baseCost.energy * (1 - energyReductionPct / 100)));
          
          let effectiveEnergyCost = costEnergy;
          if (user.infiniteEnergyUntil && new Date(user.infiniteEnergyUntil) > new Date()) {
            effectiveEnergyCost = 0;
          }
          
          if (costMoney > 0 || effectiveEnergyCost > 0) {
            await updateDoc(doc(db, 'users', user.uid), {
              money: increment(costMoney),
              energy: increment(effectiveEnergyCost)
            });
            if (costMoney > 0) await logTransaction(user.uid, 'money', costMoney, `Remboursement annulation duel: ${type}`);
            if (effectiveEnergyCost > 0) await logTransaction(user.uid, 'energy', effectiveEnergyCost, `Remboursement annulation duel: ${type}`);
          }
        }
      } catch (err) {
        console.error("Failed to refund on exit", err);
      }
    }
    
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
  const [equippedDeck, setEquippedDeck] = useState<GameCard[]>([]);
  const allCardsRef = useRef<GameCard[]>([]);
  useEffect(() => { allCardsRef.current = allCards; }, [allCards]);
  const equippedDeckRef = useRef<GameCard[]>([]);
  useEffect(() => { equippedDeckRef.current = equippedDeck; }, [equippedDeck]);
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
    if (!duelConfig || !fanz || !fanz.stats) return isMultiplier ? 1 : 0;
    const effect = duelConfig.statEffects.find(e => e.effectType === effectType);
    if (!effect) return isMultiplier ? 1 : 0;
    const statXp = (fanz.stats as any)[effect.statName] || 1;
    const statLevel = Math.min(10, Math.floor(statXp / 100) + 1);
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
  const [lastMyCard, setLastMyCard] = useState<GameCard | null>(null);
  const [isHalfHalfScarfActive, setIsHalfHalfScarfActive] = useState(false);
  const [isMegaphoneEchoActive, setIsMegaphoneEchoActive] = useState(false);
  const [lockedCardInstanceIds, setLockedCardInstanceIds] = useState<string[]>([]);
  const [isEarlyCraquageActive, setIsEarlyCraquageActive] = useState(false);
  const [isEnemyEarlyCraquageActive, setIsEnemyEarlyCraquageActive] = useState(false);
  const [isLaserRelaunchActive, setIsLaserRelaunchActive] = useState(false);
  const [isEnemyLaserRelaunchActive, setIsEnemyLaserRelaunchActive] = useState(false);
  const [isMentalMainCouranteActive, setIsMentalMainCouranteActive] = useState(false);
  const [isEnemyMentalMainCouranteActive, setIsEnemyMentalMainCouranteActive] = useState(false);
  const [isHeritageWeightActive, setIsHeritageWeightActive] = useState(false);
  const [isEnemyHeritageWeightActive, setIsEnemyHeritageWeightActive] = useState(false);
  const [isBuvetteAlertActive, setIsBuvetteAlertActive] = useState(false);
  const [hasConsumedBuvette, setHasConsumedBuvette] = useState(false);
  const [isTikTokHighlightActive, setIsTikTokHighlightActive] = useState(false);
  const [isEnemyTikTokHighlightActive, setIsEnemyTikTokHighlightActive] = useState(false);
  const [isPrimeGoatActive, setIsPrimeGoatActive] = useState(false);
  const [isEnemyPrimeGoatActive, setIsEnemyPrimeGoatActive] = useState(false);
  const [isDebatePickerOpen, setIsDebatePickerOpen] = useState(false);
  const [hasLastActionFailed, setHasLastActionFailed] = useState(false);
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
  const [isStunned, setIsStunned] = useState(false);
  const [isHeavyBallPower, setIsHeavyBallPower] = useState(false);
  const [isIntimidated, setIsIntimidated] = useState(false);
  const [isWallOfShieldsActive, setIsWallOfShieldsActive] = useState(false);
  const [isOdinClappingActive, setIsOdinClappingActive] = useState(false);
  const [isEnemyOdinClappingActive, setIsEnemyOdinClappingActive] = useState(false);
  const [odinClickBonus, setOdinClickBonus] = useState(0);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isParrotTauntActive, setIsParrotTauntActive] = useState(false);
  const [isEnemyParrotTauntActive, setIsEnemyParrotTauntActive] = useState(false);
  const [isBlind, setIsBlind] = useState(false);
  const [isEnemyBlind, setIsEnemyBlind] = useState(false);
  const [isLockerRoomCursed, setIsLockerRoomCursed] = useState(false);
  const [hasLockerRoomCurseTrap, setHasLockerRoomCurseTrap] = useState(false);
  const [isLuminescentStandardActive, setIsLuminescentStandardActive] = useState(false);
  const [isEnemyLuminescentStandardActive, setIsEnemyLuminescentStandardActive] = useState(false);
  const [playedHistory, setPlayedHistory] = useState<GameCard[]>([]);
  const [isGrimoirePickerOpen, setIsGrimoirePickerOpen] = useState(false);
  const [grimoireEligibleCards, setGrimoireEligibleCards] = useState<GameCard[]>([]);
  const [isVarOverlayActive, setIsVarOverlayActive] = useState(false);
  const [isBurningSeatsOverlayActive, setIsBurningSeatsOverlayActive] = useState(false);
  const [isTifoHolographiqueActive, setIsTifoHolographiqueActive] = useState(false);
  const [isEnemyTifoHolographiqueActive, setIsEnemyTifoHolographiqueActive] = useState(false);
  const [isCapoMegaphoneActive, setIsCapoMegaphoneActive] = useState(false);
  const [isEnemyCapoMegaphoneActive, setIsEnemyCapoMegaphoneActive] = useState(false);
  const [isCraquageMassifActive, setIsCraquageMassifActive] = useState(false);
  const [isEnemyCraquageMassifActive, setIsEnemyCraquageMassifActive] = useState(false);
  const [isMetaUpdateActive, setIsMetaUpdateActive] = useState(false);
  const [isEnemyMetaUpdateActive, setIsEnemyMetaUpdateActive] = useState(false);
  const [stateSnapshots, setStateSnapshots] = useState<{
    progress: number;
    excitement: number;
    hand: GameCard[];
    hasShield: boolean;
    isLuminescentStandardActive: boolean;
    isTifoHolographiqueActive: boolean;
    isCapoMegaphoneActive: boolean;
    isCraquageMassifActive: boolean;
  }[]>([]);
  const [lastEnemyCard, setLastEnemyCard] = useState<GameCard | null>(null);
  const [buttonPosition, setButtonPosition] = useState({ x: 0, y: 0 });

  const playSound = (url?: string) => {
    if (url) {
      const audio = new Audio(getImageUrl(url));
      audio.play().catch(e => console.log('Audio play failed', e));
    }
  };

  const saveSnapshot = (currentHand: GameCard[], currentExcitement: number) => {
    setStateSnapshots(prev => {
      const snap = {
        progress: progress,
        excitement: currentExcitement,
        hand: [...currentHand],
        hasShield: hasShield,
        isLuminescentStandardActive: isLuminescentStandardActive,
        isTifoHolographiqueActive: isTifoHolographiqueActive,
        isCapoMegaphoneActive: isCapoMegaphoneActive,
        isCraquageMassifActive: isCraquageMassifActive,
      };
      return [...prev.slice(-11), snap];
    });
  };

  // Emotes State
  const [allEmotes, setAllEmotes] = useState<FanzEmote[]>([]);
  const [unlockedEmoteIds, setUnlockedEmoteIds] = useState<string[]>(user.emotes || []);
  const [showEmotes, setShowEmotes] = useState(false);
  const [activeEmotes, setActiveEmotes] = useState<{id: string, emoteId: string, team: string, x: number | string, y: number | string}[]>([]);
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
          let equippedSkinVictoryVideoUrl = null;
          let equippedSkinDefeatVideoUrl = null;
          let equippedSkinId = null;
          let tplData: any = null;
          if (fanzData.templateId) {
            const tplSnap = await getDoc(doc(db, 'fanz_templates', fanzData.templateId));
            if (tplSnap.exists()) {
              tplData = tplSnap.data() as FanzTemplate;
              if (!imageUrl) imageUrl = tplData.image || null;
              
              let skin = fanzData.equippedSkin ? tplData.skins?.find((s: any) => s.id === fanzData.equippedSkin) : null;
              if (skin) {
                equippedSkinId = skin.id;
                equippedSkinUrl = skin.imageUrl || tplData.image;
                equippedSkinVideoUrl = skin.videoUrl || tplData.video || null;
                equippedSkinVictoryVideoUrl = skin.victoryVideoUrl || tplData.victoryVideoUrl || null;
                equippedSkinDefeatVideoUrl = skin.defeatVideoUrl || tplData.defeatVideoUrl || null;
                
                // Apply stat bonuses
                if (skin.statsBonus) {
                  if (!fanzData.stats) fanzData.stats = { force: 0, mental: 0, intelligence: 0, creativity: 0, bluff: 0, social: 0, charisma: 0, endurance: 0 };
                  if (skin.statsBonus.force) fanzData.stats.force = (fanzData.stats.force || 0) + (skin.statsBonus.force * 100);
                  if (skin.statsBonus.mental) fanzData.stats.mental = (fanzData.stats.mental || 0) + (skin.statsBonus.mental * 100);
                  if (skin.statsBonus.intelligence) fanzData.stats.intelligence = (fanzData.stats.intelligence || 0) + (skin.statsBonus.intelligence * 100);
                  if (skin.statsBonus.creativity) fanzData.stats.creativity = (fanzData.stats.creativity || 0) + (skin.statsBonus.creativity * 100);
                  if (skin.statsBonus.bluff) fanzData.stats.bluff = (fanzData.stats.bluff || 0) + (skin.statsBonus.bluff * 100);
                  if (skin.statsBonus.social) fanzData.stats.social = (fanzData.stats.social || 0) + (skin.statsBonus.social * 100);
                  if (skin.statsBonus.charisma) fanzData.stats.charisma = (fanzData.stats.charisma || 0) + (skin.statsBonus.charisma * 100);
                  if (skin.statsBonus.endurance) fanzData.stats.endurance = (fanzData.stats.endurance || 0) + (skin.statsBonus.endurance * 100);

                  // Ensure minimum 0
                  Object.keys(fanzData.stats).forEach(k => {
                    if ((fanzData.stats as any)[k] < 0) (fanzData.stats as any)[k] = 0;
                  });
                }

                // Inject special card
                if (skin.specialCardId) {
                  if (!fanzData.equippedCards) fanzData.equippedCards = [];
                  if (!fanzData.equippedCards.includes(skin.specialCardId)) {
                    fanzData.equippedCards.push(skin.specialCardId);
                  }
                }
              } else {
                // Base skin (no skin equipped or skin not found)
                equippedSkinId = `base_${tplData.id}`;
                equippedSkinUrl = tplData.image;
                equippedSkinVideoUrl = tplData.video || null;
                equippedSkinVictoryVideoUrl = tplData.victoryVideoUrl || null;
                equippedSkinDefeatVideoUrl = tplData.defeatVideoUrl || null;
              }
            }
          }
          
          const finalFanz = { 
             ...fanzData, 
             imageUrl, 
             equippedSkinUrl, 
             equippedSkinVideoUrl, 
             equippedSkinVictoryVideoUrl, 
             equippedSkinDefeatVideoUrl,
             equippedSkinActualId: equippedSkinId
          };
          setFanz(finalFanz as any);
          
          // Filter all available cards for this Fanz template
          const fanzAvailableCards = initialCards.filter(c => {
            const fanzIdsArray = Array.isArray(c.fanzIds) ? c.fanzIds : (typeof c.fanzIds === 'string' ? [c.fanzIds] : []);
            const blockedFanzIdsArray = Array.isArray(c.blockedFanzIds) ? c.blockedFanzIds : (typeof c.blockedFanzIds === 'string' ? [c.blockedFanzIds] : []);
            
            const isAllowed = !c.fanzIds || fanzIdsArray.length === 0 || (fanzData.templateId && fanzIdsArray.includes(fanzData.templateId));
            const isBlocked = c.blockedFanzIds && fanzData.templateId && blockedFanzIdsArray.includes(fanzData.templateId);
            const isSkinMatch = !c.skinId || c.skinId === fanzData.equippedSkin;
            let themeMatch = true;
            if (c.skinTheme && fanzData.equippedSkin) {
               const theme = c.skinTheme.toLowerCase();
               if (fanzData.equippedSkin.toLowerCase().includes(theme)) {
                  themeMatch = true;
               } else {
                  let skinObj = null;
                  if (tplData?.skins) {
                     skinObj = tplData.skins.find((s: any) => s.id === fanzData.equippedSkin);
                  }
                  themeMatch = skinObj && skinObj.name && skinObj.name.toLowerCase().includes(theme);
               }
            } else if (c.skinTheme && !fanzData.equippedSkin) {
               themeMatch = false; // Requires a themed skin but none equipped
            }
            return isAllowed && !isBlocked && isSkinMatch && themeMatch;
          });
          setAllCards(fanzAvailableCards);

          let equippedCardsForDeck = [];
          if (fanzData.equippedCards && Array.isArray(fanzData.equippedCards) && fanzData.equippedCards.length > 0) {
            equippedCardsForDeck = fanzAvailableCards.filter(c => fanzData.equippedCards?.includes(c.id));
            cardsToUse = equippedCardsForDeck;
          } else {
            equippedCardsForDeck = fanzAvailableCards;
            cardsToUse = fanzAvailableCards;
          }
          setEquippedDeck(equippedCardsForDeck);

          // Setup energy based on stats
          const configSnap = await getDoc(doc(db, 'global_configs', 'duel_config'));
          if (configSnap.exists()) {
            const config = configSnap.data() as DuelConfig;
            const getStatValue = (type: string, stats: FanzStats) => {
              if (!stats) return 0;
              const effect = config.statEffects.find(e => e.effectType === type);
              if (!effect) return 0;
              const statXp = (stats as any)[effect.statName] || 1;
              const statLevel = Math.min(10, Math.floor(statXp / 100) + 1);
              return effect.baseValue + (statLevel * effect.multiplierPerLevel);
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
          if (template.emotes && Array.isArray(template.emotes)) {
            emotes.push(...template.emotes);
          } else if (template.emotes && typeof template.emotes === 'object') {
            emotes.push(...Object.values(template.emotes));
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
            // setFanz was here, overwriting our carefully constructed finalFanz with raw DB data.
            // We just need fanzData for the emotes.
            if (Array.isArray(fanzData.unlockedEmotes)) {
              fanzEmotes = fanzData.unlockedEmotes;
            }
          }

          const combinedEmotes = Array.from(new Set([
            ...(Array.isArray(userData.emotes) ? userData.emotes : []),
            ...(Array.isArray(fanzEmotes) ? fanzEmotes : [])
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
        trainingType: duel.trainingType,
        matchId: duel.matchId,
        team: selectedTeam === teamA ? 'A' : 'B',
        isPrivate: duel.isPrivate,
        inviteCode: duel.inviteCode,
        invitedUids: duel.invitedUids,
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
          const currentAllCards = allCardsRef.current;
          const currentEquippedDeck = equippedDeckRef.current;

          if (currentEnergy >= 2 && Math.random() < cardChance && currentAllCards.length > 0) {
            // Pick a card from the user's exact equipped deck
            const cardsToPickFrom = currentEquippedDeck.length > 0 ? currentEquippedDeck : currentAllCards;
            
            const card = cardsToPickFrom[Math.floor(Math.random() * cardsToPickFrom.length)];
            const cost = card && typeof card.energyCost === 'number' ? (card.energyCost > 10 ? Math.max(1, Math.round(card.energyCost / 10)) : card.energyCost) : 3;

            if (card && currentEnergy >= cost) {
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
      if (botSimulationInterval) clearInterval(botSimulationInterval);
    };
  }, [socket, status, isMaster, participants.length, allCards.length, equippedDeck]);

  const fillWithBots = useCallback(() => {
    if (!socket || !isMaster) return;
    
    // Safety check to ensure we only fill current active/waiting duels.
    if (!currentDuelIdRef.current) return;
    
    // Instead of using participants reference directly for count, we use the state snapshot at time of call if possible, 
    // but we can just use the latest participant length via dependency. Wait, participants is a closure.
    // Let's use setParticipants callback or just participants since we really just need the counts
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
        user: { uid: bot.uid, pseudo: bot.pseudo, photoURL: bot.photoURL, level: bot.level, isBot: true }, 
        team: bot.team,
        fanz: bot.fanz,
        isBot: true 
      });
    });
  }, [socket, isMaster, duel.type, participants, fanz, user.level]);

  useEffect(() => {
    // Automatically launch bots in training (only if not training 1v1)
    if (duel.type === 'training' && duel.trainingType !== '1v1' && (status === 'waiting' || status === 'active') && isMaster && fanz && currentDuelIdRef.current) {
      if (participants.length < 2) {
         // Add a small delay to ensure room is fully created on server before auto-filling
         const timer = setTimeout(fillWithBots, 500);
         return () => clearTimeout(timer);
      }
    }
  }, [duel.type, duel.trainingType, status, isMaster, fanz, fillWithBots, participants.length]);

  useEffect(() => {
    if (!socket) return;

    const handleDuelUpdate = (state: { duelId?: string; progress: number; status: any; participants?: any[]; inviteCode?: string; isPrivate?: boolean; invitedUids?: string[] }) => {
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
      if (state.invitedUids) {
        setInvitedUids(state.invitedUids);
      }
    };

    const handleDuelJoined = ({ status, participants, team, duelId: serverDuelId, inviteCode: serverInviteCode, invitedUids: serverInvitedUids }: any) => {
      if (status) setStatus(status);
      if (participants) setParticipants(participants);
      if (team) setMyTeam(team);
      if (serverDuelId) setCurrentDuelId(serverDuelId);
      if (serverInviteCode) setInviteCode(serverInviteCode);
      if (serverInvitedUids) setInvitedUids(serverInvitedUids);
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

    socket.on('duel-forfeit', ({ message }) => {
      addFloatingEffect(`🚪 ${message}`, window.innerWidth / 2, window.innerHeight / 2, 'text-green-400 font-black scale-150 z-[999] p-4 bg-black/80 rounded-xl border border-green-500/50');
      showAlert({ type: 'success', title: message });
    });

    const handleDuelFinished = async ({ winner, scoreA, scoreB, details, isBotMatch }: { winner: string, scoreA: number, scoreB: number, details?: any, isBotMatch?: boolean }) => {
      setWinner(winner);
      let ferveurGain = 0;
      let teamGain = 0;
      const isForfeitMatch = !!(details && details.isForfeit);

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
      if (!isBotMatch && duel.matchId && duel.matchId !== 'global' && duel.type !== 'training') {
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
          const missionContext = {
            teamId: currentMyTeam === 'A' ? String(teamAId) : String(teamBId),
            leagueId: String(safeLeagueId || ''),
            season: String(safeSeason || '')
          };
          
          await progressMission(userData, 'duel_count', 1, missionContext);
          if (isWin) {
            await progressMission(userData, 'win_count', 1, missionContext);
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
          let skinFervorBonusMod = 0;
          let template: FanzTemplate | null = null;
          let fanzData: Fanz | null = null;

          if (fanzId) {
            const fanzSnap = await getDoc(doc(db, 'fanz', fanzId));
            if (fanzSnap.exists()) {
              fanzData = fanzSnap.data() as Fanz;
              const tplSnap = await getDoc(doc(db, 'fanz_templates', fanzData.templateId));
              if (tplSnap.exists()) {
                 template = tplSnap.data() as FanzTemplate;
                 if (fanzData.equippedSkin) {
                   const skin = template.skins?.find((s: any) => s.id === fanzData.equippedSkin);
                   if (skin) {
                     skinFervorBonusMod = skin.fervorBonus || 0;
                   }
                 }
              }
            }
          }
          
          const fervorModMultiplier = 1 + (skinFervorBonusMod / 100);

          let disableGlobalUpdates = false;

          if (isForfeitMatch && isWin) {
             // Forfeit Win
             ferveurGainFanz = 5;
             ferveurGainGeneral = 5;
             disableGlobalUpdates = true;
             
             // Refund
             const baseCost = configData?.costs?.[duelType as keyof typeof configData.costs] ?? { money: 0, energy: 0 };
             const skinBonus = fanzData ? (fanzData as any)._skinBonus : undefined;
             const energyReductionPct = skinBonus?.energyCostReduction || 0;
             const moneyReductionPct = skinBonus?.moneyCostReduction || 0;
             
             const costMoney = Math.max(0, Math.round((baseCost.money || 0) * (1 - moneyReductionPct / 100)));
             const costEnergy = Math.max(0, Math.round((baseCost.energy || 0) * (1 - energyReductionPct / 100)));
             
             let effectiveEnergyCost = costEnergy;
             if (userData.infiniteEnergyUntil && new Date(userData.infiniteEnergyUntil) > new Date()) {
               effectiveEnergyCost = 0;
             }
             
             if (costMoney > 0 || effectiveEnergyCost > 0) {
               await updateDoc(doc(db, 'users', user.uid), {
                 money: increment(costMoney),
                 energy: increment(effectiveEnergyCost)
               });
               if (costMoney > 0) await logTransaction(user.uid, 'money', costMoney, `Remboursement victoire forfait`);
               if (effectiveEnergyCost > 0) await logTransaction(user.uid, 'energy', effectiveEnergyCost, `Remboursement victoire forfait`);
             }
          } else if (isBotMatch && !isForfeitMatch && duelType !== 'training') {
             // Bot Match (not forfeit)
             ferveurGainFanz = 0;
             ferveurGainGeneral = 0;
             disableGlobalUpdates = true;
          } else if (duelType === 'training') {
            const isAgainstFriend = participants.some(p => p && !p.isBot && p.uid !== user.uid);
            if (isAgainstFriend) {
              // Pour l'entraînement contre ami, gain fixe de 10 points pour le vainqueur et 5 pour le perdant
              const fixedFervor = isWin ? 10 : 5;
              ferveurGainFanz = Math.round(fixedFervor * xpMultiplier * fervorModMultiplier);
              ferveurGainGeneral = Math.round(fixedFervor * xpMultiplier * fervorModMultiplier);
            } else {
              // Pour l'entraînement solo / bots, gain fixe de 5 points (ne dépend pas du score ni du résultat)
              ferveurGainFanz = Math.round(5 * xpMultiplier * fervorModMultiplier);
              ferveurGainGeneral = Math.round(5 * xpMultiplier * fervorModMultiplier);
            }
            disableGlobalUpdates = true;
          } else if (isWin) {
            // L'XP gagnée est basée sur le score multiplié par le type de duel
            ferveurGainFanz = Math.round(myScore * duelMultiplier * xpMultiplier * fervorModMultiplier);
            ferveurGainGeneral = Math.round(myScore * duelMultiplier * xpMultiplier * fervorModMultiplier);
          } else {
            // En cas de défaite, on gagne la moitié
            ferveurGainFanz = Math.round((myScore / 2) * duelMultiplier * xpMultiplier * fervorModMultiplier);
            ferveurGainGeneral = Math.round((myScore / 2) * duelMultiplier * xpMultiplier * fervorModMultiplier);
          }
          
          // Update FANZ
          if (fanzData && fanzId && ferveurGainFanz > 0) {
              const fanzRef = doc(db, 'fanz', fanzId);
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
              level: newUserLevel
            };
            if (!disableGlobalUpdates) {
              updates.totalScore = increment(myScore);
              updates.matchesPlayed = increment(1);
              updates.duel_count = increment(1);
              if (clicksCountRef.current > 0) {
                updates.clicks_count = increment(clicksCountRef.current);
              }
              if (cardsPlayedCountRef.current > 0) {
                updates.cards_played_count = increment(cardsPlayedCountRef.current);
              }
              if (emotesSentCountRef.current > 0) {
                updates.emotes_sent_count = increment(emotesSentCountRef.current);
              }
              if (duelType) {
                const statDuelType = (duelType === 'training' && duel.trainingType === '1v1') ? 'training_1v1' : duelType;
                updates[`duels_${statDuelType}_count`] = increment(1);
                if (isWin) {
                  updates[`duels_${statDuelType}_win_count`] = increment(1);
                }
              }
              if ((userData.antiMalusMatches || 0) > 0) {
                updates.antiMalusMatches = increment(-1);
              }
              if (isWin) {
                updates.matchesWon = increment(1);
                updates.win_count = increment(1);
              }
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

                  // If there is an explicit secondary league condition, enforce it
                  if (matchesCondition && pass.conditionLeague && pass.conditionLeague !== '') {
                    if (safeLeagueId !== pass.conditionLeague) {
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
            
            if ((fanzRef.current as any)?.equippedSkinActualId) {
              if (isWin && (fanzRef.current as any).equippedSkinVictoryVideoUrl) {
                updates.unlockedVideos = arrayUnion(`${(fanzRef.current as any).equippedSkinActualId}_victory`);
              } else if (!isWin && (fanzRef.current as any).equippedSkinDefeatVideoUrl) {
                updates.unlockedVideos = arrayUnion(`${(fanzRef.current as any).equippedSkinActualId}_defeat`);
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
      
      const fanzData = fanzRef.current as any;
      const finalIsWin = winner === (myTeamRef.current || participantsRef.current.find(p => p.uid === user.uid)?.team || 'A');
      
      let resultVideoUrl: string | null = null;
      let resultImageUrl: string | null = null;
      
      if (finalIsWin) {
        audioManager.playVictory();
        if (fanzData?.equippedSkinVictoryVideoUrl) {
           resultVideoUrl = getOptimizedVideoUrl(fanzData.equippedSkinVictoryVideoUrl) || null;
        } else if (fanzData?.equippedSkinVideoUrl || fanzData?.videoUrl) {
           resultVideoUrl = getOptimizedVideoUrl(fanzData.equippedSkinVideoUrl || fanzData.videoUrl) || null;
        } else if (fanzData?.equippedSkinUrl || fanzData?.imageUrl) {
           resultImageUrl = getImageUrl(fanzData.equippedSkinUrl || fanzData.imageUrl) || null;
        }
      } else {
        audioManager.playDefeat();
        if (fanzData?.equippedSkinDefeatVideoUrl) {
           resultVideoUrl = getOptimizedVideoUrl(fanzData.equippedSkinDefeatVideoUrl) || null;
        } else if (fanzData?.equippedSkinVideoUrl || fanzData?.videoUrl) {
           resultVideoUrl = getOptimizedVideoUrl(fanzData.equippedSkinVideoUrl || fanzData.videoUrl) || null;
        } else if (fanzData?.equippedSkinUrl || fanzData?.imageUrl) {
           resultImageUrl = getImageUrl(fanzData.equippedSkinUrl || fanzData.imageUrl) || null;
        }
      }

      setDuelResult({ winner, ferveurGain, teamGain, scoreA, scoreB, details, isBotMatch, videoUrl: resultVideoUrl, imageUrl: resultImageUrl, isWin: finalIsWin });
      
      if (resultVideoUrl || resultImageUrl) {
         setShowDuelResultDetails(false);
         setTimeout(() => setShowDuelResultDetails(true), 5000);
      } else {
         setShowDuelResultDetails(true);
      }
    };
    socket.on('duel-finished', handleDuelFinished);

    const handleEnemyCardPlayed = ({ team, card, userId }: { team: string, card: GameCard, userId?: string }) => {
      // Ignore if it's OUR OWN card play (we already handle our own card animation instantly via playCard)
      if (userId === user.uid) return;

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
        if (!enhancedCard.videoUrl || enhancedCard.videoUrl === "undefined" || user.dataSaver) {
          if (enhancedCard.soundUrl) { playSound(enhancedCard.soundUrl); } else { audioManager.playCardPlay(); }
        }
        addFloatingEffect(`🤝 Allié: ${enhancedCard.name}`, window.innerWidth / 2, 100, 'text-blue-400 font-black scale-125');
        return;
      }

      setLastEnemyCard(enhancedCard);
      setEnemyPlayedCardAnim({ card: enhancedCard, id: Math.random().toString() });
      setTimeout(() => setEnemyPlayedCardAnim(null), 2000);

      const isMalus = (enhancedCard.effects || []).some(e => 
        ['drain_energy', 'hide_button', 'shrink_button', 'move_button', 'blur_view', 'hide_score', 'discard_enemy_cards', 'discard_random_cards', 'shuffle_deck', 'freeze_button', 'earthquake', 'fake_buttons', 'card_lock', 'fog_of_war', 'sabotage', 'steal_energy', 'blackout', 'curse', 'confetti', 'hypnosis', 'pacifier_drama', 'mascot_bazooka', 'steal_best_card', 'stun', 'mammoth_charge', 'mascot_bone_drum', 'corne_drakkar', 'pumpkin_fog', 'locker_room_curse', 'chainsaw_megaphone', 'burning_seats', 'vol_ballon', 'zoomies_chaos', 'boucher_district'].includes(e.type)
      );
      
      if (!enhancedCard.videoUrl || enhancedCard.videoUrl === "undefined" || user.dataSaver) {
        if (enhancedCard.soundUrl) { playSound(enhancedCard.soundUrl); } 
        else if (isMalus) { audioManager.playDebuff(); }
        else { audioManager.playMagic(); }
      }

      addFloatingEffect(`⚠️ ${enhancedCard.name}`, window.innerWidth / 2, 100, 'text-red-500 font-black scale-125');

      if (card.lockerRoomCurseTriggered) {
        addFloatingEffect("🪤 Piège déclenché : La Malédiction des Vestiaires ! (Rendement -50%)", window.innerWidth / 2, 180, "text-red-500 font-extrabold scale-110 drop-shadow-[0_0_10px_rgba(239,68,68,0.7)] z-[200] animate-bounce");
      }

      const isAggressiveVal = isMalus || (enhancedCard.fervorValue && enhancedCard.fervorValue >= 5);
      if (isAggressiveVal && isTifoHolographiqueActive) {
        setIsTifoHolographiqueActive(false);
        addFloatingEffect('🤖 TIFO HOLOGRAPHIQUE 3D : Énergie laser absorbée !', window.innerWidth / 2, 130, 'text-cyan-400 font-extrabold scale-110 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] z-[210]');
        
        const reflectionFervor = (enhancedCard.fervorValue || 10) * 0.5;
        socket?.emit('click-ferveur', { duelId: currentDuelIdRef.current, team: currentMyTeam || 'A', multiplier: reflectionFervor * 2 });
        addFloatingEffect(`💥 ONDE DE CHOC HOLO : Renvoyé +${reflectionFervor.toFixed(1)}% ferveur !`, window.innerWidth / 2, 170, 'text-cyan-300 font-black animate-pulse z-[210]');
        
        const resistance = { '1v1': 1, '2v2': 2, '5v5': 5, 'war_of_kops': 50, 'training': 1 }[duel.type] || 1;
        const revertDelta = (enhancedCard.fervorValue || 10) / resistance;
        setProgress(prev => {
          const revertSign = currentMyTeam === 'A' ? 1 : -1;
          return Math.min(100, Math.max(0, prev + revertDelta * revertSign));
        });
        return;
      }

      const isClimateOrTerrainCard = 
        (enhancedCard.category?.toLowerCase() || '').includes('climat') || 
        (enhancedCard.category?.toLowerCase() || '').includes('terrain') || 
        (enhancedCard.category?.toLowerCase() || '').includes('weather') || 
        (enhancedCard.name?.toLowerCase() || '').includes('pluie') || 
        (enhancedCard.name?.toLowerCase() || '').includes('neige') || 
        (enhancedCard.name?.toLowerCase() || '').includes('boue') || 
        (enhancedCard.name?.toLowerCase() || '').includes('faux rebond') || 
        (enhancedCard.name?.toLowerCase() || '').includes('climat') || 
        (enhancedCard.name?.toLowerCase() || '').includes('terrain') || 
        (enhancedCard.name?.toLowerCase() || '').includes('rain') || 
        (enhancedCard.name?.toLowerCase() || '').includes('snow') || 
        (enhancedCard.name?.toLowerCase() || '').includes('mud') || 
        (enhancedCard.name?.toLowerCase() || '').includes('bounce') || 
        (enhancedCard.name?.toLowerCase() || '').includes('weather');

      if (isClimateOrTerrainCard && isMentalMainCouranteActive) {
        addFloatingEffect("🛡️ Le Mental de la Main Courante bloque l'effet de climat/terrain !", window.innerWidth / 2, 160, 'text-green-400 font-extrabold animate-bounce py-1 px-2 bg-black/40 rounded border border-green-500/35');
        return;
      }

      if (isMalus) {
        const carriesShieldBreaker = (enhancedCard.effects || []).some(e => ['mammoth_charge', 'chainsaw_megaphone', 'burning_seats'].includes(e.type));
        if (!carriesShieldBreaker) {
          if (isLuminescentStandardActive) {
            addFloatingEffect('✨ Étendard Luminescent : Altération neutre !', window.innerWidth / 2, 150, 'text-yellow-400 font-extrabold scale-110 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]');
            return;
          }
          if (isParrotTauntActive) {
            setIsParrotTauntActive(false);
            addFloatingEffect('🦜 Perroquet Insolent : PROVOCATION ! Attaque absorbée !', window.innerWidth / 2, 150, 'text-green-400 font-extrabold scale-110');
            return;
          }
          if (isImmune || (user.antiMalusMatches || 0) > 0) {
            addFloatingEffect('🛡️ Bouclier Anti-Malus Actif!', window.innerWidth / 2, 150, 'text-green-300 font-black');
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
      }

      (card.effects || []).forEach((effect: CardEffect) => {
        // Resistance stats: higher value means shorter duration
        const mentalResistance = getStatEffectValue('malus_duration', true);
        const bluffResistance = getStatEffectValue('visual_malus_duration', true);
        
        // Duration reduction: duration / resistance (if resistance is > 1)
        // Or duration * resistance (if resistance is < 1)
        // Let's assume the stat returns a multiplier where 1.0 is neutral, > 1 is better resistance
        const getEffectiveDuration = (base: number, res: number) => {
          let durationMs = (base * 1000) / Math.max(0.1, res);
          if (isWallOfShieldsActive) {
            durationMs = durationMs / 2;
          }
          return durationMs;
        };

        const getEffectiveValue = (baseVal: number) => {
          if (isWallOfShieldsActive) {
            return Math.ceil(baseVal / 2);
          }
          return baseVal;
        };

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
            setExcitement(prev => Math.max(0, prev - getEffectiveValue(effect.value || 0)));
            addFloatingEffect(`⚡ -${getEffectiveValue(effect.value || 0)} Énergie!`, window.innerWidth / 2, 200, 'text-red-400');
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
            setExcitement(prev => Math.max(0, prev - getEffectiveValue(effect.value || 0)));
            addFloatingEffect(`⚡ -${getEffectiveValue(effect.value || 0)} Énergie Volée!`, window.innerWidth / 2, 200, 'text-red-400');
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
            setExcitement(prev => Math.max(0, prev - getEffectiveValue(effect.value || 1)));
            addFloatingEffect('🍼 DRAME DE LA TÉTINE ! (-1 Carte, -1 PA)', window.innerWidth / 2, 200, 'text-blue-500 font-black scale-125 drop-shadow-md z-[200]');
            break;
          case 'mascot_bazooka':
            setHand(prev => prev.filter(c => c.name.toLowerCase().includes("enfant de la mascotte")));
            setTimeout(() => drawCard(true, 3), 100);
            addFloatingEffect('🎁 BAZOOKA À GOODIES ! (Défausse + 3 Cartes)', window.innerWidth / 2, 250, 'text-pink-500 font-black scale-125 drop-shadow-md z-[200]');
            break;
          case 'stun':
            setIsStunned(true);
            setTimeout(() => setIsStunned(false), getEffectiveDuration(effect.duration || 5, mentalResistance));
            addFloatingEffect('😵 ASSOMMÉ ! (Saut de tour)', window.innerWidth / 2, 200, 'text-red-500 font-black scale-150 animate-bounce');
            break;
          case 'vol_ballon':
            setIsStunned(true);
            setIsCursed(true);
            setTimeout(() => {
              setIsStunned(false);
              setIsCursed(false);
            }, getEffectiveDuration(effect.duration || 6, mentalResistance));
            addFloatingEffect('⚽ Vol de Ballon ! (Passage de tour & Malus ferveur !)', window.innerWidth / 2, 200, 'text-red-500 font-black scale-125 animate-bounce');
            break;
          case 'zoomies_chaos':
            setHand(prev => {
              if (prev.length === 0) return prev;
              const newHand = [...prev];
              newHand.splice(Math.floor(Math.random() * newHand.length), 1);
              return newHand;
            });
            setTimeout(() => drawCard(true, 1), 500);
            addFloatingEffect('🌪️ Chaos des Zoomies ! (Panique, main défaussée et repiochée)', window.innerWidth / 2, 200, 'text-red-400 font-extrabold animate-pulse');
            break;
          case 'throat_tackle':
            addFloatingEffect('🦵 TACLE À LA GORGE ! ("L\'arbitre laisse jouer !")', window.innerWidth / 2, 200, 'text-orange-500 font-black scale-150');
            setExcitement(prev => Math.max(0, prev - getEffectiveValue(3)));
            break;
          case 'mammoth_charge':
            setHasShield(false);
            setHasMirror(false);
            setIsOdinClappingActive(false);
            setOdinClickBonus(0);
            addFloatingEffect('🦣 CHARGE DE MAMMOUTH ! (Boucliers Brisés & Chants détruits !)', window.innerWidth / 2, 200, 'text-red-600 font-black scale-150 animate-bounce z-[200]');
            break;
          case 'chainsaw_megaphone':
            setHasShield(false);
            addFloatingEffect('⚙️ MÉGAPHONE-TRONÇONNEUSE ! Armure détruite et gros dégâts !', window.innerWidth / 2, 200, 'text-red-500 font-extrabold scale-125 animate-pulse z-[202]');
            break;
          case 'burning_seats':
            setIsBurningSeatsOverlayActive(true);
            setTimeout(() => setIsBurningSeatsOverlayActive(false), 3000);
            setHasShield(false);
            setHasMirror(false);
            setIsLuminescentStandardActive(false);
            setIsEnemyLuminescentStandardActive(false);
            setIsParrotTauntActive(false);
            setIsEnemyParrotTauntActive(false);
            setIsOdinClappingActive(false);
            setIsEnemyOdinClappingActive(false);
            setOdinClickBonus(0);
            
            // Discard 1 card unless protected
            const bIndex = handRef.current.findIndex(c => c.id === 'base_luminescent_standard');
            const vIndices: number[] = [];
            handRef.current.forEach((card, idx) => {
              if (card.id === 'base_luminescent_standard') return;
              if (bIndex !== -1 && Math.abs(bIndex - idx) === 1) return;
              vIndices.push(idx);
            });
            
            if (vIndices.length > 0) {
              const discardIdx = vIndices[Math.floor(Math.random() * vIndices.length)];
              const discardedCard = handRef.current[discardIdx];
              setHand(prev => prev.filter((_, idx) => idx !== discardIdx));
              setTimeout(drawCard, 2000);
              addFloatingEffect(`🔥 SIÈGE EN FEU : Carbonise ta carte ${discardedCard.name} !`, window.innerWidth / 2, 240, 'text-orange-500 font-black scale-110');
            } else {
              addFloatingEffect(`🛡️ SIÈGES EN FEU : Toutes tes cartes en main sont immunisées par l'Étendard !`, window.innerWidth / 2, 240, 'text-yellow-400 font-bold');
            }
            break;
          case 'clapping_odin':
            setIsEnemyOdinClappingActive(true);
            setTimeout(() => setIsEnemyOdinClappingActive(false), (effect.duration || 15) * 1000);
            addFloatingEffect("👏 L'ennemi lance le Clapping d'Odin !", window.innerWidth / 2, 200, 'text-yellow-400 font-extrabold animate-bounce');
            break;
          case 'corne_drakkar':
            setIsDeafened(true);
            setTimeout(() => setIsDeafened(false), getEffectiveDuration(effect.duration || 10, mentalResistance));
            addFloatingEffect("🔇 Sourd ! Chants et Sorts bloqués !", window.innerWidth / 2, 200, "text-red-400 font-extrabold animate-pulse");
            break;
          case 'boucher_district':
            setHand(prev => {
              if (prev.length === 0) return prev;
              const newHand = [...prev];
              newHand.splice(Math.floor(Math.random() * newHand.length), 1);
              return newHand;
            });
            setTimeout(drawCard, 2000);
            setExcitement(prev => Math.max(0, prev - 1));
            addFloatingEffect("💥 LE BOUCHER DU DISTRICT ! Tacle assassin à la gorge ! Prodige KO défaussé (-1 PA) !", window.innerWidth / 2, 200, 'text-red-500 font-black scale-125 animate-bounce z-[200]');
            break;
          case 'tiktok_highlight':
            setIsEnemyTikTokHighlightActive(true);
            setTimeout(() => setIsEnemyTikTokHighlightActive(false), 8000);
            addFloatingEffect("📱 Coup du foulard tenté (Highlight TikTok adverse) ! Double ferveur pour l'ennemi !", window.innerWidth / 2, 200, 'text-purple-400 font-bold animate-pulse');
            break;
          case 'prime_goat':
            setIsEnemyPrimeGoatActive(true);
            setTimeout(() => setIsEnemyPrimeGoatActive(false), (effect.duration || 15) * 1000);
            addFloatingEffect("⚡ Le Prime (G.O.A.T) ! L'adversaire hype l'Ado avec un montage vidéo (+4 Ferveur adverse, ignore stats) !", window.innerWidth / 2, 200, 'text-yellow-400 font-extrabold animate-bounce');
            break;
          case 'attention_swipe':
            setHand(prev => {
              if (prev.length === 0) return prev;
              const newHand = [...prev];
              newHand.splice(Math.floor(Math.random() * newHand.length), 1);
              return newHand;
            });
            setTimeout(drawCard, 2000);
            addFloatingEffect("📱 Perte d'Attention (Swipe) ! L'Ado a zappé sur TikTok ! Défausse d'une carte au hasard de votre main !", window.innerWidth / 2, 200, 'text-red-400 font-black scale-110 animate-bounce bg-black/40 px-2 py-1');
            break;
          case 'sterile_debate':
            setIsDebatePickerOpen(true);
            addFloatingEffect("💬 Le Débat Stérile sur les Réseaux ! Choisissez une carte à parier contre le Ratio adverse !", window.innerWidth / 2, 200, 'text-purple-400 font-extrabold animate-bounce bg-black/40 px-2 py-1 rounded');
            break;
          case 'faux_rebond_excuse':
            addFloatingEffect("🤷‍♂️ L'Excuse du Faux Rebond ! L'adversaire annule sa phase d'action !", window.innerWidth / 2, 200, 'text-yellow-400 font-extrabold animate-bounce bg-black/40 px-2 py-1 rounded');
            break;
          case 'parrot_taunt':
            setIsEnemyParrotTauntActive(true);
            setTimeout(() => setIsEnemyParrotTauntActive(false), (effect.duration || 15) * 1000);
            addFloatingEffect("🦜 Le perroquet adverse provoque tes supporters !", window.innerWidth / 2, 200, 'text-green-400 font-extrabold animate-bounce');
            break;
          case 'steal_object_card':
            // Handled via separate steal-card-request socket sequence
            break;
          case 'mascot_bone_drum':
            setIsIntimidated(true);
            setTimeout(() => setIsIntimidated(false), getEffectiveDuration(effect.duration || 8, mentalResistance));
            addFloatingEffect('🥁 TAMBOUR EN OS ! (Intimidé: Clics -50% !)', window.innerWidth / 2, 200, 'text-purple-500 font-black scale-125 animate-pulse z-[200]');
            break;
          case 'pumpkin_fog':
            setIsBlind(true);
            setTimeout(() => setIsBlind(false), getEffectiveDuration(effect.duration || 12, mentalResistance));
            addFloatingEffect('🎃 CUCURBITACÉE TOXIQUE ! (Aveuglé: 50% échecs !)', window.innerWidth / 2, 200, 'text-orange-500 font-extrabold scale-125 animate-pulse z-[200]');
            break;
          case 'locker_room_curse':
            setIsLockerRoomCursed(true);
            addFloatingEffect('❓ Un piège adverse mystérieux a été posé face cachée dans tes vestiaires !', window.innerWidth / 2, 200, 'text-purple-400 font-extrabold scale-110 drop-shadow-md z-[200]');
            break;
          case 'luminescent_standard':
            setIsEnemyLuminescentStandardActive(true);
            setTimeout(() => setIsEnemyLuminescentStandardActive(false), (effect.duration || 15) * 1000);
            addFloatingEffect("✨ L'ennemi a érigé son Étendard Luminescent ! (Immunisé)", window.innerWidth / 2, 200, 'text-yellow-400 font-extrabold animate-pulse');
            break;
          case 'buvette_grail':
            addFloatingEffect("🍺 L'adversaire boit au Graal de la Buvette ! (Corde soignée)", window.innerWidth / 2, 200, 'text-yellow-500 font-extrabold scale-110');
            break;
          case 'var_illusion':
            setIsVarOverlayActive(true);
            setTimeout(() => setIsVarOverlayActive(false), 3000);
            addFloatingEffect("📺 VAR : L'adversaire dénonce un hors-jeu imaginaire (Contré) !", window.innerWidth / 2, 200, 'text-red-500 font-extrabold scale-125 z-[202]');
            break;
          case 'grimoire_chants':
            addFloatingEffect("📖 L'adversaire consulte son Grimoire des Chants Oubliés !", window.innerWidth / 2, 200, 'text-yellow-400 font-extrabold');
            break;
          case 'var_temporelle':
            addFloatingEffect("📺 ARBITRAGE VIDÉO 4D : L'adversaire rembobine le match !", window.innerWidth / 2, 200, 'text-red-500 font-extrabold scale-125 z-[210] animate-pulse');
            break;
          case 'tifo_holographique':
            setIsEnemyTifoHolographiqueActive(true);
            addFloatingEffect("🤖 TIFO HOLOGRAPHIQUE 3D : L'adversaire projette son écran laser !", window.innerWidth / 2, 200, 'text-cyan-400 font-extrabold animate-pulse');
            break;
          case 'capo_megaphone':
            setIsEnemyCapoMegaphoneActive(true);
            setTimeout(() => setIsEnemyCapoMegaphoneActive(false), (effect.duration || 15) * 1000);
            addFloatingEffect("📢 MÉGAPHONE DU CAPO : Ferveur adverse doublée !", window.innerWidth / 2, 200, 'text-yellow-400 font-black scale-110');
            break;
          case 'craquage_massif':
            setIsEnemyCraquageMassifActive(true);
            setTimeout(() => setIsEnemyCraquageMassifActive(false), (effect.duration || 10) * 1000);
            addFloatingEffect("🔥 CRAQUAGE MASSIF-FUMIGÈNES ! Tribune ennemie masquée !", window.innerWidth / 2, 200, 'text-red-500 font-black animate-pulse z-[210]');
            break;
          case 'cancel_last_attack':
            if (myTeamRef.current || true) {
              const resistance = { '1v1': 1, '2v2': 2, '5v5': 5, 'war_of_kops': 50, 'training': 1 }[duel.type] || 1;
              const val = 10;
              const delta = (currentMyTeam === 'A' ? -val : val) / resistance;
              const bonus = currentMyTeam === 'A' ? -10 : 10;
              setProgress(prev => Math.min(100, Math.max(0, prev + delta + bonus)));
              addFloatingEffect("🔮 SCRIPT ADVERSE : Votre dernière attaque est annulée (Rebond miracle) !", window.innerWidth / 2, 200, 'text-red-400 font-extrabold scale-110 animate-pulse');
            }
            break;
          case 'rage_quit_discard':
            const trqDiscardList = handRef.current.filter(c => c.category?.toLowerCase().includes('action') || c.name.toLowerCase().includes('action'));
            if (trqDiscardList.length > 0) {
              setHand(prev => prev.filter(c => !(c.category?.toLowerCase().includes('action') || c.name.toLowerCase().includes('action'))));
              setTimeout(() => {
                drawCard(false, trqDiscardList.length);
              }, 2000);
            }
            setIsStunned(true);
            setTimeout(() => setIsStunned(false), getEffectiveDuration(effect.duration || 6, mentalResistance));
            addFloatingEffect(`😡 RAGE QUIT : Défausse de ${trqDiscardList.length} cartes Action + Tour sauté !`, window.innerWidth / 2, 220, 'text-red-500 font-extrabold scale-125 animate-pulse');
            break;
          case 'meta_update':
            setIsMetaUpdateActive(true);
            setTimeout(() => setIsMetaUpdateActive(false), (effect.duration || 15) * 1000);
            addFloatingEffect("🌐 NOUVELLE MÉTA : Statut Équilibrage Global !", window.innerWidth / 2, 200, 'text-cyan-400 font-black animate-pulse scale-110');
            break;
          case 'stealth_jacket_flip':
            if (lastMyCard && lastMyCard.effects && lastMyCard.effects.length > 0) {
              addFloatingEffect(`🎭 Retournement de veste adverse : Effets de "${lastMyCard.name}" copiés !`, window.innerWidth / 2, 170, 'text-red-400 font-extrabold animate-pulse');
              lastMyCard.effects.forEach((eff: any) => {
                if (eff.type === 'drain_energy') {
                  setExcitement(prev => Math.max(0, prev - getEffectiveValue(eff.value || 0)));
                } else if (eff.type === 'blur_view') {
                  setIsBlurred(true);
                  setTimeout(() => setIsBlurred(false), getEffectiveDuration(eff.duration || 5, bluffResistance));
                } else if (eff.type === 'hide_button') {
                  setIsButtonHidden(true);
                  setTimeout(() => setIsButtonHidden(false), getEffectiveDuration(eff.duration || 4, mentalResistance));
                } else if (eff.type === 'shrink_button') {
                  setIsButtonShrunk(true);
                  setTimeout(() => setIsButtonShrunk(false), getEffectiveDuration(eff.duration || 6, bluffResistance));
                } else if (eff.type === 'move_button') {
                  setIsButtonMoving(true);
                  setTimeout(() => setIsButtonMoving(false), getEffectiveDuration(eff.duration || 8, bluffResistance));
                } else if (eff.type === 'hide_score') {
                  setIsScoreHidden(true);
                  setTimeout(() => setIsScoreHidden(false), getEffectiveDuration(eff.duration || 7, bluffResistance));
                } else if (eff.type === 'freeze_button') {
                  setIsButtonFrozen(true);
                  setTimeout(() => setIsButtonFrozen(false), getEffectiveDuration(eff.duration || 3, mentalResistance));
                } else if (eff.type === 'stun') {
                  setIsStunned(true);
                  setTimeout(() => setIsStunned(false), getEffectiveDuration(eff.duration || 5, mentalResistance));
                }
              });
            } else {
              addFloatingEffect("🎭 Retournement de veste adverse : Aucune carte à copier !", window.innerWidth / 2, 170, 'text-gray-400');
            }
            break;
          case 'desert_crossing':
            const isEnemyLosing = (currentMyTeam === 'A' && progress > 50) || (currentMyTeam === 'B' && progress < 50);
            if (isEnemyLosing) {
              addFloatingEffect("🏜️ Traversée du Désert adverse : Perte de ferveur adverse !", window.innerWidth / 2, 200, 'text-red-400 font-extrabold animate-pulse');
              const loss = currentMyTeam === 'A' ? 15 : -15;
              const resistance = { '1v1': 1, '2v2': 2, '5v5': 5, 'war_of_kops': 50, 'training': 1 }[duel.type] || 1;
              setProgress(prev => Math.min(100, Math.max(0, prev + (loss / resistance))));
            } else {
              addFloatingEffect("🏜️ Traversée du Désert adverse : L'adversaire mène ! Son Glory Hunter est sauf.", window.innerWidth / 2, 200, 'text-green-400 font-bold');
            }
            break;
          case 'half_half_scarf':
            setIsEnemyLuminescentStandardActive(true);
            setTimeout(() => {
              setIsEnemyLuminescentStandardActive(false);
            }, (effect.duration || 10) * 1000);
            addFloatingEffect("🧣 Écharpe Half-Half : Combat Gelé ! (Immunité adverse active)", window.innerWidth / 2, 200, 'text-blue-300 font-black');
            break;
          case 'megaphone_echo':
            addFloatingEffect("📢 Écho du Mégaphone de l'adversaire : Ses supporters sont galvanisés !", window.innerWidth / 2, 200, 'text-yellow-400 font-black scale-110');
            break;
          case 'biological_curfew':
            setHand(currentHand => {
              if (currentHand.length > 0) {
                const randomIndex = Math.floor(Math.random() * currentHand.length);
                const targetCard = currentHand[randomIndex];
                const targetId = targetCard.instanceId || targetCard.id;
                setLockedCardInstanceIds(prev => [...prev, targetId]);
                setTimeout(() => {
                  setLockedCardInstanceIds(prev => prev.filter(id => id !== targetId));
                }, (effect.duration || 10) * 1000);
                addFloatingEffect(`😴 Couvre-Feu Biologique : "${targetCard.name}" est engagée (bloquée) !`, window.innerWidth / 2, 220, 'text-purple-400 font-extrabold animate-pulse');
              }
              return currentHand;
            });
            break;
          case 'transfusion_tactique':
            setIsStunned(true);
            setTimeout(() => setIsStunned(false), getEffectiveDuration(effect.duration || 4, mentalResistance));
            addFloatingEffect("🧛 TRANSFUSION TACTIQUE : L'adversaire draine votre énergie et vous paralyse !", window.innerWidth / 2, 200, 'text-red-500 font-black animate-pulse z-[210]');
            {
              const res = { '1v1': 1, '2v2': 2, '5v5': 5, 'war_of_kops': 50, 'training': 1 }[duel.type] || 1;
              const dir = currentMyTeam === 'A' ? -1 : 1; 
              setProgress(prev => Math.min(100, Math.max(0, prev + (15 / res) * dir)));
            }
            setExcitement(prev => Math.max(0, prev - 10));
            break;
          case 'eclipse_artificielle':
            addFloatingEffect("🦇 ÉCLIPSE ARTIFICIELLE : L'adversaire invoque la nuit et annule ses malus !", window.innerWidth / 2, 200, 'text-purple-400 font-extrabold animate-pulse');
            break;
          case 'coup_d_envoi_13h':
            setIsStunned(true);
            setTimeout(() => setIsStunned(false), getEffectiveDuration(effect.duration || 8, mentalResistance));
            addFloatingEffect("🔥 COUP D'ENVOI 13H00 : Fumée étouffante (Adversaire en flammes), vous êtes aveuglé !", window.innerWidth / 2, 210, 'text-yellow-500 font-black animate-pulse scale-125 z-[210]');
            break;
          case 'early_craquage':
            setIsEnemyEarlyCraquageActive(true);
            setTimeout(() => {
              setIsEnemyEarlyCraquageActive(false);
            }, (effect.duration || 15) * 1000);
            addFloatingEffect("🌫️ Craquage Précoce adverse ! Visibilité réduite à 0% (50% de rater ses coups)", window.innerWidth / 2, 200, 'text-gray-400 font-black animate-pulse scale-110');
            break;
          case 'laser_relaunch':
            setIsEnemyLaserRelaunchActive(true);
            setTimeout(() => {
              setIsEnemyLaserRelaunchActive(false);
            }, (effect.duration || 15) * 1000);
            addFloatingEffect("⚡ Relance Laser adverse ! Son prochain coup est ultra rapide.", window.innerWidth / 2, 200, 'text-yellow-400 font-extrabold animate-pulse');
            break;
          case 'pro_tantrum':
            const ptResistance = { '1v1': 1, '2v2': 2, '5v5': 5, 'war_of_kops': 50, 'training': 1 }[duel.type] || 1;
            const ptLoss = currentMyTeam === 'A' ? -12 : 12;
            setProgress(prev => Math.min(100, Math.max(0, prev + (ptLoss / ptResistance))));
            setHand(currentHand => {
              const ramasseurIndex = currentHand.findIndex(c => c.name.toLowerCase().includes('ramasseur') || c.name.toLowerCase().includes('ballboy') || c.name.toLowerCase().includes('ball boy') || c.id.includes('ball_boy'));
              if (ramasseurIndex !== -1) {
                const ramasseurCard = currentHand[ramasseurIndex];
                const newHand = currentHand.filter((_, idx) => idx !== ramasseurIndex);
                setDeck(prevDeck => [...prevDeck, ramasseurCard]);
                addFloatingEffect(`🏃‍♂️ "${ramasseurCard.name}" retourne dans le deck !`, window.innerWidth / 2, 220, 'text-rose-400 font-extrabold animate-bounce');
                return newHand;
              }
              return currentHand;
            });
            addFloatingEffect("🟥 Coup de Sang adverse ! Bousculade et pénalité (-12% Ferveur)", window.innerWidth / 2, 190, 'text-red-500 font-extrabold animate-pulse scale-110');
            break;
          case 'multiball_chaos':
            addFloatingEffect("🔊 DRING ! Double ballon sifflet de l'arbitre !", window.innerWidth / 2, 180, 'text-white font-extrabold scale-125 animate-pulse bg-slate-900 border border-slate-700 rounded px-2 py-1');
            setPlayedHistory(prevHistory => {
              if (prevHistory.length > 0) {
                const lastPlayed = prevHistory[prevHistory.length - 1];
                setHand(prevHand => {
                  if (prevHand.some(c => c.id === lastPlayed.id)) return prevHand;
                  return [...prevHand, lastPlayed];
                });
                addFloatingEffect(`⚽ Multi-Ballon adverse : "${lastPlayed.name}" reprise en main !`, window.innerWidth / 2, 220, 'text-green-300 font-bold');
                return prevHistory.slice(0, -1);
              }
              return prevHistory;
            });
            if (lastEnemyCard) {
              addFloatingEffect(`⚽ Multi-Ballon : "${lastEnemyCard.name}" adverse retourné !`, window.innerWidth / 2, 150, 'text-red-300 font-bold');
              const mbResistance = { '1v1': 1, '2v2': 2, '5v5': 5, 'war_of_kops': 50, 'training': 1 }[duel.type] || 1;
              const val = lastEnemyCard.fervorValue || lastEnemyCard.effects?.find(e => e.type === 'push_rope')?.value || 10;
              const delta = (currentMyTeam === 'A' ? val : -val) / mbResistance;
              setProgress(prev => Math.min(100, Math.max(0, prev + delta)));
              setLastEnemyCard(null);
            }
            break;
          case 'mental_main_courante':
            setIsEnemyMentalMainCouranteActive(true);
            setTimeout(() => {
              setIsEnemyMentalMainCouranteActive(false);
            }, (effect.duration || 15) * 1000);
            addFloatingEffect("🛡️ L'adversaire s'équipe : Le Mental de la Main Courante (Climat/Terrain immunisé) !", window.innerWidth / 2, 200, 'text-green-300 font-extrabold animate-pulse');
            break;
          case 'heritage_weight':
            setIsHeritageWeightActive(true);
            setTimeout(() => {
              setIsHeritageWeightActive(false);
            }, (effect.duration || 15) * 1000);
            addFloatingEffect("👵 Le Poids de l'Héritage ! La mélancolie vous empêche de jouer des cartes Modernes ce tour-ci !", window.innerWidth / 2, 210, 'text-red-400 font-black animate-pulse scale-105 bg-black/40 px-2 py-1 rounded');
            break;
          case 'buvette_alert':
            setIsBuvetteAlertActive(true);
            setHasConsumedBuvette(false);
            setTimeout(() => {
              setIsBuvetteAlertActive(false);
            }, 12000);
            addFloatingEffect("🌭 Alerte Buvette ! Passer l'attaque pour Buvette !", window.innerWidth / 2, 195, 'text-yellow-400 font-extrabold animate-bounce py-1 px-2 border border-yellow-500/40 rounded bg-slate-900 scale-110');
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

    const handleStealCardRequest = ({ fromTeam, filterCategory }: { fromTeam: string, filterCategory?: string }) => {
      const myParticipant = participantsRef.current.find(p => p.uid === user.uid);
      const myTeam = myParticipant?.team || 'A';
      if (fromTeam !== myTeam) {
        if (isCraquageMassifActive) {
          addFloatingEffect("💨 BROUILLARD ROUGE : Tes supporters sont masqués ! Impossible de voler !", window.innerWidth / 2, 250, 'text-red-400 font-extrabold scale-110 drop-shadow-md z-[200]');
          socket.emit('steal-card-response', { duelId: currentDuelIdRef.current, team: myTeam, card: null });
          return;
        }

        if (handRef.current.length > 0) {
           // Standard immunity rule
           const standardIndex = handRef.current.findIndex(c => c.id === 'base_luminescent_standard');
           const stealableCards = handRef.current.filter((c, idx) => {
             if (c.id === 'base_luminescent_standard') return false; // L'étendard itself is immune
             if (standardIndex !== -1 && Math.abs(standardIndex - idx) === 1) return false; // adjacent cards are immune
             return true;
           });

           if (stealableCards.length === 0 && handRef.current.some(c => c.id === 'base_luminescent_standard' || (standardIndex !== -1 && Math.abs(standardIndex - handRef.current.indexOf(c)) === 1))) {
             addFloatingEffect("✨ L'Étendard Luminescent protège tes tribunes ! Vol Échoué !", window.innerWidth / 2, 250, 'text-yellow-400 font-extrabold scale-110 drop-shadow-md z-[200]');
             socket.emit('steal-card-response', { duelId: currentDuelIdRef.current, team: myTeam, card: null });
             return;
           }

           const cardsToPool = stealableCards.length > 0 ? stealableCards : handRef.current;

           let targetCard: GameCard | null = null;
           if (filterCategory) {
             const matchingCards = cardsToPool.filter(c => 
               c.category === filterCategory || 
               c.name.toLowerCase().includes(filterCategory.toLowerCase())
             );
             if (matchingCards.length > 0) {
               targetCard = matchingCards.reduce((prev, curr) => (prev.fervorValue || 0) > (curr.fervorValue || 0) ? prev : curr);
             }
           }
           if (!targetCard) {
             targetCard = cardsToPool.reduce((prev, curr) => (prev.fervorValue || 0) > (curr.fervorValue || 0) ? prev : curr);
           }
           
           if (targetCard) {
             const cardToSteal = targetCard;
             setHand(prev => prev.filter(c => c.instanceId !== cardToSteal.instanceId));
             socket.emit('steal-card-response', { duelId: currentDuelIdRef.current, team: myTeam, card: cardToSteal });
             const messageText = filterCategory === 'Objet' ? '🏴‍☠️ Objet volé par Abordage !' : '😭 Meilleure Carte Volée!';
             addFloatingEffect(messageText, window.innerWidth / 2, 250, 'text-red-500 font-black scale-125 drop-shadow-md z-[200]');
           }
        }
      }
    };
    socket.on('steal-card-request', handleStealCardRequest);

    const handleStealCardComplete = ({ stolenCard }: { stolenCard: GameCard | null }) => {
       if (!stolenCard) {
         addFloatingEffect("🛡️ Tentative de Vol bloquée par l'immunité adverse !", window.innerWidth / 2, 250, 'text-yellow-400 font-black scale-125 drop-shadow-md z-[200]');
         return;
       }
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
      socket.off('duel-forfeit'); // remove inline listener
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
    if (winner || isButtonHidden || isButtonFrozen || isStunned) return;
    
    clicksCountRef.current += 1;
    
    if ((isEarlyCraquageActive || isEnemyEarlyCraquageActive) && Math.random() < 0.5) {
      addFloatingEffect('🌫️ Raté ! Le fumigène précoce bouche la vue (50% chance) !', e.clientX, e.clientY - 20, 'text-gray-400 font-extrabold scale-110 animate-pulse bg-black/30 px-2 py-1 rounded');
      return;
    }

    if (isBlind && Math.random() < 0.5) {
      addFloatingEffect('💨 Raté ! Aveuglé par la Citrouille !', e.clientX, e.clientY - 20, 'text-orange-500 font-extrabold scale-110 animate-pulse');
      audioManager.playCardSelect?.();
      return;
    }
    
    // Find the user's actual team
    const myParticipant = participants.find(p => p.uid === user.uid);
    const myTeam = myParticipant?.team || 'A';
    
    let currentMultiplier = multiplier + odinClickBonus;
    if (isFlare) {
      currentMultiplier *= 3;
    }
    if (isHeavyBallPower) {
      currentMultiplier *= 1.8;
    }
    if (isCapoMegaphoneActive) {
      currentMultiplier *= 2;
    }
    if (isIntimidated) {
      currentMultiplier *= 0.5;
      addFloatingEffect('🥁 Intimidé ! (-50%)', e.clientX, e.clientY - 20, 'text-purple-400 font-bold scale-90');
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
    setHasLastActionFailed(false);
    const cardId = card.instanceId || card.id;
    if (lockedCardInstanceIds.includes(cardId)) {
      const x = e ? e.clientX : window.innerWidth / 2;
      const y = e ? e.clientY - 50 : window.innerHeight / 2;
      addFloatingEffect('😴 Carte engagée ! Impossible de la jouer (Couvre-Feu Biologique 💤)', x, y, 'text-purple-400 font-extrabold scale-110');
      return;
    }

    const isModerneCard = 
      (card.category?.toLowerCase() || '').includes('tactique') || 
      (card.category?.toLowerCase() || '').includes('moderne') || 
      (card.category?.toLowerCase() || '').includes('technologie') || 
      (card.category?.toLowerCase() || '').includes('star') || 
      (card.name?.toLowerCase() || '').includes('var') || 
      (card.name?.toLowerCase() || '').includes('tactique complexe') || 
      (card.name?.toLowerCase() || '').includes('joueur star') || 
      (card.name?.toLowerCase() || '').includes('star player') || 
      (card.name?.toLowerCase() || '').includes('moderne');

    if (isHeritageWeightActive && isModerneCard) {
      const x = e ? e.clientX : window.innerWidth / 2;
      const y = e ? e.clientY - 50 : window.innerHeight / 2;
      addFloatingEffect("👴 Nostalgie : Impossible de jouer une carte Moderne (Poids de l'Héritage) !", x, y, 'text-red-400 font-extrabold scale-110 px-2 py-1 bg-black/45 rounded border border-red-500/35 m-1');
      return;
    }

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
    
    let isEligibleForLaser = false;
    if (isLaserRelaunchActive) {
      const isActionRapideOrAttaquant = card.category?.toLowerCase().includes('action rapide') || 
                                       card.name?.toLowerCase().includes('action rapide') || 
                                       card.category?.toLowerCase().includes('attaquant') || 
                                       card.name?.toLowerCase().includes('attaquant');
      if (isActionRapideOrAttaquant) {
        isEligibleForLaser = true;
        actualCost = 0;
      }
    }
    
    if (winner || status !== 'active' || excitement < actualCost || isCardLocked || isStunned) return;

    setLastMyCard(card);
    cardsPlayedCountRef.current += 1;

    // Save snapshot of state for potential "VAR Temporelle" rewind
    saveSnapshot(hand, excitement);

    const isChantOrSort = card.name.toLowerCase().startsWith('chant') || 
                          card.name.toLowerCase().startsWith('sort') || 
                          card.category === 'Chant' || 
                          card.category === 'Sort';
    if (isDeafened && isChantOrSort) {
      const x = e ? e.clientX : window.innerWidth / 2;
      const y = e ? e.clientY - 50 : window.innerHeight / 2;
      addFloatingEffect('🔇 Sourd ! Impossible de jouer de Chant ou de Sort.', x, y, 'text-red-400 font-extrabold scale-110');
      return;
    }

    // Remove from hand and deduct excitement immediately
    setHand(prev => prev.filter(c => c.id !== card.id));
    setPlayedHistory(prev => [...prev, card]);
    setExcitement(prev => Math.max(0, prev - actualCost));
    if (isEligibleForLaser) {
      setIsLaserRelaunchActive(false);
      const x = e ? e.clientX : window.innerWidth / 2;
      const y = e ? e.clientY - 50 : window.innerHeight / 2;
      addFloatingEffect("⚡ Relance Laser Consommée (0 Coût) !", x, y - 90, "text-yellow-400 font-extrabold animate-bounce");
    }
    setTimeout(drawCard, 3000);

    // Visual feedback
    setPlayedCardAnim({ card, id: Math.random().toString() });
    setTimeout(() => setPlayedCardAnim(null), 1500);
    if (!card.videoUrl || card.videoUrl === "undefined" || user.dataSaver) {
      if (card.soundUrl) { playSound(card.soundUrl); } else { audioManager.playCardPlay(); }
    }

    const x = e ? e.clientX : window.innerWidth / 2;
    const y = e ? e.clientY - 50 : window.innerHeight / 2;
    addFloatingEffect(`Carte jouée: ${card.name}`, x, y, 'text-blue-400 font-bold');

    // Calculate boosted card stats immediately for use in effects and emission
    let currentCardLevel = fanz?.cardProgress?.[card.id]?.level || 1;
    const levelBonus = 1 + (currentCardLevel - 1) * 0.05;
    const rawCharismaBonus = getStatEffectValue('card_power');
    const charismaBonus = 1 + (rawCharismaBonus - 1) * 0.2;
    const creativityBonus = getStatEffectValue('card_cost_reduction');

    const hasStunEffect = card.effects?.some(eff => eff.type === 'stun');
    let finalEffects = card.effects || [];
    if (hasStunEffect) {
      const isStunTriggered = Math.random() < 0.5;
      if (isStunTriggered) {
        addFloatingEffect('💥 CIBLE ASSOMMÉE !', x, y - 100, 'text-red-500 font-extrabold scale-125 z-[210]');
      } else {
        addFloatingEffect('💨 Ballon dévié (Manqué...)', x, y - 100, 'text-gray-400 font-semibold z-[210]');
        finalEffects = (card.effects || []).filter(eff => eff.type !== 'stun');
      }
    }

    const isPlayerCard = 
      (card.category?.toLowerCase() || '').includes('joueur') || 
      (card.category?.toLowerCase() || '').includes('player') || 
      (card.category?.toLowerCase() || '').includes('star') ||
      (card.name?.toLowerCase() || '').includes('joueur') ||
      (card.name?.toLowerCase() || '').includes('player') ||
      (card.name?.toLowerCase() || '').includes('star');

    let isPrimeGoatApplied = false;
    if (isPrimeGoatActive && isPlayerCard) {
      isPrimeGoatApplied = true;
    }

    let calculatedFervor = card.fervorValue ? Math.round(card.fervorValue * levelBonus * charismaBonus) : card.fervorValue;
    
    if (isPrimeGoatApplied) {
      const baseFervor = card.fervorValue || 10;
      calculatedFervor = baseFervor + 4;
      setIsPrimeGoatActive(false);
      addFloatingEffect(`✨ LE PRIME (G.O.A.T) ! ${card.name} montre son talent suprême ! (+4 Ferveur, ignorant ses stats réelles !)`, x, y - 110, "text-yellow-400 font-extrabold scale-115 border border-yellow-500/50 px-2.5 py-1.5 rounded bg-slate-950 shadow-[0_0_15px_rgba(234,179,8,0.6)] animate-pulse z-[250]");
    }
    
    let isTiktokContred = false;
    if (isTikTokHighlightActive) {
      const enemyHasDefenseCard = lastEnemyCard && (
        lastEnemyCard.category?.toLowerCase().includes('contre') || 
        lastEnemyCard.category?.toLowerCase().includes('défense') || 
        lastEnemyCard.category?.toLowerCase().includes('defense') || 
        lastEnemyCard.name?.toLowerCase().includes('contre') || 
        lastEnemyCard.name?.toLowerCase().includes('bouclier') || 
        lastEnemyCard.name?.toLowerCase().includes('gardien') || 
        lastEnemyCard.name?.toLowerCase().includes('esquive')
      );
      if (enemyHasDefenseCard || isEnemyMentalMainCouranteActive) {
        isTiktokContred = true;
      }

      if (isTiktokContred) {
        calculatedFervor = 0;
        finalEffects = [];
        setIsTikTokHighlightActive(false);
        setHasLastActionFailed(true);
        setHand(prev => {
          if (prev.length === 0) return prev;
          const newHand = [...prev];
          newHand.splice(Math.floor(Math.random() * newHand.length), 1);
          return newHand;
        });
        setTimeout(drawCard, 2000);
        addFloatingEffect("📱 TikTok CONTRÉ ! L'attaque a échoué et le Prodige est défaussé !", x, y - 115, "text-red-500 font-extrabold bg-black/45 px-2 py-1 rounded scale-110 z-[220] animate-bounce");
      } else {
        if (calculatedFervor) {
          calculatedFervor *= 2;
        }
        finalEffects = finalEffects.map(e => {
          if (e.type === 'push_rope' && e.value) {
            return { ...e, value: e.value * 2 };
          }
          return e;
        });
        setIsTikTokHighlightActive(false);
        addFloatingEffect("⚡ COUP DU FOULARD DOUBLE DÉGÂTS (Highlight TikTok 🔥) !", x, y - 110, "text-purple-400 font-extrabold animate-bounce bg-black/40 px-2.5 py-1.5 rounded border border-purple-500/35 scale-115 text-center");
      }
    }

    if (isMegaphoneEchoActive && (card.category?.toLowerCase().includes('supporter') || card.name.toLowerCase().includes('supporter'))) {
      if (calculatedFervor !== undefined && calculatedFervor > 0) {
        calculatedFervor += 2;
      } else {
        calculatedFervor = (calculatedFervor || 0) + 2;
      }
      addFloatingEffect("📢 ÉCHO DU MÉGAPHONE : +2 Ferveur (Galvanisé) !", x, y - 100, "text-yellow-400 font-extrabold animate-bounce");
    }

    if (isMetaUpdateActive && calculatedFervor !== undefined && calculatedFervor > 0) {
      if (calculatedFervor < 3) {
        calculatedFervor += 2;
        addFloatingEffect("🌐 NOUVELLE MÉTA : +2 Ferveur ! (Base < 3)", x, y - 100, "text-green-400 font-extrabold scale-110 animate-bounce");
      } else if (calculatedFervor > 5) {
        calculatedFervor = Math.max(1, calculatedFervor - 2);
        addFloatingEffect("🌐 NOUVELLE MÉTA : -2 Ferveur ! (Base > 5)", x, y - 100, "text-red-400 font-bold scale-110");
      }
    }
    if (isCapoMegaphoneActive && card.id !== 'base_capo_megaphone') {
      if (calculatedFervor) {
        calculatedFervor *= 2;
        addFloatingEffect("📣 EFFET MÉGAPHONE x2 !", x, y - 80, "text-yellow-400 font-extrabold scale-110 animate-bounce");
      }
    }

    if (isEarlyCraquageActive || isEnemyEarlyCraquageActive) {
      if (Math.random() < 0.5) {
        calculatedFervor = 0;
        finalEffects = [];
        setHasLastActionFailed(true);
        addFloatingEffect("🌫️ ÉCHEC ! Action perdue dans le brouillard du fumigène (50% rater) !", x, y - 110, "text-red-400 font-extrabold bg-black/45 px-2 py-1 rounded scale-110 z-[220]");
      } else {
        addFloatingEffect("🎲 Pile ou Face : Succès de l'attaque !", x, y - 110, "text-green-400 font-bold bg-black/45 px-2 py-1 rounded z-[220]");
      }
    }

    let mappedEffects = finalEffects.map(e => {
      let val = e.value ? Math.round(e.value * levelBonus * charismaBonus) : e.value;
      if (isCapoMegaphoneActive && card.id !== 'base_capo_megaphone' && e.type === 'push_rope' && val) {
        val *= 2;
      }
      return {
        ...e,
        value: val,
        duration: e.duration ? Math.round(e.duration * levelBonus * charismaBonus) : e.duration
      };
    });

    let isTrapTriggered = false;
    if (isLockerRoomCursed) {
      isTrapTriggered = true;
      setIsLockerRoomCursed(false);
      
      if (calculatedFervor) {
        calculatedFervor = Math.round(calculatedFervor * 0.5);
      }
      mappedEffects = mappedEffects.map(e => {
        if (e.type === 'push_rope' && e.value) {
          return { ...e, value: Math.round(e.value * 0.5) };
        }
        return e;
      });
      addFloatingEffect("🪤 PIÈGE ADVERSE DÉCLENCHÉ ! Malédiction des Vestiaires (Ferveur -50%)", x, y - 80, "text-red-500 font-extrabold scale-110 drop-shadow-md z-[200]");
      audioManager.playImpact?.();
    }

    const boostedCard: GameCard = {
      ...card,
      energyCost: Math.max(1, Math.round(card.energyCost * (1 - creativityBonus))),
      fervorValue: calculatedFervor,
      effects: mappedEffects,
      lockerRoomCurseTriggered: isTrapTriggered
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
    const applySingleEffect = (effect: any) => {
      if (effect.type === 'cleanse' || effect.type === 'regard_chien_battu') {
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
        setIsStunned(false);
        if (effect.type === 'regard_chien_battu') {
          setExcitement(prev => Math.min(maxExcitement, prev + (effect.value || 30)));
          addFloatingEffect('🥺 Regard de Chien Battu ! (Malus purgés & Endurance augmentée)', x, y - 30, 'text-green-400 font-black scale-110');
        } else {
          addFloatingEffect('✨ Purifié!', x, y - 30, 'text-yellow-400 font-black');
        }
      }
      if (effect.type === 'zoomies_chaos') {
        // Discard 1 random card from hand
        setHand(prev => {
          if (prev.length === 0) return prev;
          const newHand = [...prev];
          newHand.splice(Math.floor(Math.random() * newHand.length), 1);
          return newHand;
        });
        // Draw 1 new card
        setTimeout(() => drawCard(true, 1), 500);
        addFloatingEffect('🐕 Les Zoomies du Chaos ! (Votre main tourne)', x, y - 30, 'text-blue-400 font-black');
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

      if (effect.type === 'heavy_ball_boost') {
        setIsHeavyBallPower(true);
        setTimeout(() => setIsHeavyBallPower(false), (effect.duration || 12) * 1000);
        addFloatingEffect('⚽ Lourd Ballon équipé ! (+80% Force)', x, y - 30, 'text-orange-400 font-extrabold');
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
      if (effect.type === 'scarves_wall') {
        setIsWallOfShieldsActive(true);
        setTimeout(() => setIsWallOfShieldsActive(false), (effect.duration || 12) * 1000);
        addFloatingEffect('🛡️ Mur d\'Écharpes Actif ! (-50% Dégâts)', x, y - 30, 'text-blue-400 font-extrabold scale-110 animate-pulse');
      }

      if (effect.type === 'transfusion_tactique') {
        const trResistance = { '1v1': 1, '2v2': 2, '5v5': 5, 'war_of_kops': 50, 'training': 1 }[duel.type] || 1;
        const drainVal = 15 / trResistance;
        const direction = (myTeamRef.current || 'A') === 'A' ? 1 : -1;
        setProgress((prev) => Math.min(100, Math.max(0, prev + drainVal * direction)));
        setExcitement(prev => Math.min(maxExcitement, prev + 15));
        addFloatingEffect("🦇 MORSURE NOCTURNE : Vous drainez la ferveur ennemie !", x, y - 40, 'text-red-500 font-extrabold scale-125 z-[200]');
      }
      if (effect.type === 'eclipse_artificielle') {
        setIsStunned(false);
        setIsBlurred(false);
        setIsButtonHidden(false);
        setIsButtonShrunk(false);
        setIsButtonMoving(false);
        setIsScoreHidden(false);
        setIsButtonFrozen(false);
        addFloatingEffect("🦇 ÉCLIPSE ARTIFICIELLE : Nuit Noire & Purge des Malus Visuels !", x, y - 40, 'text-purple-400 font-extrabold scale-110 z-[200]');
      }
      if (effect.type === 'coup_d_envoi_13h') {
        setExcitement(0);
        addFloatingEffect("☀️ COUP D'ENVOI 13h00 : Oups ! Soleil mortel, vous perdez votre énergie !", x, y - 40, 'text-yellow-500 font-black scale-125 z-[200] animate-pulse');
      }
      if (effect.type === 'clapping_odin') {
        setIsOdinClappingActive(true);
        setOdinClickBonus(0);
        addFloatingEffect("👏 Odin Clapping : Rythme lancé !", x, y - 30, 'text-yellow-400 font-extrabold animate-bounce');
      }
      if (effect.type === 'corne_drakkar') {
        addFloatingEffect("📯 Corne de Brume de Drakkar !", x, y - 30, 'text-blue-400 font-extrabold');
      }
      if (effect.type === 'virage_host') {
        const amount = effect.value || 1;
        drawCard(true, amount);
        const commonCards = allCards.filter(c => c.rarity === 'common');
        if (commonCards.length > 0) {
          const randomCommon = commonCards[Math.floor(Math.random() * commonCards.length)];
          setHand(prev => {
            const newHand = [...prev];
            newHand.push({ ...randomCommon, instanceId: Math.random().toString(36).substr(2, 9) });
            return newHand;
          });
        }
        addFloatingEffect('📯 Ost du Virage ! (+Surnombre)', x, y - 30, 'text-green-400 font-black animate-bounce');
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
      if (effect.type === 'steal_object_card') {
        addFloatingEffect("🏴‍☠️ Abordage ! Cargo d\'objets en vue...", x, y - 80, 'text-yellow-500 font-bold animate-pulse');
        socket?.emit('steal-card-init', { duelId: currentDuelIdRef.current, team: myTeam, filterCategory: 'Objet' });
      }
      if (effect.type === 'parrot_taunt') {
        setIsParrotTauntActive(true);
        setTimeout(() => setIsParrotTauntActive(false), (effect.duration || 15) * 1000);
        addFloatingEffect('🦜 Perroquet Insolent : PROVOCATION ACTIVÉE ! (15s)', x, y - 30, 'text-green-400 font-black animate-bounce scale-110 z-[200]');
      }
      if (effect.type === 'pumpkin_fog') {
        setIsEnemyBlind(true);
        setTimeout(() => setIsEnemyBlind(false), (effect.duration || 12) * 1000);
        addFloatingEffect("🎃 Fumigène Citrouille Toxique lancée !", x, y - 30, 'text-orange-500 font-extrabold animate-bounce scale-110');
      }
      if (effect.type === 'locker_room_curse') {
        setHasLockerRoomCurseTrap(true);
        addFloatingEffect("🪤 Piège Mystérieux Posé Face Cachée ! (Vestiaires d'en face)", x, y - 30, 'text-purple-400 font-extrabold scale-110 animate-pulse');
      }
      if (effect.type === 'luminescent_standard') {
        setIsLuminescentStandardActive(true);
        setTimeout(() => setIsLuminescentStandardActive(false), (effect.duration || 15) * 1000);
        addFloatingEffect("✨ L'Étendard Luminescent brille sur ta tribune ! (15s)", x, y - 30, 'text-yellow-400 font-extrabold animate-bounce scale-110 z-[200]');
      }
      if (effect.type === 'buvette_grail') {
        if (myTeam === 'A') {
          if (progress < 50) setProgress(50);
          else setProgress(prev => Math.min(100, prev + 15));
        } else {
          if (progress > 50) setProgress(50);
          else setProgress(prev => Math.max(0, prev - 15));
        }
        addFloatingEffect("🍺 Le Graal de la Buvette ! Suppression de la déroute (50%) !", x, y - 40, 'text-yellow-500 font-extrabold animate-pulse scale-110');
      }
      if (effect.type === 'var_illusion') {
        const hasCountered = lastEnemyCard && (lastEnemyCard.category === 'Action' || lastEnemyCard.name.toLowerCase().includes('action'));
        if (hasCountered) {
          setIsVarOverlayActive(true);
          setTimeout(() => setIsVarOverlayActive(false), 3000);
          
          const resistance = { '1v1': 1, '2v2': 2, '5v5': 5, 'war_of_kops': 50, 'training': 1 }[duel.type] || 1;
          const val = lastEnemyCard.fervorValue || lastEnemyCard.effects?.find(e => e.type === 'push_rope')?.value || 0;
          // Revert: opponent B pulled progress down (so we add back positive delta for A). Opponent A pulled progress up (we subtract delta for B)
          const delta = (myTeam === 'A' ? val : -val) / resistance;
          setProgress(prev => Math.min(100, Math.max(0, prev + delta)));
          addFloatingEffect(`📺 VAR : Décision inversée ! Hors-jeu de l'adversaire (${lastEnemyCard.name})`, x, y - 50, 'text-red-500 font-extrabold scale-110 drop-shadow-md z-[202]');
          setLastEnemyCard(null);
        } else {
          addFloatingEffect("🤷‍♂️ VAR : Aucun hors-jeu ou carte action adverse à vérifier !", x, y - 50, 'text-gray-400 font-bold');
        }
      }
      if (effect.type === 'grimoire_chants') {
        const eligible = playedHistory.filter(c => 
          c.category === 'Chant' || 
          c.category === 'Sort' ||
          c.name.toLowerCase().startsWith('chant') ||
          c.name.toLowerCase().startsWith('sort')
        );
        // Eliminate duplicates by card ID to make a polished clean picker list
        const uniqueEligibleMap = new Map<string, GameCard>();
        eligible.forEach(c => uniqueEligibleMap.set(c.id, c));
        const uniqueEligible = Array.from(uniqueEligibleMap.values());

        if (uniqueEligible.length > 0) {
          setGrimoireEligibleCards(uniqueEligible);
          setIsGrimoirePickerOpen(true);
          addFloatingEffect("📖 Grimoire ouvert...", x, y - 40, 'text-yellow-400 font-bold');
        } else {
          addFloatingEffect("📖 Défausse vide (aucun Chant ou Sort) !", x, y - 40, 'text-gray-400 font-bold');
        }
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
      if (effect.type === 'chainsaw_megaphone') {
        setExcitement(prev => Math.max(0, prev - 1));
        addFloatingEffect('💥 RECUL : -1 PA d\'excitation !', x, y - 60, 'text-red-500 font-extrabold animate-bounce');
      }
      if (effect.type === 'burning_seats') {
        setIsBurningSeatsOverlayActive(true);
        setTimeout(() => setIsBurningSeatsOverlayActive(false), 3000);
        
        setHasShield(false);
        setHasMirror(false);
        setIsLuminescentStandardActive(false);
        setIsEnemyLuminescentStandardActive(false);
        setIsParrotTauntActive(false);
        setIsEnemyParrotTauntActive(false);
        setIsOdinClappingActive(false);
        setIsEnemyOdinClappingActive(false);
        setOdinClickBonus(0);
        
        const standardIndex = hand.findIndex(c => c.id === 'base_luminescent_standard');
        const vulnerableIndices: number[] = [];
        hand.forEach((card, idx) => {
          if (card.id === 'base_luminescent_standard') return;
          if (standardIndex !== -1 && Math.abs(standardIndex - idx) === 1) return;
          vulnerableIndices.push(idx);
        });
        
        if (vulnerableIndices.length > 0) {
          const randomIndexToDiscard = vulnerableIndices[Math.floor(Math.random() * vulnerableIndices.length)];
          const discardedCard = hand[randomIndexToDiscard];
          setHand(prev => prev.filter((_, idx) => idx !== randomIndexToDiscard));
          setTimeout(drawCard, 2000);
          addFloatingEffect(`🔥 SIÈGES EN FEU : Votre carte ${discardedCard.name} part en fumée !`, window.innerWidth / 2, 240, 'text-orange-500 font-black scale-110');
        } else {
          addFloatingEffect(`🛡️ PROTECT : Vos cartes en main sont immunisées par l'Étendard !`, window.innerWidth / 2, 240, 'text-yellow-400 font-bold');
        }
      }
      if (effect.type === 'var_temporelle') {
        const history = stateSnapshots;
        if (history && history.length > 1) {
          const target = history[Math.max(0, history.length - 2)];
          setProgress(target.progress);
          setExcitement(target.excitement);
          setHand(target.hand);
          setHasShield(target.hasShield);
          setIsLuminescentStandardActive(target.isLuminescentStandardActive);
          setIsTifoHolographiqueActive(target.isTifoHolographiqueActive);
          setIsCapoMegaphoneActive(target.isCapoMegaphoneActive);
          setIsCraquageMassifActive(target.isCraquageMassifActive);
          setStateSnapshots(history.slice(0, -2));
          addFloatingEffect("📺 ARBITRAGE VIDÉO 4D : Le match est rembobiné !", x, y - 50, 'text-red-500 font-extrabold scale-125 z-[210] animate-pulse');
        } else {
          addFloatingEffect("📺 VAR : Pas assez d'historique pour rembobiner !", x, y - 50, 'text-gray-400 font-bold');
        }
      }
      if (effect.type === 'tifo_holographique') {
        setIsTifoHolographiqueActive(true);
        addFloatingEffect("🛡️ TIFO HOLOGRAPHIQUE 3D : Mascotte géante déployée ! (Écran laser actif)", x, y - 40, 'text-cyan-400 font-extrabold animate-pulse');
      }
      if (effect.type === 'capo_megaphone') {
        setIsCapoMegaphoneActive(true);
        setTimeout(() => setIsCapoMegaphoneActive(false), (effect.duration || 15) * 1000);
        addFloatingEffect("📢 MÉGAPHONE DU CAPO : Énergie et chants de tribune doublés !", x, y - 45, 'text-yellow-400 font-black scale-110 animate-bounce');
      }
      if (effect.type === 'craquage_massif') {
        setIsCraquageMassifActive(true);
        setTimeout(() => setIsCraquageMassifActive(false), (effect.duration || 10) * 1000);
        addFloatingEffect("🔥 CRAQUAGE MASSIF : Tribune inciblable par l'ennemi !", x, y - 50, 'text-red-500 font-black scale-125 animate-bounce z-[210]');
      }
      if (effect.type === 'cancel_last_attack') {
        if (lastEnemyCard) {
          const resistance = { '1v1': 1, '2v2': 2, '5v5': 5, 'war_of_kops': 50, 'training': 1 }[duel.type] || 1;
          const val = lastEnemyCard.fervorValue || lastEnemyCard.effects?.find(e => e.type === 'push_rope')?.value || 10;
          const delta = (myTeam === 'A' ? val : -val) / resistance;
          const bonus = myTeam === 'A' ? 10 : -10;
          setProgress(prev => Math.min(100, Math.max(0, prev + delta + bonus)));
          addFloatingEffect(`🔮 LE SCRIPT : Attaque adverse annulée (${lastEnemyCard.name}) + Rebond Miracle !`, x, y - 50, 'text-yellow-400 font-extrabold scale-110 drop-shadow-md z-[202]');
          setLastEnemyCard(null);
        } else {
          const bonus = myTeam === 'A' ? 10 : -10;
          setProgress(prev => Math.min(100, Math.max(0, prev + bonus)));
          addFloatingEffect("🔮 SCRIPT ACTIF : Rebond miracle dans vos pieds ! (+10% ferveur)", x, y - 50, 'text-yellow-300 font-bold');
        }
      }
      if (effect.type === 'rage_quit_discard') {
        // Since playCard is playing a malus on the enemy, this only triggers locally on the player if they play it on themselves (e.g. testing)
        // Usually, malus is sent to opponent, so this is just symmetrical visual feedback when played by us.
        addFloatingEffect(`😡 RAGE QUIT INITIÉ ! Cible sous tension (l'adversaire déteste ça...)`, x, y - 55, 'text-red-500 font-black scale-110 animate-bounce');
      }
      if (effect.type === 'meta_update') {
        setIsMetaUpdateActive(true);
        setTimeout(() => setIsMetaUpdateActive(false), (effect.duration || 15) * 1000);
        addFloatingEffect("🌐 NOUVELLE MÉTA : Statut Équilibrage Actif !", x, y - 30, "text-cyan-400 font-black animate-pulse scale-110");
      }
      if (effect.type === 'stealth_jacket_flip') {
        if (lastEnemyCard && lastEnemyCard.effects && lastEnemyCard.effects.length > 0) {
          addFloatingEffect(`🎭 Retournement de veste : Effets de "${lastEnemyCard.name}" copiés !`, x, y - 80, 'text-green-400 font-extrabold animate-pulse scale-110');
          lastEnemyCard.effects.forEach(applySingleEffect);
        } else {
          addFloatingEffect("❌ Pas de carte adverse à copier", x, y - 80, 'text-gray-500');
        }
      }
      if (effect.type === 'desert_crossing') {
        const isLosing = (myTeam === 'A' && progress < 50) || (myTeam === 'B' && progress > 50);
        if (isLosing) {
          addFloatingEffect("🏜️ Traversée du Désert : Perte de ferveur (-15%) !", x, y - 80, 'text-red-500 font-extrabold animate-bounce scale-110');
          const loss = myTeam === 'A' ? -15 : 15;
          const resistance = { '1v1': 1, '2v2': 2, '5v5': 5, 'war_of_kops': 50, 'training': 1 }[duel.type] || 1;
          setProgress(prev => Math.min(100, Math.max(0, prev + (loss / resistance))));
        } else {
          addFloatingEffect("🏜️ Traversée du Désert : Vous menez ! Glory Hunter préservé.", x, y - 80, 'text-green-400 font-bold');
        }
      }
      if (effect.type === 'half_half_scarf') {
        setIsImmune(true);
        setIsHalfHalfScarfActive(true);
        setTimeout(() => {
          setIsImmune(false);
          setIsHalfHalfScarfActive(false);
        }, (effect.duration || 10) * 1000);
        addFloatingEffect("🧣 Écharpe Half-Half : Combat Gelé ! (Immunité mutuelle 10s)", x, y - 80, 'text-blue-300 font-extrabold animate-pulse');
      }
      if (effect.type === 'megaphone_echo') {
        setIsMegaphoneEchoActive(true);
        setTimeout(() => {
          setIsMegaphoneEchoActive(false);
        }, (effect.duration || 15) * 1000);
        addFloatingEffect("📢 Écho du Mégaphone : Vos supporters sont galvanisés (+2 Ferveur/Attaque) !", x, y - 80, 'text-yellow-400 font-black scale-110 animate-bounce');
      }
      if (effect.type === 'biological_curfew') {
        addFloatingEffect("😴 Couvre-Feu Biologique ! L'adversaire va s'endormir pour 2 tours.", x, y - 80, 'text-purple-400 font-extrabold scale-110');
        // Let's also lock a random opponent card in training mode to make single player training feel alive
        if (duel.type === 'training') {
           addFloatingEffect("🤖 Bot fatigué : Une de ses actions est engagée !", x, y - 120, 'text-purple-400 font-semibold');
        }
      }
      if (effect.type === 'early_craquage') {
        setIsEarlyCraquageActive(true);
        setTimeout(() => {
          setIsEarlyCraquageActive(false);
        }, (effect.duration || 15) * 1000);
        addFloatingEffect("🌫️ Le Craquage Précoce ! Fumigène massif en plein virage pendant 15s !", x, y - 80, 'text-gray-400 font-black animate-pulse scale-110');
      }
      if (effect.type === 'laser_relaunch') {
        setIsLaserRelaunchActive(true);
        setTimeout(() => {
          setIsLaserRelaunchActive(false);
        }, (effect.duration || 15) * 1000);
        addFloatingEffect("⚡ Relance Laser active ! Prochaine Action Rapide ou Attaquant gratuite !", x, y - 80, 'text-yellow-400 font-extrabold animate-pulse scale-110');
      }
      if (effect.type === 'pro_tantrum') {
        addFloatingEffect("🟥 Coup de Sang du Pro : L'adversaire bouscule le ramasseur ! (-12% Ferveur adverse)", x, y - 80, 'text-red-500 font-extrabold animate-bounce scale-110');
        const ptResistance = { '1v1': 1, '2v2': 2, '5v5': 5, 'war_of_kops': 50, 'training': 1 }[duel.type] || 1;
        const ptLoss = myTeam === 'A' ? 12 : -12;
        setProgress(prev => Math.min(100, Math.max(0, prev + (ptLoss / ptResistance))));
      }
      if (effect.type === 'multiball_chaos') {
        addFloatingEffect("🔊 DRING ! Double ballon sifflet de l'arbitre ! Phase d'attaque annulée.", x, y - 50, 'text-white font-extrabold scale-125 animate-pulse bg-slate-900 border border-slate-700 rounded px-2 py-1');
        setPlayedHistory(prevHistory => {
          if (prevHistory.length > 0) {
            const lastPlayed = prevHistory[prevHistory.length - 1];
            setHand(prevHand => {
              if (prevHand.some(c => c.id === lastPlayed.id)) return prevHand;
              return [...prevHand, lastPlayed];
            });
            addFloatingEffect(`⚽ Multi-Ballon : "${lastPlayed.name}" retourné dans votre main !`, x, y - 80, 'text-green-300 font-bold');
            return prevHistory.slice(0, -1);
          }
          return prevHistory;
        });
        if (lastEnemyCard) {
          addFloatingEffect(`⚽ Multi-Ballon : "${lastEnemyCard.name}" adverse retourné !`, x, y - 110, 'text-red-300 font-bold');
          const mbResistance = { '1v1': 1, '2v2': 2, '5v5': 5, 'war_of_kops': 50, 'training': 1 }[duel.type] || 1;
          const val = lastEnemyCard.fervorValue || lastEnemyCard.effects?.find(e => e.type === 'push_rope')?.value || 10;
          const delta = (myTeam === 'A' ? val : -val) / mbResistance;
          setProgress(prev => Math.min(100, Math.max(0, prev + delta)));
          setLastEnemyCard(null);
        }
      }
      if (effect.type === 'mental_main_courante') {
        setIsMentalMainCouranteActive(true);
        setTimeout(() => {
          setIsMentalMainCouranteActive(false);
        }, (effect.duration || 15) * 1000);
        addFloatingEffect("🛡️ Le Mental de la Main Courante ! Vos cartes sont immunisées contre le Climat et le Terrain !", x, y - 80, 'text-green-400 font-extrabold animate-pulse scale-110');
      }
      if (effect.type === 'heritage_weight') {
        setIsEnemyHeritageWeightActive(true);
        setTimeout(() => {
          setIsEnemyHeritageWeightActive(false);
        }, (effect.duration || 15) * 1000);
        addFloatingEffect("👵 Le Poids de l'Héritage ! L'adversaire est submergé par la mélancolie en repensant à 1964 !", x, y - 80, 'text-red-400 font-extrabold bg-black/45 px-2 py-1 rounded scale-110');
      }
      if (effect.type === 'buvette_alert') {
        setIsBuvetteAlertActive(true);
        setHasConsumedBuvette(false);
        setTimeout(() => {
          setIsBuvetteAlertActive(false);
        }, 12000);
        addFloatingEffect("🌭 Alerte Buvette ! Passer l'attaque pour Buvette ! (+3 Énergie / +12% Ferveur)", x, y - 80, 'text-yellow-400 font-black animate-bounce scale-110 py-1 px-2 border border-yellow-500/40 rounded bg-slate-900');
      }
      if (effect.type === 'tiktok_highlight') {
        setIsTikTokHighlightActive(true);
        addFloatingEffect("📱 Highlight TikTok ! Prochain geste doublé en ferveur ! (Attention au Contre !)", x, y - 85, 'text-purple-400 font-black animate-pulse scale-110');
      }
      if (effect.type === 'prime_goat') {
        setIsPrimeGoatActive(true);
        setTimeout(() => setIsPrimeGoatActive(false), (effect.duration || 15) * 1000);
        addFloatingEffect("⚡ Le Prime (G.O.A.T) ! Votre prochaine carte 'Joueur' gagnera +4 en ferveur !", x, y - 85, 'text-yellow-400 font-extrabold animate-pulse scale-110');
      }
      if (effect.type === 'attention_swipe') {
        addFloatingEffect("📱 Perte d'Attention (Swipe) ! L'Ado adverse zappe, défaussant une de ses cartes au hasard !", x, y - 85, 'text-red-400 font-black animate-bounce scale-110');
      }
      if (effect.type === 'sterile_debate') {
        setIsDebatePickerOpen(true);
        addFloatingEffect("💬 Débat Stérile sur les Réseaux ! Sélectionnez une carte à parier !", x, y - 85, 'text-purple-400 font-extrabold animate-bounce bg-black/40 px-2 py-1 rounded');
      }
      if (effect.type === 'boucher_district') {
        addFloatingEffect("🤕 Le Boucher du District envoyé ! Tacle assassin sur l'adversaire !", x, y - 85, 'text-red-400 font-black scale-110 animate-bounce');
      }
      if (effect.type === 'faux_rebond_excuse') {
        const lastPlayed = lastMyCard;
        if (lastPlayed) {
          setHand(prevHand => {
            if (prevHand.some(c => c.id === lastPlayed.id)) return prevHand;
            return [...prevHand, lastPlayed];
          });
          addFloatingEffect(`🤷‍♂️ Faux Rebond ! Action annulée : "${lastPlayed.name}" revient en main !`, x, y - 85, 'text-yellow-400 font-extrabold animate-bounce bg-black/40 px-2 py-1 rounded');
        } else {
          addFloatingEffect("🤷‍♂️ Faux Rebond ! Le match est temporairement gelé !", x, y - 85, 'text-yellow-400 font-bold');
        }
        setExcitement(0);
      }
    };

    (boostedCard.effects || []).forEach(applySingleEffect);

    if (boostedCard.fervorValue) {
      addFloatingEffect(`+${boostedCard.fervorValue}% Ferveur!`, x, y - 60, 'text-yellow-400 font-black');
    }

    const pushRopeEffect = boostedCard.effects?.find(e => e.type === 'push_rope');
    if (pushRopeEffect && pushRopeEffect.value && !boostedCard.fervorValue) {
       addFloatingEffect(`+${Math.round(pushRopeEffect.value * levelBonus * charismaBonus)}% Ferveur!`, x, y - 60, 'text-orange-500 font-black');
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

  // Odin's Clapping rhythmic effect
  useEffect(() => {
    if (!isOdinClappingActive || status !== 'active' || winner || !socket || !duel.id) return;

    let clapCount = 0;
    const clapIntervals = [3500, 2500, 1500, 1000, 500]; // Accelerating rhythm!
    let timer: any = null;

    const triggerClap = () => {
      clapCount++;
      
      // Play soft click/impact sound
      audioManager.playCardSelect?.();

      // Permanent bonus to click power (for the duration of the clapping)
      setOdinClickBonus(prev => prev + 1.2);

      // Support automatic rope pushing (power) representing "supporters" ferveur contribution
      const myParticipant = participants.find(p => p.uid === user.uid);
      const myTeam = myParticipant?.team || 'A';
      socket.emit('click-ferveur', { 
        duelId: duel.id, 
        team: myTeam, 
        multiplier: 1.5 * clapCount, 
        userId: user.uid 
      });

      const x = window.innerWidth / 2 + (Math.random() * 105 - 50);
      const y = window.innerHeight / 2 + (Math.random() * 105 - 50);
      addFloatingEffect(
        `👏 CLAP ! (+${(1.5 * clapCount).toFixed(0)} Ferveur Auto)`, 
        x, 
        y, 
        'text-yellow-400 font-extrabold scale-110 drop-shadow-md'
      );

      if (clapCount < clapIntervals.length) {
        timer = setTimeout(triggerClap, clapIntervals[clapCount]);
      } else {
        // Final devastating, accelerated beat!
        socket.emit('click-ferveur', { 
          duelId: duel.id, 
          team: myTeam, 
          multiplier: 10, 
          userId: user.uid 
        });
        
        addFloatingEffect(
          '⚡ RYTHME DÉVASTATEUR d\'ODIN ! ⚡ (Click +8 Actif !)', 
          window.innerWidth / 2, 
          window.innerHeight / 3, 
          'text-red-500 font-black scale-150 animate-bounce drop-shadow-[0_0_12px_rgba(239,68,68,0.9)] z-[200]'
        );

        // Retain the epic +8 click power bonus for 5s of devastation
        setOdinClickBonus(8);
        timer = setTimeout(() => {
          setIsOdinClappingActive(false);
          setOdinClickBonus(0);
        }, 5000);
      }
    };

    timer = setTimeout(triggerClap, clapIntervals[0]);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isOdinClappingActive, status, winner, participants, user.uid, socket, duel.id]);

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
    <div className="fixed inset-0 z-50 flex justify-center bg-[#0a0a0a] h-[100dvh] w-[100dvw]">
      <div className={`w-full lg:max-w-[450px] h-full relative flex flex-col p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-black lg:border-x border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.5)] transition-all duration-500 overflow-hidden ${isEarthquake || isRealMatchGoal ? 'animate-bounce' : ''}`}>
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
        {/* Luminescent Standard Overlay */}
        <AnimatePresence>
          {isLuminescentStandardActive && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 pointer-events-none"
            >
              <motion.div 
                animate={{ opacity: [0.1, 0.25, 0.1] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                className="absolute inset-0 bg-gradient-to-t from-yellow-500/5 via-transparent to-yellow-400/10"
              />
              <div className="absolute top-2 left-6 bg-yellow-950/95 border border-yellow-500/50 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-[0_0_15px_rgba(234,179,8,0.4)]">
                <span className="text-xs animate-pulse">✨</span>
                <span className="text-[10px] font-extrabold text-yellow-400 tracking-wider uppercase">Étendard Actif</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Pumpkin Toxic Fog Overlay */}
        <AnimatePresence>
          {isBlind && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 pointer-events-none bg-orange-600/25 mix-blend-color-burn"
            >
              <motion.div 
                animate={{ scale: [1, 1.15, 0.95, 1.1, 1], opacity: [0.4, 0.7, 0.35, 0.6, 0.4] }}
                transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
                className="absolute inset-0 bg-radial from-orange-500/40 via-transparent to-orange-950/60 blur-xl"
              />
              <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-orange-950/90 border border-orange-500/50 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-[0_0_15px_rgba(249,115,22,0.4)]">
                <span className="animate-spin text-xs">🎃</span>
                <span className="text-[10px] font-extrabold text-orange-400 tracking-wider uppercase animate-pulse">Brouillard de Citrouille Toxique</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* VAR Illusion Overlay */}
        <AnimatePresence>
          {isVarOverlayActive && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 pointer-events-none"
            >
              <div className="relative flex flex-col items-center p-6 border-2 border-red-500 bg-red-950/20 rounded-2xl max-w-[90%] text-center shadow-[0_0_30px_rgba(239,68,68,0.4)] overflow-hidden">
                <motion.div 
                  animate={{ scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="text-6xl mb-4"
                >
                  📺
                </motion.div>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.15),transparent_60%)] -z-10" />
                <h3 className="text-2xl font-black text-red-500 tracking-wider mb-2 uppercase select-none">
                  ILLUSION DE LA VAR
                </h3>
                <p className="text-red-200/80 text-xs font-semibold uppercase tracking-widest animate-pulse">
                  🚫 HORS-JEU IMAGINAIRE !
                </p>
                <p className="text-gray-400 text-[10px] mt-3 uppercase tracking-wider">
                  La dernière action adverse est annulée
                </p>
                <div className="mt-4 flex gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Burning Seats Overlay */}
        <AnimatePresence>
          {isBurningSeatsOverlayActive && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/85 pointer-events-none overflow-hidden"
            >
              {/* Falling blazing chairs simulation */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.2),transparent_70%)]" />
              
              <div className="relative flex flex-col items-center p-6 border-2 border-orange-500 bg-orange-950/20 rounded-2xl max-w-[90%] text-center shadow-[0_0_35px_rgba(249,115,22,0.5)]">
                <motion.div 
                  animate={{ y: [-15, 10, -15], scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  className="text-6xl mb-4"
                >
                  🔥🪑🔥
                </motion.div>
                <h3 className="text-2xl font-black text-orange-500 tracking-wider mb-2 uppercase select-none animate-pulse">
                  PLUIE DE SIÈGES ENFLAMMÉS !
                </h3>
                <p className="text-orange-200/90 text-xs font-bold uppercase tracking-widest leading-relaxed">
                  Dégâts de zone imminents !
                </p>
                <p className="text-gray-400 text-[10px] mt-2 uppercase tracking-wider">
                  Tous les bonus, compagnons et armures du plateau réduits en cendres
                </p>
                <div className="mt-4 flex gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-bounce" />
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-bounce delay-100" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-bounce delay-200" />
                </div>
              </div>
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

        {/* Tifo Holographique laser projection */}
        <AnimatePresence>
          {(isTifoHolographiqueActive || isEnemyTifoHolographiqueActive) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.25 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 pointer-events-none mix-blend-color-dodge overflow-hidden"
              style={{
                background: "radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 80%)",
                backgroundImage: "linear-gradient(rgba(18,187,222,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(18,187,222,0.1) 1px, transparent 1px)",
                backgroundSize: "20px 20px"
              }}
            >
              <div className="absolute top-1/4 left-1/2 -translate-x-1/2 flex flex-col items-center animate-pulse">
                <div className="w-48 h-48 rounded-full border-4 border-cyan-400 animate-spin opacity-40" style={{ animationDuration: '10s' }} />
                <span className="text-cyan-400 text-xs font-black tracking-widest uppercase mt-4 animate-bounce">CYBER-MASCOTTE ACTIVÉE</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Craquage Massif Red Fog of Fumigènes */}
        <AnimatePresence>
          {(isCraquageMassifActive || isEnemyCraquageMassifActive) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.65 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 pointer-events-none overflow-hidden mix-blend-screen"
              style={{
                background: "radial-gradient(circle at 50% 100%, rgba(239,68,68,0.4) 0%, rgba(220,38,38,0.2) 50%, transparent 100%)",
              }}
            >
              <div className="absolute inset-0 bg-red-600/10 backdrop-blur-[1px] animate-pulse" />
              <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-red-600/30 to-transparent blur-md animate-bounce" style={{ animationDuration: '4s' }} />
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
                        emotesSentCountRef.current += 1;
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
                  {p.fanz?.equippedSkinVideoUrl && p.fanz.equippedSkinVideoUrl !== "undefined" && !user.dataSaver ? (
                    <video src={getOptimizedVideoUrl(p.fanz.equippedSkinVideoUrl)} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" data-viewer-ignore="true" />
                  ) : p.fanz?.videoUrl && p.fanz.videoUrl !== "undefined" && !user.dataSaver ? (
                    <video src={getOptimizedVideoUrl(p.fanz.videoUrl)} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" data-viewer-ignore="true" />
                  ) : p.photoURL && p.photoURL !== "undefined" && !p.photoURL.includes('imageFanz001Skin000') ? (
                     <img src={getImageUrl(p.photoURL)} referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover" />
                  ) : p.fanz?.equippedSkinUrl && p.fanz.equippedSkinUrl !== "undefined" ? (
                     <img src={getImageUrl(p.fanz.equippedSkinUrl)} className="absolute inset-0 w-full h-full object-cover" />
                  ) : p.fanz?.imageUrl && p.fanz.imageUrl !== "undefined" ? (
                     <img src={getImageUrl(p.fanz.imageUrl)} className="absolute inset-0 w-full h-full object-cover" />
                  ) : p.photoURL && p.photoURL !== "undefined" ? (
                     <img src={getImageUrl(p.photoURL)} referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover" />
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
                  {p.fanz?.equippedSkinVideoUrl && p.fanz.equippedSkinVideoUrl !== "undefined" && !user.dataSaver ? (
                    <video src={getOptimizedVideoUrl(p.fanz.equippedSkinVideoUrl)} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" data-viewer-ignore="true" />
                  ) : p.fanz?.videoUrl && p.fanz.videoUrl !== "undefined" && !user.dataSaver ? (
                    <video src={getOptimizedVideoUrl(p.fanz.videoUrl)} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" data-viewer-ignore="true" />
                  ) : p.photoURL && p.photoURL !== "undefined" && !p.photoURL.includes('imageFanz001Skin000') ? (
                     <img src={getImageUrl(p.photoURL)} referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />
                  ) : p.fanz?.equippedSkinUrl && p.fanz.equippedSkinUrl !== "undefined" ? (
                     <img src={getImageUrl(p.fanz.equippedSkinUrl)} className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />
                  ) : p.fanz?.imageUrl && p.fanz.imageUrl !== "undefined" ? (
                     <img src={getImageUrl(p.fanz.imageUrl)} className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />
                  ) : p.photoURL && p.photoURL !== "undefined" ? (
                     <img src={getImageUrl(p.photoURL)} referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />
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
            className="absolute top-20 left-1/2 -translate-x-1/2 z-[90] pointer-events-none flex flex-col justify-center items-center"
          >
            {(() => {
              const borderColors: any = {
                common: 'border-gray-500 shadow-[0_0_30px_rgba(107,114,128,0.8)]',
                rare: 'border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.8)]',
                epic: 'border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.8)]',
                legendary: 'border-yellow-400 shadow-[0_0_50px_rgba(250,204,21,1)]',
              };
              const borderColor = borderColors[enemyPlayedCardAnim.card.rarity] || borderColors.common;
              const energy = enemyPlayedCardAnim.card.energyCost;

              return (
                <>
                  <div className={`relative w-[200px] h-[300px] md:w-[240px] md:h-[360px] rounded-2xl border-4 ${borderColor} overflow-hidden bg-black`}>
                    {enemyPlayedCardAnim.card.videoUrl && enemyPlayedCardAnim.card.videoUrl !== "undefined" && !user.dataSaver ? (
                      <video src={getOptimizedVideoUrl(enemyPlayedCardAnim.card.videoUrl)} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover z-0" data-viewer-ignore="true" />
                    ) : enemyPlayedCardAnim.card.imageUrl && enemyPlayedCardAnim.card.imageUrl !== "undefined" && (
                      <img 
                        src={getImageUrl(enemyPlayedCardAnim.card.imageUrl)} 
                        alt={enemyPlayedCardAnim.card.name} 
                        className="absolute inset-0 w-full h-full object-cover z-0" data-viewer-ignore="true"
                        referrerPolicy="no-referrer"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-0 opacity-80" />
                    
                    {/* Top left Energy */}
                    <div className="absolute top-3 left-3 z-10 flex items-center justify-center w-12 h-12 bg-black/80 rounded-full border-2 border-yellow-500 shadow-lg backdrop-blur-sm">
                      <Zap className="absolute inset-0 w-full h-full text-yellow-500 opacity-20 p-2" />
                      <span className="font-black italic text-xl text-yellow-400 drop-shadow-md z-10">{energy}</span>
                    </div>
                  </div>
                  <div className="mt-4 text-center px-4 w-[250px] md:w-[350px]">
                    <h3 className="text-white font-black italic uppercase text-2xl md:text-3xl leading-tight drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] break-words" style={{ WebkitTextStroke: '1.5px black' }}>
                      {enemyPlayedCardAnim.card.name}
                    </h3>
                  </div>
                </>
              );
            })()}
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
        {(status === 'waiting' || status === 'room_full') && (
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
              <h3 className="text-[10px] md:text-xs font-black italic uppercase text-white drop-shadow-md">
                {status === 'room_full' ? 'Le duel va commencer...' : "En attente d'adversaires..."}
              </h3>
              <p className="text-gray-300 text-[7px] md:text-[8px] font-bold uppercase tracking-widest mt-0.5">
                {status === 'room_full' ? 'Préparez-vous !' : 'Le duel commencera dès que le salon sera complet.'}
              </p>
            </div>

            {/* VS Background Split */}
            <div className="absolute inset-0 flex flex-col overflow-hidden">
              <div className="absolute inset-0">
                {arenaBg.video && !user.dataSaver ? (
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
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 transform -rotate-12 pointer-events-none">
              <span className="text-7xl md:text-8xl font-black italic text-orange-500 tracking-tighter drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]" style={{ WebkitTextStroke: '4px black' }}>VS</span>
            </div>

            {/* Teams Container */}
            <div className="absolute inset-0 flex flex-col justify-between pt-24 pb-28 md:pt-36 md:pb-40 z-10 pointer-events-none px-2">
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
                        className={`w-24 h-36 border-b-4 border-blue-500/80 rounded-t-xl overflow-hidden relative flex flex-col items-center shadow-lg pointer-events-auto ${p ? 'cursor-pointer hover:border-white transition-colors duration-200' : ''}`}
                      >
                        {p ? (
                          <>
                            {p.photoURL && p.photoURL !== "undefined" && !p.photoURL.includes('imageFanz001Skin000') ? (
                               <img src={getImageUrl(p.photoURL)} referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover z-0" />
                            ) : p.fanz?.equippedSkinVideoUrl && p.fanz.equippedSkinVideoUrl !== "undefined" && !user.dataSaver ? (
                              <video src={getOptimizedVideoUrl(p.fanz.equippedSkinVideoUrl)} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover z-0" data-viewer-ignore="true" />
                            ) : p.fanz?.videoUrl && p.fanz.videoUrl !== "undefined" && !user.dataSaver ? (
                               <video src={getOptimizedVideoUrl(p.fanz.videoUrl)} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover z-0" data-viewer-ignore="true" />
                            ) : p.fanz?.equippedSkinUrl && p.fanz.equippedSkinUrl !== "undefined" ? (
                               <img src={getImageUrl(p.fanz.equippedSkinUrl)} className="absolute inset-0 w-full h-full object-cover z-0" />
                            ) : p.fanz?.imageUrl && p.fanz.imageUrl !== "undefined" ? (
                               <img src={getImageUrl(p.fanz.imageUrl)} className="absolute inset-0 w-full h-full object-cover z-0" />
                            ) : p.photoURL && p.photoURL !== "undefined" && (
                               <img src={getImageUrl(p.photoURL)} referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover z-0" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-0" />
                            
                            <div className="relative z-10 flex flex-col items-center justify-end w-full p-2 h-full gap-1">
                              {p.fanz && (
                                <span className="bg-black/80 px-1.5 py-0.5 rounded border border-white/10 text-[8px] font-black text-white drop-shadow-md">
                                  Niv. {p.fanz.ferveurLevel || p.fanz.level || 1}
                                </span>
                              )}
                              <span className="text-[8px] text-blue-300 font-bold uppercase truncate w-full content-center text-center">{p.pseudo || 'Joueur'}</span>
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
                        className={`w-24 h-36 border-t-4 border-red-500/80 rounded-b-xl overflow-hidden relative flex flex-col items-center shadow-lg pointer-events-auto ${p ? 'cursor-pointer hover:border-white transition-colors duration-200' : ''}`}
                      >
                        {p ? (
                          <>
                            {p.photoURL && p.photoURL !== "undefined" && !p.photoURL.includes('imageFanz001Skin000') ? (
                               <img src={getImageUrl(p.photoURL)} referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover z-0 scale-x-[-1]" />
                            ) : p.fanz?.equippedSkinVideoUrl && p.fanz.equippedSkinVideoUrl !== "undefined" && !user.dataSaver ? (
                              <video src={getOptimizedVideoUrl(p.fanz.equippedSkinVideoUrl)} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover z-0 scale-x-[-1]" data-viewer-ignore="true" />
                            ) : p.fanz?.videoUrl && p.fanz.videoUrl !== "undefined" && !user.dataSaver ? (
                               <video src={getOptimizedVideoUrl(p.fanz.videoUrl)} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover z-0 scale-x-[-1]" data-viewer-ignore="true" />
                            ) : p.fanz?.equippedSkinUrl && p.fanz.equippedSkinUrl !== "undefined" ? (
                               <img src={getImageUrl(p.fanz.equippedSkinUrl)} className="absolute inset-0 w-full h-full object-cover z-0 scale-x-[-1]" />
                            ) : p.fanz?.imageUrl && p.fanz.imageUrl !== "undefined" ? (
                               <img src={getImageUrl(p.fanz.imageUrl)} className="absolute inset-0 w-full h-full object-cover z-0 scale-x-[-1]" />
                            ) : p.photoURL && p.photoURL !== "undefined" && (
                               <img src={getImageUrl(p.photoURL)} referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover z-0 scale-x-[-1]" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent z-0" />
                            <div className="relative z-10 flex flex-col items-center justify-start w-full p-2 h-full gap-1">
                              <span className="text-[8px] text-red-300 font-bold uppercase truncate w-full text-center">{p.pseudo || 'Joueur'}</span>
                              {p.fanz && (
                                <span className="bg-black/80 px-1.5 py-0.5 rounded border border-white/10 text-[8px] font-black text-white drop-shadow-md">
                                  Niv. {p.fanz.ferveurLevel || p.fanz.level || 1}
                                </span>
                              )}
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
                  </div>
                )}

                {inviteCode && (!invitedUids || invitedUids.length === 0) && (
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
                <span className={`text-lg font-black italic uppercase text-center leading-tight ${progress > 50 ? colorA.text : 'text-white/80'}`}>{duel.teamA}</span>
              </div>
              <div className="flex flex-col items-center px-2">
                <span className="font-black text-4xl drop-shadow-md">{matchDetails.goals.home ?? 0} - {matchDetails.goals.away ?? 0}</span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1">
                  {matchDetails.fixture.status.elapsed ? `${matchDetails.fixture.status.elapsed}${matchDetails.fixture.status.extra ? `+${matchDetails.fixture.status.extra}` : ''}'` : matchDetails.fixture.status.short}
                </span>
              </div>
              <div className="flex flex-col items-center gap-2 flex-1">
                <img src={matchDetails.teams.away.logo} alt={matchDetails.teams.away.name} className="w-12 h-12 object-contain drop-shadow-lg" />
                <span className={`text-lg font-black italic uppercase text-center leading-tight ${progress < 50 ? colorB.text : 'text-white/80'}`}>{duel.teamB}</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-center w-full px-4 text-2xl font-black italic uppercase">
              <span className={`text-center flex-1 leading-tight ${progress > 50 ? colorA.text : 'text-white/80'}`}>{duel.teamA}</span>
              <span className="text-gray-500 px-4 text-sm">VS</span>
              <span className={`text-center flex-1 leading-tight ${progress < 50 ? colorB.text : 'text-white/80'}`}>{duel.teamB}</span>
            </div>
          )}
        </div>

        {/* Tug of War Bar */}
        <div className={`w-full max-w-2xl relative h-8 ${colorB.bg} rounded-full border-2 border-white/20 overflow-hidden transition-opacity duration-500 ${isScoreHidden ? 'opacity-0' : 'opacity-100'} ${colorB.shadow}`}>
          {/* Center line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-white/50 z-10" />
          
          {/* Progress bar */}
          <motion.div 
            animate={{ width: `${progress}%` }}
            className={`h-full ${colorA.bg} ${colorA.shadow}`}
          />

          {/* Rope indicator */}
          <motion.div 
            animate={{ left: `${progress}%` }}
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-12 h-12 bg-white rounded-full flex items-center justify-center border-4 z-20 ${progress > 50 ? colorA.border : colorB.border}`}
          >
            <div className={`absolute inset-0 rounded-full bg-gradient-to-r ${colorA.lg} ${colorB.to} opacity-20`} />
            <Swords className={progress >= 50 ? colorA.text : colorB.text} size={24} />
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
            disabled={!!winner || isButtonFrozen || isStunned}
            animate={{ 
              x: buttonPosition.x, 
              y: buttonPosition.y,
              scale: isButtonShrunk ? 0.5 : isButtonHidden ? 0 : 1,
              opacity: isButtonHidden ? 0 : 1,
              filter: isButtonFrozen ? 'hue-rotate(180deg) brightness(1.2)' : isStunned ? 'brightness(0.6) blur(1px)' : 'none'
            }}
            className={`w-40 h-40 sm:w-48 sm:h-48 rounded-full border-8 border-white/10 shadow-2xl flex flex-col items-center justify-center transition-transform active:scale-95 disabled:opacity-50 relative z-10 ${isButtonFrozen ? 'bg-blue-400' : isStunned ? 'bg-red-900 border-red-500' : isHeavyBallPower ? 'bg-orange-850 hover:bg-orange-900 border-yellow-400 animate-pulse' : 'bg-orange-600 hover:bg-orange-700'}`}
          >
            {isButtonFrozen ? (
              <>
                <Snowflake className="w-12 h-12 text-white animate-pulse" />
                <span className="font-black italic text-xl uppercase mt-2">GELÉ !</span>
              </>
            ) : isStunned ? (
              <>
                <span className="text-3xl animate-spin" style={{ animationDuration: '3s' }}>😵</span>
                <span className="font-black italic text-sm uppercase mt-2 text-red-400">ASSOMMÉ !</span>
              </>
            ) : (
              <>
                <span className="font-black italic text-2xl uppercase">Cliquer</span>
                <span className="text-xs uppercase font-bold opacity-70">
                  {isHeavyBallPower ? 'Ferveur +0.9%' : 'Ferveur +0.5%'}
                </span>
                {isHeavyBallPower && <span className="text-[9px] font-bold text-yellow-400 animate-pulse mt-1">🎈 BALLON LOURD</span>}
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
          {(isImmune || (user.antiMalusMatches || 0) > 0) && <div className="flex items-center gap-1 text-[10px] font-bold text-green-400 uppercase">🛡️ Immunisé{(user.antiMalusMatches || 0) > 0 ? ' (Boost)' : ''}</div>}
          {isCriticalStrike && <div className="flex items-center gap-1 text-[10px] font-bold text-orange-500 uppercase">💥 Coup Critique</div>}
          {isMomentum && <div className="flex items-center gap-1 text-[10px] font-bold text-blue-300 uppercase">💨 Momentum</div>}
          {isStunned && <div className="flex items-center gap-1 text-[10px] font-bold text-red-500 uppercase animate-pulse">😵 Assommé</div>}
          {isHeavyBallPower && <div className="flex items-center gap-1 text-[10px] font-bold text-yellow-400 uppercase animate-pulse">⚽ Ballon Lourd</div>}
          {isIntimidated && <div className="flex items-center gap-1 text-[10px] font-bold text-purple-400 uppercase animate-pulse">🥁 Intimidé</div>}
          {isWallOfShieldsActive && <div className="flex items-center gap-1 text-[10px] font-bold text-blue-400 uppercase animate-pulse">🛡️ Mur d'Écharpes</div>}
          {isOdinClappingActive && <div className="flex items-center gap-1 text-[10px] font-bold text-yellow-500 uppercase animate-pulse">👏 Clapping Odin (+{odinClickBonus.toFixed(1)} Pwr)</div>}
          {isEnemyOdinClappingActive && <div className="flex items-center gap-1 text-[10px] font-bold text-red-500 uppercase animate-pulse">👏 Clapping Ennemi</div>}
          {isDeafened && <div className="flex items-center gap-1 text-[10px] font-bold text-red-400 uppercase animate-pulse">🔇 Assourdi (Bloqué)</div>}
          {isParrotTauntActive && <div className="flex items-center gap-1 text-[10px] font-bold text-green-400 uppercase animate-pulse">🦜 Perroquet (Provoc)</div>}
          {isEnemyParrotTauntActive && <div className="flex items-center gap-1 text-[10px] font-bold text-red-400 uppercase animate-pulse">🦜 Perroquet Ennemi</div>}
          {isBlind && <div className="flex items-center gap-1 text-[10px] font-bold text-orange-500 uppercase animate-pulse">🎃 Aveuglé (Citrouille)</div>}
          {isEnemyBlind && <div className="flex items-center gap-1 text-[10px] font-bold text-red-400 uppercase">🎃 Ennemi Aveuglé</div>}
          {isLockerRoomCursed && <div className="flex items-center gap-1 text-[10px] font-bold text-purple-400 uppercase animate-pulse">❓ Peur au Ventre</div>}
          {hasLockerRoomCurseTrap && <div className="flex items-center gap-1 text-[10px] font-bold text-purple-500 uppercase">🪤 Piège Vestiaires</div>}
          {isLuminescentStandardActive && <div className="flex items-center gap-1 text-[10px] font-bold text-yellow-400 uppercase animate-pulse">✨ Étendard Actif (Immunisé)</div>}
          {isEnemyLuminescentStandardActive && <div className="flex items-center gap-1 text-[10px] font-bold text-red-400 uppercase">✨ Étendard Ennemi</div>}
          {isTifoHolographiqueActive && <div className="flex items-center gap-1 text-[10px] font-bold text-cyan-400 uppercase animate-pulse"><Shield size={12} /> Tifo Holographique</div>}
          {isEnemyTifoHolographiqueActive && <div className="flex items-center gap-1 text-[10px] font-bold text-red-400 uppercase">🤖 Tifo Laser Ennemi</div>}
          {isCapoMegaphoneActive && <div className="flex items-center gap-1 text-[10px] font-bold text-yellow-500 uppercase animate-bounce">📢 Mégaphone du Capo</div>}
          {isEnemyCapoMegaphoneActive && <div className="flex items-center gap-1 text-[10px] font-bold text-red-500 uppercase animate-pulse">📢 Capo Mégaphone Ennemi</div>}
          {isCraquageMassifActive && <div className="flex items-center gap-1 text-[10px] font-bold text-red-500 uppercase animate-pulse">🔥 Fumi actifs (Inciblable)</div>}
          {isEnemyCraquageMassifActive && <div className="flex items-center gap-1 text-[10px] font-bold text-red-600 uppercase">🔥 Fumi Ennemis Actifs</div>}
          {isHalfHalfScarfActive && <div className="flex items-center gap-1 text-[10px] font-bold text-teal-400 uppercase animate-pulse">🧣 Écharpe Half-Half</div>}
          {isMegaphoneEchoActive && <div className="flex items-center gap-1 text-[10px] font-bold text-yellow-400 uppercase animate-pulse">📢 Écho du Mégaphone</div>}
          {(isEarlyCraquageActive || isEnemyEarlyCraquageActive) && <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase animate-pulse">🌫️ Craquage Précoce (Brouillard)</div>}
          {isLaserRelaunchActive && <div className="flex items-center gap-1 text-[10px] font-bold text-yellow-300 uppercase animate-pulse">⚡ Relance Laser Active !</div>}
          {isEnemyLaserRelaunchActive && <div className="flex items-center gap-1 text-[10px] font-bold text-red-300 uppercase animate-pulse">⚡ Relance Laser Ennemie</div>}
          {isMentalMainCouranteActive && <div className="flex items-center gap-1 text-[10px] font-bold text-green-400 uppercase animate-pulse">🛡️ Mental de la Main Courante</div>}
          {isEnemyMentalMainCouranteActive && <div className="flex items-center gap-1 text-[10px] font-bold text-green-600 uppercase">🛡️ Mental Main Courante Ennemi</div>}
          {isHeritageWeightActive && <div className="flex items-center gap-1 text-[10px] font-bold text-red-400 uppercase animate-pulse">👴 Nostalgie (Héritage)</div>}
          {isEnemyHeritageWeightActive && <div className="flex items-center gap-1 text-[10px] font-bold text-red-600 uppercase">👴 Nostalgie Ennemie</div>}
          {isBuvetteAlertActive && <div className="flex items-center gap-1 text-[10px] font-bold text-yellow-400 uppercase animate-pulse">🌭 Alerte Buvette !</div>}
          {isTikTokHighlightActive && <div className="flex items-center gap-1 text-[10px] font-bold text-purple-400 uppercase animate-pulse">📱 Highlight TikTok Prêt !</div>}
          {isEnemyTikTokHighlightActive && <div className="flex items-center gap-1 text-[10px] font-bold text-purple-600 uppercase">📱 Highlight TikTok Ennemi</div>}
          {isPrimeGoatActive && <div className="flex items-center gap-1 text-[10px] font-bold text-yellow-400 uppercase animate-pulse">✨ Prime G.O.A.T Activé !</div>}
          {isEnemyPrimeGoatActive && <div className="flex items-center gap-1 text-[10px] font-bold text-yellow-600 uppercase">✨ Prime G.O.A.T Ennemi</div>}
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

        <AnimatePresence>
          {isBuvetteAlertActive && !hasConsumedBuvette && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: -15 }}
              className="absolute bottom-[180px] left-1/2 -translate-x-1/2 z-50 w-full max-w-xs px-4"
            >
              <div className="bg-yellow-950/95 border-2 border-yellow-400 p-3.5 rounded-2xl shadow-[0_0_25px_rgba(234,179,8,0.65)] w-full text-center backdrop-blur-md flex flex-col items-center gap-2">
                <div className="flex items-center gap-1.5 flex-nowrap">
                  <span className="text-xl animate-bounce">🌭</span>
                  <span className="text-sm font-black text-yellow-300 uppercase tracking-wider">Alerte Buvette Tactique</span>
                  <span className="text-xl animate-bounce">🍺</span>
                </div>
                <p className="text-[11px] text-gray-200 leading-relaxed font-semibold">Les merguez sont cuites ! Souhaitez-vous passer votre tour pour récupérer de l'énergie et de la ferveur ?</p>
                
                <button
                  onClick={() => {
                    setHasConsumedBuvette(true);
                    
                    const actualTeam = myTeamRef.current || 'A';
                    const targetFervorDelta = actualTeam === 'A' ? 12 : -12;
                    setProgress(prev => Math.min(100, Math.max(0, prev + targetFervorDelta)));
                    
                    setExcitement(prev => Math.min(10, prev + 3));
                    
                    addFloatingEffect("🌭 Merguez & Frites savourées ! +3 Énergie / +12% Ferveur !", window.innerWidth / 2, window.innerHeight / 2, "text-yellow-400 font-extrabold scale-110 py-1.5 px-3 border-2 border-yellow-400 rounded-lg bg-slate-900 shadow-[0_0_15px_yellow] z-[300]");
                    
                    if (duel.type === 'training') {
                      setTimeout(() => {
                        if (Math.random() < 0.45) {
                          const botAddition = actualTeam === 'A' ? -12 : 12;
                          setProgress(p => Math.min(100, Math.max(0, p + botAddition)));
                          addFloatingEffect("🤖 Le Bot s'est aussi arrêté à la Buvette ! (+12% Ferveur Bot)", window.innerWidth / 2, 220, "text-red-300 font-bold");
                        }
                      }, 2500);
                    }
                  }}
                  className="w-full mt-1 py-2.5 rounded-xl bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-600 text-white font-extrabold text-xs shadow-md border border-yellow-300 hover:from-yellow-400 hover:to-orange-500 hover:scale-[1.03] transition-transform flex items-center justify-center gap-1 uppercase pointer-events-auto"
                >
                  🥤 Aller à la Buvette (+3⚡ / +12% Ferv)
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cards Hand */}
        <div className="flex gap-1.5 sm:gap-2 justify-center w-full px-1 sm:px-2 shrink-0">
          <AnimatePresence>
            {hand.map((card, index) => {
              const userCard = fanz?.cardProgress?.[card.id] || { level: 1, xp: 0 };
              const xpForNextLevel = userCard.level * 10;
              const xpProgress = (userCard.xp / xpForNextLevel) * 100;
              const actualCost = card.energyCost > 10 ? Math.max(1, Math.round(card.energyCost / 10)) : card.energyCost;

              const standardIndex = hand.findIndex(c => c.id === 'base_luminescent_standard');
              const isAdjacentToStandard = standardIndex !== -1 && Math.abs(standardIndex - index) === 1;

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
                  className={`flex-1 max-w-[85px] h-[115px] sm:h-[135px] rounded-lg border-2 flex flex-col cursor-pointer transition-all relative overflow-hidden ${
                    isTradingStickers 
                      ? (selectedStickers.includes(card.instanceId || card.id) ? 'border-blue-500 shadow-[0_0_15px_blue] scale-110 z-20' : 'border-gray-600')
                      : (isAdjacentToStandard 
                          ? 'border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.7)] scale-100 bg-yellow-400/5'
                          : (excitement >= actualCost ? 'border-yellow-500 bg-yellow-600/10 scale-100 hover:scale-105' : 'border-gray-600 scale-95 hover:scale-100'))
                  }`}
                >
                  {isAdjacentToStandard && (
                    <div className="absolute top-0 right-0 bg-yellow-500 text-yellow-950 font-black text-[7px] px-1 rounded-bl border-l border-b border-yellow-400/50 animate-pulse z-10 leading-normal">
                      🛡️ IMMUNISÉ
                    </div>
                  )}
                  {/* Overlay for unplayable state */}
                  {(!isTradingStickers && excitement < actualCost) && (
                    <div className="absolute inset-0 bg-black/60 z-10 pointer-events-none" />
                  )}
                  {/* Overlay for sleep (Couvre-Feu Biologique) state */}
                  {(!isTradingStickers && lockedCardInstanceIds.includes(card.instanceId || card.id)) && (
                    <div className="absolute inset-0 bg-purple-950/85 z-20 flex flex-col items-center justify-center text-center p-1 pointer-events-none">
                      <span className="text-lg animate-bounce">😴</span>
                      <span className="text-[8px] font-black text-purple-300 uppercase mt-0.5 leading-none shadow-sm">ENGAGÉE</span>
                      <span className="text-[6px] text-purple-400 font-bold leading-normal">COUVRE-FEU</span>
                    </div>
                  )}
                  {/* Background Image */}
                  {card.imageUrl && (
                    <img 
                      src={getImageUrl(card.imageUrl)} 
                      alt={card.name} 
                      className="absolute inset-0 w-full h-full object-cover z-0" data-viewer-ignore="true"
                      referrerPolicy="no-referrer"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                  {/* Gradient Overlay for readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-0" />

                  {/* Card Content */}
                  <div className="relative z-10 flex flex-col h-full p-1 sm:p-2 border-box">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex-1" />
                      <div className="flex items-center gap-0.5 text-[10px] items-center justify-center font-black text-white bg-black/50 border-orange-500 border rounded-full px-1 py-0.5 drop-shadow-md leading-none h-[18px]">
                        ⚡ {actualCost}
                      </div>
                    </div>
                    
                    <div className="flex-1" />
                    
                    <div className="mt-1 flex items-center gap-1">
                      <div className="text-[10px] font-black text-yellow-500 uppercase drop-shadow-md leading-none w-3 text-center">
                        {userCard.level}
                      </div>
                      <div className="flex-1 h-1.5 bg-black/50 border border-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(xpProgress, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-1 pt-0.5 text-center font-black text-orange-400 drop-shadow-md bg-black/80 rounded px-1 min-h-[16px] flex flex-col justify-center">
                      {(card.effects || []).map((e, index) => (
                        <div key={index} className="text-[7px] md:text-[8px] uppercase truncate leading-none py-0.5">
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
            {(duelResult.videoUrl || duelResult.imageUrl) && !showDuelResultDetails ? (
              <div className="absolute inset-0 w-full h-full">
                {duelResult.videoUrl && !user.dataSaver ? (
                  <video src={duelResult.videoUrl} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover" />
                ) : duelResult.imageUrl ? (
                  <img src={duelResult.imageUrl!} className="absolute inset-0 w-full h-full object-cover" />
                ) : null}
                {/* Color filter overlay for win/loss if it is fallback video */}
                <div className={`absolute inset-0 mix-blend-color ${duelResult.isWin ? 'bg-blue-500/30' : 'bg-red-500/30'}`} />
                <div className={`absolute inset-0 bg-gradient-to-t ${duelResult.isWin ? 'from-blue-900/80' : 'from-red-900/80'} to-transparent`} />
                <div className="absolute inset-0 flex items-center justify-center">
                   <h2 className={`text-6xl md:text-8xl font-black uppercase italic tracking-widest ${duelResult.isWin ? 'text-blue-400 drop-shadow-[0_0_20px_rgba(59,130,246,0.8)]' : 'text-red-400 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]'}`}>
                     {duelResult.isWin ? 'VICTOIRE' : 'DÉFAITE'}
                   </h2>
                </div>
              </div>
            ) : (
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className={`bg-gray-900 border-2 rounded-3xl p-8 max-w-sm w-full text-center relative overflow-hidden ${duelResult.isWin ? 'border-blue-500 shadow-[0_0_50px_rgba(59,130,246,0.3)]' : 'border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.3)]'}`}
            >
              {duelResult.videoUrl && !user.dataSaver ? (
                <div className="absolute inset-0 z-0">
                  <video src={duelResult.videoUrl} autoPlay muted loop playsInline className="w-full h-full object-cover opacity-30" />
                  <div className={`absolute inset-0 bg-gradient-to-t ${duelResult.isWin ? 'from-blue-900/80 via-black/60' : 'from-red-900/80 via-black/60'} to-transparent`} />
                </div>
              ) : duelResult.imageUrl && (
                <div className="absolute inset-0 z-0">
                  <img src={duelResult.imageUrl} className="w-full h-full object-cover opacity-30" />
                  <div className={`absolute inset-0 bg-gradient-to-t ${duelResult.isWin ? 'from-blue-900/80 via-black/60' : 'from-red-900/80 via-black/60'} to-transparent`} />
                </div>
              )}
              
              <div className="relative z-10">
                <h2 className={`text-5xl font-black italic uppercase mb-2 ${duelResult.winner === (myTeam || participants.find(p => p.uid === user.uid)?.team || 'A') ? 'text-orange-500' : 'text-gray-500'}`}>
                  {duelResult.winner === (myTeam || participants.find(p => p.uid === user.uid)?.team || 'A') ? 'Victoire !' : 'Défaite'}
                </h2>
                
                <div className="space-y-4 my-8">
                {duelResult.details?.isForfeit && duelResult.isWin ? (
                  <div className="bg-green-500/10 rounded-xl p-3 border border-green-500/20 mb-4 flex flex-col gap-1">
                    <p className="text-xs text-green-400 font-bold uppercase">Victoire par forfait !</p>
                    <p className="text-[10px] text-green-400/80 mb-1">Les adversaires ont quitté. Les équipes ne marquent pas de point.</p>
                    <p className="text-[10px] text-green-400/90 font-bold">✓ Mise de départ remboursée (Argent & Énergie)</p>
                    <p className="text-[10px] text-green-400/90 font-bold">✓ +5 XP de participation</p>
                  </div>
                ) : duelResult.details?.isForfeit && !duelResult.isWin ? (
                  <div className="bg-red-500/10 rounded-xl p-3 border border-red-500/20 mb-4">
                    <p className="text-xs text-red-400 font-bold">Défaite par forfait</p>
                    <p className="text-[10px] text-red-400/80 mt-1">Équipe déconnectée. Mise et points perdus.</p>
                  </div>
                ) : duel.type === 'training' ? (
                  <div className="bg-green-500/10 rounded-xl p-3 border border-green-500/20 mb-4 text-left">
                    <p className="text-xs text-green-400 font-bold uppercase">Entraînement terminé !</p>
                    <p className="text-[10px] text-green-400/80 mt-1">
                      {duelResult.isBotMatch 
                        ? "Entraînement réussi contre le bot. Vous gagnez 5 XP d'entraînement !" 
                        : "Duel d'entraînement amical terminé !"}
                    </p>
                  </div>
                ) : duelResult.isBotMatch && (
                  <div className="bg-orange-500/10 rounded-xl p-3 border border-orange-500/20 mb-4 text-left">
                    <p className="text-xs text-orange-400 font-bold">Match contre des Bots</p>
                    <p className="text-[10px] text-orange-400/80 mt-1">Les statistiques et l'XP ne sont pas enregistrées.</p>
                  </div>
                )}
                
                {(!duelResult.isBotMatch || duel.type === 'training' || (duelResult.details?.isForfeit && duelResult.isWin)) && (
                  <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                    <p className="text-sm text-gray-400 font-bold uppercase mb-1">Gains du Fanz</p>
                    <p className="text-3xl font-black text-yellow-400">+{duelResult.ferveurGain} XP</p>
                  </div>
                )}
                
                {!duelResult.isBotMatch && duelResult.teamGain > 0 && (
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
            </div>
            </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Played Card Animation */}
      <AnimatePresence>
        {playedCardAnim && (
          <motion.div
            key={playedCardAnim.id}
            initial={{ scale: 0.5, y: 100, opacity: 0, rotate: -10 }}
            animate={{ scale: 1, y: 0, opacity: 1, rotate: 0 }}
            exit={{ scale: 1.5, opacity: 0, filter: 'blur(10px)' }}
            transition={{ type: 'spring', damping: 15, stiffness: 200 }}
            className="absolute inset-0 z-[90] flex flex-col items-center justify-center pointer-events-none"
          >
            {(() => {
              const borderColors: any = {
                common: 'border-gray-500 shadow-[0_0_30px_rgba(107,114,128,0.8)]',
                rare: 'border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.8)]',
                epic: 'border-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.8)]',
                legendary: 'border-yellow-400 shadow-[0_0_50px_rgba(250,204,21,1)]',
              };
              const borderColor = borderColors[playedCardAnim.card.rarity] || borderColors.common;
              const energy = playedCardAnim.card.energyCost;

              return (
                <>
                  <div className={`relative w-[200px] h-[300px] md:w-[240px] md:h-[360px] rounded-2xl border-4 ${borderColor} overflow-hidden bg-black`}>
                    {playedCardAnim.card.videoUrl && playedCardAnim.card.videoUrl !== "undefined" && !user.dataSaver ? (
                      <video src={getOptimizedVideoUrl(playedCardAnim.card.videoUrl)} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover z-0" data-viewer-ignore="true" />
                    ) : playedCardAnim.card.imageUrl && playedCardAnim.card.imageUrl !== "undefined" && (
                      <img 
                        src={getImageUrl(playedCardAnim.card.imageUrl)} 
                        alt={playedCardAnim.card.name} 
                        className="absolute inset-0 w-full h-full object-cover z-0" data-viewer-ignore="true"
                        referrerPolicy="no-referrer"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-0 opacity-80" />
                    
                    {/* Top left Energy */}
                    <div className="absolute top-3 left-3 z-10 flex items-center justify-center w-12 h-12 bg-black/80 rounded-full border-2 border-yellow-500 shadow-lg backdrop-blur-sm">
                      <Zap className="absolute inset-0 w-full h-full text-yellow-500 opacity-20 p-2" />
                      <span className="font-black italic text-xl text-yellow-400 drop-shadow-md z-10">{energy}</span>
                    </div>
                  </div>
                  <div className="mt-4 text-center px-4 w-[250px] md:w-[350px]">
                    <h3 className="text-white font-black italic uppercase text-2xl md:text-3xl leading-tight drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] break-words" style={{ WebkitTextStroke: '1.5px black' }}>
                      {playedCardAnim.card.name}
                    </h3>
                  </div>
                </>
              );
            })()}
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
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
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
                  {(status === 'waiting' || status === 'room_full')
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
                {(status === 'waiting' || status === 'room_full') && (
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

      {/* Le Débat Stérile sur les Réseaux Picker Modal */}
      <AnimatePresence>
        {isDebatePickerOpen && (
          <div className="absolute inset-0 bg-black/90 space-y-4 z-50 flex flex-col justify-center items-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-[380px] bg-indigo-950/25 border-2 border-indigo-600/60 rounded-xl p-5 flex flex-col items-center gap-4 shadow-[0_0_25px_rgba(79,70,229,0.35)] relative overflow-hidden text-center"
            >
              <div className="text-4xl animate-bounce">💬</div>
              <h3 className="text-lg font-black text-indigo-400 tracking-wider uppercase">
                LE DÉBAT STÉRILE SUR LES RÉSEAUX
              </h3>
              <p className="text-xs text-indigo-200/90 leading-relaxed">
                Le match s'arrête pour un clash de <strong>"Ratio"</strong>. Choisissez une carte de votre main à parier secrètement. 
                <br />
                Si son coût est supérieur ou égal au coût de la carte adverse, vous la gardez. Sinon, elle est <strong>défaussée</strong> !
              </p>

              <div className="w-full max-h-[200px] overflow-y-auto scrollbar-thin pr-1 flex flex-col gap-2 my-2">
                {hand.length === 0 ? (
                  <p className="text-xs text-slate-400">Aucune carte en main à parier...</p>
                ) : (
                  hand.map((card, index) => {
                    return (
                      <button
                        key={card.instanceId || card.id || index}
                        onClick={() => {
                          const opponentCost = Math.floor(Math.random() * 4) + 1; // opponent card cost (1 - 4)
                          const myCost = card.energyCost || 0;
                          
                          if (myCost >= opponentCost) {
                            addFloatingEffect(`📈 Ratio Réussi ! (Toi: ${myCost}⚡ vs Adversaire: ${opponentCost}⚡) Carte préservée !`, window.innerWidth / 2, window.innerHeight / 2 - 40, "text-green-400 font-extrabold bg-slate-900 border-2 border-green-500 rounded-lg py-1.5 px-3 shadow-[0_0_15px_rgba(34,197,94,0.4)] z-[300]");
                          } else {
                            // Discard selected card
                            setHand(prev => prev.filter(c => (c.instanceId || c.id) !== (card.instanceId || card.id)));
                            setTimeout(drawCard, 2000);
                            addFloatingEffect(`📉 Ratio Échoué ! (Toi: ${myCost}⚡ vs Adversaire: ${opponentCost}⚡) Carte défaussée !`, window.innerWidth / 2, window.innerHeight / 2 - 40, "text-red-400 font-extrabold bg-slate-900 border-2 border-red-500 rounded-lg py-1.5 px-3 shadow-[0_0_15px_rgba(239,68,68,0.4)] z-[300]");
                          }
                          setIsDebatePickerOpen(false);
                        }}
                        className="w-full flex items-center justify-between p-2.5 rounded-lg bg-indigo-900/30 border border-indigo-500/20 hover:bg-indigo-900/50 hover:border-indigo-400 transition-colors text-left font-sans"
                      >
                        <span className="text-xs font-bold text-white truncate max-w-[200px]">{card.name}</span>
                        <span className="text-xs font-black text-indigo-300 shrink-0">{card.energyCost || 0} ⚡</span>
                      </button>
                    );
                  })
                )}
              </div>

              <button
                onClick={() => setIsDebatePickerOpen(false)}
                className="text-xs text-slate-400 hover:text-white transition-colors underline"
              >
                Fermer sans parier
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Grimoire des Chants Oubliés Picker Modal */}
      <AnimatePresence>
        {isGrimoirePickerOpen && (
          <div className="absolute inset-0 bg-black/90 z-50 flex flex-col justify-center items-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-[380px] bg-amber-950/25 border-2 border-amber-600/60 rounded-xl p-5 flex flex-col items-center gap-4 shadow-[0_0_25px_rgba(217,119,6,0.35)] relative overflow-hidden text-center"
            >
              {/* Background magic particles */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(217,119,6,0.1),transparent_70%)] pointer-events-none" />
              <div className="absolute -top-12 -left-12 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
              <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />

              <div className="text-4xl animate-bounce">📖</div>
              <h3 className="text-lg font-black text-amber-400 tracking-wider uppercase">
                GRIMOIRE DES CHANTS OUBLIÉS
              </h3>
              <p className="text-xs text-amber-200/70">
                Choisissez une carte Chant ou Sort de votre défausse à rajouter dans votre main :
              </p>

              <div className="w-full max-h-[180px] overflow-y-auto scrollbar-thin scrollbar-thumb-amber-800 pr-1 flex flex-col gap-2 my-2">
                {grimoireEligibleCards.map((card) => {
                  return (
                    <button
                      key={card.id + '_' + Math.random()}
                      onClick={() => {
                        setHand(prev => {
                          if (prev.length >= 5) {
                            addFloatingEffect("⚠️ Main pleine (max 5 cartes) !", window.innerWidth / 2, 200, "text-red-400 font-bold");
                            return prev;
                          }
                          return [...prev, { ...card, instanceId: Math.random().toString(36).substr(2, 9) }];
                        });
                        setIsGrimoirePickerOpen(false);
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 border border-amber-600/30 hover:border-amber-500/60 text-left transition-colors cursor-pointer group pointer-events-auto"
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-amber-300 group-hover:text-amber-200 transition-colors">
                          {card.name}
                        </span>
                        <span className="text-[9px] text-amber-200/50 uppercase font-semibold">
                          {card.category} • Coût: {card.energyCost}⚡
                        </span>
                      </div>
                      <span className="text-xs text-amber-400 font-extrabold group-hover:translate-x-1 transition-transform">
                        Récupérer ➜
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setIsGrimoirePickerOpen(false)}
                className="px-4 py-1.5 rounded bg-zinc-850 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-650 text-[11px] font-bold text-zinc-300 tracking-wider uppercase transition-colors pointer-events-auto"
              >
                Fermer
              </button>
            </motion.div>
          </div>
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
