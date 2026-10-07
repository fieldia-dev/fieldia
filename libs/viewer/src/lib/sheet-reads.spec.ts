import type { Page, Values } from '@fieldia/core';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * How a dense record sheet reads, as Flectra draws one: read-only values as
 * words, stat buttons that format what they show, links with pictures and
 * colours, parts on one line, alerts holding a field's value, a statusbar
 * with a condition, keys on buttons, parts for editing or reading only, and
 * several ribbons.
 */

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const visible = (el: Element | null) => !!el && !el.closest('[hidden]');

function mount(page: Page, options: Partial<ViewerOptions> = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, ...options });
  return { host, handle, form: handle.form, at: (id: string) => host.querySelector(`[data-node="${id}"]`) as HTMLElement };
}

const FIELDS: Page['fields'] = {
  name: { type: 'char', label: 'Name' },
  ref: { type: 'char', label: 'Reference', readonly: true },
  email: { type: 'char', label: 'Email' },
  state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'paid', label: 'Paid' }] },
  risk: { type: 'selection', label: 'Risk', options: [{ value: 'low', label: 'Low' }, { value: 'high', label: 'High' }] },
  amount: { type: 'monetary', label: 'Amount', currency: 'EGP' },
  hours: { type: 'float', label: 'Hours', digits: [16, 2] },
  due: { type: 'date', label: 'Due' },
  partner: { type: 'many2one', label: 'Customer', relation: 'res.partner' },
  notes: { type: 'text', label: 'Notes' },
  empty: { type: 'char', label: 'Nothing yet' },
};

const VALUES: Values = {
  name: 'INV/2026/0042',
  ref: 'A very long reference that goes on and on past the width of its box, as a display name does',
  email: 'sara@example.com',
  state: 'paid',
  risk: 'high',
  amount: 6750,
  hours: 24.8,
  due: '2026-10-13',
  partner: { id: 7, label: 'Bermuda Real Estate' },
  notes: 'Two lines\nof notes',
  empty: null,
};

function readonlyPage(look?: Page['look']): Page {
  const field = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ type: 'field' as const, id, field: name, readonly: true, ...extra });
  return {
    fieldia: '0.1',
    id: 'reading',
    data: { kind: 'record', model: 'account.move' },
    fields: FIELDS,
    layout: {
      type: 'sheet',
      id: 'root',
      title: { field: 'name' },
      children: [
        {
          type: 'section',
          id: 's',
          children: [
            { type: 'field', id: 'f-ref', field: 'ref' },
            field('f-email', 'email', { widget: 'email' }),
            field('f-state', 'state'),
            field('f-amount', 'amount'),
            field('f-hours', 'hours'),
            field('f-due', 'due'),
            field('f-partner', 'partner'),
            field('f-notes', 'notes'),
            field('f-empty', 'empty'),
            { type: 'field', id: 'f-name-edit', field: 'email' },
          ],
        },
      ],
    },
    ...(look ? { look } : {}),
  };
}

describe('read-only fields as words (look.readonlyShown)', () => {
  const words = (at: (id: string) => HTMLElement, id: string) => {
    const text = at(id).querySelector('.fd-read-text') as HTMLElement | null;
    return visible(text) ? (text as HTMLElement).textContent : null;
  };

  it('keeps the greyed boxes unless the page asks for words', () => {
    const { at } = mount(readonlyPage(), { values: VALUES });
    expect(words(at, 'f-state')).toBeNull();
    expect(visible(at('f-state').querySelector('select'))).toBe(true);
  });

  it('draws each read-only value as its words: a choice by its label, money with its currency, a date, a link by its name, long words wrapped', () => {
    const { at } = mount(readonlyPage({ readonlyShown: 'text' }), { values: VALUES });
    expect(words(at, 'f-ref')).toBe(VALUES['ref']);
    expect(words(at, 'f-state')).toBe('Paid');
    expect(visible(at('f-state').querySelector('select'))).toBe(false);
    expect(words(at, 'f-amount')).toMatch(/6,750\.00/);
    expect(words(at, 'f-amount')).toMatch(/EGP|E£|£/);
    expect(words(at, 'f-hours')).toBe('24.80');
    expect(words(at, 'f-due')).toBe('13 Oct 2026');
    expect(words(at, 'f-partner')).toBe('Bermuda Real Estate');
    expect(words(at, 'f-notes')).toBe('Two lines\nof notes');
    // An email is a link to write to, as Flectra's.
    expect(at('f-email').querySelector('.fd-read-text a')?.getAttribute('href')).toBe('mailto:sara@example.com');
    // Empty, it draws empty: no "Search…", no mask.
    expect(words(at, 'f-empty')).toBe('');
    // A field that can be edited keeps its box.
    expect(visible(at('f-name-edit').querySelector('input'))).toBe(true);
    expect(words(at, 'f-name-edit')).toBeNull();
  });

  it('follows the value as it changes, and the box comes back once the field can be edited', () => {
    const page = readonlyPage({ readonlyShown: 'text' });
    const section = (page.layout as { children: { children: { id: string; readonly?: unknown }[] }[] }).children[0];
    section.children.find((n) => n.id === 'f-state')!.readonly = "name == 'locked'";
    const { at, form } = mount(page, { values: { ...VALUES, name: 'locked' } });
    expect(words(at, 'f-state')).toBe('Paid');
    form.setValue('state', 'draft');
    expect(words(at, 'f-state')).toBe('Draft');
    form.setValue('name', 'open');
    expect(words(at, 'f-state')).toBeNull();
    expect(visible(at('f-state').querySelector('select'))).toBe(true);
  });

  it('draws a whole form locked by the Edit switch as words, and its boxes once Edit is pressed', () => {
    const { host, at } = mount(readonlyPage({ readonlyShown: 'text' }), { values: VALUES, readonly: true, editSwitch: true });
    expect(words(at, 'f-name-edit')).toBe('sara@example.com');
    (host.querySelector('.fd-edit-switch') as HTMLButtonElement).click();
    expect(words(at, 'f-name-edit')).toBeNull();
    expect(words(at, 'f-state')).toBe('Paid');
  });

  it('draws a read-only title as words too, so a long one wraps', () => {
    const page = readonlyPage({ readonlyShown: 'text' });
    (page.fields['name'] as { readonly?: boolean }).readonly = true;
    const { host } = mount(page, { values: VALUES });
    expect(host.querySelector('.fd-title [data-node="#title"] .fd-read-text')?.textContent).toBe('INV/2026/0042');
  });
});
