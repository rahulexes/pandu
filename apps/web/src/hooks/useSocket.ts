// ============================================================
// PANDU — Network Hook (P2P WebRTC & Socket.IO Support)
// ============================================================

'use client';

import { useEffect, useRef } from 'react';
import type { ClientToServerEvents } from '@pandu/shared';
import { useRoomStore } from '@/stores/roomStore';
import { useGameStore } from '@/stores/gameStore';
import { soundEngine } from '@/lib/audio';
import { p2pManager } from '@/lib/p2p/P2PManager';

function vibrate(pattern: number | number[]) {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore
    }
  }
}

export function useSocket() {
  const { setRoom, setConnected, addPlayer, removePlayer, updatePlayerReady, updateSettings } = useRoomStore();
  const { setGameState, setDrawnCard, setSpecialAction, setXReaction, setPanduState, setScores, setPhase } = useGameStore();

  useEffect(() => {
    // ── Connect / Disconnect ──
    p2pManager.on('connect' as any, () => {
      setConnected(true);
    });

    p2pManager.on('disconnect' as any, () => {
      setConnected(false);
    });

    // ── Room Events ──
    p2pManager.on('room:updated', (room) => {
      setRoom(room);
    });

    p2pManager.on('room:playerJoined', (player) => {
      addPlayer(player);
    });

    p2pManager.on('room:playerLeft', ({ playerId, newHostId }) => {
      removePlayer(playerId, newHostId);
    });

    p2pManager.on('room:error', ({ message }) => {
      console.error('[ROOM ERROR]', message);
      useGameStore.getState().setError(message);
    });

    // ── Lobby Events ──
    p2pManager.on('lobby:settingsUpdated', (settings) => {
      updateSettings(settings);
    });

    p2pManager.on('lobby:playerReady', ({ playerId, isReady }) => {
      updatePlayerReady(playerId, isReady);
    });

    // ── Game State ──
    p2pManager.on('game:stateUpdate', (state) => {
      setGameState(state);
    });

    p2pManager.on('game:phaseChanged', ({ phase }) => {
      setPhase(phase);
    });

    // ── Turn Events ──
    p2pManager.on('game:turnStart', (data) => {
      useGameStore.getState().setTurnInfo(data);
      const isMyTurn = data.playerId === useRoomStore.getState().myPlayerId;
      if (isMyTurn) {
        vibrate([100, 50, 100]);
        soundEngine.playCardFlip();
      }
    });

    p2pManager.on('game:cardDrawn', ({ card }) => {
      setDrawnCard(card);
      soundEngine.playCardDraw();
      vibrate(50);
    });

    p2pManager.on('game:cardDiscarded', ({ card }) => {
      useGameStore.getState().setDrawnCard(null);
      useGameStore.getState().addDiscard(card);
      soundEngine.playCardFlip();
    });

    p2pManager.on('game:cardReplaced', () => {
      useGameStore.getState().setDrawnCard(null);
      soundEngine.playCardFlip();
    });

    // ── Special Actions ──
    p2pManager.on('game:specialAction', (data) => {
      setSpecialAction(data);
      soundEngine.playSpecialPower();
      vibrate([80, 50, 80]);
    });

    p2pManager.on('game:cardRevealed', (data: any) => {
      useGameStore.getState().setRevealedCard(data);
      soundEngine.playSpecialPower();
      vibrate(60);
    });

    p2pManager.on('game:cardRevealedExpired', () => {
      useGameStore.getState().setRevealedCard(null);
    });

    // ── X Reaction ──
    p2pManager.on('game:xReactionWindow', (data) => {
      setXReaction({ isActive: true, timeRemainingMs: data.durationMs });
      soundEngine.playXReaction();
      vibrate([200, 100, 200, 100, 200]);
    });

    p2pManager.on('game:xReactionResult', (data) => {
      useGameStore.getState().setXReactionResult(data);
    });

    // ── PANDU ──
    p2pManager.on('game:panduCalled', (data) => {
      setPanduState({ callerName: data.playerName, remainingTurnNames: data.remainingTurns });
      soundEngine.playPanduCall();
      vibrate([300, 150, 300]);
    });

    // ── Timer ──
    p2pManager.on('game:timerSync', (data) => {
      useGameStore.getState().setTimer(data);
    });

    p2pManager.on('game:timerExpired', ({ type }) => {
      useGameStore.getState().clearTimer(type);
    });

    // ── End Game ──
    p2pManager.on('game:gameOver', ({ scores }) => {
      setScores(scores);
      soundEngine.playVictory();
      vibrate([200, 100, 200, 100, 400]);
    });

    // ── Errors ──
    p2pManager.on('game:actionError', ({ message }) => {
      useGameStore.getState().setError(message);
      vibrate(150);
    });

    // ── Initial View ──
    p2pManager.on('game:cardPeeked', ({ cardId, card }) => {
      useGameStore.getState().peekCard(cardId, card);
      soundEngine.playCardFlip();
      vibrate(40);
    });

    p2pManager.on('game:initialViewStart', (data) => {
      useGameStore.getState().setScores(null as any);
      useGameStore.getState().setShuffling(false);
      useGameStore.getState().setInitialView(data);
      soundEngine.playSpecialPower();
    });

    // ── Shuffle/Deal ──
    p2pManager.on('game:shuffleStart', () => {
      useGameStore.getState().setScores(null as any);
      useGameStore.getState().setShuffling(true);
      soundEngine.playCardShuffle();
      setTimeout(() => {
        useGameStore.getState().setShuffling(false);
      }, 1500);
    });

    p2pManager.on('game:dealStart', (data) => {
      useGameStore.getState().setScores(null as any);
      useGameStore.getState().setDealing(data);
      soundEngine.playCardShuffle();
      setTimeout(() => {
        useGameStore.getState().setShuffling(false);
      }, 1000);
    });

    // ── Rematch & Lobby ──
    p2pManager.on('game:rematchVotesUpdate', (data: any) => {
      useGameStore.getState().setRematchVotes(data.votes, data.totalConnected);
    });

    p2pManager.on('game:returnToLobby', () => {
      useGameStore.getState().reset();
      const roomCode = sessionStorage.getItem('pandu_room');
      if (roomCode) {
        window.location.href = `/room/${roomCode}`;
      }
    });

    p2pManager.on('game:reveal', (data) => {
      useGameStore.getState().setShuffling(false);
      useGameStore.getState().setRevealedHands(data.allHands);
      soundEngine.playCardFlip();
    });

    p2pManager.on('game:xReactionWrong', (data) => {
      useGameStore.getState().setXReactionWrong(data);
      soundEngine.playPenalty();
      vibrate([100, 50, 100]);
    });

    p2pManager.on('game:penaltyPrompt', (data) => {
      useGameStore.getState().setPenaltyPrompt(data);
      soundEngine.playPenalty();
      vibrate([200, 100, 200]);
    });

    p2pManager.on('game:penaltyCard', (data) => {
      useGameStore.getState().addPenalty(data);
      useGameStore.getState().setPenaltyPrompt(null);
      soundEngine.playPenalty();
      vibrate([200, 100, 200]);
    });

    p2pManager.on('game:deckRecycled', (data) => {
      useGameStore.getState().setDrawPileCount(data.newDrawPileCount);
    });

    p2pManager.on('game:playerEliminated', (data) => {
      useGameStore.getState().eliminatePlayer(data);
    });
  }, []);

  return null;
}

// ── Action Emitters ─────────────────────────────────────

export async function emitCreateRoom(playerName: string, avatarId: number): Promise<{ success: boolean; roomCode?: string; sessionToken?: string; playerId?: string; error?: string }> {
  const response = await p2pManager.createRoom(playerName, avatarId);
  if (response.sessionToken) {
    sessionStorage.setItem('pandu_session', response.sessionToken);
    sessionStorage.setItem('pandu_room', response.roomCode || '');
    if (response.playerId) {
      sessionStorage.setItem('pandu_player_id', response.playerId);
      useRoomStore.getState().setMyPlayerId(response.playerId);
    }
  }
  return response;
}

export async function emitJoinRoom(roomCode: string, playerName: string, avatarId: number): Promise<{ success: boolean; roomCode?: string; sessionToken?: string; playerId?: string; error?: string }> {
  const sessionToken = sessionStorage.getItem('pandu_session') || undefined;
  const response = await p2pManager.joinRoom(roomCode, playerName, avatarId, sessionToken);
  if (response.sessionToken) {
    sessionStorage.setItem('pandu_session', response.sessionToken);
    sessionStorage.setItem('pandu_room', response.roomCode || '');
    if (response.playerId) {
      sessionStorage.setItem('pandu_player_id', response.playerId);
      useRoomStore.getState().setMyPlayerId(response.playerId);
    }
  }
  return response;
}

export function emitGameAction(event: keyof ClientToServerEvents, data?: any): void {
  p2pManager.emitAction(event, data);
}
