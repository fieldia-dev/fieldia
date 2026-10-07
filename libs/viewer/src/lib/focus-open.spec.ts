import { createMemoryDataSource, type Page } from '@fieldia/core';
import { openFormDialog } from './dialog';
import { mountViewer, type ViewerHandle } from './viewer';

/** A field that takes the focus as the record opens, as Flectra's default_focus — never from someone busy elsewhere. */
const contact = {
  fieldia: '0.1',
  id: 'contact',
  data: { kind: 'record', model: 'res.partner' },
  fields: { email: { type: 'char', label: 'Email' }, name: { type: 'char', label: 'Name' }, vat: { type: 'char', label: 'Tax ID' }, is_company: { type: 'boolean', label: 'Company' } },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-email', field: 'email' },
      { type: 'field', id: 'f-vat', field: 'vat', focus: true, invisible: 'not is_company' },
      { type: 'field', id: 'f-name', field: 'name', focus: true },
    ],
  },
} as unknown as Page;

const handles: ViewerHandle[] = [];
afterEach(() => {
  handles.splice(0).forEach((handle) => handle.destroy());
  document.body.replaceChildren();
});
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
function mount(options: Partial<Parameters<typeof mountViewer>[1]> = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const handle = mountViewer(host, { page: contact, ...options });
  handles.push(handle);
  return host;
}
const focusedNode = () => document.activeElement?.closest('[data-node]')?.getAttribute('data-node');

describe('a field that takes the focus as the record opens', () => {
  it('has it once a new record opens: the first such field shown', async () => {
    mount();
    await settle();
    expect(focusedNode()).toBe('f-name');
    handles.splice(0).forEach((handle) => handle.destroy());
    mount({ values: { is_company: true } });
    await settle();
    expect(focusedNode()).toBe('f-vat');
  });

  it('has it once a record has loaded', async () => {
    const dataSource = createMemoryDataSource({ records: { 'res.partner': { 7: { name: 'Nile Crest', email: 'hi@nile.example' } } } });
    mount({ dataSource, recordId: 7 });
    await settle();
    await handles[0].form.settled();
    await settle();
    expect(focusedNode()).toBe('f-name');
  });

  it('never takes it from someone busy elsewhere on the screen, or from another form', async () => {
    const search = document.createElement('input');
    document.body.append(search);
    search.focus();
    mount();
    await settle();
    expect(document.activeElement).toBe(search);
    search.remove();
    // Two forms on one screen: the first takes it, the second leaves it there.
    handles.splice(0).forEach((handle) => handle.destroy());
    const first = mount();
    mount();
    await settle();
    expect(first.contains(document.activeElement)).toBe(true);
  });

  it('has it in a sheet’s title, as Flectra’s default_focus on the name', async () => {
    const sheet = { ...contact, layout: { type: 'sheet', id: 'sheet', title: { field: 'name', focus: true }, children: [{ type: 'field', id: 'f-email', field: 'email' }] } } as unknown as Page;
    const host = document.createElement('div');
    document.body.append(host);
    handles.push(mountViewer(host, { page: sheet }));
    await settle();
    expect(focusedNode()).toBe('#title');
  });

  it('has it in a dialog, in place of the first field', async () => {
    void openFormDialog({ page: contact, title: 'New contact' });
    await settle();
    expect(focusedNode()).toBe('f-name');
  });
});
