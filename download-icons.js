import https from 'https';
import fs from 'fs';
import path from 'path';

const url = 'https://thebestfan.online/img/public/logo/logoFerveur.png';
const publicDir = path.resolve(process.cwd(), 'public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const file = fs.createWriteStream(path.join(publicDir, 'logo-192.png'));
const file2 = fs.createWriteStream(path.join(publicDir, 'logo-512.png'));

https.get(url, function(response) {
  response.pipe(file);
});

https.get(url, function(response) {
  response.pipe(file2);
});

console.log('Icons downloaded');
