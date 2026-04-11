export const LOGOS = {
  money: 'https://firebasestorage.googleapis.com/v0/b/thebestfanonlinegas.firebasestorage.app/o/public%2Flogo%2FlogoDollar.png?alt=media',
  gems: 'https://firebasestorage.googleapis.com/v0/b/thebestfanonlinegas.firebasestorage.app/o/public%2Flogo%2FlogoGemme.png?alt=media',
  boost: 'https://firebasestorage.googleapis.com/v0/b/thebestfanonlinegas.firebasestorage.app/o/public%2Flogo%2FlogoBoost.png?alt=media',
  energy: 'https://firebasestorage.googleapis.com/v0/b/thebestfanonlinegas.firebasestorage.app/o/public%2Flogo%2FlogoEnergy.png?alt=media',
  level: 'https://firebasestorage.googleapis.com/v0/b/thebestfanonlinegas.firebasestorage.app/o/public%2Flogo%2FlogoLevel.png?alt=media',
  ferveur: 'https://firebasestorage.googleapis.com/v0/b/thebestfanonlinegas.firebasestorage.app/o/public%2Flogo%2FlogoFerveur.png?alt=media',
};

export const COLORS = {
  bg: '#1a1a1a', // Dark grey
  ink: '#000000', // Black
  paper: '#ffffff', // White
  accent: '#ff6600', // Orange
};

export const FERVEUR_LEVELS = [
  0, 15000, 50000, 150000, 300000, 600000, 1000000, 1500000, 2500000, 4000000, 6000000, 8500000, 11000000, 13000000, 15000000
];

export const FANZ_FERVEUR_LEVELS = [0, 1000, 3000, 7500, 15000, 30000, 50000, 75000, 100000, 150000];

export const INITIAL_USER_DATA = {
  money: 1000,
  gems: 5,
  boostPoints: 50,
  energy: 100,
  maxEnergy: 100,
  ferveurPoints: 0,
  level: 1,
  teamSlots: 2,
  cards: [],
  language: 'fr',
  passPoints: 0,
  isPassPremium: false,
  purchasedPasses: [],
  claimedPassRewards: [],
};

export const STAT_NAMES = [
  'force', 'endurance', 'mental', 'bluff', 'creativity', 'social', 'intelligence', 'charisma'
];
