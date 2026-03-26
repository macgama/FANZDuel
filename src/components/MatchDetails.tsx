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
  CircleDot
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface MatchDetailsProps {
  fixtureId: number;
  onBack: () => void;
  onTeamClick: (teamId: number, season: number) => void;
  onLeagueClick: (leagueId: number, season: number) => void;
}

export function MatchDetails({ fixtureId, onBack, onTeamClick, onLeagueClick }: MatchDetailsProps) {
  const [details, setDetails] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [lineups, setLineups] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'summary' | 'lineups' | 'stats'>('summary');

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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-orange-500"></div>
        <p className="text-gray-500 font-bold animate-pulse">Chargement des détails...</p>
      </div>
    );
  }

  if (!details) return null;

  const isLive = ['1H', '2H', 'HT', 'ET', 'P', 'BT'].includes(details.fixture.status.short);

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors border border-white/10"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex-1">
          <h2 
            className="text-sm font-bold text-gray-500 uppercase tracking-widest italic cursor-pointer hover:text-orange-500 transition-colors"
            onClick={() => onLeagueClick(details.league.id, details.league.season)}
          >
            {details.league.name} - {details.league.round}
          </h2>
          <p className="text-[10px] font-medium text-gray-600 uppercase tracking-tight">
            {format(new Date(details.fixture.date), 'dd/MM/yyyy, HH:mm')}
          </p>
        </div>
      </div>

      {/* Scoreboard */}
      <Card className="relative overflow-hidden border-orange-500/20">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-50"></div>
        
        <div className="flex items-center justify-between gap-4 py-4">
          {/* Home Team */}
          <div 
            className="flex-1 flex flex-col items-center gap-3 cursor-pointer group"
            onClick={() => onTeamClick(details.teams.home.id, details.league.season)}
          >
            <img src={details.teams.home.logo} alt="" className="w-16 h-16 object-contain group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
            <span className="font-black text-center uppercase italic tracking-tight text-lg group-hover:text-orange-500 transition-colors">
              {details.teams.home.name}
            </span>
          </div>

          {/* Score */}
          <div className="flex flex-col items-center min-w-[120px]">
            <div className="flex items-center gap-4">
              <span className={`text-5xl font-black ${isLive ? 'text-orange-500' : ''}`}>
                {details.goals.home ?? 0}
              </span>
              <span className="text-gray-700 text-3xl">-</span>
              <span className={`text-5xl font-black ${isLive ? 'text-orange-500' : ''}`}>
                {details.goals.away ?? 0}
              </span>
            </div>
            <div className="mt-4">
              {isLive ? (
                <span className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-xs font-black text-red-500 animate-pulse uppercase">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  {details.fixture.status.elapsed}'
                </span>
              ) : (
                <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-bold text-gray-400 uppercase">
                  {details.fixture.status.long}
                </span>
              )}
            </div>
          </div>

          {/* Away Team */}
          <div 
            className="flex-1 flex flex-col items-center gap-3 cursor-pointer group"
            onClick={() => onTeamClick(details.teams.away.id, details.league.season)}
          >
            <img src={details.teams.away.logo} alt="" className="w-16 h-16 object-contain group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
            <span className="font-black text-center uppercase italic tracking-tight text-lg group-hover:text-orange-500 transition-colors">
              {details.teams.away.name}
            </span>
          </div>
        </div>
      </Card>

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
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all font-bold text-xs uppercase italic ${
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
              <img src={lineup.team.logo} alt="" className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
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
