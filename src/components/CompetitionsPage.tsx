import React, { useState, useEffect, useMemo } from 'react';
import { footballApi } from '../services/footballApi';
import { footballDataService } from '../services/footballDataService';
import { Card, Button } from './Layout';
import { Search, Trophy, Globe, ChevronRight, History, ChevronDown, RefreshCw, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LeagueDetails } from './LeagueDetails';
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

export function CompetitionsPage({ onLeagueClick }: { onLeagueClick: (id: number, season: number) => void }) {
  const [leagues, setLeagues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set());

  const fetchLeagues = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    
    try {
      const data = await footballDataService.getLeagues(force);
      setLeagues(data);
      const updated = await footballDataService.getLastUpdated('leagues_list');
      setLastUpdated(updated);
    } catch (err) {
      console.error('Failed to fetch leagues', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeagues();
  }, []);

  const handleRefresh = () => {
    fetchLeagues(true);
  };

  const toggleCountry = (country: string) => {
    const next = new Set(expandedCountries);
    if (next.has(country)) next.delete(country);
    else next.add(country);
    setExpandedCountries(next);
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
    let result = groupedLeagues;
    
    if (searchTerm) {
      const filtered: typeof groupedLeagues = {};
      const lowerSearch = searchTerm.toLowerCase();

      Object.entries(groupedLeagues).forEach(([continent, countries]) => {
        const filteredCountries: typeof countries = {};
        Object.entries(countries).forEach(([country, data]) => {
          const matchesCountry = country.toLowerCase().includes(lowerSearch);
          const matchingLeagues = data.leagues.filter(l => l.league.name.toLowerCase().includes(lowerSearch));
          
          if (matchesCountry || matchingLeagues.length > 0) {
            filteredCountries[country] = {
              ...data,
              leagues: matchesCountry ? data.leagues : matchingLeagues
            };
          }
        });

        if (Object.keys(filteredCountries).length > 0) {
          filtered[continent] = filteredCountries;
        }
      });
      result = filtered;
    }

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
            <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500" />
            Compétitions
          </h1>
          {lastUpdated && (
            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase italic tracking-widest">
              <Clock className="w-3 h-3" />
              Mis à jour le {format(lastUpdated, 'dd/MM/yyyy HH:mm')}
            </div>
          )}
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

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input 
              type="text"
              placeholder="Rechercher une compétition..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs sm:text-sm focus:outline-none focus:border-orange-500 transition-colors h-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-orange-500"></div>
          <p className="text-gray-500 font-bold animate-pulse uppercase italic tracking-widest">Chargement des compétitions...</p>
        </div>
      ) : Object.keys(filteredContinents).length === 0 ? (
        <Card className="py-20 text-center text-gray-500">
          <Globe className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="font-bold uppercase italic tracking-widest">Aucune compétition trouvée.</p>
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
                          className="overflow-hidden pl-4 py-4"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {data.leagues.map(l => {
                              const latestSeason = l.seasons?.sort((a: any, b: any) => b.year - a.year)[0]?.year || footballDataService.getCurrentSeasonYear();
                              return (
                                <Card 
                                  key={l.league.id} 
                                  className="group cursor-pointer hover:border-orange-500/50 transition-all"
                                  onClick={() => onLeagueClick(l.league.id, latestSeason)}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                      <div className="w-12 h-12 bg-white/5 rounded-xl p-2 flex items-center justify-center group-hover:bg-orange-500/10 transition-colors">
                                        <img src={l.league.logo} alt="" className="w-full h-full object-contain" />
                                      </div>
                                      <div>
                                        <h3 className="font-bold text-sm group-hover:text-orange-500 transition-colors">{l.league.name}</h3>
                                        <div className="flex items-center gap-2">
                                          <p className="text-[10px] text-gray-500 uppercase font-bold">{l.league.type}</p>
                                          <span className="text-[10px] bg-orange-500/20 text-orange-500 px-1.5 py-0.5 rounded font-black italic">
                                            {latestSeason}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-orange-500 transition-colors" />
                                  </div>
                                </Card>
                              );
                            })}
                          </div>
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
