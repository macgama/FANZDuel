import React, { useState, useEffect, useMemo } from 'react';
import { footballApi } from '../services/footballApi';
import { footballDataService } from '../services/footballDataService';
import { Card, Button } from './Layout';
import { Search, Trophy, Globe, ChevronRight, History, ChevronDown, RefreshCw, Clock, Settings, Download, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LeagueDetails } from './LeagueDetails';
import { format } from 'date-fns';
import { translateCountryName, translateLeagueName } from '../utils/countryTranslations';
import { db } from '../firebase';
import { writeBatch, doc, deleteDoc } from 'firebase/firestore';

// Simple continent mapping helper
const getContinent = (country: string): string => {
  const europe = ['Albania', 'Andorra', 'Armenia', 'Austria', 'Azerbaijan', 'Belarus', 'Belgium', 'Bosnia & Herzegovina', 'Bosnia and Herzegovina', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Czech-Republic', 'Czechia', 'Denmark', 'Estonia', 'Faroe-Islands', 'Finland', 'France', 'Georgia', 'Germany', 'Gibraltar', 'Greece', 'Hungary', 'Iceland', 'Ireland', 'Republic of Ireland', 'Israel', 'Italy', 'Kazakhstan', 'Kosovo', 'Latvia', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Malta', 'Moldova', 'Monaco', 'Montenegro', 'Netherlands', 'Northern Ireland', 'Northern-Ireland', 'Norway', 'Poland', 'Portugal', 'Romania', 'Russia', 'San Marino', 'San-Marino', 'Scotland', 'Serbia', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Switzerland', 'Turkey', 'Ukraine', 'Wales', 'United Kingdom', 'England', 'Macedonia', 'North Macedonia', 'North-Macedonia'];
  
  const southAmerica = ['Argentina', 'Bolivia', 'Brazil', 'Chile', 'Colombia', 'Ecuador', 'Paraguay', 'Peru', 'Uruguay', 'Venezuela', 'Suriname', 'Guyana'];
  
  const northAmerica = ['Antigua and Barbuda', 'Bahamas', 'Barbados', 'Belize', 'Canada', 'Costa Rica', 'Costa-Rica', 'Cuba', 'Dominica', 'Dominican Republic', 'Dominican-Republic', 'El Salvador', 'El-Salvador', 'Grenada', 'Guatemala', 'Haiti', 'Honduras', 'Jamaica', 'Mexico', 'Nicaragua', 'Panama', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines', 'Trinidad and Tobago', 'Trinidad-And-Tobago', 'United States', 'USA'];
  
  const africa = ['Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burkina-Faso', 'Burundi', 'Cabo Verde', 'Cabo-Verde', 'Cameroon', 'Central African Republic', 'Central-African-Republic', 'Chad', 'Comoros', 'Congo', 'Congo-DR', 'Djibouti', 'Egypt', 'Equatorial Guinea', 'Equatorial-Guinea', 'Eritrea', 'Eswatini', 'Ethiopia', 'Gabon', 'Gambia', 'Ghana', 'Guinea', 'Guinea-Bissau', 'Ivory Coast', 'Ivory-Coast', "Cote d'Ivoire", 'Kenya', 'Lesotho', 'Liberia', 'Libya', 'Madagascar', 'Malawi', 'Mali', 'Mauritania', 'Mauritius', 'Morocco', 'Mozambique', 'Namibia', 'Niger', 'Nigeria', 'Rwanda', 'Sao Tome and Principe', 'Senegal', 'Seychelles', 'Sierra Leone', 'Sierra-Leone', 'Somalia', 'South Africa', 'South-Africa', 'South Sudan', 'Sudan', 'Tanzania', 'Togo', 'Tunisia', 'Uganda', 'Zambia', 'Zimbabwe'];
  
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

export function CompetitionsPage({ onLeagueClick, profile }: { onLeagueClick: (id: number, season: number) => void; profile?: any }) {
  const [leagues, setLeagues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set());
  
  // Admin states
  const [showAdmin, setShowAdmin] = useState(false);
  const [importing, setImporting] = useState(false);
  const [manualLeagueId, setManualLeagueId] = useState('');
  const [importSeason, setImportSeason] = useState(footballDataService.getCurrentSeasonYear().toString());
  const [importStatus, setImportStatus] = useState<{type: 'success' | 'error' | 'info', message: string} | null>(null);

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

  const handleImportLeague = async () => {
    if (!manualLeagueId) return;
    setImporting(true);
    setImportStatus({ type: 'info', message: `Importation de la compétition ${manualLeagueId}...` });
    try {
      const data = await footballApi.getLeagues(parseInt(importSeason), parseInt(manualLeagueId));
      if (!data || data.length === 0) {
        setImportStatus({ type: 'error', message: "Aucune compétition trouvée." });
        setImporting(false);
        return;
      }
      
      const batch = writeBatch(db);
      for (const item of data) {
        const leagueRef = doc(db, 'leagues', item.league.id.toString());
        batch.set(leagueRef, {
          id: item.league.id,
          name: item.league.name,
          type: item.league.type,
          logo: item.league.logo,
          country: item.country.name,
          countryCode: item.country.code,
          countryFlag: item.country.flag,
          season: parseInt(importSeason)
        });
      }
      await batch.commit();
      await footballDataService.setLastUpdated('leagues_list');
      
      setImportStatus({ type: 'success', message: "Importé avec succès!" });
      setManualLeagueId('');
      fetchLeagues(true); // refresh
    } catch (error) {
      setImportStatus({ type: 'error', message: "Erreur lors de l'import." });
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteLeague = async (id: number) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette compétition?")) return;
    try {
      await deleteDoc(doc(db, 'leagues', id.toString()));
      fetchLeagues(true);
    } catch (error) {
      console.error(error);
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
    
    (leagues || []).forEach(l => {
      const continent = getContinent(l.country.name);
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
    <div className="space-y-3 pb-20">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-orange-500" />
            <h1 className="text-lg font-black italic uppercase tracking-tighter text-white">Compétitions</h1>
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

        {lastUpdated && (
          <div className="flex items-center gap-1 text-[7px] font-bold text-gray-500 uppercase italic tracking-widest">
            <Clock className="w-2 h-2" />
            Mis à jour le {format(lastUpdated, 'dd/MM HH:mm')}
          </div>
        )}
        
        {profile?.role === 'admin' && (
          <div className="border border-white/10 p-2 rounded-lg bg-orange-500/5 mb-2 space-y-2">
            <div 
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setShowAdmin(!showAdmin)}
            >
              <h2 className="text-[10px] font-bold uppercase text-orange-500 tracking-widest flex items-center gap-1.5"><Settings className="w-3 h-3" /> ADM: Gérer Ligues</h2>
              <ChevronDown className={`w-3.5 h-3.5 text-orange-500 transition-transform ${showAdmin ? 'rotate-180' : ''}`} />
            </div>
            
            <AnimatePresence>
              {showAdmin && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-2 space-y-2 border-t border-white/10 mt-2">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={manualLeagueId}
                        onChange={(e) => setManualLeagueId(e.target.value)}
                        placeholder="ID Ligue" 
                        className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs focus:border-orange-500/50 outline-none"
                      />
                      <input 
                        type="text" 
                        value={importSeason}
                        onChange={(e) => setImportSeason(e.target.value)}
                        placeholder="Année" 
                        className="w-16 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs focus:border-orange-500/50 outline-none"
                      />
                      <Button size="sm" onClick={handleImportLeague} disabled={importing || !manualLeagueId} className="h-auto py-1 px-3 bg-orange-500 hover:bg-orange-600">
                        {importing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                      </Button>
                    </div>
                    {importStatus && (
                      <div className={`p-1.5 rounded text-[9px] font-bold ${importStatus.type === 'error' ? 'bg-red-500/20 text-red-500' : importStatus.type === 'success' ? 'bg-green-500/20 text-green-500' : 'bg-blue-500/20 text-blue-500'}`}>
                        {importStatus.message}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className="relative w-full group">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 group-focus-within:text-orange-500 transition-colors" />
          <input 
            type="text"
            placeholder="Rechercher une compétition..."
            className="w-full bg-white/5 border border-white/10 rounded-lg py-1.5 pl-8 pr-3 text-[10px] font-bold focus:outline-none focus:border-orange-500/50 transition-all h-8 placeholder:text-gray-600"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-orange-500"></div>
          <p className="text-[10px] text-gray-500 font-black animate-pulse uppercase italic tracking-widest">Chargement...</p>
        </div>
      ) : Object.keys(filteredContinents).length === 0 ? (
        <Card className="py-20 text-center text-gray-500 border-dashed border-white/10">
          <Globe className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-[10px] font-black uppercase italic tracking-widest">Aucune compétition trouvée.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(filteredContinents).map(([continent, countries]) => (
            <div key={continent} className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-black italic uppercase tracking-[0.2em] text-orange-500 flex items-center gap-3 whitespace-nowrap">
                  {continent}
                  <span className="h-px flex-1 bg-orange-500/20" />
                </h2>
              </div>

              <div className="grid gap-1.5">
                {Object.entries(countries).map(([country, data]) => (
                  <div key={country} className="space-y-1">
                    <button 
                      onClick={() => toggleCountry(country)}
                      className="w-full flex items-center justify-between p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all group"
                    >
                      <div className="flex items-center gap-2.5">
                        {data.flag ? (
                          <img src={data.flag} alt="" className="w-5 h-3.5 object-cover rounded-xs shadow-sm border border-white/5" />
                        ) : (
                          <Globe className="w-3.5 h-3.5 text-gray-500" />
                        )}
                        <span className="font-black italic uppercase tracking-tight text-xs group-hover:text-orange-500 transition-colors">{translateCountryName(country)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-bold text-gray-600 bg-white/5 px-1.5 py-0.5 rounded-full">{data.leagues.length}</span>
                        <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-300 ${expandedCountries.has(country) ? 'rotate-180 text-orange-500' : ''}`} />
                      </div>
                    </button>

                    <AnimatePresence>
                      {expandedCountries.has(country) && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="grid grid-cols-1 gap-1 py-1 pl-2 border-l border-white/5 ml-4">
                            {data.leagues.map(l => {
                              const latestSeason = l.seasons?.sort((a: any, b: any) => b.year - a.year)[0]?.year || footballDataService.getCurrentSeasonYear();
                              return (
                                <div 
                                  key={l.league.id} 
                                  className="flex items-center justify-between p-2 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-lg cursor-pointer group transition-all"
                                  onClick={() => onLeagueClick(l.league.id, latestSeason)}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-7 h-7 bg-white rounded-lg p-1 flex items-center justify-center group-hover:scale-110 transition-transform">
                                      <img src={l.league.logo} alt="" className="w-full h-full object-contain" />
                                    </div>
                                    <div className="min-w-0">
                                      <h3 className="font-bold text-[10px] text-white group-hover:text-orange-500 transition-colors truncate leading-tight">{translateLeagueName(l.league.name)}</h3>
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        <p className="text-[7px] text-gray-500 uppercase font-black tracking-widest">{l.league.type}</p>
                                        <span className="text-[7px] bg-orange-500/10 text-orange-500 px-1 py-0.5 rounded font-black italic">
                                          {latestSeason}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {profile?.role === 'admin' && (
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleDeleteLeague(l.league.id); }}
                                        className="p-1.5 opacity-50 hover:opacity-100 hover:text-red-500 hover:bg-red-500/10 rounded transition-all"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                    <ChevronRight className="w-3 h-3 text-gray-700 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
                                  </div>
                                </div>
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
