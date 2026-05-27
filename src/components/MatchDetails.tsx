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
  X,
  MonitorPlay
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { UserProfile } from '../types';
import { DuelManager } from './Duel';
import { DuelDetailsModal } from './DuelDetailsModal';
import { getImageUrl } from '../lib/utils';
import { db } from '../firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { translateCountryName, translateLeagueName } from '../utils/countryTranslations';

const getMatchStatusLabel = (status: any) => {
  if (!status) return '';
  const short = status.short;
  switch (short) {
    case '1H': return '1ère Mi-temps';
    case 'HT': return 'Mi-temps';
    case '2H': return '2ème Mi-temps';
    case 'ET': return 'Prolongations';
    case 'BT': return 'Pause avant Prol.';
    case 'P': return 'Tirs au But';
    case 'FT': return 'Terminé';
    case 'AET': return 'Terminé (A.P.)';
    case 'PEN': return 'Terminé (T.A.B.)';
    case 'SUSP': return 'Suspendu';
    case 'INT': return 'Interrompu';
    case 'PST': return 'Reporté';
    case 'CANC': return 'Annulé';
    case 'ABD': return 'Abandonné';
    case 'AWD': return 'Par forfait';
    case 'WO': return 'Forfait';
    case 'NS': return 'Non démarré';
    case 'TBD': return 'À définir';
    default: return status.long || short;
  }
};

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
  onPlayerClick?: (playerId: number, season: number) => void;
}

export function MatchDetails({ fixtureId, user, onBack, onTeamClick, onLeagueClick, initialTab = 'summary', initialDuelId, initialDuelType, onDuelStatusChange, onDuelIntent, onFanzClick, onPlayerClick }: MatchDetailsProps) {
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
  const [selectedDuelDetails, setSelectedDuelDetails] = useState<string | null>(null);

  const handleDuelClick = (callback: () => void) => {
    if (onDuelIntent) {
      onDuelIntent(callback);
    } else {
      callback();
    }
  };

  useEffect(() => {
    if (initialDuelType) setSelectedDuelType(initialDuelType);
    if (initialDuelId) setSelectedDuelId(initialDuelId);
  }, [initialDuelType, initialDuelId]);

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
        const res = await fetch(`/api/duels/${fixtureId}`, { headers: { 'Accept': 'application/json' }});
        if (res.ok) {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
          // filter out duels where the user is already a participant
          setActiveDuels(data.filter((d: any) => !d.participants.find((p: any) => p.uid === user.uid)));
          }
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

  const isLiveStatusRef = React.useRef<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async (isBackground = false) => {
      if (!isBackground) setLoading(true);
      try {
        const [detailsData, eventsData, lineupsData, statsData] = await Promise.all([
          footballApi.getFixtureDetails(fixtureId),
          footballApi.getFixtureEvents(fixtureId),
          footballApi.getFixtureLineups(fixtureId),
          footballApi.getFixtureStatistics(fixtureId)
        ]);
        if (isMounted) {
          setDetails(detailsData);
          setEvents(eventsData);
          setLineups(lineupsData);
          setStats(statsData);
          
          if (detailsData?.fixture?.status?.short) {
            isLiveStatusRef.current = ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE'].includes(detailsData.fixture.status.short);
          }
        }
      } catch (err) {
        console.error('Failed to fetch match details', err);
      } finally {
        if (isMounted && !isBackground) setLoading(false);
      }
    };
    fetchData();

    // Refresh live match details every 60s
    const interval = setInterval(() => {
      if (isLiveStatusRef.current) {
        fetchData(true);
      }
    }, 60000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
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
  const isHomeWinner = hasScore && scoreHome > scoreAway;
  const isAwayWinner = hasScore && scoreAway > scoreHome;

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

        {/* Match Date and Time */}
        <div className="flex justify-center items-center gap-1.5 text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1 mb-4 pt-2 border-t border-white/5">
          <Clock className="w-3.5 h-3.5 text-orange-500 shrink-0" />
          <span>{format(new Date(details.fixture.date), "dd/MM/yyyy • HH:mm")}</span>
        </div>

        {/* Middle row: Teams & Score */}
        <div className="flex justify-between items-center mb-4 gap-2">
          {/* Home Team */}
          <div className="flex-1 flex flex-col items-center gap-1.5 cursor-pointer group min-w-0" onClick={() => onTeamClick(details.teams.home.id, details.league.season)}>
            {isHomeWinner ? (
              <div className="relative w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center transition-all duration-300 rounded-full bg-black/30 p-1 border-2 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.4)] group-hover:scale-105">
                <img src={getImageUrl(details.teams.home.logo, 100)} alt="" className="w-4/5 h-4/5 object-contain" referrerPolicy="no-referrer" />
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 text-black text-[7px] sm:text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-0.5 whitespace-nowrap z-10 animate-pulse border border-yellow-300/20">
                  <Trophy className="w-2 h-2 fill-black shrink-0" />
                  <span>GAGNANT</span>
                </div>
              </div>
            ) : (
              <div className={`w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center transition-all drop-shadow-xl ${isAwayWinner ? 'opacity-40 group-hover:opacity-60 grayscale-[30%] scale-95' : 'group-hover:scale-105'}`}>
                <img src={getImageUrl(details.teams.home.logo, 100)} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              </div>
            )}
            <span className={`font-black text-center uppercase tracking-tight text-[10px] sm:text-xs transition-colors line-clamp-2 w-full leading-tight ${
              isHomeWinner ? 'text-orange-400 font-extrabold sm:text-xs' : isAwayWinner ? 'text-gray-500 font-medium' : 'text-white group-hover:text-orange-500'
            }`}>
              {details.teams.home.name}
            </span>
            <div className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full transition-all duration-300 mt-0.5 ${
              isHomeWinner 
                ? 'bg-gradient-to-r from-orange-600 to-orange-500 border border-orange-400/30 text-white shadow-lg shadow-orange-500/10 scale-105' 
                : isAwayWinner 
                ? 'bg-[#2a2a2a]/40 border border-white/5 text-gray-500 scale-95 opacity-50'
                : 'bg-[#2a2a2a] border border-orange-500/20 text-orange-500'
            }`}>
              <span className={isAwayWinner ? 'opacity-30' : ''}>🔥</span>
              <span className="font-black text-[9px] sm:text-[10px]">{hasScore ? scoreHome : '0'}{isHomeWinner ? ' PTS' : ''}</span>
            </div>
          </div>

          {/* Score & Time */}
          <div className="flex flex-col items-center justify-center px-2 shrink-0">
            <div className="text-3xl sm:text-5xl font-black text-white tracking-tighter mb-1">
              {details.goals.home ?? 0}:{details.goals.away ?? 0}
            </div>
            
            {details.score?.penalty?.home != null && (
              <div className="text-[9px] sm:text-[10px] font-black text-red-400 mb-1.5 uppercase tracking-wider bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 shadow-md">
                ({details.score.penalty.home} - {details.score.penalty.away} TAB)
              </div>
            )}
            
            {isLive ? (
              <div className="flex flex-col items-center gap-1.5">
                <div className="px-2.5 py-0.5 bg-orange-500/20 border border-orange-500/30 rounded-full text-orange-500 font-black text-[9px] sm:text-xs flex items-center justify-center gap-0.5">
                  <span>{details.fixture.status.elapsed}{details.fixture.status.extra ? `+${details.fixture.status.extra}` : ''}</span>
                  <span className="animate-pulse">'</span>
                </div>
                {/* Status translation sub-text */}
                <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shadow-sm text-center ${
                  ['ET', 'P', 'BT'].includes(details.fixture.status.short)
                    ? "bg-[#ef4444] text-white animate-pulse"
                    : "bg-[#2a2a2a] text-gray-400"
                }`}>
                  {getMatchStatusLabel(details.fixture.status)}
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <div className="px-2.5 py-0.5 bg-white/10 border border-white/10 rounded-full text-gray-400 font-black text-[8px] sm:text-[10px] uppercase">
                  {details.fixture.status.short}
                </div>
                {/* Translated/Precise label for finished matches */}
                <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20 text-center">
                  {getMatchStatusLabel(details.fixture.status)}
                </span>
              </div>
            )}
          </div>

          {/* Away Team */}
          <div className="flex-1 flex flex-col items-center gap-1.5 cursor-pointer group min-w-0" onClick={() => onTeamClick(details.teams.away.id, details.league.season)}>
            {isAwayWinner ? (
              <div className="relative w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center transition-all duration-300 rounded-full bg-black/30 p-1 border-2 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.4)] group-hover:scale-105">
                <img src={getImageUrl(details.teams.away.logo, 100)} alt="" className="w-4/5 h-4/5 object-contain" referrerPolicy="no-referrer" />
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 text-black text-[7px] sm:text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-0.5 whitespace-nowrap z-10 animate-pulse border border-yellow-300/20">
                  <Trophy className="w-2 h-2 fill-black shrink-0" />
                  <span>GAGNANT</span>
                </div>
              </div>
            ) : (
              <div className={`w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center transition-all drop-shadow-xl ${isHomeWinner ? 'opacity-40 group-hover:opacity-60 grayscale-[30%] scale-95' : 'group-hover:scale-105'}`}>
                <img src={getImageUrl(details.teams.away.logo, 100)} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              </div>
            )}
            <span className={`font-black text-center uppercase tracking-tight text-[10px] sm:text-xs transition-colors line-clamp-2 w-full leading-tight ${
              isAwayWinner ? 'text-blue-400 font-extrabold sm:text-xs' : isHomeWinner ? 'text-gray-500 font-medium' : 'text-white group-hover:text-blue-500'
            }`}>
              {details.teams.away.name}
            </span>
            <div className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full transition-all duration-300 mt-0.5 ${
              isAwayWinner 
                ? 'bg-gradient-to-r from-blue-600 to-blue-500 border border-blue-400/30 text-white shadow-lg shadow-blue-500/10 scale-105' 
                : isHomeWinner 
                ? 'bg-[#2a2a2a]/40 border border-white/5 text-gray-500 scale-95 opacity-50'
                : 'bg-[#2a2a2a] border border-blue-500/20 text-blue-500'
            }`}>
              <span className={isHomeWinner ? 'opacity-30' : ''}>🔥</span>
              <span className="font-black text-[9px] sm:text-[10px]">{hasScore ? scoreAway : '0'}{isAwayWinner ? ' PTS' : ''}</span>
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
                  onClick={() => handleDuelClick(() => {
                    setIsPrivateDuel(false);
                    setSelectedDuelType('1v1');
                  })}
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
              {activeDuels.some(d => d.type === 'war_of_kops') && (
                <button 
                  className="w-full py-3 sm:py-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold text-xs sm:text-sm uppercase tracking-widest transition-all"
                  onClick={() => handleDuelClick(() => {
                    const wokDuel = activeDuels.find(d => d.type === 'war_of_kops');
                    setIsPrivateDuel(false);
                    setSelectedDuelType('war_of_kops');
                    if (wokDuel) {
                      setSelectedDuelId(wokDuel.id);
                    }
                  })}
                >
                  Rejoindre la Guerre des Kops
                </button>
              )}
            </>
          )}
        </div>
      </div>

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
          {activeTab === 'summary' && <SummaryTab events={events} teams={details.teams} status={details.fixture.status.short} />}
          {activeTab === 'lineups' && <LineupsTab lineups={lineups} status={details.fixture.status.short} season={details.league.season} onPlayerClick={onPlayerClick} />}
          {activeTab === 'stats' && <StatsTab stats={stats} teams={details.teams} status={details.fixture.status.short} />}
          {activeTab === 'duels' && <DuelsTab history={duelHistory} teams={details.teams} setSelectedDuelDetails={setSelectedDuelDetails} />}
        </motion.div>
      </AnimatePresence>

      {selectedDuelDetails && (
        <DuelDetailsModal 
          duelId={selectedDuelDetails} 
          onClose={() => setSelectedDuelDetails(null)} 
        />
      )}
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

function SummaryTab({ events, teams, status }: { events: any[]; teams: any; status: string }) {
  if (events.length === 0) {
    const isUpcoming = ['TBD', 'NS'].includes(status);
    const isCancelled = ['SUSP', 'INT', 'PST', 'CANC', 'ABD', 'AWD', 'WO'].includes(status);
    let message = "Aucun événement enregistré pour ce match.";
    if (isUpcoming) message = "Les événements du match seront affichés ici en direct.";
    else if (isCancelled) message = "Match annulé, reporté ou interrompu.";
    else message = "Les détails de ce match ne sont malheureusement pas couverts par notre fournisseur de données.";

    return (
      <Card className="py-6 text-center text-gray-500 text-xs font-bold italic">
        {message}
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {events.map((event, idx) => {
          const isHome = event.team.id === teams.home.id;
          
          const translateDetail = (type: string, detail: string) => {
            if (!detail) return null;
            const d = detail.toLowerCase();
            if (type === 'Goal') {
              if (d.includes('missed penalty')) return 'Penalty manqué';
              if (d.includes('penalty')) return 'Penalty';
              if (d.includes('own goal')) return 'Contre son camp';
              if (d.includes('cancelled')) return 'But annulé (VAR)';
              return null; // Don't show "Normal Goal"
            }
            if (type === 'Card') {
              if (d.includes('second yellow')) return '2ème carton jaune';
              if (d.includes('red')) return 'Carton rouge';
              return null; // Don't explicitly write "Yellow Card" as the icon is obvious
            }
            if (type === 'Var') {
              if (d.includes('goal cancelled')) return 'But annulé';
              if (d.includes('penalty confirmed')) return 'Penalty confirmé';
              if (d.includes('card review')) return 'Révision arbitre';
              return detail;
            }
            return null; // Ignore subst, etc. as it's handled
          };

          const detailMsg = translateDetail(event.type, event.detail);

          return (
            <motion.div 
              key={idx} 
              initial={{ opacity: 0, x: isHome ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex items-center gap-3 ${isHome ? 'flex-row' : 'flex-row-reverse'}`}
            >
              <div className="w-8 text-center font-black text-orange-500 italic text-xs">
                {event.time.elapsed}'
              </div>
              <div className={`flex-1 flex items-center gap-2 ${isHome ? 'flex-row' : 'flex-row-reverse'}`}>
                <div className={`p-1.5 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2 ${isHome ? 'flex-row' : 'flex-row-reverse'}`}>
                  <EventIcon type={event.type} detail={event.detail} />
                  <div className={`flex flex-col ${isHome ? 'items-start' : 'items-end'}`}>
                    <span className="font-bold text-xs leading-tight">
                      {event.player.name}
                      {detailMsg && <span className="ml-1 text-[8px] font-bold text-orange-400 bg-orange-500/10 px-1 py-0.5 rounded tracking-widest uppercase">{detailMsg}</span>}
                    </span>
                    {event.type === 'Goal' && event.assist.name && event.assist.name !== event.player.name && !event.detail?.toLowerCase().includes('penalty') && !event.detail?.toLowerCase().includes('own goal') && (
                      <span className="text-[9px] text-gray-500 italic leading-tight">Passe: {event.assist.name}</span>
                    )}
                    {event.type === 'subst' && (
                      <span className="text-[9px] text-gray-500 italic leading-tight">Sortie: {event.assist.name}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex-1"></div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function DuelsTab({ history, teams, setSelectedDuelDetails }: { history: any[]; teams: any; setSelectedDuelDetails: (id: string) => void }) {
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
        {history.map((duel, idx) => {
          const scoreA = duel.scoreA || 0;
          const scoreB = duel.scoreB || 0;
          const isHomeWinner = scoreA > scoreB;
          const isAwayWinner = scoreB > scoreA;

          let typeLabel = duel.type || 'Duel';
          if (duel.type === 'war_of_kops') typeLabel = 'Guerre des KOPs';
          else if (duel.type === '1v1') typeLabel = 'Combat 1v1';
          else if (duel.type === '2v2') typeLabel = 'Duel 2v2';
          else if (duel.type === '5v5') typeLabel = 'Duel 5v5';
          else if (duel.type === 'training') typeLabel = 'Entraînement';

          // Format Date elegantly
          let formattedDate = '';
          if (duel.timestamp?.seconds) {
            formattedDate = format(new Date(duel.timestamp.seconds * 1000), "d MMM yyyy 'à' HH:mm", { locale: fr });
          } else if (duel.timestamp) {
            formattedDate = format(new Date(duel.timestamp), "d MMM yyyy 'à' HH:mm", { locale: fr });
          }

          return (
            <div 
              key={duel.id || idx} 
              className={`group border rounded-2xl p-4 cursor-pointer transition-all duration-300 relative overflow-hidden ${
                isHomeWinner 
                  ? 'bg-gradient-to-r from-orange-950/20 via-orange-500/5 to-white/[0.02] border-orange-500/20 hover:border-orange-500/50 hover:shadow-[0_0_20px_rgba(249,115,22,0.15)]' 
                  : isAwayWinner 
                  ? 'bg-gradient-to-l from-blue-950/20 via-blue-500/5 to-white/[0.02] border-blue-500/20 hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                  : 'bg-white/[0.03] border-white/5 hover:border-white/10 hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]'
              } hover:-translate-y-0.5`}
              onClick={() => setSelectedDuelDetails(duel.id)}
            >
              {/* Radial glow background for winners */}
              {isHomeWinner && (
                <div className="absolute top-1/2 left-0 -translate-y-1/2 w-32 h-32 bg-orange-500/10 rounded-full blur-[40px] pointer-events-none -z-10 transition-transform duration-500 group-hover:scale-125" />
              )}
              {isAwayWinner && (
                <div className="absolute top-1/2 right-0 -translate-y-1/2 w-32 h-32 bg-blue-500/10 rounded-full blur-[40px] pointer-events-none -z-10 transition-transform duration-500 group-hover:scale-125" />
              )}

              {/* Decorative side accent lines */}
              {isHomeWinner && (
                <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-orange-400 via-amber-500 to-orange-600 shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
              )}
              {isAwayWinner && (
                <div className="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-blue-400 via-indigo-500 to-blue-600 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
              )}

              <div className="flex justify-between items-center mb-3.5">
                <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  duel.type === 'war_of_kops'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : isHomeWinner
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : isAwayWinner
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-white/10 text-white/70 border border-white/10'
                }`}>
                  {typeLabel}
                </span>
                <span className="text-[8px] font-bold text-gray-400 group-hover:text-gray-300 transition-colors">
                  {formattedDate}
                </span>
              </div>
              
              <div className="flex items-center justify-between gap-3">
                {/* Left (Home Team) */}
                <div className={`flex-1 flex items-center gap-3 min-w-0 transition-opacity duration-300 ${
                  isAwayWinner ? 'opacity-30 group-hover:opacity-40' : 'opacity-100'
                }`}>
                  <div className="relative shrink-0">
                    {/* Ring aura around home logo if winner */}
                    {isHomeWinner && (
                      <div className="absolute inset-0 rounded-full bg-orange-500/25 blur-sm scale-110 animate-pulse pointer-events-none" />
                    )}
                    {teams.home?.logo && (
                      <div className={`w-10 h-10 rounded-full bg-black/40 p-1.5 flex items-center justify-center border transition-all duration-300 ${
                        isHomeWinner ? 'border-orange-500/50 scale-105 shadow-[0_0_12px_rgba(249,115,22,0.2)]' : 'border-white/5'
                      }`}>
                        <img 
                          src={getImageUrl(teams.home.logo)} 
                          alt={teams.home.name} 
                          className="w-7 h-7 object-contain transition-transform duration-300 group-hover:scale-105" 
                          referrerPolicy="no-referrer" 
                        />
                      </div>
                    )}
                    {isHomeWinner && (
                      <div className="absolute -top-1 -left-1 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full p-1 shadow-lg border border-black animate-bounce">
                        <Trophy className="w-2.5 h-2.5 text-black fill-yellow-400" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className={`text-[10px] uppercase truncate transition-colors duration-300 ${isHomeWinner ? 'text-orange-400 font-extrabold' : 'text-gray-300 font-semibold'}`}>
                      {teams.home.name}
                    </div>
                    <div className="text-[7px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">Hôte</div>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className={`text-xl tabular-nums transition-all leading-none ${
                        isHomeWinner 
                          ? 'text-orange-400 font-black scale-110 drop-shadow-[0_0_10px_rgba(249,115,22,0.5)]' 
                          : 'text-white font-bold'
                    }`}>
                      {scoreA}
                    </div>
                    {isHomeWinner && (
                      <span className="text-[7px] font-black text-amber-400 uppercase tracking-widest mt-1 animate-pulse">Victoire</span>
                    )}
                  </div>
                </div>
                
                {/* Separator */}
                <div className="flex flex-col items-center justify-center shrink-0 px-2 select-none">
                  <span className="text-[8px] font-black tracking-widest text-gray-600 group-hover:text-gray-500 transition-colors">VS</span>
                </div>
                
                {/* Right (Away Team) */}
                <div className={`flex-1 flex items-center justify-end gap-3 min-w-0 transition-opacity duration-300 ${
                  isHomeWinner ? 'opacity-30 group-hover:opacity-40' : 'opacity-100'
                }`}>
                  <div className="flex flex-col items-center">
                    <div className={`text-xl tabular-nums transition-all leading-none ${
                        isAwayWinner 
                          ? 'text-blue-400 font-black scale-110 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]' 
                          : 'text-white font-bold'
                    }`}>
                      {scoreB}
                    </div>
                    {isAwayWinner && (
                      <span className="text-[7px] font-black text-blue-400 uppercase tracking-widest mt-1 animate-pulse">Victoire</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 text-right">
                    <div className={`text-[10px] uppercase truncate transition-colors duration-300 ${isAwayWinner ? 'text-blue-400 font-extrabold' : 'text-gray-300 font-semibold'}`}>
                      {teams.away.name}
                    </div>
                    <div className="text-[7px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">Visiteur</div>
                  </div>

                  <div className="relative shrink-0">
                    {/* Ring aura around away logo if winner */}
                    {isAwayWinner && (
                      <div className="absolute inset-0 rounded-full bg-blue-500/25 blur-sm scale-110 animate-pulse pointer-events-none" />
                    )}
                    {teams.away?.logo && (
                      <div className={`w-10 h-10 rounded-full bg-black/40 p-1.5 flex items-center justify-center border transition-all duration-300 ${
                        isAwayWinner ? 'border-blue-500/50 scale-105 shadow-[0_0_12px_rgba(59,130,246,0.2)]' : 'border-white/5'
                      }`}>
                        <img 
                          src={getImageUrl(teams.away.logo)} 
                          alt={teams.away.name} 
                          className="w-7 h-7 object-contain transition-transform duration-300 group-hover:scale-105" 
                          referrerPolicy="no-referrer" 
                        />
                      </div>
                    )}
                    {isAwayWinner && (
                      <div className="absolute -top-1 -right-1 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full p-1 shadow-lg border border-black animate-bounce">
                        <Trophy className="w-2.5 h-2.5 text-black fill-yellow-400" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventIcon({ type, detail }: { type: string; detail: string }) {
  switch (type) {
    case 'Goal':
      if (detail?.toLowerCase().includes('missed penalty')) {
        return <X className="w-4 h-4 text-red-500" />;
      }
      return <CircleDot className="w-4 h-4 text-green-500" />;
    case 'Card':
      return <Square className={`w-4 h-4 ${detail?.includes('Yellow') ? 'text-yellow-500 fill-yellow-500' : 'text-red-500 fill-red-500'}`} />;
    case 'subst':
      return <ArrowRightLeft className="w-4 h-4 text-blue-500" />;
    case 'Var':
      return <MonitorPlay className="w-4 h-4 text-orange-500" />;
    default:
      return <AlertCircle className="w-4 h-4 text-gray-500" />;
  }
}

function LineupsTab({ lineups, status, season, onPlayerClick }: { lineups: any[]; status: string; season: number; onPlayerClick?: (id: number, season: number) => void }) {
  if (lineups.length === 0) {
    const isUpcoming = ['TBD', 'NS'].includes(status);
    const isCancelled = ['SUSP', 'INT', 'PST', 'CANC', 'ABD', 'AWD', 'WO'].includes(status);
    let message = "Compositions non disponibles.";
    if (isUpcoming) message = "Les compositions d'équipe seront dévoilées environ une heure avant le coup d'envoi.";
    else if (isCancelled) message = "Match sans compositions en raison de son annulation ou report.";
    else message = "Les compositions pour de ce match ne sont pas couvertes par notre fournisseur.";

    return (
      <Card className="py-6 text-center text-gray-500 text-xs font-bold italic">
        {message}
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
                  <PlayerRow key={p.player.id} player={p.player} season={season} onPlayerClick={onPlayerClick} />
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-[9px] font-black uppercase text-gray-500 tracking-widest mb-2">Remplaçants</h4>
              <div className="space-y-1.5">
                {lineup.substitutes.map((p: any) => (
                  <PlayerRow key={p.player.id} player={p.player} season={season} onPlayerClick={onPlayerClick} />
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

function PlayerRow({ player, season, onPlayerClick }: { player: any; season: number; onPlayerClick?: (id: number, season: number) => void }) {
  return (
    <div 
      className={`flex items-center gap-2 p-1.5 bg-white/5 rounded-lg border border-white/5 transition-colors ${onPlayerClick ? 'cursor-pointer hover:border-orange-500/50 hover:bg-white/10' : 'hover:border-white/10'}`}
      onClick={() => onPlayerClick && onPlayerClick(player.id, season)}
    >
      <div className="w-5 h-5 bg-gray-800 rounded flex items-center justify-center text-[9px] font-black text-gray-400">
        {player.number}
      </div>
      <div className="flex flex-col">
        <span className={`text-xs font-bold leading-tight ${onPlayerClick ? 'hover:text-orange-500' : ''}`}>{player.name}</span>
        <span className="text-[9px] text-gray-500 uppercase font-bold tracking-tighter leading-tight">{player.pos}</span>
      </div>
    </div>
  );
}

function StatsTab({ stats, teams, status }: { stats: any[]; teams: any; status: string }) {
  if (stats.length === 0) {
    const isUpcoming = ['TBD', 'NS'].includes(status);
    const isCancelled = ['SUSP', 'INT', 'PST', 'CANC', 'ABD', 'AWD', 'WO'].includes(status);
    let message = "Statistiques non disponibles.";
    if (isUpcoming) message = "Les statistiques apparaîtront en direct après le coup d'envoi.";
    else if (isCancelled) message = "Aucune statistique pour ce match (annulé ou reporté).";
    else message = "Les statistiques de ce match ne sont pas couvertes par notre fournisseur.";

    return (
      <Card className="py-6 text-center text-gray-500 text-xs font-bold italic">
        {message}
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
