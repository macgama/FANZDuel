// test
import * as dotenv from 'dotenv';
dotenv.config();

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const rawConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf-8'));
const firebaseConfig = {
  apiKey: rawConfig.apiKey,
  authDomain: rawConfig.authDomain,
  projectId: rawConfig.projectId,
  storageBucket: rawConfig.storageBucket,
  messagingSenderId: rawConfig.messagingSenderId,
  appId: rawConfig.appId,
  measurementId: rawConfig.measurementId
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const teamId = '15'; // Suisse (id 15)
  const a = await getDoc(doc(db, 'teams', teamId));
  console.log('teams', a.exists() ? Object.keys(a.data()) : 'not found', a.exists() ? {leagueIds: a.data()?.leagueIds, leagueId: a.data()?.leagueId} : '');

  const b = await getDoc(doc(db, 'api_teams', teamId));
  console.log('api_teams', b.exists() ? Object.keys(b.data()) : 'not found', b.exists() ? {leagueIds: b.data()?.leagueIds, leagueId: b.data()?.leagueId} : '');
  
  process.exit(0);
}
run();
