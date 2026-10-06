import type { ActionStep, Page } from '@fieldia/core';
import { iconButton, type ElementFactory } from './chrome';
import type { Designer } from './designer';
import { designerIcon } from './icons';
import { openMenu, type MenuItem } from './menu';
import type { SavedFormRef } from './saved-forms';
import { SETTABLE, stepProblem, type StepPatch } from './steps-commands';
import { showTargets, stepAt, stepsAt, type StepPath, type StepsPlace } from './steps-places';
import { newStep, stepSettings } from './steps-settings';
import { stepSentence, withCode } from './steps-words';

/**
 * What a press, a change or a moment does, as a list of steps a person reads
 * as sentences — "Open Customer in a panel, then put its answer in
 * Customer", "Ask: Send the order?" — each opening in place to its settings,
 * one at a time. "Add a step" offers the kinds that fit the page, grouped
 * plainly; a step that needs words or a page first waits here, begun, and is
 * kept once it has them. A step is moved by its grip or by Alt+↑ and Alt+↓
 * on its sentence, and removed with Undo at hand. A step that opens a page
 * holds the steps run once that page is saved, under it, as a list of their
 * own. The same editor serves every place: a button's When clicked, a
 * field's When it changes, and the form's moments.
 */

export interface StepsEditor {
  element: HTMLElement;
  update(page: Page): void;
  /** Bring it forward: its first step, or Add a step. */
  focus(): void;
}

type Kind = ActionStep['do'];

/** "Add a step"'s groups, in order, and the kinds in each. */
const GROUPS: { group: 'open' | 'values' | 'check' | 'talk' | 'app'; kinds: Kind[] }[] = [
  { group: 'open', kinds: ['open', 'openUrl', 'goTo', 'close'] },
  { group: 'values', kinds: ['set', 'clear', 'addLine'] },
  { group: 'check', kinds: ['check', 'save', 'reset'] },
  { group: 'talk', kinds: ['say', 'ask'] },
  { group: 'app', kinds: ['call', 'reload'] },
];

const keyOf = (path: StepPath | null) => (path ?? []).join('.');
const same = (a: StepPath | null, b: StepPath | null) => a !== null && b !== null && keyOf(a) === keyOf(b);

let made = 0;

interface ListView {
  element: HTMLElement;
  list: HTMLOListElement;
  add: HTMLButtonElement;
  rows: RowView[];
}

interface RowView {
  element: HTMLLIElement;
  kind: Kind;
  /** Begun with Add a step, not kept yet. */
  begun: boolean;
  path: StepPath;
  step: ActionStep;
  then: ListView | null;
  update(step: ActionStep, path: StepPath, count: number): void;
  open(on: boolean): void;
  focusFirst(): void;
  focusSay(): void;
}

export function stepsEditor(el: ElementFactory, designer: Designer, place: StepsPlace, options: { label: string }): StepsEditor {
  const words = designer.words;
  const w = words.steps;
  const base = `fd-do-${++made}`;
  let rowsMade = 0;
  const statusWords = el('span', {});
  const undo = el('button', { type: 'button', class: 'fd-button fd-button-link' }, w.undo);
  const status = el('p', { class: 'fd-answer-rules-status fd-do-status', role: 'status', hidden: '' }, statusWords, undo);
  const keepsOne = el('p', { class: 'fd-properties-hint fd-set-hint fd-do-keeps', hidden: '' }, w.keepsOne);
  const doc = status.ownerDocument;
  const top = listView(() => null);
  const element = el('div', { class: 'fd-do', role: 'group', 'aria-label': options.label }, top.element, keepsOne, status);

  let page = designer.getPage();
  /** The step open, by its path; one at a time, so the list stays short in a narrow panel. */
  let openAt: StepPath | null = null;
  /** A step begun with Add a step and not kept yet: under which step's then (null for the list itself), and what it is so far. */
  let draft: { under: StepPath | null; step: ActionStep } | null = null;
  /** The page just after a step was removed: Undo stands while it is the page. */
  let removedAt: Page | null = null;
  /** The app's saved pages to open, once asked for. */
  let listed: SavedFormRef[] | null = null;
  let asked = false;

  undo.addEventListener('click', () => {
    designer.undo();
    status.hidden = true;
    top.add.focus();
  });

  /** The app's saved pages to open: asked for once — as Add a step opens, or a step that opens one is drawn. */
  function listPages() {
    if (asked || !designer.canPlaceForms()) return;
    asked = true;
    void designer.savedForms().then((refs) => {
      listed = refs;
      draw();
    });
  }
  /** A page the app lists, as saved: its title and its fields. An id typed is not looked up as it is typed. */
  const saved = (id: string): Page | null | undefined => {
    if (!listed?.some((ref) => ref.id === id)) return undefined;
    const found = designer.savedForm(id);
    return found === undefined ? undefined : (found?.page ?? null);
  };

  // ---- a list: the place's own, or an open step's then ------------------------------------------
  function listView(under: () => StepPath | null): ListView {
    const list = el('ol', { class: 'fd-do-list' });
    const add = el('button', { type: 'button', class: 'fd-button fd-button-link fd-do-add', 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, designerIcon(doc, 'plus'), el('span', {}, w.addAStep));
    add.addEventListener('click', () => addMenu(add, under()));
    return { element: el('div', { class: 'fd-do-holder' }, list, add), list, add, rows: [] };
  }

  /** "Add a step": the kinds that fit the page, in their groups. */
  function addMenu(anchor: HTMLButtonElement, under: StepPath | null) {
    // Asked for now, so a step that opens a page offers them as it begins.
    listPages();
    const fields = Object.values(page.fields);
    const fits: Partial<Record<Kind, boolean>> = {
      set: fields.some((def) => SETTABLE.has(def.type)),
      clear: fields.length > 0,
      addLine: fields.some((def) => def.type === 'one2many'),
      goTo: showTargets(page).length > 0,
      // A record is loaded again; a survey's answers are not.
      reload: page.data.kind === 'record',
    };
    const items: MenuItem[] = GROUPS.flatMap(({ group, kinds }) =>
      kinds.filter((kind) => fits[kind] !== false).map((kind, i) => ({ id: kind, label: w.kinds[kind], ...(i === 0 ? { heading: w.groups[group] } : {}) }))
    );
    // Its groups' headings say what it holds: no title over them, and a little closer, so the whole list fits in view.
    const menu = openMenu({ el, anchor, actions: true, items, onPick: (kind) => begin(kind as Kind, under) }).element;
    menu.setAttribute('aria-label', under ? w.addThen : w.addAStep);
    menu.classList.add('fd-do-menu');
    const r = anchor.getBoundingClientRect();
    const room = doc.defaultView?.innerHeight ?? 800;
    const below = r.bottom + 6;
    const above = r.top - menu.offsetHeight - 6;
    const top = below + menu.offsetHeight <= room - 8 || above < 8 ? below : above;
    menu.style.top = `${Math.max(8, Math.min(top, room - menu.offsetHeight - 8))}px`;
  }

  /** A new step: kept at once when it needs nothing more, else begun here, open, its first box in hand. */
  function begin(kind: Kind, under: StepPath | null) {
    const step = newStep(page, kind);
    if (kind === 'open') listPages();
    status.hidden = true;
    if (!stepProblem(page, step, words)) {
      draft = null;
      const at = designer.addStep(place, step, under ? { then: under } : {});
      if (!at) return;
      openAt = at;
      draw();
      rowAt(at)?.focusFirst();
      return;
    }
    draft = { under, step };
    openAt = [...(under ?? []), listOf(under).length];
    draw();
    rowAt(openAt)?.focusFirst();
  }

  /** The kept steps of a list: the place's own, or an open step's then. */
  function listOf(under: StepPath | null): ActionStep[] {
    const all = stepsAt(page, place);
    if (!under) return all;
    const opener = stepAt(all, under);
    return opener?.do === 'open' ? (opener.then ?? []) : [];
  }

  // ---- one step ---------------------------------------------------------------------------------
  function rowView(kind: Kind, begun: boolean): RowView {
    const bodyId = `${base}-${++rowsMade}`;
    const grip = el('span', { class: 'fd-do-grip', 'aria-hidden': 'true', title: w.grip }, designerIcon(doc, 'grip'));
    // The sentence in one piece of its own: the arrow before it, the words wrapping as words, an action's name among them.
    const sentence = el('span', { class: 'fd-do-words' });
    const say = el('button', { type: 'button', class: 'fd-answer-rule-say fd-do-say', 'aria-expanded': 'false', 'aria-controls': bodyId }, sentence);
    const remove = iconButton(el, w.removeNew, '×', () => removeRow(view));
    remove.classList.add('fd-answer-rule-remove', 'fd-do-remove');
    const problem = el('p', { class: 'fd-answer-rule-problem', role: 'alert', hidden: '' });
    const settings = stepSettings(el, kind, {
      words,
      page: () => page,
      saved,
      listed: () => listed,
      change: (patch, typing) => change(view, patch, typing, problem),
    });
    const body = el('div', { class: 'fd-answer-rule-body fd-do-body', id: bodyId, hidden: '' }, settings.element, problem);
    const then = kind === 'open' ? listView(() => view.path) : null;
    if (then) {
      then.element.classList.add('fd-do-then');
      then.list.setAttribute('aria-label', w.thenList);
      (then.add.lastElementChild as HTMLElement).textContent = w.addThen;
    }
    const element = el('li', { class: 'fd-answer-rule fd-do-step', 'data-do': kind }, el('div', { class: 'fd-answer-rule-head fd-do-head' }, grip, say, remove), body, ...(then ? [then.element] : []));
    grip.addEventListener('pointerdown', (event) => drag(view, event));
    say.addEventListener('click', () => {
      openAt = say.getAttribute('aria-expanded') === 'true' ? null : view.path;
      draw();
    });
    say.addEventListener('keydown', (event) => {
      if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') || view.begun) return;
      event.preventDefault();
      move(view, view.path[view.path.length - 1] + (event.key === 'ArrowUp' ? -1 : 1), true);
    });
    body.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      event.stopPropagation();
      openAt = null;
      draw();
      say.focus();
    });
    const view: RowView = {
      element,
      kind,
      begun,
      path: [],
      step: { do: kind } as ActionStep,
      then,
      update(step, path, count) {
        view.step = step;
        view.path = path;
        sentence.textContent = view.begun ? w.kinds[kind] : stepSentence(page, step, words, saved);
        if (!view.begun) markCode(sentence, step);
        remove.setAttribute('aria-label', view.begun ? w.removeNew : w.removeStep(path.map((i) => i + 1).join('.')));
        remove.title = remove.getAttribute('aria-label') as string;
        grip.hidden = view.begun || count < 2;
        settings.update(step);
        if (then) {
          // Its own steps once its page is saved: listed under it; more are added while it is open, and not while one is begun there.
          const open = same(openAt, path);
          const begunHere = !!draft && same(draft.under, path);
          then.add.hidden = view.begun || !open || begunHere;
          then.element.hidden = then.add.hidden && !(step.do === 'open' && step.then?.length) && !begunHere;
        }
      },
      open(on) {
        say.setAttribute('aria-expanded', String(on));
        body.hidden = !on;
        element.classList.toggle('fd-answer-rule-open', on);
        if (!on) problem.hidden = true;
      },
      focusFirst: () => settings.focusFirst(),
      focusSay: () => say.focus(),
    };
    return view;
  }

  /** The app's names in a sentence — an action, a page known only by its id — kept apart, as code. */
  function markCode(say: HTMLElement, step: ActionStep) {
    const name = step.do === 'call' ? step.action : step.do === 'open' && !saved(step.page) ? step.page : '';
    if (name) say.replaceChildren(...withCode(doc, say.textContent ?? '', [name]));
  }

  /** A step changed: kept when it can be, else what is wrong said under it. A step begun is kept once it reads. */
  function change(view: RowView, patch: StepPatch, typing: boolean | undefined, problem: HTMLElement) {
    const next = { ...view.step, ...patch } as Record<string, unknown>;
    for (const key of Object.keys(next)) if (next[key] === null) delete next[key];
    const step = next as unknown as ActionStep;
    const wrong = stepProblem(page, step, words);
    problem.textContent = wrong ?? '';
    problem.hidden = !wrong;
    if (wrong) {
      // A step begun keeps what is written so far, to be kept once the rest is there.
      if (view.begun && draft) draft.step = view.step = step;
      return;
    }
    if (!view.begun) {
      designer.updateStep(place, view.path, patch, { typing });
      return;
    }
    const under = draft?.under ?? null;
    draft = null;
    // Kept now, and drawn from the page from here on: the box being typed in stays where it is.
    view.begun = false;
    const at = designer.addStep(place, step, { ...(under ? { then: under } : {}), ...(typing ? { typing: Object.keys(patch).sort().join(',') } : {}) });
    if (!at) {
      view.begun = true;
      draft = { under, step };
      return;
    }
    openAt = at;
    draw();
  }

  function removeRow(view: RowView) {
    if (view.begun) {
      draft = null;
      openAt = null;
      draw();
      top.add.focus();
      return;
    }
    const sentence = stepSentence(page, view.step, words, saved);
    // Closed first: the step that takes its place is drawn shut.
    const wasOpen = openAt;
    openAt = null;
    if (!designer.removeStep(place, view.path)) {
      openAt = wasOpen;
      return;
    }
    removedAt = designer.getPage();
    // The app's names in it kept apart, as the sentence keeps them.
    statusWords.replaceChildren(...withCode(doc, w.removed(sentence), view.step.do === 'call' ? [view.step.action] : view.step.do === 'open' ? [view.step.page] : []));
    status.hidden = false;
    undo.focus();
  }

  /** A step to another place among its own list; by keys, the cursor goes with it. */
  function move(view: RowView, to: number, keys: boolean) {
    const path = [...view.path.slice(0, -1), to];
    const wasOpen = same(openAt, view.path);
    if (!designer.moveStep(place, view.path, to)) {
      draw();
      return;
    }
    openAt = wasOpen ? path : null;
    draw();
    if (keys) rowAt(path)?.focusSay();
  }

  /** Dragged by its grip: the row follows the pointer among its own list, and the move is kept when it is let go. */
  function drag(view: RowView, event: PointerEvent) {
    if (event.button !== 0 || view.begun) return;
    event.preventDefault();
    const row = view.element;
    const list = row.parentElement as HTMLElement;
    const rows = () => [...list.children].filter((r) => !r.classList.contains('fd-do-begun')) as HTMLElement[];
    const from = rows().indexOf(row);
    row.classList.add('fd-do-lifted');
    const onMove = (e: PointerEvent) => {
      const others = rows().filter((r) => r !== row);
      const at = others.filter((r) => {
        const box = r.getBoundingClientRect();
        return box.top + box.height / 2 < e.clientY;
      }).length;
      if (rows().indexOf(row) !== at) list.insertBefore(row, others[at] ?? null);
    };
    const onEnd = () => {
      doc.removeEventListener('pointermove', onMove);
      doc.removeEventListener('pointerup', onEnd);
      doc.removeEventListener('pointercancel', onEnd);
      row.classList.remove('fd-do-lifted');
      const to = rows().indexOf(row);
      if (to !== from) move(view, to, false);
      else draw();
    };
    doc.addEventListener('pointermove', onMove);
    doc.addEventListener('pointerup', onEnd);
    doc.addEventListener('pointercancel', onEnd);
  }

  // ---- drawing ------------------------------------------------------------------------------------
  /** Every row on show, to find one again by its path. */
  let shown: RowView[] = [];
  const rowAt = (path: StepPath) => shown.find((view) => same(view.path, path)) ?? null;

  /** A list's rows: its kept steps, then a step begun in it; each row patched in place while its kind stays. */
  function drawList(view: ListView, steps: ActionStep[], under: StepPath | null) {
    const begun = draft && keyOf(draft.under) === keyOf(under) ? draft.step : null;
    const all = [...steps, ...(begun ? [begun] : [])];
    const rows = all.map((step, i) => {
      const isBegun = !!begun && i === steps.length;
      const was = view.rows[i];
      const row = was && was.kind === step.do && was.begun === isBegun ? was : rowView(step.do, isBegun);
      const path = [...(under ?? []), i];
      if (row.then) drawList(row.then, step.do === 'open' ? (step.then ?? []) : [], path);
      row.update(step, path, steps.length);
      row.element.classList.toggle('fd-do-begun', isBegun);
      row.open(same(openAt, path));
      shown.push(row);
      return row;
    });
    view.rows = rows;
    // Moved only where out of place: a box taken out of the page loses its cursor.
    rows.forEach((row, i) => {
      if (view.list.children[i] !== row.element) view.list.insertBefore(row.element, view.list.children[i] ?? null);
    });
    while (view.list.children.length > rows.length) view.list.lastElementChild?.remove();
    view.list.hidden = !rows.length;
  }

  function draw() {
    shown = [];
    const steps = stepsAt(page, place);
    // The app's pages, asked for once a step opens one: a list with none never asks.
    if (steps.some((step) => step.do === 'open') || draft?.step.do === 'open') listPages();
    drawList(top, steps, null);
    // One step begun at a time: Add a step waits while one is.
    top.add.hidden = !!draft && draft.under === null;
    // A button does at least one thing: its only step stays, and says why.
    const only = 'press' in place && steps.length === 1;
    const first = top.rows[0];
    if (first && !first.begun) (first.element.querySelector(':scope > .fd-do-head > .fd-do-remove') as HTMLElement).hidden = only;
    keepsOne.hidden = !only;
    if (removedAt && page !== removedAt) {
      removedAt = null;
      status.hidden = true;
    }
  }

  return {
    element,
    update(next) {
      page = next;
      draw();
    },
    focus() {
      const first = top.rows[0];
      if (first) first.focusSay();
      else top.add.focus();
    },
  };
}
