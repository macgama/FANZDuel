import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { Layout } from './components/Layout';
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
import { Trophy, Activity, Database, Globe, Users, Star } from 'lucide-react';

import { AlertProvider } from './context/AlertContext';

export default function App() {
  return (
    <AlertProvider>
      <AppContent />
    </AlertProvider>
  );
}

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'admin' | 'matches' | 'competitions' | 'teams' | 'fanz'>('matches');
  const [selectedLeague, setSelectedLeague] = useState<{ id: number; season: number } | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<{ id: number; season: number } | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [selectedFanzId, setSelectedFanzId] = useState<string | null>(null);
  const [isDuelActive, setIsDuelActive] = useState(false);

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
      <Layout className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-orange-500"></div>
      </Layout>
    );
  }

  if (!user || !profile) {
    return (
      <Layout className="p-8">
        <Auth onAuthSuccess={() => window.location.reload()} />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col min-h-screen">
        {profile && !isDuelActive && <Header profile={profile} />}
        
        {!isDuelActive && (
          <div className="bg-gray-800/50 backdrop-blur-md border-b border-white/10 p-2 flex justify-center gap-2 md:gap-4 text-sm font-medium sticky top-[57px] z-40 overflow-x-auto no-scrollbar">
            <NavButton 
              active={view === 'matches'} 
              onClick={() => setView('matches')}
              icon={<Activity className="w-4 h-4" />}
              label="Matchs"
            />
            <NavButton 
              active={view === 'competitions'} 
              onClick={() => setView('competitions')}
              icon={<Globe className="w-4 h-4" />}
              label="Compétitions"
            />
            <NavButton 
              active={view === 'teams'} 
              onClick={() => setView('teams')}
              icon={<Users className="w-4 h-4" />}
              label="Équipes"
            />
            <NavButton 
              active={view === 'fanz'} 
              onClick={() => setView('fanz')}
              icon={<Star className="w-4 h-4" />}
              label="FANZ"
            />
            <NavButton 
              active={view === 'dashboard'} 
              onClick={() => setView('dashboard')}
              icon={<Trophy className="w-4 h-4" />}
              label="Carrière"
            />
            {profile?.role === 'admin' && (
              <NavButton 
                active={view === 'admin'} 
                onClick={() => setView('admin')}
                icon={<Database className="w-4 h-4" />}
                label="Admin"
              />
            )}
          </div>
        )}

        <div className="flex-1 py-6 px-4">
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
          ) : view === 'admin' && profile?.role === 'admin' ? (
            <AdminZone />
          ) : view === 'matches' ? (
            <MatchesPage 
              onMatchClick={(id) => setSelectedMatchId(id)}
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
          ) : (
            <Dashboard 
              onDuelStatusChange={setIsDuelActive}
              onTeamClick={(id, season) => setSelectedTeam({ id, season })}
              onLeagueClick={(id, season) => setSelectedLeague({ id, season })}
              onMatchClick={(id) => setSelectedMatchId(id)}
            />
          )}
        </div>
      </div>
    </Layout>
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
