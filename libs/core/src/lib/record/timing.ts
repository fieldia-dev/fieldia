import type { TimeLimit } from '../format/flow';
import type { Page } from '../format/page';
import type { FormState } from './form';
import type { Scheduler } from './scheduler';

/**
 * A page's time limits (`timeLimit` on the page and on a wizard's steps), the survey part's: what each allows, when it
 * warns and what it does as it runs out, and the countdown showing now — the page's while it runs, else the step on
 * screen's. The form keeps when each started (`state.timers`, kept in its drafts) and which ran out (`state.timeUp`).
 */

/** The page's own limit's scope: a step's is its id. */
export const WHOLE_FORM = '#form';
const MINUTE = 60_000;

/** A time limit as it is kept to: in ms, its warning's too, what it does. */
export interface Limit {
  scope: string;
  ms: number;
  warnMs: number;
  then: 'send' | 'lock';
}

/** The countdown showing now. */
export interface Countdown extends Limit {
  /** When it started and ends, by the form's clock (ms). */
  started: number;
  ends: number;
  /** What is left, in ms, never below 0. */
  left: number;
  /** Running, past its warning, or run out. */
  stage: 'running' | 'warning' | 'up';
}

function limitOf(scope: string, limit: TimeLimit, step: boolean): Limit {
  const ms = limit.minutes * MINUTE;
  return { scope, ms, warnMs: (limit.warn ?? Math.min(1, limit.minutes / 5)) * MINUTE, then: limit.then ?? (step ? 'lock' : 'send') };
}

/** Every time limit of a page, by scope: the page's (`#form`), each step's by its id. */
export function limitsOf(page: Page): Record<string, Limit> {
  const out: Record<string, Limit> = {};
  if (page.data.kind !== 'responses') return out;
  if (page.timeLimit) out[WHOLE_FORM] = limitOf(WHOLE_FORM, page.timeLimit, false);
  if (page.layout.type === 'wizard') for (const step of page.layout.children) if (step.timeLimit) out[step.id] = limitOf(step.id, step.timeLimit, true);
  return out;
}

/** A limit's countdown, started then, read now. */
export function countdownOf(limit: Limit, started: number, now: number): Countdown {
  const ends = started + limit.ms;
  const left = Math.max(0, ends - now);
  return { ...limit, started, ends, left, stage: left === 0 ? 'up' : left <= limit.warnMs ? 'warning' : 'running' };
}

/**
 * The countdown showing now: the page's while it runs (or has run out), else the step's on screen; null where neither
 * has started.
 */
export function countdownNow(page: Page, timers: Readonly<Record<string, number>>, step: string | null, now: number): Countdown | null {
  const limits = limitsOf(page);
  const whole = limits[WHOLE_FORM];
  if (whole && timers[WHOLE_FORM] !== undefined) return countdownOf(whole, timers[WHOLE_FORM], now);
  const own = step ? limits[step] : undefined;
  if (own && timers[own.scope] !== undefined) return countdownOf(own, timers[own.scope], now);
  return null;
}

/** What a form's time limits ask of the form they are kept for. */
export interface TimeHost {
  readonly page: Page;
  readonly scheduler: Scheduler;
  /** Now, in ms, by the form's clock. */
  clock(): number;
  state(): FormState;
  set(patch: Partial<FormState>): void;
  /** The steps shown now, in their order. */
  steps(): string[];
  disposed(): boolean;
  /** Keep a draft soon, where the form keeps drafts: a clock started is kept at once. */
  keep(): void;
}

/** A form's time limits, kept (`keepTime`). */
export interface TimeKit {
  /** The page's limit started: its Start pressed. */
  start(): void;
  /** A step entered: its own limit, if any, starts the first time. */
  entered(step: string): void;
  /** Each started limit set to run out on time — at once, for one past its end. */
  arm(): void;
  /** Started again: no limit started, none set to run out. */
  reset(): void;
  /** The countdown showing now. */
  countdown(): Countdown | null;
  /** What a send tells of the page's limit: when it started, whether it ran out. */
  told(): { started?: string; timeUp?: boolean };
}

/**
 * A form's time limits: each started limit set to run out on the form's clock; as it does, its answers locked
 * (`state.timeUp`) and — a step's that locks, on screen — the form gone on to the next step. A page's whose answers go
 * as it runs out leaves the send to the viewer (or the app), which watches `timeUp`.
 */
export function keepTime(host: TimeHost): TimeKit {
  const { page, scheduler } = host;
  const limits = limitsOf(page);
  const running = new Map<string, unknown>();
  const begin = (scope: string) => {
    const state = host.state();
    if (!limits[scope] || state.timers[scope] !== undefined) return;
    host.set({ timers: { ...state.timers, [scope]: host.clock() } });
    kit.arm();
    host.keep();
  };
  function ranOut(scope: string) {
    running.delete(scope);
    const state = host.state();
    if (host.disposed() || state.timeUp.includes(scope) || state.sent) return;
    const shown = host.steps();
    const following = scope !== WHOLE_FORM && limits[scope].then === 'lock' && state.step === scope ? shown[shown.indexOf(scope) + 1] : undefined;
    host.set({ timeUp: [...state.timeUp, scope], ...(following ? { step: following, errors: {} } : {}) });
  }
  const kit: TimeKit = {
    start: () => begin(WHOLE_FORM),
    entered: (step) => begin(step),
    arm() {
      const state = host.state();
      for (const [scope, limit] of Object.entries(limits)) {
        const started = state.timers[scope];
        if (started === undefined || state.timeUp.includes(scope) || running.has(scope)) continue;
        running.set(scope, scheduler.setTimeout(() => ranOut(scope), Math.max(0, started + limit.ms - host.clock())));
      }
    },
    reset() {
      for (const timer of running.values()) scheduler.clearTimeout(timer);
      running.clear();
    },
    countdown() {
      const state = host.state();
      const now = countdownNow(page, state.timers, state.step, host.clock());
      return now && state.timeUp.includes(now.scope) ? { ...now, left: 0, stage: 'up' } : now;
    },
    told() {
      const state = host.state();
      const started = state.timers[WHOLE_FORM];
      return started !== undefined ? { started: new Date(started).toISOString(), timeUp: state.timeUp.includes(WHOLE_FORM) } : state.timeUp.length ? { timeUp: false } : {};
    },
  };
  return kit;
}
