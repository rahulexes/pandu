// ============================================================
// PANDU — PANDU System
// ============================================================
// Manages the PANDU call, final turn sequence, and endgame.
/**
 * Validate whether a player can call PANDU.
 */
export function validatePanduCall(playerId, activePlayerId, isAlreadyCalled, isPlayerEliminated) {
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
export function getAdditionalTurns(queenCount) {
    if (queenCount <= 2)
        return 2;
    return 1;
}
/**
 * Create the PANDU state after a valid call.
 */
export function createPanduState(callerPlayerId, finalTurnSequence, callerTeamId) {
    return {
        callerPlayerId,
        callerTeamId,
        calledAt: Date.now(),
        remainingTurns: finalTurnSequence,
        finalTurnPlayerId: callerPlayerId,
        completed: false,
    };
}
//# sourceMappingURL=PanduSystem.js.map