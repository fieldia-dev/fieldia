import type { Field, Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import { speakLike } from './chrome-language';
import type { Designer } from './designer';
import { keepPopup } from './menu';

/** The kinds whose value reads as words inside a sentence: what an answer put in words may be. */
const SAID = new Set(['char', 'text', 'html', 'integer', 'float', 'monetary', 'boolean', 'date', 'datetime', 'selection', 'many2one', 'many2many', 'reference']);

/** The page's fields an answer can be put in words from, in the page's order. */
export function answerFields(page: Page): [string, Field][] {
  return Object.entries(page.fields).filter(([, def]) => SAID.has(def.type));
}

/**
 * A box where a page's words are typed — a label, a help, a step's title, a button's words, an ending — with a button
 * beside it that puts an answer in them (`answerButton`).
 */
export function withAnswers(el: ElementFactory, designer: Designer, box: HTMLInputElement | HTMLTextAreaElement, options: { sent?: boolean } = {}): HTMLElement {
  return el('span', { class: 'fd-words-box' }, box, answerButton(el, designer, box, options));
}

/** The one list of answers open, if one is: opening another closes it. */
let open: (() => void) | null = null;

/**
 * The button that puts an answer in a box of words: a list of the page's questions, the one picked going in at the
 * caret as `{name}`, which the form shows as that answer reads ("How was your visit to {branch}?"), and an optional
 * "When empty" box, its words said while the answer is empty (`{branch|this branch}`). An ending's words (`sent`) may
 * say the reference the app gives the response, `{id}`, too. The box is told of it as typing tells it. Arrows move
 * between the answers, Escape gives the focus back, a press elsewhere closes it.
 */
export function answerButton(el: ElementFactory, designer: Designer, box: HTMLInputElement | HTMLTextAreaElement, options: { sent?: boolean } = {}): HTMLButtonElement {
  const w = designer.words.endings;
  const button = el('button', { type: 'button', class: 'fd-button fd-answer-picker', 'aria-label': w.insertAnswerIn(box.getAttribute('aria-label') ?? ''), title: w.insertAnswer, 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, '{ }');
  button.addEventListener('click', () => (button.getAttribute('aria-expanded') === 'true' ? open?.() : show()));

  function show() {
    open?.();
    const doc = button.ownerDocument;
    const page = designer.getPage();
    const answers = answerFields(page).map(([name, def]) => [name, def.label || name] as const);
    if (options.sent && !page.fields['id']) answers.unshift(['id', w.reference]);
    const empty = el('input', { class: 'fd-input fd-answer-empty', 'aria-label': w.whenEmpty, placeholder: w.whenEmptyHint, autocomplete: 'off' }) as HTMLInputElement;
    const picks = answers.map(([name, label]) => {
      const pick = el('button', { type: 'button', class: 'fd-menu-item', 'data-answer': name }, label);
      pick.addEventListener('click', () => {
        close(false);
        put(name, empty.value.replace(/[{}]/g, '').trim());
      });
      return pick;
    });
    const pop = el(
      'div',
      { class: 'fd-menu fd-answer-menu', role: 'dialog', 'aria-label': w.answersTitle },
      el('div', { class: 'fd-menu-title', 'aria-hidden': 'true' }, w.answersTitle),
      ...(picks.length ? [el('div', { class: 'fd-answer-list', role: 'group', 'aria-label': w.answersTitle }, ...picks)] : [el('p', { class: 'fd-menu-note' }, w.noAnswers)]),
      el('label', { class: 'fd-answer-empty-row' }, el('span', { class: 'fd-menu-heading' }, w.whenEmpty), empty)
    );
    pop.addEventListener('keydown', (event) => {
      const at = picks.indexOf(doc.activeElement as HTMLButtonElement);
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && at !== -1) {
        event.preventDefault();
        picks[(at + (event.key === 'ArrowDown' ? 1 : -1) + picks.length) % picks.length]?.focus();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close(true);
      }
    });
    const outside = (event: Event) => {
      if (!pop.contains(event.target as Node) && !button.contains(event.target as Node)) close(false);
    };
    doc.addEventListener('pointerdown', outside, true);
    const unkept = keepPopup(button, () => close(false));
    function close(refocus: boolean) {
      doc.removeEventListener('pointerdown', outside, true);
      unkept();
      if (open === shut) open = null;
      if (!pop.isConnected) return;
      pop.remove();
      button.setAttribute('aria-expanded', 'false');
      if (refocus) button.focus();
    }
    const shut = () => close(false);
    open = shut;
    (button.closest('.fd-form') ?? doc.body).append(speakLike(pop, button));
    button.setAttribute('aria-expanded', 'true');
    // Under the button, kept in the window.
    const r = button.getBoundingClientRect();
    const view = doc.defaultView;
    const width = pop.offsetWidth || 240;
    const height = pop.offsetHeight || 0;
    const below = r.bottom + 6;
    Object.assign(pop.style, {
      left: `${Math.max(8, Math.min(r.right - width, (view?.innerWidth ?? 1024) - width - 8))}px`,
      top: `${view && below + height > view.innerHeight - 8 && r.top - height - 6 > 8 ? r.top - height - 6 : below}px`,
    });
    (picks[0] ?? empty).focus();
  }

  /** `{name}`, or `{name|words}` with words while empty, where the caret was left — over the words chosen — the caret after it. */
  function put(name: string, empty: string) {
    const start = box.selectionStart ?? box.value.length;
    const end = box.selectionEnd ?? start;
    box.focus();
    box.setRangeText(empty ? `{${name}|${empty}}` : `{${name}}`, start, end, 'end');
    box.dispatchEvent(new Event('input', { bubbles: true }));
  }
  return button;
}
