// ============================================================
// PANDU — Socket Manager
// ============================================================
// Sets up Socket.IO server with all game event handlers.
// Routes socket events to Room methods.
import { Server as SocketIOServer } from 'socket.io';
import { RoomManager } from '../rooms/RoomManager.js';
// Rate limiting
const ACTION_COOLDOWN_MS = 100;
const actionTimestamps = new Map();
function isRateLimited(socketId) {
    const now = Date.now();
    const last = actionTimestamps.get(socketId) || 0;
    if (now - last < ACTION_COOLDOWN_MS)
        return true;
    actionTimestamps.set(socketId, now);
    return false;
}
export class SocketManager {
    io;
    roomManager;
    /** socket.id → { playerId, roomCode, sessionToken } */
    socketMeta = new Map();
    constructor(httpServer) {
        this.io = new SocketIOServer(httpServer, {
            cors: {
                origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
                methods: ['GET', 'POST'],
            },
            connectionStateRecovery: {
                maxDisconnectionDuration: 2 * 60 * 1000,
                skipMiddlewares: false,
            },
        });
        this.roomManager = new RoomManager();
        this.setupEventHandlers();
        console.log('[SOCKET] Socket.IO server initialized');
    }
    /**
     * Create event emitter for a room.
     * Routes events through Socket.IO rooms.
     */
    createRoomEmitter(roomCode) {
        return (event, data, targetPlayerIds) => {
            if (targetPlayerIds && targetPlayerIds.length > 0) {
                // Send to specific players only
                for (const playerId of targetPlayerIds) {
                    const socketId = this.getSocketIdForPlayer(playerId);
                    if (socketId) {
                        this.io.to(socketId).emit(event, data);
                    }
                }
            }
            else {
                // Broadcast to entire room
                this.io.to(`room:${roomCode}`).emit(event, data);
            }
        };
    }
    getSocketIdForPlayer(playerId) {
        for (const [socketId, meta] of this.socketMeta) {
            if (meta.playerId === playerId)
                return socketId;
        }
        return undefined;
    }
    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`[SOCKET] Client connected: ${socket.id}`);
            // ── Room Events ──────────────────────────────────
            socket.on('room:create', (data, callback) => {
                if (isRateLimited(socket.id))
                    return callback({ success: false, error: 'Too fast' });
                const emitter = this.createRoomEmitter(''); // Will be updated
                const room = this.roomManager.createRoom(emitter);
                // Update emitter with actual room code
                room.emitEvent = this.createRoomEmitter(room.code);
                const result = room.addPlayer(data.playerName, data.avatarId, socket.id);
                if ('error' in result) {
                    return callback({ success: false, error: result.error });
                }
                const { player, sessionToken } = result;
                socket.join(`room:${room.code}`);
                this.socketMeta.set(socket.id, { playerId: player.id, roomCode: room.code, sessionToken });
                this.roomManager.setPlayerRoom(player.id, room.code);
                callback({ success: true, roomCode: room.code, sessionToken, playerId: player.id });
                room.broadcastRoomState();
            });
            socket.on('room:join', (data, callback) => {
                if (isRateLimited(socket.id))
                    return callback({ success: false, error: 'Too fast' });
                const room = this.roomManager.getRoomByCode(data.roomCode);
                if (!room)
                    return callback({ success: false, error: 'Room not found' });
                // Check for reconnection
                if (data.sessionToken) {
                    const player = room.reconnectPlayer(data.sessionToken, socket.id);
                    if (player) {
                        socket.join(`room:${room.code}`);
                        this.socketMeta.set(socket.id, { playerId: player.id, roomCode: room.code, sessionToken: data.sessionToken });
                        callback({ success: true, roomCode: room.code, sessionToken: data.sessionToken, playerId: player.id });
                        room.broadcastRoomState();
                        room.broadcastGameState();
                        return;
                    }
                }
                const result = room.addPlayer(data.playerName, data.avatarId, socket.id);
                if ('error' in result) {
                    return callback({ success: false, error: result.error });
                }
                const { player, sessionToken } = result;
                socket.join(`room:${room.code}`);
                this.socketMeta.set(socket.id, { playerId: player.id, roomCode: room.code, sessionToken });
                this.roomManager.setPlayerRoom(player.id, room.code);
                callback({ success: true, roomCode: room.code, sessionToken, playerId: player.id });
                // Notify room
                this.io.to(`room:${room.code}`).emit('room:playerJoined', player);
                room.broadcastRoomState();
            });
            socket.on('room:leave', () => {
                this.handlePlayerLeave(socket);
            });
            socket.on('room:updateProfile', (data) => {
                const { room, playerId } = this.getPlayerContext(socket) || {};
                if (!room || !playerId)
                    return;
                const player = room.getPlayer(playerId);
                if (!player)
                    return;
                if (data.playerName)
                    player.name = data.playerName;
                if (data.avatarId !== undefined)
                    player.avatarId = data.avatarId;
                room.broadcastRoomState();
            });
            // ── Lobby Events ─────────────────────────────────
            socket.on('lobby:setMode', (data) => {
                const ctx = this.getPlayerContext(socket);
                if (!ctx)
                    return;
                const result = ctx.room.setMode(ctx.playerId, data.mode);
                if (result.error) {
                    socket.emit('room:error', { message: result.error });
                    return;
                }
                ctx.room.broadcastRoomState();
            });
            socket.on('lobby:updateSettings', (data) => {
                const ctx = this.getPlayerContext(socket);
                if (!ctx)
                    return;
                const payload = (data && data.settings) ? data.settings : data;
                const result = ctx.room.updateSettings(ctx.playerId, payload);
                if (result.error) {
                    socket.emit('room:error', { message: result.error });
                    return;
                }
                const settings = ctx.room.gameSettings;
                this.io.to(`room:${ctx.room.code}`).emit('lobby:settingsUpdated', settings);
                ctx.room.broadcastRoomState();
            });
            socket.on('lobby:toggleReady', () => {
                const ctx = this.getPlayerContext(socket);
                if (!ctx)
                    return;
                const isReady = ctx.room.toggleReady(ctx.playerId);
                this.io.to(`room:${ctx.room.code}`).emit('lobby:playerReady', {
                    playerId: ctx.playerId,
                    isReady,
                });
            });
            socket.on('lobby:joinTeam', (data) => {
                const ctx = this.getPlayerContext(socket);
                if (!ctx)
                    return;
                const result = ctx.room.joinTeam(ctx.playerId, data.teamId);
                if (result.error) {
                    socket.emit('room:error', { message: result.error });
                    return;
                }
                ctx.room.broadcastRoomState();
            });
            socket.on('lobby:startGame', () => {
                const ctx = this.getPlayerContext(socket);
                if (!ctx)
                    return;
                const check = ctx.room.canStartGame(ctx.playerId);
                if (!check.canStart) {
                    socket.emit('room:error', { message: check.error || 'Cannot start game' });
                    return;
                }
                ctx.room.startGame();
            });
            // ── Game Actions ─────────────────────────────────
            socket.on('game:drawCard', () => {
                if (isRateLimited(socket.id))
                    return;
                const ctx = this.getPlayerContext(socket);
                if (!ctx)
                    return;
                const result = ctx.room.drawCard(ctx.playerId);
                if (result.error) {
                    socket.emit('game:actionError', { message: result.error, action: 'drawCard' });
                }
            });
            socket.on('game:discardDrawn', () => {
                if (isRateLimited(socket.id))
                    return;
                const ctx = this.getPlayerContext(socket);
                if (!ctx)
                    return;
                const result = ctx.room.discardDrawnCard(ctx.playerId);
                if (result.error) {
                    socket.emit('game:actionError', { message: result.error, action: 'discardDrawn' });
                }
                ctx.room.broadcastGameState();
            });
            socket.on('game:replaceCard', (data) => {
                if (isRateLimited(socket.id))
                    return;
                const ctx = this.getPlayerContext(socket);
                if (!ctx)
                    return;
                const result = ctx.room.replaceHandCard(ctx.playerId, data.handCardId);
                if (result.error) {
                    socket.emit('game:actionError', { message: result.error, action: 'replaceCard' });
                }
                ctx.room.broadcastGameState();
            });
            socket.on('game:endTurn', () => {
                const ctx = this.getPlayerContext(socket);
                if (!ctx)
                    return;
                const result = ctx.room.endTurn(ctx.playerId);
                if (result.error) {
                    socket.emit('game:actionError', { message: result.error, action: 'endTurn' });
                }
            });
            socket.on('game:callPandu', () => {
                const ctx = this.getPlayerContext(socket);
                if (!ctx)
                    return;
                const result = ctx.room.callPandu(ctx.playerId);
                if (result.error) {
                    socket.emit('game:actionError', { message: result.error, action: 'callPandu' });
                }
                ctx.room.broadcastGameState();
            });
            // ── Initial Viewing ──
            socket.on('game:peekInitialCard', (data) => {
                const ctx = this.getPlayerContext(socket);
                if (!ctx)
                    return;
                const result = ctx.room.peekInitialCard(ctx.playerId, data.cardId);
                if (result.error) {
                    socket.emit('game:actionError', { message: result.error, action: 'peekInitialCard' });
                }
                else if (result.card) {
                    socket.emit('game:cardPeeked', {
                        cardId: data.cardId,
                        card: { id: result.card.id, rank: result.card.rank, suit: result.card.suit, faceUp: true },
                    });
                }
            });
            // ── Special Actions ──
            socket.on('game:selectSelfPeekCard', (data) => {
                const ctx = this.getPlayerContext(socket);
                if (!ctx)
                    return;
                const result = ctx.room.selectSelfPeekCard(ctx.playerId, data.cardId);
                if (result.error) {
                    socket.emit('game:actionError', { message: result.error, action: 'selectSelfPeekCard' });
                }
            });
            socket.on('game:selectOtherPeekCard', (data) => {
                const ctx = this.getPlayerContext(socket);
                if (!ctx)
                    return;
                const result = ctx.room.selectOtherPeekCard(ctx.playerId, data.targetPlayerId, data.cardId);
                if (result.error) {
                    socket.emit('game:actionError', { message: result.error, action: 'selectOtherPeekCard' });
                }
            });
            socket.on('game:selectOwnExchangeCard', (data) => {
                const ctx = this.getPlayerContext(socket);
                if (!ctx)
                    return;
                const result = ctx.room.selectOwnExchangeCard(ctx.playerId, data.cardId);
                if (result.error) {
                    socket.emit('game:actionError', { message: result.error, action: 'selectOwnExchangeCard' });
                }
            });
            socket.on('game:selectOtherExchangeCard', (data) => {
                const ctx = this.getPlayerContext(socket);
                if (!ctx)
                    return;
                const result = ctx.room.selectOtherExchangeCard(ctx.playerId, data.targetPlayerId, data.cardId);
                if (result.error) {
                    socket.emit('game:actionError', { message: result.error, action: 'selectOtherExchangeCard' });
                }
                ctx.room.broadcastGameState();
            });
            socket.on('game:acknowledgeSpecial', () => {
                const ctx = this.getPlayerContext(socket);
                if (!ctx)
                    return;
                const result = ctx.room.acknowledgeSpecial(ctx.playerId);
                if (result.error) {
                    socket.emit('game:actionError', { message: result.error, action: 'acknowledgeSpecial' });
                }
                ctx.room.broadcastGameState();
            });
            socket.on('game:skipSpecial', () => {
                const ctx = this.getPlayerContext(socket);
                if (!ctx)
                    return;
                const result = ctx.room.skipSpecial(ctx.playerId);
                if (result.error) {
                    socket.emit('game:actionError', { message: result.error, action: 'skipSpecial' });
                }
                ctx.room.broadcastGameState();
            });
            // ── X Reaction ──
            socket.on('game:xReaction', (data) => {
                const ctx = this.getPlayerContext(socket);
                if (!ctx)
                    return;
                const result = ctx.room.attemptXReaction(ctx.playerId, data.cardId);
                if (result.error) {
                    socket.emit('game:actionError', { message: result.error, action: 'xReaction' });
                }
            });
            socket.on('game:placePenaltyCard', (data) => {
                const ctx = this.getPlayerContext(socket);
                if (!ctx)
                    return;
                const result = ctx.room.placePenaltyCard(ctx.playerId, data?.slotIndex);
                if (result.error) {
                    socket.emit('game:actionError', { message: result.error, action: 'placePenaltyCard' });
                }
            });
            // ── Rematch ──
            socket.on('game:rematch', () => {
                const ctx = this.getPlayerContext(socket);
                if (!ctx)
                    return;
                ctx.room.requestRematch(ctx.playerId);
            });
            socket.on('game:returnToLobby', () => {
                const ctx = this.getPlayerContext(socket);
                if (!ctx)
                    return;
                ctx.room.returnToLobby();
            });
            // ── Disconnect ──
            socket.on('disconnect', () => {
                console.log(`[SOCKET] Client disconnected: ${socket.id}`);
                const meta = this.socketMeta.get(socket.id);
                if (meta) {
                    const room = this.roomManager.getRoomByCode(meta.roomCode);
                    if (room) {
                        room.disconnectPlayer(meta.playerId);
                        room.broadcastRoomState();
                    }
                    this.socketMeta.delete(socket.id);
                }
            });
        });
    }
    getPlayerContext(socket) {
        const meta = this.socketMeta.get(socket.id);
        if (!meta) {
            socket.emit('room:error', { message: 'Not in a room' });
            return null;
        }
        const room = this.roomManager.getRoomByCode(meta.roomCode);
        if (!room) {
            socket.emit('room:error', { message: 'Room not found' });
            return null;
        }
        return { room, playerId: meta.playerId };
    }
    handlePlayerLeave(socket) {
        const meta = this.socketMeta.get(socket.id);
        if (!meta)
            return;
        const room = this.roomManager.getRoomByCode(meta.roomCode);
        if (room) {
            const { newHostId } = room.removePlayer(meta.playerId);
            socket.leave(`room:${meta.roomCode}`);
            this.io.to(`room:${meta.roomCode}`).emit('room:playerLeft', {
                playerId: meta.playerId,
                newHostId,
            });
            if (room.playerCount === 0) {
                this.roomManager.deleteRoom(meta.roomCode);
            }
            else {
                room.broadcastRoomState();
            }
        }
        this.roomManager.removePlayerRoom(meta.playerId);
        this.socketMeta.delete(socket.id);
    }
    get server() {
        return this.io;
    }
}
//# sourceMappingURL=SocketManager.js.map