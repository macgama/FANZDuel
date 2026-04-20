import React, { useState, useEffect } from 'react';
import { Store, Gem, Zap, Star, User, Shirt, Smile, TrendingUp, Shield, Flame, Sparkles, X } from 'lucide-react';
import { Card, Button } from './Layout';
import { UserProfile, FanzTemplate, Card as DuelCard } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn, getImageUrl } from '../lib/utils';
import { OptimizedMedia } from './OptimizedMedia';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, getDocs, query, where, doc, updateDoc, arrayUnion, setDoc } from 'firebase/firestore';

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

  useEffect(() => {
    const fetchShopItems = async () => {
      setLoading(true);
      try {
        // Fetch user's owned Fanz to filter them out
        const userFanzSnap = await getDocs(query(collection(db, 'fanz'), where('ownerUid', '==', profile.uid)));
        const ownedFanzTemplateIds = userFanzSnap.docs.map(d => d.data().templateId);

        // Fetch Fanz Templates
        const fanzSnapshot = await getDocs(collection(db, 'fanz_templates'));
        const fanzData = fanzSnapshot.docs.map(doc => doc.data() as FanzTemplate);
        
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
          if (fanz.skins) {
            fanz.skins.forEach(skin => {
              if (skin.price && (skin.price.money || skin.price.gems) && !(profile.skins || []).includes(skin.id)) {
                skinsForSale.push({
                  id: `${fanz.id}-${skin.id}`,
                  originalId: skin.id,
                  type: 'skin',
                  name: skin.name,
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
          if (fanz.emotes) {
            fanz.emotes.forEach(emote => {
              if (emote.price && (emote.price.money || emote.price.gems) && !(profile.emotes || []).includes(emote.id)) {
                emotesForSale.push({
                  id: `${fanz.id}-${emote.id}`,
                  originalId: emote.id,
                  type: 'emote',
                  name: emote.name,
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
        });

        // Fetch Duel Cards
        const cardsSnapshot = await getDocs(collection(db, 'cards'));
        const cardsData = cardsSnapshot.docs.map(doc => doc.data() as DuelCard);
        
        const cardsForSale = cardsData
          .filter(c => c.price && (c.price.money || c.price.gems))
          .filter(c => !(profile.cards || []).includes(c.id))
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
            duration: `Coût: ${c.energyCost} Énergie`
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
            <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-[8px] font-black uppercase px-2 py-1 rounded-full text-white/80 z-20 shadow-md">
              {rarityLabel}
            </div>
            
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
            {renderPriceButton(item.price, item.currency, item)}
          </div>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="flex items-center justify-between px-4">
        <h1 className="text-lg sm:text-xl font-black italic uppercase tracking-tighter flex items-center gap-2">
          Boutique
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
                    Offre du jour
                  </h2>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Card className="relative overflow-hidden border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
                      <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/20 via-orange-500/20 to-red-500/20" />
                      <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/20 blur-3xl rounded-full" />
                      <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-500/20 blur-3xl rounded-full" />
                      
                      <div className="relative p-6 flex flex-col items-center text-center">
                        <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-lg animate-pulse">
                          -50%
                        </div>
                        <div className="relative mb-4">
                          <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-400 animate-spin-slow" />
                          <Zap className="w-20 h-20 text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.8)]" />
                        </div>
                        <h3 className="text-2xl font-black italic uppercase text-white mb-2 drop-shadow-md">Pack Ferveur</h3>
                        <p className="text-sm text-yellow-200/80 font-bold uppercase tracking-widest mb-6">1000 Gemmes + 5000$ + Boost XP</p>
                        <Button className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-black uppercase text-lg shadow-[0_0_20px_rgba(234,179,8,0.4)] border-none">
                          Acheter 4.99€
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
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
                <h3 className="text-xl font-black italic uppercase text-white mb-2">Confirmer l'achat</h3>
                <p className="text-sm text-gray-400">Êtes-vous sûr de vouloir acheter :</p>
                <p className="text-lg font-bold text-orange-500 mt-1">{selectedItem.name}</p>
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
    </div>
  );
}
