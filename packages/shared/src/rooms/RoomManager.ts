// ============================================================
// PANDU — Room Manager
// ============================================================

import { ROOM_CODE_LENGTH } from '../constants';
import { Room } from './Room';
import type { RoomEventHandler } from './Room';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private playerRooms: Map<string, string> = new Map();

  generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code: string;
    let attempts = 0;
    do {
      code = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      attempts++;
      if (attempts > 100) {
        code += Date.now().toString(36).slice(-2).toUpperCase();
        break;
      }
    } while (this.rooms.has(code));
    return code;
  }

  createRoom(emitEvent: RoomEventHandler, customCode?: string): Room {
    const code = customCode || this.generateRoomCode();
    const room = new Room(code, emitEvent);
    this.rooms.set(code, room);
    return room;
  }

  getRoomByCode(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  getRoomForPlayer(playerId: string): Room | undefined {
    const code = this.playerRooms.get(playerId);
    if (!code) return undefined;
    return this.rooms.get(code);
  }

  setPlayerRoom(playerId: string, roomCode: string): void {
    this.playerRooms.set(playerId, roomCode.toUpperCase());
  }

  removePlayerRoom(playerId: string): void {
    this.playerRooms.delete(playerId);
  }

  deleteRoom(code: string): boolean {
    const room = this.rooms.get(code);
    if (!room) return false;

    for (const [playerId, rCode] of this.playerRooms.entries()) {
      if (rCode === code) {
        this.playerRooms.delete(playerId);
      }
    }

    this.rooms.delete(code);
    return true;
  }

  get activeRoomCount(): number {
    return this.rooms.size;
  }
}
