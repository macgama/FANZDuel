export interface ActiveAction {
  fanzId: string;
  actionId: string;
  startTime: string;
  durationMinutes: number;
}

export interface UserProfile {
  uid: string;
  pseudo: string;
  email: string;
  photoURL?: string;
  favoriteTeams: string[];
  money: number;
  gems: number;
  boostPoints: number;
  energy: number;
  lastEnergyRefill: string;
  ferveurPoints: number;
  level: number;
  teamSlots: number;
  cards: string[];
  skins: string[];
  emotes: string[];
  role: 'admin' | 'client';
  language?: string;
  activeAction?: ActiveAction | null;
}

export interface FanzStats {
  force: number;
  endurance: number;
  mental: number;
  bluff: number;
  creativity: number;
  social: number;
  intelligence: number;
  charisma: number;
}

export interface LifeAction {
  id: string;
  fanzTemplateId?: string; // If undefined, applies to all Fanz
  name: string;
  image?: string;
  videoUrl?: string;
  targetStat?: keyof FanzStats; // Legacy, kept for compatibility
  xpGain?: number; // Legacy, kept for compatibility
  
  // Costs
  energyCost?: number;
  moneyCost?: number;
  gemsCost?: number;
  boostCost?: number;

  // Gains
  energyGain?: number;
  moneyGain?: number;
  gemsGain?: number;
  boostGain?: number;

  // XP Gains per stat
  xpGains?: Partial<FanzStats>;

  durationMinutes: number;
}

export interface FanzSkin {
  id: string;
  fanzId: string;
  name: string;
  imageUrl: string;
  videoUrl?: string;
  price: { type: 'money' | 'gems' | 'boostPoints'; amount: number };
}

export interface FanzEmote {
  id: string;
  fanzId: string;
  imageUrl: string;
  name: string;
}

export interface FerveurLevel {
  level: number;
  pointsRequired: number;
  reward?: {
    type: 'money' | 'gems' | 'boost' | 'xp' | 'card' | 'skin' | 'emote' | 'choice';
    amount?: number;
    cardId?: string;
    skinId?: string;
    emoteId?: string;
    statName?: keyof FanzStats;
  };
}

export interface RankReward {
  id: string; // rank-X-slot-Y
  type: 'xp' | 'card' | 'choice' | 'skin' | 'emote';
  amount?: number;
  cardId?: string;
  skinId?: string;
  emoteId?: string;
}

export interface FanzTemplate {
  id: string;
  name: string;
  sport: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  image: string;
  video?: string;
  description: string;
  baseStats: FanzStats;
  specialCards: string[];
  skins: FanzSkin[];
  emotes: FanzEmote[];
  ferveurPath?: FerveurLevel[];
  rankRewards?: Record<string, RankReward>;
  recurringReward?: {
    points: number;
    type: 'money' | 'boost';
    amount: number;
  };
}

export interface Fanz {
  id: string;
  templateId: string;
  ownerUid: string;
  name: string;
  sport: string;
  imageUrl?: string;
  videoUrl?: string;
  stats: FanzStats;
  xp: number;
  level: number;
  rank: number; // 1 to 10, paid with Money/Boosts
  ferveurPoints: number;
  ferveurLevel: number;
  energy: number;
  equippedCards: string[]; // Max 8
  unlockedSkins: string[];
  equippedSkin?: string;
  unlockedEmotes: string[];
  lifeActionProgress?: Record<string, { level: number; xp: number }>;
  claimedRewards?: string[]; // Array of slot IDs like "rank-1-slot-1"
}

export type CardEffectType = 
  | 'push_rope' 
  | 'drain_energy' 
  | 'refill_energy' 
  | 'hide_button' 
  | 'shrink_button' 
  | 'move_button' 
  | 'blur_view' 
  | 'hide_score' 
  | 'discard_enemy_cards' 
  | 'shuffle_deck'
  | 'freeze_button'
  | 'double_points'
  | 'shield'
  | 'mirror'
  | 'energy_regen_boost'
  | 'earthquake'
  | 'fake_buttons'
  | 'card_lock'
  | 'swap_hands'
  | 'mimic'
  | 'lucky_draw';

export interface CardEffect {
  type: CardEffectType;
  value?: number;
  duration?: number; // in seconds
}

export interface CardUnlockRequirement {
  type: 'skill' | 'ferveur' | 'rank';
  skillName?: keyof FanzStats;
  minLevel: number;
}

export interface Card {
  id: string;
  instanceId?: string; // For unique instances in hand
  name: string;
  type: 'bonus' | 'malus' | 'neutral';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  energyCost: number;
  description: string;
  effects: CardEffect[];
  imageUrl?: string;
  videoUrl?: string;
  fanzIds?: string[]; // For specific cards
  unlockRequirements?: CardUnlockRequirement[];
}

export interface UserCard {
  id: string; // cardId
  ownerUid: string;
  level: number;
  xp: number;
}

export interface Duel {
  id: string;
  type: 'training' | '1v1' | '2v2' | '5v5' | 'war_of_kops';
  status: 'waiting' | 'active' | 'finished';
  matchId?: string;
  teamA: string;
  teamB: string;
  progress: number;
  participants: string[];
}

export interface League {
  id: number;
  name: string;
  type: string;
  logo: string;
  country: string;
  countryCode?: string;
  countryFlag?: string;
  season: number;
}

export interface Team {
  id: number;
  name: string;
  code?: string;
  country: string;
  founded?: number;
  logo: string;
  venue?: {
    id?: number;
    name?: string;
    address?: string;
    city?: string;
    capacity?: number;
    surface?: string;
    image?: string;
  };
}

export interface Standing {
  rank: number;
  teamId: number;
  points: number;
  goalsDiff: number;
  group?: string;
  form?: string;
  status?: string;
  description?: string;
  all: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: { for: number; against: number };
  };
  home: any;
  away: any;
  update: string;
}

export interface Fixture {
  id: number;
  referee?: string;
  timezone: string;
  date: string;
  timestamp: number;
  periods: { first?: number; second?: number };
  venue: { id?: number; name?: string; city?: string };
  status: { long: string; short: string; elapsed?: number };
  league: { id: number; name: string; country: string; logo: string; flag?: string; season: number; round: string };
  teams: {
    home: { id: number; name: string; logo: string; winner?: boolean };
    away: { id: number; name: string; logo: string; winner?: boolean };
  };
  goals: { home?: number; away?: number };
  score: {
    halftime: { home?: number; away?: number };
    fulltime: { home?: number; away?: number };
    extratime: { home?: number; away?: number };
    penalty: { home?: number; away?: number };
  };
}
