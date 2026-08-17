import type { Card } from '@pandu/shared';
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
export declare function openReactionWindow(triggerCardId: string, durationMs: number): XReactionWindow;
/**
 * Register a player's reaction attempt.
 * Returns false if the window is closed or already resolved.
 */
export declare function registerReaction(window: XReactionWindow, playerId: string, cardId: string, playerHand: string[], teamId?: string): {
    accepted: boolean;
    error?: string;
};
/**
 * Resolve the X reaction window.
 * Determines the winner and penalties.
 *
 * Returns:
 * - winner: the reaction that wins (fastest valid X card, or fastest overall if no X)
 * - penalties: player IDs that receive a penalty card
 */
export declare function resolveReactions(window: XReactionWindow, getCard: (cardId: string) => Card | undefined): XReactionResult;
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
