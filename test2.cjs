const https = require('https');
https.get('https://thebestfan.online/public/duel/base_1.jpg', (res) => console.log('1.jpg: ' + res.statusCode));
https.get('https://thebestfan.online/img/public/duel/base_1.jpg', (res) => console.log('img_1.jpg: ' + res.statusCode));
https.get('https://thebestfan.online/public/duel/dos.jpg', (res) => console.log('dos.jpg: ' + res.statusCode));
https.get('https://thebestfan.online/public/duel/fond.jpg', (res) => console.log('fond.jpg: ' + res.statusCode));
