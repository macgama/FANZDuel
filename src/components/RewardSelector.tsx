import React from 'react';
import { FerveurLevel, FanzTemplate, LifeAction, Card as DuelCard } from '../types';

interface RewardSelectorProps {
  reward: FerveurLevel['reward'];
  onChange: (reward: FerveurLevel['reward']) => void;
  fanzTemplates: FanzTemplate[];
  lifeActions: LifeAction[];
  duelCards: DuelCard[];
  theme?: 'dark' | 'light';
  isFanzContext?: boolean;
  currentFanzId?: string;
}

export const RewardSelector: React.FC<RewardSelectorProps> = ({ reward, onChange, fanzTemplates, lifeActions, duelCards, theme = 'dark', isFanzContext, currentFanzId }) => {
  const filteredTemplates = isFanzContext && currentFanzId && currentFanzId !== 'global'
    ? fanzTemplates.filter(t => t.id === currentFanzId && t.isActive !== false)
    : fanzTemplates.filter(t => t.isActive !== false);

  const allSkins = filteredTemplates.flatMap(t => (t.skins || []).map(s => ({ ...s, templateName: t.name })));
  const allEmotes = filteredTemplates.flatMap(t => (t.emotes || []).map(e => ({ ...e, templateName: t.name })));

  const inputClass = theme === 'dark' 
    ? "p-1 min-w-0 bg-gray-800 [&>option]:bg-gray-800 [&>option]:text-white rounded border border-gray-700 text-xs text-white"
    : "p-2 min-w-0 bg-white [&>option]:bg-white [&>option]:text-black rounded border border-gray-200 text-sm text-gray-900";

  const availableCards = isFanzContext && currentFanzId && currentFanzId !== 'global'
    ? duelCards.filter(c => {
        return c.fanzIds && c.fanzIds.includes(currentFanzId);
      })
    : duelCards;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <select
          value={reward?.type || 'money'}
          onChange={e => {
            const type = e.target.value as any;
            const newReward = { ...reward, type };
            if (type === 'team_slot') newReward.amount = 1;
            onChange(newReward);
          }}
          className={`flex-1 w-0 truncate ${inputClass}`}
        >
          <option value="money">Argent ($)</option>
          <option value="gems">Gemmes</option>
          <option value="boost">Boost</option>
          <option value="energy">Énergie</option>
          <option value="xp">XP Compétences</option>
          <option value="skin">Skin</option>
          <option value="emote">Emote</option>
          <option value="card">Carte Duel</option>
          {!isFanzContext && <option value="action">Action LIFE</option>}
          <option value="team_slot">1 slot supplémentaire pour équipe</option>
          <option value="fanz">FANZ</option>
          <option value="choice">Au Choix (Plusieurs options)</option>
        </select>
        
        {['money', 'gems', 'boost', 'energy', 'xp', 'team_slot'].includes(reward?.type || 'money') && (
          <input
            type="number"
            value={reward?.amount || 0}
            onChange={e => onChange({ ...reward, amount: Number(e.target.value) })}
            className={`w-20 font-mono ${inputClass}`}
            placeholder="Montant"
            disabled={reward?.type === 'team_slot'}
          />
        )}
      </div>

      {reward?.type === 'choice' && (
        <div className="mt-2 space-y-2 p-2 border border-gray-600 rounded bg-black/20">
          <div className="text-xs font-bold text-gray-400">Options disponibles pour le joueur :</div>
          {(reward.choices || []).map((choice, cIdx) => (
            <div key={cIdx} className="flex gap-2 items-start border-l-2 border-orange-500 pl-2">
              <div className="flex-1">
                <RewardSelector
                  reward={choice}
                  onChange={newChoice => {
                    const newChoices = [...(reward.choices || [])];
                    newChoices[cIdx] = newChoice;
                    onChange({ ...reward, choices: newChoices });
                  }}
                  fanzTemplates={fanzTemplates}
                  lifeActions={lifeActions}
                  duelCards={duelCards}
                  theme={theme}
                  isFanzContext={isFanzContext}
                  currentFanzId={currentFanzId}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  const newChoices = [...(reward.choices || [])];
                  newChoices.splice(cIdx, 1);
                  onChange({ ...reward, choices: newChoices });
                }}
                className="p-1 text-red-500 hover:bg-red-500/20 rounded"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const newChoices = [...(reward.choices || []), { id: `choice-${Date.now()}`, type: 'money' as any, amount: 100 }];
              onChange({ ...reward, choices: newChoices });
            }}
            className="w-full text-xs py-1 px-2 border border-dashed border-gray-600 rounded text-gray-400 hover:text-white hover:border-gray-400"
          >
            + Ajouter une option au choix
          </button>
        </div>
      )}

      {reward?.type === 'xp' && (
        <select
          value={reward.statName || ''}
          onChange={e => onChange({ ...reward, statName: e.target.value as any })}
          className={`w-full truncate ${inputClass}`}
        >
          <option value="">Sélectionner une compétence...</option>
          <option value="force">Force</option>
          <option value="endurance">Endurance</option>
          <option value="mental">Mental</option>
          <option value="bluff">Bluff</option>
          <option value="creativity">Créativité</option>
          <option value="social">Social</option>
          <option value="intelligence">Intelligence</option>
          <option value="charisma">Charisme</option>
        </select>
      )}

      {reward?.type === 'fanz' && (
        <select
          value={reward.fanzId || ''}
          onChange={e => onChange({ ...reward, fanzId: e.target.value })}
          className={`w-full truncate ${inputClass}`}
        >
          <option value="">Sélectionner un FANZ...</option>
          {filteredTemplates.map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      )}

      {reward?.type === 'skin' && (
        <select
          value={reward.skinId || ''}
          onChange={e => onChange({ ...reward, skinId: e.target.value })}
          className={`w-full truncate ${inputClass}`}
        >
          <option value="">Sélectionner un skin...</option>
          {allSkins.map((s, idx) => (
            <option key={`${s.id}-${idx}`} value={s.id}>{s.templateName} - {s.name}</option>
          ))}
        </select>
      )}

      {reward?.type === 'emote' && (
        <select
          value={reward.emoteId || ''}
          onChange={e => onChange({ ...reward, emoteId: e.target.value })}
          className={`w-full truncate ${inputClass}`}
        >
          <option value="">Sélectionner une emote...</option>
          {allEmotes.map((e, idx) => (
            <option key={`${e.id}-${idx}`} value={e.id}>{e.templateName} - {e.name}</option>
          ))}
        </select>
      )}

      {reward?.type === 'card' && (
        <select
          value={reward.cardId || ''}
          onChange={e => onChange({ ...reward, cardId: e.target.value })}
          className={`w-full truncate ${inputClass}`}
        >
          <option value="">Sélectionner une carte...</option>
          {availableCards.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}

      {reward?.type === 'action' && !isFanzContext && (
        <select
          value={reward.actionId || ''}
          onChange={e => onChange({ ...reward, actionId: e.target.value })}
          className={`w-full truncate ${inputClass}`}
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
