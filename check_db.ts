import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function check() {
  const templates = await getDocs(collection(db, 'fanz_templates'));
  templates.forEach(doc => {
    console.log('Template:', doc.id, doc.data().name);
    console.log('Skins:', JSON.stringify(doc.data().skins, null, 2));
  });
  
  const actions = await getDocs(collection(db, 'life_actions'));
  actions.forEach(doc => {
    console.log('Action:', doc.id, doc.data().name, doc.data().videoUrl);
  });
  process.exit(0);
}
check();
