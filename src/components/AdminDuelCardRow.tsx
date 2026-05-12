import React, { useState, useEffect } from 'react';
import { Card as DuelCard } from '../types';
import { getImageUrl } from '../lib/utils';
import { Trash2, Save, Copy, Activity } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Button } from './Layout';

export function AdminDuelCardRow({ card, onSaved, onDeleted, fanzTemplates }: { card: DuelCard, onSaved: () => void, onDeleted: () => void, fanzTemplates: any[] }) {
  const [localCard, setLocalCard] = useState<DuelCard>({ ...card });
  const [isDirty, setIsDirty] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLocalCard({ ...card });
    setIsDirty(false);
  }, [card]);

  const handleChange = (field: string, value: any) => {
    setLocalCard(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const currentFanz = localCard.fanzIds && localCard.fanzIds.length > 0 ? localCard.fanzIds[0] : '';

  return (
    <tr className={`hover:bg-white/5 transition-colors group ${isDirty ? 'bg-orange-500/5' : ''}`}>
      <td className="px-2 py-2 align-middle border-b border-white/5">
        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Image / URL Vidéo</label>
        <div className="flex flex-col gap-1 items-center">
            <div className="w-12 h-16 rounded overflow-hidden bg-black/40 border border-white/10 shrink-0 mb-1">
               {localCard.videoUrl ? (
                 <video src={getImageUrl(localCard.videoUrl)} className="w-full h-full object-cover" autoPlay muted loop playsInline />
               ) : localCard.imageUrl ? (
                 <img src={getImageUrl(localCard.imageUrl)} alt={localCard.name} className="w-full h-full object-cover" />
               ) : (
                 <div className="w-full h-full flex items-center justify-center"><Activity className="w-6 h-6 text-gray-400" /></div>
               )}
            </div>
            <input title="Image URL" type="text" value={localCard.imageUrl || ''} onChange={e => handleChange('imageUrl', e.target.value)} className="w-24 text-[10px] p-1 bg-black text-white rounded border border-white/10" placeholder="Img URL" />
            <input title="Video URL" type="text" value={localCard.videoUrl || ''} onChange={e => handleChange('videoUrl', e.target.value)} className="w-24 text-[10px] p-1 bg-black text-white rounded border border-white/10" placeholder="Vid URL" />
        </div>
      </td>
      <td className="px-2 py-2 align-middle border-b border-white/5 min-w-[150px]">
        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Nom / ID / Type</label>
        <input type="text" value={localCard.name || ''} onChange={e => handleChange('name', e.target.value)} className="w-full text-sm font-bold p-1 bg-black text-white rounded border border-white/10 mb-1" />
        <div className="flex gap-2">
            <select value={localCard.type} onChange={e => handleChange('type', e.target.value as any)} className="w-1/2 text-[10px] p-1 bg-gray-900 text-white rounded border border-white/10">
              <option value="bonus">Bonus</option>
              <option value="malus">Malus</option>
              <option value="neutral">Neutre</option>
            </select>
            <select value={localCard.rarity} onChange={e => handleChange('rarity', e.target.value as any)} className="w-1/2 text-[10px] p-1 bg-gray-900 text-white rounded border border-white/10">
              <option value="common">Commune</option>
              <option value="rare">Rare</option>
              <option value="epic">Épique</option>
              <option value="legendary">Légendaire</option>
            </select>
        </div>
        <div className="text-[10px] text-gray-500 font-mono mt-1">{localCard.id}</div>
      </td>
      <td className="px-2 py-2 align-middle border-b border-white/5 min-w-[200px]">
        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Description & Ferveur</label>
        <textarea value={localCard.description || ''} onChange={e => handleChange('description', e.target.value)} className="w-full text-xs p-1 bg-black text-white rounded border border-white/10 h-10 mb-1" placeholder="Description..."></textarea>
        <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500">Val. Ferveur :</span>
            <input type="number" value={localCard.fervorValue || 0} onChange={e => handleChange('fervorValue', Number(e.target.value))} className="w-16 text-xs text-center p-1 bg-black text-white rounded border border-white/10" />
        </div>
      </td>
      <td className="px-2 py-2 align-middle border-b border-white/5 min-w-[120px]">
        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Fanz</label>
        <select value={currentFanz} onChange={e => handleChange('fanzIds', e.target.value ? [e.target.value] : [])} className="w-full text-[10px] p-1 bg-gray-900 text-white rounded border border-white/10">
          <option value="">Tous les FANZ</option>
          {fanzTemplates.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mt-2 mb-1">Skin</label>
        <select value={localCard.skinId || ''} onChange={e => handleChange('skinId', e.target.value)} className="w-full text-[10px] p-1 bg-gray-900 text-white rounded border border-white/10 disabled:opacity-50" disabled={!currentFanz}>
          <option value="">Tous les skins</option>
          {fanzTemplates.find(f => f.id === currentFanz)?.skins?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </td>
      <td className="px-2 py-2 align-middle border-b border-white/5 min-w-[120px]">
        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Coûts d'utilisation</label>
        <div className="flex items-center gap-1 mb-2">
            <span className="text-[10px] text-gray-400 w-12">Énergie:</span>
            <input type="number" value={localCard.energyCost || 0} onChange={e => handleChange('energyCost', Number(e.target.value))} className="flex-1 text-[10px] text-center p-1 bg-blue-900/30 text-blue-200 rounded border border-blue-500/30" />
        </div>
        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Prix d'achat</label>
        <div className="grid grid-cols-2 gap-1">
          <input title="Argent" type="number" value={localCard.price?.money || ''} onChange={e => handleChange('price', {...(localCard.price || {}), money: e.target.value ? Number(e.target.value) : undefined})} className="w-full text-[10px] text-center p-1 bg-yellow-900/30 text-yellow-200 rounded border border-yellow-500/30" placeholder="0" />
          <input title="Gemmes" type="number" value={localCard.price?.gems || ''} onChange={e => handleChange('price', {...(localCard.price || {}), gems: e.target.value ? Number(e.target.value) : undefined})} className="w-full text-[10px] text-center p-1 bg-purple-900/30 text-purple-200 rounded border border-purple-500/30" placeholder="0" />
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
                await setDoc(doc(db, 'cards', localCard.id), JSON.parse(JSON.stringify(localCard)));
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
                  const dup = { ...localCard, id: `card-${Date.now()}`, name: `${localCard.name} (Copie)` };
                  await setDoc(doc(db, 'cards', dup.id), JSON.parse(JSON.stringify(dup)));
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
