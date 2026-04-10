import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));

const app = initializeApp({
  projectId: config.projectId,
});

const db = getFirestore(app, config.firestoreDatabaseId);

async function check() {
  const users = await db.collection('ranking_users').get();
  console.log('ranking_users count:', users.size);
  users.forEach(doc => console.log(doc.id, doc.data()));

  const teams = await db.collection('ranking_teams').get();
  console.log('ranking_teams count:', teams.size);
  teams.forEach(doc => console.log(doc.id, doc.data()));
}

check().catch(console.error);
