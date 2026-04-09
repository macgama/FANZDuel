import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function check() {
  try {
    await signInAnonymously(auth);
    console.log("Signed in anonymously");
  } catch (e) {
    console.error("Auth failed:", e);
    process.exit(1);
  }

  try {
    const teamsSnap = await getDocs(collection(db, 'ranking_teams'));
    console.log('ranking_teams count:', teamsSnap.size);
    teamsSnap.forEach(doc => console.log(doc.id, doc.data()));

    const usersSnap = await getDocs(collection(db, 'ranking_users'));
    console.log('ranking_users count:', usersSnap.size);
    usersSnap.forEach(doc => console.log(doc.id, doc.data()));
  } catch (e) {
    console.error("Firestore error:", e);
  }
  
  process.exit(0);
}
check();