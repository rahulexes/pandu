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
export declare function validatePanduCall(playerId: string, activePlayerId: string, isAlreadyCalled: boolean, isPlayerEliminated: boolean): {
    valid: boolean;
    error?: string;
};
/**
 * Calculate additional turns per player based on queen count.
 * 3-4 Queens → 1 additional turn per player/team
 * 2 Queens → 2 additional turns per player/team
 */
export declare function getAdditionalTurns(queenCount: number): number;
/**
 * Create the PANDU state after a valid call.
 */
export declare function createPanduState(callerPlayerId: string, finalTurnSequence: string[], callerTeamId?: string): PanduState;
