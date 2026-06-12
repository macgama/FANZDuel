import React, { useState, useEffect } from 'react';
import { footballApi } from '../services/footballApi';
import { footballDataService } from '../services/footballDataService';
import { Card, Button } from './Layout';
import { 
  ChevronLeft, 
  Trophy, 
  Users, 
  BarChart3, 
  Calendar, 
  MapPin, 
  Goal, 
  Activity, 
  Square,
  ChevronRight,
  User,
  History,
  RefreshCw,
  Clock,
  Shield,
  Medal,
  Star,
  Flame,
  Info,
  Award
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { translateCountryName, translateLeagueName } from '../utils/countryTranslations';
import { collection, query, where, orderBy, limit, getDocs, getDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { getImageUrl } from '../lib/utils';
import { SharedMatchCard } from './SharedMatchCard';
import { LiveMatchesSlider } from './LiveMatchesSlider';
import { TbfoRankingsTab } from './LeagueDetails';
import { UserProfile } from '../types';

interface TeamDetailsProps {
  teamId: number;
  season?: number;
  onBack: () => void;
  onTeamClick: (teamId: number, season: number) => void;
  onLeagueClick: (leagueId: number, season: number) => void;
  onPlayerClick?: (playerId: number, season: number) => void;
  onMatchClick?: (matchId: number, tab?: 'summary' | 'lineups' | 'stats' | 'duels') => void;
  profile: UserProfile | null;
}

export function TeamDetails({ teamId, season: initialSeason, onBack, onTeamClick, onLeagueClick, onPlayerClick, onMatchClick, profile }: TeamDetailsProps) {
  const [team, setTeam] = useState<any>(null);
  const [selectedSeason, setSelectedSeason] = useState<number | undefined>(initialSeason);
  const [actualCurrentSeason, setActualCurrentSeason] = useState<number | null>(null);
  const [availableSeasons, setAvailableSeasons] = useState<number[]>([]);
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [squad, setSquad] = useState<any[]>([]);
  const [standings, setStandings] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'infos' | 'effectif' | 'matches' | 'standings' | 'competitions' | 'stats' | 'historique' | 'tbfo'>('infos');
  const [teamLeagues, setTeamLeagues] = useState<any[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);
  const lastRefreshedTeamRef = React.useRef<{teamId: number, season?: number} | null>(null);

  // Group initial fixtures to know which leagues the team is in
  const seasonLeagues = React.useMemo(() => {
    return Object.values(fixtures.reduce((acc: any, f: any) => {
      const leagueId = f.league.id;
      if (!acc[leagueId]) {
        acc[leagueId] = {
          id: leagueId,
          name: f.league.name,
          logo: f.league.logo
        };
      }
      return acc;
    }, {})).sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [fixtures]);

  const bestLeagueId = React.useMemo(() => {
    if (fixtures.length === 0) return null;
    let fallback = fixtures[0].league.id;
    if (teamLeagues.length > 0) {
      const domesticLeague = teamLeagues.find(l => l.league.type === 'League' && fixtures.some((f: any) => f.league.id === l.league.id));
      if (domesticLeague) {
        fallback = domesticLeague.league.id;
      }
    }
    return fallback;
  }, [fixtures, teamLeagues]);

  const effectiveLeagueId = selectedLeagueId || bestLeagueId;

  const aggregatedStats = React.useMemo(() => {
    if (selectedLeagueId !== null) return null;
    if (fixtures.length === 0) return null;

    let played = 0;
    let wins = 0, draws = 0, loses = 0;
    let goalsFor = 0, goalsAgainst = 0;
    let cleanSheets = 0, failedToScore = 0;
    let currentWins = 0, maxWins = 0;

    const sortedFixtures = [...fixtures].sort((a, b) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime());

    for (const f of sortedFixtures) {
      if (['FT', 'AET', 'PEN'].includes(f.fixture.status.short)) {
        played++;
        const isHome = f.teams.home.id === teamId;
        const gf = isHome ? f.goals.home : f.goals.away;
        const ga = isHome ? f.goals.away : f.goals.home;
        
        if (gf !== null && ga !== null) {
          goalsFor += gf;
          goalsAgainst += ga;
          
          if (gf > ga) {
            wins++;
            currentWins++;
            if (currentWins > maxWins) maxWins = currentWins;
          } else if (gf < ga) {
            loses++;
            currentWins = 0;
          } else {
            draws++;
            currentWins = 0;
          }

          if (ga === 0) cleanSheets++;
          if (gf === 0) failedToScore++;
        }
      }
    }

    return {
      fixtures: {
        played: { total: played },
        wins: { total: wins },
        draws: { total: draws },
        loses: { total: loses }
      },
      goals: {
        for: { total: { total: goalsFor }, average: { total: played ? (goalsFor / played).toFixed(1) : "0.0" } },
        against: { total: { total: goalsAgainst }, average: { total: played ? (goalsAgainst / played).toFixed(1) : "0.0" } }
      },
      biggest: {
        streak: { wins: maxWins }
      },
      clean_sheet: { total: cleanSheets },
      failed_to_score: { total: failedToScore },
      _isAggregated: true
    };
  }, [fixtures, selectedLeagueId, teamId]);

  // Refetch standings and stats when effectiveLeagueId changes
  useEffect(() => {
    if (!effectiveLeagueId || !selectedSeason) return;
    let isMounted = true;
    const fetchLeagueData = async () => {
      try {
        const alreadyRefreshed = lastRefreshedTeamRef.current?.teamId === teamId && lastRefreshedTeamRef.current?.season === selectedSeason;
        const force = !alreadyRefreshed;
        const [standingsResults, statsResults] = await Promise.allSettled([
          footballDataService.getStandings(effectiveLeagueId, selectedSeason, force),
          footballApi.getTeamStats(effectiveLeagueId, teamId, selectedSeason)
        ]);
        if (isMounted) {
          if (standingsResults.status === 'fulfilled') setStandings(standingsResults.value);
          if (statsResults.status === 'fulfilled') setStats(statsResults.value);
        }
      } catch (err) {}
    };
    fetchLeagueData();
    return () => { isMounted = false; };
  }, [effectiveLeagueId, selectedSeason, teamId]);

  // Fetch team info and available seasons
  useEffect(() => {
    const fetchTeamInfo = async () => {
      try {
        // Fetch specific team info
        const response = await fetch(`/api/football/teams?id=${teamId}`);
        const teamRes = await response.json();
        setTeam(teamRes.response[0]);

        // Fetch leagues/seasons for this team
        const leaguesRes = await footballApi.getLeaguesByTeam(teamId);
        setTeamLeagues(leaguesRes || []);
        const seasons = new Set<number>();
        let currentLeagueSeason: number | null = null;
        let currentAnySeason: number | null = null;

        (leaguesRes || []).forEach((l: any) => {
          (l.seasons || []).forEach((s: any) => {
            seasons.add(s.year);
            
            if (s.current) {
              if (l.league.type === 'League') {
                if (!currentLeagueSeason || s.year > currentLeagueSeason) {
                  currentLeagueSeason = s.year;
                }
              }
              if (!currentAnySeason || s.year > currentAnySeason) {
                currentAnySeason = s.year;
              }
            }
          });
        });
        
        const sortedSeasons = Array.from(seasons).sort((a, b: number) => b - a);
        setAvailableSeasons(sortedSeasons);
        
        let actualSeason = sortedSeasons[0];
        if (currentLeagueSeason !== null) {
          actualSeason = currentLeagueSeason;
        } else if (currentAnySeason !== null) {
          actualSeason = currentAnySeason;
        }
        
        setActualCurrentSeason(actualSeason);
        
        // Default to initialSeason if provided, else to the actual current season
        if (initialSeason) {
          setSelectedSeason(initialSeason);
        } else {
          setSelectedSeason(actualSeason);
        }
      } catch (err) {
        console.error('Failed to fetch team info', err);
      }
    };
    fetchTeamInfo();
  }, [teamId]);

  const fetchData = async (force = false) => {
    if (!selectedSeason) return;
    if (force) setRefreshing(true);
    else setLoading(true);
    
    try {
      // Fetch fixtures and squad in parallel
      const [fixturesResults, squadResults] = await Promise.allSettled([
        footballDataService.getFixturesByTeam(teamId, selectedSeason, force),
        footballDataService.getSquad(teamId)
      ]);

      const fixturesData = fixturesResults.status === 'fulfilled' ? fixturesResults.value : [];
      const squadData = squadResults.status === 'fulfilled' ? squadResults.value : [];

      setFixtures(fixturesData);
      
      // squadData comes as [{team: {...}, players: [...]}]
      if (squadData.length > 0 && squadData[0].players) {
        setSquad(squadData[0].players);
      } else {
        setSquad([]);
      }

      // If we have a league from fixtures, fetch players (no league filter)
      if (fixturesData.length > 0) {
        const [playersResults] = await Promise.allSettled([
          footballDataService.getPlayers(teamId, selectedSeason)
        ]);
        
        setPlayers(playersResults.status === 'fulfilled' ? playersResults.value : []);
      } else {
        // Fallback: fetch players without league filter if no fixtures found
        const playersFallback = await footballDataService.getPlayers(teamId, selectedSeason);
        setPlayers(playersFallback);
      }

      // Get the most recent update timestamp
      const updateResults = await Promise.allSettled([
        footballDataService.getLastUpdated(`fixtures_team_${teamId}_${selectedSeason}`),
        fixturesData.length > 0 ? footballDataService.getLastUpdated(`standings_${fixturesData[0].league.id}_${selectedSeason}`) : Promise.resolve(null)
      ]);
      
      const dates = updateResults
        .filter((res): res is PromiseFulfilledResult<Date | null> => res.status === 'fulfilled')
        .map(res => res.value)
        .filter((d): d is Date => d !== null);

      if (dates.length > 0) {
        setLastUpdated(new Date(Math.max(...dates.map(d => d.getTime()))));
      } else {
        setLastUpdated(null);
      }
    } catch (err) {
      console.error('Failed to fetch team details', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!selectedSeason) return;
    const alreadyRefreshed = lastRefreshedTeamRef.current?.teamId === teamId && lastRefreshedTeamRef.current?.season === selectedSeason;
    fetchData(!alreadyRefreshed);
    if (!alreadyRefreshed) {
      lastRefreshedTeamRef.current = { teamId, season: selectedSeason };
    }
  }, [teamId, selectedSeason]);

  const handleRefresh = () => {
    fetchData(true);
  };

  if (loading && !team) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-orange-500"></div>
        <p className="text-gray-500 font-bold animate-pulse uppercase italic tracking-widest">Chargement des détails de l'équipe...</p>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center px-4">
        <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-2">
          <Activity className="w-8 h-8 text-gray-500" />
        </div>
        <h3 className="text-xl font-black text-white uppercase italic">Données indisponibles</h3>
        <p className="text-gray-400 text-sm max-w-xs">
          Impossible de charger les détails de l'équipe. La limite de requêtes a peut-être été atteinte.
        </p>
        <Button onClick={onBack} variant="outline" className="mt-4">
          Retour
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-20 px-4">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 flex items-center justify-center drop-shadow-md">
                <img src={team.team.logo} alt="" className="w-full h-full object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black italic uppercase tracking-tighter leading-tight text-white">
                    {team.team.name}
                  </h2>
                  {profile?.favoriteTeams?.some(id => id.toString() === teamId.toString()) && (
                    <Star className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <p className="text-[8px] text-gray-400 uppercase font-black tracking-widest">
                    {translateCountryName(team.team.country)} - {team.venue.city}
                  </p>
                  {lastUpdated && (
                    <div className="flex items-center gap-1 text-[7px] font-bold text-gray-500 uppercase italic tracking-widest border-l border-white/10 pl-1.5">
                      <Clock className="w-2 h-2" />
                      {format(lastUpdated, 'dd/MM HH:mm')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="flex items-center gap-1 text-[8px] font-black uppercase italic tracking-widest h-7 px-2"
          >
            <RefreshCw className={`w-2 h-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? '...' : 'Actualiser'}
          </Button>
        </div>

        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 h-9">
          <History className="w-3.5 h-3.5 text-gray-500" />
          <select 
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(Number(e.target.value))}
            className="bg-transparent text-[10px] font-black uppercase italic focus:outline-none cursor-pointer flex-1"
          >
            {availableSeasons.map((year) => (
              <option key={year} value={year} className="bg-gray-900">
                Saison {year} {(actualCurrentSeason ? year === actualCurrentSeason : year === availableSeasons[0]) ? '(Actuelle)' : ''}
              </option>
            ))}
          </select>
          {selectedSeason === availableSeasons[0] && (
            <span className="text-[7px] bg-green-500/20 text-green-500 px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest">
              Actuelle
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-orange-500"></div>
          <p className="text-gray-500 font-bold animate-pulse uppercase italic tracking-widest">Mise à jour des données...</p>
        </div>
      ) : (
        <>
          {/* Stadium Info Card */}
          <Card className="relative overflow-hidden border-orange-500/20 p-0">
            <div className="h-24 w-full relative">
              <img 
                src={team.venue.image || "https://thebestfan.online/img/public/img/background/stade.png"} 
                alt={team.venue.name} 
                className="w-full h-full object-cover opacity-50"
                onError={(e) => {
                  e.currentTarget.src = "https://thebestfan.online/img/public/img/background/stade.png";
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent"></div>
              <div className="absolute bottom-2 left-3">
                <h3 className="text-xs font-black italic uppercase tracking-tight flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-orange-500" />
                  {team.venue.name}
                </h3>
                <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">
                  {team.venue.city} • {team.venue.capacity?.toLocaleString()} places
                </p>
              </div>
            </div>
          </Card>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-white/5 rounded-lg border border-white/10 overflow-x-auto no-scrollbar">
            <TabButton 
              active={activeTab === 'infos'} 
              onClick={() => setActiveTab('infos')}
              icon={<Info className="w-3 h-3" />}
              label="Infos"
            />
            <TabButton 
              active={activeTab === 'matches'} 
              onClick={() => setActiveTab('matches')}
              icon={<Calendar className="w-3 h-3" />}
              label="Matches"
            />
            <TabButton 
              active={activeTab === 'standings'} 
              onClick={() => setActiveTab('standings')}
              icon={<Trophy className="w-3 h-3" />}
              label="Classement"
            />
            <TabButton 
              active={activeTab === 'competitions'} 
              onClick={() => setActiveTab('competitions')}
              icon={<Award className="w-3 h-3" />}
              label="Compétitions"
            />
            <TabButton 
              active={activeTab === 'effectif'} 
              onClick={() => setActiveTab('effectif')}
              icon={<Users className="w-3 h-3" />}
              label="Effectif"
            />
            <TabButton 
              active={activeTab === 'stats'} 
              onClick={() => setActiveTab('stats')}
              icon={<BarChart3 className="w-3 h-3" />}
              label="Stats"
            />
            <TabButton 
              active={activeTab === 'historique'} 
              onClick={() => setActiveTab('historique')}
              icon={<Clock className="w-3 h-3" />}
              label="Historique"
            />
            <TabButton 
              active={activeTab === 'tbfo'} 
              onClick={() => setActiveTab('tbfo')}
              icon={<Shield className="w-3 h-3" />}
              label="TBFO"
              highlight={true}
            />
          </div>

          {/* Global League Filter (only for relevant tabs) */}
          {['infos', 'matches', 'standings', 'effectif', 'stats'].includes(activeTab) && seasonLeagues.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-2 mt-2">
              {activeTab !== 'standings' && (
                <button 
                  onClick={() => setSelectedLeagueId(null)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-colors whitespace-nowrap min-w-0 flex-shrink-0 ${
                    selectedLeagueId === null && (activeTab as string) !== 'standings'
                      ? 'bg-orange-500/10 border-orange-500 text-white' 
                      : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <span className="text-[10px] sm:text-xs font-black uppercase italic truncate">Toutes</span>
                </button>
              )}
              {seasonLeagues.map((l: any) => (
                <button 
                  key={l.id}
                  onClick={() => setSelectedLeagueId(l.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-colors whitespace-nowrap min-w-0 flex-shrink-0 ${
                    (selectedLeagueId === l.id) || (selectedLeagueId === null && effectiveLeagueId === l.id && (activeTab as string) === 'standings')
                      ? 'bg-orange-500/10 border-orange-500 text-white' 
                      : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <img src={l.logo} alt="" className="w-5 h-5 object-contain" />
                  <span className="text-[10px] sm:text-xs font-black uppercase italic truncate">{translateLeagueName(l.name)}</span>
                </button>
              ))}
            </div>
          )}

          {/* Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'infos' && <InfosTab team={team} players={players} selectedLeagueId={selectedLeagueId} selectedSeason={selectedSeason} onPlayerClick={onPlayerClick} fixtures={fixtures} />}
              {activeTab === 'matches' && <MatchesTab fixtures={fixtures} onTeamClick={onTeamClick} onLeagueClick={onLeagueClick} onMatchClick={onMatchClick} selectedSeason={selectedSeason} profile={profile} selectedLeagueId={selectedLeagueId} />}
              {activeTab === 'standings' && <StandingsTab standings={standings} teamId={teamId} onTeamClick={onTeamClick} selectedSeason={selectedSeason} fixtures={fixtures} effectiveLeagueId={effectiveLeagueId} />}
              {activeTab === 'competitions' && <CompetitionsTab leagues={teamLeagues} onLeagueClick={onLeagueClick} selectedSeason={selectedSeason} />}
              {activeTab === 'effectif' && <EffectifTab squad={squad} players={players} selectedLeagueId={selectedLeagueId} selectedSeason={selectedSeason} onPlayerClick={onPlayerClick} />}
              {activeTab === 'stats' && <StatsTab stats={selectedLeagueId === null ? aggregatedStats : stats} teamId={teamId} selectedSeason={selectedSeason} />}
              {activeTab === 'historique' && <HistoriqueTab leagues={teamLeagues} onLeagueClick={onLeagueClick} selectedSeason={selectedSeason} />}
              {activeTab === 'tbfo' && effectiveLeagueId ? (
                <TbfoRankingsTab leagueId={effectiveLeagueId} selectedSeason={selectedSeason} onTeamClick={onTeamClick} highlightTeamId={teamId} />
              ) : activeTab === 'tbfo' ? (
                <Card className="py-10 text-center text-gray-500">Données de ligue non disponibles.</Card>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, label, highlight }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; highlight?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={`flex-1 min-w-[80px] flex items-center justify-center gap-1 py-1.5 px-2 rounded-md transition-all font-bold text-[9px] sm:text-[10px] uppercase italic whitespace-nowrap ${
        active 
          ? 'bg-orange-600 text-white shadow-md' 
          : highlight 
            ? 'text-orange-500 hover:text-orange-400 hover:bg-orange-500/10' 
            : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function CompetitionsTab({ leagues, onLeagueClick, selectedSeason }: { leagues: any[], onLeagueClick: (id: number, season: number) => void, selectedSeason: number }) {
  if (!leagues || leagues.length === 0) {
    return <Card className="py-6 text-center text-gray-500 text-xs font-bold italic">Aucune compétition trouvée.</Card>;
  }

  // Filter leagues by the selected season. Some competitions might not have the team in the exact selected season, but let's try.
  let displayLeagues = leagues.filter(l => l.seasons && l.seasons.some((s: any) => s.year === selectedSeason));
  if (displayLeagues.length === 0) displayLeagues = leagues;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {displayLeagues.map((l: any) => (
        <Card key={l.league.id} className="p-4 bg-black/40 border-white/10 hover:border-orange-500/50 cursor-pointer transition-colors group" onClick={() => onLeagueClick(l.league.id, selectedSeason)}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center border border-white/10 p-2 group-hover:bg-white/10 transition-colors">
              <img src={l.league.logo} alt="" className="w-full h-full object-contain drop-shadow-md" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base uppercase text-orange-500 truncate">{l.league.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                {l.country.flag && <img src={l.country.flag} alt="" className="w-3 h-3 object-contain rounded-sm" />}
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{translateCountryName(l.country.name)}</p>
                <span className="text-gray-600 text-[10px]">&bull;</span>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{l.league.type === 'League' ? 'Championnat' : l.league.type === 'Cup' ? 'Coupe' : l.league.type}</p>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function EffectifTab({ squad, players, selectedLeagueId, selectedSeason, onPlayerClick }: { squad: any[], players: any[], selectedLeagueId: number | null, selectedSeason: number, onPlayerClick?: (id: number, season: number) => void }) {
  return <PlayersTab squad={squad} players={players} selectedLeagueId={selectedLeagueId} selectedSeason={selectedSeason} onPlayerClick={onPlayerClick} />;
}

function HistoriqueTab({ leagues, onLeagueClick, selectedSeason }: { leagues: any[], onLeagueClick: (id: number, season: number) => void, selectedSeason: number }) {
  if (!leagues || leagues.length === 0) {
    return <Card className="py-6 text-center text-gray-500 text-xs font-bold italic">Aucun historique trouvé.</Card>;
  }

  // Get all seasons present in the leagues for this team, EXCLUDING the current selectedSeason
  const seasonsMap: Record<number, any[]> = {};
  leagues.forEach(l => {
    if (l.seasons) {
      l.seasons.forEach((s: any) => {
        if (s.year !== selectedSeason) {
          if (!seasonsMap[s.year]) seasonsMap[s.year] = [];
          seasonsMap[s.year].push(l);
        }
      });
    }
  });

  const sortedSeasons = Object.keys(seasonsMap).map(Number).sort((a, b) => b - a);

  if (sortedSeasons.length === 0) {
    return <Card className="py-6 text-center text-gray-500 text-xs font-bold italic">Aucun historique disponible pour les années précédentes.</Card>;
  }

  return (
    <div className="space-y-6">
      {sortedSeasons.map(year => (
        <div key={year} className="space-y-3">
          <h3 className="text-orange-500 font-black uppercase italic tracking-widest text-sm pl-2 border-l-2 border-orange-500">Saison {year}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {seasonsMap[year].map((l: any) => (
              <Card key={`${year}-${l.league.id}`} className="p-4 bg-black/40 border-white/10 hover:border-orange-500/50 cursor-pointer transition-colors group" onClick={() => onLeagueClick(l.league.id, year)}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center border border-white/10 p-2 group-hover:bg-white/10 transition-colors">
                    <img src={l.league.logo} alt="" className="w-full h-full object-contain drop-shadow-md" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm sm:text-base uppercase text-orange-500 truncate">{l.league.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {l.country.flag && <img src={l.country.flag} alt="" className="w-3 h-3 object-contain rounded-sm" />}
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{translateCountryName(l.country.name)}</p>
                      <span className="text-gray-600 text-[10px]">&bull;</span>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{l.league.type === 'League' ? 'Championnat' : l.league.type === 'Cup' ? 'Coupe' : l.league.type}</p>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function InfosTab({ team, players, selectedLeagueId, selectedSeason, onPlayerClick, fixtures }: { team: any, players: any[], selectedLeagueId: number | null, selectedSeason: number, onPlayerClick?: (id: number, season: number) => void, fixtures: any[] }) {
  const nowMs = Date.now();
  const leagueFixtures = selectedLeagueId 
    ? fixtures.filter((f: any) => f.league?.id === selectedLeagueId)
    : fixtures;

  const hasAnyStartedMatch = leagueFixtures.some((f: any) => 
    ['FT', 'AET', 'PEN', '1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE'].includes(f.fixture?.status?.short) ||
    (f.fixture?.date && new Date(f.fixture.date).getTime() < nowMs)
  );

  const competitionNotStartedYet = leagueFixtures.length > 0 ? !hasAnyStartedMatch : false;

  return (
    <div className="space-y-6">
      {team && (
        <Card className="p-4 sm:p-6 bg-black/40 border border-white/10">
          <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start text-center sm:text-left">
            {team.logo && 
              <div className="w-24 h-24 sm:w-32 sm:h-32 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 p-4 shrink-0">
                <img src={team.logo} className="w-full h-full object-contain drop-shadow-xl" alt="" />
              </div>
            }
            <div className="flex-1 space-y-3">
              <h2 className="text-2xl sm:text-3xl font-black uppercase text-orange-500 tracking-tight">{team.name}</h2>
              <div className="flex justify-center sm:justify-start gap-4 flex-wrap text-xs sm:text-sm text-gray-300">
                {team.country && <span className="font-bold flex items-center gap-1.5 opacity-80"><img src={`https://media.api-sports.io/flags/${team.country.toLowerCase()}.svg`} className="w-4 h-4 object-contain rounded-sm" onError={(e) => e.currentTarget.style.display='none'} alt="" /> {translateCountryName(team.country)}</span>}
                {team.founded && <span className="font-bold opacity-80">Fondé en {team.founded}</span>}
                {team.venue?.name && <span className="font-bold opacity-80">Stade: {team.venue.name}</span>}
                {team.venue?.city && <span className="font-bold opacity-80">Ville: {team.venue.city}</span>}
                {team.venue?.capacity && <span className="font-bold opacity-80">Capacité: {team.venue.capacity.toLocaleString()}</span>}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Show Rankings if available */}
      {players.length > 0 && (
        <div className="pt-2">
          <h3 className="text-orange-500 font-black uppercase italic tracking-widest text-sm mb-3 pl-2 border-l-2 border-orange-500">Tops Joueurs</h3>
          <TeamRankingsTab players={players} selectedLeagueId={selectedLeagueId} selectedSeason={selectedSeason} onPlayerClick={onPlayerClick} competitionNotStartedYet={competitionNotStartedYet} />
        </div>
      )}
    </div>
  );
}

function TeamRankingsTab({ players, selectedLeagueId, selectedSeason, onPlayerClick, competitionNotStartedYet }: { players: any[], selectedLeagueId: number | null, selectedSeason: number, onPlayerClick?: (id: number, season: number) => void, competitionNotStartedYet: boolean }) {
  if (players.length === 0) {
    return (
      <Card className="py-6 text-center text-gray-500 text-xs font-bold italic">
        Les données individuelles des joueurs ne sont malheureusement pas couvertes par notre fournisseur pour cette équipe.
      </Card>
    );
  }

  const getAggregatedStats = (player: any) => {
    let goals = 0;
    let assists = 0;
    let yellow = 0;
    let red = 0;
    
    player.statistics?.forEach((stat: any) => {
      if (selectedLeagueId !== null && stat.league?.id !== selectedLeagueId) return;
      goals += stat.goals?.total || 0;
      assists += stat.goals?.assists || 0;
      yellow += stat.cards?.yellow || 0;
      red += stat.cards?.red || 0;
    });
    
    return { goals, assists, yellow, red };
  };

  const playersWithAgg = players.map(p => ({
    ...p,
    agg: getAggregatedStats(p)
  }));

  const scorers = [...playersWithAgg].sort((a, b) => b.agg.goals - a.agg.goals).slice(0, 5);
  const assists = [...playersWithAgg].sort((a, b) => b.agg.assists - a.agg.assists).slice(0, 5);
  const yellows = [...playersWithAgg].sort((a, b) => b.agg.yellow - a.agg.yellow).slice(0, 5);
  const reds = [...playersWithAgg].sort((a, b) => b.agg.red - a.agg.red).slice(0, 5);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <TeamRankingList title="Buteurs" data={scorers} label="Buts" valKey="agg.goals" icon={<Goal className="w-3.5 h-3.5 text-green-500" />} selectedSeason={selectedSeason} onPlayerClick={onPlayerClick} competitionNotStartedYet={competitionNotStartedYet} />
      <TeamRankingList title="Passeurs" data={assists} label="Passes" valKey="agg.assists" icon={<Activity className="w-3.5 h-3.5 text-blue-500" />} selectedSeason={selectedSeason} onPlayerClick={onPlayerClick} competitionNotStartedYet={competitionNotStartedYet} />
      <TeamRankingList title="Cartons Jaunes" data={yellows} label="Jaunes" valKey="agg.yellow" icon={<Square className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />} selectedSeason={selectedSeason} onPlayerClick={onPlayerClick} competitionNotStartedYet={competitionNotStartedYet} />
      <TeamRankingList title="Cartons Rouges" data={reds} label="Rouges" valKey="agg.red" icon={<Square className="w-3.5 h-3.5 text-red-500 fill-red-500" />} selectedSeason={selectedSeason} onPlayerClick={onPlayerClick} competitionNotStartedYet={competitionNotStartedYet} />
    </div>
  );
}

function TeamRankingList({ title, data, label, valKey, icon, selectedSeason, onPlayerClick, competitionNotStartedYet }: { title: string; data: any[]; label: string; valKey: string; icon: React.ReactNode; selectedSeason: number; onPlayerClick?: (id: number, season: number) => void; competitionNotStartedYet: boolean }) {
  const getVal = (p: any) => {
    if (valKey === 'agg.goals') return p.agg.goals;
    if (valKey === 'agg.assists') return p.agg.assists;
    if (valKey === 'agg.yellow') return p.agg.yellow;
    if (valKey === 'agg.red') return p.agg.red;
    return 0;
  };

  const hasNoData = data.length === 0 || data.every(p => getVal(p) === 0);

  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-black italic uppercase text-gray-500 border-b border-white/10 pb-1 tracking-widest flex items-center gap-1.5">
        {icon}
        {title}
      </h3>
      
      {hasNoData ? (
        <Card className="py-6 px-4 bg-black/25 border border-white/5 flex flex-col items-center justify-center text-center gap-1">
          <span className="text-[10px] font-bold text-gray-400">
            {competitionNotStartedYet ? "La compétition n'a pas encore commencé" : (
              valKey === 'agg.goals' ? "L'équipe n'a pas marqué" :
              valKey === 'agg.assists' ? "L'équipe n'a pas fait de passe décisive" :
              "L'équipe n'a pas eu de carton"
            )}
          </span>
        </Card>
      ) : (
        <div className="space-y-1">
          {data.map((p, idx) => {
            const val = getVal(p);
            if (val === 0 && idx > 0) return null;

            return (
              <Card 
                key={p.player.id} 
                className={`flex items-center justify-between p-1.5 transition-colors ${onPlayerClick ? 'cursor-pointer hover:border-orange-500/50 hover:bg-white/10' : ''}`}
                onClick={() => onPlayerClick && onPlayerClick(p.player.id, selectedSeason)}
              >
                <div className="flex items-center gap-2">
                  <img src={p.player.photo} alt="" className="w-6 h-6 rounded-full border border-white/10" />
                  <span className={`text-xs font-bold ${onPlayerClick ? 'hover:text-orange-500' : ''}`}>{p.player.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-orange-500">{val}</span>
                  <p className="text-[7px] uppercase font-bold text-gray-500">{label}</p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MatchesTab({ fixtures, onTeamClick, onLeagueClick, onMatchClick, selectedSeason, profile, selectedLeagueId }: { fixtures: any[]; onTeamClick: (id: number, season: number) => void; onLeagueClick: (id: number, season: number) => void; onMatchClick?: (id: number, tab?: 'summary' | 'lineups' | 'stats' | 'duels') => void; selectedSeason: number; profile?: any; selectedLeagueId: number | null }) {
  const [matchScores, setMatchScores] = useState<Record<string, { scoreA: number, scoreB: number }>>({});
  const [activeDuels, setActiveDuels] = useState<any[]>([]);
  const [matchEvents, setMatchEvents] = useState<Record<string, any[] | null>>({});

  const liveMatches = React.useMemo(() => {
    const favoriteIds = profile?.favoriteTeams?.map((id: any) => id.toString()) || [];
    return fixtures.filter(f => ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE'].includes(f.fixture.status.short)).sort((a, b) => {
      const aIsFav = favoriteIds.includes(a.teams.home.id.toString()) || favoriteIds.includes(a.teams.away.id.toString());
      const bIsFav = favoriteIds.includes(b.teams.home.id.toString()) || favoriteIds.includes(b.teams.away.id.toString());
      if (aIsFav && !bIsFav) return -1;
      if (!aIsFav && bIsFav) return 1;
      return 0;
    });
  }, [fixtures, profile]);

  useEffect(() => {
    if (!selectedLeagueId) return;

    const matchesToEnrich = fixtures.filter(f => 
      f.league.id === selectedLeagueId && 
      !matchEvents[f.fixture.id] && matchEvents[f.fixture.id] !== null &&
      ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE', 'FT', 'AET', 'PEN'].includes(f.fixture.status.short)
    );

    if (matchesToEnrich.length === 0) return;

    const fetchEvents = async () => {
      const idsToFetch = matchesToEnrich.map(m => m.fixture.id);
      try {
        for (let i = 0; i < idsToFetch.length; i += 20) {
          const chunk = idsToFetch.slice(i, i + 20);
          if (i > 0) {
            await new Promise(r => setTimeout(r, 1500));
          }
          try {
            const detailedFixtures = await footballApi.getFixturesByIds(chunk);
            const eventsMap: Record<string, any[]> = {};
            if (detailedFixtures && detailedFixtures.length > 0) {
              detailedFixtures.forEach((f: any) => {
                eventsMap[f.fixture.id] = f.events || [];
              });
              setMatchEvents(prev => ({ ...prev, ...eventsMap }));
            } else {
              chunk.forEach(id => { eventsMap[id] = null as any; });
              setMatchEvents(prev => ({ ...prev, ...eventsMap }));
              break;
            }
          } catch (e) {
            const eventsMap: Record<string, any[]> = {};
            chunk.forEach(id => { eventsMap[id] = null as any; });
            setMatchEvents(prev => ({ ...prev, ...eventsMap }));
          }
        }
      } catch (e) {
        console.warn("Failed to fetch match events", e);
      }
    };
    fetchEvents();
  }, [fixtures, selectedLeagueId, matchEvents]);

  // Fetch Duels
  useEffect(() => {
    const fetchActiveDuels = async () => {
      try {
        const res = await fetch('/api/duels/all', { headers: { 'Accept': 'application/json' }});
        if (res.ok) {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const duelsData = await res.json();
            setActiveDuels(duelsData);
          }
        }
      } catch (err: any) {
        if (err?.message !== 'Failed to fetch') {
          console.error("Failed to fetch active duels", err);
        }
      }
    };
    fetchActiveDuels();
  }, []);

  const displayedFixtures = React.useMemo(() => {
    let filtered = fixtures;
    if (selectedLeagueId) {
      filtered = fixtures.filter((f: any) => f.league.id === selectedLeagueId);
    }
    return [...filtered].sort((a: any, b: any) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime());
  }, [fixtures, selectedLeagueId]);

  // Fetch scores for this round
  useEffect(() => {
    const matchIds = displayedFixtures.map((m: any) => m.fixture.id.toString());
    if (matchIds.length === 0) return;

    setMatchScores({});
    const unsubs: (() => void)[] = [];
    const chunkSize = 10;
    
    for (let i = 0; i < matchIds.length; i += chunkSize) {
      const chunk = matchIds.slice(i, i + chunkSize);
      const q = query(collection(db, 'match_scores'), where('matchId', 'in', chunk));
      
      const unsub = onSnapshot(q, (snapshot) => {
        setMatchScores(prev => {
          const newMap = { ...prev };
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
      });
      unsubs.push(unsub);
    }
    
    return () => {
      unsubs.forEach(u => u());
    };
  }, [displayedFixtures]);

  const groupedByMonth = React.useMemo(() => {
    const grouped: Record<string, any[]> = {};
    displayedFixtures.forEach(f => {
      const date = new Date(f.fixture.date);
      const monthYear = format(date, 'MMMM yyyy', { locale: fr });
      if (!grouped[monthYear]) grouped[monthYear] = [];
      grouped[monthYear].push(f);
    });
    return grouped;
  }, [displayedFixtures]);

  if (fixtures.length === 0) return <Card className="py-10 text-center text-gray-500">Aucun match trouvé.</Card>;

  return (
    <div className="space-y-4">
      {/* Live Matches Slider */}
      {liveMatches.length > 0 && (
        <div className="-mx-4 md:mx-0">
          <LiveMatchesSlider
            matches={liveMatches}
            activeDuels={activeDuels}
            matchScores={matchScores}
            onMatchClick={onMatchClick || (() => {})}
            onJoinDuel={(id) => {}} // Not implemented internally
            onTeamClick={onTeamClick}
            onLeagueClick={onLeagueClick}
            profile={profile}
          />
        </div>
      )}

      {/* Matches Grid */}
      {Object.entries(groupedByMonth).map(([month, monthFixtures]) => (
        <div key={month} className="space-y-3">
          <h3 className="text-orange-500 font-black uppercase italic tracking-widest text-sm pl-2 border-l-2 border-orange-500">{month}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {monthFixtures.map(match => (
              <SharedMatchCard
                key={match.fixture.id}
                match={{ ...match, events: match.events || matchEvents[match.fixture.id] || [] }}
                hasActiveDuel={activeDuels.some(d => d.matchId === match.fixture.id)}
                matchScore={matchScores[match.fixture.id.toString()]}
                onClick={(tab) => onMatchClick && onMatchClick(match.fixture.id, tab)}
                onJoinDuel={() => {}}
                onTeamClick={onTeamClick}
                profile={profile}
                showLeagueHeader={true}
                showDate={true}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PlayersTab({ squad, players, selectedLeagueId, selectedSeason, onPlayerClick }: { squad?: any[], players: any[], selectedLeagueId: number | null, selectedSeason: number, onPlayerClick?: (id: number, season: number) => void }) {
  const mergedPlayers = React.useMemo(() => {
    const map = new Map<number, any>();
    
    // Add all from squad (has photo, name, age, number, position)
    if (squad && squad.length > 0) {
      squad.forEach(p => {
        map.set(p.id, {
          id: p.id,
          name: p.name,
          photo: p.photo,
          age: p.age,
          number: p.number,
          position: p.position,
          stats: { played: 0, minutes: 0, goals: 0, assists: 0 }
        });
      });
    }

    // Add/merge from players (has detailed stats with array over leagues)
    if (players && players.length > 0) {
      players.forEach(p => {
        const id = p.player?.id;
        if (!id) return;

        let played = 0;
        let minutes = 0;
        let goals = 0;
        let assists = 0;

        p.statistics?.forEach((stat: any) => {
          if (selectedLeagueId !== null && stat.league?.id !== selectedLeagueId) return;
          played += stat.games?.appearences || 0;
          minutes += stat.games?.minutes || 0;
          goals += stat.goals?.total || 0;
          assists += stat.goals?.assists || 0;
        });

        // Use position from stats if missing
        const pos = p.statistics?.[0]?.games?.position || 'Unknown';

        if (map.has(id)) {
          const np = map.get(id);
          np.stats = { played, minutes, goals, assists };
        } else {
          map.set(id, {
            id: p.player.id,
            name: p.player.name,
            photo: p.player.photo,
            age: p.player.age,
            number: p.statistics?.[0]?.games?.number,
            position: pos,
            stats: { played, minutes, goals, assists }
          });
        }
      });
    }
    
    // Sort by position then name
    return Array.from(map.values()).sort((a, b) => {
      // Prioritize played matches to hide completely unknown/inactive players if they have 0
      if (a.stats.played !== b.stats.played) return b.stats.played - a.stats.played;
      return a.name.localeCompare(b.name);
    });
  }, [squad, players, selectedLeagueId]);

  if (!mergedPlayers || mergedPlayers.length === 0) {
    return (
      <Card className="py-6 text-center text-gray-500 text-xs font-bold italic">
        L'effectif de l'équipe n'est malheureusement pas couvert par notre fournisseur de données.
      </Card>
    );
  }

  const groupedByPos = mergedPlayers.reduce((acc: any, p: any) => {
    const pos = p.position || 'Unknown';
    if (!acc[pos]) acc[pos] = [];
    acc[pos].push(p);
    return acc;
  }, {});

  const posOrder = ['Goalkeeper', 'Defender', 'Midfielder', 'Attacker', 'Unknown'];

  return (
    <div className="space-y-4">
      {posOrder.map(pos => {
        if (!groupedByPos[pos]) return null;
        return (
          <div key={pos} className="space-y-2">
            <h3 className="text-[10px] font-black italic uppercase text-gray-500 border-b border-white/10 pb-1 tracking-widest pl-2">
              {pos === 'Goalkeeper' ? 'Gardiens' : pos === 'Defender' ? 'Défenseurs' : pos === 'Midfielder' ? 'Milieux' : pos === 'Attacker' ? 'Attaquants' : 'Inconnu'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {groupedByPos[pos].map((p: any) => (
                 <Card 
                   key={p.id} 
                   className="flex gap-2 p-2 hover:bg-white/5 transition-colors cursor-pointer group"
                   onClick={() => onPlayerClick && onPlayerClick(p.id, selectedSeason)}
                 >
                   <div className="relative">
                     <img src={p.photo} alt={p.name} className="w-10 h-10 rounded-full border border-white/10 object-cover bg-white/5" />
                     {p.number && (
                       <div className="absolute -bottom-1 -right-1 bg-orange-600 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-md">
                         {p.number}
                       </div>
                     )}
                   </div>
                   <div className="min-w-0 flex-1 flex flex-col justify-center">
                     <div className="flex items-center justify-between">
                       <h4 className="text-[11px] font-black uppercase italic truncate">{p.name}</h4>
                     </div>
                     <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                       {p.age && <span className="text-[8px] text-gray-500 font-bold uppercase">{p.age} ans</span>}
                       <div className="flex items-center gap-2 mt-0.5 ml-auto">
                         <div className="flex items-center gap-1 text-[8px] text-gray-400 font-bold" title="Matches joués">
                           <Activity className="w-2.5 h-2.5 text-blue-400" />
                           {p.stats.played}
                         </div>
                         <div className="flex items-center gap-1 text-[8px] text-gray-400 font-bold" title="Minutes jouées">
                           <Clock className="w-2.5 h-2.5 text-purple-400" />
                           {p.stats.minutes}'
                         </div>
                         <div className="flex items-center gap-1 text-[8px] text-gray-400 font-bold" title="Buts">
                           <Goal className="w-2.5 h-2.5 text-green-400" />
                           {p.stats.goals}
                         </div>
                       </div>
                     </div>
                   </div>
                 </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StandingsTab({ standings, teamId, onTeamClick, selectedSeason, fixtures, effectiveLeagueId }: { standings: any[]; teamId: number; onTeamClick: (id: number, season: number) => void; selectedSeason: number; fixtures?: any[]; effectiveLeagueId?: number | null }) {
  const nowMs = Date.now();
  const leagueFixtures = fixtures && effectiveLeagueId 
    ? fixtures.filter((f: any) => f.league?.id === effectiveLeagueId)
    : (fixtures || []);

  const hasAnyStartedMatch = leagueFixtures.some((f: any) => 
    ['FT', 'AET', 'PEN', '1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE'].includes(f.fixture?.status?.short) ||
    (f.fixture?.date && new Date(f.fixture.date).getTime() < nowMs)
  );

  const competitionNotStartedYet = leagueFixtures.length > 0 ? !hasAnyStartedMatch : false;
  const allPlayedAreZero = standings.length > 0 && standings.every((s: any) => (s.all?.played || 0) === 0);

  if (competitionNotStartedYet) {
    return (
      <Card className="py-8 text-center text-gray-400 text-xs font-bold italic flex flex-col items-center justify-center gap-2 border border-white/10 bg-black/40">
        <span className="text-orange-500 font-black uppercase text-sm">La compétition n'a pas encore commencé</span>
        <span>Les matchs de cette saison débuteront prochainement.</span>
      </Card>
    );
  }

  if (allPlayedAreZero) {
    return (
      <Card className="py-8 text-center text-gray-400 text-xs font-bold italic flex flex-col items-center justify-center gap-2 border border-white/10 bg-black/40">
        <span className="text-[11px] text-orange-500 font-black uppercase">Classement non disponible</span>
        <span className="text-[10px]">Aucun match n'a encore été disputé pour cette compétition.</span>
      </Card>
    );
  }

  if (standings.length === 0) {
    return (
      <Card className="py-6 text-center text-gray-500 text-xs font-bold italic">
        Le classement n'est malheureusement pas disponible chez notre fournisseur de données, ou la compétition se déroule sous forme de phase à élimination directe exclusive.
      </Card>
    );
  }

  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-gray-400">
            <th className="px-3 py-3 w-8 text-center">#</th>
            <th className="px-3 py-3">Équipe</th>
            <th className="px-3 py-3 text-center">J</th>
            <th className="px-3 py-3 text-center">G</th>
            <th className="px-3 py-3 text-center">N</th>
            <th className="px-3 py-3 text-center">P</th>
            <th className="px-3 py-3 text-center">Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {standings.map((s) => (
            <tr key={s.team.id} className={`hover:bg-white/5 transition-colors cursor-pointer group ${s.team.id === teamId ? 'bg-orange-500/10' : ''}`} onClick={() => onTeamClick(s.team.id, selectedSeason)}>
              <td className="px-2 py-2 text-center font-black italic text-xs text-orange-500">{s.rank}</td>
              <td className="px-2 py-2">
                <div className="flex items-center gap-2">
                  <img src={s.team.logo} alt="" className="w-5 h-5 object-contain" />
                  <span className={`font-bold text-xs group-hover:text-orange-500 transition-colors ${s.team.id === teamId ? 'text-orange-500' : ''}`}>{s.team.name}</span>
                </div>
              </td>
              <td className="px-2 py-2 text-center text-[10px] font-bold">{s.all.played}</td>
              <td className="px-2 py-2 text-center text-[10px] font-bold text-green-500">{s.all.win}</td>
              <td className="px-2 py-2 text-center text-[10px] font-bold text-gray-500">{s.all.draw}</td>
              <td className="px-2 py-2 text-center text-[10px] font-bold text-red-500">{s.all.lose}</td>
              <td className="px-2 py-2 text-center font-black text-xs">{s.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function StatsTab({ stats, teamId, selectedSeason, onPlayerClick }: { stats: any, teamId: number, selectedSeason: number, onPlayerClick?: (id: number, season: number) => void }) {
  const [tbfoStats, setTbfoStats] = useState({
    duelsCount: 0,
    duels1v1: 0,
    duels2v2: 0,
    duels5v5: 0,
    duelsKop: 0,
    totalPoints: 0,
    totalClicks: 0,
    totalCards: 0,
    loading: true
  });

  useEffect(() => {
    const fetchTbfoStats = async () => {
      try {
        const rankingsQ = query(
          collection(db, 'ranking_teams'),
          where('season', '==', selectedSeason.toString()),
          where('teamId', '==', teamId.toString())
        );
        const rankingsSnap = await getDocs(rankingsQ);
        const pointTotal = rankingsSnap.docs.reduce((acc, doc) => acc + (doc.data().totalScore || 0), 0);

        const duelsQ = query(
          collection(db, 'duels'),
          where('teams', 'array-contains', teamId),
          limit(500)
        );
        let dCount = 0;
        let d1v1 = 0;
        let d2v2 = 0;
        let d5v5 = 0;
        let dKop = 0;
        let totalCards = 0;
        
        try {
           const duelsSnap = await getDocs(duelsQ);
           dCount = duelsSnap.docs.length;
           duelsSnap.docs.forEach(doc => {
             const data = doc.data();
             if (data.type === '1v1') d1v1++;
             else if (data.type === '2v2') d2v2++;
             else if (data.type === '5v5') d5v5++;
             else if (data.type === 'war_of_kops') dKop++;
             else if (data.type === 'kop') dKop++;
             
             if (data.participants && Array.isArray(data.participants)) {
               data.participants.forEach((p: any) => {
                 if (p.usedCards) totalCards += p.usedCards;
               });
             }
           });
        } catch(e) {}

        const lifeActionsQ = query(
          collection(db, 'life_actions'),
          where('teamId', '==', teamId.toString()),
           limit(100)
        );
        let tClicks = 0;
        try {
           const lifeSnap = await getDocs(lifeActionsQ);
           lifeSnap.docs.forEach(d => {
              const data = d.data();
              if (data.type === 'click') {
                 tClicks += (data.clicks || 1);
              }
           });
        } catch(e) {}

        setTbfoStats({
          duelsCount: dCount,
          duels1v1: d1v1,
          duels2v2: d2v2,
          duels5v5: d5v5,
          duelsKop: dKop,
          totalPoints: pointTotal,
          totalClicks: tClicks,
          totalCards: totalCards,
          loading: false
        });

      } catch (err) {
        setTbfoStats(prev => ({ ...prev, loading: false }));
      }
    };
    fetchTbfoStats();
  }, [teamId, selectedSeason]);


  if (!stats && tbfoStats.loading) {
    return (
      <Card className="py-6 text-center text-gray-500 text-xs font-bold italic">
        Les statistiques de cette équipe (réelles et en jeu) ne sont malheureusement pas couvertes par notre fournisseur de données.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {stats ? (
        <>
          <h3 className="text-sm font-black italic uppercase text-white flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-orange-500" />
            Stats Réelles (Football)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card className="space-y-2 p-3">
              <h3 className="text-[10px] font-black italic uppercase text-gray-500 border-b border-white/10 pb-1 tracking-widest">Attaque</h3>
              <div className="grid grid-cols-2 gap-2">
                <StatItem label="Buts" value={stats.goals?.for?.total?.total} />
                <StatItem label="Moyenne" value={stats.goals?.for?.average?.total} />
                <StatItem label="Clean Sheets" value={stats.clean_sheet?.total} />
                <StatItem label="Failed to Score" value={stats.failed_to_score?.total} />
              </div>
            </Card>
            
            <Card className="space-y-2 p-3">
              <h3 className="text-[10px] font-black italic uppercase text-gray-500 border-b border-white/10 pb-1 tracking-widest">Séries</h3>
              <div className="grid grid-cols-2 gap-2">
                <StatItem label="Victoires" value={stats.fixtures?.wins?.total} />
                <StatItem label="Nuls" value={stats.fixtures?.draws?.total} />
                <StatItem label="Défaites" value={stats.fixtures?.loses?.total} />
                <StatItem label="Plus longue série" value={stats.biggest?.streak?.wins} />
              </div>
            </Card>
          </div>
        </>
      ) : (
        <>
          <h3 className="text-sm font-black italic uppercase text-white flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-orange-500" />
            Stats Réelles (Football)
          </h3>
          <Card className="py-6 text-center text-gray-500 text-xs font-bold italic">
            Les statistiques réelles de cette équipe ne sont malheureusement pas couvertes par notre fournisseur de données.
          </Card>
        </>
      )}

      {/* TBFO STATS */}
      <h3 className="text-sm font-black italic uppercase text-white flex items-center gap-2 mt-6 mb-2">
        <Shield className="w-4 h-4 text-orange-500" />
        Stats TBFO (Jeu)
      </h3>
      
      {tbfoStats.loading ? (
        <Card className="py-8 flex justify-center items-center">
           <Activity className="w-6 h-6 text-orange-500 animate-spin" />
        </Card>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="flex flex-col items-center justify-center p-3 text-center space-y-1 bg-gradient-to-br from-orange-500/10 to-transparent border-orange-500/20">
            <Shield className="w-4 h-4 text-orange-500 mb-0.5" />
            <span className="text-xl font-black italic text-white">{tbfoStats.totalPoints.toLocaleString()}</span>
            <span className="text-[7.5px] font-bold text-orange-500/80 uppercase tracking-widest">Points Gagnés</span>
          </Card>
          
          <Card className="flex flex-col items-center justify-center p-3 text-center space-y-1 bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
            <Users className="w-4 h-4 text-blue-500 mb-0.5" />
            <span className="text-xl font-black italic text-white">{tbfoStats.duelsCount}</span>
            <span className="text-[7.5px] font-bold text-blue-500/80 uppercase tracking-widest">Batailles Jouées</span>
            <div className="text-[8px] text-gray-400 mt-1 flex flex-wrap justify-center gap-1.5">
              <span>1v1: <strong className="text-white">{tbfoStats.duels1v1}</strong></span>
              <span>2v2: <strong className="text-white">{tbfoStats.duels2v2}</strong></span>
              <span>5v5: <strong className="text-white">{tbfoStats.duels5v5}</strong></span>
              <span>Guerre des Kops: <strong className="text-white">{tbfoStats.duelsKop}</strong></span>
            </div>
          </Card>

          <Card className="flex flex-col items-center justify-center p-3 text-center space-y-1 bg-gradient-to-br from-yellow-500/10 to-transparent border-yellow-500/20">
            <Medal className="w-4 h-4 text-yellow-500 mb-0.5" />
            <span className="text-xl font-black italic text-white">{tbfoStats.totalCards}</span>
            <span className="text-[7.5px] font-bold text-yellow-500/80 uppercase tracking-widest">Cartes Jouées</span>
          </Card>

          <Card className="flex flex-col items-center justify-center p-3 text-center space-y-1 bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20">
            <BarChart3 className="w-4 h-4 text-purple-500 mb-0.5" />
            <span className="text-xl font-black italic text-white">{tbfoStats.totalClicks.toLocaleString()}</span>
            <span className="text-[7.5px] font-bold text-purple-500/80 uppercase tracking-widest">Clics (Ferveur)</span>
          </Card>
        </div>
      )}
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex flex-col">
      <span className="text-[8px] font-bold text-gray-500 uppercase">{label}</span>
      <span className="text-sm font-black italic text-orange-500">{value}</span>
    </div>
  );
}
