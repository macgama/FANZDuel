import React from 'react';
import { format } from 'date-fns';
import { Flame, Star, Activity } from 'lucide-react';
import { cn, getImageUrl } from '../lib/utils';
import { translateCountryName, translateLeagueName } from '../utils/countryTranslations';
import { Card } from './ui/card';

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
  showLeagueHeader = false
}: SharedMatchCardProps) {
  const isLive = ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE'].includes(match.fixture.status.short);
  const isUpcoming = ['TBD', 'NS'].includes(match.fixture.status.short);
  const isFinished = !isLive && !isUpcoming;
  
  const favoriteIds = profile?.favoriteTeams?.map((id: any) => id.toString()) || [];
  const homeIsFav = favoriteIds.includes(match.teams.home.id.toString());
  const awayIsFav = favoriteIds.includes(match.teams.away.id.toString());

  // Extract events if they exist
  const homeEvents = match.events?.filter((e: any) => e.team.id === match.teams.home.id && (e.type === 'Goal' || e.type === 'Card')) || [];
  const awayEvents = match.events?.filter((e: any) => e.team.id === match.teams.away.id && (e.type === 'Goal' || e.type === 'Card')) || [];

  const scoreA = matchScore?.scoreA || 0;
  const scoreB = matchScore?.scoreB || 0;
  const totalScore = scoreA + scoreB;
  const hasScore = totalScore > 0;
  
  let dominanceA = 50;
  let dominanceB = 50;
  if (hasScore) {
    dominanceA = Math.round((scoreA / totalScore) * 100);
    dominanceB = 100 - dominanceA;
  }

  return (
    <Card 
      onClick={() => onClick()}
      className="bg-[#1a1a1a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden group hover:bg-white/5 transition-colors cursor-pointer w-full"
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
            {match.league?.logo && <img src={getImageUrl(match.league.logo, 40)} alt="" className="w-4 h-4 object-contain shrink-0" referrerPolicy="no-referrer" />}
            <span className="truncate">{translateLeagueName(match.league?.name || '')}</span>
          </div>
        </div>
      )}

      {/* Teams & Score */}
      <div className="flex justify-between items-start mt-2">
        {/* Home Team */}
        <div 
          className="flex flex-col items-center gap-2 flex-1 cursor-pointer group/team min-w-0"
          onClick={(e) => {
            e.stopPropagation();
            if (onTeamClick && match.teams.home) {
              onTeamClick(match.teams.home.id, match.league?.season || new Date().getFullYear());
            }
          }}
        >
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-full p-1.5 flex items-center justify-center group-hover/team:scale-105 transition-transform relative">
            <img src={getImageUrl(match.teams.home.logo, 100)} alt="" className="w-8 h-8 sm:w-10 sm:h-10 object-contain" referrerPolicy="no-referrer" />
            {homeIsFav && (
              <div className="absolute -top-1 -right-1 bg-black rounded-full p-0.5 border border-orange-500">
                <Star className="w-3 h-3 text-orange-500 fill-orange-500" />
              </div>
            )}
          </div>
          <span className={cn("font-black text-[10px] sm:text-xs text-center uppercase leading-tight h-8 flex items-center justify-center group-hover/team:text-orange-500 transition-colors line-clamp-2 w-full px-1", homeIsFav && "text-orange-500")}>
            {match.teams.home.name}
          </span>
          {(isLive || isFinished) && (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-full px-2.5 py-1 flex items-center gap-1 mt-1">
              <Flame className="w-3 h-3 text-orange-500" />
              <span className="text-[10px] sm:text-xs font-black text-orange-500">{hasScore ? scoreA + ' PTS' : '0 PTS'}</span>
            </div>
          )}
        </div>

        {/* Score & Time */}
        <div className="flex flex-col items-center justify-center px-2 sm:px-3 shrink-0">
          {isFinished || isLive ? (
            <>
              <div className="text-3xl sm:text-4xl font-black tracking-tighter flex items-center gap-1">
                <span className={isLive ? 'text-orange-500' : ''}>{match.goals.home ?? 0}</span>
                <span className="text-orange-500">:</span>
                <span className={isLive ? 'text-orange-500' : ''}>{match.goals.away ?? 0}</span>
              </div>
              
              {match.score?.penalty?.home != null && (
                <div className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider">
                  ({match.score.penalty.home} - {match.score.penalty.away} TAB)
                </div>
              )}
              
              <div className="mt-2 bg-orange-500/20 border border-orange-500/30 rounded-full px-3 py-1 flex items-center justify-center">
                <span className="text-[10px] sm:text-xs font-black text-orange-500 uppercase">
                  {match.fixture.status.elapsed ? `${match.fixture.status.elapsed}${match.fixture.status.extra ? `+${match.fixture.status.extra}` : ''}'` : match.fixture.status.short}
                </span>
              </div>
            </>
          ) : (
            <div className="text-xs sm:text-sm font-bold text-white/80 bg-white/5 px-3 py-1.5 rounded border border-white/10 mt-6">
              {format(new Date(match.fixture.date), 'HH:mm')}
            </div>
          )}
        </div>

        {/* Away Team */}
        <div 
          className="flex flex-col items-center gap-2 flex-1 cursor-pointer group/team min-w-0"
          onClick={(e) => {
            e.stopPropagation();
            if (onTeamClick && match.teams.away) {
              onTeamClick(match.teams.away.id, match.league?.season || new Date().getFullYear());
            }
          }}
        >
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-full p-1.5 flex items-center justify-center group-hover/team:scale-105 transition-transform relative">
            <img src={getImageUrl(match.teams.away.logo, 100)} alt="" className="w-8 h-8 sm:w-10 sm:h-10 object-contain" referrerPolicy="no-referrer" />
            {awayIsFav && (
              <div className="absolute -top-1 -right-1 bg-black rounded-full p-0.5 border border-orange-500">
                <Star className="w-3 h-3 text-orange-500 fill-orange-500" />
              </div>
            )}
          </div>
          <span className={cn("font-black text-[10px] sm:text-xs text-center uppercase leading-tight h-8 flex items-center justify-center group-hover/team:text-blue-500 transition-colors line-clamp-2 w-full px-1", awayIsFav && "text-blue-500")}>
            {match.teams.away.name}
          </span>
          {(isLive || isFinished) && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-full px-2.5 py-1 flex items-center gap-1 mt-1">
              <Flame className="w-3 h-3 text-blue-500" />
              <span className="text-[10px] sm:text-xs font-black text-blue-500">{hasScore ? scoreB + ' PTS' : '0 PTS'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Match Events */}
      {(homeEvents.length > 0 || awayEvents.length > 0) && (
        <div className="flex justify-between items-start text-[9px] sm:text-[10px] text-gray-300 px-2 mt-1 min-h-[30px] max-h-[60px] overflow-y-auto no-scrollbar gap-2">
          <div className="flex-1 flex flex-col items-start gap-1">
            {homeEvents.map((e: any, idx: number) => (
              <div key={idx} className="flex items-center gap-1">
                <span className="text-gray-500 w-4">{e.time.elapsed}'</span>
                {e.type === 'Goal' ? <span>⚽</span> : 
                 e.detail === 'Yellow Card' ? <div className="w-1.5 h-2.5 bg-yellow-500 rounded-[1px]" /> :
                 <div className="w-1.5 h-2.5 bg-red-500 rounded-[1px]" />}
                <span className="truncate max-w-[80px]">{e.player.name}</span>
              </div>
            ))}
          </div>
          <div className="flex-1 flex flex-col items-end gap-1">
            {awayEvents.map((e: any, idx: number) => (
              <div key={idx} className="flex items-center gap-1 justify-end">
                <span className="truncate max-w-[80px] text-right">{e.player.name}</span>
                {e.type === 'Goal' ? <span>⚽</span> : 
                 e.detail === 'Yellow Card' ? <div className="w-1.5 h-2.5 bg-yellow-500 rounded-[1px]" /> :
                 <div className="w-1.5 h-2.5 bg-red-500 rounded-[1px]" />}
                <span className="text-gray-500 w-4 text-right">{e.time.elapsed}'</span>
              </div>
            ))}
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
