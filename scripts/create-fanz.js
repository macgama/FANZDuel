import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('./serviceAccountKey.json');

const app = initializeApp({
  credential: cert(serviceAccount)
});
const db = getFirestore(app);

async function createFanz() {
  const fanzList = [
    { id: 'fanz-001', name: 'Baby Fanzzy', description: 'Le tout premier supporter, prêt à mettre l\'ambiance !', rarity: 'common', baseExcitement: 5, imageUrl: 'public/fanz/imageFanz001Skin000.png', videoUrl: 'public/fanz/videoFanz001Skin000.mp4', price: { money: 500, gems: 5 }, baseStats: { mental: 1, social: 2, charisma: 1, creativity: 1, bluff: 2, endurance: 1, intelligence: 1, force: 1 } },
    { id: 'fanz-002', name: 'Mascotte Fanzzy', description: 'Il arrive ! Il arrive ! Maman, il m\'a fait coucou !', rarity: 'common', baseExcitement: 6, imageUrl: 'public/fanz/imageFanz002Skin000.png', videoUrl: 'public/fanz/videoFanz002Skin000.mp4', price: { money: 500, gems: 5 }, baseStats: { mental: 1, social: 2, charisma: 1, creativity: 2, bluff: 1, endurance: 1, intelligence: 1, force: 1 } },
    { id: 'fanz-003', name: 'Stickers Fanzzy', description: '', rarity: 'common', baseExcitement: 5, imageUrl: 'public/fanz/imageFanz003Skin000.png', videoUrl: 'public/fanz/videoFanz003Skin000.mp4', price: { money: 500, gems: 5 }, baseStats: { mental: 1, social: 2, charisma: 1, creativity: 2, bluff: 1, endurance: 1, intelligence: 1, force: 1 } },
    { id: 'fanz-004', name: 'Ultimate Fanzzy', description: '', rarity: 'common', baseExcitement: 6, imageUrl: 'public/fanz/imageFanz004Skin000.png', videoUrl: 'public/fanz/videoFanz004Skin000.mp4', price: { money: 500, gems: 5 }, baseStats: { mental: 1, social: 2, charisma: 1, creativity: 2, bluff: 1, endurance: 1, intelligence: 1, force: 1 } },
    { id: 'fanz-005', name: 'Glory Hunter Fanzzy', description: '', rarity: 'common', baseExcitement: 5, imageUrl: 'public/fanz/imageFanz005Skin000.png', videoUrl: 'public/fanz/videoFanz005Skin000.mp4', price: { money: 500, gems: 5 }, baseStats: { mental: 1, social: 2, charisma: 1, creativity: 2, bluff: 1, endurance: 1, intelligence: 1, force: 1 } },
    { id: 'fanz-006', name: 'MiniUltra Fanzzy', description: '', rarity: 'common', baseExcitement: 6, imageUrl: 'public/fanz/imageFanz006Skin000.png', videoUrl: 'public/fanz/videoFanz006Skin000.mp4', price: { money: 500, gems: 5 }, baseStats: { mental: 1, social: 2, charisma: 1, creativity: 2, bluff: 1, endurance: 1, intelligence: 1, force: 1 } },
    { id: 'fanz-007', name: 'BallGirl Fanzzy', description: '', rarity: 'common', baseExcitement: 5, imageUrl: 'public/fanz/imageFanz007Skin000.png', videoUrl: 'public/fanz/videoFanz007Skin000.mp4', price: { money: 500, gems: 5 }, baseStats: { mental: 1, social: 2, charisma: 1, creativity: 2, bluff: 1, endurance: 1, intelligence: 1, force: 1 } },
    { id: 'fanz-008', name: 'Tradition Fanzzy', description: '', rarity: 'common', baseExcitement: 6, imageUrl: 'public/fanz/imageFanz008Skin000.png', videoUrl: 'public/fanz/videoFanz008Skin000.mp4', price: { money: 500, gems: 5 }, baseStats: { mental: 1, social: 2, charisma: 1, creativity: 2, bluff: 1, endurance: 1, intelligence: 1, force: 1 } },
    { id: 'fanz-009', name: 'SundayProdigy Fanzzy', description: '', rarity: 'common', baseExcitement: 5, imageUrl: 'public/fanz/imageFanz009Skin000.png', videoUrl: 'public/fanz/videoFanz009Skin000.mp4', price: { money: 500, gems: 5 }, baseStats: { mental: 1, social: 2, charisma: 1, creativity: 2, bluff: 1, endurance: 1, intelligence: 1, force: 1 } },
    { id: 'fanz-010', name: 'Highlights Fanzzy', description: '', rarity: 'common', baseExcitement: 6, imageUrl: 'public/fanz/imageFanz010Skin000.png', videoUrl: 'public/fanz/videoFanz010Skin000.mp4', price: { money: 500, gems: 5 }, baseStats: { mental: 1, social: 2, charisma: 1, creativity: 2, bluff: 1, endurance: 1, intelligence: 1, force: 1 } }
  ];

  for (const fanz of fanzList) {
    const docRef = db.collection('fanz_templates').doc(fanz.id);
    await docRef.set({
      ...fanz,
      sport: 'soccer',
      type: 'base',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    console.log(`Created ${fanz.id}`);
  }
}

createFanz().catch(console.error);
