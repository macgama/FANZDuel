const https = require('https');
const ids = [1, 2, 3, 4, 5, 24, 25, 26];

ids.forEach(i => {
  const idStr = String(i).padStart(3, '0');
  https.get(`https://thebestfan.online/img/public/duel/imageDuel${idStr}Level001.png`, (res) => {
    console.log(`id ${i}: ${res.statusCode}`);
  });
});
