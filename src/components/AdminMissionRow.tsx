import React, { useState, useEffect } from 'react';
import { Mission } from '../types';
import { Trash2, Save, Copy } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Button } from './Layout';

export function AdminMissionRow({ mission, onSaved, onDeleted }: { mission: Mission, onSaved: () => void, onDeleted: () => void }) {
  const [localMission, setLocalMission] = useState<Mission>({ ...mission });
  const [isDirty, setIsDirty] = useState(false);
  const [loading, setLoading] = useState(false);
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
    setLocalMission({ ...mission });
    setIsDirty(false);
  }, [mission]);

  const handleChange = (field: string, value: any) => {
    setLocalMission(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleRewardChange = (field: string, value: any) => {
    setLocalMission(prev => ({
      ...prev,
      reward: { ...prev.reward, [field]: value }
    }));
    setIsDirty(true);
  };

  return (
    <tr className={`hover:bg-white/5 transition-colors group ${isDirty ? 'bg-orange-500/5' : ''}`}>
      <td className="px-2 py-2 align-middle border-b border-white/5 min-w-[200px]">
        <div className="flex justify-between items-center mb-1">
          <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500">Titre & ID</label>
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
          value={getTranslationValue(localMission.title, editLang)}
          onChange={e => handleChange('title', setTranslationValue(localMission.title, editLang, e.target.value))}
          className="w-full text-sm font-bold p-1 bg-black text-white rounded border border-white/10 mb-1"
        />
        <div className="text-[10px] text-gray-500 font-mono mt-1">{localMission.id}</div>
      </td>
      <td className="px-2 py-2 align-middle border-b border-white/5 min-w-[250px]">
        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Description ({editLang.toUpperCase()})</label>
        <textarea
          value={getTranslationValue(localMission.description, editLang)}
          onChange={e => handleChange('description', setTranslationValue(localMission.description, editLang, e.target.value))}
          className="w-full text-xs p-1 bg-black text-white rounded border border-white/10 h-10"
          placeholder="Description..."
        ></textarea>
      </td>
      <td className="px-2 py-2 align-middle border-b border-white/5 min-w-[150px]">
        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Détails (Type/Periode/Actif)</label>
        <div className="grid grid-cols-2 gap-1 mb-1">
            <select value={localMission.type || 'duel_count'} onChange={e => handleChange('type', e.target.value as any)} className="w-full text-[10px] p-1 bg-gray-900 text-white rounded border border-white/10">
              <option value="duel_count">Duels</option>
              <option value="win_count">Victoires</option>
              <option value="fanz_duel">FANZ Duel</option>
              <option value="life_action">Action LIFE</option>
              {/* Fallback support for other types if they exist */}
              <option value="action">Action</option>
              <option value="social">Social</option>
              <option value="collection">Collection</option>
              <option value="card_usage">Utilisation Carte</option>
            </select>
            <select value={localMission.period || 'daily'} onChange={e => handleChange('period', e.target.value as any)} className="w-full text-[10px] p-1 bg-gray-900 text-white rounded border border-white/10">
              <option value="daily">Quotidienne</option>
              <option value="weekly">Hebdomadaire</option>
              <option value="one_shot">Unique</option>
            </select>
        </div>
        <div className="flex items-center gap-2 mt-2">
            <label className="text-[10px] text-gray-400 flex items-center gap-1">
                <input type="checkbox" checked={localMission.isActive} onChange={e => handleChange('isActive', e.target.checked)} className="rounded border-gray-700 bg-gray-800" />
                Active
            </label>
            <div className="flex items-center gap-1 ml-auto">
               <span className="text-[10px] text-gray-500">Cible:</span>
               <input type="number" value={localMission.target || 1} onChange={e => handleChange('target', Number(e.target.value))} className="w-12 text-[10px] p-1 bg-black text-white rounded border border-white/10 text-center" />
            </div>
        </div>
      </td>
      <td className="px-2 py-2 align-middle border-b border-white/5 min-w-[150px]">
        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Conditions</label>
        <div className="grid grid-cols-2 gap-1 mb-1">
            <select value={localMission.conditionType || 'global'} onChange={e => handleChange('conditionType', e.target.value as any)} className="w-full text-[10px] p-1 bg-gray-900 text-white rounded border border-white/10">
              <option value="global">Général</option>
              <option value="country">Pays</option>
              <option value="team">Équipe</option>
              <option value="league">Ligue</option>
              <option value="season">Saison</option>
              <option value="fanz">FANZ</option>
            </select>
            <input type="text" value={localMission.conditionSeason || ''} onChange={e => handleChange('conditionSeason', e.target.value)} className="w-full text-[10px] p-1 bg-gray-900 text-white rounded border border-white/10" placeholder="Saison (ex: 2026)" />
        </div>
        <div className="grid grid-cols-2 gap-1">
            <input type="text" value={localMission.conditionValue || ''} onChange={e => handleChange('conditionValue', e.target.value)} disabled={localMission.conditionType === 'global' || !localMission.conditionType} className="w-full text-[10px] p-1 bg-black text-white rounded border border-white/10 disabled:opacity-50" placeholder="ID/Valeur cible" />
            <input type="text" value={localMission.conditionLeague || ''} onChange={e => handleChange('conditionLeague', e.target.value)} className="w-full text-[10px] p-1 bg-black text-white rounded border border-white/10" placeholder="Ligue ID (Opt)" />
        </div>
      </td>
      <td className="px-2 py-2 align-middle border-b border-white/5 min-w-[120px]">
        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Récompense</label>
        <div className="flex flex-col gap-1">
            <select value={localMission.reward?.type || 'money'} onChange={e => handleRewardChange('type', e.target.value)} className="w-full text-[10px] p-1 bg-gray-900 text-white rounded border border-white/10">
                <option value="money">Argent</option>
                <option value="gems">Gemmes</option>
                <option value="boost">Boost</option>
                <option value="fanz">FANZ</option>
                <option value="lootbox">Lootbox</option>
            </select>
            <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-400">Montant:</span>
                <input type="number" value={localMission.reward?.amount || 0} onChange={e => handleRewardChange('amount', Number(e.target.value))} className="flex-1 text-[10px] p-1 bg-black text-white rounded border border-white/10 text-center" />
            </div>
            {localMission.reward?.type === 'fanz' && (
                <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-400">Fanz ID:</span>
                    <input type="text" value={localMission.reward?.fanzId || ''} onChange={e => handleRewardChange('fanzId', e.target.value)} className="flex-1 text-[10px] p-1 bg-black text-white rounded border border-white/10" placeholder="Template ID" />
                </div>
            )}
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
                await setDoc(doc(db, 'missions', localMission.id), JSON.parse(JSON.stringify(localMission)));
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
                  const dup = { ...localMission, id: `mission-${Date.now()}`, title: `${localMission.title} (Copie)` };
                  await setDoc(doc(db, 'missions', dup.id), JSON.parse(JSON.stringify(dup)));
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
  );
}
