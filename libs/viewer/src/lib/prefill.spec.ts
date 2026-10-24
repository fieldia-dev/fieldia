import { createMemoryDataSource, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * A page filled from the link it is opened with (`prefill`), as the viewer draws it: the browser's own address read
 * unless the app gives one, a field on the page showing what the link gave, a hidden one sent with the answers.
 */

const enquiry: Page = {
  fieldia: '0.12',
  id: 'enquiry',
  data: { kind: 'responses' },
  fields: { name: { type: 'char', label: 'Your name' }, unit: { type: 'char', label: 'Unit' }, utm_source: { type: 'char', label: 'Source' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-unit', field: 'unit' }] },
  prefill: { fromUrl: ['unit', 'utm_source'] },
};

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
  window.history.replaceState(null, '', '/');
});

describe('a page filled from its link', () => {
  it('reads the browser’s address, shows what it gave, and sends the hidden field with the answers', async () => {
    window.history.replaceState(null, '', '/enquiry?unit=B-12&utm_source=whatsapp&other=1');
    const dataSource = createMemoryDataSource();
    const host = document.body.appendChild(document.createElement('div'));
    handle = mountViewer(host, { page: enquiry, dataSource });
    expect((host.querySelector('[data-node="f-unit"] input') as HTMLInputElement).value).toBe('B-12');
    // The hidden field is drawn nowhere.
    expect(host.querySelector('[data-field="utm_source"]')).toBeNull();
    handle.form.setValue('name', 'Mona');
    expect(await handle.save()).toBe(true);
    expect(dataSource.responses[0].values).toEqual({ name: 'Mona', unit: 'B-12', utm_source: 'whatsapp' });
  });

  it('reads the link the app gives over the browser’s, and none on a page without prefill', () => {
    window.history.replaceState(null, '', '/enquiry?unit=B-12');
    const host = document.body.appendChild(document.createElement('div'));
    handle = mountViewer(host, { page: enquiry, url: '?unit=C-3' });
    expect(handle.form.getState().values['unit']).toBe('C-3');
    handle.destroy();
    handle = mountViewer(host, { page: { ...enquiry, prefill: undefined } });
    expect(handle.form.getState().values['unit']).toBeNull();
  });
});
