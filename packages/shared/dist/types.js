// ============================================================
// PANDU — Shared Type Definitions
// ============================================================
/** Where a card physically exists */
export var CardZone;
(function (CardZone) {
    CardZone["DRAW_PILE"] = "DRAW_PILE";
    CardZone["DISCARD_PILE"] = "DISCARD_PILE";
    CardZone["PLAYER_HAND"] = "PLAYER_HAND";
    CardZone["TEAM_HAND"] = "TEAM_HAND";
    CardZone["TEMPORARY"] = "TEMPORARY";
    CardZone["PENALTY"] = "PENALTY";
})(CardZone || (CardZone = {}));
// ── Game Mode ───────────────────────────────────────────────
export var GameMode;
(function (GameMode) {
    GameMode["INDIVIDUAL"] = "INDIVIDUAL";
    GameMode["TEAM"] = "TEAM";
})(GameMode || (GameMode = {}));
// ── Game Event Log ──────────────────────────────────────────
export var GameEventType;
(function (GameEventType) {
    GameEventType["PLAYER_JOINED"] = "PLAYER_JOINED";
    GameEventType["PLAYER_LEFT"] = "PLAYER_LEFT";
    GameEventType["PLAYER_DISCONNECTED"] = "PLAYER_DISCONNECTED";
    GameEventType["PLAYER_RECONNECTED"] = "PLAYER_RECONNECTED";
    GameEventType["GAME_STARTED"] = "GAME_STARTED";
    GameEventType["CARDS_DEALT"] = "CARDS_DEALT";
    GameEventType["CARD_DRAWN"] = "CARD_DRAWN";
    GameEventType["CARD_DISCARDED"] = "CARD_DISCARDED";
    GameEventType["CARD_REPLACED"] = "CARD_REPLACED";
    GameEventType["SPECIAL_TRIGGERED"] = "SPECIAL_TRIGGERED";
    GameEventType["CARD_PEEKED"] = "CARD_PEEKED";
    GameEventType["QUEEN_EXCHANGE"] = "QUEEN_EXCHANGE";
    GameEventType["X_REACTION_ATTEMPT"] = "X_REACTION_ATTEMPT";
    GameEventType["X_REACTION_RESOLVED"] = "X_REACTION_RESOLVED";
    GameEventType["PENALTY_DEALT"] = "PENALTY_DEALT";
    GameEventType["PANDU_CALLED"] = "PANDU_CALLED";
    GameEventType["TURN_CHANGED"] = "TURN_CHANGED";
    GameEventType["PLAYER_ELIMINATED"] = "PLAYER_ELIMINATED";
    GameEventType["TEAM_ELIMINATED"] = "TEAM_ELIMINATED";
    GameEventType["GAME_ENDED"] = "GAME_ENDED";
    GameEventType["REMATCH_STARTED"] = "REMATCH_STARTED";
})(GameEventType || (GameEventType = {}));
//# sourceMappingURL=types.js.map