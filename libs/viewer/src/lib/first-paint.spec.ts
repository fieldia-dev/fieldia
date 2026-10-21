import { createMemoryDataSource, type Page } from '@fieldia/core';
import { firstPaint } from '../server';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * Mounting over a server's first paint: it stays in sight while the live form is drawn out of sight; once that is drawn
 * and its record in, the live form takes its place in one step — what was typed, ticked or chosen in the first paint
 * carried into its boxes, the focus and caret where they were; Fieldia's sheet from the server kept, not added twice.
 */

const page: Page = {
  fieldia: '0.7',
  id: 'enquiry',
  title: 'Property enquiry',
  data: { kind: 'record', model: 'crm.enquiry' },
  fields: {
    name: { type: 'char', label: 'Client', required: true },
    email: { type: 'char', label: 'Email' },
    kind: { type: 'selection', label: 'Looking for', options: [{ value: 'villa', label: 'Villa' }, { value: 'office', label: 'Office' }] },
    floor: { type: 'selection', label: 'Floor', options: [{ value: 'g', label: 'Ground' }, { value: 'u', label: 'Upper' }] },
    garden: { type: 'boolean', label: 'Needs a garden' },
    notes: { type: 'text', label: 'Notes' },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-name', field: 'name' },
      { type: 'field', id: 'f-email', field: 'email' },
      { type: 'field', id: 'f-kind', field: 'kind' },
      { type: 'field', id: 'f-floor', field: 'floor', widget: 'radio' },
      { type: 'field', id: 'f-garden', field: 'garden' },
      { type: 'field', id: 'f-notes', field: 'notes' },
    ],
  },
};
const record = { name: 'Nile Traders', email: '', kind: 'villa', floor: 'g', garden: true, notes: '' };

let handle: ViewerHandle | undefined;
afterEach(() => {
  handle?.destroy();
  handle = undefined;
  document.body.replaceChildren();
  document.head.replaceChildren();
});

/** A host holding the server's first paint, as the page arrived. */
function served() {
  const host = document.createElement('div');
  host.innerHTML = firstPaint(page, { values: record });
  document.body.append(host);
  return host;
}

describe('mounting over a first paint', () => {
  it('keeps it in sight until the live form is drawn and loaded, then puts the live form in its place, carrying what was typed', async () => {
    const host = served();
    const first = host.querySelector('[data-fd-first-paint]') as HTMLElement;
    // A person works in the first paint before the script comes.
    const email = first.querySelector<HTMLInputElement>('[data-field="email"] input') as HTMLInputElement;
    email.value = 'sales@nile.example';
    (first.querySelector('[data-field="kind"] select') as HTMLSelectElement).value = 'office';
    (first.querySelector<HTMLInputElement>('[data-field="floor"] input[value="u"]') as HTMLInputElement).checked = true;
    (first.querySelector<HTMLInputElement>('[data-field="garden"] input') as HTMLInputElement).checked = false;
    const notes = first.querySelector<HTMLTextAreaElement>('[data-field="notes"] textarea') as HTMLTextAreaElement;
    notes.value = 'Near a school';
    notes.focus();
    notes.setSelectionRange(4, 4);

    handle = mountViewer(host, { page, dataSource: createMemoryDataSource({ records: { 'crm.enquiry': { 1: record } } }), recordId: 1 });
    // Out of sight while it is drawn: the first paint is what shows.
    expect(host.querySelector('[data-fd-first-paint]')).toBe(first);
    expect(handle.element.style.display).toBe('none');
    await handle.drawn;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(host.querySelector('[data-fd-first-paint]')).toBeNull();
    expect(handle.element.style.display).toBe('');
    expect(handle.form.getState().values).toMatchObject({ name: 'Nile Traders', email: 'sales@nile.example', kind: 'office', floor: 'u', garden: false, notes: 'Near a school' });
    const live = handle.element.querySelector<HTMLTextAreaElement>('[data-field="notes"] textarea') as HTMLTextAreaElement;
    expect(document.activeElement).toBe(live);
    expect([live.selectionStart, live.selectionEnd]).toEqual([4, 4]);
    // Fieldia's sheet came with the first paint: kept, never a second.
    expect(document.querySelectorAll('#fieldia-styles')).toHaveLength(1);
  });

  it('carries nothing untouched: the live form shows the record as loaded', async () => {
    const host = served();
    handle = mountViewer(host, { page, dataSource: createMemoryDataSource({ records: { 'crm.enquiry': { 1: { ...record, name: 'Nile Traders Co.' } } } }), recordId: 1 });
    await handle.drawn;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(handle.form.getState().values['name']).toBe('Nile Traders Co.');
    expect(handle.form.getState().dirty).toEqual([]);
  });

  it('without a first paint, draws as ever', () => {
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, { page });
    expect(handle.element.style.display).toBe('');
    expect(host.firstElementChild).toBe(handle.element);
  });
});
