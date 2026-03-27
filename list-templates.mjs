import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function listTemplates() {
  const querySnapshot = await getDocs(collection(db, 'fanz_templates'));
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    console.log(`Template: ${doc.id}`);
    console.log(`  Name: ${data.name}`);
    console.log(`  Image: ${data.image}`);
    console.log(`  Video: ${data.video}`);
    if (data.skins) {
      console.log(`  Skins:`);
      data.skins.forEach(skin => {
        console.log(`    Skin: ${skin.id}`);
        console.log(`      Image: ${skin.imageUrl}`);
        console.log(`      Video: ${skin.videoUrl}`);
      });
    }
  });
}

listTemplates().catch(console.error);
