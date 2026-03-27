import React, { useState, useEffect } from 'react';
import { getImageUrl } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, updateDoc, collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { Card, Button } from './Layout';
import { UserProfile, Fanz, ActiveAction, LifeAction, UserCard, Card as DuelCard, FanzTemplate, FanzSkin, FanzEmote } from '../types';
import { Trophy, Lock, Star, Info, ArrowLeft, Zap, Shield, Brain, Heart, Eye, MessageCircle, Users, Flame, Activity, Database, Clock, Coins, Gem, Trash2, FastForward, ChevronUp, CheckCircle, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

import { LifeActionCard } from './LifeActionCard';

import { BASE_CARDS } from '../constants/cards';

interface FanzDetailsProps {
  fanzId: string;
  userProfile: UserProfile;
  onBack: () => void;
}

export function FanzDetails({ fanzId, userProfile, onBack }: FanzDetailsProps) {
  const [fanz, setFanz] = useState<Fanz | null>(null);
  const [template, setTemplate] = useState<FanzTemplate | null>(null);
  const [lifeActions, setLifeActions] = useState<LifeAction[]>([]);
  const [userCards, setUserCards] = useState<Record<string, UserCard>>({});
  const [allCards, setAllCards] = useState<DuelCard[]>([]);
  const [allSkins, setAllSkins] = useState<FanzSkin[]>([]);
  const [allEmotes, setAllEmotes] = useState<FanzEmote[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stats' | 'cards' | 'skins' | 'emotes' | 'rank' | 'ferveur'>('stats');
  const [claimingReward, setClaimingReward] = useState<string | null>(null);
  const [rewardModal, setRewardModal] = useState<{
    isOpen: boolean;
    title: string;
    rankNum?: number;
    slotId: string;
    rewardType: 'choice' | 'card' | 'xp' | 'skin' | 'emote';
    amount?: number;
    cardId?: string;
    skinId?: string;
    emoteId?: string;
    step: 'initial' | 'skill-selection' | 'card-selection' | 'skin-selection' | 'emote-selection' | 'success';
    selectedChoice?: 'card' | 'xp' | 'skin' | 'emote';
    unlockedCard?: DuelCard;
    unlockedSkin?: FanzSkin;
    unlockedEmote?: FanzEmote;
  } | null>(null);

  const [alertModal, setAlertModal] = useState<{
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const toggleCard = async (cardId: string) => {
    if (!fanz) return;
    
    const currentDeck = fanz.equippedCards || [];
    let newDeck: string[];
    
    if (currentDeck.includes(cardId)) {
      newDeck = currentDeck.filter(id => id !== cardId);
    } else {
      if (currentDeck.length >= 8) return;
      newDeck = [...currentDeck, cardId];
    }
    
    try {
      const fanzRef = doc(db, 'fanz', fanz.id);
      await updateDoc(fanzRef, { equippedCards: newDeck });
      setFanz({ ...fanz, equippedCards: newDeck });
    } catch (error) {
      console.error("Error updating deck:", error);
    }
  };

  useEffect(() => {
    let unsubscribeFanz: () => void;

    const fetchFanzAndActions = async () => {
      try {
        const docRef = doc(db, 'fanz', fanzId);
        
        unsubscribeFanz = onSnapshot(docRef, async (docSnap) => {
          if (docSnap.exists()) {
            const fanzData = docSnap.data() as Fanz;
            setFanz(fanzData);
            
            const tplRef = doc(db, 'fanz_templates', fanzData.templateId);
            const tplSnap = await getDoc(tplRef);
            if (tplSnap.exists()) {
              const tplData = tplSnap.data() as FanzTemplate;
              setTemplate(tplData);
              setAllSkins(tplData.skins || []);
              setAllEmotes(tplData.emotes || []);
            }
          }
        }, (error) => {
          console.error("Error listening to Fanz:", error);
          handleFirestoreError(error, OperationType.GET, `fanz/${fanzId}`);
        });

        const cardsSnapshot = await getDocs(collection(db, 'cards'));
        const cardsData = cardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DuelCard));
        const initialCards = cardsData.length > 0 ? cardsData : BASE_CARDS;
        setAllCards(initialCards);

        const actionsSnapshot = await getDocs(collection(db, 'life_actions'));
        const actionsData = actionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LifeAction));
        setLifeActions(actionsData);

        const userCardsSnapshot = await getDocs(collection(db, 'users', userProfile.uid, 'user_cards'));
        const userCardsData: Record<string, UserCard> = {};
        userCardsSnapshot.docs.forEach(doc => {
          userCardsData[doc.id] = doc.data() as UserCard;
        });
        setUserCards(userCardsData);
      } catch (error) {
        console.error("Error fetching Fanz details or actions:", error);
        handleFirestoreError(error, OperationType.GET, `fanz/${fanzId}`);
      } finally {
        setLoading(false);
      }
    };

    fetchFanzAndActions();
    return () => {
      if (unsubscribeFanz) unsubscribeFanz();
    };
  }, [fanzId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-orange-500"></div>
        <p className="text-gray-500 font-bold animate-pulse">Chargement du FANZ...</p>
      </div>
    );
  }

  if (!fanz || !template) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 font-bold">FANZ introuvable.</p>
        <button onClick={onBack} className="mt-4 text-orange-500 font-bold">Retour</button>
      </div>
    );
  }

  const statIcons = {
    force: <Zap className="w-4 h-4 text-yellow-500" />,
    endurance: <Shield className="w-4 h-4 text-green-500" />,
    mental: <Brain className="w-4 h-4 text-purple-500" />,
    bluff: <Eye className="w-4 h-4 text-blue-500" />,
    creativity: <Star className="w-4 h-4 text-pink-500" />,
    social: <Users className="w-4 h-4 text-cyan-500" />,
    intelligence: <Info className="w-4 h-4 text-indigo-500" />,
    charisma: <Flame className="w-4 h-4 text-red-500" />
  };

  const statLabels = {
    force: 'Force',
    endurance: 'Endurance',
    mental: 'Mental',
    bluff: 'Bluff',
    creativity: 'Créativité',
    social: 'Social',
    intelligence: 'Intelligence',
    charisma: 'Charisme'
  };

  const handleBuySkin = async (skin: FanzSkin) => {
    if (!fanz || !userProfile) return;
    
    const userBalance = userProfile[skin.price.type] || 0;
    if (userBalance < skin.price.amount) {
      setAlertModal({
        title: 'Fonds insuffisants',
        message: `Il vous manque ${skin.price.amount - userBalance} ${skin.price.type === 'money' ? 'Argent' : skin.price.type === 'gems' ? 'Gemmes' : 'Boost'} pour acheter ce skin.`,
        type: 'error'
      });
      return;
    }

    try {
      const userRef = doc(db, 'users', userProfile.uid);
      const fanzRef = doc(db, 'fanz', fanz.id);
      
      const updatedSkins = [...(fanz.unlockedSkins || []), skin.id];
      
      await updateDoc(userRef, {
        [skin.price.type]: userBalance - skin.price.amount
      });
      
      await updateDoc(fanzRef, {
        unlockedSkins: updatedSkins,
        equippedSkin: skin.id
      });

      setAlertModal({
        title: 'Skin acheté !',
        message: `Vous avez débloqué le skin ${skin.name}.`,
        type: 'success'
      });
    } catch (error) {
      console.error("Error buying skin:", error);
      handleFirestoreError(error, OperationType.UPDATE, `fanz/${fanz.id}`);
    }
  };

  const handleEquipSkin = async (skinId: string | undefined) => {
    if (!fanz) return;
    
    try {
      const fanzRef = doc(db, 'fanz', fanz.id);
      await updateDoc(fanzRef, {
        equippedSkin: skinId || null
      });
    } catch (error) {
      console.error("Error equipping skin:", error);
      handleFirestoreError(error, OperationType.UPDATE, `fanz/${fanz.id}`);
    }
  };

  const equippedSkinData = template?.skins?.find(s => s.id === fanz?.equippedSkin);
  const currentImageUrl = equippedSkinData?.imageUrl || fanz?.imageUrl || template?.image;
  const currentVideoUrl = equippedSkinData?.videoUrl || fanz?.videoUrl || template?.video;

  return (
    <div className="space-y-6 pb-20">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors font-bold uppercase text-xs tracking-wider"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour à la collection
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Fanz Identity */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="overflow-hidden relative group">
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10 pointer-events-none"></div>
            
            <div className="absolute top-4 right-4 z-30 flex flex-col items-end gap-2">
              <div className="bg-orange-500 text-white px-3 py-1 rounded-full font-black italic text-xs shadow-lg">
                RANG {fanz.rank || 1}
              </div>
              {fanz.rank > 1 && (
                <div className="bg-black/60 backdrop-blur-sm text-orange-500 px-2 py-0.5 rounded-full font-bold text-[8px] uppercase tracking-widest border border-orange-500/30">
                  +{ (fanz.rank - 1) * 2 }% Ferveur
                </div>
              )}
            </div>
            
            {currentVideoUrl ? (
              <video 
                key={getImageUrl(currentVideoUrl)}
                poster={getImageUrl(currentImageUrl || '')}
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                crossOrigin="anonymous"
                className="w-full aspect-[3/4] object-contain transition-transform duration-500 group-hover:scale-105"
              >
                <source src={getImageUrl(currentVideoUrl)} type="video/mp4" />
              </video>
            ) : (
              <img 
                src={getImageUrl(currentImageUrl || '')} 
                alt={fanz.name}
                className="w-full aspect-[3/4] object-contain transition-transform duration-500 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
            )}

            <div className="absolute bottom-0 left-0 right-0 p-6 z-20">
              <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white mb-1">
                {fanz.name}
              </h1>
              <p className="text-gray-300 text-sm font-medium">{template.description}</p>
            </div>
          </Card>

          {/* Ferveur Path */}
          <Card className="p-6">
            <h3 className="text-lg font-black italic uppercase tracking-tighter mb-4 flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              Chemin de la Ferveur
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-2xl font-black text-white">{fanz.ferveurLevel > 1 ? `Niv. ${fanz.ferveurLevel}` : 'Débutant'}</div>
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Niveau de Ferveur</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-orange-500">{fanz.ferveurPoints} / 1000</div>
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Points</div>
                </div>
              </div>
              <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/10">
                <div 
                  className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full"
                  style={{ width: `${(fanz.ferveurPoints / 1000) * 100}%` }}
                ></div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Action Banner */}
          {userProfile.activeAction?.fanzId === fanz.id && (
            <div className="mb-6">
              {lifeActions
                .filter(a => a.id === userProfile.activeAction?.actionId)
                .map(action => (
                  <LifeActionCard 
                    key={action.id} 
                    action={action} 
                    fanz={fanz} 
                    userProfile={userProfile} 
                  />
                ))}
            </div>
          )}

          {/* Tabs */}
          <div className={`flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10 overflow-x-auto no-scrollbar ${userProfile.activeAction ? 'opacity-50 pointer-events-none' : ''}`}>
            <TabButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} label="Compétences" icon={<Activity className="w-4 h-4" />} />
            <TabButton active={activeTab === 'ferveur'} onClick={() => setActiveTab('ferveur')} label="Ferveur" icon={<Flame className="w-4 h-4" />} />
            <TabButton active={activeTab === 'rank'} onClick={() => setActiveTab('rank')} label="Rang" icon={<Trophy className="w-4 h-4" />} />
            <TabButton active={activeTab === 'cards'} onClick={() => setActiveTab('cards')} label="Deck (Cartes)" icon={<Database className="w-4 h-4" />} />
            <TabButton active={activeTab === 'skins'} onClick={() => setActiveTab('skins')} label="Skins" icon={<Users className="w-4 h-4" />} />
            <TabButton active={activeTab === 'emotes'} onClick={() => setActiveTab('emotes')} label="Emotes" icon={<MessageCircle className="w-4 h-4" />} />
          </div>

          {/* Tab Content */}
          <div className={`min-h-[400px] ${userProfile.activeAction ? 'opacity-50 pointer-events-none' : ''}`}>
            {activeTab === 'stats' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(statLabels).map(([stat, label]) => {
                    const xp = fanz.stats[stat as keyof typeof statLabels] || 1;
                    const level = Math.floor(xp / 100) + 1;
                    const currentXp = xp % 100;
                    const progress = (currentXp / 100) * 100;

                    return (
                      <Card key={stat} className="p-4 flex flex-col items-center justify-center text-center gap-3">
                        <div className="flex items-center gap-3 w-full justify-center">
                          <div className="p-2.5 bg-white/5 rounded-full">
                            {statIcons[stat as keyof typeof statIcons]}
                          </div>
                          <div className="text-left">
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-tight">
                              {label}
                            </div>
                            <div className="text-xl font-black leading-tight">Niv. {level}</div>
                          </div>
                        </div>
                        
                        <div className="w-full space-y-1.5 mt-1">
                          <div className="flex justify-between text-[10px] font-bold text-gray-400">
                            <span>{currentXp > 0 ? `${currentXp} XP` : ''}</span>
                            <span>100 XP</span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full transition-all duration-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>

                <Card className="p-6">
                  <h3 className="text-lg font-black italic uppercase tracking-tighter mb-4">Actions LIFE</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {lifeActions
                      .filter(action => action.fanzTemplateId === template.id || !action.fanzTemplateId)
                      .filter(action => action.id !== userProfile.activeAction?.actionId)
                      .map((action) => (
                      <LifeActionCard 
                        key={action.id} 
                        action={action} 
                        fanz={fanz} 
                        userProfile={userProfile} 
                      />
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {activeTab === 'ferveur' && (
              <div className="space-y-6">
                <Card className="p-6 bg-gradient-to-br from-red-900/20 to-black border-red-500/30">
                  <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-6">
                      <div className="w-24 h-24 rounded-full bg-red-500 flex items-center justify-center text-4xl font-black italic text-white shadow-[0_0_30px_rgba(239,68,68,0.4)]">
                        {fanz.ferveurLevel}
                      </div>
                      <div>
                        <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">Chemin de la Ferveur</h2>
                        <p className="text-gray-400 text-sm">Gagnez des points de ferveur en duel pour progresser.</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-black text-white">{fanz.ferveurPoints || 0} <span className="text-sm text-gray-500 uppercase">Points</span></div>
                      <div className="text-[10px] font-bold text-red-500 uppercase tracking-widest mt-1">{fanz.ferveurLevel > 1 ? `Niveau ${fanz.ferveurLevel}` : ''}</div>
                    </div>
                  </div>
                </Card>

                {/* Recurring Rewards Section */}
                {template.recurringReward && (
                  <Card className="p-6 bg-orange-500/5 border-orange-500/20">
                    <div className="flex items-center justify-between gap-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center text-orange-500">
                          <RefreshCw size={24} />
                        </div>
                        <div>
                          <h3 className="font-black italic uppercase text-sm">Gains Hors Niveau</h3>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                            Tous les {template.recurringReward.points} points : {template.recurringReward.amount} {template.recurringReward.type === 'money' ? 'Argent' : 'Boost'}
                          </p>
                        </div>
                      </div>
                      <div className="flex-1 max-w-[200px] space-y-2">
                        <div className="flex justify-between text-[8px] font-black uppercase text-gray-500">
                          <span>Progression</span>
                          <span>{fanz.ferveurPoints % template.recurringReward.points} / {template.recurringReward.points}</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-orange-500 transition-all duration-500"
                            style={{ width: `${((fanz.ferveurPoints % template.recurringReward.points) / template.recurringReward.points) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-gray-400 uppercase">Total gagné</div>
                        <div className="text-lg font-black text-orange-500">
                          {Math.floor(fanz.ferveurPoints / template.recurringReward.points) * template.recurringReward.amount}
                        </div>
                      </div>
                    </div>
                  </Card>
                )}

                <div className="relative space-y-4">
                  {(template?.ferveurPath || []).length > 0 ? (
                    <div className="space-y-4">
                      {template?.ferveurPath?.map((step, idx) => {
                        const isUnlocked = (fanz.ferveurPoints || 0) >= step.pointsRequired;
                        const isClaimed = fanz.claimedRewards?.includes(`ferveur-level-${step.level}`);
                        
                        return (
                          <div key={idx} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                            isUnlocked ? 'bg-white/5 border-red-500/30' : 'bg-black/20 border-white/5 opacity-50'
                          }`}>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black ${
                              isUnlocked ? 'bg-red-500 text-white' : 'bg-gray-800 text-gray-500'
                            }`}>
                              {step.level}
                            </div>
                            <div className="flex-1">
                              <div className="font-bold text-white uppercase italic">{step.pointsRequired} Points</div>
                              <div className="text-xs text-gray-500">
                                Récompense : {step.reward?.type === 'choice' ? 'Choix (Carte/Skin/Emote)' : `${step.reward?.amount || ''} ${step.reward?.type}`}
                              </div>
                            </div>
                            {isUnlocked && !isClaimed && (
                              <Button 
                                size="sm" 
                                className="bg-red-500 hover:bg-red-600"
                                onClick={async () => {
                                  if (claimingReward) return;
                                  const slotId = `ferveur-level-${step.level}`;
                                  
                                  if (step.reward?.type === 'choice' || step.reward?.type === 'card' || step.reward?.type === 'skin' || step.reward?.type === 'emote') {
                                    setRewardModal({
                                      isOpen: true,
                                      title: `Palier Ferveur ${step.level}`,
                                      slotId,
                                      rewardType: step.reward.type as any,
                                      amount: step.reward.amount,
                                      cardId: step.reward.cardId,
                                      skinId: step.reward.skinId,
                                      emoteId: step.reward.emoteId,
                                      step: 'initial'
                                    });
                                    return;
                                  }

                                  setClaimingReward(slotId);
                                  try {
                                    const fanzRef = doc(db, 'fanz', fanz.id);
                                    const userRef = doc(db, 'users', userProfile.uid);
                                    const newClaimed = [...(fanz.claimedRewards || []), slotId];
                                    
                                    const updates: any = { claimedRewards: newClaimed };
                                    const userUpdates: any = {};

                                    if (step.reward?.type === 'money') userUpdates.money = (userProfile.money || 0) + (step.reward.amount || 0);
                                    if (step.reward?.type === 'gems') userUpdates.gems = (userProfile.gems || 0) + (step.reward.amount || 0);
                                    if (step.reward?.type === 'boost') userUpdates.boostPoints = (userProfile.boostPoints || 0) + (step.reward.amount || 0);
                                    if (step.reward?.type === 'xp' && step.reward.statName) {
                                      const newStats = { ...fanz.stats };
                                      newStats[step.reward.statName] = (newStats[step.reward.statName] || 0) + (step.reward.amount || 0);
                                      updates.stats = newStats;
                                    }
                                    
                                    await updateDoc(fanzRef, updates);
                                    if (Object.keys(userUpdates).length > 0) await updateDoc(userRef, userUpdates);
                                    
                                    setFanz({ ...fanz, claimedRewards: newClaimed, stats: updates.stats || fanz.stats });
                                    setAlertModal({
                                      title: "Récompense récupérée !",
                                      message: "Félicitations ! Votre récompense a été ajoutée à votre compte.",
                                      type: 'success'
                                    });
                                  } catch (e) { console.error(e); }
                                  setClaimingReward(null);
                                }}
                              >
                                Récupérer
                              </Button>
                            )}
                            {isClaimed && <CheckCircle className="text-green-500 w-6 h-6" />}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-20 text-gray-500">
                      Aucun chemin de ferveur défini pour ce FANZ.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'rank' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 gap-8">
                  {Array.from({ length: 10 }).map((_, rIdx) => {
                    const rankNum = rIdx + 1;
                    const isRankUnlocked = (fanz.rank || 1) >= rankNum;
                    const nextRankNum = (fanz.rank || 1) + 1;
                    const isNextRank = rankNum === nextRankNum;
                    
                    return (
                      <div key={rankNum} className="space-y-6">
                        <div className={`space-y-4 ${!isRankUnlocked ? 'opacity-40 grayscale' : ''}`}>
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-xl font-black italic text-white">
                              {rankNum}
                            </div>
                            <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">Rang {rankNum}</h3>
                            <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">+{ (rankNum - 1) * 2 }% Ferveur</span>
                            <div className="h-px flex-1 bg-white/10"></div>
                            {!isRankUnlocked && <Lock className="w-4 h-4 text-gray-500" />}
                          </div>
                          
                          <div className="flex justify-center">
                            {(() => {
                              const slotId = `rank-${rankNum}`;
                              const isClaimed = fanz.claimedRewards?.includes(slotId);
                              
                              return (
                                <button
                                  disabled={!isRankUnlocked || isClaimed || !!claimingReward}
                                  onClick={() => {
                                    if (isClaimed || !isRankUnlocked || claimingReward) return;
                                    const customReward = template?.rankRewards?.[slotId];
                                    
                                    setRewardModal({
                                      isOpen: true,
                                      title: `Rang ${rankNum}`,
                                      rankNum,
                                      slotId,
                                      rewardType: customReward?.type || 'choice',
                                      amount: customReward?.amount || 100,
                                      cardId: customReward?.cardId,
                                      step: 'initial'
                                    });
                                  }}
                                  className={`w-full max-w-sm h-32 rounded-2xl border-2 flex flex-col items-center justify-center gap-3 transition-all relative ${
                                    isClaimed 
                                      ? 'bg-green-500/10 border-green-500/50 text-green-500' 
                                      : isRankUnlocked 
                                        ? 'bg-white/5 border-white/10 hover:border-orange-500 hover:bg-orange-500/5 text-gray-400 hover:text-white'
                                        : 'bg-black/20 border-white/5 text-gray-600'
                                  }`}
                                >
                                  {isClaimed ? (
                                    <Trophy className="w-10 h-10" />
                                  ) : (
                                    <div className="flex gap-2">
                                      <Zap className="w-6 h-6" />
                                      <Activity className="w-6 h-6" />
                                    </div>
                                  )}
                                  <div className="text-center">
                                    <div className="text-xs font-black uppercase tracking-widest">
                                      {isClaimed ? 'Récompense Récupérée' : 'Récompense de Rang'}
                                    </div>
                                    {!isClaimed && isRankUnlocked && (
                                      <div className="text-[10px] font-bold text-orange-500 mt-1">Cliquez pour choisir</div>
                                    )}
                                  </div>
                                  {claimingReward === slotId && (
                                    <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center">
                                      <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                  )}
                                </button>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Rank Up Button */}
                        {isNextRank && (
                          <div className="flex flex-col items-center gap-4 py-6 border-y border-white/5 bg-white/5 rounded-2xl">
                            <div className="text-center">
                              <h4 className="text-sm font-black italic uppercase text-gray-400 mb-2">Débloquer le Rang {rankNum}</h4>
                              <div className="flex gap-6 justify-center">
                                <div className="flex items-center gap-2 text-yellow-500 font-bold">
                                  <Coins size={18} />
                                  {(fanz.rank || 1) * 1000}
                                </div>
                                <div className="flex items-center gap-2 text-blue-400 font-bold">
                                  <Zap size={18} />
                                  {(fanz.rank || 1) * 50}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={async () => {
                                const costMoney = (fanz.rank || 1) * 1000;
                                const costBoost = (fanz.rank || 1) * 50;
                                if (userProfile.money < costMoney || userProfile.boostPoints < costBoost) {
                                  setAlertModal({
                                    title: "Ressources insuffisantes",
                                    message: "Vous n'avez pas assez de pièces ou de points de boost pour passer au rang suivant.",
                                    type: 'error'
                                  });
                                  return;
                                }
                                try {
                                  const fanzRef = doc(db, 'fanz', fanz.id);
                                  const userRef = doc(db, 'users', userProfile.uid);
                                  await updateDoc(fanzRef, { rank: (fanz.rank || 1) + 1 });
                                  await updateDoc(userRef, { 
                                    money: userProfile.money - costMoney,
                                    boostPoints: userProfile.boostPoints - costBoost
                                  });
                                  setFanz({ ...fanz, rank: (fanz.rank || 1) + 1 });
                                  setAlertModal({
                                    title: "Rang débloqué !",
                                    message: `Félicitations ! Votre FANZ est maintenant Rang ${(fanz.rank || 1) + 1}.`,
                                    type: 'success'
                                  });
                                } catch (e) { console.error(e); }
                              }}
                              className="px-12 py-4 bg-orange-500 hover:bg-orange-600 text-white font-black italic uppercase tracking-widest rounded-xl transition-all shadow-xl shadow-orange-500/20 active:scale-95"
                            >
                              Passer au Rang {rankNum}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'cards' && (
              <div className="space-y-8">
                {/* Deck Actuel */}
                <Card className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-black italic uppercase tracking-tighter">Votre Deck ({fanz.equippedCards?.length || 0}/8)</h3>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Cliquez pour retirer</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {allCards.filter(c => fanz.equippedCards?.includes(c.id)).map(card => {
                      const userCard = userCards[card.id] || { level: 1, xp: 0 };
                      const xpForNextLevel = userCard.level * 10;
                      const progress = (userCard.xp / xpForNextLevel) * 100;

                      return (
                        <motion.div
                          key={card.id}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => toggleCard(card.id)}
                          className="bg-gradient-to-br from-orange-900/40 to-black border-2 border-orange-500 rounded-xl p-3 cursor-pointer relative group"
                        >
                          <div className="absolute top-2 right-2 bg-orange-500 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full z-10">
                            Équipée
                          </div>
                          <img src={getImageUrl(card.imageUrl || '')} alt={card.name} className="w-full aspect-[3/4] object-cover rounded-lg mb-2" referrerPolicy="no-referrer" />
                          <h4 className="font-black italic uppercase text-xs text-orange-500 mb-1">{card.name}</h4>
                          
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1 text-[8px] font-bold text-gray-400 uppercase">
                                <Zap size={8} /> {card.energyCost}
                              </div>
                              <div className="flex items-center gap-0.5 text-[8px] font-black text-yellow-500 uppercase">
                                <ChevronUp size={8} /> Niv.{userCard.level}
                              </div>
                            </div>
                            
                            <div className="space-y-1">
                              <div className="flex justify-between text-[6px] font-bold text-gray-500 uppercase">
                                <span>{userCard.xp > 0 ? `${userCard.xp} XP` : ''}</span>
                                <span>{xpForNextLevel} XP</span>
                              </div>
                              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-full transition-all duration-500"
                                  style={{ width: `${Math.min(progress, 100)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                    {Array.from({ length: 8 - (fanz.equippedCards?.length || 0) }).map((_, i) => (
                      <div key={`empty-${i}`} className="border-2 border-dashed border-white/10 rounded-xl aspect-[3/4] flex items-center justify-center">
                        <Database className="w-8 h-8 text-white/5" />
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Toutes les Cartes */}
                <Card className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-black italic uppercase tracking-tighter">Collection de Cartes</h3>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Cliquez pour équiper</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {allCards.map(card => {
                      const requirements = card.unlockRequirements || [];
                      const metRequirements = requirements.length > 0 && requirements.every(req => {
                        if (req.type === 'skill' && req.skillName) {
                          const xp = fanz.stats[req.skillName] || 0;
                          const level = Math.floor(xp / 100) + 1;
                          return level >= req.minLevel;
                        }
                        if (req.type === 'ferveur') {
                          return fanz.ferveurLevel >= req.minLevel;
                        }
                        if (req.type === 'rank') {
                          return (fanz.rank || 1) >= req.minLevel;
                        }
                        return true;
                      });

                      const isUnlocked = userProfile.cards?.includes(card.id) || card.id.startsWith('base_') || metRequirements;
                      const isEquipped = fanz.equippedCards?.includes(card.id);
                      
                      return (
                        <motion.div
                          key={card.id}
                          whileHover={isUnlocked && !isEquipped ? { scale: 1.05 } : {}}
                          whileTap={isUnlocked && !isEquipped ? { scale: 0.95 } : {}}
                          onClick={() => isUnlocked && !isEquipped && toggleCard(card.id)}
                          className={`relative rounded-xl p-3 transition-all ${
                            isUnlocked 
                              ? isEquipped 
                                ? 'bg-white/5 border-2 border-white/10 opacity-50 grayscale' 
                                : 'bg-white/5 border-2 border-white/10 hover:border-orange-500/50 cursor-pointer'
                              : 'bg-black/40 border-2 border-white/5 grayscale opacity-30'
                          }`}
                        >
                          {isUnlocked && (
                            <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1">
                              <div className="bg-black/60 backdrop-blur-sm text-yellow-500 text-[8px] font-black px-1.5 py-0.5 rounded-full">
                                Niv.{userCards[card.id]?.level || 1}
                              </div>
                            </div>
                          )}
                          {!isUnlocked && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center z-20 p-2 text-center bg-black/60 rounded-xl">
                              <Lock className="w-6 h-6 text-white/50 mb-1" />
                              <div className="text-[7px] font-bold text-white uppercase leading-tight">
                                {requirements.length > 0 ? (
                                  requirements.map((req, i) => (
                                    <div key={i}>
                                      {req.type === 'skill' && `${statLabels[req.skillName as keyof typeof statLabels]} Niv. ${req.minLevel}`}
                                      {req.type === 'ferveur' && `Ferveur Niv. ${req.minLevel}`}
                                      {req.type === 'rank' && `Rang Fanz ${req.minLevel}`}
                                    </div>
                                  ))
                                ) : (
                                  "Verrouillé"
                                )}
                              </div>
                            </div>
                          )}
                          <img src={getImageUrl(card.imageUrl || '')} alt={card.name} className="w-full aspect-[3/4] object-cover rounded-lg mb-2" referrerPolicy="no-referrer" />
                          <h4 className="font-black italic uppercase text-xs mb-1">{card.name}</h4>
                          <div className="flex items-center gap-1 text-[8px] font-bold text-gray-500 uppercase">
                            <Zap size={8} /> {card.energyCost} Énergie
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            )}

            {activeTab === 'skins' && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {/* Default Skin */}
                <Card 
                  onClick={() => handleEquipSkin(undefined)}
                  className={`p-4 relative overflow-hidden cursor-pointer transition-all hover:scale-105 ${!fanz.equippedSkin ? 'ring-2 ring-orange-500 bg-orange-500/10' : 'bg-gray-800/50'}`}
                >
                  <img src={getImageUrl(template.image)} alt="Original" className="w-full aspect-square object-cover rounded-lg mb-3" referrerPolicy="no-referrer" />
                  <h4 className="font-bold text-sm text-center">Original</h4>
                  {!fanz.equippedSkin && (
                    <div className="absolute top-2 right-2 bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full z-20">
                      Équipé
                    </div>
                  )}
                </Card>

                {template.skins.map((skin) => {
                  const isUnlocked = fanz.unlockedSkins?.includes(skin.id);
                  const isEquipped = fanz.equippedSkin === skin.id;

                  return (
                    <Card 
                      key={skin.id} 
                      onClick={() => isUnlocked ? handleEquipSkin(skin.id) : handleBuySkin(skin)}
                      className={`p-4 relative overflow-hidden cursor-pointer transition-all hover:scale-105 ${isEquipped ? 'ring-2 ring-orange-500 bg-orange-500/10' : 'bg-gray-800/50'}`}
                    >
                      {!isUnlocked && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-4 text-center">
                          <Lock className="w-8 h-8 text-gray-400 mb-2" />
                          <div className="flex items-center gap-1 text-xs font-black text-white uppercase tracking-tighter">
                            {skin.price.type === 'money' ? <Coins size={14} className="text-yellow-500" /> : 
                             skin.price.type === 'gems' ? <Gem size={14} className="text-blue-500" /> : 
                             <Zap size={14} className="text-orange-500" />}
                            {skin.price.amount}
                          </div>
                          <span className="text-[10px] font-bold text-gray-400 uppercase mt-1">Acheter</span>
                        </div>
                      )}
                      <img src={getImageUrl(skin.imageUrl)} alt={skin.name} className="w-full aspect-square object-cover rounded-lg mb-3" referrerPolicy="no-referrer" />
                      <h4 className="font-bold text-sm text-center">{skin.name}</h4>
                      {isEquipped && (
                        <div className="absolute top-2 right-2 bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full z-20">
                          Équipé
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}

            {activeTab === 'emotes' && (
              <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                {template.emotes.map((emote) => {
                  const isUnlocked = fanz.unlockedEmotes?.includes(emote.id);

                  return (
                    <Card key={emote.id} className="p-4 flex flex-col items-center justify-center text-center relative">
                      {!isUnlocked && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-xl">
                          <Lock className="w-6 h-6 text-gray-400 mb-1" />
                        </div>
                      )}
                      <img src={getImageUrl(emote.imageUrl)} alt={emote.name} className="w-12 h-12 object-contain mb-2" referrerPolicy="no-referrer" />
                      <h4 className="font-bold text-[10px] uppercase tracking-wider text-gray-400">{emote.name}</h4>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alert Modal */}
      {alertModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gray-900 border border-white/10 rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl"
          >
            <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${
              alertModal.type === 'success' ? 'bg-green-500/20 text-green-500' : 
              alertModal.type === 'error' ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'
            }`}>
              {alertModal.type === 'success' ? <CheckCircle size={40} /> : 
               alertModal.type === 'error' ? <Activity size={40} /> : <Info size={40} />}
            </div>
            <div>
              <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-2">{alertModal.title}</h3>
              <p className="text-gray-400 font-bold">{alertModal.message}</p>
            </div>
            <Button onClick={() => setAlertModal(null)} className="w-full py-4 text-lg">D'accord</Button>
          </motion.div>
        </div>
      )}

      {/* Reward Modal */}
      {rewardModal && rewardModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-gray-900 border border-white/10 rounded-3xl p-8 max-w-lg w-full space-y-8 shadow-2xl"
          >
            <div className="text-center space-y-2">
              <div className="inline-block px-4 py-1 bg-orange-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full mb-2">
                {rewardModal.title}
              </div>
              <h3 className="text-3xl font-black italic uppercase tracking-tighter">
                {rewardModal.step === 'initial' ? 'Choisissez votre gain' : 
                 rewardModal.step === 'skill-selection' ? 'Amélioration de stat' : 
                 rewardModal.step === 'card-selection' ? 'Sélectionnez une carte' : 
                 rewardModal.step === 'skin-selection' ? 'Sélectionnez un skin' :
                 rewardModal.step === 'emote-selection' ? 'Sélectionnez un emote' : 'Récompense obtenue !'}
              </h3>
            </div>

            {rewardModal.step === 'initial' && (
              <div className="grid grid-cols-1 gap-4">
                {(rewardModal.rewardType === 'choice' || rewardModal.rewardType === 'card') && (
                  <button
                    onClick={() => {
                      const availableCards = allCards.filter(c => 
                        (!c.fanzIds || c.fanzIds.length === 0 || c.fanzIds.includes(fanz.templateId)) &&
                        !(userProfile.cards || []).includes(c.id)
                      );

                      if (availableCards.length === 0) {
                        setAlertModal({
                          title: "Plus de cartes",
                          message: "Vous possédez déjà toutes les cartes disponibles pour ce Fanz !",
                          type: 'info'
                        });
                        return;
                      }

                      setRewardModal({ ...rewardModal, step: 'card-selection' });
                    }}
                    className="group p-6 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-6 hover:border-orange-500 hover:bg-orange-500/5 transition-all text-left"
                  >
                    <div className="w-16 h-16 bg-orange-500/20 rounded-xl flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform">
                      <Database size={32} />
                    </div>
                    <div>
                      <div className="font-black italic uppercase text-lg">Carte Duel</div>
                      <div className="text-xs text-gray-400 font-bold">Choisissez une nouvelle carte pour votre deck</div>
                    </div>
                  </button>
                )}

                {(rewardModal.rewardType === 'choice' || rewardModal.rewardType === 'skin') && (
                  <button
                    onClick={() => {
                      const availableSkins = allSkins.filter(s => 
                        s.fanzId === fanz.templateId &&
                        !(userProfile.skins || []).includes(s.id)
                      );

                      if (availableSkins.length === 0) {
                        setAlertModal({
                          title: "Plus de skins",
                          message: "Vous possédez déjà tous les skins disponibles pour ce Fanz !",
                          type: 'info'
                        });
                        return;
                      }

                      setRewardModal({ ...rewardModal, step: 'skin-selection' });
                    }}
                    className="group p-6 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-6 hover:border-purple-500 hover:bg-purple-500/5 transition-all text-left"
                  >
                    <div className="w-16 h-16 bg-purple-500/20 rounded-xl flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform">
                      <Star size={32} />
                    </div>
                    <div>
                      <div className="font-black italic uppercase text-lg">Nouveau Skin</div>
                      <div className="text-xs text-gray-400 font-bold">Débloquez un nouveau look pour votre Fanz</div>
                    </div>
                  </button>
                )}

                {(rewardModal.rewardType === 'choice' || rewardModal.rewardType === 'emote') && (
                  <button
                    onClick={() => {
                      const availableEmotes = allEmotes.filter(e => 
                        e.fanzId === fanz.templateId &&
                        !(userProfile.emotes || []).includes(e.id)
                      );

                      if (availableEmotes.length === 0) {
                        setAlertModal({
                          title: "Plus d'emotes",
                          message: "Vous possédez déjà tous les emotes disponibles pour ce Fanz !",
                          type: 'info'
                        });
                        return;
                      }

                      setRewardModal({ ...rewardModal, step: 'emote-selection' });
                    }}
                    className="group p-6 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-6 hover:border-yellow-500 hover:bg-yellow-500/5 transition-all text-left"
                  >
                    <div className="w-16 h-16 bg-yellow-500/20 rounded-xl flex items-center justify-center text-yellow-500 group-hover:scale-110 transition-transform">
                      <MessageCircle size={32} />
                    </div>
                    <div>
                      <div className="font-black italic uppercase text-lg">Nouvel Emote</div>
                      <div className="text-xs text-gray-400 font-bold">Exprimez-vous avec un nouvel emote</div>
                    </div>
                  </button>
                )}

                {(rewardModal.rewardType === 'choice' || rewardModal.rewardType === 'xp') && (
                  <button
                    onClick={() => setRewardModal({ ...rewardModal, step: 'skill-selection' })}
                    className="group p-6 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-6 hover:border-blue-500 hover:bg-blue-500/5 transition-all text-left"
                  >
                    <div className="w-16 h-16 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                      <Zap size={32} />
                    </div>
                    <div>
                      <div className="font-black italic uppercase text-lg">+{rewardModal.amount || 100} XP</div>
                      <div className="text-xs text-gray-400 font-bold">Boostez une compétence de votre choix</div>
                    </div>
                  </button>
                )}
              </div>
            )}

            {rewardModal.step === 'card-selection' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-white/10">
                {allCards
                  .filter(c => 
                    (!c.fanzIds || c.fanzIds.length === 0 || c.fanzIds.includes(fanz.templateId)) &&
                    !(userProfile.cards || []).includes(c.id)
                  )
                  .map(card => (
                    <button
                      key={card.id}
                      onClick={async () => {
                        setClaimingReward(rewardModal.slotId);
                        try {
                          const fanzRef = doc(db, 'fanz', fanz.id);
                          const userRef = doc(db, 'users', userProfile.uid);
                          const newClaimed = [...(fanz.claimedRewards || []), rewardModal.slotId];
                          const newCards = [...(userProfile.cards || []), card.id];
                          
                          await updateDoc(fanzRef, { claimedRewards: newClaimed });
                          await updateDoc(userRef, { cards: newCards });
                          
                          setFanz({ ...fanz, claimedRewards: newClaimed });
                          setRewardModal({ ...rewardModal, step: 'success', unlockedCard: card });
                        } catch (e) { console.error(e); }
                        setClaimingReward(null);
                      }}
                      className="group relative aspect-[2/3] bg-gray-800 rounded-lg overflow-hidden border border-white/10 hover:border-orange-500 transition-all"
                    >
                      <img 
                        src={getImageUrl(card.imageUrl)} 
                        alt={card.name} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2">
                        <div className="text-[8px] font-black uppercase text-white truncate">{card.name}</div>
                        <div className="text-[6px] text-orange-500 font-bold uppercase">{card.type}</div>
                      </div>
                    </button>
                  ))}
              </div>
            )}

            {rewardModal.step === 'skin-selection' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-white/10">
                {allSkins
                  .filter(s => 
                    s.fanzId === fanz.templateId &&
                    !(userProfile.skins || []).includes(s.id)
                  )
                  .map(skin => (
                    <button
                      key={skin.id}
                      onClick={async () => {
                        setClaimingReward(rewardModal.slotId);
                        try {
                          const fanzRef = doc(db, 'fanz', fanz.id);
                          const userRef = doc(db, 'users', userProfile.uid);
                          const newClaimed = [...(fanz.claimedRewards || []), rewardModal.slotId];
                          const newSkins = [...(userProfile.skins || []), skin.id];
                          
                          await updateDoc(fanzRef, { claimedRewards: newClaimed });
                          await updateDoc(userRef, { skins: newSkins });
                          
                          setFanz({ ...fanz, claimedRewards: newClaimed });
                          setRewardModal({ ...rewardModal, step: 'success', unlockedSkin: skin });
                        } catch (e) { console.error(e); }
                        setClaimingReward(null);
                      }}
                      className="group relative aspect-square bg-gray-800 rounded-lg overflow-hidden border border-white/10 hover:border-purple-500 transition-all"
                    >
                      <img 
                        src={getImageUrl(skin.imageUrl)} 
                        alt={skin.name} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2">
                        <div className="text-[8px] font-black uppercase text-white truncate">{skin.name}</div>
                      </div>
                    </button>
                  ))}
              </div>
            )}

            {rewardModal.step === 'emote-selection' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-white/10">
                {allEmotes
                  .filter(e => 
                    e.fanzId === fanz.templateId &&
                    !(userProfile.emotes || []).includes(e.id)
                  )
                  .map(emote => (
                    <button
                      key={emote.id}
                      onClick={async () => {
                        setClaimingReward(rewardModal.slotId);
                        try {
                          const fanzRef = doc(db, 'fanz', fanz.id);
                          const userRef = doc(db, 'users', userProfile.uid);
                          const newClaimed = [...(fanz.claimedRewards || []), rewardModal.slotId];
                          const newEmotes = [...(userProfile.emotes || []), emote.id];
                          
                          await updateDoc(fanzRef, { claimedRewards: newClaimed });
                          await updateDoc(userRef, { emotes: newEmotes });
                          
                          setFanz({ ...fanz, claimedRewards: newClaimed });
                          setRewardModal({ ...rewardModal, step: 'success', unlockedEmote: emote });
                        } catch (e) { console.error(e); }
                        setClaimingReward(null);
                      }}
                      className="group relative aspect-square bg-gray-800 rounded-lg overflow-hidden border border-white/10 hover:border-yellow-500 transition-all"
                    >
                      <img 
                        src={getImageUrl(emote.imageUrl)} 
                        alt={emote.name} 
                        className="w-full h-full object-contain p-2 group-hover:scale-110 transition-transform"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2">
                        <div className="text-[8px] font-black uppercase text-white truncate">{emote.name}</div>
                      </div>
                    </button>
                  ))}
              </div>
            )}

            {rewardModal.step === 'skill-selection' && (
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(statLabels).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={async () => {
                      setClaimingReward(rewardModal.slotId);
                      try {
                        const fanzRef = doc(db, 'fanz', fanz.id);
                        const newClaimed = [...(fanz.claimedRewards || []), rewardModal.slotId];
                        const newStats = { ...fanz.stats };
                        const amount = rewardModal.amount || 100;
                        newStats[key as keyof typeof statLabels] = (newStats[key as keyof typeof statLabels] || 0) + amount;
                        
                        await updateDoc(fanzRef, { 
                          claimedRewards: newClaimed,
                          stats: newStats
                        });
                        
                        setFanz({ ...fanz, claimedRewards: newClaimed, stats: newStats });
                        setRewardModal({ ...rewardModal, step: 'success' });
                      } catch (e) { console.error(e); }
                      setClaimingReward(null);
                    }}
                    className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-center gap-3 hover:border-white/30 hover:bg-white/10 transition-all text-left"
                  >
                    {statIcons[key as keyof typeof statIcons]}
                    <span className="font-bold text-sm">{label}</span>
                  </button>
                ))}
              </div>
            )}

            {rewardModal.step === 'success' && (
              <div className="text-center space-y-6 py-4">
                <div className="w-24 h-24 mx-auto bg-green-500/20 text-green-500 rounded-full flex items-center justify-center animate-bounce">
                  <Trophy size={48} />
                </div>
                <div>
                  <h4 className="text-xl font-black italic uppercase mb-2">Récompense validée !</h4>
                  {rewardModal.unlockedCard ? (
                    <p className="text-gray-400 font-bold">Vous avez débloqué la carte <span className="text-white">{rewardModal.unlockedCard.name}</span></p>
                  ) : rewardModal.unlockedSkin ? (
                    <p className="text-gray-400 font-bold">Vous avez débloqué le skin <span className="text-white">{rewardModal.unlockedSkin.name}</span></p>
                  ) : rewardModal.unlockedEmote ? (
                    <p className="text-gray-400 font-bold">Vous avez débloqué l'emote <span className="text-white">{rewardModal.unlockedEmote.name}</span></p>
                  ) : (
                    <p className="text-gray-400 font-bold">Vos statistiques ont été mises à jour avec succès.</p>
                  )}
                </div>
                <Button onClick={() => setRewardModal(null)} className="w-full py-4">Génial !</Button>
              </div>
            )}

            {rewardModal.step !== 'success' && (
              <button 
                onClick={() => setRewardModal(null)}
                className="w-full text-gray-500 font-black italic uppercase text-xs tracking-widest hover:text-white transition-colors"
              >
                Annuler
              </button>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-bold uppercase italic text-xs tracking-wider whitespace-nowrap ${
        active 
          ? 'bg-white/10 text-white' 
          : 'text-gray-500 hover:text-white hover:bg-white/5'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
