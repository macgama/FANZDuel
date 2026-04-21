import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';

async function run() {
  const projectId = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8')).projectId;
  const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync('./firestore.rules', 'utf8') }
  });

  const authData = {
    uid: 'gael_uid',
    email: 'gael.manigley@gmail.com'
  };
  
  const ctx = testEnv.authenticatedContext(authData.uid, authData);
  const db = ctx.firestore();

  const mockUserPayload = {
    uid: 'gael_uid',
    pseudo: 'Gael',
    email: 'gael.manigley@gmail.com',
    favoriteTeams: ['team-123'],
    ferveurPoints: 10,
    cards: [],
    activeFanzId: 'fanz-xyz',
    photoURL: 'https://thebestfan.online/img/public/fanz/imageFanz001Skin000.png',
    lastEnergyRefill: new Date().toISOString(),
    role: 'admin',
    money: 1000,
    gems: 5,
    boostPoints: 50,
    energy: 100,
    maxEnergy: 100,
    level: 1,
    teamSlots: 2,
    language: 'fr',
    passPoints: 0,
    isPassPremium: false,
    purchasedPasses: [],
    claimedPassRewards: [],
  };

  try {
    const { doc, setDoc } = require('firebase/firestore');
    await setDoc(doc(db, 'users', 'gael_uid'), mockUserPayload);
    console.log("SUCCESS creating user");
  } catch (e) {
    console.error("ERROR creating user:", e.message);
  }
}
run();
