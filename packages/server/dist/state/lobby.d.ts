import { Fight } from "../combat/fight.js";
import type { Action } from "../combat/actions.js";
export declare const SIDE_BET_RAKE = 0.03;
export interface Agent {
    id: string;
    skillsMd: string;
    walletAddress: string;
    characterId: string;
    wins: number;
    losses: number;
    registeredAt: number;
}
export interface Challenge {
    id: string;
    challengerId: string;
    targetId: string;
    wagerAmount: number;
    createdAt: number;
    expiresAt: number;
    status: "pending" | "accepted" | "declined" | "expired";
}
export interface SideBet {
    id: string;
    fightId: string;
    walletAddress: string;
    backedAgent: string;
    amount: number;
    placedAt: number;
    status: "active" | "won" | "lost" | "refunded";
}
export interface Payout {
    betId: string;
    walletAddress: string;
    backedAgent: string;
    betAmount: number;
    payout: number;
    status: "won" | "lost" | "refunded";
}
export interface ResolutionResult {
    fightId: string;
    winner: string | null;
    totalPool: number;
    rake: number;
    netPool: number;
    payouts: Payout[];
}
export declare class Lobby {
    onFightUpdate?: (fightId: string, state: any) => void;
    agents: Map<string, Agent>;
    challenges: Map<string, Challenge>;
    fights: Map<string, Fight>;
    fightAgents: Map<string, [string, string]>;
    sideBets: Map<string, SideBet[]>;
    registerAgent(id: string, skillsMd: string, walletAddress: string, characterId: string): Agent;
    createChallenge(challengerId: string, targetId: string, wagerAmount: number): Challenge;
    acceptChallenge(challengeId: string, agentId: string): Fight;
    submitAction(fightId: string, agentId: string, action: Action): import("../combat/resolve.js").ExchangeResult | null;
    getFight(fightId: string): Fight | undefined;
    getActiveFights(): Array<{
        fightId: string;
        agents: [string, string];
    }>;
    placeSideBet(fightId: string, walletAddress: string, backedAgent: string, amount: number): SideBet;
    getSideBets(fightId: string): {
        bets: SideBet[];
        pool: {
            p1: number;
            p2: number;
        };
    };
    recordFightResult(fightId: string): {
        winner: string | null;
        loser: string | null;
    };
    resolveSideBets(fightId: string): ResolutionResult;
}
