import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Card } from './Layout';
import { Star, Flame, Trophy, PlayCircle } from 'lucide-react';
import { FanzTemplate, FanzSkin, FanzEmote, GameCard, LifeAction } from '../types';
import { getImageUrl } from '../lib/utils';

interface CollectionPageProps {
  user: UserProfile;
}

export function CollectionPage({ user }: CollectionPageProps) {
  const [activeTab, setActiveTab] = useState<'fanz' | 'skins' | 'emotes' | 'cards' | 'actions'>('fanz');
  
  const [fanzTemplates, setFanzTemplates] = useState<FanzTemplate[]>([]);
  const [skins, setSkins] = useState<FanzSkin[]>([]);
  const [emotes, setEmotes] = useState<FanzEmote[]>([]);
  const [cards, setCards] = useState<GameCard[]>([]);
  const [actions, setActions] = useState<LifeAction[]>([]);
  const [loading, setLoading] = useState(true);

  // User's owned item caches
  const [ownedTemplates, setOwnedTemplates] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch User's Fanz to know which templates they own
        const fanzSnap = await getDocs(collection(db, 'fanz'));
        const fanzData = fanzSnap.docs
          .map(doc => doc.data())
          .filter(f => f.ownerUid === user.uid);
        
        const ownedTemplateIds = new Set(fanzData.map(f => f.templateId));
        setOwnedTemplates(ownedTemplateIds);

        // Fetch all Fanz Templates
        const templatesSnap = await getDocs(collection(db, 'fanz_templates'));
        const allTemplates = templatesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FanzTemplate));
        setFanzTemplates(allTemplates);

        // Extract skins and emotes
        let allSkins: FanzSkin[] = [];
        let allEmotes: FanzEmote[] = [];
        allTemplates.forEach(t => {
          if (t.skins) allSkins.push(...t.skins);
          if (t.emotes) allEmotes.push(...t.emotes);
        });
        const uniqueSkins = Array.from(new Map(allSkins.map(s => [s.id, s])).values());
        const uniqueEmotes = Array.from(new Map(allEmotes.map(e => [e.id, e])).values());

        setSkins(uniqueSkins);
        setEmotes(uniqueEmotes);

        // Fetch Duel Cards
        const cardsSnap = await getDocs(collection(db, 'cards'));
        setCards(cardsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as GameCard)));

        // Fetch Life Actions
        const actionsSnap = await getDocs(collection(db, 'life_actions'));
        setActions(actionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LifeAction)));

      } catch (error) {
        console.error("Error fetching collection data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user.uid]);

  const activeFanzTemplates = fanzTemplates.filter(t => t.isActive !== false);
  const activeSkins = skins.filter(s => fanzTemplates.find(t => t.id === s.fanzId)?.isActive !== false);
  const activeEmotes = emotes.filter(e => fanzTemplates.find(t => t.id === e.fanzId)?.isActive !== false);
  const activeActions = actions.filter(a => !a.fanzTemplateId || fanzTemplates.find(t => t.id === a.fanzTemplateId)?.isActive !== false);
  const activeCards = cards.filter(c => !c.fanzIds || c.fanzIds.length === 0 || c.fanzIds.some(fid => fanzTemplates.find(t => t.id === fid)?.isActive !== false));

  const countFanz = Array.from(ownedTemplates).filter(id => activeFanzTemplates.some(t => t.id === id)).length;
  const countSkins = (user.skins || []).filter(id => activeSkins.some(s => s.id === id)).length;
  const countEmotes = (user.emotes || []).filter(id => activeEmotes.some(e => e.id === id)).length;
  const countCards = (user.cards || []).filter(id => activeCards.some(c => c.id === id)).length;
  const countActions = (user.unlockedActions || []).filter(id => activeActions.some(a => a.id === id)).length;

  const tabs = [
    { id: 'fanz', label: 'FANZ', count: countFanz, total: activeFanzTemplates.length },
    { id: 'skins', label: 'SKINS', count: countSkins, total: activeSkins.length },
    { id: 'emotes', label: 'ÉMOTES', count: countEmotes, total: activeEmotes.length },
    { id: 'cards', label: 'CARTES', count: countCards, total: activeCards.length },
    { id: 'actions', label: 'ACTIONS', count: countActions, total: activeActions.length },
  ] as const;

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto no-scrollbar p-6 lg:p-8 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const renderFanz = () => {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {fanzTemplates.map(template => {
          const owned = ownedTemplates.has(template.id);
          const isFanzActive = template.isActive !== false;
          return (
            <Card key={template.id} className={`p-4 relative overflow-hidden transition-all ${!owned ? 'opacity-50 grayscale hover:grayscale-0' : 'border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.2)]'}`}>
              <div className="aspect-square rounded-lg bg-[#0a0a0a] overflow-hidden mb-3 relative">
                {template.video ? (
                  <video src={getImageUrl(template.video)} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                ) : (
                  <img src={getImageUrl(template.image)} alt={template.name} className="w-full h-full object-cover" />
                )}
                {!isFanzActive && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-500/90 text-white backdrop-blur-sm shadow-md">
                    Bientôt
                  </div>
                )}
                {!owned && isFanzActive && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-white/50 font-bold uppercase tracking-widest text-xs">Verrouillé</span>
                  </div>
                )}
              </div>
              <h3 className="font-bold text-center text-sm truncate">{template.name}</h3>
              <div className="text-center text-xs text-gray-500 uppercase mt-1">{template.rarity}</div>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderSkins = () => {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {skins.map(skin => {
          const owned = (user.skins || []).includes(skin.id);
          const isSkinActive = fanzTemplates.find(t => t.id === skin.fanzId)?.isActive !== false;
          return (
            <div key={skin.id} className={`bg-gray-900 rounded-xl overflow-hidden relative ${!owned ? 'opacity-50 grayscale hover:grayscale-0' : 'outline outline-1 outline-blue-500/50'}`}>
              <div className="aspect-square bg-black relative">
                {skin.videoUrl ? (
                  <video src={getImageUrl(skin.videoUrl)} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                ) : (
                  <img src={getImageUrl(skin.imageUrl)} alt={skin.name} className="w-full h-full object-cover" />
                )}
                {!isSkinActive && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-500/90 text-white backdrop-blur-sm shadow-md z-10">
                    Bientôt
                  </div>
                )}
                {!owned && isSkinActive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-black/80 flex items-center justify-center border border-white/10">
                      <div className="w-3 h-3 bg-white/20 rounded-full" />
                    </div>
                  </div>
                )}
              </div>
              <div className="p-2 text-center text-xs font-bold truncate">
                {skin.name}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderEmotes = () => {
    return (
      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4">
        {emotes.map(emote => {
          const owned = (user.emotes || []).includes(emote.id);
          const isEmoteActive = fanzTemplates.find(t => t.id === emote.fanzId)?.isActive !== false;
          return (
            <div key={emote.id} className={`bg-gray-900 rounded-xl overflow-hidden relative ${!owned ? 'opacity-50 grayscale hover:grayscale-0' : 'outline outline-1 outline-purple-500/50'}`}>
              <div className="aspect-square bg-black relative p-2">
                {emote.videoUrl ? (
                  <video src={getImageUrl(emote.videoUrl)} className="w-full h-full object-contain" autoPlay muted loop playsInline />
                ) : (
                  <img src={getImageUrl(emote.imageUrl)} alt={emote.name} className="w-full h-full object-contain" />
                )}
                {!isEmoteActive && (
                  <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase bg-red-500/90 text-white backdrop-blur-sm shadow-md z-10">
                    Bientôt
                  </div>
                )}
                {!owned && isEmoteActive && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white/20" />
                  </div>
                )}
              </div>
              <div className="p-1.5 text-center text-[10px] font-bold truncate text-gray-400">
                {emote.name}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderCards = () => {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {cards.map(card => {
          const owned = (user.cards || []).includes(card.id);
          const isCardActive = !card.fanzIds || card.fanzIds.length === 0 || card.fanzIds.some(fid => fanzTemplates.find(t => t.id === fid)?.isActive !== false);
          return (
            <div key={card.id} className={`aspect-[3/4] rounded-xl overflow-hidden relative ${!owned ? 'bg-gray-900 opacity-50 grayscale hover:grayscale-0' : 'bg-gray-800 outline outline-2 outline-white/10'}`}>
              {card.videoUrl ? (
                 <video src={getImageUrl(card.videoUrl)} className="w-full h-full object-cover" autoPlay muted loop playsInline />
              ) : (
                 <img src={getImageUrl(card.imageUrl)} alt={card.name} className="w-full h-full object-cover" />
              )}
              
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-black/80 text-white backdrop-blur-sm z-10">
                {card.type}
              </div>
              
              {!isCardActive && (
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-500/90 text-white backdrop-blur-sm shadow-md z-10">
                  Bientôt
                </div>
              )}
              {isCardActive && (
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/90 text-white backdrop-blur-sm flex items-center gap-1 z-10">
                  <Flame className="w-3 h-3" /> {card.energyCost}
                </div>
              )}
              
              <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black via-black/80 to-transparent z-10">
                <div className="text-xs font-black truncate">{card.name}</div>
                {!owned && isCardActive && <div className="text-[10px] text-gray-500 mt-1 uppercase">À débloquer</div>}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderActions = () => {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {actions.map(action => {
          const owned = (user.unlockedActions || []).includes(action.id);
          const isActionActive = !action.fanzTemplateId || fanzTemplates.find(t => t.id === action.fanzTemplateId)?.isActive !== false;
          return (
            <div key={action.id} className={`bg-gray-900 rounded-xl overflow-hidden relative flex flex-col ${!owned ? 'opacity-50 grayscale hover:grayscale-0' : 'outline outline-1 outline-green-500/50'}`}>
              <div className="h-32 bg-black relative">
                {action.videoUrl ? (
                   <video src={getImageUrl(action.videoUrl)} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                ) : action.image ? (
                   <img src={getImageUrl(action.image)} alt={action.name} className="w-full h-full object-cover" />
                ) : (
                   <div className="w-full h-full flex items-center justify-center text-gray-700">
                     <PlayCircle className="w-8 h-8" />
                   </div>
                )}
                {!isActionActive && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-500/90 text-white backdrop-blur-sm shadow-md z-10">
                    Bientôt
                  </div>
                )}
                {!owned && isActionActive && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                     <span className="text-white/50 text-xs font-bold uppercase tracking-wider">Non débloqué</span>
                  </div>
                )}
              </div>
              <div className="p-3 flex items-center justify-center text-center">
                <div className="text-sm font-bold line-clamp-2">{action.name}</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const totalOwnedCount = countFanz + countSkins + countEmotes + countCards + countActions;
  const totalActiveItems = Math.max(1, activeFanzTemplates.length + activeSkins.length + activeEmotes.length + activeCards.length + activeActions.length);
  const completionPercentage = Math.round((totalOwnedCount / totalActiveItems) * 100);

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar p-4 lg:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white">Ma <span className="text-orange-500">Collection</span></h1>
          <p className="text-sm text-gray-400 mt-1">Découvrez tout ce que vous avez débloqué et ce qu'il vous reste à obtenir !</p>
        </div>
        
        <div className="flex flex-col gap-2 w-full lg:min-w-[250px] lg:w-1/3 bg-gray-900/50 p-4 rounded-xl border border-white/5">
          <div className="flex items-center justify-between font-bold text-orange-400">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              <span className="uppercase tracking-wider">Complétion</span>
            </div>
            <span className="text-lg">{completionPercentage}%</span>
          </div>
          <div className="h-3 bg-black/50 rounded-full overflow-hidden relative border border-white/5 shadow-inner">
            <div 
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(249,115,22,0.5)]"
              style={{ width: `${completionPercentage}%` }}
            >
               <div className="absolute inset-0 bg-white/20 w-full h-full -translate-x-full animate-[shimmer_2s_infinite]" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex overflow-x-auto no-scrollbar gap-2 pb-2 -mx-4 px-4 lg:mx-0 lg:px-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex flex-col px-4 py-3 rounded-xl whitespace-nowrap outline-none transition-all ${activeTab === tab.id ? 'bg-orange-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.4)] relative top-0' : 'bg-gray-900/50 text-gray-400 hover:bg-gray-800 hover:text-white relative top-1'}`}
          >
            <span className="text-xs font-black tracking-wider uppercase mb-1">{tab.label}</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black leading-none">{tab.count}</span>
              <span className="text-[10px] font-bold text-white/50">/ {tab.total}</span>
            </div>
            
            {/* Progress bar */}
            <div className="w-full h-1 bg-black/30 rounded-full mt-2 overflow-hidden">
              <div 
                className="h-full bg-white/80 rounded-full"
                style={{ width: `${tab.total > 0 ? (tab.count / tab.total) * 100 : 0}%` }}
              />
            </div>
          </button>
        ))}
      </div>

      <div className="mt-8">
        {activeTab === 'fanz' && renderFanz()}
        {activeTab === 'skins' && renderSkins()}
        {activeTab === 'emotes' && renderEmotes()}
        {activeTab === 'cards' && renderCards()}
        {activeTab === 'actions' && renderActions()}
      </div>
    </div>
  );
}
