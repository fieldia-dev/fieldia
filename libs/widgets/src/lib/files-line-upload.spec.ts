import { createForm, type Field, type FieldNode, type FileValue, type Line, type Page, type UploadedFile, type UploadFile, type UploadRequest } from '@fieldia/core';
import { createWidget } from './widgets';
import { WIDGET_LABELS } from './labels';

/**
 * A picture or file on a table's line, where the source stores files: picked
 * in the line's cell, it goes to the store as that line's — the request names
 * the table and the line — shows on its way in that cell alone, and its link
 * lands in that line. A save waits for it, and one that failed stops the save
 * under its cell.
 */

beforeAll(() => {
  Object.assign(URL, { createObjectURL: () => 'blob:1', revokeObjectURL: () => undefined });
});

/** A store the test answers by hand. */
function handStore() {
  const sent: { file: UploadFile; request: UploadRequest; end(): void; fail(error: unknown): void }[] = [];
  const upload = (file: UploadFile, request: UploadRequest) =>
    new Promise<UploadedFile>((resolve, reject) => {
      request.signal?.addEventListener('abort', () => reject(Object.assign(new Error('stopped'), { name: 'AbortError' })));
      sent.push({ file, request, end: () => resolve({ url: `https://files.example/${file.name}`, name: file.name, size: file.size, type: file.type, fileId: sent.length }), fail: reject });
    });
  return { sent, upload };
}

const page = {
  fieldia: '0.1',
  id: 'listing',
  data: { kind: 'record', model: 'listing' },
  fields: {
    name: { type: 'char', label: 'Name' },
    rooms: {
      type: 'one2many',
      label: 'Rooms',
      relation: 'listing.room',
      fields: {
        title: { type: 'char', label: 'Room' },
        photo: { type: 'image', label: 'Photo' },
      },
    },
  },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-rooms', field: 'rooms' }] },
} as unknown as Page;

function mount() {
  const store = handStore();
  const values = { name: 'Garden flat', rooms: [{ key: 'a', id: 41, values: { title: 'Kitchen', photo: null } }, { key: 'b', values: { title: 'Balcony', photo: null } }] };
  const form = createForm({ page, values: values as never, recordId: 7, dataSource: { upload: store.upload, save: async () => ({ id: 7 }) } });
  const node = (page.layout as { children: FieldNode[] }).children[0];
  const widget = createWidget({ form, name: 'rooms', field: page.fields['rooms'] as Field, node, id: 'fd-rooms', document, labels: WIDGET_LABELS.en });
  document.body.replaceChildren(widget.element);
  const refresh = () => widget.update({ value: form.getState().values['rooms'], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  return { form, store, el: widget.element };
}

const cell = (el: HTMLElement, line: string) => el.querySelector(`tr[data-line="${line}"] td[data-column="photo"]`) as HTMLElement;
const going = (el: Element) => [...el.querySelectorAll<HTMLElement>('.fd-file-going')];
function choose(el: Element, file: File) {
  const input = el.querySelector('input[type=file]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
async function until(check: () => unknown) {
  for (let waited = 0; !check() && waited < 2000; waited += 10) await new Promise((resolve) => setTimeout(resolve, 10));
}
const photo = (form: ReturnType<typeof createForm>, key: string) => ((form.getState().values['rooms'] as Line[]).find((line) => line.key === key)?.values['photo'] ?? null) as FileValue | null;

describe('a picture on a table’s line, where the source stores files', () => {
  it('goes to the store as that line’s, shows on its way in its own cell alone, and lands in that line', async () => {
    const { form, store, el } = mount();
    choose(cell(el, 'a'), new File([new Uint8Array(6)], 'Kitchen.png', { type: 'image/png' }));
    await until(() => store.sent.length);
    expect(store.sent[0].request).toMatchObject({ model: 'listing', field: 'photo', recordId: 7, line: { field: 'rooms', key: 'a', id: 41 } });
    expect(form.getState().uploads).toEqual([expect.objectContaining({ field: 'photo', line: { field: 'rooms', key: 'a' }, name: 'Kitchen.png' })]);
    await until(() => going(cell(el, 'a')).length);
    expect(going(cell(el, 'a'))).toHaveLength(1);
    expect(going(cell(el, 'b'))).toHaveLength(0);
    store.sent[0].end();
    await until(() => photo(form, 'a'));
    expect(photo(form, 'a')).toEqual({ url: 'https://files.example/Kitchen.png', name: 'Kitchen.png', size: 6, type: 'image/png', fileId: 1 });
    expect(photo(form, 'b')).toBeNull();
    await until(() => !going(el).length);
    expect(going(el)).toHaveLength(0);
  });

  it('stops a save for one that failed, under its own cell', async () => {
    const { form, store, el } = mount();
    choose(cell(el, 'b'), new File([new Uint8Array(6)], 'Balcony.png', { type: 'image/png' }));
    await until(() => store.sent.length);
    store.sent[0].fail(new TypeError('Failed to fetch'));
    await until(() => going(cell(el, 'b'))[0]?.dataset['status'] === 'failed');
    expect(cell(el, 'b').querySelector('.fd-file-retry')?.hasAttribute('hidden')).toBe(false);
    await form.save();
    expect(form.getState().errors).toEqual({ 'rooms.b.photo': 'Balcony.png was not uploaded: try again, or remove it' });
  });
});
