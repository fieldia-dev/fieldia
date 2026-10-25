import type { FileValue } from '@fieldia/core';
import type { ShrinkOptions } from './shrink';

/**
 * What a file is and where its bytes are: its kind, for its icon, and its
 * picture's address. A file field's widget (files.ts, in the files part) draws
 * with them; how a file is shown in place — the formats Fieldia shows, its
 * bytes checked against them — is the files part's (file-formats.ts).
 */

export const extension = (name: string) => (/\.(\w{1,5})$/.exec(name)?.[1] ?? '').toUpperCase();
/** What a file is, for its icon: by its media type, else its extension. Never what it is shown as: `formatOf` (the files part) decides that. */
export function kindOf(file: FileValue): string {
  const of = `${file.type} ${extension(file.name)}`.toLowerCase();
  return /^image\//.test(of) ? 'image' : /pdf/.test(of) ? 'pdf' : /sheet|excel|csv|xlsx?$|ods$/.test(of) ? 'sheet' : /zip|rar|7z|tar|gz/.test(of) ? 'zip' : /word|opendocument|^text|docx?$|odt$|rtf$/.test(of) ? 'doc' : 'file';
}
/** Where a file's picture is, for a picture alone: its data as a picture's, or where it is stored. */
export const source = (file: FileValue) => (file.data ? `data:${/^image\/[\w.+-]+$/i.test(file.type) ? file.type : 'application/octet-stream'};base64,${file.data}` : (file.url ?? ''));
const bytes = (data: string) => Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
/** A file's bytes as base64 where it holds them: as its data, or in a `data:` link a store gave (the memory source's). */
export const base64Of = (file: FileValue) => file.data ?? (/^data:[^,]*;base64,/.test(file.url ?? '') ? (file.url as string).slice((file.url as string).indexOf(',') + 1) : null);
/** A file's bytes where it holds them: as its data, or in a `data:` link a store gave (the memory source's) — shown from a blob, as a browser shows a PDF. */
export const bytesOf = (file: FileValue) => {
  const held = base64Of(file);
  return held === null ? null : bytes(held);
};

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
