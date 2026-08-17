// ============================================================
// PANDU — Special Powers System
// ============================================================
// Handles special card powers triggered when a card is discarded:
// 7/8 → Self peek, 9/10 → Other peek, Q → Blind exchange, J → X reaction
import { SELF_PEEK_RANKS, OTHER_PEEK_RANKS, EXCHANGE_RANK, SpecialPowerType, } from '@pandu/shared';
/**
 * Determine which special power a discarded card triggers.
 */
export function getSpecialPower(card) {
    if (SELF_PEEK_RANKS.includes(card.rank)) {
        return SpecialPowerType.SELF_PEEK;
    }
    if (OTHER_PEEK_RANKS.includes(card.rank)) {
        return SpecialPowerType.OTHER_PEEK;
    }
    if (card.rank === EXCHANGE_RANK) {
        return SpecialPowerType.BLIND_EXCHANGE;
    }
    // Jack is a wild match card for real-time X-rule fast discard
    return SpecialPowerType.NONE;
}
/**
 * Validate that a player can peek at a specific card during self-peek (7/8).
 */
export function validateSelfPeek(playerId, cardId, playerHand) {
    if (!playerHand.includes(cardId)) {
        return { valid: false, error: 'Card is not in your hand' };
    }
    return { valid: true };
}
/**
 * Validate that a player can peek at another player's card (9/10).
 */
export function validateOtherPeek(activePlayerId, targetPlayerId, cardId, targetPlayerHand) {
    if (activePlayerId === targetPlayerId) {
        return { valid: false, error: 'You cannot peek at your own card with this power' };
    }
    if (!targetPlayerHand.includes(cardId)) {
        return { valid: false, error: 'Card is not in the target player\'s hand' };
    }
    return { valid: true };
}
/**
 * Validate blind exchange card selections (Q).
 */
export function validateExchangeOwnCard(playerId, cardId, playerHand) {
    if (!playerHand.includes(cardId)) {
        return { valid: false, error: 'Selected card is not in your hand' };
    }
    return { valid: true };
}
export function validateExchangeOtherCard(activePlayerId, targetPlayerId, cardId, targetPlayerHand) {
    if (activePlayerId === targetPlayerId) {
        return { valid: false, error: 'You cannot exchange with yourself' };
    }
    if (!targetPlayerHand.includes(cardId)) {
        return { valid: false, error: 'Card is not in the target player\'s hand' };
    }
    return { valid: true };
}
/**
 * Execute a blind exchange: swap two cards between hands.
 * Both cards remain hidden — neither player sees the ranks.
 * Returns the updated hands.
 */
export function executeBlindExchange(ownHand, ownCardId, otherHand, otherCardId) {
    const ownIndex = ownHand.indexOf(ownCardId);
    const otherIndex = otherHand.indexOf(otherCardId);
    if (ownIndex === -1 || otherIndex === -1) {
        return { ownHand, otherHand };
    }
    // Swap the cards
    const newOwnHand = [...ownHand];
    const newOtherHand = [...otherHand];
    newOwnHand[ownIndex] = otherCardId;
    newOtherHand[otherIndex] = ownCardId;
    return { ownHand: newOwnHand, otherHand: newOtherHand };
}
/**
 * Get the display message for a special power.
 */
export function getSpecialPowerMessage(type) {
    switch (type) {
        case SpecialPowerType.SELF_PEEK:
            return 'LOOK AT ONE OF YOUR CARDS';
        case SpecialPowerType.OTHER_PEEK:
            return 'LOOK AT ONE CARD OF ANOTHER PLAYER';
        case SpecialPowerType.BLIND_EXCHANGE:
            return 'EXCHANGE ONE CARD BLINDLY';
        case SpecialPowerType.X_REACTION:
            return 'X REACTION — Any player may react!';
        default:
            return '';
    }
}
//# sourceMappingURL=SpecialPowers.js.map