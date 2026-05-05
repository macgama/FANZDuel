const fs = require('fs');
try {
  const data = JSON.parse(fs.readFileSync('cards_db.json', 'utf8'));
  const urls = data.map(c => c.imageUrl).filter(Boolean);
  console.log("Found urls in DB:");
  console.dir(urls.slice(0, 20), { maxArrayLength: null });
} catch (e) {
  console.error("Error:", e.message);
}
