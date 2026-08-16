// ============================================================
// PANDU — PANDU System
// ============================================================

import { GameMode } from '../types';

export interface PanduState {
  callerPlayerId: string;
  callerTeamId?: string;
  calledAt: number;
  remainingTurns: string[];
  finalTurnPlayerId: string;
  completed: boolean;
}

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

export function getAdditionalTurns(queenCount: number): number {
  if (queenCount <= 2) return 2;
  return 1;
}

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
