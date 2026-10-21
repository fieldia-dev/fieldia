import { drawsOrder, type Field, type FieldNode, type Form, type FormState, type LayoutNode, type LineField, type Locale, type Page, type StepNode, type TabNode, type Value } from '@fieldia/core';
import { displayValue } from '@fieldia/widgets';
import { setHidden, setText, type El } from './dom';
import { installFlowStyles } from './flow-styles';
import type { ViewerLabels } from './labels';
import { oneAtATime } from './flow-one';

/**
 * A survey's flow — the survey part's (survey-part.ts), made as a page of responses that asks for it is drawn:
 *
 * - **A review before sending** (`review` on the page): the last step's button, or the page's Submit, reads "Review
 *   your answers"; pressed, the answers are checked as a step's are, and the questions give way to every answer shown —
 *   by step, each with Edit — then Back, and the page's own words to send. Edit goes to that question, in its step;
 *   from a step before the last, "Back to review" checks the steps on the way and shows it again. A send the source
 *   refuses goes back to the question it names.
 * - **One question at a time** (`flow: "one"`, flow-one.ts): each question on a screen of its own; Edit on the review
 *   goes to its screen.
 */

/** What a survey's flow needs of the viewer that draws the page. */
export interface FlowContext {
  doc: Document;
  el: El;
  /** The page as shown: its words in the page's language. */
  page: Page;
  form: Form;
  labels: ViewerLabels;
  locale: Locale;
  /** The page's questions and their buttons, as drawn: what the review stands in place of. */
  questions: HTMLElement;
  uid(id: string): string;
  /** Words said at once to a screen reader. */
  announce(text: string): void;
  /** The focus to the first box with a problem, a step's or a folded group's opened first. */
  focusFirstProblem(): void;
  /** Send the answers, as the page's own Submit does. */
  submit(): Promise<void>;
}

/** What the viewer asks of a survey's flow. */
export interface FlowKit {
  /** The words of the page's last button where the flow has its own — "Review your answers" while the review is still to come — else undefined. */
  finishWords(): string | undefined;
  /**
   * Whether a send goes ahead now: true where the page reviews nothing, or its review is shown; false where the review
   * is shown in its place now (or the answers were refused on the way to it).
   */
  sending(): Promise<boolean>;
  /** The send was refused — by the page's own checks, or the source: the questions again, at the first problem. */
  refused(): void;
  /** One question at a time (`flow: "one"`): on to the next question, as Enter and OK go — the page's submit and Ctrl+Enter alike. */
  forward?(): Promise<void>;
  update(state: FormState): void;
  destroy(): void;
}

/** A question the review lists: its part, its field, the step it is on. */
interface Asked {
  node: FieldNode;
  field: string;
  step: StepNode | null;
}

/** Whether a page has a survey flow the viewer's survey part draws: a review before sending, one question at a time, a draw. */
export const flows = (page: Page): boolean => page.data.kind === 'responses' && page.layout.type !== 'list' && (!!page.review || page.flow === 'one' || drawsOrder(page));

/** A part's parts in the order the form shows them: drawn for this respondent where the page draws, those not drawn left out. */
export function inOrder<N extends { id: string }>(form: Form, owner: string, children: readonly N[]): readonly N[] {
  const order = form.getState().order?.[owner];
  return order ? order.flatMap((id) => children.filter((child) => child.id === id)) : children;
}

/**
 * The page's parts laid in the order drawn (`state.order`): each drawn part's own, by its id — a step's or a group's
 * questions in their grid, a wizard's steps in its list of steps. Those not drawn are hidden by the form already.
 */
export function layOrder(questions: HTMLElement, order: Readonly<Record<string, readonly string[]>>): void {
  for (const [owner, ids] of Object.entries(order)) {
    const box = questions.querySelector<HTMLElement>(`[data-node="${owner}"]`) ?? (questions.getAttribute('data-node') === owner ? questions : null);
    if (!box) continue;
    const list = box.querySelector<HTMLElement>(':scope .fd-steps-list');
    if (list) {
      const items = ids.map((id) => [...list.children].find((li) => li.getAttribute('data-step') === id)).filter((li): li is Element => !!li);
      if (items.some((li, i) => list.children[i] !== li)) list.append(...items);
      continue;
    }
    const parts = ids.map((id) => box.querySelector<HTMLElement>(`[data-node="${id}"]`)).filter((part): part is HTMLElement => !!part);
    const grid = parts[0]?.parentElement;
    if (!grid || parts.some((part) => part.parentElement !== grid)) continue;
    // Each where the draw puts it, among its own: moved only where it is not there yet.
    const shown = [...grid.children].filter((child) => parts.includes(child as HTMLElement));
    if (shown.some((child, i) => child !== parts[i])) grid.append(...parts);
  }
}

export function surveyFlow(context: FlowContext): FlowKit {
  const { doc, el, page, form, labels, locale, questions } = context;
  installFlowStyles(doc);
  const layout = page.layout;
  const wizard = layout.type === 'wizard' ? layout : null;
  const review = page.review ? (page.review === true ? {} : page.review) : null;
  const cleanups: (() => void)[] = [];
  /** A page's own words as they read with the answers given ("How was your visit to {branch}?"). */
  const words = (text: string) => (text.includes('{') ? form.words(text) : text);

  // ---- the questions asked, in the order they are shown --------------------------------------------------------------

  /** The field parts inside some parts, in their order: inside groups and tabs too, those shown now. */
  function fieldsIn(nodes: readonly (LayoutNode | TabNode)[], step: StepNode | null, out: Asked[] = []): Asked[] {
    for (const node of nodes) {
      if (form.node(node.id).invisible) continue;
      if (node.type === 'field') {
        if (page.fields[node.field]) out.push({ node, field: node.field, step });
      } else if (node.type === 'section' || node.type === 'tab' || node.type === 'tabs') fieldsIn(inOrder(form, node.id, node.children as (LayoutNode | TabNode)[]), step, out);
    }
    return out;
  }
  /** The steps answered, in the order they are shown, less those passed over. */
  function stepsShown(state: FormState = form.getState()): StepNode[] {
    if (!wizard) return [];
    const order = form.steps();
    return order.flatMap((id) => {
      const step = wizard.children.find((one) => one.id === id);
      return step && !state.skipped.includes(id) ? [step] : [];
    });
  }
  /** The questions shown now, by step on a wizard, by titled group on a page of sections. */
  function groupsAsked(): { title: string | null; step: StepNode | null; asked: Asked[] }[] {
    if (wizard) return stepsShown().map((step) => ({ title: words(step.label), step, asked: fieldsIn(inOrder(form, step.id, step.children), step) }));
    const groups: { title: string | null; step: StepNode | null; asked: Asked[] }[] = [];
    const loose = (): Asked[] => {
      const last = groups[groups.length - 1];
      if (last && last.title === null) return last.asked;
      const fresh = { title: null, step: null, asked: [] as Asked[] };
      groups.push(fresh);
      return fresh.asked;
    };
    const top = layout.type === 'sections' ? inOrder(form, layout.id, layout.children) : layout.type === 'tabs' ? [layout] : layout.type === 'sheet' ? layout.children : [];
    for (const node of top) {
      if (form.node(node.id).invisible) continue;
      if (node.type === 'section' && node.title) groups.push({ title: words(node.title), step: null, asked: fieldsIn(inOrder(form, node.id, node.children), null) });
      else loose().push(...fieldsIn([node], null));
    }
    return groups.filter((group) => group.asked.length);
  }

  /** A question's words: its part's own label, else its field's, as they read with the answers given. */
  const labelOf = (asked: Asked) => words(asked.node.label ?? page.fields[asked.field]?.label ?? asked.field);
  /** An answer as the field shows it at rest: a choice by its label, a day in the page's order, money with its currency. */
  function answerOf(asked: Asked): string {
    const state = form.getState();
    const def = page.fields[asked.field] as Field;
    const value = state.values[asked.field] as Value | undefined;
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) return '';
    return displayValue(def as LineField, value, state.values as Record<string, Value>, locale);
  }

  // ---- the review --------------------------------------------------------------------------------------------------------

  const reviewTitle = el('h2', { class: 'fd-review-title', id: context.uid('review-title'), tabindex: '-1' }, words(review?.title ?? labels.reviewTitle));
  const reviewText = review?.text ? el('p', { class: 'fd-review-text' }, words(review.text)) : null;
  const reviewList = el('div', { class: 'fd-review-groups' });
  const reviewBack = el('button', { type: 'button', class: 'fd-button' }, labels.back);
  const reviewSend = el('button', { type: 'button', class: 'fd-button fd-button-primary fd-review-send' });
  const panel = el(
    'section',
    { class: 'fd-review', 'aria-labelledby': reviewTitle.id, hidden: '' },
    reviewTitle,
    ...(reviewText ? [reviewText] : []),
    reviewList,
    el('div', { class: 'fd-review-actions' }, reviewBack, el('span', { class: 'fd-spacer' }), reviewSend)
  );
  if (review) questions.after(panel);
  let reviewing = false;
  /** The draw last laid out. */
  let laidOrder: FormState['order'] = null;
  /** Edit was pressed on the review: a step before the last offers "Back to review". */
  let editing = false;
  const backToReview = el('button', { type: 'button', class: 'fd-button fd-back-to-review', hidden: '' }, labels.backToReview);
  const nav = questions.querySelector<HTMLElement>('.fd-wizard-nav');
  const submitButton = wizard ? null : questions.querySelector<HTMLButtonElement>(':scope > .fd-actions button[type="submit"]');
  if (review && wizard && nav) nav.querySelector('button[type="submit"]')?.before(backToReview);

  /** Every answer shown now, by step or group, each with Edit. */
  function drawReview() {
    reviewList.replaceChildren(
      ...groupsAsked().map((group) => {
        const rows = group.asked.map((asked) => {
          const said = answerOf(asked);
          const label = labelOf(asked);
          const edit = el('button', { type: 'button', class: 'fd-button fd-button-link fd-review-edit' }, labels.reviewEdit, el('span', { class: 'fd-sr-only' }, ` ${label}`));
          edit.addEventListener('click', () => editAt(asked));
          const locked = form.node(asked.node.id).readonly;
          return el(
            'div',
            { class: 'fd-review-row', 'data-field': asked.field, 'data-node': `${asked.node.id}~review` },
            el('dt', { class: 'fd-review-question' }, label),
            el('dd', { class: 'fd-review-answer', ...(said ? {} : { 'data-empty': '' }) }, said || labels.reviewNotAnswered),
            el('dd', { class: 'fd-review-tools' }, ...(locked ? [] : [edit]))
          );
        });
        return el('div', { class: 'fd-review-group' }, ...(group.title ? [el('h3', { class: 'fd-review-group-title' }, group.title)] : []), el('dl', { class: 'fd-review-list' }, ...rows));
      })
    );
    setText(reviewSend, words(wizard?.finishLabel ?? labels.submit));
  }
  function showReview(on: boolean) {
    reviewing = on;
    setHidden(questions, on);
    setHidden(panel, !on);
    if (on) {
      editing = false;
      drawReview();
      reviewTitle.focus();
    }
  }
  /**
   * The answers checked as the step they end on is — the step on screen, or the whole page of sections — what is typed
   * read first; a name still being looked up waited for. Then the review, or the first problem.
   */
  async function openReview(): Promise<boolean> {
    const within = wizard ? (form.getState().step ?? undefined) : undefined;
    const shown = form.recordShown();
    let ok = form.validate(within);
    if (!ok && form.reading()) {
      await form.settle();
      if (!shown()) return false;
      ok = !form.reading() && form.validate(within);
    }
    if (!ok) {
      context.focusFirstProblem();
      return false;
    }
    showReview(true);
    return true;
  }
  /** One question at a time: its screens, made once the review's own buttons are in the page. */
  const one = page.flow === 'one' ? oneAtATime(context, { finishWords: () => (review && !reviewing ? labels.reviewAnswers : words(wizard?.finishLabel ?? labels.submit)), finish: context.submit, reviewing: () => reviewing }) : null;
  if (one) cleanups.push(() => one.destroy());

  /** A question's box, focused: on its step, the review put away. */
  function editAt(asked: Asked) {
    showReview(false);
    if (one) {
      editing = true;
      one.goTo(asked.node.id);
      return;
    }
    if (asked.step && form.getState().step !== asked.step.id) form.goTo(asked.step.id);
    editing = true;
    // Drawn as the step shows: the box in sight, then focused.
    const box = questions.querySelector<HTMLElement>(`[data-node="${asked.node.id}"]`);
    box?.scrollIntoView?.({ block: 'center' });
    box?.querySelector<HTMLElement>('input:not([type="hidden"]), select, textarea, [role="radio"], [role="slider"], button')?.focus();
  }
  reviewBack.addEventListener('click', () => {
    showReview(false);
    questions.querySelector<HTMLElement>('.fd-step:not([hidden]) :is(input, select, textarea), button[type="submit"]')?.focus();
  });
  reviewSend.addEventListener('click', () => void context.submit());
  backToReview.addEventListener('click', async () => {
    const steps = form.steps();
    const last = steps[steps.length - 1];
    // The steps on the way checked as a jump checks them: the first with a problem shown, else the review.
    if (last && form.getState().step !== last && !form.goTo(last)) return context.focusFirstProblem();
    await openReview();
  });

  return {
    finishWords: () => (review && !reviewing ? labels.reviewAnswers : undefined),
    ...(one ? { forward: () => one.forward() } : {}),
    async sending() {
      if (!review || reviewing) return true;
      await openReview();
      return false;
    },
    refused() {
      if (!reviewing) return;
      showReview(false);
      // On a wizard, the step whose question the problem is under.
      const errors = Object.keys(form.getState().errors);
      const asked = groupsAsked().flatMap((group) => group.asked).find((question) => errors.some((path) => path === question.field || path.startsWith(`${question.field}.`)));
      if (one && asked) one.goTo(asked.node.id);
      else if (asked?.step && form.getState().step !== asked.step.id) form.goTo(asked.step.id);
      context.focusFirstProblem();
    },
    update(state) {
      // The parts in the order drawn, before one at a time marks the screen shown.
      if (state.order && state.order !== laidOrder) {
        laidOrder = state.order;
        layOrder(questions, state.order);
      }
      one?.update(state);
      // A page of sections' own Submit reviews them first, as a wizard's last button does.
      if (submitButton) setText(submitButton, review && !reviewing ? labels.reviewAnswers : labels.submit);
      const steps = form.steps();
      const last = steps[steps.length - 1];
      setHidden(backToReview, !editing || reviewing || !wizard || state.step === last);
      // A send on its way from the review says so on its button.
      if (state.status === 'saving') reviewSend.setAttribute('aria-busy', 'true');
      else reviewSend.removeAttribute('aria-busy');
    },
    destroy() {
      for (const cleanup of cleanups) cleanup();
      panel.remove();
      backToReview.remove();
    },
  };
}
