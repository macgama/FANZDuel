const https = require('https');
https.get('https://thebestfan.online/img/public/duel/imageDuel001Level001.png', (res) => console.log('img: ' + res.statusCode));
https.get('https://thebestfan.online/public/duel/imageDuel001Level001.png', (res) => console.log('root: ' + res.statusCode));
