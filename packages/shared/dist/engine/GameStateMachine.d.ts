import { GamePhase } from '../gameStates';
export declare class GameStateMachine {
    private phase;
    constructor(initialPhase?: GamePhase);
    get currentPhase(): GamePhase;
    canTransitionTo(targetPhase: GamePhase): boolean;
    transition(targetPhase: GamePhase): boolean;
    transitionTo(targetPhase: GamePhase): boolean;
    forcePhase(targetPhase: GamePhase): void;
    reset(): void;
}
//# sourceMappingURL=GameStateMachine.d.ts.map