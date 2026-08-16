// ============================================================
// PANDU — Shared Constants
// ============================================================

/** Standard card ranks */
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

/** Standard suits */
export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;

/** Total cards in a standard deck */
export const DECK_SIZE = 52;

/** Card scoring values */
export const CARD_SCORES: Record<string, number> = {
  'A': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  'J': 11,
  'Q': 12,
  'K': 0,
};

/**
 * The "X card" — the special reaction rank.
 * When this rank is discarded, any player can attempt a fast reaction.
 * Mapped to Jack (J) as it's the only rank without another special power.
 */
export const X_CARD_RANK = 'J';

/** Ranks that trigger "look at your own card" */
export const SELF_PEEK_RANKS = ['7', '8'] as const;

/** Ranks that trigger "look at another player's card" */
export const OTHER_PEEK_RANKS = ['9', '10'] as const;

/** Rank that triggers "blind card exchange" */
export const EXCHANGE_RANK = 'Q';

// ── Timer Durations (milliseconds) ──────────────────────────

/** Initial card viewing phase duration */
export const INITIAL_VIEW_DURATION_MS = 30_000;

/** Special card inspection duration (7/8 and 9/10 peek) */
export const PEEK_DURATION_MS = 5_000;

/** X reaction window duration */
export const X_REACTION_WINDOW_MS = 3_000;

/** Reconnection grace period */
export const RECONNECT_GRACE_MS = 120_000;

// ── Limits ──────────────────────────────────────────────────

/** Maximum players in Individual Mode */
export const MAX_PLAYERS_INDIVIDUAL = 8;

/** Minimum players to start a game */
export const MIN_PLAYERS = 2;

/** Maximum teams in Team Mode */
export const MAX_TEAMS = 4;

/** Maximum players per team */
export const MAX_PLAYERS_PER_TEAM = 4;

/** Room code length */
export const ROOM_CODE_LENGTH = 6;

/** Default cards dealt per player/team */
export const DEFAULT_CARDS_DEALT = 4;

/** Default initial viewable cards */
export const DEFAULT_INITIAL_VIEWABLE = 2;

/** Default number of queens (Team Mode) */
export const DEFAULT_QUEEN_COUNT = 4;
