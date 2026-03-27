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

  // Simple game state for active duels (tug of war)
  const duelStates: Record<string, { progress: number; teamA: number; teamB: number }> = {};

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("join-duel", (duelId) => {
      socket.join(duelId);
      if (!duelStates[duelId]) {
        duelStates[duelId] = { progress: 50, teamA: 0, teamB: 0 };
      }
      socket.emit("duel-update", duelStates[duelId]);
    });

    socket.on("click-ferveur", ({ duelId, team, multiplier }) => {
      if (duelStates[duelId]) {
        const baseDelta = 0.5;
        const delta = (team === "A" ? baseDelta : -baseDelta) * (multiplier || 1);
        duelStates[duelId].progress = Math.min(100, Math.max(0, duelStates[duelId].progress + delta));
        io.to(duelId).emit("duel-update", duelStates[duelId]);
        
        if (duelStates[duelId].progress >= 100 || duelStates[duelId].progress <= 0) {
          io.to(duelId).emit("duel-finished", { winner: duelStates[duelId].progress >= 100 ? "A" : "B" });
        }
      }
    });

    socket.on("play-card", ({ duelId, team, card }) => {
      if (duelStates[duelId]) {
        // Handle immediate effects on server state (like progress)
        card.effects.forEach((effect: any) => {
          if (effect.type === 'push_rope' && effect.value) {
            const delta = team === "A" ? effect.value : -effect.value;
            duelStates[duelId].progress = Math.min(100, Math.max(0, duelStates[duelId].progress + delta));
          }
        });
        
        // Broadcast the updated state to everyone
        io.to(duelId).emit("duel-update", duelStates[duelId]);
        
        // Broadcast the card play to the opponent for visual/status effects
        socket.to(duelId).emit("enemy-card-played", { team, card });

        // Check for win condition after card play
        if (duelStates[duelId].progress >= 100 || duelStates[duelId].progress <= 0) {
          io.to(duelId).emit("duel-finished", { winner: duelStates[duelId].progress >= 100 ? "A" : "B" });
        }
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
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
