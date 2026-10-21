import type { ActionStep } from '../format/actions';
import type { ButtonNode, MenuItem, PressUndo, StatButton } from '../format/layout';
import { fillMessage, type Messages } from './messages';
import { DONE, type ActionHost, type ActionResult, type PressTaken, type RunResult, type RunScope, type Stopped, type UndoKit } from './run';
import { sameValue, type Values } from './values';

const wordsOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Take back what a press did (`PressTaken`), as its toast's Undo asks: the app's own undos, latest first, each
 * answered as a call is; the record it archived brought back, or the reverse; then the values its steps and the
 * app's answers wrote put back — each only while it holds what they left, a change made since by anyone else staying
 * — and saved again where the press saved. On the record the press was on: another shown since, nothing is done.
 */
export async function takeBack(kit: UndoKit, taken: PressTaken, scope: RunScope): Promise<RunResult> {
const { form, answered, recordStep, replaced, tell } = kit;
  scope.generation ??= form.generation();
  const ended = (stopped: Stopped | null): RunResult =>
    stopped ? { done: false, reason: stopped.reason, ...(stopped.message !== undefined ? { message: stopped.message } : {}), ...(stopped.error !== undefined ? { error: stopped.error } : {}) } : DONE;
  try {
    // The app's own, whatever record is shown now: what it answers is laid only on the one the press ended on.
    for (const undo of [...taken.app].reverse()) {
      let answer: void | ActionResult;
      try {
        answer = await undo();
      } catch (error) {
        return ended({ reason: 'app', message: wordsOf(error), error });
      }
      if (!answer) continue;
      if (replaced(scope)) {
        if (answer.say !== undefined) tell(null, typeof answer.say === 'string' ? answer.say : answer.say.message, (typeof answer.say === 'object' && answer.say.tone) || 'info');
        continue;
      }
      const stopped = await answered(answer, scope);
      if (stopped) return ended(stopped);
    }
    if (taken.archived === undefined && !taken.wrote.size) return DONE;
    if (replaced(scope)) return ended(form.gone());
    if (taken.archived !== undefined) {
      const stopped = await recordStep(taken.archived ? 'unarchive' : 'archive', scope);
      if (stopped) return ended(stopped);
    }
    if (!taken.wrote.size) return DONE;
    const back: Values = {};
    for (const [name, { before, after }] of taken.wrote) if (sameValue(form.values()[name], after)) back[name] = before;
    if (Object.keys(back).length) form.write(back, scope.chain);
    return ended(taken.saved ? await form.save(scope.chain) : null);
  } catch (error) {
    return ended({ reason: 'cannot', message: wordsOf(error), error });
  }
}

/** What a press that offered Undo is said with once it ends, and what Undo is handed (form.ts). */
export interface OfferContext {
  kit: UndoKit;
  source: ButtonNode | StatButton | MenuItem;
  scope: RunScope;
  taken: PressTaken;
  result: RunResult;
  offers: PressUndo | undefined;
  host: ActionHost | undefined;
  messages: Messages;
  /** The number of the record shown now: Undo's steps run on the one the press ended on. */
  generation(): number;
  track<T>(work: Promise<T>): Promise<T>;
  /** Why a run stops whose record was replaced. */
  replaced(): Stopped;
  told(id: string, steps: readonly ActionStep[], result: RunResult): void;
}

/**
 * A press that offers Undo has ended: the words it held are said — the last, once it ran whole, with Undo, where what
 * it did can be taken back (its button's steps for it; else Fieldia's own taking back, where nothing it did is beyond
 * it; else the app's own undos) — or, with nothing said, "Done: {label}". Undo runs on the record the press ended on:
 * another shown since, only the app's own undos run.
 */
export function offerUndo(context: OfferContext): void {
  const { kit, source, scope, taken, result, offers, host, messages } = context;
  const did = taken.app.length > 0 || taken.archived !== undefined || taken.wrote.size > 0;
  const can = result.done && (Array.isArray(offers) || (offers === true ? did && taken.beyond === undefined : taken.app.length > 0));
  const said = [...taken.said];
  const builtin = 'builtin' in source ? source.builtin : undefined;
  const done = builtin === 'archive' ? messages.pressArchived : builtin === 'unarchive' ? messages.pressUnarchived : fillMessage(messages, messages.pressDone, { label: source.label ?? '' });
  const last = can ? (said.pop() ?? { message: done, tone: 'success' as const }) : null;
  for (const words of said) host?.say(words.message, words.tone);
  if (!last) return;
  const on = context.generation();
  const id = `${scope.id}.undo`;
  host?.say(last.message, last.tone, {
    undo: () =>
      context.track(
        (async (): Promise<RunResult> => {
          const again: RunScope = { id, chain: [], typed: 'first', generation: on, ...(scope.recordIds ? { recordIds: [...scope.recordIds] } : {}) };
          const steps = Array.isArray(offers) ? offers : [];
          // Its steps, on the record the press ended on; else what it did, taken back.
          const ended: RunResult = Array.isArray(offers) ? (on === context.generation() ? await kit.runSteps(offers, again) : { done: false, ...context.replaced() }) : await takeBack(kit, offers === true ? taken : { ...taken, wrote: new Map(), archived: undefined }, again);
          context.told(id, steps, ended);
          return ended;
        })()
      ),
  });
}

