import { Router, type Request, type Response } from "express";
import { prisma } from "../db/client.js";
import type { Pit } from "../state/pit.js";
import type { FightManager } from "../state/fight-manager.js";

interface RouterDeps {
  pit: Pit;
  fightManager: FightManager;
}

export function createRouter({ pit, fightManager }: RouterDeps): Router {
  const router = Router();

  // --- Leaderboard (DB-backed, sorted by elo) ---
  router.get("/arena/leaderboard", async (_req: Request, res: Response) => {
    try {
      const agents = await prisma.agent.findMany({
        select: { id: true, username: true, characterId: true, elo: true, wins: true, losses: true },
        orderBy: { elo: "desc" },
        take: 100,
      });
      res.json({ ok: true, leaderboard: agents });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // --- List agents currently in The Pit ---
  router.get("/arena/agents", (_req: Request, res: Response) => {
    res.json({ ok: true, agents: pit.getAgentsList() });
  });

  // --- Active fights ---
  router.get("/arena/fights", (_req: Request, res: Response) => {
    const fights: Array<{ fightId: string; agent1: string; agent2: string; wager: number }> = [];
    for (const [fightId, active] of fightManager.activeFights) {
      const a1 = pit.agents.get(active.agent1Id);
      const a2 = pit.agents.get(active.agent2Id);
      fights.push({
        fightId,
        agent1: a1?.username ?? active.agent1Id,
        agent2: a2?.username ?? active.agent2Id,
        wager: active.wager,
      });
    }
    res.json({ ok: true, fights });
  });

  // --- Single fight state ---
  router.get("/arena/fight/:fightId", (req: Request, res: Response) => {
    const state = fightManager.getFightState(req.params.fightId);
    if (!state) return res.status(404).json({ ok: false, error: "Fight not found" });
    res.json({ ok: true, state });
  });

  // --- Stats ---
  router.get("/arena/stats", async (_req: Request, res: Response) => {
    try {
      const [totalFights, totalAgents] = await Promise.all([
        prisma.fight.count(),
        prisma.agent.count(),
      ]);
      res.json({
        ok: true,
        stats: {
          totalFights,
          totalAgents,
          activeFights: fightManager.activeFights.size,
          pitAgents: pit.agents.size,
        },
      });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // --- Agent profile by username ---
  router.get("/arena/agent/:username", async (req: Request, res: Response) => {
    try {
      const agent = await prisma.agent.findUnique({
        where: { username: req.params.username },
        select: { id: true, username: true, characterId: true, elo: true, wins: true, losses: true, createdAt: true },
      });
      if (!agent) return res.status(404).json({ ok: false, error: "Agent not found" });
      res.json({ ok: true, agent });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // --- Recent fights (for spectator view) ---
  router.get("/arena/recent-fights", async (_req: Request, res: Response) => {
    try {
      const fights = await prisma.fight.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          status: true,
          wagerAmount: true,
          createdAt: true,
          completedAt: true,
          agent1: { select: { username: true, characterId: true } },
          agent2: { select: { username: true, characterId: true } },
          winner: { select: { username: true } },
        },
      });
      res.json({ ok: true, fights });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  return router;
}
