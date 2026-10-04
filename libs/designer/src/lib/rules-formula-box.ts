import type { Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import { formulaInWords, problemWords, type FormulaProblem } from './rules-formula';

/**
 * A box to type a formula in, the way a person writes one: typing a field's
 * name — or @ — lists the page's fields by their labels, and picking one puts
 * its name in; the arrows go down the list, Enter or Tab picks, Escape closes
 * it. What is wrong shows under the box, the place it is about marked in a
 * copy of the formula. A formula that reads is handed on as it is typed; one
 * that does not is kept here, so the page keeps the last one that read.
 */

export interface FormulaBoxOptions {
  label: string;
  placeholder?: string;
  /** The field it is about, left out of the suggestions. */
  own?(): string | undefined;
  /** What is wrong with a formula, or null when it reads. */
  check(page: Page, source: string): FormulaProblem | null;
  /** A formula that reads, or an empty box, as it is typed. */
  commit(source: string): void;
  /** Said after each change: the result on made-up values. */
  said?(page: Page, source: string): string;
}

/** The formula in words, when its names are not the words people know the fields by: "Reads: Price × Quantity". */
function readsLine(page: Page, source: string): string {
  const words = formulaInWords(page, source);
  return words.replace(/\s+/g, '') === source.replace(/\s+/g, '').replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−') ? '' : `Reads: ${words}`;
}

export interface FormulaBox {
  /** The box and its list of suggestions. */
  element: HTMLElement;
  input: HTMLInputElement;
  /** What is wrong, under the box. */
  problem: HTMLElement;
  /** The result, under the box. */
  result: HTMLElement;
  /** The page as it is now, and the formula it holds: shown unless the box is being typed in. */
  update(page: Page, source: string): void;
  /** Put words in where the cursor is, the cursor `back` characters before their end. */
  insert(text: string, back?: number): void;
}

let made = 0;

/** The name being typed just before the cursor, with an @ before it when there is one. */
function typing(value: string, caret: number): { from: number; query: string; at: boolean } | null {
  const before = value.slice(0, caret);
  const match = /(@?)([A-Za-z_][\w]*)?$/.exec(before);
  if (!match || (!match[1] && !match[2])) return null;
  // Inside quotes it is text, not a name.
  if ((before.slice(0, match.index).match(/'/g) ?? []).length % 2 === 1) return null;
  return { from: match.index, query: match[2] ?? '', at: match[1] === '@' };
}

/** Words that are the language's own, not the start of a field's name. */
const OWN_WORDS = /^(and|or|not|in|True|False|None|round|abs|min|max|len|today|sum|count|if)$/i;

export function formulaBox(el: ElementFactory, options: FormulaBoxOptions): FormulaBox {
  const id = `fd-formula-${++made}`;
  const input = el('input', {
    class: 'fd-input fd-formula-input',
    role: 'combobox',
    'aria-label': options.label,
    'aria-autocomplete': 'list',
    'aria-expanded': 'false',
    'aria-controls': `${id}-list`,
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: options.placeholder ?? '',
  }) as HTMLInputElement;
  const list = el('div', { class: 'fd-formula-suggest', role: 'listbox', id: `${id}-list`, 'aria-label': 'Fields', hidden: '' });
  const element = el('div', { class: 'fd-formula' }, input, list);
  const words = el('span', { class: 'fd-formula-problem-words' });
  const copy = el('code', { class: 'fd-formula-copy' });
  const problem = el('p', { class: 'fd-formula-problem', role: 'alert', hidden: '' }, words, copy);
  const reads = el('span', { class: 'fd-formula-reads' });
  const outcome = el('span', { class: 'fd-formula-outcome' });
  const result = el('p', { class: 'fd-formula-result', role: 'status', hidden: '' }, reads, outcome);

  let page: Page | null = null;
  let found: { name: string; label: string }[] = [];
  let at = 0;
  let current: { from: number; query: string; at: boolean } | null = null;
  /** The formula the page held when last drawn. */
  let lastKept = '';

  /** The page's fields that start with, or hold, what is typed: by label first, then by name. */
  function suggest() {
    const caret = input.selectionStart ?? input.value.length;
    current = page ? typing(input.value, caret) : null;
    const query = current?.query.toLowerCase() ?? '';
    if (!page || !current || (!current.at && (!query || OWN_WORDS.test(query)))) return close();
    const all = Object.entries(page.fields)
      .filter(([name]) => name !== options.own?.())
      .map(([name, def]) => ({ name, label: def.label || name }));
    const starts = all.filter((f) => f.label.toLowerCase().startsWith(query) || f.name.toLowerCase().startsWith(query));
    const holds = all.filter((f) => !starts.includes(f) && (f.label.toLowerCase().includes(query) || f.name.toLowerCase().includes(query)));
    found = [...starts, ...holds];
    // A name typed out in full needs no list.
    if (!found.length || (!current.at && found.length === 1 && found[0].name === current.query)) return close();
    at = Math.min(at, found.length - 1);
    draw();
  }

  function draw() {
    list.replaceChildren(
      ...found.map((f, i) => {
        const option = el('div', { class: 'fd-formula-suggest-option', role: 'option', id: `${id}-${i}`, 'aria-selected': String(i === at) }, el('span', { class: 'fd-formula-suggest-label' }, f.label), el('code', { class: 'fd-formula-suggest-name' }, f.name));
        // Picked with the pointer, the box keeps the cursor.
        option.addEventListener('pointerdown', (event) => event.preventDefault());
        option.addEventListener('mousedown', (event) => event.preventDefault());
        option.addEventListener('click', () => pick(i));
        return option;
      })
    );
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-activedescendant', `${id}-${at}`);
    problem.hidden = true;
  }

  function close() {
    found = [];
    at = 0;
    list.hidden = true;
    list.replaceChildren();
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  /** Put the field's name in place of what was typed for it. */
  function pick(i: number) {
    const chosen = found[i];
    if (!chosen || !current) return;
    const caret = input.selectionStart ?? input.value.length;
    input.value = input.value.slice(0, current.from) + chosen.name + input.value.slice(caret);
    const after = current.from + chosen.name.length;
    input.setSelectionRange(after, after);
    close();
    changed();
  }

  /** The box as typed: checked, said, and handed on when it reads. */
  function changed() {
    if (!page) return;
    const source = input.value;
    const wrong = source.trim() ? options.check(page, source) : null;
    showProblem(source, wrong);
    say(page, wrong || !source.trim() ? '' : source);
    if (!wrong) options.commit(source.trim());
  }

  function showProblem(source: string, wrong: FormulaProblem | null) {
    // While a name is being picked, the half-typed name is not yet wrong.
    problem.hidden = !wrong || !list.hidden;
    if (!wrong) return;
    words.textContent = problemWords(wrong);
    if (wrong.from === undefined) {
      copy.hidden = true;
      return;
    }
    const [from, to] = [wrong.from - 1, wrong.to ?? wrong.from];
    copy.replaceChildren(source.slice(0, from), el('mark', {}, source.slice(from, to)), source.slice(to));
    copy.hidden = false;
  }

  /** What the formula reads as, and gives: shown only where there is something to say. */
  function say(on: Page, source: string) {
    reads.textContent = source && options.said ? readsLine(on, source) : '';
    outcome.textContent = source && options.said ? options.said(on, source) : '';
    reads.hidden = !reads.textContent;
    result.hidden = !outcome.textContent;
  }

  input.addEventListener('input', () => {
    suggest();
    changed();
  });
  input.addEventListener('click', () => suggest());
  input.addEventListener('blur', () => close());
  input.addEventListener('keydown', (event) => {
    if (list.hidden) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      at = (at + (event.key === 'ArrowDown' ? 1 : -1) + found.length) % found.length;
      draw();
      list.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      pick(at);
    } else if (event.key === 'Escape') {
      // Only the list closes: the panel and the editor keep what is open.
      event.preventDefault();
      event.stopPropagation();
      close();
      changed();
    }
  });

  return {
    element,
    input,
    problem,
    result,
    update(next, source) {
      page = next;
      if (input.ownerDocument.activeElement === input) return;
      // A formula that does not read stays as typed until another is kept.
      if (problem.hidden || source !== lastKept) input.value = source;
      lastKept = source;
      if (problem.hidden) say(next, source);
    },
    insert(text, back = 0) {
      const from = input.selectionStart ?? input.value.length;
      const to = input.selectionEnd ?? from;
      input.value = input.value.slice(0, from) + text + input.value.slice(to);
      input.focus();
      const caret = from + text.length - back;
      input.setSelectionRange(caret, caret);
      changed();
    },
  };
}
