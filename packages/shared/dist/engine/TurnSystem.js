// ============================================================
// PANDU — Turn System
// ============================================================
import { GameMode } from '../types';
export class TurnSystem {
    mode;
    playerOrder;
    teamOrder;
    teamPlayers;
    currentPlayerIndex = 0;
    currentTeamIndex = 0;
    teamPlayerIndices = new Map();
    eliminatedPlayers = new Set();
    eliminatedTeams = new Set();
    isFinalTurns = false;
    finalTurnQueue = [];
    finalTurnIndex = 0;
    constructor(config) {
        this.mode = config.mode;
        this.playerOrder = [...config.playerOrder];
        this.teamOrder = config.teamOrder ? [...config.teamOrder] : [];
        this.teamPlayers = config.teamPlayers || new Map();
        for (const [teamId] of this.teamPlayers) {
            this.teamPlayerIndices.set(teamId, 0);
        }
    }
    get activePlayerId() {
        if (this.isFinalTurns && this.finalTurnIndex >= 0 && this.finalTurnQueue.length > 0) {
            return this.finalTurnQueue[this.finalTurnIndex];
        }
        if (this.mode === GameMode.INDIVIDUAL) {
            return this.playerOrder[this.currentPlayerIndex];
        }
        const teamId = this.activeTeamId;
        if (!teamId)
            throw new Error('No active team');
        const players = this.teamPlayers.get(teamId);
        if (!players || players.length === 0)
            throw new Error(`No players in team ${teamId}`);
        const playerIndex = this.teamPlayerIndices.get(teamId) || 0;
        return players[playerIndex];
    }
    get activeTeamId() {
        if (this.mode === GameMode.INDIVIDUAL)
            return undefined;
        if (this.isFinalTurns) {
            if (this.finalTurnIndex >= 0 && this.finalTurnIndex < this.finalTurnQueue.length) {
                const activePid = this.finalTurnQueue[this.finalTurnIndex];
                return this.getPlayerTeam(activePid);
            }
            if (this.finalTurnIndex < 0) {
                return this.teamOrder[this.currentTeamIndex];
            }
        }
        if (this.teamOrder.length === 0)
            return undefined;
        return this.teamOrder[this.currentTeamIndex];
    }
    get currentTurnIndex() {
        return this.mode === GameMode.INDIVIDUAL ? this.currentPlayerIndex : this.currentTeamIndex;
    }
    get isInFinalTurns() {
        return this.isFinalTurns;
    }
    get remainingFinalTurns() {
        if (!this.isFinalTurns)
            return [];
        if (this.finalTurnIndex < 0)
            return [...this.finalTurnQueue];
        return this.finalTurnQueue.slice(this.finalTurnIndex);
    }
    advanceTurn() {
        if (this.isFinalTurns) {
            return this.advanceFinalTurn();
        }
        if (this.mode === GameMode.INDIVIDUAL) {
            return this.advanceIndividualTurn();
        }
        else {
            return this.advanceTeamTurn();
        }
    }
    advanceIndividualTurn() {
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
    advanceTeamTurn() {
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
    advanceFinalTurn() {
        this.finalTurnIndex++;
        if (this.finalTurnIndex >= this.finalTurnQueue.length) {
            return '';
        }
        return this.finalTurnQueue[this.finalTurnIndex];
    }
    areFinalTurnsComplete() {
        return this.isFinalTurns && this.finalTurnIndex >= this.finalTurnQueue.length;
    }
    setupFinalTurns(callerPlayerId, additionalTurnsPerPlayer = 1) {
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
        }
        else {
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
    eliminatePlayer(playerId) {
        this.eliminatedPlayers.add(playerId);
    }
    eliminateTeam(teamId) {
        this.eliminatedTeams.add(teamId);
    }
    isPlayerEliminated(playerId) {
        return this.eliminatedPlayers.has(playerId);
    }
    isTeamEliminated(teamId) {
        return this.eliminatedTeams.has(teamId);
    }
    getActivePlayers() {
        return this.playerOrder.filter(id => !this.eliminatedPlayers.has(id));
    }
    getActiveTeams() {
        return this.teamOrder.filter(id => !this.eliminatedTeams.has(id));
    }
    getPlayerTeam(playerId) {
        for (const [teamId, players] of this.teamPlayers) {
            if (players.includes(playerId))
                return teamId;
        }
        return undefined;
    }
    setStartingPlayer(playerId) {
        if (this.mode === GameMode.INDIVIDUAL) {
            const idx = this.playerOrder.indexOf(playerId);
            if (idx >= 0) {
                this.currentPlayerIndex = idx;
            }
        }
    }
    setStartingTeam(teamId) {
        if (this.mode === GameMode.TEAM) {
            const idx = this.teamOrder.indexOf(teamId);
            if (idx >= 0) {
                this.currentTeamIndex = idx;
            }
        }
    }
    isGameEffectivelyOver() {
        if (this.mode === GameMode.INDIVIDUAL) {
            return this.getActivePlayers().length <= 1;
        }
        return this.getActiveTeams().length <= 1;
    }
}
//# sourceMappingURL=TurnSystem.js.map