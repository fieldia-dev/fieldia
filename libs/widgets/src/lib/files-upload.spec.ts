import { createForm, saveRefused, type DataSource, type Field, type FieldNode, type FileValue, type Page, type UploadedFile, type UploadFile, type UploadRequest } from '@fieldia/core';
import { createWidget } from './widgets';
import { INLINE_FILE_WARNING, letGoOnceLoaded } from './files';
import { fileShown } from './file-formats';
import { WIDGET_LABELS } from './labels';

/**
 * Files stored as they are picked, as the field shows them: where the data
 * source has `upload`, each file picked goes to the store at once and shows on
 * its way — its picture, its name, a bar that fills, where it is in words, ×
 * to cancel it — then takes its place among the stored files, the field
 * holding its link alone. One that fails says so, and offers Retry; one the
 * store refuses says the store's words. Without upload, a file goes into the
 * record as before, and a large one warns, once, in the console.
 */

// jsdom has no object URLs: the browser's are stood in for.
const made: string[] = [];
const revoked: string[] = [];
beforeAll(() => {
  Object.assign(URL, {
    createObjectURL: () => (made.push(`blob:${made.length + 1}`), made[made.length - 1]),
    revokeObjectURL: (url: string) => revoked.push(url),
  });
});
beforeEach(() => {
  made.length = 0;
  revoked.length = 0;
});

/** A store the test answers by hand. */
function handStore() {
  const sent: { file: UploadFile; request: UploadRequest; end(): void; fail(error: unknown): void }[] = [];
  const upload = (file: UploadFile, request: UploadRequest) =>
    new Promise<UploadedFile>((resolve, reject) => {
      request.signal?.addEventListener('abort', () => reject(Object.assign(new Error('stopped'), { name: 'AbortError' })));
      sent.push({ file, request, end: () => resolve({ url: `https://files.example/${file.name}`, name: file.name, size: file.size, type: file.type }), fail: reject });
    });
  return { sent, upload };
}

function setup(field: Record<string, unknown>, options: { upload?: DataSource['upload']; readonly?: boolean; node?: Record<string, unknown>; locale?: 'en' | 'ar' } = {}) {
  const page = {
    fieldia: '0.1',
    id: 't',
    data: { kind: 'record', model: 'listing' },
    fields: { x: { label: 'Photos', ...field } as Field },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'x', ...(options.node ? { options: options.node } : {}) }] },
  } as Page;
  const form = createForm({ page, dataSource: options.upload ? { upload: options.upload } : {} });
  const node = (page.layout as { children: FieldNode[] }).children[0];
  const locale = options.locale ?? 'en';
  const widget = createWidget({ form, name: 'x', field: page.fields['x'], node, id: 'fd-x', document, labels: WIDGET_LABELS[locale], locale });
  const root = document.createElement('div');
  root.className = 'fd-form';
  root.append(widget.element);
  document.body.replaceChildren(root);
  const refresh = () => widget.update({ value: form.getState().values['x'], values: form.getState().values, readonly: options.readonly ?? false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  return { form, el: widget.element, value: () => form.getState().values['x'] as FileValue[] | FileValue | null };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
async function until(check: () => unknown) {
  for (let waited = 0; !check() && waited < 2000; waited += 10) await new Promise((resolve) => setTimeout(resolve, 10));
}
const input = (el: Element) => el.querySelector('input[type=file]') as HTMLInputElement;
function choose(el: Element, ...files: File[]) {
  Object.defineProperty(input(el), 'files', { value: files, configurable: true });
  input(el).dispatchEvent(new Event('change', { bubbles: true }));
}
const jpeg = (name: string, size = 6) => new File([new Uint8Array(size)], name, { type: 'image/jpeg' });
const pdf = (name: string) => new File(['%PDF'], name, { type: 'application/pdf' });
const going = (el: Element) => [...el.querySelectorAll<HTMLElement>('.fd-file-going')];
const words = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const note = (el: Element) => words(el.querySelector('.fd-file-note'));
const news = (el: Element) => words(el.querySelector('.fd-file-news'));

describe('a file field where the source stores files', () => {
  it('shows each file on its way — picture, name, size, a bar — then among the stored, holding its link alone', async () => {
    const store = handStore();
    const { el, value } = setup({ type: 'image', multiple: true }, { upload: store.upload });
    choose(el, jpeg('Living room.jpg'), jpeg('Kitchen.jpg'));
    await tick();
    expect(store.sent.map((s) => s.file.name)).toEqual(['Living room.jpg', 'Kitchen.jpg']);
    expect(value()).toEqual([]);
    const [first] = going(el);
    expect(first.querySelector('img.fd-file-thumb')?.getAttribute('src')).toMatch(/^blob:/);
    expect(first.querySelector('.fd-file-name')?.getAttribute('title')).toBe('Living room.jpg');
    const bar = first.querySelector('progress') as HTMLProgressElement;
    expect(bar.getAttribute('aria-label')).toBe('Uploading Living room.jpg');
    // A bar with no number until the store tells one, then the share sent.
    expect(bar.hasAttribute('value')).toBe(false);
    expect(words(first.querySelector('.fd-file-state'))).toBe('Uploading…');
    store.sent[0].request.onProgress?.(3, 6);
    expect(bar.value).toBe(50);
    expect(words(first.querySelector('.fd-file-state'))).toBe('50%');
    expect(first.querySelector('.fd-file-cancel')?.getAttribute('aria-label')).toBe('Cancel uploading Living room.jpg');
    const shownMeanwhile = going(el).map((item) => item.querySelector('img') as HTMLImageElement);
    store.sent[0].end();
    store.sent[1].end();
    await until(() => !going(el).length);
    // Stored before their pictures loaded from the files: their addresses kept while they load (the how-to replay of
    // 0.35: let go then, WebKit said "Failed to load resource"), let go as each has loaded.
    const addresses = shownMeanwhile.map((picture) => picture.getAttribute('src'));
    expect(addresses).toEqual([expect.stringMatching(/^blob:/), expect.stringMatching(/^blob:/)]);
    expect(revoked.filter((url) => addresses.includes(url))).toEqual([]);
    for (const picture of shownMeanwhile) picture.dispatchEvent(new Event('load'));
    expect(revoked).toEqual(expect.arrayContaining(addresses));
    expect(value()).toEqual([
      { url: 'https://files.example/Living room.jpg', name: 'Living room.jpg', size: 6, type: 'image/jpeg' },
      { url: 'https://files.example/Kitchen.jpg', name: 'Kitchen.jpg', size: 6, type: 'image/jpeg' },
    ]);
    expect([...el.querySelectorAll('.fd-file-item .fd-file-thumb')].map((img) => img.getAttribute('src'))).toEqual(['https://files.example/Living room.jpg', 'https://files.example/Kitchen.jpg']);
    expect(news(el)).toBe('2 files uploaded');
    expect(el.querySelector('.fd-file-news')?.getAttribute('role')).toBe('status');
    // The pictures shown meanwhile are let go, and so is every address the photos were read through.
    expect(revoked).toEqual(expect.arrayContaining(['blob:1', 'blob:2']));
    expect(made.filter((url) => !revoked.includes(url))).toEqual([]);
  });

  it('cancels one with ×: stopped at the store, gone from the field, nothing kept', async () => {
    const store = handStore();
    const { el, value, form } = setup({ type: 'binary', multiple: true }, { upload: store.upload });
    choose(el, pdf('Lease.pdf'));
    await tick();
    (going(el)[0].querySelector('.fd-file-cancel') as HTMLButtonElement).click();
    await tick();
    expect(store.sent[0].request.signal?.aborted).toBe(true);
    expect(going(el)).toEqual([]);
    expect(form.getState().uploads).toEqual([]);
    expect(value()).toEqual([]);
    expect(note(el)).toBe('');
  });

  it('says a file did not get there, and offers Retry, which sends it again', async () => {
    const store = handStore();
    const { el, value } = setup({ type: 'image', multiple: true }, { upload: store.upload });
    choose(el, jpeg('Balcony view.jpg'));
    await tick();
    store.sent[0].fail(new TypeError('Failed to fetch'));
    await until(() => going(el)[0]?.dataset['status'] === 'failed');
    const item = going(el)[0];
    expect(words(item.querySelector('.fd-file-state'))).toBe('Not uploaded');
    expect((item.querySelector('progress') as HTMLElement).hidden).toBe(true);
    const retry = item.querySelector('.fd-file-retry') as HTMLButtonElement;
    expect([retry.hidden, words(retry), retry.getAttribute('aria-label')]).toEqual([false, 'Retry', 'Retry Balcony view.jpg']);
    expect(item.querySelector('.fd-file-cancel')?.getAttribute('aria-label')).toBe('Remove Balcony view.jpg');
    expect(news(el)).toBe('Balcony view.jpg was not uploaded');
    expect(el.querySelector('.fd-file-news')?.hasAttribute('data-failed')).toBe(true);
    retry.focus();
    retry.click();
    await tick();
    expect(store.sent).toHaveLength(2);
    expect(going(el)[0].dataset['status']).toBe('uploading');
    // The same item, so Retry's press keeps its place.
    expect(going(el)[0]).toBe(item);
    store.sent[1].end();
    await until(() => !going(el).length);
    expect((value() as FileValue[]).map((f) => f.name)).toEqual(['Balcony view.jpg']);
  });

  it('says the store’s own words for a file it refuses, with no Retry', async () => {
    const store = handStore();
    const { el } = setup({ type: 'binary', multiple: true }, { upload: store.upload });
    choose(el, pdf('Scan.pdf'));
    await tick();
    store.sent[0].fail(saveRefused({ kind: 'rule', message: 'Scans over 20 pages go to the archive' }));
    await until(() => going(el)[0]?.dataset['status'] === 'refused');
    expect(words(going(el)[0].querySelector('.fd-file-state'))).toBe('Scans over 20 pages go to the archive');
    expect((going(el)[0].querySelector('.fd-file-retry') as HTMLElement).hidden).toBe(true);
    (going(el)[0].querySelector('.fd-file-cancel') as HTMLButtonElement).click();
    expect(going(el)).toEqual([]);
  });

  it('counts the files on their way against the most, and among the names already added', async () => {
    const store = handStore();
    const { el } = setup({ type: 'binary', multiple: true, maxFiles: 2 }, { upload: store.upload });
    choose(el, pdf('a.pdf'));
    await tick();
    choose(el, pdf('a.pdf'), pdf('b.pdf'), pdf('c.pdf'));
    await tick();
    expect(store.sent.map((s) => s.file.name)).toEqual(['a.pdf', 'b.pdf']);
    expect([...el.querySelectorAll('.fd-file-note > *')].map(words)).toEqual(['a.pdf: already added', 'Up to 2 files: 1 not added']);
    // Once they are in, the news is said on a line of its own: why some were not added stays.
    store.sent.forEach((s) => s.end());
    await until(() => news(el));
    expect(news(el)).toBe('2 files uploaded');
    expect([...el.querySelectorAll('.fd-file-note > *')].map(words)).toEqual(['a.pdf: already added', 'Up to 2 files: 1 not added']);
    expect((el.querySelector('.fd-file-pick') as HTMLElement).hidden).toBe(true);
  });

  it('checks a photo’s size once it is made smaller: one still too large is refused, saying why', async () => {
    const store = handStore();
    const { el } = setup({ type: 'image', multiple: true, maxSize: 5 * 1048576 }, { upload: store.upload });
    const phone = jpeg('IMG_2041.jpg');
    Object.defineProperty(phone, 'size', { value: 12 * 1048576 });
    choose(el, phone);
    // Not refused as it is picked: it may be small enough once smaller. jsdom cannot draw it smaller, so it stays too large.
    expect(words(el.querySelector('.fd-file-note'))).toBe('');
    await until(() => going(el)[0]?.dataset['status'] === 'refused');
    expect(store.sent).toEqual([]);
    expect(words(going(el)[0].querySelector('.fd-file-state'))).toBe('IMG_2041.jpg is larger than 5 MB');
  });

  it('hides Cancel and Retry when the form reads only', async () => {
    const store = handStore();
    const { el, form } = setup({ type: 'binary', multiple: true }, { upload: store.upload, readonly: true });
    form.upload('x', [pdf('a.pdf')]);
    await tick();
    expect((going(el)[0].querySelector('.fd-file-cancel') as HTMLElement).hidden).toBe(true);
  });

  it('draws one on its way as a card too, and keeps it there when the view changes', async () => {
    const store = handStore();
    const { el } = setup({ type: 'image', multiple: true }, { upload: store.upload, node: { files: 'cards', filesSwitch: true } });
    choose(el, jpeg('Hall.jpg'));
    await tick();
    expect(going(el)[0].querySelector('.fd-file-picture img')).not.toBeNull();
    (el.querySelector('[data-view="list"]') as HTMLButtonElement).click();
    expect(going(el)).toHaveLength(1);
    expect(going(el)[0].querySelector('.fd-file-picture')).toBeNull();
  });

  it('speaks Arabic', async () => {
    const store = handStore();
    const { el } = setup({ type: 'image', multiple: true }, { upload: store.upload, locale: 'ar' });
    choose(el, jpeg('صالة.jpg'));
    await tick();
    expect(going(el)[0].querySelector('progress')?.getAttribute('aria-label')).toBe('رفع صالة.jpg');
    expect(words(going(el)[0].querySelector('.fd-file-state'))).toBe('جارٍ الرفع…');
  });
});

describe('a file field where the source does not store files', () => {
  it('reads the file into the record, as always, and warns once in the console of a large one', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { el, value } = setup({ type: 'binary', multiple: true });
    choose(el, pdf('small.pdf'));
    await until(() => (value() as FileValue[]).length === 1);
    expect((value() as FileValue[])[0].data).toBeDefined();
    expect(warn).not.toHaveBeenCalled();
    const large = (name: string) => new File([new Uint8Array(INLINE_FILE_WARNING + 1)], name, { type: 'application/pdf' });
    choose(el, large('survey.pdf'));
    await until(() => (value() as FileValue[]).length === 2);
    choose(el, large('plans.pdf'));
    await until(() => (value() as FileValue[]).length === 3);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/survey\.pdf .* goes inside the record as base64, because the data source has no upload\(\)/);
    warn.mockRestore();
  });

  it('shows a stored file whose link holds its bytes from a blob, as a browser shows a PDF', async () => {
    const shown = fileShown(document, { name: 'Plan.pdf', type: 'application/pdf', size: 4, url: 'data:application/pdf;base64,JVBERi0=' });
    expect(await shown?.ready).toBe('blob:1');
    expect(shown?.url).toBe('blob:1');
    expect(shown?.element.getAttribute('src')).toMatch(/^blob:1#/);
  });
});

describe("a picture's address, shown while its file is on its way", () => {
  const shown = (url: string) => {
    const item = document.createElement('li');
    item.append(Object.assign(document.createElement('img'), { src: url }));
    return { item, picture: item.querySelector('img') as HTMLImageElement };
  };

  it('is let go once its picture has loaded or failed, never while it still loads', () => {
    const loads = shown('blob:loads');
    letGoOnceLoaded('blob:loads', loads.item);
    expect(revoked).toEqual([]);
    loads.picture.dispatchEvent(new Event('load'));
    expect(revoked).toEqual(['blob:loads']);
    const fails = shown('blob:fails');
    letGoOnceLoaded('blob:fails', fails.item);
    expect(revoked).toEqual(['blob:loads']);
    fails.picture.dispatchEvent(new Event('error'));
    expect(revoked).toEqual(['blob:loads', 'blob:fails']);
  });

  it('is let go at once where its picture has loaded already, or none shows it (its file icon stood in)', () => {
    const loaded = shown('blob:loaded');
    Object.defineProperty(loaded.picture, 'complete', { value: true });
    letGoOnceLoaded('blob:loaded', loaded.item);
    expect(revoked).toEqual(['blob:loaded']);
    const icon = document.createElement('li');
    icon.append(Object.assign(document.createElement('span'), { className: 'fd-file-icon', textContent: 'JPG' }));
    letGoOnceLoaded('blob:icon', icon);
    expect(revoked).toEqual(['blob:loaded', 'blob:icon']);
  });
});

describe('a picture the browser cannot draw', () => {
  it('shows its file icon on its way, refused, and stored — never the browser’s broken-picture mark', async () => {
    const store = handStore();
    const { el, form } = setup({ type: 'image', multiple: true, maxSize: 5 * 1024 * 1024 }, { upload: store.upload, node: { files: 'cards' } });
    choose(el, jpeg('broken.jpg'));
    await tick();
    const card = going(el)[0];
    const picture = card.querySelector('img.fd-file-thumb') as HTMLImageElement;
    expect(picture).not.toBeNull();
    // The browser could not read its bytes as a picture.
    picture.dispatchEvent(new Event('error'));
    expect(card.querySelector('img')).toBeNull();
    expect(card.querySelector('.fd-file-icon')?.getAttribute('data-ext')).toBe('JPG');
    store.sent[0].end();
    await until(() => !going(el).length);
    // Stored, it shows from its link: that cannot be drawn either.
    const stored = el.querySelector('.fd-file-item:not(.fd-file-going) img.fd-file-thumb') as HTMLImageElement;
    stored.dispatchEvent(new Event('error'));
    expect(el.querySelector('.fd-file-item:not(.fd-file-going) img')).toBeNull();
    expect(el.querySelector('.fd-file-item:not(.fd-file-going) .fd-file-icon')?.getAttribute('data-ext')).toBe('JPG');
    void form;
  });
});
