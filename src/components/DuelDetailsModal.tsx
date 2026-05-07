import React, { useEffect, useState } from 'react';
import { X, Trophy, Shield, Zap } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';

interface DuelDetailsModalProps {
  duelId: string;
  onClose: () => void;
}

export function DuelDetailsModal({ duelId, onClose }: DuelDetailsModalProps) {
  const [duel, setDuel] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDuel = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'fixture_results', duelId));
        if (docSnap.exists()) {
          setDuel({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDuel();
  }, [duelId]);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="flex justify-between items-center p-4 border-b border-white/10">
            <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
              <Trophy className="w-4 h-4 text-orange-500" />
              Détails du Duel
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          
          <div className="p-4 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center p-8">
                 <div className="w-8 h-8 border-2 border-orange-500/50 border-t-orange-500 rounded-full animate-spin" />
              </div>
            ) : duel ? (
              <div className="space-y-6">
                <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-black text-orange-500 bg-orange-500/10 px-2 py-1 rounded uppercase tracking-widest">
                       {duel.type || 'Duel'}
                    </span>
                    <span className="text-[10px] font-bold text-gray-500">
                      {duel.timestamp ? new Date(duel.timestamp.seconds * 1000).toLocaleString() : ''}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 flex flex-col items-center">
                      <span className="text-2xl font-black text-white">{duel.teamHome?.score || 0}</span>
                      <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest text-center mt-1">
                        {duel.teamHome?.name || ''}
                      </span>
                    </div>
                    <div className="px-4 font-black italic text-gray-600">VS</div>
                    <div className="flex-1 flex flex-col items-center">
                      <span className="text-2xl font-black text-white">{duel.teamAway?.score || 0}</span>
                      <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest text-center mt-1">
                        {duel.teamAway?.name || ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Shield className="w-3 h-3" />
                    Participants
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(duel.users || {}).map(([uid, info]: [string, any]) => {
                       const isHome = info.teamSide === 'Home';
                       const isWinner = duel.winnerVirtualTeam === info.virtualTeam;
                       
                       return (
                         <div key={uid} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between relative overflow-hidden">
                           {isWinner && <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500" />}
                           <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center font-black text-xs text-white border border-white/10">
                               {info.pseudo?.[0] || '?'}
                             </div>
                             <div>
                               <div className="text-xs font-black text-white flex items-center gap-2">
                                 {info.pseudo || 'Anonyme'}
                                 {isWinner && <Trophy className="w-3 h-3 text-yellow-500" />}
                               </div>
                               <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                                 {info.realTeamName}
                               </div>
                             </div>
                           </div>
                           <div className="text-right">
                             <div className="text-sm font-black text-orange-500 flex items-center gap-1 justify-end">
                               <Zap className="w-3 h-3" />
                               {info.score}
                             </div>
                           </div>
                         </div>
                       );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 text-xs font-bold uppercase tracking-widest">
                Aucun détail disponible
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
