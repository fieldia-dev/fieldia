import type { Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { setting } from './panel-controls';

/** The kinds Fill from text fills, and those whose words it reads. */
const FILLED = new Set(['char', 'text', 'html', 'integer', 'float', 'monetary', 'boolean', 'selection', 'date', 'datetime', 'many2one', 'many2many', 'one2many']);
const TEXTS = new Set(['char', 'text', 'html']);

/**
 * AI help's Fill from text (`suggest`) on the screen's panel (panel-page.ts), beside the rest of its rules: offered or
 * not, its button's words, what it reads — words pasted or files, or a text field's own words — and the fields it may
 * fill, a tick each (none ticked: every one shown that a person can set). A form's alone: a list fills nothing.
 */
export function assistSettings(el: ElementFactory, designer: Designer): { rows: HTMLElement[]; update(page: Page): void } {
  const w = designer.words.panel;
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const on = el('input', { type: 'checkbox', class: 'fd-check', 'aria-label': w.suggestOn }) as HTMLInputElement;
  on.addEventListener('change', () => designer.setSuggest(on.checked ? {} : null));
  const label = el('input', { class: 'fd-input', 'aria-label': w.suggestLabel, placeholder: w.suggestLabelExample }) as HTMLInputElement;
  label.addEventListener('change', () => designer.setSuggest({ label: label.value.trim() || null }));
  const from = el('select', { class: 'fd-input fd-select', 'aria-label': w.suggestFrom }) as HTMLSelectElement;
  from.addEventListener('change', () => designer.setSuggest({ fromField: from.value || null }));
  const fields = el('div', { class: 'fd-q-required-row', role: 'group', 'aria-label': w.suggestFields });
  const onRow = setting(el, 'rules', 'Fill from text', on, { hint: w.suggestHint, words: w.suggest });
  const labelRow = setting(el, 'rules', 'Its button’s words', label, { words: w.suggestLabel });
  const fromRow = setting(el, 'rules', 'Fills from', from, { hint: w.suggestFromHint, words: w.suggestFrom });
  const fieldsRow = setting(el, 'rules', 'Fields it may fill', fields, { hint: w.suggestFieldsHint, words: w.suggestFields });
  return {
    rows: [onRow, labelRow, fromRow, fieldsRow],
    update(page) {
      const suggest = page.suggest;
      onRow.hidden = page.layout.type === 'list';
      on.checked = !!suggest;
      labelRow.hidden = fromRow.hidden = fieldsRow.hidden = onRow.hidden || !suggest;
      if (!suggest) return;
      if (!focused(label)) label.value = suggest.label ?? '';
      const texts = Object.entries(page.fields).filter(([, def]) => TEXTS.has(def.type));
      const choices = [['', w.suggestPasted], ...texts.map(([name, def]) => [name, def.label])];
      const key = JSON.stringify(choices);
      if (from.dataset['choices'] !== key) {
        from.dataset['choices'] = key;
        from.replaceChildren(...choices.map(([value, words]) => el('option', { value }, words)));
      }
      from.value = suggest.fromField ?? '';
      const fillable = Object.entries(page.fields).filter(([name, def]) => FILLED.has(def.type) && def.readonly !== true && def.compute === undefined && name !== suggest.fromField);
      const fillKey = JSON.stringify(fillable.map(([name, def]) => [name, def.label]));
      if (fields.dataset['choices'] !== fillKey) {
        fields.dataset['choices'] = fillKey;
        fields.replaceChildren(
          ...fillable.map(([name, def]) => {
            const tick = el('input', { type: 'checkbox', 'data-field': name }) as HTMLInputElement;
            tick.addEventListener('change', () => {
              const ticked = new Set([...fields.querySelectorAll<HTMLInputElement>('input:checked')].map((box) => box.dataset['field'] as string));
              designer.setSuggest({ fields: Object.keys(designer.getPage().fields).filter((field) => ticked.has(field)) });
            });
            return el('label', { class: 'fd-q-required' }, tick, el('span', {}, def.label));
          })
        );
      }
      for (const tick of fields.querySelectorAll<HTMLInputElement>('input')) tick.checked = !!suggest.fields?.includes(tick.dataset['field'] as string);
    },
  };
}
