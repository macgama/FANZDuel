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
  Flame
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { translateCountryName, translateLeagueName } from '../utils/countryTranslations';
import { collection, query, where, orderBy, limit, getDocs, getDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { getImageUrl } from '../lib/utils';
import { SharedMatchCard } from './SharedMatchCard';
import { TbfoRankingsTab } from './LeagueDetails';
import { UserProfile } from '../types';

interface TeamDetailsProps {
  teamId: number;
  season: number;
  onBack: () => void;
  onTeamClick: (teamId: number, season: number) => void;
  onLeagueClick: (leagueId: number, season: number) => void;
  onMatchClick?: (matchId: number, tab?: 'summary' | 'lineups' | 'stats' | 'duels') => void;
  profile: UserProfile | null;
}

export function TeamDetails({ teamId, season: initialSeason, onBack, onTeamClick, onLeagueClick, onMatchClick, profile }: TeamDetailsProps) {
  const [team, setTeam] = useState<any>(null);
  const [selectedSeason, setSelectedSeason] = useState(initialSeason);
  const [actualCurrentSeason, setActualCurrentSeason] = useState<number | null>(null);
  const [availableSeasons, setAvailableSeasons] = useState<number[]>([]);
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [standings, setStandings] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'matches' | 'players' | 'standings' | 'stats' | 'rankings' | 'tbfo'>('matches');
  const [currentLeagueId, setCurrentLeagueId] = useState<number | null>(null);

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
        const seasons = new Set<number>();
        let bestSeasonByDate: number | null = null;
        let currentByFlag: number | null = null;
        const today = new Date().toISOString().split('T')[0];

        (leaguesRes || []).forEach((l: any) => {
          (l.seasons || []).forEach((s: any) => {
            seasons.add(s.year);
            if (s.start <= today && s.end >= today) {
              if (!bestSeasonByDate || s.year > bestSeasonByDate) {
                bestSeasonByDate = s.year;
              }
            }
            if (s.current) {
              if (!currentByFlag || s.year > currentByFlag) {
                currentByFlag = s.year;
              }
            }
          });
        });
        
        const sortedSeasons = Array.from(seasons).sort((a, b) => b - a);
        setAvailableSeasons(sortedSeasons);
        
        let actualSeason = sortedSeasons[0];
        if (bestSeasonByDate) {
          actualSeason = bestSeasonByDate;
        } else if (currentByFlag) {
          actualSeason = currentByFlag;
        }
        
        setActualCurrentSeason(actualSeason);
        
        // Always default to the actual current season when visiting a team
        setSelectedSeason(actualSeason);
      } catch (err) {
        console.error('Failed to fetch team info', err);
      }
    };
    fetchTeamInfo();
  }, [teamId]);

  const fetchData = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    
    try {
      // Fetch fixtures and players in parallel using allSettled for resilience
      const [fixturesResults, playersResults] = await Promise.allSettled([
        footballDataService.getFixturesByTeam(teamId, selectedSeason, force),
        footballDataService.getPlayers(teamId, selectedSeason)
      ]);

      const fixturesData = fixturesResults.status === 'fulfilled' ? fixturesResults.value : [];
      const playersData = playersResults.status === 'fulfilled' ? playersResults.value : [];

      setFixtures(fixturesData);
      setPlayers(playersData);

      // If we have a league from fixtures, fetch standings and stats
      if (fixturesData.length > 0) {
        const leagueId = fixturesData[0].league.id;
        setCurrentLeagueId(leagueId);
        const [standingsResults, statsResults] = await Promise.allSettled([
          footballDataService.getStandings(leagueId, selectedSeason, force),
          footballApi.getTeamStats(leagueId, teamId, selectedSeason)
        ]);
        
        setStandings(standingsResults.status === 'fulfilled' ? standingsResults.value : []);
        setStats(statsResults.status === 'fulfilled' ? statsResults.value : null);
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
    fetchData();
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
              <div className="w-10 h-10 bg-white rounded-lg p-1.5 flex items-center justify-center shadow-lg">
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
              active={activeTab === 'rankings'} 
              onClick={() => setActiveTab('rankings')}
              icon={<Goal className="w-3 h-3" />}
              label="Rankings"
            />
             <TabButton 
              active={activeTab === 'players'} 
              onClick={() => setActiveTab('players')}
              icon={<Users className="w-3 h-3" />}
              label="Joueurs"
            />
            <TabButton 
              active={activeTab === 'stats'} 
              onClick={() => setActiveTab('stats')}
              icon={<BarChart3 className="w-3 h-3" />}
              label="Stats"
            />
            <TabButton 
              active={activeTab === 'tbfo'} 
              onClick={() => setActiveTab('tbfo')}
              icon={<Shield className="w-3 h-3" />}
              label="TBFO"
              highlight={true}
            />
          </div>

          {/* Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'matches' && <MatchesTab fixtures={fixtures} onTeamClick={onTeamClick} onLeagueClick={onLeagueClick} onMatchClick={onMatchClick} selectedSeason={selectedSeason} profile={profile} />}
              {activeTab === 'standings' && <StandingsTab standings={standings} teamId={teamId} onTeamClick={onTeamClick} selectedSeason={selectedSeason} />}
              {activeTab === 'rankings' && <TeamRankingsTab players={players} />}
              {activeTab === 'players' && <PlayersTab players={players} />}
              {activeTab === 'stats' && <StatsTab stats={stats} teamId={teamId} selectedSeason={selectedSeason} />}
              {activeTab === 'tbfo' && currentLeagueId ? (
                <TbfoRankingsTab leagueId={currentLeagueId} selectedSeason={selectedSeason} onTeamClick={onTeamClick} highlightTeamId={teamId} />
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

function TeamRankingsTab({ players }: { players: any[] }) {
  if (players.length === 0) return <Card className="py-10 text-center text-gray-500">Données non disponibles.</Card>;

  const scorers = [...players].sort((a, b) => (b.statistics[0].goals.total || 0) - (a.statistics[0].goals.total || 0)).slice(0, 5);
  const assists = [...players].sort((a, b) => (b.statistics[0].goals.assists || 0) - (a.statistics[0].goals.assists || 0)).slice(0, 5);
  const yellows = [...players].sort((a, b) => (b.statistics[0].cards.yellow || 0) - (a.statistics[0].cards.yellow || 0)).slice(0, 5);
  const reds = [...players].sort((a, b) => (b.statistics[0].cards.red || 0) - (a.statistics[0].cards.red || 0)).slice(0, 5);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <TeamRankingList title="Buteurs" data={scorers} label="Buts" valKey="goals.total" icon={<Goal className="w-3.5 h-3.5 text-green-500" />} />
      <TeamRankingList title="Passeurs" data={assists} label="Passes" valKey="goals.assists" icon={<Activity className="w-3.5 h-3.5 text-blue-500" />} />
      <TeamRankingList title="Cartons Jaunes" data={yellows} label="Jaunes" valKey="cards.yellow" icon={<Square className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />} />
      <TeamRankingList title="Cartons Rouges" data={reds} label="Rouges" valKey="cards.red" icon={<Square className="w-3.5 h-3.5 text-red-500 fill-red-500" />} />
    </div>
  );
}

function TeamRankingList({ title, data, label, valKey, icon }: { title: string; data: any[]; label: string; valKey: string; icon: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-black italic uppercase text-gray-500 border-b border-white/10 pb-1 tracking-widest flex items-center gap-1.5">
        {icon}
        {title}
      </h3>
      <div className="space-y-1">
        {data.map((p, idx) => {
          const stats = p.statistics[0];
          let val = 0;
          if (valKey === 'goals.total') val = stats.goals.total || 0;
          if (valKey === 'goals.assists') val = stats.goals.assists || 0;
          if (valKey === 'cards.yellow') val = stats.cards.yellow || 0;
          if (valKey === 'cards.red') val = stats.cards.red || 0;

          if (val === 0 && idx > 0) return null;

          return (
            <Card key={p.player.id} className="flex items-center justify-between p-1.5">
              <div className="flex items-center gap-2">
                <img src={p.player.photo} alt="" className="w-6 h-6 rounded-full border border-white/10" />
                <span className="text-xs font-bold">{p.player.name}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-orange-500">{val}</span>
                <p className="text-[7px] uppercase font-bold text-gray-500">{label}</p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function MatchesTab({ fixtures, onTeamClick, onLeagueClick, onMatchClick, selectedSeason, profile }: { fixtures: any[]; onTeamClick: (id: number, season: number) => void; onLeagueClick: (id: number, season: number) => void; onMatchClick?: (id: number, tab?: 'summary' | 'lineups' | 'stats' | 'duels') => void; selectedSeason: number; profile?: any }) {
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);
  const [selectedRound, setSelectedRound] = useState<string>('');
  const [leagueFixtures, setLeagueFixtures] = useState<any[]>([]);
  const [loadingLeagueFixtures, setLoadingLeagueFixtures] = useState(false);
  const [matchScores, setMatchScores] = useState<Record<string, { scoreA: number, scoreB: number }>>({});
  const [activeDuels, setActiveDuels] = useState<any[]>([]);

  // Group initial fixtures to know which leagues the team is in
  const groupedByLeague = React.useMemo(() => {
    return fixtures.reduce((acc: any, f: any) => {
      const leagueId = f.league.id;
      if (!acc[leagueId]) {
        acc[leagueId] = {
          id: leagueId,
          name: f.league.name,
          logo: f.league.logo
        };
      }
      return acc;
    }, {});
  }, [fixtures]);

  const sortedLeagues = React.useMemo(() => Object.values(groupedByLeague).sort((a: any, b: any) => a.name.localeCompare(b.name)), [groupedByLeague]);

  useEffect(() => {
    if (sortedLeagues.length > 0 && !selectedLeagueId) {
      setSelectedLeagueId((sortedLeagues[0] as any).id);
    }
  }, [sortedLeagues, selectedLeagueId]);

  useEffect(() => {
    if (selectedLeagueId) {
      setLoadingLeagueFixtures(true);
      footballDataService.getFixtures(selectedLeagueId, selectedSeason)
        .then(data => {
          setLeagueFixtures(data);
          // Set initial round based on the team's next or last match in this league, or just the first round found
          if (data && data.length > 0) {
            const teamMatches = data.filter((f: any) => f.teams.home.id === fixtures[0]?.teams?.home?.id || f.teams.away.id === fixtures[0]?.teams?.home?.id); // approximation
            
            // Just gather all rounds
            const roundsSet = new Set<string>();
            data.forEach((f: any) => roundsSet.add(f.league.round));
            const availableRounds = Array.from(roundsSet);
            setSelectedRound(availableRounds[0] || '');
          }
        })
        .finally(() => setLoadingLeagueFixtures(false));
    }
  }, [selectedLeagueId, selectedSeason, fixtures]);

  const groupedByRound = React.useMemo(() => {
    return leagueFixtures.reduce((acc: any, f: any) => {
      const round = f.league.round;
      if (!acc[round]) acc[round] = [];
      acc[round].push(f);
      return acc;
    }, {});
  }, [leagueFixtures]);

  const rounds = React.useMemo(() => {
    return Object.keys(groupedByRound).sort((a, b) => {
      const dateA = Math.min(...groupedByRound[a].map((f: any) => new Date(f.fixture.date).getTime()));
      const dateB = Math.min(...groupedByRound[b].map((f: any) => new Date(f.fixture.date).getTime()));
      return dateA - dateB;
    });
  }, [groupedByRound]);

  useEffect(() => {
    if (rounds.length > 0 && (!selectedRound || !rounds.includes(selectedRound))) {
      // Find the round with the most recent live/finished games, or the first upcoming
      let bestRound = rounds[rounds.length - 1] || rounds[0];
      
      for (const round of rounds) {
        const hasLiveInfo = groupedByRound[round].some((m: any) => ['1H', '2H', 'HT', 'LIVE', 'FT'].includes(m.fixture.status.short));
        if (hasLiveInfo) {
          bestRound = round;
        }
      }
      setSelectedRound(bestRound);
    }
  }, [rounds, groupedByRound, selectedRound]);

  const [roundEvents, setRoundEvents] = useState<Record<string, any[]>>({});

  useEffect(() => {
    if (!selectedRound) return;
    
    const fetchRoundEvents = async () => {
      const currentMatches = groupedByRound[selectedRound] || [];
      const idsToFetch = currentMatches
        .filter((m: any) => m.events === undefined && !roundEvents[m.fixture.id] && ['FT', 'AET', 'PEN', '1H', '2H', 'HT', 'LIVE'].includes(m.fixture.status.short))
        .map((m: any) => m.fixture.id);

      if (idsToFetch.length > 0) {
        try {
          const maxPerRequest = 20;
          for (let i = 0; i < idsToFetch.length; i += maxPerRequest) {
            const chunk = idsToFetch.slice(i, i + maxPerRequest);
            if (i > 0) await new Promise(r => setTimeout(r, 1500));
            try {
              const detailedFixtures = await footballApi.getFixturesByIds(chunk);
              const eventsMap: Record<string, any[]> = {};
              if (detailedFixtures && detailedFixtures.length > 0) {
                detailedFixtures.forEach((f: any) => {
                  eventsMap[f.fixture.id] = f.events || [];
                });
                setRoundEvents(prev => ({ ...prev, ...eventsMap }));
              } else {
                chunk.forEach((id: any) => eventsMap[id] = null as any);
                setRoundEvents(prev => ({ ...prev, ...eventsMap }));
                break;
              }
            } catch (err) {
              if (err instanceof Error && err.message === 'Failed to fetch') {
                console.warn("Failed to fetch round events chunk (network issue)");
              } else {
                console.warn("Failed to fetch round events chunk", err);
              }
              const eventsMap: Record<string, any[]> = {};
              chunk.forEach((id: any) => eventsMap[id] = null as any);
              setRoundEvents(prev => ({ ...prev, ...eventsMap }));
            }
          }
        } catch (err) {
          if (err instanceof Error && err.message === 'Failed to fetch') {
            console.warn("Failed to fetch round events summary (network issue)");
          } else {
            console.warn("Failed to fetch round events summary", err);
          }
        }
      }
    };
    fetchRoundEvents();

    // Fetch Duels
    const fetchActiveDuels = async () => {
      try {
        const res = await fetch('/api/duels/all');
        if (res.ok) {
          const duelsData = await res.json();
          setActiveDuels(duelsData);
        }
      } catch (err: any) {
        if (err?.message !== 'Failed to fetch') {
          console.error("Failed to fetch active duels", err);
        }
      }
    };
    fetchActiveDuels();

    // Fetch scores for this round
    const matchIds = groupedByRound[selectedRound]?.map((m: any) => m.fixture.id.toString()) || [];
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
  }, [selectedRound, groupedByRound]);

  const formatRound = (round: string) => {
    const match = round.match(/\d+/);
    if (match && (round.toLowerCase().includes('round') || round.toLowerCase().includes('regular season'))) {
      return `Journée ${match[0]}`;
    }
    return round;
  };

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = window.innerWidth > 768 ? 400 : window.innerWidth - 60;
      scrollContainerRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  if (fixtures.length === 0) return <Card className="py-10 text-center text-gray-500">Aucun match trouvé.</Card>;

  return (
    <div className="space-y-4">
      {/* League menu */}
      {sortedLeagues.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-2">
          {sortedLeagues.map((l: any) => (
            <button
              key={l.id}
              onClick={() => setSelectedLeagueId(l.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-colors whitespace-nowrap min-w-0 ${
                selectedLeagueId === l.id 
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

      {loadingLeagueFixtures ? (
        <Card className="py-10 text-center text-gray-500">
          <Activity className="w-6 h-6 animate-spin mx-auto opacity-50 mb-2" />
          <p className="text-[10px] font-bold uppercase tracking-widest">Chargement...</p>
        </Card>
      ) : (
        <>
          {/* Round Selector */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {rounds.map(round => (
              <button
                key={round}
                onClick={() => setSelectedRound(round)}
                className={`px-3 py-1.5 rounded-full whitespace-nowrap text-xs font-black uppercase italic transition-colors ${
                  selectedRound === round 
                    ? 'bg-orange-500 text-white' 
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                {formatRound(round)}
              </button>
            ))}
          </div>

          {/* Horizontal Matches */}
          {selectedRound && groupedByRound[selectedRound] && (
            <div className="relative group/scroll">
              {groupedByRound[selectedRound].length > 1 && (
                <>
                  <button 
                    onClick={() => scroll('left')}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-black/80 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 text-white opacity-0 group-hover/scroll:opacity-100 transition-opacity"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => scroll('right')}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-black/80 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 text-white opacity-0 group-hover/scroll:opacity-100 transition-opacity"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}

              <div 
                ref={scrollContainerRef}
                className="w-full overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory"
              >
                <div className="flex flex-nowrap gap-4 w-fit px-0.5 items-stretch">
                  {groupedByRound[selectedRound].map((match: any) => {
                    const matchWithEvents = {
                      ...match,
                      events: match.events || roundEvents[match.fixture.id] || []
                    };
                    return (
                    <div key={match.fixture.id} className="snap-center shrink-0 flex items-stretch w-[calc(100vw-60px)] sm:w-[400px]">
                      <SharedMatchCard
                        match={matchWithEvents}
                        hasActiveDuel={activeDuels.some(d => d.matchId === match.fixture.id)}
                        matchScore={matchScores[match.fixture.id.toString()]}
                        onClick={(tab) => onMatchClick && onMatchClick(match.fixture.id, tab)}
                        onJoinDuel={() => {}}
                        onTeamClick={onTeamClick}
                        profile={profile}
                        showLeagueHeader={false}
                      />
                    </div>
                  )})}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PlayersTab({ players }: { players: any[] }) {
  if (players.length === 0) return <Card className="py-10 text-center text-gray-500">Joueurs non disponibles.</Card>;

  const groupedByPos = players.reduce((acc: any, p: any) => {
    const pos = p.statistics[0].games.position || 'Unknown';
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
            <h3 className="text-[10px] font-black italic uppercase text-gray-500 border-b border-white/10 pb-1 tracking-widest">
              {pos === 'Goalkeeper' ? 'Gardiens' : pos === 'Defender' ? 'Défenseurs' : pos === 'Midfielder' ? 'Milieux' : pos === 'Attacker' ? 'Attaquants' : 'Inconnu'}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {groupedByPos[pos].map((p: any) => (
                <Card key={p.player.id} className="flex items-center gap-2 p-1.5 hover:bg-white/5 transition-colors">
                  <img src={p.player.photo} alt="" className="w-8 h-8 rounded-full border border-white/10" />
                  <div className="min-w-0">
                    <h4 className="text-[10px] font-bold truncate">{p.player.name}</h4>
                    <div className="flex items-center gap-1 text-[7px] text-gray-500 font-bold uppercase">
                      <span>{p.player.age} ans</span>
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

function StandingsTab({ standings, teamId, onTeamClick, selectedSeason }: { standings: any[]; teamId: number; onTeamClick: (id: number, season: number) => void; selectedSeason: number }) {
  if (standings.length === 0) return <Card className="py-10 text-center text-gray-500">Classement non disponible.</Card>;

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

function StatsTab({ stats, teamId, selectedSeason }: { stats: any, teamId: number, selectedSeason: number }) {
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


  if (!stats && tbfoStats.loading) return <Card className="py-10 text-center text-gray-500">Statistiques non disponibles.</Card>;

  return (
    <div className="space-y-4">
      {stats && (
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
