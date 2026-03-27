const https = require('https');

const urls = [
  "https://firebasestorage.googleapis.com/v0/b/thebestfanonlinegas.firebasestorage.app/o/public%2Ffanz%2FimageFanz001.png?alt=media",
  "https://firebasestorage.googleapis.com/v0/b/thebestfanonlinegas.appspot.com/o/public%2Ffanz%2FimageFanz001.png?alt=media"
];

urls.forEach(url => {
  https.get(url, (res) => {
    console.log(url);
    console.log('Status Code:', res.statusCode);
  }).on('error', (e) => {
    console.error(e);
  });
});
