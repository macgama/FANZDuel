import { db } from './src/firebase';
import { collection, getDocs, writeBatch } from 'firebase/firestore';

async function disableAll() {
  const leaguesSnap = await getDocs(collection(db, 'leagues'));
  const batch = writeBatch(db);
  let count = 0;
  leaguesSnap.forEach(docSnap => {
    batch.update(docSnap.ref, { isActive: false });
    count++;
  });
  await batch.commit();
  console.log(`Disabled ${count} leagues.`);
  process.exit(0);
}

disableAll().catch(console.error);
