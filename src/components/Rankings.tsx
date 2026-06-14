import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Card } from './Layout';
import { Trophy, Users, Shield, Medal, Activity, ChevronDown, Search } from 'lucide-react';
import { getImageUrl } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { translateCountryName } from '../utils/countryTranslations';

interface RankingEntry {
  id: string;
  rank: number;
  name: string;
  imageUrl?: string;
  averageScore: number;
  matches: number;
  totalScore: number;
  leagueId?: string;
  leagueName?: string;
  countryName?: string;
  countryFlag?: string | null;
}

interface RankingsProps {
  onBack: () => void;
}

interface AvailableLeague {
  id: string;
  name: string;
  countryName: string;
  countryFlag: string | null;
}

export function Rankings({ onBack }: RankingsProps) {
  const [activeTab, setActiveTab] = useState<'teams' | 'users'>('teams');
  const [metric, setMetric] = useState<'averageScore' | 'totalScore' | 'popularity'>('averageScore');
  const currentYearStr = new Date().getFullYear().toString();
  const prevYearStr = (new Date().getFullYear() - 1).toString();
  const [season, setSeason] = useState<string>(currentYearStr);
  const [countryId, setCountryId] = useState<string>('global'); // 'global' maps to 'Toutes les régions'
  const [leagueId, setLeagueId] = useState<string>('global');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableLeagues, setAvailableLeagues] = useState<AvailableLeague[]>([{ id: 'global', name: 'Global (Toutes compétitions)', countryName: 'Toutes les régions', countryFlag: null }]);
  const [availableSeasons, setAvailableSeasons] = useState<string[]>([currentYearStr, prevYearStr]);

  const uniqueCountries = useMemo(() => {
    let countries = Array.from(new Set(availableLeagues.filter(l => l.countryName !== 'Toutes les régions').map(l => l.countryName)));
    if (metric === 'popularity') {
       (rankings || []).forEach(r => {
          if (r.countryName) countries.push(r.countryName);
       });
    }
    countries = Array.from(new Set(countries)).sort();
    return ['Toutes les régions', ...countries];
  }, [availableLeagues, metric, rankings]);

  const filteredLeagues = useMemo(() => {
     if (countryId === 'global' || countryId === 'Toutes les régions') return availableLeagues;
     return availableLeagues.filter(l => l.countryName === countryId || l.id === 'global');
  }, [availableLeagues, countryId]);

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
     const newCountry = e.target.value;
     setCountryId(newCountry);
     
     if (newCountry === 'global' || newCountry === 'Toutes les régions') {
        setLeagueId('global');
     } else {
        const firstLeague = availableLeagues.find(l => l.countryName === newCountry);
        if (firstLeague) {
           setLeagueId(firstLeague.id);
        }
     }
  };

  const displayedRankings = useMemo(() => {
    let result = rankings;
    if (metric === 'popularity') {
        if (countryId !== 'global' && countryId !== 'Toutes les régions') {
            result = result.filter(r => r.countryName === countryId);
        }
        if (leagueId !== 'global') {
            result = result.filter(r => r.leagueId === leagueId);
        }
    }
    if (searchTerm) {
        result = result.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return result;
  }, [rankings, searchTerm, metric, countryId, leagueId]);

  // Reset metric if switching to users and popularity is selected
  useEffect(() => {
    if (activeTab === 'users' && metric === 'popularity') {
      setMetric('averageScore');
    }
  }, [activeTab, metric]);

  useEffect(() => {
    // Fetch active seasons and leagues from database
    const fetchActiveFilters = async () => {
      try {
        const teamsSnap = await getDocs(collection(db, 'ranking_teams'));
        const usersSnap = await getDocs(collection(db, 'ranking_users'));
        const rawTeamsSnap = await getDocs(collection(db, 'teams')); // Added to include favorite teams' leagues

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

        rawTeamsSnap.forEach(doc => {
          const data = doc.data();
          if (data.leagueIds && Array.isArray(data.leagueIds)) {
             data.leagueIds.forEach((lid: any) => leagueIdsSet.add(lid.toString()));
          }
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
        const leaguesList: AvailableLeague[] = [];

        if (uniqueLeagueIds.includes('global') || uniqueLeagueIds.length === 0) {
          leaguesList.push({ id: 'global', name: 'Global (Toutes compétitions)', countryName: 'Toutes les régions', countryFlag: null });
        }

        if (uniqueLeagueIds.some(id => id !== 'global')) {
          const { footballApi } = await import('../services/footballApi');
          const apiLeagues = await footballApi.getLeagues();

          for (const id of uniqueLeagueIds) {
            if (id !== 'global') {
              const apiLeague = apiLeagues.find((l: any) => l.league?.id?.toString() === id?.toString());
              if (apiLeague) {
                leaguesList.push({ 
                  id, 
                  name: apiLeague.league.name,
                  countryName: translateCountryName(apiLeague.country.name),
                  countryFlag: apiLeague.country.flag
                });
              } else {
                leaguesList.push({ id, name: `Compétition ${id}`, countryName: 'Inconnue', countryFlag: null });
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
    let unsub = () => {};
    const fetchRankings = async () => {
      setLoading(true);
      try {

        if (activeTab === 'teams' && metric === 'popularity') {
          // Fetch all users to count favorite teams
          const usersSnap = await getDocs(collection(db, 'users'));
          const teamCounts: Record<string, number> = {};
          
          usersSnap.forEach(docSnap => {
            const userData = docSnap.data();
            if (userData.favoriteTeams && Array.isArray(userData.favoriteTeams)) {
              userData.favoriteTeams.forEach((teamId: string) => {
                teamCounts[teamId] = (teamCounts[teamId] || 0) + 1;
              });
            }
          });

          let entries: RankingEntry[] = [];
          for (const [teamId, count] of Object.entries(teamCounts)) {
            if (!teamId || teamId === 'undefined' || teamId === 'null') continue;
            
            let name = 'Inconnu';
            let imageUrl = '';
            let leagueName = '';
            let countryName = '';
            let countryFlag: string | null = null;
            let foundLeagueId = '';
            
            try {
              const teamDoc = await getDoc(doc(db, 'teams', teamId));
              if (teamDoc.exists()) {
                const td = teamDoc.data();
                name = td.name;
                imageUrl = td.logo;
                if (td.leagueIds && td.leagueIds.length > 0) {
                   foundLeagueId = td.leagueIds[0].toString();
                }
              } else if (!isNaN(Number(teamId))) {
                 try {
                   const { footballApi } = await import('../services/footballApi');
                   const teamData = await footballApi.getTeamInfo(Number(teamId));
                   if (teamData) {
                     name = teamData.team.name;
                     imageUrl = teamData.team.logo;
                     if (teamData.team.country) {
                        countryName = translateCountryName(teamData.team.country);
                     }
                   }
                 } catch (e) {
                   console.error(`Failed to fetch team info for ${teamId} from API`, e);
                 }
              }

              if (foundLeagueId && foundLeagueId !== 'global') {
                const rowLeague = availableLeagues.find(l => l.id === foundLeagueId);
                if (rowLeague) {
                  leagueName = rowLeague.name;
                  countryName = rowLeague.countryName;
                  countryFlag = rowLeague.countryFlag;
                }
              } else if (foundLeagueId === 'global' || !foundLeagueId) {
                  const td = teamDoc.exists() ? teamDoc.data() : null;
                  if (td && td.leagueIds && td.leagueIds.length > 0) {
                     for (const lid of td.leagueIds) {
                       const rowLeague = availableLeagues.find(l => l.id === lid.toString());
                       if (rowLeague && rowLeague.countryFlag) {
                         countryName = rowLeague.countryName;
                         countryFlag = rowLeague.countryFlag;
                         break;
                       }
                     }
                  }
              }
              
              // We collect all possible countries in popularity without filtering here.
              // We filter them out in displayedRankings instead.
            } catch (err) {
              console.error(`Failed to fetch team doc for ${teamId}`, err);
            }
            
            entries.push({
              id: teamId,
              rank: 0,
              name,
              imageUrl,
              averageScore: 0,
              matches: 0,
              totalScore: count,
              leagueId: foundLeagueId,
              leagueName,
              countryName,
              countryFlag
            });
          }
          
          // Sort teams by count
          entries.sort((a, b) => b.totalScore - a.totalScore);
          entries = entries.slice(0, 50).map((entry, index) => ({
            ...entry,
            rank: index + 1
          }));

          setRankings(entries);
          setLoading(false);
          
        } else {
          const collectionName = activeTab === 'teams' ? 'ranking_teams' : 'ranking_users';
          
          let unsubscribe: () => void = () => {};
          try {
            // Setup optimized query
            const q = query(
              collection(db, collectionName),
              where('season', '==', season.toString()),
              where('leagueId', '==', leagueId.toString()),
              orderBy(metric === 'popularity' ? 'averageScore' : metric, 'desc'),
              limit(50)
            );
            
            unsubscribe = onSnapshot(q, async (snap) => {
              await processSnapshot(snap);
            }, async (err) => {
              console.warn("Optimized query failed in onSnapshot (likely missing index), falling back to in-memory sort", err);
              // Fallback
              const fallbackQ = query(
                collection(db, collectionName),
                where('season', '==', season.toString()),
                where('leagueId', '==', leagueId.toString())
              );
              
              const fallbackUnsub = onSnapshot(fallbackQ, async (fallbackSnap) => {
                const sortedDocs = [...fallbackSnap.docs].sort((a, b) => {
                  const valA = a.data()[metric === 'popularity' ? 'averageScore' : metric] || 0;
                  const valB = b.data()[metric === 'popularity' ? 'averageScore' : metric] || 0;
                  return valB - valA;
                }).slice(0, 50);
                
                await processSnapshot({ docs: sortedDocs });
              });
              
              // We replace the outer unsubscribe with this inner one so the cleanup effect works
              unsubscribe = fallbackUnsub;
            });
          } catch (e: any) {
             console.error("Critical error setting up ranking snapshots:", e);
          }
          
          async function processSnapshot(snapshot: any) {
            console.log(`Fetched ${snapshot.docs.length} documents from ${collectionName} for season ${season} and league ${leagueId}`);
            if (snapshot.docs.length === 0) {
              console.warn(`[Rankings] No data found in ${collectionName} for filters:`, { season, leagueId, metric });
            }

            let newEntries: RankingEntry[] = [];
            for (const docSnap of snapshot.docs) {
              const data = docSnap.data() as any;
              
              let name = 'Inconnu';
              let imageUrl = '';
              let leagueName = '';
              let countryName = '';
              let countryFlag: string | null = null;

              if (activeTab === 'teams') {
                const teamId = data.teamId?.toString();
                if (!teamId) continue;
                
                let foundLeagueId = data.leagueId;

                const teamDoc = await getDoc(doc(db, 'teams', teamId));
                if (teamDoc.exists()) {
                  const td = teamDoc.data();
                  name = td.name;
                  imageUrl = td.logo;
                  if (foundLeagueId === 'global' && td.leagueIds && td.leagueIds.length > 0) {
                     foundLeagueId = td.leagueIds[0].toString();
                  }
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

                if (foundLeagueId && foundLeagueId !== 'global') {
                  const rowLeague = availableLeagues.find(l => l.id === foundLeagueId.toString());
                  if (rowLeague) {
                    leagueName = rowLeague.name;
                    countryName = rowLeague.countryName;
                    countryFlag = rowLeague.countryFlag;
                  }
                } else if (foundLeagueId === 'global' || !foundLeagueId) {
                  // If we don't have a specific league but we have leagueIds array, try to find country info from one of them
                  const td = teamDoc.exists() ? teamDoc.data() : null;
                  if (td && td.leagueIds && td.leagueIds.length > 0) {
                     for (const lid of td.leagueIds) {
                       const rowLeague = availableLeagues.find(l => l.id === lid.toString());
                       if (rowLeague && rowLeague.countryFlag) {
                         countryName = rowLeague.countryName;
                         countryFlag = rowLeague.countryFlag;
                         break; // Found one with country info
                       }
                     }
                  }
                }

              } else {
                const userId = data.userId?.toString();
                if (!userId) continue;
                
                const userDoc = await getDoc(doc(db, 'users', userId));
                if (userDoc.exists()) {
                  name = userDoc.data().pseudo || 'Supporter';
                  imageUrl = userDoc.data().photoURL;
                }
              }

              newEntries.push({
                id: docSnap.id,
                rank: 0,
                name,
                imageUrl,
                averageScore: data.averageScore,
                matches: data.matches,
                totalScore: data.totalScore,
                leagueName,
                countryName,
                countryFlag
              });
            }

            newEntries = newEntries.map((entry, index) => ({
              ...entry,
              rank: index + 1
            }));

            setRankings(newEntries);
            setLoading(false);
          }
          
          unsub = () => unsubscribe();
        }
      } catch (error) {
        console.error("Error fetching rankings:", error);
        setLoading(false);
      }
    };

    fetchRankings();
    
    return () => unsub();
  }, [activeTab, season, leagueId, metric]);

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
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between px-4">
          <h1 className="text-lg sm:text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
            Classements
          </h1>
        </div>

        {/* Search */}
        <div className="px-4">
           <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input 
                type="text" 
                placeholder={activeTab === 'teams' ? "Rechercher une équipe..." : "Rechercher un supporter..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors text-[13px] sm:text-sm"
              />
           </div>
        </div>

        {/* Filters */}
        <div className="px-4">
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

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
            {/* Metric Selector */}
            <div className="relative col-span-2 sm:col-span-3">
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value as any)}
                className="w-full appearance-none bg-black/40 border border-white/10 rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white font-bold text-[11px] sm:text-sm focus:outline-none focus:border-orange-500 transition-colors"
              >
                <option value="averageScore">Points par match</option>
                <option value="totalScore">Total des points</option>
                {activeTab === 'teams' && (
                  <option value="popularity">Popularité (Supporters)</option>
                )}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>

            {/* Season Selector */}
            {metric !== 'popularity' && (
              <div className="relative">
                <select
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  className="w-full appearance-none bg-black/40 border border-white/10 rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white font-bold text-[11px] sm:text-sm focus:outline-none focus:border-orange-500 transition-colors truncate pr-8"
                >
                  {availableSeasons.map(s => (
                    <option key={s} value={s}>Saison {s}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            )}

            {/* Country Selector */}
            <div className={`relative ${metric === 'popularity' ? 'col-span-1' : ''}`}>
              <select
                value={countryId}
                onChange={handleCountryChange}
                className="w-full appearance-none bg-black/40 border border-white/10 rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white font-bold text-[11px] sm:text-sm focus:outline-none focus:border-orange-500 transition-colors truncate pr-8"
              >
                {uniqueCountries.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* League Selector */}
            <div className={`relative ${metric === 'popularity' ? 'col-span-1' : 'col-span-2 sm:col-span-1'}`}>
              <select
                value={leagueId}
                onChange={(e) => setLeagueId(e.target.value)}
                className="w-full appearance-none bg-black/40 border border-white/10 rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-white font-bold text-[11px] sm:text-sm focus:outline-none focus:border-orange-500 transition-colors truncate pr-8 sm:pr-10"
              >
                {filteredLeagues.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Leaderboard */}
      <div className="px-4 space-y-3">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Activity className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
        ) : displayedRankings.length === 0 ? (
          <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/10">
            <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">Aucun classement disponible pour ces critères.</p>
          </div>
        ) : (
          <AnimatePresence>
            {displayedRankings.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex items-center gap-2 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all ${
                  index === 0 ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/5 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.1)]' :
                  index === 1 ? 'bg-gradient-to-r from-gray-300/10 to-transparent border-gray-400/30' :
                  index === 2 ? 'bg-gradient-to-r from-amber-700/20 to-transparent border-amber-700/30' :
                  'bg-[#1a1a1a] border-white/5 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-center w-6 sm:w-8 font-black text-base sm:text-xl shrink-0">
                  {index === 0 ? <Medal className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-400" /> :
                   index === 1 ? <Medal className="w-5 h-5 sm:w-7 sm:h-7 text-gray-300" /> :
                   index === 2 ? <Medal className="w-4 h-4 sm:w-6 sm:h-6 text-amber-600" /> :
                   <span className="text-gray-500">{entry.rank}</span>}
                </div>

                <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-black/50 border-2 border-white/10 shrink-0 flex items-center justify-center">
                  {entry.imageUrl ? (
                    <img src={getImageUrl(entry.imageUrl)} alt={entry.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : activeTab === 'teams' ? (
                    <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-gray-500" />
                  ) : (
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${entry.id}`} alt={entry.name} className="w-full h-full object-cover bg-white/10" referrerPolicy="no-referrer" />
                  )}
                </div>

                <div className="flex-1 min-w-0 pr-1 sm:pr-2">
                  <h3 className={`font-black uppercase truncate leading-tight ${index === 0 ? 'text-yellow-400 text-[11px] sm:text-lg' : 'text-white text-[10px] sm:text-base'}`}>
                    {entry.name}
                  </h3>
                  {activeTab === 'teams' && (entry.leagueName || entry.countryFlag) && (
                    <div className="flex items-center gap-1.5 mt-0.5 text-[9px] sm:text-xs text-gray-400 font-medium truncate">
                       {entry.countryFlag && <img src={entry.countryFlag} alt={entry.countryName} className="w-3.5 h-2.5 sm:w-4 sm:h-3 object-cover rounded-[2px]" referrerPolicy="no-referrer" />}
                       <span className="truncate">{entry.leagueName || entry.countryName}</span>
                    </div>
                  )}
                  {metric !== 'popularity' && (
                    <p className="text-[9px] sm:text-xs text-gray-400 font-medium truncate mt-0.5 sm:mt-0">
                      {entry.matches} match{entry.matches > 1 ? 's' : ''} joué{entry.matches > 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  {metric === 'popularity' ? (
                    <div className="text-base sm:text-2xl font-black text-white tracking-tighter">
                      {entry.totalScore} <span className="text-[9px] sm:text-sm text-gray-500 ml-0.5 sm:ml-1">fans</span>
                    </div>
                  ) : (
                    <>
                      <div className="text-base sm:text-2xl font-black text-white tracking-tighter">
                        {metric === 'averageScore' ? (
                          <>{entry.averageScore != null ? entry.averageScore.toFixed(1) : '0.0'}<span className="text-[9px] sm:text-sm text-gray-500 ml-0.5 sm:ml-1">pts/m</span></>
                        ) : (
                          <>{entry.totalScore || 0}<span className="text-[9px] sm:text-sm text-gray-500 ml-0.5 sm:ml-1">pts</span></>
                        )}
                      </div>
                      <div className="text-[9px] sm:text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                        {metric === 'averageScore' ? `Total: ${entry.totalScore || 0}` : `Moy: ${entry.averageScore != null ? entry.averageScore.toFixed(1) : '0.0'}`}
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
