// ============================================================
// PANDU — Turn System
// ============================================================

import { GameMode } from '../types';

export interface TurnConfig {
  mode: GameMode;
  playerOrder: string[];
  teamOrder?: string[];
  teamPlayers?: Map<string, string[]>;
}

export class TurnSystem {
  private mode: GameMode;
  private playerOrder: string[];
  private teamOrder: string[];
  private teamPlayers: Map<string, string[]>;

  private currentPlayerIndex: number = 0;
  private currentTeamIndex: number = 0;
  private teamPlayerIndices: Map<string, number> = new Map();

  private eliminatedPlayers: Set<string> = new Set();
  private eliminatedTeams: Set<string> = new Set();

  private isFinalTurns: boolean = false;
  private finalTurnQueue: string[] = [];
  private finalTurnIndex: number = 0;

  constructor(config: TurnConfig) {
    this.mode = config.mode;
    this.playerOrder = [...config.playerOrder];
    this.teamOrder = config.teamOrder ? [...config.teamOrder] : [];
    this.teamPlayers = config.teamPlayers || new Map();

    for (const [teamId] of this.teamPlayers) {
      this.teamPlayerIndices.set(teamId, 0);
    }
  }

  get activePlayerId(): string {
    if (this.isFinalTurns && this.finalTurnIndex >= 0 && this.finalTurnQueue.length > 0) {
      return this.finalTurnQueue[this.finalTurnIndex];
    }

    if (this.mode === GameMode.INDIVIDUAL) {
      return this.playerOrder[this.currentPlayerIndex];
    }

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
    const currentTeamId = this.teamOrder[this.currentTeamIndex];
    const teamPlayerList = this.teamPlayers.get(currentTeamId);
    if (teamPlayerList && teamPlayerList.length > 0) {
      const currentIdx = this.teamPlayerIndices.get(currentTeamId) || 0;
      this.teamPlayerIndices.set(currentTeamId, (currentIdx + 1) % teamPlayerList.length);
    }

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
      return '';
    }
    return this.finalTurnQueue[this.finalTurnIndex];
  }

  areFinalTurnsComplete(): boolean {
    return this.isFinalTurns && this.finalTurnIndex >= this.finalTurnQueue.length;
  }

  setupFinalTurns(callerPlayerId: string, additionalTurnsPerPlayer: number = 1): void {
    this.isFinalTurns = true;
    this.finalTurnQueue = [];
    this.finalTurnIndex = -1;

    if (this.mode === GameMode.INDIVIDUAL) {
      const activePlayers = this.getActivePlayers().filter(id => id !== callerPlayerId);

      for (let round = 0; round < additionalTurnsPerPlayer; round++) {
        const callerIdx = this.playerOrder.indexOf(callerPlayerId);
        for (let i = 1; i < this.playerOrder.length; i++) {
          const idx = (callerIdx + i) % this.playerOrder.length;
          const playerId = this.playerOrder[idx];
          if (activePlayers.includes(playerId)) {
            this.finalTurnQueue.push(playerId);
          }
        }
      }

      this.finalTurnQueue.push(callerPlayerId);
    } else {
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

  setStartingPlayer(playerId: string): void {
    if (this.mode === GameMode.INDIVIDUAL) {
      const idx = this.playerOrder.indexOf(playerId);
      if (idx >= 0) {
        this.currentPlayerIndex = idx;
      }
    }
  }

  setStartingTeam(teamId: string): void {
    if (this.mode === GameMode.TEAM) {
      const idx = this.teamOrder.indexOf(teamId);
      if (idx >= 0) {
        this.currentTeamIndex = idx;
      }
    }
  }

  isGameEffectivelyOver(): boolean {
    if (this.mode === GameMode.INDIVIDUAL) {
      return this.getActivePlayers().length <= 1;
    }
    return this.getActiveTeams().length <= 1;
  }
}
