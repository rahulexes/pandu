// ============================================================
// PANDU — X Reaction System
// ============================================================
export function openReactionWindow(triggerCardId, durationMs = 3000) {
    const now = Date.now();
    return {
        triggerCardId,
        openedAt: now,
        windowEndsAt: now + durationMs,
        reactions: new Map(),
        resolved: false,
    };
}
export function registerReaction(window, playerId, cardId, playerHand) {
    if (window.resolved) {
        return { valid: false, error: 'X reaction window has closed' };
    }
    if (Date.now() > window.windowEndsAt) {
        return { valid: false, error: 'X reaction time expired' };
    }
    if (window.reactions.has(playerId)) {
        return { valid: false, error: 'Already submitted an X reaction' };
    }
    if (!playerHand.includes(cardId)) {
        return { valid: false, error: 'Card not in hand' };
    }
    window.reactions.set(playerId, {
        cardId,
        timestamp: Date.now(),
    });
    return { valid: true };
}
export function resolveReactions(window, getCard) {
    window.resolved = true;
    const triggerCard = getCard(window.triggerCardId);
    const triggerRank = triggerCard?.rank;
    const sortedReactions = Array.from(window.reactions.entries())
        .map(([playerId, { cardId, timestamp }]) => {
        const card = getCard(cardId);
        const isJack = card?.rank === 'J';
        const isMatchingRank = card && triggerRank && card.rank === triggerRank;
        const isValid = isJack || isMatchingRank;
        return {
            playerId,
            cardId,
            timestamp,
            isValid: !!isValid,
            card: card ? { id: card.id, rank: card.rank, suit: card.suit, faceUp: true } : undefined,
        };
    })
        .sort((a, b) => a.timestamp - b.timestamp);
    const firstValid = sortedReactions.find(r => r.isValid);
    const penalizedPlayers = new Set();
    for (const r of sortedReactions) {
        if (!r.isValid) {
            penalizedPlayers.add(r.playerId);
        }
    }
    const winner = firstValid
        ? { playerId: firstValid.playerId, cardId: firstValid.cardId }
        : undefined;
    const summary = sortedReactions.map(r => ({
        playerId: r.playerId,
        cardId: r.cardId,
        isValid: r.isValid,
        timestamp: r.timestamp,
        card: r.card,
    }));
    return {
        winner,
        penalties: Array.from(penalizedPlayers),
        summary,
    };
}
//# sourceMappingURL=XReactionSystem.js.map