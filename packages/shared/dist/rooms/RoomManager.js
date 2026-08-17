// ============================================================
// PANDU — Room Manager
// ============================================================
import { ROOM_CODE_LENGTH } from '../constants';
import { Room } from './Room';
export class RoomManager {
    rooms = new Map();
    playerRooms = new Map();
    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code;
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
    createRoom(emitEvent, customCode) {
        const code = customCode || this.generateRoomCode();
        const room = new Room(code, emitEvent);
        this.rooms.set(code, room);
        return room;
    }
    getRoomByCode(code) {
        return this.rooms.get(code.toUpperCase());
    }
    getRoomForPlayer(playerId) {
        const code = this.playerRooms.get(playerId);
        if (!code)
            return undefined;
        return this.rooms.get(code);
    }
    setPlayerRoom(playerId, roomCode) {
        this.playerRooms.set(playerId, roomCode.toUpperCase());
    }
    removePlayerRoom(playerId) {
        this.playerRooms.delete(playerId);
    }
    deleteRoom(code) {
        const room = this.rooms.get(code);
        if (!room)
            return false;
        for (const [playerId, rCode] of this.playerRooms.entries()) {
            if (rCode === code) {
                this.playerRooms.delete(playerId);
            }
        }
        this.rooms.delete(code);
        return true;
    }
    get activeRoomCount() {
        return this.rooms.size;
    }
}
//# sourceMappingURL=RoomManager.js.map