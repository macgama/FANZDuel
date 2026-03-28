import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import * as dotenv from "dotenv";

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
  }> = {};

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("join-duel", ({ user, fanz, type, matchId }) => {
      // Matchmaking logic
      let duelId = '';
      
      if (type === 'training') {
        duelId = `training_${socket.id}`;
      } else if (type === 'war_of_kops') {
        duelId = `war_of_kops_${matchId || 'global'}`;
      } else {
        // Find a waiting duel of same type and match
        const requiredPlayers = { '1v1': 2, '2v2': 4, '5v5': 10 }[type as '1v1' | '2v2' | '5v5'] || 2;
        const availableDuel = Object.values(duels).find(d => 
          d.type === type && 
          d.status === 'waiting' && 
          d.participants.length < requiredPlayers &&
          (!matchId || d.matchId === matchId)
        );
        
        if (availableDuel) {
          duelId = availableDuel.id;
        } else {
          duelId = `duel_${Math.random().toString(36).substring(7)}`;
        }
      }

      if (!duels[duelId]) {
        duels[duelId] = {
          id: duelId,
          type: type || '1v1',
          status: type === 'training' || type === 'war_of_kops' ? 'active' : 'waiting',
          progress: 50,
          participants: [],
          matchId,
          scores: type === 'war_of_kops' ? { A: 0, B: 0 } : undefined,
          clickCounts: { A: 0, B: 0 },
          cardCounts: { A: 0, B: 0 }
        };
      }

      const duel = duels[duelId];
      socket.join(duelId);
      
      // Add participant if not already there
      if (!duel.participants.find(p => p.uid === user.uid)) {
        let team: 'A' | 'B' = 'A';
        if (type === 'war_of_kops') {
          const teamACount = duel.participants.filter(p => p.team === 'A').length;
          const teamBCount = duel.participants.filter(p => p.team === 'B').length;
          team = teamACount <= teamBCount ? 'A' : 'B';
        } else if (type !== 'training') {
          const maxPerTeam = { '1v1': 1, '2v2': 2, '5v5': 5 }[type as '1v1' | '2v2' | '5v5'] || 1;
          const teamACount = duel.participants.filter(p => p.team === 'A').length;
          if (teamACount < maxPerTeam) team = 'A';
          else team = 'B';
        }
        
        duel.participants.push({ ...user, fanz, team, socketId: socket.id });
      }

      io.to(duelId).emit("duel-update", { 
        progress: duel.progress, 
        status: duel.status, 
        participants: duel.participants,
        scores: duel.scores
      });

      // Check if duel should start
      const requiredPlayers = { '1v1': 2, '2v2': 4, '5v5': 10, 'training': 1, 'war_of_kops': 1 }[duel.type as keyof typeof requiredPlayers] || 2;
      
      if (duel.status === 'waiting' && duel.participants.length >= requiredPlayers) {
        duel.status = 'starting';
        const startTime = Date.now() + 5000;
        io.to(duelId).emit("duel-starting", { startTime });
        
        duel.timer = setTimeout(() => {
          duel.status = 'active';
          io.to(duelId).emit("duel-started");
        }, 5000) as any;
      }

      // Training mode: Start bot logic
      if (duel.type === 'training' && duel.status === 'active') {
        const botInterval = setInterval(() => {
          if (duel.status !== 'active') {
            clearInterval(botInterval);
            return;
          }
          const botMultiplier = 1;
          const baseDelta = 0.5;
          duel.progress = Math.min(100, Math.max(0, duel.progress - (baseDelta * botMultiplier)));
          io.to(duelId).emit("duel-update", { progress: duel.progress, status: duel.status, participants: duel.participants });

          if (duel.progress <= 0) {
            duel.status = 'finished';
            io.to(duelId).emit("duel-finished", { winner: "B" });
            clearInterval(botInterval);
          }
        }, 1500 + Math.random() * 1000);
      }
    });

    socket.on("click-ferveur", ({ duelId, team, multiplier }) => {
      const duel = duels[duelId];
      if (duel && duel.status === 'active') {
        duel.clickCounts[team]++;
        const baseDelta = 0.5;
        const delta = (team === "A" ? baseDelta : -baseDelta) * (multiplier || 1);
        duel.progress = Math.min(100, Math.max(0, duel.progress + delta));
        
        if (duel.type === 'war_of_kops') {
          if (duel.progress >= 100 || duel.progress <= 0) {
            if (duel.scores) {
              if (duel.progress >= 100) duel.scores.A++;
              else duel.scores.B++;
            }
            duel.progress = 50; // Reset for continuous battle
          }
        } else if (duel.progress >= 100 || duel.progress <= 0) {
          duel.status = 'finished';
          const winner = duel.progress >= 100 ? "A" : "B";
          io.to(duelId).emit("duel-finished", { winner });
        }
        
        io.to(duelId).emit("duel-update", { 
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
        
        if (card.fervorValue) {
          const delta = team === "A" ? card.fervorValue : -card.fervorValue;
          duel.progress = Math.min(100, Math.max(0, duel.progress + delta));
        }

        card.effects.forEach((effect: any) => {
          if (effect.type === 'push_rope' && effect.value && !card.fervorValue) {
            const delta = team === "A" ? effect.value : -effect.value;
            duel.progress = Math.min(100, Math.max(0, duel.progress + delta));
          }
        });
        
        if (duel.type === 'war_of_kops') {
          if (duel.progress >= 100 || duel.progress <= 0) {
            if (duel.scores) {
              if (duel.progress >= 100) duel.scores.A++;
              else duel.scores.B++;
            }
            duel.progress = 50;
          }
        } else if (duel.progress >= 100 || duel.progress <= 0) {
          duel.status = 'finished';
          const winner = duel.progress >= 100 ? "A" : "B";
          io.to(duelId).emit("duel-finished", { winner });
        }
        
        io.to(duelId).emit("duel-update", { 
          progress: duel.progress, 
          status: duel.status, 
          participants: duel.participants,
          scores: duel.scores
        });
        socket.to(duelId).emit("enemy-card-played", { team, card });
      }
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
            io.to(duel.id).emit("duel-update", { participants: duel.participants });
          }
        }
      });
    });
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
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

  // Football API Proxy
  app.get("/api/football/*", async (req, res) => {
    const endpoint = req.params[0].replace(/^\//, '');
    const queryParams = req.query;
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

      console.log(`[Football Proxy] Success: ${url} - Status: ${response.status}`);
      res.json(response.data);
    } catch (error: any) {
      const status = error.response?.status || 500;
      const errorData = error.response?.data || error.message;
      console.error(`[Football Proxy] ERROR for ${req.url}:`, {
        status,
        message: error.message,
        data: errorData
      });
      
      res.status(status).json({ 
        error: "Failed to fetch from football API",
        message: error.message,
        details: errorData
      });
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
