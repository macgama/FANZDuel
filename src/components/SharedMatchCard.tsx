import React from 'react';
import { format } from 'date-fns';
import { Flame, Star, Activity, CircleDot, ArrowRightLeft, MonitorPlay, X, AlertCircle, Clock } from 'lucide-react';
import { cn, getImageUrl } from '../lib/utils';
import { translateCountryName, translateLeagueName } from '../utils/countryTranslations';
import { Card } from './ui/card';
import { FavoriteLeagueStar } from './FavoriteLeagueStar';

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

interface SharedMatchCardProps {
  match: any;
  hasActiveDuel: boolean;
  matchScore?: { scoreA: number; scoreB: number };
  onClick: (tab?: 'summary' | 'lineups' | 'stats' | 'duels') => void;
  onJoinDuel: (isLive: boolean) => void;
  onTeamClick: (id: number, season: number) => void;
  onLeagueClick?: (id: number, season: number) => void;
  profile: any;
  showLeagueHeader?: boolean;
  showDate?: boolean;
}

export function SharedMatchCard({ 
  match, 
  hasActiveDuel, 
  matchScore, 
  onClick, 
  onJoinDuel, 
  onTeamClick, 
  onLeagueClick,
  profile,
  showLeagueHeader = false,
  showDate = true
}: SharedMatchCardProps) {
  const isLive = ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE'].includes(match.fixture.status.short);
  const isUpcoming = ['TBD', 'NS'].includes(match.fixture.status.short);
  const isFinished = ['FT', 'AET', 'PEN'].includes(match.fixture.status.short);
  
  const favoriteIds = profile?.favoriteTeams?.map((id: any) => id.toString()) || [];
  const homeIsFav = favoriteIds.includes(match.teams.home.id.toString());
  const awayIsFav = favoriteIds.includes(match.teams.away.id.toString());

  // Extract and translate details for events
  const translateDetail = (type: string, detail: string, comments?: string) => {
    const combined = `${detail || ''} ${comments || ''}`.toLowerCase();
    if (type === 'Goal') {
      if (combined.includes('missed penalty')) return 'Penalty manqué';
      if (combined.includes('own goal') || combined.includes('csc')) return 'CSC';
      if (combined.includes('penalty')) return 'Penalty';
      if (combined.includes('cancelled')) return 'But annulé (VAR)';
      return null;
    }
    if (type === 'Card') {
      if (combined.includes('second yellow')) return '2ème jaune';
      if (combined.includes('red')) return 'Rouge';
      return null;
    }
    if (type === 'Var') {
      if (combined.includes('goal cancelled')) return 'But annulé';
      if (combined.includes('penalty confirmed')) return 'Penalty conf.';
      if (combined.includes('card review')) return 'Arbitre';
      return detail;
    }
    return null;
  };

  const getEventIcon = (type: string, detail: string, comments?: string) => {
    const combined = `${detail || ''} ${comments || ''}`.toLowerCase();
    switch (type) {
      case 'Goal':
        if (combined.includes('missed penalty')) {
          return <X className="w-3 h-3 text-red-500 shrink-0" />;
        }
        return <CircleDot className="w-3 h-3 text-green-500 shrink-0" />;
      case 'Card':
        return (
          <div 
            className={cn(
              "w-1.5 h-2.5 rounded-[1px] shrink-0", 
              combined.includes('yellow') ? "bg-yellow-500" : "bg-red-500"
            )} 
          />
        );
      case 'subst':
        return <ArrowRightLeft className="w-3 h-3 text-blue-400 shrink-0 font-bold" />;
      case 'Var':
        return <MonitorPlay className="w-3 h-3 text-orange-400 shrink-0" />;
      default:
        return <AlertCircle className="w-3 h-3 text-gray-500 shrink-0" />;
    }
  };

  const homeEvents = match.events?.filter((e: any) => e.team.id === match.teams.home.id && (e.type === 'Goal' || e.type === 'Card' || e.type === 'subst' || e.type === 'Var')) || [];
  const awayEvents = match.events?.filter((e: any) => e.team.id === match.teams.away.id && (e.type === 'Goal' || e.type === 'Card' || e.type === 'subst' || e.type === 'Var')) || [];

  const scoreA = matchScore?.scoreA || 0;
  const scoreB = matchScore?.scoreB || 0;
  const totalScore = scoreA + scoreB;
  const hasScore = totalScore > 0;
  const isHomeWinner = (isLive || isFinished) && hasScore && scoreA > scoreB;
  const isAwayWinner = (isLive || isFinished) && hasScore && scoreB > scoreA;
  
  let dominanceA = 50;
  let dominanceB = 50;
  if (hasScore) {
    dominanceA = Math.round((scoreA / totalScore) * 100);
    dominanceB = 100 - dominanceA;
  }

  return (
    <Card 
      onClick={() => onClick()}
      className={cn("bg-[#1a1a1a]/80 backdrop-blur-xl border rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden group hover:bg-white/5 transition-colors cursor-pointer w-full h-full min-h-[250px] justify-between", (isLive && (homeIsFav || awayIsFav)) ? "border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.15)]" : "border-white/10")}
    >
      {showLeagueHeader && (
        <div className="flex justify-between items-center text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {match.league?.flag && <img src={getImageUrl(match.league.flag, 40)} alt="" className="w-4 h-3 object-cover rounded-sm" referrerPolicy="no-referrer" />}
            <span className="truncate">{translateCountryName(match.league?.country || '')}</span>
          </div>
          <div 
            className="flex items-center gap-1.5 cursor-pointer hover:text-orange-500 transition-colors min-w-0"
            onClick={(e) => {
              if (onLeagueClick && match.league) {
                e.stopPropagation();
                onLeagueClick(match.league.id, match.league.season || new Date().getFullYear());
              }
            }}
          >
            {match.league && (
              <FavoriteLeagueStar 
                leagueId={match.league.id} 
                profile={profile}
                className="p-1 -mr-0.5 z-10" 
                iconClassName="w-3.5 h-3.5"
              />
            )}
            {match.league?.logo && <img src={getImageUrl(match.league.logo, 40)} alt="" className="w-4 h-4 object-contain shrink-0" referrerPolicy="no-referrer" />}
            <span className="truncate">{translateLeagueName(match.league?.name || '')}</span>
          </div>
        </div>
      )}

      {showDate && (
        <div className="text-center w-full text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest -mt-1 mb-2">
          {format(new Date(match.fixture.date), 'dd/MM/yyyy • HH:mm')}
        </div>
      )}

      {/* Teams & Score */}
      <div className="flex justify-between items-start mt-2">
        {/* Home Team */}
        <div 
          className={cn(
            "flex flex-col items-center gap-2 flex-1 cursor-pointer group/team min-w-0 transition-all duration-300",
            isAwayWinner ? "opacity-75 grayscale-[10%] scale-95" : isHomeWinner ? "scale-105" : ""
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (onTeamClick && match.teams.home) {
              onTeamClick(match.teams.home.id, match.league?.season || new Date().getFullYear());
            }
          }}
        >
          <div className={cn(
            "w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center transition-all duration-300 relative rounded-full",
            isHomeWinner && "bg-orange-500/15 ring-2 ring-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.4)]"
          )}>
            <img src={getImageUrl(match.teams.home.logo, 100)} alt="" className="w-10 h-10 sm:w-12 sm:h-12 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" referrerPolicy="no-referrer" />
            {homeIsFav && (
              <div className="absolute -top-1 -right-1 bg-black rounded-full p-0.5 border border-orange-500 z-10">
                <Star className="w-3 h-3 text-orange-500 fill-orange-500" />
              </div>
            )}
            {isHomeWinner && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-black text-[7px] sm:text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-lg border border-yellow-300 uppercase tracking-widest flex items-center gap-0.5 pointer-events-none whitespace-nowrap z-20">
                🏆 {isLive ? "MÈNE" : "GAGNANT"}
              </div>
            )}
          </div>
          <span className={cn(
            "font-black text-[10px] sm:text-xs text-center uppercase leading-tight h-8 flex items-center justify-center group-hover/team:text-orange-500 transition-colors line-clamp-2 w-full px-1", 
            homeIsFav ? "text-orange-500" : "text-white",
            isHomeWinner && "text-orange-500 font-extrabold scale-105"
          )}>
            {match.teams.home.name}
          </span>
          {(isLive || isFinished) && (
            <div className={cn(
              "rounded-full px-2.5 py-1 flex items-center gap-1 mt-1 transition-all duration-300",
              isHomeWinner 
                ? "bg-gradient-to-r from-orange-500/20 to-orange-600/30 border-2 border-orange-500 shadow-[0_0_12px_rgba(249,115,22,0.4)] scale-110" 
                : isAwayWinner 
                  ? "bg-stone-800/60 border border-white/5 opacity-90 scale-90"
                  : "bg-orange-500/10 border border-orange-500/20"
            )}>
              <Flame className={cn("w-3 h-3 text-orange-500", isHomeWinner && "animate-bounce")} />
              <span className={cn("text-[10px] sm:text-xs font-black text-orange-500", isHomeWinner && "text-[11px] sm:text-sm")}>{hasScore ? scoreA + ' PTS' : '0 PTS'}</span>
            </div>
          )}
        </div>

        {/* Score & Time */}
        <div className="flex flex-col items-center justify-center px-2 sm:px-3 shrink-0">
          {isFinished || isLive ? (
            <>
              <div className="text-3xl sm:text-4xl font-black tracking-tighter flex items-center gap-1">
                <span className={cn(isLive ? 'text-orange-500' : 'text-white', isAwayWinner && 'opacity-60')}>{match.goals.home ?? 0}</span>
                <span className="text-orange-500">:</span>
                <span className={cn(isLive ? 'text-orange-500' : 'text-white', isHomeWinner && 'opacity-60')}>{match.goals.away ?? 0}</span>
              </div>
              
              {match.score?.penalty?.home != null && (
                <div className="text-[10px] sm:text-[11px] font-black text-red-400 mt-1 uppercase tracking-wider bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20 shadow-md">
                  ({match.score.penalty.home} - {match.score.penalty.away} TAB)
                </div>
              )}
              
              {!isFinished ? (
                <>
                  <div className="mt-2 bg-orange-500/20 border border-orange-500/30 rounded-full px-3 py-1 flex items-center justify-center gap-0.5 shadow-sm">
                    <span className="text-[10px] sm:text-xs font-black text-orange-500 uppercase">
                      {match.fixture.status.elapsed ? `${match.fixture.status.elapsed}${match.fixture.status.extra ? `+${match.fixture.status.extra}` : ''}` : match.fixture.status.short}
                    </span>
                    {match.fixture.status.elapsed && <span className="text-[10px] sm:text-xs font-black text-orange-500 uppercase animate-pulse">'</span>}
                  </div>
                  <span className={cn(
                    "text-[7px] sm:text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shadow-sm text-center mt-1.5",
                    ['ET', 'P', 'BT'].includes(match.fixture.status.short)
                      ? "bg-[#ef4444] text-white animate-pulse"
                      : "bg-[#2a2a2a] text-gray-400"
                  )}>
                    {getMatchStatusLabel(match.fixture.status)}
                  </span>
                </>
              ) : (
                <div className="mt-2 bg-orange-500/15 border border-orange-500/20 rounded-full px-3 py-1 flex items-center justify-center shadow-sm">
                  <span className="text-[10px] sm:text-xs font-black text-orange-400 uppercase tracking-widest">
                    {getMatchStatusLabel(match.fixture.status)}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-1.5 mt-6">
              <div className="text-xs sm:text-sm font-bold text-white/80 bg-white/5 px-3 py-1.5 rounded border border-white/10">
                {format(new Date(match.fixture.date), 'HH:mm')}
              </div>
              <span className="text-[7.5px] sm:text-[9px] font-black uppercase tracking-wider text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20 text-center">
                {getMatchStatusLabel(match.fixture.status)}
              </span>
            </div>
          )}
        </div>

        {/* Away Team */}
        <div 
          className={cn(
            "flex flex-col items-center gap-2 flex-1 cursor-pointer group/team min-w-0 transition-all duration-300",
            isHomeWinner ? "opacity-75 grayscale-[10%] scale-95" : isAwayWinner ? "scale-105" : ""
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (onTeamClick && match.teams.away) {
              onTeamClick(match.teams.away.id, match.league?.season || new Date().getFullYear());
            }
          }}
        >
          <div className={cn(
            "w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center transition-all duration-300 relative rounded-full",
            isAwayWinner && "bg-blue-500/15 ring-2 ring-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.4)]"
          )}>
            <img src={getImageUrl(match.teams.away.logo, 100)} alt="" className="w-10 h-10 sm:w-12 sm:h-12 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" referrerPolicy="no-referrer" />
            {awayIsFav && (
              <div className="absolute -top-1 -right-1 bg-black rounded-full p-0.5 border border-orange-500 z-10">
                <Star className="w-3 h-3 text-orange-500 fill-orange-500" />
              </div>
            )}
            {isAwayWinner && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-teal-400 to-blue-500 text-white text-[7px] sm:text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-lg border border-blue-300 uppercase tracking-widest flex items-center gap-0.5 pointer-events-none whitespace-nowrap z-20">
                🏆 {isLive ? "MÈNE" : "GAGNANT"}
              </div>
            )}
          </div>
          <span className={cn(
            "font-black text-[10px] sm:text-xs text-center uppercase leading-tight h-8 flex items-center justify-center group-hover/team:text-blue-500 transition-colors line-clamp-2 w-full px-1", 
            awayIsFav ? "text-blue-500" : "text-white",
            isAwayWinner && "text-blue-500 font-extrabold scale-105"
          )}>
            {match.teams.away.name}
          </span>
          {(isLive || isFinished) && (
            <div className={cn(
              "rounded-full px-2.5 py-1 flex items-center gap-1 mt-1 transition-all duration-300",
              isAwayWinner 
                ? "bg-gradient-to-r from-blue-500/20 to-blue-600/30 border-2 border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.4)] scale-110" 
                : isHomeWinner 
                  ? "bg-stone-800/60 border border-white/5 opacity-90 scale-90"
                  : "bg-blue-500/10 border border-blue-500/20"
            )}>
              <Flame className={cn("w-3 h-3 text-blue-500", isAwayWinner && "animate-bounce")} />
              <span className={cn("text-[10px] sm:text-xs font-black text-blue-500", isAwayWinner && "text-[11px] sm:text-sm")}>{hasScore ? scoreB + ' PTS' : '0 PTS'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Match Events */}
      {(homeEvents.length > 0 || awayEvents.length > 0) && (
        <div className="flex justify-between items-start text-[9px] sm:text-[10px] text-gray-300 px-2 mt-1 min-h-[35px] max-h-[90px] overflow-y-auto no-scrollbar gap-2">
          {/* Home team events */}
          <div className="flex-1 flex flex-col items-start gap-1 min-w-0">
            {homeEvents.map((e: any, idx: number) => {
              const detailMsg = translateDetail(e.type, e.detail, e.comments);
              const combinedDetail = `${e.detail || ''} ${e.comments || ''}`.toLowerCase();
              const showAssist = e.type === 'Goal' && e.assist.name && e.assist.name !== e.player?.name && !combinedDetail.includes('penalty') && !combinedDetail.includes('own goal') && !combinedDetail.includes('csc');
              const showSubst = e.type === 'subst' && e.assist?.name;
              const playerName = e.player?.name || (combinedDetail.includes('own goal') || combinedDetail.includes('csc') ? "Joueur Inconnu" : "Inconnu");
              
              return (
                <div key={idx} className="flex flex-col items-start gap-0.5 w-full min-w-0">
                  <div className="flex items-center gap-1.5 w-full min-w-0">
                    <span className="text-gray-500 font-bold tabular-nums shrink-0">{e.time.elapsed}'</span>
                    {getEventIcon(e.type, e.detail, e.comments)}
                    <span className="truncate font-bold text-white/95 shrink">{playerName}</span>
                    {detailMsg && (
                      <span className="text-[7px] leading-tight font-black text-orange-400 bg-orange-500/10 px-1 py-0.5 rounded uppercase font-sans shrink-0 tracking-wider">
                        {detailMsg}
                      </span>
                    )}
                  </div>
                  {showAssist && (
                    <span className="text-[7px] sm:text-[8px] text-gray-500 italic pl-5 leading-none shrink-0 truncate max-w-full">
                      Passe: {e.assist.name}
                    </span>
                  )}
                  {showSubst && (
                    <span className="text-[7px] sm:text-[8px] text-gray-500 italic pl-5 leading-none shrink-0 truncate max-w-full">
                      Sortie: {e.assist.name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {/* Away team events */}
          <div className="flex-1 flex flex-col items-end gap-1 min-w-0">
            {awayEvents.map((e: any, idx: number) => {
              const detailMsg = translateDetail(e.type, e.detail, e.comments);
              const combinedDetail = `${e.detail || ''} ${e.comments || ''}`.toLowerCase();
              const showAssist = e.type === 'Goal' && e.assist.name && e.assist.name !== e.player?.name && !combinedDetail.includes('penalty') && !combinedDetail.includes('own goal') && !combinedDetail.includes('csc');
              const showSubst = e.type === 'subst' && e.assist?.name;
              const playerName = e.player?.name || (combinedDetail.includes('own goal') || combinedDetail.includes('csc') ? "Joueur Inconnu" : "Inconnu");
              
              return (
                <div key={idx} className="flex flex-col items-end gap-0.5 w-full min-w-0">
                  <div className="flex items-center gap-1.5 w-full min-w-0 justify-end">
                    {detailMsg && (
                      <span className="text-[7px] leading-tight font-black text-orange-400 bg-orange-500/10 px-1 py-0.5 rounded uppercase font-sans shrink-0 tracking-wider">
                        {detailMsg}
                      </span>
                    )}
                    <span className="truncate font-bold text-white/95 text-right shrink">{playerName}</span>
                    {getEventIcon(e.type, e.detail, e.comments)}
                    <span className="text-gray-500 font-bold tabular-nums shrink-0 text-right">{e.time.elapsed}'</span>
                  </div>
                  {showAssist && (
                    <span className="text-[7px] sm:text-[8px] text-gray-500 italic pr-5 leading-none text-right shrink-0 truncate max-w-full">
                      Passe: {e.assist.name}
                    </span>
                  )}
                  {showSubst && (
                    <span className="text-[7px] sm:text-[8px] text-gray-500 italic pr-5 leading-none text-right shrink-0 truncate max-w-full">
                      Sortie: {e.assist.name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dominance Bar (Live or Finished) */}
      {(isLive || isFinished) && (
        <div className="mt-3">
          {isFinished && totalScore === 0 ? (
            <div className="text-center py-2">
              <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest">
                Aucun duel TBFO n'a été joué
              </span>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-2 flex gap-2 sm:gap-3" onClick={e => e.stopPropagation()}>
        <button 
          onClick={() => onClick()}
          className="flex-1 py-2.5 rounded-xl border border-white/20 bg-white/5 text-white font-black text-[10px] sm:text-xs uppercase tracking-wider hover:bg-white/10 transition-colors"
        >
          Détails
        </button>
        {isLive && (
          <button 
            onClick={() => onJoinDuel(isLive)}
            className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white font-black text-[10px] sm:text-xs uppercase tracking-wider hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
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
        )}
      </div>
    </Card>
  );
}
