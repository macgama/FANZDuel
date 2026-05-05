const fs = require('fs');

const content = fs.readFileSync('src/constants/cards.ts', 'utf8');

const regex = /id:\s*'([^']+)',[\s\S]*?name:\s*'([^']+)'/g;

let match;
let count = 1;
while ((match = regex.exec(content)) !== null) {
  console.log(`${count}: ${match[1]} - ${match[2]}`);
  count++;
}
