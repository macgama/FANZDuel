import { GlobalFervorConfig } from '../types';

export const FERVOR_RANGES = [
  { level: 1, min: 0, max: 499, step: 10 },
  { level: 2, min: 500, max: 1549, step: 15 },
  { level: 3, min: 1550, max: 5099, step: 50 },
  { level: 4, min: 5100, max: 10099, step: 100 },
  { level: 5, min: 10100, max: 15099, step: 100 },
  { level: 6, min: 15100, max: 20099, step: 100 },
  { level: 7, min: 20100, max: 25099, step: 100 },
  { level: 8, min: 25100, max: 30199, step: 100 },
  { level: 9, min: 30200, max: 40199, step: 100 },
  { level: 10, min: 40200, max: 50199, step: 100 },
  { level: 11, min: 50200, max: 60199, step: 100 },
  { level: 12, min: 60200, max: 70199, step: 100 },
  { level: 13, min: 70200, max: 80199, step: 100 },
  { level: 14, min: 80200, max: 90199, step: 100 },
  { level: 15, min: 90200, max: 99999, step: 100 },
];

export function generateFervorPath(maxPoints: number, config?: GlobalFervorConfig) {
  const milestones = [];
  let nodeIndex = 1;
  let majorLevelIndex = 2;
  
  const rangesToUse = config?.ranges || FERVOR_RANGES.map(r => ({
    ...r,
    levelReward: { type: 'gems', amount: r.level * 5 },
    intermediateReward: { type: 'money', amount: r.level * 100 }
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
  
  if (maxPoints >= 100000) {
    milestones.push({
      pointsRequired: 100000,
      isIntermediate: false,
      level: nodeIndex++,
      displayLevel: majorLevelIndex++,
      reward: { type: 'boost', amount: 10 }
    });
  }
  
  return milestones;
}
