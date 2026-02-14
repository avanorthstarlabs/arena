import { Prisma } from "@prisma/client";
declare const FIGHT_RAKE_BPS = 500;
declare const SIDEBET_RAKE_BPS = 300;
/**
 * Debit an agent's balance (for wagers). Throws if insufficient.
 */
export declare function debitBalance(agentId: string, amount: Prisma.Decimal): Promise<void>;
/**
 * Credit an agent's balance (for payouts).
 */
export declare function creditBalance(agentId: string, amount: Prisma.Decimal): Promise<void>;
/**
 * Resolve a fight: pay winner, deduct treasury fee, record ledger entry.
 */
export declare function resolveFightPayout(fightId: string, winnerId: string): Promise<{
    payout: Prisma.Decimal;
    fee: Prisma.Decimal;
}>;
export { FIGHT_RAKE_BPS, SIDEBET_RAKE_BPS };
