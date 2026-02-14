import type { Server } from "http";
import type { Lobby } from "../state/lobby.js";
export declare function setupWebSocket(server: Server, _lobby: Lobby): {
    broadcast: (event: string, data: unknown) => void;
    broadcastToFight: (fightId: string, event: string, data: unknown) => void;
};
