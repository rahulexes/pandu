// ============================================================
// PANDU — Server Game Engine Unit & Integration Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  createDeck,
  shuffleDeck,
  dealCards,
  recycleDiscardPile,
  validateCardInvariant,
  getVisibleDiscards,
} from '../src/engine/Deck.js';
import { GameStateMachine } from '../src/engine/GameStateMachine.js';
import { TurnSystem } from '../src/engine/TurnSystem.js';
import {
  getSpecialPower,
  validateSelfPeek,
  validateOtherPeek,
  executeBlindExchange,
} from '../src/engine/SpecialPowers.js';
import {
  openReactionWindow,
  registerReaction,
  resolveReactions,
} from '../src/engine/XReactionSystem.js';
import {
  validatePanduCall,
  getAdditionalTurns,
} from '../src/engine/PanduSystem.js';
import {
  calculateHandScore,
  calculateFinalScores,
} from '../src/engine/ScoringSystem.js';
import {
  GamePhase,
  GameMode,
  SpecialPowerType,
  DECK_SIZE,
} from '@pandu/shared';

describe('Deck System', () => {
  it('creates exactly 52 unique physical cards', () => {
    const deck = createDeck();
    expect(deck.length).toBe(DECK_SIZE);

    const ids = new Set(deck.map((c) => c.id));
    expect(ids.size).toBe(DECK_SIZE);
  });

  it('shuffles without losing or duplicating cards', () => {
    const deck = createDeck();
    const cardIds = deck.map((c) => c.id);
    const shuffled = shuffleDeck([...cardIds]);

    expect(shuffled.length).toBe(DECK_SIZE);
    expect(new Set(shuffled).size).toBe(DECK_SIZE);
  });

  it('deals cards correctly and preserves 52-card invariant', () => {
    const deck = createDeck();
    const cardIds = shuffleDeck(deck.map((c) => c.id));
    const players = ['p1', 'p2', 'p3', 'p4'];
    const cardsPerPlayer = 4;

    const { hands, remainingDrawPile } = dealCards(cardIds, players, cardsPerPlayer);

    expect(hands.size).toBe(4);
    for (const [, hand] of hands) {
      expect(hand.length).toBe(cardsPerPlayer);
    }

    const invariant = validateCardInvariant(remainingDrawPile, [], hands);
    expect(invariant.valid).toBe(true);
    expect(invariant.totalCount).toBe(52);
  });

  it('recycles discard pile preserving the top 2 visible cards', () => {
    const discards = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];
    const { newDrawPile, remainingDiscards } = recycleDiscardPile(discards);

    expect(remainingDiscards).toEqual(['c5', 'c6']);
    expect(newDrawPile.length).toBe(4);
    expect(new Set(newDrawPile)).toEqual(new Set(['c1', 'c2', 'c3', 'c4']));
  });

  it('shows at most the top 2 discarded cards', () => {
    expect(getVisibleDiscards([])).toEqual([]);
    expect(getVisibleDiscards(['cardA'])).toEqual(['cardA']);
    expect(getVisibleDiscards(['cardA', 'cardB', 'cardC'])).toEqual(['cardB', 'cardC']);
  });
});

describe('Game State Machine', () => {
  it('transitions through valid phases and rejects illegal transitions', () => {
    const sm = new GameStateMachine(GamePhase.LOBBY);

    expect(sm.canTransition(GamePhase.READY_CHECK)).toBe(true);
    expect(sm.canTransition(GamePhase.GAME_OVER)).toBe(false);

    sm.transition(GamePhase.READY_CHECK);
    expect(sm.currentPhase).toBe(GamePhase.READY_CHECK);

    sm.transition(GamePhase.SHUFFLING);
    sm.transition(GamePhase.DEALING);
    sm.transition(GamePhase.INITIAL_VIEW);
    sm.transition(GamePhase.PLAYER_TURN);
    expect(sm.currentPhase).toBe(GamePhase.PLAYER_TURN);

    expect(() => sm.transition(GamePhase.LOBBY)).toThrow();
  });
});

describe('Turn System', () => {
  it('rotates turns correctly in Individual Mode', () => {
    const turns = new TurnSystem({
      mode: GameMode.INDIVIDUAL,
      playerOrder: ['p1', 'p2', 'p3'],
    });

    expect(turns.activePlayerId).toBe('p1');
    expect(turns.advanceTurn()).toBe('p2');
    expect(turns.advanceTurn()).toBe('p3');
    expect(turns.advanceTurn()).toBe('p1');
  });

  it('skips eliminated players in turn rotation', () => {
    const turns = new TurnSystem({
      mode: GameMode.INDIVIDUAL,
      playerOrder: ['p1', 'p2', 'p3'],
    });

    turns.eliminatePlayer('p2');
    expect(turns.activePlayerId).toBe('p1');
    expect(turns.advanceTurn()).toBe('p3');
    expect(turns.advanceTurn()).toBe('p1');
  });

  it('schedules PANDU final turns with caller going last', () => {
    const turns = new TurnSystem({
      mode: GameMode.INDIVIDUAL,
      playerOrder: ['p1', 'p2', 'p3', 'p4'],
    });

    // Advance to P2's turn
    turns.advanceTurn();
    expect(turns.activePlayerId).toBe('p2');

    // P2 calls PANDU during their turn
    turns.setupFinalTurns('p2', 1);
    expect(turns.isInFinalTurns).toBe(true);
    // P2 is STILL the active player until P2 clicks End Turn!
    expect(turns.activePlayerId).toBe('p2');

    // P2 ends their turn -> next is P3, then P4, then P1, then P2's final turn
    expect(turns.advanceTurn()).toBe('p3');
    expect(turns.advanceTurn()).toBe('p4');
    expect(turns.advanceTurn()).toBe('p1');
    expect(turns.advanceTurn()).toBe('p2');
    expect(turns.advanceTurn()).toBe(''); // Finished
    expect(turns.areFinalTurnsComplete()).toBe(true);
  });

  it('handles PANDU final turns in Team Mode: exactly 1 turn for opposing team and 1 final turn for caller team', () => {
    const teamPlayers = new Map<string, string[]>([
      ['team_A', ['p1', 'p2']],
      ['team_B', ['p3', 'p4']],
    ]);

    const turns = new TurnSystem({
      mode: GameMode.TEAM,
      playerOrder: ['p1', 'p2', 'p3', 'p4'],
      teamOrder: ['team_A', 'team_B'],
      teamPlayers,
    });

    expect(turns.activePlayerId).toBe('p1');
    expect(turns.activeTeamId).toBe('team_A');

    // p1 calls PANDU during Team A's turn
    turns.setupFinalTurns('p1', 1);
    expect(turns.isInFinalTurns).toBe(true);
    expect(turns.activePlayerId).toBe('p1');

    // p1 ends turn -> Team B gets exactly 1 turn (p3)
    expect(turns.advanceTurn()).toBe('p3');
    expect(turns.activeTeamId).toBe('team_B');

    // p3 ends turn -> Team A gets exactly 1 final turn (p1)
    expect(turns.advanceTurn()).toBe('p1');
    expect(turns.activeTeamId).toBe('team_A');

    // p1 ends final turn -> game over
    expect(turns.advanceTurn()).toBe('');
    expect(turns.areFinalTurnsComplete()).toBe(true);
  });
});

describe('Special Powers', () => {
  it('identifies special powers correctly', () => {
    expect(getSpecialPower({ id: '1', rank: '7', suit: 'hearts' })).toBe(SpecialPowerType.SELF_PEEK);
    expect(getSpecialPower({ id: '2', rank: '8', suit: 'spades' })).toBe(SpecialPowerType.SELF_PEEK);
    expect(getSpecialPower({ id: '3', rank: '9', suit: 'clubs' })).toBe(SpecialPowerType.OTHER_PEEK);
    expect(getSpecialPower({ id: '4', rank: '10', suit: 'diamonds' })).toBe(SpecialPowerType.OTHER_PEEK);
    expect(getSpecialPower({ id: '5', rank: 'Q', suit: 'hearts' })).toBe(SpecialPowerType.BLIND_EXCHANGE);
    expect(getSpecialPower({ id: '6', rank: 'J', suit: 'spades' })).toBe(SpecialPowerType.NONE); // Jack is wild snap card
    expect(getSpecialPower({ id: '7', rank: 'K', suit: 'clubs' })).toBe(SpecialPowerType.NONE);
    expect(getSpecialPower({ id: '8', rank: 'A', suit: 'diamonds' })).toBe(SpecialPowerType.NONE);
  });

  it('executes Queen blind card exchange without mutating positions', () => {
    const ownHand = ['c1', 'c2', 'c3'];
    const otherHand = ['c4', 'c5', 'c6'];

    const result = executeBlindExchange(ownHand, 'c2', otherHand, 'c5');

    expect(result.ownHand).toEqual(['c1', 'c5', 'c3']);
    expect(result.otherHand).toEqual(['c4', 'c2', 'c6']);
  });
});

describe('X Reaction System', () => {
  it('awards fastest valid X reaction to winner and penalizes others with exactly 1 penalty', () => {
    const window = openReactionWindow('trigger_card', 3000);
    const deck = createDeck();
    const cardMap = new Map(deck.map((c) => [c.id, c]));

    // p1 plays non-X (e.g. 5 of hearts)
    registerReaction(window, 'p1', 'hearts-5', ['hearts-5']);
    // p2 plays valid X (Jack of spades)
    registerReaction(window, 'p2', 'spades-J', ['spades-J']);
    // p3 plays non-X (King of clubs)
    registerReaction(window, 'p3', 'clubs-K', ['clubs-K']);

    const result = resolveReactions(window, (id) => cardMap.get(id));

    expect(result.winner?.playerId).toBe('p2');
    expect(result.penalties).toContain('p1');
    expect(result.penalties).toContain('p3');
    expect(result.penalties).not.toContain('p2');
    expect(result.penalties.length).toBe(2); // Exactly 1 penalty each
  });
});

describe('Scoring System', () => {
  it('calculates card values correctly: K=0, A=1, 2-10=face, J=11, Q=12', () => {
    const cards = [
      { id: '1', rank: 'K', suit: 'hearts' },
      { id: '2', rank: 'A', suit: 'spades' },
      { id: '3', rank: '7', suit: 'clubs' },
      { id: '4', rank: 'J', suit: 'diamonds' },
      { id: '5', rank: 'Q', suit: 'hearts' },
    ] as any;

    // 0 + 1 + 7 + 11 + 12 = 31
    expect(calculateHandScore(cards)).toBe(31);
  });

  it('ranks players in ascending order of score and handles ties correctly', () => {
    const playerData = [
      {
        playerId: 'p1',
        playerName: 'Alice',
        avatarId: 0,
        cards: [{ id: '1', rank: 'K', suit: 'hearts' }] as any, // 0 pts
        calledPandu: false,
      },
      {
        playerId: 'p2',
        playerName: 'Bob',
        avatarId: 1,
        cards: [{ id: '2', rank: '5', suit: 'hearts' }] as any, // 5 pts
        calledPandu: false,
      },
      {
        playerId: 'p3',
        playerName: 'Charlie',
        avatarId: 2,
        cards: [{ id: '3', rank: '5', suit: 'clubs' }] as any, // 5 pts (tied with Bob)
        calledPandu: false,
      },
      {
        playerId: 'p4',
        playerName: 'Dave',
        avatarId: 3,
        cards: [{ id: '4', rank: '10', suit: 'diamonds' }] as any, // 10 pts
        calledPandu: false,
      },
    ];

    const scores = calculateFinalScores(playerData);

    expect(scores[0].playerName).toBe('Alice');
    expect(scores[0].rank).toBe(1);
    expect(scores[0].score).toBe(0);

    // Tied 2nd place
    expect(scores[1].rank).toBe(2);
    expect(scores[2].rank).toBe(2);

    // 4th place
    expect(scores[3].rank).toBe(4);
  });
});
