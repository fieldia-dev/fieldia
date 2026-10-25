import { MEDIA_URL, PICTURE_URL, safeUrl, type FileValue } from '@fieldia/core';
import { base64Of, extension } from './file-shown';

/**
 * How a file is shown in place (the files part): every preview goes through `shownFile` — a file's dialog, a sheet's
 * attachment preview (`fileShown`), the pdf widget, a file's film and sound, a conversation's pictures.
 */

/** What Fieldia shows a file as, in place: a picture, a PDF in the browser's own viewer, a film or a sound in its player. */
export type ShownKind = 'image' | 'pdf' | 'video' | 'audio';

/** A file as Fieldia shows it: its kind, where it is shown from, whether it may open in a tab of its own, and what lets that address go. */
export interface Shown {
  kind: ShownKind;
  url: string;
  opens: boolean;
  free(): void;
}

/** Whether bytes start with these characters (each a byte's code), from `at`. */
const reads = (b: Uint8Array, at: number, text: string) => [...text].every((c, i) => b[at + i] === c.charCodeAt(0));
const ebml = (b: Uint8Array) => reads(b, 0, '\x1a\x45\xdf\xa3');
const ogg = (b: Uint8Array) => reads(b, 0, 'OggS');
const isoMedia = (b: Uint8Array) => reads(b, 4, 'ftyp');
const box = (b: Uint8Array, from: number) => String.fromCharCode(...b.subarray(from, from + 4));

/**
 * A format Fieldia shows: its kind, the one media type its bytes are shown with, the other names a store gives that
 * type, its extensions (read only where a file says no type), and how its bytes start. A picture drawn from markup
 * (SVG) is drawn as a picture alone — from data, where no script runs and a copy opened has no origin — never in a
 * frame nor in a tab of its own.
 */
export interface FileFormat {
  kind: ShownKind;
  type: string;
  also: string;
  names: string;
  starts(b: Uint8Array): boolean;
  markup?: true;
}
const format = (kind: ShownKind, type: string, starts: (b: Uint8Array) => boolean, also = '', names = type.slice(type.indexOf('/') + 1), markup?: true): FileFormat => ({ kind, type, also, names, starts, ...(markup ? { markup } : {}) });
const FORMATS: FileFormat[] = [
  // A PDF's header within its first kilobyte, as its readers take it.
  format('pdf', 'application/pdf', (b) => b.subarray(0, 1024).some((_, at) => reads(b, at, '%PDF-')), 'application/x-pdf'),
  format('image', 'image/png', (b) => reads(b, 0, '\x89PNG\r\n\x1a\n')),
  format('image', 'image/jpeg', (b) => reads(b, 0, '\xff\xd8\xff'), 'image/jpg image/pjpeg', 'jpg jpeg jpe jfif'),
  format('image', 'image/gif', (b) => reads(b, 0, 'GIF8')),
  format('image', 'image/webp', (b) => reads(b, 0, 'RIFF') && reads(b, 8, 'WEBP')),
  format('image', 'image/avif', (b) => reads(b, 4, 'ftypavi')),
  format('image', 'image/heic', (b) => isoMedia(b) && /^(hei[cxms]|hev[cms]|mif1|msf1)$/.test(box(b, 8)), 'image/heif image/heic-sequence image/heif-sequence', 'heic heif'),
  format('image', 'image/bmp', (b) => reads(b, 0, 'BM'), 'image/x-ms-bmp'),
  format('image', 'image/svg+xml', () => true, '', 'svg', true),
  format('video', 'video/mp4', isoMedia, 'video/x-m4v', 'mp4 m4v'),
  format('video', 'video/quicktime', (b) => /^(ftyp|moov|mdat|wide|free|skip)$/.test(box(b, 4)), '', 'mov'),
  format('video', 'video/webm', ebml),
  format('video', 'video/ogg', ogg, '', 'ogv'),
  format('audio', 'audio/mpeg', (b) => reads(b, 0, 'ID3') || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0), 'audio/mp3 audio/x-mp3 audio/mpeg3', 'mp3'),
  format('audio', 'audio/mp4', isoMedia, 'audio/x-m4a audio/m4a', 'm4a'),
  format('audio', 'audio/wav', (b) => reads(b, 0, 'RIFF') && reads(b, 8, 'WAVE'), 'audio/x-wav audio/wave audio/vnd.wave'),
  format('audio', 'audio/ogg', ogg, 'audio/opus application/ogg', 'ogg oga opus'),
  format('audio', 'audio/aac', (b) => b[0] === 0xff && (b[1] & 0xf6) === 0xf0, 'audio/x-aac audio/aacp'),
  format('audio', 'audio/flac', (b) => reads(b, 0, 'fLaC'), 'audio/x-flac'),
  format('audio', 'audio/webm', ebml, '', 'weba'),
];

/**
 * THE allow-list a file is shown by: the format it is shown in, by the media type it says it is — HTML, a script,
 * anything not listed is none, whatever its name — and by its name only where it says none.
 */
export function formatOf(file: { name: string; type?: string }): FileFormat | undefined {
  const type = (file.type ?? '').split(';')[0].trim().toLowerCase();
  const ending = extension(file.name).toLowerCase();
  return FORMATS.find((one) => (type && type !== 'application/octet-stream' ? one.type === type || one.also.split(' ').includes(type) : one.names.split(' ').includes(ending)));
}

/** Whether an address is this site's own — a path, its origin, a blob: what it answers, it answers as the page. */
const ownAddress = (url: string) => {
  const here = (globalThis as { location?: { href?: string } }).location?.href ?? 'https://fieldia.invalid/';
  const at = new URL(url, here);
  return at.protocol === 'blob:' || at.origin === new URL(here).origin;
};

/** Bytes shown as their format's: checked to start as it does, in a blob typed from it — never from the type a file says. */
function shownFrom(held: Uint8Array, base64: string, format: FileFormat): Shown | null {
  if (format.markup) return { kind: format.kind, url: `data:${format.type};base64,${base64}`, opens: false, free: () => undefined };
  if (!format.starts(held)) return null;
  if (typeof URL.createObjectURL !== 'function') return base64 ? { kind: format.kind, url: `data:${format.type};base64,${base64}`, opens: false, free: () => undefined } : null;
  const url = URL.createObjectURL(new Blob([held as BlobPart], { type: format.type }));
  return { kind: format.kind, url, opens: true, free: () => URL.revokeObjectURL(url) };
}

/**
 * THE way a file is shown in place — a picture, a PDF in a frame, a film or a sound in its player — and opened in a
 * tab of its own. Only a format Fieldia shows (`formatOf`); HTML, an SVG's markup in a frame or a tab, bytes that are
 * not what their file says and anything unknown are downloaded, never shown.
 *
 * - Bytes the value holds: checked, in a blob typed from the format.
 * - A PDF at this site's own address: fetched, checked and shown from its bytes the same way — a store on this site
 *   may answer anything, and a frame shows what it answers as this page.
 * - Another site's address, or a picture's, a film's, a sound's (the browser only draws or plays those): as it is.
 *
 * A promise only for a PDF at this site's address; null for a file that is not shown.
 */
export function shownFile(file: FileValue): Shown | Promise<Shown | null> | null {
  const found = formatOf(file);
  if (!found) return null;
  const base64 = base64Of(file);
  if (base64 !== null) {
    try {
      return shownFrom(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)), base64, found);
    } catch {
      return null;
    }
  }
  const url = safeUrl(file.url, found.markup ? ['http', 'https', 'relative', 'image'] : MEDIA_URL);
  if (!url) return null;
  if (found.kind !== 'pdf' || !ownAddress(url)) return { kind: found.kind, url, opens: !found.markup, free: () => undefined };
  if (typeof fetch !== 'function') return null;
  return fetch(url)
    .then((answer) => (answer.ok ? answer.arrayBuffer() : null))
    .then(
      (read) => (read ? shownFrom(new Uint8Array(read), '', found) : null),
      () => null
    );
}

/** Drawn now, or once a PDF of this site's own has been read: `draw` with what is shown, or null. */
export function whenShown(shown: Shown | Promise<Shown | null> | null, draw: (shown: Shown | null) => void): void {
  if (shown instanceof Promise) void shown.then(draw);
  else draw(shown);
}

/**
 * A file as a file opened in its dialog shows it: a picture, or a PDF in the
 * browser's own viewer — what a sheet's attachment preview shows beside it.
 * Null for any other file (`formatOf`). `ready` gives where it opens in a tab
 * of its own once its bytes are checked ('' for none: a picture drawn from
 * markup, bytes that are not what they say), and `url` holds it then. `free`
 * lets go of the address made for a file held as data.
 */
export function fileShown(doc: Document, file: FileValue): { element: HTMLElement; url: string; ready: Promise<string>; free(): void } | null {
  const kind = formatOf(file)?.kind;
  if (kind !== 'image' && kind !== 'pdf') return null;
  const element = doc.createElement(kind === 'image' ? 'img' : 'iframe');
  element.setAttribute(kind === 'image' ? 'alt' : 'title', file.name);
  element.setAttribute('data-kind', kind);
  let made: Shown | null = null;
  let gone = false;
  const result = {
    element,
    url: '',
    ready: Promise.resolve(''),
    free: () => {
      gone = true;
      made?.free();
    },
  };
  result.ready = new Promise<string>((resolve) =>
    whenShown(shownFile(file), (shown) => {
      if (gone) return void (shown?.free(), resolve(''));
      made = shown;
      // A PDF fills the width, without the viewer's page list beside it: there is room for the page alone.
      if (shown) element.setAttribute('src', safeUrl(shown.kind === 'pdf' ? `${shown.url}#view=FitH&navpanes=0` : shown.url, shown.kind === 'pdf' ? MEDIA_URL : PICTURE_URL) ?? '');
      element.hidden = !element.getAttribute('src');
      resolve((result.url = shown?.opens ? shown.url : ''));
    })
  );
  return result;
}
