import { GameMode } from '@pandu/shared';
export interface TurnConfig {
    mode: GameMode;
    /** Player IDs in turn order (Individual) */
    playerOrder: string[];
    /** Team IDs in turn order (Team) */
    teamOrder?: string[];
    /** Map of teamId → player IDs in rotation order */
    teamPlayers?: Map<string, string[]>;
}
export declare class TurnSystem {
    private mode;
    private playerOrder;
    private teamOrder;
    private teamPlayers;
    private currentPlayerIndex;
    private currentTeamIndex;
    /** Per-team: which player within the team is active */
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
    /**
     * Advance to the next turn. Returns the new active player ID.
     */
    advanceTurn(): string;
    private advanceIndividualTurn;
    private advanceTeamTurn;
    private advanceFinalTurn;
    /**
     * Check if all final turns have been completed.
     */
    areFinalTurnsComplete(): boolean;
    /**
     * Set up the final turn sequence after PANDU is called.
     * In Individual Mode: every other player gets one turn, caller goes last.
     * In Team Mode: depends on queen count configuration.
     *
     * @param callerPlayerId The player who called PANDU
     * @param additionalTurnsPerPlayer How many turns each player/team gets (1 for 3-4 queens, 2 for 2 queens)
     */
    setupFinalTurns(callerPlayerId: string, additionalTurnsPerPlayer?: number): void;
    eliminatePlayer(playerId: string): void;
    eliminateTeam(teamId: string): void;
    isPlayerEliminated(playerId: string): boolean;
    isTeamEliminated(teamId: string): boolean;
    getActivePlayers(): string[];
    getActiveTeams(): string[];
    getPlayerTeam(playerId: string): string | undefined;
    /**
     * Set the starting player (for rematch).
     */
    setStartingPlayer(playerId: string): void;
    /**
     * Set the starting team (for rematch).
     */
    setStartingTeam(teamId: string): void;
    /**
     * Check if only one player/team remains active.
     */
    isGameEffectivelyOver(): boolean;
}
