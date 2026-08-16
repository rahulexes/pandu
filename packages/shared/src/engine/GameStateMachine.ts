// ============================================================
// PANDU — Game State Machine
// ============================================================

import { GamePhase, VALID_TRANSITIONS } from '../gameStates';

export class GameStateMachine {
  private phase: GamePhase;

  constructor(initialPhase: GamePhase = GamePhase.LOBBY) {
    this.phase = initialPhase;
  }

  get currentPhase(): GamePhase {
    return this.phase;
  }

  canTransitionTo(targetPhase: GamePhase): boolean {
    const allowed = VALID_TRANSITIONS[this.phase];
    return allowed ? allowed.includes(targetPhase) : false;
  }

  transition(targetPhase: GamePhase): boolean {
    return this.transitionTo(targetPhase);
  }

  transitionTo(targetPhase: GamePhase): boolean {
    if (!this.canTransitionTo(targetPhase)) {
      return false;
    }
    this.phase = targetPhase;
    return true;
  }

  forcePhase(targetPhase: GamePhase): void {
    this.phase = targetPhase;
  }

  reset(): void {
    this.phase = GamePhase.LOBBY;
  }
}
