/**
 * The front page's stage: the page of JSON it writes, a customer record, and the steps it is written in. Each step
 * is the whole page as it stands then, so the JSON shown is always a page Fieldia runs; home.js types each step's new
 * lines where they belong in the one before, and draws the page with the real viewer. The last step is the page
 * (HERO_JSON), and home.mjs shows it before any script runs.
 */

/** Short lines, for the stage's narrow pane: a value stays on its line while it fits, and its parts pack onto a line while they fit. */
const WIDTH = 36;

/** A value on one line, as JSON with a space inside its braces. */
function inline(value) {
  if (Array.isArray(value)) return value.length ? `[${value.map(inline).join(', ')}]` : '[]';
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    return entries.length ? `{ ${entries.map(([key, inner]) => `${JSON.stringify(key)}: ${inline(inner)}`).join(', ')} }` : '{}';
  }
  return JSON.stringify(value);
}

/** A value whose parts are all plain: words, numbers, yes or no. */
const flat = (value) => Object.values(value).every((inner) => inner === null || typeof inner !== 'object');

/**
 * A value at `indent`, its first line starting at column `at`, `after` characters following its last line (a comma).
 * A value too long for its line breaks: an object of plain values hugs its braces, `{ "type": "char",` over
 * `  "label": "Name" }`; any other has a line for each part, packed while they fit (but the page's own, one a line).
 */
function print(value, indent, at, after) {
  const one = inline(value);
  if (!value || typeof value !== 'object' || at + one.length + after <= WIDTH) return one;
  const list = Array.isArray(value);
  const entries = list ? value.map((item) => ['', item]) : Object.entries(value);
  // Hugged only where its first part fits on the line it opens: `{ ` before it, a comma after.
  const hug = !list && flat(value) && at + 2 + `${JSON.stringify(entries[0][0])}: ${inline(entries[0][1])}`.length + 1 <= WIDTH;
  const inner = indent + 2;
  const parts = entries.map(([key, item], i, all) => {
    const name = list ? '' : `${JSON.stringify(key)}: `;
    const last = i === all.length - 1;
    return name + print(item, inner, inner + name.length, last ? 0 : 1);
  });
  const lines = [];
  let line = '';
  parts.forEach((part, i) => {
    const last = i === parts.length - 1;
    const piece = part + (last ? '' : ',');
    const start = hug && !lines.length ? at + 2 : inner;
    const fits = start + line.length + 1 + piece.length + (hug && last ? 2 + after : 0) <= WIDTH;
    if (line && indent > 0 && !part.includes('\n') && fits) line += ` ${piece}`;
    else {
      if (line) lines.push(line);
      line = piece;
    }
    if (part.includes('\n')) {
      lines.push(line);
      line = '';
    }
  });
  if (line) lines.push(line);
  const [open, close] = list ? ['[', ']'] : ['{', '}'];
  if (hug) return `${open} ${lines.map((l, i) => (i ? ' '.repeat(inner) : '') + l).join('\n')} ${close}`;
  return `${open}\n${lines.map((l) => ' '.repeat(inner) + l).join('\n')}\n${' '.repeat(indent)}${close}`;
}

/** A page as the stage writes it. */
export const pageText = (page) => print(page, 0, 0, 0);

/** The customer record, with what it has so far: a part of it is there once its step has come. */
function customer(has) {
  const node = (id, extra) => ({ type: 'field', id, field: id, ...extra });
  const about = [
    has.phone && node('phone', { widget: 'phone' }),
    has.credit && node('credit'),
    has.company && node('company', { widget: 'toggle' }),
    has.company && node('vat', { invisible: 'not company', required: 'company' }),
  ].filter(Boolean);
  return {
    fieldia: '0.5',
    id: 'customer',
    title: 'Customer',
    data: { kind: 'record', model: 'customer' },
    records: { one: 'customer', other: 'customers', a: 'a customer' },
    ...(has.phone ? { phone: { country: 'DE' } } : {}),
    fields: {
      name: { type: 'char', label: 'Name', required: true },
      ...(has.phone ? { phone: { type: 'char', label: 'Phone' } } : {}),
      ...(has.company ? { company: { type: 'boolean', label: 'A company' }, vat: { type: 'char', label: 'VAT number' } } : {}),
      ...(has.credit ? { credit: { type: 'monetary', label: 'Credit limit', currency: 'EUR' } } : {}),
      ...(has.stage
        ? {
            stage: {
              type: 'selection',
              label: 'Stage',
              options: [
                { value: 'lead', label: 'Lead' },
                { value: 'customer', label: 'Customer' },
              ],
            },
          }
        : {}),
    },
    layout: {
      type: 'sheet',
      id: 'sheet',
      title: { field: 'name' },
      ...(has.stage ? { statusbar: { field: 'stage' } } : {}),
      children: [
        ...(about.length ? [{ type: 'section', id: 'about', columns: 2, children: about }] : []),
        ...(has.invoices
          ? [
              {
                type: 'related',
                id: 'invoices',
                title: 'Their invoices',
                model: 'invoice',
                field: 'customer',
                fields: {
                  number: { type: 'char', label: 'Number' },
                  due: { type: 'date', label: 'Due' },
                  amount: { type: 'monetary', label: 'Amount', currency: 'EUR' },
                  state: {
                    type: 'selection',
                    label: 'Status',
                    options: [
                      { value: 'sent', label: 'Sent' },
                      { value: 'paid', label: 'Paid' },
                    ],
                  },
                },
                columns: ['number', 'due', 'amount', 'state'],
                ...(has.overdue ? { rowTones: [{ tone: 'danger', label: 'Overdue', when: "state == 'sent' and due < today()" }] } : {}),
                viewAll: { page: 'invoices' },
              },
            ]
          : []),
      ],
    },
  };
}

/** The steps, each with the words the stage bar says as it is drawn: what it adds, in plain words. */
const ADDS = [
  ['A customer record, with its name', {}],
  ['A phone, read for its country', { phone: true }],
  ['A rule: the VAT number only for a company', { company: true }],
  ['A credit limit, in euros', { credit: true }],
  ['A status bar: Lead › Customer', { stage: true }],
  ['Their invoices, inside the record', { invoices: true }],
  ['Overdue invoices in red, with a key', { overdue: true }],
];

let has = {};
export const STEPS = ADDS.map(([words, adds]) => {
  has = { ...has, ...adds };
  return { words, text: pageText(customer(has)) };
});

/** The page the stage ends on: home.js mounts it at its last step, and home.mjs shows it as it is. */
export const HERO_JSON = STEPS[STEPS.length - 1].text;
