// ============================================================
// PANDU — Network Hook (P2P WebRTC & Socket.IO Support)
// ============================================================

'use client';

import { useEffect, useRef } from 'react';
import type { ClientToServerEvents } from '@pandu/shared';
import { useRoomStore } from '@/stores/roomStore';
import { useGameStore } from '@/stores/gameStore';
import { soundEngine } from '@/lib/audio';
import { realtimeManager } from '@/lib/p2p/RealtimeManager';

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
    realtimeManager.on('connect' as any, () => {
      setConnected(true);
    });

    realtimeManager.on('disconnect' as any, () => {
      setConnected(false);
    });

    // ── Room Events ──
    realtimeManager.on('room:updated', (room) => {
      setRoom(room);
    });

    realtimeManager.on('room:playerJoined', (player) => {
      addPlayer(player);
    });

    realtimeManager.on('room:playerLeft', ({ playerId, newHostId }) => {
      removePlayer(playerId, newHostId);
    });

    realtimeManager.on('room:error', ({ message }) => {
      console.error('[ROOM ERROR]', message);
      useGameStore.getState().setError(message);
    });

    // ── Lobby Events ──
    realtimeManager.on('lobby:settingsUpdated', (settings) => {
      updateSettings(settings);
    });

    realtimeManager.on('lobby:playerReady', ({ playerId, isReady }) => {
      updatePlayerReady(playerId, isReady);
    });

    // ── Game State ──
    realtimeManager.on('game:stateUpdate', (state) => {
      setGameState(state);
    });

    realtimeManager.on('game:phaseChanged', ({ phase }) => {
      setPhase(phase);
    });

    // ── Turn Events ──
    realtimeManager.on('game:turnStart', (data) => {
      useGameStore.getState().setTurnInfo(data);
      const isMyTurn = data.playerId === useRoomStore.getState().myPlayerId;
      if (isMyTurn) {
        vibrate([100, 50, 100]);
        soundEngine.playCardFlip();
      }
    });

    realtimeManager.on('game:cardDrawn', (data: any) => {
      if (data.card) {
        setDrawnCard(data.card);
      }
      useGameStore.getState().triggerFlight('draw', data);
      soundEngine.playCardDraw();
      vibrate(50);
    });

    realtimeManager.on('game:cardDiscarded', (data: any) => {
      useGameStore.getState().setDrawnCard(null);
      if (data.card) {
        useGameStore.getState().addDiscard(data.card);
      }
      useGameStore.getState().triggerFlight('discard', data);
      soundEngine.playCardFlip();
    });

    realtimeManager.on('game:cardReplaced', (data: any) => {
      useGameStore.getState().setDrawnCard(null);
      useGameStore.getState().triggerFlight('replace', data);
      soundEngine.playCardFlip();
    });

    realtimeManager.on('game:exchangeComplete', (data: any) => {
      const cardIds = [data?.ownCardId, data?.otherCardId].filter(Boolean);
      useGameStore.getState().setBlinkingExchangedCardIds(cardIds.length > 0 ? cardIds : null);
      useGameStore.getState().setExchangedBanner(true);
      setTimeout(() => {
        useGameStore.getState().setExchangedBanner(false);
        useGameStore.getState().setBlinkingExchangedCardIds(null);
      }, 1500);
      soundEngine.playSpecialPower();
    });

    // ── Special Actions ──
    realtimeManager.on('game:specialAction', (data) => {
      setSpecialAction(data);
      soundEngine.playSpecialPower();
      vibrate([80, 50, 80]);
    });

    realtimeManager.on('game:cardRevealed', (data: any) => {
      useGameStore.getState().setRevealedCard(data);
      soundEngine.playSpecialPower();
      vibrate(60);
    });

    realtimeManager.on('game:cardRevealedExpired', () => {
      useGameStore.getState().setRevealedCard(null);
    });

    // ── X Reaction ──
    realtimeManager.on('game:xReactionWindow', (data) => {
      setXReaction({ isActive: true, timeRemainingMs: data.durationMs });
      soundEngine.playXReaction();
      vibrate([200, 100, 200, 100, 200]);
    });

    realtimeManager.on('game:xReactionResult', (data) => {
      useGameStore.getState().setXReactionResult(data);
    });

    // ── PANDU ──
    realtimeManager.on('game:panduCalled', (data) => {
      setPanduState({ callerName: data.playerName, remainingTurnNames: data.remainingTurns });
      soundEngine.playPanduCall();
      vibrate([300, 150, 300]);
    });

    // ── Timer ──
    realtimeManager.on('game:timerSync', (data) => {
      useGameStore.getState().setTimer(data);
    });

    realtimeManager.on('game:timerExpired', ({ type }) => {
      useGameStore.getState().clearTimer(type);
    });

    // ── End Game ──
    realtimeManager.on('game:gameOver', ({ scores }) => {
      setScores(scores);
      soundEngine.playVictory();
      vibrate([200, 100, 200, 100, 400]);
    });

    // ── Errors ──
    realtimeManager.on('game:actionError', ({ message }) => {
      useGameStore.getState().setError(message);
      vibrate(150);
    });

    // ── Initial View ──
    realtimeManager.on('game:cardPeeked', ({ cardId, card }) => {
      useGameStore.getState().peekCard(cardId, card);
      soundEngine.playCardFlip();
      vibrate(40);
    });

    realtimeManager.on('game:initialViewStart', (data) => {
      useGameStore.getState().setScores(null as any);
      useGameStore.getState().setShuffling(false);
      useGameStore.getState().setInitialView(data);
      soundEngine.playSpecialPower();
    });

    // ── Shuffle/Deal ──
    realtimeManager.on('game:shuffleStart', () => {
      useGameStore.getState().setScores(null as any);
      useGameStore.getState().setShuffling(true);
      soundEngine.playCardShuffle();
      setTimeout(() => {
        useGameStore.getState().setShuffling(false);
      }, 1500);
    });

    realtimeManager.on('game:dealStart', (data) => {
      useGameStore.getState().setScores(null as any);
      useGameStore.getState().setDealing(data);
      soundEngine.playCardShuffle();
      setTimeout(() => {
        useGameStore.getState().setShuffling(false);
      }, 1000);
    });

    // ── Rematch & Lobby ──
    realtimeManager.on('game:rematchVotesUpdate', (data: any) => {
      useGameStore.getState().setRematchVotes(data.votes, data.totalConnected);
    });

    realtimeManager.on('game:returnToLobby', () => {
      useGameStore.getState().reset();
      const roomCode = sessionStorage.getItem('pandu_room');
      if (roomCode) {
        window.location.href = `/room/${roomCode}`;
      }
    });

    realtimeManager.on('game:reveal', (data) => {
      useGameStore.getState().setShuffling(false);
      useGameStore.getState().setRevealedHands(data.allHands);
      soundEngine.playCardFlip();
    });

    realtimeManager.on('game:xReactionWrong', (data) => {
      useGameStore.getState().setXReactionWrong(data);
      soundEngine.playPenalty();
      vibrate([100, 50, 100]);
    });

    realtimeManager.on('game:penaltyPrompt', (data) => {
      useGameStore.getState().setPenaltyPrompt(data);
      soundEngine.playPenalty();
      vibrate([200, 100, 200]);
    });

    realtimeManager.on('game:penaltyCard', (data) => {
      useGameStore.getState().addPenalty(data);
      useGameStore.getState().setPenaltyPrompt(null);
      soundEngine.playPenalty();
      vibrate([200, 100, 200]);
    });

    realtimeManager.on('game:deckRecycled', (data) => {
      useGameStore.getState().setDrawPileCount(data.newDrawPileCount);
    });

    realtimeManager.on('game:playerEliminated', (data) => {
      useGameStore.getState().eliminatePlayer(data);
    });
  }, []);

  return null;
}

// ── Action Emitters ─────────────────────────────────────

export async function emitCreateRoom(playerName: string, avatarId: number): Promise<{ success: boolean; roomCode?: string; sessionToken?: string; playerId?: string; error?: string }> {
  const response = await realtimeManager.createRoom(playerName, avatarId);
  if (response.sessionToken) {
    sessionStorage.setItem('pandu_session', response.sessionToken);
    sessionStorage.setItem('pandu_room', response.roomCode || '');
    sessionStorage.setItem('pandu_is_host', 'true');
    if (response.playerId) {
      sessionStorage.setItem('pandu_player_id', response.playerId);
      useRoomStore.getState().setMyPlayerId(response.playerId);
    }
  }
  return response;
}

export async function emitJoinRoom(roomCode: string, playerName: string, avatarId: number): Promise<{ success: boolean; roomCode?: string; sessionToken?: string; playerId?: string; error?: string }> {
  const sessionToken = sessionStorage.getItem('pandu_session') || undefined;
  const response = await realtimeManager.joinRoom(roomCode, playerName, avatarId, sessionToken);
  if (response.sessionToken) {
    sessionStorage.setItem('pandu_session', response.sessionToken);
    sessionStorage.setItem('pandu_room', response.roomCode || '');
    sessionStorage.setItem('pandu_is_host', 'false');
    if (response.playerId) {
      sessionStorage.setItem('pandu_player_id', response.playerId);
      useRoomStore.getState().setMyPlayerId(response.playerId);
    }
  }
  return response;
}

export function emitGameAction(event: keyof ClientToServerEvents, data?: any): void {
  realtimeManager.emitAction(event, data);
}
