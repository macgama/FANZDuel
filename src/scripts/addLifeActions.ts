import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Read config
const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const lifeActionsToAdd = [
  {
    id: 'action-fanz2-001',
    fanzTemplateId: 'fanz-2',
    name: "Transport d'une peluche géante",
    image: '/fanz/imageFanz002Life001.png',
    videoUrl: '/fanz/videoFanz002Life001.mp4',
    durationMinutes: 30,
    energyCost: 10,
    moneyCost: 0,
    gemsCost: 0,
    boostCost: 0,
    energyGain: 0,
    moneyGain: 0,
    gemsGain: 0,
    boostGain: 0,
    xpGains: { force: 5 }
  },
  {
    id: 'action-fanz2-002',
    fanzTemplateId: 'fanz-2',
    name: "Faire la queue pour le méga-câlin",
    image: '/fanz/imageFanz002Life002.png',
    videoUrl: '/fanz/videoFanz002Life002.mp4',
    durationMinutes: 60,
    energyCost: 10,
    moneyCost: 0,
    gemsCost: 0,
    boostCost: 0,
    energyGain: 0,
    moneyGain: 0,
    gemsGain: 0,
    boostGain: 0,
    xpGains: { endurance: 5 }
  },
  {
    id: 'action-fanz2-003',
    fanzTemplateId: 'fanz-2',
    name: "Apprendre la chorégraphie de la mascotte",
    image: '/fanz/imageFanz002Life003.png',
    videoUrl: '/fanz/videoFanz002Life003.mp4',
    durationMinutes: 30,
    energyCost: 5,
    moneyCost: 0,
    gemsCost: 0,
    boostCost: 0,
    energyGain: 0,
    moneyGain: 0,
    gemsGain: 0,
    boostGain: 0,
    xpGains: { mental: 5 }
  },
  {
    id: 'action-fanz2-004',
    fanzTemplateId: 'fanz-2',
    name: "Les yeux doux à la boutique du stade",
    image: '/fanz/imageFanz002Life004.png',
    videoUrl: '/fanz/videoFanz002Life004.mp4',
    durationMinutes: 30,
    energyCost: 5,
    moneyCost: 0,
    gemsCost: 0,
    boostCost: 0,
    energyGain: 0,
    moneyGain: 0,
    gemsGain: 0,
    boostGain: 0,
    xpGains: { charisma: 5 }
  },
  {
    id: 'action-fanz2-005',
    fanzTemplateId: 'fanz-2',
    name: "Atelier Origami Mascottes",
    image: '/fanz/imageFanz002Life005.png',
    videoUrl: '/fanz/videoFanz002Life005.mp4',
    durationMinutes: 60,
    energyCost: 10,
    moneyCost: 0,
    gemsCost: 0,
    boostCost: 0,
    energyGain: 0,
    moneyGain: 0,
    gemsGain: 0,
    boostGain: 0,
    xpGains: { creativity: 5 }
  },
  {
    id: 'action-fanz2-006',
    fanzTemplateId: 'fanz-2',
    name: "Bourse d'échange de stickers à la mi-temps",
    image: '/fanz/imageFanz002Life006.png',
    videoUrl: '/fanz/videoFanz002Life006.mp4',
    durationMinutes: 30,
    energyCost: 5,
    moneyCost: 0,
    gemsCost: 0,
    boostCost: 0,
    energyGain: 0,
    moneyGain: 0,
    gemsGain: 0,
    boostGain: 0,
    xpGains: { social: 5 }
  },
  {
    id: 'action-fanz2-007',
    fanzTemplateId: 'fanz-2',
    name: "Le jeu des paires (Mascotte / Équipe)",
    image: '/fanz/imageFanz002Life007.png',
    videoUrl: '/fanz/videoFanz002Life007.mp4',
    durationMinutes: 30,
    energyCost: 5,
    moneyCost: 0,
    gemsCost: 0,
    boostCost: 0,
    energyGain: 0,
    moneyGain: 0,
    gemsGain: 0,
    boostGain: 0,
    xpGains: { intelligence: 5 }
  },
  {
    id: 'action-fanz2-008',
    fanzTemplateId: 'fanz-2',
    name: "Arriver au stade en mini-cosplay",
    image: '/fanz/imageFanz002Life008.png',
    videoUrl: '/fanz/videoFanz002Life008.mp4',
    durationMinutes: 60,
    energyCost: 10,
    moneyCost: 0,
    gemsCost: 0,
    boostCost: 0,
    energyGain: 0,
    moneyGain: 0,
    gemsGain: 0,
    boostGain: 0,
    xpGains: { bluff: 5 }
  }
];

async function run() {
  try {
    for (const action of lifeActionsToAdd) {
      const actionRef = doc(db, 'life_actions', action.id);
      await setDoc(actionRef, action);
      console.log(`Added life action: ${action.name}`);
    }
    console.log('Successfully added all life actions.');
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}

run();
