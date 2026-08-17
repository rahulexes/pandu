import { SpecialPowerType } from '@pandu/shared';
import type { Card } from '@pandu/shared';
/**
 * Determine which special power a discarded card triggers.
 */
export declare function getSpecialPower(card: Card): SpecialPowerType;
/**
 * Validate that a player can peek at a specific card during self-peek (7/8).
 */
export declare function validateSelfPeek(playerId: string, cardId: string, playerHand: (string | null)[]): {
    valid: boolean;
    error?: string;
};
/**
 * Validate that a player can peek at another player's card (9/10).
 */
export declare function validateOtherPeek(activePlayerId: string, targetPlayerId: string, cardId: string, targetPlayerHand: (string | null)[]): {
    valid: boolean;
    error?: string;
};
/**
 * Validate blind exchange card selections (Q).
 */
export declare function validateExchangeOwnCard(playerId: string, cardId: string, playerHand: (string | null)[]): {
    valid: boolean;
    error?: string;
};
export declare function validateExchangeOtherCard(activePlayerId: string, targetPlayerId: string, cardId: string, targetPlayerHand: (string | null)[]): {
    valid: boolean;
    error?: string;
};
/**
 * Execute a blind exchange: swap two cards between hands.
 * Both cards remain hidden — neither player sees the ranks.
 * Returns the updated hands.
 */
export declare function executeBlindExchange(ownHand: (string | null)[], ownCardId: string, otherHand: (string | null)[], otherCardId: string): {
    ownHand: (string | null)[];
    otherHand: (string | null)[];
};
/**
 * Get the display message for a special power.
 */
export declare function getSpecialPowerMessage(type: SpecialPowerType): string;
