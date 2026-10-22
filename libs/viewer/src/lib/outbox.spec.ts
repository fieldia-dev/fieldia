import { createMemoryDataSource, memoryOutbox, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * An offline outbox, as the viewer says it (the outbox part): a response sent without signal ends "Kept on this
 * device", the bar over the form says what waits, the browser's `online` sends it, and a send refused once it went is
 * kept with Try again and Discard.
 */

const visit: Page = {
  fieldia: '0.10',
  id: 'site-visit',
  data: { kind: 'responses' },
  outbox: true,
  fields: { unit: { type: 'char', label: 'Unit', required: true } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-unit', field: 'unit' }] },
};

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

const settled = async () => {
  for (let i = 0; i < 6; i++) await new Promise((done) => setTimeout(done, 0));
};

describe('an offline outbox on screen', () => {
  it('says a response is kept on this device, what waits, and sends it as the signal comes back', async () => {
    let off = true;
    const dataSource = createMemoryDataSource({ offline: () => off });
    const host = document.body.appendChild(document.createElement('div'));
    handle = mountViewer(host, { page: visit, dataSource, outbox: memoryOutbox(), values: { unit: 'B-12' } });
    await settled();
    const bar = host.querySelector('.fd-outbox') as HTMLElement;
    expect(bar.hidden).toBe(true);
    (host.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    await settled();
    expect(host.querySelector('.fd-done-title')?.textContent).toBe('Kept on this device');
    expect(host.querySelector('.fd-done-text')?.textContent).toContain('sent as soon as it comes back');
    // What waits said under the ending, where the person is: the form is hidden.
    expect(bar.hidden).toBe(false);
    expect(bar.closest('.fd-done')).not.toBeNull();
    expect(bar.querySelector('.fd-outbox-said')?.textContent).toBe('No signal: 1 send waits on this device.');
    off = false;
    window.dispatchEvent(new Event('online'));
    await settled();
    expect(dataSource.responses).toHaveLength(1);
    expect(bar.querySelector('.fd-outbox-said')?.textContent).toBe('Everything that waited was sent.');
    // Another response, sent with signal: the bar back over the form, and the plain thanks again.
    (host.querySelector('.fd-done > button') as HTMLButtonElement).click();
    expect(bar.closest('.fd-done')).toBeNull();
    expect(host.querySelector('.fd-content')?.contains(bar)).toBe(true);
    handle.form.setValue('unit', 'C-3');
    (host.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    await settled();
    expect(host.querySelector('.fd-done-title')?.textContent).toBe('Thank you. Your answers were sent.');
    expect(host.querySelector('.fd-done-text')).toBeNull();
  });

  it('sends what waited as soon as another send goes through, whatever the browser says of its connection', async () => {
    let off = true;
    const dataSource = createMemoryDataSource({ offline: () => off });
    const store = memoryOutbox();
    const host = document.body.appendChild(document.createElement('div'));
    handle = mountViewer(host, { page: visit, dataSource, outbox: store, values: { unit: 'A-1' } });
    await settled();
    await handle.save();
    expect(store.items).toHaveLength(1);
    // The signal back, and no `online` from the browser: the next response goes, and the one kept goes after it.
    off = false;
    handle.form.reset();
    handle.form.setValue('unit', 'A-2');
    await handle.save();
    await settled();
    expect(dataSource.responses.map((response) => response.values['unit'])).toEqual(['A-2', 'A-1']);
    expect(store.items).toEqual([]);
  });

  it('keeps a send refused once it went, to try again or discard', async () => {
    let online = false;
    const memory = createMemoryDataSource();
    const store = memoryOutbox();
    const dataSource = {
      ...memory,
      submit: () => (online ? Promise.reject(Object.assign(new Error('Unit not listed'), { problem: { kind: 'rule', message: 'Unit not listed' } })) : Promise.reject(new TypeError('Failed to fetch'))),
    };
    const host = document.body.appendChild(document.createElement('div'));
    handle = mountViewer(host, { page: visit, dataSource, outbox: store, values: { unit: 'Z-9' }, confirm: async () => true });
    await settled();
    await handle.save();
    online = true;
    (host.querySelector('.fd-outbox-send') as HTMLButtonElement).click();
    await settled();
    const refused = host.querySelector('.fd-outbox-refused') as HTMLElement;
    expect(refused.hidden).toBe(false);
    expect(refused.textContent).toContain('Not sent: Unit not listed');
    const discard = [...refused.querySelectorAll('button')].find((button) => button.textContent === 'Discard') as HTMLButtonElement;
    discard.click();
    await settled();
    expect(store.items).toEqual([]);
    expect((host.querySelector('.fd-outbox') as HTMLElement).hidden).toBe(true);
  });
});
