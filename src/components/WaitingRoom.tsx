import React, { useState, useEffect } from 'react';
import { Card, Button } from './Layout';
import { Swords, Users, Trophy, Clock, ChevronRight, Search, Filter, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Duel, UserProfile } from '../types';

interface WaitingRoomProps {
  user: UserProfile;
  onJoinDuel: (duelId: string, type: string, matchId: number) => void;
  onBack: () => void;
}

export function WaitingRoom({ user, onJoinDuel, onBack }: WaitingRoomProps) {
  const [duels, setDuels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState('');

  const handleJoinByCode = async () => {
    if (!inviteCode) return;
    try {
      const response = await fetch(`/api/duels/code/${inviteCode}`);
      if (response.ok) {
        const duel = await response.json();
        if (duel && duel.matchId) {
          onJoinDuel(duel.id, duel.type, duel.matchId);
        } else {
          alert('Duel introuvable ou expiré.');
        }
      } else {
        alert('Code invalide.');
      }
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la recherche du duel.');
    }
  };

  useEffect(() => {
    const fetchDuels = async () => {
      try {
        const response = await fetch('/api/duels');
        if (response.ok) {
          const data = await response.json();
          setDuels(data);
        }
      } catch (err) {
        console.error("Error fetching duels:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDuels();
    const interval = setInterval(fetchDuels, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, []);

  const filteredDuels = duels.filter(duel => {
    const matchesSearch = duel.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (duel.type && duel.type.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = !filterType || duel.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Header */}
      <div className="p-6 border-b border-white/10 flex items-center justify-between bg-[#111111]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-600/20">
            <Swords className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black italic uppercase tracking-tighter text-white">Salle d'Attente</h1>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Duels en attente de joueurs</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 space-y-3 bg-[#111111]/50 border-b border-white/5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input 
              type="text"
              placeholder="Rechercher un duel..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs font-bold focus:outline-none focus:border-orange-500/50 transition-all text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative w-1/3">
            <input 
              type="text"
              placeholder="Code privé"
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-xs font-bold focus:outline-none focus:border-orange-500/50 transition-all text-white uppercase"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            />
            {inviteCode && (
              <button 
                onClick={() => onJoinDuel('private_duel', '1v1', inviteCode)}
                className="absolute right-1 top-1 bottom-1 bg-orange-600 hover:bg-orange-500 text-white px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors"
              >
                Go
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {['1v1', '2v2', '5v5', 'war_of_kops'].map(type => (
            <button
              key={type}
              onClick={() => setFilterType(filterType === type ? null : type)}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
                filterType === type 
                  ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/20' 
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
              }`}
            >
              {type.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-orange-500"></div>
            <p className="text-gray-500 font-bold uppercase italic tracking-widest text-xs">Recherche de duels...</p>
          </div>
        ) : filteredDuels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-40">
            <Users className="w-16 h-16 text-gray-600" />
            <div>
              <p className="text-sm font-black uppercase italic text-gray-500">Aucun duel en attente</p>
              <p className="text-[10px] font-bold text-gray-600 uppercase mt-1">Créez-en un pour commencer !</p>
            </div>
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
                  className="bg-[#1a1a1a] border border-white/5 rounded-2xl overflow-hidden hover:border-orange-500/30 transition-all group"
                >
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
                          {duel.matchId && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-orange-500/60 uppercase">
                              <Clock className="w-3 h-3" />
                              <span>Match #{duel.matchId}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button 
                      onClick={() => onJoinDuel(duel.id, duel.type, duel.matchId)}
                      disabled={isFull}
                      className="px-6 h-10 text-[10px] font-black uppercase tracking-widest italic"
                    >
                      Rejoindre
                    </Button>
                  </div>
                  
                  {/* Participants Preview */}
                  <div className="px-4 pb-4 flex gap-1.5">
                    {duel.participants.map((p: any, i: number) => (
                      <div 
                        key={i} 
                        className={`w-6 h-6 rounded-full border-2 border-[#1a1a1a] overflow-hidden bg-white/10 flex items-center justify-center ${
                          p.team === 'A' ? 'ring-1 ring-orange-500/50' : 'ring-1 ring-blue-500/50'
                        }`}
                        title={`${p.pseudo} (${p.team})`}
                      >
                        {p.photoURL ? (
                          <img src={p.photoURL} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[8px] font-black">{p.pseudo?.[0]}</span>
                        )}
                      </div>
                    ))}
                    {Array.from({ length: Math.max(0, (typeof maxPlayers === 'number' ? maxPlayers : 0) - duel.participants.length) }).slice(0, 5).map((_, i) => (
                      <div key={`empty-${i}`} className="w-6 h-6 rounded-full border border-dashed border-white/10 bg-transparent flex items-center justify-center">
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
