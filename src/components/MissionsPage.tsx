import React, { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Gift, ChevronLeft, Target } from 'lucide-react';
import { Card, Button } from './Layout';
import { UserProfile, Mission } from '../types';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, increment, arrayUnion, getDoc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../firebase';
import { useAlert } from '../context/AlertContext';
import { useReward } from '../context/RewardContext';
import { logTransaction } from '../services/transactionService';

interface MissionsPageProps {
  profile: UserProfile;
  onBack: () => void;
}

export function MissionsPage({ profile, onBack }: MissionsPageProps) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const { showAlert } = useAlert();
  const { showReward } = useReward();

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'missions'), (snapshot) => {
      const missionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Mission));
      setMissions(missionsData.filter(m => m.isActive));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'missions');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleClaimReward = async (mission: Mission) => {
    if (!profile.uid) return;
    
    const progress = profile.missionsProgress?.[mission.id];
    if (!progress || !progress.isCompleted || progress.isClaimed) return;

    try {
      const userRef = doc(db, 'users', profile.uid);
      const updates: any = {
        [`missionsProgress.${mission.id}.isClaimed`]: true
      };

      if (mission.reward?.type === 'money') updates.money = increment(mission.reward.amount || 0);
      if (mission.reward?.type === 'gems') updates.gems = increment(mission.reward.amount || 0);
      if (mission.reward?.type === 'boost') updates.boostPoints = increment(mission.reward.amount || 0);
      if (mission.reward?.type === 'energy') updates.energy = increment(mission.reward.amount || 0);
      if (mission.reward?.type === 'team_slot') updates.teamSlots = increment(1);
      if (mission.reward?.type === 'skin' && mission.reward.skinId) updates.skins = arrayUnion(mission.reward.skinId);
      
      await updateDoc(userRef, updates);

      if (mission.reward?.type === 'fanz' && mission.reward.fanzId) {
        const fanzRef = doc(db, 'fanz', `${profile.uid}_${mission.reward.fanzId}`);
        const fanzDoc = await getDoc(fanzRef);
        if (!fanzDoc.exists()) {
          const templateDoc = await getDoc(doc(db, 'fanz_templates', mission.reward.fanzId));
          if (templateDoc.exists()) {
            const templateData = templateDoc.data();
            await setDoc(fanzRef, {
              id: `${profile.uid}_${mission.reward.fanzId}`,
              templateId: mission.reward.fanzId,
              ownerUid: profile.uid,
              name: templateData.name || 'Unknown Fanz',
              sport: templateData.sport || 'Football',
              imageUrl: templateData.image || null,
              videoUrl: templateData.video || null,
              baseExcitement: templateData.baseExcitement || 5,
              level: 1,
              xp: 0,
              rank: 1,
              ferveurPoints: 0,
              ferveurLevel: 1,
              energy: 100,
              equippedCards: [],
              deck: [],
              unlockedSkins: [],
              unlockedEmotes: [],
              stats: templateData.baseStats || { force: 10, endurance: 10, mental: 10, bluff: 10, creativity: 10, social: 10, intelligence: 10, charisma: 10 },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }
        }
      }

      if (mission.reward?.type === 'money' && mission.reward.amount) await logTransaction(profile.uid, 'money', mission.reward.amount, `Récompense mission: ${mission.title}`);
      if (mission.reward?.type === 'gems' && mission.reward.amount) await logTransaction(profile.uid, 'gems', mission.reward.amount, `Récompense mission: ${mission.title}`);
      
      if (mission.reward) {
        showReward({
          type: mission.reward.type as any,
          amount: mission.reward.amount,
          title: `Mission Accomplie !`,
          subtitle: mission.title,
          card: mission.reward.type === 'card' && mission.reward.cardId ? { name: "Carte Débloquée" } : undefined,
          skin: mission.reward.type === 'skin' && mission.reward.skinId ? { name: "Skin Débloqué" } : undefined,
          emote: mission.reward.type === 'emote' && mission.reward.emoteId ? { name: "Emote Débloqué" } : undefined,
          action: mission.reward.type === 'action' && mission.reward.actionId ? { name: "Action Débloquée" } : undefined
        });
      } else {
        showAlert({ title: "Récompense récupérée !", type: "success" });
      }
    } catch (err) {
      console.error("Error claiming mission reward", err);
      showAlert({ title: "Erreur", subtitle: "Impossible de récupérer la récompense", type: "error" });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full bg-[#0a0a0a] text-white">Chargement...</div>;
  }

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="flex items-center justify-between px-4">
        <h1 className="text-lg sm:text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
          Missions
        </h1>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-20">
        {/* Daily Missions */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black italic uppercase tracking-tighter text-white">Quêtes Quotidiennes</h2>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Renouvellement dans 14h</span>
          </div>
          
          <div className="space-y-3">
            {missions.filter(m => !m.period || m.period === 'daily').map(mission => {
              const progress = profile.missionsProgress?.[mission.id];
              const currentValue = progress?.currentValue || 0;
              const isCompleted = progress?.isCompleted || false;
              const isClaimed = progress?.isClaimed || false;

              return (
              <Card key={mission.id} className={`p-4 border ${isCompleted ? 'border-green-500/30 bg-green-500/5' : 'border-white/5'}`}>
                <div className="flex items-center gap-4">
                  <div className="shrink-0">
                    {isCompleted ? (
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    ) : (
                      <Circle className="w-8 h-8 text-gray-600" />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <h3 className={`text-sm font-black uppercase tracking-tight mb-1 ${isCompleted ? 'text-green-400' : 'text-white'}`}>
                      {mission.title}
                    </h3>
                    
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-black rounded-full overflow-hidden border border-white/10">
                        <div 
                          className={`h-full transition-all duration-500 ${isCompleted ? 'bg-green-500' : 'bg-blue-500'}`}
                          style={{ width: `${Math.min(100, (currentValue / mission.target) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-gray-400">
                        {Math.min(currentValue, mission.target)}/{mission.target}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 flex flex-col items-center justify-center bg-black/40 px-3 py-2 rounded-xl border border-white/5">
                    {mission.reward?.type === 'money' && <span className="text-green-500 font-black text-sm">$</span>}
                    {mission.reward?.type === 'gems' && <span className="text-blue-500 font-black text-sm">💎</span>}
                    {mission.reward?.type === 'boost' && <span className="text-purple-500 font-black text-sm">⚡</span>}
                    {mission.reward?.type === 'energy' && <span className="text-yellow-500 font-black text-sm">⚡</span>}
                    {mission.reward?.type === 'team_slot' && <span className="text-orange-500 font-black text-sm">🛡️</span>}
                    {mission.reward?.type === 'fanz' && <span className="text-pink-500 font-black text-sm">👤</span>}
                    <span className="text-[10px] font-bold text-white mt-1">
                      {mission.reward?.type === 'team_slot' || mission.reward?.type === 'fanz' ? '+1' : `+${mission.reward?.amount || 0}`}
                    </span>
                  </div>
                </div>

                {isCompleted && !isClaimed && (
                  <Button 
                    className="w-full mt-3 bg-green-500 hover:bg-green-600 text-black font-black uppercase text-xs h-8"
                    onClick={() => handleClaimReward(mission)}
                  >
                    Récupérer
                  </Button>
                )}
                {isClaimed && (
                  <div className="w-full mt-3 py-1.5 bg-green-500/10 text-green-500 text-center font-black uppercase text-xs rounded-lg border border-green-500/20">
                    Récupéré
                  </div>
                )}
              </Card>
            )})}
            {missions.filter(m => !m.period || m.period === 'daily').length === 0 && (
              <div className="text-center py-4 text-gray-500 text-sm italic">
                Aucune quête quotidienne disponible.
              </div>
            )}
          </div>
        </section>

        {/* Weekly Missions */}
        <section>
          <div className="flex items-center justify-between mb-4 mt-8">
            <h2 className="text-lg font-black italic uppercase tracking-tighter text-white">Quêtes Hebdomadaires</h2>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Renouvellement dans 6j</span>
          </div>
          
          <div className="space-y-3">
            {missions.filter(m => m.period === 'weekly').map(mission => {
              const progress = profile.missionsProgress?.[mission.id];
              const currentValue = progress?.currentValue || 0;
              const isCompleted = progress?.isCompleted || false;
              const isClaimed = progress?.isClaimed || false;

              return (
              <Card key={mission.id} className={`p-4 border ${isCompleted ? 'border-green-500/30 bg-green-500/5' : 'border-white/5'}`}>
                <div className="flex items-center gap-4">
                  <div className="shrink-0">
                    {isCompleted ? (
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    ) : (
                      <Circle className="w-8 h-8 text-gray-600" />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <h3 className={`text-sm font-black uppercase tracking-tight mb-1 ${isCompleted ? 'text-green-400' : 'text-white'}`}>
                      {mission.title}
                    </h3>
                    
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-black rounded-full overflow-hidden border border-white/10">
                        <div 
                          className={`h-full transition-all duration-500 ${isCompleted ? 'bg-green-500' : 'bg-blue-500'}`}
                          style={{ width: `${Math.min(100, (currentValue / mission.target) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-gray-400">
                        {Math.min(currentValue, mission.target)}/{mission.target}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 flex flex-col items-center justify-center bg-black/40 px-3 py-2 rounded-xl border border-white/5">
                    {mission.reward?.type === 'money' && <span className="text-green-500 font-black text-sm">$</span>}
                    {mission.reward?.type === 'gems' && <span className="text-blue-500 font-black text-sm">💎</span>}
                    {mission.reward?.type === 'boost' && <span className="text-purple-500 font-black text-sm">⚡</span>}
                    {mission.reward?.type === 'energy' && <span className="text-yellow-500 font-black text-sm">⚡</span>}
                    {mission.reward?.type === 'team_slot' && <span className="text-orange-500 font-black text-sm">🛡️</span>}
                    {mission.reward?.type === 'fanz' && <span className="text-pink-500 font-black text-sm">👤</span>}
                    <span className="text-[10px] font-bold text-white mt-1">
                      {mission.reward?.type === 'team_slot' || mission.reward?.type === 'fanz' ? '+1' : `+${mission.reward?.amount || 0}`}
                    </span>
                  </div>
                </div>

                {isCompleted && !isClaimed && (
                  <Button 
                    className="w-full mt-3 bg-green-500 hover:bg-green-600 text-black font-black uppercase text-xs h-8"
                    onClick={() => handleClaimReward(mission)}
                  >
                    Récupérer
                  </Button>
                )}
                {isClaimed && (
                  <div className="w-full mt-3 py-1.5 bg-green-500/10 text-green-500 text-center font-black uppercase text-xs rounded-lg border border-green-500/20">
                    Récupéré
                  </div>
                )}
              </Card>
              );
            })}
            {missions.filter(m => m.period === 'weekly').length === 0 && (
              <div className="text-center py-4 text-gray-500 text-sm italic">
                Aucune quête hebdomadaire disponible.
              </div>
            )}
          </div>
        </section>

        {/* One Shot Missions */}
        <section>
          <div className="flex items-center justify-between mb-4 mt-8">
            <h2 className="text-lg font-black italic uppercase tracking-tighter text-white">Quêtes Uniques</h2>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Une seule fois</span>
          </div>
          
          <div className="space-y-3">
            {missions.filter(m => m.period === 'one_shot').map(mission => {
              const progress = profile.missionsProgress?.[mission.id];
              const currentValue = progress?.currentValue || 0;
              const isCompleted = progress?.isCompleted || false;
              const isClaimed = progress?.isClaimed || false;

              return (
              <Card key={mission.id} className={`p-4 border ${isCompleted ? 'border-green-500/30 bg-green-500/5' : 'border-white/5'}`}>
                <div className="flex items-center gap-4">
                  <div className="shrink-0">
                    {isCompleted ? (
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    ) : (
                      <Circle className="w-8 h-8 text-gray-600" />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <h3 className={`text-sm font-black uppercase tracking-tight mb-1 ${isCompleted ? 'text-green-400' : 'text-white'}`}>
                      {mission.title}
                    </h3>
                    
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-black rounded-full overflow-hidden border border-white/10">
                        <div 
                          className={`h-full transition-all duration-500 ${isCompleted ? 'bg-green-500' : 'bg-blue-500'}`}
                          style={{ width: `${Math.min(100, (currentValue / mission.target) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-gray-400">
                        {Math.min(currentValue, mission.target)}/{mission.target}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 flex flex-col items-center justify-center bg-black/40 px-3 py-2 rounded-xl border border-white/5">
                    {mission.reward?.type === 'money' && <span className="text-green-500 font-black text-sm">$</span>}
                    {mission.reward?.type === 'gems' && <span className="text-blue-500 font-black text-sm">💎</span>}
                    {mission.reward?.type === 'boost' && <span className="text-purple-500 font-black text-sm">⚡</span>}
                    {mission.reward?.type === 'energy' && <span className="text-yellow-500 font-black text-sm">⚡</span>}
                    {mission.reward?.type === 'team_slot' && <span className="text-orange-500 font-black text-sm">🛡️</span>}
                    {mission.reward?.type === 'fanz' && <span className="text-pink-500 font-black text-sm">👤</span>}
                    <span className="text-[10px] font-bold text-white mt-1">
                      {mission.reward?.type === 'team_slot' || mission.reward?.type === 'fanz' ? '+1' : `+${mission.reward?.amount || 0}`}
                    </span>
                  </div>
                </div>

                {isCompleted && !isClaimed && (
                  <Button 
                    className="w-full mt-3 bg-green-500 hover:bg-green-600 text-black font-black uppercase text-xs h-8"
                    onClick={() => handleClaimReward(mission)}
                  >
                    Récupérer
                  </Button>
                )}
                {isClaimed && (
                  <div className="w-full mt-3 py-1.5 bg-green-500/10 text-green-500 text-center font-black uppercase text-xs rounded-lg border border-green-500/20">
                    Récupéré
                  </div>
                )}
              </Card>
              );
            })}
            {missions.filter(m => m.period === 'one_shot').length === 0 && (
              <div className="text-center py-4 text-gray-500 text-sm italic">
                Aucune quête unique disponible.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
