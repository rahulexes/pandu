// ============================================================
// PANDU — PANDU System
// ============================================================
// Manages the PANDU call, final turn sequence, and endgame.

import { GameMode } from '@pandu/shared';

export interface PanduState {
  callerPlayerId: string;
  callerTeamId?: string;
  calledAt: number;
  /** Remaining player IDs in final turn order */
  remainingTurns: string[];
  /** The player who takes the absolute last turn */
  finalTurnPlayerId: string;
  /** Whether all final turns have been completed */
  completed: boolean;
}

/**
 * Validate whether a player can call PANDU.
 */
export function validatePanduCall(
  playerId: string,
  activePlayerId: string,
  isAlreadyCalled: boolean,
  isPlayerEliminated: boolean,
): { valid: boolean; error?: string } {
  if (isAlreadyCalled) {
    return { valid: false, error: 'PANDU has already been called' };
  }
  if (playerId !== activePlayerId) {
    return { valid: false, error: 'PANDU can only be called during your turn' };
  }
  if (isPlayerEliminated) {
    return { valid: false, error: 'Eliminated players cannot call PANDU' };
  }
  return { valid: true };
}

/**
 * Calculate additional turns per player based on queen count.
 * 3-4 Queens → 1 additional turn per player/team
 * 2 Queens → 2 additional turns per player/team
 */
export function getAdditionalTurns(queenCount: number): number {
  if (queenCount <= 2) return 2;
  return 1;
}

/**
 * Create the PANDU state after a valid call.
 */
export function createPanduState(
  callerPlayerId: string,
  finalTurnSequence: string[],
  callerTeamId?: string,
): PanduState {
  return {
    callerPlayerId,
    callerTeamId,
    calledAt: Date.now(),
    remainingTurns: finalTurnSequence,
    finalTurnPlayerId: callerPlayerId,
    completed: false,
  };
}
