import { Room } from './Room';
import type { RoomEventHandler } from './Room';
export declare class RoomManager {
    private rooms;
    private playerRooms;
    generateRoomCode(): string;
    createRoom(emitEvent: RoomEventHandler, customCode?: string): Room;
    getRoomByCode(code: string): Room | undefined;
    getRoomForPlayer(playerId: string): Room | undefined;
    setPlayerRoom(playerId: string, roomCode: string): void;
    removePlayerRoom(playerId: string): void;
    deleteRoom(code: string): boolean;
    get activeRoomCount(): number;
}
//# sourceMappingURL=RoomManager.d.ts.map