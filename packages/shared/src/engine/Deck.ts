// ============================================================
// PANDU — Deck System
// ============================================================

import { RANKS, SUITS, DECK_SIZE } from '../constants';
import type { Card, Rank, Suit } from '../types';

export function makeCardId(suit: Suit, rank: Rank): string {
  return `${suit}-${rank}`;
}

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

export function createDeckWithQueenConfig(queenCount: number): Card[] {
  return createDeck();
}

/**
 * Universal Fisher-Yates shuffle using cryptographically secure randomness.
 * Works natively in browser (crypto.getRandomValues) and Node.js.
 */
export function shuffleDeck(cards: string[]): string[] {
  for (let i = cards.length - 1; i > 0; i--) {
    let rand = 0;
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
      const arr = new Uint32Array(1);
      globalThis.crypto.getRandomValues(arr);
      rand = arr[0];
    } else {
      rand = Math.floor(Math.random() * 0xffffffff);
    }
    const j = rand % (i + 1);
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export function dealCards(
  drawPile: string[],
  playerIds: string[],
  cardsPerPlayer: number
): { hands: Map<string, string[]>; remainingDrawPile: string[] } {
  const hands = new Map<string, string[]>();

  for (const playerId of playerIds) {
    hands.set(playerId, []);
  }

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

export function drawFromPile(drawPile: string[]): string | null {
  if (drawPile.length === 0) {
    return null;
  }
  return drawPile.pop()!;
}

export function addToDiscardPile(discardPile: string[], cardId: string): void {
  discardPile.push(cardId);
}

export function recycleDiscardPile(discardPile: string[]): {
  newDrawPile: string[];
  remainingDiscards: string[];
} {
  if (discardPile.length <= 2) {
    return { newDrawPile: [], remainingDiscards: [...discardPile] };
  }

  const top2 = discardPile.slice(-2);
  const toRecycle = discardPile.slice(0, -2);
  const newDrawPile = shuffleDeck([...toRecycle]);

  return { newDrawPile, remainingDiscards: top2 };
}

export function getVisibleDiscards(discardPile: string[], count: number = 2): string[] {
  if (discardPile.length === 0) return [];
  if (discardPile.length === 1) return [discardPile[0]];
  return discardPile.slice(-count);
}

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
