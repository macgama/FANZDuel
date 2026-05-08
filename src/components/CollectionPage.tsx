import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, onSnapshot, doc } from 'firebase/firestore';
import { Card, Button } from './Layout';
import { UserProfile, FanzTemplate, FanzSkin, FanzEmote, Card as GameCard, LifeAction, Fanz } from '../types';
import { getImageUrl } from '../lib/utils';
import { Maximize2, PlayCircle } from 'lucide-react';
import { useMediaViewer } from '../context/MediaViewerContext';

interface CollectionPageProps {
  user: UserProfile;
}

export function CollectionPage({ user }: CollectionPageProps) {
  const { openMedia } = useMediaViewer();
  const [activeTab, setActiveTab] = useState<'fanz' | 'skins' | 'emotes' | 'cards' | 'actions'>('fanz');
  const [fanzTemplates, setFanzTemplates] = useState<FanzTemplate[]>([]);
  const [skins, setSkins] = useState<any[]>([]);
  const [emotes, setEmotes] = useState<any[]>([]);
  const [cards, setCards] = useState<GameCard[]>([]);
  const [actions, setActions] = useState<LifeAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCollectionFanz, setFilterCollectionFanz] = useState<string>('all');

  const [ownedTemplates, setOwnedTemplates] = useState<Set<string>>(new Set());
  const [ownedSkins, setOwnedSkins] = useState<Set<string>>(new Set());
  const [ownedEmotes, setOwnedEmotes] = useState<Set<string>>(new Set());
  const [ownedCards, setOwnedCards] = useState<Set<string>>(new Set());
  const [ownedActions, setOwnedActions] = useState<Set<string>>(new Set());

  const [fanzList, setFanzList] = useState<Fanz[]>([]);
  const [userDoc, setUserDoc] = useState<UserProfile | null>(null);

  useEffect(() => {
    // 1. Fetch user's FANZ to see what they own
    const unsubscribe = onSnapshot(query(collection(db, 'fanz'), where('ownerUid', '==', user.uid)), (snap) => {
      setFanzList(snap.docs.map(d => d.data() as Fanz));
    });
    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    const unsubBase = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
       setUserDoc(docSnap.data() as UserProfile);
    });
    return () => unsubBase();
  }, [user.uid]);

  useEffect(() => {
     const t = new Set<string>();
     const s = new Set<string>();
     const e = new Set<string>();
     const c = new Set<string>();
     const a = new Set<string>();

     fanzList.forEach(f => {
       if (f.templateId) {
         t.add(f.templateId);
         if (f.unlockedSkins) {
             if (Array.isArray(f.unlockedSkins)) f.unlockedSkins.forEach(x => s.add(`${f.templateId}-${x}`));
             else Object.keys(f.unlockedSkins).forEach(x => s.add(`${f.templateId}-${x}`));
         }
         if (f.unlockedEmotes) {
             if (Array.isArray(f.unlockedEmotes)) f.unlockedEmotes.forEach(x => e.add(`${f.templateId}-${x}`));
             else Object.keys(f.unlockedEmotes).forEach(x => e.add(`${f.templateId}-${x}`));
         }
       }
     });

     if (userDoc) {
       if (userDoc.cards) {
         if (Array.isArray(userDoc.cards)) userDoc.cards.forEach(x => c.add(x));
         else Object.keys(userDoc.cards).forEach(x => c.add(x));
       }
       if (userDoc.unlockedActions) {
         if (Array.isArray(userDoc.unlockedActions)) userDoc.unlockedActions.forEach(x => a.add(x));
         else Object.keys(userDoc.unlockedActions).forEach(x => a.add(x));
       }
       if (userDoc.skins) {
         if (Array.isArray(userDoc.skins)) userDoc.skins.forEach(x => s.add(x));
         else Object.keys(userDoc.skins).forEach(x => s.add(x));
       }
       if (userDoc.emotes) {
         if (Array.isArray(userDoc.emotes)) userDoc.emotes.forEach(x => e.add(x));
         else Object.keys(userDoc.emotes).forEach(x => e.add(x));
       }
     }

     setOwnedTemplates(t);
     setOwnedSkins(s);
     setOwnedEmotes(e);
     setOwnedCards(c);
     setOwnedActions(a);
  }, [fanzList, userDoc]);

  useEffect(() => {
    const fetchAll = async () => {
      const [tSnap, cSnap, aSnap] = await Promise.all([
        getDocs(collection(db, 'fanz_templates')),
        getDocs(collection(db, 'cards')),
        getDocs(collection(db, 'life_actions')),
      ]);
      const templates = tSnap.docs.map(d => ({id: d.id, ...d.data()})) as FanzTemplate[];
      setFanzTemplates(templates);
      
      const allSkins = templates.flatMap(t => (t.skins || []).filter(s => s.category !== 'event' || s.isActive !== false).map(s => ({...s, fanzId: t.id, fanzName: t.name, uniqueId: `${t.id}-${s.id}`})));
      const allEmotes = templates.flatMap(t => (t.emotes || []).filter(e => e.category !== 'event' || e.isActive !== false).map(e => ({...e, fanzId: t.id, fanzName: t.name, uniqueId: `${t.id}-${e.id}`})));
      setSkins(allSkins);
      setEmotes(allEmotes);
      
      setCards(cSnap.docs.map(d => ({id: d.id, ...d.data()})) as any);
      setActions(aSnap.docs.map(d => ({id: d.id, ...d.data()})) as any);
      setLoading(false);
    };
    fetchAll();
  }, []);

  if (loading) return <div className="p-8 text-center text-white">Chargement...</div>;

  const checkSkinOwned = (skin: any) => ownedSkins.has(skin.uniqueId) || ownedSkins.has(skin.id);
  const checkEmoteOwned = (emote: any) => ownedEmotes.has(emote.uniqueId) || ownedEmotes.has(emote.id);
  const checkCardOwned = (card: any) => {
    if (ownedCards.has(card.id)) return true;

    // Filter fanz that can actually use this card
    const allowedFanzList = fanzList.filter(fanz => {
        const isAllowed = !card.fanzIds || card.fanzIds.length === 0 || card.fanzIds.includes(fanz.templateId);
        const isBlocked = card.blockedFanzIds && card.blockedFanzIds.includes(fanz.templateId);
        return isAllowed && !isBlocked;
    });

    if (allowedFanzList.length === 0) {
        // If user has no Fanz that can use this card, they only "own" it if it's a generic common card with no requirements
        const isGeneric = (!card.fanzIds || card.fanzIds.length === 0) && (!card.blockedFanzIds || card.blockedFanzIds.length === 0);
        if (isGeneric && card.rarity === 'common' && (!card.unlockRequirements || card.unlockRequirements.length === 0)) return true;
        return false;
    }

    const requirements = card.unlockRequirements || [];
    const hasRequirements = requirements.length > 0;
    if (!hasRequirements && card.rarity === 'common') return true;

    if (hasRequirements) {
      return allowedFanzList.some(fanz => {
        return requirements.every((req: any) => {
          if (req.type === 'fanzLevel') return (fanz.level || 1) >= req.minLevel;
          if (req.type === 'rank') return (fanz.rank ?? 0) >= req.minLevel;
          return true;
        });
      });
    }
    return false;
  };

  const validOwnedTemplates = fanzTemplates.filter(t => ownedTemplates.has(t.id)).length;
  const validOwnedSkins = skins.filter(checkSkinOwned).length;
  const validOwnedEmotes = emotes.filter(checkEmoteOwned).length;
  const validOwnedCards = cards.filter(checkCardOwned).length;
  const validOwnedActions = actions.filter(a => ownedActions.has(a.id)).length;

  const tabs = [
    { id: 'fanz', label: 'FANZ', count: validOwnedTemplates + '/' + fanzTemplates.length },
    { id: 'skins', label: 'Skins', count: validOwnedSkins + '/' + skins.length },
    { id: 'emotes', label: 'Emotes', count: validOwnedEmotes + '/' + emotes.length },
    { id: 'cards', label: 'Cartes', count: validOwnedCards + '/' + cards.length },
    { id: 'actions', label: 'Actions', count: validOwnedActions + '/' + actions.length },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] text-white">
      <div className="p-4 bg-gray-900 border-b border-white/10 sticky top-0 z-40">
        <h1 className="text-2xl font-black italic uppercase text-white mb-4">Mon Musée</h1>
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
              </div>
            </button>
          ))}
        </div>
        {activeTab !== 'fanz' && (
          <div className="mt-4 flex flex-wrap gap-4">
            <select
              value={filterCollectionFanz}
              onChange={(e) => setFilterCollectionFanz(e.target.value)}
              className="p-2 bg-[#1a1a2e] border border-white/20 rounded-lg text-white font-bold text-sm"
            >
              <option value="all">Tous les FANZ</option>
              {activeTab === 'cards' || activeTab === 'actions' ? <option value="generic">{activeTab === 'cards' ? 'Cartes Génériques' : 'Actions Génériques'}</option> : null}
              {fanzTemplates.filter(f => f.isActive !== false).map(fanz => (
                <option key={fanz.id} value={fanz.id}>{fanz.id} - {fanz.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-8 no-scrollbar scroll-smooth">
        {activeTab === 'fanz' && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...fanzTemplates]
              .sort((a, b) => {
                const aOwned = ownedTemplates.has(a.id);
                const bOwned = ownedTemplates.has(b.id);
                if (aOwned !== bOwned) return aOwned ? -1 : 1;
                return a.name.localeCompare(b.name);
              })
              .map(template => {
              const owned = ownedTemplates.has(template.id);
              const isInactive = template.isActive === false;
              return (
                <Card key={template.id} className={`p-4 relative overflow-hidden transition-all ${!owned ? (isInactive ? 'opacity-50 grayscale' : 'opacity-50 grayscale hover:grayscale-0') : 'border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.2)]'}`}>
                  <div className="aspect-square rounded-lg bg-[#0a0a0a] overflow-hidden mb-3 relative group">
                    {template.video ? (
                      <video src={getImageUrl(template.video)} className="w-full h-full object-cover cursor-pointer" autoPlay muted loop playsInline data-viewer-enabled="true" data-viewer-ignore={!owned || isInactive ? "true" : undefined} data-viewer-title={template.name} data-viewer-item-type="fanz" data-viewer-description={template.description} data-viewer-metadata={JSON.stringify({ stats: template.baseStats })} />
                    ) : (
                      <img src={getImageUrl(template.image)} alt={template.name} className="w-full h-full object-cover cursor-pointer" data-viewer-enabled="true" data-viewer-ignore={!owned || isInactive ? "true" : undefined} data-viewer-title={template.name} data-viewer-item-type="fanz" data-viewer-description={template.description} data-viewer-metadata={JSON.stringify({ stats: template.baseStats })} />
                    )}
                    {owned && !isInactive && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-20">
                        <Maximize2 className="w-8 h-8 text-white drop-shadow-lg" />
                      </div>
                    )}
                    {isInactive && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30">
                        <span className="text-white font-black text-sm uppercase px-4 py-2 bg-black/80 rounded-lg border border-white/20 -rotate-6 shadow-xl tracking-wider text-center shadow-black/80">Bientôt dispo</span>
                      </div>
                    )}
                  </div>
                  <h3 className="font-bold text-center text-sm md:text-base leading-tight">{template.name}</h3>
                </Card>
              );
            })}
          </div>
        )}

        {activeTab === 'skins' && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...skins]
              .filter(s => {
                if (filterCollectionFanz === 'all') return true;
                return s.fanzId === filterCollectionFanz;
              })
              .sort((a, b) => {
                const aOwned = checkSkinOwned(a);
                const bOwned = checkSkinOwned(b);
                if (aOwned !== bOwned) return aOwned ? -1 : 1;
                const aFanz = a.fanzName || '';
                const bFanz = b.fanzName || '';
                if (aFanz !== bFanz) return aFanz.localeCompare(bFanz);
                return (a.name || '').localeCompare(b.name || '');
              })
              .map(skin => {
              const owned = checkSkinOwned(skin);
              return (
                <div key={skin.uniqueId} className={`bg-gray-900 rounded-xl overflow-hidden relative ${!owned ? 'opacity-50 grayscale hover:grayscale-0' : 'outline outline-1 outline-blue-500/50'}`}>
                  <div className="aspect-square bg-black relative group">
                    {skin.videoUrl ? (
                      <video src={getImageUrl(skin.videoUrl)} className="w-full h-full object-cover cursor-pointer" autoPlay muted loop playsInline data-viewer-enabled="true" data-viewer-ignore={!owned ? "true" : undefined} data-viewer-title={skin.name} data-viewer-item-type="skin" />
                    ) : (
                      <img src={getImageUrl(skin.imageUrl)} alt={skin.name} className="w-full h-full object-cover cursor-pointer" data-viewer-enabled="true" data-viewer-ignore={!owned ? "true" : undefined} data-viewer-title={skin.name} data-viewer-item-type="skin" />
                    )}
                    {owned && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-20">
                        <Maximize2 className="w-8 h-8 text-white drop-shadow-lg" />
                      </div>
                    )}
                  </div>
                  <div className="p-3 bg-gray-800 text-center">
                     <h3 className="font-bold text-sm leading-tight text-white">{skin.name}</h3>
                     <p className="text-[10px] text-blue-400 mt-1 uppercase tracking-wider">{skin.fanzName}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'emotes' && (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {[...emotes]
              .filter(e => {
                if (filterCollectionFanz === 'all') return true;
                return e.fanzId === filterCollectionFanz;
              })
              .sort((a, b) => {
                const aOwned = checkEmoteOwned(a);
                const bOwned = checkEmoteOwned(b);
                if (aOwned !== bOwned) return aOwned ? -1 : 1;
                const aFanz = a.fanzName || '';
                const bFanz = b.fanzName || '';
                if (aFanz !== bFanz) return aFanz.localeCompare(bFanz);
                return (a.name || '').localeCompare(b.name || '');
              })
              .map(emote => {
              const owned = checkEmoteOwned(emote);
              return (
                <div key={emote.uniqueId} className={`bg-gray-900 rounded-xl overflow-hidden relative flex flex-col ${!owned ? 'opacity-50 grayscale hover:grayscale-0' : 'outline outline-1 outline-purple-500/50'}`}>
                  <div className="aspect-square bg-black relative p-2 group">
                    {emote.videoUrl ? (
                      <video src={getImageUrl(emote.videoUrl)} className="w-full h-full object-contain cursor-pointer" autoPlay muted loop playsInline data-viewer-enabled="true" data-viewer-ignore={!owned ? "true" : undefined} data-viewer-title={emote.name} data-viewer-item-type="emote" />
                    ) : (
                      <img src={getImageUrl(emote.imageUrl)} alt={emote.name} className="w-full h-full object-contain cursor-pointer" data-viewer-enabled="true" data-viewer-ignore={!owned ? "true" : undefined} data-viewer-title={emote.name} data-viewer-item-type="emote" />
                    )}
                    {owned && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-20">
                        <Maximize2 className="w-6 h-6 text-white drop-shadow-md" />
                      </div>
                    )}
                  </div>
                  <div className="p-1.5 bg-gray-800 flex-1 flex flex-col items-center justify-center text-center">
                    <h3 className="font-bold text-[10px] sm:text-xs uppercase truncate w-full text-gray-300">{emote.name}</h3>
                    <p className="text-[8px] text-purple-400 mt-0.5 uppercase tracking-wider line-clamp-1">{emote.fanzName}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'cards' && (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {[...cards]
              .filter(c => {
                if (filterCollectionFanz === 'all') return true;
                if (filterCollectionFanz === 'generic') return (!c.fanzIds || c.fanzIds.length === 0);
                return c.fanzIds && c.fanzIds.includes(filterCollectionFanz);
              })
              .sort((a, b) => {
                const aOwned = checkCardOwned(a);
                const bOwned = checkCardOwned(b);
                if (aOwned !== bOwned) return aOwned ? -1 : 1;
                const getFanzName = (card: GameCard) => {
                  if (!card.fanzIds || card.fanzIds.length === 0) return 'zzz_générique';
                  return card.fanzIds.map(id => {
                    const fanz = fanzTemplates.find(f => f.id === id);
                    return fanz ? fanz.name : id;
                  }).join(', ');
                };
                const aFanzName = getFanzName(a);
                const bFanzName = getFanzName(b);
                if (aFanzName !== bFanzName) return aFanzName.localeCompare(bFanzName);
                return a.name.localeCompare(b.name);
              })
              .map(card => {
              const owned = checkCardOwned(card);
              return (
                <div key={card.id} className={`aspect-[3/4] rounded-xl overflow-hidden relative flex flex-col group ${!owned ? 'bg-gray-900 opacity-50 grayscale hover:grayscale-0' : 'bg-gray-800 outline outline-2 outline-white/10'}`}>
                  {card.videoUrl ? (
                     <video src={getImageUrl(card.videoUrl)} className="w-full h-full object-cover cursor-pointer" autoPlay muted loop playsInline data-viewer-enabled="true" data-viewer-ignore={!owned ? "true" : undefined} data-viewer-title={card.name} data-viewer-item-type="card" data-viewer-metadata={JSON.stringify({ energyCost: card.energyCost, fervorValue: card.fervorValue, rarity: card.rarity })} />
                  ) : (
                     <img src={getImageUrl(card.imageUrl)} alt={card.name} className="w-full h-full object-cover cursor-pointer" data-viewer-enabled="true" data-viewer-ignore={!owned ? "true" : undefined} data-viewer-title={card.name} data-viewer-item-type="card" data-viewer-metadata={JSON.stringify({ energyCost: card.energyCost, fervorValue: card.fervorValue, rarity: card.rarity })} />
                  )}
                  {owned && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-20">
                      <Maximize2 className="w-8 h-8 text-white drop-shadow-lg" />
                    </div>
                  )}
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent pt-1 pb-3 px-1 pointer-events-none z-10 flex flex-col items-center">
                     {(() => {
                        if (!card.fanzIds || card.fanzIds.length === 0) return <span className="text-[8px] text-blue-300 font-bold uppercase tracking-wide drop-shadow-md">Générique</span>;
                        const fanzNames = card.fanzIds.map(id => {
                          const fanz = fanzTemplates.find(f => f.id === id);
                          return fanz ? fanz.name : id;
                        }).join(', ');
                        return <span className="text-[8px] text-blue-300 font-bold uppercase tracking-wide drop-shadow-md text-center line-clamp-2">{fanzNames}</span>;
                     })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'actions' && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...actions]
              .filter(a => {
                if (filterCollectionFanz === 'all') return true;
                if (filterCollectionFanz === 'generic') return !a.fanzTemplateId;
                return a.fanzTemplateId === filterCollectionFanz;
              })
              .sort((a, b) => {
                const aOwned = ownedActions.has(a.id);
                const bOwned = ownedActions.has(b.id);
                if (aOwned !== bOwned) return aOwned ? -1 : 1;
                const getFanzName = (action: LifeAction) => {
                  if (!action.fanzTemplateId) return 'zzz_générique';
                  const fanz = fanzTemplates.find(f => f.id === action.fanzTemplateId);
                  return fanz ? fanz.name : action.fanzTemplateId;
                };
                const aFanzName = getFanzName(a);
                const bFanzName = getFanzName(b);
                if (aFanzName !== bFanzName) return aFanzName.localeCompare(bFanzName);
                return a.name.localeCompare(b.name);
              })
              .map(action => {
              const owned = ownedActions.has(action.id);
              return (
                <div key={action.id} className={`bg-gray-900 rounded-xl overflow-hidden relative flex flex-col ${!owned ? 'opacity-50 grayscale hover:grayscale-0' : 'outline outline-1 outline-green-500/50'}`}>
                  <div className="h-32 bg-black relative group">
                    {action.videoUrl ? (
                       <video src={getImageUrl(action.videoUrl)} className="w-full h-full object-cover cursor-pointer" autoPlay muted loop playsInline data-viewer-enabled="true" data-viewer-ignore={!owned ? "true" : undefined} data-viewer-title={action.name} data-viewer-item-type="life_action" data-viewer-metadata={JSON.stringify({ xpReward: action.xpGain })} />
                    ) : action.image ? (
                       <img src={getImageUrl(action.image)} alt={action.name} className="w-full h-full object-cover cursor-pointer" data-viewer-enabled="true" data-viewer-ignore={!owned ? "true" : undefined} data-viewer-title={action.name} data-viewer-item-type="life_action" data-viewer-metadata={JSON.stringify({ xpReward: action.xpGain })} />
                    ) : (
                       <div className="w-full h-full flex items-center justify-center text-gray-700">
                         <PlayCircle className="w-8 h-8" />
                       </div>
                    )}
                    {owned && action.image && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-20">
                        <Maximize2 className="w-8 h-8 text-white drop-shadow-lg" />
                      </div>
                    )}
                  </div>
                  <div className="p-3 bg-gray-800 flex-1">
                    <h3 className="font-bold text-center text-xs leading-tight mb-1">{action.name}</h3>
                    {(() => {
                        if (!action.fanzTemplateId) return <p className="text-[8px] text-blue-400 text-center uppercase tracking-wider mb-1 line-clamp-1">Générique</p>;
                        const fanz = fanzTemplates.find(f => f.id === action.fanzTemplateId);
                        return <p className="text-[8px] text-blue-400 text-center uppercase tracking-wider mb-1 line-clamp-1">{fanz ? fanz.name : action.fanzTemplateId}</p>;
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
