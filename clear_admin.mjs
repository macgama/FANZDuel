import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

const app = initializeApp({ projectId: config.projectId });
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  console.log("Clearing huge fixtures from leagues/667/seasons/2024/fixtures...");
  
  // We can't query the whole collection if it's too big even for admin? No, we can just stream it or use .select() to not fetch the data, just the ref.
  const snap = await db.collection("leagues/667/seasons/2024/fixtures").select().get();
  console.log("Found", snap.size, "documents");
  let count = 0;
  for (const doc of snap.docs) {
    await doc.ref.delete();
    count++;
    if (count % 50 === 0) console.log("Deleted", count);
  }
  console.log("Done");
  process.exit(0);
}
run();
