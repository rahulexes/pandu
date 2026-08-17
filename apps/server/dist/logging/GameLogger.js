// ============================================================
// PANDU — Game Event Logger
// ============================================================
export class GameLogger {
    events = [];
    roomId;
    constructor(roomId) {
        this.roomId = roomId;
    }
    log(type, data = {}) {
        const event = {
            type,
            timestamp: Date.now(),
            roomId: this.roomId,
            data,
        };
        this.events.push(event);
        // Also log to console for debugging
        console.log(`[GAME:${this.roomId}] ${type}`, JSON.stringify(data));
    }
    getEvents() {
        return [...this.events];
    }
    getEventsByType(type) {
        return this.events.filter(e => e.type === type);
    }
    clear() {
        this.events = [];
    }
}
//# sourceMappingURL=GameLogger.js.map