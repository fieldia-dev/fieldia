import {
  createForm,
  createMemoryDataSource,
  MESSAGES,
  saveRefused,
  type DataSource,
  type DraftStore,
  type FileValue,
  type Line,
  type Page,
  type SaveRequest,
  type UploadedFile,
  type UploadFile,
  type UploadRequest,
  unsavedWork,
} from '../../index';

/**
 * Files stored as they are picked: where the data source has `upload`, a file
 * or picture field sends each file to the app's store at once, and the record
 * keeps only its link. The form shows each on its way (`uploads`), three at a
 * time, in the order picked; Cancel stops one, Retry sends a failed one again,
 * and a save waits for those still going — and stops, under the field, for
 * one that did not get there. A file still held as its bytes is stored by the
 * save, and a draft never keeps a file's bytes.
 */

const listing = (more: Partial<Page> = {}): Page =>
  ({
    fieldia: '0.1',
    id: 'listing',
    data: { kind: 'record', model: 'listing' },
    fields: {
      name: { type: 'char', label: 'Name' },
      photos: { type: 'image', label: 'Photos', multiple: true, maxFiles: 20 },
      plan: { type: 'binary', label: 'Floor plan' },
      signature: { type: 'binary', label: 'Signature' },
      rooms: { type: 'one2many', label: 'Rooms', relation: 'listing.room', fields: { name: { type: 'char', label: 'Room' }, photo: { type: 'image', label: 'Photo' } } },
    },
    layout: {
      type: 'sections',
      id: 'root',
      children: ['name', 'photos', 'plan', 'signature', 'rooms'].map((field) => ({ type: 'field', id: `f-${field}`, field })),
    },
    ...more,
  }) as Page;

const photo = (name: string, size = 6): File => new File([new Uint8Array(size).fill(7)], name, { type: 'image/jpeg' });
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A store the test answers by hand: each upload waits until told to end, well or badly. */
function handStore() {
  const sent: { file: UploadFile; request: UploadRequest; end(stored?: Partial<UploadedFile>): void; fail(error: unknown): void; aborted(): boolean }[] = [];
  let ids = 0;
  const upload = (file: UploadFile, request: UploadRequest) =>
    new Promise<UploadedFile>((resolve, reject) => {
      request.signal?.addEventListener('abort', () => reject(Object.assign(new Error('stopped'), { name: 'AbortError' })));
      sent.push({
        file,
        request,
        end: (stored = {}) => resolve({ url: `https://files.example/${file.name}`, name: file.name, size: file.size, type: file.type, fileId: ++ids, ...stored }),
        fail: reject,
        aborted: () => request.signal?.aborted === true,
      });
    });
  return { sent, upload };
}

function setup(options: { upload?: DataSource['upload']; recordId?: number; page?: Page; drafts?: { store: DraftStore; delayMs?: number }; confirm?: (message: string) => boolean } = {}) {
  const ds = createMemoryDataSource({ records: { listing: { 1: { name: 'Nile view flat', photos: [], plan: null, signature: null, rooms: [] } } } });
  const saves: SaveRequest[] = [];
  const save = ds.save.bind(ds);
  const source: DataSource = {
    ...ds,
    save: (request) => (saves.push(request), save(request)),
    upload: options.upload,
  };
  const form = createForm({ page: options.page ?? listing(), dataSource: source, recordId: options.recordId ?? null, ...(options.drafts ? { drafts: options.drafts } : {}), ...(options.confirm ? { confirm: options.confirm } : {}) });
  return { form, ds, saves, state: () => form.getState(), photos: () => (form.getState().values['photos'] as FileValue[] | null) ?? [] };
}

describe('a file picked is stored at once, where the source stores files', () => {
  it('stores files only where the source can: canUpload says which', () => {
    expect(setup().form.canUpload()).toBe(false);
    expect(setup({ upload: handStore().upload }).form.canUpload()).toBe(true);
    expect(() => setup().form.upload('photos', [photo('a.jpg')])).toThrow(/upload/);
  });

  it('sends each file as it is picked and keeps exactly the link it gives, never its bytes', async () => {
    const store = handStore();
    const { form, state, photos } = setup({ upload: store.upload });
    const [id] = form.upload('photos', [photo('Living room.jpg')]);
    await tick();
    expect(store.sent).toHaveLength(1);
    expect(store.sent[0].request).toMatchObject({ model: 'listing', field: 'photos', recordId: null });
    expect(state().uploads).toEqual([{ id, field: 'photos', name: 'Living room.jpg', size: 6, type: 'image/jpeg', status: 'uploading', sent: 0, total: null }]);
    // The bar moves with the store's word on it.
    store.sent[0].request.onProgress?.(3, 6);
    expect(state().uploads[0]).toMatchObject({ sent: 3, total: 6 });
    store.sent[0].end();
    await form.settled();
    expect(state().uploads).toEqual([]);
    expect(photos()).toEqual([{ url: 'https://files.example/Living room.jpg', name: 'Living room.jpg', size: 6, type: 'image/jpeg', fileId: 1 }]);
    expect(state().dirty).toEqual(['photos']);
  });

  it('sends three at once, the rest waiting their turn, and keeps them in the order picked', async () => {
    const store = handStore();
    const { form, state, photos } = setup({ upload: store.upload });
    form.upload('photos', ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg'].map((name) => photo(name)));
    await tick();
    expect(store.sent.map((s) => s.file.name)).toEqual(['1.jpg', '2.jpg', '3.jpg']);
    expect(state().uploads.map((u) => u.status)).toEqual(['uploading', 'uploading', 'uploading', 'waiting', 'waiting']);
    // The third is in first, then the first: each takes its place as picked.
    store.sent[2].end();
    await tick();
    expect(store.sent.map((s) => s.file.name)).toEqual(['1.jpg', '2.jpg', '3.jpg', '4.jpg']);
    store.sent[0].end();
    store.sent[3].end();
    await tick();
    store.sent[1].end();
    store.sent[4].end();
    await form.settled();
    expect(photos().map((p) => p.name)).toEqual(['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg']);
  });

  it('puts the newly picked after the files the field held, and one file in place of the one before', async () => {
    const store = handStore();
    const { form, photos, state } = setup({ upload: store.upload, recordId: 1 });
    await form.load();
    form.setValue('photos', [{ name: 'old.jpg', type: 'image/jpeg', size: 3, url: 'https://files.example/old.jpg' }]);
    form.upload('photos', [photo('new.jpg')]);
    form.upload('plan', [photo('plan-1.pdf')]);
    await tick();
    expect(store.sent[1].request).toMatchObject({ field: 'plan', recordId: 1 });
    store.sent.forEach((s) => s.end());
    await form.settled();
    expect(photos().map((p) => p.name)).toEqual(['old.jpg', 'new.jpg']);
    // A field of one file: a second picked while the first is on its way takes its place, the first stopped.
    form.upload('plan', [photo('plan-2.pdf')]);
    form.upload('plan', [photo('plan-3.pdf')]);
    await tick();
    expect(store.sent[2].aborted()).toBe(true);
    expect(state().uploads.map((u) => u.name)).toEqual(['plan-3.pdf']);
    store.sent[3].end();
    await form.settled();
    expect((state().values['plan'] as FileValue).name).toBe('plan-3.pdf');
    // Several dropped on it at once: the last.
    form.upload('plan', [photo('plan-4.pdf'), photo('plan-5.pdf')]);
    await tick();
    expect(store.sent.slice(4).map((s) => s.file.name)).toEqual(['plan-5.pdf']);
  });

  it('stops one when cancelled: its file is dropped, with no failure', async () => {
    const store = handStore();
    const { form, state, photos } = setup({ upload: store.upload });
    const [first, second] = form.upload('photos', [photo('a.jpg'), photo('b.jpg')]);
    await tick();
    form.cancelUpload(first);
    expect(store.sent[0].aborted()).toBe(true);
    expect(state().uploads.map((u) => u.id)).toEqual([second]);
    store.sent[1].end();
    await form.settled();
    expect(state().uploads).toEqual([]);
    expect(photos().map((p) => p.name)).toEqual(['b.jpg']);
  });

  it('keeps a file that failed, with why, until it is sent again or taken away', async () => {
    const store = handStore();
    const { form, state, photos } = setup({ upload: store.upload });
    const [id] = form.upload('photos', [photo('balcony.jpg')]);
    await tick();
    store.sent[0].fail(new TypeError('Failed to fetch'));
    await form.settled();
    expect(state().uploads).toEqual([expect.objectContaining({ id, status: 'failed', error: 'Failed to fetch' })]);
    expect(photos()).toEqual([]);
    form.retryUpload(id);
    await tick();
    expect(state().uploads).toEqual([expect.objectContaining({ id, status: 'uploading' })]);
    expect(store.sent).toHaveLength(2);
    store.sent[1].end();
    await form.settled();
    expect(photos().map((p) => p.name)).toEqual(['balcony.jpg']);
  });

  it('marks a file the store refuses as refused, with the store’s words: trying again cannot help', async () => {
    const store = handStore();
    const { form, state } = setup({ upload: store.upload });
    const [id] = form.upload('photos', [photo('scan.tiff')]);
    await tick();
    store.sent[0].fail(saveRefused({ kind: 'rule', message: 'The store takes JPEG and PNG pictures only' }));
    await form.settled();
    expect(state().uploads).toEqual([expect.objectContaining({ id, status: 'refused', error: 'The store takes JPEG and PNG pictures only' })]);
    form.retryUpload(id);
    expect(store.sent).toHaveLength(1);
    form.cancelUpload(id);
    expect(state().uploads).toEqual([]);
  });

  it('makes each file ready first, one at a time, and sends one it cannot make ready as it is', async () => {
    const store = handStore();
    const { form, state } = setup({ upload: store.upload });
    const making: string[] = [];
    let finish: (() => void)[] = [];
    const prepare = (file: UploadFile) =>
      new Promise<UploadFile>((resolve, reject) => {
        making.push(file.name);
        finish.push(() => (file.name === 'b.heic' ? reject(new Error('cannot read it')) : resolve(new File([new Uint8Array(2)], file.name.replace('.png', '.jpg'), { type: 'image/jpeg' }))));
      });
    form.upload('photos', [photo('a.png'), photo('b.heic')], { prepare });
    await tick();
    expect(making).toEqual(['a.png']);
    expect(state().uploads.map((u) => u.status)).toEqual(['preparing', 'waiting']);
    finish[0]();
    await tick();
    expect(making).toEqual(['a.png', 'b.heic']);
    // Made smaller and named for what it now is.
    expect(store.sent[0].file).toMatchObject({ name: 'a.jpg', size: 2, type: 'image/jpeg' });
    expect(state().uploads[0]).toMatchObject({ name: 'a.jpg', size: 2, status: 'uploading' });
    finish[1]();
    await tick();
    expect(store.sent[1].file).toMatchObject({ name: 'b.heic', size: 6 });
    finish = [];
  });

  it('refuses a file its field refuses once made ready — still too large — saying why, and sends none of it', async () => {
    const store = handStore();
    const { form, state } = setup({ upload: store.upload });
    form.upload('photos', [photo('huge.png')], { prepare: async () => Promise.reject(saveRefused({ kind: 'rule', message: 'Photos is larger than 5 MB' })) });
    await form.settled();
    expect(store.sent).toEqual([]);
    expect(state().uploads).toEqual([expect.objectContaining({ name: 'huge.png', status: 'refused', error: 'Photos is larger than 5 MB' })]);
  });

  it('takes files for a field on a table’s line, the line named in the request', async () => {
    const store = handStore();
    const { form } = setup({ upload: store.upload });
    const key = form.addLine('rooms', { name: 'Kitchen' });
    form.upload('photo', [photo('kitchen.jpg')], { line: { field: 'rooms', key } });
    await tick();
    expect(store.sent[0].request).toMatchObject({ field: 'photo', line: { field: 'rooms', key } });
    store.sent[0].end();
    await form.settled();
    const line = (form.getState().values['rooms'] as Line[])[0];
    expect(line.values['photo']).toEqual(expect.objectContaining({ url: 'https://files.example/kitchen.jpg' }));
  });

  it('gives a field its own files on their way, never a line’s of the same name', async () => {
    const store = handStore();
    const { form } = setup({ upload: store.upload, page: listing({ fields: { ...listing().fields, photo: { type: 'image', label: 'Cover' } } }) });
    const key = form.addLine('rooms', { name: 'Kitchen' });
    form.upload('photo', [photo('kitchen.jpg')], { line: { field: 'rooms', key } });
    form.upload('photo', [photo('cover.jpg')]);
    await tick();
    expect(form.uploading('photo').map((upload) => upload.name)).toEqual(['cover.jpg']);
    expect(form.uploading('photos')).toEqual([]);
  });

  it('stops every upload when the changes are discarded; another record opened waits for the file on its way, then asks, through the one check', async () => {
    const store = handStore();
    const asked: string[] = [];
    const { form, state } = setup({ upload: store.upload, recordId: 1, confirm: (message) => (asked.push(message), true) });
    await form.load();
    form.upload('photos', [photo('a.jpg'), photo('b.jpg')]);
    await tick();
    form.reset();
    expect(store.sent.every((s) => s.aborted())).toBe(true);
    expect(state().uploads).toEqual([]);
    form.upload('photos', [photo('c.jpg')]);
    await tick();
    const going = form.openRecord(null);
    await tick();
    // It waits for the file on its way, saying so; landed, the file is the person's work no save sent: asked.
    expect(state().leaving).toBe(true);
    expect(asked).toEqual([]);
    store.sent[2].end();
    expect(await going).toBe(true);
    expect(asked).toEqual(['Discard your changes?']);
    expect(state()).toMatchObject({ recordId: null, uploads: [], unsent: [], leaving: false });
  });
});

describe('a save waits for the files on their way, and stops for one that did not get there', () => {
  it('waits for every file still going, then saves their links', async () => {
    const store = handStore();
    const { form, state, saves } = setup({ upload: store.upload });
    form.setValue('name', 'Garden flat');
    form.upload('photos', [photo('a.jpg'), photo('b.jpg')]);
    await tick();
    const saved = form.save();
    await tick();
    // Saving, and saying what it waits for: the files still going.
    expect(state().status).toBe('saving');
    expect(state().uploads.filter((u) => u.status === 'uploading')).toHaveLength(2);
    expect(saves).toHaveLength(0);
    store.sent[0].end();
    await tick();
    expect(saves).toHaveLength(0);
    store.sent[1].end();
    expect(await saved).toBe(true);
    expect(saves).toHaveLength(1);
    expect(saves[0].changes.values['photos']).toEqual([expect.objectContaining({ name: 'a.jpg', url: 'https://files.example/a.jpg', fileId: 1 }), expect.objectContaining({ name: 'b.jpg', fileId: 2 })]);
    expect(JSON.stringify(saves[0])).not.toContain('"data"');
  });

  it('a file cancelled while the save waits lets it go on without it', async () => {
    const store = handStore();
    const { form, saves } = setup({ upload: store.upload });
    form.setValue('name', 'Garden flat');
    const [id] = form.upload('photos', [photo('a.jpg')]);
    await tick();
    const saved = form.save();
    await tick();
    form.cancelUpload(id);
    expect(await saved).toBe(true);
    expect(saves[0].changes.values['photos']).toBeUndefined();
  });

  it('refuses to save while a file failed, under its field, in the form’s language', async () => {
    const store = handStore();
    const { form, state, saves } = setup({ upload: store.upload });
    form.setValue('name', 'Garden flat');
    form.upload('photos', [photo('balcony.jpg')]);
    await tick();
    store.sent[0].fail(new Error('503'));
    await form.settled();
    expect(await form.save()).toBe(false);
    expect(saves).toHaveLength(0);
    expect(state().errors).toEqual({ photos: 'balcony.jpg was not uploaded: try again, or remove it' });
    expect(state().saveProblem).toMatchObject({ kind: 'fields', fields: { photos: 'balcony.jpg was not uploaded: try again, or remove it' } });
    // Two that failed are counted, and a refusal is said with the store's words.
    form.upload('photos', [photo('a.jpg'), photo('b.jpg')]);
    form.upload('plan', [photo('plan.exe')]);
    await tick();
    store.sent[1].fail(new Error('503'));
    store.sent[2].fail(new Error('503'));
    store.sent[3].fail(saveRefused({ kind: 'rule', message: 'not a kind of file the store keeps' }));
    await form.settled();
    expect(await form.save()).toBe(false);
    expect(state().errors).toEqual({ photos: '3 files were not uploaded: try again, or remove them', plan: 'plan.exe was not taken: not a kind of file the store keeps' });
  });

  it('keeps a failed file said under its field while other things change, until it is sent again', async () => {
    const store = handStore();
    const { form, state } = setup({ upload: store.upload });
    form.setValue('name', 'Garden flat');
    form.upload('photos', [photo('balcony.jpg')]);
    await tick();
    store.sent[0].fail(new Error('503'));
    await form.settled();
    expect(await form.save()).toBe(false);
    // Another change — a person's, or an onchange's answer — leaves it said.
    form.setValue('name', 'Garden flat, Zamalek');
    expect(state().errors).toEqual({ photos: 'balcony.jpg was not uploaded: try again, or remove it' });
    // Sent again: no longer a problem, so no longer said.
    form.retryUpload(state().uploads[0].id);
    expect(state().errors).toEqual({});
  });

  it('says a failed file with the form’s own problems, all at once', async () => {
    const store = handStore();
    const page = listing();
    (page.fields['name'] as { required?: boolean }).required = true;
    const { form, state } = setup({ upload: store.upload, page });
    form.upload('photos', [photo('balcony.jpg')]);
    await tick();
    store.sent[0].fail(new Error('503'));
    await form.settled();
    expect(await form.save()).toBe(false);
    expect(Object.keys(state().errors).sort()).toEqual(['name', 'photos']);
  });

  it('says it in Arabic, French and German too', () => {
    for (const locale of ['ar', 'fr', 'de'] as const) {
      for (const key of ['notUploaded', 'notUploadedMany', 'fileRefused'] as const) {
        expect(MESSAGES[locale][key]).not.toBe(MESSAGES.en[key]);
        expect(MESSAGES[locale][key]).toMatch(key === 'notUploadedMany' ? /\{n\}/ : /\{name\}/);
      }
    }
  });

  it('stores a file still held as its bytes before saving — a signature drawn, a value the app set — its other words kept', async () => {
    const store = handStore();
    const { form, saves, state } = setup({ upload: store.upload, recordId: 1 });
    await form.load();
    form.setValue('signature', { name: 'signature.png', type: 'image/png', size: 3, data: 'AQID', text: 'Mona Adel' });
    const key = form.addLine('rooms', { name: 'Hall', photo: { name: 'hall.png', type: 'image/png', size: 3, data: 'AQID' } });
    const saved = form.save();
    await tick();
    expect(store.sent.map((s) => [s.file.name, s.file.size, s.request.field, s.request.line ?? null])).toEqual([
      ['signature.png', 3, 'signature', null],
      ['hall.png', 3, 'photo', { field: 'rooms', key }],
    ]);
    expect([...new Uint8Array(await store.sent[0].file.arrayBuffer())]).toEqual([1, 2, 3]);
    store.sent.forEach((s) => s.end());
    expect(await saved).toBe(true);
    expect(saves[0].changes.values['signature']).toEqual({ url: 'https://files.example/signature.png', name: 'signature.png', size: 3, type: 'image/png', fileId: 1, text: 'Mona Adel' });
    const created = saves[0].changes.lines['rooms'][0] as unknown as { values: { photo: FileValue } };
    expect(created.values.photo).toMatchObject({ url: 'https://files.example/hall.png', fileId: 2 });
    expect(created.values.photo.data).toBeUndefined();
    expect(state().values['signature']).toMatchObject({ url: 'https://files.example/signature.png' });
  });

  it('leaves a stored record’s files as they are when they did not change', async () => {
    const store = handStore();
    const ds = createMemoryDataSource({ records: { listing: { 1: { name: 'Old flat', plan: { name: 'plan.pdf', type: 'application/pdf', size: 3, data: 'AQID' } } } } });
    const form = createForm({ page: listing(), dataSource: { ...ds, upload: store.upload }, recordId: 1 });
    await form.load();
    form.setValue('name', 'Older flat');
    expect(await form.save()).toBe(true);
    expect(store.sent).toEqual([]);
  });

  it('carries the files of a page of responses under the page’s id, for a source to keep with the response', async () => {
    const store = handStore();
    const survey = listing({ id: 'move-in', data: { kind: 'responses' } });
    const ds = createMemoryDataSource();
    const form = createForm({ page: survey, dataSource: { ...ds, upload: store.upload } });
    form.upload('photos', [photo('meter.jpg')]);
    await tick();
    expect(store.sent[0].request).toMatchObject({ model: 'move-in', field: 'photos', recordId: null });
    store.sent[0].end();
    expect(await form.save()).toBe(true);
    expect(ds.responses[0].values['photos']).toEqual([expect.objectContaining({ url: 'https://files.example/meter.jpg' })]);
  });

  it('without upload, saves as it always has: the bytes inside the record', async () => {
    const { form, saves } = setup();
    form.setValue('plan', { name: 'plan.pdf', type: 'application/pdf', size: 3, data: 'AQID' });
    expect(await form.save()).toBe(true);
    expect(saves[0].changes.values['plan']).toEqual({ name: 'plan.pdf', type: 'application/pdf', size: 3, data: 'AQID' });
  });
});

describe('a draft never keeps a file’s bytes where files are stored apart', () => {
  const store = () => {
    const items = new Map<string, string>();
    return { items, getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v), removeItem: (k: string) => void items.delete(k) };
  };

  it('leaves out a field holding a file as its bytes, keeps one holding links, and a line’s file the same', async () => {
    const kept = store();
    const { form } = setup({ upload: handStore().upload, drafts: { store: kept, delayMs: 0 } });
    form.setValue('name', 'Garden flat');
    form.setValue('plan', { name: 'plan.pdf', type: 'application/pdf', size: 3, data: 'AQID' });
    form.setValue('photos', [{ name: 'a.jpg', type: 'image/jpeg', size: 3, url: 'https://files.example/a.jpg' }]);
    form.addLine('rooms', { name: 'Hall', photo: { name: 'hall.png', type: 'image/png', size: 3, data: 'AQID' } });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const draft = JSON.parse([...kept.items.values()][0]);
    expect(draft.values['name']).toBe('Garden flat');
    expect('plan' in draft.values).toBe(false);
    expect(draft.values['photos']).toEqual([{ name: 'a.jpg', type: 'image/jpeg', size: 3, url: 'https://files.example/a.jpg' }]);
    expect(draft.values['rooms'][0].values).toEqual({ name: 'Hall' });
    expect(JSON.stringify(draft)).not.toContain('AQID');
  });

  it('without upload, keeps every file as it always has: restored, the file and the signature are back', async () => {
    const kept = store();
    const { form, state } = setup({ drafts: { store: kept, delayMs: 0 } });
    form.setValue('name', 'Garden flat');
    form.setValue('plan', { name: 'plan.pdf', type: 'application/pdf', size: 3, data: 'AQID' });
    form.setValue('signature', { name: 'signature.png', type: 'image/png', size: 3, data: 'AQID' });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const draft = JSON.parse([...kept.items.values()][0]);
    expect(draft.values['plan']).toEqual({ name: 'plan.pdf', type: 'application/pdf', size: 3, data: 'AQID' });
    // Another visit: the draft brings both back.
    const again = createForm({ page: listing(), dataSource: createMemoryDataSource(), drafts: { store: kept, restore: 'auto' } });
    expect(again.getState().values['plan']).toMatchObject({ data: 'AQID' });
    expect(again.getState().values['signature']).toMatchObject({ data: 'AQID' });
    void state;
  });

  it('goes on when the browser’s store is full', async () => {
    const full = { getItem: () => null, setItem: () => { throw Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' }); }, removeItem: () => undefined };
    const { form, state } = setup({ drafts: { store: full, delayMs: 0 } });
    form.setValue('name', 'Garden flat');
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(state().values['name']).toBe('Garden flat');
  });
});

describe('the memory source as a store that is slow, or fails', () => {
  const file = (size: number, name = 'room.jpg') => new File([new Uint8Array(size)], name, { type: 'image/jpeg' });

  it('paces an upload at bytesPerSecond, telling its progress as it goes', async () => {
    const ds = createMemoryDataSource({ storage: { bytesPerSecond: 1000 } });
    const seen: number[] = [];
    const started = Date.now();
    await ds.upload(file(300), { model: 'listing', field: 'photos', recordId: null, onProgress: (sent) => seen.push(sent) });
    expect(Date.now() - started).toBeGreaterThanOrEqual(250);
    expect(seen.length).toBeGreaterThanOrEqual(3);
    expect(seen[seen.length - 1]).toBe(300);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });

  it('fails the tries it is told to — Retry mends one, words refuse it as the store would', async () => {
    const tries: number[] = [];
    const ds = createMemoryDataSource({
      storage: { fails: (f, attempt) => (tries.push(attempt), f.name === 'balcony.jpg' ? attempt === 1 : f.name === 'scan.tiff' ? 'The store takes JPEG and PNG only' : false) },
    });
    const request = { model: 'listing', field: 'photos', recordId: null };
    await expect(ds.upload(file(5, 'balcony.jpg'), request)).rejects.toThrow(/store/i);
    await expect(ds.upload(file(5, 'balcony.jpg'), request)).resolves.toMatchObject({ name: 'balcony.jpg', fileId: 1 });
    await expect(ds.upload(file(5, 'scan.tiff'), request)).rejects.toMatchObject({ problem: { kind: 'rule', message: 'The store takes JPEG and PNG only' } });
    expect(tries).toEqual([1, 2, 1]);
  });
});

describe('a change made while a save is on its way is never taken as saved', () => {
  /** A listing whose saves wait until the test lets each go, as a slow network does. */
  async function slowSaves(upload = handStore().upload) {
    const ds = createMemoryDataSource({ records: { listing: { 1: { name: 'Nile view flat', photos: [], plan: null, signature: null, rooms: [] } } } });
    const gates: (() => void)[] = [];
    const sent: SaveRequest[] = [];
    const source: DataSource = {
      ...ds,
      upload,
      save: async (request) => {
        sent.push(request);
        await new Promise<void>((go) => gates.push(go));
        return ds.save(request);
      },
    };
    const form = createForm({ page: listing(), dataSource: source, recordId: 1 });
    await form.load();
    return { ds, form, gates, sent, state: () => form.getState() };
  }

  it('a file picked while it saves, and stored before it returns, stays a change — shown, unsaved, and saved next', async () => {
    const store = handStore();
    const { ds, form, gates, sent, state } = await slowSaves(store.upload);
    form.setValue('name', 'Garden flat');
    const saved = form.save();
    await tick();
    expect(gates).toHaveLength(1);
    // Picked while the save is on its way; stored before it returns.
    form.upload('plan', [photo('plan.jpg')]);
    await tick();
    store.sent[0].end();
    await tick();
    expect(state().values['plan']).toMatchObject({ url: 'https://files.example/plan.jpg' });
    gates[0]();
    expect(await saved).toBe(true);
    expect(ds.records['listing'][1]).toMatchObject({ name: 'Garden flat', plan: null });
    expect(sent[0].changes.values).toEqual({ name: 'Garden flat' });
    // The field still shows it, and it is a change still to save — never "saved" unsent.
    expect(state().values['plan']).toMatchObject({ url: 'https://files.example/plan.jpg' });
    expect(state().dirty).toEqual(['plan']);
    expect(unsavedWork(state())).toBe(true);
    const again = form.save();
    await tick();
    gates[1]();
    expect(await again).toBe(true);
    expect(ds.records['listing'][1]['plan']).toMatchObject({ url: 'https://files.example/plan.jpg', fileId: 1 });
    expect(state().dirty).toEqual([]);
  });

  it('words typed while it saves stay typed, and unsaved', async () => {
    const { ds, form, gates, state } = await slowSaves();
    form.setValue('name', 'Garden flat');
    const saved = form.save();
    await tick();
    form.setValue('name', 'Garden flat, Zamalek');
    gates[0]();
    expect(await saved).toBe(true);
    expect(ds.records['listing'][1]['name']).toBe('Garden flat');
    expect(state().values['name']).toBe('Garden flat, Zamalek');
    expect(state().dirty).toEqual(['name']);
  });

  it('a line added before it and changed while it saves keeps the id the save gave it: the next save changes it, never makes it twice', async () => {
    const { ds, form, gates, sent, state } = await slowSaves();
    const key = form.addLine('rooms', { name: 'Hall' });
    const saved = form.save();
    await tick();
    form.updateLine('rooms', key, 'name', 'Entrance hall');
    gates[0]();
    expect(await saved).toBe(true);
    const lines = state().values['rooms'] as Line[];
    expect(lines).toEqual([expect.objectContaining({ key, id: expect.anything(), values: expect.objectContaining({ name: 'Entrance hall' }) })]);
    expect(state().dirty).toEqual(['rooms']);
    const again = form.save();
    await tick();
    gates[1]();
    expect(await again).toBe(true);
    expect(sent[1].changes.lines['rooms']).toEqual([{ op: 'update', id: lines[0].id, values: { name: 'Entrance hall' } }]);
    expect((ds.records['listing'][1]['rooms'] as Line[]).map((line) => line.values['name'])).toEqual(['Entrance hall']);
  });
});

describe('Retry that stores a failed file takes the save’s problem with it', () => {
  it('the form no longer says the record was not saved for that file: status, error and problem are clear', async () => {
    const store = handStore();
    const { form, state } = setup({ upload: store.upload, recordId: 1 });
    await form.load();
    form.setValue('name', 'Garden flat');
    form.upload('photos', [photo('phone-a.jpg')]);
    await tick();
    store.sent[0].fail(new Error('500'));
    await form.settled();
    expect(await form.save()).toBe(false);
    expect(state()).toMatchObject({ status: 'error', error: 'phone-a.jpg was not uploaded: try again, or remove it' });
    form.retryUpload(state().uploads[0].id);
    await tick();
    store.sent[1].end();
    await form.settled();
    expect(state()).toMatchObject({ status: 'ready', error: null, saveProblem: null, errors: {} });
    // Still a change to save.
    expect(state().dirty).toEqual(['name', 'photos']);
  });

  it('removing the failed file does the same; a second one still failing keeps the save stopped', async () => {
    const store = handStore();
    const { form, state } = setup({ upload: store.upload, recordId: 1 });
    await form.load();
    form.upload('photos', [photo('a.jpg'), photo('b.jpg')]);
    await tick();
    store.sent[0].fail(new Error('500'));
    store.sent[1].fail(new Error('500'));
    await form.settled();
    expect(await form.save()).toBe(false);
    form.cancelUpload(state().uploads[0].id);
    expect(state().status).toBe('error');
    form.cancelUpload(state().uploads[0].id);
    expect(state()).toMatchObject({ status: 'ready', error: null, saveProblem: null });
  });
});

describe('a saved form placed in a record keeps to the same rules for files', () => {
  const consent: Page = {
    fieldia: '0.1',
    id: 'consent',
    title: 'Owner’s consent',
    data: { kind: 'responses' },
    fields: {
      owner: { type: 'char', label: 'Owner' },
      sig: { type: 'binary', label: 'Signature' },
      deed: { type: 'binary', label: 'Deed' },
      rooms: { type: 'one2many', label: 'Rooms', relation: 'room', fields: { name: { type: 'char', label: 'Room' }, photo: { type: 'image', label: 'Photo' } } },
    },
    layout: { type: 'sections', id: 'root', children: ['owner', 'sig', 'deed', 'rooms'].map((field) => ({ type: 'field', id: `c-${field}`, field })) },
  } as Page;
  const handover: Page = {
    fieldia: '0.1',
    id: 'handover',
    data: { kind: 'record', model: 'listing' },
    fields: { name: { type: 'char', label: 'Name' } },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'form', id: 'p-consent', page: 'consent', name: 'consent', title: 'Owner’s consent' }] },
  } as Page;

  async function placed(upload?: DataSource['upload'], drafts?: { store: DraftStore; delayMs?: number }) {
    const ds = createMemoryDataSource({ records: { listing: { 1: { name: 'Nile view flat' } } } });
    const saves: SaveRequest[] = [];
    const save = ds.save.bind(ds);
    const form = createForm({ page: handover, dataSource: { ...ds, save: (request) => (saves.push(request), save(request)), upload }, recordId: 1, ...(drafts ? { drafts } : {}) });
    const inner = form.embed('p-consent', consent);
    await form.load();
    return { ds, form, inner, saves };
  }

  it('a signature drawn in it goes to the store before the save, for the record, and only its link is saved', async () => {
    const store = handStore();
    const { form, inner, saves } = await placed(store.upload);
    inner.setValue('sig', { name: 'signature.png', type: 'image/png', size: 3, data: 'AQID' });
    const key = inner.addLine('rooms', { name: 'Hall', photo: { name: 'hall.png', type: 'image/png', size: 3, data: 'AQID' } });
    const saved = form.save();
    await tick();
    // For the record it is in — its model and id — the field where it sits in it.
    expect(store.sent.map((s) => s.request)).toEqual([
      expect.objectContaining({ model: 'listing', recordId: 1, field: 'consent.sig' }),
      expect.objectContaining({ model: 'listing', recordId: 1, field: 'photo', line: { field: 'consent.rooms', key } }),
    ]);
    store.sent.forEach((s) => s.end());
    expect(await saved).toBe(true);
    expect(saves[0].changes.values['consent']).toMatchObject({ sig: { url: 'https://files.example/signature.png', fileId: 1 } });
    expect(JSON.stringify(saves[0])).not.toContain('AQID');
    expect(form.getState().dirty).toEqual([]);
  });

  it('a file picked in it is stored for the record; the save waits for it, and stops under its field when it fails', async () => {
    const store = handStore();
    const { ds, form, inner, saves } = await placed(store.upload);
    const [id] = inner.upload('deed', [photo('deed.jpg')]);
    await tick();
    expect(store.sent[0].request).toMatchObject({ model: 'listing', recordId: 1, field: 'consent.deed' });
    // The record's form shows it on its way, under the part's name, and leaving would lose it.
    expect(form.getState().uploads).toEqual([expect.objectContaining({ id: `consent/${id}`, field: 'consent.deed', status: 'uploading' })]);
    expect(unsavedWork(form.getState())).toBe(true);
    form.setValue('name', 'Garden flat');
    const saved = form.save();
    await tick();
    expect(form.getState().status).toBe('saving');
    expect(saves).toHaveLength(0);
    store.sent[0].fail(new Error('503'));
    expect(await saved).toBe(false);
    expect(saves).toHaveLength(0);
    expect(form.getState().errors).toEqual({ 'consent.deed': 'deed.jpg was not uploaded: try again, or remove it' });
    expect(inner.getState().errors).toEqual({ deed: 'deed.jpg was not uploaded: try again, or remove it' });
    // Retry, from the record's form: stored, the problem gone with it, and the save goes.
    form.retryUpload(form.getState().uploads[0].id);
    await tick();
    store.sent[1].end();
    await form.settled();
    expect(form.getState()).toMatchObject({ status: 'ready', saveProblem: null, errors: {} });
    expect(inner.getState().errors).toEqual({});
    expect(await form.save()).toBe(true);
    expect(ds.records['listing'][1]['consent']).toMatchObject({ deed: { url: 'https://files.example/deed.jpg', fileId: 1 } });
  });

  it('a save waits for a file still going in it, and saves its link', async () => {
    const store = handStore();
    const { ds, form, inner } = await placed(store.upload);
    inner.upload('deed', [photo('deed.jpg')]);
    await tick();
    const saved = form.save();
    await tick();
    store.sent[0].end();
    expect(await saved).toBe(true);
    expect(ds.records['listing'][1]['consent']).toMatchObject({ deed: { url: 'https://files.example/deed.jpg' } });
    expect(form.getState().dirty).toEqual([]);
  });

  it('a draft keeps none of its file bytes, and restored, leaves that file as the record holds it', async () => {
    const items = new Map<string, string>();
    const kept: DraftStore = { getItem: (k) => items.get(k) ?? null, setItem: (k, v) => void items.set(k, v), removeItem: (k) => void items.delete(k) };
    const { inner } = await placed(handStore().upload, { store: kept, delayMs: 0 });
    inner.setValue('owner', 'Sara Adel');
    inner.setValue('sig', { name: 'signature.png', type: 'image/png', size: 3, data: 'AQID' });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const draft = JSON.parse([...items.values()][0]);
    expect(draft.values['consent']['owner']).toBe('Sara Adel');
    expect('sig' in draft.values['consent']).toBe(false);
    expect(JSON.stringify(draft)).not.toContain('AQID');
  });

  it('without upload, as always: its bytes are saved inside the record, and a draft keeps them', async () => {
    const items = new Map<string, string>();
    const kept: DraftStore = { getItem: (k) => items.get(k) ?? null, setItem: (k, v) => void items.set(k, v), removeItem: (k) => void items.delete(k) };
    const { form, inner, saves } = await placed(undefined, { store: kept, delayMs: 0 });
    inner.setValue('sig', { name: 'signature.png', type: 'image/png', size: 3, data: 'AQID' });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(JSON.parse([...items.values()][0]).values['consent']['sig']).toMatchObject({ data: 'AQID' });
    expect(await form.save()).toBe(true);
    expect(saves[0].changes.values['consent']).toMatchObject({ sig: { data: 'AQID' } });
  });
});
