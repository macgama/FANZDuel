import React, { useState, useEffect, useMemo } from 'react';
import { footballApi } from '../services/footballApi';
import { footballDataService } from '../services/footballDataService';
import { Card, Button } from './Layout';
import { Search, Users, Globe, ChevronRight, Trophy, ChevronDown, Flag, RefreshCw, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TeamDetails } from './TeamDetails';
import { format } from 'date-fns';

// Simple continent mapping helper
const getContinent = (country: string): string => {
  const mapping: Record<string, string[]> = {
    'Europe': ['France', 'England', 'Spain', 'Germany', 'Italy', 'Portugal', 'Netherlands', 'Belgium', 'Turkey', 'Greece', 'Scotland', 'Wales', 'Ireland', 'Switzerland', 'Austria', 'Denmark', 'Norway', 'Sweden', 'Poland', 'Ukraine', 'Russia', 'Croatia', 'Serbia', 'Czech-Republic', 'Hungary', 'Romania', 'Bulgaria'],
    'Amérique du Sud': ['Brazil', 'Argentina', 'Uruguay', 'Chile', 'Colombia', 'Ecuador', 'Peru', 'Paraguay', 'Bolivia', 'Venezuela'],
    'Amérique du Nord': ['USA', 'Mexico', 'Canada', 'Costa-Rica', 'Jamaica', 'Panama', 'Honduras', 'El-Salvador'],
    'Afrique': ['Egypt', 'Morocco', 'Senegal', 'Algeria', 'Tunisia', 'Nigeria', 'Cameroon', 'Ghana', 'Ivory-Coast', 'South-Africa'],
    'Asie': ['Japan', 'South-Korea', 'Saudi-Arabia', 'Qatar', 'UAE', 'China', 'Australia', 'Iran', 'Iraq', 'Uzbekistan'],
    'Monde': ['World']
  };

  for (const [continent, countries] of Object.entries(mapping)) {
    if (countries.includes(country)) return continent;
  }
  return 'Autres';
};

export function TeamsPage({ onTeamClick }: { onTeamClick: (id: number, season: number) => void }) {
  const [leagues, setLeagues] = useState<any[]>([]);
  const [teams, setTeams] = useState<Record<number, any[]>>({});
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loadingLeagues, setLoadingLeagues] = useState(true);
  const [refreshingLeagues, setRefreshingLeagues] = useState(false);
  const [lastUpdatedLeagues, setLastUpdatedLeagues] = useState<Date | null>(null);
  const [loadingTeams, setLoadingTeams] = useState<Record<number, boolean>>({});
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set());
  const [expandedLeagues, setExpandedLeagues] = useState<Set<number>>(new Set());

  const fetchLeagues = async (force = false) => {
    if (force) setRefreshingLeagues(true);
    else setLoadingLeagues(true);
    
    try {
      const data = await footballDataService.getLeagues(force);
      setLeagues(data);
      const updated = await footballDataService.getLastUpdated('leagues_list');
      setLastUpdatedLeagues(updated);
    } catch (err) {
      console.error('Failed to fetch leagues', err);
    } finally {
      setLoadingLeagues(false);
      setRefreshingLeagues(false);
    }
  };

  useEffect(() => {
    fetchLeagues();
  }, []);

  useEffect(() => {
    const search = async () => {
      if (searchTerm.length < 3) {
        setSearchResults([]);
        return;
      }
      
      setLoadingSearch(true);
      try {
        const data = await footballApi.searchTeams(searchTerm);
        setSearchResults(data);
      } catch (err) {
        console.error('Failed to search teams', err);
      } finally {
        setLoadingSearch(false);
      }
    };

    const timer = setTimeout(search, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchTeamsForLeague = async (leagueId: number, season: number, force = false) => {
    if (teams[leagueId] && !force) return;
    
    setLoadingTeams(prev => ({ ...prev, [leagueId]: true }));
    try {
      const data = await footballDataService.getTeams(leagueId, season, force);
      // Sort teams alphabetically by name
      const sortedTeams = [...data].sort((a: any, b: any) => 
        a.team.name.localeCompare(b.team.name)
      );
      setTeams(prev => ({ ...prev, [leagueId]: sortedTeams }));
    } catch (err) {
      console.error(`Failed to fetch teams for league ${leagueId}`, err);
    } finally {
      setLoadingTeams(prev => ({ ...prev, [leagueId]: false }));
    }
  };

  const handleRefreshLeagues = () => {
    fetchLeagues(true);
  };

  const toggleCountry = (country: string) => {
    const next = new Set(expandedCountries);
    if (next.has(country)) next.delete(country);
    else next.add(country);
    setExpandedCountries(next);
  };

  const toggleLeague = (leagueId: number, season: number) => {
    const next = new Set(expandedLeagues);
    if (next.has(leagueId)) {
      next.delete(leagueId);
    } else {
      next.add(leagueId);
      fetchTeamsForLeague(leagueId, season);
    }
    setExpandedLeagues(next);
  };

  const groupedLeagues = useMemo(() => {
    const continents: Record<string, Record<string, { flag: string; leagues: any[] }>> = {};
    
    leagues.forEach(l => {
      const continent = getContinent(l.country.name);
      const country = l.country.name;
      
      if (!continents[continent]) continents[continent] = {};
      if (!continents[continent][country]) {
        continents[continent][country] = { flag: l.country.flag, leagues: [] };
      }
      continents[continent][country].leagues.push(l);
    });

    // Sort leagues within each country alphabetically
    Object.values(continents).forEach(countries => {
      Object.values(countries).forEach(data => {
        data.leagues.sort((a, b) => a.league.name.localeCompare(b.league.name));
      });
    });

    return continents;
  }, [leagues]);

  const filteredContinents = useMemo(() => {
    // If there's a search term, we'll show search results instead of the grouped layout
    if (searchTerm.length >= 3) return {};

    let result = groupedLeagues;
    
    // Sort the final result:
    // 1. Sort continents alphabetically
    const sortedContinents = Object.keys(result).sort().reduce((acc, continent) => {
      // 2. Sort countries within continent alphabetically
      const countries = result[continent];
      const sortedCountries = Object.keys(countries).sort().reduce((cAcc, country) => {
        cAcc[country] = countries[country];
        return cAcc;
      }, {} as typeof countries);
      
      acc[continent] = sortedCountries;
      return acc;
    }, {} as typeof result);

    return sortedContinents;
  }, [groupedLeagues, searchTerm]);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black italic uppercase tracking-tighter flex items-center gap-2 sm:gap-3">
            <Users className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500" />
            Équipes
          </h1>
          {lastUpdatedLeagues && (
            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase italic tracking-widest">
              <Clock className="w-3 h-3" />
              Mis à jour le {format(lastUpdatedLeagues, 'dd/MM/yyyy HH:mm')}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefreshLeagues}
            disabled={refreshingLeagues || loadingLeagues}
            className="flex items-center gap-2 text-[10px] font-black uppercase italic tracking-widest h-10"
          >
            <RefreshCw className={`w-3 h-3 ${refreshingLeagues ? 'animate-spin' : ''}`} />
            {refreshingLeagues ? 'Mise à jour...' : 'Actualiser'}
          </Button>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input 
              type="text"
              placeholder="Rechercher une équipe..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs sm:text-sm focus:outline-none focus:border-orange-500 transition-colors h-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {loadingLeagues ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-orange-500"></div>
          <p className="text-gray-500 font-bold animate-pulse uppercase italic tracking-widest">Chargement des ligues...</p>
        </div>
      ) : searchTerm.length >= 3 ? (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-white/10" />
            <h2 className="text-xl font-black italic uppercase tracking-widest text-orange-500/50">
              Résultats de recherche
            </h2>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {loadingSearch ? (
            <div className="flex items-center gap-3 text-gray-500 py-10 justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-orange-500"></div>
              <span className="text-sm font-bold uppercase italic">Recherche en cours...</span>
            </div>
          ) : searchResults.length === 0 ? (
            <Card className="py-20 text-center text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="font-bold uppercase italic tracking-widest">Aucune équipe trouvée pour "{searchTerm}".</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {searchResults.map((item) => (
                <Card 
                  key={item.team.id} 
                  className="flex flex-col items-center gap-4 p-6 hover:border-orange-500/50 transition-all group cursor-pointer"
                  onClick={() => onTeamClick(item.team.id, footballDataService.getCurrentSeasonYear())}
                >
                  <div className="w-24 h-24 bg-white/5 rounded-2xl p-4 flex items-center justify-center group-hover:bg-orange-500/10 transition-colors">
                    <img src={item.team.logo} alt="" className="w-full h-full object-contain" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-black italic uppercase text-sm tracking-widest group-hover:text-orange-500 transition-colors">{item.team.name}</h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">{item.venue.city}</p>
                  </div>
                  <div className="w-full pt-4 border-t border-white/5 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-gray-500">
                      <Trophy className="w-3 h-3" />
                      <span className="text-[10px] font-bold uppercase truncate">{item.team.country}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                      <Globe className="w-3 h-3" />
                      <span className="text-[10px] font-bold uppercase truncate">{item.venue.name}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : Object.keys(filteredContinents).length === 0 ? (
        <Card className="py-20 text-center text-gray-500">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="font-bold uppercase italic tracking-widest">Aucune équipe ou ligue trouvée.</p>
        </Card>
      ) : (
        <div className="space-y-12">
          {Object.entries(filteredContinents).map(([continent, countries]) => (
            <div key={continent} className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-white/10" />
                <h2 className="text-xl font-black italic uppercase tracking-widest text-orange-500/50">
                  {continent}
                </h2>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div className="space-y-4">
                {Object.entries(countries).map(([country, data]) => (
                  <div key={country} className="space-y-2">
                    <button 
                      onClick={() => toggleCountry(country)}
                      className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all"
                    >
                      <div className="flex items-center gap-4">
                        {data.flag ? (
                          <img src={data.flag} alt="" className="w-8 h-6 object-cover rounded shadow-lg" />
                        ) : (
                          <Globe className="w-6 h-6 text-gray-500" />
                        )}
                        <span className="font-black italic uppercase tracking-tighter text-lg">{country}</span>
                      </div>
                      <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${expandedCountries.has(country) ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {expandedCountries.has(country) && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden pl-4 space-y-2"
                        >
                          {data.leagues.map(l => {
                            const latestSeason = l.seasons?.sort((a: any, b: any) => b.year - a.year)[0]?.year || footballDataService.getCurrentSeasonYear();
                            return (
                              <div key={l.league.id} className="space-y-2">
                                <button 
                                  onClick={() => toggleLeague(l.league.id, latestSeason)}
                                  className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition-all"
                                >
                                  <div className="flex items-center gap-3">
                                    <img src={l.league.logo} alt="" className="w-6 h-6 object-contain" />
                                    <span className="font-bold text-sm">{l.league.name}</span>
                                    <span className="text-[10px] bg-orange-500/20 text-orange-500 px-1.5 py-0.5 rounded font-black italic">
                                      {latestSeason}
                                    </span>
                                  </div>
                                  <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${expandedLeagues.has(l.league.id) ? 'rotate-180' : ''}`} />
                                </button>

                                <AnimatePresence>
                                  {expandedLeagues.has(l.league.id) && (
                                    <motion.div 
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden py-4"
                                    >
                                      {loadingTeams[l.league.id] ? (
                                        <div className="flex items-center gap-3 text-gray-500 py-4">
                                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-orange-500"></div>
                                          <span className="text-xs font-bold uppercase italic">Chargement des équipes...</span>
                                        </div>
                                      ) : teams[l.league.id]?.length === 0 ? (
                                        <p className="text-xs text-gray-500 italic py-4">Aucune équipe trouvée.</p>
                                      ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                          {teams[l.league.id]?.map((t: any) => (
                                            <Card 
                                              key={t.team.id} 
                                              className="flex flex-col items-center gap-3 p-4 hover:border-orange-500/50 transition-all group cursor-pointer"
                                              onClick={() => onTeamClick(t.team.id, latestSeason)}
                                            >
                                              <div className="w-16 h-16 bg-white/5 rounded-xl p-3 flex items-center justify-center group-hover:bg-orange-500/10 transition-colors">
                                                <img src={t.team.logo} alt="" className="w-full h-full object-contain" />
                                              </div>
                                              <div className="text-center">
                                                <h3 className="font-black italic uppercase text-[11px] tracking-widest group-hover:text-orange-500 transition-colors leading-tight">{t.team.name}</h3>
                                                <p className="text-[9px] text-gray-500 font-bold uppercase mt-1">{t.venue.city}</p>
                                              </div>
                                            </Card>
                                          ))}
                                        </div>
                                      )}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
