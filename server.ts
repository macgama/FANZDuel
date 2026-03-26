import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";

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

    socket.on("click-ferveur", ({ duelId, team }) => {
      if (duelStates[duelId]) {
        const delta = team === "A" ? 0.5 : -0.5;
        duelStates[duelId].progress = Math.min(100, Math.max(0, duelStates[duelId].progress + delta));
        io.to(duelId).emit("duel-update", duelStates[duelId]);
        
        if (duelStates[duelId].progress >= 100 || duelStates[duelId].progress <= 0) {
          io.to(duelId).emit("duel-finished", { winner: duelStates[duelId].progress >= 100 ? "A" : "B" });
        }
      }
    });

    socket.on("play-card", ({ duelId, team, cardPower }) => {
      if (duelStates[duelId]) {
        const delta = team === "A" ? cardPower : -cardPower;
        duelStates[duelId].progress = Math.min(100, Math.max(0, duelStates[duelId].progress + delta));
        io.to(duelId).emit("duel-update", duelStates[duelId]);
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

  // Football API Proxy
  app.get("/api/football/*", async (req, res) => {
    const endpoint = req.params[0];
    const queryParams = new URLSearchParams(req.query as any).toString();
    const url = `https://v3.football.api-sports.io/${endpoint}${queryParams ? `?${queryParams}` : ""}`;
    
    const apiKey = process.env.VITE_FOOTBALL_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: "VITE_FOOTBALL_API_KEY is not configured on the server." });
    }

    try {
      const response = await fetch(url, {
        headers: {
          "x-rapidapi-key": apiKey,
          "x-apisports-key": apiKey,
          "x-rapidapi-host": "v3.football.api-sports.io",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).send(errorText);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error(`Proxy error for ${url}:`, error);
      res.status(500).json({ error: "Failed to fetch from football API" });
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

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
