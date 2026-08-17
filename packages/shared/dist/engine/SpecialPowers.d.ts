import { SpecialPowerType } from '../gameStates';
import type { Card } from '../types';
export declare function getSpecialPower(card: Card): SpecialPowerType;
export declare function validateSelfPeek(playerId: string, cardId: string, hand: (string | null)[]): {
    valid: boolean;
    error?: string;
};
export declare function validateOtherPeek(playerId: string, targetPlayerId: string, cardId: string, targetHand: (string | null)[]): {
    valid: boolean;
    error?: string;
};
export declare function validateExchangeOwnCard(playerId: string, cardId: string, ownHand: (string | null)[]): {
    valid: boolean;
    error?: string;
};
export declare function validateExchangeOtherCard(playerId: string, targetPlayerId: string, cardId: string, targetHand: (string | null)[]): {
    valid: boolean;
    error?: string;
};
export declare function executeBlindExchange(ownHand: (string | null)[], ownCardId: string, otherHand: (string | null)[], otherCardId: string): {
    ownHand: (string | null)[];
    otherHand: (string | null)[];
};
export declare function getSpecialPowerMessage(type: SpecialPowerType): string;
//# sourceMappingURL=SpecialPowers.d.ts.map