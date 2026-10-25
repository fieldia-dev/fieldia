import { createForm, type Field, type FieldNode, type LineField, type Page } from '@fieldia/core';
import { createWidget } from './widgets';
import { displayValue } from './display';
import { WIDGET_LABELS } from './labels';

/**
 * Intl's formatters are made once for a language and its options (`intlFormat`), never per cell, per keystroke or per
 * date box drawn: at 0.32 they were a quarter of a table of 200 lines' keystroke and of an editable list's first draw
 * (the performance audit's M1). Counted here as they are made: the count stays the same however many are drawn.
 */

const KINDS = ['DateTimeFormat', 'NumberFormat', 'PluralRules', 'ListFormat'] as const;
const made: Record<string, number> = {};
const real = Object.fromEntries(KINDS.map((kind) => [kind, Intl[kind]]));
beforeAll(() => {
  for (const kind of KINDS) {
    made[kind] = 0;
    (Intl as unknown as Record<string, unknown>)[kind] = new Proxy(real[kind] as object, { construct: (target, args) => (made[kind]++, Reflect.construct(target as new (...a: unknown[]) => object, args)) });
  }
});
afterAll(() => {
  for (const kind of KINDS) (Intl as unknown as Record<string, unknown>)[kind] = real[kind];
});
const count = () => KINDS.reduce((sum, kind) => sum + made[kind], 0);

function page(fields: Record<string, Field>): Page {
  return { fieldia: '0.13', id: 'p', data: { kind: 'responses' }, fields, layout: { type: 'sections', id: 'root', children: Object.keys(fields).map((name) => ({ type: 'field', id: `n-${name}`, field: name })) } } as unknown as Page;
}

function mount(type: 'date' | 'monetary', n: number) {
  const fields = Object.fromEntries(Array.from({ length: n }, (_, i) => [`f${i}`, { type, label: `Field ${i}`, ...(type === 'monetary' ? { currency: 'EGP' } : {}) } as Field]));
  const p = page(fields);
  const form = createForm({ page: p });
  const nodes = (p.layout as { children: FieldNode[] }).children;
  const widgets = nodes.map((node, i) => createWidget({ form, name: `f${i}`, field: fields[`f${i}`], node, id: `fd-f${i}`, document, labels: WIDGET_LABELS.en, locale: 'en' }));
  document.body.replaceChildren(...widgets.map((w) => w.element));
  const update = () => widgets.forEach((w, i) => w.update({ value: form.getState().values[`f${i}`], values: form.getState().values, readonly: false, required: false, invalid: false }));
  update();
  return { widgets, update, form };
}

describe('Intl formatters, made once', () => {
  it('a list of dates and amounts writes a thousand cells with the formatters of one', () => {
    const date = { type: 'date', label: 'Joined' } as LineField;
    const money = { type: 'monetary', label: 'Credit', currency: 'EGP', digits: [16, 2] } as LineField;
    displayValue(date, '2026-10-24');
    displayValue(money, 1);
    const before = count();
    for (let i = 0; i < 1000; i++) {
      displayValue(date, `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`);
      displayValue(money, i * 10.5);
    }
    expect(count()).toBe(before);
    // Still as they were written.
    expect(displayValue(date, '2026-10-24')).toBe('24 Oct 2026');
    expect(displayValue(money, 1500)).toBe('E£ 1,500.00');
  });

  it('fifty date boxes draw with the formatters of one, and none of a calendar until it opens', () => {
    mount('date', 1);
    const one = count();
    mount('date', 50);
    expect(count()).toBe(one);
    // The calendar's month and weekday names are made as it first opens, and its days written in them.
    const { widgets } = mount('date', 1);
    (widgets[0].element.querySelector('.fd-calendar-button') as HTMLButtonElement).click();
    const dialog = widgets[0].element.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.hidden).toBe(false);
    expect([...dialog.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    expect(count()).toBeGreaterThan(one);
  });

  it('amounts typed in a table of money cells ask for no new formatter per keystroke', () => {
    const { update, form } = mount('monetary', 20);
    form.setValue('f0', 1);
    update();
    const before = count();
    for (let i = 2; i < 50; i++) {
      form.setValue('f0', i);
      update();
    }
    expect(count()).toBe(before);
    expect(document.querySelector('.fd-unit, [class*="currency"]')?.textContent).toBe('E£');
  });
});
