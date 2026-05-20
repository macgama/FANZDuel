import React, { useState, useEffect } from 'react';
import { UserProfile, Fanz } from '../types';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { getImageUrl } from '../lib/utils';
import { footballApi } from '../services/footballApi';
import { 
  Trophy, 
  Swords, 
  Flame, 
  Star, 
  Target, 
  Users, 
  Shield,
  History,
  Zap,
  ChevronLeft
} from 'lucide-react';
import { Button } from './Layout';
import { DuelDetailsModal } from './DuelDetailsModal';

interface StatsPageProps {
  profile: UserProfile;
  onBack: () => void;
}

export function StatsPage({ profile, onBack }: StatsPageProps) {
  const [userFanz, setUserFanz] = useState<Fanz[]>([]);
  const [favoriteTeamsInfo, setFavoriteTeamsInfo] = useState<any[]>([]);
  const [recentDuels, setRecentDuels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDuelDetails, setSelectedDuelDetails] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch Fanz
        const fanzQ = query(collection(db, 'fanz'), where('ownerUid', '==', profile.uid));
        const fanzSnap = await getDocs(fanzQ);
        setUserFanz(fanzSnap.docs.map(d => ({ id: d.id, ...d.data() } as Fanz)));

        // Fetch Recent Duels
        const duelsSnap = await getDocs(query(collection(db, 'fixture_results'), orderBy('timestamp', 'desc'), limit(20)));
        const myRecentDuels = duelsSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((d: any) => d.users && d.users[profile.uid]);
        setRecentDuels(myRecentDuels);

        // Fetch Favorite Teams
        if (profile.favoriteTeams && profile.favoriteTeams.length > 0) {
          const teams = await Promise.all(
            profile.favoriteTeams.map(async (id) => {
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
  }, [profile.uid, profile.favoriteTeams]);

  const totalWins = profile.win_count || 0;
  const totalDuels = profile.duel_count || 0;
  const winRate = totalDuels > 0 ? Math.round((totalWins / totalDuels) * 100) : 0;
  const bestFanz = [...userFanz].sort((a, b) => (b.level || 1) - (a.level || 1))[0];

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0a0a]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="bg-[#1a1a1a]/80 backdrop-blur-md border-b border-white/10 px-4 py-4 flex items-center gap-3 sticky top-0 z-50">
        <Button variant="outline" size="sm" onClick={onBack} className="p-0 h-8 w-8 rounded-full bg-white/5 border-white/10 text-white">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-xl font-black italic uppercase tracking-wider text-white leading-none">Mes Stats</h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none mt-1">Mon parcours</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8 no-scrollbar pb-32">
        <div className="max-w-2xl mx-auto space-y-8">
          
          {/* Header Card */}
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-orange-600 to-orange-900 p-8 shadow-2xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-md border-4 border-white/30 flex items-center justify-center mb-4 overflow-hidden">
                {profile.photoURL ? (
                  <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-12 h-12 text-white" />
                )}
              </div>
              <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-1">{profile.displayName || 'Guerrier du KOP'}</h2>
              <div className="px-4 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-black uppercase tracking-widest border border-white/20">
                Niveau {profile.level || 1}
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
                <div className="text-2xl font-black">{profile.money || 0}</div>
                <div className="text-[10px] font-bold uppercase text-white/60 tracking-widest">Monnaie</div>
              </div>
            </div>
          </div>

          {/* Detailed Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <StatBox icon={<Flame className="text-orange-500" />} label="Streak" value={`${profile.streak || 0} jours`} />
            <StatBox icon={<Star className="text-yellow-500" />} label="Ferveur" value={profile.ferveurPoints?.toLocaleString() || '0'} />
            <StatBox icon={<Zap className="text-blue-500" />} label="Energie" value={`${profile.energy}/${profile.maxEnergy || 100}`} />
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
                favoriteTeamsInfo.map(team => (
                  <div key={team.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 group hover:bg-white/10 transition-colors">
                    <div className="w-12 h-12 flex items-center justify-center shrink-0 drop-shadow-md">
                      <img src={getImageUrl(team.logo, 100)} alt="" className="w-8 h-8 object-contain" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black uppercase truncate">{team.name}</div>
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{team.country}</div>
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

          {/* Best Fanz */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-5 h-5 text-yellow-500" />
              <h3 className="text-sm font-black uppercase tracking-widest">Mon meilleur Fanz</h3>
            </div>
            {bestFanz ? (
              <div className="bg-gradient-to-r from-gray-900 to-black border border-white/10 rounded-3xl p-4 flex gap-6 items-center">
                <div className="w-24 h-24 bg-white/5 rounded-2xl overflow-hidden shrink-0 border border-white/10 flex items-center justify-center">
                  {(bestFanz.imageUrl || (bestFanz as any).image) ? (
                    <img src={getImageUrl(bestFanz.imageUrl || (bestFanz as any).image)} alt="" className="w-full h-full object-cover" />
                  ) : bestFanz.videoUrl ? (
                    <video src={getImageUrl(bestFanz.videoUrl)} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                  ) : (
                    <Star className="w-8 h-8 text-gray-600" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-lg font-black italic uppercase tracking-tighter text-white">{bestFanz.name}</div>
                  <div className="text-[10px] font-black uppercase text-yellow-500 tracking-widest mb-2">Niveau {bestFanz.level || 1} • {bestFanz.rarity}</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div className="flex justify-between text-[10px] font-bold border-b border-white/5 py-1">
                      <span className="text-gray-500">FORCE</span>
                      <span>{bestFanz.stats?.force || 1}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold border-b border-white/5 py-1">
                      <span className="text-gray-500">MÉNTAL</span>
                      <span>{bestFanz.stats?.mental || 1}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold border-b border-white/5 py-1">
                      <span className="text-gray-500">BLUFF</span>
                      <span>{bestFanz.stats?.bluff || 1}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold border-b border-white/5 py-1">
                      <span className="text-gray-500">SOCIAL</span>
                      <span>{bestFanz.stats?.social || 1}</span>
                    </div>
                  </div>
                </div>
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
                  const myUser = duel.users[profile.uid];
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
                          <div className="text-xs font-black uppercase truncate max-w-[150px]">{duel.teamHome.name} vs {duel.teamAway.name}</div>
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
