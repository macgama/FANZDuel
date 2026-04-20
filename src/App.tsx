import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, query, collection, where, writeBatch } from 'firebase/firestore';
import { Layout, Card, Button } from './components/Layout';
import { cn } from './lib/utils';
import { Auth } from './components/Auth';
import { AdminZone } from './components/AdminZone';
import { MatchesPage } from './components/MatchesPage';
import { CompetitionsPage } from './components/CompetitionsPage';
import { TeamsPage } from './components/TeamsPage';
import { Header } from './components/Header';
import { MatchDetails } from './components/MatchDetails';
import { LeagueDetails } from './components/LeagueDetails';
import { TeamDetails } from './components/TeamDetails';
import { UserProfile } from './types';
import { FanzPage } from './components/FanzPage';
import { FanzDetails } from './components/FanzDetails';
import { LifeActionCard } from './components/LifeActionCard';
import { WeeklyStreakModal } from './components/WeeklyStreakModal';
import { WaitingRoom } from './components/WaitingRoom';
import { SocialPage } from './components/SocialPage';
import { FervorPathPage } from './components/FervorPathPage';
import { FavoriteTeamsPage } from './components/FavoriteTeamsPage';
import { LeaderboardPage } from './components/LeaderboardPage';
import { Rankings } from './components/Rankings';
import { PassPage } from './components/PassPage';
import { MissionsPage } from './components/MissionsPage';
import { Trophy, Activity, Database, Globe, Users, Star, X, LogOut, Settings, Menu, Swords, Store, Target, Ticket, Medal, Home as HomeIcon, AlertCircle, LayoutGrid, Layers, Briefcase, Search, Calendar, Sparkles, Wallet, BarChart2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { signOut } from 'firebase/auth';

import { AlertProvider } from './context/AlertContext';
import { RewardProvider } from './context/RewardContext';
import { SocketProvider } from './context/SocketContext';
import { GlobalSocketListener } from './components/GlobalSocketListener';

import { Home } from './components/Home';
import { ShopPage } from './components/ShopPage';

import { TransactionsPage } from './components/TransactionsPage';

export default function App() {
  return <AppContent />;
}

type ViewType = 'home' | 'admin' | 'matches' | 'competitions' | 'teams' | 'fanz' | 'transactions' | 'waiting-room' | 'social' | 'fervor-path' | 'shop' | 'missions' | 'pass' | 'duel' | 'favorite-teams' | 'leaderboard' | 'rankings';

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentDuel, setCurrentDuel] = useState<any>(null);
  const [view, _setView] = useState<ViewType>('home');
  const viewHistory = React.useRef<ViewType[]>(['home']);

  const setView = (newView: ViewType) => {
    if (newView !== view) {
      viewHistory.current.push(newView);
      _setView(newView);
    }
  };

  const [selectedLeague, setSelectedLeague] = useState<{ id: number; season: number } | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<{ id: number; season: number } | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [selectedMatchTab, setSelectedMatchTab] = useState<'summary' | 'lineups' | 'stats' | 'duels'>('summary');
  const [selectedFanzId, setSelectedFanzId] = useState<string | null>(null);
  const [isDuelActive, setIsDuelActive] = useState(false);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [joiningDuel, setJoiningDuel] = useState<{ id: string; type: string; matchId: number } | null>(null);
  const [waitingDuelsCount, setWaitingDuelsCount] = useState(0);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  const [showActiveActionModal, setShowActiveActionModal] = useState(false);
  const [activeActionDetails, setActiveActionDetails] = useState<any>(null);
  const [activeFanz, setActiveFanz] = useState<any>(null);

  useEffect(() => {
    if (showActiveActionModal && !profile?.activeAction) {
      setShowActiveActionModal(false);
    }
  }, [profile?.activeAction, showActiveActionModal]);

  useEffect(() => {
    if (!user) return;
    
    const fetchWaitingDuels = async (retries = 3) => {
      try {
        const res = await fetch('/api/duels');
        if (res.ok) {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const duels = await res.json();
            // Filter out duels where the current user is already a participant
            const waitingCount = duels.filter((d: any) => !d.participants.find((p: any) => p.uid === user.uid)).length;
            setWaitingDuelsCount(waitingCount);
          } else {
            console.warn("Expected JSON from /api/duels, got", contentType);
          }
        } else if (retries > 0) {
          setTimeout(() => fetchWaitingDuels(retries - 1), 2000);
        }
      } catch (err: any) {
        if (err?.message !== 'Failed to fetch') {
          console.error("Failed to fetch waiting duels", err);
        }
        if (retries > 0) {
          setTimeout(() => fetchWaitingDuels(retries - 1), 2000);
        }
      }
    };

    fetchWaitingDuels();
    const interval = setInterval(fetchWaitingDuels, 15000); // Reduce frequency to 15s
    return () => clearInterval(interval);
  }, [user]);

  const handleDuelIntent = async (callback: () => void) => {
    if (profile?.activeAction) {
      try {
        const actionDoc = await getDoc(doc(db, 'life_actions', profile.activeAction.actionId));
        const fanzDoc = await getDoc(doc(db, 'fanz', profile.activeAction.fanzId));
        if (actionDoc.exists() && fanzDoc.exists()) {
          setActiveActionDetails({ id: actionDoc.id, ...actionDoc.data() });
          setActiveFanz({ id: fanzDoc.id, ...fanzDoc.data() });
          setShowActiveActionModal(true);
        } else {
          callback();
        }
      } catch (err) {
        console.error("Failed to fetch active action details:", err);
        callback();
      }
    } else {
      callback();
    }
  };

  const handleBack = () => {
    if (selectedTeam) {
      setSelectedTeam(null);
    } else if (selectedLeague) {
      setSelectedLeague(null);
    } else if (selectedMatchId) {
      setSelectedMatchId(null);
      setSelectedMatchTab('summary');
      setJoiningDuel(null);
    } else if (selectedFanzId) {
      setSelectedFanzId(null);
    } else if (viewHistory.current.length > 1) {
      viewHistory.current.pop();
      const previousView = viewHistory.current[viewHistory.current.length - 1];
      _setView(previousView);
    } else if (view !== 'home') {
      _setView('home');
    }
  };

  const renderFooter = () => {
    if (isDuelActive || view === 'admin') return null;
    return (
      <footer className="md:hidden shrink-0 h-16 sm:h-20 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/5 flex items-center justify-around px-2 sm:px-8 z-50 relative shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <button onClick={() => { setView('matches'); setSelectedMatchId(null); setSelectedTeam(null); setSelectedLeague(null); setSelectedFanzId(null); }} className={`flex flex-col items-center gap-1 transition-all duration-300 ${view === 'matches' ? 'text-white scale-110' : 'text-gray-500 hover:text-white'}`}>
          <Activity className="w-6 h-6 sm:w-7 sm:h-7" />
          <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">Live</span>
        </button>
        <button onClick={() => { setView('rankings'); setSelectedMatchId(null); setSelectedTeam(null); setSelectedLeague(null); setSelectedFanzId(null); }} className={`flex flex-col items-center gap-1 transition-all duration-300 ${view === 'rankings' ? 'text-white scale-110' : 'text-gray-500 hover:text-white'}`}>
          <Trophy className="w-6 h-6 sm:w-7 sm:h-7" />
          <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">Rank</span>
        </button>
        <button onClick={() => { setView('waiting-room'); setSelectedMatchId(null); setSelectedTeam(null); setSelectedLeague(null); setSelectedFanzId(null); }} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition-all duration-300 relative -top-5 sm:-top-7 group">
          <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center border-4 border-[#0a0a0a] shadow-xl transition-all duration-300 relative ${view === 'waiting-room' ? 'bg-orange-500 shadow-orange-500/50 scale-110' : 'bg-orange-600 shadow-orange-600/20 group-hover:scale-105'} ${waitingDuelsCount > 0 && view !== 'waiting-room' ? 'animate-[pulse_2s_ease-in-out_infinite] shadow-[0_0_20px_rgba(249,115,22,0.6)]' : ''}`}>
            <Swords className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            {waitingDuelsCount > 0 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-[#0a0a0a] flex items-center justify-center text-[10px] font-black text-white shadow-lg">
                {waitingDuelsCount}
              </div>
            )}
          </div>
          <span className={`text-[10px] sm:text-xs font-black uppercase tracking-widest mt-1 ${view === 'waiting-room' ? 'text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]' : 'text-orange-600'}`}>Duel</span>
        </button>
        <button onClick={() => { setView('fanz'); setSelectedMatchId(null); setSelectedTeam(null); setSelectedLeague(null); setSelectedFanzId(null); }} className={`flex flex-col items-center gap-1 transition-all duration-300 ${view === 'fanz' ? 'text-white scale-110' : 'text-gray-500 hover:text-white'}`}>
          <Star className="w-6 h-6 sm:w-7 sm:h-7" />
          <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">Fanz</span>
        </button>
        <button onClick={() => { setView('social'); setSelectedMatchId(null); setSelectedTeam(null); setSelectedLeague(null); setSelectedFanzId(null); }} className={`flex flex-col items-center gap-1 transition-all duration-300 ${view === 'social' ? 'text-white scale-110' : 'text-gray-500 hover:text-white'}`}>
          <Users className="w-6 h-6 sm:w-7 sm:h-7" />
          <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">Social</span>
        </button>
      </footer>
    );
  };

  useEffect(() => {
    let unsubscribeSnapshot: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setLoading(true); // Ensure loading is true while fetching profile
        const docRef = doc(db, 'users', currentUser.uid);
        
        unsubscribeSnapshot = onSnapshot(docRef, async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            let needsUpdate = false;
            let updatedData = { ...data };

            // Check for 24h energy refill
            const lastRefill = new Date(data.lastEnergyRefill || new Date().toISOString());
            const now = new Date();
            const hoursDiff = (now.getTime() - lastRefill.getTime()) / (1000 * 60 * 60);

            if (hoursDiff >= 24) {
              updatedData.energy = data.maxEnergy || 100;
              updatedData.lastEnergyRefill = now.toISOString();
              needsUpdate = true;
            }

            // Check for admin role
            if ((currentUser.email === 'gael.manigley@gmail.com') && data.role !== 'admin') {
              updatedData.role = 'admin';
              needsUpdate = true;
            }

            // Weekly Streak Logic
            const today = new Date().toISOString().split('T')[0];
            const lastLogin = data.lastLoginDate;

            if (!lastLogin) {
              // First time login
              updatedData.streak = 1;
              updatedData.lastLoginDate = today;
              updatedData.claimedStreakDays = [];
              needsUpdate = true;
              setShowStreakModal(true);
            } else if (lastLogin !== today) {
              const lastDate = new Date(lastLogin);
              const todayDate = new Date(today);
              const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

              if (diffDays === 1) {
                // Consecutive login
                if (data.streak >= 7) {
                  updatedData.streak = 1;
                  updatedData.claimedStreakDays = [];
                } else {
                  updatedData.streak = (data.streak || 0) + 1;
                }
              } else {
                // Missed a day or more
                updatedData.streak = 1;
                updatedData.claimedStreakDays = [];
              }
              
              updatedData.lastLoginDate = today;
              needsUpdate = true;
              setShowStreakModal(true);
            } else {
              // Already logged in today, check if reward claimed
              if (!data.claimedStreakDays?.includes(data.streak || 1)) {
                setShowStreakModal(true);
              }
            }

            if (needsUpdate) {
              await setDoc(docRef, updatedData, { merge: true });
            } else {
              setProfile(updatedData);
            }
          } else {
            setProfile(null);
          }
          setLoading(false);
        }, (error) => {
          console.error("Profile snapshot error:", error);
          if (error.message?.includes('Quota limit exceeded') || error.message?.includes('quota')) {
            setQuotaExceeded(true);
          }
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
        if (unsubscribeSnapshot) unsubscribeSnapshot();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  // Periodic check for energy refill
  useEffect(() => {
    if (!user || !profile) return;

    const checkEnergy = async () => {
      const lastRefill = new Date(profile.lastEnergyRefill || new Date().toISOString());
      const now = new Date();
      const hoursDiff = (now.getTime() - lastRefill.getTime()) / (1000 * 60 * 60);

      if (hoursDiff >= 24 && profile.energy < (profile.maxEnergy || 100)) {
        const docRef = doc(db, 'users', user.uid);
        await setDoc(docRef, {
          energy: profile.maxEnergy || 100,
          lastEnergyRefill: now.toISOString()
        }, { merge: true });
      }
    };

    const interval = setInterval(checkEnergy, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [user, profile]);

  if (quotaExceeded) {
    return (
      <Layout containerClassName="flex flex-col items-center justify-center p-8 text-center">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black uppercase italic text-white mb-4">Quota de lecture dépassé</h2>
          <p className="text-gray-400 mb-6">
            L'application a atteint sa limite quotidienne de lectures Firestore. 
            Le service sera rétabli automatiquement demain.
          </p>
          <Button onClick={() => window.location.reload()} className="bg-red-500 hover:bg-red-600">
            Réessayer
          </Button>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout containerClassName="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-orange-500"></div>
      </Layout>
    );
  }

  if (!user || (!profile && !loading)) {
    return (
      <Layout containerClassName="flex flex-col">
        <Auth onAuthSuccess={() => {}} />
      </Layout>
    );
  }

  return (
    <Layout containerClassName="md:flex-row">
      <GlobalSocketListener onDuelStarting={(duelId, duelData) => {
        setCurrentDuel(duelData);
        setView('duel');
      }} />

      {profile && !isDuelActive && view !== 'admin' && view !== ('duel' as any) && (
        <aside className="hidden md:flex flex-col w-20 lg:w-64 bg-[#0a0a0a]/95 backdrop-blur-3xl border-r border-white/5 h-[100dvh] shrink-0 shadow-[20px_0_40px_rgba(0,0,0,0.5)] z-40 overflow-y-auto relative">
          <div className="p-4 lg:p-6 flex items-center gap-3 border-b border-white/5 shrink-0 justify-center lg:justify-start">
            <img src="/img/logo2.png" alt="TBFO" className="w-8 h-8 rounded-lg outline outline-1 outline-white/10" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <span className="hidden lg:block font-black italic text-xl uppercase tracking-widest text-white">TBFO</span>
          </div>
          <div className="flex flex-col gap-1 p-2 lg:p-4 flex-1 overflow-y-auto no-scrollbar">
             <SidebarButton icon={<HomeIcon />} label="Accueil" active={view==='home'} onClick={() => { setView('home'); setSelectedMatchId(null); setSelectedTeam(null); setSelectedLeague(null); setSelectedFanzId(null); }} />
             <SidebarButton icon={<Star />} label="Mes Fans" active={view==='fanz'} onClick={() => { setView('fanz'); setSelectedMatchId(null); setSelectedTeam(null); setSelectedLeague(null); setSelectedFanzId(null); }} />
             <SidebarButton 
                icon={<div className="relative"><Swords />
                  {waitingDuelsCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center text-[8px] font-black text-white">{waitingDuelsCount}</div>
                  )}
                </div>} 
                label="Duels" active={view==='waiting-room'} onClick={() => { setView('waiting-room'); setSelectedMatchId(null); setSelectedTeam(null); setSelectedLeague(null); setSelectedFanzId(null); }} />
             
             <div className="mt-2 pt-2 border-t border-white/5 flex flex-col gap-1">
                 <h4 className="hidden lg:block text-[10px] font-black uppercase text-gray-500 px-4 mb-1 tracking-widest">Fonctions</h4>
                 <SidebarButton icon={<Layers />} label="Arsenal" active={view==='favorite-teams'} onClick={() => { setView('favorite-teams'); setSelectedMatchId(null); setSelectedTeam(null); setSelectedLeague(null); setSelectedFanzId(null); }} />
                 <SidebarButton icon={<Briefcase />} label="Fanlife" active={view==='fervor-path'} onClick={() => { setView('fervor-path'); setSelectedMatchId(null); setSelectedTeam(null); setSelectedLeague(null); setSelectedFanzId(null); }} />
                 <SidebarButton icon={<Target />} label="Missions" active={view==='missions'} onClick={() => { setView('missions'); setSelectedMatchId(null); setSelectedTeam(null); setSelectedLeague(null); setSelectedFanzId(null); }} />
                 <SidebarButton icon={<Calendar />} label="Série" active={false} onClick={() => { setShowStreakModal(true); }} />
                 <SidebarButton icon={<Sparkles />} label="Pass" active={view==='pass'} onClick={() => { setView('pass'); setSelectedMatchId(null); setSelectedTeam(null); setSelectedLeague(null); setSelectedFanzId(null); }} />
             </div>

             <div className="mt-2 pt-2 border-t border-white/5 flex flex-col gap-1">
                 <h4 className="hidden lg:block text-[10px] font-black uppercase text-gray-500 px-4 mb-1 tracking-widest">Connect</h4>
                 <SidebarButton icon={<Users />} label="Social" active={view==='social'} onClick={() => { setView('social'); setSelectedMatchId(null); setSelectedTeam(null); setSelectedLeague(null); setSelectedFanzId(null); }} />
                 <SidebarButton icon={<Activity />} label="Matchs" active={view==='matches'} onClick={() => { setView('matches'); setSelectedMatchId(null); setSelectedTeam(null); setSelectedLeague(null); setSelectedFanzId(null); }} />
                 <SidebarButton icon={<Globe />} label="Compétitions" active={view==='competitions'} onClick={() => { setView('competitions'); setSelectedMatchId(null); setSelectedTeam(null); setSelectedLeague(null); setSelectedFanzId(null); }} />
                 <SidebarButton icon={<BarChart2 />} label="Stats" active={view==='rankings'} onClick={() => { setView('rankings'); setSelectedMatchId(null); setSelectedTeam(null); setSelectedLeague(null); setSelectedFanzId(null); }} />
                 <SidebarButton icon={<Wallet />} label="Banque" active={view==='transactions'} onClick={() => { setView('transactions'); setSelectedMatchId(null); setSelectedTeam(null); setSelectedLeague(null); setSelectedFanzId(null); }} />
                 <SidebarButton icon={<Settings />} label="Admin" active={view===('admin' as any)} onClick={() => { setView('admin' as any); setSelectedMatchId(null); setSelectedTeam(null); setSelectedLeague(null); setSelectedFanzId(null); }} />
             </div>

             <div className="mt-auto border-t border-white/5 pt-4 flex flex-col gap-1">
                <SidebarButton icon={<Store />} label="Boutique" active={view==='shop'} onClick={() => { setView('shop'); setSelectedMatchId(null); setSelectedTeam(null); setSelectedLeague(null); setSelectedFanzId(null); }} />
                <SidebarButton icon={<LogOut />} label="Quitter" active={false} onClick={() => signOut(auth)} isDanger />
             </div>
          </div>
        </aside>
      )}

      <div className="flex-1 flex flex-col overflow-hidden relative min-h-0 bg-black/40">
        {view === 'home' ? (
          <Home 
            profile={profile} 
            onNavigate={(v) => {
              setView(v);
              setSelectedLeague(null);
              setSelectedTeam(null);
              setSelectedMatchId(null);
              setSelectedFanzId(null);
            }} 
            onMenuClick={() => {
              console.log("Menu clicked from Home!");
              setIsMenuOpen(true);
            }}
            onMatchClick={(id, tab = 'summary') => {
              console.log("onMatchClick called with id:", id);
              setSelectedMatchId(id);
              setSelectedMatchTab(tab as 'summary' | 'lineups' | 'stats' | 'duels');
              setView('matches');
            }}
            onJoinDuel={(id, isLive) => {
              handleDuelIntent(() => {
                setSelectedMatchId(id);
                setView('matches');
              });
            }}
            onOpenStreak={() => setShowStreakModal(true)}
          />
        ) : (
          <>
            {profile && !isDuelActive && (
              <Header 
                profile={profile} 
                variant={(view as string) === 'home' ? 'home' : 'subpage'}
                onBackClick={(view as string) === 'home' ? undefined : handleBack}
                onHomeClick={(view as string) === 'home' ? undefined : () => {
                  setView('home');
                  setSelectedLeague(null);
                  setSelectedTeam(null);
                  setSelectedMatchId(null);
                  setSelectedFanzId(null);
                }} 
                onMenuClick={() => {
                  console.log("Menu clicked from Header!");
                  setIsMenuOpen(true);
                }}
                onTransactionsClick={() => setView('transactions')}
                onFervorClick={() => setView('fervor-path')}
              />
            )}
            
            <div className={cn(
              "flex-1 overflow-y-auto pb-6", 
              (!selectedFanzId && !selectedMatchId && !selectedLeague && !selectedTeam && !['matches', 'fervor-path', 'rankings', 'social', 'missions', 'pass', 'shop', 'favorite-teams', 'transactions'].includes(view as string)) && "px-[30px]", 
              (selectedFanzId || selectedMatchId || selectedLeague || selectedTeam || ['matches', 'fervor-path', 'rankings', 'social', 'missions', 'pass', 'shop', 'favorite-teams', 'transactions'].includes(view as string)) && "px-0"
            )}>
              <div className="w-full max-w-3xl mx-auto h-full lg:border-x border-white/5 shadow-2xl relative">
              {selectedTeam ? (
                <TeamDetails 
                  teamId={selectedTeam.id} 
                  season={selectedTeam.season} 
                  onBack={() => setSelectedTeam(null)} 
                  onLeagueClick={(id, season) => setSelectedLeague({ id, season })}
                  onTeamClick={(id, season) => setSelectedTeam({ id, season })}
                />
              ) : selectedLeague ? (
                <LeagueDetails 
                  leagueId={selectedLeague.id} 
                  season={selectedLeague.season} 
                  onBack={() => setSelectedLeague(null)}
                  onTeamClick={(id, season) => setSelectedTeam({ id, season })}
                />
              ) : selectedMatchId ? (
                <MatchDetails 
                  fixtureId={selectedMatchId} 
                  user={profile}
                  initialTab={selectedMatchTab}
                  initialDuelId={joiningDuel?.id}
                  initialDuelType={joiningDuel?.type}
                  onDuelStatusChange={setIsDuelActive}
                  onDuelIntent={handleDuelIntent}
                  onBack={() => {
                    setSelectedMatchId(null);
                    setSelectedMatchTab('summary');
                    setJoiningDuel(null);
                  }}
                  onTeamClick={(id, season) => setSelectedTeam({ id, season })}
                  onLeagueClick={(id, season) => setSelectedLeague({ id, season })}
                  onFanzClick={(id) => {
                    setSelectedMatchId(null);
                    setSelectedFanzId(id);
                  }}
                />
              ) : selectedFanzId ? (
                <FanzDetails
                  fanzId={selectedFanzId}
                  userProfile={profile}
                  onBack={() => setSelectedFanzId(null)}
                />
              ) : view === 'waiting-room' ? (
                <WaitingRoom 
                  user={profile} 
                  onBack={() => setView('home')} 
                  onJoinDuel={(id, type, matchId) => {
                    handleDuelIntent(() => {
                      setJoiningDuel({ id, type, matchId });
                      setSelectedMatchId(matchId);
                      setView('matches');
                    });
                  }}
                  onMatchClick={(matchId) => {
                    setSelectedMatchId(matchId);
                    setSelectedMatchTab('summary');
                    setView('matches');
                  }}
                />
              ) : view === 'admin' ? (
                <AdminZone />
              ) : view === 'matches' ? (
                <MatchesPage 
                  onMatchClick={(id, tab = 'summary') => {
                    setSelectedMatchId(id);
                    setSelectedMatchTab(tab);
                  }}
                  onJoinDuel={(id, isLive) => {
                    handleDuelIntent(() => {
                      setSelectedMatchId(id);
                      setSelectedMatchTab('summary');
                    });
                  }}
                  onTeamClick={(id, season) => setSelectedTeam({ id, season })}
                  onLeagueClick={(id, season) => setSelectedLeague({ id, season })}
                />
              ) : view === 'competitions' ? (
                <CompetitionsPage 
                  onLeagueClick={(id, season) => setSelectedLeague({ id, season })}
                />
              ) : view === 'teams' ? (
                <TeamsPage 
                  onTeamClick={(id, season) => setSelectedTeam({ id, season })}
                />
              ) : view === 'fanz' ? (
                <FanzPage userProfile={profile} onFanzClick={(id) => setSelectedFanzId(id)} />
              ) : view === 'transactions' ? (
                <TransactionsPage profile={profile} onBack={() => setView('home')} />
              ) : view === 'social' ? (
                <SocialPage user={profile} onBack={() => setView('home')} />
              ) : view === 'fervor-path' ? (
                <FervorPathPage profile={profile} onBack={() => setView('home')} />
              ) : view === 'favorite-teams' ? (
                <FavoriteTeamsPage profile={profile} onBack={() => setView('home')} />
              ) : view === 'leaderboard' ? (
                <LeaderboardPage />
              ) : view === 'rankings' ? (
                <Rankings onBack={() => setView('home')} />
              ) : view === 'shop' ? (
                <ShopPage profile={profile} onBack={() => setView('home')} />
              ) : view === 'missions' ? (
                <MissionsPage profile={profile} onBack={() => setView('home')} />
              ) : view === 'pass' ? (
                <PassPage profile={profile} onBack={() => setView('home')} />
              ) : null}
              </div>
            </div>
          </>
        )}

        {showStreakModal && profile && (
          <WeeklyStreakModal 
            profile={profile} 
            onClose={() => setShowStreakModal(false)} 
          />
        )}
      </div>
      
      {/* Menu Modal */}
      <AnimatePresence>
        {isMenuOpen && profile && (
          <motion.div 
            key="side-menu"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute inset-0 z-[100] bg-[#0a0a0a] flex flex-col"
          >
          <div className="p-6 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="text-orange-500">
                <LayoutGrid className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-black uppercase tracking-wider text-white">Menu TBFO</h2>
            </div>
            <button 
              onClick={() => setIsMenuOpen(false)}
              className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 sm:p-8">
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <MenuButton icon={<HomeIcon />} label="Accueil" onClick={() => { setView('home'); setIsMenuOpen(false); }} />
              <MenuButton icon={<Users />} label="Mes Fans" onClick={() => { setView('fanz'); setIsMenuOpen(false); }} />
              <MenuButton 
                icon={
                  <div className="relative">
                    <Swords />
                    {waitingDuelsCount > 0 && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-[#0a0a0a] flex items-center justify-center text-[8px] font-black text-white">
                        {waitingDuelsCount}
                      </div>
                    )}
                  </div>
                } 
                label="Duels" 
                onClick={() => { setView('waiting-room'); setIsMenuOpen(false); }} 
              />
              
              <MenuButton icon={<Layers />} label="Arsenal" onClick={() => { setView('favorite-teams'); setIsMenuOpen(false); }} />
              <MenuButton icon={<Briefcase />} label="Fanlife" onClick={() => { setView('fervor-path'); setIsMenuOpen(false); }} />
              <MenuButton icon={<Store />} label="Boutique" onClick={() => { setView('shop'); setIsMenuOpen(false); }} />
              
              <MenuButton icon={<Search />} label="Social" onClick={() => { setView('social'); setIsMenuOpen(false); }} />
              <MenuButton icon={<Target />} label="Missions" onClick={() => { setView('missions'); setIsMenuOpen(false); }} />
              <MenuButton icon={<Calendar />} label="Série" onClick={() => { setShowStreakModal(true); setIsMenuOpen(false); }} />
              
              <MenuButton icon={<Sparkles />} label="Pass" onClick={() => { setView('pass'); setIsMenuOpen(false); }} />
              <MenuButton icon={<Wallet />} label="Banque" onClick={() => { setView('transactions'); setIsMenuOpen(false); }} />
              <MenuButton icon={<BarChart2 />} label="Stats" onClick={() => { setView('rankings'); setIsMenuOpen(false); }} />



              {/* Extra items not in the image but needed */}
              <MenuButton icon={<Activity />} label="Matchs" onClick={() => { setView('matches'); setIsMenuOpen(false); }} />
              <MenuButton icon={<Globe />} label="Compétitions" onClick={() => { setView('competitions'); setIsMenuOpen(false); }} />
              <MenuButton icon={<Settings />} label="Admin" onClick={() => { setView('admin'); setIsMenuOpen(false); }} />
            </div>
          </div>

          <div className="p-4 sm:p-8 mt-auto border-t border-white/10 shrink-0">
            <button 
              onClick={() => signOut(auth)}
              className="w-full flex items-center justify-center gap-3 p-4 bg-red-500/10 text-red-500 rounded-xl font-bold hover:bg-red-500/20 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Déconnexion
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Active Action Modal */}
    {showActiveActionModal && activeActionDetails && activeFanz && profile && (
      <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
        <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 w-full max-w-md overflow-hidden flex flex-col relative">
          <button 
            onClick={() => setShowActiveActionModal(false)} 
            className="absolute top-4 right-4 text-gray-400 hover:text-white z-10"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="p-6">
            <h3 className="text-xl font-black text-white uppercase italic mb-4 text-center">Action en cours</h3>
            <p className="text-sm text-gray-400 text-center mb-6">Vous ne pouvez pas rejoindre ou créer un duel pendant qu'une action de vie est en cours.</p>
            <LifeActionCard 
              action={activeActionDetails} 
              fanz={activeFanz} 
              userProfile={profile} 
            />
          </div>
        </div>
      </div>
    )}

    {renderFooter()}
    </Layout>
  );
}

function SidebarButton({ active, onClick, icon, label, isDanger = false }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; isDanger?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col lg:flex-row items-center justify-center lg:justify-start gap-2 lg:gap-4 p-3 lg:px-4 lg:py-3 rounded-xl transition-all font-black uppercase italic tracking-wider text-[10px] lg:text-sm w-full group",
        active 
          ? "bg-orange-600 text-white shadow-lg shadow-orange-600/20"
          : isDanger ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" : "text-gray-400 hover:text-white hover:bg-white/5"
      )}
    >
      <div className={cn("w-6 h-6 flex items-center justify-center transition-transform", active ? "scale-110" : "group-hover:scale-110")}>
        {icon}
      </div>
      <span className="truncate">{label}</span>
      {active && <div className="absolute right-0 w-1 h-8 bg-white rounded-l-full hidden lg:block" />}
    </button>
  );
}

function MenuButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-3 p-4 bg-[#0a0a0a] border border-white/5 rounded-2xl hover:bg-white/10 hover:border-orange-500 transition-all group aspect-square"
    >
      <div className="w-12 h-12 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-colors">
        {icon}
      </div>
      <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-center leading-tight text-white">{label}</span>
    </button>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-bold uppercase italic text-xs tracking-wider ${
        active 
          ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' 
          : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
