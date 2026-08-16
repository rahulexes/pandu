// ============================================================
// PANDU — Timer Manager
// ============================================================

export interface GameTimer {
  id: string;
  type: string;
  startsAt: number;
  endsAt: number;
  durationMs: number;
  callback: () => void;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

export class TimerManager {
  private activeTimers: Map<string, GameTimer> = new Map();
  private timerCounter: number = 0;

  startTimer(
    type: string,
    durationMs: number,
    callback: () => void,
  ): GameTimer {
    const id = `timer_${++this.timerCounter}_${Date.now()}`;
    const now = Date.now();

    const timeoutHandle = setTimeout(() => {
      this.activeTimers.delete(id);
      callback();
    }, durationMs);

    const timer: GameTimer = {
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

  cancelTimer(timerId: string): boolean {
    const timer = this.activeTimers.get(timerId);
    if (!timer) return false;

    clearTimeout(timer.timeoutHandle);
    this.activeTimers.delete(timerId);
    return true;
  }

  cancelTimersByType(type: string): void {
    for (const [id, timer] of this.activeTimers) {
      if (timer.type === type) {
        clearTimeout(timer.timeoutHandle);
        this.activeTimers.delete(id);
      }
    }
  }

  cancelAll(): void {
    for (const timer of this.activeTimers.values()) {
      clearTimeout(timer.timeoutHandle);
    }
    this.activeTimers.clear();
  }

  getRemainingTime(type: string): number | null {
    for (const timer of this.activeTimers.values()) {
      if (timer.type === type) {
        return Math.max(0, timer.endsAt - Date.now());
      }
    }
    return null;
  }

  getTimerInfo(type: string): { endsAt: number; durationMs: number } | null {
    for (const timer of this.activeTimers.values()) {
      if (timer.type === type) {
        return { endsAt: timer.endsAt, durationMs: timer.durationMs };
      }
    }
    return null;
  }

  isActive(type: string): boolean {
    for (const timer of this.activeTimers.values()) {
      if (timer.type === type) return true;
    }
    return false;
  }
}
