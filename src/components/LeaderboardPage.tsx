import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { Card, Button } from './Layout';
import { Trophy, Users, Shield, Flame, Star, Activity, ChevronDown, Medal } from 'lucide-react';
import { UserProfile } from '../types';
import { getImageUrl, cn } from '../lib/utils';
import { footballDataService } from '../services/footballDataService';
import { footballApi } from '../services/footballApi';

type LeaderboardTab = 'teams' | 'users';
type TeamMetric = 'ferveurEarned' | 'totalScoreGiven' | 'averageScore' | 'userCount';
type UserMetric = 'ferveurPoints' | 'totalScoreGiven' | 'averageScore';

export function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('teams');
  
  // Teams State
  const [teams, setTeams] = useState<any[]>([]);
  const [teamMetric, setTeamMetric] = useState<TeamMetric>('ferveurEarned');
  const [teamView, setTeamView] = useState<'general' | 'competition'>('general');
  const [leagues, setLeagues] = useState<any[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);
  const [leagueTeams, setLeagueTeams] = useState<Set<number>>(new Set());
  const [loadingTeams, setLoadingTeams] = useState(true);

  // Users State
  const [users, setUsers] = useState<any[]>([]);
  const [userMetric, setUserMetric] = useState<UserMetric>('ferveurPoints');
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Fetch Teams Data
  useEffect(() => {
    const fetchTeams = async () => {
      setLoadingTeams(true);
      try {
        const snapshot = await getDocs(collection(db, 'teams'));
        const teamsData = await Promise.all(snapshot.docs.map(async (docSnapshot) => {
          const data = docSnapshot.data();
          let leagueIds = data.leagueIds;
          
          // Backfill leagueIds if missing
          if (!leagueIds && !isNaN(Number(docSnapshot.id))) {
            try {
              const leaguesData = await footballApi.getLeaguesByTeam(Number(docSnapshot.id));
              leagueIds = leaguesData.map((l: any) => l.league.id);
              await updateDoc(doc(db, 'teams', docSnapshot.id), { leagueIds });
            } catch (e) {
              console.error("Failed to backfill leagues for team", docSnapshot.id, e);
            }
          }

          return {
            id: docSnapshot.id,
            ...data,
            leagueIds,
            averageScore: data.matchesPlayed > 0 
              ? Math.round((data.totalScoreGiven || 0) / data.matchesPlayed) 
              : 0
          };
        }));
        setTeams(teamsData);
      } catch (error) {
        console.error("Error fetching teams leaderboard:", error);
      } finally {
        setLoadingTeams(false);
      }
    };
    fetchTeams();
  }, []);

  // Fetch Leagues for Competition View
  useEffect(() => {
    const fetchLeagues = async () => {
      try {
        const data = await footballDataService.getLeagues();
        
        // Filter leagues to only show those that have at least one team in the `teams` collection
        // A team in the `teams` collection might have `leagueIds` array.
        const activeLeagueIds = new Set<number>();
        teams.forEach(t => {
          if (t.leagueIds && Array.isArray(t.leagueIds)) {
            t.leagueIds.forEach((id: number) => activeLeagueIds.add(id));
          }
        });

        const filteredLeagues = data.filter((l: any) => activeLeagueIds.has(l.league.id));
        
        setLeagues(filteredLeagues);
        if (filteredLeagues.length > 0) {
          setSelectedLeagueId(filteredLeagues[0].league.id);
        }
      } catch (error) {
        console.error("Error fetching leagues:", error);
      }
    };
    if (teams.length > 0) {
      fetchLeagues();
    }
  }, [teams]);

  // Fetch Teams for Selected League
  useEffect(() => {
    const fetchLeagueTeams = async () => {
      if (!selectedLeagueId) return;
      try {
        const currentYear = new Date().getFullYear();
        const data = await footballDataService.getTeams(selectedLeagueId, currentYear);
        const teamIds = new Set<number>(data.map((t: any) => t.team.id));
        setLeagueTeams(teamIds);
      } catch (error) {
        console.error("Error fetching league teams:", error);
      }
    };
    if (teamView === 'competition') {
      fetchLeagueTeams();
    }
  }, [selectedLeagueId, teamView]);

  // Fetch Users Data
  useEffect(() => {
    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        const usersData = snapshot.docs.map(doc => {
          const data = doc.data() as UserProfile;
          return {
            ...data,
            averageScore: data.matchesParticipated && data.matchesParticipated > 0
              ? Math.round((data.totalScoreGiven || 0) / data.matchesParticipated)
              : 0
          };
        });
        setUsers(usersData);
      } catch (error) {
        console.error("Error fetching users leaderboard:", error);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  // Processed Teams
  const sortedTeams = useMemo(() => {
    let filtered = teams;
    if (teamView === 'competition' && selectedLeagueId) {
      filtered = teams.filter(t => leagueTeams.has(Number(t.id)));
    }
    return [...filtered].sort((a, b) => (b[teamMetric] || 0) - (a[teamMetric] || 0));
  }, [teams, teamMetric, teamView, selectedLeagueId, leagueTeams]);

  // Processed Users
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => (b[userMetric] || 0) - (a[userMetric] || 0)).slice(0, 100); // Top 100
  }, [users, userMetric]);

  const renderRankIcon = (index: number) => {
    if (index === 0) return <Medal className="w-5 h-5 text-yellow-500 drop-shadow-lg" />;
    if (index === 1) return <Medal className="w-5 h-5 text-gray-400 drop-shadow-lg" />;
    if (index === 2) return <Medal className="w-5 h-5 text-orange-800 drop-shadow-lg" />;
    return <span className="text-xs font-black text-gray-500">#{index + 1}</span>;
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/10 pb-3">
        <h1 className="text-2xl font-black italic uppercase tracking-wider">Classements</h1>
      </div>

      {/* Main Tabs */}
      <div className="flex bg-black/50 p-1 rounded-xl border border-white/10">
        <button
          onClick={() => setActiveTab('teams')}
          className={cn(
            "flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2",
            activeTab === 'teams' ? "bg-orange-500 text-white shadow-lg" : "text-gray-400 hover:text-white hover:bg-white/5"
          )}
        >
          <Shield className="w-3 h-3" />
          Équipes
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={cn(
            "flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2",
            activeTab === 'users' ? "bg-orange-500 text-white shadow-lg" : "text-gray-400 hover:text-white hover:bg-white/5"
          )}
        >
          <Users className="w-3 h-3" />
          Utilisateurs
        </button>
      </div>

      {/* Teams Leaderboard */}
      {activeTab === 'teams' && (
        <div className="space-y-4">
          {/* Team View & Metric Selectors */}
          <div className="flex flex-col gap-3">
            <div className="flex bg-black/50 p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setTeamView('general')}
                className={cn(
                  "flex-1 py-1.5 pl-9 pr-4 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all",
                  teamView === 'general' ? "bg-white/20 text-white" : "text-gray-400 hover:text-white"
                )}
              >
                Général
              </button>
              <button
                onClick={() => setTeamView('competition')}
                className={cn(
                  "flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all",
                  teamView === 'competition' ? "bg-white/20 text-white" : "text-gray-400 hover:text-white"
                )}
              >
                Par Compétition
              </button>
            </div>

            <div className="flex gap-2">
              {teamView === 'competition' && (
                <select
                  value={selectedLeagueId || ''}
                  onChange={(e) => setSelectedLeagueId(Number(e.target.value))}
                  className="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs font-bold text-white outline-none focus:border-orange-500 flex-1 min-w-0"
                >
                  {leagues.map((l) => (
                    <option key={l.league.id} value={l.league.id}>{l.league.name}</option>
                  ))}
                </select>
              )}

              <select
                value={teamMetric}
                onChange={(e) => setTeamMetric(e.target.value as TeamMetric)}
                className="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs font-bold text-white outline-none focus:border-orange-500 flex-1 min-w-0"
              >
                <option value="ferveurEarned">Ferveur</option>
                <option value="totalScoreGiven">Points Totaux</option>
                <option value="averageScore">Points Moyens</option>
                <option value="userCount">Favoris</option>
              </select>
            </div>
          </div>

          {/* Teams List */}
          {loadingTeams ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500"></div>
            </div>
          ) : sortedTeams.length === 0 ? (
            <div className="text-center py-8 text-gray-500 font-bold italic text-sm">
              Aucune équipe trouvée.
            </div>
          ) : (
            <div className="space-y-2">
              {sortedTeams.map((team, index) => (
                <Card key={team.id} className="p-2 flex items-center gap-3 border-white/5 bg-white/5 hover:bg-white/10 transition-colors rounded-lg">
                  <div className="w-6 flex justify-center">
                    {renderRankIcon(index)}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-white/10 p-1.5 shrink-0">
                    <img src={team.logo} alt={team.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black italic uppercase text-sm truncate">{team.name}</h3>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <div className="text-sm font-black text-orange-500">
                      {teamMetric === 'ferveurEarned' && <span className="flex items-center gap-1"><Flame className="w-3 h-3" /> {(team.ferveurEarned || 0).toLocaleString()}</span>}
                      {teamMetric === 'totalScoreGiven' && <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> {(team.totalScoreGiven || 0).toLocaleString()}</span>}
                      {teamMetric === 'averageScore' && <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> {team.averageScore.toLocaleString()}</span>}
                      {teamMetric === 'userCount' && <span className="flex items-center gap-1"><Star className="w-3 h-3" /> {(team.userCount || 0).toLocaleString()}</span>}
                    </div>
                    <div className="text-[9px] text-gray-400 uppercase font-bold">
                      {teamMetric === 'ferveurEarned' && 'Ferveur'}
                      {teamMetric === 'totalScoreGiven' && 'Points Totaux'}
                      {teamMetric === 'averageScore' && 'Points Moyens'}
                      {teamMetric === 'userCount' && 'Favoris'}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Users Leaderboard */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* User Metric Selector */}
          <div className="flex">
            <select
              value={userMetric}
              onChange={(e) => setUserMetric(e.target.value as UserMetric)}
              className="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs font-bold text-white outline-none focus:border-orange-500 w-full"
            >
              <option value="ferveurPoints">Ferveur Gagnée</option>
              <option value="totalScoreGiven">Points Totaux</option>
              <option value="averageScore">Points Moyens</option>
            </select>
          </div>

          {/* Users List */}
          {loadingUsers ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500"></div>
            </div>
          ) : sortedUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-500 font-bold italic text-sm">
              Aucun utilisateur trouvé.
            </div>
          ) : (
            <div className="space-y-2">
              {sortedUsers.map((u, index) => (
                <Card key={u.uid} className="p-2 flex items-center gap-3 border-white/5 bg-white/5 hover:bg-white/10 transition-colors rounded-lg">
                  <div className="w-6 flex justify-center">
                    {renderRankIcon(index)}
                  </div>
                  <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/10 shrink-0">
                    <img src={getImageUrl(u.photoURL) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} alt={u.pseudo} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black italic uppercase text-sm truncate">{u.pseudo || u.displayName || 'Anonyme'}</h3>
                    <div className="text-[10px] text-gray-400 font-bold uppercase">Niv. {u.level || 1}</div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <div className="text-sm font-black text-orange-500">
                      {userMetric === 'ferveurPoints' && <span className="flex items-center gap-1"><Flame className="w-3 h-3" /> {(u.ferveurPoints || 0).toLocaleString()}</span>}
                      {userMetric === 'totalScoreGiven' && <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> {(u.totalScoreGiven || 0).toLocaleString()}</span>}
                      {userMetric === 'averageScore' && <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> {u.averageScore.toLocaleString()}</span>}
                    </div>
                    <div className="text-[9px] text-gray-400 uppercase font-bold">
                      {userMetric === 'ferveurPoints' && 'Ferveur'}
                      {userMetric === 'totalScoreGiven' && 'Points Totaux'}
                      {userMetric === 'averageScore' && 'Points Moyens'}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
