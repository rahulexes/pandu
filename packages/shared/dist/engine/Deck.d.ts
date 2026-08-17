import type { Card, Rank, Suit } from '../types';
export declare function makeCardId(suit: Suit, rank: Rank): string;
export declare function createDeck(): Card[];
export declare function createDeckWithQueenConfig(queenCount: number): Card[];
/**
 * Universal Fisher-Yates shuffle using cryptographically secure randomness.
 * Works natively in browser (crypto.getRandomValues) and Node.js.
 */
export declare function shuffleDeck(cards: string[]): string[];
export declare function dealCards(drawPile: string[], playerIds: string[], cardsPerPlayer: number): {
    hands: Map<string, string[]>;
    remainingDrawPile: string[];
};
export declare function drawFromPile(drawPile: string[]): string | null;
export declare function addToDiscardPile(discardPile: string[], cardId: string): void;
export declare function recycleDiscardPile(discardPile: string[]): {
    newDrawPile: string[];
    remainingDiscards: string[];
};
export declare function getVisibleDiscards(discardPile: string[], count?: number): string[];
export declare function validateCardInvariant(drawPile: string[], discardPile: string[], playerHands: Map<string, string[]>, temporaryCards?: string[]): {
    valid: boolean;
    error?: string;
    totalCount: number;
};
//# sourceMappingURL=Deck.d.ts.map