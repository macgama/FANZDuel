import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { UserProfile, Fanz, FanzTemplate, LifeAction, GlobalFervorConfig } from '../types';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, getDoc, doc, getDocs, limit, setDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
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
import { FavoriteLeagueStar } from './FavoriteLeagueStar';
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
  X,
  Database,
  UserPlus,
  UserCheck
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
  onlineCount?: number;
  onNavigate: (view: 'home' | 'admin' | 'matches' | 'competitions' | 'teams' | 'fanz' | 'transactions' | 'social' | 'fervor-path' | 'shop' | 'missions' | 'pass' | 'favorite-teams' | 'waiting-room' | 'mrfanz') => void;
  onMenuClick: () => void;
  onMatchClick: (matchId: number) => void;
  onLeagueClick?: (leagueId: number, season: number) => void;
  onTeamClick?: (teamId: number, season: number) => void;
  onJoinDuel: (matchId: number, isLive: boolean) => void;
  onJoinSpecificDuel?: (duelId: string, type: string, matchId: number) => void;
  onOpenStreak: () => void;
  onFanzClick?: (fanzId: string, tab?: 'infos' | 'stats' | 'cards' | 'skins' | 'emotes' | 'rank' | 'ferveur') => void;
  onStartDirectDuel?: (matchId: number, type: 'training' | '1v1', invitedFriend: UserProfile) => void;
}

import { DidacticielBanner } from "./DidacticielBanner";

export function Home({ profile, claimableAlerts, onlineCount = 1, onNavigate, onMenuClick, onMatchClick, onLeagueClick, onTeamClick, onJoinDuel, onJoinSpecificDuel, onOpenStreak, onFanzClick, onStartDirectDuel }: HomeProps) {
  const [activeFanz, setActiveFanz] = useState<Fanz | null>(null);
  const [allFanz, setAllFanz] = useState<Fanz[]>([]);
  const [showOnlineModal, setShowOnlineModal] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<UserProfile[]>([]);
  const [loadingOnlineUsers, setLoadingOnlineUsers] = useState(false);
  const [matchSelectionUser, setMatchSelectionUser] = useState<UserProfile | null>(null);
  const [matchSelectionType, setMatchSelectionType] = useState<'training' | '1v1' | null>(null);
  const [fanzTemplate, setFanzTemplate] = useState<FanzTemplate | null>(null);
  const [templatesMap, setTemplatesMap] = useState<Map<string, FanzTemplate>>(new Map());
  const [liveMatches, setLiveMatches] = useState<any[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<any[]>([]);
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
  const [dismissedAlertIDs, setDismissedAlertIDs] = useState<Set<string>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const worldCupScrollRef = useRef<HTMLDivElement>(null);
  const upcomingMatchesScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // load from local storage
    const stored = localStorage.getItem(`dismissed-alerts-${profile.uid}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.date === new Date().toDateString()) {
           setDismissedAlertIDs(new Set(parsed.ids));
        } else {
           localStorage.removeItem(`dismissed-alerts-${profile.uid}`);
        }
      } catch (e) {}
    }
  }, [profile.uid]);

  const handleDismissAlert = (id: string) => {
    const newSet = new Set(dismissedAlertIDs);
    newSet.add(id);
    setDismissedAlertIDs(newSet);
    localStorage.setItem(`dismissed-alerts-${profile.uid}`, JSON.stringify({
      date: new Date().toDateString(),
      ids: Array.from(newSet)
    }));
  };

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

  useEffect(() => {
    if (!showOnlineModal) return;

    const fetchOnlineUsers = async () => {
      setLoadingOnlineUsers(true);
      try {
        const res = await fetch("/api/online-users");
        if (res.ok) {
          const data = await res.json();
          const filtered = data.filter((u: any) => u.uid !== profile.uid);
          setOnlineUsers(filtered);
        }
      } catch (err) {
        console.error("Error loading online users:", err);
      } finally {
        setLoadingOnlineUsers(false);
      }
    };

    fetchOnlineUsers();
    const interval = setInterval(fetchOnlineUsers, 8000);
    return () => clearInterval(interval);
  }, [showOnlineModal, profile.uid]);

  const sendFriendRequest = async (targetUser: UserProfile) => {
    try {
      await updateDoc(doc(db, 'users', targetUser.uid), {
        friendRequests: arrayUnion(profile.uid)
      });
      setOnlineUsers(prev => prev.map(u => {
        if (u.uid === targetUser.uid) {
          return { ...u, friendRequests: [...(u.friendRequests || []), profile.uid] };
        }
        return u;
      }));
    } catch (err) {
      console.error("Error sending friend request:", err);
    }
  };

  const acceptFriendRequest = async (targetUser: UserProfile) => {
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        friends: arrayUnion(targetUser.uid),
        friendRequests: arrayRemove(targetUser.uid)
      });
      await updateDoc(doc(db, 'users', targetUser.uid), {
        friends: arrayUnion(profile.uid)
      });
      setOnlineUsers(prev => prev.map(u => {
        if (u.uid === targetUser.uid) {
          return { ...u, friends: [...(u.friends || []), profile.uid] };
        }
        return u;
      }));
    } catch (err) {
      console.error("Error accepting friend request:", err);
    }
  };

  const handleInitiateDuel = (targetUser: UserProfile, isLiveInvite: boolean) => {
    setMatchSelectionUser(targetUser);
    setMatchSelectionType(isLiveInvite ? '1v1' : 'training');
  };

  const getRelationStatus = (targetUser: UserProfile) => {
    const friends = profile.friends || [];
    const sentRequests = targetUser.friendRequests || [];
    const receivedRequests = profile.friendRequests || [];

    if (friends.includes(targetUser.uid)) {
      return 'friends';
    }
    if (sentRequests.includes(profile.uid)) {
      return 'sent';
    }
    if (receivedRequests.includes(targetUser.uid)) {
      return 'received';
    }
    return 'none';
  };

  const handleShareInvite = async () => {
    const shareData = {
      title: 'Rejoins-moi sur TheBestFan!',
      text: 'Viens défier les autres fans de foot sur TheBestFan.Online et deviens le meilleur fan!',
      url: window.location.origin
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.origin);
        alert('Lien d\'invitation copié ! Partage-le avec tes amis.');
      }
    } catch (err) {
      console.error('Error sharing', err);
    }
  };

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
    
    // Refresh World Cup 2026 data every minute to keep live statuses and scores up-to-date
    const interval = setInterval(() => {
      fetchWorldCup();
    }, 60 * 1000);
    
    return () => clearInterval(interval);
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

        setTemplatesMap(templatesMap);

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
    
    // Fetch some live matches and upcoming matches
    const fetchMatches = async () => {
      try {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const tomorrowStr = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd');

        const [liveFixtures, todayFixtures, tomorrowFixtures] = await Promise.all([
          footballApi.getLiveFixtures().catch(() => []),
          footballApi.getFixturesByDate(todayStr).catch(() => []),
          footballApi.getFixturesByDate(tomorrowStr).catch(() => [])
        ]);
        
        // Fetch active leagues to filter
        const leaguesSnap = await getDocs(query(collection(db, 'leagues'), where('isActive', '==', true)));
        const activeLeagueIds = leaguesSnap.docs.map(doc => Number(doc.id));
        
        const filteredFixtures = (liveFixtures || []).filter((f: any) => activeLeagueIds.includes(f.league.id));

        // Sort live matches alphabetically by country name, but put favorite teams first, then favorite leagues
        filteredFixtures.sort((a: any, b: any) => {
          const favoriteIds = profile.favoriteTeams?.map((id: any) => id.toString()) || [];
          const favoriteLeagues = profile.favoriteLeagues || [];
          
          const aIsFavTeam = favoriteIds.includes(a.teams.home.id.toString()) || favoriteIds.includes(a.teams.away.id.toString());
          const bIsFavTeam = favoriteIds.includes(b.teams.home.id.toString()) || favoriteIds.includes(b.teams.away.id.toString());
          if (aIsFavTeam && !bIsFavTeam) return -1;
          if (!aIsFavTeam && bIsFavTeam) return 1;

          const aIsFavLeague = favoriteLeagues.includes(a.league.id.toString());
          const bIsFavLeague = favoriteLeagues.includes(b.league.id.toString());
          if (aIsFavLeague && !bIsFavLeague) return -1;
          if (!aIsFavLeague && bIsFavLeague) return 1;

          const countryA = translateCountryName(a.league.country || '');
          const countryB = translateCountryName(b.league.country || '');
          return countryA.localeCompare(countryB);
        });
        // Show all live matches
        setLiveMatches(filteredFixtures);

        // Filter and sort upcoming
        const allFetched = [...(todayFixtures || []), ...(tomorrowFixtures || [])];
        const uniqueUpcomingMap = new Map();
        allFetched.forEach((f: any) => {
          if (f && f.fixture && ["NS", "TBD"].includes(f.fixture.status.short) && activeLeagueIds.includes(f.league.id)) {
            uniqueUpcomingMap.set(f.fixture.id, f);
          }
        });
        const upcomingFiltered = Array.from(uniqueUpcomingMap.values());
        upcomingFiltered.sort((a: any, b: any) => {
          const favoriteIds = profile.favoriteTeams?.map((id: any) => id.toString()) || [];
          const favoriteLeagues = profile.favoriteLeagues || [];
          
          const aIsFavTeam = favoriteIds.includes(a.teams.home.id.toString()) || favoriteIds.includes(a.teams.away.id.toString());
          const bIsFavTeam = favoriteIds.includes(b.teams.home.id.toString()) || favoriteIds.includes(b.teams.away.id.toString());
          if (aIsFavTeam && !bIsFavTeam) return -1;
          if (!aIsFavTeam && bIsFavTeam) return 1;

          const aIsFavLeague = favoriteLeagues.includes(a.league.id.toString());
          const bIsFavLeague = favoriteLeagues.includes(b.league.id.toString());
          if (aIsFavLeague && !bIsFavLeague) return -1;
          if (!aIsFavLeague && bIsFavLeague) return 1;

          return new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime();
        });
        setUpcomingMatches(upcomingFiltered);
        
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
        const res = await fetch(`/api/duels?uid=${profile.uid}`, {
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
            console.warn("Expected JSON from /api/duels, got", contentType);
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

  const fanzAlerts = React.useMemo(() => {
    const alerts: Array<{ id: string; message: string; actionTitle: string; action: () => void; Icon: any; dismissTitle?: string; dismissAction?: () => void }> = [];
    
    if (!activeFanz) {
      alerts.push({
        id: 'no-active-fanz',
        message: 'Aucun FANZ actif',
        actionTitle: 'Voir mes FANZ',
        action: () => onNavigate('fanz'),
        Icon: Flame
      });
    } else if (activeFanz) {
      const deckSize = activeFanz.equippedCards?.length || 0;
      if (deckSize < 8) {
        alerts.push({
          id: 'incomplete-deck',
          message: 'Deck incomplet',
          actionTitle: 'Compléter',
          action: () => onFanzClick?.(activeFanz.id, 'cards'),
          Icon: Database
        });
      }
    }

    // Rank upgrade alerts
    for (const fanz of allFanz) {
      if ((fanz.rank ?? 0) >= 10) continue; // Max rank reached
      
      const rankNum = (fanz.rank ?? 0) + 1;
      const slotId = `rank-${rankNum}`;
      const template = templatesMap.get(fanz.templateId);
      const rankCost = template?.rankCosts?.[slotId] || {
        money: rankNum * 1000,
        boostPoints: rankNum * 50
      };
      
      const canUpgrade = (profile.money || 0) >= (rankCost.money || 0) && 
                         (profile.boostPoints || 0) >= (rankCost.boostPoints || 0);

      const alertId = `rank-up-${fanz.id}`;
      if (canUpgrade && !dismissedAlertIDs.has(alertId)) {
        alerts.push({
          id: alertId,
          message: `Rang ${rankNum} disponible (${fanz.name})`,
          actionTitle: 'Améliorer',
          action: () => onFanzClick?.(fanz.id, 'rank'),
          dismissTitle: 'Compris',
          dismissAction: () => handleDismissAlert(alertId),
          Icon: Trophy
        });
      }
    }

    // Invitations aux Duels Privés reçues
    const privateInvites = activeDuels.filter(d => 
      d.isPrivate && 
      d.invitedUids && 
      d.invitedUids.includes(profile.uid) && 
      d.status === 'waiting' &&
      !d.participants?.some((p: any) => p.uid === profile.uid)
    );

    privateInvites.forEach(d => {
      const host = d.participants[0]?.pseudo || 'Un ami';
      const displayType = d.type === 'training' || d.type === 'training_1v1' ? "amical (?)" : "réel";
      alerts.push({
        id: `duel-invite-${d.id}`,
        message: `${host} t'invite en duel !`,
        actionTitle: 'Rejoindre',
        action: () => {
          if (onJoinSpecificDuel) {
             onJoinSpecificDuel(d.id, d.type, d.matchId);
          }
        },
        Icon: Swords
      });
    });

    return alerts;
  }, [allFanz, activeFanz, profile.money, profile.boostPoints, templatesMap, onNavigate, onFanzClick, dismissedAlertIDs, activeDuels, profile.uid, onJoinSpecificDuel]);

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

      {/* Fanz Alerts */}
      <div className="absolute top-20 left-4 z-50 flex flex-col gap-2 max-w-[60%]">
        <AnimatePresence>
          {fanzAlerts.map(alert => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-gray-900/90 backdrop-blur-md border border-white/10 rounded-xl p-2 shadow-xl flex flex-col gap-1.5"
            >
              <div className="flex items-center gap-2">
                <alert.Icon className="w-4 h-4 text-orange-500 shrink-0" />
                <span className="text-[10px] font-bold text-white leading-tight">{alert.message}</span>
              </div>
              <div className="flex gap-1.5 w-full">
                <button
                  onClick={alert.action}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-[9px] font-black uppercase py-1 rounded transition-colors text-center"
                >
                  {alert.actionTitle}
                </button>
                {alert.dismissAction && (
                  <button
                    onClick={alert.dismissAction}
                    className="flex-shrink-0 bg-white/10 hover:bg-white/20 text-white text-[9px] font-black uppercase py-1 px-2 rounded transition-colors"
                  >
                    {alert.dismissTitle}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

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

          {/* Superimposed FANZ Name (Bottom) */}
          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-black via-black/50 to-transparent flex items-end justify-between gap-3">
            <div className="flex-1 min-w-0">
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
                const isDuplicatedName = skinData.name.trim().toLowerCase() === (activeFanz.name || '').trim().toLowerCase();
                return (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {!isDuplicatedName && (
                      <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded px-2 py-0.5 text-[9px] font-black uppercase text-white shadow-sm">
                        Skin: {skinData.name}
                      </div>
                    )}
                    {skinData.energyBonus ? (
                      <div className="bg-blue-500/20 backdrop-blur-md border border-blue-500/30 rounded px-2 py-0.5 text-[9px] font-black uppercase text-blue-400 flex items-center gap-1 shadow-sm">
                        <Zap className="w-2.5 h-2.5" /> +{skinData.energyBonus} ENER Max
                      </div>
                    ) : null}
                    {skinData.moneyBonus ? (
                      <div className="bg-yellow-500/20 backdrop-blur-md border border-yellow-500/30 rounded px-2 py-0.5 text-[9px] font-black uppercase text-yellow-400 shadow-sm">
                        +{skinData.moneyBonus}% CRÉDITS
                      </div>
                    ) : null}
                    {skinData.fervorBonus ? (
                      <div className="bg-orange-500/20 backdrop-blur-md border border-orange-500/30 rounded px-2 py-0.5 text-[9px] font-black uppercase text-orange-400 shadow-sm">
                        +{skinData.fervorBonus}% FERV
                      </div>
                    ) : null}
                  </div>
                );
              })()}

              <div className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap items-center sm:gap-4 mt-3 w-full sm:w-auto">
                {/* Jauge Ferveur */}
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
                    <div className="flex flex-col gap-1 w-full sm:w-28">
                      <div className="flex justify-between items-center text-[7.5px] sm:text-[9px] font-black uppercase tracking-wider text-orange-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                        <span>Ferveur</span>
                        <span>{currentPoints}/{nextLevelPoints}</span>
                      </div>
                      <div className="h-2 bg-black/60 rounded-full border border-white/10 relative overflow-hidden shadow-inner">
                        <div 
                          className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full transition-all duration-500 relative"
                          style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                        >
                          <div className="absolute inset-0 bg-white/30 animate-[scan_2s_ease-in-out_infinite]" />
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Jauge Aptitudes / Compétences */}
                {activeFanz && (() => {
                  const stats = (activeFanz.stats || {}) as any;
                  const getStatLvl = (xp: number) => Math.min(10, Math.floor((xp || 1) / 100) + 1);
                  const totalLevels = 
                    getStatLvl(stats.force) +
                    getStatLvl(stats.endurance) +
                    getStatLvl(stats.mental) +
                    getStatLvl(stats.bluff) +
                    getStatLvl(stats.creativity) +
                    getStatLvl(stats.social) +
                    getStatLvl(stats.intelligence) +
                    getStatLvl(stats.charisma);
                  return (
                    <div className="flex flex-col gap-1 w-full sm:w-28">
                      <div className="flex justify-between items-center text-[7.5px] sm:text-[9px] font-black uppercase tracking-wider text-amber-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                        <span>Stats</span>
                        <span>{totalLevels}/80</span>
                      </div>
                      <div className="h-2 bg-black/60 rounded-full border border-white/10 relative overflow-hidden shadow-inner">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-500 relative"
                          style={{ width: `${Math.min(100, Math.max(12, (totalLevels / 80) * 100))}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* Jauge Rang */}
                {activeFanz && (() => {
                  const rank = activeFanz.rank ?? 1;
                  return (
                    <div className="flex flex-col gap-1 w-full sm:w-28">
                      <div className="flex justify-between items-center text-[7.5px] sm:text-[9px] font-black uppercase tracking-wider text-rose-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                        <span>Rang</span>
                        <span>{rank}/10</span>
                      </div>
                      <div className="h-2 bg-black/60 rounded-full border border-white/10 relative overflow-hidden shadow-inner">
                        <div 
                          className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full transition-all duration-500 relative"
                          style={{ width: `${Math.min(100, Math.max(10, (rank / 10) * 100))}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Dynamic Online Supporters Count Pill */}
            <div className="shrink-0 pb-1 flex flex-col items-end">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowOnlineModal(true);
                }}
                className="bg-black/80 backdrop-blur-md border border-emerald-500/30 rounded-full px-2.5 py-1 sm:px-3 sm:py-1.5 flex items-center gap-1.5 shadow-md shadow-emerald-950/30 cursor-pointer hover:bg-emerald-950/20 hover:border-emerald-500/60 hover:scale-105 active:scale-95 transition-all duration-200"
                title="Supporters connectés en temps réel"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] sm:text-xs font-bold uppercase text-emerald-400 tracking-wider font-mono">
                  {onlineCount} en ligne
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Content Below Video (Live Matches or Life Actions) */}
        <div className="flex-1 flex flex-col justify-evenly gap-4 py-4 shrink-0 min-h-[400px]">
          
          <DidacticielBanner
            profile={profile}
            onClickStep1={(fanzId) => fanzId ? onFanzClick?.(fanzId) : onNavigate('fanz')}
            onClickStep2={(fanzId) => onFanzClick?.(fanzId, 'cards')}
            onClickStep3={(matchId) => onMatchClick(matchId)}
            onClickStep4={() => onNavigate('favorite-teams')}
            onClickStep5={(fanzId) => onFanzClick?.(fanzId, 'stats')}
            onClickStep6={() => onNavigate('social')}
            onClickStep7={() => onNavigate('shop')}
            onClickStep8={() => onNavigate('mrfanz')} 
          />

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
              
              // Pré-calcul de la liste d'actions disponibles pour un filtrage robuste et propre
              const equippedSkinData = activeFanz?.equippedSkin && fanzTemplate ? fanzTemplate.skins?.find((s: any) => s.id === activeFanz.equippedSkin) : null;
              const filteredActions = activeFanz && fanzTemplate && !profile.activeAction ? (
                lifeActions
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
              ) : [];

              const showArrows = !isActionInProgress && filteredActions.length > 1;

              return (
                <div className="relative w-full pb-4">
                  {showArrows && (
                    <button 
                      onClick={() => scroll(scrollContainerRef, 'left')}
                      className="absolute left-1/2 -translate-x-[calc(50%+160px)] sm:-translate-x-[calc(50%+220px)] md:left-2 md:-translate-x-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-black/95 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 text-white hover:bg-white/20 hover:scale-105 transition-all shadow-[0_0_12px_rgba(0,0,0,0.5)] cursor-pointer"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                  )}

                  <div 
                    ref={scrollContainerRef}
                    className="w-full overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory"
                  >
                    <div className="flex flex-nowrap w-full items-stretch py-2">
                      {isActionInProgress ? (
                        lifeActions
                          .filter(action => action.id === profile.activeAction?.actionId)
                          .map(action => (
                            <div key={action.id} className="snap-center shrink-0 w-full flex items-stretch px-4 sm:px-[30px]">
                              <LifeActionCard 
                                action={action} 
                                fanz={activeFanz} 
                                userProfile={profile} 
                                fanzTemplate={fanzTemplate}
                              />
                            </div>
                          ))
                      ) : activeFanz && fanzTemplate && !profile.activeAction ? (
                        filteredActions.map(action => (
                          <div key={action.id} className="snap-center shrink-0 w-full flex items-stretch px-4 sm:px-[30px]">
                            <LifeActionCard 
                              action={action} 
                              fanz={activeFanz} 
                              userProfile={profile} 
                              fanzTemplate={fanzTemplate}
                            />
                          </div>
                        ))
                      ) : (
                        <div className="w-full text-center py-4 text-gray-500 text-xs font-bold uppercase px-[30px]">
                          Aucun match en direct et aucun FANZ actif
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {showArrows && (
                    <button 
                      onClick={() => scroll(scrollContainerRef, 'right')}
                      className="absolute left-1/2 translate-x-[calc(50%+120px)] sm:translate-x-[calc(50%+180px)] md:right-2 md:left-auto md:translate-x-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-black/95 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 text-white hover:bg-white/20 hover:scale-105 transition-all shadow-[0_0_12px_rgba(0,0,0,0.5)] cursor-pointer"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  )}
                </div>
              );
            })()
          )}

          {/* SECION MATCHES À VENIR S'IL N'Y A PAS DE MATCH LIVE */}
          {liveMatches.length === 0 && upcomingMatches.length > 0 && (
            <div className="pt-4 border-t border-white/5 mt-4">
              <div className="flex items-center justify-between mb-3 px-4 sm:px-[30px]">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-orange-500 animate-pulse" />
                  <span className="text-xs font-black uppercase tracking-widest text-white drop-shadow-md">
                    Matchs à venir
                  </span>
                </div>
                <span className="text-[10px] font-bold text-gray-400 bg-white/5 py-1 px-2.5 rounded-full border border-white/10 uppercase">
                  🏆 Mode Entraînement
                </span>
              </div>

              {/* Bot Message banner */}
              <div className="mx-4 sm:mx-[30px]">
                <div className="bg-gradient-to-r from-orange-500/10 to-transparent border-l-2 border-orange-500/50 p-2.5 rounded-r-lg mb-3 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black text-orange-400 uppercase tracking-tight">
                      Va t'entraîner contre des Bots
                    </span>
                    <p className="text-[9px] text-gray-400">
                      Gagne des points de ferveur à l'entraînement en solo ou défie un ami en 1v1 !
                    </p>
                  </div>
                  <Users className="w-5 h-5 text-orange-400/40 shrink-0 ml-2" />
                </div>
              </div>

              {/* Slider / List of upcoming matches */}
              <div className="relative w-full pb-2 shrink-0">
                {upcomingMatches.length > 1 && (
                  <button 
                    onClick={() => scroll(upcomingMatchesScrollRef, 'left')}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-black/90 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 text-white hover:bg-white/20 hover:scale-105 transition-all shadow-[0_0_12px_rgba(0,0,0,0.5)] cursor-pointer"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                )}

                <div 
                  ref={upcomingMatchesScrollRef}
                  className="w-full overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory"
                >
                  <div className="flex flex-nowrap w-full items-stretch py-2">
                    {upcomingMatches.slice(0, 10).map((match) => {
                      const dateObj = new Date(match.fixture.date);
                      const formattedTime = format(dateObj, 'HH:mm');
                      const formattedDay = format(dateObj, 'dd/MM');
                      
                      return (
                        <div 
                          key={match.fixture.id} 
                          className="snap-center shrink-0 w-full flex items-stretch px-4 sm:px-[30px]"
                        >
                          <div 
                            className="w-full bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-xl p-3 flex flex-col justify-between hover:border-white/20 transition-all cursor-pointer"
                            onClick={() => onMatchClick(match.fixture.id)}
                          >
                            {/* League info / Date */}
                            <div className="flex justify-between items-center mb-2.5 border-b border-white/5 pb-1.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <FavoriteLeagueStar 
                                  leagueId={match.league.id} 
                                  profile={profile} 
                                  className="p-1 -ml-1" 
                                  iconClassName="w-3 h-3"
                                />
                                <span className="text-[8px] font-bold text-gray-400 truncate max-w-[100px] uppercase">
                                  {translateLeagueName(match.league.name)}
                                </span>
                              </div>
                              <span className="text-[8px] font-black tracking-wider text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/10 uppercase">
                                {formattedDay} • {formattedTime}
                              </span>
                            </div>

                            {/* Teams */}
                            <div className="flex flex-col gap-2 mb-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {match.teams.home.logo && (
                                    <img src={match.teams.home.logo} alt="" className="w-4 h-4 object-contain shrink-0" onError={(e) => (e.currentTarget.style.display = 'none')} />
                                  )}
                                  <span className="text-[10px] font-black text-white uppercase truncate">
                                    {match.teams.home.name}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {match.teams.away.logo && (
                                    <img src={match.teams.away.logo} alt="" className="w-4 h-4 object-contain shrink-0" onError={(e) => (e.currentTarget.style.display = 'none')} />
                                  )}
                                  <span className="text-[10px] font-black text-white uppercase truncate">
                                    {match.teams.away.name}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Action Button */}
                            <button 
                              className="w-full bg-orange-600 hover:bg-orange-500 text-white text-[9px] font-black uppercase py-1.5 rounded transition-all text-center flex items-center justify-center gap-1 shadow-md shadow-orange-600/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                onMatchClick(match.fixture.id);
                              }}
                            >
                              <Swords className="w-3 h-3" />
                              S'entraîner
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {upcomingMatches.length > 1 && (
                  <button 
                    onClick={() => scroll(upcomingMatchesScrollRef, 'right')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-black/90 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 text-white hover:bg-white/20 hover:scale-105 transition-all shadow-[0_0_12px_rgba(0,0,0,0.5)] cursor-pointer"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                )}
              </div>
            </div>
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
            {worldCupStandings && worldCupStandings.length > 1 && (
              <button 
                onClick={() => scroll(worldCupScrollRef, 'left')}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-black/95 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 text-white hover:bg-white/20 hover:scale-105 transition-all shadow-[0_0_12px_rgba(0,0,0,0.5)] cursor-pointer"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            <div className="w-full">
              {worldCupStandings && worldCupStandings.length > 0 ? (
                <div 
                  ref={worldCupScrollRef}
                  className="w-full overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth no-scrollbar"
                >
                  <div className="flex flex-nowrap w-full items-stretch">
                    {worldCupStandings.map((group: any[], index: number) => {
                      const groupName = group[0]?.group || `Groupe ${String.fromCharCode(65 + index)}`;
                      return (
                        <div key={index} className="snap-center shrink-0 w-full flex flex-col px-4 sm:px-[30px]">
                          <div className="w-full bg-black/40 border border-white/10 rounded-xl overflow-hidden flex flex-col">
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
                                 const isLive = ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE'].includes(fx.fixture.status.short);
                                 const isFinished = fx.fixture.status.short === 'FT' || fx.fixture.status.short === 'AET' || fx.fixture.status.short === 'PEN';
                                 const showScore = isLive || isFinished;
                                 const elapsedStr = fx.fixture.status.elapsed ? `${fx.fixture.status.elapsed}'` : '';
                                 return (
                                 <div key={fx.fixture.id} className={`flex flex-col gap-1.5 p-2.5 bg-white/5 rounded-lg border transition-colors cursor-pointer group ${isLive ? 'border-red-500/30 bg-red-500/5 shadow-inner' : 'border-white/5 hover:border-white/10 hover:bg-white/10'}`} onClick={() => onMatchClick && onMatchClick(fx.fixture.id)}>
                                   <div className="flex justify-between items-center w-full">
                                     <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider group-hover:text-orange-400 transition-colors">
                                       {new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(fx.fixture.date))}
                                     </div>
                                     {isLive && (
                                       <div className="flex items-center gap-1 bg-red-500/10 text-red-500 border border-red-500/20 text-[8px] font-black uppercase px-2 py-0.5 rounded-full animate-pulse">
                                         <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                                         <span>LIVE {elapsedStr}</span>
                                       </div>
                                     )}
                                   </div>
                                   <div className="flex flex-col gap-1.5">
                                      <div className="flex justify-between items-center">
                                         <div className="flex items-center gap-2 overflow-hidden">
                                           <img src={getImageUrl(fx.teams.home.logo, 20)} alt="" className="w-4 h-4 object-contain rounded-sm" referrerPolicy="no-referrer" />
                                           <span className="text-xs text-white font-bold truncate">{translateCountryName(fx.teams.home.name)}</span>
                                         </div>
                                         <span className={`text-xs font-black ml-2 ${isLive ? 'text-red-500 font-extrabold animate-pulse' : 'text-gray-300'}`}>{showScore ? fx.goals.home : '-'}</span>
                                       </div>
                                       <div className="flex justify-between items-center">
                                         <div className="flex items-center gap-2 overflow-hidden">
                                           <img src={getImageUrl(fx.teams.away.logo, 20)} alt="" className="w-4 h-4 object-contain rounded-sm" referrerPolicy="no-referrer" />
                                           <span className="text-xs text-white font-bold truncate">{translateCountryName(fx.teams.away.name)}</span>
                                         </div>
                                         <span className={`text-xs font-black ml-2 ${isLive ? 'text-red-500 font-extrabold animate-pulse' : 'text-gray-300'}`}>{showScore ? fx.goals.away : '-'}</span>
                                      </div>
                                   </div>
                                 </div>
                                )})}
                             </div>
                          </div>
                        );
                      })()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="mx-4 sm:mx-[30px]">
                  <div className="w-full h-32 flex items-center justify-center border border-white/5 rounded-xl bg-white/5">
                    <div className="flex flex-col items-center gap-2 text-gray-500">
                      <div className="w-6 h-6 border-2 border-orange-500/50 border-t-orange-500 rounded-full animate-spin" />
                      <span className="text-xs font-bold uppercase">Chargement des poules...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Scroll Button */}
            {worldCupStandings && worldCupStandings.length > 1 && (
              <button 
                onClick={() => scroll(worldCupScrollRef, 'right')}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-black/95 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 text-white hover:bg-white/20 hover:scale-105 transition-all shadow-[0_0_12px_rgba(0,0,0,0.5)] cursor-pointer"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
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

  {showOnlineModal && (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-stone-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] text-white relative animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          {matchSelectionUser ? (
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => {
                  setMatchSelectionUser(null);
                  setMatchSelectionType(null);
                }}
                className="text-stone-400 hover:text-white p-1 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                title="Retour aux supporters"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-xs font-black uppercase tracking-wider text-amber-500 font-sans leading-none mb-1">
                  Défi : {matchSelectionUser.pseudo}
                </h2>
                <p className="text-[9px] text-stone-400 font-bold font-mono uppercase tracking-widest">
                  {matchSelectionType === '1v1' ? '⚡️ Duel Réel Live' : '🎯 Entraînement'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400 font-sans">
                Supporters en ligne ({onlineUsers.length})
              </h2>
            </div>
          )}
          <button
            onClick={() => {
              setShowOnlineModal(false);
              setMatchSelectionUser(null);
              setMatchSelectionType(null);
            }}
            className="text-white/50 hover:text-white p-1 hover:bg-white/5 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {matchSelectionUser ? (
          (() => {
            const isLive = matchSelectionType === '1v1';
            let displayMatches: any[] = [];
            if (isLive) {
              displayMatches = liveMatches || [];
            } else {
              const todayStr = format(new Date(), 'yyyy-MM-dd');
              const todayUpcoming = (upcomingMatches || []).filter(f => f.fixture?.date && f.fixture.date.startsWith(todayStr));
              displayMatches = todayUpcoming.length > 0 ? todayUpcoming : (upcomingMatches || []);
            }

            if (displayMatches.length === 0) {
              return (
                <div className="h-48 flex flex-col items-center justify-center text-center p-6 space-y-4">
                  <p className="text-sm text-stone-400">
                    {isLive 
                      ? "Aucun match n'est en direct pour le moment pour lancer un duel."
                      : "Aucun match à venir n'est disponible aujourd'hui pour l'entraînement."
                    }
                  </p>
                  <button
                    onClick={() => {
                      setMatchSelectionUser(null);
                      setMatchSelectionType(null);
                    }}
                    className="bg-stone-850 hover:bg-stone-800 text-xs px-4 py-2 rounded-xl font-bold transition-all border border-stone-700/60 text-stone-200 cursor-pointer active:scale-95 duration-100"
                  >
                    Retour aux supporters
                  </button>
                </div>
              );
            }

            return (
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[250px] max-h-[60vh] no-scrollbar">
                <p className="text-[10px] text-stone-400 font-mono mb-2 uppercase text-center tracking-wider font-bold">
                  Sélectionne un match pour initier le défi :
                </p>
                <div className="space-y-2.5 pb-2">
                  {displayMatches.map((match) => {
                    const dateObj = new Date(match.fixture.date);
                    const timeStr = format(dateObj, 'HH:mm');
                    const leagueName = match.league ? match.league.name : "";
                    const isMatchLive = ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE'].includes(match.fixture?.status?.short);

                    return (
                      <button
                        key={match.fixture.id}
                        onClick={() => {
                          if (onStartDirectDuel && matchSelectionUser && matchSelectionType) {
                            onStartDirectDuel(match.fixture.id, matchSelectionType, matchSelectionUser);
                            setShowOnlineModal(false);
                            setMatchSelectionUser(null);
                            setMatchSelectionType(null);
                          }
                        }}
                        className="w-full text-left bg-stone-800/40 border border-white/5 rounded-xl p-3.5 flex flex-col gap-2.5 hover:bg-stone-800/90 hover:border-emerald-500/40 active:border-emerald-500 transition-all duration-200 cursor-pointer group shadow-sm"
                      >
                        {/* Competition context */}
                        <div className="flex items-center justify-between text-[10px] text-stone-400 font-mono border-b border-white/5 pb-1.5 group-hover:text-emerald-300 transition-colors">
                          <span className="truncate max-w-[70%] font-semibold uppercase">{leagueName}</span>
                          {isMatchLive ? (
                            <span className="text-emerald-400 font-extrabold flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              LIVE {match.fixture?.status?.elapsed}'
                            </span>
                          ) : (
                            <span>Aujourd'hui à {timeStr}</span>
                          )}
                        </div>

                        {/* Match Opponents */}
                        <div className="grid grid-cols-7 items-center gap-1 py-1">
                          {/* Home Team */}
                          <div className="col-span-3 flex flex-col items-center text-center gap-1.5">
                            {match.teams?.home?.logo && (
                              <img 
                                src={getImageUrl(match.teams.home.logo, 50)} 
                                alt="" 
                                className="w-10 h-10 object-contain shadow-sm group-hover:scale-105 transition-transform" 
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                                referrerPolicy="no-referrer"
                              />
                            )}
                            <span className="text-xs font-bold leading-tight line-clamp-1 text-stone-200 group-hover:text-white transition-colors">
                              {match.teams?.home?.name}
                            </span>
                          </div>

                          {/* Mid Status Score */}
                          <div className="col-span-1 flex flex-col items-center justify-center">
                            {isMatchLive && match.goals ? (
                              <div className="bg-stone-900 border border-emerald-500/25 px-2 py-1 rounded-md text-sm font-black text-emerald-400 font-mono">
                                {match.goals.home ?? 0}-{match.goals.away ?? 0}
                              </div>
                            ) : (
                              <div className="text-[10px] font-black tracking-wider text-stone-500 font-mono text-center">
                                VS
                              </div>
                            )}
                          </div>

                          {/* Away Team */}
                          <div className="col-span-3 flex flex-col items-center text-center gap-1.5">
                            {match.teams?.away?.logo && (
                              <img 
                                src={getImageUrl(match.teams.away.logo, 50)} 
                                alt="" 
                                className="w-10 h-10 object-contain shadow-sm group-hover:scale-105 transition-transform" 
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                                referrerPolicy="no-referrer"
                              />
                            )}
                            <span className="text-xs font-bold leading-tight line-clamp-1 text-stone-200 group-hover:text-white transition-colors">
                              {match.teams?.away?.name}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[250px] max-h-[60vh]">
            {loadingOnlineUsers && onlineUsers.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center space-y-2">
                <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                <p className="text-xs text-white/50 font-mono">Recherche de supporters...</p>
              </div>
            ) : onlineUsers.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center p-6 space-y-4">
                <p className="text-sm text-stone-400">
                  Tu es le seul supporter en ligne en ce moment.
                </p>
                <button
                  onClick={handleShareInvite}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 py-2 rounded-xl font-bold transition-all shadow-md shadow-emerald-950/40 cursor-pointer active:scale-95"
                >
                  Inviter des Amis à Jouer
                </button>
              </div>
            ) : (
              onlineUsers.map((user) => {
                const relation = getRelationStatus(user);
                return (
                  <div key={user.uid} className="bg-stone-800/40 border border-white/5 rounded-xl p-3 flex flex-col gap-3 hover:border-white/10 transition-colors">
                    <div className="flex items-center justify-between">
                      {/* User Profile Info */}
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          {user.photoURL ? (
                            <img 
                              src={getImageUrl(user.photoURL)} 
                              alt={user.pseudo} 
                              className="w-10 h-10 rounded-full object-cover border border-white/20 shadow-sm"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-white text-sm border border-white/20 shadow-sm">
                              {user.pseudo ? user.pseudo.substring(0, 2).toUpperCase() : "SP"}
                            </div>
                          )}
                          <div className="absolute -bottom-1 -right-1 bg-amber-500 text-[9px] font-black text-stone-950 px-1 rounded-full border border-stone-900 shadow-sm">
                            N.{user.level || 1}
                          </div>
                        </div>
                        
                        <div>
                          <div className="font-bold text-sm text-stone-100 flex items-center gap-1.5">
                            {user.pseudo}
                          </div>
                          <div className="text-[10px] text-emerald-400 font-medium font-mono">
                            ● Actif en jeu
                          </div>
                        </div>
                      </div>

                      {/* Friend Add Button */}
                      <div>
                        {relation === 'friends' ? (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
                            <UserCheck className="w-3.5 h-3.5" />
                            Ami ✓
                          </div>
                        ) : relation === 'sent' ? (
                          <div className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full border border-amber-400/20">
                            Invité...
                          </div>
                        ) : relation === 'received' ? (
                          <button
                            onClick={() => acceptFriendRequest(user)}
                            className="flex items-center gap-1 text-[10px] font-bold text-stone-950 bg-emerald-400 hover:bg-emerald-300 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            Accepter
                          </button>
                        ) : (
                          <button
                            onClick={() => sendFriendRequest(user)}
                            className="flex items-center gap-1 text-[10px] font-bold text-stone-300 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-lg border border-white/10 transition-colors cursor-pointer active:scale-95"
                            title="Demander en ami"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            Ajouter
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Duel invitations buttons */}
                    <div className={cn(
                      "grid gap-2 pt-1 border-t border-white/5",
                      liveMatches && liveMatches.length > 0 ? "grid-cols-2" : "grid-cols-1"
                    )}>
                      <button
                        onClick={() => handleInitiateDuel(user, false)}
                        className="bg-stone-855 hover:bg-stone-800 text-stone-200 border border-stone-700/60 rounded-lg p-2 flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer active:scale-95 transition-all text-center leading-tight hover:border-stone-500"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>Entraînement 1v1</span>
                      </button>
                      {liveMatches && liveMatches.length > 0 && (
                        <button
                          onClick={() => handleInitiateDuel(user, true)}
                          className="bg-emerald-950/30 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-500/20 rounded-lg p-2 flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer active:scale-95 transition-all text-center leading-tight hover:border-emerald-500/40"
                        >
                          <Swords className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>Duel Réel 1v1</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Footer info banner */}
        <div className="p-4 border-t border-white/5 bg-stone-950/40 text-center rounded-b-2xl">
          <p className="text-[10px] text-stone-400 font-mono">
            {matchSelectionUser 
              ? "* Le duel démarrera dès la sélection du match avec ton défi privé."
              : "* Les duels d'entraînement et réels sont lancés en mode privé exclusif."
            }
          </p>
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
