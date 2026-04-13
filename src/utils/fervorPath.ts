import { GlobalFervorConfig } from '../types';

export const FERVOR_RANGES = [
  { level: 1, min: 0, max: 99999, step: 5000 },
  { level: 2, min: 100000, max: 499999, step: 10000 },
  { level: 3, min: 500000, max: 999999, step: 25000 },
  { level: 4, min: 1000000, max: 1999999, step: 50000 },
  { level: 5, min: 2000000, max: 2999999, step: 50000 },
  { level: 6, min: 3000000, max: 3999999, step: 100000 },
  { level: 7, min: 4000000, max: 4999999, step: 100000 },
  { level: 8, min: 5000000, max: 5999999, step: 100000 },
  { level: 9, min: 6000000, max: 6999999, step: 200000 },
  { level: 10, min: 7000000, max: 7999999, step: 200000 },
  { level: 11, min: 8000000, max: 8999999, step: 200000 },
  { level: 12, min: 9000000, max: 9999999, step: 250000 },
  { level: 13, min: 10000000, max: 11999999, step: 250000 },
  { level: 14, min: 12000000, max: 14999999, step: 500000 },
  { level: 15, min: 15000000, max: 15000000, step: 1000000 },
];

export function generateFervorPath(maxPoints: number, config?: GlobalFervorConfig) {
  const milestones = [];
  let nodeIndex = 1;
  let majorLevelIndex = 2;
  
  const rangesToUse = config?.ranges || FERVOR_RANGES.map(r => ({
    ...r,
    levelReward: { type: 'gems', amount: r.level * 100 },
    intermediateReward: { type: 'money', amount: r.level * 1000 }
  }));
  
  for (const range of rangesToUse) {
    if (range.min > maxPoints) break;
    
    if (range.min > 0) {
      milestones.push({
        pointsRequired: range.min,
        isIntermediate: false,
        level: nodeIndex++,
        displayLevel: majorLevelIndex++,
        reward: range.levelReward
      });
    }
    
    let nextStep = range.min + range.step;
    while (nextStep <= range.max && nextStep <= maxPoints) {
      milestones.push({
        pointsRequired: nextStep,
        isIntermediate: true,
        level: nodeIndex++,
        reward: range.intermediateReward
      });
      nextStep += range.step;
    }
  }
  
  return milestones;
}
