import { TextDecoder, TextEncoder } from 'node:util';
import type { FileValue } from '@fieldia/core';
import { fileShown, formatOf, shownFile } from './file-formats';
import { filesPart } from './widget-parts';
import { viewFiles } from './files';
import { WIDGET_LABELS } from './labels';
import { mountKind } from './test-kinds';

/** Every blob made, with the type it was given: a file is shown only from a blob typed from its format. */
const made: { url: string; type: string }[] = [];
// The files part checks a file's bytes as it is shown: here from the start, as on a page that has shown a file.
beforeAll(async () => {
  Object.assign(globalThis, { TextDecoder, TextEncoder });
  await filesPart.load();
});
const revoked: string[] = [];
beforeEach(() => {
  made.length = revoked.length = 0;
  URL.createObjectURL = (blob: Blob) => {
    const url = `blob:http://localhost/${made.length + 1}`;
    made.push({ url, type: blob.type });
    return url;
  };
  URL.revokeObjectURL = (url: string) => void revoked.push(url);
  document.body.replaceChildren(Object.assign(document.createElement('div'), { className: 'fd-form', id: 'home' }));
});

const b64 = (text: string) => btoa(text);
const HTML = '<script>parent.__hit(document.domain)</script>';
const SVG = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
const PDF = '%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF';
const PNG = '\x89PNG\r\n\x1a\n\0\0\0\rIHDR';
/** The audit's file: an uploader's HTML named and typed by its uploader. */
const evil: FileValue = { name: 'invoice.pdf', type: 'text/html', size: HTML.length, data: b64(HTML) };
const open = (files: FileValue[]) => {
  viewFiles({ doc: document, words: WIDGET_LABELS.en, id: 't', files, at: 0, home: document.getElementById('home') as HTMLElement });
  return document.querySelector('.fd-file-viewer') as HTMLElement;
};

describe('a file is shown in place only as a format Fieldia shows, from bytes that are what it says (S-H1)', () => {
  it('never shows an uploader’s HTML named .pdf: no frame, no address of its type — its words as words, downloaded as bytes (the audit’s proof)', async () => {
    expect(formatOf(evil)).toBeUndefined();
    expect(fileShown(document, evil)).toBeNull();
    const box = open([evil]);
    expect(box.querySelector('iframe, img, embed, object')).toBeNull();
    await new Promise((resolve) => setTimeout(resolve));
    expect(box.querySelector('pre')?.textContent).toBe(HTML);
    // Its Download is a blob of no type of its own: never read by the browser as a page.
    expect(box.querySelector('a[download]')?.getAttribute('href')).toBe(made[0].url);
    expect(made.map((blob) => blob.type)).toEqual(['application/octet-stream']);
  });

  it('never frames, opens or downloads from a value’s javascript: address (the audit’s proof)', () => {
    const box = open([{ name: 'scan.pdf', type: 'application/pdf', size: 1, url: 'javascript:alert(document.domain)' }]);
    expect(box.querySelector('iframe')).toBeNull();
    expect(box.querySelector('a[download]')?.hasAttribute('href')).toBe(false);
    expect(fileShown(document, { name: 'scan.pdf', type: 'application/pdf', size: 1, url: 'java\tscript:alert(1)//' })?.element.getAttribute('src') ?? null).toBeNull();
  });

  it('checks the bytes against the format they claim: HTML typed as a PDF or a PNG, by type or by name, is not shown', () => {
    for (const file of [
      { name: 'invoice.pdf', type: 'application/pdf', size: 1, data: b64(HTML) },
      { name: 'invoice.pdf', type: '', size: 1, data: b64(HTML) },
      { name: 'photo.png', type: 'image/png', size: 1, data: b64(HTML) },
      { name: 'clip.mp4', type: 'video/mp4', size: 1, data: b64(HTML) },
    ]) {
      expect(shownFile(file)).toBeNull();
      expect(fileShown(document, file)?.element.hasAttribute('src') ?? false).toBe(false);
    }
    expect(made).toEqual([]);
  });

  it('says a file named as a picture whose bytes are none is not a picture, not only that it has no preview (the walk of 0.35)', () => {
    const box = open([{ name: 'floor-photo.png', type: '', size: 209, data: b64(HTML) }]);
    expect(box.querySelector('.fd-file-none p')?.textContent).toBe('This file is not a picture, though its name says so: it is not shown');
    expect(box.querySelector('img, iframe')).toBeNull();
    // A file of a kind Fieldia shows no preview of: as before.
    box.closest('.fd-dialog-backdrop')?.remove();
    const other = open([{ name: 'notes.zip', type: 'application/zip', size: 3, data: b64('PK\x03') }]);
    expect(other.querySelector('.fd-file-none p')?.textContent).toBe('No preview for this kind of file');
  });

  it('shows a PDF and a picture from a blob typed from its format, never from the type the file says', () => {
    const pdf = fileShown(document, { name: 'Quote.pdf', type: 'application/x-pdf', size: 1, data: b64(PDF) });
    expect(pdf?.element.tagName).toBe('IFRAME');
    expect(pdf?.element.getAttribute('src')).toBe(`${made[0].url}#view=FitH&navpanes=0`);
    const png = fileShown(document, { name: 'Lobby', type: 'image/png; charset=binary', size: 1, data: b64(PNG) });
    expect(png?.element.getAttribute('src')).toBe(made[1].url);
    expect(made.map((blob) => blob.type)).toEqual(['application/pdf', 'image/png']);
    expect(pdf?.url).toBe(made[0].url);
  });

  it('draws an SVG as a picture alone, from data — never a blob of this page’s origin, never opened in a tab', () => {
    const svg = fileShown(document, { name: 'logo.svg', type: 'image/svg+xml', size: SVG.length, data: b64(SVG) });
    expect(svg?.element.tagName).toBe('IMG');
    expect(svg?.element.getAttribute('src')).toMatch(/^data:image\/svg\+xml;base64,/);
    // Nothing to open it by: the attachment preview's Open link is hidden for it.
    expect(svg?.url).toBe('');
    expect(made).toEqual([]);
  });

  it('reads a PDF at this site’s own address before framing it: what the site answers must be a PDF (a store may answer anything)', async () => {
    const answers: Record<string, string> = { '/files/7': HTML, '/files/8': PDF };
    const fetched: string[] = [];
    globalThis.fetch = (async (url: string) => {
      fetched.push(url);
      const body = new TextEncoder().encode(answers[url] ?? '');
      return { ok: url in answers, arrayBuffer: async () => body.buffer } as unknown as Response;
    }) as typeof fetch;
    const html = fileShown(document, { name: 'a.pdf', type: 'application/pdf', size: 1, url: '/files/7' });
    expect(await html?.ready).toBe('');
    expect(html?.element.hasAttribute('src')).toBe(false);
    const pdf = fileShown(document, { name: 'b.pdf', type: 'application/pdf', size: 1, url: '/files/8' });
    expect(await pdf?.ready).toBe(made[0].url);
    expect(made.map((blob) => blob.type)).toEqual(['application/pdf']);
    // Another site's: framed as it is, the browser keeping its page apart from this one.
    const away = fileShown(document, { name: 'c.pdf', type: 'application/pdf', size: 1, url: 'https://files.example/c.pdf' });
    expect(away?.element.getAttribute('src')).toBe('https://files.example/c.pdf#view=FitH&navpanes=0');
    expect(fetched).toEqual(['/files/7', '/files/8']);
  });

  it('the pdf widget frames only a PDF’s bytes', () => {
    const { el, form } = mountKind({ type: 'binary', label: 'Instructions' }, { widget: 'pdf' });
    form.setValue('x', { name: 'Instructions.pdf', type: 'application/pdf', size: 1, data: b64(HTML) });
    expect(el.querySelector('iframe')).toBeNull();
    form.setValue('x', { name: 'Instructions.pdf', type: 'application/pdf', size: 1, data: b64(PDF) });
    expect((el.querySelector('iframe') as HTMLIFrameElement).getAttribute('src')).toBe(made[0].url);
    expect(made.map((blob) => blob.type)).toEqual(['application/pdf']);
  });

  it('plays a film or a sound only from its format’s bytes, typed from it', () => {
    expect(shownFile({ name: 'note.webm', type: 'audio/webm;codecs=opus', size: 4, data: 'GkXfow==' })).toMatchObject({ kind: 'audio', url: made[0]?.url ?? 'blob:http://localhost/1' });
    expect(made.map((blob) => blob.type)).toEqual(['audio/webm']);
    expect(shownFile({ name: 'note.webm', type: 'audio/webm', size: 4, data: b64('abcd') })).toBeNull();
  });
});
