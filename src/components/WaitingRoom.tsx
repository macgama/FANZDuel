import React, { useState, useEffect } from 'react';
import { Card, Button } from './Layout';
import { Swords, Users, Trophy, Clock, ChevronRight, Search, Filter, X, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Duel, UserProfile } from '../types';
import { useAlert } from '../context/AlertContext';
import { footballApi } from '../services/footballApi';
import { getImageUrl } from '../lib/utils';
import { MrFanzHelp } from './MrFanzHelp';

interface WaitingRoomProps {
  user: UserProfile;
  onJoinDuel: (duelId: string, type: string, matchId: number) => void;
  onMatchClick?: (matchId: number) => void;
  onBack: () => void;
}

export function WaitingRoom({ user, onJoinDuel, onMatchClick, onBack }: WaitingRoomProps) {
  const { showAlert } = useAlert();
  const [duels, setDuels] = useState<any[]>([]);
  const [liveMatches, setLiveMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [matchDetailsCache, setMatchDetailsCache] = useState<Record<number, any>>({});

  const handleShareDuel = async (duelId: string, duelType: string) => {
    const inviteCode = duelId.substring(0, 8).toUpperCase();
    const shareData = {
      title: 'Rejoins mon duel sur TheBestFan!',
      text: `Viens m'affronter dans un duel ${duelType.replace('_', ' ')} ! Utilise le code: ${inviteCode}`,
      url: window.location.origin
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(inviteCode);
        showAlert({
          title: 'Code copié !',
          type: 'success'
        });
      }
    } catch (err) {
      console.error('Error sharing duel', err);
    }
  };

  const handleJoinByCode = async () => {
    if (!inviteCode) return;
    try {
      const response = await fetch(`/api/duels/code/${inviteCode}`);
      if (response.ok) {
        const duel = await response.json();
        if (duel && duel.matchId) {
          onJoinDuel(duel.id, duel.type, duel.matchId);
        } else {
          showAlert({ type: 'error', title: 'Duel introuvable ou expiré.' });
        }
      } else {
        showAlert({ type: 'error', title: 'Code invalide.' });
      }
    } catch (err) {
      console.error(err);
      showAlert({ type: 'error', title: 'Erreur lors de la recherche du duel.' });
    }
  };

  useEffect(() => {
    const fetchDuels = async () => {
      try {
        const response = await fetch('/api/duels');
        if (response.ok) {
          const data = await response.json();
          setDuels(data);
          
          // Fetch match details for new matches
          const matchIds = [...new Set(data.filter((d: any) => d.matchId && d.matchId !== 'global').map((d: any) => d.matchId))] as number[];
          
          matchIds.forEach(async (matchId) => {
            if (!matchDetailsCache[matchId]) {
              try {
                const details = await footballApi.getFixtureDetails(matchId);
                if (details) {
                  setMatchDetailsCache(prev => ({ ...prev, [matchId]: details }));
                }
              } catch (e: any) {
                if (e?.message !== 'Failed to fetch') {
                  console.error(`Error fetching match details for ${matchId}`, e);
                }
              }
            }
          });
        }
      } catch (err: any) {
        if (err?.message !== 'Failed to fetch') {
          console.error("Error fetching duels:", err);
        }
      } finally {
        setLoading(false);
      }
    };

    const fetchLiveFixtures = async () => {
      try {
        const liveFixtures = await footballApi.getLiveFixtures();
        setLiveMatches(liveFixtures || []);
      } catch (e) {
        console.error("Error fetching live fixtures in WaitingRoom", e);
      }
    };

    fetchDuels();
    fetchLiveFixtures();
    const interval = setInterval(() => {
      fetchDuels();
      fetchLiveFixtures();
    }, 10000); // Refresh every 10s instead of 5s
    return () => clearInterval(interval);
  }, []);

  const filteredDuels = duels.filter(duel => {
    const matchesSearch = duel.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (duel.type && duel.type.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = !filterType || duel.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Header */}
      <div className="flex items-center justify-between px-4 mt-2">
        <h1 className="text-lg sm:text-xl font-black italic uppercase tracking-tighter flex items-center">
          Salle d'Attente
          <MrFanzHelp contextId="waiting_room" />
        </h1>
      </div>

      {/* Filters (like tabs) */}
      <div className="flex gap-2 p-4 bg-[#111111]/50 border-b border-white/5 mx-0 w-full overflow-x-auto no-scrollbar items-center">
        <div className="relative flex-[2] min-w-[140px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
          <input 
            type="text"
            placeholder="Rechercher..."
            className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-8 pr-3 text-[10px] sm:text-xs font-bold focus:outline-none focus:border-orange-500/50 transition-all text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="relative flex-1 min-w-[100px]">
          <input 
            type="text"
            placeholder="Code privé"
            className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-[10px] sm:text-xs font-bold focus:outline-none focus:border-orange-500/50 transition-all text-white uppercase text-center"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
          />
          {inviteCode && (
            <button 
              onClick={handleJoinByCode}
              className="absolute right-1 top-1 bottom-1 bg-orange-600 hover:bg-orange-500 text-white px-2 rounded text-[10px] sm:text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center"
            >
              Go
            </button>
          )}
        </div>
      </div>
      <div className="flex gap-1 p-2 bg-[#111111]/50 border-b border-white/5 overflow-x-auto no-scrollbar">
        {['1v1', '2v2', '5v5', 'war_of_kops'].map(type => (
          <button
            key={type}
            onClick={() => setFilterType(filterType === type ? null : type)}
            className={`flex-1 min-w-[70px] px-1 py-1.5 rounded-lg font-bold text-[9px] sm:text-[10px] uppercase tracking-wider transition-all border ${
              filterType === type 
                ? 'bg-blue-600 border-blue-500 text-white' 
                : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'
            }`}
          >
            {type.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-orange-500"></div>
            <p className="text-gray-500 font-bold uppercase italic tracking-widest text-xs">Recherche de duels...</p>
          </div>
        ) : filteredDuels.length === 0 ? (
          <div className="flex flex-col space-y-6">
            <div className="flex flex-col items-center justify-center pt-8 pb-4 text-center space-y-4 opacity-40">
              <Users className="w-16 h-16 text-gray-600" />
              <div>
                <p className="text-sm font-black uppercase italic text-gray-500">Aucun duel en attente</p>
                <p className="text-[10px] font-bold text-gray-600 uppercase mt-1">Créez-en un ou rejoignez un match en direct !</p>
              </div>
            </div>

            {liveMatches && liveMatches.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <h3 className="text-sm font-black italic uppercase text-white">Matchs en direct</h3>
                </div>
                {liveMatches.slice(0, 3).map((match: any) => (
                  <motion.div
                    key={match.fixture.id}
                    onClick={() => onMatchClick && onMatchClick(match.fixture.id)}
                    className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors group"
                  >
                    <div className="flex items-center gap-4 flex-1">
                       <div className="text-center w-12">
                          <span className="text-red-500 font-bold text-xs">{match.fixture.status.elapsed}'</span>
                       </div>
                       <div className="flex flex-col gap-2 flex-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <img src={match.teams.home.logo} alt="" className="w-5 h-5 object-contain" />
                              <span className="text-xs font-bold text-white">{match.teams.home.name}</span>
                            </div>
                            <span className="text-sm font-black text-white">{match.goals.home ?? 0}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <img src={match.teams.away.logo} alt="" className="w-5 h-5 object-contain" />
                              <span className="text-xs font-bold text-white">{match.teams.away.name}</span>
                            </div>
                            <span className="text-sm font-black text-white">{match.goals.away ?? 0}</span>
                          </div>
                       </div>
                    </div>
                    <div className="ml-4 opacity-50 group-hover:opacity-100 transition-opacity">
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredDuels.map((duel) => {
              const maxPlayers = { '1v1': 2, '2v2': 4, '5v5': 10 }[duel.type as '1v1' | '2v2' | '5v5'] || '∞';
              const isFull = duel.participants.length >= (typeof maxPlayers === 'number' ? maxPlayers : 999);
              
              return (
                <motion.div
                  key={duel.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[#1a1a1a] border border-white/5 rounded-2xl overflow-hidden hover:border-orange-500/30 transition-all group flex flex-col"
                >
                  {/* Match Details Header (if available) */}
                  {duel.matchId && duel.matchId !== 'global' && matchDetailsCache[duel.matchId] && (
                    <div className="bg-white/5 px-4 py-2 flex items-center justify-between border-b border-white/5">
                      <div className="flex items-center gap-2">
                        <img src={matchDetailsCache[duel.matchId].teams.home.logo} alt="Home" className="w-5 h-5 object-contain" />
                        <span className="text-[10px] font-bold text-white uppercase truncate max-w-[80px]">{matchDetailsCache[duel.matchId].teams.home.name}</span>
                      </div>
                      <span className="text-[10px] font-black text-gray-500 italic px-2">VS</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-white uppercase truncate max-w-[80px] text-right">{matchDetailsCache[duel.matchId].teams.away.name}</span>
                        <img src={matchDetailsCache[duel.matchId].teams.away.logo} alt="Away" className="w-5 h-5 object-contain" />
                      </div>
                    </div>
                  )}

                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 group-hover:bg-orange-500/10 transition-colors">
                        <Trophy className={`w-6 h-6 ${isFull ? 'text-gray-600' : 'text-orange-500'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black italic uppercase tracking-tighter text-white">{duel.type.replace('_', ' ')}</span>
                          <span className="px-1.5 py-0.5 rounded bg-white/5 text-[8px] font-black text-gray-500 uppercase tracking-widest border border-white/5">
                            ID: {duel.id.substring(0, 8)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-gray-500 uppercase">
                            <Users className="w-3 h-3" />
                            <span>{duel.participants.length} / {maxPlayers}</span>
                          </div>
                          {duel.matchId && (!matchDetailsCache[duel.matchId] || duel.matchId === 'global') && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-orange-500/60 uppercase">
                              <Clock className="w-3 h-3" />
                              <span>Match #{duel.matchId}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleShareDuel(duel.id, duel.type)}
                        className="p-2 bg-orange-500/10 text-orange-500 rounded-lg hover:bg-orange-500/20 transition-colors border border-orange-500/20"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                      <Button 
                        onClick={() => onJoinDuel(duel.id, duel.type, duel.matchId)}
                        disabled={isFull}
                        className="px-6 h-10 text-[10px] font-black uppercase tracking-widest italic"
                      >
                        Rejoindre
                      </Button>
                    </div>
                  </div>
                  
                  {/* Participants Preview */}
                  <div className="px-4 pb-4 flex gap-1.5">
                    {duel.participants.map((p: any, i: number) => (
                      <div 
                        key={i} 
                        className={`w-8 h-8 rounded-full border-2 border-[#1a1a1a] overflow-hidden bg-gray-800 flex items-center justify-center ${
                          p.team === 'A' ? 'ring-2 ring-orange-500' : 'ring-2 ring-blue-500'
                        }`}
                        title={`${p.pseudo} (${p.team})`}
                      >
                        {p.photoURL || p.fanz?.imageUrl ? (
                          <img 
                            src={p.photoURL || getImageUrl(p.fanz?.imageUrl)} 
                            alt="Avatar" 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-[10px] font-black text-white">{p.pseudo?.[0]}</span>
                        )}
                      </div>
                    ))}
                    {Array.from({ length: Math.max(0, (typeof maxPlayers === 'number' ? maxPlayers : 0) - duel.participants.length) }).slice(0, 5).map((_, i) => (
                      <div key={`empty-${i}`} className="w-8 h-8 rounded-full border border-dashed border-white/10 bg-transparent flex items-center justify-center">
                        <span className="text-[10px] text-white/5">+</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
