const fs = require('fs');
fetch('https://v3.football.api-sports.io/players/topscorers?league=1&season=2022', {
  headers: {
    'x-apisports-key': process.env.VITE_FOOTBALL_API_KEY || '5b3dff6da01201fbfa1f4ad5947aedae'
  }
}).then(res => res.json()).then(data => {
  console.log(JSON.stringify(data.response[0], null, 2));
});
