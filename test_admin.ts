import admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

admin.initializeApp({
  projectId: config.projectId,
  databaseURL: `https://${config.projectId}.firebaseio.com`
});

const db = admin.firestore();
db.settings({ databaseId: config.firestoreDatabaseId });

async function run() {
  const cardsSnapshot = await db.collection('cards').get();
  const cards = cardsSnapshot.docs.map(d => ({id: d.id, imageUrl: d.data().imageUrl, name: d.data().name}));
  fs.writeFileSync('./cards_admin.json', JSON.stringify(cards, null, 2));
  console.log("Export complete! Found", cards.length, "cards");
  process.exit();
}

run().catch(e => { console.error(e); process.exit(1); });
