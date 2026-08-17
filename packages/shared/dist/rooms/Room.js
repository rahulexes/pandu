// ============================================================
// PANDU — Room (Game Controller)
// ============================================================
import { DECK_SIZE, INITIAL_VIEW_DURATION_MS, PEEK_DURATION_MS, DEFAULT_CARDS_DEALT, DEFAULT_INITIAL_VIEWABLE, DEFAULT_QUEEN_COUNT, } from '../constants';
import { GamePhase, SpecialPowerType, SpecialActionPhase, } from '../gameStates';
import { GameMode, GameEventType, } from '../types';
import { GameStateMachine } from '../engine/GameStateMachine';
import { TurnSystem } from '../engine/TurnSystem';
import { createDeck, shuffleDeck, dealCards, drawFromPile, addToDiscardPile, recycleDiscardPile, getVisibleDiscards, } from '../engine/Deck';
import { getSpecialPower, validateSelfPeek, validateOtherPeek, validateExchangeOwnCard, validateExchangeOtherCard, executeBlindExchange, getSpecialPowerMessage } from '../engine/SpecialPowers';
import { validatePanduCall, createPanduState } from '../engine/PanduSystem';
import { calculateFinalScores } from '../engine/ScoringSystem';
import { TimerManager } from '../engine/TimerManager';
import { GameLogger } from '../engine/GameLogger';
function generateId() {
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
export class Room {
    id;
    code;
    players = new Map();
    hostId = '';
    teams = new Map();
    settings = {
        mode: GameMode.INDIVIDUAL,
        cardsDealt: DEFAULT_CARDS_DEALT,
        initialViewable: DEFAULT_INITIAL_VIEWABLE,
        queenCount: DEFAULT_QUEEN_COUNT,
    };
    stateMachine;
    turnSystem = null;
    allCards = new Map();
    drawPile = [];
    discardPile = [];
    playerStates = new Map();
    teamStates = new Map();
    drawnCardId = null;
    currentSpecialAction = null;
    xReactionWindow = null;
    panduState = null;
    finishedOrder = [];
    nextFinishRank = 1;
    previousScores = [];
    timerManager;
    logger;
    emitEvent;
    sessionTokens = new Map();
    bannedPlayers = new Map();
    constructor(code, emitEvent) {
        this.id = generateId();
        this.code = code;
        this.stateMachine = new GameStateMachine(GamePhase.LOBBY);
        this.timerManager = new TimerManager();
        this.logger = new GameLogger(this.id);
        this.emitEvent = emitEvent;
    }
    addPlayer(name, avatarId, socketId) {
        if (this.stateMachine.currentPhase !== GamePhase.LOBBY && this.stateMachine.currentPhase !== GamePhase.GAME_OVER) {
            return { error: 'Cannot join — game is in progress' };
        }
        // Check 1-minute kick cooldown
        const bannedUntil = this.bannedPlayers.get(name.trim().toLowerCase());
        if (bannedUntil && Date.now() < bannedUntil) {
            const remainingSec = Math.ceil((bannedUntil - Date.now()) / 1000);
            return { error: `You were kicked from this room. Cooldown active (${remainingSec}s remaining).` };
        }
        const playerId = generateId();
        const sessionToken = generateId();
        const isHost = this.players.size === 0;
        const player = {
            id: playerId,
            name,
            avatarId,
            isHost,
            isReady: false,
            isConnected: true,
            socketId,
        };
        this.players.set(playerId, player);
        if (isHost)
            this.hostId = playerId;
        this.sessionTokens.set(sessionToken, playerId);
        this.logger.log(GameEventType.PLAYER_JOINED, { playerId, name });
        return { player, sessionToken };
    }
    kickPlayer(hostId, targetPlayerId) {
        const isHost = hostId === this.hostId || (this.players.get(hostId)?.isHost ?? false) || this.players.size <= 1;
        if (!isHost)
            return { error: 'Only the host can kick players' };
        if (targetPlayerId === this.hostId)
            return { error: 'Host cannot kick themselves' };
        const targetPlayer = this.players.get(targetPlayerId);
        if (!targetPlayer)
            return { error: 'Player not found' };
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
    reconnectPlayer(sessionToken, socketId) {
        const playerId = this.sessionTokens.get(sessionToken);
        if (!playerId)
            return null;
        const player = this.players.get(playerId);
        if (!player)
            return null;
        player.isConnected = true;
        player.socketId = socketId;
        this.logger.log(GameEventType.PLAYER_RECONNECTED, { playerId });
        return player;
    }
    removePlayer(playerId) {
        const player = this.players.get(playerId);
        if (!player)
            return {};
        this.players.delete(playerId);
        this.logger.log(GameEventType.PLAYER_LEFT, { playerId });
        for (const [, team] of this.teams) {
            team.playerIds = team.playerIds.filter(id => id !== playerId);
        }
        let newHostId;
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
    disconnectPlayer(playerId) {
        const player = this.players.get(playerId);
        if (player) {
            player.isConnected = false;
            this.logger.log(GameEventType.PLAYER_DISCONNECTED, { playerId });
        }
    }
    getPlayer(playerId) {
        return this.players.get(playerId);
    }
    getPlayerBySocketId(socketId) {
        for (const player of this.players.values()) {
            if (player.socketId === socketId)
                return player;
        }
        return undefined;
    }
    getAllPlayers() {
        return Array.from(this.players.values());
    }
    getConnectedPlayerIds() {
        return Array.from(this.players.values())
            .filter(p => p.isConnected)
            .map(p => p.id);
    }
    setMode(hostId, mode) {
        const isHost = hostId === this.hostId || (this.players.get(hostId)?.isHost ?? false) || this.players.size <= 1;
        if (!isHost)
            return { error: 'Only the host can change mode' };
        if (this.stateMachine.currentPhase !== GamePhase.LOBBY)
            return { error: 'Can only change mode in lobby' };
        this.settings.mode = mode;
        if (mode === GameMode.TEAM) {
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
        }
        else {
            this.teams.clear();
        }
        this.emitEvent('lobby:settingsUpdated', this.settings);
        this.broadcastRoomState();
        return {};
    }
    updateSettings(hostId, updates) {
        const isHost = hostId === this.hostId || (this.players.get(hostId)?.isHost ?? false) || this.players.size <= 1;
        if (!isHost)
            return { error: 'Only the host can change settings' };
        if (this.stateMachine.currentPhase !== GamePhase.LOBBY)
            return { error: 'Can only change settings in lobby' };
        if (updates.cardsDealt !== undefined) {
            this.settings.cardsDealt = updates.cardsDealt;
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
    toggleReady(playerId) {
        const player = this.players.get(playerId);
        if (!player)
            return false;
        player.isReady = !player.isReady;
        return player.isReady;
    }
    joinTeam(playerId, teamId) {
        if (this.settings.mode !== GameMode.TEAM)
            return { error: 'Not in team mode' };
        const team = this.teams.get(teamId);
        if (!team)
            return { error: 'Invalid team' };
        if (team.playerIds.length >= 4)
            return { error: 'Team is full (max 4)' };
        for (const [, t] of this.teams) {
            t.playerIds = t.playerIds.filter(id => id !== playerId);
        }
        team.playerIds.push(playerId);
        return {};
    }
    canStartGame(hostId) {
        if (hostId !== this.hostId)
            return { canStart: false, error: 'Only the host can start the game' };
        if (this.stateMachine.currentPhase !== GamePhase.LOBBY)
            return { canStart: false, error: 'Game already started' };
        const allPlayers = Array.from(this.players.values());
        if (allPlayers.length < 2)
            return { canStart: false, error: 'Need at least 2 players' };
        if (!allPlayers.every(p => p.isReady || p.id === this.hostId)) {
            return { canStart: false, error: 'Not all players are ready' };
        }
        const totalCardsNeeded = this.settings.mode === GameMode.INDIVIDUAL
            ? allPlayers.length * this.settings.cardsDealt
            : Array.from(this.teams.values()).filter(t => t.playerIds.length > 0).length * this.settings.cardsDealt;
        if (totalCardsNeeded > DECK_SIZE - 2) {
            return { canStart: false, error: `Not enough cards (need ${totalCardsNeeded}, only ${DECK_SIZE - 2} available)` };
        }
        if (this.settings.mode === GameMode.TEAM) {
            const activeTeams = Array.from(this.teams.values()).filter(t => t.playerIds.length > 0);
            if (activeTeams.length < 2)
                return { canStart: false, error: 'Need at least 2 teams with players' };
        }
        return { canStart: true };
    }
    startGame() {
        this.stateMachine.forcePhase(GamePhase.SHUFFLING);
        this.logger.log(GameEventType.GAME_STARTED, { settings: this.settings });
        const deck = createDeck();
        this.allCards.clear();
        for (const card of deck) {
            this.allCards.set(card.id, card);
        }
        const cardIds = deck.map(c => c.id);
        shuffleDeck(cardIds);
        this.emitEvent('game:shuffleStart', {});
        this.stateMachine.forcePhase(GamePhase.DEALING);
        let entities;
        if (this.settings.mode === GameMode.INDIVIDUAL) {
            entities = Array.from(this.players.keys());
        }
        else {
            entities = Array.from(this.teams.values())
                .filter(t => t.playerIds.length > 0)
                .map(t => t.id);
        }
        const { hands, remainingDrawPile } = dealCards(cardIds, entities, this.settings.cardsDealt);
        this.drawPile = remainingDrawPile;
        this.discardPile = [];
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
        }
        else {
            for (const [teamId, team] of this.teams) {
                if (team.playerIds.length === 0)
                    continue;
                this.teamStates.set(teamId, {
                    teamId,
                    handCardIds: hands.get(teamId) || [],
                    knownCardIds: new Set(),
                    initialPeeksUsed: 0,
                    isEliminated: false,
                    calledPandu: false,
                    currentPlayerIndex: 0,
                });
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
        const playerOrder = Array.from(this.players.keys());
        const teamOrder = Array.from(this.teams.values())
            .filter(t => t.playerIds.length > 0)
            .map(t => t.id);
        const teamPlayerMap = new Map();
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
        this.emitEvent('game:dealStart', {
            playerOrder: entities,
            cardsPerPlayer: this.settings.cardsDealt,
        });
        this.logger.log(GameEventType.CARDS_DEALT, {
            cardsPerEntity: this.settings.cardsDealt,
            entities: entities.length,
        });
        this.startInitialViewPhase();
    }
    startInitialViewPhase() {
        this.stateMachine.forcePhase(GamePhase.INITIAL_VIEW);
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
        this.broadcastGameState();
    }
    peekInitialCard(playerId, cardId) {
        if (this.stateMachine.currentPhase !== GamePhase.INITIAL_VIEW) {
            return { error: 'Not in initial viewing phase' };
        }
        let hand;
        let peeksUsed;
        let maxPeeks = this.settings.initialViewable;
        if (this.settings.mode === GameMode.INDIVIDUAL) {
            const state = this.playerStates.get(playerId);
            if (!state)
                return { error: 'Player not found' };
            hand = state.handCardIds;
            peeksUsed = state.initialPeeksUsed;
        }
        else {
            const teamId = this.getPlayerTeamId(playerId);
            if (!teamId)
                return { error: 'Player not on a team' };
            const teamState = this.teamStates.get(teamId);
            if (!teamState)
                return { error: 'Team state not found' };
            hand = teamState.handCardIds;
            peeksUsed = teamState.initialPeeksUsed;
        }
        if (peeksUsed >= maxPeeks) {
            return { error: `You have already viewed ${maxPeeks} cards` };
        }
        if (!hand.includes(cardId)) {
            return { error: 'Card is not in your hand' };
        }
        const teamId = this.getPlayerTeamId(playerId);
        const isAlreadyPeeked = this.settings.mode === GameMode.INDIVIDUAL
            ? (this.playerStates.get(playerId)?.knownCardIds.has(cardId) ?? false)
            : (teamId ? (this.teamStates.get(teamId)?.knownCardIds.has(cardId) ?? false) : false);
        if (isAlreadyPeeked) {
            return { error: 'This card has already been viewed' };
        }
        const card = this.allCards.get(cardId);
        if (!card)
            return { error: 'Card not found' };
        if (this.settings.mode === GameMode.INDIVIDUAL) {
            const state = this.playerStates.get(playerId);
            state.initialPeeksUsed++;
            state.knownCardIds.add(cardId);
        }
        else {
            const teamId = this.getPlayerTeamId(playerId);
            const teamState = this.teamStates.get(teamId);
            teamState.initialPeeksUsed++;
            teamState.knownCardIds.add(cardId);
            const team = this.teams.get(teamId);
            for (const pid of team.playerIds) {
                const ps = this.playerStates.get(pid);
                if (ps)
                    ps.knownCardIds.add(cardId);
            }
        }
        this.logger.log(GameEventType.CARD_PEEKED, { playerId, cardId, phase: 'initial' });
        const teamPlayerIds = this.getTeamPlayerIds(playerId);
        this.emitEvent('game:cardPeeked', {
            cardId,
            card: { id: card.id, rank: card.rank, suit: card.suit, faceUp: true },
        }, teamPlayerIds);
        this.broadcastGameState();
        return { card };
    }
    endInitialViewPhase() {
        this.timerManager.cancelTimersByType('initialView');
        this.emitEvent('game:timerExpired', { type: 'initialView' });
        this.startPlayerTurn();
    }
    startPlayerTurn() {
        if (!this.turnSystem)
            return;
        this.xReactionAttemptedPlayers.clear();
        let attempts = 0;
        while (attempts < this.players.size) {
            const activeId = this.turnSystem.activePlayerId;
            const hand = this.getPlayerHand(activeId);
            if (hand && hand.length === 0 && !this.turnSystem.isGameEffectivelyOver()) {
                this.turnSystem.advanceTurn();
                attempts++;
            }
            else {
                break;
            }
        }
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
        this.broadcastGameState();
    }
    drawCard(playerId) {
        if (!this.turnSystem)
            return { error: 'Game not started' };
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
        if (this.drawPile.length === 0) {
            this.recycleDiscard();
        }
        if (this.drawPile.length === 0) {
            return { error: 'No cards available to draw' };
        }
        const cardId = drawFromPile(this.drawPile);
        this.drawnCardId = cardId;
        const card = this.allCards.get(cardId);
        this.stateMachine.forcePhase(GamePhase.CARD_DECISION);
        this.logger.log(GameEventType.CARD_DRAWN, { playerId, cardId });
        const teamPlayerIds = this.getTeamPlayerIds(playerId);
        this.emitEvent('game:cardDrawn', { card: { id: card.id, rank: card.rank, suit: card.suit, faceUp: true } }, teamPlayerIds);
        const otherPlayerIds = this.getConnectedPlayerIds().filter(id => !teamPlayerIds.includes(id));
        this.emitEvent('game:cardDrawn', { card: { id: card.id, faceUp: false } }, otherPlayerIds);
        this.broadcastGameState();
        return { card };
    }
    discardDrawnCard(playerId) {
        if (!this.turnSystem)
            return { error: 'Game not started' };
        if (this.stateMachine.currentPhase !== GamePhase.CARD_DECISION)
            return { error: 'Cannot discard now' };
        const isTurn = this.settings.mode === GameMode.TEAM
            ? (this.getPlayerTeamId(playerId) === this.turnSystem.activeTeamId)
            : (playerId === this.turnSystem.activePlayerId);
        if (!isTurn)
            return { error: "It's not your turn" };
        if (!this.drawnCardId)
            return { error: 'No card drawn' };
        const cardId = this.drawnCardId;
        const card = this.allCards.get(cardId);
        addToDiscardPile(this.discardPile, cardId);
        this.drawnCardId = null;
        this.xReactionAttemptedPlayers.clear();
        this.logger.log(GameEventType.CARD_DISCARDED, { playerId, cardId, rank: card.rank, suit: card.suit });
        this.emitEvent('game:cardDiscarded', {
            cardId,
            card: { id: card.id, rank: card.rank, suit: card.suit, faceUp: true },
        });
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
    replaceHandCard(playerId, handCardId) {
        if (!this.turnSystem)
            return { error: 'Game not started' };
        if (this.stateMachine.currentPhase !== GamePhase.CARD_DECISION)
            return { error: 'Cannot replace now' };
        const isTurn = this.settings.mode === GameMode.TEAM
            ? (this.getPlayerTeamId(playerId) === this.turnSystem.activeTeamId)
            : (playerId === this.turnSystem.activePlayerId);
        if (!isTurn)
            return { error: "It's not your turn" };
        if (!this.drawnCardId)
            return { error: 'No card drawn' };
        let hand;
        if (this.settings.mode === GameMode.INDIVIDUAL) {
            const state = this.playerStates.get(playerId);
            if (!state)
                return { error: 'Player state not found' };
            hand = state.handCardIds;
        }
        else {
            const teamId = this.getPlayerTeamId(playerId);
            if (!teamId)
                return { error: 'Player not on a team' };
            const teamState = this.teamStates.get(teamId);
            if (!teamState)
                return { error: 'Team state not found' };
            hand = teamState.handCardIds;
        }
        if (!hand.includes(handCardId)) {
            return { error: 'Selected card is not in your hand' };
        }
        const drawnCardId = this.drawnCardId;
        const drawnCard = this.allCards.get(drawnCardId);
        const discardedCard = this.allCards.get(handCardId);
        const handIndex = hand.indexOf(handCardId);
        hand[handIndex] = drawnCardId;
        addToDiscardPile(this.discardPile, handCardId);
        this.drawnCardId = null;
        this.xReactionAttemptedPlayers.clear();
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
        this.emitEvent('game:cardReplaced', {
            oldCardId: handCardId,
            newCard: { id: drawnCardId, faceUp: false },
            discardedCard: { id: handCardId, rank: discardedCard.rank, suit: discardedCard.suit, faceUp: true },
            handPosition: handIndex,
        });
        const specialPower = getSpecialPower(discardedCard);
        if (specialPower !== SpecialPowerType.NONE) {
            const spResult = this.triggerSpecialPower(specialPower, playerId);
            this.broadcastGameState();
            return spResult;
        }
        if (hand.length === 0) {
            this.eliminatePlayerOrTeam(playerId);
        }
        this.stateMachine.forcePhase(GamePhase.END_TURN);
        this.broadcastGameState();
        return {};
    }
    triggerSpecialPower(type, playerId) {
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
    selectSelfPeekCard(playerId, cardId) {
        if (!this.currentSpecialAction || this.currentSpecialAction.type !== SpecialPowerType.SELF_PEEK) {
            return { error: 'No self-peek action active' };
        }
        const teamPlayerIds = this.getTeamPlayerIds(this.currentSpecialAction.triggerPlayerId);
        if (!teamPlayerIds.includes(playerId)) {
            return { error: 'This is not your special action' };
        }
        const hand = this.getPlayerHand(playerId);
        if (!hand)
            return { error: 'Hand not found' };
        const validation = validateSelfPeek(playerId, cardId, hand);
        if (!validation.valid)
            return { error: validation.error };
        const card = this.allCards.get(cardId);
        for (const pid of teamPlayerIds) {
            const ps = this.playerStates.get(pid);
            if (ps)
                ps.knownCardIds.add(cardId);
        }
        this.currentSpecialAction.phase = SpecialActionPhase.SHOWING_CARD;
        this.currentSpecialAction.selectedCardId = cardId;
        this.logger.log(GameEventType.CARD_PEEKED, { playerId, cardId, type: 'selfPeek' });
        this.emitEvent('game:cardRevealed', {
            cardId,
            targetPlayerId: playerId,
            card: { id: card.id, rank: card.rank, suit: card.suit, faceUp: true },
            durationMs: PEEK_DURATION_MS,
        }, teamPlayerIds);
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
        this.timerManager.startTimer('peek', PEEK_DURATION_MS, () => {
            this.completeSelfPeek(playerId);
        });
        return { card };
    }
    completeSelfPeek(playerId) {
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
    selectOtherPeekCard(playerId, targetPlayerId, cardId) {
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
        if (!targetHand)
            return { error: 'Target player hand not found' };
        const validation = validateOtherPeek(playerId, targetPlayerId, cardId, targetHand);
        if (!validation.valid)
            return { error: validation.error };
        const card = this.allCards.get(cardId);
        this.currentSpecialAction.phase = SpecialActionPhase.SHOWING_CARD;
        this.currentSpecialAction.targetPlayerId = targetPlayerId;
        this.currentSpecialAction.selectedOtherCardId = cardId;
        this.logger.log(GameEventType.CARD_PEEKED, { playerId, targetPlayerId, cardId, type: 'otherPeek' });
        this.emitEvent('game:cardRevealed', {
            cardId,
            targetPlayerId,
            card: { id: card.id, rank: card.rank, suit: card.suit, faceUp: true },
            durationMs: PEEK_DURATION_MS,
        }, teamPlayerIds);
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
    completeOtherPeek(playerId) {
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
    selectOwnExchangeCard(playerId, cardId) {
        if (!this.currentSpecialAction || this.currentSpecialAction.type !== SpecialPowerType.BLIND_EXCHANGE) {
            return { error: 'No exchange action active' };
        }
        const teamPlayerIds = this.getTeamPlayerIds(this.currentSpecialAction.triggerPlayerId);
        if (!teamPlayerIds.includes(playerId)) {
            return { error: 'This is not your special action' };
        }
        const hand = this.getPlayerHand(playerId);
        if (!hand)
            return { error: 'Hand not found' };
        const validation = validateExchangeOwnCard(playerId, cardId, hand);
        if (!validation.valid)
            return { error: validation.error };
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
    selectOtherExchangeCard(playerId, targetPlayerId, cardId) {
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
        if (!targetHand)
            return { error: 'Target player hand not found' };
        const validation = validateExchangeOtherCard(playerId, targetPlayerId, cardId, targetHand);
        if (!validation.valid)
            return { error: validation.error };
        const ownHand = this.getPlayerHand(playerId);
        if (!ownHand)
            return { error: 'Own hand not found' };
        const ownCardId = this.currentSpecialAction.selectedOwnCardId;
        const ownIndex = ownHand.indexOf(ownCardId);
        const otherIndex = targetHand.indexOf(cardId);
        if (ownIndex === -1 || otherIndex === -1) {
            return { error: 'Card not found in hand during exchange' };
        }
        const result = executeBlindExchange(ownHand, ownCardId, targetHand, cardId);
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
    acknowledgeSpecial(playerId) {
        if (!this.currentSpecialAction)
            return { error: 'No special action active' };
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
    skipSpecial(playerId) {
        if (!this.currentSpecialAction)
            return { error: 'No special action active' };
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
    xReactionAttemptedPlayers = new Set();
    pendingPenaltyCards = new Map();
    attemptXReaction(playerId, cardId) {
        if (this.discardPile.length === 0)
            return { error: 'No card in discard pile' };
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
        const topDiscardCard = this.allCards.get(topDiscardId);
        const candidateCard = this.allCards.get(cardId);
        const isMatch = candidateCard.rank === topDiscardCard.rank;
        const player = this.players.get(playerId);
        if (isMatch) {
            const idx = hand.indexOf(cardId);
            if (idx !== -1) {
                hand[idx] = null; // Maintain empty slot at position
                this.setPlayerHand(playerId, hand);
            }
            addToDiscardPile(this.discardPile, cardId);
            this.logger.log(GameEventType.X_REACTION_ATTEMPT, { playerId, cardId, success: true });
            this.emitEvent('game:cardDiscarded', {
                cardId,
                card: { id: candidateCard.id, rank: candidateCard.rank, suit: candidateCard.suit, faceUp: true },
                playerId,
            });
            const remainingCards = hand.filter(Boolean).length;
            if (remainingCards === 0) {
                this.eliminatePlayerOrTeam(playerId);
            }
            this.broadcastGameState();
            return {};
        }
        else {
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
    dealPenaltyCard(playerId) {
        if (this.drawPile.length === 0) {
            this.recycleDiscard();
        }
        if (this.drawPile.length === 0)
            return;
        const cardId = drawFromPile(this.drawPile);
        this.pendingPenaltyCards.set(playerId, cardId);
        this.emitEvent('game:penaltyPrompt', { cardId }, [playerId]);
        setTimeout(() => {
            if (this.pendingPenaltyCards.has(playerId)) {
                this.placePenaltyCard(playerId, 'RIGHT');
            }
        }, 12000);
    }
    placePenaltyCard(playerId, position = 'RIGHT', slotIndex) {
        const cardId = this.pendingPenaltyCards.get(playerId);
        if (!cardId)
            return { error: 'No pending penalty card' };
        this.pendingPenaltyCards.delete(playerId);
        const hand = this.getPlayerHand(playerId);
        if (hand) {
            if (typeof slotIndex === 'number' && slotIndex >= 0 && slotIndex < hand.length && hand[slotIndex] === null) {
                hand[slotIndex] = cardId;
            }
            else if (position === 'TOP_LEFT' || position === 'LEFT') {
                const firstEmptyIdx = hand.indexOf(null);
                if (firstEmptyIdx !== -1 && firstEmptyIdx === 0) {
                    hand[0] = cardId;
                }
                else {
                    hand.unshift(cardId);
                }
            }
            else if (position === 'TOP_RIGHT') {
                const cols = Math.max(2, Math.ceil(hand.length / 2));
                hand.splice(cols, 0, cardId);
            }
            else if (position === 'BOTTOM_LEFT') {
                const cols = Math.max(2, Math.ceil(hand.length / 2));
                hand.splice(cols, 0, cardId);
            }
            else {
                const lastEmptyIdx = hand.lastIndexOf(null);
                if (lastEmptyIdx !== -1 && lastEmptyIdx === hand.length - 1) {
                    hand[lastEmptyIdx] = cardId;
                }
                else {
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
    callPandu(playerId) {
        if (!this.turnSystem)
            return { error: 'Game not started' };
        const isTurn = this.settings.mode === GameMode.TEAM
            ? (this.getPlayerTeamId(playerId) === this.turnSystem.activeTeamId)
            : (playerId === this.turnSystem.activePlayerId);
        const validation = validatePanduCall(playerId, isTurn ? playerId : 'not_active', this.panduState !== null, this.playerStates.get(playerId)?.isEliminated ?? true);
        if (!validation.valid)
            return { error: validation.error };
        this.turnSystem.setupFinalTurns(playerId, 1);
        const playerState = this.playerStates.get(playerId);
        if (playerState)
            playerState.calledPandu = true;
        const teamId = this.getPlayerTeamId(playerId);
        this.panduState = createPanduState(playerId, this.turnSystem.remainingFinalTurns, teamId);
        this.logger.log(GameEventType.PANDU_CALLED, { playerId, teamId });
        const player = this.players.get(playerId);
        const remainingTurnNames = this.turnSystem.remainingFinalTurns.map(id => this.players.get(id)?.name || id);
        this.emitEvent('game:panduCalled', {
            playerId,
            playerName: player?.name || 'Unknown',
            remainingTurns: remainingTurnNames,
        });
        this.broadcastGameState();
        return {};
    }
    endTurn(playerId) {
        if (!this.turnSystem)
            return { error: 'Game not started' };
        const isTurn = this.settings.mode === GameMode.TEAM
            ? (this.getPlayerTeamId(playerId) === this.turnSystem.activeTeamId)
            : (playerId === this.turnSystem.activePlayerId);
        if (!isTurn) {
            return { error: "It's not your turn" };
        }
        this.timerManager.cancelTimersByType('peek');
        this.currentSpecialAction = null;
        this.turnSystem.advanceTurn();
        this.startPlayerTurn();
        return {};
    }
    eliminatePlayerOrTeam(playerId) {
        if (this.settings.mode === GameMode.INDIVIDUAL) {
            const state = this.playerStates.get(playerId);
            if (state) {
                state.isEliminated = true;
                state.isSpectator = true;
                state.finishRank = this.nextFinishRank++;
                this.finishedOrder.push(playerId);
                this.turnSystem?.eliminatePlayer(playerId);
            }
        }
        else {
            const teamId = this.getPlayerTeamId(playerId);
            if (teamId) {
                const teamState = this.teamStates.get(teamId);
                if (teamState && teamState.handCardIds.length === 0) {
                    teamState.isEliminated = true;
                    teamState.finishRank = this.nextFinishRank++;
                    this.finishedOrder.push(teamId);
                    this.turnSystem?.eliminateTeam(teamId);
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
        if (this.turnSystem?.isGameEffectivelyOver()) {
            this.revealAndScore();
            return;
        }
        if (this.turnSystem && this.turnSystem.activePlayerId === playerId) {
            this.turnSystem.advanceTurn();
            this.startPlayerTurn();
        }
    }
    revealAndScore() {
        this.stateMachine.forcePhase(GamePhase.REVEAL);
        const allHands = {};
        if (this.settings.mode === GameMode.INDIVIDUAL) {
            for (const [playerId, state] of this.playerStates) {
                allHands[playerId] = state.handCardIds
                    .filter((id) => id !== null)
                    .map(id => {
                    const card = this.allCards.get(id);
                    return { id: card.id, rank: card.rank, suit: card.suit, faceUp: true };
                });
            }
        }
        else {
            for (const [teamId, state] of this.teamStates) {
                allHands[teamId] = state.handCardIds
                    .filter((id) => id !== null)
                    .map(id => {
                    const card = this.allCards.get(id);
                    return { id: card.id, rank: card.rank, suit: card.suit, faceUp: true };
                });
            }
        }
        this.emitEvent('game:reveal', { allHands });
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
                        .filter((id) => id !== null)
                        .map(id => this.allCards.get(id)),
                    calledPandu: state.calledPandu,
                    preAssignedRank: state.finishRank,
                });
            }
        }
        else {
            for (const [teamId, state] of this.teamStates) {
                const team = this.teams.get(teamId);
                scoreData.push({
                    playerId: teamId,
                    playerName: team?.name || 'Unknown',
                    avatarId: 0,
                    teamId,
                    teamName: team?.name,
                    cards: state.handCardIds
                        .filter((id) => id !== null)
                        .map(id => this.allCards.get(id)),
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
    rematchVotes = new Set();
    requestRematch(playerId) {
        if (this.stateMachine.currentPhase !== GamePhase.GAME_OVER)
            return;
        if (playerId) {
            this.rematchVotes.add(playerId);
        }
        const connectedPlayers = this.getConnectedPlayerIds();
        const votesArray = Array.from(this.rematchVotes).filter(id => connectedPlayers.includes(id));
        this.emitEvent('game:rematchVotesUpdate', {
            votes: votesArray,
            totalConnected: connectedPlayers.length,
        });
        if (votesArray.length >= connectedPlayers.length && connectedPlayers.length > 0) {
            this.rematchVotes.clear();
            this.stateMachine.forcePhase(GamePhase.LOBBY);
            this.startGame();
        }
    }
    returnToLobby() {
        this.rematchVotes.clear();
        for (const player of this.players.values()) {
            player.isReady = false;
        }
        this.stateMachine.forcePhase(GamePhase.LOBBY);
        this.logger.log(GameEventType.REMATCH_STARTED, {});
        this.emitEvent('game:returnToLobby', {});
        this.broadcastRoomState();
    }
    getPlayerHand(entityId) {
        if (this.settings.mode === GameMode.INDIVIDUAL) {
            return this.playerStates.get(entityId)?.handCardIds ?? null;
        }
        else {
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
    setPlayerHand(entityId, hand) {
        if (this.settings.mode === GameMode.INDIVIDUAL) {
            const state = this.playerStates.get(entityId);
            if (state)
                state.handCardIds = hand;
        }
        else {
            if (this.teamStates.has(entityId)) {
                const state = this.teamStates.get(entityId);
                if (state)
                    state.handCardIds = hand;
                return;
            }
            const teamId = this.getPlayerTeamId(entityId);
            if (!teamId)
                return;
            const state = this.teamStates.get(teamId);
            if (state)
                state.handCardIds = hand;
        }
    }
    getPlayerTeamId(playerId) {
        for (const [teamId, team] of this.teams) {
            if (team.playerIds.includes(playerId))
                return teamId;
        }
        return undefined;
    }
    recycleDiscard() {
        const { newDrawPile, remainingDiscards } = recycleDiscardPile(this.discardPile);
        this.drawPile = newDrawPile;
        this.discardPile = remainingDiscards;
        this.emitEvent('game:deckRecycled', { newDrawPileCount: newDrawPile.length });
    }
    getTeamPlayerIds(playerId) {
        if (this.settings.mode !== GameMode.TEAM)
            return [playerId];
        const teamId = this.getPlayerTeamId(playerId);
        if (!teamId)
            return [playerId];
        const team = this.teams.get(teamId);
        return team ? [...team.playerIds] : [playerId];
    }
    getClientGameState(playerId) {
        const isTeamMode = this.settings.mode === GameMode.TEAM;
        const teamId = this.getPlayerTeamId(playerId);
        const hand = this.getPlayerHand(playerId) || [];
        const myHand = hand.map(id => id ? ({
            id,
            faceUp: false,
        }) : null);
        const visibleDiscardIds = getVisibleDiscards(this.discardPile, 2);
        const visibleDiscards = visibleDiscardIds.map(id => {
            const card = this.allCards.get(id);
            return { id, rank: card.rank, suit: card.suit, faceUp: true };
        });
        const opponents = [];
        if (!isTeamMode) {
            for (const [pid, player] of this.players) {
                if (pid === playerId)
                    continue;
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
        }
        else {
            for (const [otherTeamId, team] of this.teams) {
                if (otherTeamId === teamId)
                    continue;
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
        let drawnCard;
        const isTeamTurn = isTeamMode && teamId !== undefined && this.turnSystem?.activeTeamId === teamId;
        const isIndividualTurn = !isTeamMode && this.turnSystem?.activePlayerId === playerId;
        if (this.drawnCardId && (isIndividualTurn || isTeamTurn)) {
            const card = this.allCards.get(this.drawnCardId);
            drawnCard = { id: card.id, rank: card.rank, suit: card.suit, faceUp: true };
        }
        const isSpecialForMyTeam = isTeamMode && teamId !== undefined && (this.currentSpecialAction !== null && this.getPlayerTeamId(this.currentSpecialAction.triggerPlayerId) === teamId);
        const isSpecialForMe = this.currentSpecialAction && (this.currentSpecialAction.triggerPlayerId === playerId || isSpecialForMyTeam);
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
                callerName: this.players.get(this.panduState.callerPlayerId)?.name || (this.panduState.callerTeamId ? this.teams.get(this.panduState.callerTeamId)?.name : 'Unknown') || 'Unknown',
                remainingTurnNames: this.turnSystem?.remainingFinalTurns.map(id => this.players.get(id)?.name || id) || [],
            } : undefined,
            timer: undefined,
            finishedPlayers: this.finishedOrder,
        };
    }
    getClientRoomState() {
        return {
            code: this.code,
            hostId: this.hostId,
            players: Array.from(this.players.values()).map(p => ({
                ...p,
                socketId: undefined,
                sessionToken: undefined,
            })),
            teams: Array.from(this.teams.values()).map(t => ({
                id: t.id,
                name: t.name,
                playerIds: t.playerIds,
            })),
            settings: { ...this.settings },
            gamePhase: this.stateMachine.currentPhase,
        };
    }
    broadcastGameState() {
        for (const player of this.players.values()) {
            if (!player.isConnected)
                continue;
            const state = this.getClientGameState(player.id);
            this.emitEvent('game:stateUpdate', state, [player.id]);
        }
    }
    broadcastRoomState() {
        const roomState = this.getClientRoomState();
        this.emitEvent('room:updated', roomState);
    }
    get gamePhase() {
        return this.stateMachine.currentPhase;
    }
    get isHost() {
        return this.hostId;
    }
    get gameSettings() {
        return { ...this.settings };
    }
    get playerCount() {
        return this.players.size;
    }
}
//# sourceMappingURL=Room.js.map