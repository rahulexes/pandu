// ============================================================
// PANDU — Room (Game Controller)
// ============================================================
// The Room class is the central game controller that orchestrates
// all engine modules. Each room is an independent game instance.

import { v4 as uuidv4 } from 'uuid';
import {
  GamePhase,
  GameMode,
  SpecialPowerType,
  SpecialActionPhase,
  GameEventType,
  DECK_SIZE,
  INITIAL_VIEW_DURATION_MS,
  PEEK_DURATION_MS,
  X_REACTION_WINDOW_MS,
  DEFAULT_CARDS_DEALT,
  DEFAULT_INITIAL_VIEWABLE,
  DEFAULT_QUEEN_COUNT,
  X_CARD_RANK,
} from '@pandu/shared';
import type {
  Card,
  Player,
  Team,
  GameSettings,
  PlayerGameState,
  TeamGameState,
  ClientGameState,
  ClientCard,
  ClientOpponent,
  PlayerScore,
  ClientRoomState,
} from '@pandu/shared';

import { GameStateMachine } from '../engine/GameStateMachine.js';
import { TurnSystem } from '../engine/TurnSystem.js';
import {
  createDeck,
  shuffleDeck,
  dealCards,
  drawFromPile,
  addToDiscardPile,
  recycleDiscardPile,
  getVisibleDiscards,
  validateCardInvariant,
} from '../engine/Deck.js';
import { getSpecialPower, validateSelfPeek, validateOtherPeek, validateExchangeOwnCard, validateExchangeOtherCard, executeBlindExchange, getSpecialPowerMessage } from '../engine/SpecialPowers.js';
import { openReactionWindow, registerReaction, resolveReactions } from '../engine/XReactionSystem.js';
import type { XReactionWindow, XReactionResult } from '../engine/XReactionSystem.js';
import { validatePanduCall, getAdditionalTurns, createPanduState } from '../engine/PanduSystem.js';
import type { PanduState } from '../engine/PanduSystem.js';
import { calculateFinalScores, getRematchStartingPlayer } from '../engine/ScoringSystem.js';
import { TimerManager } from '../timers/TimerManager.js';
import { GameLogger } from '../logging/GameLogger.js';

// ── Event emitter interface ────────────────────────────────
// The Room emits events that the SocketManager translates into socket messages.
export type RoomEventHandler = (event: string, data: unknown, targetPlayerIds?: string[]) => void;

export class Room {
  readonly id: string;
  readonly code: string;

  // ── Players ──
  private players: Map<string, Player> = new Map();
  private hostId: string = '';

  // ── Teams ──
  private teams: Map<string, Team> = new Map();

  // ── Settings ──
  private settings: GameSettings = {
    mode: GameMode.INDIVIDUAL,
    cardsDealt: DEFAULT_CARDS_DEALT,
    initialViewable: DEFAULT_INITIAL_VIEWABLE,
    queenCount: DEFAULT_QUEEN_COUNT,
  };

  // ── Game Engine ──
  private stateMachine: GameStateMachine;
  private turnSystem: TurnSystem | null = null;
  private allCards: Map<string, Card> = new Map();
  private drawPile: string[] = [];
  private discardPile: string[] = [];
  private playerStates: Map<string, PlayerGameState> = new Map();
  private teamStates: Map<string, TeamGameState> = new Map();

  // ── Turn State ──
  private drawnCardId: string | null = null;
  private currentSpecialAction: {
    type: SpecialPowerType;
    phase: SpecialActionPhase;
    triggerPlayerId: string;
    selectedCardId?: string;
    selectedOwnCardId?: string;
    selectedOtherCardId?: string;
    targetPlayerId?: string;
  } | null = null;

  // ── X Reaction ──
  private xReactionWindow: XReactionWindow | null = null;

  // ── PANDU ──
  private panduState: PanduState | null = null;

  // ── Scoring ──
  private finishedOrder: string[] = [];
  private nextFinishRank: number = 1;
  private previousScores: PlayerScore[] = [];

  // ── Subsystems ──
  private timerManager: TimerManager;
  private logger: GameLogger;
  private emitEvent: RoomEventHandler;

  // ── Session tokens ──
  private sessionTokens: Map<string, string> = new Map(); // sessionToken → playerId
  private bannedPlayers: Map<string, number> = new Map();

  constructor(code: string, emitEvent: RoomEventHandler) {
    this.id = uuidv4();
    this.code = code;
    this.stateMachine = new GameStateMachine(GamePhase.LOBBY);
    this.timerManager = new TimerManager();
    this.logger = new GameLogger(this.id);
    this.emitEvent = emitEvent;
  }

  // ════════════════════════════════════════════════════════
  // ROOM MANAGEMENT
  // ════════════════════════════════════════════════════════

  addPlayer(name: string, avatarId: number, socketId: string): { player: Player; sessionToken: string } | { error: string } {
    if (this.stateMachine.currentPhase !== GamePhase.LOBBY && this.stateMachine.currentPhase !== GamePhase.GAME_OVER) {
      return { error: 'Cannot join — game is in progress' };
    }

    // Check 1-minute kick cooldown
    const bannedUntil = this.bannedPlayers.get(name.trim().toLowerCase());
    if (bannedUntil && Date.now() < bannedUntil) {
      const remainingSec = Math.ceil((bannedUntil - Date.now()) / 1000);
      return { error: `You were kicked from this room. Cooldown active (${remainingSec}s remaining).` };
    }

    const playerId = uuidv4();
    const sessionToken = uuidv4();
    const isHost = this.players.size === 0;

    const player: Player = {
      id: playerId,
      name,
      avatarId,
      isHost,
      isReady: false,
      isConnected: true,
      socketId,
    };

    this.players.set(playerId, player);
    if (isHost) this.hostId = playerId;
    this.sessionTokens.set(sessionToken, playerId);

    this.logger.log(GameEventType.PLAYER_JOINED, { playerId, name });
    return { player, sessionToken };
  }

  kickPlayer(hostId: string, targetPlayerId: string): { error?: string } {
    const isHost = hostId === this.hostId || (this.players.get(hostId)?.isHost ?? false) || this.players.size <= 1;
    if (!isHost) return { error: 'Only the host can kick players' };
    if (targetPlayerId === this.hostId) return { error: 'Host cannot kick themselves' };

    const targetPlayer = this.players.get(targetPlayerId);
    if (!targetPlayer) return { error: 'Player not found' };

    const cooldownUntil = Date.now() + 60_000;
    this.bannedPlayers.set(targetPlayerId, cooldownUntil);
    this.bannedPlayers.set(targetPlayer.name.trim().toLowerCase(), cooldownUntil);

    this.emitEvent('lobby:kicked', {
      targetPlayerId,
      reason: 'Kicked by host',
      cooldownSeconds: 60,
      cooldownUntil,
    }, [targetPlayerId]);

    this.removePlayer(targetPlayerId);
    this.logger.log(GameEventType.PLAYER_LEFT, { playerId: targetPlayerId, reason: 'kicked' });
    this.broadcastRoomState();
    return {};
  }

  reconnectPlayer(sessionToken: string, socketId: string): Player | null {
    const playerId = this.sessionTokens.get(sessionToken);
    if (!playerId) return null;

    const player = this.players.get(playerId);
    if (!player) return null;

    player.isConnected = true;
    player.socketId = socketId;

    this.logger.log(GameEventType.PLAYER_RECONNECTED, { playerId });
    return player;
  }

  removePlayer(playerId: string): { newHostId?: string } {
    const player = this.players.get(playerId);
    if (!player) return {};

    this.players.delete(playerId);
    this.logger.log(GameEventType.PLAYER_LEFT, { playerId });

    // Remove from teams
    for (const [, team] of this.teams) {
      team.playerIds = team.playerIds.filter(id => id !== playerId);
    }

    // Transfer host if needed
    let newHostId: string | undefined;
    if (playerId === this.hostId && this.players.size > 0) {
      const nextPlayer = this.players.values().next().value;
      if (nextPlayer) {
        nextPlayer.isHost = true;
        this.hostId = nextPlayer.id;
        newHostId = nextPlayer.id;
      }
    }

    return { newHostId };
  }

  disconnectPlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      player.isConnected = false;
      this.logger.log(GameEventType.PLAYER_DISCONNECTED, { playerId });
    }
  }

  getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  getPlayerBySocketId(socketId: string): Player | undefined {
    for (const player of this.players.values()) {
      if (player.socketId === socketId) return player;
    }
    return undefined;
  }

  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  getConnectedPlayerIds(): string[] {
    return Array.from(this.players.values())
      .filter(p => p.isConnected)
      .map(p => p.id);
  }

  // ════════════════════════════════════════════════════════
  // LOBBY ACTIONS
  // ════════════════════════════════════════════════════════

  setMode(hostId: string, mode: GameMode): { error?: string } {
    const isHost = hostId === this.hostId || (this.players.get(hostId)?.isHost ?? false) || this.players.size <= 1;
    if (!isHost) return { error: 'Only the host can change mode' };
    if (this.stateMachine.currentPhase !== GamePhase.LOBBY) return { error: 'Can only change mode in lobby' };

    this.settings.mode = mode;

    if (mode === GameMode.TEAM) {
      // Initialize 4 teams
      const teamNames = ['Team A', 'Team B', 'Team C', 'Team D'];
      this.teams.clear();
      for (let i = 0; i < 4; i++) {
        const teamId = `team_${String.fromCharCode(65 + i)}`;
        this.teams.set(teamId, {
          id: teamId,
          name: teamNames[i],
          playerIds: [],
          activePlayerIndex: 0,
        });
      }
    } else {
      this.teams.clear();
    }

    this.emitEvent('lobby:settingsUpdated', this.settings);
    this.broadcastRoomState();
    return {};
  }

  updateSettings(hostId: string, updates: Partial<GameSettings>): { error?: string } {
    const isHost = hostId === this.hostId || (this.players.get(hostId)?.isHost ?? false) || this.players.size <= 1;
    if (!isHost) return { error: 'Only the host can change settings' };
    if (this.stateMachine.currentPhase !== GamePhase.LOBBY) return { error: 'Can only change settings in lobby' };

    if (updates.cardsDealt !== undefined) {
      this.settings.cardsDealt = updates.cardsDealt;
      // Auto-adjust initialViewable if constraint violated
      const maxViewable = Math.floor(this.settings.cardsDealt / 2);
      if (this.settings.initialViewable > maxViewable) {
        this.settings.initialViewable = maxViewable;
      }
    }

    if (updates.initialViewable !== undefined) {
      const maxViewable = Math.floor(this.settings.cardsDealt / 2);
      if (updates.initialViewable > maxViewable) {
        return { error: `Initial viewable must be ≤ ${maxViewable} (floor of cards dealt / 2)` };
      }
      this.settings.initialViewable = updates.initialViewable;
    }

    if (updates.queenCount !== undefined) {
      if (updates.queenCount < 2 || updates.queenCount > 4) {
        return { error: 'Queen count must be between 2 and 4' };
      }
      this.settings.queenCount = updates.queenCount;
    }

    this.emitEvent('lobby:settingsUpdated', this.settings);
    this.broadcastRoomState();
    return {};
  }

  toggleReady(playerId: string): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;
    player.isReady = !player.isReady;
    return player.isReady;
  }

  joinTeam(playerId: string, teamId: string): { error?: string } {
    if (this.settings.mode !== GameMode.TEAM) return { error: 'Not in team mode' };

    const team = this.teams.get(teamId);
    if (!team) return { error: 'Invalid team' };
    if (team.playerIds.length >= 4) return { error: 'Team is full (max 4)' };

    // Remove from current team
    for (const [, t] of this.teams) {
      t.playerIds = t.playerIds.filter(id => id !== playerId);
    }

    team.playerIds.push(playerId);
    return {};
  }

  // ════════════════════════════════════════════════════════
  // GAME START
  // ════════════════════════════════════════════════════════

  canStartGame(hostId: string): { canStart: boolean; error?: string } {
    if (hostId !== this.hostId) return { canStart: false, error: 'Only the host can start the game' };
    if (this.stateMachine.currentPhase !== GamePhase.LOBBY) return { canStart: false, error: 'Game already started' };

    const allPlayers = Array.from(this.players.values());
    if (allPlayers.length < 2) return { canStart: false, error: 'Need at least 2 players' };
    if (!allPlayers.every(p => p.isReady || p.id === this.hostId)) {
      return { canStart: false, error: 'Not all players are ready' };
    }

    // Check if enough cards for all players
    const totalCardsNeeded = this.settings.mode === GameMode.INDIVIDUAL
      ? allPlayers.length * this.settings.cardsDealt
      : Array.from(this.teams.values()).filter(t => t.playerIds.length > 0).length * this.settings.cardsDealt;

    if (totalCardsNeeded > DECK_SIZE - 2) {
      return { canStart: false, error: `Not enough cards (need ${totalCardsNeeded}, only ${DECK_SIZE - 2} available after keeping 2 for draw/discard)` };
    }

    if (this.settings.mode === GameMode.TEAM) {
      const activeTeams = Array.from(this.teams.values()).filter(t => t.playerIds.length > 0);
      if (activeTeams.length < 2) return { canStart: false, error: 'Need at least 2 teams with players' };
    }

    return { canStart: true };
  }

  startGame(): void {
    this.stateMachine.transition(GamePhase.READY_CHECK);
    this.stateMachine.transition(GamePhase.SHUFFLING);

    this.logger.log(GameEventType.GAME_STARTED, { settings: this.settings });

    // 1. Create and shuffle deck
    const deck = createDeck();
    this.allCards.clear();
    for (const card of deck) {
      this.allCards.set(card.id, card);
    }
    const cardIds = deck.map(c => c.id);
    shuffleDeck(cardIds);

    // Emit shuffle animation
    this.emitEvent('game:shuffleStart', {});

    // 2. Deal cards
    this.stateMachine.transition(GamePhase.DEALING);

    let entities: string[]; // player IDs or team IDs
    if (this.settings.mode === GameMode.INDIVIDUAL) {
      entities = Array.from(this.players.keys());
    } else {
      entities = Array.from(this.teams.values())
        .filter(t => t.playerIds.length > 0)
        .map(t => t.id);
    }

    const { hands, remainingDrawPile } = dealCards(cardIds, entities, this.settings.cardsDealt);
    this.drawPile = remainingDrawPile;
    this.discardPile = [];

    // 3. Initialize player/team game states
    this.playerStates.clear();
    this.teamStates.clear();
    this.finishedOrder = [];
    this.nextFinishRank = 1;
    this.panduState = null;
    this.drawnCardId = null;
    this.currentSpecialAction = null;
    this.xReactionWindow = null;
    this.rematchVotes.clear();

    if (this.settings.mode === GameMode.INDIVIDUAL) {
      for (const [playerId] of this.players) {
        this.playerStates.set(playerId, {
          playerId,
          handCardIds: hands.get(playerId) || [],
          knownCardIds: new Set(),
          initialPeeksUsed: 0,
          isEliminated: false,
          calledPandu: false,
          isSpectator: false,
        });
      }
    } else {
      for (const [teamId, team] of this.teams) {
        if (team.playerIds.length === 0) continue;
        this.teamStates.set(teamId, {
          teamId,
          handCardIds: hands.get(teamId) || [],
          knownCardIds: new Set(),
          initialPeeksUsed: 0,
          isEliminated: false,
          calledPandu: false,
          currentPlayerIndex: 0,
        });
        // Also create individual player states for team members
        for (const pid of team.playerIds) {
          this.playerStates.set(pid, {
            playerId: pid,
            handCardIds: [],
            knownCardIds: new Set(),
            initialPeeksUsed: 0,
            isEliminated: false,
            calledPandu: false,
            isSpectator: false,
          });
        }
      }
    }

    // 4. Initialize turn system
    const playerOrder = Array.from(this.players.keys());
    const teamOrder = Array.from(this.teams.values())
      .filter(t => t.playerIds.length > 0)
      .map(t => t.id);
    const teamPlayerMap = new Map<string, string[]>();
    for (const [teamId, team] of this.teams) {
      if (team.playerIds.length > 0) {
        teamPlayerMap.set(teamId, [...team.playerIds]);
      }
    }

    this.turnSystem = new TurnSystem({
      mode: this.settings.mode,
      playerOrder,
      teamOrder,
      teamPlayers: teamPlayerMap,
    });

    // Set starting player for rematch
    if (this.previousScores.length > 0) {
      const starterId = getRematchStartingPlayer(this.previousScores);
      this.turnSystem.setStartingPlayer(starterId);
    }

    // Emit deal animation
    this.emitEvent('game:dealStart', {
      playerOrder: entities,
      cardsPerPlayer: this.settings.cardsDealt,
    });

    this.logger.log(GameEventType.CARDS_DEALT, {
      cardsPerEntity: this.settings.cardsDealt,
      entities: entities.length,
    });

    // 5. Start initial viewing phase
    this.startInitialViewPhase();
  }

  // ════════════════════════════════════════════════════════
  // INITIAL VIEWING PHASE
  // ════════════════════════════════════════════════════════

  private startInitialViewPhase(): void {
    this.stateMachine.transition(GamePhase.INITIAL_VIEW);

    this.emitEvent('game:initialViewStart', {
      durationMs: INITIAL_VIEW_DURATION_MS,
      maxPeeks: this.settings.initialViewable,
    });

    this.emitEvent('game:timerSync', {
      type: 'initialView',
      endsAt: Date.now() + INITIAL_VIEW_DURATION_MS,
      durationMs: INITIAL_VIEW_DURATION_MS,
    });

    this.timerManager.startTimer('initialView', INITIAL_VIEW_DURATION_MS, () => {
      this.endInitialViewPhase();
    });

    // Broadcast initial game state to all players
    this.broadcastGameState();
  }

  peekInitialCard(playerId: string, cardId: string): { error?: string; card?: Card } {
    if (this.stateMachine.currentPhase !== GamePhase.INITIAL_VIEW) {
      return { error: 'Not in initial viewing phase' };
    }

    let hand: (string | null)[];
    let peeksUsed: number;
    let maxPeeks: number = this.settings.initialViewable;

    if (this.settings.mode === GameMode.INDIVIDUAL) {
      const state = this.playerStates.get(playerId);
      if (!state) return { error: 'Player not found' };
      hand = state.handCardIds;
      peeksUsed = state.initialPeeksUsed;
    } else {
      // Team mode: any player on the team can peek (shared pool of peeks)
      const teamId = this.getPlayerTeamId(playerId);
      if (!teamId) return { error: 'Player not on a team' };
      const teamState = this.teamStates.get(teamId);
      if (!teamState) return { error: 'Team state not found' };
      hand = teamState.handCardIds;
      peeksUsed = teamState.initialPeeksUsed;
    }

    if (peeksUsed >= maxPeeks) {
      return { error: `You have already viewed ${maxPeeks} cards` };
    }

    if (!hand.includes(cardId)) {
      return { error: 'Card is not in your hand' };
    }

    // Check if already peeked
    const teamId = this.getPlayerTeamId(playerId);
    const isAlreadyPeeked = this.settings.mode === GameMode.INDIVIDUAL
      ? (this.playerStates.get(playerId)?.knownCardIds.has(cardId) ?? false)
      : (teamId ? (this.teamStates.get(teamId)?.knownCardIds.has(cardId) ?? false) : false);

    if (isAlreadyPeeked) {
      return { error: 'This card has already been viewed' };
    }

    const card = this.allCards.get(cardId);
    if (!card) return { error: 'Card not found' };

    // Record the peek
    if (this.settings.mode === GameMode.INDIVIDUAL) {
      const state = this.playerStates.get(playerId)!;
      state.initialPeeksUsed++;
      state.knownCardIds.add(cardId);
    } else {
      const teamId = this.getPlayerTeamId(playerId)!;
      const teamState = this.teamStates.get(teamId)!;
      teamState.initialPeeksUsed++;
      teamState.knownCardIds.add(cardId);
      // All team members now know this card
      const team = this.teams.get(teamId)!;
      for (const pid of team.playerIds) {
        const ps = this.playerStates.get(pid);
        if (ps) ps.knownCardIds.add(cardId);
      }
    }

    this.logger.log(GameEventType.CARD_PEEKED, { playerId, cardId, phase: 'initial' });

    // Emit card peeked to ALL teammates so their screens show the peeked card simultaneously!
    const teamPlayerIds = this.getTeamPlayerIds(playerId);
    this.emitEvent('game:cardPeeked', {
      cardId,
      card: { id: card.id, rank: card.rank, suit: card.suit, faceUp: true },
    }, teamPlayerIds);

    this.broadcastGameState();
    return { card };
  }

  private endInitialViewPhase(): void {
    this.timerManager.cancelTimersByType('initialView');
    this.emitEvent('game:timerExpired', { type: 'initialView' });

    // Start the first turn
    this.startPlayerTurn();
  }

  // ════════════════════════════════════════════════════════
  // TURN FLOW
  // ════════════════════════════════════════════════════════

  private startPlayerTurn(): void {
    if (!this.turnSystem) return;

    // Reset fast-reaction trackers on turn change
    this.xReactionAttemptedPlayers.clear();

    // Skip any players with 0 cards remaining
    let attempts = 0;
    while (attempts < this.players.size) {
      const activeId = this.turnSystem.activePlayerId;
      const hand = this.getPlayerHand(activeId);
      if (hand && hand.length === 0 && !this.turnSystem.isGameEffectivelyOver()) {
        this.turnSystem.advanceTurn();
        attempts++;
      } else {
        break;
      }
    }

    // Check if game should end
    if (this.turnSystem.isInFinalTurns && this.turnSystem.areFinalTurnsComplete()) {
      this.revealAndScore();
      return;
    }

    if (this.turnSystem.isGameEffectivelyOver() && !this.turnSystem.isInFinalTurns) {
      this.revealAndScore();
      return;
    }

    this.stateMachine.forcePhase(GamePhase.PLAYER_TURN);
    this.drawnCardId = null;
    this.currentSpecialAction = null;

    const activeId = this.turnSystem.activePlayerId;
    if (!activeId) {
      this.revealAndScore();
      return;
    }

    const player = this.players.get(activeId);
    const teamId = this.turnSystem.activeTeamId;

    this.emitEvent('game:turnStart', {
      playerId: activeId,
      teamId,
      playerName: player?.name || 'Unknown',
      turnNumber: this.turnSystem.currentTurnIndex,
    });

    this.logger.log(GameEventType.TURN_CHANGED, { playerId: activeId, teamId });

    // Broadcast full state update
    this.broadcastGameState();
  }

  // ── Draw Card ──

  drawCard(playerId: string): { error?: string; card?: Card } {
    if (!this.turnSystem) return { error: 'Game not started' };

    if (this.stateMachine.currentPhase !== GamePhase.PLAYER_TURN) {
      return { error: 'Cannot draw now' };
    }

    const isTurn = this.settings.mode === GameMode.TEAM
      ? (this.getPlayerTeamId(playerId) === this.turnSystem.activeTeamId)
      : (playerId === this.turnSystem.activePlayerId);

    if (!isTurn) {
      return { error: "It's not your turn" };
    }

    this.stateMachine.forcePhase(GamePhase.DRAWING);

    // Check if draw pile is empty, recycle if needed
    if (this.drawPile.length === 0) {
      this.recycleDiscard();
    }

    if (this.drawPile.length === 0) {
      return { error: 'No cards available to draw' };
    }

    const cardId = drawFromPile(this.drawPile)!;
    this.drawnCardId = cardId;
    const card = this.allCards.get(cardId)!;

    this.stateMachine.forcePhase(GamePhase.CARD_DECISION);

    this.logger.log(GameEventType.CARD_DRAWN, { playerId, cardId });

    // Active player and their teammate both see the drawn card face-up!
    const teamPlayerIds = this.getTeamPlayerIds(playerId);
    this.emitEvent('game:cardDrawn', { card: { id: card.id, rank: card.rank, suit: card.suit, faceUp: true } }, teamPlayerIds);

    // Opponents see a hidden card drawn
    const otherPlayerIds = this.getConnectedPlayerIds().filter(id => !teamPlayerIds.includes(id));
    this.emitEvent('game:cardDrawn', { card: { id: card.id, faceUp: false } }, otherPlayerIds);

    this.broadcastGameState();
    return { card };
  }

  // ── Discard Drawn Card ──

  discardDrawnCard(playerId: string): { error?: string; specialPower?: SpecialPowerType } {
    if (!this.turnSystem) return { error: 'Game not started' };
    if (this.stateMachine.currentPhase !== GamePhase.CARD_DECISION) return { error: 'Cannot discard now' };
    const isTurn = this.settings.mode === GameMode.TEAM
      ? (this.getPlayerTeamId(playerId) === this.turnSystem.activeTeamId)
      : (playerId === this.turnSystem.activePlayerId);
    if (!isTurn) return { error: "It's not your turn" };
    if (!this.drawnCardId) return { error: 'No card drawn' };

    const cardId = this.drawnCardId;
    const card = this.allCards.get(cardId)!;

    // Add to discard pile
    addToDiscardPile(this.discardPile, cardId);
    this.drawnCardId = null;
    this.xReactionAttemptedPlayers.clear();

    this.logger.log(GameEventType.CARD_DISCARDED, { playerId, cardId, rank: card.rank, suit: card.suit });

    // Broadcast the discard (card is now visible to all)
    this.emitEvent('game:cardDiscarded', {
      cardId,
      card: { id: card.id, rank: card.rank, suit: card.suit, faceUp: true },
    });

    // Check for special power
    const specialPower = getSpecialPower(card);
    if (specialPower !== SpecialPowerType.NONE) {
      const spResult = this.triggerSpecialPower(specialPower, playerId);
      this.broadcastGameState();
      return spResult;
    }

    this.stateMachine.forcePhase(GamePhase.END_TURN);
    this.broadcastGameState();
    return {};
  }

  // ── Replace Hand Card ──

  replaceHandCard(playerId: string, handCardId: string): { error?: string; specialPower?: SpecialPowerType } {
    if (!this.turnSystem) return { error: 'Game not started' };
    if (this.stateMachine.currentPhase !== GamePhase.CARD_DECISION) return { error: 'Cannot replace now' };
    
    const isTurn = this.settings.mode === GameMode.TEAM
      ? (this.getPlayerTeamId(playerId) === this.turnSystem.activeTeamId)
      : (playerId === this.turnSystem.activePlayerId);
    if (!isTurn) return { error: "It's not your turn" };
    if (!this.drawnCardId) return { error: 'No card drawn' };

    // Get the correct hand (individual or team)
    let hand: (string | null)[];
    if (this.settings.mode === GameMode.INDIVIDUAL) {
      const state = this.playerStates.get(playerId);
      if (!state) return { error: 'Player state not found' };
      hand = state.handCardIds;
    } else {
      const teamId = this.getPlayerTeamId(playerId);
      if (!teamId) return { error: 'Player not on a team' };
      const teamState = this.teamStates.get(teamId);
      if (!teamState) return { error: 'Team state not found' };
      hand = teamState.handCardIds;
    }

    if (!hand.includes(handCardId)) {
      return { error: 'Selected card is not in your hand' };
    }

    const drawnCardId = this.drawnCardId;
    const drawnCard = this.allCards.get(drawnCardId)!;
    const discardedCard = this.allCards.get(handCardId)!;

    // Replace the card in hand
    const handIndex = hand.indexOf(handCardId);
    hand[handIndex] = drawnCardId;

    // Discard the old hand card
    addToDiscardPile(this.discardPile, handCardId);
    this.drawnCardId = null;
    this.xReactionAttemptedPlayers.clear();

    // The player (and team) now knows the drawn card
    const teamPlayerIds = this.getTeamPlayerIds(playerId);
    for (const pid of teamPlayerIds) {
      const ps = this.playerStates.get(pid);
      if (ps) {
        ps.knownCardIds.add(drawnCardId);
        ps.knownCardIds.delete(handCardId);
      }
    }

    this.logger.log(GameEventType.CARD_REPLACED, {
      playerId,
      drawnCardId,
      discardedCardId: handCardId,
      handPosition: handIndex,
    });

    // Broadcast
    this.emitEvent('game:cardReplaced', {
      oldCardId: handCardId,
      newCard: { id: drawnCardId, faceUp: false },
      discardedCard: { id: handCardId, rank: discardedCard.rank, suit: discardedCard.suit, faceUp: true },
      handPosition: handIndex,
    });

    // Check for special power on the discarded card
    const specialPower = getSpecialPower(discardedCard);
    if (specialPower !== SpecialPowerType.NONE) {
      const spResult = this.triggerSpecialPower(specialPower, playerId);
      this.broadcastGameState();
      return spResult;
    }

    // Check zero-card elimination
    if (hand.length === 0) {
      this.eliminatePlayerOrTeam(playerId);
    }

    this.stateMachine.forcePhase(GamePhase.END_TURN);
    this.broadcastGameState();
    return {};
  }

  // ════════════════════════════════════════════════════════
  // SPECIAL POWERS
  // ════════════════════════════════════════════════════════

  private triggerSpecialPower(type: SpecialPowerType, playerId: string): { specialPower: SpecialPowerType } {
    if (type === SpecialPowerType.NONE || type === SpecialPowerType.X_REACTION) {
      this.stateMachine.forcePhase(GamePhase.END_TURN);
      return { specialPower: SpecialPowerType.NONE };
    }

    this.logger.log(GameEventType.SPECIAL_TRIGGERED, { playerId, type });
    this.stateMachine.forcePhase(GamePhase.SPECIAL_ACTION);

    this.currentSpecialAction = {
      type,
      phase: SpecialActionPhase.SELECT_CARD,
      triggerPlayerId: playerId,
    };

    const message = getSpecialPowerMessage(type);
    const teamPlayerIds = this.getTeamPlayerIds(playerId);
    this.emitEvent('game:specialAction', {
      type,
      phase: SpecialActionPhase.SELECT_CARD,
      message,
    }, teamPlayerIds);

    return { specialPower: type };
  }

  // ── Self Peek (7/8) ──

  selectSelfPeekCard(playerId: string, cardId: string): { error?: string; card?: Card } {
    if (!this.currentSpecialAction || this.currentSpecialAction.type !== SpecialPowerType.SELF_PEEK) {
      return { error: 'No self-peek action active' };
    }
    const teamPlayerIds = this.getTeamPlayerIds(this.currentSpecialAction.triggerPlayerId);
    if (!teamPlayerIds.includes(playerId)) {
      return { error: 'This is not your special action' };
    }

    const hand = this.getPlayerHand(playerId);
    if (!hand) return { error: 'Hand not found' };

    const validation = validateSelfPeek(playerId, cardId, hand);
    if (!validation.valid) return { error: validation.error };

    const card = this.allCards.get(cardId)!;

    // Team members now know this card
    for (const pid of teamPlayerIds) {
      const ps = this.playerStates.get(pid);
      if (ps) ps.knownCardIds.add(cardId);
    }

    this.currentSpecialAction.phase = SpecialActionPhase.SHOWING_CARD;
    this.currentSpecialAction.selectedCardId = cardId;

    this.logger.log(GameEventType.CARD_PEEKED, { playerId, cardId, type: 'selfPeek' });

    // Reveal card to the entire team for 5 seconds
    this.emitEvent('game:cardRevealed', {
      cardId,
      targetPlayerId: playerId,
      card: { id: card.id, rank: card.rank, suit: card.suit, faceUp: true },
      durationMs: PEEK_DURATION_MS,
    }, teamPlayerIds);

    // Also notify opponents with faceUp: false so their screens scale up the peeked card!
    const otherPlayerIds = this.getConnectedPlayerIds().filter(id => !teamPlayerIds.includes(id));
    this.emitEvent('game:cardRevealed', {
      cardId,
      targetPlayerId: playerId,
      card: { id: card.id, faceUp: false },
      durationMs: PEEK_DURATION_MS,
    }, otherPlayerIds);

    this.emitEvent('game:timerSync', {
      type: 'peekTimer',
      endsAt: Date.now() + PEEK_DURATION_MS,
      durationMs: PEEK_DURATION_MS,
    }, teamPlayerIds);

    // Auto-close after 5 seconds
    this.timerManager.startTimer('peek', PEEK_DURATION_MS, () => {
      this.completeSelfPeek(playerId);
    });

    return { card };
  }

  private completeSelfPeek(playerId: string): void {
    this.timerManager.cancelTimersByType('peek');
    if (this.currentSpecialAction) {
      this.currentSpecialAction.phase = SpecialActionPhase.COMPLETE;
    }
    const teamPlayerIds = this.getTeamPlayerIds(playerId);
    this.emitEvent('game:timerExpired', { type: 'peekTimer' }, teamPlayerIds);
    this.emitEvent('game:cardRevealedExpired', {});
    this.emitEvent('game:specialAction', {
      type: SpecialPowerType.SELF_PEEK,
      phase: SpecialActionPhase.COMPLETE,
      message: 'Card viewing complete',
    }, teamPlayerIds);
  }

  // ── Other Peek (9/10) ──

  selectOtherPeekCard(playerId: string, targetPlayerId: string, cardId: string): { error?: string; card?: Card } {
    if (!this.currentSpecialAction || this.currentSpecialAction.type !== SpecialPowerType.OTHER_PEEK) {
      return { error: 'No other-peek action active' };
    }
    const teamPlayerIds = this.getTeamPlayerIds(this.currentSpecialAction.triggerPlayerId);
    if (!teamPlayerIds.includes(playerId)) {
      return { error: 'This is not your special action' };
    }

    if (this.settings.mode === GameMode.TEAM) {
      const myTeamId = this.getPlayerTeamId(playerId);
      const targetTeamId = this.teamStates.has(targetPlayerId) ? targetPlayerId : this.getPlayerTeamId(targetPlayerId);
      if (myTeamId && targetTeamId && myTeamId === targetTeamId) {
        return { error: 'You cannot peek at your own team\'s card with this power' };
      }
    }

    const targetHand = this.getPlayerHand(targetPlayerId);
    if (!targetHand) return { error: 'Target player hand not found' };

    const validation = validateOtherPeek(playerId, targetPlayerId, cardId, targetHand);
    if (!validation.valid) return { error: validation.error };

    const card = this.allCards.get(cardId)!;

    this.currentSpecialAction.phase = SpecialActionPhase.SHOWING_CARD;
    this.currentSpecialAction.targetPlayerId = targetPlayerId;
    this.currentSpecialAction.selectedOtherCardId = cardId;

    this.logger.log(GameEventType.CARD_PEEKED, { playerId, targetPlayerId, cardId, type: 'otherPeek' });

    // Reveal card to the entire viewing team for 5 seconds
    this.emitEvent('game:cardRevealed', {
      cardId,
      targetPlayerId,
      card: { id: card.id, rank: card.rank, suit: card.suit, faceUp: true },
      durationMs: PEEK_DURATION_MS,
    }, teamPlayerIds);

    // Also notify the target team & opponents with faceUp: false so their screens scale up the card!
    const otherPlayerIds = this.getConnectedPlayerIds().filter(id => !teamPlayerIds.includes(id));
    this.emitEvent('game:cardRevealed', {
      cardId,
      targetPlayerId,
      card: { id: card.id, faceUp: false },
      durationMs: PEEK_DURATION_MS,
    }, otherPlayerIds);

    this.emitEvent('game:timerSync', {
      type: 'peekTimer',
      endsAt: Date.now() + PEEK_DURATION_MS,
      durationMs: PEEK_DURATION_MS,
    }, teamPlayerIds);

    this.timerManager.startTimer('peek', PEEK_DURATION_MS, () => {
      this.completeOtherPeek(playerId);
    });

    return { card };
  }

  private completeOtherPeek(playerId: string): void {
    this.timerManager.cancelTimersByType('peek');
    if (this.currentSpecialAction) {
      this.currentSpecialAction.phase = SpecialActionPhase.COMPLETE;
    }
    const teamPlayerIds = this.getTeamPlayerIds(playerId);
    this.emitEvent('game:timerExpired', { type: 'peekTimer' }, teamPlayerIds);
    this.emitEvent('game:cardRevealedExpired', {});
    this.emitEvent('game:specialAction', {
      type: SpecialPowerType.OTHER_PEEK,
      phase: SpecialActionPhase.COMPLETE,
      message: 'Card viewing complete',
    }, teamPlayerIds);
  }

  // ── Blind Exchange (Q) ──

  selectOwnExchangeCard(playerId: string, cardId: string): { error?: string } {
    if (!this.currentSpecialAction || this.currentSpecialAction.type !== SpecialPowerType.BLIND_EXCHANGE) {
      return { error: 'No exchange action active' };
    }
    const teamPlayerIds = this.getTeamPlayerIds(this.currentSpecialAction.triggerPlayerId);
    if (!teamPlayerIds.includes(playerId)) {
      return { error: 'This is not your special action' };
    }

    const hand = this.getPlayerHand(playerId);
    if (!hand) return { error: 'Hand not found' };

    const validation = validateExchangeOwnCard(playerId, cardId, hand);
    if (!validation.valid) return { error: validation.error };

    this.currentSpecialAction.selectedOwnCardId = cardId;
    this.currentSpecialAction.phase = SpecialActionPhase.SELECT_OTHER_CARD;

    this.emitEvent('game:specialAction', {
      type: SpecialPowerType.BLIND_EXCHANGE,
      phase: SpecialActionPhase.SELECT_OTHER_CARD,
      message: 'Now select a card from another player',
    }, teamPlayerIds);

    this.broadcastGameState();
    return {};
  }

  selectOtherExchangeCard(playerId: string, targetPlayerId: string, cardId: string): { error?: string } {
    if (!this.currentSpecialAction || this.currentSpecialAction.type !== SpecialPowerType.BLIND_EXCHANGE) {
      return { error: 'No exchange action active' };
    }
    const teamPlayerIds = this.getTeamPlayerIds(this.currentSpecialAction.triggerPlayerId);
    if (!teamPlayerIds.includes(playerId)) {
      return { error: 'This is not your special action' };
    }
    if (!this.currentSpecialAction.selectedOwnCardId) {
      return { error: 'Select your own card first' };
    }

    if (this.settings.mode === GameMode.TEAM) {
      const myTeamId = this.getPlayerTeamId(playerId);
      const targetTeamId = this.teamStates.has(targetPlayerId) ? targetPlayerId : this.getPlayerTeamId(targetPlayerId);
      if (myTeamId && targetTeamId && myTeamId === targetTeamId) {
        return { error: 'You cannot exchange with your own team' };
      }
    }

    const targetHand = this.getPlayerHand(targetPlayerId);
    if (!targetHand) return { error: 'Target player hand not found' };

    const validation = validateExchangeOtherCard(playerId, targetPlayerId, cardId, targetHand);
    if (!validation.valid) return { error: validation.error };

    const ownHand = this.getPlayerHand(playerId);
    if (!ownHand) return { error: 'Own hand not found' };

    // Execute the exchange
    const ownCardId = this.currentSpecialAction.selectedOwnCardId;
    const ownIndex = ownHand.indexOf(ownCardId);
    const otherIndex = targetHand.indexOf(cardId);

    if (ownIndex === -1 || otherIndex === -1) {
      return { error: 'Card not found in hand during exchange' };
    }

    const result = executeBlindExchange(ownHand, ownCardId, targetHand, cardId);

    // Update the hands
    this.setPlayerHand(playerId, result.ownHand);
    this.setPlayerHand(targetPlayerId, result.otherHand);

    // Reset card knowledge for swapped cards
    const myState = this.playerStates.get(playerId);
    if (myState) {
      myState.knownCardIds.delete(ownCardId);
      myState.knownCardIds.delete(cardId);
    }
    const targetState = this.playerStates.get(targetPlayerId);
    if (targetState) {
      targetState.knownCardIds.delete(cardId);
      targetState.knownCardIds.delete(ownCardId);
    }

    this.currentSpecialAction.phase = SpecialActionPhase.COMPLETE;

    this.logger.log(GameEventType.QUEEN_EXCHANGE, {
      playerId,
      targetPlayerId,
      ownCardId,
      otherCardId: cardId,
    });

    // Broadcast exchange animation
    this.emitEvent('game:exchangeComplete', {
      ownCardId,
      otherCardId: cardId,
      otherPlayerId: targetPlayerId,
    });

    this.emitEvent('game:specialAction', {
      type: SpecialPowerType.BLIND_EXCHANGE,
      phase: SpecialActionPhase.COMPLETE,
      message: 'Blind exchange complete! Click CONTINUE to end turn.',
    }, teamPlayerIds);

    this.broadcastGameState();
    return {};
  }

  // ── Acknowledge Special Action Complete ──

  acknowledgeSpecial(playerId: string): { error?: string } {
    if (!this.currentSpecialAction) return { error: 'No special action active' };
    const teamPlayerIds = this.getTeamPlayerIds(this.currentSpecialAction.triggerPlayerId);
    if (!teamPlayerIds.includes(playerId)) {
      return { error: 'This is not your special action' };
    }

    this.timerManager.cancelTimersByType('peek');
    this.emitEvent('game:cardRevealedExpired', {});
    this.currentSpecialAction = null;
    this.stateMachine.forcePhase(GamePhase.END_TURN);
    this.broadcastGameState();
    return {};
  }

  skipSpecial(playerId: string): { error?: string } {
    if (!this.currentSpecialAction) return { error: 'No special action active' };
    const teamPlayerIds = this.getTeamPlayerIds(this.currentSpecialAction.triggerPlayerId);
    if (!teamPlayerIds.includes(playerId)) {
      return { error: 'This is not your special action' };
    }

    this.timerManager.cancelTimersByType('peek');
    this.emitEvent('game:cardRevealedExpired', {});
    this.currentSpecialAction = null;
    this.stateMachine.forcePhase(GamePhase.END_TURN);
    this.broadcastGameState();
    return {};
  }

  // ════════════════════════════════════════════════════════
  // X REACTION (Real-time fast discard)
  // ════════════════════════════════════════════════════════

  private xReactionAttemptedPlayers = new Set<string>();
  private pendingPenaltyCards = new Map<string, string>();

  attemptXReaction(playerId: string, cardId: string): { error?: string } {
    if (this.discardPile.length === 0) return { error: 'No card in discard pile' };
    if (this.stateMachine.currentPhase === GamePhase.INITIAL_VIEW ||
        this.stateMachine.currentPhase === GamePhase.SHUFFLING ||
        this.stateMachine.currentPhase === GamePhase.DEALING ||
        this.stateMachine.currentPhase === GamePhase.GAME_OVER) {
      return { error: 'Fast discard not allowed in this phase' };
    }

    if (this.xReactionAttemptedPlayers.has(playerId)) {
      return { error: 'You have already used your fast discard chance for this card' };
    }

    const hand = this.getPlayerHand(playerId);
    if (!hand || !hand.includes(cardId)) {
      return { error: 'Card not in your hand' };
    }

    // Record that this player has taken their 1 chance for the current top discard
    this.xReactionAttemptedPlayers.add(playerId);

    const topDiscardId = this.discardPile[this.discardPile.length - 1];
    const topDiscardCard = this.allCards.get(topDiscardId)!;
    const candidateCard = this.allCards.get(cardId)!;

    // Check match: rank matches top discard ONLY (Jack is not wild)
    const isMatch = candidateCard.rank === topDiscardCard.rank;

    const player = this.players.get(playerId);

    if (isMatch) {
      // SUCCESS! Set slot to null to maintain fixed position
      const idx = hand.indexOf(cardId);
      if (idx !== -1) {
        hand[idx] = null;
        this.setPlayerHand(playerId, hand);
      }
      addToDiscardPile(this.discardPile, cardId);

      this.logger.log(GameEventType.X_REACTION_ATTEMPT, { playerId, cardId, success: true });

      // Broadcast discard
      this.emitEvent('game:cardDiscarded', {
        cardId,
        card: { id: candidateCard.id, rank: candidateCard.rank, suit: candidateCard.suit, faceUp: true },
        playerId,
      });

      // Check elimination
      const remainingCards = hand.filter(Boolean).length;
      if (remainingCards === 0) {
        this.eliminatePlayerOrTeam(playerId);
      }

      this.broadcastGameState();
      return {};
    } else {
      // MISMATCH: Reveal card to all players for 3s, then return & deal penalty card
      this.emitEvent('game:xReactionWrong', {
        playerId,
        playerName: player?.name || 'Unknown',
        card: { id: candidateCard.id, rank: candidateCard.rank, suit: candidateCard.suit, faceUp: true },
      });

      this.dealPenaltyCard(playerId);
      this.broadcastGameState();
      return { error: `❌ Wrong card (${candidateCard.rank})! +1 Penalty card dealt.` };
    }
  }

  private dealPenaltyCard(playerId: string): void {
    if (this.drawPile.length === 0) {
      this.recycleDiscard();
    }
    if (this.drawPile.length === 0) return;

    const cardId = drawFromPile(this.drawPile)!;
    this.pendingPenaltyCards.set(playerId, cardId);

    // Send placement choice prompt to penalized player
    this.emitEvent('game:penaltyPrompt', { cardId }, [playerId]);

    // Default fallback to RIGHT position after 12s if player doesn't choose
    setTimeout(() => {
      if (this.pendingPenaltyCards.has(playerId)) {
        this.placePenaltyCard(playerId, 'RIGHT');
      }
    }, 12000);
  }

  placePenaltyCard(
    playerId: string,
    position: 'LEFT' | 'RIGHT' | 'TOP_LEFT' | 'TOP_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_RIGHT' = 'RIGHT',
    slotIndex?: number,
  ): { error?: string } {
    const cardId = this.pendingPenaltyCards.get(playerId);
    if (!cardId) return { error: 'No pending penalty card' };

    this.pendingPenaltyCards.delete(playerId);

    const hand = this.getPlayerHand(playerId);
    if (hand) {
      if (typeof slotIndex === 'number' && slotIndex >= 0 && slotIndex < hand.length && hand[slotIndex] === null) {
        hand[slotIndex] = cardId;
      } else if (position === 'TOP_LEFT' || position === 'LEFT') {
        const firstEmptyIdx = hand.indexOf(null);
        if (firstEmptyIdx !== -1 && firstEmptyIdx === 0) {
          hand[0] = cardId;
        } else {
          hand.unshift(cardId);
        }
      } else if (position === 'TOP_RIGHT') {
        const cols = Math.max(2, Math.ceil(hand.length / 2));
        hand.splice(cols, 0, cardId);
      } else if (position === 'BOTTOM_LEFT') {
        const cols = Math.max(2, Math.ceil(hand.length / 2));
        hand.splice(cols, 0, cardId);
      } else {
        const lastEmptyIdx = hand.lastIndexOf(null);
        if (lastEmptyIdx !== -1 && lastEmptyIdx === hand.length - 1) {
          hand[lastEmptyIdx] = cardId;
        } else {
          hand.push(cardId);
        }
      }
      this.setPlayerHand(playerId, hand);
    }

    this.logger.log(GameEventType.PENALTY_DEALT, { playerId, cardId, position, slotIndex });
    this.emitEvent('game:penaltyCard', { playerId, cardCount: 1 });
    this.broadcastGameState();
    return {};
  }

  // ════════════════════════════════════════════════════════
  // PANDU
  // ════════════════════════════════════════════════════════

  callPandu(playerId: string): { error?: string } {
    if (!this.turnSystem) return { error: 'Game not started' };

    const isTurn = this.settings.mode === GameMode.TEAM
      ? (this.getPlayerTeamId(playerId) === this.turnSystem.activeTeamId)
      : (playerId === this.turnSystem.activePlayerId);

    const validation = validatePanduCall(
      playerId,
      isTurn ? playerId : 'not_active',
      this.panduState !== null,
      this.playerStates.get(playerId)?.isEliminated ?? true,
    );

    if (!validation.valid) return { error: validation.error };

    // Setup exactly 1 final round of turns after PANDU for all game modes
    this.turnSystem.setupFinalTurns(playerId, 1);

    const playerState = this.playerStates.get(playerId);
    if (playerState) playerState.calledPandu = true;

    const teamId = this.getPlayerTeamId(playerId);
    this.panduState = createPanduState(
      playerId,
      this.turnSystem.remainingFinalTurns,
      teamId,
    );

    this.logger.log(GameEventType.PANDU_CALLED, { playerId, teamId });

    const player = this.players.get(playerId);
    const remainingTurnNames = this.turnSystem.remainingFinalTurns.map(
      id => this.players.get(id)?.name || id
    );

    this.emitEvent('game:panduCalled', {
      playerId,
      playerName: player?.name || 'Unknown',
      remainingTurns: remainingTurnNames,
    });

    this.broadcastGameState();
    return {};
  }

  // ════════════════════════════════════════════════════════
  // END TURN
  // ════════════════════════════════════════════════════════

  endTurn(playerId: string): { error?: string } {
    if (!this.turnSystem) return { error: 'Game not started' };

    const isTurn = this.settings.mode === GameMode.TEAM
      ? (this.getPlayerTeamId(playerId) === this.turnSystem.activeTeamId)
      : (playerId === this.turnSystem.activePlayerId);

    if (!isTurn) {
      return { error: "It's not your turn" };
    }

    // Clean up any remaining special action
    this.timerManager.cancelTimersByType('peek');
    this.currentSpecialAction = null;

    // Advance turn
    this.turnSystem.advanceTurn();

    // Start next player's turn
    this.startPlayerTurn();
    return {};
  }

  // ════════════════════════════════════════════════════════
  // ENDGAME
  // ════════════════════════════════════════════════════════

  private eliminatePlayerOrTeam(playerId: string): void {
    if (this.settings.mode === GameMode.INDIVIDUAL) {
      const state = this.playerStates.get(playerId);
      if (state) {
        state.isEliminated = true;
        state.isSpectator = true;
        state.finishRank = this.nextFinishRank++;
        this.finishedOrder.push(playerId);
        this.turnSystem?.eliminatePlayer(playerId);
      }
    } else {
      const teamId = this.getPlayerTeamId(playerId);
      if (teamId) {
        const teamState = this.teamStates.get(teamId);
        if (teamState && teamState.handCardIds.length === 0) {
          teamState.isEliminated = true;
          teamState.finishRank = this.nextFinishRank++;
          this.finishedOrder.push(teamId);
          this.turnSystem?.eliminateTeam(teamId);

          // Mark all team members as spectators
          const team = this.teams.get(teamId);
          if (team) {
            for (const pid of team.playerIds) {
              const ps = this.playerStates.get(pid);
              if (ps) {
                ps.isEliminated = true;
                ps.isSpectator = true;
              }
            }
          }
        }
      }
    }

    const player = this.players.get(playerId);
    this.logger.log(GameEventType.PLAYER_ELIMINATED, { playerId, playerName: player?.name });
    this.emitEvent('game:playerEliminated', {
      playerId,
      playerName: player?.name || 'Unknown',
      rank: this.nextFinishRank - 1,
    });

    // Check if game is over
    if (this.turnSystem?.isGameEffectivelyOver()) {
      this.revealAndScore();
      return;
    }

    // When 0 cards remaining and it was active player's turn, auto-advance immediately to next player
    if (this.turnSystem && this.turnSystem.activePlayerId === playerId) {
      this.turnSystem.advanceTurn();
      this.startPlayerTurn();
    }
  }

  private revealAndScore(): void {
    this.stateMachine.forcePhase(GamePhase.REVEAL);

    // Reveal all hands
    const allHands: Record<string, ClientCard[]> = {};

    if (this.settings.mode === GameMode.INDIVIDUAL) {
      for (const [playerId, state] of this.playerStates) {
        allHands[playerId] = state.handCardIds
          .filter((id): id is string => id !== null)
          .map(id => {
            const card = this.allCards.get(id)!;
            return { id: card.id, rank: card.rank, suit: card.suit, faceUp: true };
          });
      }
    } else {
      for (const [teamId, state] of this.teamStates) {
        allHands[teamId] = state.handCardIds
          .filter((id): id is string => id !== null)
          .map(id => {
            const card = this.allCards.get(id)!;
            return { id: card.id, rank: card.rank, suit: card.suit, faceUp: true };
          });
      }
    }

    this.emitEvent('game:reveal', { allHands });

    // Calculate scores
    this.stateMachine.forcePhase(GamePhase.SCORING);

    const scoreData = [];
    if (this.settings.mode === GameMode.INDIVIDUAL) {
      for (const [playerId, state] of this.playerStates) {
        const player = this.players.get(playerId);
        scoreData.push({
          playerId,
          playerName: player?.name || 'Unknown',
          avatarId: player?.avatarId || 0,
          cards: state.handCardIds
            .filter((id): id is string => id !== null)
            .map(id => this.allCards.get(id)!),
          calledPandu: state.calledPandu,
          preAssignedRank: state.finishRank,
        });
      }
    } else {
      for (const [teamId, state] of this.teamStates) {
        const team = this.teams.get(teamId);
        scoreData.push({
          playerId: teamId,
          playerName: team?.name || 'Unknown',
          avatarId: 0,
          teamId,
          teamName: team?.name,
          cards: state.handCardIds
            .filter((id): id is string => id !== null)
            .map(id => this.allCards.get(id)!),
          calledPandu: state.calledPandu,
          preAssignedRank: state.finishRank,
        });
      }
    }

    const scores = calculateFinalScores(scoreData);
    this.previousScores = scores;

    this.stateMachine.forcePhase(GamePhase.GAME_OVER);

    this.logger.log(GameEventType.GAME_ENDED, { scores });
    this.emitEvent('game:gameOver', { scores });
    this.broadcastGameState();
  }

  private rematchVotes = new Set<string>();

  // ════════════════════════════════════════════════════════
  // REMATCH & LOBBY RETURN
  // ════════════════════════════════════════════════════════

  requestRematch(playerId?: string): void {
    if (this.stateMachine.currentPhase !== GamePhase.GAME_OVER) return;

    if (playerId) {
      this.rematchVotes.add(playerId);
    }

    const connectedPlayers = this.getConnectedPlayerIds();
    const votesArray = Array.from(this.rematchVotes).filter(id => connectedPlayers.includes(id));

    this.emitEvent('game:rematchVotesUpdate', {
      votes: votesArray,
      totalConnected: connectedPlayers.length,
    });

    // When all connected players have voted for rematch (or if host calls when alone):
    if (votesArray.length >= connectedPlayers.length && connectedPlayers.length > 0) {
      this.rematchVotes.clear();
      this.stateMachine.forcePhase(GamePhase.LOBBY);
      this.startGame();
    }
  }

  returnToLobby(): void {
    this.rematchVotes.clear();
    // Reset all player ready states
    for (const player of this.players.values()) {
      player.isReady = false;
    }

    this.stateMachine.forcePhase(GamePhase.LOBBY);
    this.logger.log(GameEventType.REMATCH_STARTED, {});
    this.emitEvent('game:returnToLobby', {});
    this.broadcastRoomState();
  }

  // ════════════════════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════════════════════

  private getPlayerHand(entityId: string): (string | null)[] | null {
    if (this.settings.mode === GameMode.INDIVIDUAL) {
      return this.playerStates.get(entityId)?.handCardIds ?? null;
    } else {
      if (this.teamStates.has(entityId)) {
        return this.teamStates.get(entityId)?.handCardIds ?? null;
      }
      const teamId = this.getPlayerTeamId(entityId);
      if (teamId) {
        return this.teamStates.get(teamId)?.handCardIds ?? null;
      }
      return null;
    }
  }

  private setPlayerHand(entityId: string, hand: (string | null)[]): void {
    if (this.settings.mode === GameMode.INDIVIDUAL) {
      const state = this.playerStates.get(entityId);
      if (state) state.handCardIds = hand;
    } else {
      if (this.teamStates.has(entityId)) {
        const state = this.teamStates.get(entityId);
        if (state) state.handCardIds = hand;
        return;
      }
      const teamId = this.getPlayerTeamId(entityId);
      if (!teamId) return;
      const state = this.teamStates.get(teamId);
      if (state) state.handCardIds = hand;
    }
  }

  private getPlayerTeamId(playerId: string): string | undefined {
    for (const [teamId, team] of this.teams) {
      if (team.playerIds.includes(playerId)) return teamId;
    }
    return undefined;
  }

  private recycleDiscard(): void {
    const { newDrawPile, remainingDiscards } = recycleDiscardPile(this.discardPile);
    this.drawPile = newDrawPile;
    this.discardPile = remainingDiscards;

    this.emitEvent('game:deckRecycled', { newDrawPileCount: newDrawPile.length });
  }

  private getTeamPlayerIds(playerId: string): string[] {
    if (this.settings.mode !== GameMode.TEAM) return [playerId];
    const teamId = this.getPlayerTeamId(playerId);
    if (!teamId) return [playerId];
    const team = this.teams.get(teamId);
    return team ? [...team.playerIds] : [playerId];
  }

  // ════════════════════════════════════════════════════════
  // STATE SERIALIZATION (for clients)
  // ════════════════════════════════════════════════════════

  /**
   * Get the filtered game state for a specific player.
   * Never includes hidden card information belonging to other players.
   */
  getClientGameState(playerId: string): ClientGameState {
    const playerState = this.playerStates.get(playerId);
    const isTeamMode = this.settings.mode === GameMode.TEAM;
    const teamId = this.getPlayerTeamId(playerId);

    // My hand — always face down on the table in physical gameplay (shared by team in Team Mode)
    const hand = this.getPlayerHand(playerId) || [];
    const myHand: (ClientCard | null)[] = hand.map(id => id ? ({
      id,
      faceUp: false,
    }) : null);

    // Visible discards (top 2)
    const visibleDiscardIds = getVisibleDiscards(this.discardPile, 2);
    const visibleDiscards: ClientCard[] = visibleDiscardIds.map(id => {
      const card = this.allCards.get(id)!;
      return { id, rank: card.rank, suit: card.suit, faceUp: true };
    });

    // Opponents (In Team mode: exactly 1 opponent team with 1 hand)
    const opponents: ClientOpponent[] = [];
    if (!isTeamMode) {
      for (const [pid, player] of this.players) {
        if (pid === playerId) continue;
        const opponentState = this.playerStates.get(pid);
        const opponentHand = this.getPlayerHand(pid) || [];

        opponents.push({
          playerId: pid,
          name: player.name,
          avatarId: player.avatarId,
          cardCount: opponentHand.filter(Boolean).length,
          cards: opponentHand.map(id => id ? ({ id, faceUp: false }) : null),
          isActive: this.turnSystem?.activePlayerId === pid,
          isConnected: player.isConnected,
          isEliminated: opponentState?.isEliminated || false,
        });
      }
    } else {
      for (const [otherTeamId, team] of this.teams) {
        if (otherTeamId === teamId) continue;
        const teamState = this.teamStates.get(otherTeamId);
        const teamHand = teamState?.handCardIds || [];
        const isTeamActive = this.turnSystem?.activeTeamId === otherTeamId;

        const teamMemberNames = team.playerIds
          .map(pid => this.players.get(pid)?.name || 'Player')
          .join(' & ');

        const firstPlayer = team.playerIds[0] ? this.players.get(team.playerIds[0]) : undefined;

        opponents.push({
          playerId: otherTeamId,
          name: `${team.name} (${teamMemberNames})`,
          avatarId: firstPlayer?.avatarId || 0,
          cardCount: teamHand.filter(Boolean).length,
          cards: teamHand.map(id => id ? ({ id, faceUp: false }) : null),
          isActive: isTeamActive,
          isConnected: team.playerIds.some(pid => this.players.get(pid)?.isConnected),
          isEliminated: teamState?.isEliminated || false,
          teamId: otherTeamId,
          teamName: team.name,
        });
      }
    }

    // Drawn card (visible to both teammates when active in Team Mode)
    let drawnCard: ClientCard | undefined;
    const isTeamTurn = isTeamMode && teamId !== undefined && this.turnSystem?.activeTeamId === teamId;
    const isIndividualTurn = !isTeamMode && this.turnSystem?.activePlayerId === playerId;

    if (this.drawnCardId && (isIndividualTurn || isTeamTurn)) {
      const card = this.allCards.get(this.drawnCardId)!;
      drawnCard = { id: card.id, rank: card.rank, suit: card.suit, faceUp: true };
    }

    // Special Action (visible to both teammates in Team Mode)
    const isSpecialForMyTeam = isTeamMode && teamId !== undefined && (
      this.currentSpecialAction !== null && this.getPlayerTeamId(this.currentSpecialAction.triggerPlayerId) === teamId
    );
    const isSpecialForMe = this.currentSpecialAction && (
      this.currentSpecialAction.triggerPlayerId === playerId || isSpecialForMyTeam
    );

    const specialAction = isSpecialForMe && this.currentSpecialAction ? {
      type: this.currentSpecialAction.type,
      phase: this.currentSpecialAction.phase,
      message: getSpecialPowerMessage(this.currentSpecialAction.type),
    } : undefined;

    return {
      phase: this.stateMachine.currentPhase,
      settings: { ...this.settings },
      drawPileCount: this.drawPile.length,
      visibleDiscards,
      myHand,
      opponents,
      turnNumber: this.turnSystem?.currentTurnIndex ?? 0,
      activePlayerId: this.turnSystem?.activePlayerId ?? '',
      activeTeamId: this.turnSystem?.activeTeamId,
      isMyTurn: isIndividualTurn || isTeamTurn,
      drawnCard,
      specialAction,
      xReaction: this.xReactionWindow ? {
        isActive: !this.xReactionWindow.resolved,
        timeRemainingMs: Math.max(0, this.xReactionWindow.windowEndsAt - Date.now()),
      } : undefined,
      panduState: this.panduState ? {
        callerName: this.players.get(this.panduState.callerPlayerId)?.name || (
          this.panduState.callerTeamId ? this.teams.get(this.panduState.callerTeamId)?.name : 'Unknown'
        ) || 'Unknown',
        remainingTurnNames: this.turnSystem?.remainingFinalTurns.map(
          id => this.players.get(id)?.name || id
        ) || [],
      } : undefined,
      timer: undefined,
      finishedPlayers: this.finishedOrder,
    };
  }

  /**
   * Get the room state for clients (lobby view).
   */
  getClientRoomState(): ClientRoomState {
    return {
      code: this.code,
      hostId: this.hostId,
      players: Array.from(this.players.values()).map(p => ({
        ...p,
        socketId: undefined,
        sessionToken: undefined,
      })) as Player[],
      teams: Array.from(this.teams.values()).map(t => ({
        id: t.id,
        name: t.name,
        playerIds: t.playerIds,
      })),
      settings: { ...this.settings },
      gamePhase: this.stateMachine.currentPhase,
    };
  }

  /**
   * Broadcast the full game state to all connected players.
   * Each player receives their own filtered view.
   */
  broadcastGameState(): void {
    for (const player of this.players.values()) {
      if (!player.isConnected) continue;
      const state = this.getClientGameState(player.id);
      this.emitEvent('game:stateUpdate', state, [player.id]);
    }
  }

  broadcastRoomState(): void {
    const roomState = this.getClientRoomState();
    this.emitEvent('room:updated', roomState);
  }

  // ── Accessors ──
  get gamePhase(): GamePhase {
    return this.stateMachine.currentPhase;
  }

  get isHost(): string {
    return this.hostId;
  }

  get gameSettings(): GameSettings {
    return { ...this.settings };
  }

  get playerCount(): number {
    return this.players.size;
  }
}
