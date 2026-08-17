import { GameEventType } from '../types';
import type { GameEvent } from '../types';
export declare class GameLogger {
    private events;
    private roomId;
    constructor(roomId: string);
    log(type: GameEventType, data?: Record<string, unknown>): void;
    getEvents(): GameEvent[];
    getEventsByType(type: GameEventType): GameEvent[];
    clear(): void;
}
//# sourceMappingURL=GameLogger.d.ts.map