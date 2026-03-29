import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { Layout, Card } from './components/Layout';
import { cn } from './lib/utils';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
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
import { WeeklyStreakModal } from './components/WeeklyStreakModal';
import { Trophy, Activity, Database, Globe, Users, Star, X, LogOut, Settings, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { signOut } from 'firebase/auth';

import { AlertProvider } from './context/AlertContext';
import { RewardProvider } from './context/RewardContext';

import { Home } from './components/Home';

import { TransactionsPage } from './components/TransactionsPage';

export default function App() {
  return (
    <AlertProvider>
      <RewardProvider>
        <AppContent />
      </RewardProvider>
    </AlertProvider>
  );
}

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'home' | 'dashboard' | 'admin' | 'matches' | 'competitions' | 'teams' | 'fanz' | 'transactions'>('home');
  const [selectedLeague, setSelectedLeague] = useState<{ id: number; season: number } | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<{ id: number; season: number } | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [selectedFanzId, setSelectedFanzId] = useState<string | null>(null);
  const [isDuelActive, setIsDuelActive] = useState(false);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    let unsubscribeSnapshot: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
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
              updatedData.energy = 100;
              updatedData.lastEnergyRefill = now.toISOString();
              needsUpdate = true;
            }

            // Check for admin role
            if (currentUser.email === 'gael.manigley@gmail.com' && data.role !== 'admin') {
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

      if (hoursDiff >= 24 && profile.energy < 100) {
        const docRef = doc(db, 'users', user.uid);
        await setDoc(docRef, {
          energy: 100,
          lastEnergyRefill: now.toISOString()
        }, { merge: true });
      }
    };

    const interval = setInterval(checkEnergy, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [user, profile]);

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

  if (view === 'home') {
    return (
      <Layout>
        <Home 
          profile={profile} 
          onNavigate={(v) => {
            setView(v);
            setSelectedLeague(null);
            setSelectedTeam(null);
            setSelectedMatchId(null);
            setSelectedFanzId(null);
          }} 
          onMenuClick={() => setIsMenuOpen(true)}
          onMatchClick={(id) => {
            console.log("onMatchClick called with id:", id);
            setSelectedMatchId(id);
            setView('matches');
          }}
          onJoinDuel={(id, isLive) => {
            setSelectedMatchId(id);
            setView('matches');
          }}
        />
      </Layout>
    );
  }

  return (
    <Layout isMobileOnly={view !== 'admin'}>
      <div className="flex flex-col min-h-screen">
        {profile && !isDuelActive && (
          <Header 
            profile={profile} 
            onHomeClick={() => {
              setView('home');
              setSelectedLeague(null);
              setSelectedTeam(null);
              setSelectedMatchId(null);
              setSelectedFanzId(null);
            }} 
            onMenuClick={() => setIsMenuOpen(true)}
            onTransactionsClick={() => setView('transactions')}
          />
        )}
        
        <div className={cn("flex-1", !selectedFanzId && "py-6 px-[30px]")}>
          {showStreakModal && profile && (
            <WeeklyStreakModal 
              profile={profile} 
              onClose={() => setShowStreakModal(false)} 
            />
          )}
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
              onBack={() => setSelectedMatchId(null)}
              onTeamClick={(id, season) => setSelectedTeam({ id, season })}
              onLeagueClick={(id, season) => setSelectedLeague({ id, season })}
            />
          ) : selectedFanzId ? (
            <FanzDetails
              fanzId={selectedFanzId}
              userProfile={profile}
              onBack={() => setSelectedFanzId(null)}
            />
          ) : view === 'admin' ? (
            <AdminZone />
          ) : view === 'matches' ? (
            <MatchesPage 
              onMatchClick={(id) => setSelectedMatchId(id)}
              onJoinDuel={(id, isLive) => {
                setSelectedMatchId(id);
                // We don't have a direct way to pass isLive to MatchDetails from here yet,
                // but MatchDetails fetches the match and determines isLive itself.
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
            <FanzPage userUid={user.uid} onFanzClick={(id) => setSelectedFanzId(id)} />
          ) : view === 'transactions' ? (
            <TransactionsPage profile={profile} onBack={() => setView('home')} />
          ) : (
            <Dashboard 
              onDuelStatusChange={setIsDuelActive}
              onTeamClick={(id, season) => setSelectedTeam({ id, season })}
              onLeagueClick={(id, season) => setSelectedLeague({ id, season })}
              onMatchClick={(id) => setSelectedMatchId(id)}
              onFanzClick={(id) => setSelectedFanzId(id)}
            />
          )}
        </div>

        {/* SIDE MENU */}
        <AnimatePresence>
          {isMenuOpen && profile && (
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-0 z-[100] bg-[#0a0a0a] flex flex-col"
            >
              <div className="p-6 flex items-center justify-between border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center border-2 border-orange-500 overflow-hidden">
                    {profile.photoURL ? (
                      <img src={profile.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-black italic uppercase tracking-wider text-orange-500">Menu</div>
                    <div className="text-xs font-bold text-white/60">{profile.pseudo}</div>
                  </div>
                </div>
                <button 
                  onClick={() => setIsMenuOpen(false)}
                  className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>
              
              <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
                <MenuButton icon={<Activity />} label="Matchs en direct" onClick={() => { setView('matches'); setIsMenuOpen(false); }} />
                <MenuButton icon={<Globe />} label="Compétitions" onClick={() => { setView('competitions'); setIsMenuOpen(false); }} />
                <MenuButton icon={<Users />} label="Équipes" onClick={() => { setView('teams'); setIsMenuOpen(false); }} />
                <MenuButton icon={<Star />} label="Mes FANZ" onClick={() => { setView('fanz'); setIsMenuOpen(false); }} />
                
                <MenuButton icon={<Settings />} label="Admin" onClick={() => { setView('admin'); setIsMenuOpen(false); }} />
              </div>

              <div className="p-8 mt-auto">
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
      </div>
    </Layout>
  );
}

function MenuButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-orange-500 transition-all group"
    >
      <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-colors">
        {icon}
      </div>
      <span className="text-lg font-black italic uppercase tracking-wider">{label}</span>
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
