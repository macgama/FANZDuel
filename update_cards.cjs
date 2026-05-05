const fs = require('fs');
let content = fs.readFileSync('src/constants/cards.ts', 'utf8');
const lines = content.split('\n');
let currentId = '';
for (let i = 0; i < lines.length; i++) {
  const idMatch = lines[i].match(/id:\s*'([^']+)'/);
  if (idMatch) {
    currentId = idMatch[1];
  }
  if (lines[i].includes('imageUrl:') && lines[i].includes('picsum.photos')) {
    lines[i] = lines[i].replace(/'https:\/\/picsum\.photos[^']+'/, `'https://thebestfan.online/public/duel/${currentId}.png'`);
  }
}
fs.writeFileSync('src/constants/cards.ts', lines.join('\n'));
