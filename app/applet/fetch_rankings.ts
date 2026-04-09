import axios from 'axios';

async function fetchRankings() {
  try {
    const res = await axios.get('http://localhost:3000/api/debug/rankings');
    console.log(JSON.stringify(res.data, null, 2));
  } catch (e) {
    console.error(e);
  }
}

fetchRankings();