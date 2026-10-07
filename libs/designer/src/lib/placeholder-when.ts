import type { Page, PlaceholderWhen } from '@fieldia/core';
import { iconButton, type ElementFactory } from './chrome';
import type { Designer } from './designer';
import { findField } from './page-tree';
import { formulaProblem } from './rules-formula';
import { formulaBox, type FormulaBox } from './rules-formula-box';

/**
 * Words in a field's empty box chosen by a condition (`placeholderWhen`), in
 * the Placeholder row: each its words and the condition on the record that
 * shows them, the first that holds — a company's name or a person's. A new
 * one is kept once its words and its condition are both there.
 */
export function placeholderWhenList(el: ElementFactory, designer: Designer, id: string): { element: HTMLElement; update(page: Page): void } {
  const w = designer.words.panel;
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  let page = designer.getPage();
  let drafting = false;
  const read = (): PlaceholderWhen[] => findField(designer.getPage(), id)?.node.placeholderWhen ?? [];
  const list = el('ul', { class: 'fd-table-tones fd-placeholder-when' });
  const add = el('button', { type: 'button', class: 'fd-button fd-button-link fd-placeholder-when-add' }, w.placeholderWhenAdd);
  const rows: { element: HTMLElement; text: HTMLInputElement; when: FormulaBox }[] = [];
  add.addEventListener('click', () => {
    drafting = true;
    draw();
    rows[rows.length - 1]?.text.focus();
  });

  function row(index: number) {
    const keep = () => {
      const words = text.value;
      const condition = when.input.value.trim();
      if (!words.trim() || !condition || formulaProblem(page, condition)) return;
      const items = [...read()];
      items[index] = { when: condition, text: words };
      const begun = index >= read().length;
      if (begun) drafting = false;
      if (!designer.setPlaceholderWhen(id, items) && begun) drafting = true;
    };
    const text = el('input', { class: 'fd-input fd-placeholder-when-text', 'aria-label': w.placeholderWhenWords, placeholder: w.placeholderHint }) as HTMLInputElement;
    text.addEventListener('input', keep);
    const when = formulaBox(el, { words: designer.words, label: w.placeholderWhenCondition, placeholder: designer.words.tables.whenPlaceholder, check: (on, source) => formulaProblem(on, source, designer.words), commit: () => keep() });
    const remove = iconButton(el, w.placeholderWhenRemove(index + 1), '×', () => {
      if (index >= read().length) {
        drafting = false;
        return draw();
      }
      const items = read().filter((_, i) => i !== index);
      designer.setPlaceholderWhen(id, items.length ? items : null);
    });
    const element = el(
      'li',
      { class: 'fd-table-tone-row' },
      text,
      el('div', { class: 'fd-table-tone-when' }, el('span', { class: 'fd-answer-rule-word' }, w.placeholderWhenCondition), when.element, when.problem),
      remove
    );
    return { element, text, when };
  }

  function draw() {
    const items = read();
    const count = items.length + (drafting ? 1 : 0);
    while (rows.length > count) rows.pop()?.element.remove();
    while (rows.length < count) {
      const made = row(rows.length);
      rows.push(made);
      list.append(made.element);
    }
    rows.forEach((r, i) => {
      const item = items[i];
      if (item && !focused(r.text)) r.text.value = item.text;
      r.when.update(page, item ? String(item.when) : r.when.input.value);
    });
    list.hidden = !count;
    add.hidden = drafting;
  }

  return {
    element: el('div', { class: 'fd-table-tone-list' }, list, add),
    update(next) {
      page = next;
      draw();
    },
  };
}

