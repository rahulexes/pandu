// ============================================================
// PANDU — Room Manager
// ============================================================
// Creates, finds, and manages game rooms.

import { ROOM_CODE_LENGTH } from '@pandu/shared';
import { Room, type RoomEventHandler } from './Room.js';
import crypto from 'crypto';

export class RoomManager {
  private rooms: Map<string, Room> = new Map(); // code → Room
  private roomById: Map<string, Room> = new Map(); // id → Room
  private playerRooms: Map<string, string> = new Map(); // playerId → roomCode

  /**
   * Generate a unique room code.
   */
  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 for readability
    let code: string;
    do {
      code = '';
      const bytes = crypto.randomBytes(ROOM_CODE_LENGTH);
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += chars[bytes[i] % chars.length];
      }
    } while (this.rooms.has(code));
    return code;
  }

  /**
   * Create a new room.
   */
  createRoom(emitEvent: RoomEventHandler): Room {
    const code = this.generateCode();
    const room = new Room(code, emitEvent);
    this.rooms.set(code, room);
    this.roomById.set(room.id, room);
    return room;
  }

  /**
   * Find a room by code.
   */
  getRoomByCode(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  /**
   * Find a room by ID.
   */
  getRoomById(id: string): Room | undefined {
    return this.roomById.get(id);
  }

  /**
   * Track which room a player is in.
   */
  setPlayerRoom(playerId: string, roomCode: string): void {
    this.playerRooms.set(playerId, roomCode);
  }

  /**
   * Get the room a player is in.
   */
  getPlayerRoom(playerId: string): Room | undefined {
    const code = this.playerRooms.get(playerId);
    if (!code) return undefined;
    return this.rooms.get(code);
  }

  /**
   * Remove player-room association.
   */
  removePlayerRoom(playerId: string): void {
    this.playerRooms.delete(playerId);
  }

  /**
   * Delete an empty room.
   */
  deleteRoom(code: string): void {
    const room = this.rooms.get(code);
    if (room) {
      this.roomById.delete(room.id);
      this.rooms.delete(code);
    }
  }

  /**
   * Get all active rooms (for admin/debugging).
   */
  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  /**
   * Get room count.
   */
  get roomCount(): number {
    return this.rooms.size;
  }
}
