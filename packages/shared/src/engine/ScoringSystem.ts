// ============================================================
// PANDU — Scoring System
// ============================================================

import { CARD_SCORES } from '../constants';
import type { Card, PlayerScore } from '../types';

export function getCardScore(card: Card): number {
  return CARD_SCORES[card.rank] ?? 0;
}

export function calculateHandScore(cards: Card[]): number {
  return cards.reduce((sum, card) => sum + getCardScore(card), 0);
}

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

export function calculateFinalScores(players: PlayerScoreInput[]): PlayerScore[] {
  const scoredPlayers = players.map(p => {
    const handCards = p.cards.map(c => ({
      id: c.id,
      rank: c.rank,
      suit: c.suit,
      faceUp: true,
    }));

    return {
      playerId: p.playerId,
      playerName: p.playerName,
      avatarId: p.avatarId,
      teamId: p.teamId,
      teamName: p.teamName,
      score: calculateHandScore(p.cards),
      cards: handCards,
      calledPandu: p.calledPandu || false,
      preAssignedRank: p.preAssignedRank,
    };
  });

  scoredPlayers.sort((a, b) => {
    if (a.preAssignedRank !== undefined && b.preAssignedRank !== undefined) {
      return a.preAssignedRank - b.preAssignedRank;
    }
    if (a.preAssignedRank !== undefined) return -1;
    if (b.preAssignedRank !== undefined) return 1;
    return a.score - b.score;
  });

  const results: PlayerScore[] = [];
  let currentRank = 1;

  for (let i = 0; i < scoredPlayers.length; i++) {
    const current = scoredPlayers[i];

    if (i > 0) {
      const prev = scoredPlayers[i - 1];
      if (
        current.preAssignedRank !== undefined &&
        prev.preAssignedRank !== undefined &&
        current.preAssignedRank === prev.preAssignedRank
      ) {
        // Same rank
      } else if (
        current.preAssignedRank === undefined &&
        prev.preAssignedRank === undefined &&
        current.score === prev.score
      ) {
        // Same rank
      } else {
        currentRank = i + 1;
      }
    }

    results.push({
      playerId: current.playerId,
      playerName: current.playerName,
      avatarId: current.avatarId,
      teamId: current.teamId,
      teamName: current.teamName,
      score: current.score,
      rank: current.preAssignedRank ?? currentRank,
      cards: current.cards,
      calledPandu: current.calledPandu,
    });
  }

  return results;
}

export function getRematchStartingPlayer(previousScores: PlayerScore[]): string {
  if (previousScores.length === 0) return '';
  const winner = previousScores.find(s => s.rank === 1) || previousScores[0];
  return winner.playerId;
}
