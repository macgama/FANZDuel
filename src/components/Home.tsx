import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { UserProfile, Fanz, FanzTemplate, LifeAction, GlobalFervorConfig } from '../types';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, getDoc, doc, getDocs, limit } from 'firebase/firestore';
import { getImageUrl } from '../lib/utils';
import { footballApi } from '../services/footballApi';
import { LifeActionCard } from './LifeActionCard';
import { generateFervorPath } from '../utils/fervorPath';
import { 
  Trophy, 
  Activity, 
  Users, 
  Flame, 
  ArrowRight, 
  ChevronLeft, 
  ChevronRight,
  Zap,
  Calendar,
  Store,
  Target,
  Ticket,
  Star,
  Swords
} from 'lucide-react';
import { OptimizedMedia } from './OptimizedMedia';
import { motion, AnimatePresence } from 'motion/react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

import { UserProfileModal } from './UserProfileModal';
import { Header } from './Header';

interface HomeProps {
  profile: UserProfile;
  onNavigate: (view: 'home' | 'admin' | 'matches' | 'competitions' | 'teams' | 'fanz' | 'transactions' | 'social' | 'fervor-path' | 'shop' | 'missions' | 'pass' | 'favorite-teams' | 'waiting-room') => void;
  onMenuClick: () => void;
  onMatchClick: (matchId: number) => void;
  onJoinDuel: (matchId: number, isLive: boolean) => void;
  onOpenStreak: () => void;
}

export function Home({ profile, onNavigate, onMenuClick, onMatchClick, onJoinDuel, onOpenStreak }: HomeProps) {
  const [activeFanz, setActiveFanz] = useState<Fanz | null>(null);
  const [allFanz, setAllFanz] = useState<Fanz[]>([]);
  const [fanzTemplate, setFanzTemplate] = useState<FanzTemplate | null>(null);
  const [liveMatches, setLiveMatches] = useState<any[]>([]);
  const [matchScores, setMatchScores] = useState<Record<string, { scoreA: number, scoreB: number }>>({});
  const [lifeActions, setLifeActions] = useState<LifeAction[]>([]);
  const [activeDuels, setActiveDuels] = useState<any[]>([]);
  const [fanzFervorConfig, setFanzFervorConfig] = useState<GlobalFervorConfig | undefined>(undefined);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -scrollContainerRef.current.clientWidth : scrollContainerRef.current.clientWidth;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const currentActiveAction = lifeActions.find(a => a.id === profile.activeAction?.actionId && profile.activeAction?.fanzId === activeFanz?.id);
  const waitingDuelsCount = activeDuels.filter(d => d.status === 'waiting' && d.creatorId !== profile.uid).length;

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const configDoc = await getDoc(doc(db, 'global_configs', 'fanz_fervor'));
        if (configDoc.exists()) {
          setFanzFervorConfig(configDoc.data() as GlobalFervorConfig);
        }
      } catch (err) {
        console.error("Error fetching fanz fervor config", err);
      }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    if (!profile.uid) return;

    const q = query(collection(db, 'fanz'), where('ownerUid', '==', profile.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (!snapshot.empty) {
        const templatesSnap = await getDocs(collection(db, 'fanz_templates'));
        const templatesMap = new Map(templatesSnap.docs.map(d => [d.id, d.data()]));

        const sortedDocs = [...snapshot.docs].sort((a, b) => {
          const dataA = a.data() as Fanz;
          const dataB = b.data() as Fanz;
          if (dataA.equippedSkin && !dataB.equippedSkin) return -1;
          if (!dataA.equippedSkin && dataB.equippedSkin) return 1;
          if ((dataB.level || 0) !== (dataA.level || 0)) return (dataB.level || 0) - (dataA.level || 0);
          if ((dataB.xp || 0) !== (dataA.xp || 0)) return (dataB.xp || 0) - (dataA.xp || 0);
          return a.id.localeCompare(b.id);
        });
        
        setAllFanz(sortedDocs.map(d => {
          const data = d.data() as Fanz;
          const template = templatesMap.get(data.templateId) as any;
          return {
            ...data,
            id: d.id,
            name: data.name || template?.name || 'Unknown Fanz',
            imageUrl: data.imageUrl || template?.image || null,
          };
        }));
      } else {
        setAllFanz([]);
      }
    }, (error) => {
      console.error("Error in Home fanz listener:", error);
    });

    return () => unsubscribe();
  }, [profile.uid]);

  useEffect(() => {
    const updateActiveFanz = async () => {
      if (allFanz.length > 0) {
        const fanzData = profile.activeFanzId 
          ? allFanz.find(f => f.id === profile.activeFanzId) 
          : (allFanz.find(f => f.id === profile.activeAction?.fanzId) || allFanz[0]);

        if (fanzData) {
          setActiveFanz(fanzData);

          if (fanzData.templateId) {
            try {
              const templateDoc = await getDoc(doc(db, 'fanz_templates', fanzData.templateId));
              if (templateDoc.exists()) {
                const templateData = templateDoc.data() as FanzTemplate;
                setFanzTemplate(templateData);
                
                const equippedSkinData = templateData.skins?.find(s => s.id === fanzData.equippedSkin);
                const activeAction = lifeActions.find(a => a.id === profile.activeAction?.actionId && profile.activeAction?.fanzId === fanzData.id);
                
                let currentImageUrl = templateData.image;
                let currentVideoUrl = templateData.video;

                if (fanzData.imageUrl) currentImageUrl = fanzData.imageUrl;
                if (fanzData.videoUrl) currentVideoUrl = fanzData.videoUrl;

                if (equippedSkinData) {
                  currentImageUrl = equippedSkinData.imageUrl || currentImageUrl;
                  currentVideoUrl = equippedSkinData.videoUrl || currentVideoUrl;
                }

                if (activeAction) {
                  currentImageUrl = activeAction.image || currentImageUrl;
                  currentVideoUrl = activeAction.videoUrl || currentVideoUrl;
                }

                const finalVideoUrl = getImageUrl(currentVideoUrl);
                setVideoUrl(finalVideoUrl ? currentVideoUrl : null);
                setImageUrl(currentImageUrl || null);
              }
            } catch (error) {
              console.error("Error fetching template", error);
            }
          }
        }
      } else {
        setActiveFanz(null);
        setFanzTemplate(null);
        setVideoUrl(null);
        setImageUrl(null);
      }
    };

    updateActiveFanz();
  }, [allFanz, profile.activeFanzId, profile.activeAction?.fanzId, profile.activeAction?.actionId, lifeActions]);

  useEffect(() => {
    // Fetch some live matches
    const fetchMatches = async () => {
      try {
        const liveFixtures = await footballApi.getLiveFixtures();
        // Show all live matches
        setLiveMatches(liveFixtures);
        
        // Fetch scores for these matches
        if (liveFixtures.length > 0) {
          const matchIds = liveFixtures.map((m: any) => m.fixture.id.toString());
          const scoresMap: Record<string, { scoreA: number, scoreB: number }> = {};
          
          // Chunk matchIds into arrays of 10
          const chunkSize = 10;
          for (let i = 0; i < matchIds.length; i += chunkSize) {
            const chunk = matchIds.slice(i, i + chunkSize);
            const scoresQuery = query(collection(db, 'match_scores'), where('matchId', 'in', chunk));
            const scoresSnapshot = await getDocs(scoresQuery);
            
            scoresSnapshot.forEach(doc => {
              const data = doc.data();
              if (data.matchId) {
                if (!scoresMap[data.matchId]) {
                  scoresMap[data.matchId] = { scoreA: 0, scoreB: 0 };
                }
                scoresMap[data.matchId].scoreA += data.scoreA || 0;
                scoresMap[data.matchId].scoreB += data.scoreB || 0;
              }
            });
          }
          
          setMatchScores(scoresMap);
        }
      } catch (error) {
        console.error("Error fetching matches", error);
      }
    };
    
    const fetchLifeActions = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'life_actions'));
        const actionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LifeAction));
        setLifeActions(actionsData);
      } catch (error) {
        console.error("Error fetching life actions", error);
      }
    };

    fetchMatches();
    fetchLifeActions();

    const fetchActiveDuels = async () => {
      try {
        const res = await fetch('/api/duels/all');
        if (res.ok) {
          const duelsData = await res.json();
          setActiveDuels(duelsData);
        }
      } catch (err) {
        console.error("Failed to fetch active duels", err);
      }
    };

    fetchActiveDuels();
    const interval = setInterval(fetchActiveDuels, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    signOut(auth);
  };

  return (
    <div className="h-full w-full bg-transparent relative overflow-hidden flex flex-col font-sans text-white">
      
      {/* HEADER */}
      <Header 
        profile={profile} 
        onMenuClick={onMenuClick}
        onHomeClick={() => setShowProfileModal(true)}
        onTransactionsClick={() => onNavigate('transactions')}
        onFervorClick={() => onNavigate('fervor-path')}
        absolute
      />

      {/* Waiting Duels Alert */}
      {waitingDuelsCount > 0 && (
        <div className="absolute top-20 left-4 right-4 z-50">
          <button 
            onClick={() => onNavigate('waiting-room')}
            className="w-full bg-orange-500/90 backdrop-blur-md border border-orange-400 rounded-xl p-3 flex items-center justify-between shadow-lg shadow-orange-500/20 animate-[pulse_2s_ease-in-out_infinite]"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Swords className="w-4 h-4 text-white" />
              </div>
              <div className="text-left">
                <div className="text-xs font-black uppercase tracking-wider text-white">
                  {waitingDuelsCount} {waitingDuelsCount > 1 ? 'Duels en attente' : 'Duel en attente'}
                </div>
                <div className="text-[10px] font-bold text-orange-100">Rejoignez un duel maintenant !</div>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-white" />
          </button>
        </div>
      )}

      {/* BODY: Video Background (4:3) and Content Below */}
      <div className="flex-1 flex flex-col relative overflow-y-auto pb-6 no-scrollbar">
        {/* Video Section (4:3 Aspect Ratio) */}
        <div className="w-full aspect-[4/3] relative shrink-0">
          {videoUrl ? (
            <OptimizedMedia
              type="video"
              src={videoUrl}
              poster={imageUrl || ''}
              dataSaver={profile.dataSaver}
              className="w-full h-full object-cover"
            />
          ) : imageUrl ? (
            <OptimizedMedia
              type="image"
              src={imageUrl}
              alt={activeFanz?.name || 'Mon FANZ'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-900 flex items-center justify-center">
              <p className="text-gray-500 font-bold">Aucun FANZ actif</p>
            </div>
          )}

          {/* Superimposed FANZ Rank (Top Right) - REMOVED AS PER REQUEST */}

          {/* Superimposed FANZ Name (Bottom) */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/50 to-transparent">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter text-white drop-shadow-lg">
                {activeFanz?.name || 'Mon FANZ'}
              </h1>
              {activeFanz && (
                <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center border border-white/20 shadow-lg shrink-0">
                  <span className="text-sm font-black italic text-white">{activeFanz.rank ?? 0}</span>
                </div>
              )}
            </div>

            {currentActiveAction && (
              <div className="flex items-center gap-2 mt-1">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                <p className="text-xs font-black italic uppercase tracking-tighter text-orange-500 drop-shadow-md">
                  {currentActiveAction.name}
                </p>
              </div>
            )}

            {fanzTemplate && (
              <p className="text-xs font-bold text-orange-400 uppercase tracking-widest mt-1">
                {fanzTemplate.rarity}
              </p>
            )}

            {!currentActiveAction && activeFanz && (() => {
              const ferveurPath = fanzFervorConfig 
                ? generateFervorPath(fanzFervorConfig.ranges?.[fanzFervorConfig.ranges.length - 1]?.max || 50000, fanzFervorConfig)
                : fanzTemplate?.ferveurPath || [];
              const nextLevelPoints = ferveurPath.find(l => l.level === activeFanz.ferveurLevel + 1)?.pointsRequired || 1000;
              
              return (
                <div className="mt-2 w-full max-w-[200px]">
                  <div className="h-4 bg-black/60 rounded-full border border-white/10 relative overflow-hidden">
                    <div 
                      className="h-full bg-orange-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (activeFanz.ferveurPoints / nextLevelPoints) * 100)}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] font-black text-white drop-shadow-md">
                        {activeFanz.ferveurPoints} / {nextLevelPoints}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Quick Links */}
        <div className="px-4 sm:px-8 py-6 grid grid-cols-3 sm:grid-cols-6 gap-3 sm:gap-4">
          <button 
            onClick={onOpenStreak}
            className="flex flex-col items-center justify-center gap-2 p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
          >
            <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500" />
            <span className="text-[10px] sm:text-xs font-black uppercase text-center leading-tight">Série</span>
          </button>
          <button 
            onClick={() => onNavigate('fervor-path')}
            className="flex flex-col items-center justify-center gap-2 p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
          >
            <Flame className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500" />
            <span className="text-[10px] sm:text-xs font-black uppercase text-center leading-tight">Ferveur</span>
          </button>
          <button 
            onClick={() => onNavigate('favorite-teams')}
            className="flex flex-col items-center justify-center gap-2 p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
          >
            <Star className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500" />
            <span className="text-[10px] sm:text-xs font-black uppercase text-center leading-tight">Équipes</span>
          </button>
          <button 
            onClick={() => onNavigate('shop')}
            className="flex flex-col items-center justify-center gap-2 p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
          >
            <Store className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500" />
            <span className="text-[10px] sm:text-xs font-black uppercase text-center leading-tight">Shop</span>
          </button>
          <button 
            onClick={() => onNavigate('missions')}
            className="flex flex-col items-center justify-center gap-2 p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
          >
            <Target className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
            <span className="text-[10px] sm:text-xs font-black uppercase text-center leading-tight">Missions</span>
          </button>
          <button 
            onClick={() => onNavigate('pass')}
            className="flex flex-col items-center justify-center gap-2 p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
          >
            <Ticket className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500" />
            <span className="text-[10px] sm:text-xs font-black uppercase text-center leading-tight">Pass</span>
          </button>
        </div>

        {/* Content Below Video (Live Matches or Life Actions) */}
        <div className="flex-1 flex flex-col justify-center py-4">
          {liveMatches.length === 0 && activeFanz && fanzTemplate && (
            <p className="text-center text-gray-400 text-xs font-bold px-6 mb-4">
              Pas de match en direct actuellement, profites-en pour monter tes FANZ en compétences et gagner de l'argent ou de l'énergie !
            </p>
          )}

          {liveMatches.length > 0 && (
            <div className="flex justify-between items-center px-[30px] mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-black uppercase tracking-widest">EN DIRECT ({liveMatches.length})</span>
              </div>
              <button onClick={() => onNavigate('matches')} className="text-[10px] font-black text-orange-500 uppercase flex items-center gap-1 hover:text-orange-400">
                VOIR TOUT <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="relative w-full pb-4">
            {/* Left Scroll Button */}
            <button 
              onClick={() => scroll('left')}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-black/80 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 text-white hover:bg-white/10 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div 
              ref={scrollContainerRef}
              className="w-full overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory scroll-px-[30px]"
            >
              <div className="flex flex-nowrap gap-4 px-[30px] w-fit mx-auto">
                {liveMatches.length > 0 ? (
                liveMatches.map(match => {
                  const matchId = match.fixture.id.toString();
                  const scoreA = matchScores[matchId]?.scoreA || 0;
                  const scoreB = matchScores[matchId]?.scoreB || 0;
                  const totalScore = scoreA + scoreB;
                  const dominanceA = totalScore > 0 ? Math.round((scoreA / totalScore) * 100) : 50;
                  const dominanceB = totalScore > 0 ? Math.round((scoreB / totalScore) * 100) : 50;

                  return (
                  <div key={match.fixture.id} className="snap-center shrink-0 w-[calc(100vw-80px)] max-w-[400px] bg-[#1a1a1a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden group">
                    {/* Header: Country & League */}
                    <div className="flex justify-between items-center text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest">
                      <div className="flex items-center gap-1.5">
                        {match.league?.flag && <img src={match.league.flag} alt="" className="w-4 h-3 object-cover rounded-sm" />}
                        <span>{match.league?.country}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {match.league?.logo && <img src={match.league.logo} alt="" className="w-4 h-4 object-contain" />}
                        <span>{match.league?.name}</span>
                      </div>
                    </div>

                    {/* Teams & Score */}
                    <div className="flex justify-between items-start mt-2">
                      {/* Home Team */}
                      <div className="flex flex-col items-center gap-2 flex-1">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-full p-1.5 flex items-center justify-center">
                          <img src={match.teams.home.logo} alt="" className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
                        </div>
                        <span className="font-black text-xs sm:text-sm text-center uppercase leading-tight h-8 flex items-center">{match.teams.home.name}</span>
                        <div className="bg-orange-500/10 border border-orange-500/20 rounded-full px-2.5 py-1 flex items-center gap-1 mt-1">
                          <Flame className="w-3 h-3 text-orange-500" />
                          <span className="text-[10px] sm:text-xs font-black text-orange-500">{scoreA} PTS</span>
                        </div>
                      </div>

                      {/* Score & Time */}
                      <div className="flex flex-col items-center justify-center px-3 sm:px-4">
                        <div className="text-3xl sm:text-4xl font-black tracking-tighter flex items-center gap-1">
                          <span>{match.goals.home ?? 0}</span>
                          <span className="text-orange-500">:</span>
                          <span>{match.goals.away ?? 0}</span>
                        </div>
                        <div className="mt-2 bg-orange-500/20 border border-orange-500/30 rounded-full px-3 py-1 flex items-center justify-center">
                          <span className="text-[10px] sm:text-xs font-black text-orange-500">{match.fixture.status.elapsed ? `${match.fixture.status.elapsed}${match.fixture.status.extra ? `+${match.fixture.status.extra}` : ''}'` : match.fixture.status.short}</span>
                        </div>
                      </div>

                      {/* Away Team */}
                      <div className="flex flex-col items-center gap-2 flex-1">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-transparent flex items-center justify-center">
                          <img src={match.teams.away.logo} alt="" className="w-10 h-10 sm:w-12 sm:h-12 object-contain" />
                        </div>
                        <span className="font-black text-xs sm:text-sm text-center uppercase leading-tight h-8 flex items-center">{match.teams.away.name}</span>
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-full px-2.5 py-1 flex items-center gap-1 mt-1">
                          <Flame className="w-3 h-3 text-blue-500" />
                          <span className="text-[10px] sm:text-xs font-black text-blue-500">{scoreB} PTS</span>
                        </div>
                      </div>
                    </div>

                    {/* Dominance Bar */}
                    <div className="mt-4">
                      <div className="flex justify-between items-center text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                        <span className="text-orange-500">{dominanceA}%</span>
                        <span>DOMINANCE MONDIALE</span>
                        <span className="text-blue-500">{dominanceB}%</span>
                      </div>
                      <div className="h-2 w-full bg-black/60 rounded-full overflow-hidden flex relative">
                        <div className="h-full bg-orange-500 transition-all duration-500" style={{ width: `${dominanceA}%` }} />
                        <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${dominanceB}%` }} />
                        <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/50 -translate-x-1/2 z-10"></div>
                      </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 mt-4 relative">
                      <button 
                        onClick={(e) => { e.stopPropagation(); console.log("MATCH clicked", match.fixture.id); onMatchClick(match.fixture.id); }}
                        className="flex-1 py-3 rounded-xl border border-white/20 bg-white/5 text-white font-black text-xs uppercase tracking-wider hover:bg-white/10 transition-colors"
                      >
                        MATCH
                      </button>
                      
                      {(() => {
                        const waitingDuel = activeDuels.find(d => d.matchId == match.fixture.id && d.status === 'waiting' && d.creatorId !== profile.uid);
                        const myWaitingDuel = activeDuels.find(d => d.matchId == match.fixture.id && d.status === 'waiting' && d.creatorId === profile.uid);
                        const activeDuel = activeDuels.find(d => d.matchId == match.fixture.id && (d.status === 'active' || d.status === 'starting'));

                        if (waitingDuel) {
                          return (
                            <button 
                              onClick={(e) => { e.stopPropagation(); console.log("REJOINDRE clicked", match.fixture.id); onJoinDuel(match.fixture.id, true); }}
                              className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-black text-xs uppercase tracking-wider hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 relative overflow-hidden"
                            >
                              <div className="absolute inset-0 bg-white/20 animate-pulse" />
                              <Swords className="w-4 h-4 relative z-10" />
                              <span className="relative z-10">REJOINDRE UN DUEL</span>
                            </button>
                          );
                        }
                        
                        if (myWaitingDuel) {
                          return (
                            <button 
                              onClick={(e) => { e.stopPropagation(); console.log("EN ATTENTE clicked", match.fixture.id); onJoinDuel(match.fixture.id, true); }}
                              className="flex-1 py-3 rounded-xl border border-orange-500/50 bg-orange-500/10 text-orange-500 font-black text-xs uppercase tracking-wider hover:bg-orange-500/20 transition-colors flex items-center justify-center gap-2"
                            >
                              <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                              EN ATTENTE...
                            </button>
                          );
                        }

                        if (activeDuel) {
                          return (
                            <button 
                              onClick={(e) => { e.stopPropagation(); console.log("CRÉER clicked", match.fixture.id); onJoinDuel(match.fixture.id, true); }}
                              className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-black text-xs uppercase tracking-wider hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
                            >
                              <Activity className="w-4 h-4 text-white/70" />
                              CRÉER UN DUEL
                            </button>
                          );
                        }

                        return (
                          <button 
                            onClick={(e) => { e.stopPropagation(); console.log("CRÉER clicked", match.fixture.id); onJoinDuel(match.fixture.id, true); }}
                            className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-black text-xs uppercase tracking-wider hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
                          >
                            CRÉER UN DUEL
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                )})
              ) : (
                activeFanz && fanzTemplate ? (
                  lifeActions
                    .filter(action => action.fanzTemplateId === fanzTemplate.id || !action.fanzTemplateId)
                    .map(action => (
                      <div key={action.id} className="snap-center shrink-0 w-[calc(100vw-80px)] max-w-[400px]">
                        <LifeActionCard 
                          action={action} 
                          fanz={activeFanz} 
                          userProfile={profile} 
                        />
                      </div>
                    ))
                ) : (
                  <div className="w-full text-center py-4 text-gray-500 text-xs font-bold uppercase px-[30px]">
                    Aucun match en direct et aucun FANZ actif
                  </div>
                )
              )}
              </div>
            </div>
            
            {/* Right Scroll Button */}
            <button 
              onClick={() => scroll('right')}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-black/80 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 text-white hover:bg-white/10 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {showProfileModal && (
        <UserProfileModal 
          profile={profile} 
          onClose={() => setShowProfileModal(false)} 
        />
      )}
    </div>
  );
}
