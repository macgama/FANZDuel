import React, { useState, useEffect } from 'react';
import { Ticket, ArrowLeft, Lock, Star, Check, ChevronLeft } from 'lucide-react';
import { Card, Button } from './Layout';
import { UserProfile, Pass, FanzSkin } from '../types';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, increment, getDoc, setDoc } from 'firebase/firestore';
import { useAlert } from '../context/AlertContext';
import { logTransaction } from '../services/transactionService';
import { getImageUrl } from '../lib/utils';

interface PassPageProps {
  profile: UserProfile;
  onBack: () => void;
}

export function PassPage({ profile, onBack }: PassPageProps) {
  const [allPasses, setAllPasses] = useState<Pass[]>([]);
  const [selectedPass, setSelectedPass] = useState<Pass | null>(null);
  const [loading, setLoading] = useState(true);
  const [skins, setSkins] = useState<Record<string, FanzSkin>>({});
  const { showAlert } = useAlert();

  useEffect(() => {
    const fetchPasses = async () => {
      try {
        const q = query(collection(db, 'passes'), where('isActive', '==', true));
        const snap = await getDocs(q);
        const passesData = await Promise.all(snap.docs.map(async (docSnap) => {
          const pass = { id: docSnap.id, ...docSnap.data() } as Pass;
          if (pass.skinRewardId && !pass.skinReward) {
            const skinDoc = await getDoc(doc(db, 'skins', pass.skinRewardId));
            if (skinDoc.exists()) {
              pass.skinReward = { id: skinDoc.id, ...skinDoc.data() } as FanzSkin;
            }
          }
          return pass;
        }));
        setAllPasses(passesData);
        
        // Fetch skins for all passes to have them ready
        const allSkinIds = passesData.flatMap(p => p.levels.map(l => l.premiumReward?.skinId).filter(Boolean)) as string[];
        
        if (allSkinIds.length > 0) {
          const allSkins: Record<string, FanzSkin> = {};
          
          const fanzSnap = await getDocs(collection(db, 'fanz_templates'));
          fanzSnap.forEach(doc => {
            const data = doc.data();
            if (data.skins) {
              data.skins.forEach((s: FanzSkin) => {
                if (s.id) allSkins[s.id] = s;
              });
            }
          });

          const skinsSnap = await getDocs(collection(db, 'skins'));
          skinsSnap.forEach(doc => {
            const data = doc.data() as FanzSkin;
            const id = data.id || doc.id;
            if (id) allSkins[id] = { ...data, id };
          });

          setSkins(allSkins);
        }
      } catch (err) {
        console.error("Error fetching passes", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPasses();
  }, []);

  const handleBuyPass = async (pass: Pass) => {
    const costMoney = pass.premiumPrice?.money || 0;
    const costGems = pass.premiumPrice?.gems || 0;
    
    if (profile.money < costMoney || profile.gems < costGems) {
      showAlert({ title: "Fonds insuffisants", type: "error" });
      return;
    }
    
    try {
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, {
        purchasedPasses: arrayUnion(pass.id),
        // For backward compatibility or if this is the "active" one
        isPassPremium: true,
        passId: pass.id,
        money: increment(-costMoney),
        gems: increment(-costGems)
      });
      
      if (costMoney > 0) await logTransaction(profile.uid, 'money', -costMoney, `Achat Pass ${pass.name}`);
      if (costGems > 0) await logTransaction(profile.uid, 'gems', -costGems, `Achat Pass ${pass.name}`);
      
      showAlert({ title: "Pass activé !", type: "success" });
    } catch (err) {
      console.error("Error buying pass", err);
      showAlert({ title: "Erreur lors de l'achat", type: "error" });
    }
  };

  const handleClaimReward = async (level: number, type: 'free' | 'premium') => {
    if (!selectedPass) return;
    
    if (!profile.purchasedPasses?.includes(selectedPass.id)) {
      showAlert({ title: "Pass non possédé", subtitle: "Vous devez activer ce pass pour récupérer les récompenses.", type: "error" });
      return;
    }

    const rewardId = `${selectedPass.id}-level-${level}-${type}`;
    if (profile.claimedPassRewards?.includes(rewardId)) return;
    
    const levelData = selectedPass.levels.find(l => l.level === level);
    if (!levelData) return;
    
    const reward = type === 'free' ? levelData.freeReward : levelData.premiumReward;
    if (!reward) return;
    
    try {
      const userRef = doc(db, 'users', profile.uid);
      const updates: any = {
        claimedPassRewards: arrayUnion(rewardId)
      };
      
      if (reward.type === 'money') updates.money = increment(reward.amount || 0);
      if (reward.type === 'gems') updates.gems = increment(reward.amount || 0);
      if (reward.type === 'boost') updates.boostPoints = increment(reward.amount || 0);
      if (reward.type === 'energy') updates.energy = increment(reward.amount || 0);
      if (reward.type === 'skin' && reward.skinId) updates.skins = arrayUnion(reward.skinId);
      if (reward.type === 'team_slot') updates.teamSlots = increment(1);
      
      await updateDoc(userRef, updates);
      
      if (reward.type === 'fanz' && reward.fanzId) {
        const fanzRef = doc(db, 'fanz', `${profile.uid}_${reward.fanzId}`);
        const fanzDoc = await getDoc(fanzRef);
        if (!fanzDoc.exists()) {
          const templateDoc = await getDoc(doc(db, 'fanz_templates', reward.fanzId));
          if (templateDoc.exists()) {
            const templateData = templateDoc.data();
            await setDoc(fanzRef, {
              id: `${profile.uid}_${reward.fanzId}`,
              templateId: reward.fanzId,
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
      
      if (reward.type === 'money' && reward.amount) await logTransaction(profile.uid, 'money', reward.amount, `Récompense Pass Niveau ${level}`);
      if (reward.type === 'gems' && reward.amount) await logTransaction(profile.uid, 'gems', reward.amount, `Récompense Pass Niveau ${level}`);
      
      showAlert({ title: "Récompense récupérée !", type: "success" });
    } catch (err) {
      console.error("Error claiming reward", err);
      showAlert({ title: "Erreur lors de la récupération", type: "error" });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full bg-[#0a0a0a] text-white">Chargement...</div>;
  }

  if (!selectedPass) {
    return (
      <div className="flex flex-col h-full bg-black">
        {/* Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-b from-purple-900/40 to-transparent shrink-0">
          <div className="flex items-center gap-4 mb-6">
            <button 
              onClick={onBack}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                <Ticket className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter text-white">FANZ Pass</h1>
                <p className="text-purple-200 text-xs sm:text-sm">Débloquez des récompenses exclusives</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {allPasses.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500 font-bold">Aucun Pass disponible.</div>
          ) : (
            allPasses.map(pass => {
              const isOwned = profile.purchasedPasses?.includes(pass.id);
              return (
                <Card 
                  key={pass.id} 
                  onClick={() => setSelectedPass(pass)}
                  className={`relative overflow-hidden cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] ${isOwned ? 'border-purple-500/50' : 'border-white/10'}`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-r ${isOwned ? 'from-purple-900/40 to-purple-500/10' : 'from-gray-900 to-gray-800/50'}`} />
                  <div className="relative p-6 flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-black italic uppercase tracking-tighter text-white mb-1">{pass.name}</h2>
                      <p className="text-xs text-gray-400 font-bold">{pass.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {isOwned ? (
                        <div className="px-3 py-1 bg-green-500/20 border border-green-500/50 rounded-full text-[10px] font-black text-green-400 uppercase">
                          Possédé
                        </div>
                      ) : (
                        <div className="px-3 py-1 bg-purple-500/20 border border-purple-500/50 rounded-full text-[10px] font-black text-purple-400 uppercase">
                          Découvrir
                        </div>
                      )}
                      <div className="text-[10px] font-bold text-gray-500 uppercase">
                        {pass.levels.length} Niveaux
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    );
  }

  const userPoints = profile.passPoints || 0;
  const isOwned = profile.purchasedPasses?.includes(selectedPass.id);

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Header */}
      <div className="p-4 sm:p-6 bg-gradient-to-b from-purple-900/40 to-transparent shrink-0">
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={() => setSelectedPass(null)}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <div className="flex items-center gap-3 flex-1">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
              <Ticket className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter text-white">{selectedPass.name}</h1>
              <p className="text-purple-200 text-xs sm:text-sm">Points Pass: <span className="font-black text-white">{userPoints}</span></p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-20">
        {/* Pass Banner */}
        <Card className={`relative overflow-hidden mb-8 ${isOwned ? 'border-purple-500/50' : 'border-white/10'}`}>
          <div className={`absolute inset-0 bg-gradient-to-r ${isOwned ? 'from-purple-900/80 to-purple-500/20' : 'from-gray-900 to-gray-800'}`} />
          <div className="relative p-6 flex flex-col items-center text-center">
            <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-1">{selectedPass.name}</h2>
            <p className="text-xs text-purple-200 font-bold mb-4">{selectedPass.description}</p>
            {!isOwned ? (
              <Button onClick={() => handleBuyPass(selectedPass)} className="w-full bg-purple-500 hover:bg-purple-600 text-white font-black uppercase flex flex-col gap-1 h-auto py-2">
                <span>Activer le Pass</span>
                <span className="text-[10px] opacity-80">
                  {selectedPass.premiumPrice?.money ? `${selectedPass.premiumPrice.money} 💰 ` : ''}
                  {selectedPass.premiumPrice?.money && selectedPass.premiumPrice?.gems ? '+ ' : ''}
                  {selectedPass.premiumPrice?.gems ? `${selectedPass.premiumPrice.gems} 💎` : ''}
                  {!selectedPass.premiumPrice?.money && !selectedPass.premiumPrice?.gems && `${selectedPass.priceGems} 💎`}
                </span>
              </Button>
            ) : (
              <div className="w-full py-3 bg-green-500/20 border border-green-500/50 rounded-xl text-green-400 font-black uppercase flex items-center justify-center gap-2">
                <Check className="w-5 h-5" /> Pass Actif
              </div>
            )}
          </div>
        </Card>

        {/* Pass Track */}
        <div className="space-y-4 relative">
          {/* Central Line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-white/5 -translate-x-1/2 rounded-full" />
          
          {selectedPass.levels.map((level) => {
            const unlocked = userPoints >= level.pointsRequired;
            const claimedFree = profile.claimedPassRewards?.includes(`${selectedPass.id}-level-${level.level}-free`);
            const claimedPremium = profile.claimedPassRewards?.includes(`${selectedPass.id}-level-${level.level}-premium`);
            
            return (
              <div key={level.level} className="relative flex items-center gap-4">
                {/* Free Reward (Left) */}
                <div className="flex-1 flex justify-end">
                  {level.freeReward ? (
                    <Card className={`p-3 w-32 flex flex-col items-center text-center border transition-all ${unlocked && isOwned ? (claimedFree ? 'border-white/10 bg-black/40 opacity-50' : 'border-green-500/50 bg-green-500/10') : 'border-white/5 bg-black/40 opacity-50'}`}>
                      <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">Gratuit</div>
                      <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center text-green-500 font-black mb-2">
                        {level.freeReward.type === 'money' ? '$' : level.freeReward.type === 'gems' ? '💎' : '⚡'}
                      </div>
                      <div className="text-xs font-black text-white mb-2">{level.freeReward.amount}</div>
                      {unlocked && isOwned && !claimedFree && (
                        <Button onClick={() => handleClaimReward(level.level, 'free')} size="sm" className="w-full h-6 text-[10px] bg-green-500 hover:bg-green-600 text-black font-black uppercase">
                          Récupérer
                        </Button>
                      )}
                      {claimedFree && <div className="text-[10px] text-green-500 font-bold uppercase"><Check className="w-3 h-3 mx-auto" /></div>}
                    </Card>
                  ) : <div className="w-32" />}
                </div>

                {/* Level Node */}
                <div className={`relative z-10 w-12 h-12 rounded-full flex flex-col items-center justify-center border-2 shrink-0 ${unlocked ? 'bg-purple-900 border-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'bg-gray-900 border-white/10 text-gray-600'}`}>
                  <span className="font-black italic leading-none">{level.level}</span>
                  <span className="text-[8px] font-bold opacity-50">{level.pointsRequired} pts</span>
                </div>

                {/* Premium Reward (Right) */}
                <div className="flex-1 flex justify-start">
                  {level.premiumReward ? (
                    <Card className={`p-3 w-32 flex flex-col items-center text-center border transition-all ${unlocked && isOwned ? (claimedPremium ? 'border-white/10 bg-black/40 opacity-50' : 'border-purple-500/50 bg-purple-500/10') : 'border-white/5 bg-black/40 opacity-50'}`}>
                      <div className="text-[10px] font-bold text-purple-400 uppercase mb-2 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Premium
                      </div>
                      
                      {level.premiumReward.type === 'skin' && level.premiumReward.skinId ? (
                        <>
                          <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center mb-2 overflow-hidden">
                            {skins[level.premiumReward.skinId] ? (
                              <img src={getImageUrl(skins[level.premiumReward.skinId].imageUrl)} alt="Skin" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xl">👕</span>
                            )}
                          </div>
                          <div className="text-[9px] font-black text-white mb-2 leading-tight h-6 overflow-hidden">
                            {skins[level.premiumReward.skinId]?.name || 'Skin Exclusif'}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-500 font-black mb-2">💎</div>
                          <div className="text-xs font-black text-white mb-2">{level.premiumReward.amount}</div>
                        </>
                      )}

                      {unlocked && isOwned && !claimedPremium && (
                        <Button onClick={() => handleClaimReward(level.level, 'premium')} size="sm" className="w-full h-6 text-[10px] bg-purple-500 hover:bg-purple-600 text-white font-black uppercase">
                          Récupérer
                        </Button>
                      )}
                      {claimedPremium && <div className="text-[10px] text-purple-500 font-bold uppercase"><Check className="w-3 h-3 mx-auto" /></div>}
                      {(!unlocked || !isOwned) && (
                        <div className="text-[10px] text-gray-500 font-bold uppercase flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Bloqué
                        </div>
                      )}
                    </Card>
                  ) : <div className="w-32" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
