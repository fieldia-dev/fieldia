import type { Page } from '../format/page';
import { checkPage } from '../format/check-page';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import { memoryOutbox } from './outbox-form';
import type { FileValue } from './values';

/**
 * An offline outbox (`outbox`), as the form keeps it: a send that finds no network kept on the device — the form as
 * though it went, its ending told it was kept, no signal said until a try goes through — and sent in order once the signal is back, each taken by one sender only, its key sent
 * with it; a refusal then kept to try again or discard; a new record saved twice without signal saved once, and given
 * its id; a photo taken without signal kept as its bytes and stored before its send.
 */

const visit = (more: Partial<Page> = {}): Page => ({
  fieldia: '0.13',
  id: 'site-visit',
  data: { kind: 'responses' },
  outbox: true,
  fields: { unit: { type: 'char', label: 'Unit', required: true }, notes: { type: 'text', label: 'Notes' }, photos: { type: 'binary', label: 'Photos', multiple: true } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-unit', field: 'unit' }, { type: 'field', id: 'f-notes', field: 'notes' }, { type: 'field', id: 'f-photos', field: 'photos' }] },
  ...more,
});

/** A memory source whose signal the test turns off and on. */
function signal() {
  let off = false;
  const dataSource = createMemoryDataSource({ offline: () => off });
  return { dataSource, set: (on: boolean) => (off = !on) };
}

describe('an offline outbox', () => {
  it('keeps a response sent without signal, says it is kept, and sends it once the signal is back', async () => {
    const { dataSource, set } = signal();
    const store = memoryOutbox();
    const form = createForm({ page: visit(), dataSource, outbox: store });
    set(false);
    form.setValues({ unit: 'B-12', notes: 'Cracked tile in the kitchen' });
    expect(await form.save()).toBe(true);
    expect(form.getState().sent).toEqual({ id: null, values: { unit: 'B-12', notes: 'Cracked tile in the kitchen', photos: [] } });
    expect(form.getState().saveProblem).toBeNull();
    expect(form.getState().outbox).toEqual({ waiting: 1, sending: false, offline: true, kept: true, refused: [], lasting: false });
    expect(dataSource.responses).toEqual([]);
    // Still no signal: it waits where it was.
    await form.joined('outbox')?.send();
    expect(form.getState().outbox).toMatchObject({ waiting: 1, offline: true });
    set(true);
    await form.joined('outbox')?.send();
    expect(dataSource.responses).toHaveLength(1);
    // Kept by the key its first try carried: the same key sent with it, and as `queued.key`.
    expect(dataSource.responses[0]).toMatchObject({ pageId: 'site-visit', values: { unit: 'B-12' }, queued: { key: expect.stringMatching(/^send-/), at: expect.any(String) } });
    expect(dataSource.responses[0].key).toBe(dataSource.responses[0].queued?.key);
    expect(form.getState().outbox).toEqual({ waiting: 0, sending: false, offline: false, kept: true, refused: [], lasting: false });
    // Another response, sent with signal: its ending is the plain thanks.
    form.reset();
    expect(form.getState().outbox?.kept).toBe(false);
    form.setValues({ unit: 'C-3' });
    expect(await form.save()).toBe(true);
    expect(form.getState().outbox?.kept).toBe(false);
    expect(dataSource.responses).toHaveLength(2);
  });

  it('sends what waited right after another send goes through, whatever the browser says of its connection', async () => {
    const { dataSource, set } = signal();
    const store = memoryOutbox();
    const form = createForm({ page: visit(), dataSource, outbox: store });
    set(false);
    form.setValues({ unit: 'A-1' });
    await form.save();
    set(true);
    form.reset();
    form.setValues({ unit: 'A-2' });
    await form.save();
    await form.settle();
    await new Promise((done) => setTimeout(done, 0));
    expect(dataSource.responses.map((response) => response.values['unit'])).toEqual(['A-2', 'A-1']);
    expect(store.items).toEqual([]);
  });

  it('sends in the order they were kept, stopping where the signal goes, each by one sender only', async () => {
    const { dataSource, set } = signal();
    const store = memoryOutbox();
    const first = createForm({ page: visit(), dataSource, outbox: store });
    set(false);
    for (const unit of ['A-1', 'A-2', 'A-3']) {
      first.setValues({ unit });
      await first.save();
      first.reset();
    }
    expect(store.items.map((item) => item.request.values['unit'])).toEqual(['A-1', 'A-2', 'A-3']);
    // Two forms on the same device — two tabs — send at once: each send goes once.
    const second = createForm({ page: visit(), dataSource, outbox: store });
    await second.joined('outbox')?.refresh();
    expect(second.getState().outbox?.waiting).toBe(3);
    set(true);
    await Promise.all([first.joined('outbox')?.send(), second.joined('outbox')?.send()]);
    expect(dataSource.responses.map((response) => response.values['unit'])).toEqual(['A-1', 'A-2', 'A-3']);
  });

  it('keeps a send the server refused once it went, to try again or discard', async () => {
    let refuse = true;
    const memory = createMemoryDataSource();
    const store = memoryOutbox();
    let online = false;
    const dataSource = {
      ...memory,
      submit: (request: Parameters<typeof memory.submit>[0]) => {
        if (!online) return Promise.reject(new TypeError('Failed to fetch'));
        if (refuse) return Promise.reject(Object.assign(new Error('This unit is no longer listed'), { problem: { kind: 'rule', message: 'This unit is no longer listed' } }));
        return memory.submit(request);
      },
    };
    const form = createForm({ page: visit(), dataSource, outbox: store });
    form.setValues({ unit: 'Z-9' });
    await form.save();
    online = true;
    await form.joined('outbox')?.send();
    expect(form.getState().outbox).toEqual({ waiting: 0, sending: false, offline: false, kept: true, refused: [{ key: store.items[0].key, message: 'This unit is no longer listed', at: store.items[0].at }], lasting: false });
    refuse = false;
    await form.joined('outbox')?.retry(store.items[0].key);
    expect(memory.responses).toHaveLength(1);
    expect(store.items).toEqual([]);
    // A refusal let go: nothing kept, nothing sent.
    refuse = true;
    online = false;
    form.reset();
    form.setValues({ unit: 'Z-8' });
    await form.save();
    online = true;
    await form.joined('outbox')?.send();
    await form.joined('outbox')?.discard(store.items[0].key);
    expect(store.items).toEqual([]);
    expect(form.getState().outbox?.refused).toEqual([]);
  });

  it('saves a new record kept twice without signal once, and gives the form its id once it went', async () => {
    const { dataSource, set } = signal();
    const store = memoryOutbox();
    const page: Page = { ...visit(), data: { kind: 'record', model: 'visit' } };
    const form = createForm({ page, dataSource, outbox: store });
    set(false);
    form.setValues({ unit: 'C-3' });
    expect(await form.save()).toBe(true);
    form.setValues({ notes: 'Second look' });
    expect(form.getState().dirty).toEqual(['notes']);
    expect(await form.save()).toBe(true);
    expect(form.getState().dirty).toEqual([]);
    expect(store.items).toHaveLength(1);
    expect(store.items[0].request.values).toMatchObject({ unit: 'C-3', notes: 'Second look' });
    expect(form.getState().recordId).toBeNull();
    set(true);
    await form.joined('outbox')?.send();
    expect(form.getState().recordId).toBe(1);
    expect(dataSource.records['visit']['1']).toMatchObject({ unit: 'C-3', notes: 'Second look' });
  });

  it('keeps a photo taken without signal as its bytes, and stores it before its send', async () => {
    const { dataSource, set } = signal();
    const store = memoryOutbox();
    const form = createForm({ page: visit(), dataSource, outbox: store });
    set(false);
    const bytes = new TextEncoder().encode('a photo');
    form.upload('photos', [{ name: 'kitchen.jpg', size: bytes.length, type: 'image/jpeg', arrayBuffer: async () => bytes.buffer }]);
    await form.settle();
    await new Promise((done) => setTimeout(done, 0));
    const held = form.getState().values['photos'] as FileValue[];
    expect(held).toEqual([{ name: 'kitchen.jpg', type: 'image/jpeg', size: 7, data: 'YSBwaG90bw==' }]);
    expect(form.getState().uploads).toEqual([]);
    form.setValues({ unit: 'D-4' });
    expect(await form.save()).toBe(true);
    set(true);
    await form.joined('outbox')?.send();
    const sent = dataSource.responses[0].values['photos'] as FileValue[];
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ name: 'kitchen.jpg', type: 'image/jpeg' });
    expect(sent[0].data).toBeUndefined();
    expect(typeof sent[0].url).toBe('string');
  });

  it('refuses an outbox on a list of records', () => {
    const checked = checkPage({ ...visit(), data: { kind: 'record', model: 'visit' }, layout: { type: 'list', id: 'visits', columns: ['unit'] } });
    expect(checked.ok ? [] : checked.issues.map((issue) => `${issue.path}: ${issue.message}`)).toEqual(['outbox: an outbox keeps a form’s sends made without signal: a list of records sends none']);
  });
});
