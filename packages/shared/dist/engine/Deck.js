// ============================================================
// PANDU — Deck System
// ============================================================
import { RANKS, SUITS, DECK_SIZE } from '../constants';
export function makeCardId(suit, rank) {
    return `${suit}-${rank}`;
}
export function createDeck() {
    const cards = [];
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
export function createDeckWithQueenConfig(queenCount) {
    return createDeck();
}
/**
 * Universal Fisher-Yates shuffle using cryptographically secure randomness.
 * Works natively in browser (crypto.getRandomValues) and Node.js.
 */
export function shuffleDeck(cards) {
    for (let i = cards.length - 1; i > 0; i--) {
        let rand = 0;
        if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
            const arr = new Uint32Array(1);
            globalThis.crypto.getRandomValues(arr);
            rand = arr[0];
        }
        else {
            rand = Math.floor(Math.random() * 0xffffffff);
        }
        const j = rand % (i + 1);
        [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
}
export function dealCards(drawPile, playerIds, cardsPerPlayer) {
    const hands = new Map();
    for (const playerId of playerIds) {
        hands.set(playerId, []);
    }
    for (let round = 0; round < cardsPerPlayer; round++) {
        for (const playerId of playerIds) {
            if (drawPile.length === 0) {
                throw new Error('Not enough cards in draw pile to deal');
            }
            const cardId = drawPile.pop();
            hands.get(playerId).push(cardId);
        }
    }
    return { hands, remainingDrawPile: drawPile };
}
export function drawFromPile(drawPile) {
    if (drawPile.length === 0) {
        return null;
    }
    return drawPile.pop();
}
export function addToDiscardPile(discardPile, cardId) {
    discardPile.push(cardId);
}
export function recycleDiscardPile(discardPile) {
    if (discardPile.length <= 2) {
        return { newDrawPile: [], remainingDiscards: [...discardPile] };
    }
    const top2 = discardPile.slice(-2);
    const toRecycle = discardPile.slice(0, -2);
    const newDrawPile = shuffleDeck([...toRecycle]);
    return { newDrawPile, remainingDiscards: top2 };
}
export function getVisibleDiscards(discardPile, count = 2) {
    if (discardPile.length === 0)
        return [];
    if (discardPile.length === 1)
        return [discardPile[0]];
    return discardPile.slice(-count);
}
export function validateCardInvariant(drawPile, discardPile, playerHands, temporaryCards = []) {
    const allCardIds = new Set();
    const duplicates = [];
    const addCard = (id, zone) => {
        if (allCardIds.has(id)) {
            duplicates.push(`${id} (duplicate in ${zone})`);
        }
        allCardIds.add(id);
    };
    for (const id of drawPile)
        addCard(id, 'drawPile');
    for (const id of discardPile)
        addCard(id, 'discardPile');
    for (const [playerId, hand] of playerHands) {
        for (const id of hand)
            addCard(id, `hand:${playerId}`);
    }
    for (const id of temporaryCards)
        addCard(id, 'temporary');
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
//# sourceMappingURL=Deck.js.map