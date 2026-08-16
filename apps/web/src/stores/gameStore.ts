// ============================================================
// PANDU — Game Store (Zustand)
// ============================================================

import { create } from 'zustand';
import type { ClientGameState, ClientCard, PlayerScore, ClientXReaction } from '@pandu/shared';
import { GamePhase, SpecialPowerType, SpecialActionPhase } from '@pandu/shared';

interface GameState {
  // Full game state from server
  gameState: ClientGameState | null;
  setGameState: (state: ClientGameState) => void;

  // Phase
  phase: GamePhase;
  setPhase: (phase: GamePhase) => void;

  // Turn info
  turnInfo: { playerId: string; teamId?: string; playerName: string; turnNumber: number } | null;
  setTurnInfo: (info: { playerId: string; teamId?: string; playerName: string; turnNumber: number }) => void;

  // Drawn card
  drawnCard: ClientCard | null;
  setDrawnCard: (card: ClientCard | null) => void;

  // Special action
  specialAction: { type: SpecialPowerType; phase: SpecialActionPhase; message: string } | null;
  setSpecialAction: (action: { type: SpecialPowerType; phase: SpecialActionPhase; message: string } | null) => void;

  // Revealed card (during special action)
  revealedCard: { cardId: string; card: ClientCard; durationMs: number } | null;
  setRevealedCard: (data: { cardId: string; card: ClientCard; durationMs: number } | null) => void;

  // X Reaction
  xReaction: { isActive: boolean; timeRemainingMs: number } | null;
  setXReaction: (data: { isActive: boolean; timeRemainingMs: number } | null) => void;
  xReactionResult: { reactions: ClientXReaction[]; winnerId?: string } | null;
  setXReactionResult: (data: { reactions: ClientXReaction[]; winnerId?: string } | null) => void;
  xReactionWrong: { playerId: string; playerName: string; card: ClientCard } | null;
  setXReactionWrong: (data: { playerId: string; playerName: string; card: ClientCard } | null) => void;

  // Penalty Prompt (Choose Left or Right placement)
  penaltyPrompt: { cardId: string } | null;
  setPenaltyPrompt: (data: { cardId: string } | null) => void;

  // PANDU state
  panduState: { callerName: string; remainingTurnNames: string[] } | null;
  setPanduState: (state: { callerName: string; remainingTurnNames: string[] } | null) => void;

  // Timer
  timer: { type: string; endsAt: number; durationMs: number } | null;
  setTimer: (timer: { type: string; endsAt: number; durationMs: number }) => void;
  clearTimer: (type: string) => void;

  // Scores
  scores: PlayerScore[] | null;
  setScores: (scores: PlayerScore[]) => void;

  // Error
  error: string | null;
  setError: (error: string | null) => void;

  // Animations
  isShuffling: boolean;
  setShuffling: (v: boolean) => void;
  dealingInfo: { playerOrder: string[]; cardsPerPlayer: number } | null;
  setDealing: (info: { playerOrder: string[]; cardsPerPlayer: number } | null) => void;

  // Initial view
  initialView: { durationMs: number; maxPeeks: number } | null;
  setInitialView: (data: { durationMs: number; maxPeeks: number } | null) => void;

  // Discard pile additions
  addDiscard: (card: ClientCard) => void;

  // Peek card
  peekCard: (cardId: string, card: ClientCard) => void;

  // Revealed hands (end game)
  revealedHands: Record<string, ClientCard[]> | null;
  setRevealedHands: (hands: Record<string, ClientCard[]> | null) => void;

  // Rematch
  rematchVotes: string[];
  totalPlayers: number;
  setRematchVotes: (votes: string[], total: number) => void;

  // Penalty
  addPenalty: (data: { playerId: string; cardCount: number }) => void;

  // Draw pile
  drawPileCount: number;
  setDrawPileCount: (count: number) => void;

  // Elimination
  eliminatePlayer: (data: { playerId: string; playerName: string; rank: number }) => void;

  // Reset
  reset: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  gameState: null,
  rematchVotes: [],
  totalPlayers: 0,
  setRematchVotes: (votes, total) => set({ rematchVotes: votes, totalPlayers: total }),

  setGameState: (state) => set((prev) => {
    let myHand = state.myHand;
    if (prev.gameState && state.phase === GamePhase.INITIAL_VIEW) {
      const currentlyFaceUp = new Map<string, ClientCard>();
      for (const card of prev.gameState.myHand) {
        if (card.faceUp) {
          currentlyFaceUp.set(card.id, card);
        }
      }
      if (currentlyFaceUp.size > 0) {
        myHand = state.myHand.map(card => {
          const peeked = currentlyFaceUp.get(card.id);
          return peeked ? { ...card, rank: peeked.rank, suit: peeked.suit, faceUp: true } : card;
        });
      }
    }

    const isGameOverPhase = state.phase === GamePhase.GAME_OVER || state.phase === GamePhase.SCORING || state.phase === GamePhase.REVEAL;

    return {
      gameState: { ...state, myHand },
      phase: state.phase,
      drawnCard: state.drawnCard ?? null,
      specialAction: (state.specialAction as any) ?? null,
      xReaction: state.xReaction ?? null,
      panduState: state.panduState ?? null,
      scores: isGameOverPhase ? prev.scores : null,
      rematchVotes: isGameOverPhase ? prev.rematchVotes : [],
    };
  }),

  phase: GamePhase.LOBBY,
  setPhase: (phase) => set({ phase }),

  turnInfo: null,
  setTurnInfo: (info) => set((state) => {
    // When turn starts, all cards in hand flip back to facedown
    const myHand = state.gameState?.myHand.map(c => ({ ...c, faceUp: false })) || [];
    return {
      turnInfo: info,
      drawnCard: null,
      gameState: state.gameState ? { ...state.gameState, myHand } : null,
    };
  }),

  drawnCard: null,
  setDrawnCard: (card) => set({ drawnCard: card }),

  specialAction: null,
  setSpecialAction: (action) => set({ specialAction: action }),

  revealedCard: null,
  setRevealedCard: (data) => {
    set({ revealedCard: data });
    if (data) {
      setTimeout(() => {
        set((state) => (state.revealedCard?.cardId === data.cardId ? { revealedCard: null } : {}));
      }, (data.durationMs || 5000));
    }
  },

  xReaction: null,
  setXReaction: (data) => set({ xReaction: data }),
  xReactionResult: null,
  setXReactionResult: (data) => set({ xReactionResult: data, xReaction: null }),
  xReactionWrong: null,
  setXReactionWrong: (data) => {
    set({ xReactionWrong: data });
    if (data) {
      setTimeout(() => {
        set({ xReactionWrong: null });
      }, 3200);
    }
  },

  penaltyPrompt: null,
  setPenaltyPrompt: (data) => set({ penaltyPrompt: data }),

  panduState: null,
  setPanduState: (state) => set({ panduState: state }),

  timer: null,
  setTimer: (timer) => set({ timer }),
  clearTimer: (type) => set((state) => {
    if (state.timer?.type === type) return { timer: null };
    return {};
  }),

  scores: null,
  setScores: (scores) => set({ scores }),

  error: null,
  setError: (error) => {
    set({ error });
    if (error) {
      setTimeout(() => set({ error: null }), 4000);
    }
  },

  isShuffling: false,
  setShuffling: (v) => set({ isShuffling: v }),
  dealingInfo: null,
  setDealing: (info) => set({ dealingInfo: info }),

  initialView: null,
  setInitialView: (data) => set({ initialView: data }),

  addDiscard: (card) => set((state) => {
    if (!state.gameState) return {};
    const discards = [...(state.gameState.visibleDiscards || []), card].slice(-2);
    return {
      gameState: { ...state.gameState, visibleDiscards: discards },
    };
  }),

  peekCard: (cardId, card) => {
    set((state) => {
      if (!state.gameState) return {};
      const myHand = state.gameState.myHand.map(c =>
        c.id === cardId ? { ...c, rank: card.rank, suit: card.suit, faceUp: true } : c
      );
      return {
        gameState: { ...state.gameState, myHand },
        revealedCard: { cardId, card: { id: cardId, rank: card.rank, suit: card.suit, faceUp: true }, durationMs: 4000 },
      };
    });

    // Auto flip back after 4 seconds
    setTimeout(() => {
      set((state) => {
        if (!state.gameState) return {};
        const myHand = state.gameState.myHand.map(c =>
          c.id === cardId ? { ...c, faceUp: false } : c
        );
        return {
          gameState: { ...state.gameState, myHand },
          revealedCard: state.revealedCard?.cardId === cardId ? null : state.revealedCard,
        };
      });
    }, 4000);
  },

  revealedHands: null,
  setRevealedHands: (hands) => set({ revealedHands: hands }),

  addPenalty: (data) => {},

  drawPileCount: 0,
  setDrawPileCount: (count) => set({ drawPileCount: count }),

  eliminatePlayer: (data) => {},

  reset: () => set({
    gameState: null,
    phase: GamePhase.LOBBY,
    turnInfo: null,
    drawnCard: null,
    specialAction: null,
    revealedCard: null,
    xReaction: null,
    xReactionResult: null,
    panduState: null,
    timer: null,
    scores: null,
    error: null,
    isShuffling: false,
    dealingInfo: null,
    initialView: null,
    revealedHands: null,
  }),
}));
