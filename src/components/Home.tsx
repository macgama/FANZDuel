import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { UserProfile, Fanz, FanzTemplate, LifeAction, GlobalFervorConfig } from '../types';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, getDoc, doc, getDocs, limit, setDoc } from 'firebase/firestore';
import { getImageUrl, cn } from '../lib/utils';
import { BuyMeACoffee } from './BuyMeACoffee';
// ... (rest of imports)

// Since getImageUrl handles the logic for converting gs:// to https://thebestfan.online/img/, 
// we just need to ensure it's used consistently for images and videos fetched from Firebase.

// Inside getImageUrl utility, I will add logic to replace gs://thebestfanonlinegas.firebasestorage.app/ with https://thebestfan.online/img/ if it isn't already.
import { footballApi } from '../services/footballApi';
import { MatchEvents } from './MatchEvents';
import { LifeActionCard } from './LifeActionCard';
import { LiveMatchesSlider } from './LiveMatchesSlider';
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
  Swords,
  Megaphone,
  X
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
  claimableAlerts?: { missions: boolean; globalFervor: boolean; fanzFervor: boolean };
  onNavigate: (view: 'home' | 'admin' | 'matches' | 'competitions' | 'teams' | 'fanz' | 'transactions' | 'social' | 'fervor-path' | 'shop' | 'missions' | 'pass' | 'favorite-teams' | 'waiting-room') => void;
  onMenuClick: () => void;
  onMatchClick: (matchId: number) => void;
  onLeagueClick?: (leagueId: number, season: number) => void;
  onTeamClick?: (teamId: number, season: number) => void;
  onJoinDuel: (matchId: number, isLive: boolean) => void;
  onOpenStreak: () => void;
  onFanzClick?: (fanzId: string) => void;
}

export function Home({ profile, claimableAlerts, onNavigate, onMenuClick, onMatchClick, onLeagueClick, onTeamClick, onJoinDuel, onOpenStreak, onFanzClick }: HomeProps) {
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
  const [news, setNews] = useState<any[]>([]);
  const [currentNewsIndex, setCurrentNewsIndex] = useState(0);
  const [selectedNewsDetail, setSelectedNewsDetail] = useState<any | null>(null);
  const [showNewsModal, setShowNewsModal] = useState(false);
  const [zoomedMedia, setZoomedMedia] = useState<{ type: 'image' | 'video', url: string } | null>(null);

  useEffect(() => {
    if (news.length > 0) {
      try {
        const alreadyShown = sessionStorage.getItem('news_modal_shown');
        if (!alreadyShown) {
          setShowNewsModal(true);
          sessionStorage.setItem('news_modal_shown', 'true');
        }
      } catch (e) {
        setShowNewsModal(true);
      }
    }
  }, [news]);

  const favoriteIds = React.useMemo(() => {
    return profile?.favoriteTeams?.map(id => id.toString()) || [];
  }, [profile?.favoriteTeams]);

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
        if (err?.code !== 'permission-denied' && !err?.message?.includes('Missing or insufficient permissions') && err?.message !== 'Failed to fetch') {
          console.error("Error fetching badges:", err);
        }
      }
    };
    if (profile.uid) {
      fetchBadges();
    }
  }, [profile.uid, profile.purchasedPasses, profile.streak, profile.claimedStreakDays]);

  useEffect(() => {
    const q = query(
      collection(db, 'news'),
      where('isActive', '==', true),
      limit(5)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNews(list);
    }, (error) => {
      console.log("News snapshot listener handled:", error.message);
    });
    return () => unsubscribe();
  }, []);

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
            } catch (err: any) {
              if (err?.code !== 'permission-denied' && !err?.message?.includes('Missing or insufficient permissions')) {
                console.error(`Error checking api_teams for ${teamIdStr}`, err);
              }
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
        const activeActionFanz = profile.activeAction?.fanzId 
          ? allFanz.find(f => f.id === profile.activeAction.fanzId)
          : null;

        const fanzData = activeActionFanz || (profile.activeFanzId 
          ? allFanz.find(f => f.id === profile.activeFanzId) 
          : allFanz[0]);

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
                  currentVideoUrl = equippedSkinData.videoUrl || null; // Don't fallback to template video if skin has no video
                }

                if (activeAction) {
                  let resolvedImage = activeAction.image;
                  let resolvedVideoUrl = activeAction.videoUrl;
                  if (fanzData.equippedSkin && activeAction.skinOverrides && activeAction.skinOverrides[fanzData.equippedSkin]) {
                    const override = activeAction.skinOverrides[fanzData.equippedSkin];
                    if (override.image) resolvedImage = override.image;
                    if (override.videoUrl) resolvedVideoUrl = override.videoUrl;
                  }
                  currentImageUrl = resolvedImage || currentImageUrl;
                  currentVideoUrl = resolvedVideoUrl || null; // Don't fallback to skin video if action has no video
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

    let currentMatchIdsStr = "";
    
    // Fetch some live matches
    const fetchMatches = async () => {
      try {
        const liveFixtures = await footballApi.getLiveFixtures();
        
        // Fetch active leagues to filter
        const leaguesSnap = await getDocs(query(collection(db, 'leagues'), where('isActive', '==', true)));
        const activeLeagueIds = leaguesSnap.docs.map(doc => Number(doc.id));
        
        const filteredFixtures = liveFixtures.filter((f: any) => activeLeagueIds.includes(f.league.id));

        // Sort live matches alphabetically by country name, but put favorite teams first
        filteredFixtures.sort((a: any, b: any) => {
          const favoriteIds = profile.favoriteTeams?.map((id: any) => id.toString()) || [];
          const aIsFav = favoriteIds.includes(a.teams.home.id.toString()) || favoriteIds.includes(a.teams.away.id.toString());
          const bIsFav = favoriteIds.includes(b.teams.home.id.toString()) || favoriteIds.includes(b.teams.away.id.toString());
          if (aIsFav && !bIsFav) return -1;
          if (!aIsFav && bIsFav) return 1;
          const countryA = translateCountryName(a.league.country || '');
          const countryB = translateCountryName(b.league.country || '');
          return countryA.localeCompare(countryB);
        });
        // Show all live matches
        setLiveMatches(filteredFixtures);
        
        // Fetch scores for these matches via onSnapshot
        if (filteredFixtures.length > 0) {
          const matchIds = filteredFixtures.map((m: any) => m.fixture.id.toString());
          const matchIdsStr = matchIds.sort().join(",");
          
          if (matchIdsStr !== currentMatchIdsStr) {
            // Match list changed, need to recreate listeners
            unsubs.forEach(unsub => unsub());
            unsubs = [];
            currentMatchIdsStr = matchIdsStr;
            
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
        } else {
          unsubs.forEach(unsub => unsub());
          unsubs = [];
          currentMatchIdsStr = "";
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
        if (error?.code !== 'permission-denied' && !error?.message?.includes('Missing or insufficient permissions') && error?.message !== 'Failed to fetch') {
          console.error("Error fetching life actions", error);
        }
      }
    };

    fetchMatches();
    const intervalMatches = setInterval(fetchMatches, 60000);
    fetchLifeActions();

    const fetchActiveDuels = async () => {
      try {
        const res = await fetch('/api/duels/all', {
          headers: {
            'Accept': 'application/json'
          }
        });
        if (res.ok) {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const duelsData = await res.json();
            setActiveDuels(duelsData);
          } else {
            console.warn("Expected JSON from /api/duels/all, got", contentType);
          }
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
      clearInterval(intervalMatches);
    };
  }, [profile?.uid, JSON.stringify(profile?.favoriteTeams)]);

  const handleNewsClick = (item: any) => {
    if (!item) return;
    setSelectedNewsDetail(item);
  };

  const handleNewsNavigate = (item: any) => {
    if (!item) return;
    setSelectedNewsDetail(null);
    if (item.type === 'pack' || item.type === 'fanz' || item.type === 'skin' || item.type === 'emote') {
      onNavigate('shop');
    } else if (item.type === 'competition') {
      onNavigate('competitions');
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  return (
    <div className="h-full w-full max-w-[600px] mx-auto bg-transparent relative overflow-hidden flex flex-col font-sans text-white border-x border-white/5 shadow-2xl">
      
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
        <div className="absolute top-20 right-4 z-50">
          <button 
            onClick={() => onNavigate('waiting-room')}
            className="bg-orange-500/90 backdrop-blur-md border border-orange-400 rounded-full py-1.5 px-3 flex items-center gap-2 shadow-lg shadow-orange-500/20 animate-pulse"
          >
            <Swords className="w-3 h-3 text-white" />
            <span className="text-[10px] font-black text-white">{waitingDuelsCount}</span>
            <ArrowRight className="w-3 h-3 text-white" />
          </button>
        </div>
      )}

      {/* BODY: Video Background (4:3) and Content Below */}
      <div className="flex-1 flex flex-col relative overflow-y-auto pb-6 no-scrollbar">
        {/* Video Section (4:3 Aspect Ratio) */}
        <div 
          className="w-full aspect-[4/3] relative shrink-0 cursor-pointer group overflow-hidden isolate [transform:translateZ(0)]"
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
              poster={imageUrl || undefined}
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
          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-black via-black/50 to-transparent flex items-end justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-lg sm:text-3xl font-black italic uppercase tracking-tighter text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] flex items-center">
                  {activeFanz?.name || 'Mon FANZ'}
                  <MrFanzHelp contextId="home" />
                </h1>
              </div>

              {currentActiveAction && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                  <p className="text-[10px] sm:text-xs font-black italic uppercase tracking-tighter text-orange-500 drop-shadow-md">
                    {currentActiveAction.name}
                  </p>
                </div>
              )}

              {activeFanz?.equippedSkin && fanzTemplate?.skins && (() => {
                const skinData = fanzTemplate.skins.find(s => s.id === activeFanz.equippedSkin);
                if (!skinData) return null;
                return (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded px-2 py-0.5 text-[9px] font-black uppercase text-white shadow-sm">
                      Skin: {skinData.name}
                    </div>
                    {skinData.energyBonus && (
                      <div className="bg-blue-500/20 backdrop-blur-md border border-blue-500/30 rounded px-2 py-0.5 text-[9px] font-black uppercase text-blue-400 flex items-center gap-1 shadow-sm">
                        <Zap className="w-2.5 h-2.5" /> +{skinData.energyBonus} ENER Max
                      </div>
                    )}
                    {skinData.moneyBonus && (
                      <div className="bg-yellow-500/20 backdrop-blur-md border border-yellow-500/30 rounded px-2 py-0.5 text-[9px] font-black uppercase text-yellow-400 shadow-sm">
                        +{skinData.moneyBonus}% CRÉDITS
                      </div>
                    )}
                    {skinData.fervorBonus && (
                      <div className="bg-orange-500/20 backdrop-blur-md border border-orange-500/30 rounded px-2 py-0.5 text-[9px] font-black uppercase text-orange-400 shadow-sm">
                        +{skinData.fervorBonus}% FERV
                      </div>
                    )}
                  </div>
                );
              })()}

              {!currentActiveAction && activeFanz && (() => {
                const configToUse = fanzTemplate?.ferveurConfig || fanzFervorConfig;
                const ferveurPath = configToUse 
                  ? generateFervorPath(configToUse.ranges?.[configToUse.ranges.length - 1]?.max || 50000, configToUse)
                  : fanzTemplate?.ferveurPath || [];
                const nextStep = ferveurPath.find(l => (activeFanz.ferveurPoints || 0) < l.pointsRequired);
                const nextLevelPoints = nextStep?.pointsRequired || (ferveurPath.length > 0 ? ferveurPath[ferveurPath.length - 1].pointsRequired : 1000);
                const currentPoints = activeFanz.ferveurPoints || 0;
                const prevStep = ferveurPath.filter(l => l.pointsRequired <= currentPoints).pop();
                const prevPoints = prevStep ? prevStep.pointsRequired : 0;
                
                const progressPercent = nextStep 
                  ? ((currentPoints - prevPoints) / (nextLevelPoints - prevPoints)) * 100 
                  : 100;
                
                return (
                  <div className="mt-2 w-full max-w-[150px] sm:max-w-[200px]">
                    <div className="h-3 sm:h-4 bg-black/60 rounded-full border border-white/10 relative overflow-hidden">
                      <div 
                        className="h-full bg-orange-500 rounded-full transition-all duration-500 relative"
                        style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                      >
                        <div className="absolute inset-0 bg-white/30 animate-[scan_2s_ease-in-out_infinite]" />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                        <span className="text-[8px] sm:text-[10px] font-black text-white italic uppercase tracking-tighter drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                          {currentPoints} / {nextLevelPoints}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            {activeFanz && (
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-black rounded-full flex flex-col items-center justify-center border-2 border-white/10 shadow-xl shrink-0 mb-1 backdrop-blur-md">
                <span className="text-sm sm:text-base font-black italic text-white leading-none">{activeFanz.rank ?? 0}</span>
              </div>
            )}
          </div>
        </div>

        {/* Content Below Video (Live Matches or Life Actions) */}
        <div className="flex-1 flex flex-col justify-evenly gap-4 py-4 shrink-0 min-h-[400px]">
          {/* Official News Button Indicator */}
          {news.length > 0 && (
            <div className="px-4 sm:px-8 shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <button
                onClick={() => setShowNewsModal(true)}
                className="w-full relative flex items-center justify-between gap-3 p-3 bg-gradient-to-r from-blue-950/40 via-purple-950/30 to-blue-950/40 border border-blue-500/20 rounded-xl hover:bg-white/10 hover:border-blue-500/40 transition-all text-left shadow-[0_4px_24px_rgba(59,130,246,0.15)] cursor-pointer group"
              >
                {/* Background light pulse */}
                <div className="absolute inset-0 bg-blue-500/5 opacity-50 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
                
                <div className="flex items-center gap-2.5 relative z-10">
                  <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0 select-none">
                    <Megaphone className="w-3.5 h-3.5 animate-pulse" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-white leading-tight flex items-center gap-1.5">
                      Actualités Fanz <span className="bg-blue-500/20 text-blue-300 text-[8px] font-black px-1.5 py-0.2 rounded-full border border-blue-500/30">{news.length}</span>
                    </span>
                    <p className="text-[8px] text-white/50">Cliquez pour voir les dernières nouveautés</p>
                  </div>
                </div>
                <div className="text-[8px] font-black uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20 relative z-10 hover:bg-blue-500/20 transition-all">
                  Consulter
                </div>
              </button>
            </div>
          )}

          {/* Quick Links */}
          <div className="px-4 sm:px-8 grid grid-cols-4 gap-3 sm:gap-4 shrink-0">
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
              {claimableAlerts?.missions && (
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

          {liveMatches.length > 0 ? (
            <LiveMatchesSlider
              matches={liveMatches}
              activeDuels={activeDuels}
              matchScores={matchScores}
              onMatchClick={onMatchClick}
              onJoinDuel={onJoinDuel}
              onTeamClick={onTeamClick}
              onLeagueClick={onLeagueClick}
              profile={profile}
              showAllButton={true}
              onShowAllClick={() => onNavigate('matches')}
            />
          ) : (
            (() => {
              const isActionInProgress = !!(activeFanz && fanzTemplate && profile.activeAction?.fanzId === activeFanz.id);
              return (
                <div className="relative w-full pb-4">
                  {!isActionInProgress && (
                    <button 
                      onClick={() => scroll(scrollContainerRef, 'left')}
                      className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-black/80 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 text-white hover:bg-white/10 transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  )}

                  <div 
                    ref={scrollContainerRef}
                    className={isActionInProgress 
                      ? "w-full flex justify-center px-4" 
                      : "w-full overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory"
                    }
                  >
                    <div className={isActionInProgress 
                      ? "w-full flex justify-center py-2" 
                      : "flex flex-nowrap gap-4 px-4 py-2 w-fit items-stretch"
                    }>
                      {activeFanz && fanzTemplate && profile.activeAction?.fanzId === activeFanz.id ? (
                        lifeActions
                          .filter(action => action.id === profile.activeAction?.actionId)
                          .map(action => (
                            <div key={action.id} className="w-full max-w-[500px] shrink-0">
                              <LifeActionCard 
                                action={action} 
                                fanz={activeFanz} 
                                userProfile={profile} 
                                fanzTemplate={fanzTemplate}
                              />
                            </div>
                          ))
                      ) : activeFanz && fanzTemplate && !profile.activeAction ? (
                        (() => {
                          const equippedSkinData = activeFanz.equippedSkin ? fanzTemplate.skins?.find((s: any) => s.id === activeFanz.equippedSkin) : null;
                          return lifeActions
                            .filter(action => {
                              const isTemplateMatch = action.fanzTemplateId === fanzTemplate.id || !action.fanzTemplateId;
                              const isSkinMatch = !action.skinId || action.skinId === activeFanz.equippedSkin;
                              const isSpecialAction = action.id === equippedSkinData?.specialActionId;
                              return (isTemplateMatch && isSkinMatch) || isSpecialAction;
                            })
                            .reduce((acc, action) => {
                              const existingIdx = acc.findIndex(a => a.name === action.name);
                              if (existingIdx !== -1) {
                                if (action.skinId && !acc[existingIdx].skinId) {
                                  acc[existingIdx] = action;
                                }
                              } else {
                                acc.push(action);
                              }
                              return acc;
                            }, [] as LifeAction[])
                            .map(action => (
                              <div key={action.id} className="snap-center shrink-0 w-[calc(100vw-80px)] max-w-[400px]">
                                <LifeActionCard 
                                  action={action} 
                                  fanz={activeFanz} 
                                  userProfile={profile} 
                                  fanzTemplate={fanzTemplate}
                                />
                              </div>
                            ));
                        })()
                      ) : (
                        <div className="w-full text-center py-4 text-gray-500 text-xs font-bold uppercase px-[30px]">
                          Aucun match en direct et aucun FANZ actif
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {!isActionInProgress && (
                    <button 
                      onClick={() => scroll(scrollContainerRef, 'right')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-black/80 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 text-white hover:bg-white/10 transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  )}
                </div>
              );
            })()
          )}



        {/* BOUTON SOUTIEN / BUY ME A COFFEE */}
        <div className="flex justify-center py-2 relative z-20">
          <BuyMeACoffee />
        </div>

        {/* HUB COUPE DU MONDE 2026 */}
        <div className="py-2 shrink-0 relative">
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

  {selectedNewsDetail && (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-stone-900 border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col space-y-4 text-white relative">
        <button
          onClick={() => setSelectedNewsDetail(null)}
          className="absolute top-4 right-4 text-white/50 hover:text-white p-1 hover:bg-white/5 rounded-full transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-[8px] uppercase font-black tracking-wider ${
            selectedNewsDetail.type === 'competition' ? 'bg-purple-900/40 text-purple-400 border border-purple-800/40' :
            selectedNewsDetail.type === 'fanz' ? 'bg-orange-900/40 text-orange-400 border border-orange-800/40' :
            selectedNewsDetail.type === 'skin' ? 'bg-pink-900/40 text-pink-400 border border-pink-800/40' :
            selectedNewsDetail.type === 'emote' ? 'bg-teal-900/40 text-teal-400 border border-teal-800/40' :
            selectedNewsDetail.type === 'pack' ? 'bg-yellow-900/40 text-yellow-500 border border-yellow-800/40' :
            'bg-blue-900/40 text-blue-400 border border-blue-800/40'
          }`}>
            {selectedNewsDetail.type}
          </span>
          <span className="text-[9px] text-white/40">
            {new Date(selectedNewsDetail.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-black uppercase text-white leading-tight">
            {selectedNewsDetail.title}
          </h3>

          {selectedNewsDetail.imageUrl && (
            <div className="w-full flex justify-center bg-black/40 border border-white/5 rounded-xl p-3">
              {selectedNewsDetail.imageUrl.length < 5 ? (
                <span className="text-4xl select-none">{selectedNewsDetail.imageUrl}</span>
              ) : (
                <img 
                  src={getImageUrl(selectedNewsDetail.imageUrl)} 
                  alt="Aperçu" 
                  className="max-h-32 object-contain rounded-lg"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>
          )}

          <p className="text-[11px] text-white/80 leading-relaxed max-h-40 overflow-y-auto pr-1">
            {selectedNewsDetail.message}
          </p>
        </div>

        <div className="flex flex-col gap-1.5 pt-3 border-t border-white/5">
          {(selectedNewsDetail.type === 'pack' || selectedNewsDetail.type === 'fanz' || selectedNewsDetail.type === 'skin' || selectedNewsDetail.type === 'emote' || selectedNewsDetail.type === 'competition') && (
            <button
              onClick={() => handleNewsNavigate(selectedNewsDetail)}
              className="w-full bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-[10px] font-black uppercase tracking-wider py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_2px_8px_rgba(59,130,246,0.3)]"
            >
              {selectedNewsDetail.type === 'competition' ? (
                <>🏆 Rejoindre les Compétitions</>
              ) : (
                <>🛍️ Acheter / Découvrir</>
              )}
            </button>
          )}
          <button
            onClick={() => setSelectedNewsDetail(null)}
            className="w-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-[10px] font-black uppercase tracking-wider py-2.5 rounded-lg transition-all cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )}

  {showNewsModal && news.length > 0 && (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-stone-900 border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col space-y-4 text-white relative">
        <button
          onClick={() => setShowNewsModal(false)}
          className="absolute top-4 right-4 text-white/50 hover:text-white p-1 hover:bg-white/5 rounded-full transition-colors z-[100]"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Carousel de News */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-widest text-blue-400 flex items-center gap-1.5 leading-none">
              <Megaphone className="w-3.5 h-3.5" />
              Actualités Fanz ({currentNewsIndex + 1}/{news.length})
            </h2>
          </div>

          <div className="relative min-h-[200px] flex flex-col justify-between">
            {/* Contenu de la news actuelle */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[8px] uppercase font-black tracking-wider ${
                  news[currentNewsIndex].type === 'competition' ? 'bg-purple-900/40 text-purple-400 border border-purple-800/40' :
                  news[currentNewsIndex].type === 'fanz' ? 'bg-orange-900/40 text-orange-400 border border-orange-800/40' :
                  news[currentNewsIndex].type === 'skin' ? 'bg-pink-900/40 text-pink-400 border border-pink-800/40' :
                  news[currentNewsIndex].type === 'emote' ? 'bg-teal-900/40 text-teal-400 border border-teal-800/40' :
                  news[currentNewsIndex].type === 'pack' ? 'bg-yellow-900/40 text-yellow-500 border border-yellow-800/40' :
                  'bg-blue-900/40 text-blue-400 border border-blue-800/40'
                }`}>
                  {news[currentNewsIndex].type}
                </span>
                <span className="text-[9px] text-white/40">
                  {new Date(news[currentNewsIndex].createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>

              <h3 className="text-sm font-black uppercase text-white leading-tight">
                {news[currentNewsIndex].title}
              </h3>

              {(() => {
                const currentNews = news[currentNewsIndex];
                const isVideoExt = (url: string) => {
                  if (!url) return false;
                  const cleanUrl = url.split('?')[0];
                  return cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.webm') || cleanUrl.endsWith('.mov') || cleanUrl.endsWith('.ogg');
                };

                const hasVideo = currentNews.videoUrl || (currentNews.imageUrl && isVideoExt(currentNews.imageUrl));
                const mediaType = hasVideo ? 'video' : 'image';
                const mediaUrl = currentNews.videoUrl || currentNews.imageUrl;

                if (!mediaUrl) return null;

                return (
                  <div 
                    onClick={() => {
                      if (mediaUrl.length >= 5) {
                        setZoomedMedia({ type: mediaType, url: getImageUrl(mediaUrl) });
                      }
                    }}
                    className={`w-full flex justify-center bg-black/40 border border-white/5 rounded-xl p-3 relative group transition-all duration-300 ${mediaUrl.length >= 5 ? 'cursor-zoom-in hover:border-blue-500/30 hover:bg-black/60 shadow-lg' : ''}`}
                  >
                    {mediaUrl.length < 5 ? (
                      <span className="text-4xl select-none">{mediaUrl}</span>
                    ) : hasVideo ? (
                      <div className="relative max-h-28 flex items-center justify-center">
                        <video 
                          src={getImageUrl(mediaUrl)} 
                          className="max-h-24 object-contain rounded-lg shadow-md"
                          autoPlay
                          muted
                          loop
                          playsInline
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center rounded-lg transition-colors duration-300">
                          <span className="bg-black/60 text-[9px] font-black uppercase text-white px-2 py-1 rounded border border-white/15 opacity-0 group-hover:opacity-100 transition-opacity tracking-wider">Agrandir la vidéo</span>
                        </div>
                      </div>
                    ) : (
                      <div className="relative max-h-28 flex items-center justify-center">
                        <img 
                          src={getImageUrl(mediaUrl)} 
                          alt="Aperçu" 
                          className="max-h-24 object-contain rounded-lg shadow-md"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center rounded-lg transition-colors duration-300">
                          <span className="bg-black/60 text-[9px] font-black uppercase text-white px-2 py-1 rounded border border-white/15 opacity-0 group-hover:opacity-100 transition-opacity tracking-wider">Agrandir l'image</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              <p className="text-[11px] text-white/85 leading-relaxed max-h-32 overflow-y-auto pr-1">
                {news[currentNewsIndex].message}
              </p>
            </div>

            {/* Navigation du carrousel */}
            {news.length > 1 && (
              <div className="flex items-center justify-between mt-4">
                <button
                  onClick={() => setCurrentNewsIndex(prev => (prev - 1 + news.length) % news.length)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer border border-white/5"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                {/* Indicateurs de points */}
                <div className="flex gap-1.5">
                  {news.map((_, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => setCurrentNewsIndex(idx)}
                      className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${idx === currentNewsIndex ? 'w-4 bg-blue-500' : 'w-1.5 bg-white/20'}`} 
                    />
                  ))}
                </div>

                <button
                  onClick={() => setCurrentNewsIndex(prev => (prev + 1) % news.length)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer border border-white/5"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Boutons d'action en bas du modal */}
        <div className="flex flex-col gap-1.5 pt-3 border-t border-white/5 text-center">
          {(news[currentNewsIndex].type === 'pack' || news[currentNewsIndex].type === 'fanz' || news[currentNewsIndex].type === 'skin' || news[currentNewsIndex].type === 'emote' || news[currentNewsIndex].type === 'competition') && (
            <button
              onClick={() => {
                setShowNewsModal(false);
                handleNewsNavigate(news[currentNewsIndex]);
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-[10px] font-black uppercase tracking-wider py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_2px_8px_rgba(59,130,246,0.3)]"
            >
              {news[currentNewsIndex].type === 'competition' ? (
                <>🏆 Rejoindre les Compétitions</>
              ) : (
                <>🛍️ Acheter / Découvrir</>
              )}
            </button>
          )}
          <button
            onClick={() => setShowNewsModal(false)}
            className="w-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-[10px] font-black uppercase tracking-wider py-2.5 rounded-lg transition-all cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )}

  {zoomedMedia && (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-4 backdrop-blur-lg animate-in fade-in duration-200" onClick={() => setZoomedMedia(null)}>
      <div className="max-w-full max-h-full flex flex-col items-center justify-center relative" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => setZoomedMedia(null)}
          className="absolute -top-12 sm:top-4 sm:-right-12 text-white/70 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors z-[210] cursor-pointer animate-in fade-in duration-300"
        >
          <X className="w-6 h-6" />
        </button>
        {zoomedMedia.type === 'video' ? (
          <video
            src={zoomedMedia.url}
            className="max-w-[90vw] max-h-[80vh] object-contain rounded-xl border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200"
            controls
            autoPlay
            loop
            playsInline
          />
        ) : (
          <img
            src={zoomedMedia.url}
            alt="Agrandissement"
            className="max-w-[90vw] max-h-[80vh] object-contain rounded-xl border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200"
            referrerPolicy="no-referrer"
          />
        )}
      </div>
    </div>
  )}
</div>
  );
}
