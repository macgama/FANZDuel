const https = require('https');

const checkUrl = (url) => {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      resolve(res.statusCode);
    });
  });
};

(async () => {
  const found = [];
  for (let i = 1; i <= 60; i++) {
    const idStr = String(i).padStart(3, '0');
    const url = `https://thebestfan.online/img/public/duel/imageDuel${idStr}Level001.png`;
    const status = await checkUrl(url);
    if (status !== 404) {
      found.push(i);
      console.log(`Found: imageDuel${idStr}Level001.png (${status})`);
    }
  }
  console.log("All found:", found);
})();
