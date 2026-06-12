export interface ResourceTransaction {
  id: string;
  userId: string;
  type: 'money' | 'gems' | 'boost' | 'energy' | 'ferveur_general' | 'ferveur_fanz';
  amount: number;
  description: string;
  fanzId?: string; // For ferveur_fanz
  createdAt: string;
}

export interface ActiveAction {
  fanzId: string;
  actionId: string;
  startTime: string;
  durationMinutes: number;
}

export interface UserProfile {
  uid: string;
  pseudo: string;
  unlockedVideos?: string[]; // Array of strings like "skinId_victory" or "skinId_defeat"
  seenMuseumItems?: string[]; // Permanent persistence for seen museum items
  displayName?: string;
  email: string;
  photoURL?: string;
  language?: string;
  dataSaver?: boolean;
  isMuted?: boolean;
  favoriteTeams: string[];
  money: number;
  gems: number;
  boostPoints: number;
  energy: number;
  maxEnergy?: number;
  lastEnergyRefill: string;
  skinEnergyBonus?: number;
  ferveurPoints: number;
  matchesParticipated?: number;
  totalScoreGiven?: number;
  matchesPlayed?: number;
  matchesWon?: number;
  totalScore?: number;
  win_count?: number; // Added for compatibility
  duel_count?: number; // Added for compatibility
  clicks_count?: number;
  cards_played_count?: number;
  emotes_sent_count?: number;
  duels_training_count?: number;
  duels_training_win_count?: number;
  duels_training_1v1_count?: number;
  duels_training_1v1_win_count?: number;
  duels_1v1_count?: number;
  duels_1v1_win_count?: number;
  duels_2v2_count?: number;
  duels_2v2_win_count?: number;
  duels_5v5_count?: number;
  duels_5v5_win_count?: number;
  duels_war_of_kops_count?: number;
  duels_war_of_kops_win_count?: number;
  level: number;
  teamSlots: number;
  cards: string[];
  skins: string[];
  emotes: string[];
  unlockedActions?: string[];
  role: 'admin' | 'moderator' | 'client';
  activeAction?: ActiveAction | null;
  streak: number;
  lastLoginDate?: string;
  boostXpUntil?: string;
  infiniteEnergyUntil?: string;
  antiMalusMatches?: number;
  doubleGainsUntil?: string;
  lastDailyMissionReset?: string; // YYYY-MM-DD
  lastWeeklyMissionReset?: string; // YYYY-MM-DD
  claimedStreakDays: number[]; // Days claimed in current week (1-7)
  missionsProgress?: Record<string, UserMissionProgress>;
  passId?: string;
  purchasedPasses?: string[];
  passPoints: number;
  passProgress?: Record<string, number>;
  isPassPremium: boolean;
  claimedPassRewards: string[]; // "level-X-free" or "level-X-premium"
  claimedFervorRewards?: string[];
  friends?: string[];
  friendRequests?: string[];
  activeFanzId?: string;
  hasCompletedOnboarding?: boolean;
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
  skinId?: string; // If defined, applies only when this skin is equipped
  name: string;
  image?: string;
  videoUrl?: string;
  skinTheme?: string; 
  skinOverrides?: Record<string, { image?: string; videoUrl?: string }>;
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
  videoUrl?: string; // Used for skin menu presentation
  victoryVideoUrl?: string; // Played on duel victory
  defeatVideoUrl?: string; // Played on duel defeat
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  price: {
    money?: number;
    gems?: number;
    boostPoints?: number;
  };
  category?: 'base' | 'event';
  isActive?: boolean;
  
  // Passive Bonuses
  statsBonus?: {
    force?: number;       // e.g. 5 for +5% Force
    mental?: number;      // e.g. 10 for +10% Mental
    intelligence?: number; // e.g. -5 for -5% Intelligence
    creativity?: number;
    bluff?: number;
    social?: number;
    charisma?: number;
    endurance?: number;
  };
  energyBonus?: number;    // Additional Max Energy (e.g., +20)
  fervorBonus?: number;    // % Bonus Fervor points in Duels (e.g. 15 for +15%)
  dropRateBonus?: number;  // % Bonus rewards in Duels (gains généraux)
  gemsBonus?: number;      // % Bonus gems
  moneyBonus?: number;     // % Bonus money
  boostBonus?: number;     // % Bonus boost points
  
  energyCostReduction?: number; // % reduction in energy cost of actions (e.g. 10 for -10%)
  moneyCostReduction?: number;  // % reduction in money cost of actions
  gemsCostReduction?: number;   // % reduction in gems cost of actions
  boostCostReduction?: number;  // % reduction in boost cost of actions
  
  // Specific features for skins
  specialCardId?: string;  // A unique Duel card ID that gets added to deck when skin is equipped
  specialActionId?: string; // A unique Life action ID that is unlocked when skin is equipped
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
  category?: 'base' | 'event';
  isActive?: boolean;
}

export interface FerveurLevel {
  id?: string;
  level?: number;
  displayLevel?: number;
  isIntermediate?: boolean;
  pointsRequired: number;
  reward?: {
    type: 'money' | 'gems' | 'boost' | 'energy' | 'xp' | 'card' | 'skin' | 'emote' | 'action' | 'choice' | 'team_slot' | 'fanz';
    amount?: number;
    cardId?: string;
    skinId?: string;
    emoteId?: string;
    actionId?: string;
    fanzId?: string;
    statName?: keyof FanzStats;
    choices?: any[];
  };
}

export interface RankReward {
  id: string; // rank-X-slot-Y
  type: 'money' | 'gems' | 'boost' | 'energy' | 'xp' | 'skin' | 'emote' | 'card' | 'action' | 'team_slot' | 'fanz' | 'choice';
  amount?: number;
  cardId?: string;
  skinId?: string;
  emoteId?: string;
  actionId?: string;
  fanzId?: string;
  statName?: keyof FanzStats;
  choices?: RankReward[];
}

export interface FanzTemplate {
  id: string;
  name: string;
  sport: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  image: string;
  video?: string;
  victoryVideoUrl?: string;
  defeatVideoUrl?: string;
  shortDescription?: string;
  longDescription?: string;
  battleCry?: string;
  description: string;
  baseExcitement?: number; // 1 to 10
  baseStats: FanzStats;
  specialAttackIds?: string[]; // 3 special attacks (Card IDs)
  lifeActionIds?: Record<string, string>; // Map of stat name to Action ID
  specialCards: string[];
  skins: FanzSkin[];
  emotes: FanzEmote[];
  ferveurConfig?: GlobalFervorConfig;
  ferveurPath?: FerveurLevel[];
  rankRewards?: Record<string, RankReward>;
  rankCosts?: Record<string, { money?: number; boostPoints?: number; gems?: number; energy?: number }>;
  isActive?: boolean;
  price?: {
    money?: number;
    gems?: number;
    boostPoints?: number;
  };
}

export interface Fanz {
  id: string;
  templateId: string;
  ownerUid: string;
  shortDescription?: string;
  longDescription?: string;
  battleCry?: string;
  specialAttackIds?: string[]; // 3 special attacks (Card IDs)
  lifeActionIds?: Record<string, string>; // Map of stat name to Action ID
  name: string;
  sport: string;
  imageUrl?: string;
  videoUrl?: string;
  victoryVideoUrl?: string;
  defeatVideoUrl?: string;
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
  rarity?: 'common' | 'rare' | 'epic' | 'legendary'; // Added for compatibility
  unlockedEmotes: string[];
  unlockedActions?: string[];
  ferveurPath?: FerveurLevel[];
  lifeActionProgress?: Record<string, { level: number; xp: number }>;
  cardProgress?: Record<string, { level: number; xp: number }>;
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
  | 'lucky_draw'
  | 'steal_energy'
  | 'cleanse'
  | 'vampirism'
  | 'fog_of_war'
  | 'frenzy'
  | 'sabotage'
  | 'immunity'
  | 'critical_strike'
  | 'momentum'
  | 'overload'
  | 'cancel_last_attack'
  | 'rage_quit_discard'
  | 'meta_update'
  | 'invert_rope'
  | 'blackout'
  | 'stealth_jacket_flip'
  | 'desert_crossing'
  | 'half_half_scarf'
  | 'megaphone_echo'
  | 'biological_curfew'
  | 'early_craquage'
  | 'laser_relaunch'
  | 'pro_tantrum'
  | 'multiball_chaos'
  | 'mental_main_courante'
  | 'heritage_weight'
  | 'buvette_alert'
  | 'tiktok_highlight'
  | 'boucher_district'
  | 'faux_rebond_excuse'
  | 'prime_goat'
  | 'attention_swipe'
  | 'sterile_debate'
  | 'curse'
  | 'blessing'
  | 'confetti'
  | 'golden_goal'
  | 'hypnosis'
  | 'pacifier_drama'
  | 'draw_cards'
  | 'mascot_bazooka'
  | 'steal_best_card'
  | 'discard_random_cards'
  | 'trade_stickers'
  | 'stun'
  | 'heavy_ball_boost'
  | 'throat_tackle'
  | 'mammoth_charge'
  | 'mascot_bone_drum'
  | 'scarves_wall'
  | 'virage_host'
  | 'clapping_odin'
  | 'corne_drakkar'
  | 'steal_object_card'
  | 'parrot_taunt'
  | 'pumpkin_fog'
  | 'locker_room_curse'
  | 'luminescent_standard'
  | 'buvette_grail'
  | 'var_illusion'
  | 'grimoire_chants'
  | 'chainsaw_megaphone'
  | 'burning_seats'
  | 'var_temporelle'
  | 'tifo_holographique'
  | 'capo_megaphone'
  | 'craquage_massif'
  | 'vol_ballon'
  | 'regard_chien_battu'
  | 'zoomies_chaos'
  | 'transfusion_tactique'
  | 'eclipse_artificielle'
  | 'coup_d_envoi_13h';

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
  isActive?: boolean;
  instanceId?: string; // For unique instances in hand
  name: string;
  type: 'bonus' | 'malus' | 'neutral';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  category?: string; // e.g. 'Chant', 'Sort', 'Objet'
  energyCost: number;
  fervorValue: number; // Value added to rope progress
  description: string;
  effects: CardEffect[];
  imageUrl?: string;
  videoUrl?: string;
  soundUrl?: string;
  lockerRoomCurseTriggered?: boolean;
  fanzIds?: string[]; // For specific cards
  blockedFanzIds?: string[]; // Blocked Fanz templates
  skinId?: string; // If defined, available only when this skin is equipped
  skinTheme?: string; // If defined, available if the skin name or ID contains this string (e.g., "viking")
  unlockRequirements?: CardUnlockRequirement[];
  price?: {
    money?: number;
    gems?: number;
    boostPoints?: number;
  };
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
  type: 'duel' | 'action' | 'social' | 'collection' | 'duel_count' | 'win_count' | 'fanz_duel' | 'life_action' | 'card_usage';
  target: number;
  reward: FerveurLevel['reward'];
  isActive: boolean;
  period?: 'daily' | 'weekly' | 'one_shot';
  conditionType?: 'global' | 'country' | 'team' | 'league' | 'season' | 'fanz' | 'skin' | 'card';
  conditionValue?: string;
  conditionSeason?: string;
  conditionLeague?: string;
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
  skinRewardId?: string;
  skinReward?: FanzSkin;
  conditionType?: 'global' | 'country' | 'team' | 'league' | 'season' | 'fanz' | 'skin' | 'card';
  conditionValue?: string;
  conditionSeason?: string;
  conditionLeague?: string;
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

export interface FervorRangeConfig {
  level: number;
  min: number;
  max: number;
  step: number;
  levelReward: NonNullable<FerveurLevel['reward']>;
  intermediateReward: NonNullable<FerveurLevel['reward']>;
}

export interface GlobalShopConfig {
  id: string;
  ferveurPacks: {
    id: string;
    name: string;
    price: number;
    numberOfRewards: number;
    description: string;
  }[];
  realMoneyPacks?: {
    id: string;
    name: string;
    priceEur: number;
    rewards: {
      type: 'gems' | 'money' | 'energy' | 'boost';
      amount?: number;
      boostId?: string;
    }[];
    image: string;
    popular?: boolean;
    bgColor?: string;
  }[];
  boosts?: {
    id: string;
    name: string;
    duration: string;
    price: number;
    currency: string;
    color: string;
  }[];
}

export interface GlobalFervorConfig {
  id: string; // 'default'
  ranges: FervorRangeConfig[];
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
  baseExcitementRegenTime?: number; // Time in seconds to regenerate 1 point of excitement
  statEffects: DuelStatEffect[];
  costs: {
    training: { money: number; energy: number };
    '1v1': { money: number; energy: number };
    '2v2': { money: number; energy: number };
    '5v5': { money: number; energy: number };
    war_of_kops: { money: number; energy: number };
  };
  rewards?: {
    training: { winXp: number; loseXp: number };
    '1v1': { winXp: number; loseXp: number };
    '2v2': { winXp: number; loseXp: number };
    '5v5': { winXp: number; loseXp: number };
    war_of_kops: { winXp: number; loseXp: number };
  };
  botFillTimer?: number;
  botClickRatePerSec?: number;
  botCardPlayChance?: number;
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
  isPrivate?: boolean;
  inviteCode?: string;
  invitedUids?: string[];
  trainingType?: '1v1' | 'solo';
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
  status: { long: string; short: string; elapsed?: number; extra?: number };
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
