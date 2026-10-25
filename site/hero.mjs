/**
 * The front page's stage: four pages of JSON it writes — a customer record, a list of invoices, homes on a map and a
 * booking — each in its own tab, and the steps each is written in. Each step is the whole page as it stands then, so
 * the JSON shown is always a page Fieldia runs; home.js types each step's new lines where they belong in the one
 * before, draws the page with the real viewer, then has someone use it. A tab's last step is its page (TABS[i].json;
 * the record's is HERO_JSON), and home.mjs shows the record's before any script runs.
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
    fieldia: '0.13',
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


/** A list of invoices, with what it has so far. */
function invoices(has) {
  return {
    fieldia: '0.13',
    id: 'invoices',
    title: 'Invoices',
    data: { kind: 'record', model: 'invoice' },
    fields: {
      number: { type: 'char', label: 'No.' },
      customer: { type: 'char', label: 'Customer' },
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
    layout: {
      type: 'list',
      id: 'list',
      // Four columns, as the stage's pane fits them: the due date read by the overdue rule, not shown; no boxes to choose rows.
      columns: ['number', 'customer', 'amount', 'state'],
      choose: false,
      ...(has.total ? { cells: { amount: { total: 'sum' } } } : {}),
      ...(has.overdue ? { rowTones: [{ tone: 'danger', label: 'Overdue', when: "state == 'sent' and due < today()" }] } : {}),
      ...(has.filter ? { filters: [{ id: 'unpaid', label: 'Unpaid', filter: [{ field: 'state', op: '=', value: 'sent' }] }], defaultFilters: ['unpaid'] } : {}),
      ...(has.group ? { groupBy: ['customer'] } : {}),
      ...(has.cards ? { card: {} } : {}),
    },
  };
}

/** Homes for sale on a map, with what it has so far. */
function homes(has) {
  return {
    fieldia: '0.13',
    id: 'homes',
    title: 'Homes for sale',
    data: { kind: 'record', model: 'home' },
    fields: {
      name: { type: 'char', label: 'Home' },
      price: { type: 'monetary', label: 'Price', currency: 'EGP' },
      district: { type: 'char', label: 'District' },
      place: { type: 'json', label: 'Place' },
    },
    layout: {
      type: 'list',
      id: 'list',
      columns: ['name', 'price', 'district'],
      map: {
        point: 'place',
        view: 'map',
        ...(has.price ? { pin: { look: 'label', label: 'price' } } : {}),
        ...(has.card ? { card: { title: 'name', fields: ['price', 'district'] } } : {}),
        ...(has.districts ? { regions: { from: 'districts', key: 'name', field: 'district' } } : {}),
      },
    },
  };
}

/** A test drive booked at a showroom in Berlin, with what it has so far. */
function booking(has) {
  const slots = has.slots ? { widget: 'slots', options: { schedule: 'showroom', length: 45, ...(has.end ? { endField: 'stop' } : {}) } } : {};
  return {
    fieldia: '0.13',
    id: 'test-drive',
    title: 'Book a test drive',
    ...(has.zone ? { timeZone: 'Europe/Berlin' } : {}),
    data: { kind: 'record', model: 'drive' },
    fields: {
      name: { type: 'char', label: 'Name', required: true },
      start: { type: 'datetime', label: 'Test drive', required: true },
      ...(has.end ? { stop: { type: 'datetime', label: 'Back by', readonly: true } } : {}),
    },
    layout: {
      type: 'sheet',
      id: 'sheet',
      title: { field: 'name', placeholder: 'Your name' },
      children: [{ type: 'field', id: 'start', field: 'start', ...slots }, ...(has.end ? [{ type: 'field', id: 'stop', field: 'stop' }] : [])],
    },
  };
}

/** The page a tab's steps end on. */
const lastOf = (list) => list[list.length - 1].text;

/** A tab's steps, each the whole page as it stands then and the words the stage bar says as it is drawn. */
function steps(make, adds) {
  let has = {};
  return adds.map(([words, more]) => {
    has = { ...has, ...more };
    return { words, text: pageText(make(has)) };
  });
}

/**
 * The stage's tabs, in order: each its name, the file it writes, its steps — what each adds, in plain words — (and
 * those it takes on a phone's screen instead, `narrow`), then the words the bar says as someone uses it (home.js
 * plays them), the last of them its finished state's. `json` is the page its steps end on; `narrowJson` a phone's.
 */
export const TABS = [
  {
    id: 'record',
    name: 'A record',
    file: 'customer.page.json',
    steps: steps(customer, [
      ['A customer record, with its name', {}],
      ['A phone, read for its country', { phone: true }],
      ['A rule: the VAT number only for a company', { company: true }],
      ['A credit limit, in euros', { credit: true }],
      ['A status bar: Lead › Customer', { stage: true }],
      ['Their invoices, inside the record', { invoices: true }],
      ['Overdue invoices in red, with a key', { overdue: true }],
    ]),
    used: ['Now someone uses it', 'Marked a company: the VAT number appears, now required', 'The finished record: try it'],
  },
  {
    id: 'list',
    name: 'A list',
    file: 'invoices.page.json',
    // A table wherever the stage is wider than a phone; on a phone's screen (520px or less) its rows as cards, a step
    // of their own (`narrow`, which home.js plays there).
    steps: steps(invoices, [
      ['A list of invoices', {}],
      ['A total under the amounts', { total: true }],
      ['Overdue ones in red, with a key', { overdue: true }],
      ['A filter, on as it opens: Unpaid', { filter: true }],
      ['Group By customer, in the search', { group: true }],
    ]),
    narrow: steps(invoices, [
      ['A list of invoices', {}],
      ['At a phone’s width, cards', { cards: true }],
      ['A total under the amounts', { total: true }],
      ['Overdue ones in red, with a key', { overdue: true }],
      ['A filter, on as it opens: Unpaid', { filter: true }],
      ['Group By customer, in the search', { group: true }],
    ]),
    used: ['Now someone uses it', 'Grouped by customer, each with its sum', 'One customer’s invoices, opened', 'The finished list: try it'],
  },
  {
    id: 'map',
    name: 'A map',
    file: 'homes.page.json',
    steps: steps(homes, [
      ['Homes for sale, each on its place', {}],
      ['Each pin says its price', { price: true }],
      ['A card for each home', { card: true }],
      ['Districts shaded by their homes, with a key', { districts: true }],
    ]),
    used: ['Now someone uses it', 'A district pressed: searched for its homes', 'A pin pressed: its home’s card', 'The finished map: try it'],
  },
  {
    id: 'booking',
    name: 'A booking',
    file: 'test-drive.page.json',
    steps: steps(booking, [
      ['A test drive, booked by its time', {}],
      ['On the showroom’s clock, in Berlin', { zone: true }],
      ['The times still free, from its diary', { slots: true }],
      ['Back by, written as a time is picked', { end: true }],
    ]),
    used: ['Now someone books', 'A day picked: its free times', 'Meanwhile, someone else books one', 'That time pressed: said taken, nothing booked', 'Another time booked, and back by', 'The finished booking: try it'],
  },
].map((tab) => ({ ...tab, json: lastOf(tab.steps), ...(tab.narrow ? { narrowJson: lastOf(tab.narrow) } : {}) }));

/** The record's steps and page, as the stage's first tab writes them; home.mjs shows its page before any script runs. */
export const STEPS = TABS[0].steps;
export const HERO_JSON = TABS[0].json;
