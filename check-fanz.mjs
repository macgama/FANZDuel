import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function checkFanz() {
  const docRef = doc(db, 'fanz', 'gzmub5');
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    console.log("Keys:", Object.keys(docSnap.data()));
  } else {
    console.log("No such document!");
  }
  process.exit(0);
}

checkFanz();
