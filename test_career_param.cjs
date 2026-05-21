const fs = require('fs');

async function test() {
  const headers = { 'x-apisports-key': process.env.VITE_FOOTBALL_API_KEY || '5b3dff6da01201fbfa1f4ad5947aedae' };
  
  const res = await fetch("https://v3.football.api-sports.io/players?id=1374", { headers });
  const data = await res.json();
  console.log("Stats without season:", JSON.stringify(data, null, 2));
}

test();
