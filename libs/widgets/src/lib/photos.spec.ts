import { createForm, createMemoryDataSource, type DataSource, type Field, type FieldNode, type FileValue, type Page, type UploadedFile, type UploadFile, type UploadRequest } from '@fieldia/core';
import { createWidget } from './widgets';
import { WIDGET_LABELS } from './labels';
import { fitted, moved, sized, turnedCrop, turnedSize } from './photo-editor';

/**
 * A photo set, as a person meets it: the photos as tiles, the first the cover; moved by keys, by the cover's button,
 * by a drag of the pointer and by a finger resting on one; a caption typed under each; one removed, asked first; more
 * picked up to the most; and one cropped and turned in its dialog, its original kept beside the new picture — stored at
 * once where the source stores files, a caption typed meanwhile kept.
 */

const made: string[] = [];
beforeAll(() => {
  Object.assign(URL, { createObjectURL: () => (made.push(`blob:${made.length + 1}`), made[made.length - 1]), revokeObjectURL: () => undefined });
});

const photo = (name: string, more: Partial<FileValue> = {}): FileValue => ({ name, type: 'image/jpeg', size: 5, url: `https://files.example/${name}`, ...more });
const ROOMS = ['Living room.jpg', 'Kitchen.jpg', 'Hall.jpg'];

function setup(options: { readonly?: boolean; node?: Record<string, unknown>; dir?: string; locale?: 'en' | 'ar'; value?: FileValue[]; field?: Record<string, unknown>; source?: DataSource } = {}) {
  const page = {
    fieldia: '0.9',
    id: 'listing',
    data: { kind: 'record', model: 'listing' },
    fields: { photos: { type: 'image', label: 'Photos', multiple: true, maxFiles: 6, ...options.field } as Field },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-photos', field: 'photos', widget: 'photos', options: { captions: true, ...options.node } }] },
  } as Page;
  const form = createForm({ page, ...(options.source ? { dataSource: options.source } : {}), values: { photos: options.value ?? ROOMS.map((name) => photo(name)) } });
  const node = (page.layout as { children: FieldNode[] }).children[0];
  const locale = options.locale ?? 'en';
  const widget = createWidget({ form, name: 'photos', field: page.fields['photos'], node, id: 'fd-photos', document, labels: WIDGET_LABELS[locale], locale });
  const root = document.createElement('div');
  root.className = 'fd-form';
  if (options.dir) root.setAttribute('dir', options.dir);
  root.append(widget.element);
  document.body.replaceChildren(root);
  const refresh = () => widget.update({ value: form.getState().values['photos'], values: form.getState().values, readonly: options.readonly ?? false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  return { form, el: widget.element, widget, value: () => (form.getState().values['photos'] as FileValue[] | null) ?? [] };
}

const tiles = (el: Element) => [...el.querySelectorAll<HTMLElement>('.fd-photo')];
const opens = (el: Element) => tiles(el).map((tile) => tile.querySelector('.fd-photo-open') as HTMLButtonElement);
const labels = (el: Element) => opens(el).map((open) => open.getAttribute('aria-label'));
const said = (el: Element) => el.querySelector('.fd-announce')?.textContent;
const key = (target: Element, name: string, extra: KeyboardEventInit = {}) => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...extra }));
const tool = (tile: Element, which: string) => tile.querySelector(`[data-tool="${which}"]`) as HTMLButtonElement;
async function until(check: () => unknown) {
  for (let waited = 0; !check() && waited < 2000; waited += 10) await new Promise((resolve) => setTimeout(resolve, 10));
}

/**
 * Where each tile is laid out, as a browser lays three to a row out: by its CSS order where a drag has given it one,
 * else by its place among the photos — 100 pixels a tile, 90 wide and high.
 */
function layOut(el: Element) {
  const all = () => tiles(el);
  for (const tile of all()) {
    tile.getBoundingClientRect = () => {
      const order = all()
        .map((one, i) => ({ one, i, by: one.style.order === '' ? i : Number(one.style.order) }))
        .sort((a, b) => a.by - b.by || a.i - b.i)
        .findIndex(({ one }) => one === tile);
      const [left, top] = [(order % 3) * 100, Math.floor(order / 3) * 100];
      return { left, top, right: left + 90, bottom: top + 90, width: 90, height: 90, x: left, y: top, toJSON: () => undefined } as DOMRect;
    };
  }
}
const pointer = (type: string, x: number, y: number, more: Record<string, unknown> = {}) => Object.assign(new Event(type, { bubbles: true, cancelable: true }), { clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', button: 0, isPrimary: true, ...more });
const touch = (type: string, x: number, y: number) => {
  const one = { identifier: 7, clientX: x, clientY: y };
  return Object.assign(new Event(type, { bubbles: true, cancelable: true }), { touches: type === 'touchend' ? [] : [one], changedTouches: [one] });
};

describe('a photo set', () => {
  it('shows the photos as tiles in their order, the first the cover, how many of the most, and how to move one', () => {
    const { el } = setup();
    expect(labels(el)).toEqual(['Living room.jpg, the cover, photo 1 of 3', 'Kitchen.jpg, photo 2 of 3', 'Hall.jpg, photo 3 of 3']);
    expect(tiles(el).map((tile) => !(tile.querySelector('.fd-photo-cover') as HTMLElement).hidden)).toEqual([true, false, false]);
    expect(el.querySelector('.fd-photos-count')?.textContent).toBe('3 of 6 photos');
    expect(el.querySelector('.fd-photos-how-keys')?.textContent).toBe('Drag a photo to move it, or press Alt and an arrow key. The first is the cover.');
    // Where the screen is touched, the sheet shows a finger's way instead.
    expect(el.querySelector('.fd-photos-how-touch')?.textContent).toBe('Hold a photo a moment, then drag it to move it. The first is the cover.');
    expect(opens(el)[1].getAttribute('aria-describedby')).toBe('fd-photos-how');
    expect(el.querySelector('.fd-file-limits')?.textContent).toBe('up to 6 photos');
    // The cover needs no Make cover; the rest have it, with Crop and turn and Remove, each named by its photo.
    expect(tool(tiles(el)[0], 'cover').hidden).toBe(true);
    expect([tool(tiles(el)[1], 'cover'), tool(tiles(el)[1], 'edit'), tool(tiles(el)[1], 'remove')].map((b) => b.getAttribute('aria-label'))).toEqual(['Make Kitchen.jpg the cover', 'Crop and turn Kitchen.jpg', 'Remove Kitchen.jpg']);
    expect(tiles(el)[0].querySelector('img')?.getAttribute('src')).toBe('https://files.example/Living room.jpg');
  });

  it('marks no cover where the page says so, and keeps to the page’s shape', () => {
    const { el } = setup({ node: { cover: false, aspect: '1:1' } });
    expect(labels(el)[0]).toBe('Living room.jpg, photo 1 of 3');
    expect(el.querySelector('.fd-photo-cover:not([hidden])')).toBeNull();
    expect(tiles(el)[1].querySelector('[data-tool="cover"]')).toBeNull();
    expect(el.querySelector('.fd-photos-how-keys')?.textContent).toBe('Drag a photo to move it, or press Alt and an arrow key.');
    expect(el.querySelector('.fd-photos-how-touch')?.textContent).toBe('Hold a photo a moment, then drag it to move it.');
    expect((el as HTMLElement).style.getPropertyValue('--fd-photo-shape')).toBe('1');
  });

  it('moves a photo with Alt and the arrows, Home and End, each move said, the focus kept with it', () => {
    const { el, value } = setup();
    opens(el)[0].focus();
    key(opens(el)[0], 'ArrowRight', { altKey: true });
    expect(value().map((p) => p.name)).toEqual(['Kitchen.jpg', 'Living room.jpg', 'Hall.jpg']);
    expect(said(el)).toBe('Living room.jpg moved to place 2 of 3');
    expect(document.activeElement).toBe(opens(el)[1]);
    key(opens(el)[1], 'End', { altKey: true });
    expect(value().map((p) => p.name)).toEqual(['Kitchen.jpg', 'Hall.jpg', 'Living room.jpg']);
    key(opens(el)[1], 'Home', { altKey: true });
    expect(value().map((p) => p.name)).toEqual(['Hall.jpg', 'Kitchen.jpg', 'Living room.jpg']);
    expect(said(el)).toBe('Hall.jpg is the cover now');
    expect(labels(el)[0]).toBe('Hall.jpg, the cover, photo 1 of 3');
    // An arrow alone moves nothing; nor does Alt past an end.
    key(opens(el)[0], 'ArrowRight');
    key(opens(el)[0], 'ArrowUp', { altKey: true });
    expect(value().map((p) => p.name)).toEqual(['Hall.jpg', 'Kitchen.jpg', 'Living room.jpg']);
  });

  it('mirrors the arrows right to left, and says the moves in the page’s language', () => {
    const { el, value } = setup({ dir: 'rtl', locale: 'ar' });
    key(opens(el)[0], 'ArrowLeft', { altKey: true });
    expect(value().map((p) => p.name)).toEqual(['Kitchen.jpg', 'Living room.jpg', 'Hall.jpg']);
    expect(said(el)).toBe('أصبح Living room.jpg في المرتبة 2 من 3');
    key(opens(el)[1], 'ArrowRight', { altKey: true });
    expect(said(el)).toBe('أصبحت Living room.jpg الغلاف');
  });

  it('makes a photo the cover with its button, the focus on it at its new place', () => {
    const { el, value } = setup();
    tool(tiles(el)[2], 'cover').click();
    expect(value().map((p) => p.name)).toEqual(['Hall.jpg', 'Living room.jpg', 'Kitchen.jpg']);
    expect(said(el)).toBe('Hall.jpg is the cover now');
    expect(document.activeElement).toBe(opens(el)[0]);
    expect(tool(tiles(el)[0], 'cover').hidden).toBe(true);
  });

  it('moves a photo dragged by the pointer as the others make room, and puts it back on Escape', () => {
    const { el, value } = setup();
    layOut(el);
    const hall = opens(el)[2];
    hall.dispatchEvent(pointer('pointerdown', 245, 45));
    // A press that moves less than a few pixels lifts nothing: a click.
    document.dispatchEvent(pointer('pointermove', 247, 46));
    expect(tiles(el)[2].hasAttribute('data-lifted')).toBe(false);
    document.dispatchEvent(pointer('pointermove', 20, 45));
    expect(tiles(el)[2].hasAttribute('data-lifted')).toBe(true);
    expect(el.hasAttribute('data-moving')).toBe(true);
    // Over the first tile's start: before it — laid out first while dragged, the cover's mark on it, nothing kept yet.
    expect(tiles(el).map((tile) => tile.style.order)).toEqual(['-2', '-1', '-3']);
    expect(tiles(el).map((tile) => !(tile.querySelector('.fd-photo-cover') as HTMLElement).hidden)).toEqual([false, false, true]);
    expect(value().map((p) => p.name)).toEqual(ROOMS);
    document.dispatchEvent(pointer('pointerup', 20, 45));
    expect(value().map((p) => p.name)).toEqual(['Hall.jpg', 'Living room.jpg', 'Kitchen.jpg']);
    expect(said(el)).toBe('Hall.jpg is the cover now');
    expect(tiles(el).every((tile) => tile.style.order === '' && !tile.hasAttribute('data-lifted'))).toBe(true);
    // The click the drag ends with opens nothing.
    opens(el)[0].click();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    // Escape while dragged: as it was.
    layOut(el);
    opens(el)[0].dispatchEvent(pointer('pointerdown', 45, 45));
    document.dispatchEvent(pointer('pointermove', 160, 45));
    expect(tiles(el)[0].style.order).toBe('-2');
    key(document.body, 'Escape');
    expect(tiles(el).every((tile) => tile.style.order === '')).toBe(true);
    expect(tiles(el).map((tile) => !(tile.querySelector('.fd-photo-cover') as HTMLElement).hidden)).toEqual([true, false, false]);
    document.dispatchEvent(pointer('pointerup', 160, 45));
    expect(value().map((p) => p.name)).toEqual(['Hall.jpg', 'Living room.jpg', 'Kitchen.jpg']);
  });

  it('lifts a photo a finger rests on, moves it as the finger does, and lets a swipe scroll', () => {
    jest.useFakeTimers();
    try {
      const { el, value } = setup();
      layOut(el);
      // A swipe: the finger wanders before it has rested, and nothing is lifted.
      opens(el)[0].dispatchEvent(touch('touchstart', 45, 45));
      opens(el)[0].dispatchEvent(touch('touchmove', 45, 80));
      jest.advanceTimersByTime(600);
      expect(tiles(el)[0].hasAttribute('data-lifted')).toBe(false);
      opens(el)[0].dispatchEvent(touch('touchend', 45, 80));
      // Resting half a second lifts it; carried past the last tile's middle, it goes last.
      opens(el)[0].dispatchEvent(touch('touchstart', 45, 45));
      jest.advanceTimersByTime(500);
      expect(tiles(el)[0].hasAttribute('data-lifted')).toBe(true);
      const move = touch('touchmove', 280, 45);
      opens(el)[0].dispatchEvent(move);
      expect(move.defaultPrevented).toBe(true);
      const end = touch('touchend', 280, 45);
      opens(el)[0].dispatchEvent(end);
      expect(end.defaultPrevented).toBe(true);
      expect(value().map((p) => p.name)).toEqual(['Kitchen.jpg', 'Hall.jpg', 'Living room.jpg']);
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps a caption typed under a photo once it is read, trimmed; an empty one takes it away', () => {
    const { el, value } = setup();
    const box = tiles(el)[1].querySelector('.fd-photo-caption') as HTMLInputElement;
    expect(box.getAttribute('aria-label')).toBe('Caption for Kitchen.jpg');
    expect(box.placeholder).toBe('Add a caption');
    box.value = '  The kitchen, newly fitted ';
    box.dispatchEvent(new Event('change', { bubbles: true }));
    expect(value()[1]).toEqual({ ...photo('Kitchen.jpg'), caption: 'The kitchen, newly fitted' });
    // The photo is named by its caption now.
    expect(labels(el)[1]).toBe('The kitchen, newly fitted, photo 2 of 3');
    // A box being typed in is never written over by a change elsewhere.
    box.focus();
    box.value = 'The kit';
    key(opens(el)[0], 'ArrowRight', { altKey: true });
    expect((tiles(el)[0].querySelector('.fd-photo-caption') as HTMLInputElement).value).toBe('The kit');
    box.value = '';
    box.dispatchEvent(new Event('change', { bubbles: true }));
    expect(value()[0]).toEqual(photo('Kitchen.jpg'));
  });

  it('asks before removing a photo, says it was removed, and moves the focus on', () => {
    const { el, value } = setup();
    tool(tiles(el)[1], 'remove').click();
    const question = el.querySelector('.fd-file-confirm') as HTMLElement;
    expect(question.hidden).toBe(false);
    expect(question.textContent).toContain('Remove Kitchen.jpg?');
    expect(document.activeElement?.textContent).toBe('Keep');
    (question.querySelectorAll('button')[0] as HTMLButtonElement).click();
    expect(value().map((p) => p.name)).toEqual(['Living room.jpg', 'Hall.jpg']);
    expect(el.querySelector('.fd-file-note')?.textContent).toBe('Kitchen.jpg removed');
    expect(document.activeElement).toBe(tool(tiles(el)[1], 'remove'));
  });

  it('adds photos picked after the rest, up to the most, saying why the rest were not', async () => {
    const { el, value } = setup();
    const input = el.querySelector('input[type=file]') as HTMLInputElement;
    expect(input.multiple).toBe(true);
    expect(input.accept).toBe('image/*');
    const picked = ['Roof.jpg', 'Study.jpg', 'Kitchen.jpg', 'Bath.jpg', 'Balcony.jpg'].map((name) => new File(['abc'], name, { type: 'image/jpeg' }));
    Object.defineProperty(input, 'files', { value: picked, configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await until(() => value().length === 6);
    expect(value().map((p) => p.name)).toEqual([...ROOMS, 'Roof.jpg', 'Study.jpg', 'Bath.jpg']);
    expect(el.querySelector('.fd-file-note')?.textContent).toBe('Kitchen.jpg: already addedUp to 6 files: 1 not added');
    // Full: no tile to add more.
    expect((el.querySelector('.fd-photos-add') as HTMLElement).hidden).toBe(true);
    expect(el.querySelector('.fd-photos-count')?.textContent).toBe('6 of 6 photos');
  });

  it('read only: the photos and their captions alone, each still opened to look at', () => {
    const { el } = setup({ readonly: true, value: [photo('Living room.jpg', { caption: 'Light all day' }), photo('Kitchen.jpg')] });
    expect(el.querySelector('.fd-photo-tool:not([hidden])')).toBeNull();
    expect(el.querySelector('.fd-photo-caption:not([hidden])')).toBeNull();
    expect([...el.querySelectorAll('.fd-photo-words')].map((p) => p.textContent)).toEqual(['Light all day', '']);
    expect((el.querySelector('.fd-photos-add') as HTMLElement).hidden).toBe(true);
    expect((el.querySelector('.fd-photos-how') as HTMLElement).hidden).toBe(true);
    opens(el)[0].click();
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.querySelector('h2')?.textContent).toBe('Light all day');
    expect(dialog.textContent).toContain('Living room.jpg · 5 bytes');
    key(dialog, 'Escape');
  });
});

describe('a photo cropped and turned', () => {
  /** A canvas as a browser's: a context that notes what was drawn, and a picture made of its size. */
  const drawn: string[] = [];
  beforeAll(() => {
    const context = new Proxy({}, { get: (_target, name) => (...args: unknown[]) => void drawn.push(`${String(name)}(${args.filter((a) => typeof a === 'number').map((a) => Math.round(a as number)).join(',')})`), set: () => true });
    HTMLCanvasElement.prototype.getContext = (() => context) as unknown as HTMLCanvasElement['getContext'];
    HTMLCanvasElement.prototype.toBlob = function (this: HTMLCanvasElement, done: BlobCallback, type?: string) {
      done(new Blob([`${this.width}x${this.height}`], { type: type ?? 'image/png' }));
    };
    Object.assign(window, { createImageBitmap: async () => ({ width: 400, height: 300, close: () => undefined }) });
  });
  beforeEach(() => (drawn.length = 0));
  const editor = () => document.querySelector('.fd-photo-editor') as HTMLElement;
  const button = (words: string) => [...editor().querySelectorAll('button')].find((b) => b.textContent === words) as HTMLButtonElement;
  const crop = () => {
    const box = editor().querySelector('.fd-photo-crop') as HTMLElement;
    return [box.style.left, box.style.top, box.style.width, box.style.height].map((v) => Math.round(parseFloat(v)));
  };
  const bytes = (photo: FileValue) => Buffer.from(photo.data ?? '', 'base64').toString();

  it('crops a photo to the page’s shape, turned, its original and what was done kept beside it, its caption kept', async () => {
    const { el, value } = setup({ node: { aspect: '1:1' }, value: [photo('Living room.jpg'), { ...photo('Kitchen.jpg'), data: 'aGVsbG8=', url: undefined, caption: 'Newly fitted' }] });
    tool(tiles(el)[1], 'edit').click();
    expect(editor().getAttribute('aria-labelledby')).toBe('fd-photos-edit');
    expect(editor().querySelector('h2')?.textContent).toBe('Crop and turn Newly fitted');
    await until(() => !(editor().querySelector('.fd-photo-picture') as HTMLElement).hidden);
    // The page's shape: a square in the middle of the 400 × 300 photo; no shapes to pick.
    expect(crop()).toEqual([13, 0, 75, 100]);
    expect((editor().querySelector('.fd-photo-shapes') as HTMLElement).hidden).toBe(true);
    expect(document.activeElement).toBe(editor().querySelector('.fd-photo-crop'));
    // Moved to the left edge with the keys; turned right, the square fits the turned photo again.
    key(editor().querySelector('.fd-photo-crop') as HTMLElement, 'ArrowLeft');
    expect(crop()[0]).toBe(12);
    button('Turn right').click();
    expect(crop()).toEqual([0, 13, 100, 75]);
    drawn.length = 0;
    button('Apply').click();
    await until(() => value()[1].edit);
    // A 300 × 300 part of the photo turned a quarter, drawn at the photo's own pixels.
    expect(drawn).toEqual(['translate(0,-50)', 'translate(300,0)', 'rotate(2)', 'drawImage(0,0,400,300)']);
    expect(value()[1]).toEqual({
      name: 'Kitchen.jpg',
      type: 'image/jpeg',
      size: 7,
      data: expect.any(String),
      original: { name: 'Kitchen.jpg', type: 'image/jpeg', size: 5, data: 'aGVsbG8=' },
      edit: { turn: 90, crop: { x: 0, y: 0.125, width: 1, height: 0.75 } },
      caption: 'Newly fitted',
    });
    expect(bytes(value()[1])).toBe('300x300');
    expect(editor()).toBeNull();
    expect(document.activeElement).toBe(tool(tiles(el)[1], 'edit'));
    expect(said(el)).toBe('Newly fitted changed: its original is kept');
  });

  it('crops again from the original, as it was cropped last; puts the original back; keeps none where the page says so', async () => {
    const original = photo('Hall.jpg');
    const edited: FileValue = { ...photo('Hall.jpg', { url: 'https://files.example/Hall-2.jpg' }), original, edit: { turn: 0, crop: { x: 0.1, y: 0.2, width: 0.5, height: 0.5 } }, caption: 'The hall' };
    const fetched: string[] = [];
    Object.assign(globalThis, { fetch: async (url: string) => (fetched.push(url), { ok: true, blob: async () => new Blob(['pixels'], { type: 'image/jpeg' }) }) });
    const { el, value } = setup({ value: [photo('Living room.jpg'), edited] });
    tool(tiles(el)[1], 'edit').click();
    await until(() => !(editor().querySelector('.fd-photo-picture') as HTMLElement).hidden);
    expect(fetched).toEqual(['https://files.example/Hall.jpg']);
    expect(crop()).toEqual([10, 20, 50, 50]);
    // Any shape picked by the person; the shapes say which is in force.
    expect(editor().querySelector('.fd-photo-shapes [aria-pressed="true"]')?.textContent).toBe('Any');
    button('16:9').click();
    expect(crop()).toEqual([0, 13, 100, 75]);
    button('Put back the original').click();
    await until(() => !value()[1].original);
    expect(value()[1]).toEqual({ ...original, caption: 'The hall' });
    expect(said(el)).toBe('The original of The hall is back');
    // A photo with no original has no Put back.
    tool(tiles(el)[1], 'edit').click();
    expect(button('Put back the original').hidden).toBe(true);
    button('Cancel').click();
    expect(editor()).toBeNull();
    expect(value()[1]).toEqual({ ...original, caption: 'The hall' });

    const plain = setup({ node: { keepOriginal: false }, value: [photo('Living room.jpg'), edited] });
    tool(tiles(plain.el)[1], 'edit').click();
    await until(() => !(editor().querySelector('.fd-photo-picture') as HTMLElement).hidden);
    button('Apply').click();
    await until(() => plain.value()[1].data);
    expect(plain.value()[1]).toEqual({ name: 'Hall.jpg', type: 'image/jpeg', size: 7, data: expect.any(String), caption: 'The hall' });
    expect(said(plain.el)).toBe('The hall changed');
  });

  it('says a photo the page cannot read, with nothing to apply', async () => {
    Object.assign(globalThis, { fetch: async () => Promise.reject(new TypeError('Failed to fetch')) });
    const { el } = setup();
    tool(tiles(el)[0], 'edit').click();
    await until(() => editor().querySelector('.fd-photo-stage p')?.textContent !== 'Reading the photo…');
    expect(editor().querySelector('.fd-photo-stage p')?.textContent).toBe('This photo cannot be cropped here: the page is not allowed to read it.');
    expect(button('Apply').hidden).toBe(true);
    key(editor(), 'Escape');
    expect(editor()).toBeNull();
  });

  it('stores a photo cropped at once where the source stores files: its bar on its tile, its link in place once stored, a caption typed meanwhile kept', async () => {
    const sent: { file: UploadFile; request: UploadRequest; end(): void }[] = [];
    const upload = (file: UploadFile, request: UploadRequest) => new Promise<UploadedFile>((resolve) => sent.push({ file, request, end: () => resolve({ url: 'https://files.example/Kitchen-cropped.jpg', name: file.name, size: file.size, type: file.type, fileId: 41 }) }));
    Object.assign(globalThis, { fetch: async () => ({ ok: true, blob: async () => new Blob(['pixels'], { type: 'image/jpeg' }) }) });
    const { el, value, form } = setup({ source: { ...createMemoryDataSource(), upload } });
    tool(tiles(el)[1], 'edit').click();
    await until(() => !(editor().querySelector('.fd-photo-picture') as HTMLElement).hidden);
    button('Apply').click();
    await until(() => sent.length);
    expect(sent[0].request).toMatchObject({ model: 'listing', field: 'photos' });
    const going = tiles(el)[1].querySelector('.fd-photo-going') as HTMLElement;
    expect(going.hidden).toBe(false);
    expect(going.querySelector('progress')?.getAttribute('aria-label')).toBe('Uploading Kitchen.jpg');
    // No tile of its own: it is the kitchen's photo, on its way.
    expect(el.querySelector('.fd-file-going')).toBeNull();
    const box = tiles(el)[1].querySelector('.fd-photo-caption') as HTMLInputElement;
    box.value = 'Newly fitted';
    box.dispatchEvent(new Event('change', { bubbles: true }));
    sent[0].end();
    await form.settled();
    // Never drawn as a photo picked, nor counted as one uploaded: it is the kitchen's.
    expect(el.querySelector('.fd-file-going')).toBeNull();
    expect(el.querySelector('.fd-file-news')?.textContent).toBe('');
    expect(value()[1]).toEqual({ url: 'https://files.example/Kitchen-cropped.jpg', name: 'Kitchen.jpg', size: 7, type: 'image/jpeg', fileId: 41, original: photo('Kitchen.jpg'), edit: { turn: 0, crop: { x: 0, y: 0, width: 1, height: 1 } }, caption: 'Newly fitted' });
    expect(going.hidden).toBe(true);
  });
});

describe('the part of a photo kept, in fractions of the photo turned', () => {
  const size = { width: 400, height: 300 };
  it('fits a shape in the middle, all of it for none', () => {
    expect(fitted(size, null)).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    expect(fitted(size, 1)).toEqual({ x: 0.125, y: 0, width: 0.75, height: 1 });
    expect(fitted(size, 16 / 9)).toEqual({ x: 0, y: 0.125, width: 1, height: 0.75 });
    expect(turnedSize(size, 90)).toEqual({ width: 300, height: 400 });
    expect(turnedSize(size, 180)).toBe(size);
  });
  it('turns with the photo, a quarter on and back', () => {
    const crop = { x: 0.1, y: 0.2, width: 0.5, height: 0.3 };
    expect(turnedCrop(crop, 90)).toEqual({ x: 0.5, y: 0.1, width: 0.3, height: 0.5 });
    const back = turnedCrop(turnedCrop(crop, 90), -90);
    expect([back.x, back.y, back.width, back.height].map((n) => Math.round(n * 1000) / 1000)).toEqual([0.1, 0.2, 0.5, 0.3]);
  });
  it('moves within the photo, never past an edge', () => {
    expect(moved({ x: 0.1, y: 0.1, width: 0.5, height: 0.5 }, -0.3, 0.7)).toEqual({ x: 0, y: 0.5, width: 0.5, height: 0.5 });
  });
  it('sizes by a corner, the opposite one staying, within the photo, never too small, and of a shape where there is one', () => {
    const crop = { x: 0.2, y: 0.2, width: 0.4, height: 0.4 };
    expect(sized(crop, 'se', 0.1, 0.05, null, size)).toEqual({ x: 0.2, y: 0.2, width: 0.5, height: 0.45 });
    expect(sized(crop, 'nw', 0.5, 0.5, null, size)).toEqual({ x: 0.55, y: 0.55, width: 0.05, height: 0.05 });
    expect(sized(crop, 'se', 0.9, 0.9, null, size)).toEqual({ x: 0.2, y: 0.2, width: 0.8, height: 0.8 });
    // A square of a 400 × 300 photo: its height three quarters of its width, as fractions; the side moved more led.
    const square = sized({ x: 0.1, y: 0.1, width: 0.3, height: 0.4 }, 'se', 0.15, 0, 1, size);
    expect([square.x, square.y, square.width, square.height].map((n) => Math.round(n * 1000) / 1000)).toEqual([0.1, 0.1, 0.45, 0.6]);
    const kept = sized({ x: 0.1, y: 0.1, width: 0.3, height: 0.4 }, 'se', 0.9, 0.9, 1, size);
    expect(Math.round(kept.height * 1000) / 1000).toBe(0.9);
    expect(Math.round((kept.width * 400) / (kept.height * 300) * 1000) / 1000).toBe(1);
  });
});
