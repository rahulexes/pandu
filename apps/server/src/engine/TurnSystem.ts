// ============================================================
// PANDU — Turn System
// ============================================================
// Manages turn order for both Individual and Team modes.
// Handles player elimination, team rotation, PANDU final turns.

import { GameMode } from '@pandu/shared';

export interface TurnConfig {
  mode: GameMode;
  /** Player IDs in turn order (Individual) */
  playerOrder: string[];
  /** Team IDs in turn order (Team) */
  teamOrder?: string[];
  /** Map of teamId → player IDs in rotation order */
  teamPlayers?: Map<string, string[]>;
}

export class TurnSystem {
  private mode: GameMode;
  private playerOrder: string[];
  private teamOrder: string[];
  private teamPlayers: Map<string, string[]>;

  // Current indices
  private currentPlayerIndex: number = 0;
  private currentTeamIndex: number = 0;
  /** Per-team: which player within the team is active */
  private teamPlayerIndices: Map<string, number> = new Map();

  // Elimination tracking
  private eliminatedPlayers: Set<string> = new Set();
  private eliminatedTeams: Set<string> = new Set();

  // PANDU final turns
  private isFinalTurns: boolean = false;
  private finalTurnQueue: string[] = [];
  private finalTurnIndex: number = 0;

  constructor(config: TurnConfig) {
    this.mode = config.mode;
    this.playerOrder = [...config.playerOrder];
    this.teamOrder = config.teamOrder ? [...config.teamOrder] : [];
    this.teamPlayers = config.teamPlayers || new Map();

    // Initialize team player indices
    for (const [teamId] of this.teamPlayers) {
      this.teamPlayerIndices.set(teamId, 0);
    }
  }

  // ── Getters ─────────────────────────────────────────────

  get activePlayerId(): string {
    if (this.isFinalTurns && this.finalTurnIndex >= 0 && this.finalTurnQueue.length > 0) {
      return this.finalTurnQueue[this.finalTurnIndex];
    }

    if (this.mode === GameMode.INDIVIDUAL) {
      return this.playerOrder[this.currentPlayerIndex];
    }

    // Team mode: get active player within active team
    const teamId = this.activeTeamId;
    if (!teamId) throw new Error('No active team');
    const players = this.teamPlayers.get(teamId);
    if (!players || players.length === 0) throw new Error(`No players in team ${teamId}`);
    const playerIndex = this.teamPlayerIndices.get(teamId) || 0;
    return players[playerIndex];
  }

  get activeTeamId(): string | undefined {
    if (this.mode === GameMode.INDIVIDUAL) return undefined;
    if (this.isFinalTurns) {
      if (this.finalTurnIndex >= 0 && this.finalTurnIndex < this.finalTurnQueue.length) {
        const activePid = this.finalTurnQueue[this.finalTurnIndex];
        return this.getPlayerTeam(activePid);
      }
      if (this.finalTurnIndex < 0) {
        // Caller team is taking initial turn before advancing
        return this.teamOrder[this.currentTeamIndex];
      }
    }
    if (this.teamOrder.length === 0) return undefined;
    return this.teamOrder[this.currentTeamIndex];
  }

  get currentTurnIndex(): number {
    return this.mode === GameMode.INDIVIDUAL ? this.currentPlayerIndex : this.currentTeamIndex;
  }

  get isInFinalTurns(): boolean {
    return this.isFinalTurns;
  }

  get remainingFinalTurns(): string[] {
    if (!this.isFinalTurns) return [];
    if (this.finalTurnIndex < 0) return [...this.finalTurnQueue];
    return this.finalTurnQueue.slice(this.finalTurnIndex);
  }

  // ── Turn Advancement ────────────────────────────────────

  /**
   * Advance to the next turn. Returns the new active player ID.
   */
  advanceTurn(): string {
    if (this.isFinalTurns) {
      return this.advanceFinalTurn();
    }

    if (this.mode === GameMode.INDIVIDUAL) {
      return this.advanceIndividualTurn();
    } else {
      return this.advanceTeamTurn();
    }
  }

  private advanceIndividualTurn(): string {
    const activePlayers = this.getActivePlayers();
    if (activePlayers.length === 0) {
      throw new Error('No active players remaining');
    }

    // Move to next non-eliminated player
    let attempts = 0;
    do {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerOrder.length;
      attempts++;
      if (attempts > this.playerOrder.length) {
        throw new Error('No active players found after full rotation');
      }
    } while (this.eliminatedPlayers.has(this.playerOrder[this.currentPlayerIndex]));

    return this.activePlayerId;
  }

  private advanceTeamTurn(): string {
    // First, advance the player within the current team
    const currentTeamId = this.teamOrder[this.currentTeamIndex];
    const teamPlayerList = this.teamPlayers.get(currentTeamId);
    if (teamPlayerList && teamPlayerList.length > 0) {
      const currentIdx = this.teamPlayerIndices.get(currentTeamId) || 0;
      this.teamPlayerIndices.set(currentTeamId, (currentIdx + 1) % teamPlayerList.length);
    }

    // Then advance to the next non-eliminated team
    let attempts = 0;
    do {
      this.currentTeamIndex = (this.currentTeamIndex + 1) % this.teamOrder.length;
      attempts++;
      if (attempts > this.teamOrder.length) {
        throw new Error('No active teams found after full rotation');
      }
    } while (this.eliminatedTeams.has(this.teamOrder[this.currentTeamIndex]));

    return this.activePlayerId;
  }

  private advanceFinalTurn(): string {
    this.finalTurnIndex++;
    if (this.finalTurnIndex >= this.finalTurnQueue.length) {
      // All final turns completed
      return '';
    }
    return this.finalTurnQueue[this.finalTurnIndex];
  }

  /**
   * Check if all final turns have been completed.
   */
  areFinalTurnsComplete(): boolean {
    return this.isFinalTurns && this.finalTurnIndex >= this.finalTurnQueue.length;
  }

  // ── PANDU Final Turns ───────────────────────────────────

  /**
   * Set up the final turn sequence after PANDU is called.
   * In Individual Mode: every other player gets one turn, caller goes last.
   * In Team Mode: depends on queen count configuration.
   *
   * @param callerPlayerId The player who called PANDU
   * @param additionalTurnsPerPlayer How many turns each player/team gets (1 for 3-4 queens, 2 for 2 queens)
   */
  setupFinalTurns(callerPlayerId: string, additionalTurnsPerPlayer: number = 1): void {
    this.isFinalTurns = true;
    this.finalTurnQueue = [];
    this.finalTurnIndex = -1; // Caller is currently active and must manually end turn

    if (this.mode === GameMode.INDIVIDUAL) {
      // Build queue: all active players except caller get their turns, then caller
      const activePlayers = this.getActivePlayers().filter(id => id !== callerPlayerId);

      for (let round = 0; round < additionalTurnsPerPlayer; round++) {
        // Start from the player AFTER the caller in turn order
        const callerIdx = this.playerOrder.indexOf(callerPlayerId);
        for (let i = 1; i < this.playerOrder.length; i++) {
          const idx = (callerIdx + i) % this.playerOrder.length;
          const playerId = this.playerOrder[idx];
          if (activePlayers.includes(playerId)) {
            this.finalTurnQueue.push(playerId);
          }
        }
      }

      // Caller's final turn is last
      this.finalTurnQueue.push(callerPlayerId);
    } else {
      // Team mode — start from team AFTER caller, exactly 1 turn per opposing team, then 1 final turn for caller team
      const callerTeamId = this.getPlayerTeam(callerPlayerId);
      const callerTeamIdx = callerTeamId ? this.teamOrder.indexOf(callerTeamId) : 0;
      const activeTeams = this.teamOrder.filter(tid => !this.eliminatedTeams.has(tid) && tid !== callerTeamId);

      for (let i = 1; i < this.teamOrder.length; i++) {
        const idx = (callerTeamIdx + i) % this.teamOrder.length;
        const teamId = this.teamOrder[idx];
        if (activeTeams.includes(teamId)) {
          const players = this.teamPlayers.get(teamId) || [];
          const currentIdx = this.teamPlayerIndices.get(teamId) || 0;
          const activePlayer = players[currentIdx % players.length];
          if (activePlayer) {
            this.finalTurnQueue.push(activePlayer);
          }
        }
      }

      // Caller team's final turn is last
      if (callerTeamId) {
        const callerTeamPlayers = this.teamPlayers.get(callerTeamId) || [];
        const callerIdx = this.teamPlayerIndices.get(callerTeamId) || 0;
        const finalPlayer = callerTeamPlayers[callerIdx % callerTeamPlayers.length];
        if (finalPlayer) {
          this.finalTurnQueue.push(finalPlayer);
        }
      }
    }
  }

  // ── Elimination ─────────────────────────────────────────

  eliminatePlayer(playerId: string): void {
    this.eliminatedPlayers.add(playerId);
  }

  eliminateTeam(teamId: string): void {
    this.eliminatedTeams.add(teamId);
  }

  isPlayerEliminated(playerId: string): boolean {
    return this.eliminatedPlayers.has(playerId);
  }

  isTeamEliminated(teamId: string): boolean {
    return this.eliminatedTeams.has(teamId);
  }

  // ── Helpers ─────────────────────────────────────────────

  getActivePlayers(): string[] {
    return this.playerOrder.filter(id => !this.eliminatedPlayers.has(id));
  }

  getActiveTeams(): string[] {
    return this.teamOrder.filter(id => !this.eliminatedTeams.has(id));
  }

  getPlayerTeam(playerId: string): string | undefined {
    for (const [teamId, players] of this.teamPlayers) {
      if (players.includes(playerId)) return teamId;
    }
    return undefined;
  }

  /**
   * Set the starting player (for rematch).
   */
  setStartingPlayer(playerId: string): void {
    if (this.mode === GameMode.INDIVIDUAL) {
      const idx = this.playerOrder.indexOf(playerId);
      if (idx >= 0) {
        this.currentPlayerIndex = idx;
      }
    }
  }

  /**
   * Set the starting team (for rematch).
   */
  setStartingTeam(teamId: string): void {
    if (this.mode === GameMode.TEAM) {
      const idx = this.teamOrder.indexOf(teamId);
      if (idx >= 0) {
        this.currentTeamIndex = idx;
      }
    }
  }

  /**
   * Check if only one player/team remains active.
   */
  isGameEffectivelyOver(): boolean {
    if (this.mode === GameMode.INDIVIDUAL) {
      return this.getActivePlayers().length <= 1;
    }
    return this.getActiveTeams().length <= 1;
  }
}
