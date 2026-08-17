// ============================================================
// PANDU — PANDU System
// ============================================================
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
export function getAdditionalTurns(queenCount) {
    if (queenCount <= 2)
        return 2;
    return 1;
}
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