import { GamePhase, GameMode, SpecialPowerType } from '@pandu/shared';
import type { Card, Player, GameSettings, ClientGameState, ClientRoomState } from '@pandu/shared';
export type RoomEventHandler = (event: string, data: unknown, targetPlayerIds?: string[]) => void;
export declare class Room {
    readonly id: string;
    readonly code: string;
    private players;
    private hostId;
    private teams;
    private settings;
    private stateMachine;
    private turnSystem;
    private allCards;
    private drawPile;
    private discardPile;
    private playerStates;
    private teamStates;
    private drawnCardId;
    private currentSpecialAction;
    private xReactionWindow;
    private panduState;
    private finishedOrder;
    private nextFinishRank;
    private previousScores;
    private timerManager;
    private logger;
    private emitEvent;
    private sessionTokens;
    private bannedPlayers;
    constructor(code: string, emitEvent: RoomEventHandler);
    addPlayer(name: string, avatarId: number, socketId: string): {
        player: Player;
        sessionToken: string;
    } | {
        error: string;
    };
    kickPlayer(hostId: string, targetPlayerId: string): {
        error?: string;
    };
    reconnectPlayer(sessionToken: string, socketId: string): Player | null;
    removePlayer(playerId: string): {
        newHostId?: string;
    };
    disconnectPlayer(playerId: string): void;
    getPlayer(playerId: string): Player | undefined;
    getPlayerBySocketId(socketId: string): Player | undefined;
    getAllPlayers(): Player[];
    getConnectedPlayerIds(): string[];
    setMode(hostId: string, mode: GameMode): {
        error?: string;
    };
    updateSettings(hostId: string, updates: Partial<GameSettings>): {
        error?: string;
    };
    toggleReady(playerId: string): boolean;
    joinTeam(playerId: string, teamId: string): {
        error?: string;
    };
    canStartGame(hostId: string): {
        canStart: boolean;
        error?: string;
    };
    startGame(): void;
    private startInitialViewPhase;
    peekInitialCard(playerId: string, cardId: string): {
        error?: string;
        card?: Card;
    };
    private endInitialViewPhase;
    private startPlayerTurn;
    drawCard(playerId: string): {
        error?: string;
        card?: Card;
    };
    discardDrawnCard(playerId: string): {
        error?: string;
        specialPower?: SpecialPowerType;
    };
    replaceHandCard(playerId: string, handCardId: string): {
        error?: string;
        specialPower?: SpecialPowerType;
    };
    private triggerSpecialPower;
    selectSelfPeekCard(playerId: string, cardId: string): {
        error?: string;
        card?: Card;
    };
    private completeSelfPeek;
    selectOtherPeekCard(playerId: string, targetPlayerId: string, cardId: string): {
        error?: string;
        card?: Card;
    };
    private completeOtherPeek;
    selectOwnExchangeCard(playerId: string, cardId: string): {
        error?: string;
    };
    selectOtherExchangeCard(playerId: string, targetPlayerId: string, cardId: string): {
        error?: string;
    };
    acknowledgeSpecial(playerId: string): {
        error?: string;
    };
    skipSpecial(playerId: string): {
        error?: string;
    };
    private xReactionAttemptedPlayers;
    private pendingPenaltyCards;
    attemptXReaction(playerId: string, cardId: string): {
        error?: string;
    };
    private dealPenaltyCard;
    placePenaltyCard(playerId: string, slotIndex?: number): {
        error?: string;
    };
    callPandu(playerId: string): {
        error?: string;
    };
    endTurn(playerId: string): {
        error?: string;
    };
    private eliminatePlayerOrTeam;
    private revealAndScore;
    private rematchVotes;
    requestRematch(playerId?: string): void;
    returnToLobby(): void;
    private getPlayerHand;
    private setPlayerHand;
    private getPlayerTeamId;
    private recycleDiscard;
    private getTeamPlayerIds;
    /**
     * Get the filtered game state for a specific player.
     * Never includes hidden card information belonging to other players.
     */
    getClientGameState(playerId: string): ClientGameState;
    /**
     * Get the room state for clients (lobby view).
     */
    getClientRoomState(): ClientRoomState;
    /**
     * Broadcast the full game state to all connected players.
     * Each player receives their own filtered view.
     */
    broadcastGameState(): void;
    broadcastRoomState(): void;
    get gamePhase(): GamePhase;
    get isHost(): string;
    get gameSettings(): GameSettings;
    get playerCount(): number;
}
