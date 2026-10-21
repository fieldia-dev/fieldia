import type { Page } from '../format/page';
import type { StoredDraft, SubmitRequest } from './data-source';
import type { FormState } from './form';
import { drawOrder, type DrawnOrder } from './order';
import type { Scheduler } from './scheduler';
import { drawsOrder } from './survey';
import { keepTime, WHOLE_FORM, type Countdown } from './timing';

/**
 * A survey's draw and clocks, kept for a form by the survey part (survey.ts, `formSurveyPart`): the order drawn for each
 * respondent and the parts it leaves out (order.ts), and a page's time limits (timing.ts) — what the form asks of them
 * at its moments: a part hidden or locked, a draft kept and laid, a send told, a response started again, a step entered.
 */

/** What a survey's draw and clocks ask of the form they are kept for. */
export interface SurveyHost {
  readonly page: Page;
  readonly scheduler: Scheduler;
  /** The respondent's own seed — the app's, else the person's id — or null: one of this browser's for each response. */
  readonly seed: string | null;
  /** Now, in ms, by the form's clock. */
  clock(): number;
  state(): FormState;
  set(patch: Partial<FormState>): void;
  /** The steps shown now, in their order. */
  steps(): string[];
  /** The wizard's steps in the order drawn, or null: the page's own. */
  order(steps: string[] | null): void;
  /** The part a part of the page sits in. */
  parentOf(id: string): string | null;
  disposed(): boolean;
  /** Keep a draft soon, where the form keeps drafts. */
  keep(): void;
}

/** A form's survey draw and clocks (`surveyKit`). */
export interface SurveyKit {
  /** The draw made, where the page draws and the form has none yet: its first step the drawn one's while the person has not moved. */
  open(): void;
  /** Whether a part was left out by the draw: never shown, asked, required or sent. */
  hidden(id: string): boolean;
  /** Whether a part's time ran out — the page's, or that of the step it is on: locked, its checks refusing nothing. */
  locked(id: string): boolean;
  /** What a draft keeps of them: the draw, the clocks' starts. */
  draft(): Pick<StoredDraft, 'order' | 'timers'>;
  /** A draft laid: its draw where the page still has it, its clocks going on from their starts. */
  lay(draft: StoredDraft): void;
  /** What a send tells of them: the order shown, when the page's clock started and whether it ran out. */
  sent(): Pick<SubmitRequest, 'order' | 'started' | 'timeUp'>;
  /** Started again, a new respondent: drawn anew (unless the app or the person's id is the seed), no clock running. */
  reset(): void;
  /** A step entered: its own clock starts the first time. */
  entered(step: string): void;
  /** The page's clock started: its Start pressed. */
  start(): void;
  /** The countdown showing now. */
  countdown(): Countdown | null;
}

export function surveyKit(host: SurveyHost): SurveyKit {
  const { page } = host;
  const drawn = drawsOrder(page);
  const time = keepTime(host);
  /** Each part's parts, by its id: what a draw kept in a draft may name. */
  const partsOf = new Map<string, Set<string>>();
  const walk = (node: { id?: string; children?: unknown[] }) => {
    const children = Array.isArray(node.children) ? (node.children as { id?: string; children?: unknown[] }[]) : [];
    if (node.id) partsOf.set(node.id, new Set(children.map((child) => child.id ?? '')));
    children.forEach(walk);
  };
  walk(page.layout as unknown as { id?: string; children?: unknown[] });
  let undrawn = new Set<string>();
  /** The steps and the parts left out, as an order has them. */
  function take(order: DrawnOrder | null) {
    undrawn = new Set();
    for (const [id, list] of Object.entries(order ?? {})) for (const part of partsOf.get(id) ?? []) if (!list.includes(part)) undrawn.add(part);
    host.order((page.layout.type === 'wizard' && order?.[page.layout.id]) || null);
  }
  const draw = () => drawOrder(page, host.seed ?? Math.random().toString(36).slice(2));
  /** An order set, the first step the drawn one's while the person has not moved. */
  function placed(order: DrawnOrder | null) {
    const was = host.steps()[0];
    take(order);
    host.set({ order, ...(host.state().step === was ? { step: host.steps()[0] ?? null } : {}) });
  }
  const kit: SurveyKit = {
    open() {
      if (drawn && !host.state().order) placed(draw());
    },
    hidden: (id) => undrawn.has(id),
    locked(id) {
      const up = host.state().timeUp;
      if (!up.length) return false;
      if (up.includes(WHOLE_FORM)) return true;
      for (let at: string | null = id; at; at = host.parentOf(at)) if (up.includes(at)) return true;
      return false;
    },
    draft() {
      const state = host.state();
      return {
        ...(state.order ? { order: state.order as DrawnOrder } : {}),
        ...(Object.keys(state.timers).length ? { timers: Object.fromEntries(Object.entries(state.timers).map(([scope, at]) => [scope, new Date(at).toISOString()])) } : {}),
      };
    },
    lay(draft) {
      // Its draw, where every part it names is still the page's with the parts it lists.
      const kept = Object.entries(draft.order ?? {}).filter(([id, list]) => partsOf.has(id) && Array.isArray(list) && list.every((one) => partsOf.get(id)?.has(one)));
      if (drawn && kept.length) placed(Object.fromEntries(kept));
      const timers = Object.entries(draft.timers ?? {}).filter(([, at]) => typeof at === 'string' && !Number.isNaN(Date.parse(at)));
      if (timers.length) {
        host.set({ timers: { ...host.state().timers, ...Object.fromEntries(timers.map(([scope, at]) => [scope, Date.parse(at)])) } });
        time.arm();
      }
    },
    sent() {
      const order = host.state().order;
      return { ...(order ? { order: order as DrawnOrder } : {}), ...time.told() };
    },
    reset() {
      time.reset();
      const order = drawn ? (host.seed === null ? draw() : (host.state().order as DrawnOrder | null) ?? draw()) : null;
      take(order);
      host.set({ order, timers: {}, timeUp: [] });
    },
    entered: (step) => time.entered(step),
    start: () => time.start(),
    countdown: () => time.countdown(),
  };
  return kit;
}
