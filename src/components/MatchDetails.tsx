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
  Target,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { UserProfile } from '../types';
import { DuelManager } from './Duel';
import { getImageUrl } from '../lib/utils';
import { db } from '../firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { translateCountryName, translateLeagueName } from '../utils/countryTranslations';

interface MatchDetailsProps {
  fixtureId: number;
  user: UserProfile | null;
  onBack: () => void;
  onTeamClick: (teamId: number, season: number) => void;
  onLeagueClick: (leagueId: number, season: number) => void;
  initialTab?: 'summary' | 'lineups' | 'stats' | 'duels';
  initialDuelId?: string;
  initialDuelType?: string;
  onDuelStatusChange?: (isActive: boolean) => void;
  onDuelIntent?: (callback: () => void) => void;
  onFanzClick?: (fanzId: string) => void;
}

export function MatchDetails({ fixtureId, user, onBack, onTeamClick, onLeagueClick, initialTab = 'summary', initialDuelId, initialDuelType, onDuelStatusChange, onDuelIntent, onFanzClick }: MatchDetailsProps) {
  const [details, setDetails] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [lineups, setLineups] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'summary' | 'lineups' | 'stats' | 'duels'>(initialTab);
  const [selectedDuelType, setSelectedDuelType] = useState<string | null>(initialDuelType || null);
  const [selectedDuelId, setSelectedDuelId] = useState<string | null>(initialDuelId || null);
  const [matchScore, setMatchScore] = useState<{ scoreA: number, scoreB: number } | null>(null);
  const [activeDuels, setActiveDuels] = useState<any[]>([]);
  const [showDuelsList, setShowDuelsList] = useState(false);
  const [showCreateDuel, setShowCreateDuel] = useState(false);
  const [newDuelType, setNewDuelType] = useState<'1v1' | '2v2' | '5v5'>('1v1');
  const [isPrivateDuel, setIsPrivateDuel] = useState(false);
  const [duelHistory, setDuelHistory] = useState<any[]>([]);

  const handleDuelClick = (callback: () => void) => {
    if (onDuelIntent) {
      onDuelIntent(callback);
    } else {
      callback();
    }
  };

  useEffect(() => {
    if (onDuelStatusChange) {
      onDuelStatusChange(!!selectedDuelType);
    }
  }, [selectedDuelType, onDuelStatusChange]);

  useEffect(() => {
    return () => {
      if (onDuelStatusChange) {
        onDuelStatusChange(false);
      }
    };
  }, [onDuelStatusChange]);

  useEffect(() => {
    const fetchActiveDuels = async () => {
      try {
        const res = await fetch(`/api/duels/${fixtureId}`);
        if (res.ok) {
          const data = await res.json();
          // filter out duels where the user is already a participant
          setActiveDuels(data.filter((d: any) => !d.participants.find((p: any) => p.uid === user.uid)));
        }
      } catch (err: any) {
        if (err?.message !== 'Failed to fetch') {
          console.error('Failed to fetch active duels', err);
        }
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
    const mId = fixtureId?.toString();
    if (!mId) return;
    
    console.log(`[MatchDetails] Initializing score listener for matchId: ${mId}`);
    const q = query(collection(db, 'match_scores'), where('matchId', '==', mId));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      console.log(`[MatchDetails] Snapshot received for match ${mId}. Empty: ${querySnapshot.empty}, Count: ${querySnapshot.size}`);
      
      if (!querySnapshot.empty) {
        let totalA = 0;
        let totalB = 0;
        const history: any[] = [];
        
        querySnapshot.forEach(doc => {
          const data = doc.data();
          const sA = Number(data.scoreA || 0);
          const sB = Number(data.scoreB || 0);
          console.log(`[MatchDetails] -> Doc ${doc.id}: ${sA}-${sB} (${data.matchId})`);
          totalA += sA;
          totalB += sB;
          history.push({ id: doc.id, ...data });
        });
        
        console.log(`[MatchDetails] Total aggregated for ${mId}: A=${totalA}, B=${totalB}`);
        setMatchScore({
          scoreA: totalA,
          scoreB: totalB
        });
        
        const sortedHistory = history.sort((a, b) => {
          const timeA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
          const timeB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
          return timeB - timeA;
        });
        setDuelHistory(sortedHistory);
      } else {
        console.log(`[MatchDetails] Query returned empty for match ${mId}`);
        setMatchScore({ scoreA: 0, scoreB: 0 });
        setDuelHistory([]);
      }
    }, (err) => {
      console.error(`[MatchDetails] Snapshot error for match ${mId}:`, err);
    });

    return () => unsubscribe();
  }, [fixtureId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-orange-500"></div>
        <p className="text-gray-500 font-bold animate-pulse">Chargement des détails...</p>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center px-4">
        <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-2">
          <Activity className="w-8 h-8 text-gray-500" />
        </div>
        <h3 className="text-xl font-black text-white uppercase italic">Données indisponibles</h3>
        <p className="text-gray-400 text-sm max-w-xs">
          Impossible de charger les détails du match. La limite de requêtes a peut-être été atteinte.
        </p>
        <Button onClick={onBack} variant="outline" className="mt-4">
          Retour
        </Button>
      </div>
    );
  }

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
        teamAId={details.teams.home.id.toString()}
        teamBId={details.teams.away.id.toString()}
        teamALogo={details.teams.home.logo}
        teamBLogo={details.teams.away.logo}
        initialDuelId={selectedDuelId || undefined}
        initialDuelType={selectedDuelType || undefined}
        isLiveMatch={isLive}
        isPrivate={isPrivateDuel}
        onNavigateToFanz={onFanzClick}
        duelLeagueId={details.league.id.toString()}
        duelSeason={details.league.season.toString()}
      />
    );
  }

  const scoreHome = matchScore?.scoreA || 0;
  const scoreAway = matchScore?.scoreB || 0;
  const totalScore = scoreHome + scoreAway;
  
  let dominanceA = 50;
  let dominanceB = 50;
  
  if (totalScore > 0) {
    const rawA = (scoreHome / totalScore) * 100;
    const rawB = (scoreAway / totalScore) * 100;
    dominanceA = Math.round(rawA);
    dominanceB = Math.round(rawB);
    
    // Fix rounding errors so they don't exceed 100
    if (dominanceA + dominanceB !== 100) {
      if (rawA > rawB) {
        dominanceA += 100 - (dominanceA + dominanceB);
      } else {
        dominanceB += 100 - (dominanceA + dominanceB);
      }
    }
  }

  const hasScore = totalScore > 0;

  return (
    <div className="space-y-2 pb-20 px-2 sm:px-4">
      {/* Gaming Scoreboard */}
      <div className="bg-[#1e1e1e] rounded-[1rem] p-2 sm:p-4 shadow-2xl relative overflow-hidden border border-white/5">
        {/* Top row: Country & League */}
        <div className="flex justify-between items-center mb-2 text-[8px] sm:text-[10px] font-black text-gray-400 uppercase tracking-wider">
          <div className="flex items-center gap-1 min-w-0">
            {details.league.flag && <img src={getImageUrl(details.league.flag, 40)} alt="" className="w-3 h-2.5 sm:w-4 sm:h-3 object-cover rounded-xs flex-shrink-0" />}
            <span className="truncate">{translateCountryName(details.league.country)}</span>
          </div>
          <div className="flex items-center gap-1 text-right cursor-pointer hover:text-orange-500 transition-colors min-w-0" onClick={() => onLeagueClick(details.league.id, details.league.season)}>
            {details.league.logo && <img src={getImageUrl(details.league.logo, 40)} alt="" className="w-3 h-3 sm:w-4 sm:h-4 object-contain flex-shrink-0" />}
            <span className="truncate">{translateLeagueName(details.league.name)} - {details.league.round}</span>
          </div>
        </div>

        {/* Middle row: Teams & Score */}
        <div className="flex justify-between items-center mb-4 gap-2">
          {/* Home Team */}
          <div className="flex-1 flex flex-col items-center gap-1.5 cursor-pointer group min-w-0" onClick={() => onTeamClick(details.teams.home.id, details.league.season)}>
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center p-1.5 shadow-lg group-hover:scale-105 transition-transform">
              <img src={getImageUrl(details.teams.home.logo, 100)} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            </div>
            <span className="font-black text-center uppercase tracking-tight text-[10px] sm:text-xs text-white group-hover:text-orange-500 transition-colors line-clamp-2 w-full leading-tight">
              {details.teams.home.name}
            </span>
            <div className="flex items-center gap-1 px-2 py-0.5 bg-[#2a2a2a] border border-orange-500/20 rounded-full mt-0.5">
              <span className="text-orange-500 text-[9px] sm:text-[10px]">🔥</span>
              <span className="text-orange-500 font-black text-[9px] sm:text-[10px]">{hasScore ? scoreHome : '0'}</span>
            </div>
          </div>

          {/* Score & Time */}
          <div className="flex flex-col items-center justify-center px-2 shrink-0">
            <div className="text-3xl sm:text-5xl font-black text-white tracking-tighter mb-1">
              {details.goals.home ?? 0}:{details.goals.away ?? 0}
            </div>
            {isLive ? (
              <div className="px-2 py-0.5 bg-orange-500/20 border border-orange-500/30 rounded-full text-orange-500 font-black text-[9px] sm:text-xs">
                {details.fixture.status.elapsed}{details.fixture.status.extra ? `+${details.fixture.status.extra}` : ''}'
              </div>
            ) : (
              <div className="px-2 py-0.5 bg-white/10 border border-white/10 rounded-full text-gray-400 font-black text-[8px] sm:text-[10px] uppercase">
                {details.fixture.status.short}
              </div>
            )}
          </div>

          {/* Away Team */}
          <div className="flex-1 flex flex-col items-center gap-1.5 cursor-pointer group min-w-0" onClick={() => onTeamClick(details.teams.away.id, details.league.season)}>
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center p-1.5 shadow-lg group-hover:scale-105 transition-transform">
              <img src={getImageUrl(details.teams.away.logo, 100)} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            </div>
            <span className="font-black text-center uppercase tracking-tight text-[10px] sm:text-xs text-white group-hover:text-blue-500 transition-colors line-clamp-2 w-full leading-tight">
              {details.teams.away.name}
            </span>
            <div className="flex items-center gap-1 px-2 py-0.5 bg-[#2a2a2a] border border-blue-500/20 rounded-full mt-0.5">
              <span className="text-blue-500 text-[9px] sm:text-[10px]">🔥</span>
              <span className="text-blue-500 font-black text-[9px] sm:text-[10px]">{hasScore ? scoreAway : '0'}</span>
            </div>
          </div>
        </div>

        {/* Dominance Mondiale */}
        <div className="mb-2 sm:mb-3 px-2">
          {hasScore ? (
            <>
              <div className="text-center mb-2">
                <span className="text-[8px] sm:text-[10px] font-black text-yellow-500 tracking-[0.15em] uppercase bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20">
                  Dominance Mondiale
                </span>
              </div>
              
              <div className="flex justify-between items-end mb-1 px-1">
                <div className="flex flex-col items-start">
                  <span className="text-lg sm:text-2xl font-black text-orange-500 leading-none">
                    {dominanceA}
                    <span className="text-[10px] sm:text-sm text-orange-500/50 ml-0.5">%</span>
                  </span>
                </div>
                
                <div className="flex flex-col items-end">
                  <span className="text-lg sm:text-2xl font-black text-blue-500 leading-none">
                    {dominanceB}
                    <span className="text-[10px] sm:text-sm text-blue-500/50 ml-0.5">%</span>
                  </span>
                </div>
              </div>

              <div className="relative h-1.5 sm:h-2 bg-gray-800 rounded-full overflow-hidden flex border border-gray-700 shadow-inner">
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
            </>
          ) : (
            <div className="text-center py-4">
              <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest">
                Aucun duel n'a été joué
              </span>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-2 sm:gap-3 mt-4 sm:mt-6">
          {isUpcoming && (
            <button 
              className="w-full py-3 sm:py-4 rounded-xl border border-orange-500/30 bg-orange-500/5 hover:bg-orange-500/10 text-white font-bold text-xs sm:text-sm uppercase tracking-widest transition-all"
              onClick={() => handleDuelClick(() => setSelectedDuelType('training'))}
            >
              <div className="flex items-center justify-center gap-2">
                <Target className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
                Entraînement Solo
              </div>
            </button>
          )}

          {isLive && (
            <>
              <div className="flex gap-2 sm:gap-3">
                <button 
                  className={`py-4 sm:py-5 rounded-xl border-2 border-orange-500/50 bg-orange-500/10 hover:bg-orange-500/20 text-white font-black text-xs sm:text-sm uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(249,115,22,0.2)] active:scale-95 ${activeDuels.length > 0 ? 'flex-1' : 'w-full'}`}
                  onClick={() => handleDuelClick(() => setShowCreateDuel(true))}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Swords className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
                    Créer un Duel
                  </div>
                </button>
                {activeDuels.length > 0 && (
                  <button 
                    className="flex-1 py-4 sm:py-5 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-black text-xs sm:text-sm uppercase tracking-widest transition-all shadow-lg shadow-orange-500/30 active:scale-95"
                    onClick={() => handleDuelClick(() => setShowDuelsList(true))}
                  >
                    Rejoindre ({activeDuels.length})
                  </button>
                )}
              </div>
              <button 
                className="w-full py-3 sm:py-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold text-xs sm:text-sm uppercase tracking-widest transition-all"
                onClick={() => handleDuelClick(() => {
                  setIsPrivateDuel(false);
                  setSelectedDuelType('war_of_kops');
                })}
              >
                Rejoindre la Guerre des Kops
              </button>
            </>
          )}
        </div>
      </div>

      {showCreateDuel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
          <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-black text-white uppercase italic">Créer un Duel</h3>
              <button onClick={() => setShowCreateDuel(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Type de Duel</label>
                <div className="grid grid-cols-3 gap-2">
                  {['1v1', '2v2', '5v5'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setNewDuelType(type as any)}
                      className={`py-3 rounded-xl font-black text-sm uppercase transition-all border ${
                        newDuelType === type 
                          ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/20' 
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                <div>
                  <div className="font-bold text-white text-sm">Duel Privé</div>
                  <div className="text-xs text-gray-500 mt-1">Uniquement sur invitation</div>
                </div>
                <button 
                  onClick={() => setIsPrivateDuel(!isPrivateDuel)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${isPrivateDuel ? 'bg-orange-500' : 'bg-gray-600'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${isPrivateDuel ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              <button 
                className="w-full py-4 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-orange-500/30 active:scale-95"
                onClick={() => {
                  setShowCreateDuel(false);
                  setSelectedDuelType(newDuelType);
                }}
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {showDuelsList && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
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
                    onClick={() => handleDuelClick(() => {
                      setShowDuelsList(false);
                      setSelectedDuelId(duel.id);
                      setSelectedDuelType(duel.type);
                    })}
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
      <div className="flex gap-1 p-1 bg-white/5 rounded-lg border border-white/10">
        <TabButton 
          active={activeTab === 'summary'} 
          onClick={() => setActiveTab('summary')}
          icon={<Activity className="w-3 h-3" />}
          label="Résumé"
        />
        <TabButton 
          active={activeTab === 'lineups'} 
          onClick={() => setActiveTab('lineups')}
          icon={<Users className="w-3 h-3" />}
          label="Compos"
        />
        <TabButton 
          active={activeTab === 'stats'} 
          onClick={() => setActiveTab('stats')}
          icon={<BarChart3 className="w-3 h-3" />}
          label="Stats"
        />
        <TabButton 
          active={activeTab === 'duels'} 
          onClick={() => setActiveTab('duels')}
          icon={<Trophy className="w-3 h-3" />}
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
      className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md transition-all font-bold text-[9px] uppercase italic ${
        active 
          ? 'bg-orange-600 text-white shadow-md' 
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
      <Card className="py-6 text-center text-gray-500 text-xs font-bold italic">
        Aucun événement enregistré pour ce match.
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event, idx) => {
        const isHome = event.team.id === teams.home.id;
        return (
          <div key={idx} className={`flex items-center gap-3 ${isHome ? 'flex-row' : 'flex-row-reverse'}`}>
            <div className="w-8 text-center font-black text-orange-500 italic text-xs">
              {event.time.elapsed}'
            </div>
            <div className={`flex-1 flex items-center gap-2 ${isHome ? 'flex-row' : 'flex-row-reverse'}`}>
              <div className={`p-1.5 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2 ${isHome ? 'flex-row' : 'flex-row-reverse'}`}>
                <EventIcon type={event.type} detail={event.detail} />
                <div className={`flex flex-col ${isHome ? 'items-start' : 'items-end'}`}>
                  <span className="font-bold text-xs leading-tight">{event.player.name}</span>
                  {event.type === 'Goal' && event.assist.name && (
                    <span className="text-[9px] text-gray-500 italic leading-tight">Passe: {event.assist.name}</span>
                  )}
                  {event.type === 'subst' && (
                    <span className="text-[9px] text-gray-500 italic leading-tight">Sortie: {event.assist.name}</span>
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
      <Card className="py-6 text-center text-gray-500 text-xs font-bold italic">
        Aucun duel enregistré pour ce match.
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 text-center">
          <div className="text-[8px] font-black text-orange-500 uppercase tracking-widest mb-0.5 truncate">Total {teams.home.name}</div>
          <div className="text-xl font-black text-white">
            {history.reduce((acc, curr) => acc + (curr.scoreA || 0), 0)}
          </div>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
          <div className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-0.5 truncate">Total {teams.away.name}</div>
          <div className="text-xl font-black text-white">
            {history.reduce((acc, curr) => acc + (curr.scoreB || 0), 0)}
          </div>
        </div>
      </div>

      <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mb-3">Historique des Duels</h3>
      
      <div className="space-y-2">
        {history.map((duel, idx) => (
          <div key={duel.id || idx} className="bg-white/5 border border-white/10 rounded-xl p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[8px] font-black text-orange-500 uppercase tracking-wider bg-orange-500/10 px-1.5 py-0.5 rounded">
                {duel.type || 'Duel'}
              </span>
              <span className="text-[8px] font-bold text-gray-500 italic">
                {duel.timestamp?.seconds ? new Date(duel.timestamp.seconds * 1000).toLocaleDateString() : ''}
              </span>
            </div>
            
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 flex flex-col items-center min-w-0">
                <span className="text-base font-black text-white">{duel.scoreA || 0}</span>
                <span className="text-[7px] font-bold text-gray-500 uppercase truncate w-full text-center">{teams.home.name}</span>
              </div>
              
              <div className="flex flex-col items-center px-2">
                <div className="h-0.5 w-6 bg-white/10" />
              </div>
              
              <div className="flex-1 flex flex-col items-center min-w-0">
                <span className="text-base font-black text-white">{duel.scoreB || 0}</span>
                <span className="text-[7px] font-bold text-gray-500 uppercase truncate w-full text-center">{teams.away.name}</span>
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
      <Card className="py-6 text-center text-gray-500 text-xs font-bold italic">
        Compositions non disponibles.
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {lineups.map((lineup, idx) => (
        <div key={idx} className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
            <div className="flex items-center gap-2">
              <img src={getImageUrl(lineup.team.logo, 40)} alt="" className="w-6 h-6 object-contain" referrerPolicy="no-referrer" />
              <h3 className="font-black italic uppercase text-xs tracking-wider">{lineup.team.name}</h3>
            </div>
            <span className="text-[10px] font-bold text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded">
              {lineup.formation}
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <h4 className="text-[9px] font-black uppercase text-gray-500 tracking-widest mb-2">Titulaires</h4>
              <div className="space-y-1.5">
                {lineup.startXI.map((p: any) => (
                  <PlayerRow key={p.player.id} player={p.player} />
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-[9px] font-black uppercase text-gray-500 tracking-widest mb-2">Remplaçants</h4>
              <div className="space-y-1.5">
                {lineup.substitutes.map((p: any) => (
                  <PlayerRow key={p.player.id} player={p.player} />
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-gray-600 uppercase">Coach:</span>
                <span className="text-xs font-bold">{lineup.coach.name}</span>
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
    <div className="flex items-center gap-2 p-1.5 bg-white/5 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
      <div className="w-5 h-5 bg-gray-800 rounded flex items-center justify-center text-[9px] font-black text-gray-400">
        {player.number}
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-bold leading-tight">{player.name}</span>
        <span className="text-[9px] text-gray-500 uppercase font-bold tracking-tighter leading-tight">{player.pos}</span>
      </div>
    </div>
  );
}

function StatsTab({ stats, teams }: { stats: any[]; teams: any }) {
  if (stats.length === 0) {
    return (
      <Card className="py-6 text-center text-gray-500 text-xs font-bold italic">
        Statistiques non disponibles.
      </Card>
    );
  }

  // Find all unique stat types
  const statTypes = stats[0].statistics.map((s: any) => s.type);

  return (
    <Card className="p-4 space-y-4">
      {statTypes.map((type: string) => {
        const homeVal = stats.find(s => s.team.id === teams.home.id)?.statistics.find((s: any) => s.type === type)?.value || 0;
        const awayVal = stats.find(s => s.team.id === teams.away.id)?.statistics.find((s: any) => s.type === type)?.value || 0;

        // Simple percentage calculation for the bar
        const homeNum = parseFloat(String(homeVal).replace('%', '')) || 0;
        const awayNum = parseFloat(String(awayVal).replace('%', '')) || 0;
        const total = homeNum + awayNum;
        const homePercent = total === 0 ? 50 : (homeNum / total) * 100;

        return (
          <div key={type} className="space-y-1.5">
            <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-gray-400">
              <span>{homeVal}</span>
              <span className="text-white">{type}</span>
              <span>{awayVal}</span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden flex">
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
