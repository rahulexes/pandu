// ============================================================
// PANDU — Timer Manager
// ============================================================
export class TimerManager {
    activeTimers = new Map();
    timerCounter = 0;
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
    cancelTimer(timerId) {
        const timer = this.activeTimers.get(timerId);
        if (!timer)
            return false;
        clearTimeout(timer.timeoutHandle);
        this.activeTimers.delete(timerId);
        return true;
    }
    cancelTimersByType(type) {
        for (const [id, timer] of this.activeTimers) {
            if (timer.type === type) {
                clearTimeout(timer.timeoutHandle);
                this.activeTimers.delete(id);
            }
        }
    }
    cancelAll() {
        for (const timer of this.activeTimers.values()) {
            clearTimeout(timer.timeoutHandle);
        }
        this.activeTimers.clear();
    }
    getRemainingTime(type) {
        for (const timer of this.activeTimers.values()) {
            if (timer.type === type) {
                return Math.max(0, timer.endsAt - Date.now());
            }
        }
        return null;
    }
    getTimerInfo(type) {
        for (const timer of this.activeTimers.values()) {
            if (timer.type === type) {
                return { endsAt: timer.endsAt, durationMs: timer.durationMs };
            }
        }
        return null;
    }
    isActive(type) {
        for (const timer of this.activeTimers.values()) {
            if (timer.type === type)
                return true;
        }
        return false;
    }
}
//# sourceMappingURL=TimerManager.js.map