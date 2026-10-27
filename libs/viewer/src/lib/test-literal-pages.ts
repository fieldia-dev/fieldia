import type { Page } from '@fieldia/core';

/**
 * The gate of literal words' own pages (literal-words.spec.ts): the places of the page format that no example page
 * holds, or holds where it is not drawn, each on a page that draws it — the gate writes every word of them with
 * `literalWords` and looks for each where the viewer shows it.
 */

/** A button of every kind of press: asking first, a toggle shown pressed, a menu of its own whose item asks first. */
const buttons = (id: string) => [
  { type: 'button', id: `${id}-ask`, label: 'Ask', confirm: 'Sure?', action: 'ask' },
  { type: 'button', id: `${id}-toggle`, label: 'Follow', pressedLabel: 'Following', pressed: 'on', action: 'follow' },
  { type: 'button', id: `${id}-menu`, label: 'More', menuLabel: 'More of it', action: 'more', menu: [{ id: `${id}-item`, label: 'Item', confirm: 'Item sure?', action: 'item' }] },
];

/** A record's sheet: its head, title, counters, alerts, buttons, and every kind of field and part. */
const record: Page = {
  fieldia: '0.13',
  id: 'gate-record',
  title: 'Gate record',
  data: { kind: 'record', model: 'gate' },
  fields: {
    name: { type: 'char', label: 'Name', help: 'Its name', pattern: '^[a-z]+$', patternHint: 'Small letters', default: 'NOT SMALL' },
    on: { type: 'boolean', label: 'On', default: true },
    hours: { type: 'float', label: 'Hours', default: 3 },
    lat: { type: 'float', label: 'Latitude', default: 30.05 },
    lng: { type: 'float', label: 'Longitude', default: 31.23 },
    notes: { type: 'html', label: 'Notes', help: 'Anything else' },
    rooms: {
      type: 'matrix',
      label: 'Rooms',
      help: 'Each room',
      rows: [{ value: 'kitchen', label: 'Kitchen', caption: 'Where we cook', alt: 'A kitchen' }],
      columns: [{ value: 'am', label: 'Morning', caption: 'Before noon', alt: 'Sunrise' }],
    },
    source: { type: 'reference', label: 'Source', help: 'Where from', models: [{ value: 'partner', label: 'Customer', caption: 'A customer', alt: 'A person' }] },
    extra: { type: 'properties', label: 'Extra', help: 'More of it', definitions: [{ name: 'size', label: 'Size', type: 'char' }] },
    desk: { type: 'selection', label: 'Desk', help: 'Pick one', options: [{ value: 'standing', label: 'Standing', caption: 'Up', alt: 'A standing desk', image: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }] },
    seat: { type: 'selection', label: 'Seat', options: [{ value: 'high', label: 'High', caption: 'For the counter' }] },
    lines: {
      type: 'one2many',
      label: 'Lines',
      help: 'Its lines',
      relation: 'gate.line',
      fields: {
        code: { type: 'char', label: 'Code', help: 'A code', pattern: '^[0-9]+$', patternHint: 'Figures' },
        level: { type: 'selection', label: 'Level', options: [{ value: 'a', label: 'A' }] },
        parts: { type: 'one2many', label: 'Parts', relation: 'gate.part', fields: { part: { type: 'char', label: 'Part', help: 'A part', pattern: '^[0-9]+$', patternHint: 'Figures too' } } },
      },
    },
    items: { type: 'one2many', label: 'Items', relation: 'gate.item', fields: { what: { type: 'char', label: 'What' } } },
    kinded: { type: 'one2many', label: 'Kinded', relation: 'gate.kinded', lineKinds: { field: 'display', text: 'what' }, fields: { display: { type: 'char', label: 'Display' }, what: { type: 'char', label: 'What' } } },
    none: { type: 'one2many', label: 'None', relation: 'gate.none', fields: { what: { type: 'char', label: 'What' } } },
    spots: { type: 'json', label: 'Spots' },
    ok: { type: 'boolean', label: 'OK' },
    tags: { type: 'many2many', label: 'Tags', relation: 'gate.tag', fields: { tag: { type: 'char', label: 'Tag', help: 'A tag', pattern: '^[0-9]+$', patternHint: 'Figures again' } } },
  },
  layout: {
    type: 'sheet',
    id: 'sheet',
    title: {
      field: 'name',
      label: 'Its name',
      placeholder: 'Name it',
      above: [{ type: 'field', id: 't-hours', field: 'hours', label: 'Beside', help: 'Beside help', readonly: true, readonlyReason: 'Beside locked' }],
    },
    statButtons: [{ id: 's-hours', label: 'Hours', field: 'hours', unit: 'h', action: 'hours' }],
    alerts: [{ id: 'a-one', tone: 'info', message: 'Note', buttons: buttons('alert') as never }],
    buttons: buttons('sheet') as never,
    footer: buttons('foot') as never,
    children: [
      {
        type: 'section',
        id: 'main',
        title: 'Main',
        children: [
          { type: 'field', id: 'f-name', field: 'name', placeholderWhen: [{ when: 'true', text: 'Type a name' }], validate: [{ minLength: 50, message: 'Longer, please' }] },
          { type: 'field', id: 'f-notes', field: 'notes' },
          { type: 'field', id: 'f-rooms', field: 'rooms' },
          { type: 'field', id: 'f-source', field: 'source' },
          { type: 'field', id: 'f-extra', field: 'extra' },
          { type: 'field', id: 'f-desk', field: 'desk', widget: 'image-choice' },
          { type: 'field', id: 'f-seat', field: 'seat', widget: 'radio' },
          {
            type: 'field',
            id: 'f-lines',
            field: 'lines',
            lineOpens: 'fields',
            cells: { code: { tones: [{ tone: 'info', when: 'true', label: 'Toned' }] } },
            rowButtons: buttons('line') as never,
            selectedButtons: buttons('chosen') as never,
            controlButtons: buttons('control') as never,
          },
          { type: 'field', id: 'f-tags', field: 'tags', columns: ['tag'] },
          { type: 'field', id: 'f-items', field: 'items', widget: 'cards', options: { itemLabel: 'Person', addLabel: 'Add a person' } },
          { type: 'field', id: 'f-kinded', field: 'kinded', options: { addSectionLabel: 'Add a heading', addNoteLabel: 'Add a remark' } },
          { type: 'field', id: 'f-none', field: 'none', options: { emptyLabel: 'Nothing yet' } },
          { type: 'field', id: 'f-spots', field: 'spots', widget: 'pins', options: { image: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', alt: 'A face', noteLabel: 'What was given' } },
          { type: 'field', id: 'f-ok', field: 'ok', widget: 'buttons', options: { yesLabel: 'Agreed', noLabel: 'Refused' } },
          ...buttons('part'),
          { type: 'form', id: 'f-saved', page: 'gate-saved', name: 'saved', title: 'Saved form' },
          { type: 'map', id: 'm-map', label: 'Map', layers: [{ id: 'l-one', label: 'Layer', latitude: 'lat', longitude: 'lng' }] },
          {
            type: 'related',
            id: 'r-related',
            title: 'Related',
            model: 'gate.related',
            field: 'gate_id',
            fields: { name: { type: 'char', label: 'Name' }, size: { type: 'float', label: 'Size' } },
            columns: ['name', 'size'],
            rowBold: 'true',
            rowBoldLabel: 'Bold one',
            card: { title: 'name', fields: [{ field: 'size', unit: 'm²' }] },
            rowButtons: buttons('related') as never,
          },
        ],
      },
    ],
  },
  on: { open: [{ do: 'say', message: 'Opened' }] },
} as unknown as Page;

/** A work item's head: its kind, the fields beside it, its own buttons. */
const head: Page = {
  fieldia: '0.13',
  id: 'gate-head',
  title: 'Gate head',
  data: { kind: 'record', model: 'gate' },
  fields: { name: { type: 'char', label: 'Name' }, on: { type: 'boolean', label: 'On' } },
  layout: {
    type: 'sheet',
    id: 'sheet',
    head: {
      kind: { label: 'Kind' },
      meta: [{ type: 'field', id: 'h-name', field: 'name', label: 'Meta name', help: 'Meta help', readonly: true, readonlyReason: 'Meta locked' }],
      actions: buttons('head') as never,
    },
    title: { field: 'name' },
    children: [{ type: 'section', id: 'main', children: [{ type: 'field', id: 'f-on', field: 'on' }] }],
  },
} as unknown as Page;

/** A list: its own buttons, its rows', the detail a row opens to. */
const list: Page = {
  fieldia: '0.13',
  id: 'gate-list',
  title: 'Gate list',
  data: { kind: 'record', model: 'gate' },
  fields: { name: { type: 'char', label: 'Name' }, size: { type: 'float', label: 'Size' }, on: { type: 'boolean', label: 'On', default: true }, line_ids: { type: 'one2many', label: 'Lines', relation: 'gate.line', fields: { code: { type: 'char', label: 'Code' } } } },
  layout: {
    type: 'list',
    id: 'list',
    columns: ['name'],
    actions: buttons('list') as never,
    rowButtons: buttons('row') as never,
    detail: { title: 'Its lines', lines: 'line_ids', columns: ['code'] },
    card: { title: 'name', fields: [{ field: 'size', unit: 'm²' }, { field: 'size', unit: { one: 'room', other: 'rooms' } }] },
    gallery: { opens: 'gallery' },
  },
} as unknown as Page;

/** A survey of a few steps: its wizard's own words, its review, its payment, its suggestions, its quiz and its endings. */
const survey: Page = {
  fieldia: '0.13',
  id: 'gate-survey',
  title: 'Gate survey',
  data: { kind: 'responses' },
  fields: {
    answer: { type: 'selection', label: 'Answer', options: [{ value: 'a', label: 'A', correct: true }, { value: 'b', label: 'B' }], default: 'b', quiz: { feedback: { right: 'Right', wrong: 'Wrong' } } },
    other: { type: 'selection', label: 'Other', options: [{ value: 'a', label: 'A', correct: true }], default: 'a', quiz: { feedback: { right: 'Right too', wrong: 'Wrong too' } } },
  },
  layout: {
    type: 'wizard',
    id: 'wizard',
    nextLabel: 'Onward',
    backLabel: 'Backward',
    finishLabel: 'Done',
    children: [
      { type: 'step', id: 'one', label: 'One', children: [{ type: 'field', id: 'f-answer', field: 'answer' }] },
      { type: 'step', id: 'two', label: 'Two', children: [{ type: 'field', id: 'f-other', field: 'other' }] },
    ],
  },
  quiz: { results: 'now', rightAnswers: true },
  review: { title: 'Look again', text: 'Before you send' },
  suggest: { label: 'Fill it', placeholder: 'Paste here' },
  endings: [{ title: 'Thanks', text: 'All done', again: 'Once more' }],
} as unknown as Page;

/** A page of responses that asks for a payment before it is sent. */
const payment: Page = {
  fieldia: '0.13',
  id: 'gate-payment',
  title: 'Gate payment',
  data: { kind: 'responses' },
  fields: { name: { type: 'char', label: 'Name' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-name', field: 'name' }] },
  payment: { label: 'Fee', amount: 100, currency: 'EGP', description: 'Paid now' },
} as unknown as Page;

/** A page that opens another as it opens, its dialog's title its own. */
const opening: Page = {
  fieldia: '0.13',
  id: 'gate-opening',
  title: 'Gate opening',
  data: { kind: 'record', model: 'gate' },
  fields: { name: { type: 'char', label: 'Name' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-name', field: 'name' }] },
  on: { open: [{ do: 'open', page: 'gate-saved', as: 'dialog', title: 'Opened as' }] },
} as unknown as Page;

/** A page of sections: its footer's buttons. */
const sections: Page = {
  fieldia: '0.13',
  id: 'gate-sections',
  title: 'Gate sections',
  data: { kind: 'record', model: 'gate' },
  fields: { name: { type: 'char', label: 'Name' }, on: { type: 'boolean', label: 'On', default: true } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-name', field: 'name' }], footer: buttons('sections') as never },
} as unknown as Page;

export const GATE_PAGES: Page[] = [record, head, list, survey, payment, sections, opening];

/** The records the gate's pages show: a record with its lines and tags, its related records, a list's rows. */
export const GATE_RECORDS = {
  gate: {
    1: { name: 'NOT SMALL', on: true, hours: 3, lat: 30.05, lng: 31.23, size: 2, lines: [{ key: 'l1', id: 1, values: { code: 'X', level: 'a', parts: [{ key: 'p1', id: 1, values: { part: 'Y' } }] } }], items: [{ key: 'i1', id: 1, values: { what: 'One' } }], kinded: [{ key: 'k1', id: 1, values: { display: 'section', what: 'Head' } }], spots: [{ x: 0.5, y: 0.5, note: 'Here' }], tags: [{ id: 1, label: 'Tag', tag: 'Z' }], line_ids: [{ key: 'l1', id: 1, values: { code: 'X' } }] },
    2: { name: 'Second', on: true, size: 1 },
  },
  'gate.related': { 1: { name: 'Related one', size: 2, gate_id: { id: 1, label: 'NOT SMALL' } } },
};

/** Saved forms the gate's pages place in themselves, by id. */
export const GATE_SAVED: Record<string, Page> = {
  'gate-saved': { fieldia: '0.13', id: 'gate-saved', title: 'Saved', data: { kind: 'record', model: 'gate.saved' }, fields: { name: { type: 'char', label: 'Saved name' } }, layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-name', field: 'name' }] } } as unknown as Page,
};
