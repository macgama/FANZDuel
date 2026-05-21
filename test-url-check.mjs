import https from 'https';

function check(url) {
  https.get(url, (res) => {
    console.log(url, res.statusCode);
  }).on('error', (e) => {
    console.error(url, e.message);
  });
}

check('https://thebestfan.online/img/public/fanz/imageFanz001Skin000.png');
check('https://thebestfan.online/img/fanz/imageFanz001Skin000.png');
check('https://thebestfan.online/img/fanz/001/imageFanz001Skin000.png');
check('https://thebestfan.online/fanz/001/imageFanz001Skin000.png');
check('https://thebestfan.online/public/fanz/001/imageFanz001Skin000.png');
