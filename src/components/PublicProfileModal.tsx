import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, UserPlus, Shield, Star, ShieldAlert, Check, Zap } from 'lucide-react';
import { UserProfile, Fanz } from '../types';
import { getDoc, doc, updateDoc, arrayUnion, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { getImageUrl } from '../lib/utils';
import { footballApi } from '../services/footballApi';

interface PublicProfileModalProps {
  targetUid: string;
  currentUser: UserProfile;
  onClose: () => void;
}

export function PublicProfileModal({ targetUid, currentUser, onClose }: PublicProfileModalProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [favoriteTeamsInfo, setFavoriteTeamsInfo] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestSent, setRequestSent] = useState(false);
  const [isBot, setIsBot] = useState(false);
  const [activeFanz, setActiveFanz] = useState<Fanz | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    if (targetUid.startsWith('bot_')) {
      setIsBot(true);
      setProfile({
        uid: targetUid,
        pseudo: 'Bot',
        level: Math.floor(Math.random() * 50) + 1,
        favoriteTeams: [],
        money: 0,
        gems: 0,
        boostPoints: 0,
        energy: 0,
        lastEnergyRefill: '',
        ferveurPoints: 0,
        teamSlots: 0,
        cards: [],
        skins: [],
        emotes: [],
        role: 'client',
        streak: 0,
        claimedStreakDays: [],
        passPoints: 0,
        isPassPremium: false,
        claimedPassRewards: [],
        email: ''
      });
      setActiveFanz({
        id: 'bot_fanz',
        name: 'FANZ Bot',
        imageUrl: 'https://thebestfan.online/img/public/logo/logoFanz.png',
        stats: {
          force: Math.floor(Math.random() * 8) + 1,
          endurance: Math.floor(Math.random() * 8) + 1,
          mental: Math.floor(Math.random() * 8) + 1,
          bluff: Math.floor(Math.random() * 8) + 1,
          creativity: Math.floor(Math.random() * 8) + 1,
          social: Math.floor(Math.random() * 8) + 1,
          intelligence: Math.floor(Math.random() * 8) + 1,
          charisma: Math.floor(Math.random() * 8) + 1,
        },
        templateId: '',
        ownerUid: targetUid,
        xp: 0,
        equippedCards: [],
        favoriteTeams: [],
        gender: 'M',
        unlockedSkins: [],
      } as any);
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', targetUid));
        if (snap.exists() && isMounted) {
          const targetData = snap.data() as UserProfile;
          setProfile(targetData);
          if (targetData.friendRequests?.includes(currentUser.uid) || targetData.friends?.includes(currentUser.uid)) {
            setRequestSent(true);
          }
          
          if (targetData.favoriteTeams && targetData.favoriteTeams.length > 0) {
            const teams = await Promise.all(
              targetData.favoriteTeams.map(async (id) => {
                try {
                  const res = await footballApi.getTeamInfo(Number(id));
                  return res?.team;
                } catch (e) {
                  return null;
                }
              })
            );
            if (isMounted) setFavoriteTeamsInfo(teams.filter(Boolean));
          }

          // Charger le fanz actif de l'autre utilisateur
          const fanzQuery = query(collection(db, 'fanz'), where('ownerUid', '==', targetUid));
          const fanzSnap = await getDocs(fanzQuery);
          if (!fanzSnap.empty && isMounted) {
            const fanzList = fanzSnap.docs.map(d => ({ id: d.id, ...d.data() } as Fanz));
            const activeId = targetData.activeFanzId || targetData.activeAction?.fanzId;
            const foundActiveFanz = fanzList.find(f => f.id === activeId) || fanzList[0];
            setActiveFanz(foundActiveFanz);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchProfile();
    return () => { isMounted = false; };
  }, [targetUid, currentUser.uid]);

  const handleAddFriend = async () => {
    if (!profile || isBot || requestSent) return;
    try {
      await updateDoc(doc(db, 'users', targetUid), {
        friendRequests: arrayUnion(currentUser.uid)
      });
      setRequestSent(true);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden flex flex-col relative"
        >
          {/* Header */}
          <div className="h-24 bg-gradient-to-br from-blue-900 to-indigo-900 relative">
            <button 
              onClick={onClose}
              className="absolute top-2 right-2 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Profile Info */}
          <div className="px-6 pb-6 pt-0 flex flex-col items-center -mt-12 relative z-10">
            {loading ? (
              <div className="w-24 h-24 rounded-full bg-zinc-800 border-4 border-zinc-900 animate-pulse" />
            ) : (
               <div className="w-24 h-24 rounded-full border-4 border-zinc-900 bg-zinc-800 overflow-hidden relative shadow-xl">
                 {profile?.photoURL ? (
                   <img src={getImageUrl(profile.photoURL)} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-800">
                     <span className="text-3xl font-black text-white/50">{profile?.pseudo?.charAt(0)?.toUpperCase()}</span>
                   </div>
                 )}
               </div>
            )}

            <div className="mt-4 text-center w-full">
              {loading ? (
                <div className="h-6 w-32 bg-zinc-800 rounded animate-pulse mx-auto mb-2" />
              ) : (
                <h2 className="text-xl font-black text-white uppercase tracking-wider">{profile?.pseudo || 'Joueur Inconnu'}</h2>
              )}
              
              {!loading && profile && (
                <div className="flex items-center justify-center gap-2 mt-1">
                  <div className="bg-blue-500/20 px-2 py-0.5 rounded text-[10px] font-bold text-blue-400 border border-blue-500/30 flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    Niv. {profile.level || 1}
                  </div>
                  {profile.role === 'admin' && (
                    <div className="bg-red-500/20 px-2 py-0.5 rounded text-[10px] font-bold text-red-400 border border-red-500/30 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" />
                      Admin
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Favorite Teams */}
            {!loading && profile && profile.favoriteTeams?.length > 0 && (
              <div className="w-full mt-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 border-b border-white/5 pb-1">Équipes Favorites</h3>
                <div className="flex flex-wrap gap-2">
                  {favoriteTeamsInfo.length > 0 ? favoriteTeamsInfo.map((team: any) => (
                    <span key={team.id} className="text-xs font-medium text-white bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg flex items-center gap-2">
                      <img src={team.logo} alt={team.name} className="w-4 h-4 object-contain" />
                      {team.name}
                    </span>
                  )) : (
                    profile.favoriteTeams.map((teamId: string) => (
                      <span key={teamId} className="text-xs font-medium text-white bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg flex items-center gap-2">
                        <Shield className="w-3 h-3 text-emerald-400" />
                        Chargement...
                      </span>
                    ))
                  )}
                </div>
              </div>
            )}            {/* FANZ Actif & Jauges */}
            {!loading && activeFanz && (() => {
              const stats = (activeFanz.stats || {}) as any;
              const getStatLvl = (xp: number) => Math.min(10, Math.floor((xp || 1) / 100) + 1);
              const totalStats = 
                getStatLvl(stats.force) +
                getStatLvl(stats.endurance) +
                getStatLvl(stats.mental) +
                getStatLvl(stats.bluff) +
                getStatLvl(stats.creativity) +
                getStatLvl(stats.social) +
                getStatLvl(stats.intelligence) +
                getStatLvl(stats.charisma);

              // calcul ferveur par défaut pour l'affichage modal
              const currentFervor = activeFanz.ferveurPoints || 0;
              const configToUse = 500; // Pas de template entier mais on sait que le niveau 1 -> 500
              const currentLevel = Math.floor(currentFervor / configToUse) + 1;
              const nextLevelPoints = currentLevel * configToUse;
              const prevPoints = (currentLevel - 1) * configToUse;
              const progressFervor = ((currentFervor - prevPoints) / configToUse) * 100;

              const rank = activeFanz.rank ?? 1;

              return (
                <div className="w-full mt-6 bg-white/5 border border-white/10 rounded-xl p-3.5 flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">FANZ Actif</span>
                    <span className="text-xs font-black italic uppercase text-orange-400">{activeFanz.name}</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Jauge Ferveur */}
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider text-orange-400">
                        <span>Ferveur</span>
                        <span>{currentFervor}/{nextLevelPoints}</span>
                      </div>
                      <div className="h-2 w-full bg-black/60 rounded-full border border-white/10 relative overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full transition-all duration-500 relative"
                          style={{ width: `${Math.min(100, Math.max(0, progressFervor))}%` }}
                        >
                          <div className="absolute inset-0 bg-white/20 animate-pulse" />
                        </div>
                      </div>
                    </div>

                    {/* Jauge Aptitudes */}
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider text-amber-400">
                        <span>Stats</span>
                        <span>{totalStats}/80</span>
                      </div>
                      <div className="h-2 w-full bg-black/60 rounded-full border border-white/10 relative overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(12, (totalStats / 80) * 100))}%` }}
                        />
                      </div>
                    </div>

                    {/* Jauge Rang */}
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider text-rose-400">
                        <span>Rang</span>
                        <span>{rank}/10</span>
                      </div>
                      <div className="h-2 w-full bg-black/60 rounded-full border border-white/10 relative overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(10, (rank / 10) * 100))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
            
            {/* Stats */}
            {!loading && profile && (
               <div className="w-full mt-6 grid grid-cols-2 gap-3">
                 <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col items-center">
                   <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Victoires</span>
                   <span className="text-xl font-black text-white">{profile.matchesWon || 0}</span>
                 </div>
                 <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col items-center">
                   <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Duels</span>
                   <span className="text-xl font-black text-white">{profile.matchesPlayed || profile.matchesParticipated || 0}</span>
                 </div>
               </div>
            )}

            {/* Actions */}
            {!loading && profile && profile.uid !== currentUser.uid && !isBot && (
              <button 
                onClick={handleAddFriend}
                disabled={requestSent}
                className={`w-full mt-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 ${
                  requestSent 
                    ? 'bg-zinc-800 text-gray-500 border border-white/10 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg'
                }`}
              >
                {requestSent ? (
                  <>
                    <Check className="w-4 h-4" />
                    Demande Envoyée
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Ajouter en ami
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
