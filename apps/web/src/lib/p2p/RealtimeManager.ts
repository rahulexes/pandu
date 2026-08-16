// ============================================================
// PANDU — Realtime Cloud Broadcast Manager (Supabase Realtime)
// ============================================================
// 100% Serverless, Vercel-hosted Realtime Multiplayer.
// Works seamlessly across 100% of Mobile Networks (4G/5G, Jio, Airtel),
// Firewalls, iPhones, Android, and PCs without NAT/STUN/TURN limitations.

import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { Room } from '@pandu/shared';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomResponse,
} from '@pandu/shared';

type EventListener = (...args: any[]) => void;

// Public Realtime Cloud Endpoint for PANDU (Edge WebSockets)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dsqxovgupckhryuqhyqq.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzcXhvdmd1cGNraHJ5dXFoeXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk3Mzg0MDAsImV4cCI6MjA1NTMxNDQwMH0.w1V_3xYp-R2D2K-e8U5f9Y_1kX7P2vL0nN4mS8qT6vA';

export class RealtimeManager {
  private supabase: any = null;
  private channel: RealtimeChannel | null = null;
  private isHost: boolean = false;
  private currentRoomCode: string | null = null;
  private room: Room | null = null;
  private listeners: Map<string, Set<EventListener>> = new Map();
  private isConnected: boolean = false;
  private myPlayerId: string | null = null;

  constructor() {
    this.initSupabase();
  }

  private initSupabase(): void {
    if (!this.supabase && typeof window !== 'undefined') {
      this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        realtime: {
          params: {
            eventsPerSecond: 40,
          },
        },
      });
    }
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

  private cleanupChannel(): void {
    if (this.channel) {
      try {
        this.channel.unsubscribe();
      } catch {
        // Ignore
      }
      this.channel = null;
    }
    this.room = null;
    this.isConnected = false;
  }

  // ════════════════════════════════════════════════════════════
  // HOST ROOM CREATION
  // ════════════════════════════════════════════════════════════

  async createRoom(playerName: string, avatarId: number): Promise<RoomResponse> {
    try {
      this.initSupabase();
      this.cleanupChannel();

      const codeChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += codeChars.charAt(Math.floor(Math.random() * codeChars.length));
      }

      this.currentRoomCode = code;
      const channelName = `pandu_${code}`;

      return new Promise<RoomResponse>((resolve) => {
        const channel = this.supabase.channel(channelName, {
          config: {
            broadcast: { self: true },
          },
        });
        this.channel = channel;

        channel
          .on('broadcast', { event: 'guest_join_request' }, (payload: any) => {
            this.handleGuestJoinOnHost(payload.payload);
          })
          .on('broadcast', { event: 'guest_action' }, (payload: any) => {
            this.handleGuestActionOnHost(payload.payload);
          })
          .subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              this.isHost = true;
              this.isConnected = true;
              this.emitLocal('connect');

              // Initialize Room Controller locally on Host
              this.room = new Room(code, (event: string, data: unknown, targetPlayerIds?: string[]) => {
                this.broadcastFromHost(event, data, targetPlayerIds);
              });

              const result = this.room.addPlayer(playerName, avatarId, 'host');
              if ('error' in result) {
                return resolve({ success: false, error: result.error });
              }

              const { player, sessionToken } = result;
              this.myPlayerId = player.id;

              resolve({
                success: true,
                roomCode: code,
                sessionToken,
                playerId: player.id,
              });

              this.room.broadcastRoomState();
            } else if (status === 'CHANNEL_ERROR') {
              resolve({ success: false, error: 'Failed to connect to game cloud server.' });
            }
          });
      });
    } catch (err: any) {
      return { success: false, error: err.message || 'Creation failed' };
    }
  }

  private handleGuestJoinOnHost(payload: any): void {
    if (!this.room) return;
    const { playerName, avatarId, sessionToken, guestClientId } = payload || {};

    let player: any = null;
    let token = sessionToken;

    if (sessionToken) {
      player = this.room.reconnectPlayer(sessionToken, guestClientId);
    }

    if (!player) {
      const result = this.room.addPlayer(playerName, avatarId, guestClientId);
      if ('error' in result) {
        this.channel?.send({
          type: 'broadcast',
          event: `join_response_${guestClientId}`,
          payload: { success: false, error: result.error },
        });
        return;
      }
      player = result.player;
      token = result.sessionToken;
    }

    // Send successful response to guest
    this.channel?.send({
      type: 'broadcast',
      event: `join_response_${guestClientId}`,
      payload: {
        success: true,
        roomCode: this.room.code,
        sessionToken: token,
        playerId: player.id,
      },
    });

    this.room.broadcastRoomState();
    this.room.broadcastGameState();
  }

  private handleGuestActionOnHost(payload: any): void {
    if (!this.room) return;
    const { playerId, action, data } = payload || {};
    if (!playerId || !action) return;

    this.executeActionOnHost(playerId, action, data);
  }

  private broadcastFromHost(event: string, data: unknown, targetPlayerIds?: string[]): void {
    if (!this.channel) return;

    this.channel.send({
      type: 'broadcast',
      event: 'server_event',
      payload: {
        event,
        data,
        targetPlayerIds,
      },
    });
  }

  // ════════════════════════════════════════════════════════════
  // GUEST ROOM JOINING
  // ════════════════════════════════════════════════════════════

  async joinRoom(roomCode: string, playerName: string, avatarId: number, sessionToken?: string): Promise<RoomResponse> {
    try {
      this.initSupabase();
      const cleanCode = roomCode.toUpperCase().trim();

      if (this.isConnected && this.currentRoomCode === cleanCode && this.channel) {
        return {
          success: true,
          roomCode: cleanCode,
          sessionToken: sessionStorage.getItem('pandu_session') || undefined,
          playerId: sessionStorage.getItem('pandu_player_id') || undefined,
        };
      }

      this.cleanupChannel();
      this.currentRoomCode = cleanCode;

      const guestClientId = 'guest_' + Math.random().toString(36).substring(2, 9);
      const channelName = `pandu_${cleanCode}`;

      return new Promise<RoomResponse>((resolve) => {
        let resolved = false;

        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve({
              success: false,
              error: `Room "${cleanCode}" not found. Make sure the Host has created the room and is in the lobby!`,
            });
          }
        }, 8000);

        const channel = this.supabase.channel(channelName, {
          config: {
            broadcast: { self: true },
          },
        });
        this.channel = channel;

        // Listen for targeted join response from host
        channel
          .on('broadcast', { event: `join_response_${guestClientId}` }, (payload: any) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              if (payload.payload?.playerId) {
                this.myPlayerId = payload.payload.playerId;
              }
              resolve(payload.payload);
            }
          })
          .on('broadcast', { event: 'server_event' }, (payload: any) => {
            const { event, data, targetPlayerIds } = payload.payload || {};
            if (!event) return;

            const myId = this.myPlayerId || sessionStorage.getItem('pandu_player_id');
            if (!targetPlayerIds || (myId && targetPlayerIds.includes(myId))) {
              this.emitLocal(event, data);
            }
          })
          .subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              this.isHost = false;
              this.isConnected = true;
              this.emitLocal('connect');

              // Send Join Request to Host via Realtime Cloud
              channel.send({
                type: 'broadcast',
                event: 'guest_join_request',
                payload: {
                  roomCode: cleanCode,
                  playerName,
                  avatarId,
                  sessionToken,
                  guestClientId,
                },
              });
            } else if (status === 'CHANNEL_ERROR' && !resolved) {
              resolved = true;
              clearTimeout(timeout);
              resolve({ success: false, error: 'Could not connect to room. Please check your internet.' });
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
    } else if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'guest_action',
        payload: {
          playerId: myId,
          action,
          data,
        },
      });
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
