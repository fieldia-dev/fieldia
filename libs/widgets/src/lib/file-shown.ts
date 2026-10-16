import type { FileValue } from '@fieldia/core';
import type { ShrinkOptions } from './shrink';

/**
 * What a file is and where its bytes are: its kind, for its icon and its
 * preview, and its picture's address. A file field's widget (files.ts, in the
 * files part) draws with them; a sheet's attachment preview beside its record
 * (@fieldia/viewer) shows a file with `fileShown`, the files part or not.
 */

export const extension = (name: string) => (/\.(\w{1,5})$/.exec(name)?.[1] ?? '').toUpperCase();
/** What a file is, for its icon and its preview: by its media type, else its extension. */
export function kindOf(file: FileValue): string {
  const of = `${file.type} ${extension(file.name)}`.toLowerCase();
  return /^image\//.test(of) ? 'image' : /pdf/.test(of) ? 'pdf' : /sheet|excel|csv|xlsx?$|ods$/.test(of) ? 'sheet' : /zip|rar|7z|tar|gz/.test(of) ? 'zip' : /word|opendocument|^text|docx?$|odt$|rtf$/.test(of) ? 'doc' : 'file';
}
/** Where a file's picture is: its data, or where it is stored. */
export const source = (file: FileValue) => (file.data ? `data:${file.type};base64,${file.data}` : (file.url ?? ''));
const bytes = (data: string) => Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
/** A file's bytes where it holds them: as its data, or in a `data:` link a store gave (the memory source's) — shown from a blob, as a browser shows a PDF. */
export const bytesOf = (file: FileValue) => (file.data ? bytes(file.data) : /^data:[^,]*;base64,/.test(file.url ?? '') ? bytes((file.url as string).slice((file.url as string).indexOf(',') + 1)) : null);

/**
 * A file as a file opened in its dialog shows it: a picture, or a PDF in the
 * browser's own viewer — what a sheet's attachment preview shows beside it.
 * Null for any other kind. `free` lets go of the address made for a file
 * held as data.
 */
export function fileShown(doc: Document, file: FileValue): { element: HTMLElement; url: string; free(): void } | null {
  const kind = kindOf(file);
  if (kind !== 'image' && kind !== 'pdf') return null;
  const data = bytesOf(file);
  const url = data ? URL.createObjectURL(new Blob([data], { type: file.type })) : source(file);
  const element = doc.createElement(kind === 'image' ? 'img' : 'iframe');
  // A PDF fills the width, without the viewer's page list beside it: there is room for the page alone.
  element.setAttribute('src', kind === 'pdf' ? `${url}#view=FitH&navpanes=0` : url);
  element.setAttribute(kind === 'image' ? 'alt' : 'title', file.name);
  element.setAttribute('data-kind', kind);
  return { element, url, free: () => void (url.startsWith('blob:') && URL.revokeObjectURL(url)) };
}

/** A file read whole into a value of its own, its bytes as base64: what a field holds where no store keeps files. */
export const readFile = (file: File) =>
  new Promise<FileValue>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? '');
      resolve({ name: file.name, type: file.type, size: file.size, data: url.slice(url.indexOf(',') + 1) });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

/** A file held inside the record warns, once a form, from this size: it travels in every save. */
export const INLINE_FILE_WARNING = 1024 * 1024;

/** How large a photo is made before it is stored, unless its field says otherwise (`shrink`). */
export const SHRINK_DEFAULTS: Required<ShrinkOptions> = { maxSide: 2048, quality: 0.85 };
