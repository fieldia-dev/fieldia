import { fill, formatBytes, type FileUpload, type Form } from '@fieldia/core';
import type { WidgetLabels } from './labels';
import { setAttr, setHidden, setText, type Make } from './kind-parts';
import { installFilesStyles } from './styles-files';

/**
 * Files on their way to the app's store, as a file field shows them: each an
 * item like a stored file's — its picture, its name, its size — with a bar
 * under it that fills as it goes, the words of where it is (waiting, being
 * made smaller, 40%, not uploaded), × to cancel it, and Retry once it failed.
 * A screen reader hears the bar by the file's name; the field's own status
 * says when files are in, and when one did not get there.
 */

/** A file on its way, as the field shows it: the form's upload, or a composer's own. */
export type Going = Pick<FileUpload, 'id' | 'name' | 'size' | 'type' | 'status' | 'sent' | 'total' | 'error'>;

/** Where a file on its way is, in words. */
export function goingWords(words: WidgetLabels, going: Going): string {
  if (going.status === 'waiting') return words.uploadWaiting;
  if (going.status === 'preparing') return words.uploadPreparing;
  if (going.status === 'failed') return words.uploadFailed;
  if (going.status === 'refused') return going.error || words.uploadRefused;
  return going.total ? fill(words.uploadPercent, { n: Math.min(100, Math.floor((going.sent * 100) / going.total)) }) : words.uploading;
}

export interface GoingItem {
  element: HTMLLIElement;
  update(going: Going, readonly: boolean): void;
}

/**
 * One file on its way. `picture` stands where a stored file's picture does;
 * `named` writes its name as the field writes names. Cancel and Retry are the
 * caller's: × cancels one going and removes one that failed or was refused.
 */
export function goingItem(make: Make, words: WidgetLabels, picture: HTMLElement, named: (name: string) => HTMLElement, on: { cancel(): void; retry(): void }): GoingItem {
  // Drawn by the files part's sheet, wherever it is drawn: a file field, a composer's files.
  installFilesStyles(picture.ownerDocument);
  const bar = make('progress', { class: 'fd-file-progress', max: '100' });
  const state = make('span', { class: 'fd-file-state' });
  const size = make('span', { class: 'fd-file-size' });
  const retry = make('button', { type: 'button', class: 'fd-button fd-button-link fd-file-retry' }, words.retryUpload);
  const cancel = make('button', { type: 'button', class: 'fd-file-remove fd-file-cancel' }, '×');
  retry.addEventListener('click', on.retry);
  cancel.addEventListener('click', on.cancel);
  let name: HTMLElement = make('span');
  // The bar and its words inside the item's own frame: a line of their own in a list, at a card's foot, over a tile's.
  const box = make('div', { class: 'fd-file-open fd-file-going-box' }, picture, name, size, make('div', { class: 'fd-file-progress-box' }, bar, state, retry));
  const element = make('li', { class: 'fd-file-item fd-file-going' }, box, cancel);
  let shownName = '';
  return {
    element,
    update(going, readonly) {
      element.dataset['upload'] = going.id;
      element.dataset['status'] = going.status;
      // Its name as it is now: a photo made smaller may be a .jpg now.
      if (shownName !== going.name) {
        shownName = going.name;
        const next = named(going.name);
        name.replaceWith(next);
        name = next;
      }
      setText(size, formatBytes(going.size));
      setText(state, goingWords(words, going));
      const moving = going.status !== 'failed' && going.status !== 'refused';
      setHidden(bar, !moving);
      // A number once the store has told one; until then the bar moves with none — and waits, empty and still, for its turn.
      if (going.status === 'uploading' && going.total) bar.value = Math.min(100, Math.floor((going.sent * 100) / going.total));
      else if (going.status === 'waiting') bar.value = 0;
      else bar.removeAttribute('value');
      setAttr(bar, 'aria-label', fill(words.uploadingNamed, { name: going.name }));
      setHidden(retry, readonly || going.status !== 'failed');
      setAttr(retry, 'aria-label', fill(words.retryUploadNamed, { name: going.name }));
      setHidden(cancel, readonly);
      setAttr(cancel, 'aria-label', fill(moving ? words.cancelUpload : words.remove, { name: going.name }));
      setAttr(cancel, 'title', moving ? fill(words.cancelUpload, { name: going.name }) : null);
    },
  };
}

/**
 * A field's files on their way, as a list of their own — under a signature's
 * pad, for a picture of one uploaded: each with its bar, × and Retry, patched
 * in place as the form's uploads change.
 */
export function goingList(make: Make, words: WidgetLabels, form: Form, field: string): { element: HTMLUListElement; update(readonly: boolean): void } {
  const element = make('ul', { class: 'fd-files fd-files-going', role: 'list' });
  const items = new Map<string, GoingItem>();
  let seen: readonly FileUpload[] | undefined;
  let wasReadonly = false;
  return {
    element,
    update(readonly) {
      const uploads = form.getState().uploads ?? [];
      if (uploads === seen && readonly === wasReadonly) return;
      seen = uploads;
      wasReadonly = readonly;
      const mine = form.uploading(field);
      for (const [id, item] of items) {
        if (mine.some((upload) => upload.id === id)) continue;
        item.element.remove();
        items.delete(id);
      }
      for (const upload of mine) {
        let item = items.get(upload.id);
        if (!item) {
          const picture = make('span', { class: 'fd-file-icon', 'data-kind': 'image', 'aria-hidden': 'true' }, (/\.(\w{1,5})$/.exec(upload.name)?.[1] ?? '').toUpperCase());
          item = goingItem(make, words, picture, (name) => make('span', { class: 'fd-file-name', dir: 'auto', title: name }, name), { cancel: () => form.cancelUpload(upload.id), retry: () => form.retryUpload(upload.id) });
          items.set(upload.id, item);
          element.append(item.element);
        }
        item.update(upload, readonly);
      }
    },
  };
}
