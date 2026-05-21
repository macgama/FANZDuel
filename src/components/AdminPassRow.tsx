import React, { useState, useEffect } from 'react';
import { Pass } from '../types';
import { Trash2, Save, Copy, Edit } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Button } from './Layout';

export function AdminPassRow({ pass, onSaved, onDeleted, onEditFull }: { pass: Pass, onSaved: () => void, onDeleted: () => void, onEditFull: (pass: Pass) => void }) {
  const [localPass, setLocalPass] = useState<Pass>({ ...pass });
  const [isDirty, setIsDirty] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLocalPass({ ...pass });
    setIsDirty(false);
  }, [pass]);

  const handleChange = (field: string, value: any) => {
    setLocalPass(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handlePremiumChange = (field: string, value: any) => {
    setLocalPass(prev => ({
      ...prev,
      premiumPrice: { ...prev.premiumPrice, [field]: value }
    }));
    setIsDirty(true);
  };

  return (
    <tr className={`hover:bg-white/5 transition-colors group ${isDirty ? 'bg-orange-500/5' : ''}`}>
      <td className="px-2 py-2 align-middle border-b border-white/5 min-w-[200px]">
        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Nom & ID</label>
        <input type="text" value={localPass.name || ''} onChange={e => handleChange('name', e.target.value)} className="w-full text-sm font-bold p-1 bg-black text-white rounded border border-white/10 mb-1" />
        <div className="text-[10px] text-gray-500 font-mono mt-1">{localPass.id}</div>
      </td>
      <td className="px-2 py-2 align-middle border-b border-white/5 min-w-[250px]">
        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Description</label>
        <textarea value={localPass.description || ''} onChange={e => handleChange('description', e.target.value)} className="w-full text-xs p-1 bg-black text-white rounded border border-white/10 h-10" placeholder="Description..."></textarea>
      </td>
      <td className="px-2 py-2 align-middle border-b border-white/5 min-w-[150px]">
        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Dates & Statut</label>
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-500 w-12">Début:</span>
                <input type="date" value={localPass.startDate ? localPass.startDate.split('T')[0] : ''} onChange={e => handleChange('startDate', e.target.value ? new Date(e.target.value).toISOString() : '')} className="flex-1 text-[10px] p-1 bg-gray-900 text-white rounded border border-white/10" />
            </div>
            <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-500 w-12">Fin:</span>
                <input type="date" value={localPass.endDate ? localPass.endDate.split('T')[0] : ''} onChange={e => handleChange('endDate', e.target.value ? new Date(e.target.value).toISOString() : '')} className="flex-1 text-[10px] p-1 bg-gray-900 text-white rounded border border-white/10" />
            </div>
            <label className="text-[10px] text-gray-400 flex items-center gap-1 mt-1">
                <input type="checkbox" checked={localPass.isActive} onChange={e => handleChange('isActive', e.target.checked)} className="rounded border-gray-700 bg-gray-800" />
                Pass Actif
            </label>
        </div>
      </td>
      <td className="px-2 py-2 align-middle border-b border-white/5 min-w-[150px]">
        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Conditions</label>
        <div className="grid grid-cols-2 gap-1 mb-1">
            <select value={localPass.conditionType || 'global'} onChange={e => handleChange('conditionType', e.target.value as any)} className="w-full text-[10px] p-1 bg-gray-900 text-white rounded border border-white/10">
              <option value="global">Général</option>
              <option value="country">Pays</option>
              <option value="team">Équipe</option>
              <option value="league">Ligue</option>
              <option value="season">Saison</option>
              <option value="fanz">FANZ</option>
            </select>
            <input type="text" value={localPass.conditionSeason || ''} onChange={e => handleChange('conditionSeason', e.target.value)} className="w-full text-[10px] p-1 bg-gray-900 text-white rounded border border-white/10" placeholder="Saison (ex: 2026)" />
        </div>
        <div className="grid grid-cols-2 gap-1">
            <input type="text" value={localPass.conditionValue || ''} onChange={e => handleChange('conditionValue', e.target.value)} disabled={localPass.conditionType === 'global' || !localPass.conditionType} className="w-full text-[10px] p-1 bg-black text-white rounded border border-white/10 disabled:opacity-50" placeholder="ID/Valeur cible" />
            <input type="text" value={localPass.conditionLeague || ''} onChange={e => handleChange('conditionLeague', e.target.value)} className="w-full text-[10px] p-1 bg-black text-white rounded border border-white/10" placeholder="Ligue ID (Opt)" />
        </div>
      </td>
      <td className="px-2 py-2 align-middle border-b border-white/5 min-w-[150px]">
        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Prix Premium</label>
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1 mb-1">
                <span className="text-[10px] text-gray-400 w-16 text-right">Argent 💰:</span>
                <input type="number" value={localPass.premiumPrice?.money || ''} onChange={e => handlePremiumChange('money', e.target.value ? Number(e.target.value) : undefined)} className="flex-1 text-[10px] p-1 bg-yellow-900/30 text-yellow-200 rounded border border-yellow-500/30 text-center" placeholder="0" />
            </div>
            <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-400 w-16 text-right">Gemmes 💎:</span>
                <input type="number" value={localPass.premiumPrice?.gems || ''} onChange={e => handlePremiumChange('gems', e.target.value ? Number(e.target.value) : undefined)} className="flex-1 text-[10px] p-1 bg-purple-900/30 text-purple-200 rounded border border-purple-500/30 text-center" placeholder="0" />
            </div>
        </div>
      </td>
      <td className="px-2 py-2 align-middle border-b border-white/5 min-w-[120px] text-center">
        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Niveaux</label>
        <div className="text-xl font-bold text-white leading-none mb-1">{(localPass.levels || []).length}</div>
        <span className="text-[10px] text-gray-400 block mb-2">niveaux</span>
        <Button type="button" variant="outline" size="sm" className="w-full h-6 text-[10px] py-0 px-2 flex items-center justify-center gap-1" onClick={() => onEditFull(localPass)}>
           Éditer Niveaux <Edit className="w-3 h-3" />
        </Button>
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
                // Keep the priceGems backward compatible
                let finalPass = { ...localPass };
                if (finalPass.premiumPrice?.gems) finalPass.priceGems = finalPass.premiumPrice.gems;

                await setDoc(doc(db, 'passes', localPass.id), JSON.parse(JSON.stringify(finalPass)));
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
                  const dup = { ...localPass, id: `pass-${Date.now()}`, name: `${localPass.name} (Copie)` };
                  await setDoc(doc(db, 'passes', dup.id), JSON.parse(JSON.stringify(dup)));
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
