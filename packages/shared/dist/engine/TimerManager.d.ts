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
    startTimer(type: string, durationMs: number, callback: () => void): GameTimer;
    cancelTimer(timerId: string): boolean;
    cancelTimersByType(type: string): void;
    cancelAll(): void;
    getRemainingTime(type: string): number | null;
    getTimerInfo(type: string): {
        endsAt: number;
        durationMs: number;
    } | null;
    isActive(type: string): boolean;
}
//# sourceMappingURL=TimerManager.d.ts.map