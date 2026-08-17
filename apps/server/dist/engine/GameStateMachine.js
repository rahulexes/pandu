// ============================================================
// PANDU — Game State Machine
// ============================================================
// Enforces valid state transitions and prevents illegal moves.
import { GamePhase, VALID_TRANSITIONS } from '@pandu/shared';
export class GameStateMachine {
    _currentPhase;
    _transitionHistory = [];
    constructor(initialPhase = GamePhase.LOBBY) {
        this._currentPhase = initialPhase;
    }
    get currentPhase() {
        return this._currentPhase;
    }
    get history() {
        return [...this._transitionHistory];
    }
    /**
     * Check if a transition to the target phase is valid from the current phase.
     */
    canTransition(targetPhase) {
        const validTargets = VALID_TRANSITIONS[this._currentPhase];
        return validTargets?.includes(targetPhase) ?? false;
    }
    /**
     * Transition to a new phase. Throws if the transition is invalid.
     */
    transition(targetPhase) {
        if (!this.canTransition(targetPhase)) {
            throw new GameStateError(`Invalid transition: ${this._currentPhase} → ${targetPhase}. ` +
                `Valid transitions: ${VALID_TRANSITIONS[this._currentPhase]?.join(', ') || 'none'}`);
        }
        this._transitionHistory.push({
            from: this._currentPhase,
            to: targetPhase,
            timestamp: Date.now(),
        });
        this._currentPhase = targetPhase;
    }
    /**
     * Force a phase (for reconnection state restoration). Use sparingly.
     */
    forcePhase(phase) {
        this._currentPhase = phase;
    }
    /**
     * Check if the game is in a playable state (not lobby or game over).
     */
    isInGame() {
        return (this._currentPhase !== GamePhase.LOBBY &&
            this._currentPhase !== GamePhase.GAME_OVER &&
            this._currentPhase !== GamePhase.REMATCH);
    }
    /**
     * Check if the game is in a state where normal turns happen.
     */
    isInTurnPhase() {
        return [
            GamePhase.PLAYER_TURN,
            GamePhase.DRAWING,
            GamePhase.CARD_DECISION,
            GamePhase.SPECIAL_ACTION,
            GamePhase.X_REACTION,
            GamePhase.END_TURN,
            GamePhase.FINAL_TURNS,
        ].includes(this._currentPhase);
    }
    /**
     * Reset to lobby state.
     */
    reset() {
        this._currentPhase = GamePhase.LOBBY;
        this._transitionHistory = [];
    }
}
export class GameStateError extends Error {
    constructor(message) {
        super(message);
        this.name = 'GameStateError';
    }
}
//# sourceMappingURL=GameStateMachine.js.map