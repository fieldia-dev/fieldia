import type { ActionStep, ButtonNode, CallStep, Page, PageEvents, StatButton } from '@fieldia/core';
import { findHeaderPart } from './header-commands';
import { locate } from './layout-tree';
import { containers, tabsNodes } from './page-tree';
import { Refusal } from './refusal';
import { fieldsReadBy } from './rules-formula';

/**
 * Where steps are kept, as the designer edits them: a press — a button in
 * the body, in a record's header, a counter, a list's button — a field's
 * change, one of the form's moments, or a tab or wizard step shown. No DOM.
 *
 * A press is edited as one list: its `steps`, then its app `action` as the
 * `call` step it is run as. A button with only an action shows as that one
 * step, and a list that is one plain `call` is written back as an `action`,
 * so a button the designer did not change keeps the shape it had.
 */

export type Moment = 'open' | 'beforeSave' | 'afterSave';

/** A list of steps, by where it is. */
export type StepsPlace = { press: string } | { change: string } | { moment: Moment } | { show: string };

/** A step by its place: `[1]` the second step, `[1, 0]` the first of its `then`. */
export type StepPath = number[];

export const MOMENTS: readonly Moment[] = ['open', 'beforeSave', 'afterSave'];

export function placeKey(place: StepsPlace): string {
  if ('press' in place) return `press:${place.press}`;
  if ('change' in place) return `change:${place.change}`;
  if ('moment' in place) return `moment:${place.moment}`;
  return `show:${place.show}`;
}

export const samePlace = (a: StepsPlace, b: StepsPlace) => placeKey(a) === placeKey(b);

/** A button anywhere on the page, by its id: in the body, a record's header (a button or a counter), or a list's. */
export function pressOf(page: Page, id: string): ButtonNode | StatButton | null {
  const node = locate(page, id)?.node;
  if (node?.type === 'button') return node;
  const header = findHeaderPart(page, id);
  if (header && header.kind !== 'badge') return header.part as ButtonNode | StatButton;
  const root = page.layout;
  if (root.type === 'list') return root.actions?.find((a) => a.id === id) ?? null;
  return null;
}

/** A press's app action, as the `call` step it is run as. */
function actionStep(press: ButtonNode | StatButton): CallStep | null {
  if (press.action === undefined) return null;
  const params = (press as ButtonNode).params;
  return { do: 'call', action: press.action, ...(params ? { params } : {}) };
}

/** The steps kept at a place, as the editor shows them; none where there are none, or no such place. */
export function stepsAt(page: Page, place: StepsPlace): ActionStep[] {
  if ('press' in place) {
    const press = pressOf(page, place.press);
    if (!press) return [];
    const call = actionStep(press);
    return [...(press.steps ?? []), ...(call ? [call] : [])];
  }
  const on = page.on;
  if (!on) return [];
  if ('change' in place) return on.change?.[place.change] ?? [];
  if ('moment' in place) return on[place.moment] ?? [];
  return on.show?.[place.show] ?? [];
}

/** Whether the place is on the page: a press that is there, a field it has, a tab or step it has. */
export function placeIsThere(page: Page, place: StepsPlace): boolean {
  if ('press' in place) return pressOf(page, place.press) !== null;
  if ('change' in place) return !!page.fields[place.change];
  if ('show' in place) return showTargets(page).some((t) => t.id === place.show);
  return true;
}

/**
 * Keep a list at its place. A press needs something to do: a list left empty
 * is refused; one plain `call` is its action, as a button that only names an
 * action is; anything else its steps. A moment left with none goes, and `on`
 * with it once it holds nothing.
 */
export function writeSteps(draft: Page, place: StepsPlace, steps: ActionStep[]): void {
  if ('press' in place) {
    const press = pressOf(draft, place.press);
    if (!press) throw new Refusal((w) => w.steps.noPlace);
    if (!steps.length) throw new Refusal((w) => w.steps.needsSomething(press.label));
    // A counter takes no params with its action: a call with some stays a step.
    const only = steps.length === 1 && steps[0].do === 'call' && steps[0].when === undefined && (!steps[0].params || 'type' in press) ? steps[0] : null;
    // Each key that stays keeps its place in the button, as the JSON shows it.
    if (only) {
      delete press.steps;
      press.action = only.action;
      if (only.params) (press as ButtonNode).params = only.params;
      else delete (press as ButtonNode).params;
    } else {
      delete press.action;
      delete (press as ButtonNode).params;
      press.steps = steps;
    }
    return;
  }
  if (!placeIsThere(draft, place)) throw new Refusal((w) => w.steps.noPlace);
  const on: PageEvents = draft.on ?? {};
  if ('moment' in place) {
    if (steps.length) on[place.moment] = steps;
    else delete on[place.moment];
  } else {
    const key = 'change' in place ? 'change' : 'show';
    const name = 'change' in place ? place.change : (place as { show: string }).show;
    const map = { ...(on[key] ?? {}) };
    if (steps.length) map[name] = steps;
    else delete map[name];
    if (Object.keys(map).length) on[key] = map;
    else delete on[key];
  }
  if (Object.keys(on).length) draft.on = on;
  else delete draft.on;
}

/** The step at a path, or none. */
export function stepAt(list: readonly ActionStep[], path: StepPath): ActionStep | undefined {
  let step: ActionStep | undefined = list[path[0]];
  for (const i of path.slice(1)) step = step?.do === 'open' ? step.then?.[i] : undefined;
  return step;
}

/** The list a path's step sits in, as a copy of the whole to change: the list itself is changed in place. */
export function holderOf(list: ActionStep[], path: StepPath): ActionStep[] | null {
  let holder: ActionStep[] = list;
  for (const i of path.slice(0, -1)) {
    const step = holder[i];
    if (step?.do !== 'open') return null;
    step.then = step.then ?? [];
    holder = step.then;
  }
  return holder;
}

/** An open step whose `then` was emptied loses it: the format takes no empty list. */
export function tidyThen(list: ActionStep[]): ActionStep[] {
  for (const step of list) {
    if (step.do !== 'open' || !step.then) continue;
    if (step.then.length) tidyThen(step.then);
    else delete step.then;
  }
  return list;
}

/** Every step of a list, at any depth, with its path. */
export function eachStep(list: readonly ActionStep[], path: StepPath = []): { step: ActionStep; path: StepPath }[] {
  return list.flatMap((step, i) => [{ step, path: [...path, i] }, ...(step.do === 'open' && step.then ? eachStep(step.then, [...path, i]) : [])]);
}

/** The tabs and wizard steps a step can go to, or show steps for, in reading order, with their words. */
export function showTargets(page: Page): { id: string; label: string }[] {
  const root = page.layout;
  if (root.type === 'wizard') return root.children.map((step) => ({ id: step.id, label: step.label }));
  if (root.type === 'tabs') return root.children.map((tab) => ({ id: tab.id, label: tab.label }));
  if (root.type === 'list') return [];
  return tabsNodes(page).flatMap((tabs) => tabs.children.map((tab) => ({ id: tab.id, label: tab.label })));
}

/** Every list of steps on the page, where it is, in reading order: the presses, then the changes, then the moments. */
export function everyPlace(page: Page): { place: StepsPlace; steps: ActionStep[] }[] {
  const out: { place: StepsPlace; steps: ActionStep[] }[] = [];
  const press = (part: { id: string; steps?: ActionStep[] }) => {
    if (part.steps?.length) out.push({ place: { press: part.id }, steps: stepsAt(page, { press: part.id }) });
  };
  const root = page.layout;
  if (root.type === 'sheet') [...(root.buttons ?? []), ...(root.statButtons ?? [])].forEach(press);
  if (root.type === 'list') (root.actions ?? []).forEach(press);
  for (const c of containers(page)) for (const node of c.children) if (node.type === 'button') press(node);
  const on = page.on ?? {};
  for (const [field, steps] of Object.entries(on.change ?? {})) out.push({ place: { change: field }, steps });
  for (const moment of MOMENTS) if (on[moment]?.length) out.push({ place: { moment }, steps: on[moment] as ActionStep[] });
  for (const [show, steps] of Object.entries(on.show ?? {})) out.push({ place: { show }, steps });
  return out;
}

/** The fields of this page a step names: the field it sets, empties or adds a line to, those it checks, those it puts answers in. */
export function fieldsNamed(step: ActionStep): string[] {
  switch (step.do) {
    case 'set':
    case 'clear':
    case 'addLine':
      return [step.field];
    case 'check':
      return step.fields ?? [];
    case 'open':
      return Object.keys(step.into ?? {});
    default:
      return [];
  }
}

/** The fields of this page a step's expressions read: when it runs, the value it sets, what an opened page starts with. Not its answers: those are the opened page's. */
export function fieldsRead(step: ActionStep): string[] {
  const sources: (string | boolean | undefined)[] = [step.when];
  if (step.do === 'set') sources.push(step.value);
  if (step.do === 'addLine') sources.push(...Object.values(step.values ?? {}));
  if (step.do === 'open') sources.push(step.record, ...Object.values(step.values ?? {}));
  return [...new Set(sources.flatMap((s) => fieldsReadBy(s)))];
}

/** Every field the page's steps need to have a definition: named, read, or changed. */
export function fieldsStepsNeed(page: Page): Set<string> {
  const need = new Set<string>(Object.keys(page.on?.change ?? {}));
  for (const { steps } of everyPlace(page)) {
    for (const { step } of eachStep(steps)) for (const name of [...fieldsNamed(step), ...fieldsRead(step)]) need.add(name);
  }
  return need;
}

/** Steps going to a tab or step no longer there, and a tab's or step's own steps once it is gone: taken away. */
export function forgetGoneTargets(page: Page): void {
  const there = new Set(showTargets(page).map((t) => t.id));
  const on = page.on;
  if (on?.show) {
    for (const id of Object.keys(on.show)) if (!there.has(id)) delete on.show[id];
    if (!Object.keys(on.show).length) delete on.show;
    if (!Object.keys(on).length) delete page.on;
  }
  const keep = (list: ActionStep[]): ActionStep[] =>
    list.filter((step) => step.do !== 'goTo' || there.has(step.target)).map((step) => (step.do === 'open' && step.then ? { ...step, then: keep(step.then) } : step));
  for (const { place, steps } of everyPlace(page)) {
    const kept = tidyThen(keep(steps));
    if (JSON.stringify(kept) === JSON.stringify(steps)) continue;
    // A press left with nothing to do keeps its steps: the page's own check says where they go.
    if ('press' in place && !kept.length) continue;
    try {
      writeSteps(page, place, kept);
    } catch {
      // A place no longer there: the page's own check says so.
    }
  }
}
