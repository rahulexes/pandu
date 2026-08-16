// ============================================================
// PANDU — Realtime Cloud Broadcast Manager (WSS Cloud Mesh)
// ============================================================
// 100% Serverless, Vercel-hosted Realtime Multiplayer.
// Works seamlessly across 100% of Mobile Networks (4G/5G, Jio, Airtel),
// iPhones, Android, PCs, Brave, Safari, and Wi-Fi without NAT/STUN issues.

import mqtt from 'mqtt';
import { Room } from '@pandu/shared';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomResponse,
} from '@pandu/shared';

type EventListener = (...args: any[]) => void;

const CLOUD_BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
];

export class RealtimeManager {
  private client: mqtt.MqttClient | null = null;
  private isHost: boolean = false;
  private currentRoomCode: string | null = null;
  private room: Room | null = null;
  private listeners: Map<string, Set<EventListener>> = new Map();
  private isConnected: boolean = false;
  private myPlayerId: string | null = null;
  private clientId: string = 'pandu_' + Math.random().toString(36).substring(2, 9);

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
          console.error(`[REALTIME] Error in handler for event ${event}:`, err);
        }
      }
    }
  }

  private cleanupClient(): void {
    if (this.client) {
      try {
        this.client.end(true);
      } catch {
        // Ignore
      }
      this.client = null;
    }
    this.room = null;
    this.isConnected = false;
  }

  private connectToBroker(brokerIndex = 0): Promise<mqtt.MqttClient> {
    return new Promise((resolve, reject) => {
      const brokerUrl = CLOUD_BROKERS[brokerIndex % CLOUD_BROKERS.length];
      const client = mqtt.connect(brokerUrl, {
        clientId: `${this.clientId}_${Date.now()}`,
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 2000,
      });

      const timer = setTimeout(() => {
        if (!client.connected) {
          client.end(true);
          if (brokerIndex < CLOUD_BROKERS.length - 1) {
            this.connectToBroker(brokerIndex + 1).then(resolve).catch(reject);
          } else {
            reject(new Error('Connection timed out'));
          }
        }
      }, 4000);

      client.once('connect', () => {
        clearTimeout(timer);
        resolve(client);
      });

      client.once('error', (err) => {
        clearTimeout(timer);
        client.end(true);
        if (brokerIndex < CLOUD_BROKERS.length - 1) {
          this.connectToBroker(brokerIndex + 1).then(resolve).catch(reject);
        } else {
          reject(err);
        }
      });
    });
  }

  // ════════════════════════════════════════════════════════════
  // HOST ROOM CREATION
  // ════════════════════════════════════════════════════════════

  async createRoom(playerName: string, avatarId: number): Promise<RoomResponse> {
    try {
      this.cleanupClient();

      const codeChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += codeChars.charAt(Math.floor(Math.random() * codeChars.length));
      }

      this.currentRoomCode = code;
      const topic = `pandu/rooms/${code}/events`;

      const client = await this.connectToBroker();
      this.client = client;

      return new Promise<RoomResponse>((resolve) => {
        client.subscribe(`pandu/rooms/${code}/#`, (err) => {
          if (err) {
            return resolve({ success: false, error: 'Failed to create room topic' });
          }

          this.isHost = true;
          this.isConnected = true;
          this.emitLocal('connect');

          // Initialize local authoritative Room engine on Host
          this.room = new Room(code, (event: string, data: unknown, targetPlayerIds?: string[]) => {
            this.broadcastFromHost(event, data, targetPlayerIds);
          });

          const result = this.room.addPlayer(playerName, avatarId, 'host');
          if ('error' in result) {
            return resolve({ success: false, error: result.error });
          }

          const { player, sessionToken } = result;
          this.myPlayerId = player.id;

          // Message router for Host
          client.on('message', (t, msgBuffer) => {
            try {
              const msg = JSON.parse(msgBuffer.toString());
              if (msg.senderClientId === this.clientId) return; // Ignore own messages

              if (msg.type === 'guest_join_request') {
                this.handleGuestJoinOnHost(msg);
              } else if (msg.type === 'guest_action') {
                this.handleGuestActionOnHost(msg);
              }
            } catch (e) {
              console.error('[REALTIME MSG ERR]', e);
            }
          });

          resolve({
            success: true,
            roomCode: code,
            sessionToken,
            playerId: player.id,
          });

          this.room.broadcastRoomState();
        });
      });
    } catch (err: any) {
      return { success: false, error: err.message || 'Room creation failed' };
    }
  }

  private handleGuestJoinOnHost(msg: any): void {
    if (!this.room || !this.client || !this.currentRoomCode) return;
    const { playerName, avatarId, sessionToken, guestClientId } = msg;

    let player: any = null;
    let token = sessionToken;

    if (sessionToken) {
      player = this.room.reconnectPlayer(sessionToken, guestClientId);
    }

    if (!player) {
      const result = this.room.addPlayer(playerName, avatarId, guestClientId);
      if ('error' in result) {
        this.client.publish(
          `pandu/rooms/${this.currentRoomCode}/join_response`,
          JSON.stringify({
            senderClientId: this.clientId,
            targetGuestId: guestClientId,
            success: false,
            error: result.error,
          })
        );
        return;
      }
      player = result.player;
      token = result.sessionToken;
    }

    // Send successful response to guest
    this.client.publish(
      `pandu/rooms/${this.currentRoomCode}/join_response`,
      JSON.stringify({
        senderClientId: this.clientId,
        targetGuestId: guestClientId,
        success: true,
        roomCode: this.room.code,
        sessionToken: token,
        playerId: player.id,
      })
    );

    this.room.broadcastRoomState();
    this.room.broadcastGameState();
  }

  private handleGuestActionOnHost(msg: any): void {
    if (!this.room) return;
    const { playerId, action, data } = msg;
    if (!playerId || !action) return;

    this.executeActionOnHost(playerId, action, data);
  }

  private broadcastFromHost(event: string, data: unknown, targetPlayerIds?: string[]): void {
    if (!this.client || !this.currentRoomCode) return;

    // Dispatch locally to Host if targeted or broadcast
    const hostPlayerId = this.myPlayerId;
    if (!targetPlayerIds || (hostPlayerId && targetPlayerIds.includes(hostPlayerId))) {
      this.emitLocal(event, data);
    }

    // Broadcast to remote guests
    this.client.publish(
      `pandu/rooms/${this.currentRoomCode}/events`,
      JSON.stringify({
        senderClientId: this.clientId,
        type: 'server_event',
        event,
        data,
        targetPlayerIds,
      })
    );
  }

  // ════════════════════════════════════════════════════════════
  // GUEST ROOM JOINING
  // ════════════════════════════════════════════════════════════

  async joinRoom(roomCode: string, playerName: string, avatarId: number, sessionToken?: string): Promise<RoomResponse> {
    try {
      const cleanCode = roomCode.toUpperCase().trim();

      if (this.isConnected && this.currentRoomCode === cleanCode && this.client?.connected) {
        return {
          success: true,
          roomCode: cleanCode,
          sessionToken: sessionStorage.getItem('pandu_session') || undefined,
          playerId: sessionStorage.getItem('pandu_player_id') || undefined,
        };
      }

      this.cleanupClient();
      this.currentRoomCode = cleanCode;

      const client = await this.connectToBroker();
      this.client = client;

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

        client.subscribe(`pandu/rooms/${cleanCode}/#`, (err) => {
          if (err && !resolved) {
            resolved = true;
            clearTimeout(timeout);
            return resolve({ success: false, error: 'Could not connect to room channel.' });
          }

          this.isHost = false;
          this.isConnected = true;
          this.emitLocal('connect');

          // Send join request to Host
          client.publish(
            `pandu/rooms/${cleanCode}/events`,
            JSON.stringify({
              senderClientId: this.clientId,
              type: 'guest_join_request',
              guestClientId: this.clientId,
              roomCode: cleanCode,
              playerName,
              avatarId,
              sessionToken,
            })
          );
        });

        client.on('message', (t, msgBuffer) => {
          try {
            const msg = JSON.parse(msgBuffer.toString());
            if (msg.senderClientId === this.clientId) return; // Ignore own messages

            if (msg.targetGuestId && msg.targetGuestId === this.clientId) {
              if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                if (msg.playerId) {
                  this.myPlayerId = msg.playerId;
                }
                resolve(msg);
              }
              return;
            }

            if (msg.type === 'server_event' && msg.event) {
              const myId = this.myPlayerId || sessionStorage.getItem('pandu_player_id');
              if (!msg.targetPlayerIds || (myId && msg.targetPlayerIds.includes(myId))) {
                this.emitLocal(msg.event, msg.data);
              }
            }
          } catch (e) {
            console.error('[REALTIME GUEST MSG ERR]', e);
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
    const myId = this.myPlayerId || sessionStorage.getItem('pandu_player_id');
    if (!myId) return;

    if (this.isHost && this.room) {
      this.executeActionOnHost(myId, action, data);
    } else if (this.client && this.currentRoomCode) {
      this.client.publish(
        `pandu/rooms/${this.currentRoomCode}/events`,
        JSON.stringify({
          senderClientId: this.clientId,
          type: 'guest_action',
          playerId: myId,
          action,
          data,
        })
      );
    }
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

// Global Singleton Instance
export const realtimeManager = new RealtimeManager();
