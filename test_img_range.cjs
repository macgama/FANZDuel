const https = require('https');

const checkUrl = (url) => {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      resolve(res.statusCode);
    });
  });
};

(async () => {
  for (let i = 1; i <= 30; i++) {
    const idStr = String(i).padStart(3, '0');
    for (let lvl = 1; lvl <= 2; lvl++) {
      const lvlStr = String(lvl).padStart(3, '0');
      const url = `https://thebestfan.online/img/public/duel/imageDuel${idStr}Level${lvlStr}.png`;
      const status = await checkUrl(url);
      if (status !== 404) {
        console.log(`Found: imageDuel${idStr}Level${lvlStr}.png (${status})`);
      }
    }
  }
})();
