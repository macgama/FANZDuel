import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import * as dotenv from "dotenv";
import sharp from "sharp";
import { BASE_CARDS } from "./src/constants/cards.ts";

dotenv.config();

async function startServer() {
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
    status: 'waiting' | 'starting' | 'active' | 'finished';
    progress: number;
    participants: any[];
    matchId?: number;
    startTime?: number;
    timer?: NodeJS.Timeout;
    scores?: { A: number; B: number };
    clickCounts: { A: number; B: number };
    cardCounts: { A: number; B: number };
    botInterval?: NodeJS.Timeout;
    isPrivate?: boolean;
    inviteCode?: string;
  }> = {};

  function finishDuel(duelId: string, winner: string) {
    const duel = duels[duelId];
    if (!duel) return;
    
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

    const details = {
      teamAActions,
      teamBActions,
      totalActions,
      baseWinnerPoints: 10,
      proportionalPointsA: scoreA - (winner === 'A' ? 10 : 0),
      proportionalPointsB: scoreB - (winner === 'B' ? 10 : 0)
    };

    io.to(duelId).emit("duel-finished", { winner, scoreA, scoreB, details });
  }

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("join-duel", ({ duelId: clientDuelId, user, fanz, type, matchId, team: chosenTeam, isPrivate, inviteCode }) => {
      // Check for reconnection
      if (clientDuelId && duels[clientDuelId]) {
        const existingDuel = duels[clientDuelId];
        const participant = existingDuel.participants.find(p => p.uid === user.uid);
        if (participant) {
          participant.socketId = socket.id;
          socket.join(clientDuelId);
          io.to(clientDuelId).emit("duel-update", { 
            duelId: existingDuel.id,
            progress: existingDuel.progress, 
            status: existingDuel.status, 
            participants: existingDuel.participants,
            scores: existingDuel.scores,
            isPrivate: existingDuel.isPrivate,
            inviteCode: existingDuel.inviteCode
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
      } else if (type === 'training') {
        duelId = clientDuelId || `training_${socket.id}`;
      } else if (type === 'war_of_kops') {
        duelId = clientDuelId || `war_of_kops_${matchId || 'global'}`;
      } else if (!isPrivate) {
        // Find a waiting public duel of same type and match
        const requiredPlayers = { '1v1': 2, '2v2': 4, '5v5': 10 }[type as '1v1' | '2v2' | '5v5'] || 2;
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
      } else {
        // Create a new private duel
        duelId = clientDuelId || `duel_${Math.random().toString(36).substring(7)}`;
      }

      if (!duels[duelId]) {
        duels[duelId] = {
          id: duelId,
          type: type || '1v1',
          status: type === 'training' ? 'active' : 'waiting',
          progress: 50,
          participants: [],
          matchId,
          scores: type === 'war_of_kops' ? { A: 0, B: 0 } : undefined,
          clickCounts: { A: 0, B: 0 },
          cardCounts: { A: 0, B: 0 },
          isPrivate: isPrivate || false,
          inviteCode: isPrivate ? Math.random().toString(36).substring(2, 8).toUpperCase() : undefined
        };
      }

      const duel = duels[duelId];
      socket.join(duelId);
      
      // Add participant if not already there
      if (!duel.participants.find(p => p.uid === user.uid)) {
        let team: 'A' | 'B' = 'A';
        const maxPerTeam = { '1v1': 1, '2v2': 2, '5v5': 5 }[type as '1v1' | '2v2' | '5v5'] || 999;
        const teamACount = duel.participants.filter(p => p.team === 'A').length;
        const teamBCount = duel.participants.filter(p => p.team === 'B').length;

        if (chosenTeam && (chosenTeam === 'A' || chosenTeam === 'B')) {
          const chosenCount = chosenTeam === 'A' ? teamACount : teamBCount;
          if (chosenCount < maxPerTeam) {
            team = chosenTeam;
          } else {
            // Fallback to other team if chosen is full
            team = chosenTeam === 'A' ? 'B' : 'A';
          }
        } else if (type === 'war_of_kops') {
          team = teamACount <= teamBCount ? 'A' : 'B';
        } else if (type !== 'training') {
          if (teamACount < maxPerTeam) team = 'A';
          else team = 'B';
        }
        
        duel.participants.push({ ...user, fanz, team, socketId: socket.id });
      }

      const participant = duel.participants.find(p => p.uid === user.uid);
      socket.emit("duel-joined", { 
        team: participant?.team || 'A', 
        duelId: duel.id, 
        participants: duel.participants 
      });

      io.to(duelId).emit("duel-update", { 
        duelId: duel.id,
        progress: duel.progress, 
        status: duel.status, 
        participants: duel.participants,
        scores: duel.scores
      });

      // Check if duel should start
      let shouldStart = false;
      if (duel.type === 'war_of_kops') {
        const hasTeamA = duel.participants.some(p => p.team === 'A');
        const hasTeamB = duel.participants.some(p => p.team === 'B');
        shouldStart = hasTeamA && hasTeamB;
      } else {
        const requiredPlayers = { '1v1': 2, '2v2': 4, '5v5': 10, 'training': 1 }[duel.type as string] || 2;
        shouldStart = duel.participants.length >= requiredPlayers;
      }
      
      if (duel.status === 'waiting' && shouldStart) {
        duel.status = 'starting';
        const startTime = Date.now() + 5000;
        io.to(duelId).emit("duel-starting", { startTime, duelId, duel });
        
        duel.timer = setTimeout(() => {
          duel.status = 'active';
          io.to(duelId).emit("duel-started");
        }, 5000) as any;
      }

      // Training mode: Start bot logic
      if (duel.type === 'training' && duel.status === 'active' && !duel.botInterval) {
        const botInterval = setInterval(() => {
          if (duel.status !== 'active') {
            clearInterval(botInterval);
            delete duel.botInterval;
            return;
          }
          const botMultiplier = 1;
          const baseDelta = 0.5;
          duel.progress = Math.min(100, Math.max(0, duel.progress - (baseDelta * botMultiplier)));
          
          // Occasional bot card play (10% chance per tick)
          if (Math.random() < 0.1) {
            const randomCard = BASE_CARDS[Math.floor(Math.random() * BASE_CARDS.length)];
            duel.cardCounts['B']++;
            
            if (randomCard.fervorValue) {
              duel.progress = Math.max(0, duel.progress - randomCard.fervorValue);
            }
            randomCard.effects.forEach((effect: any) => {
              if (effect.type === 'push_rope' && effect.value && !randomCard.fervorValue) {
                duel.progress = Math.max(0, duel.progress - effect.value);
              }
            });
            
            io.to(duelId).emit("enemy-card-played", { team: 'B', card: randomCard });
          }

          io.to(duelId).emit("duel-update", { duelId: duel.id, progress: duel.progress, status: duel.status, participants: duel.participants });

          if (duel.progress <= 0) {
            clearInterval(botInterval);
            delete duel.botInterval;
            finishDuel(duelId, "B");
          }
        }, 1500 + Math.random() * 1000);
        duel.botInterval = botInterval;
      }
    });

    socket.on("leave-duel", ({ duelId, userId }) => {
      const duel = duels[duelId];
      if (duel && duel.status === 'waiting') {
        duel.participants = duel.participants.filter(p => p.uid !== userId);
        socket.leave(duelId);
        io.to(duelId).emit("duel-update", { 
          duelId: duel.id, 
          progress: duel.progress, 
          status: duel.status, 
          participants: duel.participants 
        });
        
        // If no participants left, we could optionally delete the duel, but the user requested "Le DUEL est toujours inscrit"
        // So we just leave it empty.
      }
    });

    socket.on("click-ferveur", ({ duelId, team, multiplier }) => {
      const duel = duels[duelId];
      if (duel && duel.status === 'active') {
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

    socket.on("play-card", ({ duelId, team, card }) => {
      const duel = duels[duelId];
      if (duel && duel.status === 'active') {
        duel.cardCounts[team]++;
        const resistance = { '1v1': 1, '2v2': 2, '5v5': 5, 'war_of_kops': 50, 'training': 1 }[duel.type] || 1;
        
        if (card.fervorValue) {
          const delta = (team === "A" ? card.fervorValue : -card.fervorValue) / resistance;
          duel.progress = Math.min(100, Math.max(0, duel.progress + delta));
        }

        card.effects.forEach((effect: any) => {
          if (effect.type === 'push_rope' && effect.value && !card.fervorValue) {
            const delta = (team === "A" ? effect.value : -effect.value) / resistance;
            duel.progress = Math.min(100, Math.max(0, duel.progress + delta));
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
        socket.to(duelId).emit("enemy-card-played", { team, card });
      }
    });

    socket.on("swap-hands-init", ({ duelId, team, hand }) => {
      socket.to(duelId).emit("swap-hands-request", { fromTeam: team, opponentHand: hand });
    });

    socket.on("swap-hands-response", ({ duelId, team, hand }) => {
      socket.to(duelId).emit("swap-hands-complete", { newHand: hand });
    });

    socket.on("send-emote", ({ duelId, team, emoteId, senderId }) => {
      socket.to(duelId).emit("receive-emote", { team, emoteId, senderId });
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      // Clean up participants
      Object.values(duels).forEach(duel => {
        const index = duel.participants.findIndex(p => p.socketId === socket.id);
        if (index !== -1) {
          duel.participants.splice(index, 1);
          if (duel.participants.length === 0 && duel.type !== 'war_of_kops') {
            if (duel.timer) clearTimeout(duel.timer);
            delete duels[duel.id];
          } else {
            io.to(duel.id).emit("duel-update", { duelId: duel.id, participants: duel.participants });
          }
        }
      });
    });
  });

  // API Routes
  app.get("/api/duels/all", (req, res) => {
    const allActiveDuels = Object.values(duels).filter(d => d.status !== 'finished' && !d.isPrivate);
    res.json(allActiveDuels);
  });

  app.get("/api/duels", (req, res) => {
    const waitingDuels = Object.values(duels).filter(d => d.status === 'waiting' && !d.isPrivate);
    console.log(`[API] Fetching waiting duels. Count: ${waitingDuels.length}`);
    res.json(waitingDuels);
  });

  app.get("/api/duels/:matchId", (req, res) => {
    const matchIdStr = req.params.matchId;
    const activeDuels = Object.values(duels).filter(d => 
      d.matchId?.toString() === matchIdStr && d.status === 'waiting' && !d.isPrivate
    );
    res.json(activeDuels);
  });

  app.get("/api/duels/code/:code", (req, res) => {
    const code = req.params.code.toUpperCase();
    const duel = Object.values(duels).find(d => d.inviteCode === code && d.status === 'waiting');
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

      // Fetch the original image
      const response = await axios.get(targetUrl, { 
        responseType: 'arraybuffer',
        timeout: 8000 // 8 second timeout so it doesn't hang
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
      } else {
        console.error(`[Image Proxy Error] ${e.message} - URL: ${urlParam}`);
      }

      // If it fails, redirect to original image to let the browser handle the 404
      if (typeof req.query.url === 'string') {
        res.redirect(req.query.url);
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

  // Football API Proxy with Caching
  const footballCache: Record<string, { data: any; timestamp: number }> = {};
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

  app.get("/api/football/*", async (req, res) => {
    const endpoint = req.params[0].replace(/^\//, "");
    const queryParams = req.query;
    const cacheKey = `${endpoint}?${JSON.stringify(queryParams)}`;

    // Check cache
    const cached = footballCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[Football Proxy] Serving from cache: ${cacheKey}`);
      return res.json(cached.data);
    }

    const url = `https://v3.football.api-sports.io/${endpoint}`;
    
    console.log(`[Football Proxy] Requesting: ${url}`, queryParams);
    
    const apiKey = process.env.VITE_FOOTBALL_API_KEY;
    
    if (!apiKey) {
      console.error("[Football Proxy] ERROR: VITE_FOOTBALL_API_KEY is missing in environment variables");
      return res.status(500).json({ 
        error: "VITE_FOOTBALL_API_KEY is not configured on the server.",
        details: "Please add VITE_FOOTBALL_API_KEY to your environment variables in the AI Studio settings."
      });
    }

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

      // Handle API-Sports specific errors that return 200 OK
      if (response.data && response.data.errors && Object.keys(response.data.errors).length > 0) {
        console.warn(`[Football Proxy] API returned errors:`, JSON.stringify(response.data.errors));
        
        if (cached) {
          console.log(`[Football Proxy] API error, serving stale cache for: ${cacheKey}`);
          return res.json(cached.data);
        }
        // Return empty response to prevent app crash for ANY error
        return res.json({ get: endpoint, parameters: queryParams, errors: [], results: 0, paging: { current: 1, total: 1 }, response: [] });
      }

      console.log(`[Football Proxy] Success: ${url} - Status: ${response.status}`);
      
      // Cache the successful response
      footballCache[cacheKey] = {
        data: response.data,
        timestamp: Date.now()
      };

      res.json(response.data);
    } catch (error: any) {
      const status = error.response?.status || 500;
      const errorData = error.response?.data || error.message;
      console.error(`[Football Proxy] ERROR for ${req.url}:`, {
        status,
        message: error.message,
        data: errorData
      });
      
      if (status === 429 || status === 403) {
        if (cached) {
          console.log(`[Football Proxy] Rate limit hit (${status}), serving stale cache for: ${cacheKey}`);
          return res.json(cached.data);
        }
        return res.json({ get: endpoint, parameters: queryParams, errors: [], results: 0, paging: { current: 1, total: 1 }, response: [] });
      }
      
      res.status(status).json({ 
        error: "Failed to fetch from football API",
        message: error.message,
        details: errorData
      });
    }
  });

  app.get('/api/debug/rankings', async (req, res) => {
    try {
      const admin = await import('firebase-admin');
      const { getFirestore } = await import('firebase-admin/firestore');
      
      const fs = await import('fs');
      const path = await import('path');
      const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

      if (!admin.apps.length) {
        admin.initializeApp({
          projectId: config.projectId,
        });
      }
      
      const db = getFirestore(config.firestoreDatabaseId || '(default)');
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
