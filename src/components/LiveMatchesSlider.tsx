import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { SharedMatchCard } from './SharedMatchCard';

interface LiveMatchesSliderProps {
  matches: any[];
  activeDuels: any[];
  matchScores: Record<string, { scoreA: number, scoreB: number }>;
  onMatchClick: (id: number, tab?: 'summary' | 'lineups' | 'stats' | 'duels') => void;
  onJoinDuel: (id: number, isLive: boolean) => void;
  onTeamClick: (id: number, season: number) => void;
  onLeagueClick?: (id: number, season: number) => void;
  profile: any;
  showAllButton?: boolean;
  onShowAllClick?: () => void;
}

export function LiveMatchesSlider({ 
  matches, 
  activeDuels, 
  matchScores, 
  onMatchClick, 
  onJoinDuel, 
  onTeamClick, 
  onLeagueClick, 
  profile,
  showAllButton,
  onShowAllClick
}: LiveMatchesSliderProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -scrollContainerRef.current.clientWidth : scrollContainerRef.current.clientWidth;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (!matches || matches.length === 0) return null;

  return (
    <>
      <div className="flex justify-between items-center px-[30px] mb-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-black uppercase tracking-widest text-red-500">EN DIRECT ({matches.length})</span>
        </div>
        {showAllButton && onShowAllClick && (
          <button onClick={onShowAllClick} className="text-[10px] font-black text-orange-500 uppercase flex items-center gap-1 hover:text-orange-400">
            VOIR TOUT <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="relative w-full pb-0 mb-0 shrink-0">
        {matches.length > 1 && (
          <button 
            onClick={() => scroll('left')}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-black/80 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 text-white hover:bg-white/10 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        <div 
          ref={scrollContainerRef}
          className="w-full overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory"
        >
          <div className="flex flex-nowrap gap-4 px-4 py-2 w-fit items-stretch">
            {matches.map(match => (
              <div key={match.fixture.id} className={`snap-center shrink-0 flex items-stretch ${matches.length > 1 ? 'w-[85vw] sm:w-[360px]' : 'w-[calc(100vw-32px)] max-w-[388px]'}`}>
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
        
        {matches.length > 1 && (
          <button 
            onClick={() => scroll('right')}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-black/80 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 text-white hover:bg-white/10 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </>
  );
}
