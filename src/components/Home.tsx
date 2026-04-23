import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { UserProfile, Fanz, FanzTemplate, LifeAction, GlobalFervorConfig } from '../types';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, getDoc, doc, getDocs, limit, setDoc } from 'firebase/firestore';
import { getImageUrl, cn } from '../lib/utils';
// ... (rest of imports)

// Since getImageUrl handles the logic for converting gs:// to https://thebestfan.online/img/, 
// we just need to ensure it's used consistently for images and videos fetched from Firebase.

// Inside getImageUrl utility, I will add logic to replace gs://thebestfanonlinegas.firebasestorage.app/ with https://thebestfan.online/img/ if it isn't already.
import { footballApi } from '../services/footballApi';
import { MatchEvents } from './MatchEvents';
import { LifeActionCard } from './LifeActionCard';
import { generateFervorPath } from '../utils/fervorPath';
import { translateCountryName, translateLeagueName } from '../utils/countryTranslations';
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
import { MrFanzHelp } from './MrFanzHelp';

interface HomeProps {
  profile: UserProfile;
  onNavigate: (view: 'home' | 'admin' | 'matches' | 'competitions' | 'teams' | 'fanz' | 'transactions' | 'social' | 'fervor-path' | 'shop' | 'missions' | 'pass' | 'favorite-teams' | 'waiting-room') => void;
  onMenuClick: () => void;
  onMatchClick: (matchId: number) => void;
  onLeagueClick?: (leagueId: number, season: number) => void;
  onTeamClick?: (teamId: number, season: number) => void;
  onJoinDuel: (matchId: number, isLive: boolean) => void;
  onOpenStreak: () => void;
  onFanzClick?: (fanzId: string) => void;
}

export function Home({ profile, onNavigate, onMenuClick, onMatchClick, onLeagueClick, onTeamClick, onJoinDuel, onOpenStreak, onFanzClick }: HomeProps) {
  const [activeFanz, setActiveFanz] = useState<Fanz | null>(null);
  const [allFanz, setAllFanz] = useState<Fanz[]>([]);
  const [fanzTemplate, setFanzTemplate] = useState<FanzTemplate | null>(null);
  const [liveMatches, setLiveMatches] = useState<any[]>([]);
  const [matchScores, setMatchScores] = useState<Record<string, { scoreA: number, scoreB: number }>>({});
  const [lifeActions, setLifeActions] = useState<LifeAction[]>([]);
  const [favoriteTeamsInfo, setFavoriteTeamsInfo] = useState<any[]>([]);
  const [activeDuels, setActiveDuels] = useState<any[]>([]);
  const [worldCupStandings, setWorldCupStandings] = useState<any[]>([]);
  const [worldCupFixtures, setWorldCupFixtures] = useState<any[]>([]);
  const [fanzFervorConfig, setFanzFervorConfig] = useState<GlobalFervorConfig | undefined>(undefined);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const worldCupScrollRef = useRef<HTMLDivElement>(null);

  const [hasNewPass, setHasNewPass] = useState(false);
  const [hasClaimableStreak, setHasClaimableStreak] = useState(false);

  const favoriteIds = React.useMemo(() => {
    return profile?.favoriteTeams?.map(id => id.toString()) || [];
  }, [profile?.favoriteTeams]);

  const hasClaimableMissions = Object.values(profile.missionsProgress || {}).some(
    (p: any) => p.isCompleted && !p.isClaimed
  );

  useEffect(() => {
    const fetchBadges = async () => {
      try {
        // Pass Badges
        const qPasses = query(collection(db, 'passes'), where('isActive', '==', true));
        const snapPasses = await getDocs(qPasses);
        const hasNew = snapPasses.docs.some(doc => !profile.purchasedPasses?.includes(doc.id));
        setHasNewPass(hasNew);

        // Streak Badges
        const currentDay = profile.streak || 1;
        const isAlreadyClaimed = profile.claimedStreakDays?.includes(currentDay);
        if (!isAlreadyClaimed) {
          const qStreak = query(collection(db, 'weekly_streak_cycles'), where('isActive', '==', true));
          const snapStreak = await getDocs(qStreak);
          setHasClaimableStreak(!snapStreak.empty);
        } else {
          setHasClaimableStreak(false);
        }
      } catch (err: any) {
        if (err?.message !== 'Failed to fetch') {
          console.error("Error fetching badges:", err);
        }
      }
    };
    if (profile.uid) {
      fetchBadges();
    }
  }, [profile.uid, profile.purchasedPasses, profile.streak, profile.claimedStreakDays]);

  const scroll = (ref: React.RefObject<HTMLDivElement>, direction: 'left' | 'right') => {
    if (ref.current) {
      const scrollAmount = direction === 'left' ? -ref.current.clientWidth : ref.current.clientWidth;
      ref.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const currentActiveAction = lifeActions.find(a => a.id === profile.activeAction?.actionId && profile.activeAction?.fanzId === activeFanz?.id);
  const waitingDuelsCount = activeDuels.filter(d => d.status === 'waiting' && d.creatorId !== profile.uid).length;

  useEffect(() => {
    const fetchWorldCup = async () => {
      try {
        const standingsInfo = await footballApi.getStandings(1, 2026);
        if (standingsInfo && standingsInfo.length > 0 && standingsInfo[0].league && standingsInfo[0].league.standings) {
          setWorldCupStandings(standingsInfo[0].league.standings);
        }
        const fixturesInfo = await footballApi.getFixtures(1, 2026);
        if (fixturesInfo) {
          setWorldCupFixtures(fixturesInfo);
        }
      } catch (err: any) {
        if (err?.message !== 'Failed to fetch') {
          console.error("Error fetching World Cup Data", err);
        }
      }
    };
    fetchWorldCup();
  }, []);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const configDoc = await getDoc(doc(db, 'global_configs', 'fanz_fervor'));
        if (configDoc.exists()) {
          setFanzFervorConfig(configDoc.data() as GlobalFervorConfig);
        }
      } catch (err: any) {
        if (err?.message !== 'Failed to fetch') {
          console.error("Error fetching fanz fervor config", err);
        }
      }
    };
    fetchConfig();
  }, []);

  // Fetch Favorite Teams Details
  useEffect(() => {
    if (!profile.favoriteTeams || profile.favoriteTeams.length === 0) {
      setFavoriteTeamsInfo([]);
      return;
    }

    const fetchFavoriteTeams = async () => {
      try {
        const teams = await Promise.all(
          profile.favoriteTeams!.map(async (id) => {
            const teamIdStr = id.toString();
            // Check Firestore cache first
            try {
              const teamDoc = await getDoc(doc(db, 'api_teams', teamIdStr));
              if (teamDoc.exists()) {
                return teamDoc.data();
              }
            } catch (err) {
              console.error(`Error checking api_teams for ${teamIdStr}`, err);
            }

            // Fallback to API
            try {
              const res = await footballApi.getTeamInfo(Number(id));
              if (res && res.team) {
                // Background cache
                setDoc(doc(db, 'api_teams', teamIdStr), res.team, { merge: true }).catch(() => {});
                return res.team;
              }
            } catch (apiErr) {
              console.error(`Failed to fetch team ${id} from API`, apiErr);
            }
            return { id: Number(id), name: 'Équipe ' + id, logo: '' };
          })
        );
        setFavoriteTeamsInfo(teams.filter(Boolean));
      } catch (err: any) {
        if (err?.message !== 'Failed to fetch') {
          console.error("Error fetching favorite teams info", err);
        }
      }
    };

    fetchFavoriteTeams();
  }, [profile.favoriteTeams]);

  useEffect(() => {
    if (!profile.uid) return;

    const q = query(collection(db, 'fanz'), where('ownerUid', '==', profile.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (!snapshot.empty) {
        const templatesSnap = await getDocs(collection(db, 'fanz_templates'));
        const templatesMap = new Map();
        templatesSnap.docs.forEach(d => {
          const t = d.data() as FanzTemplate;
          if (t.isActive !== false) {
            templatesMap.set(d.id, t);
          }
        });

        const validDocs = [...snapshot.docs].filter(d => {
          const data = d.data() as Fanz;
          return templatesMap.has(data.templateId);
        });

        const sortedDocs = validDocs.sort((a, b) => {
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
          const template = templatesMap.get(data.templateId);
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
            } catch (error: any) {
              if (error?.message !== 'Failed to fetch') {
                console.error("Error fetching template", error);
              }
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
    if (!profile?.uid) return;
    let unsubs: (() => void)[] = [];

    // Fetch some live matches
    const fetchMatches = async () => {
      try {
        const liveFixtures = await footballApi.getLiveFixtures();
        // Show all live matches
        setLiveMatches(liveFixtures);
        
        // Fetch scores for these matches via onSnapshot
        if (liveFixtures.length > 0) {
          const matchIds = liveFixtures.map((m: any) => m.fixture.id.toString());
          
          // Chunk matchIds into arrays of 10
          const chunkSize = 10;
          for (let i = 0; i < matchIds.length; i += chunkSize) {
            const chunk = matchIds.slice(i, i + chunkSize);
            const q = query(collection(db, 'match_scores'), where('matchId', 'in', chunk));
            
            const unsub = onSnapshot(q, (snapshot) => {
              if (!snapshot.empty) {
                console.log(`[Home] Received ${snapshot.size} scores for chunk starting with ${chunk[0]}`);
              }
              setMatchScores(prev => {
                const newMap = { ...prev };
                // Reset/Init scores for the current chunk matches to avoid accumulation bugs on snapshot updates
                chunk.forEach(id => {
                  newMap[id] = { scoreA: 0, scoreB: 0 };
                });
                
                snapshot.forEach(doc => {
                  const data = doc.data();
                  const mIdStr = data.matchId?.toString();
                  if (mIdStr && chunk.includes(mIdStr)) {
                    newMap[mIdStr].scoreA += Number(data.scoreA || 0);
                    newMap[mIdStr].scoreB += Number(data.scoreB || 0);
                  }
                });
                return newMap;
              });
            }, (err: any) => {
              if (err?.code === 'permission-denied' || err?.message?.includes('Missing or insufficient permissions')) {
                console.warn("[Home] Scores listener permission denied, usually due to active sign-out.");
              } else {
                console.error("Error listening to scores on Home:", err);
              }
            });
            unsubs.push(unsub);
          }
        }
      } catch (error: any) {
        if (error?.message !== 'Failed to fetch') {
          console.error("Error fetching matches", error);
        }
      }
    };
    
    const fetchLifeActions = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'life_actions'));
        const actionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LifeAction));
        setLifeActions(actionsData);
      } catch (error: any) {
        if (error?.message !== 'Failed to fetch') {
          console.error("Error fetching life actions", error);
        }
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
      } catch (err: any) {
        if (err?.message !== 'Failed to fetch') {
          console.error("Failed to fetch active duels", err);
        }
      }
    };

    fetchActiveDuels();
    const interval = setInterval(fetchActiveDuels, 5000);

    return () => {
      unsubs.forEach(un => un());
      clearInterval(interval);
    };
  }, []);

  const handleLogout = () => {
    signOut(auth);
  };

  return (
    <div className="h-full w-full max-w-3xl mx-auto bg-transparent relative overflow-hidden flex flex-col font-sans text-white border-x border-white/5 shadow-2xl">
      
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
        <div 
          className="w-full aspect-[4/3] relative shrink-0 cursor-pointer group"
          onClick={() => {
            if (activeFanz?.id) {
              onFanzClick?.(activeFanz.id);
            } else {
              onNavigate('fanz');
            }
          }}
        >
          {videoUrl ? (
            <OptimizedMedia
              type="video"
              src={videoUrl}
              poster={imageUrl || ''}
              dataSaver={profile.dataSaver}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : imageUrl ? (
            <OptimizedMedia
              type="image"
              src={imageUrl}
              alt={activeFanz?.name || 'Mon FANZ'}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-gray-900 flex items-center justify-center transition-transform duration-700 group-hover:scale-105">
              <p className="text-gray-500 font-bold">Aucun FANZ actif</p>
            </div>
          )}

          {/* Superimposed FANZ Rank (Top Right) - REMOVED AS PER REQUEST */}

          {/* Superimposed FANZ Name (Bottom) */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/50 to-transparent flex items-end justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter text-white drop-shadow-lg flex items-center">
                  {activeFanz?.name || 'Mon FANZ'}
                  <MrFanzHelp contextId="home" />
                </h1>
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
            {activeFanz && (
              <div className="w-10 h-10 bg-black rounded-full flex flex-col items-center justify-center border-2 border-white/10 shadow-xl shrink-0 mb-1 backdrop-blur-md">
                <span className="text-base font-black italic text-white leading-none">{activeFanz.rank ?? 0}</span>
              </div>
            )}
          </div>
        </div>

        {/* Content Below Video (Live Matches or Life Actions) */}
        <div className="flex-1 flex flex-col justify-start py-2">
          {/* Quick Links */}
          <div className="px-4 sm:px-8 pt-3 pb-2 grid grid-cols-4 gap-3 sm:gap-4">
            <button 
              onClick={() => onNavigate('shop')}
              className="relative flex flex-col items-center justify-center gap-2 p-2 sm:p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
            >
              <Store className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500" />
              <span className="text-[10px] font-black uppercase text-center leading-tight">Shop</span>
            </button>
            <button 
              onClick={() => onNavigate('missions')}
              className="relative flex flex-col items-center justify-center gap-2 p-2 sm:p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
            >
              {hasClaimableMissions && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-black animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)] z-10" />
              )}
              <Target className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
              <span className="text-[10px] font-black uppercase text-center leading-tight">Missions</span>
            </button>
            <button 
              onClick={() => onOpenStreak()}
              className="relative flex flex-col items-center justify-center gap-2 p-2 sm:p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
            >
              {hasClaimableStreak && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-black animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)] z-10" />
              )}
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />
              <span className="text-[10px] font-black uppercase text-center leading-tight">Série</span>
            </button>
            <button 
              onClick={() => onNavigate('pass')}
              className="relative flex flex-col items-center justify-center gap-2 p-2 sm:p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
            >
              {hasNewPass && (
                <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded border border-black uppercase animate-bounce shadow-[0_0_8px_rgba(239,68,68,0.6)] z-10">
                  New
                </div>
              )}
              <Ticket className="w-5 h-5 sm:w-6 sm:h-6 text-purple-500" />
              <span className="text-[10px] font-black uppercase text-center leading-tight">Pass</span>
            </button>
          </div>

          {liveMatches.length === 0 && activeFanz && fanzTemplate && (
            <p className="text-center text-gray-400 text-xs font-bold px-6 pt-2 pb-4">
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
              onClick={() => scroll(scrollContainerRef, 'left')}
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
                  const hasScore = totalScore > 0;
                  
                  let dominanceA = 50;
                  let dominanceB = 50;
                  if (totalScore > 0) {
                    dominanceA = Math.round((scoreA / totalScore) * 100);
                    dominanceB = 100 - dominanceA;
                  }

                  const homeEvents = match.events?.filter((e: any) => e.team.id === match.teams.home.id && (e.type === 'Goal' || e.type === 'Card')) || [];
                  const awayEvents = match.events?.filter((e: any) => e.team.id === match.teams.away.id && (e.type === 'Goal' || e.type === 'Card')) || [];

                  const homeIsFav = favoriteIds.includes(match.teams.home.id.toString());
                  const awayIsFav = favoriteIds.includes(match.teams.away.id.toString());

                  return (
                  <div key={match.fixture.id} className="snap-center shrink-0 w-[calc(100vw-80px)] max-w-[400px] bg-[#1a1a1a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden group">
                    {/* Header: Country & League */}
                    <div className="flex justify-between items-center text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {match.league?.flag && <img src={getImageUrl(match.league.flag, 40)} alt="" className="w-4 h-3 object-cover rounded-sm" referrerPolicy="no-referrer" />}
                        <span className="truncate">{translateCountryName(match.league?.country || '')}</span>
                      </div>
                      <div 
                        className="flex items-center gap-1.5 cursor-pointer hover:text-orange-500 transition-colors min-w-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onLeagueClick && match.league) {
                            onLeagueClick(match.league.id, match.league.season || new Date().getFullYear());
                          }
                        }}
                      >
                        {match.league?.logo && <img src={getImageUrl(match.league.logo, 40)} alt="" className="w-4 h-4 object-contain shrink-0" referrerPolicy="no-referrer" />}
                        <span className="truncate">{translateLeagueName(match.league?.name || '')}</span>
                      </div>
                    </div>

                    {/* Teams & Score */}
                    <div className="flex justify-between items-start mt-2">
                      {/* Home Team */}
                      <div 
                        className="flex flex-col items-center gap-2 flex-1 cursor-pointer group min-w-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onTeamClick && match.teams.home) {
                            onTeamClick(match.teams.home.id, match.league?.season || new Date().getFullYear());
                          }
                        }}
                      >
                        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-full p-1.5 flex items-center justify-center group-hover:scale-105 transition-transform relative">
                          <img src={getImageUrl(match.teams.home.logo, 100)} alt="" className="w-8 h-8 sm:w-10 sm:h-10 object-contain" referrerPolicy="no-referrer" />
                          {homeIsFav && (
                            <div className="absolute -top-1 -right-1 bg-black rounded-full p-0.5 border border-orange-500">
                              <Star className="w-3 h-3 text-orange-500 fill-orange-500" />
                            </div>
                          )}
                        </div>
                        <span className={cn("font-black text-[10px] sm:text-xs text-center uppercase leading-tight h-8 flex items-center justify-center group-hover:text-orange-500 transition-colors line-clamp-2 w-full px-1", homeIsFav && "text-orange-500")}>{match.teams.home.name}</span>
                        <div className="bg-orange-500/10 border border-orange-500/20 rounded-full px-2.5 py-1 flex items-center gap-1 mt-1">
                          <Flame className="w-3 h-3 text-orange-500" />
                          <span className="text-[10px] sm:text-xs font-black text-orange-500">{hasScore ? scoreA : '0'}</span>
                        </div>
                      </div>

                      {/* Score & Time */}
                      <div className="flex flex-col items-center justify-center px-2 sm:px-3 shrink-0">
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
                      <div 
                        className="flex flex-col items-center gap-2 flex-1 cursor-pointer group min-w-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onTeamClick && match.teams.away) {
                            onTeamClick(match.teams.away.id, match.league?.season || new Date().getFullYear());
                          }
                        }}
                      >
                        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-full p-1.5 flex items-center justify-center group-hover:scale-105 transition-transform relative">
                          <img src={getImageUrl(match.teams.away.logo, 100)} alt="" className="w-8 h-8 sm:w-10 sm:h-10 object-contain" referrerPolicy="no-referrer" />
                          {awayIsFav && (
                            <div className="absolute -top-1 -right-1 bg-black rounded-full p-0.5 border border-orange-500">
                              <Star className="w-3 h-3 text-orange-500 fill-orange-500" />
                            </div>
                          )}
                        </div>
                        <span className={cn("font-black text-[10px] sm:text-xs text-center uppercase leading-tight h-8 flex items-center justify-center group-hover:text-blue-500 transition-colors line-clamp-2 w-full px-1", awayIsFav && "text-orange-500")}>{match.teams.away.name}</span>
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-full px-2.5 py-1 flex items-center gap-1 mt-1">
                          <Flame className="w-3 h-3 text-blue-500" />
                          <span className="text-[10px] sm:text-xs font-black text-blue-500">{hasScore ? scoreB : '0'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Match Events */}
                    {(homeEvents.length > 0 || awayEvents.length > 0) && (
                      <div className="flex justify-between items-start text-[9px] sm:text-[10px] text-gray-300 px-2 mt-1 min-h-[30px] max-h-[60px] overflow-y-auto no-scrollbar gap-2">
                        <div className="flex-1 flex flex-col items-start gap-1">
                          {homeEvents.map((e: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-1">
                              <span className="text-gray-500 w-4">{e.time.elapsed}'</span>
                              {e.type === 'Goal' ? <span>⚽</span> : 
                               e.detail === 'Yellow Card' ? <div className="w-1.5 h-2.5 bg-yellow-500 rounded-[1px]" /> :
                               <div className="w-1.5 h-2.5 bg-red-500 rounded-[1px]" />}
                              <span className="truncate max-w-[80px]">{e.player.name}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex-1 flex flex-col items-end gap-1">
                          {awayEvents.map((e: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-1 justify-end">
                              <span className="truncate max-w-[80px] text-right">{e.player.name}</span>
                              {e.type === 'Goal' ? <span>⚽</span> : 
                               e.detail === 'Yellow Card' ? <div className="w-1.5 h-2.5 bg-yellow-500 rounded-[1px]" /> :
                               <div className="w-1.5 h-2.5 bg-red-500 rounded-[1px]" />}
                              <span className="text-gray-500 w-4 text-right">{e.time.elapsed}'</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Dominance Bar */}
                    <div className="mt-3">
                      {hasScore ? (
                        <>
                          <div className="flex justify-between items-center text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                            <span className="text-orange-500">{dominanceA}%</span>
                            <span>DOMINANCE MONDIALE</span>
                            <span className="text-blue-500">{dominanceB}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-black/60 rounded-full overflow-hidden flex relative">
                            <div className="h-full bg-orange-500 transition-all duration-500" style={{ width: `${dominanceA}%` }} />
                            <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${dominanceB}%` }} />
                            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/50 -translate-x-1/2 z-10"></div>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-1">
                          <span className="text-[8px] sm:text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                            Aucun duel n'a été joué
                          </span>
                        </div>
                      )}
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
                activeFanz && fanzTemplate && profile.activeAction?.fanzId === activeFanz.id ? (
                  lifeActions
                    .filter(action => action.id === profile.activeAction?.actionId)
                    .map(action => (
                      <div key={action.id} className="snap-center shrink-0 w-[calc(100vw-80px)] max-w-[400px]">
                        <LifeActionCard 
                          action={action} 
                          fanz={activeFanz} 
                          userProfile={profile} 
                        />
                      </div>
                    ))
                ) : activeFanz && fanzTemplate && !profile.activeAction ? (
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
              onClick={() => scroll(scrollContainerRef, 'right')}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-black/80 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 text-white hover:bg-white/10 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Buy me a ball after live slider / actions */}
          <div className="px-[30px] py-4">
            <a 
              href="https://buymeacoffee.com/thebestfanonline" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full relative group overflow-hidden rounded-2xl flex items-center justify-center p-0.5"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500 via-yellow-500 to-orange-500 rounded-2xl animate-spin-slow opacity-70 group-hover:opacity-100 transition-opacity" style={{ animationDuration: '3s' }} />
              <div className="relative w-full bg-[#111] backdrop-blur-md px-4 py-3 rounded-2xl flex items-center justify-center gap-3 transition-transform duration-300 group-hover:scale-[0.98]">
                <img src="https://img.buymeacoffee.com/button-api/?text=Buy me a ball&emoji=⚽&slug=fanz.sports&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff" alt="Buy me a ball" className="h-10" />
              </div>
            </a>
          </div>

        {/* HUB COUPE DU MONDE 2026 */}
        <div className="py-8 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-amber-700/10 pointer-events-none"></div>
          <div className="relative z-10 flex items-center justify-between px-[30px] mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-500" /> 
              <span className="text-xs font-black uppercase tracking-widest text-white drop-shadow-md">COUPE DU MONDE 2026</span>
            </div>
            {onLeagueClick && (
              <button 
                onClick={() => onLeagueClick(1, 2026)}
                className="text-[10px] font-black text-orange-500 uppercase flex items-center gap-1 hover:text-orange-400 transition-colors"
              >
                TOUT VOIR <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
          
          <div className="relative z-10">
            {/* Left Scroll Button */}
            <button 
              onClick={() => scroll(worldCupScrollRef, 'left')}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-black/80 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 text-white hover:bg-white/10 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="px-4 sm:px-[30px]">
              {worldCupStandings && worldCupStandings.length > 0 ? (
                <div 
                  ref={worldCupScrollRef}
                  className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth no-scrollbar"
                >
                  {worldCupStandings.map((group: any[], index: number) => {
                  const groupName = group[0]?.group || `Groupe ${String.fromCharCode(65 + index)}`;
                  return (
                    <div key={index} className="snap-center shrink-0 w-[85vw] sm:w-[320px] max-w-[340px] bg-black/40 border border-white/10 rounded-xl overflow-hidden flex flex-col">
                      <div className="bg-white/5 px-3 py-2 text-xs font-black uppercase tracking-widest text-orange-500 border-b border-white/5 flex justify-between items-center">
                        <span>{groupName}</span>
                        <span className="text-[10px] text-gray-500">PHASES DE POULES</span>
                      </div>
                      <div className="p-3">
                        <div className="flex justify-between text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2 px-1">
                          <span className="w-5">#</span>
                          <span className="flex-1 text-left">Nation</span>
                          <span className="w-6 text-center" title="Joués">J</span>
                          <span className="w-8 text-center" title="Différence de buts">+/-</span>
                          <span className="w-8 text-center">PTS</span>
                        </div>
                        {group.map((teamData: any) => (
                          <div key={teamData.team.id} className="flex justify-between items-center py-1.5 px-1 border-b border-white/5 last:border-0 hover:bg-white/5 rounded cursor-pointer transition-colors" onClick={() => onTeamClick && onTeamClick(teamData.team.id, 2026)}>
                            <span className="w-5 text-xs font-black text-gray-400">{teamData.rank}</span>
                            <div className="flex-1 flex items-center gap-2 overflow-hidden pr-2">
                              {teamData.team.logo && <img src={getImageUrl(teamData.team.logo, 40)} alt="" className="w-4 h-4 object-contain rounded-sm" referrerPolicy="no-referrer" />}
                              <span className="text-sm font-bold text-white truncate">{translateCountryName(teamData.team.name)}</span>
                            </div>
                            <span className="w-6 text-xs text-gray-500 text-center font-bold">{teamData.all?.played ?? 0}</span>
                            <span className="w-8 text-[11px] text-gray-500 text-center font-bold">{teamData.goalsDiff > 0 ? `+${teamData.goalsDiff}` : (teamData.goalsDiff || 0)}</span>
                            <span className="w-8 text-sm font-black text-orange-400 text-center">{teamData.points}</span>
                          </div>
                        ))}
                      </div>
                      
                      {worldCupFixtures && worldCupFixtures.length > 0 && (() => {
                        // Extract all team IDs from this group to filter fixtures
                        const groupTeamIds = group.map(t => t.team.id);
                        
                        // Find fixtures where both home and away teams are in this group
                        const groupFixtures = worldCupFixtures.filter(f => 
                           f.teams && 
                           f.teams.home && 
                           f.teams.away && 
                           groupTeamIds.includes(f.teams.home.id) && 
                           groupTeamIds.includes(f.teams.away.id)
                        ).sort((a,b) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime());

                        if (groupFixtures.length === 0) return null;

                        return (
                          <div className="p-3 border-t border-white/5 bg-black/20">
                             <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-3 px-1">Matchs Prévus</div>
                             <div className="grid grid-cols-1 gap-2">
                               {groupFixtures.slice(0, 6).map((fx: any) => {
                                 const isFinished = fx.fixture.status.short === 'FT' || fx.fixture.status.short === 'AET' || fx.fixture.status.short === 'PEN';
                                 return (
                                 <div key={fx.fixture.id} className="flex flex-col gap-1.5 p-2.5 bg-white/5 rounded-lg border border-white/5 hover:border-white/10 hover:bg-white/10 transition-colors cursor-pointer group" onClick={() => onMatchClick && onMatchClick(fx.fixture.id)}>
                                   <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider group-hover:text-orange-400 transition-colors">
                                     {new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(fx.fixture.date))}
                                   </div>
                                   <div className="flex flex-col gap-1.5">
                                      <div className="flex justify-between items-center">
                                         <div className="flex items-center gap-2 overflow-hidden">
                                           <img src={getImageUrl(fx.teams.home.logo, 20)} alt="" className="w-4 h-4 object-contain rounded-sm" referrerPolicy="no-referrer" />
                                           <span className="text-xs text-white font-bold truncate">{translateCountryName(fx.teams.home.name)}</span>
                                         </div>
                                         <span className="text-xs font-black text-gray-300 ml-2">{isFinished ? fx.goals.home : '-'}</span>
                                      </div>
                                      <div className="flex justify-between items-center">
                                         <div className="flex items-center gap-2 overflow-hidden">
                                           <img src={getImageUrl(fx.teams.away.logo, 20)} alt="" className="w-4 h-4 object-contain rounded-sm" referrerPolicy="no-referrer" />
                                           <span className="text-xs text-white font-bold truncate">{translateCountryName(fx.teams.away.name)}</span>
                                         </div>
                                         <span className="text-xs font-black text-gray-300 ml-2">{isFinished ? fx.goals.away : '-'}</span>
                                      </div>
                                   </div>
                                 </div>
                               )})}
                             </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="w-full h-32 flex items-center justify-center border border-white/5 rounded-xl bg-white/5">
                <div className="flex flex-col items-center gap-2 text-gray-500">
                  <div className="w-6 h-6 border-2 border-orange-500/50 border-t-orange-500 rounded-full animate-spin" />
                  <span className="text-xs font-bold uppercase">Chargement des poules...</span>
                </div>
              </div>
            )}

            {/* Right Scroll Button */}
            <button 
              onClick={() => scroll(worldCupScrollRef, 'right')}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-black/80 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 text-white hover:bg-white/10 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
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
