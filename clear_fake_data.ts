import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));

const app = initializeApp({
  projectId: config.projectId,
});

const db = getFirestore(app, config.firestoreDatabaseId);

async function clearFakeData() {
  const fakeTeamIds = ['85', '81', '80'];
  const fakeUserIds = ['user1', 'user2', 'user3'];

  const rankingTeamsSnap = await db.collection('ranking_teams').get();
  for (const doc of rankingTeamsSnap.docs) {
    const data = doc.data();
    if (fakeTeamIds.includes(data.teamId)) {
      console.log(`Deleting fake ranking_teams doc: ${doc.id}`);
      await doc.ref.delete();
    }
  }

  const rankingUsersSnap = await db.collection('ranking_users').get();
  for (const doc of rankingUsersSnap.docs) {
    const data = doc.data();
    if (fakeUserIds.includes(data.userId) || data.totalScore === 4500 || data.totalScore === 3200 || data.totalScore === 5100) {
      console.log(`Deleting fake ranking_users doc: ${doc.id}`);
      await doc.ref.delete();
    }
  }
  
  console.log('Fake data cleared.');
}

clearFakeData().catch(console.error);
