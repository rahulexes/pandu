import type { ClientGameState, GameSettings, Player, PlayerScore, ClientCard, ClientXReaction } from './types';
import { GamePhase, SpecialPowerType, SpecialActionPhase } from './gameStates';
export interface ClientToServerEvents {
    'room:create': (data: {
        playerName: string;
        avatarId: number;
    }, callback: (response: RoomResponse) => void) => void;
    'room:join': (data: {
        roomCode: string;
        playerName: string;
        avatarId: number;
        sessionToken?: string;
    }, callback: (response: RoomResponse) => void) => void;
    'room:leave': () => void;
    'room:updateProfile': (data: {
        playerName?: string;
        avatarId?: number;
    }) => void;
    'lobby:setMode': (data: {
        mode: 'INDIVIDUAL' | 'TEAM';
    }) => void;
    'lobby:updateSettings': (data: Partial<GameSettings>) => void;
    'lobby:toggleReady': () => void;
    'lobby:joinTeam': (data: {
        teamId: string;
    }) => void;
    'lobby:startGame': () => void;
    'lobby:kickPlayer': (data: {
        targetPlayerId: string;
    }) => void;
    'game:drawCard': () => void;
    'game:discardDrawn': () => void;
    'game:replaceCard': (data: {
        handCardId: string;
    }) => void;
    'game:endTurn': () => void;
    'game:callPandu': () => void;
    'game:peekInitialCard': (data: {
        cardId: string;
    }) => void;
    'game:selectSelfPeekCard': (data: {
        cardId: string;
    }) => void;
    'game:selectOtherPeekCard': (data: {
        targetPlayerId: string;
        cardId: string;
    }) => void;
    'game:selectOwnExchangeCard': (data: {
        cardId: string;
    }) => void;
    'game:selectOtherExchangeCard': (data: {
        targetPlayerId: string;
        cardId: string;
    }) => void;
    'game:acknowledgeSpecial': () => void;
    'game:skipSpecial': () => void;
    'game:xReaction': (data: {
        cardId: string;
    }) => void;
    'game:placePenaltyCard': (data: {
        slotIndex?: number;
    }) => void;
    'game:rematch': () => void;
    'game:returnToLobby': () => void;
}
export interface ServerToClientEvents {
    'room:updated': (room: ClientRoomState) => void;
    'room:playerJoined': (player: Player) => void;
    'room:playerLeft': (data: {
        playerId: string;
        newHostId?: string;
    }) => void;
    'room:error': (data: {
        message: string;
    }) => void;
    'room:kicked': (data: {
        reason: string;
    }) => void;
    'lobby:settingsUpdated': (settings: GameSettings) => void;
    'lobby:playerReady': (data: {
        playerId: string;
        isReady: boolean;
    }) => void;
    'lobby:teamUpdated': (data: {
        playerId: string;
        teamId: string;
    }) => void;
    'lobby:kicked': (data: {
        targetPlayerId: string;
        reason: string;
        cooldownSeconds: number;
        cooldownUntil: number;
    }) => void;
    'game:stateUpdate': (state: ClientGameState) => void;
    'game:phaseChanged': (data: {
        phase: GamePhase;
        message?: string;
    }) => void;
    'game:shuffleStart': () => void;
    'game:dealStart': (data: {
        playerOrder: string[];
        cardsPerPlayer: number;
    }) => void;
    'game:dealCard': (data: {
        toPlayerId: string;
        cardIndex: number;
    }) => void;
    'game:initialViewStart': (data: {
        durationMs: number;
        maxPeeks: number;
    }) => void;
    'game:cardPeeked': (data: {
        cardId: string;
        card: ClientCard;
    }) => void;
    'game:turnStart': (data: {
        playerId: string;
        teamId?: string;
        playerName: string;
        turnNumber: number;
    }) => void;
    'game:cardDrawn': (data: {
        card?: ClientCard;
        playerId: string;
    }) => void;
    'game:cardDiscarded': (data: {
        cardId: string;
        card: ClientCard;
        playerId?: string;
    }) => void;
    'game:cardReplaced': (data: {
        oldCardId: string;
        newCard: ClientCard;
        discardedCard: ClientCard;
        handPosition: number;
        playerId?: string;
    }) => void;
    'game:specialAction': (data: {
        type: SpecialPowerType;
        phase: SpecialActionPhase;
        message: string;
    }) => void;
    'game:cardRevealed': (data: {
        cardId: string;
        targetPlayerId?: string;
        card: ClientCard;
        durationMs: number;
    }) => void;
    'game:cardRevealedExpired': (data: {}) => void;
    'game:exchangeComplete': (data: {
        ownCardId: string;
        otherCardId: string;
        otherPlayerId: string;
        playerId?: string;
    }) => void;
    'game:xReactionWindow': (data: {
        triggerCardId: string;
        durationMs: number;
    }) => void;
    'game:xReactionResult': (data: {
        reactions: ClientXReaction[];
        winnerId?: string;
    }) => void;
    'game:xReactionWrong': (data: {
        playerId: string;
        playerName: string;
        card: ClientCard;
    }) => void;
    'game:penaltyPrompt': (data: {
        cardId: string;
    }) => void;
    'game:penaltyCard': (data: {
        playerId: string;
        cardCount: number;
    }) => void;
    'game:panduCalled': (data: {
        playerId: string;
        playerName: string;
        remainingTurns: string[];
    }) => void;
    'game:playerEliminated': (data: {
        playerId: string;
        playerName: string;
        rank: number;
    }) => void;
    'game:reveal': (data: {
        allHands: Record<string, ClientCard[]>;
    }) => void;
    'game:scores': (data: {
        scores: PlayerScore[];
    }) => void;
    'game:gameOver': (data: {
        scores: PlayerScore[];
    }) => void;
    'game:timerSync': (data: {
        type: string;
        endsAt: number;
        durationMs: number;
    }) => void;
    'game:timerExpired': (data: {
        type: string;
    }) => void;
    'game:actionError': (data: {
        message: string;
        action: string;
    }) => void;
    'game:rematchVotesUpdate': (data: {
        votes: string[];
        totalConnected: number;
    }) => void;
    'game:returnToLobby': (data: {}) => void;
    'game:deckRecycled': (data: {
        newDrawPileCount: number;
    }) => void;
}
export interface RoomResponse {
    success: boolean;
    roomCode?: string;
    sessionToken?: string;
    playerId?: string;
    error?: string;
}
export interface ClientRoomState {
    code: string;
    hostId: string;
    players: Player[];
    teams: {
        id: string;
        name: string;
        playerIds: string[];
    }[];
    settings: GameSettings;
    gamePhase: GamePhase;
}
//# sourceMappingURL=events.d.ts.map