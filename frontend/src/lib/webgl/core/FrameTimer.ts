/**
 * Tracks delta time and cumulative elapsed time from `performance.now()`
 * timestamps. `reset()` must be called after a pause (e.g. the tab was
 * hidden) so the next tick doesn't report the paused duration as a single
 * frame's delta.
 */
export class FrameTimer {
  private lastTime: number | null = null;
  elapsed = 0;

  /** Clamped to 100ms so a stalled frame never produces a large jump. */
  private static readonly MAX_DT = 0.1;

  tick(now: number): number {
    if (this.lastTime === null) {
      this.lastTime = now;
      return 0;
    }
    const dt = Math.min((now - this.lastTime) / 1000, FrameTimer.MAX_DT);
    this.lastTime = now;
    this.elapsed += dt;
    return dt;
  }

  reset(): void {
    this.lastTime = null;
  }

  /** Set a deliberate animation state while resetting the next-frame delta. */
  setElapsed(elapsed: number): void {
    this.elapsed = Math.max(0, elapsed);
    this.lastTime = null;
  }
}
