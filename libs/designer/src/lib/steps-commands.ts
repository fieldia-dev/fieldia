import type { ActionStep, AddLineStep, CallStep, CheckStep, GoToStep, OpenStep, OpenUrlStep, Page, PostStep, SayStep, SetStep } from '@fieldia/core';
import type { DesignerWords } from './designer-words';
import { en } from './locales/en';
import { Refusal } from './refusal';
import { formulaProblem, problemWords } from './rules-formula';
import { holderOf, placeIsThere, placeKey, showTargets, stepAt, stepsAt, tidyThen, writeSteps, type StepPath, type StepsPlace } from './steps-places';

/**
 * The store's steps: what a press, a field's change or one of the form's
 * moments does. Each edit goes through the designer's `apply`, so it is one
 * undo step, checked before it is kept and saved like every other; typing in
 * one box of one step is one step, through the merge key. What a step cannot
 * be is refused in words (`stepProblem`), as the editor checks before it
 * hands anything on.
 */

/** Everything a step of any kind may say, but what kind it is. */
type StepFields = Omit<OpenStep, 'do'> & Omit<SetStep, 'do'> & Omit<AddLineStep, 'do'> & Omit<CheckStep, 'do'> & Omit<GoToStep, 'do'> & Omit<SayStep, 'do'> & Omit<CallStep, 'do'> & Omit<OpenUrlStep, 'do'> & Omit<PostStep, 'do'>;

/** A change to a step: a value sets it, `null` takes it away. */
export type StepPatch = { [K in keyof StepFields]?: StepFields[K] | null };

export interface StepsCommands {
  /** What a place does, in order, as the editor shows it: a button with only an app action shows it as one `call` step. */
  steps(place: StepsPlace): ActionStep[];
  /** A list's steps at once, as one edit; an empty list takes a moment's away (a button keeps needing something to do). */
  setSteps(place: StepsPlace, steps: ActionStep[]): boolean;
  /**
   * A step at the end of a list — or of an open step's `then`, by that
   * step's path — as one edit. Returns its path. `typing`: it was finished
   * by typing in that box, which goes on as the same undo step.
   */
  addStep(place: StepsPlace, step: ActionStep, options?: { then?: StepPath; typing?: string }): StepPath | false;
  /** One step changed. With `typing`, a run of typing in one of its boxes is one undo step. */
  updateStep(place: StepsPlace, path: StepPath, patch: StepPatch, options?: { typing?: boolean }): boolean;
  /** A step moved to another place among its own list. */
  moveStep(place: StepsPlace, path: StepPath, to: number): boolean;
  /** A step taken away, with the steps it ran once its page was saved. */
  removeStep(place: StepsPlace, path: StepPath): boolean;
}

export interface StepsCommandsDeps {
  apply(edit: (draft: Page) => void, merge?: string | null): boolean;
  getPage(): Page;
}

const KINDS_WITH_FIELD = new Set(['set', 'clear', 'addLine']);
/** The kinds of field a step can set from an expression, as the format allows. */
export const SETTABLE = new Set(['char', 'text', 'html', 'integer', 'float', 'monetary', 'boolean', 'date', 'datetime', 'selection', 'json']);

/** A step with what was taken away left out: `null`, undefined, and empty words where words are optional. */
function withoutEmpty(step: Record<string, unknown>): ActionStep {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(step)) {
    if (value === null || value === undefined) continue;
    if ((key === 'title' || key === 'record') && value === '') continue;
    if ((key === 'values' || key === 'into' || key === 'params') && typeof value === 'object' && !Object.keys(value as object).length) continue;
    if ((key === 'then' || key === 'fields') && Array.isArray(value) && !value.length) continue;
    out[key] = value;
  }
  return out as unknown as ActionStep;
}

/**
 * What is wrong with a step on this page, in words; null when it can be
 * kept. What it opens, sets, empties or adds to must be there; what it says
 * or asks, the app's action, must be written; its formulas must read.
 */
export function stepProblem(page: Page, step: ActionStep, words: DesignerWords = en): string | null {
  const w = words.steps;
  const formula = (source: string | undefined) => {
    if (source === undefined) return null;
    const problem = formulaProblem(page, source, words);
    return problem ? problemWords(problem, words) : null;
  };
  if (typeof step.when === 'string') {
    if (!step.when.trim()) return w.needsValue;
    const wrong = formula(step.when);
    if (wrong) return wrong;
  }
  if (KINDS_WITH_FIELD.has(step.do)) {
    const name = (step as SetStep).field;
    if (!name || !page.fields[name]) return w.noField;
  }
  switch (step.do) {
    case 'open':
      if (!step.page?.trim()) return w.needsPage;
      for (const value of [step.record, ...Object.values(step.values ?? {})]) {
        if (value === undefined) continue;
        if (!value.trim()) return w.needsValue;
        const wrong = formula(value);
        if (wrong) return wrong;
      }
      for (const [name, value] of Object.entries(step.into ?? {})) if (!page.fields[name] || !value.trim()) return w.needsValue;
      return null;
    case 'set': {
      if (!SETTABLE.has(page.fields[step.field].type)) return w.noField;
      if (!step.value?.trim()) return w.needsValue;
      return formula(step.value);
    }
    case 'addLine': {
      const lines = page.fields[step.field];
      if (lines.type !== 'one2many') return w.noField;
      for (const [name, value] of Object.entries(step.values ?? {})) {
        if (!lines.fields[name] || !value.trim()) return w.needsValue;
        const wrong = formula(value);
        if (wrong) return wrong;
      }
      return null;
    }
    case 'check':
      return step.fields?.some((name) => !page.fields[name]) ? w.noField : null;
    case 'goTo':
      return showTargets(page).some((t) => t.id === step.target) ? null : w.noTabs;
    case 'say':
    case 'ask':
    case 'post':
      return step.message?.trim() ? null : w.needsWords;
    case 'call':
      return step.action?.trim() ? null : w.needsAction;
    case 'openUrl':
      return step.url?.trim() ? formula(step.url) : w.needsAddress;
    default:
      return null;
  }
}

export function stepsCommands({ apply, getPage }: StepsCommandsDeps): StepsCommands {
  /** Change a place's list, as one edit: refused when the place is gone, a step is not one, or a button is left with nothing to do. */
  const change = (place: StepsPlace, edit: (list: ActionStep[], draft: Page) => void, merge: string | null = null) =>
    apply((draft) => {
      const list = JSON.parse(JSON.stringify(stepsAt(draft, place))) as ActionStep[];
      edit(list, draft);
      tidyThen(list);
      // A place no longer there may only lose its steps.
      if (list.length && !placeIsThere(draft, place)) throw new Refusal((w) => w.steps.noPlace);
      writeSteps(draft, place, list);
    }, merge);
  /** A step that cannot be kept is refused, saying why. */
  const refuseIfWrong = (draft: Page, step: ActionStep) => {
    if (stepProblem(draft, step)) throw new Refusal((w) => stepProblem(draft, step, w) as string);
  };
  const missing = (path: StepPath) => new Refusal((w) => w.steps.noStep(path[path.length - 1] + 1));

  return {
    steps: (place) => stepsAt(getPage(), place),

    setSteps(place, steps) {
      return change(place, (list, draft) => {
        list.splice(0, list.length, ...JSON.parse(JSON.stringify(steps)));
        for (const step of list) refuseIfWrong(draft, step);
      });
    },

    addStep(place, step, options = {}) {
      let made: StepPath | null = null;
      // Finished by typing: the typing that goes on in that box is the same undo step.
      const now = stepsAt(getPage(), place);
      const next = [...(options.then ?? []), options.then ? ((stepAt(now, options.then) as OpenStep | undefined)?.then?.length ?? 0) : now.length];
      const merge = options.typing ? `step:${placeKey(place)}:${next.join('.')}:${options.typing}` : null;
      const ok = change(
        place,
        (list, draft) => {
          const tidy = withoutEmpty(step as unknown as Record<string, unknown>);
          refuseIfWrong(draft, tidy);
          if (!options.then) {
            list.push(tidy);
            made = [list.length - 1];
            return;
          }
          const opener = stepAt(list, options.then);
          if (opener?.do !== 'open') throw new Refusal((w) => w.steps.onlyOpenThen);
          opener.then = [...(opener.then ?? []), tidy];
          made = [...options.then, opener.then.length - 1];
        },
        merge
      );
      return ok && made ? made : false;
    },

    updateStep(place, path, patch, options = {}) {
      const merge = options.typing ? `step:${placeKey(place)}:${path.join('.')}:${Object.keys(patch).sort().join(',')}` : null;
      return change(
        place,
        (list, draft) => {
          const holder = holderOf(list, path);
          const at = path[path.length - 1];
          const step = holder?.[at];
          if (!holder || !step) throw missing(path);
          const next = withoutEmpty({ ...step, ...patch });
          refuseIfWrong(draft, next);
          holder[at] = next;
        },
        merge
      );
    },

    moveStep(place, path, to) {
      return change(place, (list) => {
        const holder = holderOf(list, path);
        const from = path[path.length - 1];
        if (!holder?.[from]) throw missing(path);
        if (to < 0 || to >= holder.length || to === from) throw new Refusal((w) => w.steps.cannotMoveFurther);
        const [moved] = holder.splice(from, 1);
        holder.splice(to, 0, moved);
      });
    },

    removeStep(place, path) {
      return change(place, (list) => {
        const holder = holderOf(list, path);
        const at = path[path.length - 1];
        if (!holder?.[at]) throw missing(path);
        holder.splice(at, 1);
      });
    },
  };
}
