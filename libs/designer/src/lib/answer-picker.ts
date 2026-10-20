import type { Field, Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { openMenu } from './menu';

/** The kinds whose value reads as words inside a sentence: what an answer put in words may be. */
const SAID = new Set(['char', 'text', 'html', 'integer', 'float', 'monetary', 'boolean', 'date', 'datetime', 'selection', 'many2one', 'many2many', 'reference']);

/** The page's fields an answer can be put in words from, in the page's order. */
export function answerFields(page: Page): [string, Field][] {
  return Object.entries(page.fields).filter(([, def]) => SAID.has(def.type));
}

/**
 * A box where a page's words are typed — a label, a help, a step's title, a button's words, an ending — with a button
 * beside it that puts an answer in them: a menu of the page's questions, the one picked going in at the caret as
 * `{name}`, which the form shows as that answer reads ("How was your visit to {branch}?"). An ending's words
 * (`sent`) may say the reference the app gives the response, `{id}`, too. The box is told of it as typing tells it.
 */
export function withAnswers(el: ElementFactory, designer: Designer, box: HTMLInputElement | HTMLTextAreaElement, options: { sent?: boolean } = {}): HTMLElement {
  return el('span', { class: 'fd-words-box' }, box, answerButton(el, designer, box, options));
}

/** The button alone, for a box drawn its own way beside it (a survey's question, its page's title). */
export function answerButton(el: ElementFactory, designer: Designer, box: HTMLInputElement | HTMLTextAreaElement, options: { sent?: boolean } = {}): HTMLButtonElement {
  const w = designer.words.endings;
  const button = el('button', { type: 'button', class: 'fd-button fd-answer-picker', 'aria-label': w.insertAnswerIn(box.getAttribute('aria-label') ?? ''), title: w.insertAnswer, 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, '{ }');
  button.addEventListener('click', () => {
    const page = designer.getPage();
    const items = answerFields(page).map(([name, def]) => ({ id: name, label: def.label || name }));
    if (options.sent && !page.fields['id']) items.unshift({ id: 'id', label: w.reference });
    openMenu({ el, anchor: button, title: w.answersTitle, items, actions: true, ...(items.length ? {} : { note: w.noAnswers }), onPick: (name) => put(name) });
  });
  /** `{name}` where the caret was left — over the words chosen — the caret after it. */
  function put(name: string) {
    const start = box.selectionStart ?? box.value.length;
    const end = box.selectionEnd ?? start;
    box.focus();
    box.setRangeText(`{${name}}`, start, end, 'end');
    box.dispatchEvent(new Event('input', { bubbles: true }));
  }
  return button;
}
