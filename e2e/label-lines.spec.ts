import { expect, test } from '@playwright/test';

/**
 * A label beside its value starts level with it: one field of every type, in
 * both skins, labels beside by the page and by the skin, each label's top
 * within 4px of its box's top. A table of lines and a grid of answers may have
 * their name over them instead, as Flectra draws a table's; never down them.
 */

const FIELDS: Record<string, unknown> = {
  char: { type: 'char', label: 'Name' },
  text: { type: 'text', label: 'Notes', default: 'First line\nSecond line\nThird line\nFourth line' },
  html: { type: 'html', label: 'Description' },
  integer: { type: 'integer', label: 'Seats' },
  float: { type: 'float', label: 'Hours' },
  monetary: { type: 'monetary', label: 'Budget', currency: 'USD' },
  boolean: { type: 'boolean', label: 'Active' },
  date: { type: 'date', label: 'Starts' },
  datetime: { type: 'datetime', label: 'Meeting' },
  selection: { type: 'selection', label: 'Plan', options: [{ value: 'a', label: 'Team' }, { value: 'b', label: 'Business' }] },
  binary: { type: 'binary', label: 'Contract' },
  image: { type: 'image', label: 'Photo' },
  many2one: { type: 'many2one', label: 'Customer', relation: 'partner' },
  many2many: { type: 'many2many', label: 'Tags', relation: 'tag' },
  one2many: { type: 'one2many', label: 'Lines', relation: 'line', fields: { name: { type: 'char', label: 'Item' } } },
  reference: { type: 'reference', label: 'Came from', models: [{ value: 'partner', label: 'Customer' }] },
  properties: { type: 'properties', label: 'Details', definitions: [{ name: 'floor', label: 'Floor', type: 'integer' }] },
  json: { type: 'json', label: 'Settings', default: { retries: 3, timeout: 30, notify: ['ops', 'owner'], mode: 'strict' } },
  matrix: { type: 'matrix', label: 'Each part', rows: [{ value: 'a', label: 'Setup' }], columns: [{ value: 1, label: 'Hard' }, { value: 2, label: 'Easy' }] },
};
/** The kinds whose name is a heading over them, not a label beside them: a table of lines and a grid of answers. */
const HEADED = ['one2many', 'matrix'];

// Beside by the page's own look, and beside as the underline skin puts them when the page says nothing.
for (const [skin, labels] of [['underline', 'beside'], ['outlined', 'beside'], ['underline', undefined]] as const) {
  test(`${skin}, labels ${labels ? 'beside' : 'where the skin puts them'}: every field type’s label starts level with its box`, async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.goto('/script/');
    await page.waitForFunction(() => 'Fieldia' in window);
    const offsets = await page.evaluate(
      ({ fields, skin, labels }) => {
        const host = document.createElement('div');
        document.body.prepend(host);
        const names = Object.keys(fields);
        const W = window as any;
        W.Fieldia.mountViewer(host, {
          page: {
            fieldia: '0.1', id: 'every-type', title: 'Every type', data: { kind: 'responses' }, ...(labels ? { look: { labels } } : {}),
            fields,
            layout: { type: 'sections', id: 'r', children: [{ type: 'section', id: 's', columns: 1, children: names.map((n) => ({ type: 'field', id: `f-${n}`, field: n })) }] },
          },
          dataSource: W.Fieldia.createMemoryDataSource(),
          skin,
        });
        return names.map((name) => {
          const field = host.querySelector(`.fd-field[data-field="${name}"]`)!;
          const label = field.querySelector(':scope > .fd-label')!;
          const control = [...field.children].find((c) => c !== label && !c.matches('.fd-help, .fd-error, .fd-warning, .fd-counter') && c.getBoundingClientRect().height > 0)!;
          return { name, offset: Math.round(label.getBoundingClientRect().top - control.getBoundingClientRect().top) };
        });
      },
      { fields: FIELDS, skin, labels }
    );
    expect(offsets).toHaveLength(Object.keys(FIELDS).length);
    const astray = offsets.filter((o) => !HEADED.includes(o.name) && Math.abs(o.offset) > 4).map((o) => `${o.name}: ${o.offset}px`);
    expect(astray).toEqual([]);
    // A table's or a grid's name heads it, or stands level with it: never further down it.
    for (const o of offsets.filter((o) => HEADED.includes(o.name))) expect(o.offset, o.name).toBeLessThanOrEqual(4);
  });
}
