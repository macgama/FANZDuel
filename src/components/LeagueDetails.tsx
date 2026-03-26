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
  History,
  RefreshCw,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface LeagueDetailsProps {
  leagueId: number;
  season: number;
  onBack: () => void;
  onTeamClick: (teamId: number, season: number) => void;
}

export function LeagueDetails({ leagueId, season: initialSeason, onBack, onTeamClick }: LeagueDetailsProps) {
  const [league, setLeague] = useState<any>(null);
  const [selectedSeason, setSelectedSeason] = useState(initialSeason);
  const [availableSeasons, setAvailableSeasons] = useState<any[]>([]);
  const [standings, setStandings] = useState<any[]>([]);
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [topScorers, setTopScorers] = useState<any[]>([]);
  const [topAssists, setTopAssists] = useState<any[]>([]);
  const [topYellowCards, setTopYellowCards] = useState<any[]>([]);
  const [topRedCards, setTopRedCards] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'standings' | 'matches' | 'stats' | 'rankings' | 'teams'>('standings');

  // Fetch league info and available seasons
  useEffect(() => {
    const fetchLeagueInfo = async () => {
      try {
        const data = await footballApi.getLeagueInfo(leagueId);
        setLeague(data);
        if (data.seasons) {
          const sorted = [...data.seasons].sort((a: any, b: any) => b.year - a.year);
          setAvailableSeasons(sorted);
          
          // If initialSeason is just a placeholder, use the latest current season
          if (initialSeason === footballDataService.getCurrentSeasonYear()) {
            const current = data.seasons.find((s: any) => s.current);
            if (current) setSelectedSeason(current.year);
            else setSelectedSeason(sorted[0].year);
          }
        }
      } catch (err) {
        console.error('Failed to fetch league info', err);
      }
    };
    fetchLeagueInfo();
  }, [leagueId]);

  const fetchData = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    
    try {
      // Use Promise.allSettled to be resilient to individual API failures
      const results = await Promise.allSettled([
        footballDataService.getStandings(leagueId, selectedSeason, force),
        footballDataService.getFixtures(leagueId, selectedSeason, force),
        footballApi.getTopScorers(leagueId, selectedSeason),
        footballApi.getTopAssists(leagueId, selectedSeason),
        footballApi.getTopYellowCards(leagueId, selectedSeason),
        footballApi.getTopRedCards(leagueId, selectedSeason),
        footballDataService.getTeams(leagueId, selectedSeason, force)
      ]);
      
      const getValue = (index: number, defaultValue: any = []) => {
        const res = results[index];
        return res.status === 'fulfilled' ? res.value : defaultValue;
      };

      setStandings(getValue(0));
      setFixtures(getValue(1));
      setTopScorers(getValue(2));
      setTopAssists(getValue(3));
      setTopYellowCards(getValue(4));
      setTopRedCards(getValue(5));
      setTeams(getValue(6));

      // Log errors for failed requests
      results.forEach((res, idx) => {
        if (res.status === 'rejected') {
          console.warn(`API call ${idx} failed:`, res.reason);
        }
      });

      // Get the most recent update timestamp
      const updateResults = await Promise.allSettled([
        footballDataService.getLastUpdated(`standings_${leagueId}_${selectedSeason}`),
        footballDataService.getLastUpdated(`fixtures_${leagueId}_${selectedSeason}`),
        footballDataService.getLastUpdated(`teams_${leagueId}_${selectedSeason}`)
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
      console.error('Failed to fetch league details', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [leagueId, selectedSeason]);

  const handleRefresh = () => {
    fetchData(true);
  };

  if (loading && !league) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-orange-500"></div>
        <p className="text-gray-500 font-bold animate-pulse uppercase italic tracking-widest">Chargement des détails...</p>
      </div>
    );
  }

  if (!league) return null;

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
            <img src={league.league.logo} alt="" className="w-12 h-12 object-contain" referrerPolicy="no-referrer" />
            <div>
              <h2 className="text-2xl font-black italic uppercase tracking-tighter">
                {league.league.name}
              </h2>
              <div className="flex items-center gap-3">
                <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">
                  {league.country.name}
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
              {availableSeasons.map((s) => (
                <option key={s.year} value={s.year} className="bg-gray-900">
                  Saison {s.year} {s.current ? '(Actuelle)' : ''}
                </option>
              ))}
            </select>
            {availableSeasons.find(s => s.year === selectedSeason)?.current && (
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
          {/* Tabs */}
          <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10 overflow-x-auto no-scrollbar">
            <TabButton 
              active={activeTab === 'standings'} 
              onClick={() => setActiveTab('standings')}
              icon={<Trophy className="w-4 h-4" />}
              label="Classement"
            />
            <TabButton 
              active={activeTab === 'matches'} 
              onClick={() => setActiveTab('matches')}
              icon={<Calendar className="w-4 h-4" />}
              label="Matches"
            />
            <TabButton 
              active={activeTab === 'rankings'} 
              onClick={() => setActiveTab('rankings')}
              icon={<Goal className="w-4 h-4" />}
              label="Rankings"
            />
            <TabButton 
              active={activeTab === 'teams'} 
              onClick={() => setActiveTab('teams')}
              icon={<Users className="w-4 h-4" />}
              label="Équipes"
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
              {activeTab === 'standings' && <StandingsTab standings={standings} onTeamClick={onTeamClick} selectedSeason={selectedSeason} />}
              {activeTab === 'matches' && <MatchesTab fixtures={fixtures} onTeamClick={onTeamClick} selectedSeason={selectedSeason} />}
              {activeTab === 'rankings' && (
                <RankingsTab 
                  scorers={topScorers} 
                  assists={topAssists} 
                  yellowCards={topYellowCards} 
                  redCards={topRedCards} 
                  onTeamClick={onTeamClick}
                  selectedSeason={selectedSeason}
                />
              )}
              {activeTab === 'teams' && <TeamsTab teams={teams} onTeamClick={onTeamClick} selectedSeason={selectedSeason} />}
              {activeTab === 'stats' && <StatsTab standings={standings} />}
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

function StandingsTab({ standings, onTeamClick, selectedSeason }: { standings: any[]; onTeamClick: (id: number, season: number) => void; selectedSeason: number }) {
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
            <th className="px-4 py-3 text-center">BP</th>
            <th className="px-4 py-3 text-center">BC</th>
            <th className="px-4 py-3 text-center">+/-</th>
            <th className="px-4 py-3 text-center">Pts</th>
            <th className="px-4 py-3 text-center">Forme</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {standings.map((s) => (
            <tr key={s.team.id} className="hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => onTeamClick(s.team.id, selectedSeason)}>
              <td className="px-4 py-3 text-center font-black italic text-sm text-orange-500">{s.rank}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <img src={s.team.logo} alt="" className="w-6 h-6 object-contain" referrerPolicy="no-referrer" />
                  <span className="font-bold text-sm truncate max-w-[150px] group-hover:text-orange-500 transition-colors">{s.team.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-center text-xs font-bold">{s.all.played}</td>
              <td className="px-4 py-3 text-center text-xs font-bold text-green-500">{s.all.win}</td>
              <td className="px-4 py-3 text-center text-xs font-bold text-gray-500">{s.all.draw}</td>
              <td className="px-4 py-3 text-center text-xs font-bold text-red-500">{s.all.lose}</td>
              <td className="px-4 py-3 text-center text-xs font-bold">{s.all.goals.for}</td>
              <td className="px-4 py-3 text-center text-xs font-bold">{s.all.goals.against}</td>
              <td className="px-4 py-3 text-center text-xs font-bold">{s.goalsDiff}</td>
              <td className="px-4 py-3 text-center font-black text-sm">{s.points}</td>
              <td className="px-4 py-3">
                <div className="flex justify-center gap-1">
                  {s.form?.split('').map((f: string, i: number) => (
                    <span 
                      key={i} 
                      className={`w-4 h-4 rounded-sm text-[8px] flex items-center justify-center font-black text-white ${
                        f === 'W' ? 'bg-green-500' : f === 'D' ? 'bg-gray-500' : 'bg-red-500'
                      }`}
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function MatchesTab({ fixtures, onTeamClick, selectedSeason }: { fixtures: any[]; onTeamClick: (id: number, season: number) => void; selectedSeason: number }) {
  const formatRound = (round: string) => {
    const match = round.match(/\d+/);
    if (match && (round.toLowerCase().includes('round') || round.toLowerCase().includes('regular season'))) {
      return `Journée ${match[0]}`;
    }
    return round;
  };

  const groupedByRound = fixtures.reduce((acc: any, f: any) => {
    const round = f.league.round;
    if (!acc[round]) acc[round] = [];
    acc[round].push(f);
    return acc;
  }, {});

  const rounds = Object.keys(groupedByRound).sort((a, b) => {
    const dateA = Math.min(...groupedByRound[a].map((f: any) => new Date(f.fixture.date).getTime()));
    const dateB = Math.min(...groupedByRound[b].map((f: any) => new Date(f.fixture.date).getTime()));
    return dateA - dateB;
  });

  return (
    <div className="space-y-8">
      {rounds.map((round) => (
        <div key={round} className="space-y-4">
          <h3 className="text-sm font-black italic uppercase text-gray-500 border-b border-white/10 pb-2 tracking-widest">
            {formatRound(round)}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupedByRound[round].map((f: any) => (
              <Card key={f.fixture.id} className="p-4 hover:border-orange-500/30 transition-all cursor-pointer">
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
                    <div className="flex justify-between items-center cursor-pointer group/team" onClick={(e) => { e.stopPropagation(); onTeamClick(f.teams.home.id, selectedSeason); }}>
                      <div className="flex items-center gap-3">
                        <img src={f.teams.home.logo} alt="" className="w-6 h-6 object-contain group-hover/team:scale-110 transition-transform" referrerPolicy="no-referrer" />
                        <span className={`text-sm font-bold ${f.teams.home.winner ? 'text-white' : 'text-gray-400'} group-hover/team:text-orange-500 transition-colors`}>
                          {f.teams.home.name}
                        </span>
                      </div>
                      <span className="font-black text-lg">{f.goals.home ?? '-'}</span>
                    </div>
                    <div className="flex justify-between items-center cursor-pointer group/team" onClick={(e) => { e.stopPropagation(); onTeamClick(f.teams.away.id, selectedSeason); }}>
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
  );
}

function RankingsTab({ scorers, assists, yellowCards, redCards, onTeamClick, selectedSeason }: { scorers: any[]; assists: any[]; yellowCards: any[]; redCards: any[]; onTeamClick: (id: number, season: number) => void; selectedSeason: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <RankingList title="Meilleurs Buteurs" data={scorers} statLabel="Buts" statKey="goals" icon={<Goal className="text-green-500" />} onTeamClick={onTeamClick} selectedSeason={selectedSeason} />
      <RankingList title="Meilleurs Passeurs" data={assists} statLabel="Passes" statKey="assists" icon={<Activity className="text-blue-500" />} onTeamClick={onTeamClick} selectedSeason={selectedSeason} />
      <RankingList title="Cartons Jaunes" data={yellowCards} statLabel="Jaunes" statKey="yellow" icon={<Square className="text-yellow-500 fill-yellow-500" />} onTeamClick={onTeamClick} selectedSeason={selectedSeason} />
      <RankingList title="Cartons Rouges" data={redCards} statLabel="Rouges" statKey="red" icon={<Square className="text-red-500 fill-red-500" />} onTeamClick={onTeamClick} selectedSeason={selectedSeason} />
    </div>
  );
}

function RankingList({ title, data, statLabel, statKey, icon, onTeamClick, selectedSeason }: { title: string; data: any[]; statLabel: string; statKey: string; icon: React.ReactNode; onTeamClick: (id: number, season: number) => void; selectedSeason: number }) {
  if (data.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-black italic uppercase text-gray-500 border-b border-white/10 pb-2 tracking-widest flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <div className="space-y-2">
        {data.slice(0, 10).map((item, idx) => {
          const stats = item.statistics[0];
          let value = 0;
          if (statKey === 'goals') value = stats.goals.total;
          if (statKey === 'assists') value = stats.goals.assists || 0;
          if (statKey === 'yellow') value = stats.cards.yellow;
          if (statKey === 'red') value = stats.cards.red;

          return (
            <Card 
              key={idx} 
              className="flex items-center justify-between p-3 hover:bg-white/5 transition-colors cursor-pointer group"
              onClick={() => onTeamClick(item.statistics[0].team.id, selectedSeason)}
            >
              <div className="flex items-center gap-4">
                <span className="w-4 text-xs font-black italic text-gray-600">{idx + 1}</span>
                <img src={item.player.photo} alt="" className="w-10 h-10 rounded-full border border-white/10 group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                <div>
                  <h4 className="text-sm font-bold group-hover:text-orange-500 transition-colors">{item.player.name}</h4>
                  <p className="text-[10px] text-gray-500 uppercase font-bold">{item.statistics[0].team.name}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-orange-500">{value}</span>
                <p className="text-[8px] uppercase font-bold text-gray-500">{statLabel}</p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function TeamsTab({ teams, onTeamClick, selectedSeason }: { teams: any[]; onTeamClick: (id: number, season: number) => void; selectedSeason: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {teams.map((t) => (
        <Card key={t.team.id} onClick={() => onTeamClick(t.team.id, selectedSeason)} className="flex flex-col items-center gap-4 p-6 hover:border-orange-500/50 transition-all group cursor-pointer">
          <div className="w-20 h-20 bg-white/5 rounded-2xl p-4 flex items-center justify-center group-hover:bg-orange-500/10 transition-colors">
            <img src={t.team.logo} alt="" className="w-full h-full object-contain group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
          </div>
          <div className="text-center">
            <h3 className="font-black italic uppercase text-sm tracking-widest group-hover:text-orange-500 transition-colors">{t.team.name}</h3>
            <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">{t.venue.city}</p>
          </div>
          <div className="w-full pt-4 border-t border-white/5 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-gray-500">
              <MapPin className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase truncate">{t.venue.name}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <Users className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase">{t.venue.capacity?.toLocaleString()} places</span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function StatsTab({ standings }: { standings: any[] }) {
  if (standings.length === 0) return <Card className="py-10 text-center text-gray-500">Statistiques non disponibles.</Card>;

  const totalGoals = standings.reduce((acc, s) => acc + s.all.goals.for, 0);
  const totalMatches = standings.reduce((acc, s) => acc + s.all.played, 0) / 2;
  const avgGoals = totalMatches > 0 ? (totalGoals / totalMatches).toFixed(2) : '0';
  
  const totalWins = standings.reduce((acc, s) => acc + s.all.win, 0);
  const totalDraws = standings.reduce((acc, s) => acc + s.all.draw, 0);
  const totalLoses = standings.reduce((acc, s) => acc + s.all.lose, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <Card className="flex flex-col items-center justify-center p-8 text-center space-y-2">
        <Goal className="w-8 h-8 text-orange-500 mb-2" />
        <span className="text-4xl font-black italic text-white">{totalGoals}</span>
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Buts marqués</span>
      </Card>

      <Card className="flex flex-col items-center justify-center p-8 text-center space-y-2">
        <Activity className="w-8 h-8 text-orange-500 mb-2" />
        <span className="text-4xl font-black italic text-white">{avgGoals}</span>
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Buts par match</span>
      </Card>

      <Card className="flex flex-col items-center justify-center p-8 text-center space-y-2">
        <Trophy className="w-8 h-8 text-orange-500 mb-2" />
        <span className="text-4xl font-black italic text-white">{totalMatches}</span>
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Matchs joués</span>
      </Card>

      <Card className="md:col-span-2 lg:col-span-3 p-6">
        <h3 className="text-sm font-black italic uppercase text-gray-500 border-b border-white/10 pb-4 mb-6 tracking-widest">Répartition des résultats</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-black text-green-500">{totalWins}</div>
            <div className="text-[10px] font-bold text-gray-500 uppercase">Victoires</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-gray-400">{totalDraws}</div>
            <div className="text-[10px] font-bold text-gray-500 uppercase">Nuls</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-black text-red-500">{totalLoses}</div>
            <div className="text-[10px] font-bold text-gray-500 uppercase">Défaites</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
