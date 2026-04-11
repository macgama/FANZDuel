import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const snap = await getDoc(doc(db, 'global_configs', 'duel_config'));
  const data = snap.data();
  console.log(JSON.stringify(data?.statEffects?.find((e: any) => e.effectType === 'ferveur_bonus'), null, 2));
  process.exit(0);
}
run();
