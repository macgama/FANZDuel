import React, { useState, useEffect, useMemo } from 'react';
import { footballApi } from '../services/footballApi';
import { Card, Button } from './Layout';
import { Search, Calendar as CalendarIcon, Activity, Clock, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays, subDays, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { MatchDetails } from './MatchDetails';

export function MatchesPage({ onMatchClick, onTeamClick, onLeagueClick }: { onMatchClick: (id: number) => void; onTeamClick: (id: number, season: number) => void; onLeagueClick: (id: number, season: number) => void }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'upcoming' | 'finished'>('all');

  const fetchFixtures = async () => {
    setLoading(true);
    try {
      let data;
      if (statusFilter === 'live') {
        data = await footballApi.getLiveFixtures();
      } else {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        data = await footballApi.getFixturesByDate(dateStr);
      }
      setFixtures(data || []);
    } catch (err) {
      console.error('Failed to fetch fixtures', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFixtures();
    // Refresh live matches every minute if filter is live
    let interval: any;
    if (statusFilter === 'live') {
      interval = setInterval(fetchFixtures, 60000);
    }
    return () => clearInterval(interval);
  }, [selectedDate, statusFilter]);

  const filteredFixtures = useMemo(() => {
    return fixtures.filter(f => {
      const matchesSearch = 
        f.league.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.teams.home.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.teams.away.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      if (statusFilter === 'live') return true; // Already filtered by API
      if (statusFilter === 'upcoming') return ['NS', 'TBD'].includes(f.fixture.status.short);
      if (statusFilter === 'finished') return ['FT', 'AET', 'PEN'].includes(f.fixture.status.short);
      
      return true;
    });
  }, [fixtures, searchTerm, statusFilter]);

  const groupedByCountry = useMemo(() => {
    const countries: { [key: string]: { name: string; leagues: { [key: string]: { league: any; matches: any[] } } } } = {};
    
    filteredFixtures.forEach(f => {
      const countryName = f.league.country;
      if (!countries[countryName]) {
        countries[countryName] = { 
          name: countryName, 
          leagues: {} 
        };
      }
      
      const leagueKey = `${f.league.id}-${f.league.season}`;
      if (!countries[countryName].leagues[leagueKey]) {
        countries[countryName].leagues[leagueKey] = { league: f.league, matches: [] };
      }
      countries[countryName].leagues[leagueKey].matches.push(f);
    });
    
    return Object.values(countries)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(country => ({
        ...country,
        leagues: Object.values(country.leagues).sort((a, b) => a.league.name.localeCompare(b.league.name))
      }));
  }, [filteredFixtures]);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-black italic uppercase tracking-tighter flex items-center gap-3">
          <Activity className="text-orange-500" />
          Matchs du jour
        </h1>

        <div className="flex items-center bg-white/5 rounded-xl p-1 border border-white/10">
          <button 
            onClick={() => setSelectedDate(subDays(selectedDate, 1))}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="px-4 font-bold min-w-[140px] text-center">
            {isSameDay(selectedDate, new Date()) ? "Aujourd'hui" : format(selectedDate, 'dd/MM/yyyy')}
          </div>
          <button 
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input 
            type="text"
            placeholder="Rechercher une équipe ou ligue..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>

        <div className="flex gap-2">
          <FilterButton 
            active={statusFilter === 'all'} 
            onClick={() => setStatusFilter('all')}
            icon={<Clock className="w-4 h-4" />}
            label="Tous"
          />
          <FilterButton 
            active={statusFilter === 'live'} 
            onClick={() => setStatusFilter('live')}
            icon={<Activity className="w-4 h-4" />}
            label="Live"
            color="text-red-500"
          />
          <FilterButton 
            active={statusFilter === 'upcoming'} 
            onClick={() => setStatusFilter('upcoming')}
            icon={<Clock className="w-4 h-4" />}
            label="À venir"
          />
          <FilterButton 
            active={statusFilter === 'finished'} 
            onClick={() => setStatusFilter('finished')}
            icon={<CheckCircle className="w-4 h-4" />}
            label="Terminés"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-orange-500"></div>
          <p className="text-gray-500 font-bold animate-pulse">Chargement des matchs...</p>
        </div>
      ) : groupedByCountry.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 text-center">
          <Activity className="w-12 h-12 text-gray-700 mb-4" />
          <h3 className="text-xl font-bold">Aucun match trouvé</h3>
          <p className="text-gray-500">Essayez de changer de date ou de filtre.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedByCountry.map(country => (
            <CountrySection 
              key={country.name} 
              country={country} 
              onMatchClick={onMatchClick}
              onTeamClick={onTeamClick}
              onLeagueClick={onLeagueClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CountrySection({ country, onMatchClick, onTeamClick, onLeagueClick }: { country: any; onMatchClick: (id: number) => void; onTeamClick: (id: number, season: number) => void; onLeagueClick: (id: number, season: number) => void }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="space-y-2">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center text-xs font-bold text-gray-400 group-hover:text-white transition-colors">
            {country.name.substring(0, 2).toUpperCase()}
          </div>
          <h2 className="font-black italic uppercase tracking-wider text-sm">
            {country.name}
          </h2>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-white/10 rounded-full text-gray-400">
            {country.leagues.reduce((acc: number, l: any) => acc + l.matches.length, 0)}
          </span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 0 : -90 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight className="w-5 h-5 text-gray-500" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden space-y-4 pt-2 pl-4 border-l border-white/5"
          >
            {country.leagues.map((group: any) => (
              <div key={`${group.league.id}-${group.league.season}`} className="space-y-3">
                <button 
                  onClick={() => onLeagueClick(group.league.id, group.league.season)}
                  className="flex items-center gap-3 px-2 hover:text-orange-500 transition-colors group"
                >
                  <img src={group.league.logo} alt="" className="w-5 h-5 object-contain" referrerPolicy="no-referrer" />
                  <h3 className="font-bold italic uppercase text-[11px] tracking-widest text-gray-500 group-hover:text-orange-500 transition-colors">
                    {group.league.name}
                  </h3>
                </button>
                
                <div className="grid gap-2">
                  {group.matches.map((match: any) => (
                    <MatchCard 
                      key={match.fixture.id} 
                      match={match} 
                      onClick={() => onMatchClick(match.fixture.id)}
                      onTeamClick={onTeamClick}
                    />
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterButton({ active, onClick, icon, label, color = "text-white" }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; color?: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl border transition-all font-bold text-xs uppercase italic ${
        active 
          ? 'bg-orange-600 border-orange-500 text-white' 
          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
      }`}
    >
      <span className={active ? 'text-white' : color}>{icon}</span>
      {label}
    </button>
  );
}

function MatchCard({ match, onClick, onTeamClick }: { match: any; onClick: () => void; onTeamClick: (id: number, season: number) => void }) {
  const isLive = ['1H', '2H', 'HT', 'ET', 'P', 'BT'].includes(match.fixture.status.short);
  const isFinished = ['FT', 'AET', 'PEN'].includes(match.fixture.status.short);

  return (
    <Card 
      className="p-4 hover:bg-white/10 transition-colors group cursor-pointer"
    >
      <div className="flex items-center justify-between gap-4">
        {/* Home Team */}
        <div 
          className="flex-1 flex items-center justify-end gap-3 hover:text-orange-500 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onTeamClick(match.teams.home.id, match.league.season);
          }}
        >
          <span className="font-bold text-sm md:text-base text-right">{match.teams.home.name}</span>
          <img src={match.teams.home.logo} alt="" className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
        </div>

        {/* Score / Time */}
        <div 
          className="flex flex-col items-center min-w-[80px] px-2"
          onClick={onClick}
        >
          {isFinished || isLive ? (
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-black ${isLive ? 'text-orange-500' : ''}`}>
                {match.goals.home ?? 0}
              </span>
              <span className="text-gray-600">-</span>
              <span className={`text-2xl font-black ${isLive ? 'text-orange-500' : ''}`}>
                {match.goals.away ?? 0}
              </span>
            </div>
          ) : (
            <div className="text-xs font-bold text-white/80 bg-white/5 px-2 py-1 rounded border border-white/10">
              {format(new Date(match.fixture.date), 'dd/MM/yyyy HH:mm')}
            </div>
          )}
          
          <div className="mt-1">
            {isLive ? (
              <span className="flex items-center gap-1 text-[10px] font-black text-red-500 animate-pulse uppercase">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                {match.fixture.status.elapsed}'
              </span>
            ) : (
              <span className="text-[10px] font-bold text-gray-500 uppercase">
                {match.fixture.status.long}
              </span>
            )}
          </div>
        </div>

        {/* Away Team */}
        <div 
          className="flex-1 flex items-center gap-3 hover:text-orange-500 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onTeamClick(match.teams.away.id, match.league.season);
          }}
        >
          <img src={match.teams.away.logo} alt="" className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
          <span className="font-bold text-sm md:text-base">{match.teams.away.name}</span>
        </div>
      </div>
    </Card>
  );
}
