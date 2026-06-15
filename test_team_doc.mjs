import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

const app = initializeApp({ projectId: config.projectId });
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const userSnap = await db.collection("users").where("email", "==", "gael.manigley@gmail.com").get();
  if (userSnap.empty) {
    console.log("user not found");
    return;
  }
  const user = userSnap.docs[0].data();
  console.log("Favorite Teams count:", user.favoriteTeams?.length);
  for (const tId of user.favoriteTeams || []) {
      const snapTeams = await db.collection("teams").doc(tId.toString()).get();
      const snapApi = await db.collection("api_teams").doc(tId.toString()).get();
      
      console.log(`Team ${tId}:`);
      console.log(`  in teams: ${snapTeams.exists}`, snapTeams.exists ? `leagueIds = ${JSON.stringify(snapTeams.data()?.leagueIds || snapTeams.data()?.leagueId)}` : '');
      console.log(`  in api_teams: ${snapApi.exists}`, snapApi.exists ? `leagueIds = ${JSON.stringify(snapApi.data()?.leagueIds || snapApi.data()?.leagueId)}` : '');
  }
}

run().catch(console.error);
