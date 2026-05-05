const https = require('https');

const checkUrl = (url) => {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      resolve(res.statusCode);
    });
  });
};

(async () => {
  for (let i = 2; i <= 5; i++) {
    const idStr = String(i).padStart(3, '0');
    for (let ext of ['.png', '.jpg', '.jpeg', '.webp']) {
      const url = `https://thebestfan.online/img/public/duel/imageDuel${idStr}Level001${ext}`;
      const status = await checkUrl(url);
      if (status !== 404) {
        console.log(`Found: imageDuel${idStr}Level001${ext} (${status})`);
      }
    }
  }
})();
