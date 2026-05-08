import React, { useState, useEffect } from 'react';
import { Store, Gem, Zap, Star, User, Shirt, Smile, TrendingUp, Shield, Flame, Sparkles, X } from 'lucide-react';
import { Card, Button } from './Layout';
import { UserProfile, FanzTemplate, Card as DuelCard, GlobalShopConfig } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn, getImageUrl } from '../lib/utils';
import { OptimizedMedia } from './OptimizedMedia';
import { MrFanzHelp } from './MrFanzHelp';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, getDocs, query, where, doc, updateDoc, arrayUnion, setDoc, getDoc } from 'firebase/firestore';

interface ShopPageProps {
  profile: UserProfile;
  onBack: () => void;
}

const CATEGORIES = [
  { id: 'featured', title: 'À la une', icon: <Star className="w-4 h-4" /> },
  { id: 'fanz', title: 'Fanz', icon: <User className="w-4 h-4" /> },
  { id: 'skins', title: 'Skins', icon: <Shirt className="w-4 h-4" /> },
  { id: 'emotes', title: 'Emotes', icon: <Smile className="w-4 h-4" /> },
  { id: 'cards', title: 'Cartes', icon: <Zap className="w-4 h-4" /> },
  { id: 'boosts', title: 'Boosts', icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'gems', title: 'Gemmes', icon: <Gem className="w-4 h-4" /> },
];

// Mock Data for Boosts and Gems
const MOCK_BOOSTS = [
  { id: 'b1', name: 'Boost XP x2', duration: '24h', price: 100, currency: 'gems', icon: <TrendingUp className="w-8 h-8 text-blue-500" />, color: 'blue' },
  { id: 'b2', name: 'Énergie Infinie', duration: '1h', price: 50, currency: 'gems', icon: <Zap className="w-8 h-8 text-yellow-500" />, color: 'yellow' },
  { id: 'b3', name: 'Bouclier Anti-Malus', duration: '3 Matchs', price: 150, currency: 'gems', icon: <Shield className="w-8 h-8 text-green-500" />, color: 'green' },
];

const MOCK_GEMS = [
  { id: 'g1', amount: 80, bonus: 0, price: '1.19€', image: '💎' },
  { id: 'g2', amount: 500, bonus: 50, price: '5.99€', image: '💎💎' },
  { id: 'g3', amount: 1200, bonus: 200, price: '11.99€', image: '💎💎💎', popular: true },
  { id: 'g4', amount: 2500, bonus: 500, price: '23.99€', image: '👑' },
];

const RARITY_COLORS = {
  common: 'from-gray-600 to-gray-800 border-gray-500 text-gray-300 shadow-gray-500/20',
  rare: 'from-blue-600 to-blue-900 border-blue-500 text-blue-300 shadow-blue-500/20',
  epic: 'from-purple-600 to-purple-900 border-purple-500 text-purple-300 shadow-purple-500/20',
  legendary: 'from-yellow-500 to-orange-700 border-yellow-400 text-yellow-200 shadow-yellow-500/30',
};

const RARITY_LABELS = {
  common: 'Commun',
  rare: 'Rare',
  epic: 'Épique',
  legendary: 'Légendaire',
};

export function ShopPage({ profile, onBack }: ShopPageProps) {
  const [activeTab, setActiveTab] = useState('featured');
  const [fanzItems, setFanzItems] = useState<any[]>([]);
  const [skinItems, setSkinItems] = useState<any[]>([]);
  const [emoteItems, setEmoteItems] = useState<any[]>([]);
  const [cardItems, setCardItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [packAnimation, setPackAnimation] = useState<'idle' | 'opening' | 'opened'>('idle');
  const [packRewards, setPackRewards] = useState<any[]>([]);
  const [shopConfig, setShopConfig] = useState<GlobalShopConfig | null>(null);

  useEffect(() => {
    const fetchShopConfig = async () => {
      try {
        const configDoc = await getDoc(doc(db, 'global_configs', 'shop'));
        if (configDoc.exists()) {
          setShopConfig(configDoc.data() as GlobalShopConfig);
        } else {
          // Default config
          setShopConfig({
            id: 'shop',
            ferveurPacks: [
              { id: 'pack_1', name: 'Pack Ferveur Standard', price: 5, numberOfRewards: 1, description: '1 Récompense (Skin, Carte, Énergie...)' },
              { id: 'pack_2', name: 'Pack Ferveur Épique', price: 9, numberOfRewards: 2, description: '2 Récompenses (Skins, Cartes, Énergie...)' },
              { id: 'pack_3', name: 'Pack Ferveur Légendaire', price: 13, numberOfRewards: 3, description: '3 Récompenses (Skins, Cartes, Énergie...)' }
            ]
          });
        }
      } catch (err) {
        console.error("Error fetching shop config", err);
      }
    };
    fetchShopConfig();
  }, []);

  useEffect(() => {
    const fetchShopItems = async () => {
      setLoading(true);
      try {
        // Fetch user's owned Fanz to filter them out
        const userFanzSnap = await getDocs(query(collection(db, 'fanz'), where('ownerUid', '==', profile.uid)));
        const ownedFanzTemplateIds = userFanzSnap.docs.map(d => d.data().templateId);

        // Fetch Fanz Templates
        const fanzSnapshot = await getDocs(collection(db, 'fanz_templates'));
        const fanzData = fanzSnapshot.docs
          .map(doc => doc.data() as FanzTemplate)
          .filter(f => f.isActive !== false);
        
        const fanzForSale = fanzData
          .filter(f => f.price && (f.price.money || f.price.gems))
          .filter(f => !ownedFanzTemplateIds.includes(f.id))
          .map(f => ({
            id: f.id,
            type: 'fanz',
            name: f.name,
            rarity: f.rarity,
            price: f.price?.gems ? f.price.gems : f.price?.money,
            currency: f.price?.gems ? 'gems' : 'money',
            fullPrice: f.price,
            image: getImageUrl(f.image),
            video: f.video,
            template: f
          }));
        
        const skinsForSale: any[] = [];
        const emotesForSale: any[] = [];
        
        fanzData.forEach(fanz => {
          // Only show skins and emotes if the user has unlocked this FANZ
          if (ownedFanzTemplateIds.includes(fanz.id)) {
            if (fanz.skins && Array.isArray(fanz.skins)) {
              fanz.skins.forEach(skin => {
                if (skin.price && (skin.price.money || skin.price.gems) && !(profile.skins || []).includes(skin.id) && (skin.category !== 'event' || skin.isActive !== false)) {
                  skinsForSale.push({
                    id: `${fanz.id}-${skin.id}`,
                    originalId: skin.id,
                    type: 'skin',
                    name: skin.name,
                    category: skin.category,
                    fanz: fanz.name,
                    fanzId: fanz.id,
                    rarity: 'epic', // Default rarity for skins if not specified
                    price: skin.price.gems ? skin.price.gems : skin.price.money,
                    currency: skin.price.gems ? 'gems' : 'money',
                    fullPrice: skin.price,
                    image: skin.imageUrl ? getImageUrl(skin.imageUrl) : '👕',
                    video: skin.videoUrl
                  });
                }
              });
            }
            if (fanz.emotes && Array.isArray(fanz.emotes)) {
              fanz.emotes.forEach(emote => {
                if (emote.price && (emote.price.money || emote.price.gems) && !(profile.emotes || []).includes(emote.id) && (emote.category !== 'event' || emote.isActive !== false)) {
                  emotesForSale.push({
                    id: `${fanz.id}-${emote.id}`,
                    originalId: emote.id,
                    type: 'emote',
                    name: emote.name,
                    category: emote.category,
                    fanz: fanz.name,
                    fanzId: fanz.id,
                    rarity: 'rare', // Default rarity for emotes
                    price: emote.price.gems ? emote.price.gems : emote.price.money,
                    currency: emote.price.gems ? 'gems' : 'money',
                    fullPrice: emote.price,
                    icon: emote.imageUrl ? getImageUrl(emote.imageUrl) : '😀',
                    video: emote.videoUrl
                  });
                }
              });
            }
          }
        });

        // Fetch Duel Cards
        const cardsSnapshot = await getDocs(collection(db, 'cards'));
        const cardsData = cardsSnapshot.docs.map(doc => {
          const card = { id: doc.id, ...doc.data() } as any;
          if (!card.price && ['rare', 'epic', 'legendary'].includes(card.rarity)) {
             card.price = {
               gems: card.rarity === 'rare' ? 30 : card.rarity === 'epic' ? 100 : 300
             };
          }
          return card;
        });
        
        const cardsForSale = cardsData
          .filter(c => c.price && (c.price.money || c.price.gems))
          .filter(c => !(profile.cards || []).includes(c.id))
          .filter(c => {
            // Only show cards if they don't have specific fanzIds, or if the user owns at least one of those FANZ
            if (c.fanzIds && c.fanzIds.length > 0) {
              return c.fanzIds.some(fid => ownedFanzTemplateIds.includes(fid));
            }
            return true;
          })
          .map(c => ({
            id: c.id,
            type: 'card',
            name: c.name,
            rarity: c.rarity,
            price: c.price?.gems ? c.price.gems : c.price?.money,
            currency: c.price?.gems ? 'gems' : 'money',
            fullPrice: c.price,
            image: c.imageUrl ? getImageUrl(c.imageUrl) : '🃏',
            video: c.videoUrl,
            duration: `Coût: ${c.energyCost} Énergie`,
            description: c.description
          }));

        setFanzItems(fanzForSale);
        setSkinItems(skinsForSale);
        setEmoteItems(emotesForSale);
        setCardItems(cardsForSale);
      } catch (err) {
        console.error("Error fetching shop items", err);
        handleFirestoreError(err, OperationType.GET, 'shop_items');
      } finally {
        setLoading(false);
      }
    };

    fetchShopItems();
  }, [profile.uid, profile.skins, profile.emotes, profile.cards]);

  const purchasePackFerveur = async (pack: { price: number; numberOfRewards: number }) => {
    if ((profile.gems || 0) < pack.price) {
      setError("Pas assez de gemmes pour acheter le Pack !");
      return;
    }

    setPurchasing(true);
    setPackAnimation('opening');
    setPackRewards([]);
    setError(null);
    
    try {
      const userRef = doc(db, 'users', profile.uid);
      const updates: any = {};
      
      updates.gems = (profile.gems || 0) - pack.price;

      // 1. Fetch user's Fanzs to see what we can give
      const userFanzSnap = await getDocs(query(collection(db, 'fanz'), where('ownerUid', '==', profile.uid)));
      const userFanzs = userFanzSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      
      // 2. Fetch Templates and Cards to pick skins/emotes/cards
      const fanzTemplatesSnap = await getDocs(collection(db, 'fanz_templates'));
      const fanzTemplates = fanzTemplatesSnap.docs.map(d => ({ id: d.id, ...d.data() as FanzTemplate }));
      
      const cardsSnap = await getDocs(collection(db, 'cards'));
      const allCards = cardsSnap.docs.map(d => ({ id: d.id, ...d.data() as DuelCard }));
      
      // Decide number of rewards from pack
      const numRewards = pack.numberOfRewards;
      
      const generatedRewards: any[] = [];
      const userSkins = [...(profile.skins || [])];
      const userEmotes = [...(profile.emotes || [])];
      const userCards = [...(profile.cards || [])];
      
      const REWARD_TYPES = ['skin', 'emote', 'card', 'money', 'gems', 'boost', 'infinite_energy', 'double_gains', 'xp'];
      
      for (let i = 0; i < numRewards; i++) {
        const shuffledTypes = [...REWARD_TYPES].sort(() => 0.5 - Math.random());
        let rewardAdded = false;
        
        for (const type of shuffledTypes) {
           if (rewardAdded) break;
           
           if (type === 'money') {
              const amount = Math.floor(Math.random() * 900) + 100;
              generatedRewards.push({ type, name: `${amount} $`, icon: '💰', amount });
              updates.money = (updates.money !== undefined ? updates.money : profile.money || 0) + amount;
              rewardAdded = true;
           } else if (type === 'gems') {
              const amount = Math.floor(Math.random() * 40) + 10;
              generatedRewards.push({ type, name: `${amount} Gemmes`, icon: '💎', amount });
              updates.gems = (updates.gems !== undefined ? updates.gems : profile.gems || 0) + amount;
              rewardAdded = true;
           } else if (type === 'boost') {
              const boostPoints = Math.floor(Math.random() * 50) + 10;
              generatedRewards.push({ type, name: `${boostPoints} Boosts`, icon: '🚀', amount: boostPoints });
              updates.boostPoints = (updates.boostPoints !== undefined ? updates.boostPoints : profile.boostPoints || 0) + boostPoints;
              rewardAdded = true;
           } else if (type === 'infinite_energy') {
              generatedRewards.push({ type, name: 'Énergie Infinie (1h)', icon: '⚡' });
              const now = new Date();
              const currentUntil = profile.infiniteEnergyUntil ? new Date(profile.infiniteEnergyUntil) : now;
              const baseDate = currentUntil > now ? currentUntil : now;
              updates.infiniteEnergyUntil = new Date(baseDate.getTime() + 60 * 60 * 1000).toISOString();
              rewardAdded = true;
           } else if (type === 'double_gains') {
              generatedRewards.push({ type, name: 'Gains x2 (1h)', icon: '📈' });
              const now = new Date();
              const currentUntil = profile.doubleGainsUntil ? new Date(profile.doubleGainsUntil) : now;
              const baseDate = currentUntil > now ? currentUntil : now;
              updates.doubleGainsUntil = new Date(baseDate.getTime() + 60 * 60 * 1000).toISOString();
              rewardAdded = true;
           } else if (type === 'skin' || type === 'emote' || type === 'xp' || type === 'card') {
              if (userFanzs.length > 0) {
                 const randomFanz = userFanzs[Math.floor(Math.random() * userFanzs.length)];
                 const template = fanzTemplates.find(t => t.id === randomFanz.templateId);
                 
                 if (type === 'skin' && template?.skins) {
                    const availableSkins = template.skins.filter((s:any) => !userSkins.includes(s.id));
                    if (availableSkins.length > 0) {
                       const skin = availableSkins[Math.floor(Math.random() * availableSkins.length)];
                       generatedRewards.push({ type, name: `Skin: ${skin.name}`, fanz: template.name, icon: '👕', image: skin.imageUrl ? getImageUrl(skin.imageUrl) : undefined });
                       userSkins.push(skin.id);
                       updates.skins = arrayUnion(...userSkins.filter(s => !profile.skins?.includes(s)));
                       rewardAdded = true;
                    }
                 } else if (type === 'emote' && template?.emotes) {
                    const availableEmotes = template.emotes.filter((e:any) => !userEmotes.includes(e.id));
                    if (availableEmotes.length > 0) {
                       const emote = availableEmotes[Math.floor(Math.random() * availableEmotes.length)];
                       generatedRewards.push({ type, name: `Emote: ${emote.name}`, fanz: template.name, icon: '😀', image: emote.imageUrl ? getImageUrl(emote.imageUrl) : undefined });
                       userEmotes.push(emote.id);
                       updates.emotes = arrayUnion(...userEmotes.filter(e => !profile.emotes?.includes(e)));
                       rewardAdded = true;
                    }
                 } else if (type === 'card') {
                    const availableCards = allCards.filter(c => (c.fanzIds && c.fanzIds.includes(template!.id)) && !c.blockedFanzIds?.includes(template!.id) && !userCards.includes(c.id));
                    if (availableCards.length > 0) {
                       const card = availableCards[Math.floor(Math.random() * availableCards.length)];
                       generatedRewards.push({ type, name: `Carte: ${card.name}`, fanz: template!.name, icon: '🃏', image: card.imageUrl ? getImageUrl(card.imageUrl) : undefined });
                       userCards.push(card.id);
                       updates.cards = arrayUnion(...userCards.filter(c => !profile.cards?.includes(c)));
                       rewardAdded = true;
                    }
                 } else if (type === 'xp') {
                    const stats = ['force', 'endurance', 'mental', 'bluff', 'creativity', 'social', 'intelligence', 'charisma'];
                    const randomStat = stats[Math.floor(Math.random() * stats.length)];
                    const xpGain = Math.floor(Math.random() * 50) + 20; // 20-70 XP
                    generatedRewards.push({ type, name: `+${xpGain} XP ${randomStat}`, fanz: template!.name, icon: '⭐' });
                    
                    const fanzRef = doc(db, 'fanz', randomFanz.id);
                    await updateDoc(fanzRef, {
                      [`stats.${randomStat}`]: (randomFanz.stats?.[randomStat] || 0) + xpGain
                    });
                    rewardAdded = true;
                 }
              }
           }
        }
        
        // Fallback
        if (!rewardAdded) {
           const amount = 500;
           generatedRewards.push({ type: 'money', name: `${amount} $`, icon: '💰', amount });
           updates.money = (updates.money !== undefined ? updates.money : profile.money || 0) + amount;
        }
      }

      await updateDoc(userRef, updates);
      
      setPackRewards(generatedRewards);
      
      // Keep "opening" animation for 2 seconds
      setTimeout(() => {
        setPackAnimation('opened');
        setPurchasing(false);
      }, 2000);

    } catch (err) {
      console.error(err);
      setError("Erreur lors de l'ouverture du pack.");
      setPurchasing(false);
      setPackAnimation('idle');
    }
  };

  const handlePurchase = async (currencyToUse: 'money' | 'gems' | 'both') => {
    if (!selectedItem) return;
    
    let costMoney = 0;
    let costGems = 0;

    if (currencyToUse === 'both') {
      costMoney = selectedItem.fullPrice?.money || 0;
      costGems = selectedItem.fullPrice?.gems || 0;
    } else {
      const singleCost = selectedItem.fullPrice?.[currencyToUse] || selectedItem.price;
      if (currencyToUse === 'money') costMoney = singleCost;
      if (currencyToUse === 'gems') costGems = singleCost;
    }

    if (costMoney > 0 && (profile.money || 0) < costMoney) {
      setError(`Vous n'avez pas assez de dollars.`);
      return;
    }
    if (costGems > 0 && (profile.gems || 0) < costGems) {
      setError(`Vous n'avez pas assez de gemmes.`);
      return;
    }

    if (costMoney <= 0 && costGems <= 0) return;

    setPurchasing(true);
    setError(null);

    try {
      const userRef = doc(db, 'users', profile.uid);
      const updates: any = {};
      
      if (costMoney > 0) updates.money = (profile.money || 0) - costMoney;
      if (costGems > 0) updates.gems = (profile.gems || 0) - costGems;

      if (selectedItem.type === 'fanz') {
        const newFanzId = `fanz-${Date.now()}`;
        const newFanz = {
          id: newFanzId,
          templateId: selectedItem.id,
          ownerUid: profile.uid,
          name: selectedItem.template.name,
          sport: selectedItem.template.sport || 'Football',
          imageUrl: selectedItem.template.image,
          videoUrl: selectedItem.template.video,
          stats: selectedItem.template.baseStats || { force: 10, endurance: 10, mental: 10, bluff: 10, creativity: 10, social: 10, intelligence: 10, charisma: 10 },
          xp: 0,
          level: 1,
          rank: 1,
          ferveurPoints: 0,
          ferveurLevel: 1,
          energy: 100,
          equippedCards: [],
          deck: [],
          unlockedSkins: [],
          unlockedEmotes: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'fanz', newFanzId), newFanz);
        setFanzItems(prev => prev.filter(i => i.id !== selectedItem.id));
      } else if (selectedItem.type === 'skin') {
        updates.skins = arrayUnion(selectedItem.originalId);
        setSkinItems(prev => prev.filter(i => i.id !== selectedItem.id));
      } else if (selectedItem.type === 'emote') {
        updates.emotes = arrayUnion(selectedItem.originalId);
        setEmoteItems(prev => prev.filter(i => i.id !== selectedItem.id));
      } else if (selectedItem.type === 'card') {
        updates.cards = arrayUnion(selectedItem.id);
        setCardItems(prev => prev.filter(i => i.id !== selectedItem.id));
      } else if (selectedItem.type === 'boost') {
        const now = new Date();
        if (selectedItem.id === 'b1') { // Boost XP x2 (24h)
          const currentUntil = profile.boostXpUntil ? new Date(profile.boostXpUntil) : now;
          const baseDate = currentUntil > now ? currentUntil : now;
          updates.boostXpUntil = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000).toISOString();
        } else if (selectedItem.id === 'b2') { // Énergie Infinie (1h)
          const currentUntil = profile.infiniteEnergyUntil ? new Date(profile.infiniteEnergyUntil) : now;
          const baseDate = currentUntil > now ? currentUntil : now;
          updates.infiniteEnergyUntil = new Date(baseDate.getTime() + 60 * 60 * 1000).toISOString();
        } else if (selectedItem.id === 'b3') { // Bouclier Anti-Malus (3 Matchs)
          updates.antiMalusMatches = (profile.antiMalusMatches || 0) + 3;
        }
      }

      await updateDoc(userRef, updates);
      setSelectedItem(null);
    } catch (err) {
      console.error("Error purchasing item:", err);
      setError("Une erreur est survenue lors de l'achat.");
    } finally {
      setPurchasing(false);
    }
  };

  const renderPriceButton = (price: number | string, currency: string, item?: any) => {
    // If the item has a full price object, we can render both if they exist
    if (item && item.fullPrice) {
      const hasMoney = item.fullPrice.money > 0;
      const hasGems = item.fullPrice.gems > 0;

      if (hasMoney && hasGems) {
        return (
          <Button 
            onClick={() => setSelectedItem(item)}
            className="w-full font-black uppercase text-[10px] bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white mt-3 px-1"
          >
            <span className="flex items-center justify-center gap-1.5 flex-wrap">
              <span className="flex items-center gap-0.5">{item.fullPrice.money} <span>$</span></span>
              <span>+</span>
              <span className="flex items-center gap-0.5">{item.fullPrice.gems} <Gem className="w-3 h-3" /></span>
            </span>
          </Button>
        );
      }
    }

    // Fallback to the original logic if only one currency is provided or fullPrice is missing
    return (
      <Button 
        onClick={() => setSelectedItem(item)}
        className={cn(
        "w-full font-black uppercase text-xs mt-3",
        currency === 'gems' ? "bg-blue-500 hover:bg-blue-600 text-white" : 
        currency === 'money' ? "bg-green-500 hover:bg-green-600 text-white" : 
        "bg-white text-black hover:bg-gray-200"
      )}>
        <span className="flex items-center justify-center gap-1">
          {price} 
          {currency === 'gems' && <Gem className="w-3 h-3" />}
          {currency === 'money' && <span>$</span>}
        </span>
      </Button>
    );
  };

  const renderItemCard = (item: any, type: 'fanz' | 'skin' | 'emote' | 'boost' | 'card') => {
    const rarityColor = RARITY_COLORS[item.rarity as keyof typeof RARITY_COLORS] || RARITY_COLORS.common;
    const rarityLabel = RARITY_LABELS[item.rarity as keyof typeof RARITY_LABELS] || RARITY_LABELS.common;

    return (
      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} key={item.id}>
        <Card className={cn(
          "relative overflow-hidden border p-4 flex flex-col items-center text-center h-full",
          `bg-gradient-to-b ${rarityColor} shadow-lg`
        )}>
          <div className="w-full aspect-square mb-3 rounded-lg overflow-hidden relative shadow-inner shadow-white/10">
            {item.category === 'event' && (
              <div className="absolute top-2 left-2 backdrop-blur-sm bg-fuchsia-600 border border-fuchsia-400 font-black uppercase text-[8px] tracking-widest px-1.5 py-0.5 rounded-sm text-white z-20 shadow-[0_0_10px_rgba(192,38,211,0.5)]">
                Événement
              </div>
            )}
            
            {type !== 'skin' && type !== 'emote' && (
              <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-[8px] font-black uppercase px-2 py-1 rounded-full text-white/80 z-20 shadow-md">
                {rarityLabel}
              </div>
            )}
            
            <div className="absolute inset-0 bg-black/20 mix-blend-overlay z-0"></div>
            {type === 'fanz' && (
              <OptimizedMedia type={item.video ? 'video' : 'image'} src={item.video || item.image || null} poster={item.image} className="w-full h-full object-cover relative z-10 scale-110" />
            )}
            {type === 'skin' && (item.image?.startsWith('http') || item.image?.startsWith('/') || item.video ? <OptimizedMedia type={item.video ? 'video' : 'image'} src={item.video || item.image || null} poster={item.image} className="w-full h-full object-cover relative z-10 scale-110" /> : <div className="w-full h-full flex items-center justify-center text-6xl relative z-10">{item.image}</div>)}
            {type === 'emote' && (item.icon?.startsWith('http') || item.icon?.startsWith('/') || item.video ? <OptimizedMedia type={item.video ? 'video' : 'image'} src={item.video || item.icon || null} poster={item.icon} className="w-full h-full object-contain p-2 relative z-10" /> : <div className="w-full h-full flex items-center justify-center text-6xl relative z-10">{item.icon}</div>)}
            {type === 'boost' && <div className="w-full h-full flex items-center justify-center relative z-10">{item.icon}</div>}
            {type === 'card' && (item.image?.startsWith('http') || item.image?.startsWith('/') || item.video ? <OptimizedMedia type={item.video ? 'video' : 'image'} src={item.video || item.image || null} poster={item.image} className="w-full h-full object-cover relative z-10 scale-110" /> : <div className="w-full h-full flex items-center justify-center text-6xl relative z-10">{item.image}</div>)}
          </div>

          <div className="w-full flex flex-col flex-1 justify-end">
            <h3 className="text-sm font-black italic uppercase text-white mb-1 leading-tight">{item.name}</h3>
            {item.fanz && <p className="text-[10px] text-white/70 font-bold uppercase">Pour: {item.fanz}</p>}
            {item.duration && <p className="text-[10px] text-white/70 font-bold uppercase">{item.duration}</p>}
            {item.description && <p className="text-[9px] text-white/60 font-medium italic mt-1 line-clamp-2 leading-tight">"{item.description}"</p>}
            {renderPriceButton(item.price, item.currency, item)}
          </div>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="flex items-center justify-between px-4">
        <h1 className="text-lg sm:text-xl font-black italic uppercase tracking-tighter flex items-center">
          Boutique
          <MrFanzHelp contextId="shop" />
        </h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-full">
            <span className="text-green-400 font-black text-xs">{profile.money || 0}</span>
            <span className="text-green-400 font-black text-xs">$</span>
          </div>
          <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-full">
            <span className="text-blue-400 font-black text-xs">{profile.gems || 0}</span>
            <Gem className="w-3 h-3 text-blue-400" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-20">
        {/* Categories */}
        <div className="flex overflow-x-auto gap-2 no-scrollbar pb-2">
          {CATEGORIES.map(cat => (
            <button 
              key={cat.id} 
              onClick={() => setActiveTab(cat.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 border rounded-full whitespace-nowrap transition-all",
                activeTab === cat.id 
                  ? "bg-orange-600 border-orange-500 shadow-[0_0_15px_rgba(234,88,12,0.4)]" 
                  : "bg-white/5 border-white/10 hover:bg-white/10"
              )}
            >
              <div className={activeTab === cat.id ? "text-white" : "text-gray-400"}>
                {cat.icon}
              </div>
              <span className={cn(
                "text-xs font-bold uppercase tracking-widest",
                activeTab === cat.id ? "text-white" : "text-gray-400"
              )}>
                {cat.title}
              </span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* FEATURED TAB */}
            {activeTab === 'featured' && (
              <>
                <section>
                  <h2 className="text-lg font-black italic uppercase tracking-tighter text-white mb-4 flex items-center gap-2">
                    <Flame className="w-5 h-5 text-orange-500" />
                    Offres Fanzzy
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {(shopConfig?.ferveurPacks || []).map((pack, idx) => (
                      <motion.div
                        key={pack.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Card className="relative overflow-hidden border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.2)] h-full flex flex-col justify-between">
                          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/20 via-orange-500/20 to-red-500/20" />
                          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/20 blur-3xl rounded-full" />
                          <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-500/20 blur-3xl rounded-full" />
                          
                          <div className="relative p-6 flex flex-col items-center text-center h-full">
                            <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-lg animate-pulse">
                              Épique
                            </div>
                            <div className="relative mb-4 mt-2">
                              {pack.numberOfRewards >= 3 && <Sparkles className="absolute -top-4 -right-4 w-8 h-8 text-yellow-400 animate-spin-slow" />}
                              <Zap className="w-16 h-16 text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.8)]" />
                            </div>
                            <h3 className="text-xl font-black italic uppercase text-white mb-2 drop-shadow-md">{pack.name}</h3>
                            <p className="text-[10px] text-yellow-200/80 font-bold uppercase tracking-widest mb-6 flex-grow flex items-center justify-center min-h-[40px]">{pack.description}</p>
                            <Button 
                              onClick={() => purchasePackFerveur(pack)}
                              disabled={purchasing || (profile.gems || 0) < pack.price}
                              className="w-full mt-auto bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-black uppercase text-base shadow-[0_0_20px_rgba(234,179,8,0.4)] border-none flex items-center justify-center gap-1.5 py-3">
                              {purchasing && packAnimation !== 'idle' ? 'Ouverture...' : <>Acheter {pack.price} <Gem className="w-4 h-4 mx-0.5" /></>}
                            </Button>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </section>

                <section>
                  <h2 className="text-lg font-black italic uppercase tracking-tighter text-white mb-4">Nouveautés</h2>
                  <div className="grid grid-cols-2 gap-4">
                    {fanzItems.length > 0 && renderItemCard(fanzItems[0], 'fanz')}
                    {skinItems.length > 0 && renderItemCard(skinItems[0], 'skin')}
                  </div>
                </section>
              </>
            )}

            {/* FANZ TAB */}
            {activeTab === 'fanz' && (
              <section>
                {fanzItems.length === 0 && !loading && (
                  <p className="text-center text-gray-500 py-8">Aucun Fanz disponible pour le moment.</p>
                )}
                <div className="grid grid-cols-2 gap-4">
                  {fanzItems.map(fanz => renderItemCard(fanz, 'fanz'))}
                </div>
              </section>
            )}

            {/* SKINS TAB */}
            {activeTab === 'skins' && (
              <section>
                {skinItems.length === 0 && !loading && (
                  <p className="text-center text-gray-500 py-8">Aucun Skin disponible pour le moment.</p>
                )}
                <div className="grid grid-cols-2 gap-4">
                  {skinItems.map(skin => renderItemCard(skin, 'skin'))}
                </div>
              </section>
            )}

            {/* EMOTES TAB */}
            {activeTab === 'emotes' && (
              <section>
                {emoteItems.length === 0 && !loading && (
                  <p className="text-center text-gray-500 py-8">Aucun Emote disponible pour le moment.</p>
                )}
                <div className="grid grid-cols-2 gap-4">
                  {emoteItems.map(emote => renderItemCard(emote, 'emote'))}
                </div>
              </section>
            )}

            {/* CARDS TAB */}
            {activeTab === 'cards' && (
              <section>
                {cardItems.length === 0 && !loading && (
                  <p className="text-center text-gray-500 py-8">Aucune Carte disponible pour le moment.</p>
                )}
                <div className="grid grid-cols-2 gap-4">
                  {cardItems.map(card => renderItemCard(card, 'card'))}
                </div>
              </section>
            )}

            {/* BOOSTS TAB */}
            {activeTab === 'boosts' && (
              <section>
                <div className="grid grid-cols-2 gap-4">
                  {MOCK_BOOSTS.map(boost => renderItemCard(boost, 'boost'))}
                </div>
              </section>
            )}

            {/* GEMS TAB */}
            {activeTab === 'gems' && (
              <section className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {MOCK_GEMS.map(gem => (
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} key={gem.id}>
                      <Card className={cn(
                        "relative overflow-hidden border p-4 flex flex-col items-center text-center h-full",
                        gem.popular ? "border-blue-500 bg-blue-900/20 shadow-[0_0_15px_rgba(59,130,246,0.3)]" : "border-white/10 bg-white/5 hover:bg-white/10"
                      )}>
                        {gem.popular && (
                          <div className="absolute top-0 inset-x-0 bg-blue-500 text-white text-[8px] font-black uppercase py-0.5 tracking-widest">
                            Le plus populaire
                          </div>
                        )}
                        <div className={cn("text-4xl mb-3 drop-shadow-xl", gem.popular ? "mt-4" : "")}>
                          {gem.image}
                        </div>
                        <h3 className="text-lg font-black italic text-white mb-1">{gem.amount}</h3>
                        <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mb-4">
                          {gem.bonus > 0 ? `+${gem.bonus} Bonus` : 'Gemmes'}
                        </p>
                        <Button className={cn(
                          "w-full font-black uppercase text-xs",
                          gem.popular ? "bg-blue-500 hover:bg-blue-600 text-white" : "bg-white text-black hover:bg-gray-200"
                        )}>
                          {gem.price}
                        </Button>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Purchase Confirmation Modal */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative"
            >
              <button
                onClick={() => { setSelectedItem(null); setError(null); }}
                className="absolute top-4 right-4 text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="text-center mb-6">
                <h3 className="text-xl font-black italic uppercase text-white mb-4">Confirmer l'achat</h3>

                {/* Large Preview in Modal */}
                <div className="w-32 h-32 mx-auto mb-4 rounded-2xl overflow-hidden bg-gray-800/50 border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                    {(selectedItem.image || selectedItem.video || selectedItem.icon) && (typeof selectedItem.image === 'string' || typeof selectedItem.icon === 'string') ? (
                      <OptimizedMedia 
                        type={selectedItem.video ? 'video' : 'image'} 
                        src={selectedItem.video || selectedItem.image || selectedItem.icon || null} 
                        poster={selectedItem.image || selectedItem.icon} 
                        className="w-full h-full object-contain" 
                        autoPlay
                        loop
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-6xl">
                        {selectedItem.image || selectedItem.icon}
                      </div>
                    )}
                </div>

                <p className="text-sm text-gray-400">Êtes-vous sûr de vouloir acheter :</p>
                <p className="text-xl font-black italic text-orange-500 mt-1 uppercase drop-shadow-md">{selectedItem.name}</p>
                
                {selectedItem.description && (
                  <p className="text-xs text-gray-300 mt-2 bg-white/5 p-2 rounded-lg border border-white/10 italic">
                    "{selectedItem.description}"
                  </p>
                )}
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500 text-red-500 text-sm p-3 rounded-lg mb-4 text-center">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-3">
                {selectedItem.fullPrice?.money > 0 && selectedItem.fullPrice?.gems > 0 ? (
                  <Button
                    onClick={() => handlePurchase('both')}
                    disabled={purchasing || (profile.money || 0) < selectedItem.fullPrice.money || (profile.gems || 0) < selectedItem.fullPrice.gems}
                    className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-black uppercase flex items-center justify-center gap-1.5"
                  >
                    {purchasing ? 'Achat en cours...' : (
                      <>
                        Acheter pour {selectedItem.fullPrice.money} $ + {selectedItem.fullPrice.gems} <Gem className="w-4 h-4 ml-0.5" />
                      </>
                    )}
                  </Button>
                ) : (
                  <>
                    {selectedItem.fullPrice?.money > 0 && (
                      <Button
                        onClick={() => handlePurchase('money')}
                        disabled={purchasing || (profile.money || 0) < selectedItem.fullPrice.money}
                        className="w-full bg-green-500 hover:bg-green-600 text-white font-black uppercase"
                      >
                        {purchasing ? 'Achat en cours...' : `Acheter pour ${selectedItem.fullPrice.money} $`}
                      </Button>
                    )}
                    
                    {selectedItem.fullPrice?.gems > 0 && (
                      <Button
                        onClick={() => handlePurchase('gems')}
                        disabled={purchasing || (profile.gems || 0) < selectedItem.fullPrice.gems}
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black uppercase"
                      >
                        {purchasing ? 'Achat en cours...' : `Acheter pour ${selectedItem.fullPrice.gems} Gemmes`}
                      </Button>
                    )}
                  </>
                )}

                {/* Fallback if fullPrice is not structured properly but price/currency exist */}
                {(!selectedItem.fullPrice || (selectedItem.fullPrice.money === 0 && selectedItem.fullPrice.gems === 0)) && selectedItem.price > 0 && (
                  <Button
                    onClick={() => handlePurchase(selectedItem.currency as 'money' | 'gems')}
                    disabled={purchasing || (profile[selectedItem.currency as 'money' | 'gems'] || 0) < selectedItem.price}
                    className={cn(
                      "w-full font-black uppercase",
                      selectedItem.currency === 'gems' ? "bg-blue-500 hover:bg-blue-600 text-white" : "bg-green-500 hover:bg-green-600 text-white"
                    )}
                  >
                    {purchasing ? 'Achat en cours...' : `Acheter pour ${selectedItem.price} ${selectedItem.currency === 'gems' ? 'Gemmes' : '$'}`}
                  </Button>
                )}

                <Button
                  onClick={() => { setSelectedItem(null); setError(null); }}
                  disabled={purchasing}
                  className="w-full bg-white/10 hover:bg-white/20 text-white font-bold uppercase"
                >
                  Annuler
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {packAnimation !== 'idle' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 overflow-hidden"
          >
            {packAnimation === 'opening' ? (
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ 
                  scale: [0.8, 1.2, 0.9, 1.1, 1],
                  rotate: [0, -5, 5, -5, 0]
                }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
                className="relative"
              >
                <div className="absolute inset-0 bg-yellow-500 blur-[100px] opacity-50 animate-pulse" />
                <Zap className="w-48 h-48 text-yellow-400 drop-shadow-[0_0_30px_rgba(234,179,8,1)] animate-bounce" />
              </motion.div>
            ) : (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full max-w-md flex flex-col items-center gap-6"
              >
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-500/20 via-transparent to-transparent pointer-events-none" />
                
                <h2 className="text-4xl font-black italic uppercase text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)] text-center mb-4">
                  Incroyable !
                </h2>
                
                <div className="flex flex-col gap-4 w-full">
                  {packRewards.map((reward, i) => (
                    <motion.div
                      key={i}
                      initial={{ x: -50, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: i * 0.3, type: "spring", stiffness: 200 }}
                    >
                      <Card className="p-4 bg-gradient-to-r from-gray-800 to-gray-900 border-yellow-500/30 flex items-center gap-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/10 blur-2xl rounded-full" />
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-black/50 flex-shrink-0 flex items-center justify-center border border-white/10 relative">
                          {reward.image ? (
                            <img src={reward.image} alt={reward.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-3xl">{reward.icon}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-lg font-black uppercase text-white truncate drop-shadow-sm">{reward.name}</h4>
                          {reward.fanz && <p className="text-xs text-yellow-500 font-bold uppercase truncate">Pour {reward.fanz}</p>}
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: packRewards.length * 0.3 + 0.5 }}
                  className="w-full mt-6"
                >
                  <Button
                    onClick={() => setPackAnimation('idle')}
                    className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-black uppercase text-xl py-4 shadow-[0_0_30px_rgba(234,179,8,0.3)]"
                  >
                    Génial !
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
