// ============================================================
// PANDU — Game State Machine
// ============================================================
import { GamePhase, VALID_TRANSITIONS } from '../gameStates';
export class GameStateMachine {
    phase;
    constructor(initialPhase = GamePhase.LOBBY) {
        this.phase = initialPhase;
    }
    get currentPhase() {
        return this.phase;
    }
    canTransitionTo(targetPhase) {
        const allowed = VALID_TRANSITIONS[this.phase];
        return allowed ? allowed.includes(targetPhase) : false;
    }
    transition(targetPhase) {
        return this.transitionTo(targetPhase);
    }
    transitionTo(targetPhase) {
        if (!this.canTransitionTo(targetPhase)) {
            return false;
        }
        this.phase = targetPhase;
        return true;
    }
    forcePhase(targetPhase) {
        this.phase = targetPhase;
    }
    reset() {
        this.phase = GamePhase.LOBBY;
    }
}
//# sourceMappingURL=GameStateMachine.js.map