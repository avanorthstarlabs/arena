import { type Action } from "./actions.js";
export interface FighterState {
    hp: number;
    stamina: number;
}
export interface ExchangeResult {
    /** Damage dealt BY player 1 (to player 2) */
    p1Damage: number;
    /** Damage dealt BY player 2 (to player 1) */
    p2Damage: number;
    /** Stamina change for player 1 (negative = cost, positive = regen) */
    p1StaminaChange: number;
    /** Stamina change for player 2 */
    p2StaminaChange: number;
    /** What happened this exchange */
    narrative: string;
}
/**
 * Resolve one simultaneous exchange between two fighters.
 *
 * Priority system:
 *  - Light beats Heavy (interrupt)
 *  - Heavy beats Block (guard break, reduced damage)
 *  - Block beats Light (absorb)
 *  - Dodge avoids everything, deals nothing
 *  - Specials beat blocks, lose to attacks
 *  - Same-category = both land (trade)
 *  - Taunt = free stamina regen, but vulnerable to everything
 */
export declare function resolveExchange(p1Action: Action, p2Action: Action, p1State: FighterState, p2State: FighterState): ExchangeResult;
