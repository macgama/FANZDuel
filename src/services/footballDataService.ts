import { db, OperationType, handleFirestoreError } from '../firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  query, 
  where, 
  writeBatch,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { footballApi } from './footballApi';

export const footballDataService = {
  /**
   * Gets the current football season year (e.g., in March 2026, the season is 2025).
   */
  getCurrentSeasonYear(): number {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed, 0 = Jan, 6 = July
    return month < 7 ? year - 1 : year;
  },

  /**
   * Gets the last updated timestamp for a specific key.
   */
  async getLastUpdated(key: string): Promise<Date | null> {
    try {
      const docRef = doc(db, 'metadata', key);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.lastUpdated instanceof Timestamp) {
          return data.lastUpdated.toDate();
        }
      }
      return null;
    } catch (error) {
      console.error('Error getting last updated:', error);
      return null;
    }
  },

  /**
   * Sets the last updated timestamp for a specific key.
   */
  async setLastUpdated(key: string) {
    try {
      const docRef = doc(db, 'metadata', key);
      await setDoc(docRef, { lastUpdated: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error('Error setting last updated:', error);
    }
  },

  /**
   * Gets all leagues with Firestore caching.
   */
  async getLeagues(forceRefresh = false) {
    const cacheKey = 'leagues_list';
    const path = 'leagues';
    try {
      if (!forceRefresh) {
        const snapshot = await getDocs(collection(db, path));
        if (!snapshot.empty) {
          // Reconstruct the format expected by the UI (which matches API response)
          return snapshot.docs.map(d => {
            const data = d.data();
            return {
              league: { id: data.id, name: data.name, type: data.type, logo: data.logo },
              country: { name: data.country, code: data.countryCode, flag: data.countryFlag },
              seasons: [{ year: data.season, current: true }] // Simplified
            };
          });
        }
      }

      // Fetch from API
      const leagues = await footballApi.getLeagues();
      if (leagues && leagues.length > 0) {
        const chunkSize = 50;
        for (let i = 0; i < leagues.length; i += chunkSize) {
          const chunk = leagues.slice(i, i + chunkSize);
          const batch = writeBatch(db);
          chunk.forEach((l: any) => {
            const docRef = doc(db, path, l.league.id.toString());
            batch.set(docRef, {
              id: l.league.id,
              name: l.league.name,
              type: l.league.type,
              logo: l.league.logo,
              country: l.country.name,
              countryCode: l.country.code,
              countryFlag: l.country.flag,
              season: l.seasons?.sort((a: any, b: any) => b.year - a.year)[0]?.year || this.getCurrentSeasonYear()
            });
          });
          await batch.commit();
          await new Promise(resolve => setTimeout(resolve, 250));
        }
        await this.setLastUpdated(cacheKey);
      }
      return leagues || [];
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  /**
   * Gets the latest available season for a league.
   */
  async getLatestSeason(leagueId: number): Promise<number> {
    try {
      const leagueInfo = await footballApi.getLeagueInfo(leagueId);
      if (!leagueInfo || !leagueInfo.seasons) return this.getCurrentSeasonYear();
      
      // Find the latest season where current is true, or just the last one in the list
      const currentSeason = leagueInfo.seasons.find((s: any) => s.current);
      if (currentSeason) return currentSeason.year;
      
      const sortedSeasons = leagueInfo.seasons.sort((a: any, b: any) => b.year - a.year);
      return sortedSeasons[0].year;
    } catch (error) {
      console.error('Error getting latest season:', error);
      return this.getCurrentSeasonYear();
    }
  },

  /**
   * Gets standings for a league and season, with Firestore caching.
   */
  async getStandings(leagueId: number, season: number, forceRefresh = false) {
    const cacheKey = `standings_${leagueId}_${season}`;
    const path = `leagues/${leagueId}/seasons/${season}/standings`;
    try {
      if (!forceRefresh) {
        const snapshot = await getDocs(collection(db, path));
        if (!snapshot.empty) {
          const cachedStandings = snapshot.docs.map(doc => doc.data()).sort((a, b) => a.rank - b.rank);
          // If it's a major tournament and we seem to only have 1 group cached due to a previous bug, ignore cache
          const uniqueGroups = new Set(cachedStandings.map(s => s.group)).size;
          if (leagueId === 1 && uniqueGroups <= 1 && cachedStandings.length <= 4) {
             console.log("Incomplete cache detected, forcing refresh from API...");
          } else {
             return cachedStandings;
          }
        }
      }

      // Not in Firestore or force refresh, fetch from API
      const apiData = await footballApi.getStandings(leagueId, season);
      const standingsArrays = apiData[0]?.league?.standings || [];
      const standings = standingsArrays.flat();

      if (standings.length > 0) {
        // Cache in Firestore
        const chunkSize = 50;
        for (let i = 0; i < standings.length; i += chunkSize) {
          const chunk = standings.slice(i, i + chunkSize);
          const batch = writeBatch(db);
          chunk.forEach((s: any) => {
            const docRef = doc(db, path, s.team.id.toString());
            batch.set(docRef, { ...s, teamId: s.team.id, season });
          });
          await batch.commit();
          await new Promise(resolve => setTimeout(resolve, 250));
        }
        await this.setLastUpdated(cacheKey);
      }

      return standings || [];
    } catch (error: any) {
      if (error.message?.includes('API Data Error')) {
        console.error('API Error in getStandings:', error.message);
      } else {
        handleFirestoreError(error, OperationType.LIST, path);
      }
      return [];
    }
  },

  /**
   * Gets fixtures for a league and season, with Firestore caching.
   */
  async getFixtures(leagueId: number, season: number, forceRefresh = false) {
    const cacheKey = `fixtures_${leagueId}_${season}`;
    const path = `leagues/${leagueId}/seasons/${season}/slim_fixtures`;
    try {
      if (!forceRefresh) {
        const snapshot = await getDocs(collection(db, path));
        if (!snapshot.empty) {
          return snapshot.docs.map(doc => doc.data()).sort((a, b) => a.timestamp - b.timestamp);
        }
      }

      // Not in Firestore or force refresh, fetch from API
      const fixtures = await footballApi.getFixtures(leagueId, season);

      if (fixtures.length > 0) {
        // Cache in Firestore
        // Chunk into groups of 50 to avoid Firestore payload size limit
        const chunkSize = 50;
        for (let i = 0; i < fixtures.length; i += chunkSize) {
          const chunk = fixtures.slice(i, i + chunkSize);
          const batch = writeBatch(db);
          chunk.forEach((f: any) => {
            const docRef = doc(db, path, f.fixture.id.toString());
            // Strip potentially massive details when saving the full season list to avoid quota/size hits
            // e.g., players, lineups, statistics, events
            const { players, lineups, statistics, events, ...slimFixture } = f;
            batch.set(docRef, { ...slimFixture, season });
          });
          await batch.commit();
          await new Promise(resolve => setTimeout(resolve, 250));
        }
        await this.setLastUpdated(cacheKey);
      }

      return fixtures || [];
    } catch (error: any) {
      if (error.message?.includes('API Data Error')) {
        console.error('API Error in getFixtures:', error.message);
      } else {
        handleFirestoreError(error, OperationType.LIST, path);
      }
      return [];
    }
  },

  /**
   * Gets teams for a league and season, with Firestore caching.
   */
  async getTeams(leagueId: number, season: number, forceRefresh = false) {
    const cacheKey = `teams_${leagueId}_${season}`;
    const path = `leagues/${leagueId}/seasons/${season}/teams`;
    try {
      if (!forceRefresh) {
        const snapshot = await getDocs(collection(db, path));
        if (!snapshot.empty) {
          return snapshot.docs.map(doc => doc.data());
        }
      }

      // Not in Firestore or force refresh, fetch from API
      const teams = await footballApi.getTeams(leagueId, season);

      if (teams.length > 0) {
        const chunkSize = 50;
        for (let i = 0; i < teams.length; i += chunkSize) {
          const chunk = teams.slice(i, i + chunkSize);
          const batch = writeBatch(db);
          chunk.forEach((t: any) => {
            const docRef = doc(db, path, t.team.id.toString());
            batch.set(docRef, { ...t, season });
          });
          await batch.commit();
          await new Promise(resolve => setTimeout(resolve, 250));
        }
        await this.setLastUpdated(cacheKey);
      }

      return teams || [];
    } catch (error: any) {
      if (error.message?.includes('API Data Error')) {
        console.error('API Error in getTeams:', error.message);
      } else {
        handleFirestoreError(error, OperationType.LIST, path);
      }
      return [];
    }
  },

  /**
   * Gets fixtures for a team and season, with Firestore caching.
   */
  async getFixturesByTeam(teamId: number, season: number, forceRefresh = false) {
    const cacheKey = `fixtures_team_${teamId}_${season}`;
    const path = `teams/${teamId}/seasons/${season}/fixtures`;
    try {
      if (!forceRefresh) {
        const snapshot = await getDocs(collection(db, path));
        if (!snapshot.empty) {
          return snapshot.docs.map(doc => doc.data()).sort((a, b) => a.timestamp - b.timestamp);
        }
      }

      // Not in Firestore or force refresh, fetch from API
      const fixtures = await footballApi.getFixturesByTeam(teamId, season);

      if (fixtures.length > 0) {
        const chunkSize = 50;
        for (let i = 0; i < fixtures.length; i += chunkSize) {
          const chunk = fixtures.slice(i, i + chunkSize);
          const batch = writeBatch(db);
          chunk.forEach((f: any) => {
            const docRef = doc(db, path, f.fixture.id.toString());
            const { players, lineups, statistics, events, ...slimFixture } = f;
            batch.set(docRef, { ...slimFixture, season });
          });
          await batch.commit();
          await new Promise(resolve => setTimeout(resolve, 250));
        }
        await this.setLastUpdated(cacheKey);
      }

      return fixtures || [];
    } catch (error: any) {
      if (error.message?.includes('API Data Error')) {
        console.error('API Error in getFixturesByTeam:', error.message);
      } else {
        handleFirestoreError(error, OperationType.LIST, path);
      }
      return [];
    }
  },

  /**
   * Gets players for a team and season.
   */
  async getPlayers(teamId: number, season: number) {
    return await footballApi.getPlayers(teamId, season);
  }
};
