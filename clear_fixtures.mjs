import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  console.log("Clearing 667/2024 fixtures...");
  const snap = await getDocs(collection(db, "leagues/667/seasons/2024/fixtures"));
  console.log("Found", snap.size, "documents");
  let count = 0;
  for (const d of snap.docs) {
    await deleteDoc(d.ref);
    count++;
    if (count % 50 === 0) console.log("Deleted", count);
  }
  console.log("Done");
  process.exit(0);
}
run();
