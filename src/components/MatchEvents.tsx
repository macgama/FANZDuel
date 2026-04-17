import React, { useState, useEffect, useRef } from 'react';
import { footballApi } from '../services/footballApi';

export function MatchEvents({ 
  fixtureId, 
  homeId, 
  awayId, 
  initialEvents = [] 
}: { 
  fixtureId: number, 
  homeId: number, 
  awayId: number, 
  initialEvents?: any[] 
}) {
  const [events, setEvents] = useState<any[]>(initialEvents);
  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        observer.disconnect();
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (initialEvents && initialEvents.length > 0) {
      setEvents(initialEvents);
      return;
    }
    
    if (inView) {
      let mounted = true;
      footballApi.getFixtureEvents(fixtureId)
        .then(evs => {
          if (mounted && evs) setEvents(evs);
        })
        .catch(err => console.error("Failed to fetch events", err));
        
      return () => { mounted = false; };
    }
  }, [fixtureId, initialEvents, inView]);

  const scorers = events.filter((e: any) => e.type?.toLowerCase() === 'goal') || [];
  
  const homeYellowCards = events.filter((e: any) => e.team.id === homeId && e.type?.toLowerCase() === 'card' && e.detail?.toLowerCase().includes('yellow')).length;
  const homeRedCards = events.filter((e: any) => e.team.id === homeId && e.type?.toLowerCase() === 'card' && e.detail?.toLowerCase().includes('red')).length;

  const awayYellowCards = events.filter((e: any) => e.team.id === awayId && e.type?.toLowerCase() === 'card' && e.detail?.toLowerCase().includes('yellow')).length;
  const awayRedCards = events.filter((e: any) => e.team.id === awayId && e.type?.toLowerCase() === 'card' && e.detail?.toLowerCase().includes('red')).length;

  return (
    <div ref={containerRef} className="flex flex-col w-full">
      {/* Cards Display */}
      <div className="flex justify-between items-center px-4 -mt-2 mb-2">
        <div className="flex gap-1.5 items-center">
          {homeYellowCards > 0 && (
            <div className="w-[14px] h-[18px] bg-yellow-400 rounded-[2px] shadow-sm flex items-center justify-center border border-yellow-500">
              <span className="text-[9px] font-black text-black">{homeYellowCards}</span>
            </div>
          )}
          {homeRedCards > 0 && (
            <div className="w-[14px] h-[18px] bg-red-600 rounded-[2px] shadow-sm flex items-center justify-center border border-red-700">
              <span className="text-[9px] font-black text-white">{homeRedCards}</span>
            </div>
          )}
        </div>
        <div className="flex gap-1.5 items-center">
          {awayYellowCards > 0 && (
            <div className="w-[14px] h-[18px] bg-yellow-400 rounded-[2px] shadow-sm flex items-center justify-center border border-yellow-500">
              <span className="text-[9px] font-black text-black">{awayYellowCards}</span>
            </div>
          )}
          {awayRedCards > 0 && (
            <div className="w-[14px] h-[18px] bg-red-600 rounded-[2px] shadow-sm flex items-center justify-center border border-red-700">
              <span className="text-[9px] font-black text-white">{awayRedCards}</span>
            </div>
          )}
        </div>
      </div>

      {/* Scorers Section */}
      {scorers.length > 0 && (
        <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-3 mt-1">
          <div className="space-y-1">
            {scorers.filter((e: any) => e.team.id === homeId).map((e: any, i: number) => (
              <div key={i} className="flex items-center justify-end gap-1.5 text-[10px] sm:text-xs text-gray-400 font-bold">
                <span className="truncate max-w-[100px] sm:max-w-[120px]">{e.player.name}</span>
                <span className="text-orange-500 font-black">{e.time.elapsed}{e.time.extra ? `+${e.time.extra}` : ''}'</span>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            {scorers.filter((e: any) => e.team.id === awayId).map((e: any, i: number) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px] sm:text-xs text-gray-400 font-bold">
                <span className="text-orange-500 font-black">{e.time.elapsed}{e.time.extra ? `+${e.time.extra}` : ''}'</span>
                <span className="truncate max-w-[100px] sm:max-w-[120px]">{e.player.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
