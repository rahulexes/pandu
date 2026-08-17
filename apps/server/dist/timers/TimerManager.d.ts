export interface GameTimer {
    id: string;
    type: string;
    startsAt: number;
    endsAt: number;
    durationMs: number;
    callback: () => void;
    timeoutHandle: ReturnType<typeof setTimeout>;
}
export declare class TimerManager {
    private activeTimers;
    private timerCounter;
    /**
     * Start a new timer. Returns the timer ID.
     */
    startTimer(type: string, durationMs: number, callback: () => void): GameTimer;
    /**
     * Cancel a specific timer.
     */
    cancelTimer(timerId: string): boolean;
    /**
     * Cancel all timers of a specific type.
     */
    cancelTimersByType(type: string): void;
    /**
     * Cancel all active timers.
     */
    cancelAll(): void;
    /**
     * Get the remaining time for a timer type.
     */
    getRemainingTime(type: string): number | null;
    /**
     * Get timer info for client synchronization.
     */
    getTimerInfo(type: string): {
        endsAt: number;
        durationMs: number;
    } | null;
    /**
     * Check if a timer of a given type is active.
     */
    isActive(type: string): boolean;
}
