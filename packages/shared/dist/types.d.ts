import { RANKS, SUITS } from './constants';
import { GamePhase, SpecialActionPhase, SpecialPowerType } from './gameStates';
export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];
/** A unique card with server-side identity */
export interface Card {
    /** Unique ID e.g. "hearts-7", "spades-K" */
    id: string;
    rank: Rank;
    suit: Suit;
}
/** A card as seen by a specific player (may be hidden) */
export interface ClientCard {
    /** Unique card ID (always provided for position tracking) */
    id: string;
    /** Rank — only provided if the card is visible to this player */
    rank?: Rank;
    /** Suit — only provided if the card is visible to this player */
    suit?: Suit;
    /** Whether this card is face-up (visible) */
    faceUp: boolean;
}
/** Where a card physically exists */
export declare enum CardZone {
    DRAW_PILE = "DRAW_PILE",
    DISCARD_PILE = "DISCARD_PILE",
    PLAYER_HAND = "PLAYER_HAND",
    TEAM_HAND = "TEAM_HAND",
    TEMPORARY = "TEMPORARY",
    PENALTY = "PENALTY"
}
export interface Player {
    id: string;
    name: string;
    avatarId: number;
    isHost: boolean;
    isReady: boolean;
    isConnected: boolean;
    teamId?: string;
    /** Socket ID for server use */
    socketId?: string;
    /** Session token for reconnection */
    sessionToken?: string;
}
/** Player state during an active game */
export interface PlayerGameState {
    playerId: string;
    /** Card IDs in hand (order matters for position, null represents empty slot) */
    handCardIds: (string | null)[];
    /** Card IDs the player has peeked at (knows the identity of) */
    knownCardIds: Set<string>;
    /** Number of initial peeks used */
    initialPeeksUsed: number;
    /** Whether the player has been eliminated (0 cards) */
    isEliminated: boolean;
    /** Finishing rank (set when eliminated or game ends) */
    finishRank?: number;
    /** Final score */
    score?: number;
    /** Whether this player called PANDU */
    calledPandu: boolean;
    /** Is this player a spectator */
    isSpectator: boolean;
}
export interface Team {
    id: string;
    name: string;
    playerIds: string[];
    /** Index of the current active player within the team */
    activePlayerIndex: number;
}
export interface TeamGameState {
    teamId: string;
    /** Card IDs in shared hand (null represents empty slot) */
    handCardIds: (string | null)[];
    /** Card IDs known by the team */
    knownCardIds: Set<string>;
    initialPeeksUsed: number;
    isEliminated: boolean;
    finishRank?: number;
    score?: number;
    calledPandu: boolean;
    /** Current player index within team rotation */
    currentPlayerIndex: number;
}
export declare enum GameMode {
    INDIVIDUAL = "INDIVIDUAL",
    TEAM = "TEAM"
}
export interface GameSettings {
    mode: GameMode;
    /** Number of cards dealt to each player/team (Y) */
    cardsDealt: number;
    /** Number of cards initially viewable (X), must be <= floor(Y/2) */
    initialViewable: number;
    /** Number of Queens in deck (Team Mode, 2-4) */
    queenCount: number;
}
export interface RoomData {
    id: string;
    code: string;
    hostId: string;
    players: Player[];
    teams: Team[];
    settings: GameSettings;
    gamePhase: GamePhase;
    createdAt: number;
}
export interface ServerGameState {
    roomId: string;
    phase: GamePhase;
    settings: GameSettings;
    /** All 52 cards, keyed by ID */
    allCards: Map<string, Card>;
    /** Card IDs in the draw pile (top of array = top of pile) */
    drawPile: string[];
    /** Card IDs in the discard pile (last element = top/newest) */
    discardPile: string[];
    playerStates: Map<string, PlayerGameState>;
    turnOrder: string[];
    activePlayerId: string;
    activePlayerIndex: number;
    teamStates: Map<string, TeamGameState>;
    teamTurnOrder: string[];
    activeTeamId?: string;
    activeTeamIndex: number;
    turnNumber: number;
    /** The card currently drawn (in TEMPORARY zone) */
    drawnCardId?: string;
    /** Current special action being resolved */
    currentSpecialAction?: {
        type: SpecialPowerType;
        phase: SpecialActionPhase;
        triggerPlayerId: string;
        selectedCardId?: string;
        selectedOwnCardId?: string;
        selectedOtherCardId?: string;
        targetPlayerId?: string;
        targetTeamId?: string;
        expiresAt?: number;
    };
    xReactionState?: {
        triggerCardId: string;
        windowStartedAt: number;
        windowEndsAt: number;
        reactions: XReaction[];
        resolved: boolean;
    };
    panduState?: {
        callerPlayerId: string;
        callerTeamId?: string;
        calledAt: number;
        remainingTurns: string[];
        finalTurnPlayerId: string;
    };
    finishedOrder: string[];
    nextFinishRank: number;
    currentTimer?: {
        type: string;
        startsAt: number;
        endsAt: number;
    };
    previousWinnerIds?: string[];
}
/** An X reaction attempt from a player */
export interface XReaction {
    playerId: string;
    teamId?: string;
    cardId: string;
    timestamp: number;
    /** Server-assigned order (hrtime precision) */
    serverOrder: number;
}
export interface ClientGameState {
    phase: GamePhase;
    settings: GameSettings;
    drawPileCount: number;
    /** Top 2 discarded cards (visible to all) */
    visibleDiscards: ClientCard[];
    myHand: (ClientCard | null)[];
    myTeamHand?: (ClientCard | null)[];
    opponents: ClientOpponent[];
    turnNumber: number;
    activePlayerId: string;
    activeTeamId?: string;
    isMyTurn: boolean;
    drawnCard?: ClientCard;
    specialAction?: {
        type: SpecialPowerType;
        phase: SpecialActionPhase;
        message?: string;
        /** The revealed card (only if player is authorized to see it) */
        revealedCard?: ClientCard;
    };
    xReaction?: {
        isActive: boolean;
        timeRemainingMs: number;
        reactions?: ClientXReaction[];
    };
    panduState?: {
        callerName: string;
        remainingTurnNames: string[];
    };
    timer?: {
        type: string;
        endsAt: number;
        durationMs: number;
    };
    scores?: PlayerScore[];
    finishedPlayers: string[];
}
export interface ClientOpponent {
    playerId: string;
    name: string;
    avatarId: number;
    cardCount: number;
    cards: (ClientCard | null)[];
    isActive: boolean;
    isConnected: boolean;
    isEliminated: boolean;
    teamId?: string;
    teamName?: string;
}
export interface ClientXReaction {
    playerName?: string;
    playerId: string;
    cardId?: string;
    isWinner?: boolean;
    isValid?: boolean;
    timestamp?: number;
    card?: ClientCard;
    cardRevealed?: ClientCard;
    receivedPenalty?: boolean;
}
export interface PlayerScore {
    playerId: string;
    playerName: string;
    avatarId: number;
    teamId?: string;
    teamName?: string;
    score: number;
    rank: number;
    cards: ClientCard[];
    calledPandu: boolean;
}
export declare enum GameEventType {
    PLAYER_JOINED = "PLAYER_JOINED",
    PLAYER_LEFT = "PLAYER_LEFT",
    PLAYER_DISCONNECTED = "PLAYER_DISCONNECTED",
    PLAYER_RECONNECTED = "PLAYER_RECONNECTED",
    GAME_STARTED = "GAME_STARTED",
    CARDS_DEALT = "CARDS_DEALT",
    CARD_DRAWN = "CARD_DRAWN",
    CARD_DISCARDED = "CARD_DISCARDED",
    CARD_REPLACED = "CARD_REPLACED",
    SPECIAL_TRIGGERED = "SPECIAL_TRIGGERED",
    CARD_PEEKED = "CARD_PEEKED",
    QUEEN_EXCHANGE = "QUEEN_EXCHANGE",
    X_REACTION_ATTEMPT = "X_REACTION_ATTEMPT",
    X_REACTION_RESOLVED = "X_REACTION_RESOLVED",
    PENALTY_DEALT = "PENALTY_DEALT",
    PANDU_CALLED = "PANDU_CALLED",
    TURN_CHANGED = "TURN_CHANGED",
    PLAYER_ELIMINATED = "PLAYER_ELIMINATED",
    TEAM_ELIMINATED = "TEAM_ELIMINATED",
    GAME_ENDED = "GAME_ENDED",
    REMATCH_STARTED = "REMATCH_STARTED"
}
export interface GameEvent {
    type: GameEventType;
    timestamp: number;
    roomId: string;
    data: Record<string, unknown>;
}
//# sourceMappingURL=types.d.ts.map