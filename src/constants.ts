export const LOGOS = {
  money: 'https://thebestfan.online/img/public/logo/logoDollar.png',
  gems: 'https://thebestfan.online/img/public/logo/logoGemme.png',
  boost: 'https://thebestfan.online/img/public/logo/logoBoost.png',
  energy: 'https://thebestfan.online/img/public/logo/logoEnergy.png',
  level: 'https://thebestfan.online/img/public/logo/logoLevel.png',
  ferveur: 'https://thebestfan.online/img/public/logo/logoFerveur.png',
};

export const COLORS = {
  bg: '#1a1a1a', // Dark grey
  ink: '#000000', // Black
  paper: '#ffffff', // White
  accent: '#ff6600', // Orange
};

export const INITIAL_USER_DATA = {
  money: 1000,
  gems: 5,
  boostPoints: 50,
  energy: 100,
  maxEnergy: 100,
  ferveurPoints: 0,
  level: 1,
  teamSlots: 2,
  cards: [] as string[],
  language: 'fr',
  passPoints: 0,
  isPassPremium: false,
  purchasedPasses: [],
  claimedPassRewards: [],
};

export const STAT_NAMES = [
  'force', 'endurance', 'mental', 'bluff', 'creativity', 'social', 'intelligence', 'charisma'
];
