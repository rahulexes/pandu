import { GamePhase } from '@pandu/shared';
export declare class GameStateMachine {
    private _currentPhase;
    private _transitionHistory;
    constructor(initialPhase?: GamePhase);
    get currentPhase(): GamePhase;
    get history(): {
        from: GamePhase;
        to: GamePhase;
        timestamp: number;
    }[];
    /**
     * Check if a transition to the target phase is valid from the current phase.
     */
    canTransition(targetPhase: GamePhase): boolean;
    /**
     * Transition to a new phase. Throws if the transition is invalid.
     */
    transition(targetPhase: GamePhase): void;
    /**
     * Force a phase (for reconnection state restoration). Use sparingly.
     */
    forcePhase(phase: GamePhase): void;
    /**
     * Check if the game is in a playable state (not lobby or game over).
     */
    isInGame(): boolean;
    /**
     * Check if the game is in a state where normal turns happen.
     */
    isInTurnPhase(): boolean;
    /**
     * Reset to lobby state.
     */
    reset(): void;
}
export declare class GameStateError extends Error {
    constructor(message: string);
}
