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
  Clock,
  Shield,
  Medal
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { translateCountryName, translateLeagueName } from '../utils/countryTranslations';
import { collection, query, where, orderBy, limit, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { getImageUrl } from '../lib/utils';

interface LeagueDetailsProps {
  leagueId: number;
  season: number;
  onBack: () => void;
  onTeamClick: (teamId: number, season: number) => void;
  onMatchClick?: (matchId: number, tab?: 'summary' | 'lineups' | 'stats' | 'duels') => void;
}

export function LeagueDetails({ leagueId, season: initialSeason, onBack, onTeamClick, onMatchClick }: LeagueDetailsProps) {
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
  const [activeTab, setActiveTab] = useState<'standings' | 'matches' | 'knockouts' | 'stats' | 'rankings' | 'teams' | 'tbfo'>('standings');

  // Check if there are knockout fixtures to show the tab
  const hasKnockouts = fixtures.some(f => {
    const round = f.league.round || '';
    return /round of 16|8th|huiti|quarter|quart|semi|demi|^final$|^finale$/i.test(round);
  });

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

  if (!league) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center px-4">
        <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-2">
          <Activity className="w-8 h-8 text-gray-500" />
        </div>
        <h3 className="text-xl font-black text-white uppercase italic">Données indisponibles</h3>
        <p className="text-gray-400 text-sm max-w-xs">
          Impossible de charger les détails de la compétition. La limite de requêtes a peut-être été atteinte.
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
                <img src={league.league.logo} alt="" className="w-full h-full object-contain" />
              </div>
              <div>
                <h2 className="text-sm font-black italic uppercase tracking-tighter leading-tight text-white">
                  {translateLeagueName(league.league.name)}
                </h2>
                <div className="flex items-center gap-1.5">
                  <p className="text-[8px] text-gray-400 uppercase font-black tracking-widest">
                    {translateCountryName(league.country.name)}
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
            {availableSeasons.map((s) => (
              <option key={s.year} value={s.year} className="bg-gray-900">
                Saison {s.year} {s.current ? '(Actuelle)' : ''}
              </option>
            ))}
          </select>
          {availableSeasons.find(s => s.year === selectedSeason)?.current && (
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
            {hasKnockouts && (
              <TabButton 
                active={activeTab === 'knockouts'} 
                onClick={() => setActiveTab('knockouts')}
                icon={<Activity className="w-3 h-3" />}
                label="Playoffs"
              />
            )}
            <TabButton 
              active={activeTab === 'rankings'} 
              onClick={() => setActiveTab('rankings')}
              icon={<Goal className="w-3 h-3" />}
              label="Rankings"
            />
            <TabButton 
              active={activeTab === 'teams'} 
              onClick={() => setActiveTab('teams')}
              icon={<Users className="w-3 h-3" />}
              label="Équipes"
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
              {activeTab === 'standings' && <StandingsTab standings={standings} fixtures={fixtures} onTeamClick={onTeamClick} onMatchClick={onMatchClick} selectedSeason={selectedSeason} />}
              {activeTab === 'tbfo' && <TbfoRankingsTab leagueId={leagueId} selectedSeason={selectedSeason} onTeamClick={onTeamClick} teams={teams} />}
              {activeTab === 'knockouts' && <KnockoutsTab fixtures={fixtures} onTeamClick={onTeamClick} onMatchClick={onMatchClick} selectedSeason={selectedSeason} />}
              {activeTab === 'matches' && <MatchesTab fixtures={fixtures} onTeamClick={onTeamClick} onMatchClick={onMatchClick} selectedSeason={selectedSeason} />}
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
              {activeTab === 'teams' && <TeamsTab teams={teams} onTeamClick={onTeamClick} selectedSeason={selectedSeason} standings={standings} />}
              {activeTab === 'stats' && <StatsTab standings={standings} leagueId={leagueId} selectedSeason={selectedSeason} />}
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

function StandingsTab({ standings, fixtures, onTeamClick, onMatchClick, selectedSeason }: { standings: any[]; fixtures?: any[]; onTeamClick: (id: number, season: number) => void; onMatchClick?: (id: number) => void; selectedSeason: number }) {
  if (standings.length === 0) return <Card className="py-10 text-center text-gray-500">Classement non disponible.</Card>;

  const groupedStandings = standings.reduce((acc: any, s: any) => {
    const groupName = s.group || 'Classement';
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(groupedStandings).map(([groupName, groupData]: [string, any]) => (
        <Card key={groupName} className="overflow-x-auto p-0 border border-white/10 bg-black/40">
          <div className="bg-white/5 px-4 py-2 border-b border-white/5">
            <h3 className="text-xs font-black uppercase text-center text-gray-300 tracking-widest">{translateCountryName(groupName)}</h3>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-[10px] font-black uppercase tracking-widest text-gray-400">
                <th className="px-3 py-2 w-8 text-center text-orange-500">#</th>
                <th className="px-3 py-2 text-white">Équipe</th>
                <th className="px-2 py-2 text-center" title="Matchs Joués">MP</th>
                <th className="px-2 py-2 text-center" title="Gagnés">W</th>
                <th className="px-2 py-2 text-center" title="Nuls">D</th>
                <th className="px-2 py-2 text-center" title="Perdus">L</th>
                <th className="px-2 py-2 text-center" title="Buts Marqués : Encaissés">G</th>
                <th className="px-2 py-2 text-center" title="Différence de buts">+/-</th>
                <th className="px-2 py-2 text-center text-white">PTS</th>
                <th className="px-3 py-2 text-center">FORM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(groupData as any[]).sort((a,b) => a.rank - b.rank).map((s) => (
                <tr key={s.team.id} className="hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => onTeamClick(s.team.id, selectedSeason)}>
                  <td className="px-3 py-2 text-center font-black italic text-xs text-white group-hover:text-orange-500">{s.rank}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <img src={s.team.logo} alt="" className="w-5 h-5 object-contain" />
                      <span className="font-bold text-xs truncate max-w-[120px] text-gray-200 group-hover:text-white transition-colors">{translateCountryName(s.team.name)}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center text-[11px] font-bold text-gray-400">{s.all.played}</td>
                  <td className="px-2 py-2 text-center text-[11px] font-bold text-gray-400">{s.all.win}</td>
                  <td className="px-2 py-2 text-center text-[11px] font-bold text-gray-400">{s.all.draw}</td>
                  <td className="px-2 py-2 text-center text-[11px] font-bold text-gray-400">{s.all.lose}</td>
                  <td className="px-2 py-2 text-center text-[11px] font-bold text-gray-400">{s.all.goals.for}:{s.all.goals.against}</td>
                  <td className="px-2 py-2 text-center text-[11px] font-bold text-gray-400">{s.goalsDiff}</td>
                  <td className="px-2 py-2 text-center font-black text-xs text-orange-400">{s.points}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-center gap-1">
                      {s.form?.split('').map((f: string, i: number) => (
                        <span 
                          key={i} 
                          className={`w-4 h-4 rounded text-[8px] flex items-center justify-center font-black text-white/90 ${
                            f === 'W' ? 'bg-green-600/80' : f === 'D' ? 'bg-gray-500/80' : 'bg-red-600/80'
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

          {fixtures && fixtures.filter(f => f.league.round === groupName || groupName.includes(f.league.round) || f.league.round.includes(groupName.replace(/.* - /, ''))).length > 0 && (
            <div className="bg-white/5 border-t border-white/5 p-2">
              <h4 className="text-[10px] font-black italic uppercase text-gray-500 mb-2 pl-2 tracking-widest border-l-2 border-orange-500">Matchs du {groupName.replace(/Group /i, 'Groupe ')}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {fixtures
                  .filter(f => f.league.round === groupName || groupName.includes(f.league.round) || f.league.round.includes(groupName.replace(/.* - /, '')))
                  .sort((a, b) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime())
                  .map(f => (
                    <Card key={f.fixture.id} className="p-2 hover:border-orange-500/30 transition-all cursor-pointer bg-black/40 border-white/5" onClick={() => onMatchClick && onMatchClick(f.fixture.id)}>
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center text-[8px] font-medium text-gray-400 uppercase tracking-wider">
                          <span className="flex items-center gap-1 opacity-80">
                            <Clock className="w-2 h-2" />
                            {format(new Date(f.fixture.date), 'dd/MM HH:mm')}
                          </span>
                          <span className={f.fixture.status.short === 'FT' ? 'text-gray-500' : 'text-orange-500'}>
                            {f.fixture.status.short}
                          </span>
                        </div>
                        
                        <div className="flex flex-col gap-1.5">
                          <div className="flex justify-between items-center cursor-pointer group/team" onClick={(e) => { e.stopPropagation(); onTeamClick(f.teams.home.id, selectedSeason); }}>
                            <div className="flex items-center gap-2">
                              <img src={f.teams.home.logo} alt="" className="w-4 h-4 object-contain" />
                              <span className="font-bold text-[10px] text-gray-300 group-hover/team:text-orange-500 transition-colors uppercase truncate max-w-[100px]">{f.teams.home.name}</span>
                            </div>
                            <span className="font-black text-xs">{f.goals.home ?? '-'}</span>
                          </div>
                          <div className="flex justify-between items-center cursor-pointer group/team" onClick={(e) => { e.stopPropagation(); onTeamClick(f.teams.away.id, selectedSeason); }}>
                            <div className="flex items-center gap-2">
                              <img src={f.teams.away.logo} alt="" className="w-4 h-4 object-contain" />
                              <span className="font-bold text-[10px] text-gray-300 group-hover/team:text-orange-500 transition-colors uppercase truncate max-w-[100px]">{f.teams.away.name}</span>
                            </div>
                            <span className="font-black text-xs">{f.goals.away ?? '-'}</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function MatchesTab({ fixtures, onTeamClick, onMatchClick, selectedSeason }: { fixtures: any[]; onTeamClick: (id: number, season: number) => void; onMatchClick?: (id: number) => void; selectedSeason: number }) {
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
    <div className="space-y-4">
      {rounds.map((round) => (
        <div key={round} className="space-y-2">
          <h3 className="text-[10px] font-black italic uppercase text-gray-500 border-b border-white/10 pb-1 tracking-widest">
            {formatRound(round)}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {groupedByRound[round].map((f: any) => (
              <Card key={f.fixture.id} className="p-2 hover:border-orange-500/30 transition-all cursor-pointer" onClick={() => onMatchClick && onMatchClick(f.fixture.id)}>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center text-[8px] font-medium text-gray-500 uppercase tracking-wider">
                    <span className="flex items-center gap-1 opacity-80">
                      <Clock className="w-2 h-2" />
                      {format(new Date(f.fixture.date), 'dd/MM HH:mm')}
                    </span>
                    <span className={f.fixture.status.short === 'FT' ? 'text-gray-400' : 'text-orange-500'}>
                      {f.fixture.status.short}
                    </span>
                  </div>
                  
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center cursor-pointer group/team" onClick={(e) => { e.stopPropagation(); onTeamClick(f.teams.home.id, selectedSeason); }}>
                      <div className="flex items-center gap-2">
                        <img src={f.teams.home.logo} alt="" className="w-4 h-4 object-contain group-hover/team:scale-110 transition-transform" />
                        <span className={`text-[11px] font-bold ${f.teams.home.winner ? 'text-white' : 'text-gray-400'} group-hover/team:text-orange-500 transition-colors truncate max-w-[120px]`}>
                          {translateCountryName(f.teams.home.name)}
                        </span>
                      </div>
                      <span className="font-black text-sm">{f.goals.home ?? '-'}</span>
                    </div>
                    <div className="flex justify-between items-center cursor-pointer group/team" onClick={(e) => { e.stopPropagation(); onTeamClick(f.teams.away.id, selectedSeason); }}>
                      <div className="flex items-center gap-2">
                        <img src={f.teams.away.logo} alt="" className="w-4 h-4 object-contain group-hover/team:scale-110 transition-transform" />
                        <span className={`text-[11px] font-bold ${f.teams.away.winner ? 'text-white' : 'text-gray-400'} group-hover/team:text-orange-500 transition-colors truncate max-w-[120px]`}>
                          {translateCountryName(f.teams.away.name)}
                        </span>
                      </div>
                      <span className="font-black text-sm">{f.goals.away ?? '-'}</span>
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

function KnockoutsTab({ fixtures, onTeamClick, onMatchClick, selectedSeason }: { fixtures: any[]; onTeamClick: (id: number, season: number) => void; onMatchClick?: (id: number) => void; selectedSeason: number }) {
  const knockoutRounds = [
    { key: '16', regex: /round of 16|8th|huiti|1\/8/i, title: 'Huitièmes' },
    { key: '8', regex: /quarter|quart|1\/4/i, title: 'Quarts' },
    { key: '4', regex: /semi|demi|1\/2/i, title: 'Demi-finales' },
    { key: '2', regex: /^final$|^finale$|^3rd/i, title: 'Finale' },
  ];

  const roundData: Record<string, any[]> = {
    '16': [],
    '8': [],
    '4': [],
    '2': []
  };

  let hasKnockouts = false;

  fixtures.forEach(f => {
    const round = f.league.round || '';
    const matched = knockoutRounds.find(r => r.regex.test(round));
    if (matched) {
      roundData[matched.key].push(f);
      hasKnockouts = true;
    }
  });

  if (!hasKnockouts) {
    return <Card className="py-10 text-center text-gray-500">Aucune phase finale disponible.</Card>;
  }

  return (
    <div className="overflow-x-auto pb-4 no-scrollbar">
      <div className="flex gap-6 min-w-max px-2 py-4">
        {knockoutRounds.map(r => {
           const matches = roundData[r.key];
           if (matches.length === 0) return null;
           
           return (
             <div key={r.key} className="flex flex-col gap-4 w-48 shrink-0 justify-around">
               <div className="text-center font-black uppercase tracking-widest text-orange-500 text-[10px] bg-white/5 py-1 rounded border border-white/5 mb-2 shadow-sm">{r.title}</div>
               {matches.map(f => {
                  const isFinished = f.fixture.status.short === 'FT' || f.fixture.status.short === 'AET' || f.fixture.status.short === 'PEN';
                  return (
                    <div key={f.fixture.id} className="flex flex-col gap-1 p-2 bg-black/60 rounded-lg border border-white/10 hover:border-orange-500/50 transition-colors cursor-pointer" onClick={() => onMatchClick && onMatchClick(f.fixture.id)}>
                      <div className="text-[8px] text-gray-500 font-bold uppercase tracking-wider text-center border-b border-white/5 pb-1 mb-1">
                        {format(new Date(f.fixture.date), 'dd/MM HH:mm')}
                      </div>
                      <div className="flex flex-col gap-1">
                        {/* Home Team */}
                        <div className={`flex justify-between items-center px-1 rounded py-0.5 group/team ${f.teams.home.winner ? 'bg-orange-500/10' : ''}`} onClick={(e) => { e.stopPropagation(); onTeamClick(f.teams.home.id, selectedSeason); }}>
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            <img src={f.teams.home.logo} alt="" className="w-3.5 h-3.5 object-contain group-hover/team:scale-110 transition-transform" />
                            <span className={`text-[10px] font-bold truncate group-hover/team:text-orange-500 transition-colors ${f.teams.home.winner ? 'text-white' : 'text-gray-300'}`}>{translateCountryName(f.teams.home.name)}</span>
                          </div>
                          <span className={`text-xs font-black ${f.teams.home.winner ? 'text-orange-500' : 'text-gray-400'}`}>
                            {isFinished ? f.goals.home : '-'}
                          </span>
                        </div>
                        {/* Away Team */}
                        <div className={`flex justify-between items-center px-1 rounded py-0.5 group/team ${f.teams.away.winner ? 'bg-orange-500/10' : ''}`} onClick={(e) => { e.stopPropagation(); onTeamClick(f.teams.away.id, selectedSeason); }}>
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            <img src={f.teams.away.logo} alt="" className="w-3.5 h-3.5 object-contain group-hover/team:scale-110 transition-transform" />
                            <span className={`text-[10px] font-bold truncate group-hover/team:text-orange-500 transition-colors ${f.teams.away.winner ? 'text-white' : 'text-gray-300'}`}>{translateCountryName(f.teams.away.name)}</span>
                          </div>
                          <span className={`text-xs font-black ${f.teams.away.winner ? 'text-orange-500' : 'text-gray-400'}`}>
                            {isFinished ? f.goals.away : '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
               })}
             </div>
           )
        })}
      </div>
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
    <div className="space-y-2">
      <h3 className="text-[10px] font-black italic uppercase text-gray-500 border-b border-white/10 pb-1 tracking-widest flex items-center gap-1.5">
        {icon}
        {title}
      </h3>
      <div className="space-y-1">
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
              className="flex items-center justify-between p-1.5 hover:bg-white/5 transition-colors cursor-pointer group"
              onClick={() => onTeamClick(item.statistics[0].team.id, selectedSeason)}
            >
              <div className="flex items-center gap-2">
                <span className="w-3 text-[10px] font-black italic text-gray-600">{idx + 1}</span>
                <img src={item.player.photo} alt="" className="w-8 h-8 rounded-full border border-white/10 group-hover:scale-110 transition-transform" />
                <div className="min-w-0">
                  <h4 className="text-xs font-bold group-hover:text-orange-500 transition-colors truncate">{item.player.name}</h4>
                  <p className="text-[8px] text-gray-500 uppercase font-bold truncate">{item.statistics[0].team.name}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-orange-500">{value}</span>
                <p className="text-[7px] uppercase font-bold text-gray-500">{statLabel}</p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function TeamsTab({ teams, onTeamClick, selectedSeason, standings }: { teams: any[]; onTeamClick: (id: number, season: number) => void; selectedSeason: number; standings?: any[] }) {
  // If there are groups in standings, we can structure it. Otherwise simple list.
  const isGroupStage = standings && standings.length > 1 && standings[0].group;
  
  if (isGroupStage) {
    const groupedTeams: Record<string, any[]> = {};
    standings.forEach(group => {
      const groupName = group.group || 'Group';
      groupedTeams[groupName] = [];
      group.standings.forEach((teamEntry: any) => {
        const teamObj = teams.find(t => t.team.id === teamEntry.team.id);
        if (teamObj) {
           groupedTeams[groupName].push(teamObj);
        }
      });
    });

    return (
      <div className="space-y-6">
        {Object.entries(groupedTeams).map(([groupName, groupTeams]) => (
          <div key={groupName}>
            <h3 className="text-orange-500 font-black uppercase italic tracking-widest text-sm mb-3 pl-2 border-l-2 border-orange-500">{translateCountryName(groupName)}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {groupTeams.map((t) => (
                <Card key={t.team.id} onClick={() => onTeamClick(t.team.id, selectedSeason)} className="flex flex-col items-center gap-2 p-3 hover:border-orange-500/50 transition-all group cursor-pointer relative">
                  {t.team.country && (
                    <div className="absolute top-2 right-2 flex items-center justify-center">
                        <span className="text-[8px] font-bold text-gray-500 uppercase">{translateCountryName(t.team.country)}</span>
                    </div>
                  )}
                  <div className="w-12 h-12 bg-white/5 rounded-xl p-2 flex items-center justify-center group-hover:bg-orange-500/10 transition-colors">
                    <img src={t.team.logo} alt="" className="w-full h-full object-contain group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="text-center w-full">
                    <h3 className="font-black italic uppercase text-[10px] tracking-widest group-hover:text-orange-500 transition-colors leading-tight truncate px-1">{translateCountryName(t.team.name)}</h3>
                    <p className="text-[8px] text-gray-500 font-bold uppercase mt-0.5 truncate px-1">{t.venue.city}</p>
                  </div>
                  <div className="w-full pt-2 border-t border-white/5 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <MapPin className="w-2.5 h-2.5 shrink-0" />
                      <span className="text-[8px] font-bold uppercase truncate">{t.venue.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <Users className="w-2.5 h-2.5 shrink-0" />
                      <span className="text-[8px] font-bold uppercase">{t.venue.capacity?.toLocaleString()}</span>
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

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {teams.map((t) => (
        <Card key={t.team.id} onClick={() => onTeamClick(t.team.id, selectedSeason)} className="flex flex-col items-center gap-2 p-3 hover:border-orange-500/50 transition-all group cursor-pointer relative">
          {t.team.country && (
            <div className="absolute top-2 right-2 flex items-center justify-center">
                <span className="text-[8px] font-bold text-gray-500 uppercase">{translateCountryName(t.team.country)}</span>
            </div>
          )}
          <div className="w-12 h-12 bg-white/5 rounded-xl p-2 flex items-center justify-center group-hover:bg-orange-500/10 transition-colors">
            <img src={t.team.logo} alt="" className="w-full h-full object-contain group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-center w-full">
            <h3 className="font-black italic uppercase text-[10px] tracking-widest group-hover:text-orange-500 transition-colors leading-tight truncate px-1">{translateCountryName(t.team.name)}</h3>
            <p className="text-[8px] text-gray-500 font-bold uppercase mt-0.5 truncate px-1">{t.venue.city}</p>
          </div>
          <div className="w-full pt-2 border-t border-white/5 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-gray-500">
              <MapPin className="w-2.5 h-2.5 shrink-0" />
              <span className="text-[8px] font-bold uppercase truncate">{t.venue.name}</span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-500">
              <Users className="w-2.5 h-2.5 shrink-0" />
              <span className="text-[8px] font-bold uppercase">{t.venue.capacity?.toLocaleString()}</span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function StatsTab({ standings, leagueId, selectedSeason }: { standings: any[], leagueId: number, selectedSeason: number }) {
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
        // Fetch rankings to get total points
        const rankingsQ = query(
          collection(db, 'ranking_users'),
          where('season', '==', selectedSeason.toString()),
          where('leagueId', '==', leagueId.toString())
        );
        const rankingsSnap = await getDocs(rankingsQ);
        const pointTotal = rankingsSnap.docs.reduce((acc, doc) => acc + (doc.data().totalScore || 0), 0);

        // Let's actually fetch the duels for this league (up to 500 max to prevent massive reads)
        const duelsQ = query(
          collection(db, 'duels'),
          where('match.leagueId', '==', leagueId),
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
            else if (data.type === 'kop') dKop++;
            else if (data.type === 'team') dKop++; // Fallback if 'team' is still in DB, map to kop or general 'team'
            
            // Count cards used if available in the duel data directly (e.g., participants history)
            // This depends on the specific db structure. We'll provide a placeholder or basic count
            if (data.participants) {
              data.participants.forEach((p: any) => {
                // If cards are stored here
                if (p.usedCards) totalCards += p.usedCards;
              });
            }
          });
        } catch (err) {
          console.warn("Could not fetch duels for stats:", err);
        }

        // For clicks, we might trace 'life_actions' or 'fanz'
        const lifeActionsQ = query(
          collection(db, 'life_actions'),
          limit(100) // sample since we don't have a direct leagueId index
        );
        let tClicks = 0;
        try {
           const lifeSnap = await getDocs(lifeActionsQ);
           lifeSnap.docs.forEach(d => {
              const data = d.data();
              if (data.leagueId === leagueId && data.type === 'click') {
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
        console.error("Error fetching TBFO stats:", err);
        setTbfoStats(prev => ({ ...prev, loading: false }));
      }
    };

    fetchTbfoStats();
  }, [leagueId, selectedSeason]);

  const totalGoals = standings.reduce((acc, s) => acc + s.all.goals.for, 0);
  const totalMatches = standings.reduce((acc, s) => acc + s.all.played, 0) / 2;
  const avgGoals = totalMatches > 0 ? (totalGoals / totalMatches).toFixed(2) : '0';
  
  const totalWins = standings.reduce((acc, s) => acc + s.all.win, 0);
  const totalDraws = standings.reduce((acc, s) => acc + s.all.draw, 0);
  const totalLoses = standings.reduce((acc, s) => acc + s.all.lose, 0);

  return (
    <div className="space-y-4">
      {standings.length > 0 && (
        <>
          <h3 className="text-sm font-black italic uppercase text-white flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-orange-500" />
            Stats Réelles (Football)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Card className="flex flex-col items-center justify-center p-4 text-center space-y-1">
              <Goal className="w-5 h-5 text-orange-500 mb-1" />
              <span className="text-2xl font-black italic text-white">{totalGoals}</span>
              <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Buts marqués</span>
            </Card>

            <Card className="flex flex-col items-center justify-center p-4 text-center space-y-1">
              <Activity className="w-5 h-5 text-orange-500 mb-1" />
              <span className="text-2xl font-black italic text-white">{avgGoals}</span>
              <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Buts / match</span>
            </Card>

            <Card className="flex flex-col items-center justify-center p-4 text-center space-y-1">
              <Trophy className="w-5 h-5 text-orange-500 mb-1" />
              <span className="text-2xl font-black italic text-white">{totalMatches}</span>
              <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Matchs joués</span>
            </Card>

            <Card className="col-span-2 md:col-span-3 p-4">
              <h3 className="text-[10px] font-black italic uppercase text-gray-500 border-b border-white/10 pb-2 mb-4 tracking-widest">Résultats Globaux</h3>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <div className="text-xl font-black text-green-500">{totalWins}</div>
                  <div className="text-[8px] font-bold text-gray-500 uppercase">Victoires</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-black text-gray-400">{totalDraws}</div>
                  <div className="text-[8px] font-bold text-gray-500 uppercase">Nuls</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-black text-red-500">{totalLoses}</div>
                  <div className="text-[8px] font-bold text-gray-500 uppercase">Défaites</div>
                </div>
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
        <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
          <Card className="flex flex-col items-center justify-center p-4 text-center space-y-1 bg-gradient-to-br from-orange-500/10 to-transparent border-orange-500/20">
            <Shield className="w-5 h-5 text-orange-500 mb-1" />
            <span className="text-2xl font-black italic text-white">{tbfoStats.totalPoints.toLocaleString()}</span>
            <span className="text-[8px] font-bold text-orange-500/80 uppercase tracking-widest">Points Distribués</span>
          </Card>
          
          <Card className="flex flex-col items-center justify-center p-4 text-center space-y-1 bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
            <Users className="w-5 h-5 text-blue-500 mb-1" />
            <span className="text-2xl font-black italic text-white flex items-center gap-1">
              {tbfoStats.duelsCount}
            </span>
            <span className="text-[8px] font-bold text-blue-500/80 uppercase tracking-widest">Duels Joués</span>
            <div className="text-[9px] text-gray-400 mt-2 flex flex-wrap justify-center gap-1.5">
              <span>1v1: <strong className="text-white">{tbfoStats.duels1v1}</strong></span>
              <span>2v2: <strong className="text-white">{tbfoStats.duels2v2}</strong></span>
              <span>5v5: <strong className="text-white">{tbfoStats.duels5v5}</strong></span>
              <span>Guerre des Kops: <strong className="text-white">{tbfoStats.duelsKop}</strong></span>
            </div>
          </Card>

          <Card className="flex flex-col items-center justify-center p-4 text-center space-y-1 bg-gradient-to-br from-yellow-500/10 to-transparent border-yellow-500/20">
            <Medal className="w-5 h-5 text-yellow-500 mb-1" />
            <span className="text-2xl font-black italic text-white">{tbfoStats.totalCards}</span>
            <span className="text-[8px] font-bold text-yellow-500/80 uppercase tracking-widest">Cartes Jouées</span>
          </Card>

          <Card className="flex flex-col items-center justify-center p-4 text-center space-y-1 bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20">
            <BarChart3 className="w-5 h-5 text-purple-500 mb-1" />
            <span className="text-2xl font-black italic text-white">{tbfoStats.totalClicks.toLocaleString()}</span>
            <span className="text-[8px] font-bold text-purple-500/80 uppercase tracking-widest">Clics (Ferveur)</span>
          </Card>
        </div>
      )}
    </div>
  );
}

export function TbfoRankingsTab({ leagueId, selectedSeason, onTeamClick, teams, highlightTeamId }: { leagueId: number, selectedSeason: number, onTeamClick: (id: number, season: number) => void, teams?: any[], highlightTeamId?: number }) {
  const [activeTab, setActiveTab] = useState<'teams' | 'users'>('teams');
  const [metric, setMetric] = useState<'averageScore' | 'totalScore'>('averageScore');
  const [loading, setLoading] = useState(true);
  const [rankings, setRankings] = useState<any[]>([]);

  useEffect(() => {
    const fetchRankings = async () => {
      setLoading(true);
      try {
        const collectionName = activeTab === 'teams' ? 'ranking_teams' : 'ranking_users';
        let entries: any[] = [];
        
        let snapshot;
        try {
          const q = query(
            collection(db, collectionName),
            where('season', '==', selectedSeason.toString()),
            where('leagueId', '==', leagueId.toString()),
            orderBy(metric, 'desc'),
            limit(50)
          );
          snapshot = await getDocs(q);
        } catch (e) {
          const fallbackQ = query(
            collection(db, collectionName),
            where('season', '==', selectedSeason.toString()),
            where('leagueId', '==', leagueId.toString())
          );
          const fallbackSnap = await getDocs(fallbackQ);
          const sortedDocs = [...fallbackSnap.docs].sort((a, b) => {
            const valA = a.data()[metric] || 0;
            const valB = b.data()[metric] || 0;
            return valB - valA;
          }).slice(0, 50);
          snapshot = { docs: sortedDocs };
        }

        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          let name = 'Inconnu';
          let imageUrl = '';
          let actualTeamId = data.teamId;

          if (activeTab === 'teams') {
            const tId = data.teamId?.toString();
            if (!tId) continue;
            
            // Fast lookup in 'teams' prop
            const localTeam = teams?.find(t => t.team.id === Number(tId));
            if (localTeam) {
              name = localTeam.team.name;
              imageUrl = localTeam.team.logo;
            } else {
              try {
                const teamDoc = await getDoc(doc(db, 'teams', tId));
                if (teamDoc.exists()) {
                  name = teamDoc.data().name;
                  imageUrl = teamDoc.data().logo;
                } else if (!isNaN(Number(tId))) {
                 try {
                   const { footballApi } = await import('../services/footballApi');
                   const teamData = await footballApi.getTeamInfo(Number(tId));
                   if (teamData) {
                     name = teamData.team.name;
                     imageUrl = teamData.team.logo;
                   }
                 } catch (e) {}
                }
              } catch(e) {}
            }
          } else {
            const uId = data.userId?.toString();
            if (!uId) continue;
            try {
              const userDoc = await getDoc(doc(db, 'users', uId));
              if (userDoc.exists()) {
                name = userDoc.data().pseudo || 'Supporter';
                imageUrl = userDoc.data().photoURL;
              }
            } catch(e) {}
          }

          entries.push({
            id: docSnap.id,
            teamId: actualTeamId,
            name,
            imageUrl,
            averageScore: data.averageScore || 0,
            matches: data.matches || 0,
            totalScore: data.totalScore || 0,
            rank: 0
          });
        }
        
        // If viewing teams, include teams that have 0 played games
        if (activeTab === 'teams' && teams) {
          teams.forEach(t => {
            if (!entries.find(e => Number(e.teamId) === t.team.id)) {
              entries.push({
                id: `team_${t.team.id}`,
                teamId: t.team.id,
                name: t.team.name,
                imageUrl: t.team.logo,
                averageScore: 0,
                matches: 0,
                totalScore: 0,
                rank: 0
              });
            }
          });
          
          // Re-sort entries since we added 0-score teams
          entries.sort((a, b) => b[metric] - a[metric] || b.matches - a.matches || a.name.localeCompare(b.name));
        }

        entries = entries.map((e, index) => ({ ...e, rank: index + 1 }));
        setRankings(entries);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchRankings();
  }, [activeTab, metric, leagueId, selectedSeason, teams]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 p-1 bg-black/40 rounded-xl max-w-sm mx-auto">
        <button
          onClick={() => setActiveTab('teams')}
          className={`flex-1 py-1.5 rounded-lg font-bold text-[10px] sm:text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'teams' ? 'bg-orange-500 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          Équipes
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 py-1.5 rounded-lg font-bold text-[10px] sm:text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'users' ? 'bg-blue-500 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Supporters
        </button>
      </div>

      <div className="flex justify-center mb-4">
        <div className="relative inline-block w-48">
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as any)}
            className="w-full appearance-none bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white font-bold text-[10px] text-center focus:outline-none focus:border-orange-500 transition-colors"
          >
            <option value="averageScore">Points par match</option>
            <option value="totalScore">Total des points</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="flex justify-center items-center py-10">
            <Activity className="w-6 h-6 text-orange-500 animate-spin" />
          </div>
        ) : rankings.length === 0 ? (
          <Card className="py-10 text-center text-gray-500">Aucun classement disponible.</Card>
        ) : (
          <AnimatePresence>
            {rankings.map((entry, index) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => {
                  if (activeTab === 'teams' && entry.teamId) {
                    onTeamClick(Number(entry.teamId), selectedSeason);
                  }
                }}
                className={`flex items-center gap-3 p-2 rounded-xl border transition-all ${activeTab === 'teams' ? 'cursor-pointer hover:border-orange-500/50 hover:bg-white/5' : ''} ${
                  highlightTeamId && Number(entry.teamId) === highlightTeamId ? 'bg-orange-500/20 border-orange-500/50' :
                  index === 0 ? 'bg-gradient-to-r from-yellow-500/20 to-transparent border-yellow-500/30' :
                  index === 1 ? 'bg-gradient-to-r from-gray-300/10 to-transparent border-gray-400/20' :
                  index === 2 ? 'bg-gradient-to-r from-amber-700/10 to-transparent border-amber-700/20' :
                  'bg-black/40 border-white/5'
                }`}
              >
                <div className="flex items-center justify-center w-6 font-black text-xs shrink-0">
                  {index === 0 ? <Medal className="w-5 h-5 text-yellow-400" /> :
                   index === 1 ? <Medal className="w-4 h-4 text-gray-300" /> :
                   index === 2 ? <Medal className="w-4 h-4 text-amber-600" /> :
                   <span className="text-gray-500">{entry.rank}</span>}
                </div>

                <div className="w-8 h-8 rounded-full overflow-hidden bg-white/5 shrink-0 flex items-center justify-center border border-white/10">
                  {entry.imageUrl ? (
                    <img src={getImageUrl(entry.imageUrl)} alt={entry.name} className="w-full h-full object-cover" />
                  ) : activeTab === 'teams' ? (
                    <Shield className="w-4 h-4 text-gray-500" />
                  ) : (
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${entry.id}`} alt={entry.name} className="w-full h-full object-cover bg-white/10" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className={`font-bold truncate text-[11px] ${index === 0 ? 'text-yellow-400' : 'text-white'}`}>
                    {entry.name}
                  </h3>
                  <p className="text-[9px] text-gray-400">
                    {entry.matches} match{entry.matches > 1 ? 's' : ''}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-black text-white">
                    {metric === 'averageScore' ? (
                      <>{entry.averageScore != null ? entry.averageScore.toFixed(1) : '0.0'}</>
                    ) : (
                      <>{entry.totalScore || 0}</>
                    )}
                  </div>
                  <div className="text-[8px] text-gray-500 font-bold uppercase">
                    {metric === 'averageScore' ? 'pts/m' : 'pts'}
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
