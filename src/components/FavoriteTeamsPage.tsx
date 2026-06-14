import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, setDoc, increment } from 'firebase/firestore';
import { Search, Plus, Shield, ChevronLeft, Star, Activity, Globe, ChevronRight } from 'lucide-react';
import { getImageUrl, cn } from '../lib/utils';
import { footballApi } from '../services/footballApi';
import { footballDataService } from '../services/footballDataService';
import { Button, Card } from './Layout';
import { useAlert } from '../context/AlertContext';
import { handleFirestoreError, OperationType } from '../firebase';
import { logTransaction } from '../services/transactionService';
import { translateCountryName } from '../utils/countryTranslations';
import { getSearchVariations } from '../utils/teamSearch';

interface FavoriteTeamsPageProps {
  profile: UserProfile;
  onBack: () => void;
  onTeamClick: (teamId: number, season?: number) => void;
}

export function FavoriteTeamsPage({ profile, onBack, onTeamClick }: FavoriteTeamsPageProps) {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const { showAlert } = useAlert();

  useEffect(() => {
    const fetchTeams = async () => {
      setLoading(true);
      try {
        const favoriteTeams = profile.favoriteTeams || [];
        const teamData = await Promise.all(
          favoriteTeams.map(async (teamIdOrName) => {
            const teamIdStr = teamIdOrName.toString();
            const teamDoc = await getDoc(doc(db, 'teams', teamIdStr));
            
            let data: any = { id: teamIdStr };
            
            if (teamDoc.exists()) {
              data = { ...data, ...teamDoc.data() };
            }
            
            // Fetch extra info if missing or for refresh
            if (!data.name || !data.logo) {
              try {
                let teamApiData = null;
                if (!isNaN(Number(teamIdStr))) {
                  const res = await footballApi.getTeamInfo(Number(teamIdStr));
                  if (res && res.team) teamApiData = res.team;
                } else {
                  const results = await footballApi.searchTeams(teamIdStr);
                  const matching = results?.find((r: any) => r.team.name.toLowerCase() === teamIdStr.toLowerCase());
                  if (matching) teamApiData = matching.team;
                }

                if (teamApiData) {
                  const teamRef = doc(db, 'teams', teamApiData.id.toString());
                  const updates = {
                    name: teamApiData.name,
                    logo: teamApiData.logo,
                    updatedAt: new Date().toISOString()
                  };
                  await setDoc(teamRef, updates, { merge: true });
                  data = { ...data, ...updates };
                }
              } catch (e) {
                console.error(`Failed to fetch team data for ${teamIdStr}:`, e);
              }
            }

            // Fetch Summary Data (Ranking, Last Matches, Competitions)
            try {
              const currentSeason = footballDataService.getCurrentSeasonYear();
              const leagues = await footballApi.getLeaguesByTeam(Number(data.id)).catch(() => []);
              
              let fixtures: any[] = [];
              const currentYear = new Date().getFullYear();
              let seasonToFetch = currentYear;
              let attempts = 0;
              const nowMs = Date.now();
              
              // Get fixtures from current year and go back if needed to find at least 5 completed matches
              while (attempts < 4) {
                const fetched = await footballApi.getFixturesByTeam(Number(data.id), seasonToFetch).catch(() => []);
                fetched.forEach((f: any) => {
                  if (!fixtures.some((existing: any) => existing.fixture.id === f.fixture.id)) {
                    fixtures.push(f);
                  }
                });
                
                const pastFT = fixtures.filter((f: any) => 
                  ['FT', 'AET', 'PEN'].includes(f.fixture.status.short)
                );
                
                if (pastFT.length >= 5) {
                  break;
                }
                
                seasonToFetch--;
                attempts++;
              }

              // Filter to include only completed matches and sort descending (newest first)
              const completedPastMatches = fixtures
                .filter((f: any) => 
                  ['FT', 'AET', 'PEN'].includes(f.fixture.status.short)
                )
                .sort((a: any, b: any) => new Date(b.fixture.date).getTime() - new Date(a.fixture.date).getTime())
                .slice(0, 5);

              // Get primary league standings if possible, using the latest/current season of that league
              let standing = null;
              if (leagues.length > 0) {
                const firstLeagueEntry = leagues[0];
                const primaryLeague = firstLeagueEntry.league.id;
                
                const sortedSeasons = [...(firstLeagueEntry.seasons || [])].sort((a: any, b: any) => b.year - a.year);
                const latestLeagueSeasonObj = sortedSeasons.find((s: any) => s.current) || sortedSeasons[0];
                const leagueSeason = latestLeagueSeasonObj ? latestLeagueSeasonObj.year : currentSeason;
                
                const standingsRes = await footballApi.getStandings(primaryLeague, leagueSeason).catch(() => []);
                if (standingsRes && standingsRes[0] && standingsRes[0].league && standingsRes[0].league.standings) {
                  const flatStandings = standingsRes[0].league.standings.flat();
                  const teamStanding = flatStandings.find((s: any) => s.team?.id?.toString() === data.id?.toString());
                  if (teamStanding) {
                    standing = { ...teamStanding, leagueName: standingsRes[0].league.name };
                  }
                }
              }

              data.summary = {
                lastMatches: completedPastMatches,
                standing: standing,
                competitions: leagues.map((l: any) => l.league.name)
              };
            } catch (e) {
              console.error("Failed to fetch team summary:", e);
            }

            return data;
          })
        );
        setTeams(teamData);
      } catch (error) {
        console.error("Error fetching favorite teams:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, [profile.favoriteTeams]);

  useEffect(() => {
    const search = async () => {
      if (searchQuery.length < 3) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const variations = getSearchVariations(searchQuery);
        let results: any[] = [];
        
        // Execute queries for all variations in parallel and combine/deduplicate
        const queryPromises = variations.map(v => footballApi.searchTeams(v).catch(() => []));
        const allRes = await Promise.all(queryPromises);
        
        const seenIds = new Set<number>();
        allRes.forEach((resList) => {
          if (resList) {
            resList.forEach((item: any) => {
              if (item?.team?.id && !seenIds.has(item.team.id)) {
                seenIds.add(item.team.id);
                results.push(item);
              }
            });
          }
        });

        setSearchResults(results);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    };
    
    const timeoutId = setTimeout(search, 500);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleAddTeam = async (team: any) => {
    const favoriteTeams = profile.favoriteTeams || [];
    if (favoriteTeams.length >= (profile.teamSlots || 1)) {
      showAlert({ type: 'error', title: 'Limite atteinte', subtitle: 'Plus d\'emplacements disponibles.' });
      return;
    }

    const teamId = team.team.id.toString();
    if (favoriteTeams.map(t => t.toString()).includes(teamId)) {
      showAlert({ type: 'error', title: 'Déjà ajouté', subtitle: 'Cette équipe est déjà dans vos favoris.' });
      return;
    }

    setIsAdding(teamId);
    try {
      const teamRef = doc(db, 'teams', teamId);
      const teamDoc = await getDoc(teamRef);
      
      const teamPayload = {
        name: team.team.name,
        logo: team.team.logo,
        updatedAt: new Date().toISOString()
      };

      if (!teamDoc.exists()) {
        // Fetch leagues for this team to enrich data
        let leagueIds: number[] = [];
        try {
          const leaguesData = await footballApi.getLeaguesByTeam(Number(teamId));
          leagueIds = leaguesData.map((l: any) => l.league.id);
        } catch (e) {
          console.error("Failed to fetch leagues for team enrichment", e);
        }

        await setDoc(teamRef, {
          ...teamPayload,
          userCount: 1,
          averageFerveur: 10,
          ferveurEarned: 0,
          totalScoreGiven: 0,
          matchesPlayed: 0,
          leagueIds: leagueIds
        });
      } else {
        // If doc exists but lacked name/logo (due to some error), heal it
        await updateDoc(teamRef, {
          ...teamPayload,
          userCount: increment(1)
        });
      }

      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, {
        favoriteTeams: [...favoriteTeams, teamId]
      });
      
      setSearchQuery('');
      setSearchResults([]);
      showAlert({ type: 'success', title: 'Équipe ajoutée !', subtitle: `${team.team.name} a rejoint vos favoris.` });
    } catch (error) {
      console.error("Error adding favorite team:", error);
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    } finally {
      setIsAdding(null);
    }
  };

  const handleBuySlot = async () => {
    if (profile.gems < 5) {
      showAlert({ type: 'error', title: 'Pas assez de gemmes.' });
      return;
    }

    try {
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, {
        gems: profile.gems - 5,
        teamSlots: profile.teamSlots + 1
      });
      await logTransaction(profile.uid, 'gems', -5, 'Achat d\'un emplacement d\'équipe favorite');
      showAlert({ type: 'success', title: 'Nouvel emplacement débloqué !' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const emptySlots = Math.max(0, profile.teamSlots - profile.favoriteTeams.length);

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="flex items-center justify-between px-4">
        <h1 className="text-lg sm:text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
          Équipes Favorites
        </h1>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-8">
        <div className="bg-black/50 border border-white/10 rounded-xl p-4 flex items-center justify-between">
          <div className="text-gray-400 text-xs sm:text-sm">Emplacements utilisés</div>
          <div className="text-xl font-black text-orange-500">{profile.favoriteTeams.length} <span className="text-sm text-orange-500/50">/ {profile.teamSlots}</span></div>
        </div>
        
        {/* Current Teams */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-gray-500 font-bold animate-pulse uppercase tracking-widest italic">
            Chargement de vos équipes et résultats...
          </div>
        ) : (
          <>
            {teams.map((team, idx) => (
              <Card 
                key={idx} 
                onClick={() => onTeamClick(Number(team.id))}
                className="bg-black/60 border-white/10 p-4 space-y-4 hover:border-orange-500/50 transition-all cursor-pointer group relative overflow-hidden"
              >
                <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                  <div className="w-14 h-14 shrink-0 flex items-center justify-center p-1 drop-shadow-xl">
                    {team.logo ? (
                      <img src={getImageUrl(team.logo, 100)} alt={team.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <Shield className="w-8 h-8 text-gray-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-white text-lg sm:text-xl italic uppercase tracking-tighter truncate">{translateCountryName(team.name)}</h3>
                      <Star className="w-4 h-4 text-orange-500 fill-orange-500" />
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {team.summary?.standing && (
                        <span className="text-[10px] font-black italic bg-orange-500 text-black px-2 py-0.5 rounded uppercase tracking-tighter">
                          {team.summary.standing.rank}e - {team.summary.standing.leagueName}
                        </span>
                      )}
                      <span className="text-[10px] text-orange-500 font-black uppercase tracking-tighter bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">Bonus Ferveur Actif</span>
                    </div>
                  </div>
                </div>

                {/* Team Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Form / Last Matches */}
                  <div className="space-y-2">
                    <h4 className="text-[9px] font-black uppercase text-gray-500 tracking-widest flex items-center gap-1.5">
                      <Activity className="w-3 h-3" />
                      Derniers Résultats
                    </h4>
                    <div className="flex gap-1">
                      {team.summary?.lastMatches && team.summary.lastMatches.length > 0 ? (
                        team.summary.lastMatches.map((m: any, i: number) => {
                          const isHome = m.teams?.home?.id?.toString() === team.id?.toString();
                          const teamGoals = isHome ? m.goals.home : m.goals.away;
                          const opponentGoals = isHome ? m.goals.away : m.goals.home;
                          const win = teamGoals > opponentGoals;
                          const draw = teamGoals === opponentGoals;
                          return (
                            <div 
                              key={i} 
                              className={cn(
                                "w-6 h-6 rounded flex items-center justify-center text-[10px] font-black border",
                                win ? "bg-green-500/20 border-green-500 text-green-500" :
                                draw ? "bg-gray-500/20 border-gray-500 text-gray-500" :
                                "bg-red-500/20 border-red-500 text-red-500"
                              )}
                              title={`${m.teams.home.name} ${m.goals.home}-${m.goals.away} ${m.teams.away.name}`}
                            >
                              {win ? 'V' : draw ? 'N' : 'D'}
                            </div>
                          );
                        })
                      ) : (
                        <span className="text-[10px] text-gray-500 font-bold">Pas de matchs récents</span>
                      )}
                    </div>
                  </div>

                  {/* Competitions */}
                  <div className="space-y-2">
                    <h4 className="text-[9px] font-black uppercase text-gray-500 tracking-widest flex items-center gap-1.5">
                      <Globe className="w-3 h-3" />
                      Compétitions
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {team.summary?.competitions && team.summary.competitions.length > 0 ? (
                        team.summary.competitions.slice(0, 3).map((comp: string, i: number) => (
                          <span key={i} className="text-[9px] font-bold text-gray-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">
                            {comp}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-gray-500 font-bold">...</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-1 text-orange-500 font-black text-[10px] uppercase italic tracking-widest">
                    Voir détails <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              </Card>
            ))}

            {/* Empty Slots */}
            {Array.from({ length: emptySlots }).map((_, idx) => (
              <div key={`empty-${idx}`} className="bg-black/20 border border-dashed border-white/20 rounded-xl p-3 flex flex-col items-center justify-center min-h-[88px]">
                <span className="text-gray-500 font-bold text-xs text-center leading-tight">Emplacement<br/>Libre</span>
              </div>
            ))}

            {/* Buy Slot Button */}
            <button
              onClick={handleBuySlot}
              className="bg-orange-500/5 border border-orange-500/30 rounded-xl p-3 flex flex-col items-center justify-center gap-1 hover:bg-orange-500/10 transition-colors"
            >
              <Plus className="w-5 h-5 text-orange-500 mb-1" />
              <span className="text-orange-500 font-bold text-xs text-center leading-tight">Acheter un<br/>emplacement</span>
              <div className="bg-orange-500 text-black text-[10px] font-black px-2 py-0.5 rounded mt-1">
                5 Gemmes
              </div>
            </button>
          </>
        )}
      </div>

      {/* Add New Team */}
      {emptySlots > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg md:text-xl font-black italic uppercase tracking-tight text-white">
            Ajouter une équipe
          </h2>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une équipe (ex: Paris)"
              className={`w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500 transition-colors ${(profile?.favoriteTeams?.length || 0) < 2 && !profile?.hasCompletedDidacticiel ? 'ring-4 ring-orange-500 animate-pulse ring-offset-2 ring-offset-[#0a0a0b]' : ''}`}
            />
          </div>

          {isSearching && (
            <div className="text-center py-8 text-gray-500 font-bold animate-pulse">
              Recherche en cours...
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {searchResults.map((result) => (
                <div 
                  key={result.team.id}
                  className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between hover:border-orange-500/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 shrink-0 bg-white/5 rounded-lg p-1.5 flex items-center justify-center">
                      <img src={getImageUrl(result.team.logo, 100)} alt={result.team.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-white text-sm truncate">{translateCountryName(result.team.name)}</h4>
                      <p className="text-xs text-gray-500 truncate">{translateCountryName(result.team.country)}</p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => handleAddTeam(result)}
                    disabled={isAdding === result.team.id.toString()}
                    className="shrink-0 ml-2 bg-orange-500 hover:bg-orange-600 text-black font-black uppercase text-[10px] px-3 py-1.5 h-auto disabled:opacity-50"
                  >
                    {isAdding === result.team.id.toString() ? '...' : 'Ajouter'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
