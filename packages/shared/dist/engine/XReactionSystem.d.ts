import type { Card, ClientXReaction } from '../types';
export interface XReactionWindow {
    triggerCardId: string;
    openedAt: number;
    windowEndsAt: number;
    reactions: Map<string, {
        cardId: string;
        timestamp: number;
    }>;
    resolved: boolean;
}
export declare function openReactionWindow(triggerCardId: string, durationMs?: number): XReactionWindow;
export declare function registerReaction(window: XReactionWindow, playerId: string, cardId: string, playerHand: string[]): {
    valid: boolean;
    error?: string;
};
export interface XReactionResult {
    winner?: {
        playerId: string;
        cardId: string;
    };
    penalties: string[];
    summary: ClientXReaction[];
}
export declare function resolveReactions(window: XReactionWindow, getCard: (cardId: string) => Card | undefined): XReactionResult;
//# sourceMappingURL=XReactionSystem.d.ts.map