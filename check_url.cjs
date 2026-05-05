const https = require('https');
https.get('https://thebestfan.online/img/public/duel/base_1.jpg', (res) => console.log('jpg: ' + res.statusCode));
https.get('https://thebestfan.online/img/public/duel/base_1.webp', (res) => console.log('webp: ' + res.statusCode));
https.get('https://thebestfan.online/img/public/duel/base_1.png', (res) => console.log('png: ' + res.statusCode));
https.get('https://thebestfan.online/img/public/duel/base_1.jpeg', (res) => console.log('jpeg: ' + res.statusCode));
