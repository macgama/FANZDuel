import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function test() {
  let user;
  try {
    const cred = await createUserWithEmailAndPassword(auth, 'testUser@random.com', 'testpass123');
    user = cred.user;
    console.log("User created in Auth:", user.uid);
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      const cred = await signInWithEmailAndPassword(auth, 'testUser@random.com', 'testpass123');
      user = cred.user;
      console.log("User logged in:", user.uid);
    } else {
      throw err;
    }
  }

  const MOCK_USER = {
    uid: user.uid,
    pseudo: 'testuser',
    email: user.email,
    favoriteTeams: ['test-team'],
    ferveurPoints: 10,
    cards: [],
    activeFanzId: 'fanz-xyz',
    photoURL: 'https://thebestfan.online/img/public/fanz/imageFanz001Skin000.png',
    lastEnergyRefill: new Date().toISOString(),
    role: 'client',
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
    claimedPassRewards: []
  };

  try {
    await setDoc(doc(db, 'users', user.uid), MOCK_USER);
    console.log('Success saving user document');
  } catch (error) {
    console.error('Error saving user:', error.message);
  }
  process.exit(0);
}

test();
