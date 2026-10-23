import type { StoredDraft, SubmitRequest } from './data-source';
import type { FormInner, FormJoin } from './joins';
import { askedInOrder, drawOrder, drawsOrder, type DrawnOrder } from './order';
import { quizResults, type QuizResults } from './quiz';
import type { Values } from './values';
import { keepTime, WHOLE_FORM, type Countdown } from './timing';

/**
 * A survey's draw and clocks, kept for a form by the survey flow's part (survey.ts, `formSurveyPart`): the order drawn for each
 * respondent and the parts it leaves out (order.ts), and a page's time limits (timing.ts) — what the form asks of them
 * at its moments: a part hidden or locked, a draft kept and laid, a send told, a response started again, a step entered.
 */

/** A form's survey draw and clocks (`join`; `form.joined('surveyflow')`): its hooks into the form, and its own. */
export interface SurveyKit extends FormJoin {
  /** Whether a part was left out by the draw: never shown, asked, required or sent. */
  hides(id: string): boolean;
  /** Whether a part's time ran out — the page's, or that of the step it is on: locked, its checks refusing nothing. */
  locks(id: string): boolean;
  /** What a draft keeps of them: the draw, the clocks' starts. */
  kept(): Pick<StoredDraft, 'order' | 'timers'>;
  /** A draft laid: its draw where the page still has it, its clocks going on from their starts. */
  lay(draft: StoredDraft): void;
  /** Started again, a new respondent: drawn anew (unless the app or the person's id is the seed), no clock running, on the first step drawn. */
  reset(): void;
  /** A step entered: its own clock starts the first time. */
  entered(step: string): void;
  /** The page's clock started: its Start pressed. */
  start(): void;
  /** The countdown showing now. */
  countdown(): Countdown | null;
  /** A quiz's results for the answers as sent (`quiz` on the page), in the order they were asked; undefined where it has none. */
  marked(values: Values): QuizResults | undefined;
}

/**
 * The survey flow's side of a form (joins.ts), made as the form is: the draw made where the page draws and the form has
 * none yet — its first step the drawn one's while the person has not moved — and what a response is sent with told
 * (`around`: the order shown, when the page's clock started and whether it ran out).
 */
export function join(host: FormInner): SurveyKit {
  const { page, form } = host;
  const drawn = drawsOrder(page);
  const time = keepTime({ page, scheduler: host.scheduler, clock: () => form.now().getTime(), state: () => form.getState(), set: host.set, steps: () => form.steps(), disposed: host.disposed, keep: host.keep });
  const user = form.user()?.id;
  const seed = host.options.seed ?? (user != null ? String(user) : null);
  /** Each part's parts, by its id — what a draw kept in a draft may name — and the part each sits in. */
  const partsOf = new Map<string, Set<string>>();
  const parents = new Map<string, string>();
  const walk = (node: { id?: string; children?: unknown[] }) => {
    const children = Array.isArray(node.children) ? (node.children as { id?: string; children?: unknown[] }[]) : [];
    if (node.id) partsOf.set(node.id, new Set(children.map((child) => child.id ?? '')));
    for (const child of children) if (node.id && child.id) parents.set(child.id, node.id);
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
  const draw = () => drawOrder(page, seed ?? Math.random().toString(36).slice(2));
  /** An order set, the first step the drawn one's while the person has not moved. */
  function placed(order: DrawnOrder | null) {
    const was = form.steps()[0];
    take(order);
    host.set({ order, ...(form.getState().step === was ? { step: form.steps()[0] ?? null } : {}) });
  }
  /** What a response is sent with of them: the order shown, when the page's clock started and whether it ran out. */
  const told = (): Pick<SubmitRequest, 'order' | 'started' | 'timeUp'> => {
    const order = form.getState().order;
    return { ...(order ? { order: order as DrawnOrder } : {}), ...time.told() };
  };
  /** The answers and the step last kept while a clock runs. */
  let keptAs: unknown[] = [];
  const kit: SurveyKit = {
    hides: (id) => undrawn.has(id),
    locks(id) {
      const up = form.getState().timeUp;
      if (!up.length) return false;
      if (up.includes(WHOLE_FORM)) return true;
      for (let at: string | undefined = id; at; at = parents.get(at)) if (up.includes(at)) return true;
      return false;
    },
    kept() {
      const state = form.getState();
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
        host.set({ timers: { ...form.getState().timers, ...Object.fromEntries(timers.map(([scope, at]) => [scope, Date.parse(at)])) } });
        time.arm();
      }
    },
    around: (kind, sent, go) => go(kind === 'submit' ? { ...(sent as SubmitRequest), ...told() } : sent),
    changed() {
      // While a clock runs, each answer given is kept at once, never a moment later: a reload loses nothing typed, nor
      // gains the time it took. Nothing once sent, or started again with nothing given.
      const state = form.getState();
      if (state.sent || !state.dirty.length || !Object.keys(state.timers).length || (state.values === keptAs[0] && state.step === keptAs[1])) return;
      keptAs = [state.values, state.step];
      host.keep();
    },
    reset() {
      time.reset();
      host.set({ timers: {}, timeUp: [] });
      placed(drawn ? (seed === null ? draw() : (form.getState().order as DrawnOrder | null) ?? draw()) : null);
    },
    entered: (step) => time.entered(step),
    start: () => time.start(),
    countdown: () => time.countdown(),
    marked: (values) => (page.quiz ? quizResults(page, values, askedInOrder(page, (form.getState().order ?? null) as DrawnOrder | null, values)) ?? undefined : undefined),
  };
  if (drawn && !form.getState().order) placed(draw());
  return kit;
}
