import React, { useState, useEffect, useMemo } from 'react';
import { footballApi } from '../services/footballApi';
import { Card, Button } from './Layout';
import { Search, Calendar as CalendarIcon, Activity, Clock, CheckCircle, ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import { format, addDays, subDays, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { MatchDetails } from './MatchDetails';
import { MatchEvents } from './MatchEvents';
import { db } from '../firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { translateCountryName, translateLeagueName } from '../utils/countryTranslations';

export function MatchesPage({ onMatchClick, onJoinDuel, onTeamClick, onLeagueClick }: { onMatchClick: (id: number, tab?: 'summary' | 'lineups' | 'stats' | 'duels') => void; onJoinDuel: (id: number, isLive: boolean) => void; onTeamClick: (id: number, season: number) => void; onLeagueClick: (id: number, season: number) => void }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'upcoming' | 'finished'>('all');

  const [matchScores, setMatchScores] = useState<Record<string, { scoreA: number, scoreB: number }>>({});

  const fetchFixtures = async () => {
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      let data;
      
      if (statusFilter === 'live' && isSameDay(selectedDate, new Date())) {
        data = await footballApi.getLiveFixtures();
        // Fetch events for live matches to get scorers
        if (data && data.length > 0) {
          const liveEvents = await Promise.all(
            data.slice(0, 10).map((f: any) => footballApi.getFixtureEvents(f.fixture.id).catch(() => []))
          );
          data = data.map((f: any, i: number) => ({
            ...f,
            events: liveEvents[i] || []
          }));
        }
      } else {
        data = await footballApi.getFixturesByDate(dateStr);
      }
      
      if (statusFilter === 'live') {
        data = data.filter((f: any) => ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE'].includes(f.fixture.status.short));
      }
      setFixtures(data || []);
    } catch (err: any) {
      if (err?.message !== 'Failed to fetch') {
        console.error('Failed to fetch fixtures', err);
      }
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

  useEffect(() => {
    if (fixtures.length === 0) return;
    
    const matchIds = fixtures.map((f: any) => f.fixture.id.toString());
    const unsubs: (() => void)[] = [];
    const chunkSize = 10;
    
    for (let i = 0; i < matchIds.length; i += chunkSize) {
      const chunk = matchIds.slice(i, i + chunkSize);
      const q = query(collection(db, 'match_scores'), where('matchId', 'in', chunk));
      
      const unsub = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          console.log(`[MatchesPage] Received ${snapshot.size} scores for chunk starting with ${chunk[0]}`);
        }
        setMatchScores(prev => {
          const newMap = { ...prev };
          // Reset chunk IDs to avoid double accumulation
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
      }, (err) => {
        console.error('Error listening to scores on MatchesPage', err);
      });
      unsubs.push(unsub);
    }
    
    return () => unsubs.forEach(un => un());
  }, [fixtures]);

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

  const [activeDuels, setActiveDuels] = useState<any[]>([]);

  useEffect(() => {
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
    const interval = setInterval(fetchActiveDuels, 5000);
    return () => clearInterval(interval);
  }, []);

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
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between px-4">
          <h1 className="text-lg sm:text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
            Matchs du jour
          </h1>

          <div className="flex items-center bg-white/5 rounded-xl p-1 border border-white/10 text-sm">
            <button 
              onClick={() => setSelectedDate(subDays(selectedDate, 1))}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-2 font-bold min-w-[100px] text-center">
              {isSameDay(selectedDate, new Date()) ? "Aujourd'hui" : format(selectedDate, 'dd/MM/yyyy')}
            </div>
            <button 
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar px-4">
            <FilterButton 
              active={statusFilter === 'all'} 
              onClick={() => setStatusFilter('all')}
              label="Tous"
            />
            <FilterButton 
              active={statusFilter === 'live'} 
              onClick={() => setStatusFilter('live')}
              label="Live"
              color="text-red-500"
            />
            <FilterButton 
              active={statusFilter === 'upcoming'} 
              onClick={() => setStatusFilter('upcoming')}
              label="À venir"
            />
            <FilterButton 
              active={statusFilter === 'finished'} 
              onClick={() => setStatusFilter('finished')}
              label="Terminés"
            />
          </div>

          <div className="relative flex-1 px-4">
            <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input 
              type="text"
              placeholder="Rechercher une équipe ou une compétition..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-4 focus:outline-none focus:border-orange-500 transition-colors text-sm"
            />
          </div>
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
              activeDuels={activeDuels}
              matchScores={matchScores}
              onMatchClick={onMatchClick}
              onJoinDuel={onJoinDuel}
              onTeamClick={onTeamClick}
              onLeagueClick={onLeagueClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CountrySection({ country, activeDuels, matchScores, onMatchClick, onJoinDuel, onTeamClick, onLeagueClick }: { country: any; activeDuels: any[]; matchScores: any; onMatchClick: (id: number, tab?: 'summary' | 'lineups' | 'stats' | 'duels') => void; onJoinDuel: (id: number, isLive: boolean) => void; onTeamClick: (id: number, season: number) => void; onLeagueClick: (id: number, season: number) => void }) {
  const [isOpen, setIsOpen] = useState(true);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -scrollContainerRef.current.clientWidth : scrollContainerRef.current.clientWidth;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-2 max-w-[420px] mx-auto w-full px-4">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors group"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-gray-800 rounded-full flex items-center justify-center text-[10px] font-bold text-gray-400 group-hover:text-white transition-colors">
            {country.name.substring(0, 2).toUpperCase()}
          </div>
          <h2 className="font-black italic uppercase tracking-wider text-[11px] sm:text-xs">
            {translateCountryName(country.name)}
          </h2>
          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-white/10 rounded-full text-gray-400">
            {country.leagues.reduce((acc: number, l: any) => acc + l.matches.length, 0)}
          </span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 0 : -90 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight className="w-4 h-4 text-gray-500" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden space-y-3 pt-1"
          >
            {country.leagues.map((group: any) => (
              <div key={`${group.league.id}-${group.league.season}`} className="space-y-2 relative">
                <button 
                  onClick={() => onLeagueClick(group.league.id, group.league.season)}
                  className="flex items-center gap-2 hover:text-orange-500 transition-colors group px-1"
                >
                  <img src={group.league.logo} alt="" className="w-4 h-4 object-contain" />
                  <h3 className="font-bold italic uppercase text-[9px] sm:text-[10px] tracking-widest text-gray-500 group-hover:text-orange-500 transition-colors">
                    {translateLeagueName(group.league.name)}
                  </h3>
                </button>
                
                <div className="relative group/scroll">
                  {group.matches.length > 1 && (
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
                    <div className="flex flex-nowrap gap-4 w-fit px-0.5">
                      {group.matches.map((match: any) => (
                        <div key={match.fixture.id} className="snap-center shrink-0 w-[calc(100vw-60px)] sm:w-[400px]">
                          <MatchCard 
                            match={match} 
                            hasActiveDuel={activeDuels.some(d => d.matchId === match.fixture.id)}
                            matchScore={matchScores[match.fixture.id.toString()]}
                            onClick={(tab) => onMatchClick(match.fixture.id, tab)}
                            onJoinDuel={(isLive) => onJoinDuel(match.fixture.id, isLive)}
                            onTeamClick={onTeamClick}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterButton({ active, onClick, label, color = "text-white" }: { active: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex-1 flex items-center justify-center px-3 py-2.5 sm:py-3 rounded-xl border transition-all font-bold text-[10px] sm:text-xs uppercase italic min-w-[80px] ${
        active 
          ? 'bg-orange-600 border-orange-500 text-white' 
          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
      }`}
    >
      <span className={active ? 'text-white' : color}>{label}</span>
    </button>
  );
}

function MatchCard({ match, hasActiveDuel, matchScore, onClick, onJoinDuel, onTeamClick }: { match: any; hasActiveDuel: boolean; matchScore?: { scoreA: number, scoreB: number }; onClick: (tab?: 'summary' | 'lineups' | 'stats' | 'duels') => void; onJoinDuel: (isLive: boolean) => void; onTeamClick: (id: number, season: number) => void }) {
  const isLive = ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE'].includes(match.fixture.status.short);
  const isUpcoming = ['TBD', 'NS'].includes(match.fixture.status.short);
  const isFinished = !isLive && !isUpcoming;

  // Extract scorers
  const scorers = match.events?.filter((e: any) => e.type?.toLowerCase() === 'goal') || [];

  const scoreA = matchScore?.scoreA || 0;
  const scoreB = matchScore?.scoreB || 0;
  const totalScore = scoreA + scoreB;
  let dominanceA = 50;
  let dominanceB = 50;
  if (totalScore > 0) {
    dominanceA = Math.round((scoreA / totalScore) * 100);
    dominanceB = 100 - dominanceA;
  }

  return (
    <Card 
      className="p-4 hover:bg-white/10 transition-colors group cursor-pointer bg-[#1a1a1a]/80 backdrop-blur-xl border border-white/10 rounded-2xl"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          {/* Home Team */}
          <div 
            className="flex-1 flex flex-col items-center gap-2 hover:text-orange-500 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onTeamClick(match.teams.home.id, match.league.season);
            }}
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-full p-1.5 flex items-center justify-center">
              <img src={match.teams.home.logo} alt="" className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
            </div>
            <span className="font-black text-xs sm:text-sm text-center uppercase leading-tight w-full">{match.teams.home.name}</span>
            {(isLive || isFinished) && (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-full px-2.5 py-1 flex items-center gap-1 mt-1">
                <Flame className="w-3 h-3 text-orange-500" />
                <span className="text-[10px] sm:text-xs font-black text-orange-500">{scoreA} PTS</span>
              </div>
            )}
          </div>

          {/* Score / Time */}
          <div 
            className="flex flex-col items-center min-w-[90px] px-2"
            onClick={() => onClick()}
          >
            {isFinished || isLive ? (
              <div className="flex items-center gap-2">
                <span className={`text-3xl sm:text-4xl font-black ${isLive ? 'text-orange-500' : ''}`}>
                  {match.goals.home ?? 0}
                </span>
                <span className="text-orange-500 font-black text-2xl">:</span>
                <span className={`text-3xl sm:text-4xl font-black ${isLive ? 'text-orange-500' : ''}`}>
                  {match.goals.away ?? 0}
                </span>
              </div>
            ) : (
              <div className="text-xs sm:text-sm font-bold text-white/80 bg-white/5 px-3 py-1.5 rounded border border-white/10">
                {format(new Date(match.fixture.date), 'HH:mm')}
              </div>
            )}
            
            <div className="mt-2">
              {isLive ? (
                <div className="bg-orange-500/20 border border-orange-500/30 rounded-full px-3 py-1 flex items-center justify-center">
                  <span className="text-[10px] sm:text-xs font-black text-orange-500 animate-pulse uppercase">
                    {match.fixture.status.elapsed}{match.fixture.status.extra ? `+${match.fixture.status.extra}` : ''}'
                  </span>
                </div>
              ) : (
                <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase">
                  {match.fixture.status.short}
                </span>
              )}
            </div>
          </div>

          {/* Away Team */}
          <div 
            className="flex-1 flex flex-col items-center gap-2 hover:text-orange-500 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onTeamClick(match.teams.away.id, match.league.season);
            }}
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-transparent flex items-center justify-center">
              <img src={match.teams.away.logo} alt="" className="w-10 h-10 sm:w-12 sm:h-12 object-contain" />
            </div>
            <span className="font-black text-xs sm:text-sm text-center uppercase leading-tight w-full">{match.teams.away.name}</span>
            {(isLive || isFinished) && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-full px-2.5 py-1 flex items-center gap-1 mt-1">
                <Flame className="w-3 h-3 text-blue-500" />
                <span className="text-[10px] sm:text-xs font-black text-blue-500">{scoreB} PTS</span>
              </div>
            )}
          </div>
        </div>

        {/* Dominance Bar (Live or Finished) */}
        {(isLive || isFinished) && (
          <div className="mt-2">
            <div className="flex justify-between items-center text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
              <span className="text-orange-500">{dominanceA}%</span>
              <span>DOMINANCE MONDIALE</span>
              <span className="text-blue-500">{dominanceB}%</span>
            </div>
            <div className="h-1.5 sm:h-2 w-full bg-black/60 rounded-full overflow-hidden flex relative">
              <div className="h-full bg-orange-500 transition-all duration-500" style={{ width: `${dominanceA}%` }} />
              <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${dominanceB}%` }} />
              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/50 -translate-x-1/2 z-10"></div>
            </div>
          </div>
        )}

        {/* External Events Component removed to prevent huge height in MatchCards */}
        
        {isLive && (
          <div className="mt-2 flex gap-2 sm:gap-3">
            <button 
              onClick={(e) => { e.stopPropagation(); onClick(); }}
              className="flex-1 py-2 sm:py-2.5 rounded-xl border border-white/20 bg-white/5 text-white font-black text-[10px] sm:text-xs uppercase tracking-wider hover:bg-white/10 transition-colors"
            >
              MATCH
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onJoinDuel(isLive); }}
              className="flex-1 py-2 sm:py-2.5 rounded-xl bg-orange-500 text-white font-black text-[10px] sm:text-xs uppercase tracking-wider hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
            >
              {hasActiveDuel ? (
                <>
                  <Activity className="w-3 h-3 sm:w-4 sm:h-4 animate-pulse" />
                  REJOINDRE
                </>
              ) : (
                'CRÉER UN DUEL'
              )}
            </button>
          </div>
        )}

        {isFinished && (
          <div className="mt-2 flex gap-2 sm:gap-3">
            <button 
              onClick={(e) => { e.stopPropagation(); onClick('duels'); }}
              className="flex-1 py-2 sm:py-2.5 rounded-xl bg-white/10 text-white font-black text-[10px] sm:text-xs uppercase tracking-wider hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
            >
              RÉSUMÉ
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
