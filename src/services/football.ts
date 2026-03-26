import axios from 'axios';

const API_KEY = process.env.VITE_FOOTBALL_API_KEY;
const BASE_URL = 'https://v3.football.api-sports.io';

export const footballApi = axios.create({
  baseURL: BASE_URL,
  headers: {
    'x-rapidapi-key': API_KEY,
    'x-rapidapi-host': 'v3.football.api-sports.io',
  },
});

export const getLiveMatches = async () => {
  try {
    const response = await footballApi.get('/fixtures', {
      params: { live: 'all' },
    });
    return response.data.response;
  } catch (error) {
    console.error('Error fetching live matches:', error);
    return [];
  }
};
