import { DOWNLOAD_URL, safeUrl, type ActionFile, type FileValue } from '@fieldia/core';
import { formatOf } from './file-formats';
import { viewFiles } from './files';
import { maker } from './kind-parts';
import type { WidgetLabels } from './labels';

/**
 * The app's own file for a record — its PDF of an invoice, a report under the
 * gear menu's Print — handed back from an action (`ActionResult.file`): a PDF
 * or a picture shown over the form in the browser's own viewer, as a file
 * field's file opens (`viewFiles`), with Download; any other kind, or one the
 * app says to save (`show: 'download'`), saved at once. In the files part: the
 * viewer's host asks for it the first time an action hands back a file.
 */

/** A kind by a file's name, where the app gave none. */
const KINDS: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', csv: 'text/csv', txt: 'text/plain', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
const kindOfName = (name: string) => KINDS[/\.(\w+)$/.exec(name)?.[1]?.toLowerCase() ?? ''] ?? 'application/octet-stream';

export interface AppFileContext {
  doc: Document;
  /** The widgets' words: the dialog's Download, Close and what it says of a file it cannot show. */
  labels: WidgetLabels;
  /** The form it opens over. */
  home: HTMLElement;
  file: ActionFile;
}

/** Bytes as base64, a piece at a time: a large file never passes as one call's arguments. */
function base64(bytes: Uint8Array): string {
  let text = '';
  for (let at = 0; at < bytes.length; at += 0x8000) text += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  return btoa(text);
}

/** Shown, or saved: once it is on the screen, or handed to the browser to save. */
export function showAppFile(context: AppFileContext): void {
  const { doc, file } = context;
  const type = file.type || kindOfName(file.name);
  // Its bytes as an address of their own, let go of once it is closed (or saved); the app's address as it is.
  let url = file.url ?? '';
  let size = Number.NaN;
  if (!url) {
    const bytes = file.bytes;
    const blob = bytes ? (typeof Blob !== 'undefined' && bytes instanceof Blob ? bytes : new Blob([bytes as ArrayBuffer], { type })) : file.data ? new Blob([Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0))], { type }) : null;
    if (!blob) throw new Error(`The file "${file.name}" came with no address, data or bytes`);
    url = URL.createObjectURL(blob);
    size = blob.size;
  }
  const free = () => url.startsWith('blob:') && URL.revokeObjectURL(url);
  const save = () => {
    const link = maker(doc)('a', { href: safeUrl(url, DOWNLOAD_URL), download: file.name, hidden: '' });
    (doc.body ?? doc.documentElement).append(link);
    link.click();
    link.remove();
    // Let go of the bytes once the browser has taken them.
    setTimeout(free, 60000);
  };
  // Shown only as a format Fieldia shows (`formatOf`); the dialog reads its bytes before it does.
  if (file.show === 'download' || !/^(pdf|image)$/.test(formatOf({ name: file.name, type })?.kind ?? '')) return save();
  // Its bytes, where they came with it, shown from themselves (`shownFile` checks them); an address alone is read first.
  const given = file.bytes;
  const held = file.data ?? (given instanceof ArrayBuffer || ArrayBuffer.isView(given) ? base64(new Uint8Array(given as ArrayBuffer)) : undefined);
  const shown: FileValue = { name: file.name, type, size, url, ...(held ? { data: held } : {}) };
  // Back where the person was once it is closed: the gear's button, as a menu's item hands the focus back to it.
  const before = doc.activeElement as HTMLElement | null;
  viewFiles({ doc, words: context.labels, id: `fd-file-${Date.now().toString(36)}`, files: [shown], at: 0, home: context.home, back: () => (before?.isConnected ? before : null), closed: free });
}
