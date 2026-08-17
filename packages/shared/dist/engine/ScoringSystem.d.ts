import type { Card, PlayerScore } from '../types';
export declare function getCardScore(card: Card): number;
export declare function calculateHandScore(cards: Card[]): number;
export interface PlayerScoreInput {
    playerId: string;
    playerName: string;
    avatarId: number;
    teamId?: string;
    teamName?: string;
    cards: Card[];
    calledPandu?: boolean;
    preAssignedRank?: number;
}
export declare function calculateFinalScores(players: PlayerScoreInput[]): PlayerScore[];
export declare function getRematchStartingPlayer(previousScores: PlayerScore[]): string;
//# sourceMappingURL=ScoringSystem.d.ts.map