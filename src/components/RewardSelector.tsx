import React from 'react';
import { FerveurLevel, FanzTemplate, LifeAction, Card as DuelCard } from '../types';

interface RewardSelectorProps {
  reward: FerveurLevel['reward'];
  onChange: (reward: FerveurLevel['reward']) => void;
  fanzTemplates: FanzTemplate[];
  lifeActions: LifeAction[];
  duelCards: DuelCard[];
}

export const RewardSelector: React.FC<RewardSelectorProps & { theme?: 'dark' | 'light' }> = ({ reward, onChange, fanzTemplates, lifeActions, duelCards, theme = 'dark' }) => {
  const allSkins = fanzTemplates.flatMap(t => t.skins.map(s => ({ ...s, templateName: t.name })));
  const allEmotes = fanzTemplates.flatMap(t => t.emotes.map(e => ({ ...e, templateName: t.name })));

  const inputClass = theme === 'dark' 
    ? "p-1 bg-gray-800 rounded border border-gray-700 text-xs text-white"
    : "p-2 bg-white rounded border border-gray-200 text-sm text-gray-900";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <select
          value={reward?.type || 'money'}
          onChange={e => onChange({ ...reward, type: e.target.value as any })}
          className={`flex-1 ${inputClass}`}
        >
          <option value="money">Argent ($)</option>
          <option value="gems">Gemmes</option>
          <option value="boost">Boost</option>
          <option value="energy">Énergie</option>
          <option value="xp">XP Compétences</option>
          <option value="skin">Skin</option>
          <option value="emote">Emote</option>
          <option value="card">Carte Duel</option>
          <option value="action">Action LIFE</option>
        </select>
        
        {['money', 'gems', 'boost', 'energy', 'xp'].includes(reward?.type || 'money') && (
          <input
            type="number"
            value={reward?.amount || 0}
            onChange={e => onChange({ ...reward, amount: Number(e.target.value) })}
            className={`w-20 font-mono ${inputClass}`}
            placeholder="Montant"
          />
        )}
      </div>

      {reward?.type === 'skin' && (
        <select
          value={reward.skinId || ''}
          onChange={e => onChange({ ...reward, skinId: e.target.value })}
          className={`w-full ${inputClass}`}
        >
          <option value="">Sélectionner un skin...</option>
          {allSkins.map(s => (
            <option key={s.id} value={s.id}>{s.templateName} - {s.name}</option>
          ))}
        </select>
      )}

      {reward?.type === 'emote' && (
        <select
          value={reward.emoteId || ''}
          onChange={e => onChange({ ...reward, emoteId: e.target.value })}
          className={`w-full ${inputClass}`}
        >
          <option value="">Sélectionner une emote...</option>
          {allEmotes.map(e => (
            <option key={e.id} value={e.id}>{e.templateName} - {e.name}</option>
          ))}
        </select>
      )}

      {reward?.type === 'card' && (
        <select
          value={reward.cardId || ''}
          onChange={e => onChange({ ...reward, cardId: e.target.value })}
          className={`w-full ${inputClass}`}
        >
          <option value="">Sélectionner une carte...</option>
          {duelCards.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}

      {reward?.type === 'action' && (
        <select
          value={reward.actionId || ''}
          onChange={e => onChange({ ...reward, actionId: e.target.value })}
          className={`w-full ${inputClass}`}
        >
          <option value="">Sélectionner une action...</option>
          {lifeActions.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      )}
    </div>
  );
};
