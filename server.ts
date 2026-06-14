import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import axios from "axios";
import * as dotenv from "dotenv";
import sharp from "sharp";
import { BASE_CARDS } from "./src/constants/cards.ts";
import admin from 'firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

dotenv.config();

async function startServer() {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  let db: admin.firestore.Firestore | null = null;
  let loadedCards: any[] = [...BASE_CARDS];
  
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    let credentialOptions = {};
    
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        credentialOptions = { credential: admin.credential.cert(serviceAccount) };
      } catch(e) {
        console.error("Invalid FIREBASE_SERVICE_ACCOUNT_KEY JSON format.");
      }
    } else {
      console.warn("\n⚠️ WARNING: FIREBASE_SERVICE_ACCOUNT_KEY is missing from secrets. Server-side Firebase features (like refund, live card images for bots) will experience PERMISSION_DENIED errors. Please generate a Service Account in Firebase and add its JSON content to your AI Studio secrets as FIREBASE_SERVICE_ACCOUNT_KEY.\n");
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: config.projectId,
        ...credentialOptions
      });
    }
    db = getFirestore(admin.app(), config.firestoreDatabaseId || '(default)');
    
    // Live update cards from Firestore
    db.collection('cards').onSnapshot((snap) => {
      if (!snap.empty) {
        const dbCards = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const mergedCards = [...BASE_CARDS];
        dbCards.forEach(dbCard => {
          const idx = mergedCards.findIndex(c => c.id === dbCard.id);
          if (idx !== -1) {
            mergedCards[idx] = { ...mergedCards[idx], ...dbCard } as any;
          } else {
            mergedCards.push(dbCard as any);
          }
        });
        loadedCards = mergedCards;
        console.log(`[Server] Live-updated ${loadedCards.length} cards from database.`);
      }
    }, (err) => {
      console.warn("[Server] Failed to listen to cards collection (database integration is pending admin credentials):", err.message || err);
    });
  }

  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = 3000;

  // Enhanced game state for duels
  const duels: Record<string, {
    id: string;
    type: string;
    status: 'waiting' | 'room_full' | 'starting' | 'active' | 'finished';
    progress: number;
    participants: any[];
    matchId?: number;
    leagueId?: string;
    season?: string;
    teamAId?: string;
    teamBId?: string;
    teamA?: string;
    teamB?: string;
    startTime?: number;
    timer?: NodeJS.Timeout;
    scores?: { A: number; B: number };
    clickCounts: { A: number; B: number };
    cardCounts: { A: number; B: number };
    lastClicks: Record<string, number[]>; // For anti-clicker: maps uid to array of timestamps
    lockedCards: Record<string, boolean>; // For server-side card verification cache/status
    botInterval?: NodeJS.Timeout;
    isPrivate?: boolean;
    inviteCode?: string;
    trainingType?: string;
    invitedUids?: string[];
    historicalParticipants?: Record<string, any>;
    lastActionCards?: any;
  }> = {};

  // Helper to get a JSON-safe version of a duel (removing circular timers/intervals)
  function getSafeDuel(duel: any) {
    const { timer, botInterval, lastClicks, ...safeProps } = duel;
    return safeProps;
  }

  function checkAndForfeitDuel(duelId: string) {
    const duel = duels[duelId];
    if (!duel || (duel.status !== 'active' && duel.status !== 'starting')) return;
    if (['1v1', '2v2', '5v5'].includes(duel.type)) {
       const humansA = duel.participants.filter(p => p.team === 'A' && !p.isBot && !p.uid.startsWith('bot_'));
       const humansB = duel.participants.filter(p => p.team === 'B' && !p.isBot && !p.uid.startsWith('bot_'));
       
       if (humansA.length === 0 || humansB.length === 0) {
         if (duel.timer) clearTimeout(duel.timer);
         if (duel.botInterval) clearInterval(duel.botInterval);
         
         const winner = humansA.length > 0 ? "A" : (humansB.length > 0 ? "B" : "A"); 
         
         io.to(duelId).emit("duel-forfeit", { message: "Victoire par forfait (adversaires déconnectés) !" });
         finishDuel(duelId, winner, true);
       }
    }
  }

  function finishDuel(duelId: string, winner: string, isForfeitPassed?: boolean) {
    const duel = duels[duelId];
    if (!duel || duel.status === 'finished') return;
    
    console.log(`[Server] Finishing duel ${duelId} (Match: ${duel.matchId}, Type: ${duel.type}, Winner: ${winner})`);
    
    duel.status = 'finished';
    
    const teamAActions = (duel.clickCounts.A || 0) + (duel.cardCounts.A || 0);
    const teamBActions = (duel.clickCounts.B || 0) + (duel.cardCounts.B || 0);
    const totalActions = teamAActions + teamBActions;
    
    let scoreA = 0;
    let scoreB = 0;
    
    if (totalActions > 0) {
      // Winner gets 10 base, the rest (90) is proportional to actions
      if (winner === 'A') {
        scoreA = Math.round(10 + (90 * teamAActions / totalActions));
        scoreB = Math.round(90 * teamBActions / totalActions);
      } else {
        scoreB = Math.round(10 + (90 * teamBActions / totalActions));
        scoreA = Math.round(90 * teamAActions / totalActions);
      }
    } else {
      scoreA = winner === 'A' ? 55 : 45;
      scoreB = winner === 'B' ? 55 : 45;
    }
    
    // Ensure total is exactly 100
    const sum = scoreA + scoreB;
    if (sum !== 100 && sum > 0) {
      if (winner === 'A') {
        scoreA += (100 - sum);
      } else {
        scoreB += (100 - sum);
      }
    }

    console.log(`[Server] Final results for ${duelId}: A=${scoreA}, B=${scoreB}`);

    const allParticipantsForForfeit = duel.type === 'war_of_kops' && duel.historicalParticipants ? Object.values(duel.historicalParticipants) : duel.participants;
    const currentHumansA = allParticipantsForForfeit.filter(p => p.team === 'A' && !p.isBot && !p.uid.startsWith('bot_'));
    const currentHumansB = allParticipantsForForfeit.filter(p => p.team === 'B' && !p.isBot && !p.uid.startsWith('bot_'));

    const allParticipants = duel.type === 'war_of_kops' && duel.historicalParticipants ? Object.values(duel.historicalParticipants) : duel.participants;

    // Check if the duel contains real opponents or just bots against real users
    const isBotMatch = duel.type === 'war_of_kops'
      ? !allParticipants.some(p => !p.isBot)
      : (allParticipants.some(p => p.team === 'A' && !p.isBot) === false ||
         allParticipants.some(p => p.team === 'B' && !p.isBot) === false);

    const isForfeitType = ['1v1', '2v2', '5v5'].includes(duel.type);
    const forfeitWin = isForfeitType && !isBotMatch && (winner === 'A' ? (currentHumansB.length === 0) : (currentHumansA.length === 0));

    const details = {
      teamAActions,
      teamBActions,
      totalActions,
      baseWinnerPoints: 10,
      proportionalPointsA: scoreA - (winner === 'A' ? 10 : 0),
      proportionalPointsB: scoreB - (winner === 'B' ? 10 : 0),
      isForfeit: isForfeitPassed === true || forfeitWin
    };

    io.to(duelId).emit("duel-finished", { winner, scoreA, scoreB, details, isBotMatch });

    // Server-side database updates
    if (db && duel.type !== 'training' && !isBotMatch) {
      (async () => {
        try {
          const seasonsToUpdate = [];
          const currentYear = new Date().getFullYear().toString();
          
          if (duel.season) {
            seasonsToUpdate.push(duel.season);
            if (currentYear !== duel.season) {
              seasonsToUpdate.push(currentYear);
            }
          } else {
            seasonsToUpdate.push(currentYear);
          }
          
          // Remove potential duplicates
          const uniqueSeasons = Array.from(new Set(seasonsToUpdate));

          const updateRanking = async (collectionName: string, entityIdField: string, entityId: string, seasonStr: string, leagueIdStr: string, scoreToAdd: number) => {
            if (!entityId || !seasonStr || !leagueIdStr || !db) return;
            const safeEntityId = entityId.toString();
            const safeSeason = seasonStr.toString();
            const safeLeagueId = leagueIdStr.toString();
            
            const docId = `${safeEntityId}_${safeSeason}_${safeLeagueId}`;
            const docRef = db.collection(collectionName).doc(docId);

            await db.runTransaction(async (transaction) => {
              const docSnap = await transaction.get(docRef);
              let totalScore = scoreToAdd;
              let matches = 1;

              if (docSnap.exists) {
                const data = docSnap.data()!;
                totalScore = Number(data.totalScore || 0) + scoreToAdd;
                matches = Number(data.matches || 0) + 1;
              }

              const averageScore = matches > 0 ? (totalScore / matches) : 0;

              transaction.set(docRef, {
                [entityIdField]: safeEntityId,
                season: safeSeason,
                leagueId: safeLeagueId,
                totalScore,
                matches,
                averageScore,
                updatedAt: new Date().toISOString()
              }, { merge: true });
            });
            console.log(`[Server Ranking] Updated ${collectionName} for ${safeEntityId} with +${scoreToAdd}`);
          };

          const allParticipants = duel.type === 'war_of_kops' && duel.historicalParticipants ? Object.values(duel.historicalParticipants) : duel.participants;
          // Update users
          for (const p of allParticipants as any[]) {
            if (p.uid.startsWith('bot_')) continue;
            const userScore = p.team === 'A' ? scoreA : scoreB;
            for (const s of uniqueSeasons) {
              if (!s) continue;
              await updateRanking('ranking_users', 'userId', p.uid, s, 'global', userScore);
              if (duel.leagueId && duel.leagueId !== 'global') {
                await updateRanking('ranking_users', 'userId', p.uid, s, duel.leagueId, userScore);
              }
            }
          }

          // Update Teams (runs ONCE per duel match instead of per-client)
          for (const s of uniqueSeasons) {
            if (!s) continue;
            if (duel.teamAId) {
              await updateRanking('ranking_teams', 'teamId', duel.teamAId, s, 'global', scoreA);
              if (duel.leagueId && duel.leagueId !== 'global') {
                await updateRanking('ranking_teams', 'teamId', duel.teamAId, s, duel.leagueId, scoreA);
              }
              
              // Also update the main teams collection
              try {
                const teamRef = db.collection('teams').doc(duel.teamAId.toString());
                const teamSnap = await teamRef.get();
                if (teamSnap.exists) {
                  await teamRef.update({
                    ferveurEarned: admin.firestore.FieldValue.increment(scoreA),
                    totalScoreGiven: admin.firestore.FieldValue.increment(scoreA),
                    matchesPlayed: admin.firestore.FieldValue.increment(1)
                  });
                }
              } catch (e) {
                console.error(`Error updating team A general stats:`, e);
              }
            }
            if (duel.teamBId) {
              await updateRanking('ranking_teams', 'teamId', duel.teamBId, s, 'global', scoreB);
              if (duel.leagueId && duel.leagueId !== 'global') {
                await updateRanking('ranking_teams', 'teamId', duel.teamBId, s, duel.leagueId, scoreB);
              }

              // Also update the main teams collection
              try {
                const teamRef = db.collection('teams').doc(duel.teamBId.toString());
                const teamSnap = await teamRef.get();
                if (teamSnap.exists) {
                  await teamRef.update({
                    ferveurEarned: admin.firestore.FieldValue.increment(scoreB),
                    totalScoreGiven: admin.firestore.FieldValue.increment(scoreB),
                    matchesPlayed: admin.firestore.FieldValue.increment(1)
                  });
                }
              } catch (e) {
                console.error(`Error updating team B general stats:`, e);
              }
            }
          }

          // Write finished duel to database
          const simplifiedParticipants = allParticipants.map((p: any) => ({
            uid: p.uid,
            team: p.team,
            pseudo: p.pseudo || 'Bot',
            fanzId: p.fanz?.id || null
          }));
          
          await db.collection('duels').doc(duel.id).set({
            id: duel.id,
            type: duel.type,
            status: 'finished',
            matchId: Number(duel.matchId) || 0,
            teamA: duel.teamAId,
            teamB: duel.teamBId,
            participants: simplifiedParticipants,
            winner,
            scoreA,
            scoreB,
            updatedAt: new Date().toISOString()
          }, { merge: true });

          // Save to match_scores in Firestore so it lists in match summary (Match Details duels history tab)
          if (duel.matchId) {
            const matchIdStr = duel.matchId.toString();
            await db.collection('match_scores').doc(duel.id).set({
              matchId: matchIdStr,
              scoreA: Number(scoreA),
              scoreB: Number(scoreB),
              timestamp: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            // Save to fixture_results for detailed historic tracking
            const matchSeason = duel.season || currentYear;
            const safeLeagueId = duel.leagueId || 'global';
            await db.collection('fixture_results').doc(duel.id).set({
              fixtureId: matchIdStr,
              leagueId: safeLeagueId,
              season: matchSeason,
              duelId: duel.id,
              type: duel.type,
              teamHome: {
                id: duel.teamAId || '',
                name: duel.teamA || '',
                score: Number(scoreA)
              },
              teamAway: {
                id: duel.teamBId || '',
                name: duel.teamB || '',
                score: Number(scoreB)
              },
              winnerVirtualTeam: winner,
              users: simplifiedParticipants.reduce((acc: any, p: any) => {
                acc[p.uid] = {
                  pseudo: p.pseudo || 'Unknown',
                  virtualTeam: p.team,
                  teamSide: p.team === 'A' ? 'Home' : 'Away',
                  realTeamName: p.team === 'A' ? (duel.teamA || '') : (duel.teamB || ''),
                  score: p.team === 'A' ? Number(scoreA) : Number(scoreB)
                };
                return acc;
              }, {}),
              timestamp: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            console.log(`[Server] Saved match_scores and fixture_results for duel ${duel.id}`);
          }

        } catch (err) {
          console.error("[Server] Error updating db for finished duel", err);
        }
      })();
    }
  }

  function checkAndFinishWarOfKopsDuels(matchId: string | number) {
    if (!matchId) return;
    const matchIdStr = matchId.toString();
    Object.values(duels).forEach(duel => {
      if (duel.type === 'war_of_kops' && duel.matchId?.toString() === matchIdStr && duel.status !== 'finished') {
        console.log(`[Server] Automatically finishing War of Kops duel ${duel.id} because match ${matchId} is finished.`);
        // Winner is team A if progress >= 50, otherwise B
        const winner = duel.progress >= 50 ? "A" : "B";
        finishDuel(duel.id, winner);
      }
    });
  }

  // Map to track active sockets by user uid
  const userSockets = new Map<string, string>();
  const userProfiles = new Map<string, any>();

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Send immediate initial count
    socket.emit("online-users-count", { count: Math.max(1, userSockets.size) });

    // Register active user connection
    socket.on("register-user", ({ uid, profile }) => {
      if (uid) {
        userSockets.set(uid, socket.id);
        if (profile) userProfiles.set(uid, profile);
        console.log(`[Server] Registered user ${uid} to socket ${socket.id}`);
        // Broadcast new online count to all clients
        io.emit("online-users-count", { count: Math.max(1, userSockets.size) });
      }
    });

    socket.on("join-duel", (params: any) => {
      const { duelId: clientDuelId, user, fanz, type, trainingType, invitedUids, matchId, team: chosenTeam, isPrivate, inviteCode, teamAId, teamBId, teamA, teamB, leagueId, season, isBot } = params;
      
      // Check for reconnection
      if (clientDuelId && duels[clientDuelId]) {
        const existingDuel = duels[clientDuelId];
        const participant = existingDuel.participants.find(p => p.uid === user.uid);
        if (participant) {
          participant.socketId = socket.id;
          socket.join(clientDuelId);
          if (!user.isBot && !params.isBot) {
            socket.emit("duel-joined", { 
              team: participant.team || 'A', 
              duelId: existingDuel.id, 
              participants: existingDuel.participants 
            });
          }
          io.to(clientDuelId).emit("duel-update", { 
            duelId: existingDuel.id,
            progress: existingDuel.progress, 
            status: existingDuel.status, 
            participants: existingDuel.participants,
            scores: existingDuel.scores,
            isPrivate: existingDuel.isPrivate,
            inviteCode: existingDuel.inviteCode,
            invitedUids: existingDuel.invitedUids
          });
          return;
        }
      }

      // Matchmaking logic
      let duelId = '';
      
      if (inviteCode) {
        // Find duel by invite code
        const duelWithCode = Object.values(duels).find(d => d.inviteCode === inviteCode);
        if (duelWithCode) {
          duelId = duelWithCode.id;
        } else {
          socket.emit("duel-error", { message: "Code d'invitation invalide ou duel expiré." });
          return;
        }
      } else if (type === 'training' && trainingType !== '1v1') {
        duelId = clientDuelId || `training_${socket.id}`;
      } else if (type === 'war_of_kops') {
        duelId = clientDuelId || `war_of_kops_${matchId || 'global'}`;
      } else if (!isPrivate) {
        // Find if the user is already in an active or waiting duel of same type and match
        const existingActiveDuel = Object.values(duels).find(d => 
          d.type === type &&
          (!matchId || d.matchId === matchId) &&
          d.participants.some(p => p.uid === user.uid) &&
          d.status !== 'finished'
        );

        if (existingActiveDuel) {
          duelId = existingActiveDuel.id;
        } else {
          // Find a waiting public duel of same type and match
          const reqPlayersObj = { '1v1': 2, '2v2': 4, '5v5': 10 };
          const requiredPlayers = (type === 'training' && trainingType === '1v1') ? 2 : (reqPlayersObj[type as '1v1' | '2v2' | '5v5'] || 2);
          const availableDuel = Object.values(duels).find(d => 
            d.type === type && 
            d.status === 'waiting' && 
            !d.isPrivate &&
            d.participants.length < requiredPlayers &&
            (!matchId || d.matchId === matchId) &&
            (!clientDuelId || d.id === clientDuelId)
          );
          
          if (availableDuel) {
            duelId = availableDuel.id;
          } else {
            duelId = clientDuelId || `duel_${Math.random().toString(36).substring(7)}`;
          }
        }
      } else {
        // Create a new private duel
        duelId = clientDuelId || `duel_${Math.random().toString(36).substring(7)}`;
      }

      if (!duels[duelId]) {
        duels[duelId] = {
          id: duelId,
          type: type || '1v1',
          trainingType,
          invitedUids,
          status: (type === 'training' && trainingType !== '1v1') ? 'active' : 'waiting',
          progress: 50,
          participants: [],
          historicalParticipants: {},
          matchId,
          leagueId,
          season,
          teamAId,
          teamBId,
          teamA,
          teamB,
          scores: type === 'war_of_kops' ? { A: 0, B: 0 } : undefined,
          clickCounts: { A: 0, B: 0 },
          cardCounts: { A: 0, B: 0 },
          lastClicks: {},
          lockedCards: {},
          isPrivate: isPrivate || false,
          inviteCode: isPrivate ? (() => {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let res = '';
            for(let i=0;i<6;i++) res += chars[Math.floor(Math.random()*chars.length)];
            return res;
          })() : undefined
        };
      }

      const duel = duels[duelId];
      socket.join(duelId);
      
      // Add participant if not already there
      if (!duel.participants.find(p => p.uid === user.uid)) {
        let team: 'A' | 'B' = 'A';
        const maxPerTeam = (duel.type === 'training' && duel.trainingType === '1v1') ? 1 : ({ '1v1': 1, '2v2': 2, '5v5': 5 }[duel.type as '1v1' | '2v2' | '5v5'] || 999);
        const teamACount = duel.participants.filter(p => p.team === 'A').length;
        const teamBCount = duel.participants.filter(p => p.team === 'B').length;

        if (chosenTeam && (chosenTeam === 'A' || chosenTeam === 'B')) {
          const chosenCount = chosenTeam === 'A' ? teamACount : teamBCount;
          const otherCount = chosenTeam === 'A' ? teamBCount : teamACount;
          if (chosenCount < maxPerTeam) {
            team = chosenTeam;
          } else if (otherCount < maxPerTeam) {
            // Fallback to other team if chosen is full
            team = chosenTeam === 'A' ? 'B' : 'A';
          } else {
             // Both teams full, reject
             return;
          }
        } else if (duel.type === 'war_of_kops') {
          team = teamACount <= teamBCount ? 'A' : 'B';
        } else if (duel.type !== 'training' || duel.trainingType === '1v1') {
          if (teamACount < maxPerTeam) team = 'A';
          else if (teamBCount < maxPerTeam) team = 'B';
          else return; // Both teams full
        }
        
        duel.participants.push({ ...user, fanz, team, socketId: socket.id });
        duel.historicalParticipants[user.uid] = { ...user, fanz, team };

        // Send real-time notification to invited friends when the room is initially created by host
        const isCreator = duel.participants.length === 1 && duel.participants[0].uid === user.uid;
        if (isCreator && duel.isPrivate && duel.invitedUids && duel.invitedUids.length > 0) {
          duel.invitedUids.forEach((invitedUid: string) => {
            const invitedSocketId = userSockets.get(invitedUid);
            if (invitedSocketId) {
              io.to(invitedSocketId).emit("duel-invitation", {
                duelId: duel.id,
                type: duel.type,
                trainingType: duel.trainingType,
                hostPseudo: user.pseudo,
                matchId: duel.matchId,
                teamA: duel.teamA,
                teamB: duel.teamB
              });
              console.log(`[Server] Invitation sent to user ${invitedUid} via socket ${invitedSocketId}`);
            }
          });
        }
      }

      const participant = duel.participants.find(p => p.uid === user.uid);
      if (!user.isBot && !isBot) {
        socket.emit("duel-joined", { 
          team: participant?.team || 'A', 
          duelId: duel.id, 
          participants: duel.participants,
          inviteCode: duel.inviteCode,
          isPrivate: duel.isPrivate,
          invitedUids: duel.invitedUids
        });
      }

      io.to(duelId).emit("duel-update", { 
        duelId: duel.id,
        progress: duel.progress, 
        status: duel.status, 
        participants: duel.participants,
        scores: duel.scores,
        inviteCode: duel.inviteCode,
        isPrivate: duel.isPrivate,
        invitedUids: duel.invitedUids
      });

      // Check if duel should start
      let shouldStart = false;
      if (duel.type === 'war_of_kops') {
        const hasTeamA = duel.participants.some(p => p.team === 'A');
        const hasTeamB = duel.participants.some(p => p.team === 'B');
        shouldStart = hasTeamA && hasTeamB;
      } else {
        const requiredPlayers = (duel.type === 'training' && duel.trainingType === '1v1') ? 2 : ({ '1v1': 2, '2v2': 4, '5v5': 10, 'training': 1 }[duel.type as string] || 2);
        shouldStart = duel.participants.length >= requiredPlayers;
      }
      
      if (duel.status === 'waiting' && shouldStart) {
        duel.status = 'room_full';
        io.to(duelId).emit("duel-update", { 
          duelId: duel.id,
          progress: duel.progress, 
          status: duel.status, 
          participants: duel.participants,
          scores: duel.scores,
          inviteCode: duel.inviteCode,
          isPrivate: duel.isPrivate
        });

        duel.timer = setTimeout(() => {
          if (duels[duelId]) {
            duels[duelId].status = 'starting';
            const startTime = Date.now() + 5000;
            io.to(duelId).emit("duel-starting", { startTime, duelId, duel: getSafeDuel(duels[duelId]) });
            
            duels[duelId].timer = setTimeout(() => {
              if (duels[duelId]) {
                duels[duelId].status = 'active';
                io.to(duelId).emit("duel-started");
              }
            }, 5000) as any;
          }
        }, 5000) as any;
      }

      // The bot simulation is handled entirely by the frontend (Duel.tsx) now.
    });

    const refundParticipants = async (duelType: string, uids: string[]) => {
      if (!db || uids.length === 0) return;
      try {
        const configDoc = await db.collection('global_configs').doc('duel_config').get();
        let cost = { money: 0, energy: 0 };
        if (configDoc.exists) {
          const config = configDoc.data() as any;
          if (config.costs && config.costs[duelType]) {
            cost = config.costs[duelType];
          }
        }
        if (cost.money > 0 || cost.energy > 0) {
          for (const uid of uids) {
            if (uid.startsWith('bot_')) continue;
            await db.collection('users').doc(uid).update({
              money: FieldValue.increment(cost.money),
              energy: FieldValue.increment(cost.energy)
            });
          }
        }
      } catch(err) {
        console.error("Refund error:", err);
      }
    };

    socket.on("leave-duel", async ({ duelId, userId }) => {
      const duel = duels[duelId];
      if (duel) {
        if (duel.status === 'waiting' || duel.status === 'room_full') {
          const isParticipant = duel.participants.some(p => p.uid === userId);
          if (isParticipant) {
            duel.participants = duel.participants.filter(p => p.uid !== userId);
            socket.leave(duelId);
            
            if (duel.status === 'room_full') {
              if (duel.timer) clearTimeout(duel.timer);
              duel.status = 'waiting';
            }
            
            io.to(duelId).emit("duel-update", { 
              duelId: duel.id, 
              progress: duel.progress, 
              status: duel.status, 
              participants: duel.participants 
            });
            
            if (duel.participants.length === 0 && duel.type !== 'war_of_kops') {
               if (duel.timer) clearTimeout(duel.timer);
               delete duels[duelId];
            }
          }
        } else if ((duel.status === 'active' || duel.status === 'starting') && ['1v1', '2v2', '5v5'].includes(duel.type)) {
          duel.participants = duel.participants.filter(p => p.uid !== userId);
          socket.leave(duelId);
          io.to(duelId).emit("duel-update", { 
             duelId: duel.id, 
             progress: duel.progress, 
             status: duel.status, 
             participants: duel.participants 
          });
          checkAndForfeitDuel(duelId);
        } else if (duel.status === 'active' && duel.type === 'war_of_kops') {
          // Can safely leave war of kops without breaking it
          duel.participants = duel.participants.filter(p => p.uid !== userId);
          socket.leave(duelId);
          io.to(duelId).emit("duel-update", { 
            duelId: duel.id, 
            progress: duel.progress, 
            status: duel.status, 
            participants: duel.participants 
          });
        }
      }
    });

    socket.on("update-duel-settings", ({ duelId, isPrivate }) => {
      const duel = duels[duelId];
      if (duel && duel.status === 'waiting') {
        duel.isPrivate = isPrivate;
        io.to(duelId).emit("duel-update", {
          duelId: duel.id,
          progress: duel.progress,
          status: duel.status,
          participants: duel.participants,
          scores: duel.scores,
          isPrivate: duel.isPrivate,
          inviteCode: duel.inviteCode
        });
      }
    });

    socket.on("cancel-duel", async ({ duelId, userId }) => {
      const duel = duels[duelId];
      if (duel && (duel.status === 'waiting' || duel.status === 'room_full')) {
        const isParticipant = duel.participants.some(p => p.uid === userId);
        if (isParticipant) {
          if (duel.timer) clearTimeout(duel.timer);
          const participantsToRefund = duel.participants.map((p: any) => p.uid);
          delete duels[duelId];
          io.to(duelId).emit("duel-cancelled");
          await refundParticipants(duel.type, participantsToRefund);
        }
      }
    });

    socket.on("click-ferveur", ({ duelId, team, multiplier, userId }) => {
      const duel = duels[duelId];
      if (duel && duel.status === 'active') {
        // Anti-clicker validation
        let participant = null;
        if (userId) {
          participant = duel.participants.find(p => p.uid === userId && p.socketId === socket.id);
        } else {
          participant = duel.participants.find(p => p.socketId === socket.id && !p.isBot);
        }
        
        if (participant) {
          const uid = participant.uid;
          const now = Date.now();
          if (!duel.lastClicks[uid]) {
            duel.lastClicks[uid] = [];
          }
          // Remove clicks older than 1 second
          duel.lastClicks[uid] = duel.lastClicks[uid].filter(t => now - t < 1000);
          
          const maxClicks = participant.isBot ? 25 : 12; // Allow higher throughput for simulation batches
          if (duel.lastClicks[uid].length >= maxClicks) {
            if (!participant.isBot) {
              console.warn(`[Anti-Cheat] Player ${uid} clicking too fast in duel ${duelId}`);
              socket.emit("duel-error", { message: "Trop de clics détectés, ralentissez !" });
            }
            return; // Ignore this click
          }
          duel.lastClicks[uid].push(now);
        }

        duel.clickCounts[team]++;
        const resistance = { '1v1': 1, '2v2': 2, '5v5': 5, 'war_of_kops': 50, 'training': 1 }[duel.type] || 1;
        const baseDelta = 0.5;
        const delta = ((team === "A" ? baseDelta : -baseDelta) * (multiplier || 1)) / resistance;
        duel.progress = Math.min(100, Math.max(0, duel.progress + delta));
        
        if (duel.progress >= 100 || duel.progress <= 0) {
          const winner = duel.progress >= 100 ? "A" : "B";
          finishDuel(duelId, winner);
        }
        
        io.to(duelId).emit("duel-update", { 
          duelId: duel.id,
          progress: duel.progress, 
          status: duel.status, 
          participants: duel.participants,
          scores: duel.scores
        });
      }
    });

    socket.on("play-card", ({ duelId, team, card, userId }) => {
      const duel = duels[duelId];
      if (duel && duel.status === 'active') {
        let participant = null;
        if (userId) {
          participant = duel.participants.find(p => p.uid === userId && p.socketId === socket.id);
        } else {
          participant = duel.participants.find(p => p.socketId === socket.id && !p.isBot);
        }
        const uid = participant ? participant.uid : 'unknown';
        
        // Keep progress snapshot before resolving play card for VAR Temporelle
        if (!(duel as any).progressHistory) {
          (duel as any).progressHistory = [];
        }
        (duel as any).progressHistory.push(duel.progress);
        if ((duel as any).progressHistory.length > 15) {
          (duel as any).progressHistory.shift();
        }

        // Server-Side Card Validation
        const baseCard = loadedCards.find((c: any) => c.id === card.id);
        if (!participant || !participant.isBot) {
          if (!baseCard) {
            console.warn(`[Anti-Cheat] Player ${uid} played invalid card: ${card.id}`);
            // If Firebase is not running on server properly, we might reject valid cards.
            // But we will allow it for now if we are in missing admin mode.
            // return;
          }
        }

        const fallbackFervor = baseCard ? (baseCard.fervorValue || 0) : 0;
        // Validate that the provided card's fervor doesn't exceed a reasonable max (e.g. max x10 multiplier via level caps)
        const maxFervorAllowed = Math.max(20, fallbackFervor * 10);
        if (card.fervorValue && card.fervorValue > maxFervorAllowed) {
          console.warn(`[Anti-Cheat] Player ${uid} used forged card value: ${card.fervorValue} for ${card.id}`);
          socket.emit("duel-error", { message: "Action suspecte détectée sur une carte." });
          return;
        }

        duel.cardCounts[team]++;
        const resistance = { '1v1': 1, '2v2': 2, '5v5': 5, 'war_of_kops': 50, 'training': 1 }[duel.type] || 1;
        
        if (card.fervorValue) {
          const delta = (team === "A" ? card.fervorValue : -card.fervorValue) / resistance;
          duel.progress = Math.min(100, Math.max(0, duel.progress + delta));
        }

        const safeCard = baseCard || card;
        if (safeCard.category === 'Action') {
          if (!duel.lastActionCards) duel.lastActionCards = { A: null, B: null };
          duel.lastActionCards[team] = {
            id: card.id,
            name: card.name,
            fervorValue: card.fervorValue || 0,
            pushRopeValue: card.effects?.find((e: any) => e.type === 'push_rope')?.value || 0
          };
        }

        (card.effects || []).forEach((effect: any) => {
          if (effect.type === 'push_rope' && effect.value && !card.fervorValue) {
            const maxEffectAllowed = Math.max(50, (safeCard.effects?.find((e: any) => e.type === 'push_rope')?.value || 0) * 4); // More balanced limit
            if (effect.value > maxEffectAllowed) {
               console.warn(`[Anti-Cheat] Player ${uid} forged effect value: ${effect.value} (max: ${maxEffectAllowed})`);
               return;
            }
            const delta = (team === "A" ? effect.value : -effect.value) / resistance;
            duel.progress = Math.min(100, Math.max(0, duel.progress + delta));
          }
          if (effect.type === 'var_illusion') {
            const opponentTeam = team === 'A' ? 'B' : 'A';
            if (duel.lastActionCards && duel.lastActionCards[opponentTeam]) {
              const oppCard = duel.lastActionCards[opponentTeam];
              const reverseFervor = (opponentTeam === 'A' ? -oppCard.fervorValue : oppCard.fervorValue) / resistance;
              const reversePush = (opponentTeam === 'A' ? -oppCard.pushRopeValue : oppCard.pushRopeValue) / resistance;
              duel.progress = Math.min(100, Math.max(0, duel.progress + reverseFervor + reversePush));
              duel.lastActionCards[opponentTeam] = null; // clear after revert
            }
          }
          if (effect.type === 'invert_rope') {
            duel.progress = 100 - duel.progress;
          }
          if (effect.type === 'buvette_grail') {
            if (team === 'A') {
              if (duel.progress < 50) {
                duel.progress = 50;
              } else {
                duel.progress = Math.min(100, duel.progress + 15);
              }
            } else if (team === 'B') {
              if (duel.progress > 50) {
                duel.progress = 50;
              } else {
                duel.progress = Math.max(0, duel.progress - 15);
              }
            }
          }
          if (effect.type === 'var_temporelle') {
            const history = (duel as any).progressHistory;
            if (history && history.length > 2) {
              const targetProg = history[history.length - 3]; // Rewind to start of previous turn (2 steps back)
              duel.progress = targetProg;
              (duel as any).progressHistory = history.slice(0, -2);
            } else if (history && history.length > 1) {
              duel.progress = history[0];
            } else {
              duel.progress = 50;
            }
          }
        });
        
        if (duel.progress >= 100 || duel.progress <= 0) {
          const winner = duel.progress >= 100 ? "A" : "B";
          finishDuel(duelId, winner);
        }
        
        io.to(duelId).emit("duel-update", { 
          duelId: duel.id,
          progress: duel.progress, 
          status: duel.status, 
          participants: duel.participants,
          scores: duel.scores
        });
        io.to(duelId).emit("enemy-card-played", { team, card, userId: uid });
      }
    });

    socket.on("swap-hands-init", ({ duelId, team, hand }) => {
      socket.to(duelId).emit("swap-hands-request", { fromTeam: team, opponentHand: hand });
    });

    socket.on("swap-hands-response", ({ duelId, team, hand }) => {
      socket.to(duelId).emit("swap-hands-complete", { newHand: hand });
    });

    socket.on("steal-card-init", ({ duelId, team, filterCategory }) => {
      socket.to(duelId).emit("steal-card-request", { fromTeam: team, filterCategory });
    });

    socket.on("steal-card-response", ({ duelId, team, card }) => {
      socket.to(duelId).emit("steal-card-complete", { stolenCard: card });
    });

    socket.on("send-emote", ({ duelId, team, emoteId, senderId }) => {
      socket.to(duelId).emit("receive-emote", { team, emoteId, senderId });
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      
      // Clean up userSockets map
      let changed = false;
      for (const [uid, sid] of userSockets.entries()) {
        if (sid === socket.id) {
          userSockets.delete(uid);
          userProfiles.delete(uid);
          console.log(`[Server] Unregistered user ${uid} of socket ${socket.id}`);
          changed = true;
          break;
        }
      }

      if (changed) {
        io.emit("online-users-count", { count: Math.max(1, userSockets.size) });
      }

      // Clean up participants
      Object.values(duels).forEach(duel => {
        const index = duel.participants.findIndex(p => p.socketId === socket.id);
        if (index !== -1) {
          duel.participants.splice(index, 1);
          
          if (duel.status === 'room_full') {
            if (duel.timer) clearTimeout(duel.timer);
            duel.status = 'waiting';
          }
          
          if (duel.status === 'waiting' && duel.participants.length === 0 && duel.type !== 'war_of_kops') {
            if (duel.timer) clearTimeout(duel.timer);
            delete duels[duel.id];
          } else {
            io.to(duel.id).emit("duel-update", { duelId: duel.id, participants: duel.participants, status: duel.status });
            if (duel.status === 'active' || duel.status === 'starting') {
               checkAndForfeitDuel(duel.id);
            }
          }
        }
      });
    });
  });

  // API Routes
  app.get("/api/landing/stats", async (req, res) => {
    const BASE_SUPPORTERS = 0;
    const BASE_DUELS = 0;
    let supporters = BASE_SUPPORTERS;
    let duelsTotal = BASE_DUELS;
    const duelsActive = Object.values(duels).filter(d => d.status !== 'finished').length;
    const usersOnline = Math.max(1, userSockets.size);

    if (db) {
      try {
        const usersSnap = await db.collection('users').count().get();
        if (usersSnap && usersSnap.data) {
          supporters = BASE_SUPPORTERS + (usersSnap.data().count || 0);
        }
      } catch (err: any) {
        console.warn("Could not fetch real users count via Admin SDK:", err.message || err);
      }
      try {
        const duelsSnap = await db.collection('duels').count().get();
        if (duelsSnap && duelsSnap.data) {
          duelsTotal = BASE_DUELS + (duelsSnap.data().count || 0);
        }
      } catch (err: any) {
        console.warn("Could not fetch real duels count via Admin SDK:", err.message || err);
      }
    }

    res.json({
      supporters,
      duelsTotal,
      duelsActive,
      usersOnline
    });
  });

  app.get("/api/online-users", async (req, res) => {
    const uids = Array.from(userSockets.keys());
    if (uids.length === 0) {
      return res.json([]);
    }

    const usersList = Array.from(userProfiles.values());

    // Fallback for sockets that have no full profile
    uids.forEach(uid => {
      if (!userProfiles.has(uid)) {
        usersList.push({
          uid,
          pseudo: `Supporter #${uid.substring(0, 4)}`,
          displayName: `Supporter #${uid.substring(0, 4)}`,
          level: 1,
          favoriteTeams: [],
          photoURL: null,
          friends: [],
          friendRequests: [],
        });
      }
    });

    res.json(usersList);
  });

  app.get("/api/duels/all", (req, res) => {
    const allActiveDuels = Object.values(duels)
      .filter(d => d.status !== 'finished' && !d.isPrivate)
      .map(d => getSafeDuel(d));
    res.json(allActiveDuels);
  });

  app.get("/api/duels", (req, res) => {
    const uid = req.query.uid as string;
    const waitingDuels = Object.values(duels)
      .filter(d => {
        const isPublicWaiting = !d.isPrivate && (d.status === 'waiting' || (d.type === 'war_of_kops' && d.status === 'active'));
        const isUserParticipant = uid && d.participants.some(p => p.uid === uid);
        const isUserWaiting = isUserParticipant && (d.status === 'waiting' || (d.type === 'war_of_kops' && d.status === 'active'));
        const isUserInvited = d.isPrivate && uid && d.invitedUids && d.invitedUids.includes(uid) && (d.status === 'waiting' || (d.type === 'war_of_kops' && d.status === 'active'));
        return isPublicWaiting || isUserWaiting || isUserInvited;
      })
      .map(d => getSafeDuel(d));
    res.json(waitingDuels);
  });

  app.get("/api/duels/id/:id", (req, res) => {
    const duelId = req.params.id;
    const duel = duels[duelId];
    if (duel) {
      res.json(getSafeDuel(duel));
    } else {
      res.status(404).json({ error: 'Duel not found' });
    }
  });

  app.get("/api/duels/:matchId", (req, res) => {
    const matchIdStr = req.params.matchId;
    const uid = req.query.uid as string;
    const activeDuels = Object.values(duels)
      .filter(d => {
        const isCorrectMatch = d.matchId?.toString() === matchIdStr;
        if (!isCorrectMatch) return false;
        
        const isWaiting = d.status === 'waiting' || (d.type === 'war_of_kops' && d.status === 'active');
        if (!isWaiting) return false;

        const isPublic = !d.isPrivate;
        const isUserInvited = d.isPrivate && uid && d.invitedUids && d.invitedUids.includes(uid);
        
        return isPublic || isUserInvited;
      })
      .map(d => getSafeDuel(d));
    res.json(activeDuels);
  });

  app.get("/api/duels/code/:code", (req, res) => {
    const code = req.params.code.toUpperCase();
    const duel = Object.values(duels).find(d => d.inviteCode === code && (d.status === 'waiting' || (d.type === 'war_of_kops' && d.status === 'active')));
    if (duel) {
      res.json({
        id: duel.id,
        type: duel.type,
        matchId: duel.matchId,
        participants: duel.participants.map(p => ({
          uid: p.uid,
          pseudo: p.pseudo,
          team: p.team,
          photoURL: p.photoURL
        }))
      });
    } else {
      res.status(404).json({ error: 'Duel not found' });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Image Optimization Proxy
  app.get("/api/image-proxy", async (req, res) => {
    try {
      const targetUrl = req.query.url as string;
      const width = parseInt(req.query.w as string) || 800; // Default max width

      if (!targetUrl) {
        return res.status(400).send("Missing url parameter");
      }

      // Prevent directory requests which return 403 and pollute logs
      const cleanTarget = targetUrl.trim();
      const lowerTarget = cleanTarget.toLowerCase();
      if (
        lowerTarget === "https://thebestfan.online/img/public" ||
        lowerTarget === "https://thebestfan.online/img/public/" ||
        lowerTarget === "https://thebestfan.online/img/public/duel" ||
        lowerTarget === "https://thebestfan.online/img/public/duel/" ||
        lowerTarget.endsWith("/public") ||
        lowerTarget.endsWith("/public/") ||
        lowerTarget.endsWith("/duel") ||
        lowerTarget.endsWith("/duel/")
      ) {
        return res.redirect('https://thebestfan.online/img/public/logo/imageMydeck.png');
      }

      // Fetch the original image
      const response = await axios.get(targetUrl, { 
        responseType: 'arraybuffer',
        timeout: 4000 // 4 second timeout for faster fallback
      });
      const buffer = Buffer.from(response.data, 'binary');

      // Optimize and resize
      const optimized = await sharp(buffer)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 80 }) // Compress to WebP!
        .toBuffer();

      res.set('Content-Type', 'image/webp');
      res.set('Cache-Control', 'public, max-age=31536000, immutable'); // Cache for 1 year
      res.send(optimized);
    } catch (e: any) {
      const urlParam = req.query.url as string;
      if (e.response && e.response.status === 404) {
        // Silently handle 404s without polluting the console
        // console.warn(`[Image Proxy Error] 404 Not Found: ${urlParam}`);
      } else if (e.code === 'ECONNABORTED' || e.message?.includes('timeout')) {
        console.warn(`[Image Proxy] Timeout falling back to direct URL: ${urlParam}`);
      } else {
        console.error(`[Image Proxy Error] ${e.message} - URL: ${urlParam}`);
      }

      // Avoid raw redirects which might fail due to CORS or Hotlink protection.
      // Instead, redirect to a highly reliable category-appropriate fallback image.
      if (typeof req.query.url === 'string') {
        const lowerUrl = req.query.url.toLowerCase();
        if (lowerUrl.includes('emote') || lowerUrl.includes('social')) {
          res.redirect('https://thebestfan.online/img/public/logo/imageSocial.png');
        } else if (lowerUrl.includes('skin') || lowerUrl.includes('fanz') || lowerUrl.includes('myfan')) {
          res.redirect('https://thebestfan.online/img/public/logo/imageMyfan.png');
        } else if (lowerUrl.includes('action') || lowerUrl.includes('force')) {
          res.redirect('https://thebestfan.online/img/public/logo/imageForce.png');
        } else {
          res.redirect('https://thebestfan.online/img/public/logo/imageMydeck.png');
        }
      } else {
        res.status(500).send("Error processing image");
      }
    }
  });

  // Diagnostic route
  app.get("/api/diag", (req, res) => {
    res.json({
      status: "ok",
      env: {
        hasFootballKey: !!process.env.VITE_FOOTBALL_API_KEY,
        footballKeyLength: process.env.VITE_FOOTBALL_API_KEY?.length || 0,
        nodeEnv: process.env.NODE_ENV,
      }
    });
  });

  // Football API Proxy with Caching, Request Collapsing, and Stale Fallbacks
  interface FootballCacheEntry {
    data: any;
    timestamp: number;
  }
  const footballCache: Record<string, FootballCacheEntry> = {};
  const inFlightFootballRequests: Record<string, Promise<FootballCacheEntry | null>> = {};
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes default fallback cache
  
  // Track finished fixtures in memory so we don't spam requests for completed matches
  const finishedFixturesSet = new Set<string>();

  function getCustomTTL(endpoint: string, queryParams: any): number {
    // 1. Static/Slow-moving endpoints (leagues, teams, standings, players, squads etc.)
    if (
      endpoint.includes("leagues") ||
      endpoint.includes("teams") ||
      endpoint.includes("players") ||
      endpoint.includes("venues")
    ) {
      return 12 * 60 * 60 * 1000; // 12 hours
    }

    if (endpoint.includes("standings")) {
      return 5 * 60 * 1000; // 5 minutes (so rankings update quickly after a match)
    }

    // 2. Fixtures
    if (endpoint.includes("fixtures")) {
      // Live matches or World Cup 2026 fixtures (League 1, Season 2026)
      if (
        queryParams.live === 'all' || 
        queryParams.live || 
        (String(queryParams.league) === '1' && String(queryParams.season) === '2026')
      ) {
        return 60 * 1000; // 60 seconds (quick update for active matches/World Cup 2026)
      }

      // Querying a specific fixture (by id or ids)
      const fixtureId = queryParams.id || queryParams.fixture;
      if (fixtureId) {
        if (finishedFixturesSet.has(String(fixtureId))) {
          return 24 * 60 * 60 * 1000; // 24 hours for completed matches
        }
        return 60 * 1000; // 60 seconds for active/upcoming match details
      }

      // Querying fixtures by date
      if (queryParams.date) {
        const dateStr = String(queryParams.date); // e.g., YYYY-MM-DD
        const todayStr = new Date().toISOString().split('T')[0];

        if (dateStr < todayStr) {
          return 24 * 60 * 60 * 1000; // 24 hours (past matches won't change)
        } else if (dateStr > todayStr) {
          return 4 * 60 * 60 * 1000; // 4 hours for future matches
        } else {
          return 60 * 1000; // 60 seconds for today's matches
        }
      }
    }

    // 3. Match details (events, lineups, statistics) using fixture ID
    if (
      endpoint.includes("fixtures/events") ||
      endpoint.includes("fixtures/lineups") ||
      endpoint.includes("fixtures/statistics")
    ) {
      const parentFixtureId = queryParams.fixture;
      if (parentFixtureId && finishedFixturesSet.has(String(parentFixtureId))) {
        return 24 * 60 * 60 * 1000; // 24 hours for finished match stats
      }
      return 60 * 1000; // 60 seconds for live match details updates
    }

    return CACHE_TTL;
  }

  app.get("/api/football/*", async (req, res) => {
    const endpoint = req.params[0].replace(/^\//, "");
    const queryParams = req.query;
    const cacheKey = `${endpoint}?${JSON.stringify(queryParams)}`;

    // Calculate current TTL for checking
    const currentTTL = getCustomTTL(endpoint, queryParams);

    // Check memory cache
    const cached = footballCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < currentTTL) {
      console.log(`[Football Proxy] Serving from cache: ${cacheKey} (TTL: ${currentTTL / 1000}s)`);
      return res.json(cached.data);
    }

    // Check if there is already an in-flight request for this exact query to collapse concurrent duplicate requests
    if (inFlightFootballRequests[cacheKey]) {
      console.log(`[Football Proxy] Request collapsing: Waiting for active in-flight request: ${cacheKey}`);
      try {
        const result = await inFlightFootballRequests[cacheKey];
        if (result && result.data) {
          console.log(`[Football Proxy] Collapsed request finished successfully. Serving from updated cache: ${cacheKey}`);
          return res.json(result.data);
        }
      } catch (err: any) {
        console.warn(`[Football Proxy] In-flight collapsed request failed for: ${cacheKey}`, err?.message);
      }

      // If collapsed request failed, fall back to stale cache if available
      if (cached) {
        console.log(`[Football Proxy] Collapsed request failed, serving stale cache for: ${cacheKey}`);
        return res.json(cached.data);
      }
      return res.json({ get: endpoint, parameters: queryParams, errors: [], results: 0, paging: { current: 1, total: 1 }, response: [] });
    }

    const url = `https://v3.football.api-sports.io/${endpoint}`;
    const apiKey = process.env.VITE_FOOTBALL_API_KEY;
    
    if (!apiKey) {
      console.error("[Football Proxy] ERROR: VITE_FOOTBALL_API_KEY is missing in environment variables");
      return res.status(500).json({ 
        error: "VITE_FOOTBALL_API_KEY is not configured on the server.",
        details: "Please add VITE_FOOTBALL_API_KEY to your environment variables in the AI Studio settings."
      });
    }

    console.log(`[Football Proxy] Fetching from upstream API: ${url}`, queryParams);

    // Create the in-flight promise and track it
    const fetchPromise = (async (): Promise<FootballCacheEntry | null> => {
      try {
        const response = await axios.get(url, {
          params: queryParams,
          headers: {
            "x-rapidapi-key": apiKey,
            "x-apisports-key": apiKey,
            "x-rapidapi-host": "v3.football.api-sports.io",
          },
          timeout: 15000 // 15 seconds timeout
        });

        // Handle API-Sports 200 OK error bodies
        if (response.data && response.data.errors && Object.keys(response.data.errors).length > 0) {
          const errorsStr = JSON.stringify(response.data.errors);
          console.warn(`[Football Proxy] Upstream API returned errors:`, errorsStr);
          
          const isRateLimit = errorsStr.toLowerCase().includes("rate limit") || 
                              errorsStr.toLowerCase().includes("exceeded") || 
                              errorsStr.toLowerCase().includes("requests");
          
          if (isRateLimit) {
            const err: any = new Error("Rate exceeded");
            err.isRateLimit = true;
            throw err;
          }
          throw new Error(`Upstream API Error: ${errorsStr}`);
        }

        console.log(`[Football Proxy] Upstream success: ${url} - Status: ${response.status}`);
        
        // Scan response to detect and save finished fixtures
        if (response.data && Array.isArray(response.data.response)) {
          response.data.response.forEach((item: any) => {
            const fId = item.fixture?.id;
            const status = item.fixture?.status?.short;
            if (fId && (status === "FT" || status === "AET" || status === "PEN")) {
              finishedFixturesSet.add(String(fId));
              checkAndFinishWarOfKopsDuels(fId);
            }
          });
        }

        const entry: FootballCacheEntry = {
          data: response.data,
          timestamp: Date.now()
        };

        // Update the cache
        footballCache[cacheKey] = entry;
        return entry;
      } catch (error: any) {
        const isRateLimit = error.isRateLimit ||
                            error.response?.status === 429 ||
                            error.response?.status === 403 ||
                            String(error.response?.data || "").toLowerCase().includes("exceeded") ||
                            String(error.response?.data || "").toLowerCase().includes("rate limit") ||
                            String(error.message || "").toLowerCase().includes("rate exceeded") ||
                            String(error.message || "").toLowerCase().includes("rate limit");

        if (isRateLimit) {
          console.warn(`[Football Proxy Rate Limit] Upstream returned rate limit or quota exceeded for ${url}. Handled gracefully.`);
          if (cached) {
            console.log(`[Football Proxy] Rate limit hit. Returning cached stale entry for ${cacheKey}`);
            return cached;
          }
          // Cache an empty success structure briefly to prevent infinite spamming
          const fallbackEntry: FootballCacheEntry = {
            data: { get: endpoint, parameters: queryParams, errors: [], results: 0, paging: { current: 1, total: 1 }, response: [] },
            timestamp: Date.now() - (currentTTL - 15000) // 15 seconds remainder TTL
          };
          footballCache[cacheKey] = fallbackEntry;
          return fallbackEntry;
        }

        console.error(`[Football Proxy Error] for ${url}:`, {
          status: error.response?.status,
          message: error.message,
        });

        throw error;
      } finally {
        // Clean up from the map of active promises
        delete inFlightFootballRequests[cacheKey];
      }
    })();

    inFlightFootballRequests[cacheKey] = fetchPromise;

    try {
      const result = await fetchPromise;
      if (result) {
        return res.json(result.data);
      }
      throw new Error("Empty fetch result");
    } catch (error: any) {
      if (cached) {
        console.log(`[Football Proxy] Ultimate fetch exception: serving stale cache for: ${cacheKey}`);
        return res.json(cached.data);
      }
      // Always return 200 OK with empty template rather than propagate 429/500 to frontend
      console.warn(`[Football Proxy] Fetch exception with no cache. Returning empty fallback JSON format. Status: ${error.response?.status || 500}`);
      return res.json({ get: endpoint, parameters: queryParams, errors: [], results: 0, paging: { current: 1, total: 1 }, response: [] });
    }
  });

  app.get('/api/debug/rankings', async (req, res) => {
    try {
      const adminModule = await import('firebase-admin');
      const admin = adminModule.default || adminModule;
      const { getFirestore } = await import('firebase-admin/firestore');
      
      const fs = await import('fs');
      const path = await import('path');
      const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

      if (!admin.apps.length) {
        let credentialOptions = {};
        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
          try {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
            credentialOptions = { credential: admin.credential.cert(serviceAccount) };
          } catch(e) {}
        }
        admin.initializeApp({
          projectId: config.projectId,
          ...credentialOptions
        });
      }
      
      const db = getFirestore(admin.app(), config.firestoreDatabaseId || '(default)');
      const teamsSnap = await db.collection('ranking_teams').get();
      const usersSnap = await db.collection('ranking_users').get();
      
      res.json({
        teamsCount: teamsSnap.size,
        teams: teamsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        usersCount: usersSnap.size,
        users: usersSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("[Server Error]", err);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Running on http://0.0.0.0:${PORT}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV}`);
    console.log(`[Server] Football API Key: ${process.env.VITE_FOOTBALL_API_KEY ? 'Configured (length: ' + process.env.VITE_FOOTBALL_API_KEY.length + ')' : 'MISSING'}`);
  });
}

startServer();
