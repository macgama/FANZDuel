export interface UserProfile {
  uid: string;
  pseudo: string;
  email: string;
  favoriteTeams: string[];
  money: number;
  gems: number;
  boostPoints: number;
  energy: number;
  lastEnergyRefill: string;
  ferveurPoints: number;
  level: number;
  slots: number;
  role: 'admin' | 'client';
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

export interface Fanz {
  id: string;
  ownerUid: string;
  name: string;
  sport: string;
  stats: FanzStats;
  xp: number;
  level: number;
  ferveurPoints: number;
  ferveurLevel: number;
  energy: number;
}

export interface Card {
  id: string;
  name: string;
  type: 'common' | 'specific';
  power: number;
  energyCost: number;
  description: string;
  fanzIds?: string[]; // For specific cards
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
