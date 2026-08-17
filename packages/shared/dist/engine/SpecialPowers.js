import { SpecialPowerType } from '../gameStates';
export function getSpecialPower(card) {
    switch (card.rank) {
        case '7':
        case '8':
            return SpecialPowerType.SELF_PEEK;
        case '9':
        case '10':
            return SpecialPowerType.OTHER_PEEK;
        case 'Q':
            return SpecialPowerType.BLIND_EXCHANGE;
        default:
            return SpecialPowerType.NONE;
    }
}
export function validateSelfPeek(playerId, cardId, hand) {
    if (!hand.includes(cardId)) {
        return { valid: false, error: 'Selected card is not in your hand' };
    }
    return { valid: true };
}
export function validateOtherPeek(playerId, targetPlayerId, cardId, targetHand) {
    if (playerId === targetPlayerId) {
        return { valid: false, error: 'Cannot target your own cards with this power' };
    }
    if (!targetHand.includes(cardId)) {
        return { valid: false, error: 'Selected card is not in the target player\'s hand' };
    }
    return { valid: true };
}
export function validateExchangeOwnCard(playerId, cardId, ownHand) {
    if (!ownHand.includes(cardId)) {
        return { valid: false, error: 'Selected card is not in your hand' };
    }
    return { valid: true };
}
export function validateExchangeOtherCard(playerId, targetPlayerId, cardId, targetHand) {
    if (playerId === targetPlayerId) {
        return { valid: false, error: 'Cannot exchange with yourself' };
    }
    if (!targetHand.includes(cardId)) {
        return { valid: false, error: 'Selected card is not in the target player\'s hand' };
    }
    return { valid: true };
}
export function executeBlindExchange(ownHand, ownCardId, otherHand, otherCardId) {
    const ownIndex = ownHand.indexOf(ownCardId);
    const otherIndex = otherHand.indexOf(otherCardId);
    if (ownIndex === -1 || otherIndex === -1) {
        throw new Error('Card not found in hand during exchange');
    }
    const newOwnHand = [...ownHand];
    const newOtherHand = [...otherHand];
    newOwnHand[ownIndex] = otherCardId;
    newOtherHand[otherIndex] = ownCardId;
    return { ownHand: newOwnHand, otherHand: newOtherHand };
}
export function getSpecialPowerMessage(type) {
    switch (type) {
        case SpecialPowerType.SELF_PEEK:
            return 'Peek at one of your own cards (5s)';
        case SpecialPowerType.OTHER_PEEK:
            return 'Peek at any other player\'s card (5s)';
        case SpecialPowerType.BLIND_EXCHANGE:
            return 'Blind Exchange: Swap one of your cards with another player\'s card';
        case SpecialPowerType.X_REACTION:
            return 'Fast discard active! Match the top discard card!';
        default:
            return '';
    }
}
//# sourceMappingURL=SpecialPowers.js.map