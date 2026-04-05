import React, { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Gift } from 'lucide-react';
import { Card, Button } from './Layout';
import { UserProfile, Mission } from '../types';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, increment, arrayUnion, getDoc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../firebase';
import { useAlert } from '../context/AlertContext';
import { logTransaction } from '../services/transactionService';

interface MissionsPageProps {
  profile: UserProfile;
  onBack: () => void;
}

export function MissionsPage({ profile, onBack }: MissionsPageProps) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const { showAlert } = useAlert();

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
          await setDoc(fanzRef, {
            id: `${profile.uid}_${mission.reward.fanzId}`,
            templateId: mission.reward.fanzId,
            ownerUid: profile.uid,
            level: 1,
            xp: 0,
            ferveurPoints: 0,
            ferveurLevel: 1,
            stats: { force: 10, endurance: 10, mental: 10, bluff: 10, creativity: 10, social: 10, intelligence: 10, charisma: 10 }
          });
        }
      }

      if (mission.reward?.type === 'money' && mission.reward.amount) await logTransaction(profile.uid, 'money', mission.reward.amount, `Récompense mission: ${mission.title}`);
      if (mission.reward?.type === 'gems' && mission.reward.amount) await logTransaction(profile.uid, 'gems', mission.reward.amount, `Récompense mission: ${mission.title}`);
      
      showAlert({ title: "Récompense récupérée !", type: "success" });
    } catch (err) {
      console.error("Error claiming mission reward", err);
      showAlert({ title: "Erreur", subtitle: "Impossible de récupérer la récompense", type: "error" });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full bg-[#0a0a0a] text-white">Chargement...</div>;
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-gray-900/90 backdrop-blur-xl border-b border-white/10 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-black italic uppercase tracking-tighter text-white flex items-center gap-2">
            Missions
          </h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-20">
        {/* Daily Missions */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black italic uppercase tracking-tighter text-white">Quêtes Quotidiennes</h2>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Renouvellement dans 14h</span>
          </div>
          
          <div className="space-y-3">
            {missions.map(mission => {
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
          </div>
        </section>

        {/* Weekly Missions */}
        <section className="opacity-50 grayscale pointer-events-none">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black italic uppercase tracking-tighter text-white">Quêtes Hebdomadaires</h2>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Bientôt</span>
          </div>
          <Card className="p-8 flex flex-col items-center justify-center text-center border-white/5 border-dashed">
            <Gift className="w-12 h-12 text-gray-600 mb-2" />
            <p className="text-xs font-bold text-gray-500 uppercase">Débloqué au niveau 10</p>
          </Card>
        </section>
      </div>
    </div>
  );
}
