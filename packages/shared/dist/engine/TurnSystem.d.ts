import { GameMode } from '../types';
export interface TurnConfig {
    mode: GameMode;
    playerOrder: string[];
    teamOrder?: string[];
    teamPlayers?: Map<string, string[]>;
}
export declare class TurnSystem {
    private mode;
    private playerOrder;
    private teamOrder;
    private teamPlayers;
    private currentPlayerIndex;
    private currentTeamIndex;
    private teamPlayerIndices;
    private eliminatedPlayers;
    private eliminatedTeams;
    private isFinalTurns;
    private finalTurnQueue;
    private finalTurnIndex;
    constructor(config: TurnConfig);
    get activePlayerId(): string;
    get activeTeamId(): string | undefined;
    get currentTurnIndex(): number;
    get isInFinalTurns(): boolean;
    get remainingFinalTurns(): string[];
    advanceTurn(): string;
    private advanceIndividualTurn;
    private advanceTeamTurn;
    private advanceFinalTurn;
    areFinalTurnsComplete(): boolean;
    setupFinalTurns(callerPlayerId: string, additionalTurnsPerPlayer?: number): void;
    eliminatePlayer(playerId: string): void;
    eliminateTeam(teamId: string): void;
    isPlayerEliminated(playerId: string): boolean;
    isTeamEliminated(teamId: string): boolean;
    getActivePlayers(): string[];
    getActiveTeams(): string[];
    getPlayerTeam(playerId: string): string | undefined;
    setStartingPlayer(playerId: string): void;
    setStartingTeam(teamId: string): void;
    isGameEffectivelyOver(): boolean;
}
//# sourceMappingURL=TurnSystem.d.ts.map