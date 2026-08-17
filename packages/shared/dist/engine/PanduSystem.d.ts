export interface PanduState {
    callerPlayerId: string;
    callerTeamId?: string;
    calledAt: number;
    remainingTurns: string[];
    finalTurnPlayerId: string;
    completed: boolean;
}
export declare function validatePanduCall(playerId: string, activePlayerId: string, isAlreadyCalled: boolean, isPlayerEliminated: boolean): {
    valid: boolean;
    error?: string;
};
export declare function getAdditionalTurns(queenCount: number): number;
export declare function createPanduState(callerPlayerId: string, finalTurnSequence: string[], callerTeamId?: string): PanduState;
//# sourceMappingURL=PanduSystem.d.ts.map