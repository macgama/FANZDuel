const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

admin.initializeApp({
  projectId: config.projectId,
});

const db = admin.firestore();
db.settings({ databaseId: config.firestoreDatabaseId || '(default)' });

async function seed() {
  try {
    console.log("Seeding rankings...");
    
    // Seed Teams
    const teams = [
      { id: '85', name: 'PSG', logo: 'https://media.api-sports.io/football/teams/85.png' },
      { id: '81', name: 'Marseille', logo: 'https://media.api-sports.io/football/teams/81.png' },
      { id: '80', name: 'Lyon', logo: 'https://media.api-sports.io/football/teams/80.png' },
    ];

    for (const team of teams) {
      await db.collection('teams').doc(team.id).set({
        name: team.name,
        logo: team.logo,
        ferveurEarned: Math.floor(Math.random() * 1000),
        totalScoreGiven: Math.floor(Math.random() * 5000),
        matchesPlayed: Math.floor(Math.random() * 50) + 10,
      });

      const score = Math.floor(Math.random() * 5000) + 1000;
      const matches = Math.floor(Math.random() * 50) + 10;
      await db.collection('ranking_teams').doc(`${team.id}_2026_global`).set({
        teamId: team.id,
        season: '2026',
        leagueId: 'global',
        totalScore: score,
        matches: matches,
        averageScore: score / matches,
        updatedAt: new Date().toISOString()
      });
    }

    // Seed Users
    const users = [
      { id: 'user1', name: 'Gael', score: 4500 },
      { id: 'user2', name: 'Alex', score: 3200 },
      { id: 'user3', name: 'Sam', score: 5100 },
    ];

    for (const u of users) {
      await db.collection('users').doc(u.id).set({
        pseudo: u.name,
        photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}`,
        ferveurPoints: u.score
      });

      const matches = Math.floor(Math.random() * 50) + 10;
      await db.collection('ranking_users').doc(`${u.id}_2026_global`).set({
        userId: u.id,
        season: '2026',
        leagueId: 'global',
        totalScore: u.score,
        matches: matches,
        averageScore: u.score / matches,
        updatedAt: new Date().toISOString()
      });
    }

    console.log("Seeding complete!");
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

seed();
