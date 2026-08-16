// ============================================================
// PANDU — Robust P2P WebRTC Manager (PeerJS)
// ============================================================
// Enables 100% Serverless, Vercel-hosted Multiplayer via WebRTC.
// Host client runs the authoritative Room engine locally in-browser.
// Guests communicate directly with Host over low-latency DataChannels.

import { Room } from '@pandu/shared';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomResponse,
} from '@pandu/shared';

type EventListener = (...args: any[]) => void;

const PEER_PREFIX = 'pandu-game-v2-';

const PEER_CONFIG = {
  debug: 1,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },
      {
        urls: [
          'turn:openrelay.metered.ca:80',
          'turn:openrelay.metered.ca:443',
          'turn:openrelay.metered.ca:443?transport=tcp',
        ],
        username: 'openrelay',
        credential: 'openrelay',
      },
    ],
    iceCandidatePoolSize: 10,
  },
};

export class P2PManager {
  private peer: any = null;
  private isHost: boolean = false;
  private currentRoomCode: string | null = null;
  private room: Room | null = null;
  private connections: Map<string, any> = new Map(); // peerId -> DataConnection
  private playerPeerMap: Map<string, string> = new Map(); // playerId -> peerId
  private peerPlayerMap: Map<string, string> = new Map(); // peerId -> playerId
  private hostConnection: any = null;
  private listeners: Map<string, Set<EventListener>> = new Map();
  private isConnected: boolean = false;

  constructor() {
    // Event dispatcher
  }

  on<K extends keyof ServerToClientEvents>(event: K, handler: ServerToClientEvents[K]): void {
    if (!this.listeners.has(event as string)) {
      this.listeners.set(event as string, new Set());
    }
    this.listeners.get(event as string)!.add(handler as any);
  }

  off<K extends keyof ServerToClientEvents>(event: K, handler: ServerToClientEvents[K]): void {
    this.listeners.get(event as string)?.delete(handler as any);
  }

  private emitLocal(event: string, ...args: any[]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const h of handlers) {
        try {
          h(...args);
        } catch (err) {
          console.error(`[P2P] Error in handler for event ${event}:`, err);
        }
      }
    }
  }

  private async getPeerClass(): Promise<any> {
    const module = await import('peerjs');
    return module.default || module.Peer;
  }

  private destroyExistingPeer(): void {
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        // Ignore
      }
      this.peer = null;
    }
    this.connections.clear();
    this.playerPeerMap.clear();
    this.peerPlayerMap.clear();
    this.hostConnection = null;
    this.room = null;
    this.isConnected = false;
  }

  // ════════════════════════════════════════════════════════════
  // HOST ROOM CREATION
  // ════════════════════════════════════════════════════════════

  async createRoom(playerName: string, avatarId: number): Promise<RoomResponse> {
    try {
      this.destroyExistingPeer();

      const PeerClass = await this.getPeerClass();
      const codeChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += codeChars.charAt(Math.floor(Math.random() * codeChars.length));
      }

      const hostPeerId = `${PEER_PREFIX}${code}`;
      this.currentRoomCode = code;

      return new Promise<RoomResponse>((resolve) => {
        let resolved = false;

        const peer = new PeerClass(hostPeerId, PEER_CONFIG);
        this.peer = peer;

        // Attach incoming connection listener immediately
        peer.on('connection', (conn: any) => {
          this.handleIncomingConnectionOnHost(conn);
        });

        peer.on('open', (id: string) => {
          if (resolved) return;
          resolved = true;

          this.isHost = true;
          this.isConnected = true;
          this.emitLocal('connect');

          // Initialize Room Engine locally in Host browser
          this.room = new Room(code, (event: string, data: unknown, targetPlayerIds?: string[]) => {
            this.handleHostBroadcast(event, data, targetPlayerIds);
          });

          const result = this.room.addPlayer(playerName, avatarId, hostPeerId);
          if ('error' in result) {
            return resolve({ success: false, error: result.error });
          }

          const { player, sessionToken } = result;
          this.playerPeerMap.set(player.id, hostPeerId);
          this.peerPlayerMap.set(hostPeerId, player.id);

          resolve({
            success: true,
            roomCode: code,
            sessionToken,
            playerId: player.id,
          });

          this.room.broadcastRoomState();
        });

        peer.on('error', (err: any) => {
          console.error('[P2P HOST ERROR]', err);
          if (err.type === 'unavailable-id') {
            resolve(this.createRoom(playerName, avatarId));
          } else if (!resolved) {
            resolved = true;
            resolve({ success: false, error: err.message || 'Failed to initialize peer' });
          }
        });
      });
    } catch (err: any) {
      return { success: false, error: err.message || 'P2P init failed' };
    }
  }

  private handleIncomingConnectionOnHost(conn: any): void {
    const attachHandlers = () => {
      this.connections.set(conn.peer, conn);

      conn.on('data', (payload: any) => {
        this.handleGuestMessageOnHost(conn, payload);
      });

      conn.on('close', () => {
        this.handleGuestDisconnect(conn.peer);
      });

      conn.on('error', (err: any) => {
        console.error('[P2P CONN ERROR]', err);
      });
    };

    if (conn.open) {
      attachHandlers();
    } else {
      conn.on('open', attachHandlers);
    }
  }

  private handleGuestDisconnect(peerId: string): void {
    this.connections.delete(peerId);
    const playerId = this.peerPlayerMap.get(peerId);
    if (playerId && this.room) {
      this.room.disconnectPlayer(playerId);
      this.room.broadcastRoomState();
      this.peerPlayerMap.delete(peerId);
      this.playerPeerMap.delete(playerId);
    }
  }

  private handleHostBroadcast(event: string, data: unknown, targetPlayerIds?: string[]): void {
    // Send to local host first if target matches or broadcast
    const hostPlayerId = this.peerPlayerMap.get(this.peer?.id);
    if (!targetPlayerIds || (hostPlayerId && targetPlayerIds.includes(hostPlayerId))) {
      this.emitLocal(event, data);
    }

    // Broadcast to remote guests
    for (const [playerId, peerId] of this.playerPeerMap.entries()) {
      if (peerId === this.peer?.id) continue;
      if (targetPlayerIds && !targetPlayerIds.includes(playerId)) continue;

      const conn = this.connections.get(peerId);
      if (conn && conn.open) {
        try {
          conn.send({ event, data });
        } catch (err) {
          console.error('[P2P BROADCAST ERROR]', err);
        }
      }
    }
  }

  // ════════════════════════════════════════════════════════════
  // GUEST JOINING
  // ════════════════════════════════════════════════════════════

  async joinRoom(roomCode: string, playerName: string, avatarId: number, sessionToken?: string): Promise<RoomResponse> {
    try {
      const cleanCode = roomCode.toUpperCase().trim();

      // If already connected to this room, reuse existing connection
      if (this.isConnected && this.currentRoomCode === cleanCode && this.hostConnection) {
        return {
          success: true,
          roomCode: cleanCode,
          sessionToken: sessionStorage.getItem('pandu_session') || undefined,
          playerId: sessionStorage.getItem('pandu_player_id') || undefined,
        };
      }

      this.destroyExistingPeer();
      this.currentRoomCode = cleanCode;

      const PeerClass = await this.getPeerClass();
      const hostPeerId = `${PEER_PREFIX}${cleanCode}`;

      return new Promise<RoomResponse>((resolve) => {
        let resolved = false;

        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve({
              success: false,
              error: `Room "${cleanCode}" not found. Make sure the Host has created the room and is currently in the lobby!`,
            });
          }
        }, 6000);

        const peer = new PeerClass(PEER_CONFIG);
        this.peer = peer;

        peer.on('open', (myPeerId: string) => {
          this.isHost = false;
          const conn = peer.connect(hostPeerId, { reliable: true });
          this.hostConnection = conn;

          const sendJoin = () => {
            this.isConnected = true;
            this.emitLocal('connect');

            conn.send({
              action: 'room:join',
              payload: { roomCode: cleanCode, playerName, avatarId, sessionToken },
            });
          };

          if (conn.open) {
            sendJoin();
          } else {
            conn.on('open', sendJoin);
          }

          conn.on('data', (msg: any) => {
            if (msg.type === 'join_response') {
              if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                resolve(msg.response);
              }
              return;
            }

            if (msg.event) {
              this.emitLocal(msg.event, msg.data);
            }
          });

          conn.on('close', () => {
            this.isConnected = false;
            this.emitLocal('disconnect');
          });

          conn.on('error', (err: any) => {
            console.error('[P2P GUEST CONN ERROR]', err);
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              resolve({ success: false, error: 'Could not connect to room host.' });
            }
          });
        });

        peer.on('error', (err: any) => {
          console.error('[P2P GUEST PEER ERROR]', err);
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve({ success: false, error: `Room "${cleanCode}" not found. Verify the code and try again.` });
          }
        });
      });
    } catch (err: any) {
      return { success: false, error: err.message || 'Connection failed' };
    }
  }

  // ════════════════════════════════════════════════════════════
  // ACTION DISPATCHER (Host & Guest)
  // ════════════════════════════════════════════════════════════

  emitAction(action: keyof ClientToServerEvents, data?: any): void {
    if (this.isHost && this.room) {
      const hostPlayerId = this.peerPlayerMap.get(this.peer?.id);
      if (!hostPlayerId) return;
      this.executeActionOnHost(hostPlayerId, action, data);
    } else if (this.hostConnection && this.hostConnection.open) {
      try {
        this.hostConnection.send({
          action,
          data,
        });
      } catch (err) {
        console.error('[P2P SEND ERROR]', err);
      }
    }
  }

  private handleGuestMessageOnHost(conn: any, payload: any): void {
    if (!this.room) return;

    this.connections.set(conn.peer, conn);

    if (payload.action === 'room:join') {
      const { playerName, avatarId, sessionToken } = payload.payload || {};
      
      let player: any = null;
      let token = sessionToken;

      if (sessionToken) {
        player = this.room.reconnectPlayer(sessionToken, conn.peer);
      }

      if (!player) {
        const result = this.room.addPlayer(playerName, avatarId, conn.peer);
        if ('error' in result) {
          conn.send({ type: 'join_response', response: { success: false, error: result.error } });
          return;
        }
        player = result.player;
        token = result.sessionToken;
      }

      this.playerPeerMap.set(player.id, conn.peer);
      this.peerPlayerMap.set(conn.peer, player.id);

      conn.send({
        type: 'join_response',
        response: {
          success: true,
          roomCode: this.room.code,
          sessionToken: token,
          playerId: player.id,
        },
      });

      this.room.broadcastRoomState();
      this.room.broadcastGameState();
      return;
    }

    const playerId = this.peerPlayerMap.get(conn.peer);
    if (!playerId) return;

    this.executeActionOnHost(playerId, payload.action, payload.data);
  }

  private executeActionOnHost(playerId: string, action: keyof ClientToServerEvents, data?: any): void {
    if (!this.room) return;

    switch (action) {
      case 'lobby:setMode':
        this.room.setMode(playerId, data?.mode);
        this.room.broadcastRoomState();
        break;
      case 'lobby:updateSettings':
        this.room.updateSettings(playerId, data);
        break;
      case 'lobby:toggleReady':
        this.room.toggleReady(playerId);
        this.room.broadcastRoomState();
        break;
      case 'lobby:joinTeam':
        this.room.joinTeam(playerId, data?.teamId);
        this.room.broadcastRoomState();
        break;
      case 'lobby:startGame':
        if (this.room.canStartGame(playerId).canStart) {
          this.room.startGame();
        }
        break;
      case 'game:drawCard':
        this.room.drawCard(playerId);
        break;
      case 'game:discardDrawn':
        this.room.discardDrawnCard(playerId);
        break;
      case 'game:replaceCard':
        this.room.replaceHandCard(playerId, data?.handCardId);
        break;
      case 'game:endTurn':
        this.room.endTurn(playerId);
        break;
      case 'game:callPandu':
        this.room.callPandu(playerId);
        break;
      case 'game:peekInitialCard':
        this.room.peekInitialCard(playerId, data?.cardId);
        break;
      case 'game:selectSelfPeekCard':
        this.room.selectSelfPeekCard(playerId, data?.cardId);
        break;
      case 'game:selectOtherPeekCard':
        this.room.selectOtherPeekCard(playerId, data?.targetPlayerId, data?.cardId);
        break;
      case 'game:selectOwnExchangeCard':
        this.room.selectOwnExchangeCard(playerId, data?.cardId);
        break;
      case 'game:selectOtherExchangeCard':
        this.room.selectOtherExchangeCard(playerId, data?.targetPlayerId, data?.cardId);
        break;
      case 'game:acknowledgeSpecial':
        this.room.acknowledgeSpecial(playerId);
        break;
      case 'game:skipSpecial':
        this.room.skipSpecial(playerId);
        break;
      case 'game:xReaction':
        this.room.attemptXReaction(playerId, data?.cardId);
        break;
      case 'game:placePenaltyCard':
        this.room.placePenaltyCard(playerId, data?.position);
        break;
      case 'game:rematch':
        this.room.requestRematch(playerId);
        break;
      case 'game:returnToLobby':
        this.room.returnToLobby();
        break;
    }
  }

  get connected(): boolean {
    return this.isConnected;
  }
}

// Global Singleton instance
export const p2pManager = new P2PManager();
