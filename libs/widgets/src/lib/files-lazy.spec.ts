import { createForm, type DataSource, type Field, type FieldNode, type FileValue, type Page, type UploadedFile, type UploadFile, type UploadRequest } from '@fieldia/core';
import { FIELDIA_CSS, installPartStyles, installStyles, PART_RANK } from './styles';
import { FILES_CSS } from './styles-files';
import { foreignRules } from './test-kinds';
import { datePart, filesPart, shrinkPhoto } from './widget-parts';
import { createWidget, widgetPart, type Widget, type WidgetFactory } from './widgets';

/**
 * File and picture fields, a signature's pad and a PDF under its file box
 * come in the files part (files-part.ts), loaded the first time a page shows
 * one. Before it has come — a widget made by something that did not wait for
 * it, as the viewer does — each is the names of the files its value holds,
 * read only: nothing it holds is dropped, those on their way neither, and a
 * file is picked once the part's own widget has taken its place, with the
 * last state it was given and the focus if it had it. This file starts with
 * no part loaded (src/test-parts.ts leaves it so), and its tests run in order.
 */

// jsdom has no object URLs, and draws nothing on a canvas: the browser's are stood in for.
beforeAll(() => {
  Object.assign(URL, { createObjectURL: () => 'blob:1', revokeObjectURL: () => undefined });
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
});

const fields: Record<string, Field> = {
  docs: { type: 'binary', label: 'Documents', multiple: true },
  photo: { type: 'image', label: 'Photo' },
  sign: { type: 'binary', label: 'Signed by' },
  manual: { type: 'binary', label: 'Manual', accept: ['application/pdf'] },
  name: { type: 'char', label: 'Name' },
};
const node = (field: string, more: Partial<FieldNode> = {}): FieldNode => ({ type: 'field', id: `f-${field}`, field, ...more });
const page = { fieldia: '0.1', id: 'p', title: 'P', data: { kind: 'record', model: 'job' }, fields, layout: { type: 'sections', id: 's', children: [] } } as unknown as Page;

const SURVEY: FileValue = { name: 'Site survey.txt', type: 'text/plain', size: 5, data: 'aGVsbG8=' };
const PLAN: FileValue = { name: 'Floor plan.pdf', type: 'application/pdf', size: 4, url: 'https://files.example/plan.pdf' };
const FACE: FileValue = { name: 'Face.png', type: 'image/png', size: 3, data: 'iVBO' };
const SIGNED: FileValue = { name: 'signature.png', type: 'image/png', size: 3, data: 'iVBO', text: 'Mona Adel' };

/** A store the test answers by hand: an upload stays on its way until then. */
function handStore() {
  const sent: { file: UploadFile; end(): void }[] = [];
  const upload = (file: UploadFile, request: UploadRequest) =>
    new Promise<UploadedFile>((resolve, reject) => {
      request.signal?.addEventListener('abort', () => reject(Object.assign(new Error('stopped'), { name: 'AbortError' })));
      sent.push({ file, end: () => resolve({ url: `https://files.example/${file.name}`, name: file.name, size: file.size, type: file.type }) });
    });
  return { sent, upload: upload as DataSource['upload'] };
}

afterEach(() => document.body.replaceChildren());

describe('the files part', () => {
  it('is named by a file, a picture, a signature and a PDF field — never a text, nor a file the app draws itself', () => {
    expect(filesPart.loaded).toBeUndefined();
    expect(widgetPart(fields['docs'], node('docs'))).toBe(filesPart);
    expect(widgetPart(fields['photo'], node('photo'))).toBe(filesPart);
    expect(widgetPart(fields['sign'], node('sign', { widget: 'signature' }))).toBe(filesPart);
    expect(widgetPart(fields['manual'], node('manual', { widget: 'pdf' }))).toBe(filesPart);
    expect(widgetPart(fields['name'], node('name'))).toBeUndefined();
    const own: WidgetFactory = () => ({ element: document.createElement('div'), update: () => undefined, focus: () => undefined });
    expect(widgetPart(fields['docs'], node('docs'), { binary: own })).toBeUndefined();
  });

  it('has a sheet of its own, before the pickers’: it restyles nothing the main sheet draws, and the main sheet keeps no file’s rule but asking first', () => {
    document.head.replaceChildren();
    installStyles(document);
    installPartStyles(document, 'picker', '.b{}', PART_RANK.picker);
    installPartStyles(document, 'files', '.a{}', PART_RANK.files);
    expect([...document.head.querySelectorAll('style')].map((style) => style.id)).toEqual(['fieldia-styles', 'files', 'picker', 'fieldia-styles-looks']);
    // Each of its rules names a class of the files' own, which no rule of the main sheet names.
    expect(foreignRules(FILES_CSS, FIELDIA_CSS).filter((selector) => selector.includes('.fd-'))).toEqual([]);
    // A table's line asks first too (askFirst): its row stays.
    expect([...new Set(FIELDIA_CSS.match(/\.fd-(?:files?|signature|image-pick)\b[\w-]*/g))]).toEqual(['.fd-file-confirm']);
    expect(filesPart.loaded).toBeUndefined();
  });
});

describe('a file field made before its part came', () => {
  it('shows the names its value holds, read only and never written, then the part’s own widget with them, those on their way, and the focus', async () => {
    expect(filesPart.loaded).toBeUndefined();
    const store = handStore();
    const form = createForm({ page, dataSource: { upload: store.upload } });
    form.setValue('docs', [SURVEY, PLAN]);
    form.setValue('photo', FACE);
    form.setValue('sign', SIGNED);
    form.setValue('manual', PLAN);
    // A file already on its way to the store, put there by the app before the field could pick one.
    form.upload('docs', [new File(['%PDF'], 'Quote.pdf', { type: 'application/pdf' })]);
    const values = form.getState().values;
    const made: Record<string, Widget> = {};
    const box = document.createElement('div');
    box.className = 'fd-form';
    document.body.append(box);
    for (const [name, shown] of [['docs', node('docs')], ['photo', node('photo')], ['sign', node('sign', { widget: 'signature' })], ['manual', node('manual', { widget: 'pdf' })]] as const) {
      const widget = createWidget({ form, name, field: fields[name], node: shown, id: `w-${name}`, document });
      const slot = document.createElement('div');
      slot.dataset['slot'] = name;
      slot.append(widget.element);
      box.append(slot);
      widget.update({ value: form.getState().values[name], values: form.getState().values, readonly: false, required: false, invalid: false });
      made[name] = widget;
    }
    // Meanwhile each is its files' names, words alone: nothing to pick with, nothing it could drop.
    const plain = (name: string) => made[name].element;
    expect(Object.keys(made).map((name) => [plain(name).tagName, plain(name).dataset['fdPlain'], plain(name).textContent])).toEqual([
      ['OUTPUT', 'files', 'Site survey.txt, Floor plan.pdf'],
      ['OUTPUT', 'files', 'Face.png'],
      ['OUTPUT', 'files', 'signature.png'],
      ['OUTPUT', 'files', 'Floor plan.pdf'],
    ]);
    expect(box.querySelector('input[type=file]')).toBeNull();
    expect(plain('docs').id).toBe('w-docs');
    made['docs'].focus();
    expect(document.activeElement).toBe(plain('docs'));
    // Read only and emptied from outside: it says so, and writes nothing back.
    made['photo'].update({ value: null, values: form.getState().values, readonly: true, required: false, invalid: false });
    expect(plain('photo').textContent).toBe('');
    made['photo'].update({ value: FACE, values: form.getState().values, readonly: false, required: false, invalid: false });
    expect(form.getState().values).toBe(values);
    expect(document.getElementById('fieldia-files-styles')).toBeNull();

    await filesPart.load();
    await Promise.resolve();
    // The part's own widgets in their places, each with the files it was last given, the focus where it was.
    const slot = (name: string) => box.querySelector(`[data-slot="${name}"]`) as HTMLElement;
    for (const name of Object.keys(made)) expect(slot(name).firstElementChild).toBe(made[name].element);
    expect(made['docs'].element.classList.contains('fd-file')).toBe(true);
    expect([...made['docs'].element.querySelectorAll('.fd-file-item:not(.fd-file-going) .fd-file-name')].map((name) => name.getAttribute('title'))).toEqual(['Site survey.txt', 'Floor plan.pdf']);
    expect(made['docs'].element.contains(document.activeElement)).toBe(true);
    // The file on its way, as the form holds it: with its bar, × and its name.
    expect([...made['docs'].element.querySelectorAll('.fd-file-going')].map((item) => item.querySelector('.fd-file-name')?.getAttribute('title'))).toEqual(['Quote.pdf']);
    expect(made['photo'].element.classList.contains('fd-file-image')).toBe(true);
    expect(made['photo'].element.querySelector('img.fd-file-thumb')?.getAttribute('src')).toBe('data:image/png;base64,iVBO');
    expect(made['sign'].element.classList.contains('fd-signature')).toBe(true);
    expect((made['sign'].element.querySelector('.fd-signature-image') as HTMLImageElement).hidden).toBe(false);
    expect((made['sign'].element.querySelector('.fd-signature-typed') as HTMLInputElement).value).toBe('Mona Adel');
    expect(made['manual'].element.querySelector('.fd-file .fd-file-name')?.getAttribute('title')).toBe('Floor plan.pdf');
    expect(made['manual'].element.querySelector('iframe')?.getAttribute('src')).toBe('https://files.example/plan.pdf');
    expect(document.getElementById('fieldia-files-styles')).not.toBeNull();
    // Nothing it held was dropped, nor written again.
    expect(form.getState().values).toBe(values);
    expect(form.uploading('docs').map((upload) => upload.name)).toEqual(['Quote.pdf']);
    // Its upload ends where it began: in the field, as its link.
    store.sent[0].end();
    await form.settled();
    expect((form.getState().values['docs'] as FileValue[]).map((file) => file.name)).toEqual(['Site survey.txt', 'Floor plan.pdf', 'Quote.pdf']);
    // From now on each is the part's own, at once; the date part was never asked for.
    expect(createWidget({ form, name: 'photo', field: fields['photo'], node: node('photo'), id: 'w-again', document }).element.classList.contains('fd-file')).toBe(true);
    expect(datePart.loaded).toBeUndefined();
    for (const widget of Object.values(made)) widget.destroy?.();
  });

  it('makes a photo smaller for an app’s own code, with the part’s code: a GIF is kept as it is', async () => {
    const gif = new File(['GIF89a'], 'moving.gif', { type: 'image/gif' });
    expect(await shrinkPhoto(gif, { maxSide: 10 })).toBe(gif);
    expect(filesPart.loaded?.shrinkPhoto).toBeDefined();
  });
});
