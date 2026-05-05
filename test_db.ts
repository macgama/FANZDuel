import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const querySnapshot = await getDocs(collection(db, "cards"));
  const cards = querySnapshot.docs.map(d => ({id: d.id, ...d.data()}));
  fs.writeFileSync('./cards_db.json', JSON.stringify(cards, null, 2));
  console.log("Export complete! Size:", cards.length);
  process.exit(0);
}

run();
