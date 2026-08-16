// ============================================================
// PANDU — Game Event Logger
// ============================================================

import { GameEventType } from '../types';
import type { GameEvent } from '../types';

export class GameLogger {
  private events: GameEvent[] = [];
  private roomId: string;

  constructor(roomId: string) {
    this.roomId = roomId;
  }

  log(type: GameEventType, data: Record<string, unknown> = {}): void {
    const event: GameEvent = {
      type,
      timestamp: Date.now(),
      roomId: this.roomId,
      data,
    };
    this.events.push(event);

    console.log(`[GAME:${this.roomId}] ${type}`, JSON.stringify(data));
  }

  getEvents(): GameEvent[] {
    return [...this.events];
  }

  getEventsByType(type: GameEventType): GameEvent[] {
    return this.events.filter(e => e.type === type);
  }

  clear(): void {
    this.events = [];
  }
}
