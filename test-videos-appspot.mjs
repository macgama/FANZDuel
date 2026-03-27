import https from 'https';

const urls = [
  'https://firebasestorage.googleapis.com/v0/b/thebestfanonlinegas.appspot.com/o/public%2Ffanz%2FvideoFanz001.mp4?alt=media',
  'https://firebasestorage.googleapis.com/v0/b/thebestfanonlinegas.appspot.com/o/public%2Ffanz%2FvideoFanz001Skin001.mp4?alt=media'
];

urls.forEach(url => {
  https.get(url, (res) => {
    console.log(`URL: ${url}`);
    console.log(`Status: ${res.statusCode}`);
    res.on('data', () => {}); // consume data
  }).on('error', (e) => {
    console.error(`Error for ${url}: ${e.message}`);
  });
});
