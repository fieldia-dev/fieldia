import type { RunResult } from '@fieldia/core';

/** The steps that take a way out of the form, each through its one check (`form.leave()`). */
const WAYS_OUT = new Set(['close', 'reload', 'reset', 'openUrl', 'archive', 'unarchive', 'duplicate', 'call']);

/**
 * Whether a run stopped because the person chose to stay: one of its steps
 * took a way out, and the form's one check was answered Cancel. A dialog or a
 * page in place that would give way once that run's save settles does not ask
 * them a second time; any other stop — an `ask` step answered No — gives way
 * on a save, as it always has.
 */
export const stayed = (result: RunResult): boolean => result.reason === 'no' && !!result.step && WAYS_OUT.has(result.step.do);
