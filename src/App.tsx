import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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
import { Trophy, Activity, Database, Globe, Users, Star } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'admin' | 'matches' | 'competitions' | 'teams' | 'fanz'>('matches');
  const [selectedLeague, setSelectedLeague] = useState<{ id: number; season: number } | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<{ id: number; season: number } | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [isDuelActive, setIsDuelActive] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          if (user.email === 'gael.manigley@gmail.com' && data.role !== 'admin') {
            await setDoc(docRef, { ...data, role: 'admin' }, { merge: true });
            setProfile({ ...data, role: 'admin' });
          } else {
            setProfile(data);
          }
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <Layout className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-orange-500"></div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout className="p-8">
        <Auth onAuthSuccess={() => {}} />
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
            <FanzPage userUid={user.uid} />
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
