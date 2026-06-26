import React, { useState, useEffect } from 'react';
import { LifeAction } from '../types';
import { getImageUrl } from '../lib/utils';
import { Trash2, Save, Copy, Activity } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Button } from './Layout';

const renderTrans = (field: any, preferredLang: string = 'fr'): string => {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (typeof field === 'object') {
    return field[preferredLang] || field['fr'] || field['en'] || field['es'] || Object.values(field)[0] || '';
  }
  return String(field);
};

export function AdminLifeActionRow({ action, onSaved, onDeleted, fanzTemplates }: { action: LifeAction, onSaved: () => void, onDeleted: () => void, fanzTemplates: any[] }) {
  const [localAction, setLocalAction] = useState<LifeAction>({ ...action });
  const [isDirty, setIsDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showOverrides, setShowOverrides] = useState(false);
  const [editLang, setEditLang] = useState<'fr' | 'en' | 'es'>('fr');

  const getTranslationValue = (field: any, lang: string): string => {
    if (!field) return '';
    if (typeof field === 'string') {
      return lang === 'fr' ? field : '';
    }
    return field[lang] || '';
  };

  const setTranslationValue = (field: any, lang: string, value: string) => {
    if (!field || typeof field === 'string') {
      const frVal = typeof field === 'string' ? field : '';
      return { fr: frVal, en: '', es: '', [lang]: value };
    }
    return { ...field, [lang]: value };
  };

  useEffect(() => {
    setLocalAction({ ...action });
    setIsDirty(false);
  }, [action]);

  const handleChange = (field: string, value: any) => {
    setLocalAction(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleOverrideChange = (skinId: string, field: string, value: string) => {
    setLocalAction(prev => {
      const overrides = { ...(prev.skinOverrides || {}) };
      if (!overrides[skinId]) overrides[skinId] = {};
      overrides[skinId] = { ...overrides[skinId], [field]: value };
      return { ...prev, skinOverrides: overrides };
    });
    setIsDirty(true);
  };

  return (
    <>
    <tr className={`hover:bg-white/5 transition-colors group ${isDirty ? 'bg-orange-500/5' : ''}`}>
      <td className="px-2 py-2 align-middle border-b border-white/5">
        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Image / URL Vidéo</label>
        <div className="flex flex-col gap-1 items-center relative">
            <div className="w-12 h-12 rounded overflow-hidden bg-black/40 border border-white/10 shrink-0 mb-1">
               {localAction.videoUrl ? (
                 <video src={getImageUrl(localAction.videoUrl)} className="w-full h-full object-cover" autoPlay muted loop playsInline />
               ) : localAction.image ? (
                 <img src={getImageUrl(localAction.image)} alt={getTranslationValue(localAction.name, 'fr')} className="w-full h-full object-cover" />
               ) : (
                 <div className="w-full h-full flex items-center justify-center"><Activity className="w-6 h-6 text-gray-400" /></div>
               )}
            </div>
            <input title="Image URL" type="text" value={localAction.image || ''} onChange={e => handleChange('image', e.target.value)} className="w-24 text-[10px] p-1 bg-black text-white rounded border border-white/10" placeholder="Img URL" />
            <input title="Video URL" type="text" value={localAction.videoUrl || ''} onChange={e => handleChange('videoUrl', e.target.value)} className="w-24 text-[10px] p-1 bg-black text-white rounded border border-white/10" placeholder="Vid URL" />
            {localAction.fanzTemplateId && (
               <button onClick={() => setShowOverrides(!showOverrides)} className={`text-[9px] w-24 p-1 rounded font-bold uppercase ${showOverrides ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 border border-white/10'}`}>Skins Overrides</button>
            )}
        </div>
      </td>
      <td className="px-2 py-2 align-middle border-b border-white/5 min-w-[150px]">
        <div className="flex justify-between items-center mb-1">
          <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500">Nom de l'action / ID</label>
          <div className="flex gap-1 bg-white/5 p-0.5 rounded border border-white/10 text-[9px]">
            {(['fr', 'en', 'es'] as const).map(l => (
              <button
                key={l}
                type="button"
                onClick={() => setEditLang(l)}
                className={`px-1 rounded uppercase font-bold transition-colors ${editLang === l ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <input
          type="text"
          value={getTranslationValue(localAction.name, editLang)}
          onChange={e => handleChange('name', setTranslationValue(localAction.name, editLang, e.target.value))}
          className="w-full text-sm font-bold p-1 bg-black text-white rounded border border-white/10 mb-1"
        />
        <div className="text-[10px] text-gray-500 font-mono mt-1">{localAction.id}</div>
      </td>
      <td className="px-2 py-2 align-middle border-b border-white/5 w-24">
        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Durée (min)</label>
        <input type="number" value={localAction.durationMinutes || 0} onChange={e => handleChange('durationMinutes', Number(e.target.value))} className="w-full text-xs text-center p-1 bg-black text-white rounded border border-white/10 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none" />
      </td>
      <td className="px-2 py-2 align-middle border-b border-white/5 min-w-[120px]">
        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Fanz</label>
        <select value={localAction.fanzTemplateId || ''} onChange={e => handleChange('fanzTemplateId', e.target.value)} className="w-full text-[10px] p-1 bg-gray-900 text-white rounded border border-white/10">
          <option value="">Tous les FANZ</option>
          {fanzTemplates.map(f => <option key={f.id} value={f.id}>{renderTrans(f.name)}</option>)}
        </select>
        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mt-2 mb-1">Skin</label>
        <select value={localAction.skinId || ''} onChange={e => handleChange('skinId', e.target.value)} className="w-full text-[10px] p-1 bg-gray-900 text-white rounded border border-white/10 disabled:opacity-50" disabled={!localAction.fanzTemplateId}>
          <option value="">Tous les skins</option>
          {fanzTemplates.find(f => f.id === localAction.fanzTemplateId)?.skins?.map((s: any) => <option key={s.id} value={s.id}>{renderTrans(s.name)}</option>)}
        </select>
      </td>
      <td className="px-2 py-2 align-middle border-b border-white/5 min-w-[180px]">
        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">XP (For/End/Men/Blf/Cre/Soc/Int/Cha)</label>
        <div className="grid grid-cols-4 gap-1">
          {['force', 'endurance', 'mental', 'bluff'].map((stat) => (
             <input key={stat} title={stat.toUpperCase()} type="number" value={localAction.xpGains?.[stat as keyof typeof localAction.xpGains] || 0} onChange={e => handleChange('xpGains', {...localAction.xpGains, [stat]: Number(e.target.value)})} className="w-full text-[10px] text-center p-1 bg-blue-900/30 text-blue-200 rounded border border-blue-500/30" />
          ))}
          {['creativity', 'social', 'intelligence', 'charisma'].map((stat) => (
             <input key={stat} title={stat.toUpperCase()} type="number" value={localAction.xpGains?.[stat as keyof typeof localAction.xpGains] || 0} onChange={e => handleChange('xpGains', {...localAction.xpGains, [stat]: Number(e.target.value)})} className="w-full text-[10px] text-center p-1 bg-blue-900/30 text-blue-200 rounded border border-blue-500/30" />
          ))}
        </div>
      </td>
      <td className="px-2 py-2 align-middle border-b border-white/5 min-w-[120px]">
        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Coûts (EN/AR/GE/BO)</label>
        <div className="grid grid-cols-4 gap-1">
          <input title="Énergie" type="number" value={localAction.energyCost || 0} onChange={e => handleChange('energyCost', Number(e.target.value))} className="w-full text-[10px] text-center p-1 bg-red-900/30 text-red-200 rounded border border-red-500/30" />
          <input title="Argent" type="number" value={localAction.moneyCost || 0} onChange={e => handleChange('moneyCost', Number(e.target.value))} className="w-full text-[10px] text-center p-1 bg-red-900/30 text-red-200 rounded border border-red-500/30" />
          <input title="Gemmes" type="number" value={localAction.gemsCost || 0} onChange={e => handleChange('gemsCost', Number(e.target.value))} className="w-full text-[10px] text-center p-1 bg-red-900/30 text-red-200 rounded border border-red-500/30" />
          <input title="Boosts" type="number" value={localAction.boostCost || 0} onChange={e => handleChange('boostCost', Number(e.target.value))} className="w-full text-[10px] text-center p-1 bg-red-900/30 text-red-200 rounded border border-red-500/30" />
        </div>
      </td>
      <td className="px-2 py-2 align-middle border-b border-white/5 min-w-[120px]">
        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Gains (EN/AR/GE/BO)</label>
        <div className="grid grid-cols-4 gap-1">
          <input title="Énergie" type="number" value={localAction.energyGain || 0} onChange={e => handleChange('energyGain', Number(e.target.value))} className="w-full text-[10px] text-center p-1 bg-green-900/30 text-green-200 rounded border border-green-500/30" />
          <input title="Argent" type="number" value={localAction.moneyGain || 0} onChange={e => handleChange('moneyGain', Number(e.target.value))} className="w-full text-[10px] text-center p-1 bg-green-900/30 text-green-200 rounded border border-green-500/30" />
          <input title="Gemmes" type="number" value={localAction.gemsGain || 0} onChange={e => handleChange('gemsGain', Number(e.target.value))} className="w-full text-[10px] text-center p-1 bg-green-900/30 text-green-200 rounded border border-green-500/30" />
          <input title="Boosts" type="number" value={localAction.boostGain || 0} onChange={e => handleChange('boostGain', Number(e.target.value))} className="w-full text-[10px] text-center p-1 bg-green-900/30 text-green-200 rounded border border-green-500/30" />
        </div>
      </td>
      <td className="px-2 py-2 align-middle border-b border-white/5 text-center min-w-[120px] shadow-[-10px_0_20px_rgba(0,0,0,0.5)]">
        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1 opacity-0">Actions</label>
        <div className="flex flex-col items-center justify-center gap-2">
          <Button 
            disabled={loading}
            variant="outline" 
            size="sm" 
            className={`w-full p-2 h-auto flex items-center justify-center gap-2 font-bold text-xs ${isDirty ? 'text-white bg-green-600 hover:bg-green-500 border-transparent shadow-[0_0_15px_rgba(22,163,74,0.5)]' : 'text-gray-500 border-white/10 hover:text-white'}`}
            onClick={async () => {
              if(!isDirty) return;
              setLoading(true);
              try {
                await setDoc(doc(db, 'life_actions', localAction.id), JSON.parse(JSON.stringify(localAction)));
                setIsDirty(false);
                onSaved();
              } catch(err) {
                 console.error(err);
              } finally {
                setLoading(false);
              }
            }}
          >
            <Save className="w-4 h-4" /> Sauver
          </Button>
          <div className="flex gap-2 w-full">
            <Button 
              disabled={loading}
              variant="outline" 
              size="sm" 
              title="Dupliquer"
              className="flex-1 text-blue-400 border-blue-400/30 hover:bg-blue-500/10 p-1.5 h-auto text-xs"
              onClick={async () => {
                setLoading(true);
                try {
                  const dup = { ...localAction, id: `action-${Date.now()}`, name: `${localAction.name} (Copie)` };
                  await setDoc(doc(db, 'life_actions', dup.id), JSON.parse(JSON.stringify(dup)));
                  onSaved();
                } catch (err) {
                  console.error(err);
                } finally {
                  setLoading(false);
                }
              }}
            >
              <Copy className="w-3 h-3" /> Copier
            </Button>
            <Button 
              disabled={loading}
              variant="outline" 
              size="sm" 
              title="Supprimer"
              className="text-red-500 border-red-500/30 hover:bg-red-500/10 p-1.5 h-auto"
              onClick={() => onDeleted()}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </td>
    </tr>
    {showOverrides && localAction.fanzTemplateId && (
      <tr className="bg-black/40 border-b border-white/5">
        <td colSpan={8} className="p-4">
          <div className="flex flex-col gap-2 p-3 bg-gray-900 rounded-lg border border-white/10">
            <h4 className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-2">Overrides d'Images/Vidéos par Skin</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {fanzTemplates.find(f => f.id === localAction.fanzTemplateId)?.skins?.map((skin: any) => {
                 const ov = localAction.skinOverrides?.[skin.id] || {};
                 return (
                   <div key={skin.id} className="flex flex-col gap-1 p-2 bg-black rounded border border-white/5">
                     <span className="text-[10px] font-bold text-gray-300 truncate">{renderTrans(skin.name)}</span>
                     <input title="Image URL" type="text" value={ov.image || ''} onChange={e => handleOverrideChange(skin.id, 'image', e.target.value)} className="w-full text-[10px] p-1 bg-gray-800 text-white rounded border border-white/10 focus:border-orange-500" placeholder="Override d'Image URL" />
                     <input title="Video URL" type="text" value={ov.videoUrl || ''} onChange={e => handleOverrideChange(skin.id, 'videoUrl', e.target.value)} className="w-full text-[10px] p-1 bg-gray-800 text-white rounded border border-white/10 focus:border-orange-500" placeholder="Override de Video URL" />
                   </div>
                 );
              })}
            </div>
          </div>
        </td>
      </tr>
    )}
    </>
  );
}
