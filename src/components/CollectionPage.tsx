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
         s.add(`${f.templateId}-000`); // Always own the base skin
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
      
      const allSkins = templates.flatMap(t => {
        const baseSkin = {
          id: '000',
          uniqueId: `${t.id}-000`,
          fanzId: t.id,
          fanzName: t.name,
          name: t.name,
          imageUrl: t.image,
          videoUrl: t.video,
          victoryVideoUrl: t.victoryVideoUrl,
          defeatVideoUrl: t.defeatVideoUrl,
          isActive: t.isActive
        };
        const otherSkins = (t.skins || []).filter(s => s.category !== 'event' || s.isActive !== false).map(s => ({...s, fanzId: t.id, fanzName: t.name, uniqueId: `${t.id}-${s.id}`}));
        return [baseSkin, ...otherSkins];
      });
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
        let ownsRequiredSkin = !card.skinId || (
          fanz.unlockedSkins && (
            Array.isArray(fanz.unlockedSkins) ? fanz.unlockedSkins.includes(card.skinId) 
            : Object.keys(fanz.unlockedSkins).includes(card.skinId)
          )
        );
        
        if (card.skinTheme && fanz.unlockedSkins) {
           const theme = card.skinTheme.toLowerCase();
           const unlockedList = Array.isArray(fanz.unlockedSkins) ? fanz.unlockedSkins : Object.keys(fanz.unlockedSkins);
           // Try to match the skin ID directly with the theme
           const hasThemeSkin = unlockedList.some(skinId => {
             if (skinId.toLowerCase().includes(theme)) return true;
             // We can also fetch the skin name from templates, but we have `skins` array available in this component!
             const skinObj = skins.find(s => s.id === skinId || s.uniqueId === `${fanz.templateId}-${skinId}`);
             return skinObj && skinObj.name && skinObj.name.toLowerCase().includes(theme);
           });
           ownsRequiredSkin = ownsRequiredSkin && hasThemeSkin;
        }
        return isAllowed && !isBlocked && ownsRequiredSkin;
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

  const expandedActions = actions.flatMap(action => {
    if (action.skinOverrides && Object.keys(action.skinOverrides).length > 0 && action.fanzTemplateId) {
      const items = [{
        ...action,
        uniqueItemKey: action.id + '-000',
        associatedSkinId: '000',
        fanzSkinName: fanzTemplates.find(f => f.id === action.fanzTemplateId)?.name || action.fanzTemplateId
      }];
      Object.keys(action.skinOverrides).forEach(skinId => {
        const skinOverride = action.skinOverrides![skinId];
        const skinName = fanzTemplates.find(f => f.id === action.fanzTemplateId)?.skins?.find(s => s.id === skinId)?.name || skinId;
        items.push({
          ...action,
          uniqueItemKey: action.id + '-' + skinId,
          associatedSkinId: skinId,
          fanzSkinName: skinName,
          image: skinOverride.image || action.image,
          videoUrl: skinOverride.videoUrl || action.videoUrl
        });
      });
      return items;
    }
    return [{
      ...action,
      uniqueItemKey: action.id,
      associatedSkinId: action.skinId,
      fanzSkinName: action.fanzTemplateId ? (fanzTemplates.find(f => f.id === action.fanzTemplateId)?.name || action.fanzTemplateId) : ''
    }];
  });

  const validOwnedTemplates = fanzTemplates.filter(t => ownedTemplates.has(t.id)).length;
  const validOwnedSkins = skins.filter(checkSkinOwned).length;
  const validOwnedEmotes = emotes.filter(checkEmoteOwned).length;
  const validOwnedCards = cards.filter(checkCardOwned).length;
  
  const validOwnedExpandedActions = expandedActions.filter(a => {
    const ownedAction = ownedActions.has(a.id);
    const ownedSkin = !a.associatedSkinId || ownedSkins.has(`${a.fanzTemplateId}-${a.associatedSkinId}`);
    return ownedAction && ownedSkin;
  }).length;

  const tabs = [
    { id: 'fanz', label: 'FANZ', count: validOwnedTemplates + '/' + fanzTemplates.length },
    { id: 'skins', label: 'Skins', count: validOwnedSkins + '/' + skins.length },
    { id: 'emotes', label: 'Emotes', count: validOwnedEmotes + '/' + emotes.length },
    { id: 'cards', label: 'Cartes', count: validOwnedCards + '/' + cards.length },
    { id: 'actions', label: 'Actions', count: validOwnedExpandedActions + '/' + expandedActions.length },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] text-white">
      <div className="p-4 px-2 sm:px-4 bg-gray-900 border-b border-white/10 sticky top-0 z-40">
        <h1 className="text-2xl font-black italic uppercase text-white mb-4 px-2 sm:px-0">Mon Musée</h1>
        <div className="grid grid-cols-5 gap-1 pb-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex flex-col items-center justify-center py-2 sm:py-3 rounded-lg outline-none transition-all ${activeTab === tab.id ? 'bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)] relative z-10' : 'bg-gray-900/50 text-gray-400 hover:bg-gray-800 hover:text-white'}`}
            >
              <span className="text-[9px] sm:text-[10px] font-black tracking-wider uppercase mb-1">{tab.label}</span>
              <div className="flex items-baseline gap-1">
                <span className="text-sm sm:text-xl font-black leading-none">{tab.count}</span>
              </div>
            </button>
          ))}
        </div>
        {activeTab !== 'fanz' && (
          <div className="mt-2 sm:mt-4 px-2 sm:px-0">
            <select
              value={filterCollectionFanz}
              onChange={(e) => setFilterCollectionFanz(e.target.value)}
              className="w-full sm:w-auto p-2 bg-[#1a1a2e] border border-white/20 rounded-lg text-white font-bold text-sm"
            >
              <option value="all">Tous les FANZ</option>
              {activeTab === 'cards' || activeTab === 'actions' ? <option value="generic">{activeTab === 'cards' ? 'Cartes Génériques' : 'Actions Génériques'}</option> : null}
              {fanzTemplates.filter(f => f.isActive !== false).map(fanz => (
                <option key={fanz.id} value={fanz.id}>{fanz.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 sm:p-4 lg:p-8 space-y-4 no-scrollbar scroll-smooth">
        {activeTab === 'fanz' && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
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
                <div key={template.id} className={`bg-[#111] rounded-xl overflow-hidden relative flex flex-col transition-all ${!owned ? (isInactive ? 'opacity-50 grayscale' : 'opacity-50 grayscale') : 'outline outline-2 outline-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.2)]'}`}>
                  <div className="aspect-square bg-[#0a0a0a] relative group">
                    {template.video && !user.dataSaver ? (
                      <video src={getImageUrl(template.video)} className={`w-full h-full object-cover ${!owned || isInactive ? 'cursor-default' : 'cursor-pointer'}`} autoPlay={owned && !isInactive} muted loop playsInline data-viewer-enabled="true" data-viewer-ignore={!owned || isInactive ? "true" : undefined} data-viewer-title={template.name} data-viewer-item-type="fanz" data-viewer-description={template.description} data-viewer-metadata={JSON.stringify({ stats: template.baseStats })} />
                    ) : (
                      <img src={getImageUrl(template.image)} alt={template.name} className={`w-full h-full object-cover ${!owned || isInactive ? 'cursor-default' : 'cursor-pointer'}`} data-viewer-enabled="true" data-viewer-ignore={!owned || isInactive ? "true" : undefined} data-viewer-title={template.name} data-viewer-item-type="fanz" data-viewer-description={template.description} data-viewer-metadata={JSON.stringify({ stats: template.baseStats })} data-viewer-video-url={template.video} />
                    )}
                    {owned && !isInactive && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-20">
                        <Maximize2 className="w-8 h-8 text-white drop-shadow-lg" />
                      </div>
                    )}
                    {isInactive && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30">
                        <span className="text-[10px] sm:text-xs text-white font-black uppercase px-2 py-1 bg-black/80 rounded border border-white/20 -rotate-6 shadow-xl tracking-wider text-center">Bientôt dispo</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3 flex flex-col justify-between flex-1">
                    <h3 className="font-bold text-center text-xs md:text-sm leading-tight mb-2">{template.name}</h3>
                    
                    <div className="flex gap-1 justify-center mt-auto flex-wrap">
                      {template.victoryVideoUrl && userDoc?.unlockedVideos?.includes(template.id + '_base_victory') && (
                         <Button size="sm" variant="outline" className="px-1.5 py-1 h-auto text-[9px] sm:text-[10px] uppercase font-black tracking-wider text-green-400 border-green-500/50 hover:bg-green-500/20" onClick={(e) => {
                            e.stopPropagation();
                            openMedia({ type: 'video', url: getImageUrl(template.victoryVideoUrl!), title: template.name + ' - Victoire', itemType: 'fanz' });
                         }}>
                            <PlayCircle className="w-3 h-3 mr-0.5" /> Victoire
                         </Button>
                      )}
                      {template.defeatVideoUrl && userDoc?.unlockedVideos?.includes(template.id + '_base_defeat') && (
                         <Button size="sm" variant="outline" className="px-1.5 py-1 h-auto text-[9px] sm:text-[10px] uppercase font-black tracking-wider text-red-400 border-red-500/50 hover:bg-red-500/20" onClick={(e) => {
                            e.stopPropagation();
                            openMedia({ type: 'video', url: getImageUrl(template.defeatVideoUrl!), title: template.name + ' - Défaite', itemType: 'fanz' });
                         }}>
                            <PlayCircle className="w-3 h-3 mr-0.5" /> Défaite
                         </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'skins' && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
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
                <div key={skin.uniqueId} className={`bg-[#111] rounded-xl overflow-hidden relative flex flex-col ${!owned ? 'opacity-50 grayscale' : 'outline outline-2 outline-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]'}`}>
                  <div className="aspect-square bg-black relative group">
                    {skin.videoUrl && !user.dataSaver ? (
                      <video src={getImageUrl(skin.videoUrl)} className={`w-full h-full object-cover ${!owned ? 'cursor-default' : 'cursor-pointer'}`} autoPlay={owned} muted loop playsInline data-viewer-enabled="true" data-viewer-ignore={!owned ? "true" : undefined} data-viewer-title={skin.name} data-viewer-item-type="skin" />
                    ) : (
                      <img src={getImageUrl(skin.imageUrl)} alt={skin.name} className={`w-full h-full object-cover ${!owned ? 'cursor-default' : 'cursor-pointer'}`} data-viewer-enabled="true" data-viewer-ignore={!owned ? "true" : undefined} data-viewer-title={skin.name} data-viewer-item-type="skin" data-viewer-video-url={skin.videoUrl} />
                    )}
                    {owned && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-20">
                        <Maximize2 className="w-8 h-8 text-white drop-shadow-lg" />
                      </div>
                    )}
                  </div>
                  <div className="p-3 text-center flex flex-col justify-between flex-1">
                     <div>
                       <h3 className="font-bold text-xs sm:text-sm leading-tight text-white mb-0.5">{skin.name}</h3>
                       <p className="text-[9px] sm:text-[10px] text-blue-400 uppercase tracking-wider mb-2">{skin.fanzName}</p>
                     </div>
                     
                     <div className="flex gap-1 justify-center mt-auto flex-wrap">
                       {skin.victoryVideoUrl && userDoc?.unlockedVideos?.includes(skin.id === '000' ? (skin.fanzId + '_base_victory') : (skin.id + '_victory')) && (
                          <Button size="sm" variant="outline" className="px-1.5 py-1 h-auto text-[9px] sm:text-[10px] uppercase font-black tracking-wider text-green-400 border-green-500/50 hover:bg-green-500/20" onClick={(e) => {
                             e.stopPropagation();
                             openMedia({ type: 'video', url: getImageUrl(skin.victoryVideoUrl), title: skin.name + ' - Victoire', itemType: 'skin' });
                          }}>
                             <PlayCircle className="w-3 h-3 mr-0.5" /> Victoire
                          </Button>
                       )}
                       {skin.defeatVideoUrl && userDoc?.unlockedVideos?.includes(skin.id === '000' ? (skin.fanzId + '_base_defeat') : (skin.id + '_defeat')) && (
                          <Button size="sm" variant="outline" className="px-1.5 py-1 h-auto text-[9px] sm:text-[10px] uppercase font-black tracking-wider text-red-400 border-red-500/50 hover:bg-red-500/20" onClick={(e) => {
                             e.stopPropagation();
                             openMedia({ type: 'video', url: getImageUrl(skin.defeatVideoUrl), title: skin.name + ' - Défaite', itemType: 'skin' });
                          }}>
                             <PlayCircle className="w-3 h-3 mr-0.5" /> Défaite
                          </Button>
                       )}
                     </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'emotes' && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4">
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
                <div key={emote.uniqueId} className={`bg-[#111] rounded-xl overflow-hidden relative flex flex-col ${!owned ? 'opacity-50 grayscale' : 'outline outline-2 outline-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]'}`}>
                  <div className="aspect-square bg-black relative group flex items-center justify-center">
                    {emote.videoUrl && !user.dataSaver ? (
                      <video src={getImageUrl(emote.videoUrl)} className={`w-full h-full object-cover ${!owned ? 'cursor-default' : 'cursor-pointer'}`} autoPlay={owned} muted loop playsInline data-viewer-enabled="true" data-viewer-ignore={!owned ? "true" : undefined} data-viewer-title={emote.name} data-viewer-item-type="emote" />
                    ) : (
                      <img src={getImageUrl(emote.imageUrl)} alt={emote.name} className={`w-full h-full object-cover ${!owned ? 'cursor-default' : 'cursor-pointer'}`} data-viewer-enabled="true" data-viewer-ignore={!owned ? "true" : undefined} data-viewer-title={emote.name} data-viewer-item-type="emote" data-viewer-video-url={emote.videoUrl} />
                    )}
                    {owned && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-20">
                        <Maximize2 className="w-6 h-6 text-white drop-shadow-md" />
                      </div>
                    )}
                  </div>
                  <div className="p-2 bg-[#111] flex flex-col items-center justify-center text-center">
                    <h3 className="font-bold text-[10px] sm:text-xs uppercase truncate w-full text-gray-200">{emote.name}</h3>
                    <p className="text-[8px] text-purple-400 mt-0.5 uppercase tracking-wider">{emote.fanzName}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'cards' && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4">
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
                  let names = card.fanzIds.map(id => {
                    const fanz = fanzTemplates.find(f => f.id === id);
                    return fanz ? fanz.name : id;
                  }).join(', ');
                  if (card.skinId && card.fanzIds.length === 1) {
                     const fanz = fanzTemplates.find(f => f.id === card.fanzIds![0]);
                     const skin = fanz?.skins?.find(s => s.id === card.skinId);
                     if (skin) {
                       names += ` - ${skin.name}`;
                     }
                  }
                  return names;
                };
                const aFanzName = getFanzName(a);
                const bFanzName = getFanzName(b);
                if (aFanzName !== bFanzName) return aFanzName.localeCompare(bFanzName);
                return a.name.localeCompare(b.name);
              })
              .map(card => {
              const owned = checkCardOwned(card);
              return (
                <div key={card.id} className={`aspect-[3/4] rounded-xl overflow-hidden relative flex flex-col group ${!owned ? 'bg-[#111] opacity-50 grayscale' : 'bg-[#111] outline outline-2 outline-white/20 hover:outline-white/50 shadow-md'}`}>
                  {card.videoUrl && !user.dataSaver ? (
                     <video src={getImageUrl(card.videoUrl)} className={`w-full h-full object-cover ${!owned ? 'cursor-default' : 'cursor-pointer hover:scale-105 transition-transform duration-500'}`} autoPlay={owned} muted loop playsInline data-viewer-enabled="true" data-viewer-ignore={!owned ? "true" : undefined} data-viewer-title={card.name} data-viewer-item-type="card" data-viewer-metadata={JSON.stringify({ energyCost: card.energyCost, fervorValue: card.fervorValue, rarity: card.rarity })} />
                  ) : (
                     <img src={getImageUrl(card.imageUrl)} alt={card.name} className={`w-full h-full object-cover ${!owned ? 'cursor-default' : 'cursor-pointer hover:scale-105 transition-transform duration-500'}`} data-viewer-enabled="true" data-viewer-ignore={!owned ? "true" : undefined} data-viewer-title={card.name} data-viewer-item-type="card" data-viewer-metadata={JSON.stringify({ energyCost: card.energyCost, fervorValue: card.fervorValue, rarity: card.rarity })} data-viewer-video-url={card.videoUrl} />
                  )}
                  {owned && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-20">
                      <Maximize2 className="w-8 h-8 text-white drop-shadow-lg" />
                    </div>
                  )}
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent pt-1 pb-3 px-1 pointer-events-none z-10 flex flex-col items-center">
                     {(() => {
                        if (!card.fanzIds || card.fanzIds.length === 0) return <span className="text-[8px] text-blue-300 font-bold uppercase tracking-wide drop-shadow-md bg-black/40 px-1 py-0.5 rounded">Générique</span>;
                        let names = card.fanzIds.map(id => {
                          const fanz = fanzTemplates.find(f => f.id === id);
                          return fanz ? fanz.name : id;
                        }).join(', ');
                        if (card.skinId && card.fanzIds.length === 1) {
                          const fanz = fanzTemplates.find(f => f.id === card.fanzIds![0]);
                          const skin = fanz?.skins?.find(s => s.id === card.skinId);
                          if (skin) {
                            names += ` - ${skin.name}`;
                          }
                        }
                        return <span className="text-[8px] text-blue-300 font-bold uppercase tracking-wide drop-shadow-md text-center line-clamp-2 bg-black/40 px-1 pt-0.5 rounded">{names}</span>;
                     })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'actions' && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
            {expandedActions
              .filter(a => {
                if (filterCollectionFanz === 'all') return true;
                if (filterCollectionFanz === 'generic') return !a.fanzTemplateId;
                return a.fanzTemplateId === filterCollectionFanz;
              })
              .sort((a, b) => {
                const aOwnedAction = ownedActions.has(a.id);
                const aOwnedSkin = !a.associatedSkinId || ownedSkins.has(`${a.fanzTemplateId}-${a.associatedSkinId}`);
                const aOwned = aOwnedAction && aOwnedSkin;

                const bOwnedAction = ownedActions.has(b.id);
                const bOwnedSkin = !b.associatedSkinId || ownedSkins.has(`${b.fanzTemplateId}-${b.associatedSkinId}`);
                const bOwned = bOwnedAction && bOwnedSkin;

                if (aOwned !== bOwned) return aOwned ? -1 : 1;
                
                const getFanzName = (action: any) => {
                  if (!action.fanzTemplateId) return 'zzz_générique';
                  return action.fanzSkinName || action.fanzTemplateId;
                };
                const aFanzName = getFanzName(a);
                const bFanzName = getFanzName(b);
                if (aFanzName !== bFanzName) return aFanzName.localeCompare(bFanzName);
                if (a.name !== b.name) return a.name.localeCompare(b.name);
                return (a.associatedSkinId || '').localeCompare(b.associatedSkinId || '');
              })
              .map(action => {
              const ownedAction = ownedActions.has(action.id);
              const ownedSkin = !action.associatedSkinId || ownedSkins.has(`${action.fanzTemplateId}-${action.associatedSkinId}`);
              const owned = ownedAction && ownedSkin;

              return (
                <div key={action.uniqueItemKey} className={`bg-[#111] rounded-xl overflow-hidden relative flex flex-col ${!owned ? 'opacity-50 grayscale' : 'outline outline-2 outline-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.2)]'}`}>
                  <div className="aspect-square bg-black relative group">
                    {action.videoUrl && !user.dataSaver ? (
                       <video src={getImageUrl(action.videoUrl)} className={`w-full h-full object-cover ${!owned ? 'cursor-default' : 'cursor-pointer'}`} autoPlay={owned} muted loop playsInline data-viewer-enabled="true" data-viewer-ignore={!owned ? "true" : undefined} data-viewer-title={`${action.name} ${action.associatedSkinId && action.associatedSkinId !== '000' ? `(${action.fanzSkinName})` : ''}`} data-viewer-item-type="life_action" data-viewer-metadata={JSON.stringify({ xpReward: action.xpGain })} />
                    ) : action.image ? (
                       <img src={getImageUrl(action.image)} alt={action.name} className={`w-full h-full object-cover ${!owned ? 'cursor-default' : 'cursor-pointer'}`} data-viewer-enabled="true" data-viewer-ignore={!owned ? "true" : undefined} data-viewer-title={`${action.name} ${action.associatedSkinId && action.associatedSkinId !== '000' ? `(${action.fanzSkinName})` : ''}`} data-viewer-item-type="life_action" data-viewer-metadata={JSON.stringify({ xpReward: action.xpGain })} data-viewer-video-url={action.videoUrl} />
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
                  <div className="p-2 sm:p-3 bg-[#111] flex-1 flex flex-col items-center justify-center text-center">
                    <h3 className="font-bold text-[10px] sm:text-xs leading-tight mb-0.5">{action.name}</h3>
                    {(() => {
                        return <p className="text-[8px] sm:text-[9px] text-blue-400 uppercase tracking-wider">{action.fanzSkinName || 'Générique'}</p>;
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
