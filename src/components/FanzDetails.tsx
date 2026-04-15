import React, { useState, useEffect, useRef } from 'react';
import { getImageUrl } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, updateDoc, setDoc, collection, getDocs, query, where, onSnapshot, arrayUnion } from 'firebase/firestore';
import { logTransaction } from '../services/transactionService';
import { Card, Button } from './Layout';
import { UserProfile, Fanz, ActiveAction, LifeAction, UserCard, Card as DuelCard, FanzTemplate, FanzSkin, FanzEmote, GlobalFervorConfig } from '../types';
import { Trophy, Lock, Unlock, Star, Info, ArrowLeft, Shield, Brain, Heart, Eye, MessageCircle, Users, Flame, Activity, Database, Clock, Trash2, FastForward, ChevronUp, CheckCircle, RefreshCw, Layers, Smile, ChevronLeft, ChevronRight, Check, Gift } from 'lucide-react';
import { motion } from 'motion/react';
import { LOGOS } from '../constants';

import { LifeActionCard } from './LifeActionCard';

import { BASE_CARDS } from '../constants/cards';
import { OptimizedMedia } from './OptimizedMedia';

import { useReward } from '../context/RewardContext';
import { generateFervorPath } from '../utils/fervorPath';

interface FanzDetailsProps {
  fanzId: string;
  userProfile: UserProfile;
  onBack: () => void;
}

export function FanzDetails({ fanzId, userProfile, onBack }: FanzDetailsProps) {
  const [fanz, setFanz] = useState<Fanz | null>(null);
  const [template, setTemplate] = useState<FanzTemplate | null>(null);
  const [lifeActions, setLifeActions] = useState<LifeAction[]>([]);
  const [allCards, setAllCards] = useState<DuelCard[]>([]);
  const [allSkins, setAllSkins] = useState<FanzSkin[]>([]);
  const [allEmotes, setAllEmotes] = useState<FanzEmote[]>([]);
  const [fanzFervorConfig, setFanzFervorConfig] = useState<GlobalFervorConfig | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stats' | 'cards' | 'skins' | 'emotes' | 'rank' | 'ferveur'>('stats');
  const [claimingReward, setClaimingReward] = useState<string | null>(null);
  const [rankingUp, setRankingUp] = useState(false);
  const [rewardModal, setRewardModal] = useState<{
    isOpen: boolean;
    title: string;
    rankNum?: number;
    slotId: string;
    rewardType: 'choice' | 'card' | 'xp' | 'skin' | 'emote' | 'action' | 'fanz' | 'team_slot' | 'money' | 'gems' | 'boost' | 'energy';
    amount?: number;
    cardId?: string;
    skinId?: string;
    emoteId?: string;
    actionId?: string;
    step: 'initial' | 'skill-selection' | 'card-selection' | 'skin-selection' | 'emote-selection' | 'action-selection' | 'success';
    selectedChoice?: 'card' | 'xp' | 'skin' | 'emote' | 'action';
    unlockedCard?: DuelCard;
    unlockedSkin?: FanzSkin;
    unlockedEmote?: FanzEmote;
    unlockedAction?: LifeAction;
  } | null>(null);

  const [alertModal, setAlertModal] = useState<{
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -scrollContainerRef.current.clientWidth : scrollContainerRef.current.clientWidth;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

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

  const { showReward } = useReward();

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

        const configDoc = await getDoc(doc(db, 'global_configs', 'fanz_fervor'));
        if (configDoc.exists()) {
          setFanzFervorConfig(configDoc.data() as GlobalFervorConfig);
        }
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

  const ferveurPath = React.useMemo(() => {
    if (fanzFervorConfig) {
      // Use the max points from the config, or a high default
      const maxPoints = fanzFervorConfig.ranges?.[fanzFervorConfig.ranges.length - 1]?.max || 50000;
      return generateFervorPath(maxPoints, fanzFervorConfig);
    }
    return template?.ferveurPath || [];
  }, [fanzFervorConfig, template]);

  const maxFerveurPoints = ferveurPath.length > 0 ? ferveurPath[ferveurPath.length - 1].pointsRequired : 1000;

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
    force: <img src={LOGOS.energy} alt="Force" className="w-4 h-4 object-contain" />,
    endurance: <Shield className="w-4 h-4 text-green-500" />,
    mental: <Brain className="w-4 h-4 text-purple-500" />,
    bluff: <Eye className="w-4 h-4 text-blue-500" />,
    creativity: <Star className="w-4 h-4 text-pink-500" />,
    social: <Users className="w-4 h-4 text-cyan-500" />,
    intelligence: <Info className="w-4 h-4 text-indigo-500" />,
    charisma: <Flame className="w-4 h-4 text-red-500" />
  };

  const cardTypeStyles = {
    bonus: {
      bg: 'from-green-900/40 to-black',
      border: 'border-green-500',
      text: 'text-green-500',
      label: 'Bonus'
    },
    malus: {
      bg: 'from-red-900/40 to-black',
      border: 'border-red-500',
      text: 'text-red-500',
      label: 'Malus'
    },
    neutral: {
      bg: 'from-blue-900/40 to-black',
      border: 'border-blue-500',
      text: 'text-blue-500',
      label: 'Neutre'
    }
  };

  const effectLabels: Record<string, string> = {
    push_rope: 'Pousse la corde',
    drain_energy: 'Vole de l\'excitation',
    refill_energy: 'Restaure l\'excitation',
    hide_button: 'Cache le bouton',
    shrink_button: 'Rétrécit le bouton',
    move_button: 'Déplace le bouton',
    blur_view: 'Floute la vue',
    hide_score: 'Cache le score',
    discard_enemy_cards: 'Défausse les cartes adverses',
    shuffle_deck: 'Mélange le deck',
    freeze_button: 'Gèle le bouton',
    double_points: 'Points doublés',
    shield: 'Bouclier',
    mirror: 'Miroir',
    energy_regen_boost: 'Boost régén. excitation',
    earthquake: 'Tremblement de terre',
    fake_buttons: 'Faux boutons',
    card_lock: 'Verrouille les cartes',
    swap_hands: 'Échange les mains',
    mimic: 'Imite la dernière carte',
    lucky_draw: 'Tirage chanceux'
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
    
    const missingCurrencies: string[] = [];
    if (skin.price.money && (userProfile.money || 0) < skin.price.money) missingCurrencies.push(`${skin.price.money - (userProfile.money || 0)} Argent`);
    if (skin.price.gems && (userProfile.gems || 0) < skin.price.gems) missingCurrencies.push(`${skin.price.gems - (userProfile.gems || 0)} Gemmes`);
    if (skin.price.boostPoints && (userProfile.boostPoints || 0) < skin.price.boostPoints) missingCurrencies.push(`${skin.price.boostPoints - (userProfile.boostPoints || 0)} Boost`);

    if (missingCurrencies.length > 0) {
      setAlertModal({
        title: 'Fonds insuffisants',
        message: `Il vous manque : ${missingCurrencies.join(', ')} pour acheter ce skin.`,
        type: 'error'
      });
      return;
    }

    try {
      const userRef = doc(db, 'users', userProfile.uid);
      const fanzRef = doc(db, 'fanz', fanz.id);
      
      const updatedSkins = [...(fanz.unlockedSkins || []), skin.id];
      const userUpdates: any = {
        skins: arrayUnion(skin.id)
      };
      if (skin.price.money) userUpdates.money = (userProfile.money || 0) - skin.price.money;
      if (skin.price.gems) userUpdates.gems = (userProfile.gems || 0) - skin.price.gems;
      if (skin.price.boostPoints) userUpdates.boostPoints = (userProfile.boostPoints || 0) - skin.price.boostPoints;
      
      await updateDoc(userRef, userUpdates);
      await updateDoc(fanzRef, {
        unlockedSkins: updatedSkins,
        equippedSkin: skin.id,
        name: skin.name
      });

      if (skin.price.money) await logTransaction(userProfile.uid, 'money', -skin.price.money, `Achat skin: ${skin.name}`);
      if (skin.price.gems) await logTransaction(userProfile.uid, 'gems', -skin.price.gems, `Achat skin: ${skin.name}`);
      if (skin.price.boostPoints) await logTransaction(userProfile.uid, 'boost', -skin.price.boostPoints, `Achat skin: ${skin.name}`);

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

  const handleBuyEmote = async (emote: FanzEmote) => {
    if (!fanz || !userProfile || !emote.price) return;
    
    const missingCurrencies: string[] = [];
    if (emote.price.money && (userProfile.money || 0) < emote.price.money) missingCurrencies.push(`${emote.price.money - (userProfile.money || 0)} Argent`);
    if (emote.price.gems && (userProfile.gems || 0) < emote.price.gems) missingCurrencies.push(`${emote.price.gems - (userProfile.gems || 0)} Gemmes`);
    if (emote.price.boostPoints && (userProfile.boostPoints || 0) < emote.price.boostPoints) missingCurrencies.push(`${emote.price.boostPoints - (userProfile.boostPoints || 0)} Boost`);

    if (missingCurrencies.length > 0) {
      setAlertModal({
        title: 'Fonds insuffisants',
        message: `Il vous manque : ${missingCurrencies.join(', ')} pour acheter cet emote.`,
        type: 'error'
      });
      return;
    }

    try {
      const userRef = doc(db, 'users', userProfile.uid);
      const fanzRef = doc(db, 'fanz', fanz.id);
      
      const updatedEmotes = [...(fanz.unlockedEmotes || []), emote.id];
      const userUpdates: any = {
        emotes: arrayUnion(emote.id)
      };
      if (emote.price.money) userUpdates.money = (userProfile.money || 0) - emote.price.money;
      if (emote.price.gems) userUpdates.gems = (userProfile.gems || 0) - emote.price.gems;
      if (emote.price.boostPoints) userUpdates.boostPoints = (userProfile.boostPoints || 0) - emote.price.boostPoints;
      
      await updateDoc(userRef, userUpdates);
      await updateDoc(fanzRef, {
        unlockedEmotes: updatedEmotes
      });

      if (emote.price.money) await logTransaction(userProfile.uid, 'money', -emote.price.money, `Achat emote: ${emote.name}`);
      if (emote.price.gems) await logTransaction(userProfile.uid, 'gems', -emote.price.gems, `Achat emote: ${emote.name}`);
      if (emote.price.boostPoints) await logTransaction(userProfile.uid, 'boost', -emote.price.boostPoints, `Achat emote: ${emote.name}`);

      setAlertModal({
        title: 'Emote acheté !',
        message: `Vous avez débloqué l'emote ${emote.name}.`,
        type: 'success'
      });
    } catch (error) {
      console.error("Error buying emote:", error);
      handleFirestoreError(error, OperationType.UPDATE, `fanz/${fanz.id}`);
    }
  };

  const handleEquipSkin = async (skinId: string | undefined) => {
    if (!fanz || !template || !userProfile) return;
    
    try {
      const fanzRef = doc(db, 'fanz', fanz.id);
      const skin = template.skins?.find(s => s.id === skinId);
      const newName = skin ? skin.name : template.name;
      
      await updateDoc(fanzRef, {
        equippedSkin: skinId || null,
        name: newName
      });

      if (userProfile.activeFanzId === fanz.id) {
        const skinImageUrl = skin ? skin.imageUrl : (fanz.imageUrl || template.image);
        await updateDoc(doc(db, 'users', userProfile.uid), {
          photoURL: skinImageUrl || null
        });
      }
    } catch (error) {
      console.error("Error equipping skin:", error);
      handleFirestoreError(error, OperationType.UPDATE, `fanz/${fanz.id}`);
    }
  };

  const activeActionId = userProfile.activeAction?.fanzId === fanz.id ? userProfile.activeAction.actionId : null;
  const activeAction = lifeActions.find(a => a.id === activeActionId);

  const equippedSkinData = template?.skins?.find(s => s.id === fanz?.equippedSkin);
  
  let currentImageUrl = template?.image;
  let currentVideoUrl = template?.video;

  if (fanz?.imageUrl) currentImageUrl = fanz.imageUrl;
  if (fanz?.videoUrl) currentVideoUrl = fanz.videoUrl;

  if (equippedSkinData) {
    currentImageUrl = equippedSkinData.imageUrl || currentImageUrl;
    currentVideoUrl = equippedSkinData.videoUrl || null; // Don't fallback to template video if skin has no video
  }

  if (activeAction) {
    currentImageUrl = activeAction.image || currentImageUrl;
    currentVideoUrl = activeAction.videoUrl || null; // Don't fallback to skin video if action has no video
  }

  const finalVideoUrl = getImageUrl(currentVideoUrl);
  if (!finalVideoUrl) {
    currentVideoUrl = null;
  }

  const handleSetActiveFanz = async () => {
    if (!userProfile || !fanz) return;
    try {
      const skinImageUrl = equippedSkinData ? equippedSkinData.imageUrl : (fanz.imageUrl || template?.image);
      await updateDoc(doc(db, 'users', userProfile.uid), {
        activeFanzId: fanz.id,
        photoURL: skinImageUrl || null
      });
      setAlertModal({
        title: 'FANZ Actif',
        message: 'Ce FANZ est maintenant votre FANZ actif !',
        type: 'success'
      });
    } catch (error) {
      console.error("Error setting active FANZ:", error);
      setAlertModal({
        title: 'Erreur',
        message: 'Impossible de définir ce FANZ comme actif.',
        type: 'error'
      });
    }
  };

  return (
    <div className="flex flex-col pb-20">
      {/* Hero Section (4:3 Aspect Ratio) */}
      <div className="w-full aspect-[4/3] relative shrink-0 overflow-hidden group">
        {/* Rarity Badge */}
        <div className="absolute top-4 right-4 z-30 flex flex-col items-end gap-2">
          <div className="px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
            <span className="text-[10px] font-black italic uppercase tracking-widest text-orange-500">
              {template.rarity}
            </span>
          </div>
          {userProfile.activeFanzId !== fanz.id ? (
            <button
              onClick={handleSetActiveFanz}
              className="px-3 py-1 bg-orange-500/20 hover:bg-orange-500/40 backdrop-blur-md rounded-full border border-orange-500/50 transition-colors"
            >
              <span className="text-[10px] font-black italic uppercase tracking-widest text-orange-500">
                Définir Actif
              </span>
            </button>
          ) : (
            <div className="px-3 py-1 bg-green-500/20 backdrop-blur-md rounded-full border border-green-500/50">
              <span className="text-[10px] font-black italic uppercase tracking-widest text-green-500">
                FANZ Actif
              </span>
            </div>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/40 to-transparent z-10 pointer-events-none"></div>
        
        {currentVideoUrl ? (
          <OptimizedMedia
            type="video"
            src={currentVideoUrl}
            poster={currentImageUrl || ''}
            dataSaver={userProfile.dataSaver}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <OptimizedMedia
            type="image"
            src={currentImageUrl || ''}
            alt={equippedSkinData?.name || fanz.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}

        {/* Superimposed Info */}
        <div className="absolute bottom-0 left-0 right-0 p-6 z-20">
          <div className="flex items-center gap-3">
            <h1 
              onClick={() => setActiveTab('stats')}
              className="text-3xl sm:text-4xl font-black italic uppercase tracking-tighter text-white drop-shadow-lg cursor-pointer hover:text-orange-500 transition-colors"
            >
              {equippedSkinData?.name || fanz.name}
            </h1>
            <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center border border-white/20 shadow-lg shrink-0">
              <span className="text-lg font-black italic text-white">{fanz.rank ?? 0}</span>
            </div>
          </div>

          {activeAction && (
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <p className="text-sm font-black italic uppercase tracking-tighter text-orange-500 drop-shadow-md">
                {activeAction.name}
              </p>
            </div>
          )}

          {!activeAction && (
            <p className="text-xs font-medium text-gray-300 mt-1 max-w-[80%] line-clamp-2">
              {template.description}
            </p>
          )}

          {!activeAction && (() => {
            const nextLevelPoints = ferveurPath.find(l => l.level === fanz.ferveurLevel + 1)?.pointsRequired || 1000;
            return (
              <div 
                onClick={() => setActiveTab('ferveur')}
                className="mt-3 w-full max-w-[250px] cursor-pointer group/ferveur"
              >
                <div className="h-5 bg-black/60 rounded-full border border-white/10 relative overflow-hidden group-hover/ferveur:border-orange-500/50 transition-colors">
                  <div 
                    className="h-full bg-orange-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (fanz.ferveurPoints / nextLevelPoints) * 100)}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] font-black text-white drop-shadow-md">
                      {fanz.ferveurPoints} / {nextLevelPoints}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex justify-center mt-[10px] px-5">
        <div className={`flex w-full gap-0.5 p-1 bg-white/5 rounded-xl border border-white/10 ${userProfile.activeAction ? 'opacity-50 pointer-events-none' : ''}`}>
          <TabButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} label="Stats" icon={<Activity className="w-4 h-4" />} />
          <TabButton active={activeTab === 'ferveur'} onClick={() => setActiveTab('ferveur')} label="Ferveur" icon={<Flame className="w-4 h-4" />} />
          <TabButton active={activeTab === 'rank'} onClick={() => setActiveTab('rank')} label="Rang" icon={<Trophy className="w-4 h-4" />} />
          <TabButton active={activeTab === 'cards'} onClick={() => setActiveTab('cards')} label="Deck" icon={<Database className="w-4 h-4" />} />
          <TabButton active={activeTab === 'skins'} onClick={() => setActiveTab('skins')} label="Skins" icon={<Users className="w-4 h-4" />} />
          <TabButton active={activeTab === 'emotes'} onClick={() => setActiveTab('emotes')} label="Emotes" icon={<MessageCircle className="w-4 h-4" />} />
        </div>
      </div>

      <div className="py-6 px-5 space-y-6">
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

        {/* Tab Content */}
        <div className={`min-h-[400px] ${userProfile.activeAction ? 'opacity-50 pointer-events-none' : ''}`}>
            {activeTab === 'stats' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
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
                        
                        <div className="w-full mt-1">
                          <div className="w-full h-4 bg-gray-800 rounded-full overflow-hidden relative border border-white/10">
                            <div 
                              className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full transition-all duration-500"
                              style={{ width: `${progress}%` }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-[10px] font-black text-white drop-shadow-md">
                                {currentXp} / 100 XP
                              </span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>

                <Card className="p-0 overflow-hidden">
                  <h3 className="text-lg font-black italic uppercase tracking-tighter px-6 pt-6 mb-4">Actions LIFE</h3>
                  
                  <div className="relative w-full pb-6">
                    {/* Left Scroll Button */}
                    <button 
                      onClick={() => scroll('left')}
                      className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-black/80 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 text-white hover:bg-white/10 transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>

                    <div 
                      ref={scrollContainerRef}
                      className="w-full overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory"
                    >
                      <div className="flex flex-nowrap w-full">
                        {lifeActions
                          .filter(action => action.fanzTemplateId === template.id || !action.fanzTemplateId)
                          .filter(action => action.id !== userProfile.activeAction?.actionId)
                          .map((action) => (
                          <div key={action.id} className="snap-center shrink-0 w-full">
                            <LifeActionCard 
                              action={action} 
                              fanz={fanz} 
                              userProfile={userProfile} 
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right Scroll Button */}
                    <button 
                      onClick={() => scroll('right')}
                      className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-black/80 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 text-white hover:bg-white/10 transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </Card>
              </div>
            )}

            {activeTab === 'ferveur' && (
              <div className="flex flex-col gap-6 pb-20">
                <div className="text-center mb-2">
                  <h3 className="text-xl font-black italic uppercase tracking-tighter text-white drop-shadow-md flex items-center justify-center gap-2">
                    <Flame className="w-6 h-6 text-orange-500" />
                    Chemin de Ferveur
                  </h3>
                  <p className="text-xs text-gray-400 font-medium mt-1">
                    Joue avec {fanz.name} pour débloquer ces récompenses !
                  </p>
                </div>

                {/* Next Reward Highlight */}
                {(() => {
                  const nextStep = ferveurPath.find(l => (fanz.ferveurPoints || 0) < l.pointsRequired);
                  if (!nextStep) return null;
                  return (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="px-2"
                    >
                      <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-2xl p-4 flex items-center justify-between shadow-[0_0_30px_rgba(249,115,22,0.15)] relative overflow-hidden">
                        <div className="absolute -right-10 -top-10 w-32 h-32 bg-orange-500/20 blur-3xl rounded-full" />
                        
                        <div>
                          <div className="text-xs font-black uppercase tracking-widest text-orange-400 mb-1 flex items-center gap-1">
                            <Star className="w-3 h-3" /> Prochain Objectif
                          </div>
                          <div className="text-xl font-black italic uppercase tracking-tighter text-white">
                            {nextStep.pointsRequired.toLocaleString()} PTS
                          </div>
                          {!nextStep.isIntermediate && (
                            <div className="text-sm text-gray-300 font-medium">
                              Palier {nextStep.level}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-sm font-black italic uppercase text-green-400">
                              +{nextStep.reward?.amount} {nextStep.reward?.type === 'money' ? '$' : nextStep.reward?.type}
                            </div>
                          </div>
                          <div className="w-12 h-12 rounded-full bg-black/50 border border-white/10 flex items-center justify-center shadow-inner">
                            {nextStep.reward?.type === 'money' ? (
                              <img src={LOGOS.money} alt="Money" className="w-8 h-8 object-contain" />
                            ) : nextStep.reward?.type === 'gems' ? (
                              <img src={LOGOS.gems} alt="Gems" className="w-8 h-8 object-contain" />
                            ) : (
                              <Gift className="w-6 h-6 text-orange-400" />
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })()}

                {/* Progress Bar */}
                <div className="px-2">
                  <div className="relative h-12 bg-black/60 rounded-2xl border border-white/10 overflow-hidden shadow-2xl backdrop-blur-sm">
                    {/* Progress Fill */}
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, ((fanz.ferveurPoints || 0) / maxFerveurPoints) * 100)}%` }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-orange-600 via-orange-500 to-yellow-500"
                    >
                      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay" />
                    </motion.div>
                    {/* Text Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-black italic uppercase tracking-widest text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                        {(fanz.ferveurPoints || 0).toLocaleString()} / {maxFerveurPoints.toLocaleString()} PTS
                      </span>
                    </div>
                  </div>
                </div>

                {/* Vertical Path */}
                <div className="relative mt-8 px-4">
                  {/* Central Line */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-orange-600 via-orange-500/30 to-transparent -translate-x-1/2 rounded-full" />

                  <div className="space-y-24 relative">
                    {ferveurPath.length > 0 ? (
                      ferveurPath.map((step, idx) => {
                        const isUnlocked = (fanz.ferveurPoints || 0) >= step.pointsRequired;
                        const slotId = step.isIntermediate ? `ferveur-inter-${step.id || step.pointsRequired}` : `ferveur-level-${step.level}`;
                        const isClaimed = fanz.claimedRewards?.includes(slotId);
                        const isLeft = idx % 2 === 0;
                        const nextStep = ferveurPath.find(l => (fanz.ferveurPoints || 0) < l.pointsRequired);
                        const isCurrentTarget = nextStep?.pointsRequired === step.pointsRequired;

                        return (
                          <motion.div 
                            initial={{ opacity: 0, y: 50 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-50px" }}
                            transition={{ duration: 0.5, delay: idx * 0.05 }}
                            key={idx} 
                            className="relative flex items-center justify-center"
                          >
                            {/* Milestone Node */}
                            <div className={`relative z-10 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 ${
                              step.isIntermediate ? 'w-12 h-12 rotate-45' : 'w-20 h-20'
                            } ${
                              isClaimed 
                                ? 'bg-green-900/40 border-green-500 text-green-400 shadow-[0_0_20px_rgba(34,197,94,0.2)]' 
                                : isUnlocked 
                                  ? 'bg-orange-600 border-orange-300 text-white shadow-[0_0_30px_rgba(249,115,22,0.6)]' 
                                  : isCurrentTarget
                                    ? 'bg-gray-900 border-orange-500/50 text-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.2)] animate-pulse'
                                    : 'bg-[#111] border-white/10 text-gray-600'
                            }`}>
                              <div className={step.isIntermediate ? '-rotate-45' : ''}>
                                {isClaimed ? (
                                  <Check className={step.isIntermediate ? "w-6 h-6" : "w-10 h-10"} />
                                ) : step.reward?.type === 'money' ? (
                                  <img src={LOGOS.money} alt="Money" className={`${step.isIntermediate ? "w-6 h-6" : "w-12 h-12"} object-contain drop-shadow-lg`} />
                                ) : step.reward?.type === 'gems' ? (
                                  <img src={LOGOS.gems} alt="Gems" className={`${step.isIntermediate ? "w-6 h-6" : "w-12 h-12"} object-contain drop-shadow-lg`} />
                                ) : (
                                  <Trophy className={step.isIntermediate ? "w-6 h-6" : "w-10 h-10"} />
                                )}
                              </div>

                              {/* Points Label */}
                              <div className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap ${isLeft ? (step.isIntermediate ? 'left-16 text-left' : 'left-24 text-left') : (step.isIntermediate ? 'right-16 text-right' : 'right-24 text-right')}`}>
                                <div className={`text-lg font-black italic uppercase tracking-tighter drop-shadow-md ${isUnlocked ? 'text-orange-400' : 'text-gray-500'}`}>
                                  {step.pointsRequired.toLocaleString()} PTS
                                </div>
                                {!step.isIntermediate && (
                                  <div className="text-xs font-black uppercase tracking-widest text-gray-400 bg-black/50 px-2 py-0.5 rounded-full inline-block mt-1 border border-white/5">
                                    Palier {step.level || idx + 1}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Reward Box */}
                            <div className={`absolute top-1/2 -translate-y-1/2 ${step.isIntermediate ? 'w-[140px]' : 'w-[180px]'} ${isLeft ? (step.isIntermediate ? 'right-[calc(50%+45px)]' : 'right-[calc(50%+55px)]') : (step.isIntermediate ? 'left-[calc(50%+45px)]' : 'left-[calc(50%+55px)]')}`}>
                              <div className={`p-4 rounded-2xl border backdrop-blur-sm transition-all duration-500 ${
                                isClaimed 
                                  ? 'bg-black/40 border-green-500/20 opacity-60' 
                                  : isUnlocked 
                                    ? 'bg-gradient-to-br from-orange-900/40 to-black border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.15)]' 
                                    : isCurrentTarget
                                      ? 'bg-gray-900/80 border-orange-500/30'
                                      : 'bg-black/40 border-white/5 opacity-50'
                              }`}>
                                <div className="text-center">
                                  <div className={`text-lg font-black italic uppercase tracking-tighter mb-3 drop-shadow-md ${isUnlocked && !isClaimed ? 'text-green-400' : 'text-gray-400'}`}>
                                    +{step.reward?.amount} {step.reward?.type === 'money' ? '$' : step.reward?.type}
                                  </div>
                                  {isUnlocked && !isClaimed ? (
                                    <Button 
                                      size="sm" 
                                      className="w-full h-7 text-[10px] bg-orange-500 hover:bg-orange-600 font-black italic uppercase tracking-tighter"
                                      onClick={async () => {
                                        if (claimingReward) return;
                                        
                                        if (step.reward?.type === 'choice' || 
                                            (step.reward?.type === 'card' && !step.reward.cardId) || 
                                            (step.reward?.type === 'skin' && !step.reward.skinId) || 
                                            (step.reward?.type === 'emote' && !step.reward.emoteId) ||
                                            (step.reward?.type === 'action' && !step.reward.actionId)) {
                                          setRewardModal({
                                            isOpen: true,
                                            title: step.isIntermediate ? `Gain Intermédiaire` : `Palier Ferveur ${step.level}`,
                                            slotId,
                                            rewardType: step.reward.type as any,
                                            amount: step.reward.amount,
                                            cardId: step.reward.cardId,
                                            skinId: step.reward.skinId,
                                            emoteId: step.reward.emoteId,
                                            actionId: step.reward.actionId,
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
                                          if (step.reward?.type === 'team_slot') userUpdates.teamSlots = (userProfile.teamSlots || 2) + 1;
                                          
                                          if (step.reward?.type === 'fanz' && step.reward.fanzId) {
                                            const newFanzRef = doc(db, 'fanz', `${userProfile.uid}_${step.reward.fanzId}`);
                                            const newFanzDoc = await getDoc(newFanzRef);
                                            if (!newFanzDoc.exists()) {
                                              const templateDoc = await getDoc(doc(db, 'fanz_templates', step.reward.fanzId));
                                              if (templateDoc.exists()) {
                                                const templateData = templateDoc.data();
                                                await setDoc(newFanzRef, {
                                                  id: `${userProfile.uid}_${step.reward.fanzId}`,
                                                  templateId: step.reward.fanzId,
                                                  ownerUid: userProfile.uid,
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
                                          
                                          if (step.reward?.type === 'xp' && step.reward.statName) {
                                            const newStats = { ...fanz.stats };
                                            newStats[step.reward.statName] = (newStats[step.reward.statName] || 0) + (step.reward.amount || 0);
                                            updates.stats = newStats;
                                          }
                                          if (step.reward?.type === 'card' && step.reward.cardId) {
                                            const card = allCards.find(c => c.id === step.reward!.cardId);
                                            if (card && !(userProfile.cards || []).includes(card.id)) {
                                              userUpdates.cards = [...(userProfile.cards || []), card.id];
                                            }
                                          }
                                          if (step.reward?.type === 'skin' && step.reward.skinId) {
                                            const skin = template?.skins?.find(s => s.id === step.reward!.skinId);
                                            if (skin && !(fanz.unlockedSkins || []).includes(skin.id)) {
                                              updates.unlockedSkins = [...(fanz.unlockedSkins || []), skin.id];
                                            }
                                          }
                                          if (step.reward?.type === 'emote' && step.reward.emoteId) {
                                            const emote = template?.emotes?.find(e => e.id === step.reward!.emoteId);
                                            if (emote && !(fanz.unlockedEmotes || []).includes(emote.id)) {
                                              updates.unlockedEmotes = [...(fanz.unlockedEmotes || []), emote.id];
                                            }
                                          }
                                          if (step.reward?.type === 'action' && step.reward.actionId) {
                                            if (!(fanz.unlockedActions || []).includes(step.reward.actionId)) {
                                              updates.unlockedActions = [...(fanz.unlockedActions || []), step.reward.actionId];
                                            }
                                          }
                                          
                                          await updateDoc(fanzRef, updates);
                                          if (Object.keys(userUpdates).length > 0) await updateDoc(userRef, userUpdates);

                                          if (step.reward?.type === 'money' && step.reward.amount) await logTransaction(userProfile.uid, 'money', step.reward.amount, `Récompense palier ${step.level}`);
                                          if (step.reward?.type === 'gems' && step.reward.amount) await logTransaction(userProfile.uid, 'gems', step.reward.amount, `Récompense palier ${step.level}`);
                                          if (step.reward?.type === 'boost' && step.reward.amount) await logTransaction(userProfile.uid, 'boost', step.reward.amount, `Récompense palier ${step.level}`);
                                          
                                          setFanz({ 
                                            ...fanz, 
                                            claimedRewards: newClaimed, 
                                            stats: updates.stats || fanz.stats, 
                                            unlockedSkins: updates.unlockedSkins || fanz.unlockedSkins, 
                                            unlockedEmotes: updates.unlockedEmotes || fanz.unlockedEmotes,
                                            unlockedActions: updates.unlockedActions || fanz.unlockedActions
                                          });

                                          if (step.reward) {
                                            const reward = step.reward;
                                            let rewardData: any = {
                                              type: reward.type,
                                              amount: reward.amount || 1
                                            };

                                            if (reward.type === 'card' && reward.cardId) {
                                              const card = allCards.find(c => c.id === reward.cardId);
                                              if (card) rewardData.card = card;
                                            } else if (reward.type === 'skin' && reward.skinId) {
                                              const skin = template?.skins?.find(s => s.id === reward.skinId);
                                              if (skin) rewardData.skin = skin;
                                            } else if (reward.type === 'emote' && reward.emoteId) {
                                              const emote = template?.emotes?.find(e => e.id === reward.emoteId);
                                              if (emote) rewardData.emote = emote;
                                            } else if (reward.type === 'action' && reward.actionId) {
                                              const action = lifeActions.find(a => a.id === reward.actionId);
                                              if (action) rewardData.action = action;
                                            } else if (reward.type === 'xp' && reward.statName) {
                                              rewardData.title = `+${reward.amount} ${statLabels[reward.statName as keyof typeof statLabels]}`;
                                            }

                                            showReward(rewardData);
                                          }
                                        } catch (e) { console.error(e); }
                                        setClaimingReward(null);
                                      }}
                                    >
                                      Réclamer
                                    </Button>
                                  ) : (
                                    <div className="text-[10px] font-black uppercase tracking-tighter text-gray-500">
                                      {isClaimed ? 'OK' : 'Bloqué'}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })
                    ) : (
                      <div className="text-center py-20 bg-black/20 rounded-2xl border border-white/5">
                        <Trophy className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                        <p className="text-gray-500 font-bold uppercase italic">Aucun chemin de ferveur défini</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'rank' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 gap-8">
                  {Array.from({ length: 10 }).map((_, rIdx) => {
                    const rankNum = rIdx + 1;
                    const isRankUnlocked = (fanz.rank ?? 0) >= rankNum;
                    const nextRankNum = (fanz.rank ?? 0) + 1;
                    const isNextRank = rankNum === nextRankNum;
                    const slotId = `rank-${rankNum}`;
                    const customReward = template?.rankRewards?.[slotId];
                    const rankCost = template?.rankCosts?.[slotId] || { money: rankNum * 1000, boostPoints: rankNum * 50 };
                    const costMoney = rankCost.money || 0;
                    const costBoost = rankCost.boostPoints || 0;
                    
                    return (
                      <div key={rankNum} className="space-y-6">
                        <div className={`flex items-center gap-2 ${!isRankUnlocked ? 'opacity-40 grayscale' : ''}`}>
                          <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-base font-black italic text-white">
                            {rankNum}
                          </div>
                          <h3 className="text-base font-black italic uppercase tracking-tighter text-white">Rang {rankNum}</h3>
                          <span className="text-[8px] font-black uppercase tracking-widest text-orange-500">+{ (rankNum - 1) * 2 }% Ferv.</span>
                          <div className="h-px flex-1 bg-white/10"></div>
                          {!isRankUnlocked && <Lock className="w-2.5 h-2.5 text-gray-500" />}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className={`flex justify-center ${!isRankUnlocked ? 'opacity-40 grayscale' : ''}`}>
                            {(() => {
                              const isClaimed = fanz.claimedRewards?.includes(slotId);
                              const claimedChoice = fanz.claimedChoices?.[slotId];
                              
                              return (
                                <button
                                  disabled={!isRankUnlocked || !!claimingReward}
                                  onClick={async () => {
                                    if (!isRankUnlocked || claimingReward) return;
                                    
                                    if (isClaimed) {
                                      // Show reward alert for already claimed reward
                                      if (claimedChoice) {
                                        if (claimedChoice.type === 'card' && claimedChoice.cardId) {
                                          const card = allCards.find(c => c.id === claimedChoice.cardId);
                                          if (card) showReward({ type: 'card', card, title: 'Carte Débloquée' });
                                        } else if (claimedChoice.type === 'skin' && claimedChoice.skinId) {
                                          const skin = allSkins.find(s => s.id === claimedChoice.skinId);
                                          if (skin) showReward({ type: 'skin', skin, title: 'Skin Débloqué' });
                                        } else if (claimedChoice.type === 'emote' && claimedChoice.emoteId) {
                                          const emote = allEmotes.find(e => e.id === claimedChoice.emoteId);
                                          if (emote) showReward({ type: 'emote', emote, title: 'Emote Débloqué' });
                                        } else if (claimedChoice.type === 'action' && claimedChoice.actionId) {
                                          const action = lifeActions.find(a => a.id === claimedChoice.actionId);
                                          if (action) showReward({ type: 'action', action, title: 'Action Débloquée' });
                                        } else if (claimedChoice.type === 'skill') {
                                          showReward({ type: 'xp', amount: claimedChoice.amount || 100, title: 'Stat Améliorée' });
                                        }
                                      } else {
                                        // Fallback for older claimed rewards without choice info
                                        showReward({ type: 'xp', amount: 100, title: 'Récompense Récupérée' });
                                      }
                                      return;
                                    }

                                    // If it's a simple reward (not a choice or something needing selection), claim it directly
                                    if (customReward && 
                                        !['choice', 'card', 'skin', 'emote', 'action', 'xp'].includes(customReward.type) &&
                                        (customReward.type !== 'card' || customReward.cardId) &&
                                        (customReward.type !== 'skin' || customReward.skinId) &&
                                        (customReward.type !== 'emote' || customReward.emoteId) &&
                                        (customReward.type !== 'action' || customReward.actionId)) {
                                      
                                      setClaimingReward(slotId);
                                      try {
                                        const fanzRef = doc(db, 'fanz', fanz.id);
                                        const userRef = doc(db, 'users', userProfile.uid);
                                        const newClaimed = [...(fanz.claimedRewards || []), slotId];
                                        
                                        const updates: any = { claimedRewards: newClaimed };
                                        const userUpdates: any = {};

                                        if (customReward.type === 'money') userUpdates.money = (userProfile.money || 0) + (customReward.amount || 0);
                                        if (customReward.type === 'gems') userUpdates.gems = (userProfile.gems || 0) + (customReward.amount || 0);
                                        if (customReward.type === 'boost') userUpdates.boostPoints = (userProfile.boostPoints || 0) + (customReward.amount || 0);
                                        if (customReward.type === 'energy') userUpdates.energy = Math.min(100, (userProfile.energy || 0) + (customReward.amount || 0));
                                        if (customReward.type === 'team_slot') userUpdates.teamSlots = (userProfile.teamSlots || 2) + 1;
                                        
                                        await updateDoc(fanzRef, updates);
                                        if (Object.keys(userUpdates).length > 0) await updateDoc(userRef, userUpdates);

                                        if (customReward.type === 'money' && customReward.amount) await logTransaction(userProfile.uid, 'money', customReward.amount, `Récompense Rang ${rankNum}`);
                                        if (customReward.type === 'gems' && customReward.amount) await logTransaction(userProfile.uid, 'gems', customReward.amount, `Récompense Rang ${rankNum}`);
                                        if (customReward.type === 'boost' && customReward.amount) await logTransaction(userProfile.uid, 'boost', customReward.amount, `Récompense Rang ${rankNum}`);
                                        
                                        setFanz({ ...fanz, claimedRewards: newClaimed });
                                        
                                        showReward({
                                          type: customReward.type as any,
                                          amount: customReward.amount || 1,
                                          title: `Récompense Rang ${rankNum}`
                                        });
                                      } catch (e) {
                                        console.error("Error claiming rank reward:", e);
                                      }
                                      setClaimingReward(null);
                                      return;
                                    }

                                    setRewardModal({
                                      isOpen: true,
                                      title: `Rang ${rankNum}`,
                                      rankNum,
                                      slotId,
                                      rewardType: (customReward?.type || 'choice') as any,
                                      amount: customReward?.amount || 100,
                                      cardId: customReward?.cardId,
                                      skinId: customReward?.skinId,
                                      emoteId: customReward?.emoteId,
                                      actionId: customReward?.actionId,
                                      step: 'initial'
                                    });
                                  }}
                                  className={`w-full h-32 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all relative ${
                                    isClaimed 
                                      ? 'bg-green-500/10 border-green-500/50 text-green-500' 
                                      : isRankUnlocked 
                                        ? 'bg-white/5 border-white/10 hover:border-orange-500 hover:bg-orange-500/5 text-gray-400 hover:text-white'
                                        : 'bg-black/20 border-white/5 text-gray-600'
                                  }`}
                                >
                                  {isClaimed ? (
                                    <div className="flex flex-col items-center gap-1">
                                      {claimedChoice?.type === 'card' && <Layers className="w-8 h-8" />}
                                      {claimedChoice?.type === 'skin' && <Shield className="w-8 h-8" />}
                                      {claimedChoice?.type === 'emote' && <Smile className="w-8 h-8" />}
                                      {claimedChoice?.type === 'action' && <Activity className="w-8 h-8" />}
                                      {claimedChoice?.type === 'skill' && <Star className="w-8 h-8" />}
                                      {!claimedChoice && <Trophy className="w-8 h-8" />}
                                    </div>
                                  ) : (
                                    <div className="flex gap-2 items-center justify-center">
                                      {customReward ? (
                                        customReward.type === 'money' ? <img src={LOGOS.money} alt="Money" className="w-8 h-8 object-contain" /> :
                                        customReward.type === 'gems' ? <img src={LOGOS.gems} alt="Gems" className="w-8 h-8 object-contain" /> :
                                        customReward.type === 'boost' ? <img src={LOGOS.boost} alt="Boost" className="w-8 h-8 object-contain" /> :
                                        customReward.type === 'energy' ? <img src={LOGOS.energy} alt="Energy" className="w-8 h-8 object-contain" /> :
                                        customReward.type === 'xp' ? <img src={LOGOS.level} alt="XP" className="w-8 h-8 object-contain" /> :
                                        customReward.type === 'card' ? <Layers className="w-8 h-8" /> :
                                        customReward.type === 'skin' ? <Shield className="w-8 h-8" /> :
                                        customReward.type === 'emote' ? <Smile className="w-8 h-8" /> :
                                        customReward.type === 'action' ? <Activity className="w-8 h-8" /> :
                                        customReward.type === 'team_slot' ? <div className="font-black">SLOT</div> :
                                        <><img src={LOGOS.energy} alt="Energy" className="w-5 h-5 object-contain" /><Activity className="w-5 h-5" /></>
                                      ) : <><img src={LOGOS.energy} alt="Energy" className="w-5 h-5 object-contain" /><Activity className="w-5 h-5" /></>}
                                    </div>
                                  )}
                                  <div className="text-center px-2">
                                    <div className="text-[9px] font-black uppercase tracking-wider leading-tight">
                                      {isClaimed ? (
                                        <>
                                          {claimedChoice?.type === 'card' && 'Carte Débloquée'}
                                          {claimedChoice?.type === 'skin' && 'Skin Débloqué'}
                                          {claimedChoice?.type === 'emote' && 'Emote Débloqué'}
                                          {claimedChoice?.type === 'action' && 'Action Débloquée'}
                                          {claimedChoice?.type === 'skill' && 'Stat Améliorée'}
                                          {!claimedChoice && 'Récompense Récupérée'}
                                        </>
                                      ) : (
                                        customReward ? (
                                          customReward.type === 'money' ? `${customReward.amount} Argent` :
                                          customReward.type === 'gems' ? `${customReward.amount} Gemmes` :
                                          customReward.type === 'boost' ? `${customReward.amount} Boost` :
                                          customReward.type === 'energy' ? `${customReward.amount} Énergie` :
                                          customReward.type === 'xp' ? `${customReward.amount} XP` :
                                          customReward.type === 'card' ? 'Carte' :
                                          customReward.type === 'skin' ? 'Skin' :
                                          customReward.type === 'emote' ? 'Emote' :
                                          customReward.type === 'action' ? 'Action' :
                                          customReward.type === 'team_slot' ? 'Slot Équipe' :
                                          'Récompense de Rang'
                                        ) : 'Récompense de Rang'
                                      )}
                                    </div>
                                    {!isClaimed && isRankUnlocked && (
                                      <div className="text-[8px] font-bold text-orange-500 mt-0.5">Choisir</div>
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

                          {/* Rank Up Button */}
                          {isNextRank && (
                            <div className="flex flex-col items-center justify-center gap-3 py-4 border border-white/10 bg-white/5 rounded-2xl">
                              <div className="text-center">
                                <h4 className="text-[10px] font-black italic uppercase text-orange-500 mb-1">Débloquer Rang {rankNum}</h4>
                                <div className="flex gap-3 justify-center">
                                  {costMoney > 0 && (
                                    <div className="flex items-center gap-1 text-yellow-500 font-bold text-xs">
                                      <img src={LOGOS.money} alt="Money" className="w-3.5 h-3.5 object-contain" />
                                      {costMoney}
                                    </div>
                                  )}
                                  {costBoost > 0 && (
                                    <div className="flex items-center gap-1 text-blue-400 font-bold text-xs">
                                      <img src={LOGOS.boost} alt="Boost" className="w-3.5 h-3.5 object-contain" />
                                      {costBoost}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={async () => {
                                  if (userProfile.money < costMoney || userProfile.boostPoints < costBoost) {
                                    setAlertModal({
                                      title: "Ressources insuffisantes",
                                      message: "Vous n'avez pas assez de pièces ou de points de boost pour passer au rang suivant.",
                                      type: 'error'
                                    });
                                    return;
                                  }
                                  try {
                                    setRankingUp(true);
                                    const fanzRef = doc(db, 'fanz', fanz.id);
                                    const userRef = doc(db, 'users', userProfile.uid);
                                    await updateDoc(fanzRef, { rank: rankNum });
                                    
                                    const userUpdates: any = {};
                                    if (costMoney > 0) userUpdates.money = userProfile.money - costMoney;
                                    if (costBoost > 0) userUpdates.boostPoints = userProfile.boostPoints - costBoost;
                                    
                                    if (Object.keys(userUpdates).length > 0) {
                                      await updateDoc(userRef, userUpdates);
                                    }

                                    if (costMoney > 0) await logTransaction(userProfile.uid, 'money', -costMoney, `Passage Rang ${rankNum} (${fanz.name})`);
                                    if (costBoost > 0) await logTransaction(userProfile.uid, 'boost', -costBoost, `Passage Rang ${rankNum} (${fanz.name})`);

                                    setFanz({ ...fanz, rank: rankNum });
                                    setAlertModal({
                                      title: "Rang débloqué !",
                                      message: `Félicitations ! Votre FANZ est maintenant Rang ${rankNum}.`,
                                      type: 'success'
                                    });
                                  } catch (e) { console.error(e); } finally { setRankingUp(false); }
                                }}
                                disabled={rankingUp}
                                className="w-full max-w-[140px] py-2 bg-orange-600 hover:bg-orange-500 text-white font-black italic uppercase tracking-widest text-[10px] rounded-lg transition-all shadow-lg shadow-orange-900/20 active:scale-95 disabled:opacity-50"
                              >
                                {rankingUp ? '...' : `Passer Rang ${rankNum}`}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'cards' && (
              <div className="space-y-8">
                {/* Deck Actuel */}
                <Card className="p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-base font-black italic uppercase tracking-tighter">Votre Deck ({fanz.equippedCards?.length || 0}/8)</h3>
                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Retirer</p>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {allCards.filter(c => fanz.equippedCards?.includes(c.id)).map(card => {
                      const typeStyle = cardTypeStyles[card.type] || cardTypeStyles.neutral;

                      return (
                        <motion.div
                          key={card.id}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => toggleCard(card.id)}
                          className={`bg-gradient-to-br ${typeStyle.bg} border-2 ${typeStyle.border} rounded-lg cursor-pointer relative group flex flex-col overflow-hidden`}
                        >
                          <div className="absolute top-1 left-1 bg-black/60 backdrop-blur-sm text-yellow-500 text-[6px] font-black px-1 py-0.5 rounded-full z-10 flex items-center gap-0.5">
                            <img src={LOGOS.level} alt="Level" className="w-2 h-2 object-contain" />
                            Niv.{fanz.cardProgress?.[card.id]?.level || 1}
                          </div>
                          <div className={`absolute top-1 right-1 ${typeStyle.text === 'text-green-500' ? 'bg-green-500' : typeStyle.text === 'text-red-500' ? 'bg-red-500' : 'bg-blue-500'} text-white text-[6px] font-black uppercase px-1 py-0.5 rounded-full z-10`}>
                            {typeStyle.label}
                          </div>
                          <div className="w-full aspect-[4/3] overflow-hidden bg-gray-900 shrink-0">
                            {card.videoUrl ? (
                              <OptimizedMedia
                                type="video"
                                src={card.videoUrl}
                                poster={card.imageUrl || ''}
                                dataSaver={userProfile.dataSaver}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <OptimizedMedia
                                type="image"
                                src={card.imageUrl || ''}
                                alt={card.name}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                    {Array.from({ length: 8 - (fanz.equippedCards?.length || 0) }).map((_, i) => (
                      <div key={`empty-${i}`} className="border-2 border-dashed border-white/10 rounded-lg aspect-[4/3] flex items-center justify-center">
                        <Database className="w-4 h-4 text-white/5" />
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Toutes les Cartes */}
                <Card className="p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-base font-black italic uppercase tracking-tighter">Collection de Cartes</h3>
                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Équiper</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {allCards.filter(card => {
                      const isAllowed = !card.fanzIds || card.fanzIds.length === 0 || card.fanzIds.includes(fanz.templateId);
                      const isBlocked = card.blockedFanzIds && card.blockedFanzIds.includes(fanz.templateId);
                      return isAllowed && !isBlocked;
                    }).map(card => {
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
                          return (fanz.rank ?? 0) >= req.minLevel;
                        }
                        return true;
                      });

                      const isUnlocked = userProfile.cards?.includes(card.id) || card.id.startsWith('base_') || metRequirements;
                      const isEquipped = fanz.equippedCards?.includes(card.id);
                      const typeStyle = cardTypeStyles[card.type] || cardTypeStyles.neutral;
                      
                      return (
                        <motion.div
                          key={card.id}
                          whileHover={isUnlocked && !isEquipped ? { scale: 1.05 } : {}}
                          whileTap={isUnlocked && !isEquipped ? { scale: 0.95 } : {}}
                          onClick={() => isUnlocked && !isEquipped && toggleCard(card.id)}
                          className={`relative rounded-xl transition-all flex flex-col h-full overflow-hidden ${
                            isUnlocked 
                              ? isEquipped 
                                ? 'bg-white/5 border-2 border-white/10 opacity-50 grayscale' 
                                : `bg-gradient-to-br ${typeStyle.bg} border-2 ${typeStyle.border} hover:scale-105 cursor-pointer`
                              : 'bg-black/40 border-2 border-white/5 grayscale opacity-30'
                          }`}
                        >
                          {isUnlocked && (
                            <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1">
                              <div className={`${typeStyle.text === 'text-green-500' ? 'bg-green-500' : typeStyle.text === 'text-red-500' ? 'bg-red-500' : 'bg-blue-500'} text-white text-[6px] font-black px-1.5 py-0.5 rounded-full uppercase`}>
                                {typeStyle.label}
                              </div>
                              <div className="bg-black/60 backdrop-blur-sm text-yellow-500 text-[8px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                <img src={LOGOS.level} alt="Level" className="w-2.5 h-2.5 object-contain" />
                                Niv.{fanz.cardProgress?.[card.id]?.level || 1}
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
                          <div className="w-full aspect-[3/4] overflow-hidden bg-gray-900 shrink-0">
                            {card.videoUrl ? (
                              <OptimizedMedia
                                type="video"
                                src={card.videoUrl}
                                poster={card.imageUrl || ''}
                                dataSaver={userProfile.dataSaver}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <OptimizedMedia
                                type="image"
                                src={card.imageUrl || ''}
                                alt={card.name}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                          <div className="p-2 flex-1 flex flex-col gap-1.5">
                            <h4 className={`font-black italic uppercase text-[10px] truncate ${isUnlocked ? typeStyle.text : 'text-gray-400'}`}>{card.name}</h4>
                            
                            <div className="flex-1 flex flex-col gap-1.5">
                              <div className="flex items-center gap-1 text-[7px] font-bold text-gray-500 uppercase">
                                <span className="text-yellow-500">⚡ {card.energyCost} Excitation</span>
                              </div>

                              {isUnlocked && (
                                <>
                                  <p className="text-[6px] text-gray-300 leading-tight line-clamp-2 italic">{card.description}</p>
                                  <div className="space-y-0.5 mt-auto">
                                    {card.effects.map((effect, idx) => (
                                      <div key={idx} className="text-[5px] font-bold text-gray-400 uppercase flex justify-between">
                                        <span>{effectLabels[effect.type] || effect.type}</span>
                                        <span className={typeStyle.text}>{effect.value ? `+${effect.value}` : ''}{effect.duration ? ` (${effect.duration}s)` : ''}</span>
                                      </div>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            )}

            {activeTab === 'skins' && (
              <div className="grid grid-cols-2 gap-3">
                {/* Default Skin */}
                <Card 
                  onClick={() => handleEquipSkin(undefined)}
                  className={`relative overflow-hidden cursor-pointer transition-all hover:scale-105 p-0 ${!fanz.equippedSkin ? 'ring-2 ring-orange-500 bg-orange-500/10' : 'bg-gray-800/50'}`}
                >
                  <div className="w-full aspect-square overflow-hidden bg-gray-900">
                    {template.video ? (
                      <OptimizedMedia
                        type="video"
                        src={template.video}
                        poster={template.image}
                        dataSaver={userProfile.dataSaver}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <OptimizedMedia
                        type="image"
                        src={template.image}
                        alt="Original"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  {!fanz.equippedSkin && (
                    <div className="absolute top-2 right-2 bg-orange-500 text-white text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full z-20">
                      Équipé
                    </div>
                  )}
                </Card>

                {template.skins.map((skin, idx) => {
                  const isUnlocked = fanz.unlockedSkins?.includes(skin.id);
                  const isEquipped = fanz.equippedSkin === skin.id;
                  const canAfford = !isUnlocked && userProfile && (
                    (!skin.price.money || (userProfile.money || 0) >= skin.price.money) &&
                    (!skin.price.gems || (userProfile.gems || 0) >= skin.price.gems) &&
                    (!skin.price.boostPoints || (userProfile.boostPoints || 0) >= skin.price.boostPoints)
                  );

                  return (
                    <Card 
                      key={`${skin.id}-${idx}`} 
                      onClick={() => isUnlocked ? handleEquipSkin(skin.id) : handleBuySkin(skin)}
                      className={`relative overflow-hidden cursor-pointer transition-all hover:scale-105 p-0 ${isEquipped ? 'ring-2 ring-orange-500 bg-orange-500/10' : 'bg-gray-800/50'}`}
                    >
                      {!isUnlocked && (
                        <>
                          <div className={`absolute top-2 right-2 z-20 backdrop-blur-sm p-1.5 rounded-lg ${canAfford ? 'bg-green-500/80' : 'bg-black/60'}`}>
                            {canAfford ? <Unlock className="w-4 h-4 text-white" /> : <Lock className="w-4 h-4 text-white" />}
                          </div>
                          {canAfford && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                              <div className="bg-green-500/90 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg transform -rotate-12">
                                Tu peux m'acheter !
                              </div>
                            </div>
                          )}
                          <div className={`absolute bottom-2 left-2 z-20 backdrop-blur-sm px-2 py-1 rounded-lg flex flex-col gap-0.5 text-[8px] font-black text-white uppercase tracking-tighter ${canAfford ? 'bg-green-600/80' : 'bg-black/60'}`}>
                            {skin.price.money > 0 && (
                              <div className="flex items-center gap-1">
                                <img src={LOGOS.money} alt="Money" className="w-2.5 h-2.5 object-contain" />
                                {skin.price.money}
                              </div>
                            )}
                            {skin.price.gems > 0 && (
                              <div className="flex items-center gap-1">
                                <img src={LOGOS.gems} alt="Gems" className="w-2.5 h-2.5 object-contain" />
                                {skin.price.gems}
                              </div>
                            )}
                            {skin.price.boostPoints > 0 && (
                              <div className="flex items-center gap-1">
                                <img src={LOGOS.boost} alt="Boost" className="w-2.5 h-2.5 object-contain" />
                                {skin.price.boostPoints}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                      <div className={`w-full aspect-square overflow-hidden bg-gray-900 ${!isUnlocked && !canAfford ? 'grayscale opacity-60' : !isUnlocked && canAfford ? 'opacity-90' : ''}`}>
                        {skin.videoUrl ? (
                          <OptimizedMedia
                            type="video"
                            src={skin.videoUrl}
                            poster={skin.imageUrl}
                            dataSaver={userProfile.dataSaver}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <OptimizedMedia
                            type="image"
                            src={skin.imageUrl}
                            alt={skin.name}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      {isEquipped && (
                        <div className="absolute top-2 right-2 bg-orange-500 text-white text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full z-20">
                          Équipé
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}

            {activeTab === 'emotes' && (
              <div className="grid grid-cols-2 gap-3">
                {template.emotes.map((emote, idx) => {
                  const isUnlocked = fanz.unlockedEmotes?.includes(emote.id);
                  const canAfford = !isUnlocked && emote.price && userProfile && (
                    (!emote.price.money || (userProfile.money || 0) >= emote.price.money) &&
                    (!emote.price.gems || (userProfile.gems || 0) >= emote.price.gems) &&
                    (!emote.price.boostPoints || (userProfile.boostPoints || 0) >= emote.price.boostPoints)
                  );

                  return (
                    <Card 
                      key={`${emote.id}-${idx}`} 
                      onClick={() => !isUnlocked && emote.price && handleBuyEmote(emote)}
                      className={`relative transition-all overflow-hidden p-0 ${!isUnlocked ? 'cursor-pointer hover:scale-105' : ''}`}
                    >
                      {!isUnlocked && (
                        <>
                          <div className={`absolute top-2 right-2 z-20 backdrop-blur-sm p-1 rounded-lg ${canAfford ? 'bg-green-500/80' : 'bg-black/60'}`}>
                            {canAfford ? <Unlock className="w-3 h-3 text-white" /> : <Lock className="w-3 h-3 text-white" />}
                          </div>
                          {canAfford && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                              <div className="bg-green-500/90 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg transform -rotate-12">
                                Tu peux m'acheter !
                              </div>
                            </div>
                          )}
                          {emote.price && (
                            <div className={`absolute bottom-2 left-2 z-20 backdrop-blur-sm px-1.5 py-0.5 rounded-lg flex flex-col gap-0.5 text-[7px] font-black text-white uppercase tracking-tighter ${canAfford ? 'bg-green-600/80' : 'bg-black/60'}`}>
                              {emote.price.money > 0 && (
                                <div className="flex items-center gap-0.5">
                                  <img src={LOGOS.money} alt="Money" className="w-2 h-2 object-contain" />
                                  {emote.price.money}
                                </div>
                              )}
                              {emote.price.gems > 0 && (
                                <div className="flex items-center gap-0.5">
                                  <img src={LOGOS.gems} alt="Gems" className="w-2 h-2 object-contain" />
                                  {emote.price.gems}
                                </div>
                              )}
                              {emote.price.boostPoints > 0 && (
                                <div className="flex items-center gap-0.5">
                                  <img src={LOGOS.boost} alt="Boost" className="w-2 h-2 object-contain" />
                                  {emote.price.boostPoints}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                      <div className={`w-full aspect-square overflow-hidden bg-gray-900 ${!isUnlocked && !canAfford ? 'grayscale opacity-60' : !isUnlocked && canAfford ? 'opacity-90' : ''}`}>
                        {emote.videoUrl ? (
                          <OptimizedMedia
                            type="video"
                            src={emote.videoUrl}
                            poster={emote.imageUrl}
                            dataSaver={userProfile.dataSaver}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <OptimizedMedia
                            type="image"
                            src={emote.imageUrl}
                            alt={emote.name}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      {/* Alert Modal */}
      {alertModal && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
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
        <div className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-gray-900 border border-white/10 rounded-3xl p-6 max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl"
          >
            <div className="text-center space-y-1 mb-4 flex-shrink-0">
              <div className="inline-block px-3 py-0.5 bg-orange-500 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-full mb-1">
                {rewardModal.title}
              </div>
              <h3 className="text-2xl font-black italic uppercase tracking-tighter">
                {rewardModal.step === 'initial' ? 'Choisissez votre gain' : 
                 rewardModal.step === 'skill-selection' ? 'Amélioration de stat' : 
                 rewardModal.step === 'card-selection' ? 'Sélectionnez une carte' : 
                 rewardModal.step === 'skin-selection' ? 'Sélectionnez un skin' :
                 rewardModal.step === 'emote-selection' ? 'Sélectionnez un emote' : 
                 rewardModal.step === 'action-selection' ? 'Sélectionnez une action' : 'Récompense obtenue !'}
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 space-y-4">
              {rewardModal.step === 'initial' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(rewardModal.rewardType === 'choice' || rewardModal.rewardType === 'card') && (
                    allCards.filter(c => {
                      const isAllowed = !c.fanzIds || c.fanzIds.length === 0 || c.fanzIds.includes(fanz.templateId);
                      const isBlocked = c.blockedFanzIds && c.blockedFanzIds.includes(fanz.templateId);
                      
                      const requirements = c.unlockRequirements || [];
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
                          return (fanz.rank ?? 0) >= req.minLevel;
                        }
                        return true;
                      });
                      
                      const isAlreadyUnlocked = (userProfile.cards || []).includes(c.id) || c.id.startsWith('base_') || metRequirements;
                      
                      return isAllowed && !isBlocked && !isAlreadyUnlocked;
                    }).length > 0 && (
                      <button
                        onClick={() => setRewardModal({ ...rewardModal, step: 'card-selection' })}
                        className="group p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center text-center gap-3 hover:border-orange-500 hover:bg-orange-500/5 transition-all"
                      >
                        <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform">
                          <Database size={24} />
                        </div>
                        <div>
                          <div className="font-black italic uppercase text-sm">Carte Duel</div>
                          <div className="text-[10px] text-gray-400 font-bold leading-tight">Nouvelle carte pour votre deck</div>
                        </div>
                      </button>
                    )
                  )}

                  {(rewardModal.rewardType === 'choice' || rewardModal.rewardType === 'skin') && (
                    allSkins.filter(s => 
                      s.fanzId === fanz.templateId &&
                      !(userProfile.skins || []).includes(s.id) &&
                      !(fanz.unlockedSkins || []).includes(s.id)
                    ).length > 0 && (
                      <button
                        onClick={() => setRewardModal({ ...rewardModal, step: 'skin-selection' })}
                        className="group p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center text-center gap-3 hover:border-purple-500 hover:bg-purple-500/5 transition-all"
                      >
                        <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform">
                          <Star size={24} />
                        </div>
                        <div>
                          <div className="font-black italic uppercase text-sm">Nouveau Skin</div>
                          <div className="text-[10px] text-gray-400 font-bold leading-tight">Look exclusif pour votre Fanz</div>
                        </div>
                      </button>
                    )
                  )}

                  {(rewardModal.rewardType === 'choice' || rewardModal.rewardType === 'emote') && (
                    allEmotes.filter(e => 
                      e.fanzId === fanz.templateId &&
                      !(userProfile.emotes || []).includes(e.id) &&
                      !(fanz.unlockedEmotes || []).includes(e.id)
                    ).length > 0 && (
                      <button
                        onClick={() => setRewardModal({ ...rewardModal, step: 'emote-selection' })}
                        className="group p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center text-center gap-3 hover:border-yellow-500 hover:bg-yellow-500/5 transition-all"
                      >
                        <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center text-yellow-500 group-hover:scale-110 transition-transform">
                          <MessageCircle size={24} />
                        </div>
                        <div>
                          <div className="font-black italic uppercase text-sm">Nouvel Emote</div>
                          <div className="text-[10px] text-gray-400 font-bold leading-tight">Exprimez-vous en duel</div>
                        </div>
                      </button>
                    )
                  )}

                  {(rewardModal.rewardType === 'choice' || rewardModal.rewardType === 'action') && (
                    lifeActions.filter(a => 
                      (!a.fanzTemplateId || a.fanzTemplateId === fanz.templateId) &&
                      !(fanz.unlockedActions || []).includes(a.id) &&
                      !(userProfile.unlockedActions || []).includes(a.id)
                    ).length > 0 && (
                      <button
                        onClick={() => setRewardModal({ ...rewardModal, step: 'action-selection' })}
                        className="group p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center text-center gap-3 hover:border-cyan-500 hover:bg-cyan-500/5 transition-all"
                      >
                        <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center text-cyan-500 group-hover:scale-110 transition-transform">
                          <Activity size={24} />
                        </div>
                        <div>
                          <div className="font-black italic uppercase text-sm">Action LIFE</div>
                          <div className="text-[10px] text-gray-400 font-bold leading-tight">Nouvelle activité quotidienne</div>
                        </div>
                      </button>
                    )
                  )}

                  {(rewardModal.rewardType === 'choice' || rewardModal.rewardType === 'xp') && (
                    <button
                      onClick={() => setRewardModal({ ...rewardModal, step: 'skill-selection' })}
                      className="group p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center text-center gap-3 hover:border-blue-500 hover:bg-blue-500/5 transition-all"
                    >
                      <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                        <img src={LOGOS.level} alt="XP" className="w-6 h-6 object-contain" />
                      </div>
                      <div>
                        <div className="font-black italic uppercase text-sm">+{rewardModal.amount || 100} XP</div>
                        <div className="text-[10px] text-gray-400 font-bold leading-tight">Boostez vos compétences</div>
                      </div>
                    </button>
                  )}

                  {/* Fallback for simple rewards if they somehow end up in the modal */}
                  {!['choice', 'card', 'skin', 'emote', 'action', 'xp'].includes(rewardModal.rewardType) && (
                    <button
                      onClick={async () => {
                        setClaimingReward(rewardModal.slotId);
                        try {
                          const fanzRef = doc(db, 'fanz', fanz.id);
                          const userRef = doc(db, 'users', userProfile.uid);
                          const newClaimed = [...(fanz.claimedRewards || []), rewardModal.slotId];
                          
                          const updates: any = { claimedRewards: newClaimed };
                          const userUpdates: any = {};

                          if (rewardModal.rewardType === 'money') userUpdates.money = (userProfile.money || 0) + (rewardModal.amount || 0);
                          if (rewardModal.rewardType === 'gems') userUpdates.gems = (userProfile.gems || 0) + (rewardModal.amount || 0);
                          if (rewardModal.rewardType === 'boost') userUpdates.boostPoints = (userProfile.boostPoints || 0) + (rewardModal.amount || 0);
                          if (rewardModal.rewardType === 'energy') userUpdates.energy = Math.min(100, (userProfile.energy || 0) + (rewardModal.amount || 0));
                          if (rewardModal.rewardType === 'team_slot') userUpdates.teamSlots = (userProfile.teamSlots || 2) + 1;
                          
                          await updateDoc(fanzRef, updates);
                          if (Object.keys(userUpdates).length > 0) await updateDoc(userRef, userUpdates);

                          if (rewardModal.rewardType === 'money' && rewardModal.amount) await logTransaction(userProfile.uid, 'money', rewardModal.amount, `Récompense ${rewardModal.title}`);
                          if (rewardModal.rewardType === 'gems' && rewardModal.amount) await logTransaction(userProfile.uid, 'gems', rewardModal.amount, `Récompense ${rewardModal.title}`);
                          if (rewardModal.rewardType === 'boost' && rewardModal.amount) await logTransaction(userProfile.uid, 'boost', rewardModal.amount, `Récompense ${rewardModal.title}`);
                          
                          setFanz({ ...fanz, claimedRewards: newClaimed });
                          
                          showReward({
                            type: rewardModal.rewardType as any,
                            amount: rewardModal.amount || 1,
                            title: rewardModal.title
                          });
                          setRewardModal({ ...rewardModal, step: 'success' });
                        } catch (e) { console.error(e); }
                        setClaimingReward(null);
                      }}
                      className="group p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center text-center gap-3 hover:border-green-500 hover:bg-green-500/5 transition-all"
                    >
                      <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center text-green-500 group-hover:scale-110 transition-transform">
                        <Trophy size={24} />
                      </div>
                      <div>
                        <div className="font-black italic uppercase text-sm">Récupérer</div>
                        <div className="text-[10px] text-gray-400 font-bold leading-tight">
                          {rewardModal.amount} {rewardModal.rewardType === 'money' ? '$' : rewardModal.rewardType}
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              )}

            {rewardModal.step === 'card-selection' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-2">
                {allCards
                  .filter(c => {
                    const isAllowed = !c.fanzIds || c.fanzIds.length === 0 || c.fanzIds.includes(fanz.templateId);
                    const isBlocked = c.blockedFanzIds && c.blockedFanzIds.includes(fanz.templateId);
                    
                    const requirements = c.unlockRequirements || [];
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
                        return (fanz.rank ?? 0) >= req.minLevel;
                      }
                      return true;
                    });
                    
                    const isAlreadyUnlocked = (userProfile.cards || []).includes(c.id) || c.id.startsWith('base_') || metRequirements;
                    
                    return isAllowed && !isBlocked && !isAlreadyUnlocked;
                  })
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
                          const newChoices = { ...(fanz.claimedChoices || {}), [rewardModal.slotId]: { type: 'card', id: card.id } };
                          
                          await updateDoc(fanzRef, { 
                            claimedRewards: newClaimed,
                            claimedChoices: newChoices
                          });
                          await updateDoc(userRef, { cards: newCards });
                          
                          setFanz({ ...fanz, claimedRewards: newClaimed, claimedChoices: newChoices });
                          
                          showReward({
                            type: 'card',
                            amount: 1,
                            card: card
                          });
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-2">
                {allSkins
                  .filter(s => 
                    s.fanzId === fanz.templateId &&
                    !(userProfile.skins || []).includes(s.id) &&
                    !(fanz.unlockedSkins || []).includes(s.id)
                  )
                  .map((skin, idx) => (
                    <button
                      key={`${skin.id}-${idx}`}
                      onClick={async () => {
                        setClaimingReward(rewardModal.slotId);
                        try {
                          const fanzRef = doc(db, 'fanz', fanz.id);
                          const userRef = doc(db, 'users', userProfile.uid);
                          const newClaimed = [...(fanz.claimedRewards || []), rewardModal.slotId];
                          const newSkins = [...(userProfile.skins || []), skin.id];
                          const newFanzSkins = [...(fanz.unlockedSkins || []), skin.id];
                          const newChoices = { ...(fanz.claimedChoices || {}), [rewardModal.slotId]: { type: 'skin', id: skin.id } };
                          
                          await updateDoc(fanzRef, { 
                            claimedRewards: newClaimed,
                            unlockedSkins: newFanzSkins,
                            claimedChoices: newChoices
                          });
                          await updateDoc(userRef, { skins: newSkins });
                          
                          setFanz({ ...fanz, claimedRewards: newClaimed, unlockedSkins: newFanzSkins, claimedChoices: newChoices });
                          
                          showReward({
                            type: 'skin',
                            amount: 1,
                            skin: skin
                          });
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
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2">
                        <div className="text-[8px] font-black uppercase text-white truncate">{skin.name}</div>
                      </div>
                    </button>
                  ))}
              </div>
            )}

            {rewardModal.step === 'emote-selection' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-2">
                {allEmotes
                  .filter(e => 
                    e.fanzId === fanz.templateId &&
                    !(userProfile.emotes || []).includes(e.id) &&
                    !(fanz.unlockedEmotes || []).includes(e.id)
                  )
                  .map((emote, idx) => (
                    <button
                      key={`${emote.id}-${idx}`}
                      onClick={async () => {
                        setClaimingReward(rewardModal.slotId);
                        try {
                          const fanzRef = doc(db, 'fanz', fanz.id);
                          const userRef = doc(db, 'users', userProfile.uid);
                          const newClaimed = [...(fanz.claimedRewards || []), rewardModal.slotId];
                          const newEmotes = [...(userProfile.emotes || []), emote.id];
                          const newFanzEmotes = [...(fanz.unlockedEmotes || []), emote.id];
                          const newChoices = { ...(fanz.claimedChoices || {}), [rewardModal.slotId]: { type: 'emote', id: emote.id } };
                          
                          await updateDoc(fanzRef, { 
                            claimedRewards: newClaimed,
                            unlockedEmotes: newFanzEmotes,
                            claimedChoices: newChoices
                          });
                          await updateDoc(userRef, { emotes: newEmotes });
                          
                          setFanz({ ...fanz, claimedRewards: newClaimed, unlockedEmotes: newFanzEmotes, claimedChoices: newChoices });
                          
                          showReward({
                            type: 'emote',
                            amount: 1,
                            emote: emote
                          });
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
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2">
                        <div className="text-[8px] font-black uppercase text-white truncate">{emote.name}</div>
                      </div>
                    </button>
                  ))}
              </div>
            )}

            {rewardModal.step === 'action-selection' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-2">
                {lifeActions
                  .filter(a => 
                    (!a.fanzTemplateId || a.fanzTemplateId === fanz.templateId) &&
                    !(fanz.unlockedActions || []).includes(a.id) &&
                    !(userProfile.unlockedActions || []).includes(a.id)
                  )
                  .map(action => (
                    <button
                      key={action.id}
                      onClick={async () => {
                        setClaimingReward(rewardModal.slotId);
                        try {
                          const fanzRef = doc(db, 'fanz', fanz.id);
                          const userRef = doc(db, 'users', userProfile.uid);
                          const newClaimed = [...(fanz.claimedRewards || []), rewardModal.slotId];
                          const newActions = [...(fanz.unlockedActions || []), action.id];
                          const newUserActions = [...(userProfile.unlockedActions || []), action.id];
                          const newChoices = { ...(fanz.claimedChoices || {}), [rewardModal.slotId]: { type: 'action', id: action.id } };
                          
                          await updateDoc(fanzRef, { 
                            claimedRewards: newClaimed,
                            unlockedActions: newActions,
                            claimedChoices: newChoices
                          });
                          await updateDoc(userRef, { unlockedActions: newUserActions });
                          
                          setFanz({ ...fanz, claimedRewards: newClaimed, unlockedActions: newActions, claimedChoices: newChoices });
                          
                          showReward({
                            type: 'action',
                            amount: 1,
                            action: action
                          });
                          setRewardModal({ ...rewardModal, step: 'success', unlockedAction: action });
                        } catch (e) { console.error(e); }
                        setClaimingReward(null);
                      }}
                      className="group relative aspect-square bg-gray-800 rounded-lg overflow-hidden border border-white/10 hover:border-cyan-500 transition-all"
                    >
                      {action.image && (
                        <img 
                          src={getImageUrl(action.image)} 
                          alt={action.name} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-2">
                        <div className="text-[10px] font-black uppercase text-white truncate">{action.name}</div>
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
                        const newChoices = { ...(fanz.claimedChoices || {}), [rewardModal.slotId]: { type: 'skill', stat: key, amount } };
                        
                        await updateDoc(fanzRef, { 
                          claimedRewards: newClaimed,
                          stats: newStats,
                          claimedChoices: newChoices
                        });
                        
                        setFanz({ ...fanz, claimedRewards: newClaimed, stats: newStats, claimedChoices: newChoices });
                        
                        showReward({
                          type: 'xp', // Using XP type for stat gains as it's similar
                          amount: amount,
                          title: `+${amount} ${statLabels[key as keyof typeof statLabels]}`
                        });
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
              <div className="text-center space-y-4 py-2">
                <div className="w-20 h-20 mx-auto bg-green-500/20 text-green-500 rounded-full flex items-center justify-center animate-bounce">
                  <Trophy size={40} />
                </div>
                <div>
                  <h4 className="text-lg font-black italic uppercase mb-1">Récompense validée !</h4>
                  {rewardModal.unlockedCard ? (
                    <p className="text-gray-400 font-bold text-sm">Vous avez débloqué la carte <span className="text-white">{rewardModal.unlockedCard.name}</span></p>
                  ) : rewardModal.unlockedSkin ? (
                    <p className="text-gray-400 font-bold text-sm">Vous avez débloqué le skin <span className="text-white">{rewardModal.unlockedSkin.name}</span></p>
                  ) : rewardModal.unlockedEmote ? (
                    <p className="text-gray-400 font-bold text-sm">Vous avez débloqué l'emote <span className="text-white">{rewardModal.unlockedEmote.name}</span></p>
                  ) : rewardModal.unlockedAction ? (
                    <p className="text-gray-400 font-bold text-sm">Vous avez débloqué l'action <span className="text-white">{rewardModal.unlockedAction.name}</span></p>
                  ) : (
                    <p className="text-gray-400 font-bold text-sm">Vos statistiques ont été mises à jour avec succès.</p>
                  )}
                </div>
                <Button onClick={() => setRewardModal(null)} className="w-full py-3">Génial !</Button>
              </div>
            )}
          </div>

          {rewardModal.step !== 'success' && (
            <div className="pt-4 flex-shrink-0">
              <button 
                onClick={() => setRewardModal(null)}
                className="w-full text-gray-500 font-black italic uppercase text-xs tracking-widest hover:text-white transition-colors"
              >
                Annuler
              </button>
            </div>
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
      className={`flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 rounded-lg transition-all font-bold uppercase italic text-[8px] tracking-tighter whitespace-nowrap flex-1 min-w-0 ${
        active 
          ? 'bg-white/10 text-white' 
          : 'text-gray-500 hover:text-white hover:bg-white/5'
      }`}
    >
      <div className="shrink-0">
        {icon}
      </div>
      <span className="truncate w-full text-center">{label}</span>
    </button>
  );
}
