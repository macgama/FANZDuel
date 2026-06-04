import React, { useState, useEffect } from 'react';
import { UserProfile, Fanz } from '../types';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
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
  ChevronLeft,
  Gamepad2,
  Tv,
  MessageCircle,
  Activity,
  Award
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
  const [activeTab, setActiveTab] = useState<'overview' | 'duels' | 'activity' | 'history'>('overview');
  const [rendementFilter, setRendementFilter] = useState<'all' | 'official'>('all');
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch Fanz
        const fanzQ = query(collection(db, 'fanz'), where('ownerUid', '==', profile.uid));
        const fanzSnap = await getDocs(fanzQ);
        const fanzList = fanzSnap.docs.map(d => ({ id: d.id, ...d.data() } as Fanz));
        setUserFanz(fanzList);

        // Find active Fanz (either by activeFanzId or pick the first one)
        const activeFanz = fanzList.find(f => f.id === profile.activeFanzId) || fanzList[0];
        let avatarUrlToUse = profile.photoURL || null;

        if (activeFanz) {
          let activeFanzImg = activeFanz.imageUrl || null;
          if (activeFanz.templateId) {
            try {
              const tplDoc = await getDoc(doc(db, 'fanz_templates', activeFanz.templateId));
              if (tplDoc.exists()) {
                const tplData = tplDoc.data() as any;
                const activeSkin = tplData.skins?.find((s: any) => s.id === activeFanz.equippedSkin);
                if (activeSkin && activeSkin.imageUrl) {
                  activeFanzImg = activeSkin.imageUrl;
                } else if (!activeFanzImg) {
                  activeFanzImg = tplData.image || null;
                }
              }
            } catch (err) {
              console.error("Error loading active fanz template for StatsPage avatar", err);
            }
          }
          if (activeFanzImg) {
            avatarUrlToUse = activeFanzImg;
          }
        }
        setResolvedAvatarUrl(avatarUrlToUse);

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

  const totalWins = profile.win_count || profile.matchesWon || 0;
  const totalDuels = profile.duel_count || profile.matchesPlayed || 0;
  const winRate = totalDuels > 0 ? Math.round((totalWins / totalDuels) * 100) : 0;
  const bestFanz = [...userFanz].sort((a, b) => (b.level || 1) - (a.level || 1))[0];

  const getLevelProgress = () => {
    const FERVOR_RANGES = [
      { level: 1, min: 0, max: 1000 },
      { level: 2, min: 1000, max: 5000 },
      { level: 3, min: 5000, max: 15000 },
      { level: 4, min: 15000, max: 50000 },
      { level: 5, min: 50000, max: 150000 },
      { level: 6, min: 150000, max: 350000 },
      { level: 7, min: 350000, max: 750000 },
      { level: 8, min: 750000, max: 1500000 },
      { level: 9, min: 1500000, max: 3000000 },
      { level: 10, min: 3000000, max: 5000000 },
      { level: 11, min: 5000000, max: 7000000 },
      { level: 12, min: 7000000, max: 9000000 },
      { level: 13, min: 9000000, max: 10000000 },
      { level: 14, min: 10000000, max: 12000000 },
      { level: 15, min: 12000000, max: 15000000 },
    ];
    
    const currentFervor = profile.ferveurPoints || 0;
    const currentLevel = profile.level || 1;
    const range = FERVOR_RANGES.find(r => r.level === currentLevel) || { level: currentLevel, min: 0, max: 999999999 };
    
    const earned = currentFervor - range.min;
    const totalNeeded = range.max - range.min;
    const percent = Math.min(100, Math.max(0, Math.round((earned / totalNeeded) * 100)));
    return {
      percent,
      nextMin: range.max
    };
  };

  const progress = getLevelProgress();

  const duelTypesConfig = [
    {
      key: 'training',
      label: 'Entraînement Solo',
      subtitle: 'Contre un BOT IA',
      icon: <Gamepad2 className="w-5 h-5 text-gray-400" />
    },
    {
      key: '1v1',
      label: 'Clash direct (1v1 TV)',
      subtitle: 'Duels en face-à-face',
      icon: <Tv className="w-5 h-5 text-blue-400" />
    },
    {
      key: '2v2',
      label: 'Match Co-op (2v2)',
      subtitle: 'Alliance de supporters',
      icon: <Users className="w-5 h-5 text-purple-400" />
    },
    {
      key: '5v5',
      label: 'Grande Arène (5v5)',
      subtitle: 'Guerre de clubs',
      icon: <Swords className="w-5 h-5 text-red-400" />
    },
    {
      key: 'war_of_kops',
      label: 'Guerre des KOPs',
      subtitle: 'Le sommet de l\'ambiance',
      icon: <Trophy className="w-5 h-5 text-yellow-500" />
    }
  ];

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
        <div>
          <h2 className="text-xl font-black italic uppercase tracking-wider text-white leading-none">Missions & Stats</h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none mt-1">Analyse de mes performances</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 no-scrollbar pb-32">
        <div className="max-w-2xl mx-auto space-y-6">
          
          {/* Header Card */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-600 to-orange-950 p-4 sm:p-6 shadow-2xl border border-orange-500/10">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/20 backdrop-blur-md border-4 border-white/30 flex items-center justify-center mb-2 sm:mb-3 overflow-hidden shadow-lg">
                {resolvedAvatarUrl ? (
                  <img 
                    src={getImageUrl(resolvedAvatarUrl)} 
                    alt="" 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                  />
                ) : profile.photoURL ? (
                  <img 
                    src={getImageUrl(profile.photoURL)} 
                    alt="" 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <Users className="w-8 h-8 text-white" />
                )}
              </div>
              <h2 className="text-lg xs:text-xl sm:text-2xl font-black italic uppercase tracking-tighter mb-1 text-center">{profile.displayName || 'Guerrier du KOP'}</h2>
              <div className="px-2.5 py-0.5 bg-white/20 backdrop-blur-md rounded-full text-[9px] font-black uppercase tracking-widest border border-white/20 flex items-center gap-1 shadow-sm">
                <Award className="w-3.5 h-3.5 text-yellow-300" />
                Niveau {profile.level || 1}
              </div>
              
              {/* Level XP Bar */}
              <div className="w-full max-w-sm mt-4">
                <div className="flex justify-between text-[7px] font-bold uppercase text-white/70 tracking-widest mb-1">
                  <span>EXP progres</span>
                  <span>{profile.ferveurPoints?.toLocaleString() || 0} / {progress.nextMin.toLocaleString()} FERVEUR</span>
                </div>
                <div className="w-full bg-black/40 h-2 rounded-full p-0.5 border border-white/5 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-yellow-400 to-orange-400 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-4 sm:mt-6 relative z-10 bg-black/25 p-3 sm:p-4 rounded-2xl backdrop-blur-sm border border-white/5">
              <div className="text-center">
                <div className="text-lg sm:text-xl font-bold tracking-tight text-white font-sans">{totalDuels}</div>
                <div className="text-[8px] sm:text-[9px] font-black uppercase text-white/50 tracking-widest">Duels</div>
              </div>
              <div className="text-center border-x border-white/10">
                <div className="text-lg sm:text-xl font-bold tracking-tight text-white font-sans">{winRate}%</div>
                <div className="text-[8px] sm:text-[9px] font-black uppercase text-white/50 tracking-widest">Victoires</div>
              </div>
              <div className="text-center">
                <div className="text-lg sm:text-xl font-bold tracking-tight text-white font-sans">{profile.money || 0}</div>
                <div className="text-[8px] sm:text-[9px] font-black uppercase text-white/50 tracking-widest">Pièces</div>
              </div>
            </div>
          </div>

          {/* Sticky Interactive Tab Switcher */}
          <div className="flex bg-neutral-900 p-1 rounded-xl sm:rounded-2xl gap-0.5 sm:gap-1 border border-white/5 shadow-inner">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 py-2 sm:py-2.5 text-[8px] xs:text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider rounded-lg sm:rounded-xl transition-all ${
                activeTab === 'overview'
                  ? 'bg-orange-600 text-white shadow-lg font-black'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              Général
            </button>
            <button
              onClick={() => setActiveTab('duels')}
              className={`flex-1 py-2 sm:py-2.5 text-[8px] xs:text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider rounded-lg sm:rounded-xl transition-all ${
                activeTab === 'duels'
                  ? 'bg-orange-600 text-white shadow-lg font-black'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              Modes Duel
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`flex-1 py-2 sm:py-2.5 text-[8px] xs:text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider rounded-lg sm:rounded-xl transition-all ${
                activeTab === 'activity'
                  ? 'bg-orange-600 text-white shadow-lg font-black'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              Activités
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-2 sm:py-2.5 text-[8px] xs:text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider rounded-lg sm:rounded-xl transition-all ${
                activeTab === 'history'
                  ? 'bg-orange-600 text-white shadow-lg font-black'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              Historique
            </button>
          </div>

          {/* Tab Contents */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Detailed Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <StatBox icon={<Flame className="text-orange-500" />} label="Streak" value={`${profile.streak || 0} jours`} />
                <StatBox icon={<Star className="text-yellow-500" />} label="Ferveur" value={profile.ferveurPoints?.toLocaleString() || '0'} />
                <StatBox icon={<Zap className="text-blue-500" />} label="Energie" value={`${profile.energy}/${profile.maxEnergy || 100}`} />
                <StatBox icon={<Trophy className="text-purple-500" />} label="Rareté Max" value={bestFanz?.rarity || 'Commun'} />
              </div>

              {/* Best Fanz */}
              <section className="bg-neutral-900 border border-white/5 rounded-3xl p-4 sm:p-5 shadow-lg">
                <div className="flex items-center gap-2 mb-4">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-neutral-300">Mon meilleur Fanz</h3>
                </div>
                {bestFanz ? (
                  <div className="bg-black/60 border border-white/5 rounded-2xl p-3 sm:p-4 flex gap-3 sm:gap-5 items-center">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-neutral-800 rounded-xl overflow-hidden shrink-0 border border-white/10 flex items-center justify-center relative shadow-md">
                      {(bestFanz.imageUrl || (bestFanz as any).image) ? (
                        <img src={getImageUrl(bestFanz.imageUrl || (bestFanz as any).image)} alt="" className="w-full h-full object-cover" />
                      ) : bestFanz.videoUrl ? (
                        <video src={getImageUrl(bestFanz.videoUrl)} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                      ) : (
                        <Star className="w-8 h-8 text-neutral-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm sm:text-base font-black italic uppercase tracking-tighter text-white truncate">{bestFanz.name}</div>
                      <div className="text-[9px] font-black uppercase text-yellow-500 tracking-widest mb-2 flex items-center gap-1">
                        <span>Niveau {bestFanz.level || 1}</span>
                        <span>•</span>
                        <span>{bestFanz.rarity}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <div className="flex justify-between text-[9px] font-bold border-b border-white/5 py-1">
                          <span className="text-neutral-500">FORCE</span>
                          <span className="text-neutral-200">{bestFanz.stats?.force || 1}</span>
                        </div>
                        <div className="flex justify-between text-[9px] font-bold border-b border-white/5 py-1">
                          <span className="text-neutral-500 font-mono">MENTAL</span>
                          <span className="text-neutral-200">{bestFanz.stats?.mental || 1}</span>
                        </div>
                        <div className="flex justify-between text-[9px] font-bold border-b border-white/5 py-1">
                          <span className="text-neutral-500">BLUFF</span>
                          <span className="text-neutral-200">{bestFanz.stats?.bluff || 1}</span>
                        </div>
                        <div className="flex justify-between text-[9px] font-bold border-b border-white/5 py-1">
                          <span className="text-neutral-500">SOCIAL</span>
                          <span className="text-neutral-200">{bestFanz.stats?.social || 1}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 bg-black/40 border border-dashed border-white/10 rounded-2xl">
                    <p className="text-xs text-neutral-500 font-medium uppercase">Aucun Fanz trouvé</p>
                  </div>
                )}
              </section>

              {/* Favorite Teams */}
              <section className="bg-neutral-900 border border-white/5 rounded-3xl p-4 sm:p-5 shadow-lg">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-4 h-4 text-orange-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-neutral-300">Équipes Favorites</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {favoriteTeamsInfo.length > 0 ? (
                    favoriteTeamsInfo.map(team => (
                      <div key={team.id} className="bg-black/40 border border-white/5 rounded-xl p-2.5 sm:p-3 flex items-center gap-2.5 sm:gap-3.5 group hover:bg-neutral-800 transition-colors">
                        <div className="w-10 h-10 flex items-center justify-center shrink-0 bg-neutral-900/60 rounded-lg p-1.5">
                          <img src={getImageUrl(team.logo, 100)} alt="" className="w-full h-full object-contain" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-black uppercase truncate text-neutral-200">{team.name}</div>
                          <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">{team.country}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-6 bg-black/40 border border-dashed border-white/10 rounded-2xl">
                      <p className="text-xs text-neutral-500 font-medium uppercase">Aucune équipe favorite liée</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'duels' && (
            <div className="space-y-4">
              <div className="bg-neutral-900 border border-white/5 rounded-3xl p-4 sm:p-5 shadow-md">
                <div className="flex items-center gap-2 mb-4">
                  <Swords className="w-4 h-4 text-orange-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-neutral-300">Statistiques par Modes de Duel</h3>
                </div>

                <div className="space-y-3.5">
                  {duelTypesConfig.map(mode => {
                    const played = (profile as any)[`duels_${mode.key}_count`] || 0;
                    const won = (profile as any)[`duels_${mode.key}_win_count`] || 0;
                    const rate = played > 0 ? Math.round((won / played) * 100) : 0;

                    return (
                      <div key={mode.key} className="bg-black/50 border border-white/5 rounded-2xl p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-neutral-800 rounded-xl flex items-center justify-center shrink-0">
                            {mode.icon}
                          </div>
                          <div>
                            <div className="text-xs font-black uppercase text-neutral-200">{mode.label}</div>
                            <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">{mode.subtitle}</div>
                          </div>
                        </div>

                        <div className="flex-1 md:max-w-[200px]">
                          <div className="flex justify-between items-end mb-1">
                            <span className="text-[10px] font-bold text-neutral-400 font-mono">
                              {won}V / {played - won}D
                            </span>
                            <span className={`text-[10px] font-black ${rate >= 50 ? 'text-green-400' : 'text-neutral-400'}`}>
                              {rate}% Victoires
                            </span>
                          </div>
                          <div className="w-full bg-neutral-900 h-2 rounded-full overflow-hidden border border-white/5">
                            <div 
                              className="bg-gradient-to-r from-orange-500 to-amber-400 h-full rounded-full transition-all duration-300" 
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-6">
              {/* Gameplay stats blocks */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-neutral-900 border border-white/5 rounded-2xl p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3.5 shadow-md">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-orange-500/10 rounded-xl flex items-center justify-center shrink-0">
                    <Activity className="w-5 h-5 text-orange-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider leading-none mb-1 truncate">Total Clics</div>
                    <div className="text-lg sm:text-xl font-black italic uppercase tracking-tighter text-white">{(profile.clicks_count || 0).toLocaleString()}</div>
                    <div className="text-[8px] font-bold text-neutral-400 font-mono uppercase tracking-widest mt-0.5 truncate">Encouragements</div>
                  </div>
                </div>

                <div className="bg-neutral-900 border border-white/5 rounded-2xl p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3.5 shadow-md">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-500/10 rounded-xl flex items-center justify-center shrink-0">
                    <Swords className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider leading-none mb-1 truncate">Cartes Jouées</div>
                    <div className="text-lg sm:text-xl font-black italic uppercase tracking-tighter text-white">{(profile.cards_played_count || 0).toLocaleString()}</div>
                    <div className="text-[8px] font-bold text-neutral-400 font-mono uppercase tracking-widest mt-0.5 truncate">En combat</div>
                  </div>
                </div>

                <div className="bg-neutral-900 border border-white/5 rounded-2xl p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3.5 shadow-md col-span-2">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-purple-500/10 rounded-xl flex items-center justify-center shrink-0">
                    <MessageCircle className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider leading-none mb-1 truncate">Emotes Envoyées</div>
                    <div className="text-lg sm:text-xl font-black italic uppercase tracking-tighter text-white">{(profile.emotes_sent_count || 0).toLocaleString()}</div>
                    <div className="text-[8px] font-bold text-neutral-400 font-mono uppercase tracking-widest mt-0.5 truncate">Réactions expressives chat arène</div>
                  </div>
                </div>
              </div>

              {/* Multiplier Average Metrics */}
              <section className="bg-neutral-900 border border-white/5 rounded-3xl p-4 sm:p-5 shadow-lg">
                <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-500" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-neutral-300">Rendement de Match</h3>
                  </div>
                  <div className="flex bg-neutral-950 p-1 rounded-lg border border-white/5 gap-0.5 shadow-inner shrink-0">
                    <button 
                      onClick={() => setRendementFilter('all')}
                      aria-label="Afficher le rendement pour tous les matchs"
                      className={`px-2 py-1 text-[8.5px] font-black uppercase tracking-wider rounded-md transition-all ${
                        rendementFilter === 'all' ? 'bg-orange-600 text-white' : 'text-neutral-500 hover:text-neutral-300'
                      }`}
                    >
                      Global
                    </button>
                    <button 
                      onClick={() => setRendementFilter('official')}
                      aria-label="Afficher le rendement pour les matchs officiels uniquement"
                      className={`px-2 py-1 text-[8.5px] font-black uppercase tracking-wider rounded-md transition-all ${
                        rendementFilter === 'official' ? 'bg-orange-600 text-white' : 'text-neutral-500 hover:text-neutral-300'
                      }`}
                    >
                      Matchs Officiels
                    </button>
                  </div>
                </div>

                {(() => {
                  const officialDuelsCount = (profile.duels_1v1_count || 0) + 
                                             (profile.duels_2v2_count || 0) + 
                                             (profile.duels_5v5_count || 0) + 
                                             (profile.duels_war_of_kops_count || 0);
                  const denominator = rendementFilter === 'all' ? totalDuels : officialDuelsCount;

                  return (
                    <>
                      <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        <div className="bg-black/50 p-3 sm:p-4 rounded-xl border border-white/5 text-center">
                          <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
                            {denominator > 0 ? ( (profile.clicks_count || 0) / denominator ).toFixed(1) : "0.0"}
                          </div>
                          <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider mt-1">Clics moyens / match</div>
                        </div>

                        <div className="bg-black/50 p-3 sm:p-4 rounded-xl border border-white/5 text-center">
                          <div className="text-xl sm:text-2xl font-black text-blue-400 font-mono">
                            {denominator > 0 ? ( (profile.cards_played_count || 0) / denominator ).toFixed(1) : "0.0"}
                          </div>
                          <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider mt-1">Cartes posées / match</div>
                        </div>
                      </div>
                      <p className="text-[8px] text-neutral-500 font-medium tracking-wide uppercase mt-3.5 mb-1 text-center font-mono leading-relaxed">
                        {rendementFilter === 'all' 
                          ? "Inclus tous les duels d'entraînement + tous les duels multijoueurs officiels"
                          : "Inclus uniquement les duels officiels (1v1, 2v2, 5v5 et Guerre des KOPs)"
                        }
                      </p>
                    </>
                  );
                })()}
              </section>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <section className="bg-neutral-900 border border-white/5 rounded-3xl p-4 sm:p-5 shadow-md">
                <div className="flex items-center gap-2 mb-4">
                  <History className="w-4 h-4 text-blue-500" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-neutral-300">Historique des 20 derniers duels</h3>
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
                          className="bg-black/40 border border-white/5 rounded-2xl p-3 xs:p-4 flex items-center justify-between cursor-pointer hover:bg-neutral-800 transition-colors"
                          onClick={() => setSelectedDuelDetails(duel.id)}
                        >
                          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${isWin ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                              {isWin ? 'W' : 'L'}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-black uppercase truncate max-w-[140px] xs:max-w-[180px] text-neutral-200">{duel.teamHome.name} vs {duel.teamAway.name}</div>
                              <div className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest mt-0.5">{dateStr} • {myUser.score} pts</div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs font-black text-white font-mono">{duel.teamHome.score} - {duel.teamAway.score}</div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 bg-black/40 border border-dashed border-white/10 rounded-2xl">
                      <p className="text-xs text-neutral-500 font-medium uppercase">Aucun duel enregistré</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

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
    <div className="bg-neutral-900 border border-white/5 rounded-xl p-3 xs:p-4 flex items-center gap-2 xs:gap-3 shadow-md">
      <div className="w-8 h-8 xs:w-9 xs:h-9 bg-black/40 rounded-xl flex items-center justify-center shrink-0 border border-white/5">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest truncate">{label}</div>
        <div className="text-xs xs:text-sm sm:text-base font-black italic uppercase tracking-tighter text-white mt-0.5 truncate">{value}</div>
      </div>
    </div>
  );
}
