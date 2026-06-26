const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');

// Load firebase config
const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const EMOTE_TRANSLATIONS = {
  'pleure': { en: 'Cry', es: 'Llora' },
  'rigole': { en: 'Laugh', es: 'Ríe' },
  'colère': { en: 'Angry', es: 'Enfadado' },
  'dégoût': { en: 'Disgust', es: 'Asco' },
  'dort': { en: 'Sleep', es: 'Duerme' },
  'surpris': { en: 'Surprised', es: 'Sorprendido' },
  'confus': { en: 'Confused', es: 'Confuso' },
  'peur': { en: 'Scared', es: 'Miedo' },
  'triste': { en: 'Sad', es: 'Triste' },
  'heureux': { en: 'Happy', es: 'Feliz' },
  'content': { en: 'Happy', es: 'Feliz' },
  'choqué': { en: 'Shocked', es: 'Conmocionado' },
  "clin d'oeil": { en: 'Wink', es: 'Guiño' },
  'bisou': { en: 'Kiss', es: 'Beso' },
  'fête': { en: 'Party', es: 'Fiesta' },
  'applaudit': { en: 'Clap', es: 'Aplaude' },
  'gêné': { en: 'Embarrassed', es: 'Avergonzado' },
  'siffle': { en: 'Whistle', es: 'Silba' },
  'furieux': { en: 'Furious', es: 'Furioso' },
  'love': { en: 'Love', es: 'Amor' },
  'cool': { en: 'Cool', es: 'Genial' },
  'mort': { en: 'Dead', es: 'Muerto' }
};

async function run() {
  try {
    const fanzSnap = await getDocs(collection(db, 'fanz_templates'));
    let updatedCount = 0;

    for (const fanzDoc of fanzSnap.docs) {
      const fanz = fanzDoc.data();
      if (!fanz.emotes || fanz.emotes.length === 0) continue;
      
      let changed = false;
      const newEmotes = fanz.emotes.map((emote) => {
        if (typeof emote.name === 'string') {
          const frName = emote.name.trim();
          const lower = frName.toLowerCase();
          const trans = EMOTE_TRANSLATIONS[lower];
          
          changed = true;
          if (trans) {
            return { ...emote, name: { fr: frName, en: trans.en, es: trans.es } };
          } else {
            return { ...emote, name: { fr: frName, en: frName, es: frName } };
          }
        }
        return emote;
      });
      
      if (changed) {
        await updateDoc(doc(db, 'fanz_templates', fanzDoc.id), { emotes: newEmotes });
        updatedCount++;
        console.log(`Updated emotes for FANZ: ${fanz.name || fanzDoc.id}`);
      }
    }
    console.log(`Successfully updated ${updatedCount} FANZ templates!`);
  } catch (err) {
    console.error('Error translating emotes:', err);
  }
  process.exit(0);
}

run();
