import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { db } from '../firebase';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { Card, Button } from './Layout';
import { ChevronLeft, Trophy, Swords, Medal, Star, Flame, Target, Layers, PieChart, BarChart } from 'lucide-react';
import { translateCountryName } from '../utils/countryTranslations';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { footballApi } from '../services/footballApi';

interface StatsPageProps {
  profile: UserProfile;
  onBack: () => void;
}

export function StatsPage({ profile, onBack }: StatsPageProps) {
  const [fanzCount, setFanzCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [favTeamsDetails, setFavTeamsDetails] = useState<any[]>([]);

  useEffect(() => {
    const fetchStatsData = async () => {
      try {
        // Fetch FANZ count
        const fanzQuery = query(collection(db, 'fanz'), where('ownerUid', '==', profile.uid));
        const fanzSnap = await getDocs(fanzQuery);
        setFanzCount(fanzSnap.size);

        // Fetch Favorite Teams details
        if (profile.favoriteTeams && profile.favoriteTeams.length > 0) {
          const teamsData = [];
          // Just fetch top 3 to keep it fast
          const topTeams = profile.favoriteTeams.slice(0, 3);
          for (const teamId of topTeams) {
            try {
              const teamDoc = await getDoc(doc(db, 'api_teams', teamId.toString()));
              if (teamDoc.exists()) {
                 teamsData.push(teamDoc.data());
              } else {
                 const apiTeam = await footballApi.getTeamInfo(parseInt(teamId));
                 if (apiTeam) teamsData.push(apiTeam.team);
              }
            } catch (e) {
              console.error("Error fetching team data for stats", e);
            }
          }
          setFavTeamsDetails(teamsData);
        }
      } catch (err) {
        console.error("Error fetching user stats extra data", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStatsData();
  }, [profile.uid, profile.favoriteTeams]);

  const matchesPlayed = profile.matchesPlayed || 0;
  const matchesWon = profile.matchesWon || 0;
  const matchesLost = Math.max(0, matchesPlayed - matchesWon);
  const winRate = matchesPlayed > 0 ? Math.round((matchesWon / matchesPlayed) * 100) : 0;
  const totalScore = profile.totalScore || 0;

  const pieData = [
    { name: 'Victoires', value: matchesWon, color: '#f97316' },
    { name: 'Défaites/Nuls', value: matchesLost, color: '#3f3f46' }
  ];

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-orange-500"></div>
        <p className="text-gray-500 font-bold uppercase italic tracking-widest">Chargement des statistiques...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="bg-[#1a1a1a] border-b border-white/10 px-4 py-4 flex items-center justify-between shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="p-0 h-8 w-8 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="text-orange-500">
              <BarChart className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black italic uppercase tracking-wider text-white leading-none">Mon Parcours</h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none mt-1">Statistiques du joueur</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-20 px-4 pt-6 space-y-6">
        
        {/* Global Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-4 bg-gradient-to-br from-orange-500/10 to-transparent border-orange-500/30 flex flex-col items-center justify-center text-center">
            <Flame className="w-8 h-8 text-orange-500 mb-2" />
            <span className="text-3xl font-black text-white">{profile.level}</span>
            <span className="text-[10px] text-orange-400 uppercase font-black tracking-widest">Niveau</span>
          </Card>
          
          <Card className="p-4 bg-white/5 border-white/10 flex flex-col items-center justify-center text-center">
            <Swords className="w-8 h-8 text-blue-400 mb-2" />
            <span className="text-3xl font-black text-white">{matchesPlayed}</span>
            <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Duels joués</span>
          </Card>

          <Card className="p-4 bg-white/5 border-white/10 flex flex-col items-center justify-center text-center">
            <Trophy className="w-8 h-8 text-yellow-400 mb-2" />
            <span className="text-3xl font-black text-white">{matchesWon}</span>
            <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Victoires</span>
          </Card>

          <Card className="p-4 bg-white/5 border-white/10 flex flex-col items-center justify-center text-center">
            <Target className="w-8 h-8 text-purple-400 mb-2" />
            <span className="text-3xl font-black text-white">{totalScore}</span>
            <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Points Marqués</span>
          </Card>
        </div>

        {/* Details Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* Win Rate Chart */}
          <Card className="p-4 bg-[#1a1a1a]/80 border-white/10 flex flex-col">
            <h3 className="text-xs font-black uppercase text-gray-500 tracking-widest mb-4 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-orange-500" />
              Ratio de Victoires
            </h3>
            
            <div className="flex-1 flex items-center justify-center min-h-[200px] relative">
              {matchesPlayed > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <RechartsPieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                        itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-4xl font-black text-white">{winRate}%</span>
                    <span className="text-[10px] text-gray-500 uppercase font-bold">Win Rate</span>
                  </div>
                </>
              ) : (
                <div className="text-center text-gray-500 text-sm italic">Aucun duel joué pour l'instant</div>
              )}
            </div>
          </Card>

          {/* Collection Stats */}
          <Card className="p-4 bg-[#1a1a1a]/80 border-white/10 flex flex-col">
            <h3 className="text-xs font-black uppercase text-gray-500 tracking-widest mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-orange-500" />
              Collection & Ressources
            </h3>
            
            <div className="flex flex-col gap-3">
              <div className="bg-white/5 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                    <Star className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-bold">FANZ Possédés</p>
                    <p className="text-lg font-black text-white">{fanzCount}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Layers className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-bold">Cartes DUEL</p>
                    <p className="text-lg font-black text-white">{profile.cards?.length || 0}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white/5 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-pink-500/20 rounded-lg flex items-center justify-center">
                    <Medal className="w-5 h-5 text-pink-500" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-bold">Série Connexions</p>
                    <p className="text-lg font-black text-white">{profile.streak || 0} jours</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Favorite Teams */}
        {favTeamsDetails.length > 0 && (
          <Card className="p-4 bg-[#1a1a1a]/80 border-white/10">
            <h3 className="text-xs font-black uppercase text-gray-500 tracking-widest mb-4 flex items-center gap-2">
              <HeartIcon className="w-4 h-4 text-red-500" /> {/* Replaced Heart with standard heart to avoid import issues if not loaded. I'll just use Star */}
              Équipes de Cœur
            </h3>
            
            <div className="flex flex-col gap-2">
              {favTeamsDetails.map((team, idx) => (
                <div key={idx} className="bg-white/5 rounded-xl p-3 flex items-center gap-3">
                  <img src={team.logo} alt="" className="w-10 h-10 object-contain" />
                  <div>
                    <h4 className="text-sm font-bold text-white leading-tight">{team.name}</h4>
                    <span className="text-[10px] inline-block px-1.5 py-0.5 bg-gray-800 text-gray-300 rounded font-bold uppercase mt-1">
                      {translateCountryName(team.country)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// Simple heart icon for the section
const HeartIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
  </svg>
);
