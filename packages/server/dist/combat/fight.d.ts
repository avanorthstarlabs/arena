import { type Action } from "./actions.js";
import { type ExchangeResult } from "./resolve.js";
export type FightStatus = "waiting_for_actions" | "round_over" | "fight_over";
export interface FighterSnapshot {
    agentId: string;
    hp: number;
    stamina: number;
    roundWins: number;
}
export interface ExchangeRecord {
    round: number;
    exchange: number;
    p1Action: Action;
    p2Action: Action;
    result: ExchangeResult;
}
export interface FightState {
    fightId: string;
    round: number;
    exchange: number;
    maxExchanges: number;
    roundsToWin: number;
    p1: FighterSnapshot;
    p2: FighterSnapshot;
    status: FightStatus;
    lastResult: ExchangeResult | null;
    history: ExchangeRecord[];
}
export declare class Fight {
    private fightId;
    private p1Id;
    private p2Id;
    private p1Hp;
    private p2Hp;
    private p1Stamina;
    private p2Stamina;
    private p1RoundWins;
    private p2RoundWins;
    private round;
    private exchange;
    private status;
    private pendingP1;
    private pendingP2;
    private lastResult;
    private history;
    constructor(fightId: string, p1Id: string, p2Id: string);
    /** Submit an action for one fighter. Returns the exchange result when both have submitted. */
    submitAction(agentId: string, action: Action): ExchangeResult | null;
    private resolve;
    private endRound;
    /** Start the next round. Only valid when status is "round_over". */
    nextRound(): void;
    /** Get the winner's agent ID. Only valid when fight_over. */
    getWinner(): string | null;
    getState(): FightState;
}
