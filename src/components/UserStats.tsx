import React, { useState, useEffect } from 'react';
import { UserProfile, Fanz } from '../types';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { getImageUrl } from '../lib/utils';
import { translateCountryName } from '../utils/countryTranslations';
import { 
  Trophy, 
  Swords, 
  Flame, 
  Star, 
  Target, 
  TrendingUp, 
  Users, 
  Shield,
  Activity,
  History,
  Medal,
  Zap
} from 'lucide-react';
import { motion } from 'motion/react';
import { footballApi } from '../services/footballApi';
import { DuelDetailsModal } from './DuelDetailsModal';

interface UserStatsProps {
  user: UserProfile;
  onBack: () => void;
}

export function UserStats({ user, onBack }: UserStatsProps) {
  const [userFanz, setUserFanz] = useState<Fanz[]>([]);
  const [favoriteTeamsInfo, setFavoriteTeamsInfo] = useState<any[]>([]);
  const [recentDuels, setRecentDuels] = useState<any[]>([]);
  const [fanzTransactions, setFanzTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDuelDetails, setSelectedDuelDetails] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch Fanz
        const fanzQ = query(collection(db, 'fanz'), where('ownerUid', '==', user.uid));
        const fanzSnap = await getDocs(fanzQ);
        setUserFanz(fanzSnap.docs.map(d => ({ id: d.id, ...d.data() } as Fanz)));

        // Fetch ferveur_fanz transactions
        try {
          const txsQ = query(
            collection(db, 'transactions'),
            where('userId', '==', user.uid),
            where('type', '==', 'ferveur_fanz')
          );
          const txsSnap = await getDocs(txsQ);
          setFanzTransactions(txsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (e) {
          console.error("Error fetching fanz transactions:", e);
        }

        // Fetch Recent Duels (from fixture_results)
        const duelsQ = query(
          collection(db, 'fixture_results'), 
          where(`users.${user.uid}.score`, '!=', null), // This is a trick to filter by presence in map, but Firestore doesn't support it well.
          // Better: query all and filter in memory if volume is small, or use a separate duel_participants collection.
          orderBy('timestamp', 'desc'),
          limit(10)
        );
        // Note: The above query might need an index. For now let's just get the latest ones.
        const duelsSnap = await getDocs(query(collection(db, 'fixture_results'), orderBy('timestamp', 'desc'), limit(20)));
        const myRecentDuels = duelsSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((d: any) => d.users && d.users[user.uid]);
        setRecentDuels(myRecentDuels);

        // Fetch Favorite Teams
        if (user.favoriteTeams && user.favoriteTeams.length > 0) {
          const uniqueFavIds = Array.from(new Set(
            user.favoriteTeams
              .map((id: any) => id?.toString()?.trim() || "")
              .filter((id: string) => id !== "" && id !== "undefined" && id !== "null")
          ));
          const teams = await Promise.all(
            uniqueFavIds.map(async (id) => {
              try {
                const res = await footballApi.getTeamInfo(Number(id));
                return res?.team;
              } catch (e) {
                return null;
              }
            })
          );
          setFavoriteTeamsInfo(teams.filter(Boolean));
        }
      } catch (err) {
        console.error("Error fetching stats data", err);
      }
      setLoading(false);
    };

    fetchData();
  }, [user.uid, user.favoriteTeams]);

  const totalWins = user.win_count || 0;
  const totalDuels = user.duel_count || 0;
  const winRate = totalDuels > 0 ? Math.round((totalWins / totalDuels) * 100) : 0;
  const bestFanz = [...userFanz].sort((a, b) => (b.level || 1) - (a.level || 1))[0];

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a] text-white">
      {/* Stats Content */}
      <div className="flex-1 overflow-y-auto px-6 py-8 no-scrollbar pb-32">
        <div className="max-w-2xl mx-auto space-y-8">
          
          {/* Header Card */}
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-orange-600 to-orange-900 p-8 shadow-2xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-md border-4 border-white/30 flex items-center justify-center mb-4 overflow-hidden">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-12 h-12 text-white" />
                )}
              </div>
              <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-1">{user.displayName || 'Guerrier du KOP'}</h2>
              <div className="px-4 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-black uppercase tracking-widest border border-white/20">
                Niveau {user.level || 1}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-8 relative z-10">
              <div className="text-center">
                <div className="text-2xl font-black">{totalDuels}</div>
                <div className="text-[10px] font-bold uppercase text-white/60 tracking-widest">Duels</div>
              </div>
              <div className="text-center border-x border-white/10">
                <div className="text-2xl font-black">{winRate}%</div>
                <div className="text-[10px] font-bold uppercase text-white/60 tracking-widest">Victoires</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-black">{user.money || 0}</div>
                <div className="text-[10px] font-bold uppercase text-white/60 tracking-widest">Monnaie</div>
              </div>
            </div>
          </div>

          {/* Detailed Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <StatBox icon={<Flame className="text-orange-500" />} label="Streak" value={`${user.streak || 0} jours`} />
            <StatBox icon={<Star className="text-yellow-500" />} label="Ferveur" value={user.ferveurPoints?.toLocaleString() || '0'} />
            <StatBox icon={<Zap className="text-blue-500" />} label="Energie" value={`${user.energy}/${user.maxEnergy || 100}`} />
            <StatBox icon={<Trophy className="text-purple-500" />} label="Rareté Max" value={bestFanz?.rarity || 'Commun'} />
          </div>

          {/* Favorite Teams */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-orange-500" />
              <h3 className="text-sm font-black uppercase tracking-widest">Équipes Favorites</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {favoriteTeamsInfo.length > 0 ? (
                favoriteTeamsInfo.map((team, idx) => (
                  <div key={`${team.id}-${idx}`} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 group hover:bg-white/10 transition-colors">
                    <div className="w-12 h-12 flex items-center justify-center shrink-0 drop-shadow-md">
                      <img src={getImageUrl(team.logo, 100)} alt="" className="w-8 h-8 object-contain" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black uppercase truncate">{team.name}</div>
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{translateCountryName(team.country)}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 text-center py-8 bg-white/5 border border-dashed border-white/10 rounded-2xl">
                  <p className="text-xs text-gray-500 font-bold uppercase">Aucune équipe favorite</p>
                </div>
              )}
            </div>
          </section>

          {/* Mes FANZ en Possession */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-5 h-5 text-yellow-500" />
              <h3 className="text-sm font-black uppercase tracking-widest">Mes FANZ ({userFanz.length})</h3>
            </div>
            {userFanz.length > 0 ? (
              <div className="space-y-4">
                {userFanz.map((fanz) => {
                  const fanzSkinsCount = Array.isArray(fanz.unlockedSkins) 
                    ? fanz.unlockedSkins.length 
                    : fanz.unlockedSkins 
                      ? Object.keys(fanz.unlockedSkins).length 
                      : 0;
                  const fanzEmotesCount = Array.isArray(fanz.unlockedEmotes) 
                    ? fanz.unlockedEmotes.length 
                    : fanz.unlockedEmotes 
                      ? Object.keys(fanz.unlockedEmotes).length 
                      : 0;
                  
                  // Calculate duel stats from transactions
                  const txs = fanzTransactions.filter(tx => tx.fanzId === fanz.id);
                  const wins = txs.filter(tx => tx.description?.toLowerCase().includes('victoire')).length;
                  const losses = txs.filter(tx => tx.description?.toLowerCase().includes('défaite')).length;
                  const trainings = txs.filter(tx => tx.description?.toLowerCase().includes('entraînement')).length;
                  
                  return (
                    <div key={fanz.id} className="bg-gradient-to-r from-stone-900 via-stone-950/70 to-black border border-white/10 rounded-2xl p-5 flex flex-col sm:flex-row gap-5 items-center sm:items-start transition-all hover:border-orange-500/30">
                      {/* Image / Video preview */}
                      <div className="w-24 h-24 bg-white/5 rounded-2xl overflow-hidden shrink-0 border border-white/10 flex items-center justify-center relative shadow-inner">
                        {(fanz.imageUrl || (fanz as any).image) ? (
                          <img src={getImageUrl(fanz.imageUrl || (fanz as any).image)} alt="" className="w-full h-full object-cover" />
                        ) : fanz.videoUrl ? (
                          <video src={getImageUrl(fanz.videoUrl)} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                        ) : (
                          <Users className="w-8 h-8 text-stone-600" />
                        )}
                        <span className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] font-black uppercase text-white tracking-widest border border-white/10">
                          {fanz.rarity || 'Commun'}
                        </span>
                      </div>

                      {/* Info & Stats list */}
                      <div className="flex-1 w-full text-center sm:text-left space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <div>
                            <h4 className="text-lg font-black italic uppercase tracking-tight text-white leading-tight">
                              {fanz.name}
                            </h4>
                            <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">
                              Sport : {fanz.sport}
                            </p>
                          </div>
                          <div className="text-xs font-black uppercase text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-1 rounded-full w-fit mx-auto sm:mx-0">
                            Rang {fanz.rank || 1}
                          </div>
                        </div>

                        {/* Detailed information table */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] font-bold border-t border-white/5 pt-3">
                          <div className="flex justify-between border-b border-white/5 pb-1">
                            <span className="text-stone-400 uppercase">Ferveur</span>
                            <span className="text-orange-400">Niveau {fanz.ferveurLevel || 1}</span>
                          </div>
                          <div className="flex justify-between border-b border-white/5 pb-1">
                            <span className="text-stone-400 uppercase">Skins</span>
                            <span className="text-white">{Math.max(1, fanzSkinsCount)} débloqué(s)</span>
                          </div>
                          <div className="flex justify-between border-b border-white/5 pb-1">
                            <span className="text-stone-400 uppercase">Émotes</span>
                            <span className="text-white">{fanzEmotesCount} débloquée(s)</span>
                          </div>
                          <div className="flex justify-between border-b border-white/5 pb-1">
                            <span className="text-stone-400 uppercase">Cartes Duel</span>
                            <span className="text-white">{(fanz.deck || fanz.equippedCards || []).length} / 8 équipées</span>
                          </div>
                        </div>

                        {/* Duels metrics */}
                        <div className="bg-white/5 rounded-xl p-3 border border-white/5 space-y-1 text-[10px] font-bold text-left">
                          <div className="text-stone-400 uppercase tracking-wider text-[8px] mb-1">Historique de ferveur fanz</div>
                          <div className="flex items-center justify-between text-white">
                            <span>Matches de Duel</span>
                            <span className="text-sm font-black italic">
                              <span className="text-green-400">{wins}V</span>
                              <span className="text-stone-500 mx-1">/</span>
                              <span className="text-red-400">{losses}D</span>
                            </span>
                          </div>
                          {trainings > 0 && (
                            <div className="flex items-center justify-between text-stone-400 font-normal text-[9px] border-t border-white/5 pt-1 mt-1">
                              <span>Entraînements réalisés</span>
                              <span>{trainings} match(s)</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 bg-white/5 border border-dashed border-white/10 rounded-2xl">
                <p className="text-xs text-gray-500 font-bold uppercase">Aucun Fanz trouvé</p>
              </div>
            )}
          </section>

          {/* Recent Match Performance */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-blue-500" />
              <h3 className="text-sm font-black uppercase tracking-widest">Derniers Duels</h3>
            </div>
            <div className="space-y-3">
              {recentDuels.length > 0 ? (
                recentDuels.map((duel, idx) => {
                  const myUser = duel.users[user.uid];
                  const isWin = duel.winnerVirtualTeam === myUser.virtualTeam;
                  const dateStr = duel.timestamp ? new Date(duel.timestamp.seconds * 1000).toLocaleDateString() : 'Récemment';
                  
                  return (
                    <div 
                      key={idx} 
                      className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors"
                      onClick={() => setSelectedDuelDetails(duel.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${isWin ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                          {isWin ? 'W' : 'L'}
                        </div>
                        <div>
                          <div className="text-xs font-black uppercase">{duel.teamHome.name} vs {duel.teamAway.name}</div>
                          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{dateStr} • {myUser.score} pts</div>
                        </div>
                      </div>
                      <div className="text-right">
                         <div className="text-xs font-black text-white">{duel.teamHome.score} - {duel.teamAway.score}</div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 bg-white/5 border border-dashed border-white/10 rounded-2xl">
                  <p className="text-xs text-gray-500 font-bold uppercase">Aucun duel récent</p>
                </div>
              )}
            </div>
          </section>

        </div>
      </div>

      {selectedDuelDetails && (
        <DuelDetailsModal 
          duelId={selectedDuelDetails} 
          onClose={() => setSelectedDuelDetails(null)} 
        />
      )}
    </div>
  );
}

function StatBox({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{label}</div>
        <div className="text-base font-black italic uppercase tracking-tighter text-white">{value}</div>
      </div>
    </div>
  );
}
