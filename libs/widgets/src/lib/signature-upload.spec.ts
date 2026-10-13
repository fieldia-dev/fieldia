import { createForm, type DataSource, type Field, type FieldNode, type FileValue, type Page, type UploadedFile, type UploadFile, type UploadRequest } from '@fieldia/core';
import { createWidget } from './widgets';
import { WIDGET_LABELS } from './labels';

/**
 * A signature where the data source stores files: a picture of one uploaded
 * goes to the store as it is picked, shown on its way under the pad, and the
 * field keeps its link; one drawn is stored by the save (the form's), and the
 * pad then shows the stored picture, the name typed kept beside it.
 */

beforeEach(() => {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => new Proxy({}, { get: () => () => undefined, set: () => true }) as never);
  jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(() => 'data:image/png;base64,QUJDRA==');
});
afterEach(() => jest.restoreAllMocks());

function handStore() {
  const sent: { file: UploadFile; request: UploadRequest; end(): void }[] = [];
  const upload = (file: UploadFile, request: UploadRequest) =>
    new Promise<UploadedFile>((resolve) => sent.push({ file, request, end: () => resolve({ url: `https://files.example/${file.name}`, name: file.name, size: file.size, type: file.type }) }));
  return { sent, upload };
}

function setup(upload: DataSource['upload']) {
  const page = {
    fieldia: '0.1',
    id: 'handover',
    data: { kind: 'responses' },
    fields: { x: { type: 'binary', label: 'Signature' } as Field },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'x', widget: 'signature', options: { upload: true } }] },
  } as Page;
  const sent: unknown[] = [];
  const form = createForm({ page, dataSource: { upload, submit: async (request) => (sent.push(request.values), {}) } });
  const widget = createWidget({ form, name: 'x', field: page.fields['x'], node: (page.layout as { children: FieldNode[] }).children[0], id: 'fd-x', document, labels: WIDGET_LABELS.en, locale: 'en' });
  document.body.replaceChildren(widget.element);
  const refresh = () => widget.update({ value: form.getState().values['x'], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  return { form, el: widget.element, sent, value: () => form.getState().values['x'] as FileValue | null };
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('a signature where the source stores files', () => {
  it('sends a picture uploaded to the store, shows it on its way under the pad, and keeps its link', async () => {
    const store = handStore();
    const { el, value } = setup(store.upload);
    const input = el.querySelector('input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [new File([new Uint8Array(8)], 'signed.jpg', { type: 'image/jpeg' })], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();
    expect(store.sent.map((s) => [s.file.name, s.request.field])).toEqual([['signed.jpg', 'x']]);
    const item = el.querySelector('.fd-file-going') as HTMLElement;
    expect(item.querySelector('progress')?.getAttribute('aria-label')).toBe('Uploading signed.jpg');
    // Not read into the record meanwhile: the field waits for the link.
    expect(value()).toBeNull();
    store.sent[0].end();
    await tick();
    await tick();
    expect(value()).toEqual({ url: 'https://files.example/signed.jpg', name: 'signed.jpg', size: 8, type: 'image/jpeg' });
    expect(el.querySelector('.fd-file-going')).toBeNull();
    const shown = el.querySelector('img.fd-signature-image') as HTMLImageElement;
    expect([shown.hidden, shown.getAttribute('src')]).toEqual([false, 'https://files.example/signed.jpg']);
  });

  it('stores a signature typed or drawn when the answers are sent, and shows the stored picture with the name kept', async () => {
    const store = handStore();
    const { el, form, sent } = setup(store.upload);
    const typed = el.querySelector('input.fd-signature-typed') as HTMLInputElement;
    typed.value = 'Mona Adel';
    typed.dispatchEvent(new Event('input', { bubbles: true }));
    const saving = form.save();
    await tick();
    expect(store.sent.map((s) => s.file.name)).toEqual(['signature.png']);
    store.sent[0].end();
    expect(await saving).toBe(true);
    expect(sent[0]).toEqual({ x: { url: 'https://files.example/signature.png', name: 'signature.png', size: 4, type: 'image/png', text: 'Mona Adel' } });
    expect((el.querySelector('img.fd-signature-image') as HTMLImageElement).getAttribute('src')).toBe('https://files.example/signature.png');
  });
});
