import { Fanz, FanzTemplate, FanzSkin } from '../types';

export function getEffectiveFanz(fanz: Fanz, template: FanzTemplate): Fanz {
  if (!fanz || !template) return fanz;

  // Don't modify the original object
  const effectiveFanz = { ...fanz, stats: { ...fanz.stats } };

  const equippedSkinId = fanz.equippedSkin;
  if (!equippedSkinId) return effectiveFanz;

  const skin = template.skins?.find(s => s.id === equippedSkinId);
  if (!skin) return effectiveFanz;

  // Apply Stat Bonuses
  if (skin.statsBonus) {
    if (skin.statsBonus.force) effectiveFanz.stats.force = (effectiveFanz.stats.force || 0) + (skin.statsBonus.force * 100);
    if (skin.statsBonus.mental) effectiveFanz.stats.mental = (effectiveFanz.stats.mental || 0) + (skin.statsBonus.mental * 100);
    if (skin.statsBonus.intelligence) effectiveFanz.stats.intelligence = (effectiveFanz.stats.intelligence || 0) + (skin.statsBonus.intelligence * 100);
    if (skin.statsBonus.creativity) effectiveFanz.stats.creativity = (effectiveFanz.stats.creativity || 0) + (skin.statsBonus.creativity * 100);
    if (skin.statsBonus.bluff) effectiveFanz.stats.bluff = (effectiveFanz.stats.bluff || 0) + (skin.statsBonus.bluff * 100);
    if (skin.statsBonus.social) effectiveFanz.stats.social = (effectiveFanz.stats.social || 0) + (skin.statsBonus.social * 100);
    if (skin.statsBonus.charisma) effectiveFanz.stats.charisma = (effectiveFanz.stats.charisma || 0) + (skin.statsBonus.charisma * 100);
    if (skin.statsBonus.endurance) effectiveFanz.stats.endurance = (effectiveFanz.stats.endurance || 0) + (skin.statsBonus.endurance * 100);
  }

  // Ensure stats don't drop below 0
  Object.keys(effectiveFanz.stats).forEach(key => {
    const k = key as keyof typeof effectiveFanz.stats;
    if (effectiveFanz.stats[k] < 0) effectiveFanz.stats[k] = 0;
  });

  return effectiveFanz;
}

export function getSkinBonuses(skin?: FanzSkin) {
  return {
    energyBonus: skin?.energyBonus || 0,
    fervorBonus: skin?.fervorBonus || 0,
    gemsBonus: skin?.gemsBonus || 0,
    moneyBonus: skin?.moneyBonus || 0,
    boostBonus: skin?.boostBonus || 0,
  };
}
