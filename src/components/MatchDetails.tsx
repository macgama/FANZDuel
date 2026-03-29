import React, { useState, useEffect } from 'react';
import { footballApi } from '../services/footballApi';
import { Card, Button } from './Layout';
import { 
  ChevronLeft, 
  Activity, 
  Users, 
  BarChart3, 
  Clock, 
  AlertCircle,
  ArrowRightLeft,
  Square,
  CircleDot,
  Swords,
  Trophy,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { UserProfile } from '../types';
import { DuelManager } from './Duel';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface MatchDetailsProps {
  fixtureId: number;
  user: UserProfile | null;
  onBack: () => void;
  onTeamClick: (teamId: number, season: number) => void;
  onLeagueClick: (leagueId: number, season: number) => void;
  initialTab?: 'summary' | 'lineups' | 'stats' | 'duels';
}

export function MatchDetails({ fixtureId, user, onBack, onTeamClick, onLeagueClick, initialTab = 'summary' }: MatchDetailsProps) {
  const [details, setDetails] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [lineups, setLineups] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'summary' | 'lineups' | 'stats' | 'duels'>(initialTab);
  const [selectedDuelType, setSelectedDuelType] = useState<string | null>(null);
  const [selectedDuelId, setSelectedDuelId] = useState<string | null>(null);
  const [matchScore, setMatchScore] = useState<{ scoreA: number, scoreB: number } | null>(null);
  const [activeDuels, setActiveDuels] = useState<any[]>([]);
  const [showDuelsList, setShowDuelsList] = useState(false);
  const [duelHistory, setDuelHistory] = useState<any[]>([]);

  useEffect(() => {
    const fetchActiveDuels = async () => {
      try {
        const res = await fetch(`/api/duels/${fixtureId}`);
        if (res.ok) {
          const data = await res.json();
          // filter out duels where the user is already a participant
          setActiveDuels(data.filter((d: any) => !d.participants.find((p: any) => p.uid === user.uid)));
        }
      } catch (err) {
        console.error('Failed to fetch active duels', err);
      }
    };
    fetchActiveDuels();
    const interval = setInterval(fetchActiveDuels, 5000);
    return () => clearInterval(interval);
  }, [fixtureId, user.uid]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [detailsData, eventsData, lineupsData, statsData] = await Promise.all([
          footballApi.getFixtureDetails(fixtureId),
          footballApi.getFixtureEvents(fixtureId),
          footballApi.getFixtureLineups(fixtureId),
          footballApi.getFixtureStatistics(fixtureId)
        ]);
        setDetails(detailsData);
        setEvents(eventsData);
        setLineups(lineupsData);
        setStats(statsData);
      } catch (err) {
        console.error('Failed to fetch match details', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [fixtureId]);

  useEffect(() => {
    const fetchScores = async () => {
      if (selectedDuelType !== null) return; // Don't fetch while in duel
      try {
        const q = query(collection(db, 'match_scores'), where('matchId', '==', fixtureId.toString()));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          let totalA = 0;
          let totalB = 0;
          const history: any[] = [];
          querySnapshot.forEach(doc => {
            const data = doc.data();
            totalA += data.scoreA || 0;
            totalB += data.scoreB || 0;
            history.push({ id: doc.id, ...data });
          });
          setMatchScore({
            scoreA: totalA,
            scoreB: totalB
          });
          setDuelHistory(history.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
        } else {
          setMatchScore(null);
          setDuelHistory([]);
        }
      } catch (err) {
        console.error('Failed to fetch match scores', err);
      }
    };
    fetchScores();
  }, [fixtureId, selectedDuelType]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-orange-500"></div>
        <p className="text-gray-500 font-bold animate-pulse">Chargement des détails...</p>
      </div>
    );
  }

  if (!details) return null;

  const isLive = ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE'].includes(details.fixture.status.short);
  const isUpcoming = ['TBD', 'NS'].includes(details.fixture.status.short);
  const isFinished = !isLive && !isUpcoming;

  if (selectedDuelType && user) {
    return (
      <DuelManager 
        user={user} 
        onExit={() => {
          setSelectedDuelType(null);
          setSelectedDuelId(null);
        }} 
        matchId={fixtureId.toString()}
        teamA={details.teams.home.name}
        teamB={details.teams.away.name}
        teamALogo={details.teams.home.logo}
        teamBLogo={details.teams.away.logo}
        initialDuelId={selectedDuelId || undefined}
        initialDuelType={selectedDuelType || undefined}
        isLiveMatch={isLive}
      />
    );
  }

  const totalScore = (matchScore?.scoreA || 0) + (matchScore?.scoreB || 0);
  const dominanceA = totalScore > 0 ? Math.round(((matchScore?.scoreA || 0) / totalScore) * 100) : 50;
  const dominanceB = totalScore > 0 ? Math.round(((matchScore?.scoreB || 0) / totalScore) * 100) : 50;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors border border-white/10"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>

      {/* Gaming Scoreboard */}
      <div className="bg-[#1e1e1e] rounded-[2rem] p-4 sm:p-6 shadow-2xl relative overflow-hidden border border-white/5">
        {/* Top row: Country & League */}
        <div className="flex justify-between items-center mb-6 text-[9px] sm:text-xs font-black text-gray-400 uppercase tracking-widest">
          <div className="flex items-center gap-2">
            {details.league.flag && <img src={details.league.flag} alt="" className="w-4 h-3 object-cover rounded-sm" />}
            <span className="truncate max-w-[80px] sm:max-w-none">{details.league.country}</span>
          </div>
          <div className="flex items-center gap-2 text-right cursor-pointer hover:text-orange-500 transition-colors truncate" onClick={() => onLeagueClick(details.league.id, details.league.season)}>
            {details.league.logo && <img src={details.league.logo} alt="" className="w-4 h-4 object-contain flex-shrink-0" />}
            <span className="truncate max-w-[120px] sm:max-w-none">{details.league.name} - {details.league.round}</span>
          </div>
        </div>

        {/* Middle row: Teams & Score */}
        <div className="flex justify-between items-center mb-8">
          {/* Home Team */}
          <div className="flex-1 flex flex-col items-center gap-2 sm:gap-3 cursor-pointer group" onClick={() => onTeamClick(details.teams.home.id, details.league.season)}>
            <div className="w-14 h-14 sm:w-20 sm:h-20 bg-white rounded-full flex items-center justify-center p-2 shadow-lg group-hover:scale-105 transition-transform">
              <img src={details.teams.home.logo} alt="" className="w-full h-full object-contain" />
            </div>
            <span className="font-black text-center uppercase tracking-tight text-[10px] sm:text-sm text-white group-hover:text-orange-500 transition-colors line-clamp-2">
              {details.teams.home.name}
            </span>
            <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 bg-[#2a2a2a] border border-orange-500/20 rounded-full mt-1">
              <span className="text-orange-500 text-[10px] sm:text-xs">🔥</span>
              <span className="text-orange-500 font-black text-[9px] sm:text-xs">{matchScore?.scoreA || 0} PTS</span>
            </div>
          </div>

          {/* Score & Time */}
          <div className="flex flex-col items-center justify-center px-2 sm:px-4">
            <div className="text-3xl sm:text-5xl font-black text-white tracking-tighter mb-2">
              {details.goals.home ?? 0}:{details.goals.away ?? 0}
            </div>
            {isLive ? (
              <div className="px-2 sm:px-3 py-1 bg-orange-500/20 border border-orange-500/30 rounded-full text-orange-500 font-black text-[10px] sm:text-sm">
                {details.fixture.status.elapsed}{details.fixture.status.extra ? `+${details.fixture.status.extra}` : ''}'
              </div>
            ) : (
              <div className="px-2 sm:px-3 py-1 bg-white/10 border border-white/10 rounded-full text-gray-400 font-black text-[9px] sm:text-xs uppercase">
                {details.fixture.status.short}
              </div>
            )}
          </div>

          {/* Away Team */}
          <div className="flex-1 flex flex-col items-center gap-2 sm:gap-3 cursor-pointer group" onClick={() => onTeamClick(details.teams.away.id, details.league.season)}>
            <div className="w-14 h-14 sm:w-20 sm:h-20 bg-white rounded-full flex items-center justify-center p-2 shadow-lg group-hover:scale-105 transition-transform">
              <img src={details.teams.away.logo} alt="" className="w-full h-full object-contain" />
            </div>
            <span className="font-black text-center uppercase tracking-tight text-[10px] sm:text-sm text-white group-hover:text-orange-500 transition-colors line-clamp-2">
              {details.teams.away.name}
            </span>
            <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 bg-[#2a2a2a] border border-blue-500/20 rounded-full mt-1">
              <span className="text-blue-500 text-[10px] sm:text-xs">🔥</span>
              <span className="text-blue-500 font-black text-[9px] sm:text-xs">{matchScore?.scoreB || 0} PTS</span>
            </div>
          </div>
        </div>

        {/* Dominance Mondiale */}
        <div className="mb-4 sm:mb-6 px-1 sm:px-2">
          <div className="text-center mb-3">
            <span className="text-[10px] sm:text-xs font-black text-yellow-500 tracking-[0.2em] uppercase bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20">
              Dominance Mondiale
            </span>
          </div>
          
          <div className="flex justify-between items-end mb-2 px-2">
            <div className="flex flex-col items-start">
              <span className="text-2xl sm:text-4xl font-black text-orange-500 leading-none">
                {dominanceA}
                <span className="text-sm sm:text-lg text-orange-500/50 ml-1">%</span>
              </span>
            </div>
            
            <div className="flex flex-col items-end">
              <span className="text-2xl sm:text-4xl font-black text-blue-500 leading-none">
                {dominanceB}
                <span className="text-sm sm:text-lg text-blue-500/50 ml-1">%</span>
              </span>
            </div>
          </div>

          <div className="relative h-3 sm:h-4 bg-gray-800 rounded-full overflow-hidden flex border border-gray-700 shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-1000 ease-out relative" 
              style={{ width: `${dominanceA}%` }}
            >
              <div className="absolute inset-0 bg-white/20 w-full animate-pulse"></div>
            </div>
            <div 
              className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-1000 ease-out" 
              style={{ width: `${dominanceB}%` }}
            ></div>
            
            {/* Center Marker */}
            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/50 -translate-x-1/2 z-10"></div>
          </div>
        </div>

        {/* Buttons */}
        {!isFinished && (
          <div className="flex gap-2 sm:gap-4 mt-6">
            <button 
              className={`py-3 sm:py-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white font-black text-[10px] sm:text-sm uppercase tracking-widest transition-colors ${activeDuels.length > 0 ? 'flex-1' : 'w-full'}`}
              onClick={() => setSelectedDuelType(isLive ? 'war_of_kops' : 'training')}
            >
              Duel
            </button>
            {activeDuels.length > 0 && isLive && (
              <button 
                className="flex-1 py-3 sm:py-4 rounded-xl bg-[#ff6b00] hover:bg-[#ff8533] text-white font-black text-[10px] sm:text-sm uppercase tracking-widest transition-colors shadow-lg shadow-orange-500/20"
                onClick={() => setShowDuelsList(true)}
              >
                Rejoindre ({activeDuels.length})
              </button>
            )}
          </div>
        )}
      </div>

      {showDuelsList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-black text-white uppercase italic">Duels en attente</h3>
              <button onClick={() => setShowDuelsList(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {activeDuels.map(duel => (
                <div key={duel.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-orange-500 font-black text-sm uppercase">{duel.type}</div>
                    <div className="text-white text-xs mt-1">
                      {duel.participants.length} joueur(s) en attente
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setShowDuelsList(false);
                      setSelectedDuelId(duel.id);
                      setSelectedDuelType(duel.type);
                    }}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-bold text-xs uppercase"
                  >
                    Rejoindre
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
        <TabButton 
          active={activeTab === 'summary'} 
          onClick={() => setActiveTab('summary')}
          icon={<Activity className="w-4 h-4" />}
          label="Résumé"
        />
        <TabButton 
          active={activeTab === 'lineups'} 
          onClick={() => setActiveTab('lineups')}
          icon={<Users className="w-4 h-4" />}
          label="Compos"
        />
        <TabButton 
          active={activeTab === 'stats'} 
          onClick={() => setActiveTab('stats')}
          icon={<BarChart3 className="w-4 h-4" />}
          label="Stats"
        />
        <TabButton 
          active={activeTab === 'duels'} 
          onClick={() => setActiveTab('duels')}
          icon={<Trophy className="w-4 h-4" />}
          label="Duels"
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
          {activeTab === 'summary' && <SummaryTab events={events} teams={details.teams} />}
          {activeTab === 'lineups' && <LineupsTab lineups={lineups} />}
          {activeTab === 'stats' && <StatsTab stats={stats} teams={details.teams} />}
          {activeTab === 'duels' && <DuelsTab history={duelHistory} teams={details.teams} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-3 rounded-lg transition-all font-bold text-[10px] sm:text-xs uppercase italic ${
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

function SummaryTab({ events, teams }: { events: any[]; teams: any }) {
  if (events.length === 0) {
    return (
      <Card className="py-10 text-center text-gray-500">
        Aucun événement enregistré pour ce match.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event, idx) => {
        const isHome = event.team.id === teams.home.id;
        return (
          <div key={idx} className={`flex items-center gap-4 ${isHome ? 'flex-row' : 'flex-row-reverse'}`}>
            <div className="w-10 text-center font-black text-orange-500 italic text-sm">
              {event.time.elapsed}'
            </div>
            <div className={`flex-1 flex items-center gap-3 ${isHome ? 'flex-row' : 'flex-row-reverse'}`}>
              <div className={`p-2 rounded-lg bg-white/5 border border-white/10 flex items-center gap-3 ${isHome ? 'flex-row' : 'flex-row-reverse'}`}>
                <EventIcon type={event.type} detail={event.detail} />
                <div className={`flex flex-col ${isHome ? 'items-start' : 'items-end'}`}>
                  <span className="font-bold text-sm">{event.player.name}</span>
                  {event.type === 'Goal' && event.assist.name && (
                    <span className="text-[10px] text-gray-500 italic">Passe: {event.assist.name}</span>
                  )}
                  {event.type === 'subst' && (
                    <span className="text-[10px] text-gray-500 italic">Sortie: {event.assist.name}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex-1"></div>
          </div>
        );
      })}
    </div>
  );
}

function DuelsTab({ history, teams }: { history: any[]; teams: any }) {
  if (history.length === 0) {
    return (
      <Card className="py-10 text-center text-gray-500">
        Aucun duel enregistré pour ce match.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 text-center">
          <div className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1">Total {teams.home.name}</div>
          <div className="text-2xl font-black text-white">
            {history.reduce((acc, curr) => acc + (curr.scoreA || 0), 0)}
          </div>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 text-center">
          <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Total {teams.away.name}</div>
          <div className="text-2xl font-black text-white">
            {history.reduce((acc, curr) => acc + (curr.scoreB || 0), 0)}
          </div>
        </div>
      </div>

      <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Historique des Duels</h3>
      
      <div className="space-y-3">
        {history.map((duel, idx) => (
          <div key={duel.id || idx} className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-black text-orange-500 uppercase tracking-wider bg-orange-500/10 px-2 py-0.5 rounded">
                {duel.type || 'Duel'}
              </span>
              <span className="text-[10px] font-bold text-gray-500 italic">
                {duel.timestamp?.seconds ? new Date(duel.timestamp.seconds * 1000).toLocaleDateString() : ''}
              </span>
            </div>
            
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 flex flex-col items-center">
                <span className="text-lg font-black text-white">{duel.scoreA || 0}</span>
                <span className="text-[8px] font-bold text-gray-500 uppercase truncate w-full text-center">{teams.home.name}</span>
              </div>
              
              <div className="flex flex-col items-center px-4">
                <div className="h-0.5 w-8 bg-white/10" />
              </div>
              
              <div className="flex-1 flex flex-col items-center">
                <span className="text-lg font-black text-white">{duel.scoreB || 0}</span>
                <span className="text-[8px] font-bold text-gray-500 uppercase truncate w-full text-center">{teams.away.name}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EventIcon({ type, detail }: { type: string; detail: string }) {
  switch (type) {
    case 'Goal':
      return <CircleDot className="w-4 h-4 text-green-500" />;
    case 'Card':
      return <Square className={`w-4 h-4 ${detail.includes('Yellow') ? 'text-yellow-500 fill-yellow-500' : 'text-red-500 fill-red-500'}`} />;
    case 'subst':
      return <ArrowRightLeft className="w-4 h-4 text-blue-500" />;
    default:
      return <AlertCircle className="w-4 h-4 text-gray-500" />;
  }
}

function LineupsTab({ lineups }: { lineups: any[] }) {
  if (lineups.length === 0) {
    return (
      <Card className="py-10 text-center text-gray-500">
        Compositions non disponibles.
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {lineups.map((lineup, idx) => (
        <div key={idx} className="space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-3">
              <img src={lineup.team.logo} alt="" className="w-8 h-8 object-contain" />
              <h3 className="font-black italic uppercase text-sm tracking-wider">{lineup.team.name}</h3>
            </div>
            <span className="text-xs font-bold text-orange-500 bg-orange-500/10 px-2 py-1 rounded">
              {lineup.formation}
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-3">Titulaires</h4>
              <div className="space-y-2">
                {lineup.startXI.map((p: any) => (
                  <PlayerRow key={p.player.id} player={p.player} />
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-3">Remplaçants</h4>
              <div className="space-y-2">
                {lineup.substitutes.map((p: any) => (
                  <PlayerRow key={p.player.id} player={p.player} />
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-600 uppercase">Coach:</span>
                <span className="text-sm font-bold">{lineup.coach.name}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PlayerRow({ player }: { player: any }) {
  return (
    <div className="flex items-center gap-3 p-2 bg-white/5 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
      <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center text-[10px] font-black text-gray-400">
        {player.number}
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-bold">{player.name}</span>
        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter">{player.pos}</span>
      </div>
    </div>
  );
}

function StatsTab({ stats, teams }: { stats: any[]; teams: any }) {
  if (stats.length === 0) {
    return (
      <Card className="py-10 text-center text-gray-500">
        Statistiques non disponibles.
      </Card>
    );
  }

  // Find all unique stat types
  const statTypes = stats[0].statistics.map((s: any) => s.type);

  return (
    <Card className="p-6 space-y-6">
      {statTypes.map((type: string) => {
        const homeVal = stats.find(s => s.team.id === teams.home.id)?.statistics.find((s: any) => s.type === type)?.value || 0;
        const awayVal = stats.find(s => s.team.id === teams.away.id)?.statistics.find((s: any) => s.type === type)?.value || 0;

        // Simple percentage calculation for the bar
        const homeNum = parseFloat(String(homeVal).replace('%', '')) || 0;
        const awayNum = parseFloat(String(awayVal).replace('%', '')) || 0;
        const total = homeNum + awayNum;
        const homePercent = total === 0 ? 50 : (homeNum / total) * 100;

        return (
          <div key={type} className="space-y-2">
            <div className="flex justify-between text-[11px] font-black uppercase tracking-widest text-gray-400">
              <span>{homeVal}</span>
              <span className="text-white">{type}</span>
              <span>{awayVal}</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden flex">
              <div 
                className="h-full bg-orange-600 transition-all duration-500" 
                style={{ width: `${homePercent}%` }}
              ></div>
              <div 
                className="h-full bg-white/20 transition-all duration-500" 
                style={{ width: `${100 - homePercent}%` }}
              ></div>
            </div>
          </div>
        );
      })}
    </Card>
  );
}
