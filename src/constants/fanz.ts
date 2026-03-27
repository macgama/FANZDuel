import { FanzStats, LifeAction, FanzSkin, FanzEmote, FanzTemplate } from '../types';

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
      ferveurPath: [
        { level: 1, pointsRequired: 249, reward: { type: 'money', amount: 100 } },
        { level: 2, pointsRequired: 499, reward: { type: 'money', amount: 100 } },
        { level: 3, pointsRequired: 749, reward: { type: 'money', amount: 100 } },
        { level: 4, pointsRequired: 999, reward: { type: 'money', amount: 100 } },
        { level: 5, pointsRequired: 1000, reward: { type: 'money', amount: 100 } }
      ],
      recurringRewards: [
        { points: 20, type: 'money', amount: 100 }
      ]
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
    ferveurPath: [
      { level: 1, pointsRequired: 249, reward: { type: 'money', amount: 100 } },
      { level: 2, pointsRequired: 499, reward: { type: 'money', amount: 100 } },
      { level: 3, pointsRequired: 749, reward: { type: 'money', amount: 100 } },
      { level: 4, pointsRequired: 999, reward: { type: 'money', amount: 100 } },
      { level: 5, pointsRequired: 1000, reward: { type: 'money', amount: 100 } }
    ],
    recurringRewards: [
      { points: 20, type: 'money', amount: 100 }
    ]
  };
});
