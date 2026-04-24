const BASE_URL = '/api/football/';

async function fetchApi(url: string) {
  try {
    // We now use the server-side proxy, so we don't need to send the API key from the client.
    // This avoids CORS issues and keeps the API key secure.
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API Error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.details) errorMessage = `${errorMessage} - ${JSON.stringify(errorJson.details)}`;
        else if (errorJson.message) errorMessage = `${errorMessage} - ${errorJson.message}`;
        else if (errorJson.error) errorMessage = `${errorMessage} - ${errorJson.error}`;
      } catch (e) {
        // Not JSON
        if (errorText) errorMessage = `${errorMessage} - ${errorText.substring(0, 100)}`;
      }
      console.error(`API Error (${response.status}): ${errorText}`);
      throw new Error(errorMessage);
    }
    const data = await response.json();
    if (data.errors && Object.keys(data.errors).length > 0) {
      const errorMsg = JSON.stringify(data.errors);
      console.error('API Data Errors:', errorMsg);
      throw new Error(`API Data Error: ${errorMsg}`);
    }
    return data;
  } catch (error: any) {
    if (error?.message !== 'Failed to fetch') {
      console.error(`Fetch error for ${url}:`, error);
    }
    throw error;
  }
}

export const footballApi = {
  async getSeasons() {
    const data = await fetchApi(`${BASE_URL}leagues/seasons`);
    return data.response as number[];
  },

  async getLeagues(season?: number, leagueId?: number) {
    let url = `${BASE_URL}leagues`;
    const params = new URLSearchParams();
    
    if (leagueId) params.append('id', leagueId.toString());
    if (season) params.append('season', season.toString());
    
    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;
    
    const data = await fetchApi(url);
    return data.response;
  },

  async getLeagueInfo(leagueId: number) {
    if (!leagueId) throw new Error('Invalid leagueId');
    const data = await fetchApi(`${BASE_URL}leagues?id=${leagueId}`);
    return data.response[0];
  },

  async getTeams(leagueId: number, season: number) {
    if (!leagueId || !season) throw new Error('Invalid leagueId or season');
    const data = await fetchApi(`${BASE_URL}teams?league=${leagueId}&season=${season}`);
    return data.response;
  },

  async getTeamInfo(teamId: number) {
    if (!teamId) throw new Error('Invalid teamId');
    const data = await fetchApi(`${BASE_URL}teams?id=${teamId}`);
    return data.response[0];
  },

  async searchTeams(search: string) {
    const data = await fetchApi(`${BASE_URL}teams?search=${search}`);
    return data.response;
  },

  async getTeamStats(leagueId: number, teamId: number, season: number) {
    if (!leagueId || !teamId || !season) throw new Error('Invalid parameters for team stats');
    const data = await fetchApi(`${BASE_URL}teams/statistics?league=${leagueId}&team=${teamId}&season=${season}`);
    return data.response;
  },

  async getStandings(leagueId: number, season: number) {
    if (!leagueId || !season) throw new Error('Invalid leagueId or season');
    const data = await fetchApi(`${BASE_URL}standings?league=${leagueId}&season=${season}`);
    return data.response;
  },

  async getFixtures(leagueId: number, season: number) {
    if (!leagueId || !season) throw new Error('Invalid leagueId or season');
    const data = await fetchApi(`${BASE_URL}fixtures?league=${leagueId}&season=${season}`);
    return data.response;
  },

  async getFixturesByDate(date: string) {
    const data = await fetchApi(`${BASE_URL}fixtures?date=${date}`);
    return data.response;
  },

  async getLiveFixtures() {
    const data = await fetchApi(`${BASE_URL}fixtures?live=all`);
    return data.response;
  },

  async getInjuries(leagueId: number, season: number) {
    const data = await fetchApi(`${BASE_URL}injuries?league=${leagueId}&season=${season}`);
    return data.response;
  },

  async getFixtureDetails(fixtureId: number) {
    const data = await fetchApi(`${BASE_URL}fixtures?id=${fixtureId}`);
    return data.response[0];
  },

  async getFixturesByIds(fixtureIds: number[]) {
    if (!fixtureIds || fixtureIds.length === 0) return [];
    const idsString = fixtureIds.join('-');
    const data = await fetchApi(`${BASE_URL}fixtures?ids=${idsString}`);
    return data.response;
  },

  async getFixtureEvents(fixtureId: number) {
    const data = await fetchApi(`${BASE_URL}fixtures/events?fixture=${fixtureId}`);
    return data.response;
  },

  async getFixtureLineups(fixtureId: number) {
    const data = await fetchApi(`${BASE_URL}fixtures/lineups?fixture=${fixtureId}`);
    return data.response;
  },

  async getFixtureStatistics(fixtureId: number) {
    const data = await fetchApi(`${BASE_URL}fixtures/statistics?fixture=${fixtureId}`);
    return data.response;
  },

  async getTopScorers(leagueId: number, season: number) {
    const data = await fetchApi(`${BASE_URL}players/topscorers?league=${leagueId}&season=${season}`);
    return data.response;
  },

  async getTopAssists(leagueId: number, season: number) {
    const data = await fetchApi(`${BASE_URL}players/topassists?league=${leagueId}&season=${season}`);
    return data.response;
  },

  async getTopYellowCards(leagueId: number, season: number) {
    const data = await fetchApi(`${BASE_URL}players/topyellowcards?league=${leagueId}&season=${season}`);
    return data.response;
  },

  async getTopRedCards(leagueId: number, season: number) {
    const data = await fetchApi(`${BASE_URL}players/topredcards?league=${leagueId}&season=${season}`);
    return data.response;
  },

  async getPlayers(teamId: number, season: number) {
    const data = await fetchApi(`${BASE_URL}players?team=${teamId}&season=${season}`);
    return data.response;
  },

  async getFixturesByTeam(teamId: number, season: number) {
    const data = await fetchApi(`${BASE_URL}fixtures?team=${teamId}&season=${season}`);
    return data.response;
  },

  async getLeaguesByTeam(teamId: number) {
    const data = await fetchApi(`${BASE_URL}leagues?team=${teamId}`);
    return data.response;
  }
};
