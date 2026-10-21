import type { Field, Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { shownFields } from './page-tree';
import { setting } from './panel-controls';

/** The kinds a link's words fill (`prefill`), as the page's checks keep them: words, numbers, yes or no, a choice, a day. */
const FILLED = new Set(['char', 'text', 'integer', 'float', 'monetary', 'boolean', 'selection', 'date', 'datetime']);
const fillable = (def: Field) => FILLED.has(def.type) && def.compute === undefined && !(def.type === 'selection' && def.optionsFrom !== undefined);

/**
 * The fields the link a page is opened with fills (`prefill.fromUrl`), on the screen's panel (panel-page.ts) beside its
 * other rules: a row for each of the link's parameters — its name as the link writes it, and the field it fills, one of
 * the page's or its own hidden field — with ×, and Add a parameter. A row's parameter is kept as it is left.
 */
export function prefillSettings(el: ElementFactory, designer: Designer): { rows: HTMLElement[]; update(page: Page): void } {
  const w = designer.words.panel;
  const list = el('div', { class: 'fd-prefill-rows', role: 'group', 'aria-label': w.prefill });
  const add = el('button', { type: 'button', class: 'fd-button fd-button-link fd-prefill-add' }, w.prefillAdd);
  /** A row added and not given its parameter yet: kept in the panel only. */
  let pending = false;
  add.addEventListener('click', () => {
    pending = true;
    draw(designer.getPage());
    list.querySelector<HTMLInputElement>('.fd-prefill-row:last-child input')?.focus();
  });
  /** The rows as the panel shows them now, read back as the setting. */
  const read = () =>
    [...list.querySelectorAll<HTMLElement>('.fd-prefill-row')]
      .map((row) => ({ param: (row.querySelector('input') as HTMLInputElement).value.trim(), field: (row.querySelector('select') as HTMLSelectElement).value || null }))
      .filter((row) => row.param);
  const commit = () => {
    pending = false;
    designer.setPrefill(read());
  };
  const row = (page: Page, param: string, field: string | null) => {
    const name = el('input', { class: 'fd-input', 'aria-label': w.prefillParam, placeholder: 'utm_source', value: param, autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
    name.value = param;
    name.addEventListener('change', commit);
    // Its own hidden field, of its own name, placed nowhere, reads as "its own" here: the parameter names it.
    const placed = shownFields(page);
    const hidden = field === null || (field === param && !placed.has(field));
    const fields = Object.entries(page.fields).filter(([key, def]) => fillable(def) && (placed.has(key) || (!hidden && key === field)));
    const into = el('select', { class: 'fd-input fd-select', 'aria-label': w.prefillField }, el('option', { value: '' }, w.prefillHidden), ...fields.map(([key, def]) => el('option', { value: key }, def.label || key))) as HTMLSelectElement;
    into.value = hidden ? '' : (field as string);
    into.addEventListener('change', commit);
    const remove = el('button', { type: 'button', class: 'fd-button fd-button-link', 'aria-label': w.prefillRemove }, '×');
    remove.addEventListener('click', () => {
      line.remove();
      commit();
    });
    const line = el('div', { class: 'fd-prefill-row' }, name, el('span', { 'aria-hidden': 'true' }, '→'), into, remove);
    return line;
  };
  function draw(page: Page) {
    const rows = (page.prefill?.fromUrl ?? []).map((one) => (typeof one === 'string' ? { param: one, field: one } : one));
    list.replaceChildren(...rows.map((one) => row(page, one.param, one.field)), ...(pending ? [row(page, '', null)] : []));
  }
  const prefillRow = setting(el, 'rules', 'Filled from the link', [list, add], { hint: w.prefillHint, words: w.prefill });
  return {
    rows: [prefillRow],
    update(page) {
      // A list of records starts no answers to fill.
      prefillRow.hidden = page.layout.type === 'list';
      // A row being typed in keeps its words until it is left.
      if (list.contains(list.ownerDocument.activeElement)) return;
      draw(page);
    },
  };
}
