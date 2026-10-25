/**
 * What a change costs a form, counted rather than timed — the same on any machine — and the plain way to work a change
 * out that the quick way is held to.
 *
 * Since 0.35 a form works out only what reads what changed: a condition is read again once a value it reads changed, a
 * worked-out value once one it is worked out from did, a field's problem once its answer or what its rules read did, and
 * the viewer brings a part up to date only once what it shows changed. `recomputeInFull(true)` makes the forms and
 * viewers made after it work every change out in full instead — every condition read, every value worked out, every
 * part brought up to date — as before 0.35: the oracle Fieldia's own tests compare the quick way with, on pages made at
 * random. An app never needs it; its tests may use it the same way.
 */

let full = false;

/** Whether forms and viewers made from now work each change out in full; `on` sets it. Each keeps what it was made with. */
export function recomputeInFull(on?: boolean): boolean {
  if (on !== undefined) full = on;
  return full;
}

/**
 * The work done since the page opened, by every form and viewer on it: conditions read (`conditions`), values worked
 * out (`computes`), fields checked (`checks`) and parts brought up to date (`updaters`). Tests read it before and after
 * an action: a key typed on a page of 500 fields brings a handful of parts up to date, not 500.
 */
export const workCounts = { conditions: 0, computes: 0, checks: 0, updaters: 0 };
