// ============================================================
// PANDU — Game State Machine States
// ============================================================

/**
 * All possible game states.
 * Transitions between states are strictly enforced server-side.
 */
export enum GamePhase {
  /** Room exists, waiting for players */
  LOBBY = 'LOBBY',
  /** All players ready, about to start */
  READY_CHECK = 'READY_CHECK',
  /** Shuffle animation playing */
  SHUFFLING = 'SHUFFLING',
  /** Cards being dealt to players */
  DEALING = 'DEALING',
  /** 30-second initial card viewing */
  INITIAL_VIEW = 'INITIAL_VIEW',
  /** Active player's turn — waiting for action */
  PLAYER_TURN = 'PLAYER_TURN',
  /** Player is drawing a card */
  DRAWING = 'DRAWING',
  /** Player deciding: discard drawn card or replace hand card */
  CARD_DECISION = 'CARD_DECISION',
  /** Special power is being resolved (7/8, 9/10, Q) */
  SPECIAL_ACTION = 'SPECIAL_ACTION',
  /** X reaction window is open */
  X_REACTION = 'X_REACTION',
  /** Player confirming end of turn */
  END_TURN = 'END_TURN',
  /** PANDU has been called, final turns sequence */
  PANDU_CALLED = 'PANDU_CALLED',
  /** Playing out final turns */
  FINAL_TURNS = 'FINAL_TURNS',
  /** All cards being revealed */
  REVEAL = 'REVEAL',
  /** Scores being calculated */
  SCORING = 'SCORING',
  /** Game is over, showing results */
  GAME_OVER = 'GAME_OVER',
  /** Rematch initiated */
  REMATCH = 'REMATCH',
}

/**
 * Sub-phases for special actions.
 */
export enum SpecialActionPhase {
  /** Waiting for player to select a card to peek */
  SELECT_CARD = 'SELECT_CARD',
  /** Card is being shown to player */
  SHOWING_CARD = 'SHOWING_CARD',
  /** Waiting for player to select own card for exchange */
  SELECT_OWN_CARD = 'SELECT_OWN_CARD',
  /** Waiting for player to select opponent's card for exchange */
  SELECT_OTHER_CARD = 'SELECT_OTHER_CARD',
  /** Exchange animation playing */
  EXCHANGING = 'EXCHANGING',
  /** Special action complete, waiting for acknowledgement */
  COMPLETE = 'COMPLETE',
}

/**
 * Types of special powers triggered by discarded cards.
 */
export enum SpecialPowerType {
  /** 7 or 8: Look at one of your own cards */
  SELF_PEEK = 'SELF_PEEK',
  /** 9 or 10: Look at another player's card */
  OTHER_PEEK = 'OTHER_PEEK',
  /** Q: Blind card exchange */
  BLIND_EXCHANGE = 'BLIND_EXCHANGE',
  /** J (X card): Reaction discard */
  X_REACTION = 'X_REACTION',
  /** No special power */
  NONE = 'NONE',
}

/**
 * Valid state transitions.
 * Key = current state, Value = array of valid next states.
 */
export const VALID_TRANSITIONS: Record<GamePhase, GamePhase[]> = {
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
