import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Card } from './Layout';
import { Trophy, Users, Shield, Medal, Activity, ChevronDown, ChevronLeft } from 'lucide-react';
import { getImageUrl } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface RankingEntry {
  id: string;
  rank: number;
  name: string;
  imageUrl?: string;
  averageScore: number;
  matches: number;
  totalScore: number;
}

interface RankingsProps {
  onBack: () => void;
}

export function Rankings({ onBack }: RankingsProps) {
  const [activeTab, setActiveTab] = useState<'teams' | 'users'>('teams');
  const currentYearStr = new Date().getFullYear().toString();
  const prevYearStr = (new Date().getFullYear() - 1).toString();
  const [season, setSeason] = useState<string>(currentYearStr);
  const [leagueId, setLeagueId] = useState<string>('global');
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableLeagues, setAvailableLeagues] = useState<{id: string, name: string}[]>([{ id: 'global', name: 'Global (Toutes compétitions)' }]);
  const [availableSeasons, setAvailableSeasons] = useState<string[]>([currentYearStr, prevYearStr]);

  useEffect(() => {
    // Fetch active seasons and leagues from database
    const fetchActiveFilters = async () => {
      try {
        const teamsSnap = await getDocs(collection(db, 'ranking_teams'));
        const usersSnap = await getDocs(collection(db, 'ranking_users'));

        const seasonsSet = new Set<string>();
        const leagueIdsSet = new Set<string>();

        teamsSnap.forEach(doc => {
          const data = doc.data();
          if (data.season) seasonsSet.add(data.season.toString());
          if (data.leagueId) leagueIdsSet.add(data.leagueId.toString());
        });

        usersSnap.forEach(doc => {
          const data = doc.data();
          if (data.season) seasonsSet.add(data.season.toString());
          if (data.leagueId) leagueIdsSet.add(data.leagueId.toString());
        });

        if (seasonsSet.size === 0) {
          const currentYear = new Date().getFullYear();
          seasonsSet.add(currentYear.toString());
        }

        const uniqueSeasons = Array.from(seasonsSet).sort((a, b) => b.localeCompare(a));
        if (uniqueSeasons.length > 0) {
          setAvailableSeasons(uniqueSeasons);
          if (!uniqueSeasons.includes(season.toString())) {
            setSeason(uniqueSeasons[0]);
          }
        }

        const uniqueLeagueIds = Array.from(leagueIdsSet);
        const leaguesList: {id: string, name: string}[] = [];

        if (uniqueLeagueIds.includes('global') || uniqueLeagueIds.length === 0) {
          leaguesList.push({ id: 'global', name: 'Global (Toutes compétitions)' });
        }

        if (uniqueLeagueIds.some(id => id !== 'global')) {
          const { footballApi } = await import('../services/footballApi');
          const apiLeagues = await footballApi.getLeagues();

          for (const id of uniqueLeagueIds) {
            if (id !== 'global') {
              const apiLeague = apiLeagues.find((l: any) => l.league.id.toString() === id);
              if (apiLeague) {
                leaguesList.push({ id, name: apiLeague.league.name });
              } else {
                leaguesList.push({ id, name: `Compétition ${id}` });
              }
            }
          }
        }

        setAvailableLeagues(leaguesList);
        if (!leaguesList.find(l => l.id === leagueId.toString()) && leaguesList.length > 0) {
          setLeagueId(leaguesList[0].id);
        }

      } catch (e) {
        console.error("Failed to fetch active filters", e);
      }
    };
    fetchActiveFilters();
  }, []);

  useEffect(() => {
    const fetchRankings = async () => {
      setLoading(true);
      try {
        const collectionName = activeTab === 'teams' ? 'ranking_teams' : 'ranking_users';
        // Fetch all documents and filter client-side to avoid any index or type mismatch issues
        const q = query(collection(db, collectionName));

        const snapshot = await getDocs(q);
        console.log(`Fetched ${snapshot.size} documents from ${collectionName}`);
        let entries: RankingEntry[] = [];

        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          console.log(`Doc ${docSnap.id}:`, data);
          
          // Client-side filtering
          const docSeason = data.season?.toString();
          const docLeagueId = data.leagueId?.toString();
          
          if (docSeason !== season.toString() || docLeagueId !== leagueId.toString()) {
            console.log(`Filtered out ${docSnap.id} because season ${docSeason} !== ${season} or leagueId ${docLeagueId} !== ${leagueId}`);
            continue;
          }

          let name = 'Inconnu';
          let imageUrl = '';

          if (activeTab === 'teams') {
            // Fetch team details
            const teamId = data.teamId?.toString();
            if (!teamId) {
              console.log(`Filtered out ${docSnap.id} because teamId is undefined`);
              continue;
            }
            
            const teamDoc = await getDoc(doc(db, 'teams', teamId));
            if (teamDoc.exists()) {
              name = teamDoc.data().name;
              imageUrl = teamDoc.data().logo;
            } else if (!isNaN(Number(teamId))) {
               try {
                 const { footballApi } = await import('../services/footballApi');
                 const teamData = await footballApi.getTeamInfo(Number(teamId));
                 if (teamData) {
                   name = teamData.team.name;
                   imageUrl = teamData.team.logo;
                 }
               } catch (e) {
                 console.error(`Failed to fetch team info for ${teamId}`, e);
               }
            }
          } else {
            // Fetch user details
            const userId = data.userId?.toString();
            if (!userId) {
              console.log(`Filtered out ${docSnap.id} because userId is undefined`);
              continue;
            }
            
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
              name = userDoc.data().pseudo || 'Supporter';
              imageUrl = userDoc.data().photoURL;
            }
          }

          entries.push({
            id: docSnap.id,
            rank: 0, // Will be set after sorting
            name,
            imageUrl,
            averageScore: data.averageScore,
            matches: data.matches,
            totalScore: data.totalScore
          });
        }

        // Sort client-side
        entries.sort((a, b) => b.averageScore - a.averageScore);
        
        // Assign ranks and limit to 50
        entries = entries.slice(0, 50).map((entry, index) => ({
          ...entry,
          rank: index + 1
        }));

        setRankings(entries);
      } catch (error) {
        console.error("Error fetching rankings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRankings();
  }, [activeTab, season, leagueId]);

  const seedRankings = async () => {
    try {
      setLoading(true);
      const { doc, setDoc } = await import('firebase/firestore');
      
      const teams = [
        { id: '85', name: 'PSG', logo: 'https://media.api-sports.io/football/teams/85.png' },
        { id: '81', name: 'Marseille', logo: 'https://media.api-sports.io/football/teams/81.png' },
        { id: '80', name: 'Lyon', logo: 'https://media.api-sports.io/football/teams/80.png' },
      ];

      for (const team of teams) {
        await setDoc(doc(db, 'teams', team.id), {
          name: team.name,
          logo: team.logo,
          ferveurEarned: Math.floor(Math.random() * 1000),
          totalScoreGiven: Math.floor(Math.random() * 5000),
          matchesPlayed: Math.floor(Math.random() * 50) + 10,
        });

        const score = Math.floor(Math.random() * 5000) + 1000;
        const matches = Math.floor(Math.random() * 50) + 10;
        await setDoc(doc(db, 'ranking_teams', `${team.id}_2026_global`), {
          teamId: team.id,
          season: '2026',
          leagueId: 'global',
          totalScore: score,
          matches: matches,
          averageScore: score / matches,
          updatedAt: new Date().toISOString()
        });
      }

      const { auth } = await import('../firebase');
      const currentUser = auth.currentUser;

      const users = [
        { id: currentUser?.uid || 'user1', name: currentUser?.displayName || 'Gael', score: 4500 },
        { id: 'user2', name: 'Alex', score: 3200 },
        { id: 'user3', name: 'Sam', score: 5100 },
      ];

      for (const u of users) {
        const matches = Math.floor(Math.random() * 50) + 10;
        await setDoc(doc(db, 'ranking_users', `${u.id}_2026_global`), {
          userId: u.id,
          season: '2026',
          leagueId: 'global',
          totalScore: u.score,
          matches: matches,
          averageScore: u.score / matches,
          updatedAt: new Date().toISOString()
        });
      }
      
      alert('Classements générés avec succès !');
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert('Erreur lors de la génération des classements');
    } finally {
      setLoading(false);
    }
  };

  const clearFakeData = async () => {
    try {
      setLoading(true);
      const { doc, deleteDoc, getDocs, collection } = await import('firebase/firestore');
      
      const fakeTeamIds = ['85', '81', '80'];
      const fakeUserIds = ['user1', 'user2', 'user3'];

      const teamsSnap = await getDocs(collection(db, 'ranking_teams'));
      for (const d of teamsSnap.docs) {
        if (fakeTeamIds.includes(d.data().teamId)) {
          await deleteDoc(doc(db, 'ranking_teams', d.id));
        }
      }

      const usersSnap = await getDocs(collection(db, 'ranking_users'));
      for (const d of usersSnap.docs) {
        if (fakeUserIds.includes(d.data().userId) || d.data().totalScore === 4500 || d.data().totalScore === 3200 || d.data().totalScore === 5100) {
          await deleteDoc(doc(db, 'ranking_users', d.id));
        }
      }
      
      alert('Données de test supprimées !');
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert('Erreur lors de la suppression');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Header */}
      <div className="p-4 sm:p-6 bg-gradient-to-b from-orange-900/40 to-transparent shrink-0">
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center border border-orange-500/30">
              <Trophy className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter text-white">Classements</h1>
              <p className="text-orange-200 text-xs sm:text-sm">Les meilleurs sur le terrain</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-4">
          {/* Tabs */}
          <div className="flex gap-2 p-1 bg-black/40 rounded-xl">
            <button
              onClick={() => setActiveTab('teams')}
              className={`flex-1 py-2 rounded-lg font-bold text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                activeTab === 'teams' ? 'bg-orange-500 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Shield className="w-4 h-4" />
              Équipes
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`flex-1 py-2 rounded-lg font-bold text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                activeTab === 'users' ? 'bg-blue-500 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Users className="w-4 h-4" />
              Supporters
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Season Selector */}
            <div className="relative">
              <select
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                className="w-full appearance-none bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-sm focus:outline-none focus:border-orange-500 transition-colors"
              >
                {availableSeasons.map(s => (
                  <option key={s} value={s}>Saison {s}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>

            {/* League Selector */}
            <div className="relative">
              <select
                value={leagueId}
                onChange={(e) => setLeagueId(e.target.value)}
                className="w-full appearance-none bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-sm focus:outline-none focus:border-orange-500 transition-colors truncate pr-10"
              >
                {availableLeagues.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Activity className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
        ) : rankings.length === 0 ? (
          <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/10">
            <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">Aucun classement disponible pour ces critères.</p>
          </div>
        ) : (
          <AnimatePresence>
            {rankings.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                  index === 0 ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/5 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.1)]' :
                  index === 1 ? 'bg-gradient-to-r from-gray-300/10 to-transparent border-gray-400/30' :
                  index === 2 ? 'bg-gradient-to-r from-amber-700/20 to-transparent border-amber-700/30' :
                  'bg-[#1a1a1a] border-white/5 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-center w-8 font-black text-xl">
                  {index === 0 ? <Medal className="w-8 h-8 text-yellow-400" /> :
                   index === 1 ? <Medal className="w-7 h-7 text-gray-300" /> :
                   index === 2 ? <Medal className="w-6 h-6 text-amber-600" /> :
                   <span className="text-gray-500">{entry.rank}</span>}
                </div>

                <div className="w-12 h-12 rounded-full overflow-hidden bg-black/50 border-2 border-white/10 shrink-0 flex items-center justify-center">
                  {entry.imageUrl ? (
                    <img src={getImageUrl(entry.imageUrl)} alt={entry.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : activeTab === 'teams' ? (
                    <Shield className="w-6 h-6 text-gray-500" />
                  ) : (
                    <Users className="w-6 h-6 text-gray-500" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className={`font-black uppercase truncate ${index === 0 ? 'text-yellow-400 text-lg' : 'text-white'}`}>
                    {entry.name}
                  </h3>
                  <p className="text-xs text-gray-400 font-medium">
                    {entry.matches} match{entry.matches > 1 ? 's' : ''} joué{entry.matches > 1 ? 's' : ''}
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-2xl font-black text-white tracking-tighter">
                    {entry.averageScore != null ? entry.averageScore.toFixed(1) : '0.0'}<span className="text-sm text-gray-500 ml-1">pts/m</span>
                  </div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                    Total: {entry.totalScore || 0}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
