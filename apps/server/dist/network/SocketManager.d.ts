import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
export declare class SocketManager {
    private io;
    private roomManager;
    /** socket.id → { playerId, roomCode, sessionToken } */
    private socketMeta;
    constructor(httpServer: HTTPServer);
    /**
     * Create event emitter for a room.
     * Routes events through Socket.IO rooms.
     */
    private createRoomEmitter;
    private getSocketIdForPlayer;
    private setupEventHandlers;
    private getPlayerContext;
    private handlePlayerLeave;
    get server(): SocketIOServer;
}
