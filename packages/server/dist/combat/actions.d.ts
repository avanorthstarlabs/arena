export declare const ACTIONS: readonly ["light_punch", "heavy_punch", "light_kick", "heavy_kick", "block_high", "block_low", "dodge_back", "dodge_forward", "uppercut", "sweep", "grab", "taunt"];
export type Action = (typeof ACTIONS)[number];
export type ActionCategory = "light_attack" | "heavy_attack" | "block" | "dodge" | "special";
export declare function categorize(action: Action): ActionCategory;
/** Base damage values per action */
export declare const BASE_DAMAGE: Record<Action, number>;
/** Stamina cost per action */
export declare const STAMINA_COST: Record<Action, number>;
