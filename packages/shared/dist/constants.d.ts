/** Standard card ranks */
export declare const RANKS: readonly ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
/** Standard suits */
export declare const SUITS: readonly ["hearts", "diamonds", "clubs", "spades"];
/** Total cards in a standard deck */
export declare const DECK_SIZE = 52;
/** Card scoring values */
export declare const CARD_SCORES: Record<string, number>;
/**
 * The "X card" — the special reaction rank.
 * When this rank is discarded, any player can attempt a fast reaction.
 * Mapped to Jack (J) as it's the only rank without another special power.
 */
export declare const X_CARD_RANK = "J";
/** Ranks that trigger "look at your own card" */
export declare const SELF_PEEK_RANKS: readonly ["7", "8"];
/** Ranks that trigger "look at another player's card" */
export declare const OTHER_PEEK_RANKS: readonly ["9", "10"];
/** Rank that triggers "blind card exchange" */
export declare const EXCHANGE_RANK = "Q";
/** Initial card viewing phase duration */
export declare const INITIAL_VIEW_DURATION_MS = 30000;
/** Special card inspection duration (7/8 and 9/10 peek) */
export declare const PEEK_DURATION_MS = 5000;
/** X reaction window duration */
export declare const X_REACTION_WINDOW_MS = 3000;
/** Reconnection grace period */
export declare const RECONNECT_GRACE_MS = 120000;
/** Maximum players in Individual Mode */
export declare const MAX_PLAYERS_INDIVIDUAL = 8;
/** Minimum players to start a game */
export declare const MIN_PLAYERS = 2;
/** Maximum teams in Team Mode */
export declare const MAX_TEAMS = 4;
/** Maximum players per team */
export declare const MAX_PLAYERS_PER_TEAM = 4;
/** Room code length */
export declare const ROOM_CODE_LENGTH = 6;
/** Default cards dealt per player/team */
export declare const DEFAULT_CARDS_DEALT = 4;
/** Default initial viewable cards */
export declare const DEFAULT_INITIAL_VIEWABLE = 2;
/** Default number of queens (Team Mode) */
export declare const DEFAULT_QUEEN_COUNT = 4;
//# sourceMappingURL=constants.d.ts.map