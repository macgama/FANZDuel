export interface FanzTemplate {
  id: string;
  name: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  image: string;
  description: string;
}

export const ALL_FANZ: FanzTemplate[] = Array.from({ length: 100 }, (_, i) => ({
  id: `fanz-${i + 1}`,
  name: `Fanz #${i + 1}`,
  rarity: i < 60 ? 'common' : i < 85 ? 'rare' : i < 95 ? 'epic' : 'legendary',
  image: `https://picsum.photos/seed/fanz${i + 1}/200/300`,
  description: `Un supporter passionné de soccer #${i + 1}.`,
}));
