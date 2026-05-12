import React, { useState } from 'react';
import { FanzTemplate, FanzSkin, FanzEmote, FerveurLevel, LifeAction, Card as DuelCard, FervorRangeConfig } from '../types';
import { Button } from './ui/button';
import { Plus, Trash2, Copy } from 'lucide-react';
import { getImageUrl } from '../lib/utils';
import { RewardSelector } from './RewardSelector';

interface FanzSkinsTableProps {
  skins: FanzSkin[];
  onChange: (skins: FanzSkin[]) => void;
  lifeActions: LifeAction[];
  duelCards: DuelCard[];
  fanzId: string;
}

export const FanzSkinsTable: React.FC<FanzSkinsTableProps> = ({ skins, onChange, lifeActions, duelCards, fanzId }) => {
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  };

  const skinsWithOriginalIndex = skins.map((skin, originalIdx) => ({ skin, originalIdx }));

  const sortedSkinsObjects = React.useMemo(() => {
    let sortableItems = [...skinsWithOriginalIndex];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const valA = getNestedValue(a.skin, sortConfig.key);
        const valB = getNestedValue(b.skin, sortConfig.key);

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [skins, sortConfig]);

  const updateSkin = (originalIdx: number, updates: Partial<FanzSkin>) => {
    const newSkins = [...skins];
    newSkins[originalIdx] = { ...newSkins[originalIdx], ...updates };
    onChange(newSkins);
  };

  const updateNestedSkin = (originalIdx: number, field: string, subField: string, value: any) => {
    const newSkins = [...skins];
    const skin = newSkins[originalIdx];
    if (!skin[field as keyof FanzSkin]) {
      (skin as any)[field] = {};
    }
    if (value === null || value === undefined) {
       delete (skin as any)[field][subField];
    } else {
       (skin as any)[field][subField] = value;
    }
    onChange(newSkins);
  };

  const renderSortHeader = (label: string, key: string, classes: string = "") => (
    <th className={`p-2 border border-gray-700 cursor-pointer hover:bg-gray-700 ${classes}`} onClick={() => handleSort(key)}>
      <div className="flex items-center gap-1 justify-between">
        {label}
        {sortConfig?.key === key ? (
          <span className="text-[10px] text-gray-300">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
        ) : (
          <span className="text-[10px] text-transparent hover:text-gray-500">▲</span>
        )}
      </div>
    </th>
  );

  return (
    <div className="w-full overflow-x-auto bg-gray-900 border border-gray-800 rounded-xl">
      <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
        <thead className="bg-gray-800 text-gray-400">
          <tr>
            <th className="p-2 border border-gray-700 sticky left-0 z-20 bg-gray-800 min-w-[70px]">Actions</th>
            {renderSortHeader("Actif", "isActive", "sticky left-[70px] z-20 bg-gray-800")}
            {renderSortHeader("Nom", "name")}
            {renderSortHeader("ID", "id")}
            <th className="p-2 border border-gray-700">Image URL</th>
            <th className="p-2 border border-gray-700">Video Menu URL</th>
            <th className="p-2 border border-gray-700 bg-green-900/30">Vidéo Victoire URL</th>
            <th className="p-2 border border-gray-700 bg-red-900/30">Vidéo Défaite URL</th>
            {renderSortHeader("Catégorie", "category")}
            {renderSortHeader("Rareté", "rarity")}
            {renderSortHeader("Argent", "price.money", "text-yellow-500")}
            {renderSortHeader("Gemmes", "price.gems", "text-purple-400")}
            {renderSortHeader("Boost", "price.boostPoints", "text-blue-400")}
            <th className="p-2 border border-gray-700 bg-gray-800">Stats Bonus (Force, Mental, Int, Crea, Bluff, Soc, Char, End)</th>
            <th className="p-2 border border-gray-700 bg-gray-800">Avantages (Energie, Ferv[M], Arg[M], Gem[M], Foo[M])</th>
            <th className="p-2 border border-gray-700 bg-gray-800">Réductions (Ene, Arg, Gem, Foo)</th>
            {renderSortHeader("Action Spéciale", "specialActionId")}
            {renderSortHeader("Carte Spéciale", "specialCardId")}
          </tr>
        </thead>
        <tbody>
          {sortedSkinsObjects.map(({ skin, originalIdx }) => (
            <tr key={originalIdx} className="hover:bg-gray-800/50">
              <td className="p-2 border border-gray-800 sticky left-0 z-10 bg-gray-900">
                <div className="flex gap-1" title={originalIdx.toString()}>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-blue-400" onClick={() => {
                    const newSkin = { ...skin, id: `${skin.id}-copy-${Date.now()}`, name: `${skin.name} (Copie)` };
                    onChange([...skins.slice(0, originalIdx+1), newSkin, ...skins.slice(originalIdx+1)]);
                  }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => {
                    onChange(skins.filter((_, i) => i !== originalIdx));
                  }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </td>
              <td className="p-2 border border-gray-800 sticky left-[70px] z-10 bg-gray-900 text-center">
                <input type="checkbox" checked={skin.isActive !== false} onChange={(e) => updateSkin(originalIdx, { isActive: e.target.checked })} />
              </td>
              <td className="p-2 border border-gray-800">
                <input type="text" className="w-32 bg-transparent border-b border-gray-700 focus:border-orange-500 outline-none" value={skin.name} onChange={(e) => updateSkin(originalIdx, { name: e.target.value })} />
              </td>
              <td className="p-2 border border-gray-800">
                <input type="text" className="w-32 bg-transparent border-b border-gray-700 focus:border-orange-500 outline-none" value={skin.id} onChange={(e) => updateSkin(originalIdx, { id: e.target.value })} />
              </td>
              <td className="p-2 border border-gray-800">
                <input type="text" className="w-40 bg-transparent border-b border-gray-700 focus:border-orange-500 outline-none" value={skin.imageUrl} onChange={(e) => updateSkin(originalIdx, { imageUrl: e.target.value })} />
              </td>
              <td className="p-2 border border-gray-800">
                <input type="text" className="w-40 bg-transparent border-b border-gray-700 focus:border-orange-500 outline-none" value={skin.videoUrl || ''} onChange={(e) => updateSkin(originalIdx, { videoUrl: e.target.value })} />
              </td>
              <td className="p-2 border border-gray-800 bg-green-900/10">
                <input type="text" className="w-40 bg-transparent border-b border-gray-700 focus:border-green-500 outline-none" value={skin.victoryVideoUrl || ''} onChange={(e) => updateSkin(originalIdx, { victoryVideoUrl: e.target.value })} />
              </td>
              <td className="p-2 border border-gray-800 bg-red-900/10">
                <input type="text" className="w-40 bg-transparent border-b border-gray-700 focus:border-red-500 outline-none" value={skin.defeatVideoUrl || ''} onChange={(e) => updateSkin(originalIdx, { defeatVideoUrl: e.target.value })} />
              </td>
              <td className="p-2 border border-gray-800">
                <select className="bg-transparent [&>option]:bg-gray-900 [&>option]:text-white border-b border-gray-700 focus:border-orange-500 outline-none" value={skin.category || 'base'} onChange={(e) => updateSkin(originalIdx, { category: e.target.value as 'base' | 'event' })}>
                  <option value="base">Permanent (Base)</option>
                  <option value="event">Événementiel (Event)</option>
                </select>
              </td>
              <td className="p-2 border border-gray-800">
                <select className="bg-transparent [&>option]:bg-gray-900 [&>option]:text-white border-b border-gray-700 focus:border-orange-500 outline-none" value={skin.rarity || 'common'} onChange={(e) => updateSkin(originalIdx, { rarity: e.target.value as 'common' | 'rare' | 'epic' | 'legendary' })}>
                  <option value="common">Commune</option>
                  <option value="rare">Rare</option>
                  <option value="epic">Épique</option>
                  <option value="legendary">Légendaire</option>
                </select>
              </td>
              <td className="p-2 border border-gray-800">
                <input type="number" className="w-16 bg-transparent border-b border-gray-700 focus:border-orange-500 outline-none text-right" value={skin.price?.money || 0} onChange={(e) => updateNestedSkin(originalIdx, 'price', 'money', Number(e.target.value))} />
              </td>
              <td className="p-2 border border-gray-800">
                <input type="number" className="w-16 bg-transparent border-b border-gray-700 focus:border-orange-500 outline-none text-right" value={skin.price?.gems || 0} onChange={(e) => updateNestedSkin(originalIdx, 'price', 'gems', Number(e.target.value))} />
              </td>
              <td className="p-2 border border-gray-800">
                <input type="number" className="w-16 bg-transparent border-b border-gray-700 focus:border-orange-500 outline-none text-right" value={skin.price?.boostPoints || 0} onChange={(e) => updateNestedSkin(originalIdx, 'price', 'boostPoints', Number(e.target.value))} />
              </td>
              <td className="p-2 border border-gray-800 bg-gray-800/30">
                <div className="flex gap-2">
                  {['force', 'mental', 'intelligence', 'creativity', 'bluff', 'social', 'charisma', 'endurance'].map(s => (
                    <input key={s} type="number" title={s} className="w-12 bg-gray-900 border border-gray-700 rounded text-center" value={skin.statsBonus?.[s as keyof typeof skin.statsBonus] || 0} onChange={(e) => updateNestedSkin(originalIdx, 'statsBonus', s, Number(e.target.value))} />
                  ))}
                </div>
              </td>
              <td className="p-2 border border-gray-800 bg-gray-800/30">
                <div className="flex gap-2">
                   <input type="number" title="Énergie" className="w-12 bg-gray-900 border border-gray-700 rounded text-center text-blue-300" value={skin.energyBonus || 0} onChange={(e) => updateSkin(originalIdx, { energyBonus: Number(e.target.value) })} />
                   <input type="number" title="Ferveur %" className="w-12 bg-gray-900 border border-gray-700 rounded text-center text-orange-300" value={skin.fervorBonus || 0} onChange={(e) => updateSkin(originalIdx, { fervorBonus: Number(e.target.value) })} />
                   <input type="number" title="Argent %" className="w-12 bg-gray-900 border border-gray-700 rounded text-center text-yellow-300" value={skin.moneyBonus || 0} onChange={(e) => updateSkin(originalIdx, { moneyBonus: Number(e.target.value) })} />
                   <input type="number" title="Gemmes %" className="w-12 bg-gray-900 border border-gray-700 rounded text-center text-purple-300" value={skin.gemsBonus || 0} onChange={(e) => updateSkin(originalIdx, { gemsBonus: Number(e.target.value) })} />
                   <input type="number" title="Boost %" className="w-12 bg-gray-900 border border-gray-700 rounded text-center text-green-300" value={skin.boostBonus || 0} onChange={(e) => updateSkin(originalIdx, { boostBonus: Number(e.target.value) })} />
                </div>
              </td>
              <td className="p-2 border border-gray-800 bg-gray-800/30">
                <div className="flex gap-2">
                   <input type="number" title="Reduc Énergie %" className="w-12 bg-gray-900 border border-gray-700 rounded text-center text-blue-300" value={skin.energyCostReduction || 0} onChange={(e) => updateSkin(originalIdx, { energyCostReduction: Number(e.target.value) })} />
                   <input type="number" title="Reduc Monnaie %" className="w-12 bg-gray-900 border border-gray-700 rounded text-center text-yellow-300" value={skin.moneyCostReduction || 0} onChange={(e) => updateSkin(originalIdx, { moneyCostReduction: Number(e.target.value) })} />
                   <input type="number" title="Reduc Gemmes %" className="w-12 bg-gray-900 border border-gray-700 rounded text-center text-purple-300" value={skin.gemsCostReduction || 0} onChange={(e) => updateSkin(originalIdx, { gemsCostReduction: Number(e.target.value) })} />
                   <input type="number" title="Reduc Boost %" className="w-12 bg-gray-900 border border-gray-700 rounded text-center text-green-300" value={skin.boostCostReduction || 0} onChange={(e) => updateSkin(originalIdx, { boostCostReduction: Number(e.target.value) })} />
                </div>
              </td>
              <td className="p-2 border border-gray-800">
                <select className="bg-transparent [&>option]:bg-gray-900 [&>option]:text-white w-32 border-b border-gray-700 focus:border-orange-500 outline-none truncate" value={skin.specialActionId || ''} onChange={(e) => updateSkin(originalIdx, { specialActionId: e.target.value || undefined })}>
                  <option value="">-- Aucune action --</option>
                  {lifeActions.filter(a => a.fanzTemplateId === fanzId).map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                {lifeActions.filter(a => a.skinId === skin.id).length > 0 && (
                  <div className="mt-1 text-[9px] text-gray-400">
                    <div>Liées spécifiquement :</div>
                    <ul className="list-disc list-inside">
                      {lifeActions.filter(a => a.skinId === skin.id).map(a => (
                        <li key={a.id}>{a.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </td>
              <td className="p-2 border border-gray-800">
                <select className="bg-transparent [&>option]:bg-gray-900 [&>option]:text-white w-32 border-b border-gray-700 focus:border-orange-500 outline-none truncate" value={skin.specialCardId || ''} onChange={(e) => updateSkin(originalIdx, { specialCardId: e.target.value || undefined })}>
                  <option value="">-- Aucune carte --</option>
                  {duelCards.filter((c: any) => c.fanzIds?.includes(fanzId)).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {duelCards.filter((c: any) => c.skinId === skin.id).length > 0 && (
                  <div className="mt-1 text-[9px] text-gray-400">
                    <div>Liées spécifiquement :</div>
                    <ul className="list-disc list-inside">
                      {duelCards.filter((c: any) => c.skinId === skin.id).map((c: any) => (
                        <li key={c.id}>{c.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-2 bg-gray-800/50">
        <Button size="sm" type="button" onClick={() => {
           onChange([...skins, { id: `${fanzId}_skin-${Date.now()}`, fanzId, name: 'Nouveau Skin', imageUrl: '', videoUrl: '', price: { money: 100 } }]);
        }}>
           <Plus className="min-w-4 w-4 h-4 mr-2" /> Ajouter Ligne
        </Button>
      </div>
    </div>
  );
};

interface FanzEmotesTableProps {
  emotes: FanzEmote[];
  onChange: (emotes: FanzEmote[]) => void;
  fanzId: string;
}

export const FanzEmotesTable: React.FC<FanzEmotesTableProps> = ({ emotes, onChange, fanzId }) => {
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  };

  const emotesWithOriginalIndex = emotes.map((emote, originalIdx) => ({ emote, originalIdx }));

  const sortedEmotesObjects = React.useMemo(() => {
    let sortableItems = [...emotesWithOriginalIndex];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const valA = getNestedValue(a.emote, sortConfig.key);
        const valB = getNestedValue(b.emote, sortConfig.key);

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [emotes, sortConfig]);

  const updateEmote = (originalIdx: number, updates: Partial<FanzEmote>) => {
    const newEmotes = [...emotes];
    newEmotes[originalIdx] = { ...newEmotes[originalIdx], ...updates };
    onChange(newEmotes);
  };

  const updateNestedEmote = (originalIdx: number, field: string, subField: string, value: any) => {
    const newEmotes = [...emotes];
    const emote = newEmotes[originalIdx];
    if (!emote[field as keyof FanzEmote]) {
      (emote as any)[field] = {};
    }
    if (value === null || value === undefined) {
       delete (emote as any)[field][subField];
    } else {
       (emote as any)[field][subField] = value;
    }
    onChange(newEmotes);
  };

  const renderSortHeader = (label: string, key: string, classes: string = "") => (
    <th className={`p-2 border border-gray-700 cursor-pointer hover:bg-gray-700 ${classes}`} onClick={() => handleSort(key)}>
      <div className="flex items-center gap-1 justify-between">
        {label}
        {sortConfig?.key === key ? (
          <span className="text-[10px] text-gray-300">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
        ) : (
          <span className="text-[10px] text-transparent hover:text-gray-500">▲</span>
        )}
      </div>
    </th>
  );

  return (
    <div className="w-full overflow-x-auto bg-gray-900 border border-gray-800 rounded-xl">
      <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
        <thead className="bg-gray-800 text-gray-400">
          <tr>
            <th className="p-2 border border-gray-700 sticky left-0 z-20 bg-gray-800 min-w-[70px]">Actions</th>
            {renderSortHeader("Actif", "isActive", "sticky left-[70px] z-20 bg-gray-800")}
            {renderSortHeader("Nom", "name")}
            {renderSortHeader("ID", "id")}
            <th className="p-2 border border-gray-700">Image URL</th>
            <th className="p-2 border border-gray-700">Video URL</th>
            {renderSortHeader("Catégorie", "category")}
            {renderSortHeader("Argent", "price.money", "text-yellow-500")}
            {renderSortHeader("Gemmes", "price.gems", "text-purple-400")}
            {renderSortHeader("Boost", "price.boostPoints", "text-blue-400")}
          </tr>
        </thead>
        <tbody>
          {sortedEmotesObjects.map(({ emote, originalIdx }) => (
            <tr key={originalIdx} className="hover:bg-gray-800/50">
              <td className="p-2 border border-gray-800 sticky left-0 z-10 bg-gray-900">
                <div className="flex gap-1" title={originalIdx.toString()}>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-blue-400" onClick={() => {
                    const newEmote = { ...emote, id: `${emote.id}-copy-${Date.now()}`, name: `${emote.name} (Copie)` };
                    onChange([...emotes.slice(0, originalIdx+1), newEmote, ...emotes.slice(originalIdx+1)]);
                  }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => {
                    onChange(emotes.filter((_, i) => i !== originalIdx));
                  }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </td>
              <td className="p-2 border border-gray-800 sticky left-[70px] z-10 bg-gray-900 text-center">
                <input type="checkbox" checked={emote.isActive !== false} onChange={(e) => updateEmote(originalIdx, { isActive: e.target.checked })} />
              </td>
              <td className="p-2 border border-gray-800">
                <input type="text" className="w-32 bg-transparent border-b border-gray-700 focus:border-orange-500 outline-none" value={emote.name} onChange={(e) => updateEmote(originalIdx, { name: e.target.value })} />
              </td>
              <td className="p-2 border border-gray-800">
                <input type="text" className="w-32 bg-transparent border-b border-gray-700 focus:border-orange-500 outline-none" value={emote.id} onChange={(e) => updateEmote(originalIdx, { id: e.target.value })} />
              </td>
              <td className="p-2 border border-gray-800">
                <input type="text" className="w-40 bg-transparent border-b border-gray-700 focus:border-orange-500 outline-none" value={emote.imageUrl} onChange={(e) => updateEmote(originalIdx, { imageUrl: e.target.value })} />
              </td>
              <td className="p-2 border border-gray-800">
                <input type="text" className="w-40 bg-transparent border-b border-gray-700 focus:border-orange-500 outline-none" value={emote.videoUrl || ''} onChange={(e) => updateEmote(originalIdx, { videoUrl: e.target.value })} />
              </td>
              <td className="p-2 border border-gray-800">
                <select className="bg-transparent [&>option]:bg-gray-900 [&>option]:text-white border-b border-gray-700 focus:border-orange-500 outline-none" value={emote.category || 'base'} onChange={(e) => updateEmote(originalIdx, { category: e.target.value as 'base' | 'event' })}>
                  <option value="base">Permanent (Base)</option>
                  <option value="event">Événementiel (Event)</option>
                </select>
              </td>
              <td className="p-2 border border-gray-800">
                <input type="number" className="w-16 bg-transparent border-b border-gray-700 focus:border-orange-500 outline-none text-right" value={emote.price?.money || 0} onChange={(e) => updateNestedEmote(originalIdx, 'price', 'money', Number(e.target.value))} />
              </td>
              <td className="p-2 border border-gray-800">
                <input type="number" className="w-16 bg-transparent border-b border-gray-700 focus:border-orange-500 outline-none text-right" value={emote.price?.gems || 0} onChange={(e) => updateNestedEmote(originalIdx, 'price', 'gems', Number(e.target.value))} />
              </td>
              <td className="p-2 border border-gray-800">
                <input type="number" className="w-16 bg-transparent border-b border-gray-700 focus:border-orange-500 outline-none text-right" value={emote.price?.boostPoints || 0} onChange={(e) => updateNestedEmote(originalIdx, 'price', 'boostPoints', Number(e.target.value))} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-2 bg-gray-800/50">
        <Button size="sm" type="button" onClick={() => {
           onChange([...emotes, { id: `${fanzId}_emote-${Date.now()}`, fanzId, name: 'Nouvelle Emote', imageUrl: '', videoUrl: '', price: { money: 100 } }]);
        }}>
           <Plus className="min-w-4 w-4 h-4 mr-2" /> Ajouter Ligne
        </Button>
      </div>
    </div>
  );
};

interface FanzFerveurTableProps {
  ranges: FervorRangeConfig[];
  onChange: (ranges: FervorRangeConfig[]) => void;
  fanzId: string;
  fanzTemplates?: any[];
  lifeActions?: any[];
  duelCards?: any[];
}

export const FanzFerveurTable: React.FC<FanzFerveurTableProps> = ({ ranges, onChange, fanzId, fanzTemplates = [], lifeActions = [], duelCards = [] }) => {
  const updateRange = (idx: number, updates: Partial<FervorRangeConfig>) => {
    const newRanges = [...ranges];
    newRanges[idx] = { ...newRanges[idx], ...updates };
    onChange(newRanges);
  };

  const updateLevelReward = (idx: number, reward: any) => {
    const newRanges = [...ranges];
    newRanges[idx] = { ...newRanges[idx], levelReward: reward };
    onChange(newRanges);
  }

  const updateIntermediateReward = (idx: number, reward: any) => {
    const newRanges = [...ranges];
    newRanges[idx] = { ...newRanges[idx], intermediateReward: reward };
    onChange(newRanges);
  }

  return (
    <div className="w-full overflow-x-auto bg-gray-900 border border-gray-800 rounded-xl">
      <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
        <thead className="bg-gray-800 text-gray-400">
          <tr>
            <th className="p-2 border border-gray-700 sticky left-0 z-20 bg-gray-800 w-[100px]">Actions</th>
            <th className="p-2 border border-gray-700">Niveau</th>
            <th className="p-2 border border-gray-700 text-orange-400">Min</th>
            <th className="p-2 border border-gray-700 text-orange-500">Max</th>
            <th className="p-2 border border-gray-700">Pas (Step)</th>
            <th className="p-2 border border-gray-700 w-48">Récompense Principale (Fin de Palier)</th>
            <th className="p-2 border border-gray-700 w-48 text-gray-500">Récompense Interm. (Par Pas)</th>
          </tr>
        </thead>
        <tbody>
          {ranges.map((range, idx) => (
            <tr key={idx} className="hover:bg-gray-800/50">
              <td className="p-2 border border-gray-800 sticky left-0 z-10 bg-gray-900">
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-blue-400" onClick={() => {
                    const newRange = { ...range, level: ranges.length + 1 };
                    onChange([...ranges.slice(0, idx+1), newRange, ...ranges.slice(idx+1)]);
                  }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => {
                    onChange(ranges.filter((_, i) => i !== idx));
                  }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </td>
              <td className="p-2 border border-gray-800 font-bold text-center">
                <input type="number" className="w-16 bg-transparent border-b border-gray-700 focus:border-orange-500 outline-none text-center" value={range.level || idx+1} onChange={(e) => updateRange(idx, { level: Number(e.target.value) })} />
              </td>
              <td className="p-2 border border-gray-800">
                <input type="number" className="w-20 bg-transparent border-b border-gray-700 focus:border-orange-500 outline-none text-right" value={range.min || 0} onChange={(e) => updateRange(idx, { min: Number(e.target.value) })} />
              </td>
              <td className="p-2 border border-gray-800">
                <input type="number" className="w-20 bg-transparent border-b border-gray-700 focus:border-orange-500 outline-none text-right" value={range.max || 0} onChange={(e) => updateRange(idx, { max: Number(e.target.value) })} />
              </td>
              <td className="p-2 border border-gray-800">
                <input type="number" className="w-20 bg-transparent border-b border-gray-700 focus:border-orange-500 outline-none text-right" value={range.step || 0} onChange={(e) => updateRange(idx, { step: Number(e.target.value) })} />
              </td>
              
               <td className="p-2 border border-gray-800">
                  <RewardSelector
                    reward={range.levelReward}
                    onChange={(r) => updateLevelReward(idx, r)}
                    fanzTemplates={fanzTemplates}
                    lifeActions={lifeActions}
                    duelCards={duelCards}
                    isFanzContext={true}
                    currentFanzId={fanzId}
                  />
               </td>
               <td className="p-2 border border-gray-800 bg-gray-800/30">
                  <RewardSelector
                    reward={range.intermediateReward}
                    onChange={(r) => updateIntermediateReward(idx, r)}
                    fanzTemplates={fanzTemplates}
                    lifeActions={lifeActions}
                    duelCards={duelCards}
                    isFanzContext={true}
                    currentFanzId={fanzId}
                  />
               </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-2 bg-gray-800/50">
        <Button size="sm" type="button" onClick={() => {
           onChange([...ranges, { level: ranges.length + 1, min: ranges.length > 0 ? (ranges[ranges.length-1].max || 0) + 1 : 0, max: ranges.length > 0 ? (ranges[ranges.length-1].max || 0) + 1000 : 999, step: 200, levelReward: { type: 'money', amount: 100 }, intermediateReward: { type: 'money', amount: 50 } }]);
        }}>
           <Plus className="min-w-4 w-4 h-4 mr-2" /> Ajouter Ligne
        </Button>
      </div>
    </div>
  );
};
