import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Read config
const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const emotesToAdd = [
  { id: 'emote006', name: 'Colère', imageUrl: '/fanz/imageFanz002Emote006.png', price: { money: 100, gems: 0, boostPoints: 0 } },
  { id: 'emote007', name: 'Dégoût', imageUrl: '/fanz/imageFanz002Emote007.png', price: { money: 100, gems: 0, boostPoints: 0 } },
  { id: 'emote008', name: 'Dort', imageUrl: '/fanz/imageFanz002Emote008.png', price: { money: 100, gems: 0, boostPoints: 0 } },
  { id: 'emote009', name: 'Rigole', imageUrl: '/fanz/imageFanz002Emote009.png', price: { money: 100, gems: 0, boostPoints: 0 } },
  { id: 'emote010', name: 'Surpris', imageUrl: '/fanz/imageFanz002Emote010.png', price: { money: 100, gems: 0, boostPoints: 0 } },
  { id: 'emote011', name: 'Confus', imageUrl: '/fanz/imageFanz002Emote011.png', price: { money: 100, gems: 0, boostPoints: 0 } },
  { id: 'emote012', name: 'Peur', imageUrl: '/fanz/imageFanz002Emote012.png', price: { money: 100, gems: 0, boostPoints: 0 } }
];

async function run() {
  try {
    const fanzRef = doc(db, 'fanz_templates', 'fanz-2');
    const fanzSnap = await getDoc(fanzRef);
    
    if (fanzSnap.exists()) {
      const data = fanzSnap.data();
      const existingEmotes = data.emotes || [];
      
      // Filter out emotes that already exist to avoid duplicates
      const newEmotes = emotesToAdd.filter(e => !existingEmotes.find((ex: any) => ex.id === e.id));
      
      if (newEmotes.length > 0) {
        const updatedEmotes = [...existingEmotes, ...newEmotes];
        await updateDoc(fanzRef, { emotes: updatedEmotes });
        console.log(`Successfully added ${newEmotes.length} emotes to fanz-2.`);
      } else {
        console.log('All emotes already exist in fanz-2.');
      }
    } else {
      console.log('fanz-2 does not exist.');
    }
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}

run();
