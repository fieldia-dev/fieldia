import { TextDecoder } from 'node:util';
import { createForm, type Field, type FieldNode, type FileValue, type Page } from '@fieldia/core';
import { createWidget } from './widgets';
import { WIDGET_LABELS } from './labels';

/**
 * Several files in one field, and a file opened to look at: the picker and the
 * drop zone take many, each added file joins the list up to the most the field
 * takes, and what is refused is said, by name and why. Files show as a list or
 * as thumbnails; one opens in a dialog that goes through them.
 */

// jsdom has no object URLs and no text decoder: the browser's are stood in for.
const made: string[] = [];
const revoked: string[] = [];
beforeAll(() => {
  Object.assign(URL, {
    createObjectURL: () => {
      made.push(`blob:${made.length + 1}`);
      return made[made.length - 1];
    },
    revokeObjectURL: (url: string) => revoked.push(url),
  });
  Object.assign(globalThis, { TextDecoder });
});
beforeEach(() => {
  made.length = 0;
  revoked.length = 0;
});

function setup(field: Record<string, unknown>, options: { readonly?: boolean; node?: Record<string, unknown>; dir?: string; locale?: 'en' | 'ar' } = {}) {
  const page = {
    fieldia: '0.1',
    id: 't',
    data: { kind: 'responses' },
    fields: { x: { label: 'Documents', ...field } as Field },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'x', ...(options.node ? { options: options.node } : {}) }] },
  } as Page;
  const form = createForm({ page });
  const node = (page.layout as { children: FieldNode[] }).children[0];
  const locale = options.locale ?? 'en';
  const widget = createWidget({ form, name: 'x', field: page.fields['x'], node, id: 'fd-x', document, labels: WIDGET_LABELS[locale], locale });
  const root = document.createElement('div');
  root.className = 'fd-form';
  if (options.dir) root.setAttribute('dir', options.dir);
  root.append(widget.element);
  document.body.replaceChildren(root);
  const refresh = () => widget.update({ value: form.getState().values['x'], values: form.getState().values, readonly: options.readonly ?? false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  return { form, el: widget.element, widget, value: () => form.getState().values['x'] as FileValue[] };
}

/** Waits for the file reader, however busy the machine: until the check holds, or two seconds. */
async function until(check: () => unknown) {
  for (let waited = 0; !check() && waited < 2000; waited += 10) await new Promise((resolve) => setTimeout(resolve, 10));
}
const input = (el: Element) => el.querySelector('input[type=file]') as HTMLInputElement;
function choose(el: Element, ...files: File[]) {
  Object.defineProperty(input(el), 'files', { value: files, configurable: true });
  input(el).dispatchEvent(new Event('change', { bubbles: true }));
}
function drop(el: Element, ...files: File[]) {
  const event = new Event('drop', { bubbles: true, cancelable: true }) as Event & { dataTransfer: unknown };
  event.dataTransfer = { files };
  el.dispatchEvent(event);
}
const pdf = (name: string, size = 5) => new File(['x'.repeat(size)], name, { type: 'application/pdf' });
const stored = (name: string, type: string, data = 'aGVsbG8='): FileValue => ({ name, type, size: 5, data });
/** The words as a person reads them: each part apart. */
function text(el: Element | null | undefined): string {
  if (!el) return '';
  const parts: string[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) parts.push(n.textContent ?? '');
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
const note = (el: Element) => text(el.querySelector('.fd-file-note'));
const names = (el: Element) => [...el.querySelectorAll('.fd-file-item .fd-file-name')].map((n) => n.getAttribute('title'));
const key = (target: Element, name: string, extra: KeyboardEventInit = {}) => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...extra }));
const dialog = () => document.querySelector('[role="dialog"]') as HTMLElement | null;

describe('several files', () => {
  it('takes many at once from the picker, each joining the list, and counts them against the most', async () => {
    const { el, value } = setup({ type: 'binary', multiple: true, maxFiles: 5 });
    expect(input(el).multiple).toBe(true);
    choose(el, pdf('a.pdf'), pdf('b.pdf'));
    await until(() => value().length === 2);
    expect(value().map((f) => f.name)).toEqual(['a.pdf', 'b.pdf']);
    choose(el, pdf('c.pdf'));
    await until(() => value().length === 3);
    expect(names(el)).toEqual(['a.pdf', 'b.pdf', 'c.pdf']);
    expect(text(el.querySelector('.fd-file-count'))).toBe('3 of 5 files');
  });

  it('adds none past the most, and says how many were left out', async () => {
    const { el, value } = setup({ type: 'binary', multiple: true, maxFiles: 3 });
    drop(el, pdf('a.pdf'), pdf('b.pdf'), pdf('c.pdf'), pdf('d.pdf'), pdf('e.pdf'));
    await until(() => value().length);
    expect(value().map((f) => f.name)).toEqual(['a.pdf', 'b.pdf', 'c.pdf']);
    expect(note(el)).toBe('Up to 3 files: 2 not added');
    expect(el.querySelector('.fd-file-note')?.getAttribute('role')).toBe('status');
    // Full, it takes no more: the picker goes.
    expect((el.querySelector('.fd-file-pick') as HTMLElement).hidden).toBe(true);
  });

  it('refuses a file of a kind it does not take, one too large, and one already added, each by name and why', async () => {
    const { el, value } = setup({ type: 'binary', multiple: true, accept: ['application/pdf'], maxSize: 10 * 1048576 });
    choose(el, pdf('a.pdf'));
    await until(() => value().length);
    const big = new File(['x'], 'video.mp4', { type: 'video/mp4' });
    Object.defineProperty(big, 'size', { value: 20 * 1048576 });
    const hugePdf = pdf('scan.pdf');
    Object.defineProperty(hugePdf, 'size', { value: 11 * 1048576 });
    choose(el, new File(['MZ'], 'report.exe', { type: 'application/x-msdownload' }), hugePdf, pdf('a.pdf'), pdf('b.pdf'), big);
    await until(() => value().length === 2);
    expect(value().map((f) => f.name)).toEqual(['a.pdf', 'b.pdf']);
    expect([...el.querySelectorAll('.fd-file-note > *')].map(text)).toEqual([
      'report.exe must be a PDF file',
      'scan.pdf is larger than 10 MB',
      'a.pdf: already added',
      'video.mp4 is larger than 10 MB',
    ]);
  });

  it('says its limits before anyone tries: the kinds, the largest, the most', () => {
    const { el } = setup({ type: 'binary', multiple: true, accept: ['application/pdf', 'image/*'], maxSize: 10 * 1048576, maxFiles: 5 });
    expect(text(el.querySelector('.fd-file-pick'))).toBe('Add files or drop them here');
    expect(text(el.querySelector('.fd-file-limits'))).toBe('PDF or image · up to 10 MB each · up to 5 files');
    expect(text(setup({ type: 'binary', maxSize: 1048576 }).el.querySelector('.fd-file-limits'))).toBe('up to 1 MB');
    expect(text(setup({ type: 'image', multiple: true }).el.querySelector('.fd-file-pick'))).toBe('Add photos or drop them here');
  });

  it('counts without a most, one file and several', async () => {
    const { el, form } = setup({ type: 'binary', multiple: true });
    expect(text(el.querySelector('.fd-file-count'))).toBe('');
    form.setValue('x', [stored('a.txt', 'text/plain')]);
    expect(text(el.querySelector('.fd-file-count'))).toBe('1 file');
    form.setValue('x', [stored('a.txt', 'text/plain'), stored('b.txt', 'text/plain')]);
    expect(text(el.querySelector('.fd-file-count'))).toBe('2 files');
  });

  it('removes a file only once asked, and says so', () => {
    const { el, form, value } = setup({ type: 'binary', multiple: true });
    form.setValue('x', [stored('report.pdf', 'application/pdf'), stored('plan.pdf', 'application/pdf')]);
    const remove = el.querySelector('[aria-label="Remove report.pdf"]') as HTMLButtonElement;
    remove.click();
    const ask = el.querySelector('.fd-file-confirm') as HTMLElement;
    expect(ask.hidden).toBe(false);
    expect(text(ask)).toBe('Remove report.pdf? Remove Keep');
    expect(document.activeElement?.textContent).toBe('Keep');
    // Kept: nothing goes, and the focus is back on its button.
    (document.activeElement as HTMLButtonElement).click();
    expect(ask.hidden).toBe(true);
    expect(value()).toHaveLength(2);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Remove report.pdf');
    // Removed: it goes, it is said, and the focus is on the next file's button.
    (document.activeElement as HTMLButtonElement).click();
    ([...ask.querySelectorAll('button')].find((b) => b.textContent === 'Remove') as HTMLButtonElement).click();
    expect(value().map((f) => f.name)).toEqual(['plan.pdf']);
    expect(note(el)).toBe('report.pdf removed');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Remove plan.pdf');
  });
});

describe('a list, and thumbnails', () => {
  const files = [stored('photo.png', 'image/png'), stored('report.pdf', 'application/pdf'), stored('budget.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), stored('site.zip', 'application/zip'), stored('notes.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), stored('data.bin', 'application/octet-stream')];

  it('lists a file a row: a thumbnail for an image, an icon by kind with its extension for the rest, its name and size', () => {
    const { el, form } = setup({ type: 'binary', multiple: true });
    form.setValue('x', files);
    expect(el.classList.contains('fd-files-list')).toBe(true);
    const rows = [...el.querySelectorAll('.fd-file-item')];
    expect(rows).toHaveLength(6);
    expect((rows[0].querySelector('img') as HTMLImageElement).src).toBe('data:image/png;base64,aGVsbG8=');
    expect(rows.slice(1).map((r) => [r.querySelector('.fd-file-icon')?.getAttribute('data-kind'), text(r.querySelector('.fd-file-icon'))])).toEqual([
      ['pdf', 'PDF'],
      ['sheet', 'XLSX'],
      ['zip', 'ZIP'],
      ['doc', 'DOCX'],
      ['file', 'BIN'],
    ]);
    expect(text(rows[1].querySelector('.fd-file-size'))).toBe('5 bytes');
    // The row opens the file; its button is named by the file.
    const open = rows[1].querySelector('.fd-file-open') as HTMLButtonElement;
    expect(open.getAttribute('aria-haspopup')).toBe('dialog');
    expect(open.getAttribute('aria-label')).toBe('report.pdf, 5 bytes');
  });

  it('cuts a long name in the middle, keeping its end and extension', () => {
    const { el, form } = setup({ type: 'binary', multiple: true });
    form.setValue('x', [stored('Quarterly site inspection report, final.pdf', 'application/pdf')]);
    const name = el.querySelector('.fd-file-name') as HTMLElement;
    expect(name.getAttribute('title')).toBe('Quarterly site inspection report, final.pdf');
    expect(name.getAttribute('dir')).toBe('auto');
    // The start may be cut with an ellipsis; the end never is.
    expect(name.lastChild?.textContent).toBe('final.pdf');
    expect(name.firstElementChild?.textContent).toBe('Quarterly site inspection report, ');
  });

  it('shows an image field as thumbnails, and either field as the page says', () => {
    expect(setup({ type: 'image', multiple: true }).el.classList.contains('fd-files-thumbs')).toBe(true);
    expect(setup({ type: 'binary', multiple: true }, { node: { files: 'thumbnails' } }).el.classList.contains('fd-files-thumbs')).toBe(true);
    expect(setup({ type: 'image' }, { node: { files: 'list' } }).el.classList.contains('fd-files-list')).toBe(true);
  });

  it('offers the camera on a phone, the rear one unless the page says the front', () => {
    expect(input(setup({ type: 'image' }, { node: { camera: true } }).el).getAttribute('capture')).toBe('environment');
    expect(input(setup({ type: 'image', multiple: true }, { node: { camera: 'user' } }).el).getAttribute('capture')).toBe('user');
    expect(input(setup({ type: 'image' }).el).hasAttribute('capture')).toBe(false);
    expect(input(setup({ type: 'image' }).el).accept).toBe('image/*');
  });
});

describe('one file', () => {
  it('shows it as a row it opens from, with Replace, and a new one replaces it', async () => {
    const { el, form } = setup({ type: 'binary' });
    expect(input(el).multiple).toBe(false);
    expect(text(el.querySelector('.fd-file-pick'))).toBe('Upload a file or drop it here');
    choose(el, pdf('contract.pdf'));
    await until(() => form.getState().values['x']);
    expect(form.getState().values['x']).toEqual({ name: 'contract.pdf', type: 'application/pdf', size: 5, data: 'eHh4eHg=' });
    expect(el.querySelectorAll('.fd-file-item')).toHaveLength(1);
    expect(el.querySelector('.fd-file-count')).toBeNull();
    const replace = [...el.querySelectorAll('button')].find((b) => b.textContent === 'Replace') as HTMLButtonElement;
    expect(replace.hidden).toBe(false);
    choose(el, pdf('signed.pdf'));
    await until(() => (form.getState().values['x'] as FileValue).name === 'signed.pdf');
    expect(names(el)).toEqual(['signed.pdf']);
  });
});

describe('read-only', () => {
  it('lists the files to open, with nothing to add, remove or drop', async () => {
    const { el, form } = setup({ type: 'binary', multiple: true }, { readonly: true });
    form.setValue('x', [stored('a.pdf', 'application/pdf')]);
    expect(el.querySelectorAll('.fd-file-item')).toHaveLength(1);
    expect((el.querySelector('.fd-file-pick') as HTMLElement).hidden).toBe(true);
    expect(el.querySelector('.fd-file-remove')).toBeNull();
    drop(el, pdf('b.pdf'));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect((form.getState().values['x'] as FileValue[]).map((f) => f.name)).toEqual(['a.pdf']);
    (el.querySelector('.fd-file-open') as HTMLButtonElement).click();
    expect(dialog()?.querySelector('a[download]')?.getAttribute('download')).toBe('a.pdf');
    key(dialog() as HTMLElement, 'Escape');
  });
});

describe('the viewer', () => {
  const three = [stored('photo.png', 'image/png'), stored('notes.txt', 'text/plain'), { name: 'plan.pdf', type: 'application/pdf', size: 2048, url: 'https://files.example/plan.pdf' }];
  function opened(index = 0, options: { dir?: string } = {}) {
    const result = setup({ type: 'binary', multiple: true }, options);
    result.form.setValue('x', three);
    const opener = result.el.querySelectorAll<HTMLButtonElement>('.fd-file-open')[index];
    opener.focus();
    opener.click();
    return { ...result, opener, box: dialog() as HTMLElement };
  }

  it('opens a file in a modal dialog named by the file, the focus in it', () => {
    const { box } = opened();
    expect(box.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(box.getAttribute('aria-labelledby') as string)?.textContent).toBe('photo.png');
    expect(box.contains(document.activeElement)).toBe(true);
    expect(text(box.querySelector('.fd-form-dialog-head'))).toContain('5 bytes · 1 of 3');
    // An image whole, from an object URL of its data.
    const img = box.querySelector('.fd-file-viewer-body img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('blob:1');
    expect(box.querySelector('a[download]')?.getAttribute('href')).toBe('blob:1');
    key(box, 'Escape');
  });

  it('goes through the files with Previous and Next, and the arrows, freeing each object URL', async () => {
    const { box } = opened();
    (box.querySelector('[aria-label="Next"]') as HTMLButtonElement).click();
    expect(revoked).toEqual(['blob:1']);
    expect(text(box.querySelector('h2'))).toBe('notes.txt');
    await until(() => box.querySelector('pre')?.textContent);
    expect(box.querySelector('pre')?.textContent).toBe('hello');
    key(box, 'ArrowRight');
    // A stored file is shown from where it is: a PDF in a frame named by it.
    expect(text(box.querySelector('h2'))).toBe('plan.pdf');
    const frame = box.querySelector('iframe') as HTMLIFrameElement;
    expect([frame.getAttribute('src'), frame.title]).toEqual(['https://files.example/plan.pdf', 'plan.pdf']);
    expect(text(box.querySelector('.fd-form-dialog-head'))).toContain('2 KB · 3 of 3');
    key(box, 'ArrowRight');
    expect(text(box.querySelector('h2'))).toBe('photo.png');
    key(box, 'ArrowLeft');
    expect(text(box.querySelector('h2'))).toBe('plan.pdf');
    (box.querySelector('[aria-label="Previous"]') as HTMLButtonElement).click();
    expect(text(box.querySelector('h2'))).toBe('notes.txt');
    key(box, 'Escape');
    expect(made.every((url) => revoked.includes(url))).toBe(true);
  });

  it('mirrors the arrows right to left', () => {
    const { box } = opened(0, { dir: 'rtl' });
    key(box, 'ArrowLeft');
    expect(text(box.querySelector('h2'))).toBe('notes.txt');
    key(box, 'ArrowRight');
    expect(text(box.querySelector('h2'))).toBe('photo.png');
    key(box, 'Escape');
  });

  it('closes with Escape, the close button and the backdrop, the focus back on the file it was opened from', () => {
    let { box, opener } = opened(1);
    key(box, 'ArrowRight');
    key(box, 'Escape');
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener);
    ({ box, opener } = opened(2));
    (box.querySelector('[aria-label="Close"]') as HTMLButtonElement).click();
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener);
    ({ box, opener } = opened(0));
    (box.parentElement as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('keeps Tab inside it', () => {
    const { box } = opened();
    const stops = [...box.querySelectorAll<HTMLElement>('button:not([hidden]), a[href]')];
    stops[stops.length - 1].focus();
    key(stops[stops.length - 1], 'Tab');
    expect(document.activeElement).toBe(stops[0]);
    key(stops[0], 'Tab', { shiftKey: true });
    expect(document.activeElement).toBe(stops[stops.length - 1]);
    key(box, 'Escape');
  });

  it('says when a kind of file has no preview, with its icon, name and size', () => {
    const { form, el } = setup({ type: 'binary' });
    form.setValue('x', stored('site.zip', 'application/zip'));
    (el.querySelector('.fd-file-open') as HTMLButtonElement).click();
    const box = dialog() as HTMLElement;
    expect(text(box.querySelector('.fd-file-none'))).toBe('ZIP site.zip 5 bytes No preview for this kind of file');
    // One file: nothing to go through.
    expect((box.querySelector('[aria-label="Next"]') as HTMLElement).hidden).toBe(true);
    key(box, 'Escape');
  });

  it('speaks the page’s language', () => {
    const { form, el } = setup({ type: 'binary', multiple: true }, { locale: 'ar', dir: 'rtl' });
    form.setValue('x', [stored('a.txt', 'text/plain'), stored('b.txt', 'text/plain')]);
    expect(text(el.querySelector('.fd-file-count'))).toBe('عدد الملفات: 2');
    (el.querySelector('.fd-file-open') as HTMLButtonElement).click();
    const box = dialog() as HTMLElement;
    expect(box.querySelector('[aria-label="التالي"]')).not.toBeNull();
    expect(text(box.querySelector('.fd-form-dialog-head'))).toContain('1 من 2');
    key(box, 'Escape');
  });
});

describe('every language', () => {
  it('has every word', () => {
    for (const words of Object.values(WIDGET_LABELS)) expect(Object.keys(words).sort()).toEqual(Object.keys(WIDGET_LABELS.en).sort());
  });
});

describe('several files where they are only read', () => {
  it('are their names, in a table’s cell and a summary', async () => {
    const { displayValue } = await import('./display');
    const { summary } = await import('./widgets');
    const docs = { type: 'binary', label: 'Documents', multiple: true } as Field;
    const two = [stored('a.pdf', 'application/pdf'), stored('b.pdf', 'application/pdf')];
    expect(displayValue(docs as never, two)).toBe('a.pdf, b.pdf');
    expect(summary(two, docs)).toBe('a.pdf, b.pdf');
    expect(summary(stored('a.pdf', 'application/pdf'), { type: 'binary', label: 'One' } as Field)).toBe('a.pdf');
  });
});
