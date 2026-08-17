// ============================================================
// PANDU — Timer Manager
// ============================================================
// Server-authoritative timer system.
export class TimerManager {
    activeTimers = new Map();
    timerCounter = 0;
    /**
     * Start a new timer. Returns the timer ID.
     */
    startTimer(type, durationMs, callback) {
        const id = `timer_${++this.timerCounter}_${Date.now()}`;
        const now = Date.now();
        const timeoutHandle = setTimeout(() => {
            this.activeTimers.delete(id);
            callback();
        }, durationMs);
        const timer = {
            id,
            type,
            startsAt: now,
            endsAt: now + durationMs,
            durationMs,
            callback,
            timeoutHandle,
        };
        this.activeTimers.set(id, timer);
        return timer;
    }
    /**
     * Cancel a specific timer.
     */
    cancelTimer(timerId) {
        const timer = this.activeTimers.get(timerId);
        if (!timer)
            return false;
        clearTimeout(timer.timeoutHandle);
        this.activeTimers.delete(timerId);
        return true;
    }
    /**
     * Cancel all timers of a specific type.
     */
    cancelTimersByType(type) {
        for (const [id, timer] of this.activeTimers) {
            if (timer.type === type) {
                clearTimeout(timer.timeoutHandle);
                this.activeTimers.delete(id);
            }
        }
    }
    /**
     * Cancel all active timers.
     */
    cancelAll() {
        for (const timer of this.activeTimers.values()) {
            clearTimeout(timer.timeoutHandle);
        }
        this.activeTimers.clear();
    }
    /**
     * Get the remaining time for a timer type.
     */
    getRemainingTime(type) {
        for (const timer of this.activeTimers.values()) {
            if (timer.type === type) {
                return Math.max(0, timer.endsAt - Date.now());
            }
        }
        return null;
    }
    /**
     * Get timer info for client synchronization.
     */
    getTimerInfo(type) {
        for (const timer of this.activeTimers.values()) {
            if (timer.type === type) {
                return { endsAt: timer.endsAt, durationMs: timer.durationMs };
            }
        }
        return null;
    }
    /**
     * Check if a timer of a given type is active.
     */
    isActive(type) {
        for (const timer of this.activeTimers.values()) {
            if (timer.type === type)
                return true;
        }
        return false;
    }
}
//# sourceMappingURL=TimerManager.js.map