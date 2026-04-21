import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { readFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);

const db = getFirestore(app); // Default DB

async function test() {
  try {
    const snap = await getDocs(collection(db, 'fixture_results'));
    console.log(`Success fixture_results: ${snap.size} docs found`);
  } catch (error) {
    console.error('Error fixture_results:', error.message);
  }
}

test();
