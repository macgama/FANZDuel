const fs = require('fs');

async function test() {
  const headers = { 'x-apisports-key': process.env.VITE_FOOTBALL_API_KEY || '5b3dff6da01201fbfa1f4ad5947aedae' };
  
  const [profileRes, statsRes] = await Promise.all([
    fetch("https://v3.football.api-sports.io/players/profiles?player=1374", { headers }),
    fetch("https://v3.football.api-sports.io/players?id=1374&season=2022", { headers })
  ]);
  
  const profile = await profileRes.json();
  const stats = await statsRes.json();
  
  console.log("PROFILE:", JSON.stringify(profile.response[0], null, 2));
  console.log("STATS:", JSON.stringify(stats.response[0], null, 2));
}

test();
