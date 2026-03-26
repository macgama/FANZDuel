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
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface TeamDetailsProps {
  teamId: number;
  season: number;
  onBack: () => void;
  onTeamClick: (teamId: number, season: number) => void;
  onLeagueClick: (leagueId: number, season: number) => void;
}

export function TeamDetails({ teamId, season: initialSeason, onBack, onTeamClick, onLeagueClick }: TeamDetailsProps) {
  const [team, setTeam] = useState<any>(null);
  const [selectedSeason, setSelectedSeason] = useState(initialSeason);
  const [availableSeasons, setAvailableSeasons] = useState<number[]>([]);
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [standings, setStandings] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'matches' | 'players' | 'standings' | 'stats' | 'rankings'>('matches');

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
        leaguesRes.forEach((l: any) => {
          l.seasons.forEach((s: any) => seasons.add(s.year));
        });
        const sortedSeasons = Array.from(seasons).sort((a, b) => b - a);
        setAvailableSeasons(sortedSeasons);
        
        if (initialSeason === footballDataService.getCurrentSeasonYear() && sortedSeasons.length > 0) {
          const currentYear = footballDataService.getCurrentSeasonYear();
          if (sortedSeasons.includes(currentYear)) {
            setSelectedSeason(currentYear);
          } else {
            setSelectedSeason(sortedSeasons[0]);
          }
        }
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

  if (!team) return null;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors border border-white/10"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-4">
            <img src={team.team.logo} alt="" className="w-16 h-16 object-contain" referrerPolicy="no-referrer" />
            <div>
              <h2 className="text-3xl font-black italic uppercase tracking-tighter">
                {team.team.name}
              </h2>
              <div className="flex items-center gap-3">
                <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">
                  {team.team.country} - {team.venue.city}
                </p>
                {lastUpdated && (
                  <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase italic tracking-widest border-l border-white/10 pl-3">
                    <Clock className="w-3 h-3" />
                    Mis à jour le {format(lastUpdated, 'dd/MM/yyyy HH:mm')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="flex items-center gap-2 text-[10px] font-black uppercase italic tracking-widest h-10"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Mise à jour...' : 'Actualiser'}
          </Button>

          <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2 h-10">
            <History className="w-4 h-4 text-gray-500" />
            <select 
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(Number(e.target.value))}
              className="bg-transparent text-sm font-bold focus:outline-none cursor-pointer"
            >
              {availableSeasons.map((year) => (
                <option key={year} value={year} className="bg-gray-900">
                  Saison {year} {year === availableSeasons[0] ? '(Actuelle)' : ''}
                </option>
              ))}
            </select>
            {selectedSeason === availableSeasons[0] && (
              <span className="ml-2 text-[10px] bg-green-500/20 text-green-500 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">
                Actuelle
              </span>
            )}
          </div>
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
            <div className="h-48 w-full relative">
              <img 
                src={team.venue.image || `https://picsum.photos/seed/${team.venue.id}/1200/400`} 
                alt={team.venue.name} 
                className="w-full h-full object-cover opacity-50"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent"></div>
              <div className="absolute bottom-4 left-6">
                <h3 className="text-xl font-black italic uppercase tracking-tight flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-orange-500" />
                  {team.venue.name}
                </h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                  {team.venue.address}, {team.venue.city} • {team.venue.capacity?.toLocaleString()} places
                </p>
              </div>
            </div>
          </Card>

          {/* Tabs */}
          <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10 overflow-x-auto no-scrollbar">
            <TabButton 
              active={activeTab === 'matches'} 
              onClick={() => setActiveTab('matches')}
              icon={<Calendar className="w-4 h-4" />}
              label="Matches"
            />
            <TabButton 
              active={activeTab === 'players'} 
              onClick={() => setActiveTab('players')}
              icon={<Users className="w-4 h-4" />}
              label="Joueurs"
            />
            <TabButton 
              active={activeTab === 'rankings'} 
              onClick={() => setActiveTab('rankings')}
              icon={<Goal className="w-4 h-4" />}
              label="Rankings"
            />
            <TabButton 
              active={activeTab === 'standings'} 
              onClick={() => setActiveTab('standings')}
              icon={<Trophy className="w-4 h-4" />}
              label="Classement"
            />
            <TabButton 
              active={activeTab === 'stats'} 
              onClick={() => setActiveTab('stats')}
              icon={<BarChart3 className="w-4 h-4" />}
              label="Stats"
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
              {activeTab === 'matches' && <MatchesTab fixtures={fixtures} onTeamClick={onTeamClick} onLeagueClick={onLeagueClick} selectedSeason={selectedSeason} />}
              {activeTab === 'players' && <PlayersTab players={players} />}
              {activeTab === 'rankings' && <TeamRankingsTab players={players} />}
              {activeTab === 'standings' && <StandingsTab standings={standings} teamId={teamId} onTeamClick={onTeamClick} selectedSeason={selectedSeason} />}
              {activeTab === 'stats' && <StatsTab stats={stats} />}
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 rounded-lg transition-all font-bold text-xs uppercase italic ${
        active 
          ? 'bg-orange-600 text-white shadow-lg' 
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <TeamRankingList title="Buteurs" data={scorers} label="Buts" valKey="goals.total" icon={<Goal className="text-green-500" />} />
      <TeamRankingList title="Passeurs" data={assists} label="Passes" valKey="goals.assists" icon={<Activity className="text-blue-500" />} />
      <TeamRankingList title="Cartons Jaunes" data={yellows} label="Jaunes" valKey="cards.yellow" icon={<Square className="text-yellow-500 fill-yellow-500" />} />
      <TeamRankingList title="Cartons Rouges" data={reds} label="Rouges" valKey="cards.red" icon={<Square className="text-red-500 fill-red-500" />} />
    </div>
  );
}

function TeamRankingList({ title, data, label, valKey, icon }: { title: string; data: any[]; label: string; valKey: string; icon: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-black italic uppercase text-gray-500 border-b border-white/10 pb-2 tracking-widest flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <div className="space-y-2">
        {data.map((p, idx) => {
          const stats = p.statistics[0];
          let val = 0;
          if (valKey === 'goals.total') val = stats.goals.total || 0;
          if (valKey === 'goals.assists') val = stats.goals.assists || 0;
          if (valKey === 'cards.yellow') val = stats.cards.yellow || 0;
          if (valKey === 'cards.red') val = stats.cards.red || 0;

          if (val === 0 && idx > 0) return null;

          return (
            <Card key={p.player.id} className="flex items-center justify-between p-3">
              <div className="flex items-center gap-3">
                <img src={p.player.photo} alt="" className="w-8 h-8 rounded-full border border-white/10" referrerPolicy="no-referrer" />
                <span className="text-sm font-bold">{p.player.name}</span>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-orange-500">{val}</span>
                <p className="text-[8px] uppercase font-bold text-gray-500">{label}</p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function MatchesTab({ fixtures, onTeamClick, onLeagueClick, selectedSeason }: { fixtures: any[]; onTeamClick: (id: number, season: number) => void; onLeagueClick: (id: number, season: number) => void; selectedSeason: number }) {
  if (fixtures.length === 0) return <Card className="py-10 text-center text-gray-500">Aucun match trouvé.</Card>;

  const formatRound = (round: string) => {
    const match = round.match(/\d+/);
    if (match && (round.toLowerCase().includes('round') || round.toLowerCase().includes('regular season'))) {
      return `Journée ${match[0]}`;
    }
    return round;
  };

  // Group by League then by Round
  const groupedByLeague = fixtures.reduce((acc: any, f: any) => {
    const leagueId = f.league.id;
    if (!acc[leagueId]) {
      acc[leagueId] = {
        id: leagueId,
        name: f.league.name,
        logo: f.league.logo,
        rounds: {}
      };
    }
    
    const round = f.league.round;
    if (!acc[leagueId].rounds[round]) {
      acc[leagueId].rounds[round] = [];
    }
    acc[leagueId].rounds[round].push(f);
    return acc;
  }, {});

  // Sort leagues by name
  const sortedLeagues = Object.values(groupedByLeague).sort((a: any, b: any) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-12">
      {sortedLeagues.map((league: any) => {
        // Sort rounds for this league by the date of the first match in that round
        const sortedRounds = Object.keys(league.rounds).sort((a, b) => {
          const dateA = Math.min(...league.rounds[a].map((f: any) => new Date(f.fixture.date).getTime()));
          const dateB = Math.min(...league.rounds[b].map((f: any) => new Date(f.fixture.date).getTime()));
          return dateA - dateB;
        });

        return (
          <div key={league.id} className="space-y-6">
            <div 
              className="flex items-center gap-3 border-b-2 border-orange-500/20 pb-2 cursor-pointer hover:text-orange-500 transition-colors group"
              onClick={() => onLeagueClick(league.id, selectedSeason)}
            >
              <img src={league.logo} alt="" className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
              <h2 className="text-xl font-black italic uppercase tracking-tight group-hover:translate-x-1 transition-transform">
                {league.name}
              </h2>
            </div>

            <div className="space-y-8 pl-4 border-l border-white/5">
              {sortedRounds.map((round) => (
                <div key={round} className="space-y-4">
                  <h3 className="text-[10px] font-black italic uppercase text-gray-500 tracking-[0.2em] flex items-center gap-2">
                    <span className="w-8 h-[1px] bg-white/10"></span>
                    {formatRound(round)}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {league.rounds[round]
                      .sort((a: any, b: any) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime())
                      .map((f: any) => (
                        <Card 
                          key={f.fixture.id} 
                          className="p-4 hover:border-orange-500/30 transition-all cursor-pointer group"
                        >
                          <div className="flex flex-col gap-3">
                            <div className="flex justify-between items-center text-[9px] font-medium text-gray-500 uppercase tracking-wider">
                              <span className="flex items-center gap-1.5 opacity-80">
                                <Clock className="w-2.5 h-2.5" />
                                {format(new Date(f.fixture.date), 'dd/MM/yyyy HH:mm')}
                              </span>
                              <span className={f.fixture.status.short === 'FT' ? 'text-gray-400' : 'text-orange-500'}>
                                {f.fixture.status.long}
                              </span>
                            </div>
                            
                            <div className="flex flex-col gap-2">
                              <div className="flex justify-between items-center group/team" onClick={(e) => { e.stopPropagation(); onTeamClick(f.teams.home.id, selectedSeason); }}>
                                <div className="flex items-center gap-3">
                                  <img src={f.teams.home.logo} alt="" className="w-6 h-6 object-contain group-hover/team:scale-110 transition-transform" referrerPolicy="no-referrer" />
                                  <span className={`text-sm font-bold ${f.teams.home.winner ? 'text-white' : 'text-gray-400'} group-hover/team:text-orange-500 transition-colors`}>
                                    {f.teams.home.name}
                                  </span>
                                </div>
                                <span className="font-black text-lg">{f.goals.home ?? '-'}</span>
                              </div>
                              <div className="flex justify-between items-center group/team" onClick={(e) => { e.stopPropagation(); onTeamClick(f.teams.away.id, selectedSeason); }}>
                                <div className="flex items-center gap-3">
                                  <img src={f.teams.away.logo} alt="" className="w-6 h-6 object-contain group-hover/team:scale-110 transition-transform" referrerPolicy="no-referrer" />
                                  <span className={`text-sm font-bold ${f.teams.away.winner ? 'text-white' : 'text-gray-400'} group-hover/team:text-orange-500 transition-colors`}>
                                    {f.teams.away.name}
                                  </span>
                                </div>
                                <span className="font-black text-lg">{f.goals.away ?? '-'}</span>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
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
    <div className="space-y-8">
      {posOrder.map(pos => {
        if (!groupedByPos[pos]) return null;
        return (
          <div key={pos} className="space-y-4">
            <h3 className="text-sm font-black italic uppercase text-gray-500 border-b border-white/10 pb-2 tracking-widest">
              {pos === 'Goalkeeper' ? 'Gardiens' : pos === 'Defender' ? 'Défenseurs' : pos === 'Midfielder' ? 'Milieux' : pos === 'Attacker' ? 'Attaquants' : 'Inconnu'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {groupedByPos[pos].map((p: any) => (
                <Card key={p.player.id} className="flex items-center gap-4 p-3 hover:bg-white/5 transition-colors">
                  <img src={p.player.photo} alt="" className="w-12 h-12 rounded-full border border-white/10" referrerPolicy="no-referrer" />
                  <div>
                    <h4 className="text-sm font-bold">{p.player.name}</h4>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase">
                      <span>{p.player.age} ans</span>
                      <span>•</span>
                      <span>{p.player.nationality}</span>
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
          <tr className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-gray-500">
            <th className="px-4 py-3 w-12 text-center">#</th>
            <th className="px-4 py-3">Équipe</th>
            <th className="px-4 py-3 text-center">J</th>
            <th className="px-4 py-3 text-center">G</th>
            <th className="px-4 py-3 text-center">N</th>
            <th className="px-4 py-3 text-center">P</th>
            <th className="px-4 py-3 text-center">Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {standings.map((s) => (
            <tr key={s.team.id} className={`hover:bg-white/5 transition-colors cursor-pointer group ${s.team.id === teamId ? 'bg-orange-500/10' : ''}`} onClick={() => onTeamClick(s.team.id, selectedSeason)}>
              <td className="px-4 py-3 text-center font-black italic text-sm text-orange-500">{s.rank}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <img src={s.team.logo} alt="" className="w-6 h-6 object-contain" referrerPolicy="no-referrer" />
                  <span className={`font-bold text-sm group-hover:text-orange-500 transition-colors ${s.team.id === teamId ? 'text-orange-500' : ''}`}>{s.team.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-center text-xs font-bold">{s.all.played}</td>
              <td className="px-4 py-3 text-center text-xs font-bold text-green-500">{s.all.win}</td>
              <td className="px-4 py-3 text-center text-xs font-bold text-gray-500">{s.all.draw}</td>
              <td className="px-4 py-3 text-center text-xs font-bold text-red-500">{s.all.lose}</td>
              <td className="px-4 py-3 text-center font-black text-sm">{s.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function StatsTab({ stats }: { stats: any }) {
  if (!stats) return <Card className="py-10 text-center text-gray-500">Statistiques non disponibles.</Card>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="space-y-4">
        <h3 className="text-sm font-black italic uppercase text-gray-500 border-b border-white/10 pb-2 tracking-widest">Attaque</h3>
        <div className="grid grid-cols-2 gap-4">
          <StatItem label="Buts" value={stats.goals.for.total.total} />
          <StatItem label="Moyenne" value={stats.goals.for.average.total} />
          <StatItem label="Clean Sheets" value={stats.clean_sheet.total} />
          <StatItem label="Failed to Score" value={stats.failed_to_score.total} />
        </div>
      </Card>
      
      <Card className="space-y-4">
        <h3 className="text-sm font-black italic uppercase text-gray-500 border-b border-white/10 pb-2 tracking-widest">Séries</h3>
        <div className="grid grid-cols-2 gap-4">
          <StatItem label="Victoires" value={stats.fixtures.wins.total} />
          <StatItem label="Nuls" value={stats.fixtures.draws.total} />
          <StatItem label="Défaites" value={stats.fixtures.loses.total} />
          <StatItem label="Plus longue série" value={stats.biggest.streak.wins} />
        </div>
      </Card>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-bold text-gray-500 uppercase">{label}</span>
      <span className="text-xl font-black italic text-orange-500">{value}</span>
    </div>
  );
}
