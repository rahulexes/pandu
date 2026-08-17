import type { Card, PlayerScore } from '@pandu/shared';
/**
 * Calculate the score for a set of cards.
 * K = 0, A = 1, 2-10 = face value, J = 11, Q = 12
 */
export declare function calculateHandScore(cards: Card[]): number;
/**
 * Calculate scores and rankings for all players/teams.
 * Returns sorted array (lowest score first = best rank).
 */
export declare function calculateFinalScores(playerData: {
    playerId: string;
    playerName: string;
    avatarId: number;
    teamId?: string;
    teamName?: string;
    cards: Card[];
    calledPandu: boolean;
    /** Pre-assigned finish rank (for early elimination/zero-card finish) */
    preAssignedRank?: number;
}[]): PlayerScore[];
/**
 * Determine the first player for a rematch based on previous game results.
 * The player/team who finished first gets the first turn.
 * If tied, randomly select from tied players.
 */
export declare function getRematchStartingPlayer(previousScores: PlayerScore[]): string;
