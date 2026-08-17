// ============================================================
// PANDU — Game State Machine States
// ============================================================
/**
 * All possible game states.
 * Transitions between states are strictly enforced server-side.
 */
export var GamePhase;
(function (GamePhase) {
    /** Room exists, waiting for players */
    GamePhase["LOBBY"] = "LOBBY";
    /** All players ready, about to start */
    GamePhase["READY_CHECK"] = "READY_CHECK";
    /** Shuffle animation playing */
    GamePhase["SHUFFLING"] = "SHUFFLING";
    /** Cards being dealt to players */
    GamePhase["DEALING"] = "DEALING";
    /** 30-second initial card viewing */
    GamePhase["INITIAL_VIEW"] = "INITIAL_VIEW";
    /** Active player's turn — waiting for action */
    GamePhase["PLAYER_TURN"] = "PLAYER_TURN";
    /** Player is drawing a card */
    GamePhase["DRAWING"] = "DRAWING";
    /** Player deciding: discard drawn card or replace hand card */
    GamePhase["CARD_DECISION"] = "CARD_DECISION";
    /** Special power is being resolved (7/8, 9/10, Q) */
    GamePhase["SPECIAL_ACTION"] = "SPECIAL_ACTION";
    /** X reaction window is open */
    GamePhase["X_REACTION"] = "X_REACTION";
    /** Player confirming end of turn */
    GamePhase["END_TURN"] = "END_TURN";
    /** PANDU has been called, final turns sequence */
    GamePhase["PANDU_CALLED"] = "PANDU_CALLED";
    /** Playing out final turns */
    GamePhase["FINAL_TURNS"] = "FINAL_TURNS";
    /** All cards being revealed */
    GamePhase["REVEAL"] = "REVEAL";
    /** Scores being calculated */
    GamePhase["SCORING"] = "SCORING";
    /** Game is over, showing results */
    GamePhase["GAME_OVER"] = "GAME_OVER";
    /** Rematch initiated */
    GamePhase["REMATCH"] = "REMATCH";
})(GamePhase || (GamePhase = {}));
/**
 * Sub-phases for special actions.
 */
export var SpecialActionPhase;
(function (SpecialActionPhase) {
    /** Waiting for player to select a card to peek */
    SpecialActionPhase["SELECT_CARD"] = "SELECT_CARD";
    /** Card is being shown to player */
    SpecialActionPhase["SHOWING_CARD"] = "SHOWING_CARD";
    /** Waiting for player to select own card for exchange */
    SpecialActionPhase["SELECT_OWN_CARD"] = "SELECT_OWN_CARD";
    /** Waiting for player to select opponent's card for exchange */
    SpecialActionPhase["SELECT_OTHER_CARD"] = "SELECT_OTHER_CARD";
    /** Exchange animation playing */
    SpecialActionPhase["EXCHANGING"] = "EXCHANGING";
    /** Special action complete, waiting for acknowledgement */
    SpecialActionPhase["COMPLETE"] = "COMPLETE";
})(SpecialActionPhase || (SpecialActionPhase = {}));
/**
 * Types of special powers triggered by discarded cards.
 */
export var SpecialPowerType;
(function (SpecialPowerType) {
    /** 7 or 8: Look at one of your own cards */
    SpecialPowerType["SELF_PEEK"] = "SELF_PEEK";
    /** 9 or 10: Look at another player's card */
    SpecialPowerType["OTHER_PEEK"] = "OTHER_PEEK";
    /** Q: Blind card exchange */
    SpecialPowerType["BLIND_EXCHANGE"] = "BLIND_EXCHANGE";
    /** J (X card): Reaction discard */
    SpecialPowerType["X_REACTION"] = "X_REACTION";
    /** No special power */
    SpecialPowerType["NONE"] = "NONE";
})(SpecialPowerType || (SpecialPowerType = {}));
/**
 * Valid state transitions.
 * Key = current state, Value = array of valid next states.
 */
export const VALID_TRANSITIONS = {
    [GamePhase.LOBBY]: [GamePhase.READY_CHECK],
    [GamePhase.READY_CHECK]: [GamePhase.SHUFFLING, GamePhase.LOBBY],
    [GamePhase.SHUFFLING]: [GamePhase.DEALING],
    [GamePhase.DEALING]: [GamePhase.INITIAL_VIEW],
    [GamePhase.INITIAL_VIEW]: [GamePhase.PLAYER_TURN],
    [GamePhase.PLAYER_TURN]: [GamePhase.DRAWING, GamePhase.PANDU_CALLED],
    [GamePhase.DRAWING]: [GamePhase.CARD_DECISION],
    [GamePhase.CARD_DECISION]: [GamePhase.END_TURN, GamePhase.SPECIAL_ACTION, GamePhase.X_REACTION],
    [GamePhase.SPECIAL_ACTION]: [GamePhase.END_TURN, GamePhase.X_REACTION],
    [GamePhase.X_REACTION]: [GamePhase.END_TURN],
    [GamePhase.END_TURN]: [GamePhase.PLAYER_TURN, GamePhase.REVEAL, GamePhase.FINAL_TURNS],
    [GamePhase.PANDU_CALLED]: [GamePhase.FINAL_TURNS],
    [GamePhase.FINAL_TURNS]: [GamePhase.PLAYER_TURN, GamePhase.REVEAL],
    [GamePhase.REVEAL]: [GamePhase.SCORING],
    [GamePhase.SCORING]: [GamePhase.GAME_OVER],
    [GamePhase.GAME_OVER]: [GamePhase.REMATCH, GamePhase.LOBBY],
    [GamePhase.REMATCH]: [GamePhase.SHUFFLING],
};
//# sourceMappingURL=gameStates.js.map