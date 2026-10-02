/**
 * Timers, injected. Core compiles without the DOM or Node's types, and tests
 * drive time by hand instead of waiting for it.
 */
export interface Scheduler {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

interface HostTimers {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

/** The host's own timers: the browser's or Node's, whichever is running. */
export const hostScheduler: Scheduler = {
  setTimeout: (callback, ms) => (globalThis as unknown as HostTimers).setTimeout(callback, ms),
  clearTimeout: (handle) => (globalThis as unknown as HostTimers).clearTimeout(handle),
};

/** Resolve after `ms`, on the given scheduler. */
export function wait(ms: number, scheduler: Scheduler = hostScheduler): Promise<void> {
  return new Promise((resolve) => {
    scheduler.setTimeout(resolve, ms);
  });
}
