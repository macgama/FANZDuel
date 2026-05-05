const https = require('https');
const ids = ['base_1', 'base_2', 'double-ferveur', 'bouclier-divin', 'seisme'];
const exts = ['.png', '.jpg', '.webp', '.jpeg'];
let checked = 0;
ids.forEach(id => {
  exts.forEach(ext => {
    https.get(`https://thebestfan.online/img/public/duel/${id}${ext}`, (res) => {
      if (res.statusCode !== 404) console.log(`${id}${ext}: ` + res.statusCode);
      checked++;
    });
    https.get(`https://thebestfan.online/public/duel/${id}${ext}`, (res) => {
      if (res.statusCode !== 404) console.log(`raw_${id}${ext}: ` + res.statusCode);
      checked++;
    });
  });
});
