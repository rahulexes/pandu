import { Room, type RoomEventHandler } from './Room.js';
export declare class RoomManager {
    private rooms;
    private roomById;
    private playerRooms;
    /**
     * Generate a unique room code.
     */
    private generateCode;
    /**
     * Create a new room.
     */
    createRoom(emitEvent: RoomEventHandler): Room;
    /**
     * Find a room by code.
     */
    getRoomByCode(code: string): Room | undefined;
    /**
     * Find a room by ID.
     */
    getRoomById(id: string): Room | undefined;
    /**
     * Track which room a player is in.
     */
    setPlayerRoom(playerId: string, roomCode: string): void;
    /**
     * Get the room a player is in.
     */
    getPlayerRoom(playerId: string): Room | undefined;
    /**
     * Remove player-room association.
     */
    removePlayerRoom(playerId: string): void;
    /**
     * Delete an empty room.
     */
    deleteRoom(code: string): void;
    /**
     * Get all active rooms (for admin/debugging).
     */
    getAllRooms(): Room[];
    /**
     * Get room count.
     */
    get roomCount(): number;
}
