// ============================================================
// PANDU — Room Store (Zustand)
// ============================================================

import { create } from 'zustand';
import type { Player, GameSettings } from '@pandu/shared';
import type { ClientRoomState } from '@pandu/shared';
import { GamePhase, GameMode } from '@pandu/shared';

interface RoomState {
  // Connection
  isConnected: boolean;
  setConnected: (v: boolean) => void;

  // Room data
  room: ClientRoomState | null;
  setRoom: (room: ClientRoomState) => void;
  
  // Player actions
  addPlayer: (player: Player) => void;
  removePlayer: (playerId: string, newHostId?: string) => void;
  updatePlayerReady: (playerId: string, isReady: boolean) => void;
  updateSettings: (settings: Partial<GameSettings>) => void;

  // Local user
  myPlayerId: string | null;
  setMyPlayerId: (id: string) => void;
  myName: string;
  setMyName: (name: string) => void;
  myAvatarId: number;
  setMyAvatarId: (id: number) => void;

  // Reset
  reset: () => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  isConnected: false,
  setConnected: (v) => set({ isConnected: v }),

  room: null,
  setRoom: (room) => set({ room }),

  addPlayer: (player) => set((state) => {
    if (!state.room) return {};
    return {
      room: {
        ...state.room,
        players: [...state.room.players.filter(p => p.id !== player.id), player],
      },
    };
  }),

  removePlayer: (playerId, newHostId) => set((state) => {
    if (!state.room) return {};
    const players = state.room.players.filter(p => p.id !== playerId);
    if (newHostId) {
      const host = players.find(p => p.id === newHostId);
      if (host) host.isHost = true;
    }
    return {
      room: {
        ...state.room,
        players,
        hostId: newHostId || state.room.hostId,
      },
    };
  }),

  updatePlayerReady: (playerId, isReady) => set((state) => {
    if (!state.room) return {};
    return {
      room: {
        ...state.room,
        players: state.room.players.map(p =>
          p.id === playerId ? { ...p, isReady } : p
        ),
      },
    };
  }),

  updateSettings: (settings) => set((state) => {
    if (!state.room) return {};
    return {
      room: {
        ...state.room,
        settings: { ...state.room.settings, ...settings },
      },
    };
  }),

  myPlayerId: typeof window !== 'undefined' ? sessionStorage.getItem('pandu_player_id') : null,
  setMyPlayerId: (id) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('pandu_player_id', id);
    }
    set({ myPlayerId: id });
  },
  myName: typeof window !== 'undefined' ? (sessionStorage.getItem('pandu_name') || '') : '',
  setMyName: (name) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('pandu_name', name);
    }
    set({ myName: name });
  },
  myAvatarId: typeof window !== 'undefined' ? parseInt(sessionStorage.getItem('pandu_avatar') || '0', 10) : 0,
  setMyAvatarId: (id) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('pandu_avatar', id.toString());
    }
    set({ myAvatarId: id });
  },

  reset: () => set({
    room: null,
    myPlayerId: null,
  }),
}));
