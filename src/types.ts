export interface ActiveAction {
  fanzId: string;
  actionId: string;
  startTime: string;
  durationMinutes: number;
}

export interface UserProfile {
  uid: string;
  pseudo: string;
  displayName?: string;
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
  unlockedActions?: string[];
  role: 'admin' | 'moderator' | 'client';
  language?: string;
  activeAction?: ActiveAction | null;
  streak: number;
  lastLoginDate?: string;
  claimedStreakDays: number[]; // Days claimed in current week (1-7)
  missionsProgress?: Record<string, UserMissionProgress>;
  passId?: string;
  passPoints: number;
  isPassPremium: boolean;
  claimedPassRewards: string[]; // "level-X-free" or "level-X-premium"
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
  price: {
    money?: number;
    gems?: number;
    boostPoints?: number;
  };
}

export interface FanzEmote {
  id: string;
  fanzId: string;
  imageUrl: string;
  videoUrl?: string;
  name: string;
  price?: {
    money?: number;
    gems?: number;
    boostPoints?: number;
  };
}

export interface FerveurLevel {
  id?: string;
  level?: number;
  isIntermediate?: boolean;
  pointsRequired: number;
  reward?: {
    type: 'money' | 'gems' | 'boost' | 'energy' | 'xp' | 'card' | 'skin' | 'emote' | 'action' | 'choice';
    amount?: number;
    cardId?: string;
    skinId?: string;
    emoteId?: string;
    actionId?: string;
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
  baseExcitement?: number; // 1 to 10
  baseStats: FanzStats;
  specialCards: string[];
  skins: FanzSkin[];
  emotes: FanzEmote[];
  ferveurPath?: FerveurLevel[];
  rankRewards?: Record<string, RankReward>;
}

export interface Fanz {
  id: string;
  templateId: string;
  ownerUid: string;
  name: string;
  sport: string;
  imageUrl?: string;
  videoUrl?: string;
  baseExcitement?: number; // 1 to 10
  stats: FanzStats;
  xp: number;
  level: number;
  rank: number; // 1 to 10, paid with Money/Boosts
  ferveurPoints: number;
  ferveurLevel: number;
  energy: number;
  equippedCards: string[]; // Max 8
  deck: string[]; // Max 8
  unlockedSkins: string[];
  equippedSkin?: string;
  unlockedEmotes: string[];
  unlockedActions?: string[];
  lifeActionProgress?: Record<string, { level: number; xp: number }>;
  claimedChoices?: Record<string, any>;
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
  fervorValue: number; // Value added to rope progress
  description: string;
  effects: CardEffect[];
  imageUrl?: string;
  videoUrl?: string;
  fanzIds?: string[]; // For specific cards
  blockedFanzIds?: string[]; // Blocked Fanz templates
  unlockRequirements?: CardUnlockRequirement[];
}

export interface UserCard {
  id: string; // cardId
  ownerUid: string;
  level: number;
  xp: number;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  type: 'duel' | 'action' | 'social' | 'collection' | 'duel_count' | 'win_count' | 'fanz_duel' | 'life_action';
  target: number;
  reward: FerveurLevel['reward'];
  isActive: boolean;
}

export interface UserMissionProgress {
  missionId: string;
  currentValue: number;
  isClaimed: boolean;
  isCompleted: boolean;
}

export interface PassLevel {
  level: number;
  pointsRequired: number;
  freeReward?: FerveurLevel['reward'];
  premiumReward?: FerveurLevel['reward'];
}

export interface Pass {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  startDate: string;
  endDate: string;
  levels: PassLevel[];
  priceGems: number;
  isActive: boolean;
  premiumPrice: {
    money?: number;
    gems?: number;
    boostPoints?: number;
  };
}

export interface WeeklyStreakConfig {
  day: number; // 1 to 7
  reward: FerveurLevel['reward'];
}

export interface WeeklyStreakCycle {
  id: string;
  name: string;
  isActive: boolean;
  days: WeeklyStreakConfig[];
}

export interface GlobalFervorConfig {
  id: string; // 'default'
  levels: FerveurLevel[];
}

export interface DuelStatEffect {
  statName: keyof FanzStats;
  effectType: 'click_power' | 'energy_regen' | 'malus_duration' | 'visual_malus_duration' | 'card_cost_reduction' | 'ferveur_bonus' | 'rarity_chance' | 'card_power' | 'max_energy' | 'start_energy' | 'button_visibility' | 'button_hidden';
  baseValue: number;
  multiplierPerLevel: number;
  description: string;
}

export interface DuelConfig {
  id: string; // 'default'
  statEffects: DuelStatEffect[];
  costs: {
    training: { money: number; energy: number };
    '1v1': { money: number; energy: number };
    '2v2': { money: number; energy: number };
    '5v5': { money: number; energy: number };
    war_of_kops: { money: number; energy: number };
  };
}

export interface DuelParticipant {
  uid: string;
  pseudo: string;
  team: 'A' | 'B';
  fanzId: string;
  ready: boolean;
  progress: number;
  energy: number;
  hand: string[]; // card IDs
  deck: string[]; // card IDs
}

export interface Duel {
  id: string;
  type: 'training' | '1v1' | '2v2' | '5v5' | 'war_of_kops';
  status: 'waiting' | 'starting' | 'active' | 'finished';
  matchId?: string;
  teamA: string; // Team name or ID
  teamB: string; // Team name or ID
  progress: number; // 0 to 100 (50 is center)
  participants: DuelParticipant[];
  startTime?: string;
  winner?: 'A' | 'B';
  createdAt: string;
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
