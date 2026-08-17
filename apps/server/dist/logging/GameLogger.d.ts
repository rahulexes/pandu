import { GameEventType } from '@pandu/shared';
import type { GameEvent } from '@pandu/shared';
export declare class GameLogger {
    private events;
    private roomId;
    constructor(roomId: string);
    log(type: GameEventType, data?: Record<string, unknown>): void;
    getEvents(): GameEvent[];
    getEventsByType(type: GameEventType): GameEvent[];
    clear(): void;
}
