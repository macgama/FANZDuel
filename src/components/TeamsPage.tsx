import React, { useState, useEffect, useMemo } from 'react';
import { footballApi } from '../services/footballApi';
import { footballDataService } from '../services/footballDataService';
import { Card, Button } from './Layout';
import { Search, Users, Globe, ChevronRight, Trophy, ChevronDown, Flag, RefreshCw, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TeamDetails } from './TeamDetails';
import { format } from 'date-fns';
import { translateCountryName, translateLeagueName } from '../utils/countryTranslations';

// Simple continent mapping helper
const getContinent = (country: string): string => {
  const europe = ['Albania', 'Andorra', 'Armenia', 'Austria', 'Azerbaijan', 'Belarus', 'Belgium', 'Bosnia & Herzegovina', 'Bosnia and Herzegovina', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Czech-Republic', 'Czechia', 'Denmark', 'Estonia', 'Faroe-Islands', 'Finland', 'France', 'Georgia', 'Germany', 'Gibraltar', 'Greece', 'Hungary', 'Iceland', 'Ireland', 'Republic of Ireland', 'Israel', 'Italy', 'Kazakhstan', 'Kosovo', 'Latvia', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Malta', 'Moldova', 'Monaco', 'Montenegro', 'Netherlands', 'Northern Ireland', 'Northern-Ireland', 'Norway', 'Poland', 'Portugal', 'Romania', 'Russia', 'San Marino', 'San-Marino', 'Scotland', 'Serbia', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Switzerland', 'Turkey', 'Ukraine', 'Wales', 'United Kingdom', 'England', 'Macedonia', 'North Macedonia', 'North-Macedonia'];
  
  const southAmerica = ['Argentina', 'Bolivia', 'Brazil', 'Chile', 'Colombia', 'Ecuador', 'Paraguay', 'Peru', 'Uruguay', 'Venezuela', 'Suriname', 'Guyana'];
  
  const northAmerica = ['Antigua and Barbuda', 'Bahamas', 'Barbados', 'Belize', 'Canada', 'Costa Rica', 'Costa-Rica', 'Cuba', 'Dominica', 'Dominican Republic', 'Dominican-Republic', 'El Salvador', 'El-Salvador', 'Grenada', 'Guatemala', 'Haiti', 'Honduras', 'Jamaica', 'Mexico', 'Nicaragua', 'Panama', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines', 'Trinidad and Tobago', 'Trinidad-And-Tobago', 'United States', 'USA'];
  
  const africa = ['Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burkina-Faso', 'Burundi', 'Cabo Verde', 'Cabo-Verde', 'Cameroon', 'Central African Republic', 'Central-African-Republic', 'Chad', 'Comoros', 'Congo', 'Congo-DR', 'Congo DR', 'Djibouti', 'Egypt', 'Equatorial Guinea', 'Equatorial-Guinea', 'Eritrea', 'Eswatini', 'Ethiopia', 'Gabon', 'Gambia', 'Ghana', 'Guinea', 'Guinea-Bissau', 'Ivory Coast', 'Ivory-Coast', "Cote d'Ivoire", 'Kenya', 'Lesotho', 'Liberia', 'Libya', 'Madagascar', 'Malawi', 'Mali', 'Mauritania', 'Mauritius', 'Morocco', 'Mozambique', 'Namibia', 'Niger', 'Nigeria', 'Rwanda', 'Sao Tome and Principe', 'Senegal', 'Seychelles', 'Sierra Leone', 'Sierra-Leone', 'Somalia', 'South Africa', 'South-Africa', 'South Sudan', 'Sudan', 'Tanzania', 'Togo', 'Tunisia', 'Uganda', 'Zambia', 'Zimbabwe'];
  
  const asia = ['Afghanistan', 'Bahrain', 'Bangladesh', 'Bhutan', 'Brunei', 'Cambodia', 'China', 'India', 'Indonesia', 'Iran', 'Iraq', 'Japan', 'Jordan', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Lebanon', 'Malaysia', 'Maldives', 'Mongolia', 'Myanmar', 'Nepal', 'North Korea', 'North-Korea', 'Oman', 'Pakistan', 'Palestine', 'Philippines', 'Qatar', 'Saudi Arabia', 'Saudi-Arabia', 'Singapore', 'South Korea', 'South-Korea', 'Sri Lanka', 'Syria', 'Taiwan', 'Tajikistan', 'Thailand', 'Timor-Leste', 'Turkmenistan', 'United Arab Emirates', 'United-Arab-Emirates', 'Uzbekistan', 'Vietnam', 'Yemen', 'Macao', 'Hong-Kong'];

  const oceania = ['Australia', 'Fiji', 'Kiribati', 'Marshall Islands', 'Micronesia', 'Nauru', 'New Zealand', 'New-Zealand', 'Palau', 'Papua New Guinea', 'Papua-New-Guinea', 'Samoa', 'Solomon Islands', 'Tonga', 'Tuvalu', 'Vanuatu', 'Tahiti', 'New-Caledonia'];

  if (europe.includes(country)) return 'Europe';
  if (southAmerica.includes(country)) return 'Amérique du Sud';
  if (northAmerica.includes(country)) return 'Amérique du Nord';
  if (africa.includes(country)) return 'Afrique';
  if (asia.includes(country)) return 'Asie';
  if (oceania.includes(country)) return 'Océanie';
  if (country === 'World') return 'Monde';

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
      // Translate the country name immediately for sorting and display
      const country = translateCountryName(l.country.name);
      
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
    <div className="space-y-2 pb-20">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-500" />
            <h1 className="text-lg font-black italic uppercase tracking-tighter text-white">Équipes</h1>
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefreshLeagues}
            disabled={refreshingLeagues || loadingLeagues}
            className="flex items-center gap-1 text-[8px] font-black uppercase italic tracking-widest h-7 px-1.5"
          >
            <RefreshCw className={`w-2 h-2 ${refreshingLeagues ? 'animate-spin' : ''}`} />
            {refreshingLeagues ? '...' : 'Actualiser'}
          </Button>
        </div>

        {lastUpdatedLeagues && (
          <div className="flex items-center gap-1 text-[7px] font-bold text-gray-500 uppercase italic tracking-widest">
            <Clock className="w-2 h-2" />
            Mis à jour le {format(lastUpdatedLeagues, 'dd/MM HH:mm')}
          </div>
        )}
        
        <div className="relative w-full group">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 group-focus-within:text-orange-500 transition-colors" />
          <input 
            type="text"
            placeholder="Rechercher une équipe..."
            className="w-full bg-white/5 border border-white/10 rounded-lg py-1.5 pl-8 pr-3 text-[10px] font-bold focus:outline-none focus:border-orange-500/50 transition-all h-8 placeholder:text-gray-600"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loadingLeagues ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-orange-500"></div>
          <p className="text-gray-500 font-bold animate-pulse uppercase italic tracking-widest">Chargement des ligues...</p>
        </div>
      ) : searchTerm.length >= 3 ? (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <h2 className="text-sm font-black italic uppercase tracking-widest text-orange-500/50">
              Résultats de recherche
            </h2>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {loadingSearch ? (
            <div className="flex items-center gap-2 text-gray-500 py-10 justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-orange-500"></div>
              <span className="text-xs font-bold uppercase italic">Recherche en cours...</span>
            </div>
          ) : searchResults.length === 0 ? (
            <Card className="py-20 text-center text-gray-500">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-xs font-bold uppercase italic tracking-widest">Aucune équipe trouvée pour "{searchTerm}".</p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {searchResults.map((item) => (
                <Card 
                  key={item.team.id} 
                  className="flex flex-col items-center gap-1.5 p-2 hover:border-orange-500/50 transition-all group cursor-pointer"
                  onClick={() => onTeamClick(item.team.id, footballDataService.getCurrentSeasonYear())}
                >
                  <div className="w-12 h-12 bg-white/5 rounded-lg p-2 flex items-center justify-center group-hover:bg-orange-500/10 transition-colors">
                    <img src={item.team.logo} alt="" className="w-full h-full object-contain" />
                  </div>
                  <div className="text-center min-w-0 w-full">
                    <h3 className="font-black italic uppercase text-[9px] tracking-widest group-hover:text-orange-500 transition-colors truncate leading-tight">{translateCountryName(item.team.name)}</h3>
                    <p className="text-[7px] text-gray-500 font-bold uppercase mt-0.5 truncate">{item.venue.city}</p>
                  </div>
                  <div className="w-full pt-1.5 border-t border-white/5 flex flex-col gap-0.5">
                    <div className="flex items-center gap-1 text-gray-500">
                      <Trophy className="w-2 h-2" />
                      <span className="text-[7px] font-bold uppercase truncate">{translateCountryName(item.team.country)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-500">
                      <Globe className="w-2 h-2" />
                      <span className="text-[7px] font-bold uppercase truncate">{item.venue.name}</span>
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
        <div className="space-y-6">
          {Object.entries(filteredContinents).map(([continent, countries]) => (
            <div key={continent} className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <h2 className="text-xs font-black italic uppercase tracking-[0.2em] text-orange-500 flex items-center gap-3 whitespace-nowrap">
                  {continent}
                  <span className="h-px flex-1 bg-orange-500/20" />
                </h2>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div className="space-y-2">
                {Object.entries(countries).map(([country, data]) => (
                  <div key={country} className="space-y-1.5">
                    <button 
                      onClick={() => toggleCountry(country)}
                      className="w-full flex items-center justify-between p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
                    >
                      <div className="flex items-center gap-3">
                        {data.flag ? (
                          <img src={data.flag} alt="" className="w-6 h-4 object-cover rounded-sm shadow-sm" />
                        ) : (
                          <Globe className="w-4 h-4 text-gray-500" />
                        )}
                        <span className="font-black italic uppercase tracking-tight text-xs group-hover:text-orange-500 transition-colors">{country}</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${expandedCountries.has(country) ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {expandedCountries.has(country) && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden pl-2 space-y-1.5"
                        >
                          {data.leagues.map(l => {
                            const latestSeason = l.seasons?.sort((a: any, b: any) => b.year - a.year)[0]?.year || footballDataService.getCurrentSeasonYear();
                            return (
                              <div key={l.league.id} className="space-y-1.5">
                                <button 
                                  onClick={() => toggleLeague(l.league.id, latestSeason)}
                                  className="w-full flex items-center justify-between p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg transition-all"
                                >
                                  <div className="flex items-center gap-2">
                                    <img src={l.league.logo} alt="" className="w-5 h-5 object-contain" />
                                    <span className="font-bold text-xs">{translateLeagueName(l.league.name)}</span>
                                    <span className="text-[8px] bg-orange-500/20 text-orange-500 px-1 py-0.5 rounded font-black italic">
                                      {latestSeason}
                                    </span>
                                  </div>
                                  <ChevronDown className={`w-3.5 h-3.5 text-gray-600 transition-transform ${expandedLeagues.has(l.league.id) ? 'rotate-180' : ''}`} />
                                </button>

                                <AnimatePresence>
                                  {expandedLeagues.has(l.league.id) && (
                                    <motion.div 
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden py-2"
                                    >
                                      {loadingTeams[l.league.id] ? (
                                        <div className="flex items-center gap-2 text-gray-500 py-2">
                                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-orange-500"></div>
                                          <span className="text-[10px] font-bold uppercase italic">Chargement...</span>
                                        </div>
                                      ) : teams[l.league.id]?.length === 0 ? (
                                        <p className="text-[10px] text-gray-500 italic py-2">Aucune équipe trouvée.</p>
                                      ) : (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                                          {teams[l.league.id]?.map((t: any) => (
                                            <Card 
                                              key={t.team.id} 
                                              className="flex flex-col items-center gap-2 p-2 hover:border-orange-500/50 transition-all group cursor-pointer"
                                              onClick={() => onTeamClick(t.team.id, latestSeason)}
                                            >
                                              <div className="w-12 h-12 bg-white/5 rounded-lg p-2 flex items-center justify-center group-hover:bg-orange-500/10 transition-colors">
                                                <img src={t.team.logo} alt="" className="w-full h-full object-contain" />
                                              </div>
                                              <div className="text-center">
                                                <h3 className="font-black italic uppercase text-[9px] tracking-widest group-hover:text-orange-500 transition-colors leading-tight">{translateCountryName(t.team.name)}</h3>
                                                <p className="text-[7px] text-gray-500 font-bold uppercase mt-0.5">{t.venue.city}</p>
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
