import { createMemoryDataSource, type DataSource, type Locale, type Page, type UploadedFile, type UploadFile, type UploadRequest } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * A save that waits for files on their way to the store: Save shows as soon
 * as a file is picked, and pressed while files are still going it waits,
 * saying how many and why where "Saving…" would be — never a disabled
 * button. A file that did not get there stops the save under its field, in
 * the page's language.
 */

const listing = (kind: 'record' | 'responses' = 'record'): Page =>
  ({
    fieldia: '0.1',
    id: 'listing',
    data: kind === 'record' ? { kind, model: 'listing' } : { kind },
    fields: { name: { type: 'char', label: 'Name' }, photos: { type: 'image', label: 'Photos', multiple: true } },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-photos', field: 'photos' }] },
  }) as unknown as Page;

function handStore() {
  const sent: { file: UploadFile; request: UploadRequest; end(): void; fail(error: unknown): void }[] = [];
  const upload = (file: UploadFile, request: UploadRequest) =>
    new Promise<UploadedFile>((resolve, reject) => sent.push({ file, request, fail: reject, end: () => resolve({ url: `https://files.example/${file.name}`, name: file.name, size: file.size, type: file.type }) }));
  return { sent, upload };
}

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

function mount(options: { kind?: 'record' | 'responses'; locale?: Locale } = {}) {
  const store = handStore();
  const ds = createMemoryDataSource();
  const saves: unknown[] = [];
  const dataSource: DataSource = { ...ds, upload: store.upload, save: (request) => (saves.push(request), ds.save(request)) };
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page: listing(options.kind), dataSource, ...(options.locale ? { locale: options.locale } : {}) });
  const pick = (...names: string[]) => {
    const input = host.querySelector('[data-node="f-photos"] input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: names.map((name) => new File([new Uint8Array(4)], name, { type: 'image/jpeg' })), configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const button = (name: string) => [...host.querySelectorAll<HTMLButtonElement>('.fd-actions button')].find((b) => b.textContent?.trim() === name) as HTMLButtonElement;
  const status = () => host.querySelector('.fd-status')?.textContent ?? '';
  return { host, store, saves, pick, button, status, form: () => (handle as ViewerHandle).form };
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
async function until(check: () => unknown) {
  for (let waited = 0; !check() && waited < 2000; waited += 10) await new Promise((resolve) => setTimeout(resolve, 10));
}

describe('a save that waits for files on their way', () => {
  it('shows Save once a file is picked, waits when pressed, saying why, then saves the links', async () => {
    const { store, saves, pick, button, status, form } = mount();
    expect(button('Save').hidden).toBe(true);
    pick('Living room.jpg', 'Kitchen.jpg');
    await tick();
    // A file on its way is a change coming: Save shows for it.
    expect(button('Save').hidden).toBe(false);
    button('Save').click();
    await tick();
    expect(status()).toBe('2 files still uploading. Saving when they are done.');
    // Save stays where it was pressed, busy, while the save waits (the owner's walk of 0.33.0: it never looked busy).
    expect(button('Save').hidden).toBe(false);
    expect(button('Save').getAttribute('aria-busy')).toBe('true');
    expect(button('Discard').hidden).toBe(true);
    store.sent[0].end();
    await until(() => status().startsWith('1 file'));
    expect(status()).toBe('1 file still uploading. Saving when it is done.');
    expect(saves).toEqual([]);
    store.sent[1].end();
    await until(() => form().getState().status === 'saved');
    expect(status()).toBe('Saved');
    expect(saves).toHaveLength(1);
  });

  it('stops for a file that did not get there, under its field', async () => {
    const { host, store, saves, pick, button, status, form } = mount();
    pick('Balcony view.jpg');
    await tick();
    store.sent[0].fail(new Error('503'));
    await until(() => form().getState().uploads[0]?.status === 'failed');
    button('Save').click();
    await until(() => form().getState().status === 'error');
    expect(saves).toEqual([]);
    expect(status()).toBe('Not saved. Check: Photos');
    expect(host.querySelector('[data-node="f-photos"] .fd-error')?.textContent).toBe('Balcony view.jpg was not uploaded: try again, or remove it');
  });

  it('says it sends once they are in, on a page of answers, and in Arabic', async () => {
    const answers = mount({ kind: 'responses' });
    answers.pick('meter.jpg');
    await tick();
    answers.button('Submit').click();
    await tick();
    expect(answers.status()).toBe('1 file still uploading. Sending when it is done.');
    handle?.destroy();
    document.body.replaceChildren();

    const arabic = mount({ locale: 'ar' });
    arabic.pick('a.jpg', 'b.jpg', 'c.jpg');
    await tick();
    arabic.button('حفظ').click();
    await tick();
    expect(arabic.status()).toBe('ما زالت الملفات تُرفع: 3. سيُحفظ عند انتهائها.');
  });
});
