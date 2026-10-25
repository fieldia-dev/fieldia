/**
 * The time a proof test of the 0.34 hardening audits gives work the code bounds — a pattern refused or capped, an
 * archive's file stopped where it says it ends, a workbook read once through, long text left unread, a worked-out
 * value held to its most. Every proof took 0.3 to 8.5 s before its fix; a fixed 50 ms was a guess that a shared CI
 * runner missed (unzip's proof took 59.7 ms on PR #34's). So the clock only shows the work never runs away — one
 * bound, far under every proof's time before and safe on a slow runner — and the bounded work itself is asserted by
 * counting it where the code can be counted: bytes inflated, a pattern's tries, characters scanned.
 */
export const PROOF_MS = 500;

/** How long `run` takes, in milliseconds. */
export function timed(run: () => unknown): number {
  const start = performance.now();
  run();
  return performance.now() - start;
}

/** How long an asynchronous `run` takes, in milliseconds, and what it answered (or threw). */
export async function timedAsync<T>(run: () => Promise<T>): Promise<{ result: T | unknown; ms: number }> {
  const start = performance.now();
  const result = await run().catch((error: unknown) => error);
  return { result, ms: performance.now() - start };
}
