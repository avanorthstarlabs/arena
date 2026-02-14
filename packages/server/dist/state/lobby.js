import { nanoid } from "nanoid";
import { Fight } from "../combat/fight.js";
export const SIDE_BET_RAKE = 0.03;
export class Lobby {
    onFightUpdate;
    agents = new Map();
    challenges = new Map();
    fights = new Map();
    fightAgents = new Map();
    sideBets = new Map(); // fightId -> bets
    registerAgent(id, skillsMd, walletAddress, characterId) {
        if (this.agents.has(id))
            throw new Error(`Agent ${id} already registered`);
        const agent = { id, skillsMd, walletAddress, characterId, wins: 0, losses: 0, registeredAt: Date.now() };
        this.agents.set(id, agent);
        return agent;
    }
    createChallenge(challengerId, targetId, wagerAmount) {
        if (!this.agents.has(challengerId))
            throw new Error("Challenger not registered");
        if (!this.agents.has(targetId))
            throw new Error("Target not registered");
        if (challengerId === targetId)
            throw new Error("Cannot challenge yourself");
        const challenge = {
            id: nanoid(),
            challengerId,
            targetId,
            wagerAmount,
            createdAt: Date.now(),
            expiresAt: Date.now() + 5 * 60 * 1000,
            status: "pending",
        };
        this.challenges.set(challenge.id, challenge);
        return challenge;
    }
    acceptChallenge(challengeId, agentId) {
        const challenge = this.challenges.get(challengeId);
        if (!challenge)
            throw new Error("Challenge not found");
        if (challenge.targetId !== agentId)
            throw new Error("Not the challenge target");
        if (challenge.status === "pending" && Date.now() > challenge.expiresAt) {
            challenge.status = "expired";
        }
        if (challenge.status !== "pending")
            throw new Error("Challenge not pending");
        challenge.status = "accepted";
        const fightId = nanoid();
        const fight = new Fight(fightId, challenge.challengerId, challenge.targetId);
        this.fights.set(fightId, fight);
        this.fightAgents.set(fightId, [challenge.challengerId, challenge.targetId]);
        return fight;
    }
    submitAction(fightId, agentId, action) {
        const fight = this.fights.get(fightId);
        if (!fight)
            throw new Error("Fight not found");
        const result = fight.submitAction(agentId, action);
        if (result !== null) {
            this.onFightUpdate?.(fightId, fight.getState());
        }
        return result;
    }
    getFight(fightId) {
        return this.fights.get(fightId);
    }
    getActiveFights() {
        const active = [];
        for (const [fightId, fight] of this.fights) {
            if (fight.getState().status !== "fight_over") {
                active.push({ fightId, agents: this.fightAgents.get(fightId) });
            }
        }
        return active;
    }
    placeSideBet(fightId, walletAddress, backedAgent, amount) {
        const fight = this.fights.get(fightId);
        if (!fight)
            throw new Error("Fight not found");
        if (fight.getState().status === "fight_over")
            throw new Error("Fight already over");
        const agents = this.fightAgents.get(fightId);
        if (!agents.includes(backedAgent))
            throw new Error("Agent not in this fight");
        if (amount <= 0)
            throw new Error("Bet amount must be positive");
        const bet = {
            id: nanoid(),
            fightId,
            walletAddress,
            backedAgent,
            amount,
            placedAt: Date.now(),
            status: "active",
        };
        if (!this.sideBets.has(fightId))
            this.sideBets.set(fightId, []);
        this.sideBets.get(fightId).push(bet);
        return bet;
    }
    getSideBets(fightId) {
        const bets = this.sideBets.get(fightId) ?? [];
        const agents = this.fightAgents.get(fightId);
        const pool = { p1: 0, p2: 0 };
        if (agents) {
            for (const bet of bets) {
                if (bet.backedAgent === agents[0])
                    pool.p1 += bet.amount;
                else
                    pool.p2 += bet.amount;
            }
        }
        return { bets, pool };
    }
    recordFightResult(fightId) {
        const fight = this.fights.get(fightId);
        if (!fight)
            throw new Error("Fight not found");
        const state = fight.getState();
        if (state.status !== "fight_over")
            throw new Error("Fight not over yet");
        const winner = fight.getWinner();
        const [agentId1, agentId2] = this.fightAgents.get(fightId) ?? [null, null];
        if (winner !== null) {
            const winnerAgent = this.agents.get(winner);
            const loser = winner === agentId1 ? agentId2 : agentId1;
            const loserAgent = this.agents.get(loser);
            if (winnerAgent)
                winnerAgent.wins++;
            if (loserAgent)
                loserAgent.losses++;
            return { winner, loser };
        }
        return { winner: null, loser: null };
    }
    resolveSideBets(fightId) {
        const fight = this.fights.get(fightId);
        this.recordFightResult(fightId);
        if (!fight)
            throw new Error("Fight not found");
        const winner = fight.getWinner();
        const state = fight.getState();
        if (state.status !== "fight_over")
            throw new Error("Fight not over yet");
        const bets = this.sideBets.get(fightId) ?? [];
        if (bets.length === 0) {
            return {
                fightId,
                winner,
                totalPool: 0,
                rake: 0,
                netPool: 0,
                payouts: [],
            };
        }
        const RAKE_RATE = SIDE_BET_RAKE;
        const payouts = [];
        // Calculate totals
        const totalPool = bets.reduce((sum, bet) => sum + bet.amount, 0);
        // Handle draw case
        if (winner === null) {
            for (const bet of bets) {
                bet.status = "refunded";
                payouts.push({
                    betId: bet.id,
                    walletAddress: bet.walletAddress,
                    backedAgent: bet.backedAgent,
                    betAmount: bet.amount,
                    payout: bet.amount,
                    status: "refunded",
                });
            }
            return {
                fightId,
                winner: null,
                totalPool,
                rake: 0,
                netPool: totalPool,
                payouts,
            };
        }
        // Calculate winner side total
        const winnerSideTotal = bets
            .filter((bet) => bet.backedAgent === winner)
            .reduce((sum, bet) => sum + bet.amount, 0);
        let rake = Math.round(totalPool * RAKE_RATE * 100) / 100;
        let netPool = totalPool - rake;
        // If all bets on losing side, refund everyone
        if (winnerSideTotal === 0) {
            rake = 0;
            netPool = totalPool;
            for (const bet of bets) {
                bet.status = "refunded";
                payouts.push({
                    betId: bet.id,
                    walletAddress: bet.walletAddress,
                    backedAgent: bet.backedAgent,
                    betAmount: bet.amount,
                    payout: bet.amount,
                    status: "refunded",
                });
            }
        }
        else {
            // Normal payout distribution
            for (const bet of bets) {
                if (bet.backedAgent === winner) {
                    const payout = Math.round((bet.amount / winnerSideTotal) * netPool * 100) / 100;
                    bet.status = "won";
                    payouts.push({
                        betId: bet.id,
                        walletAddress: bet.walletAddress,
                        backedAgent: bet.backedAgent,
                        betAmount: bet.amount,
                        payout,
                        status: "won",
                    });
                }
                else {
                    bet.status = "lost";
                    payouts.push({
                        betId: bet.id,
                        walletAddress: bet.walletAddress,
                        backedAgent: bet.backedAgent,
                        betAmount: bet.amount,
                        payout: 0,
                        status: "lost",
                    });
                }
            }
        }
        return {
            fightId,
            winner,
            totalPool,
            rake,
            netPool,
            payouts,
        };
    }
}
