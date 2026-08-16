// ============================================================
// PANDU — Scoring System
// ============================================================
// Calculates final scores and rankings.

import { CARD_SCORES } from '@pandu/shared';
import type { Card, PlayerScore, ClientCard } from '@pandu/shared';

/**
 * Calculate the score for a set of cards.
 * K = 0, A = 1, 2-10 = face value, J = 11, Q = 12
 */
export function calculateHandScore(cards: Card[]): number {
  return cards.reduce((total, card) => {
    return total + (CARD_SCORES[card.rank] ?? 0);
  }, 0);
}

/**
 * Calculate scores and rankings for all players/teams.
 * Returns sorted array (lowest score first = best rank).
 */
export function calculateFinalScores(
  playerData: {
    playerId: string;
    playerName: string;
    avatarId: number;
    teamId?: string;
    teamName?: string;
    cards: Card[];
    calledPandu: boolean;
    /** Pre-assigned finish rank (for early elimination/zero-card finish) */
    preAssignedRank?: number;
  }[],
): PlayerScore[] {
  // Calculate raw scores
  const scored = playerData.map(p => ({
    ...p,
    score: calculateHandScore(p.cards),
    clientCards: p.cards.map(c => ({
      id: c.id,
      rank: c.rank,
      suit: c.suit,
      faceUp: true,
    } as ClientCard)),
  }));

  // Sort by pre-assigned rank first (eliminated players who finished early),
  // then by score (ascending)
  scored.sort((a, b) => {
    // Players with pre-assigned ranks come first (they finished earlier)
    if (a.preAssignedRank !== undefined && b.preAssignedRank !== undefined) {
      return a.preAssignedRank - b.preAssignedRank;
    }
    if (a.preAssignedRank !== undefined) return -1;
    if (b.preAssignedRank !== undefined) return 1;

    return a.score - b.score;
  });

  // Assign ranks (handle ties)
  const results: PlayerScore[] = [];
  let currentRank = 1;

  for (let i = 0; i < scored.length; i++) {
    const player = scored[i];

    if (player.preAssignedRank !== undefined) {
      results.push({
        playerId: player.playerId,
        playerName: player.playerName,
        avatarId: player.avatarId,
        teamId: player.teamId,
        teamName: player.teamName,
        score: player.score,
        rank: player.preAssignedRank,
        cards: player.clientCards,
        calledPandu: player.calledPandu,
      });
      continue;
    }

    // For unranked players, calculate rank based on score
    if (i > 0 && scored[i - 1].preAssignedRank === undefined && player.score === scored[i - 1].score) {
      // Same score as previous = same rank (tie)
    } else {
      currentRank = results.filter(r => r.rank !== undefined).length + 1;
    }

    results.push({
      playerId: player.playerId,
      playerName: player.playerName,
      avatarId: player.avatarId,
      teamId: player.teamId,
      teamName: player.teamName,
      score: player.score,
      rank: currentRank,
      cards: player.clientCards,
      calledPandu: player.calledPandu,
    });
  }

  return results;
}

/**
 * Determine the first player for a rematch based on previous game results.
 * The player/team who finished first gets the first turn.
 * If tied, randomly select from tied players.
 */
export function getRematchStartingPlayer(previousScores: PlayerScore[]): string {
  if (previousScores.length === 0) {
    throw new Error('No previous scores to determine starting player');
  }

  // Find all players with rank 1
  const firstPlacers = previousScores.filter(s => s.rank === 1);

  if (firstPlacers.length === 1) {
    return firstPlacers[0].playerId;
  }

  // Random selection among tied first-place players
  const randomIndex = Math.floor(Math.random() * firstPlacers.length);
  return firstPlacers[randomIndex].playerId;
}
