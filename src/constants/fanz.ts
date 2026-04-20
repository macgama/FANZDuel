import { FanzStats, LifeAction, FanzSkin, FanzEmote, FanzTemplate, FerveurLevel } from '../types';

const defaultFerveurPath: FerveurLevel[] = [];
const fanzLevels = [
  { level: 2, points: 5000, reward: { type: 'gems', amount: 50 } },
  { level: 3, points: 15000, reward: { type: 'money', amount: 1000 } }, 
  { level: 4, points: 30000, reward: { type: 'gems', amount: 100 } },
  { level: 5, points: 50000, reward: { type: 'boost', amount: 5 } },
  { level: 6, points: 75000, reward: { type: 'money', amount: 5000 } },
  { level: 7, points: 100000, reward: { type: 'gems', amount: 500 } },
  { level: 8, points: 120000, reward: { type: 'boost', amount: 10 } },
  { level: 9, points: 135000, reward: { type: 'money', amount: 10000 } },
  { level: 10, points: 150000, reward: { type: 'gems', amount: 1000 } },
];

const steps = [];
for (let pts = 1000; pts <= 30000; pts += 1000) steps.push(pts);
for (let pts = 32500; pts <= 75000; pts += 2500) steps.push(pts);
for (let pts = 80000; pts <= 150000; pts += 5000) steps.push(pts);

fanzLevels.forEach(l => {
  if (!steps.includes(l.points)) steps.push(l.points);
});
steps.sort((a, b) => a - b);

const uniqueSteps = Array.from(new Set(steps));

uniqueSteps.forEach(pts => {
  const major = fanzLevels.find(l => l.points === pts);
  if (major) {
    defaultFerveurPath.push({ level: major.level, pointsRequired: pts, reward: major.reward as any });
  } else {
    let reward = { type: 'money', amount: 100 };
    if (pts % 10000 === 0) reward = { type: 'boost', amount: 2 };
    else if (pts % 5000 === 0) reward = { type: 'gems', amount: 20 };
    else if (pts % 2000 === 0) reward = { type: 'xp', amount: 50 };
    
    defaultFerveurPath.push({ isIntermediate: true, pointsRequired: pts, reward: reward as any });
  }
});

export const ALL_FANZ: FanzTemplate[] = Array.from({ length: 100 }, (_, i) => {
  const paddedId = String(i + 1).padStart(3, '0');
  const imageUrl = `https://thebestfan.online/img/public/fanz/imageFanz${paddedId}Skin000.png`;
  const videoUrl = `https://thebestfan.online/img/public/fanz/videoFanz${paddedId}Skin000.mp4`;

  if (i === 0) {
    return {
      id: `fanz-001`,
      name: `Baby Fanzzy`,
      sport: 'soccer',
      rarity: 'common',
      image: imageUrl,
      video: videoUrl,
      description: `Le tout premier supporter, prêt à mettre l'ambiance !`,
      baseStats: {
        force: 1,
        endurance: 1,
        mental: 1,
        bluff: 2,
        creativity: 1,
        social: 2,
        intelligence: 1,
        charisma: 1,
      },
      specialCards: ['card-bebe-1'],
      skins: [
        {
          id: 'skin-bebe-gold',
          fanzId: 'fanz-001',
          name: 'Bébé Fanzzy Gold',
          imageUrl: 'https://thebestfan.online/img/public/fanz/imageFanz001Skin001.png',
          price: { gems: 500 },
        }
      ],
      emotes: [
        {
          id: 'emote-bebe-cry',
          fanzId: 'fanz-001',
          name: 'Pleure',
          imageUrl: 'https://thebestfan.online/img/public/fanz/emoteFanz001Cry.png',
        },
        {
          id: 'emote-bebe-laugh',
          fanzId: 'fanz-001',
          name: 'Rigole',
          imageUrl: 'https://thebestfan.online/img/public/fanz/emoteFanz001Laugh.png',
        }
      ],
      ferveurPath: defaultFerveurPath
    };
  }
  return {
    id: `fanz-${paddedId}`,
    name: `Fanz #${i + 1}`,
    sport: 'soccer',
    rarity: i < 60 ? 'common' : i < 85 ? 'rare' : i < 95 ? 'epic' : 'legendary',
    image: imageUrl,
    video: videoUrl,
    description: `Un supporter passionné de soccer #${i + 1}.`,
    baseStats: {
      force: 1,
      endurance: 1,
      mental: 1,
      bluff: 1,
      creativity: 1,
      social: 1,
      intelligence: 1,
      charisma: 1,
    },
    specialCards: [],
    skins: [],
    emotes: [],
    ferveurPath: defaultFerveurPath
  };
});
