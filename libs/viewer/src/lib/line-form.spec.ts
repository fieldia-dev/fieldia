import type { Line, Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * A contact's child addresses, each opened in a form of its own as Flectra's
 * dialog: a type chosen by radio with a sentence for each, job and title only
 * for a contact, the address only for the other types, the name required for
 * a contact — and a survey question's answers, lines held in a line.
 */
const contact = {
  fieldia: '0.1',
  id: 'contact',
  data: { kind: 'record', model: 'res.partner' },
  fields: {
    name: { type: 'char', label: 'Name' },
    is_company: { type: 'boolean', label: 'Company' },
    child_ids: {
      type: 'one2many',
      label: 'Contacts',
      relation: 'res.partner',
      fields: {
        type: { type: 'selection', label: 'Type', options: [{ value: 'contact', label: 'Contact' }, { value: 'invoice', label: 'Invoice Address' }] },
        name: { type: 'char', label: 'Name' },
        function: { type: 'char', label: 'Job Position' },
        street: { type: 'char', label: 'Street' },
        tags: {
          type: 'one2many',
          label: 'Phones',
          relation: 'res.partner.phone',
          fields: { number: { type: 'char', label: 'Number' } },
        },
      },
    },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-name', field: 'name' },
      {
        type: 'field',
        id: 'f-children',
        field: 'child_ids',
        columns: ['type', 'name', 'street'],
        lineForm: {
          children: [
            { type: 'field', id: 'c-type', field: 'type', widget: 'radio' },
            { type: 'text', id: 'c-help-contact', text: 'Use this to organize the people of a company.', style: 'note', invisible: "type != 'contact'" },
            { type: 'text', id: 'c-help-invoice', text: 'Preferred address for all invoices.', style: 'note', invisible: "type != 'invoice'" },
            {
              type: 'section',
              id: 'c-main',
              columns: 2,
              children: [
                { type: 'field', id: 'c-name', field: 'name', required: "type == 'contact'" },
                { type: 'field', id: 'c-function', field: 'function', invisible: "type != 'contact'" },
                { type: 'field', id: 'c-street', field: 'street', invisible: "type == 'contact'" },
                { type: 'text', id: 'c-parent', text: 'Of {name}', invisible: 'not parent.is_company' },
              ],
            },
            { type: 'field', id: 'c-phones', field: 'tags' },
          ],
        },
      },
    ],
  },
} as unknown as Page;

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const dialog = () => document.querySelector('.fd-form-dialog') as HTMLElement;
const shown = (id: string) => {
  const part = dialog().querySelector(`[data-node="${id}"]`);
  return !!part && !part.closest('[hidden]');
};
const footButton = (name: string) => [...dialog().querySelectorAll<HTMLButtonElement>('.fd-form-dialog-foot button')].find((b) => b.textContent === name) as HTMLButtonElement;

async function open(values: Record<string, unknown>) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page: contact, values: { name: 'Nile Crest', is_company: true, child_ids: [{ key: 'k1', values }] } as never });
  const button = host.querySelector('tr[data-line="k1"] .fd-line-open') as HTMLButtonElement;
  expect(button).not.toBeNull();
  button.click();
  await settle();
  return host;
}
const line = () => (handle!.form.getState().values['child_ids'] as Line[])[0];

describe('a line opened in a form of its own', () => {
  it('is laid out by its own parts, each shown by a condition on the line, the record as parent', async () => {
    await open({ type: 'contact', name: 'Hany Saber', function: 'CFO', street: null, tags: [] });
    expect(dialog()).not.toBeNull();
    expect(dialog().querySelector('[data-node="c-type"] [role="radiogroup"]')).not.toBeNull();
    expect(shown('c-help-contact')).toBe(true);
    expect(shown('c-help-invoice')).toBe(false);
    expect(shown('c-function')).toBe(true);
    expect(shown('c-street')).toBe(false);
    expect(shown('c-parent')).toBe(true);
    // Invoice: its own sentence, the address, no job.
    (dialog().querySelector('[data-node="c-type"] input[value="1"]') as HTMLInputElement).click();
    expect(shown('c-help-invoice')).toBe(true);
    expect(shown('c-function')).toBe(false);
    expect(shown('c-street')).toBe(true);
  });

  it('asks for what the line requires by its own condition, and writes the line back on Save & Close', async () => {
    await open({ type: 'contact', name: null, function: null, street: null, tags: [] });
    footButton('Save & Close').click();
    await settle();
    // A contact needs its name: the dialog stays.
    expect(dialog()).not.toBeNull();
    const name = dialog().querySelector('[data-node="c-name"] input') as HTMLInputElement;
    name.value = 'Mona Adel';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    footButton('Save & Close').click();
    await settle();
    expect(dialog()).toBeNull();
    expect(line().values['name']).toBe('Mona Adel');
  });

  it('edits the lines a line holds in its form, and keeps them in the line', async () => {
    await open({ type: 'contact', name: 'Hany Saber', function: null, street: null, tags: [] });
    const add = [...dialog().querySelectorAll<HTMLButtonElement>('[data-node="c-phones"] .fd-lines-add')][0];
    add.click();
    const number = dialog().querySelector('[data-node="c-phones"] tbody input') as HTMLInputElement;
    number.value = '+20 100 000 0000';
    number.dispatchEvent(new Event('input', { bubbles: true }));
    footButton('Save & Close').click();
    await settle();
    expect((line().values['tags'] as Line[]).map((inner) => inner.values['number'])).toEqual(['+20 100 000 0000']);
    // The table's row never draws them.
    expect(document.querySelector('tr[data-line="k1"] [data-column="tags"]')).toBeNull();
  });
});

describe('a card opened in its line’s form', () => {
  it('has ↗ on each card, opening the same form', async () => {
    const page = JSON.parse(JSON.stringify(contact));
    page.layout.children[1].widget = 'cards';
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, { page, values: { name: 'Nile Crest', is_company: true, child_ids: [{ key: 'k1', values: { type: 'invoice', name: null, function: null, street: '12 Nile St', tags: [] } }] } as never });
    const open = host.querySelector('.fd-repeat-card[data-line="k1"] .fd-line-open') as HTMLButtonElement;
    expect(open.getAttribute('aria-label')).toBe('Open line');
    open.click();
    await settle();
    expect(shown('c-help-invoice')).toBe(true);
    expect(shown('c-street')).toBe(true);
  });
});
