// ============================================================
// PANDU — Room Manager
// ============================================================
// Creates, finds, and manages game rooms.
import { ROOM_CODE_LENGTH } from '@pandu/shared';
import { Room } from './Room.js';
import crypto from 'crypto';
export class RoomManager {
    rooms = new Map(); // code → Room
    roomById = new Map(); // id → Room
    playerRooms = new Map(); // playerId → roomCode
    /**
     * Generate a unique room code.
     */
    generateCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 for readability
        let code;
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
    createRoom(emitEvent) {
        const code = this.generateCode();
        const room = new Room(code, emitEvent);
        this.rooms.set(code, room);
        this.roomById.set(room.id, room);
        return room;
    }
    /**
     * Find a room by code.
     */
    getRoomByCode(code) {
        return this.rooms.get(code.toUpperCase());
    }
    /**
     * Find a room by ID.
     */
    getRoomById(id) {
        return this.roomById.get(id);
    }
    /**
     * Track which room a player is in.
     */
    setPlayerRoom(playerId, roomCode) {
        this.playerRooms.set(playerId, roomCode);
    }
    /**
     * Get the room a player is in.
     */
    getPlayerRoom(playerId) {
        const code = this.playerRooms.get(playerId);
        if (!code)
            return undefined;
        return this.rooms.get(code);
    }
    /**
     * Remove player-room association.
     */
    removePlayerRoom(playerId) {
        this.playerRooms.delete(playerId);
    }
    /**
     * Delete an empty room.
     */
    deleteRoom(code) {
        const room = this.rooms.get(code);
        if (room) {
            this.roomById.delete(room.id);
            this.rooms.delete(code);
        }
    }
    /**
     * Get all active rooms (for admin/debugging).
     */
    getAllRooms() {
        return Array.from(this.rooms.values());
    }
    /**
     * Get room count.
     */
    get roomCount() {
        return this.rooms.size;
    }
}
//# sourceMappingURL=RoomManager.js.map