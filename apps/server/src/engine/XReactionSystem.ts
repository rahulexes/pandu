// ============================================================
// PANDU — X Reaction System
// ============================================================
// Handles the instant reaction when a Jack (X card) is discarded.
// Any player can attempt to double-tap one of their cards.
// Server determines the fastest valid reaction.

import { X_CARD_RANK } from '@pandu/shared';
import type { XReaction, Card } from '@pandu/shared';

export interface XReactionWindow {
  triggerCardId: string;
  windowStartedAt: number;
  windowEndsAt: number;
  reactions: XReactionAttempt[];
  resolved: boolean;
}

export interface XReactionAttempt {
  playerId: string;
  teamId?: string;
  cardId: string;
  /** High-resolution server timestamp (from process.hrtime.bigint()) */
  serverTimestamp: bigint;
  /** Monotonic order assigned by server */
  serverOrder: number;
}

/**
 * Open a new X reaction window.
 */
export function openReactionWindow(
  triggerCardId: string,
  durationMs: number,
): XReactionWindow {
  const now = Date.now();
  return {
    triggerCardId,
    windowStartedAt: now,
    windowEndsAt: now + durationMs,
    reactions: [],
    resolved: false,
  };
}

/**
 * Register a player's reaction attempt.
 * Returns false if the window is closed or already resolved.
 */
export function registerReaction(
  window: XReactionWindow,
  playerId: string,
  cardId: string,
  playerHand: string[],
  teamId?: string,
): { accepted: boolean; error?: string } {
  if (window.resolved) {
    return { accepted: false, error: 'The reaction window has closed' };
  }

  if (Date.now() > window.windowEndsAt) {
    return { accepted: false, error: 'The reaction window has expired' };
  }

  // Check that the card belongs to the player
  if (!playerHand.includes(cardId)) {
    return { accepted: false, error: 'That card is not in your hand' };
  }

  // Check if this player already reacted
  if (window.reactions.some(r => r.playerId === playerId)) {
    return { accepted: false, error: 'You have already reacted' };
  }

  window.reactions.push({
    playerId,
    teamId,
    cardId,
    serverTimestamp: process.hrtime.bigint(),
    serverOrder: window.reactions.length,
  });

  return { accepted: true };
}

/**
 * Resolve the X reaction window.
 * Determines the winner and penalties.
 * 
 * Returns:
 * - winner: the reaction that wins (fastest valid X card, or fastest overall if no X)
 * - penalties: player IDs that receive a penalty card
 */
export function resolveReactions(
  window: XReactionWindow,
  getCard: (cardId: string) => Card | undefined,
): XReactionResult {
  window.resolved = true;

  if (window.reactions.length === 0) {
    return { winner: null, penalties: [], allReactions: [] };
  }

  // Sort by server order (which reflects actual arrival order)
  const sorted = [...window.reactions].sort((a, b) => a.serverOrder - b.serverOrder);

  const triggerCard = getCard(window.triggerCardId);

  // Build result for each reaction
  const allReactions: ResolvedReaction[] = sorted.map(r => {
    const card = getCard(r.cardId);
    // A card is a valid X reaction if it matches the trigger card's rank OR is Jack
    const isXCard = card && (card.rank === triggerCard?.rank || card.rank === X_CARD_RANK);
    return {
      playerId: r.playerId,
      teamId: r.teamId,
      cardId: r.cardId,
      isXCard: !!isXCard,
      serverOrder: r.serverOrder,
    };
  });

  // Find the fastest player whose card IS an X card
  const fastestValidX = allReactions.find(r => r.isXCard);

  if (fastestValidX) {
    // Winner is the fastest valid X card
    const penalties = allReactions
      .filter(r => r.playerId !== fastestValidX.playerId)
      .map(r => r.playerId);

    return {
      winner: fastestValidX,
      penalties,
      allReactions,
    };
  }

  // No valid X card was submitted — the fastest player gets penalized
  // All players who reacted get penalized (they all selected wrong cards)
  const penalties = allReactions.map(r => r.playerId);

  return {
    winner: null,
    penalties,
    allReactions,
  };
}

export interface ResolvedReaction {
  playerId: string;
  teamId?: string;
  cardId: string;
  isXCard: boolean;
  serverOrder: number;
}

export interface XReactionResult {
  winner: ResolvedReaction | null;
  penalties: string[];
  allReactions: ResolvedReaction[];
}
