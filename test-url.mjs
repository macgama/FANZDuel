import https from 'https';

const url = "https://firebasestorage.googleapis.com/v0/b/thebestfanonlinegas.firebasestorage.app/o/public%2Ffanz%2FimageFanz001.png?alt=media";

https.get(url, (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Content-Type:', res.headers['content-type']);
  console.log('Access-Control-Allow-Origin:', res.headers['access-control-allow-origin']);
}).on('error', (e) => {
  console.error(e);
});
