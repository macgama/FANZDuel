import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const templatesSnap = await getDocs(collection(db, "fanz_templates"));
  const templates = templatesSnap.docs.map(d => ({id: d.id, ...d.data()}));
  console.log("FANZ TEMPLATES:");
  templates.forEach(t => console.log(` - ID: ${t.id}, Name: ${(t as any).name}`));

  const actionsSnap = await getDocs(collection(db, "life_actions"));
  const actions = actionsSnap.docs.map(d => ({id: d.id, name: (d.data() as any).name, fanzTemplateId: (d.data() as any).fanzTemplateId}));
  console.log("LIFE ACTIONS:");
  actions.slice(0, 15).forEach(a => console.log(` - ID: ${a.id}, Name: ${a.name}, fanzTemplateId: ${a.fanzTemplateId}`));

  const fanzSnap = await getDocs(collection(db, "fanz"));
  const fanzList = fanzSnap.docs.map(d => ({id: d.id, templateId: (d.data() as any).templateId, ownerUid: (d.data() as any).ownerUid, unlockedActions: (d.data() as any).unlockedActions}));
  console.log("OWNED FANZ:");
  fanzList.forEach(f => console.log(` - ID: ${f.id}, templateId: ${f.templateId}, Owner: ${f.ownerUid}, unlockedActions:`, f.unlockedActions));

  const usersSnap = await getDocs(collection(db, "users"));
  const users = usersSnap.docs.map(d => ({id: d.id, unlockedActions: (d.data() as any).unlockedActions}));
  console.log("USERS:");
  users.forEach(u => console.log(` - UID: ${u.id}, unlockedActions:`, u.unlockedActions));

  process.exit(0);
}

run();
