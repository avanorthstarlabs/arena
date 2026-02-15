import express from "express";
import cors from "cors";
import { createServer } from "http";
import { config } from "./config.js";
import { setupWebSocket } from "./api/ws.js";
import { createRouter } from "./api/routes.js";

const app = express();
const server = createServer(app);

app.use(cors({ origin: config.corsOrigins }));
app.use(express.json());

const { pit, fightManager, broadcastToFight } = setupWebSocket(server);
const router = createRouter({ pit, fightManager });
app.use("/api/v1", router);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

server.listen(config.port, () => {
  console.log(`Arena server running on port ${config.port}`);
});

export { app };
