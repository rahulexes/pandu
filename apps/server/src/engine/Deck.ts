// ============================================================
// PANDU — Deck System
// ============================================================
// Manages the 52-card deck: creation, shuffling, dealing,
// card zone tracking, and discard pile recycling.
// All operations maintain the invariant: exactly 52 cards exist.

import { RANKS, SUITS, DECK_SIZE } from '@pandu/shared';
import type { Card, Rank, Suit } from '@pandu/shared';
import crypto from 'crypto';

/**
 * Creates a unique card ID from rank and suit.
 */
export function makeCardId(suit: Suit, rank: Rank): string {
  return `${suit}-${rank}`;
}

/**
 * Creates a fresh 52-card deck.
 */
export function createDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({
        id: makeCardId(suit, rank),
        rank,
        suit,
      });
    }
  }
  return cards;
}

/**
 * Creates a deck with a custom queen count (for Team Mode).
 * Removes queens beyond the desired count and replaces them
 * with extra cards from a conceptual pool — but since we must
 * stay at 52 cards with unique identities, we simply mark
 * which queens are active. For simplicity, we always use all 52
 * cards but the queen COUNT affects PANDU endgame behavior only.
 */
export function createDeckWithQueenConfig(queenCount: number): Card[] {
  // Always use the full 52-card deck.
  // The queenCount parameter only affects endgame turn calculation.
  return createDeck();
}

/**
 * Fisher-Yates shuffle using cryptographically secure randomness.
 * Shuffles in-place and returns the array.
 */
export function shuffleDeck(cards: string[]): string[] {
  for (let i = cards.length - 1; i > 0; i--) {
    const randomBytes = crypto.randomBytes(4);
    const j = randomBytes.readUInt32BE(0) % (i + 1);
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

/**
 * Deals cards from the draw pile to players/teams.
 * Returns a map of playerId → card IDs dealt.
 */
export function dealCards(
  drawPile: string[],
  playerIds: string[],
  cardsPerPlayer: number
): { hands: Map<string, string[]>; remainingDrawPile: string[] } {
  const hands = new Map<string, string[]>();

  for (const playerId of playerIds) {
    hands.set(playerId, []);
  }

  // Deal one card at a time to each player, round-robin
  for (let round = 0; round < cardsPerPlayer; round++) {
    for (const playerId of playerIds) {
      if (drawPile.length === 0) {
        throw new Error('Not enough cards in draw pile to deal');
      }
      const cardId = drawPile.pop()!;
      hands.get(playerId)!.push(cardId);
    }
  }

  return { hands, remainingDrawPile: drawPile };
}

/**
 * Draws the top card from the draw pile.
 * Returns the card ID or null if the pile is empty.
 */
export function drawFromPile(drawPile: string[]): string | null {
  if (drawPile.length === 0) {
    return null;
  }
  return drawPile.pop()!;
}

/**
 * Adds a card to the top of the discard pile.
 */
export function addToDiscardPile(discardPile: string[], cardId: string): void {
  discardPile.push(cardId);
}

/**
 * Recycles the discard pile when the draw pile is empty.
 * Keeps the top 2 discarded cards in place.
 * Shuffles the rest and returns them as the new draw pile.
 * 
 * Returns the new draw pile card IDs.
 */
export function recycleDiscardPile(discardPile: string[]): {
  newDrawPile: string[];
  remainingDiscards: string[];
} {
  if (discardPile.length <= 2) {
    // Nothing to recycle — not enough cards below the top 2
    return { newDrawPile: [], remainingDiscards: [...discardPile] };
  }

  // Keep top 2 (last 2 elements)
  const top2 = discardPile.slice(-2);
  // Take everything below the top 2
  const toRecycle = discardPile.slice(0, -2);

  // Shuffle the recycled cards
  const newDrawPile = shuffleDeck([...toRecycle]);

  return { newDrawPile, remainingDiscards: top2 };
}

/**
 * Gets the top N visible cards from the discard pile.
 * The discard pile shows the top 2 cards face-up.
 */
export function getVisibleDiscards(discardPile: string[], count: number = 2): string[] {
  if (discardPile.length === 0) return [];
  if (discardPile.length === 1) return [discardPile[0]];
  return discardPile.slice(-count);
}

/**
 * Validates that exactly 52 unique cards exist across all zones.
 */
export function validateCardInvariant(
  drawPile: string[],
  discardPile: string[],
  playerHands: Map<string, string[]>,
  temporaryCards: string[] = []
): { valid: boolean; error?: string; totalCount: number } {
  const allCardIds = new Set<string>();
  const duplicates: string[] = [];

  const addCard = (id: string, zone: string) => {
    if (allCardIds.has(id)) {
      duplicates.push(`${id} (duplicate in ${zone})`);
    }
    allCardIds.add(id);
  };

  for (const id of drawPile) addCard(id, 'drawPile');
  for (const id of discardPile) addCard(id, 'discardPile');
  for (const [playerId, hand] of playerHands) {
    for (const id of hand) addCard(id, `hand:${playerId}`);
  }
  for (const id of temporaryCards) addCard(id, 'temporary');

  if (duplicates.length > 0) {
    return { valid: false, error: `Duplicate cards: ${duplicates.join(', ')}`, totalCount: allCardIds.size };
  }

  if (allCardIds.size !== DECK_SIZE) {
    return {
      valid: false,
      error: `Expected ${DECK_SIZE} cards, found ${allCardIds.size}`,
      totalCount: allCardIds.size,
    };
  }

  return { valid: true, totalCount: allCardIds.size };
}
