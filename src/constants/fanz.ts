import { FanzStats, LifeAction, FanzSkin, FanzEmote, FanzTemplate, FerveurLevel } from '../types';

const defaultFerveurPath: FerveurLevel[] = [];
for (let pts = 25; pts <= 1000; pts += 25) {
  if (pts === 250) {
    defaultFerveurPath.push({ level: 2, pointsRequired: 250, reward: { type: 'money', amount: 100 } });
  } else if (pts === 500) {
    defaultFerveurPath.push({ level: 3, pointsRequired: 500, reward: { type: 'money', amount: 100 } });
  } else if (pts === 750) {
    defaultFerveurPath.push({ level: 4, pointsRequired: 750, reward: { type: 'money', amount: 100 } });
  } else if (pts === 1000) {
    defaultFerveurPath.push({ level: 5, pointsRequired: 1000, reward: { type: 'money', amount: 100 } });
  } else {
    defaultFerveurPath.push({ isIntermediate: true, pointsRequired: pts, reward: { type: 'money', amount: 25 } });
  }
}

export const ALL_FANZ: FanzTemplate[] = Array.from({ length: 100 }, (_, i) => {
  const paddedId = String(i + 1).padStart(3, '0');
  const imageUrl = `gs://thebestfanonlinegas.firebasestorage.app/public/fanz/imageFanz${paddedId}Skin000.png`;
  const videoUrl = `gs://thebestfanonlinegas.firebasestorage.app/public/fanz/videoFanz${paddedId}Skin000.mp4`;

  if (i === 0) {
    return {
      id: `fanz-1`,
      name: `Bébé Fanzzy`,
      sport: 'soccer',
      rarity: 'legendary',
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
          fanzId: 'fanz-1',
          name: 'Bébé Fanzzy Gold',
          imageUrl: 'gs://thebestfanonlinegas.firebasestorage.app/public/fanz/imageFanz001Skin001.png',
          price: { gems: 500 },
        }
      ],
      emotes: [
        {
          id: 'emote-bebe-cry',
          fanzId: 'fanz-1',
          name: 'Pleure',
          imageUrl: 'gs://thebestfanonlinegas.firebasestorage.app/public/fanz/emoteFanz001Cry.png',
        },
        {
          id: 'emote-bebe-laugh',
          fanzId: 'fanz-1',
          name: 'Rigole',
          imageUrl: 'gs://thebestfanonlinegas.firebasestorage.app/public/fanz/emoteFanz001Laugh.png',
        }
      ],
      ferveurPath: defaultFerveurPath
    };
  }
  return {
    id: `fanz-${i + 1}`,
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
