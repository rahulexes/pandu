import type { Card, Rank, Suit } from '@pandu/shared';
/**
 * Creates a unique card ID from rank and suit.
 */
export declare function makeCardId(suit: Suit, rank: Rank): string;
/**
 * Creates a fresh 52-card deck.
 */
export declare function createDeck(): Card[];
/**
 * Creates a deck with a custom queen count (for Team Mode).
 * Removes queens beyond the desired count and replaces them
 * with extra cards from a conceptual pool — but since we must
 * stay at 52 cards with unique identities, we simply mark
 * which queens are active. For simplicity, we always use all 52
 * cards but the queen COUNT affects PANDU endgame behavior only.
 */
export declare function createDeckWithQueenConfig(queenCount: number): Card[];
/**
 * Fisher-Yates shuffle using cryptographically secure randomness.
 * Shuffles in-place and returns the array.
 */
export declare function shuffleDeck(cards: string[]): string[];
/**
 * Deals cards from the draw pile to players/teams.
 * Returns a map of playerId → card IDs dealt.
 */
export declare function dealCards(drawPile: string[], playerIds: string[], cardsPerPlayer: number): {
    hands: Map<string, string[]>;
    remainingDrawPile: string[];
};
/**
 * Draws the top card from the draw pile.
 * Returns the card ID or null if the pile is empty.
 */
export declare function drawFromPile(drawPile: string[]): string | null;
/**
 * Adds a card to the top of the discard pile.
 */
export declare function addToDiscardPile(discardPile: string[], cardId: string): void;
/**
 * Recycles the discard pile when the draw pile is empty.
 * Keeps the top 2 discarded cards in place.
 * Shuffles the rest and returns them as the new draw pile.
 *
 * Returns the new draw pile card IDs.
 */
export declare function recycleDiscardPile(discardPile: string[]): {
    newDrawPile: string[];
    remainingDiscards: string[];
};
/**
 * Gets the top N visible cards from the discard pile.
 * The discard pile shows the top 2 cards face-up.
 */
export declare function getVisibleDiscards(discardPile: string[], count?: number): string[];
/**
 * Validates that exactly 52 unique cards exist across all zones.
 */
export declare function validateCardInvariant(drawPile: string[], discardPile: string[], playerHands: Map<string, string[]>, temporaryCards?: string[]): {
    valid: boolean;
    error?: string;
    totalCount: number;
};
