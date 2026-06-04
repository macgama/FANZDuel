import React, { useState, useEffect, useMemo } from 'react';
import { footballApi } from '../services/footballApi';
import { Card, Button } from './Layout';
import { ChevronLeft, ChevronRight, Search, Activity } from 'lucide-react';
import { format, addDays, subDays, isSameDay } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { SharedMatchCard } from './SharedMatchCard';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { translateCountryName, translateLeagueName } from '../utils/countryTranslations';
import { cn } from '../lib/utils';
import { UserProfile } from '../types';

export function MatchesPage({ onMatchClick, onJoinDuel, onTeamClick, onLeagueClick, profile }: { onMatchClick: (id: number, tab?: 'summary' | 'lineups' | 'stats' | 'duels') => void; onJoinDuel: (id: number, isLive: boolean) => void; onTeamClick: (id: number, season: number) => void; onLeagueClick: (id: number, season: number) => void; profile: UserProfile | null }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'upcoming' | 'finished'>('all');

  const [matchScores, setMatchScores] = useState<Record<string, { scoreA: number, scoreB: number }>>({});

  const fetchFixtures = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      let data;
      
      if (statusFilter === 'live' && isSameDay(selectedDate, new Date())) {
        data = await footballApi.getLiveFixtures();
        if (data && data.length > 0) {
          data = data.map((f: any) => ({
            ...f,
            events: f.events || undefined
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
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchFixtures();
    // Refresh matches every minute if date is today
    let interval: any;
    if (isSameDay(selectedDate, new Date())) {
      interval = setInterval(() => {
        fetchFixtures(true);
      }, 60000);
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
      }, (err: any) => {
        if (err?.code === 'permission-denied' || err?.message?.includes('Missing or insufficient permissions')) {
          console.warn("[MatchesPage] Scores listener permission denied, usually due to active sign-out.");
        } else {
          console.error("Error listening to scores on MatchesPage:", err);
        }
      });
      unsubs.push(unsub);
    }
    
    return () => unsubs.forEach(un => un());
  }, [fixtures]);

  const [activeLeagueIds, setActiveLeagueIds] = useState<number[]>([]);
  const [leaguesLoaded, setLeaguesLoaded] = useState<boolean>(false);

  useEffect(() => {
    const fetchActiveLeagues = async () => {
      try {
        const snapshot = await getDocs(query(collection(db, 'leagues'), where('isActive', '==', true)));
        const ids = snapshot.docs.map(doc => Number(doc.id));
        setActiveLeagueIds(ids);
      } catch (err) {
        console.error("Error fetching active leagues:", err);
      } finally {
        setLeaguesLoaded(true);
      }
    };
    fetchActiveLeagues();
  }, []);

  const filteredFixtures = useMemo(() => {
    const favoriteIds = profile?.favoriteTeams?.map(id => id.toString()) || [];
    
    return fixtures.filter(f => {
      // Only show matches from active leagues if there are active leagues defined.
      // Otherwise, show all to avoid an empty screen.
      if (activeLeagueIds.length > 0 && !activeLeagueIds.includes(f.league.id)) {
        return false;
      }

      const matchesSearch = 
        f.league.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.teams.home.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.teams.away.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      if (statusFilter === 'live') return true; // Already filtered by API
      if (statusFilter === 'upcoming') return ['NS', 'TBD'].includes(f.fixture.status.short);
      if (statusFilter === 'finished') return ['FT', 'AET', 'PEN'].includes(f.fixture.status.short);
      
      return true;
    }).sort((a, b) => {
      const aIsFav = favoriteIds.includes(a.teams.home.id.toString()) || favoriteIds.includes(a.teams.away.id.toString());
      const bIsFav = favoriteIds.includes(b.teams.home.id.toString()) || favoriteIds.includes(b.teams.away.id.toString());
      if (aIsFav && !bIsFav) return -1;
      if (!aIsFav && bIsFav) return 1;
      return 0;
    });
  }, [fixtures, searchTerm, statusFilter, profile?.favoriteTeams, activeLeagueIds]);

  // Enrich visible matches with events
  useEffect(() => {
    // We use events === undefined to know it hasn't been fetched yet.
    // If it's `null`, it means we tried and failed (or it has no events).
    const matchesToEnrich = filteredFixtures.filter(f => f.events === undefined && ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE', 'FT', 'AET', 'PEN'].includes(f.fixture.status.short));
    if (matchesToEnrich.length === 0) return;

    let isMounted = true;
    const fetchEnriched = async () => {
      const chunkSize = 20;
      // take max 40 to avoid API spam
      const limit = Math.min(matchesToEnrich.length, 40);
      for (let i = 0; i < limit; i += chunkSize) {
        if (!isMounted) break;
        const chunkIds = matchesToEnrich.slice(i, i + chunkSize).map(f => f.fixture.id);
        
        if (i > 0) {
          // Strict delay to respect 10 req/min API-Football limit
          await new Promise(r => setTimeout(r, 2000));
        }
        
        try {
          const enriched = await footballApi.getFixturesByIds(chunkIds);
          if (isMounted) {
            if (enriched && enriched.length > 0) {
              setFixtures(prev => prev.map(p => {
                if (chunkIds.includes(p.fixture.id)) {
                  const enrichedMatch = enriched.find((e: any) => e.fixture.id === p.fixture.id);
                  return { ...p, events: enrichedMatch?.events || [] };
                }
                return p;
              }));
            } else {
              // Rate limited or error: stop trying for now and mark as requested
              setFixtures(prev => prev.map(p => 
                chunkIds.includes(p.fixture.id) ? { ...p, events: null } : p
              ));
              break; 
            }
          }
        } catch (e: any) {
          if (e?.message !== 'Failed to fetch') {
            console.error('[MatchesPage] Failed to enrich chunk', e);
          }
          if (isMounted) {
            setFixtures(prev => prev.map(p => 
              chunkIds.includes(p.fixture.id) ? { ...p, events: null } : p
            ));
          }
        }
      }
    };
    fetchEnriched();
    return () => { isMounted = false; };
  }, [filteredFixtures]);

  const [activeDuels, setActiveDuels] = useState<any[]>([]);

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
      .sort((a, b) => translateCountryName(a.name).localeCompare(translateCountryName(b.name)))
      .map(country => ({
        ...country,
        leagues: Object.values(country.leagues).sort((a, b) => a.league.name.localeCompare(b.league.name))
      }));
  }, [filteredFixtures]);

  const liveMatches = useMemo(() => {
    const favoriteIds = profile?.favoriteTeams?.map(id => id.toString()) || [];
    return filteredFixtures.filter(f => ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE'].includes(f.fixture.status.short)).sort((a, b) => {
      const aIsFav = favoriteIds.includes(a.teams.home.id.toString()) || favoriteIds.includes(a.teams.away.id.toString());
      const bIsFav = favoriteIds.includes(b.teams.home.id.toString()) || favoriteIds.includes(b.teams.away.id.toString());
      if (aIsFav && !bIsFav) return -1;
      if (!aIsFav && bIsFav) return 1;
      const countryA = translateCountryName(a.league.country || '');
      const countryB = translateCountryName(b.league.country || '');
      return countryA.localeCompare(countryB);
    });
  }, [filteredFixtures, profile]);

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
        <div className="space-y-6 flex flex-col">
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
              profile={profile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CountrySection({ country, activeDuels, matchScores, onMatchClick, onJoinDuel, onTeamClick, onLeagueClick, profile }: { country: any; activeDuels: any[]; matchScores: any; onMatchClick: (id: number, tab?: 'summary' | 'lineups' | 'stats' | 'duels') => void; onJoinDuel: (id: number, isLive: boolean) => void; onTeamClick: (id: number, season: number) => void; onLeagueClick: (id: number, season: number) => void; profile: UserProfile | null }) {
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
                    <div className="flex flex-nowrap gap-4 px-4 py-2 w-fit items-stretch">
                      {group.matches.map((match: any) => (
                        <div key={match.fixture.id} className="snap-center shrink-0 flex items-stretch w-[85vw] sm:w-[360px] max-w-[calc(100vw-32px)]">
                          <SharedMatchCard 
                            match={match} 
                            hasActiveDuel={activeDuels.some(d => d.matchId === match.fixture.id)}
                            matchScore={matchScores[match.fixture.id.toString()]}
                            onClick={(tab) => onMatchClick(match.fixture.id, tab)}
                            onJoinDuel={(isLive) => onJoinDuel(match.fixture.id, isLive)}
                            onTeamClick={onTeamClick}
                            onLeagueClick={onLeagueClick}
                            profile={profile}
                            showLeagueHeader={true}
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


