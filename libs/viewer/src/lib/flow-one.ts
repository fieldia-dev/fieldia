import { fill, type FieldNode, type FormState, type LayoutNode, type StepNode, type TabNode } from '@fieldia/core';
import { setAttr, setHidden, setText } from './dom';
import type { FlowContext } from './survey-flow';

/**
 * One question at a time (`flow: "one"` on a page of responses), as Typeform asks: each question on a screen of its
 * own, large, the words before it (a text, a picture) with it; a step's title over it. Enter or OK goes on — once the
 * question's answer is checked — and a choice picked with the pointer or its letter (A, B, C… beside each option) goes
 * on by itself a moment later; ↑ and ↓ (and Page Up, Page Down) go back and on where no box takes those keys, as the
 * bar's buttons do; "Question 3 of 12" and a bar say how far. The questions an answer hides are passed, those it shows
 * come in their place. A wizard's steps are kept as its form keeps them: a step is entered, checked, skipped and kept
 * in a draft as ever. A form opened with answers (a draft) starts at the first question still to answer.
 */

/** A screen: a question with the words before it, or words alone (a step of no question, words after the last). */
export interface Screen {
  /** Its id: its question's part's, else its first part's. */
  key: string;
  step: StepNode | null;
  /** Its question's part, the field it asks, if any. */
  question: LayoutNode | null;
  field: string | null;
  /** Every part it shows: the words before the question, then the question. */
  nodes: LayoutNode[];
}

/** What one question at a time asks of the rest of the survey's flow. */
export interface OneHooks {
  /** The words of the button that ends the questions on the last screen: the review's, or the page's own. */
  finishWords(): string;
  /** The questions end: the review, or the send. */
  finish(): Promise<void>;
  /** Whether the review stands in place of the questions: no key of the questions is taken then. */
  reviewing(): boolean;
}

export interface OneKit {
  /** On: the screen's answer checked, then the next screen — or, on the last, the end. */
  forward(): Promise<void>;
  /** The screen of a question's part, its step entered: back at once, forward past the steps between only when they are complete. */
  goTo(nodeId: string): boolean;
  update(state: FormState): void;
  destroy(): void;
}

/** Kinds whose answer is one pick: a choice of one goes on by itself once picked by the pointer or its letter. */
const ONE_PICK_WIDGETS = new Set(['radio', 'image-choice', 'rating', 'scale', 'priority', 'boolean', 'yes-no', undefined]);

export function oneAtATime(context: FlowContext, hooks: OneHooks): OneKit {
  const { el, page, form, labels, questions } = context;
  const layout = page.layout;
  const wizard = layout.type === 'wizard' ? layout : null;
  const root = questions.closest<HTMLElement>('.fd-form') ?? questions;
  root.classList.add('fd-flow-one');
  const cleanups: (() => void)[] = [() => root.classList.remove('fd-flow-one')];

  // ---- the screens --------------------------------------------------------------------------------------------------

  /** The screens of some parts: each question with the words before it; words after the last with it. */
  function screensIn(nodes: readonly (LayoutNode | TabNode)[], step: StepNode | null, out: Screen[], before: LayoutNode[] = []): LayoutNode[] {
    let waiting = before;
    for (const node of nodes) {
      if (form.node(node.id).invisible) continue;
      if ((node.type === 'field' && page.fields[node.field]) || node.type === 'form') {
        out.push({ key: node.id, step, question: node, field: node.type === 'field' ? node.field : null, nodes: [...waiting, node] });
        waiting = [];
      } else if (node.type === 'section' || node.type === 'tab' || node.type === 'tabs') waiting = screensIn(node.children, step, out, waiting);
      else if (node.type !== 'button' || !waiting.length) waiting = [...waiting, node as LayoutNode];
    }
    return waiting;
  }
  /** Every screen now, in the order shown: a wizard's by its steps as the form shows them, the passed-over ones left out. */
  function screens(state: FormState = form.getState()): Screen[] {
    const out: Screen[] = [];
    const place = (children: readonly LayoutNode[], step: StepNode | null) => {
      const from = out.length;
      const left = screensIn(children, step, out);
      if (!left.length) return;
      // Words after the last question go with it; a step of words alone is a screen of its own.
      if (out.length > from) out[out.length - 1].nodes.push(...left);
      else out.push({ key: left[0].id, step, question: null, field: null, nodes: left });
    };
    if (wizard) {
      for (const id of form.steps()) {
        const step = wizard.children.find((one) => one.id === id);
        if (step && !state.skipped.includes(id)) place(step.children, step);
      }
    } else place(layout.type === 'sections' ? layout.children : layout.type === 'sheet' ? layout.children : layout.type === 'tabs' ? [layout] : [], null);
    return out;
  }

  // ---- the bar: how far, back, on ---------------------------------------------------------------------------------

  const progressText = el('span', { class: 'fd-flow-count' });
  const bar = el('span', { class: 'fd-flow-bar-fill' });
  const up = el('button', { type: 'button', class: 'fd-button fd-flow-move', 'aria-label': labels.flowPrevious, title: labels.flowPrevious }, el('span', { 'aria-hidden': 'true' }, '↑'));
  const down = el('button', { type: 'button', class: 'fd-button fd-flow-move', 'aria-label': labels.flowNext, title: labels.flowNext }, el('span', { 'aria-hidden': 'true' }, '↓'));
  // The form's first submit button, so Enter in a box presses it as it would Next: the page's submit goes on (`forward`).
  const ok = el('button', { type: 'submit', class: 'fd-button fd-button-primary fd-flow-ok' });
  const hint = el('span', { class: 'fd-flow-hint' }, labels.flowEnterHint);
  const flowBar = el(
    'div',
    { class: 'fd-flow-nav' },
    el('div', { class: 'fd-flow-progress' }, progressText, el('span', { class: 'fd-flow-bar', 'aria-hidden': 'true' }, bar)),
    el('span', { class: 'fd-flow-moves' }, up, down),
    el('span', { class: 'fd-spacer' }),
    hint,
    ok
  );
  const nav = questions.querySelector<HTMLElement>(':scope > .fd-wizard-nav, :scope > .fd-actions') ?? questions;
  nav.prepend(flowBar);
  cleanups.push(() => flowBar.remove());
  up.addEventListener('click', () => void back());
  down.addEventListener('click', () => void forward());

  // ---- where the person is ----------------------------------------------------------------------------------------

  let current: string | null = null;
  /** The person moved or answered: a form opened with answers no longer moves them to the first question still to answer. */
  let placed = false;
  const empty = (value: unknown) => value === null || value === undefined || value === '' || value === false || (Array.isArray(value) && !value.length);

  /** Each part of the page shown on the current screen, and none other: the words before it, its group's heading, its step. */
  function mark(screen: Screen | undefined) {
    const kept = (screen?.nodes ?? []).map((node) => questions.querySelector<HTMLElement>(`[data-node="${cssId(node.id)}"]`)).filter((found): found is HTMLElement => !!found);
    for (const part of questions.querySelectorAll<HTMLElement>('[data-node]')) {
      const on = kept.some((one) => one === part || one.contains(part) || part.contains(one));
      setAttr(part, 'data-fd-away', on ? null : '');
      setAttr(part, 'data-fd-current', screen && part.getAttribute('data-node') === screen.key ? '' : null);
    }
  }
  const cssId = (id: string) => id.replace(/["\\]/g, '\\$&');
  /** The screen's first box, else its question's words: where the focus goes as it shows. */
  function focusScreen(screen: Screen) {
    const at = questions.querySelector<HTMLElement>(`[data-node="${cssId(screen.key)}"]`);
    const box = at?.querySelector<HTMLElement>('input:not([type="hidden"]):not([disabled]), select, textarea, [role="radio"], [role="slider"], [role="checkbox"], button:not(.fd-flow-move)');
    if (box) box.focus({ preventScroll: true });
    else (at as HTMLElement | null)?.focus?.({ preventScroll: true });
    at?.scrollIntoView?.({ block: 'center' });
  }
  function show(screen: Screen, focus = true) {
    current = screen.key;
    render(form.getState());
    if (focus) focusScreen(screen);
  }

  /** The screen's answer checked — what is typed read first, a name still looked up waited for — said where it falls short. */
  async function checked(screen: Screen): Promise<boolean> {
    if (!screen.question) return true;
    const shown = form.recordShown();
    let fine = form.validate(screen.question.id);
    if (!fine && form.reading()) {
      await form.settle();
      if (!shown()) return false;
      fine = !form.reading() && form.validate(screen.question.id);
    }
    if (!fine) context.focusFirstProblem();
    return fine;
  }

  async function forward(): Promise<void> {
    placed = true;
    const list = screens();
    const at = list.findIndex((screen) => screen.key === current);
    const here = list[at] ?? list[0];
    if (!here) return hooks.finish();
    if (!(await checked(here))) return;
    // Its answer may change what follows: the screens again, from here.
    const after = screens();
    const now = after.findIndex((screen) => screen.key === here.key);
    const next = after[now + 1];
    if (!next) return hooks.finish();
    if (wizard && next.step && form.getState().step !== next.step.id && !form.goTo(next.step.id)) return context.focusFirstProblem();
    show(next);
  }
  async function back(): Promise<void> {
    placed = true;
    const list = screens();
    const at = list.findIndex((screen) => screen.key === current);
    const previous = list[at - 1];
    if (!previous) return;
    if (wizard && previous.step && form.getState().step !== previous.step.id) form.goTo(previous.step.id);
    show(previous);
  }
  function goTo(nodeId: string): boolean {
    placed = true;
    const screen = screens().find((one) => one.nodes.some((node) => node.id === nodeId));
    if (!screen) return false;
    if (wizard && screen.step && form.getState().step !== screen.step.id && !form.goTo(screen.step.id)) {
      context.focusFirstProblem();
      return false;
    }
    show(screen);
    return true;
  }

  // ---- a pick goes on by itself; letters pick; arrows move -----------------------------------------------------------

  /** How the last answer came: a press, or a letter, goes on by itself; arrows in a group of radios never do. */
  let pickedBy: 'pointer' | 'letter' | null = null;
  let pickedAt = 0;
  const pointer = () => {
    pickedBy = 'pointer';
    pickedAt = Date.now();
  };
  questions.addEventListener('pointerdown', pointer);
  cleanups.push(() => questions.removeEventListener('pointerdown', pointer));
  let onward: ReturnType<typeof setTimeout> | null = null;
  cleanups.push(() => onward !== null && clearTimeout(onward));
  cleanups.push(
    form.on('change', ({ field, value, by }) => {
      if (by !== 'person' || hooks.reviewing()) return;
      const screen = screens().find((one) => one.key === current);
      if (!screen || screen.field !== field || screen.question?.type !== 'field') return;
      const def = page.fields[field];
      const one = (def.type === 'selection' && !def.multiple && !def.other) || def.type === 'boolean';
      if (!one || !ONE_PICK_WIDGETS.has((screen.question as FieldNode).widget) || empty(value) || !pickedBy || Date.now() - pickedAt > 1500) return;
      pickedBy = null;
      if (onward !== null) clearTimeout(onward);
      // A moment to see the pick, then on — unless the person moved, or changed it again, meanwhile.
      onward = setTimeout(() => {
        onward = null;
        if (current === screen.key && form.getState().values[field] === value) void forward();
      }, 450);
    })
  );
  const keys = (event: KeyboardEvent) => {
    if (event.defaultPrevented || hooks.reviewing() || event.isComposing) return;
    const target = event.target as HTMLElement | null;
    const typing = !!target?.closest('input:not([type="radio"]):not([type="checkbox"]), textarea, select, [contenteditable="true"], [role="listbox"], [role="combobox"]');
    const arrows = !!target?.closest('input, textarea, select, [role="radio"], [role="slider"], [role="listbox"], [role="radiogroup"], [role="spinbutton"]');
    const moved = (go: () => Promise<void>) => {
      event.preventDefault();
      void go();
    };
    // Enter on a tick or a radio goes on, as it does in a box (where the form's submit takes it).
    if (event.key === 'Enter' && !event.shiftKey && target?.matches('input[type="radio"], input[type="checkbox"]')) return moved(forward);
    if ((event.key === 'PageDown' && !typing) || (event.key === 'ArrowDown' && !arrows && !event.altKey)) return moved(forward);
    if ((event.key === 'PageUp' && !typing) || (event.key === 'ArrowUp' && !arrows && !event.altKey)) return moved(back);
    // A letter picks the option it stands beside: A the first, B the next — by the key's place, whatever the keyboard's language.
    const letter = /^Key([A-Z])$/.exec(event.code)?.[1];
    if (!letter || typing || event.ctrlKey || event.metaKey || event.altKey) return;
    const screen = questions.querySelector<HTMLElement>('[data-fd-current]');
    const options = screen ? [...screen.querySelectorAll<HTMLInputElement>('.fd-choices > .fd-choice > input')] : [];
    const option = options[letter.charCodeAt(0) - 65];
    if (!option) return;
    event.preventDefault();
    pickedBy = 'letter';
    pickedAt = Date.now();
    option.click();
    option.focus();
  };
  root.addEventListener('keydown', keys);
  cleanups.push(() => root.removeEventListener('keydown', keys));

  // ---- drawn as the form changes ----------------------------------------------------------------------------------

  function render(state: FormState) {
    const list = screens(state);
    if (!list.length) return mark(undefined);
    // A form opened with answers starts at the first question still to answer — at the step it opened at, or after.
    if (!placed && state.status !== 'loading') {
      placed = true;
      const from = Math.max(0, wizard && state.step ? list.findIndex((screen) => screen.step?.id === state.step) : 0);
      const answered = list.some((screen) => screen.field && !empty(state.values[screen.field]));
      const start = answered ? list.findIndex((screen, i) => i >= from && !!screen.field && empty(state.values[screen.field])) : from;
      const first = list[start === -1 ? list.length - 1 : start];
      current = first.key;
      // Its step entered, once this drawing is done: the steps before it checked as a jump checks them — where one falls
      // short, the first screen of the step the form stays at.
      const step = first.step;
      if (wizard && step && state.step !== step.id)
        void Promise.resolve().then(() => {
          if (form.goTo(step.id)) return;
          current = screens().find((screen) => screen.step?.id === form.getState().step)?.key ?? current;
          render(form.getState());
        });
    }
    let at = list.findIndex((screen) => screen.key === current);
    // The question shown went — an answer hid it: the screen in its place, else the last.
    if (at === -1) {
      at = Math.min(list.length - 1, Math.max(0, lastAt));
      current = list[at].key;
    }
    lastAt = at;
    const screen = list[at];
    mark(screen);
    setText(progressText, fill(labels.flowQuestionOf, { n: at + 1, total: list.length }));
    bar.style.width = `${((at + 1) / list.length) * 100}%`;
    setHidden(up, at === 0);
    const last = at === list.length - 1;
    setHidden(down, last);
    setText(ok, last ? hooks.finishWords() : labels.flowOk);
  }
  let lastAt = 0;

  return {
    forward,
    goTo,
    update: render,
    destroy() {
      for (const cleanup of cleanups) cleanup();
      for (const part of questions.querySelectorAll<HTMLElement>('[data-fd-away], [data-fd-current]')) {
        part.removeAttribute('data-fd-away');
        part.removeAttribute('data-fd-current');
      }
    },
  };
}
