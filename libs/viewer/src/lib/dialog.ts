import type { RecordId, Values } from '@fieldia/core';
import { mountViewer, VIEWER_LABELS, type ViewerOptions } from './viewer';

/**
 * A page in a dialog: a new related record, a line to edit, a quick task. The
 * dialog saves (Save & Close) or closes without saving (Discard, ×, Escape);
 * the page's own Save and Discard stay hidden. The focus moves into the dialog,
 * Tab stays inside it, and the focus goes back where it was when it closes.
 */

export interface FormDialogOptions extends ViewerOptions {
  title: string;
  size?: 'small' | 'medium' | 'large' | 'full';
  /**
   * "save" (the default) saves the record through the data source. "values"
   * only checks the form and hands its values back, for something saved with
   * a bigger record, such as a line.
   */
  mode?: 'save' | 'values';
  /** Where the dialog goes: the document's body by default. */
  container?: HTMLElement;
}

export interface FormDialogResult {
  /** True when Save & Close was pressed and the form accepted. */
  saved: boolean;
  recordId: RecordId | null;
  values: Values;
}

let dialogs = 0;

const FOCUSABLE = 'button, [href], input, select, textarea, [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

export function openFormDialog(options: FormDialogOptions): Promise<FormDialogResult> {
  const doc = options.container?.ownerDocument ?? document;
  const container = options.container ?? doc.body;
  const opener = doc.activeElement instanceof doc.defaultView!.HTMLElement ? (doc.activeElement as HTMLElement) : null;
  const labels = { ...VIEWER_LABELS[options.locale ?? 'en'], ...options.labels };
  const id = `fd-dialog-${++dialogs}`;
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string) => {
    const element = doc.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
    if (text !== undefined) element.textContent = text;
    return element;
  };

  const title = make('h2', { id: `${id}-title`, class: 'fd-form-dialog-title' }, options.title);
  const closeButton = make('button', { type: 'button', class: 'fd-dialog-close', 'aria-label': labels.close }, '×');
  const body = make('div', { class: 'fd-form-dialog-body' });
  const discard = make('button', { type: 'button', class: 'fd-button' }, labels.discard);
  const saveClose = make('button', { type: 'button', class: 'fd-button fd-button-primary' }, labels.saveClose);
  const box = make('div', {
    class: `fd-form-dialog fd-size-${options.size ?? 'medium'}`,
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': title.id,
    tabindex: '-1',
  });
  if (options.dir) box.setAttribute('dir', options.dir);
  box.append(make('div', { class: 'fd-form-dialog-head' }), body, make('div', { class: 'fd-actions fd-actions-end fd-form-dialog-foot' }));
  box.firstElementChild?.append(title, closeButton);
  box.lastElementChild?.append(discard, saveClose);
  const backdrop = make('div', { class: 'fd-dialog-backdrop fd-form-dialog-backdrop' });
  backdrop.append(box);
  container.append(backdrop);

  const handle = mountViewer(body, { ...options, showActions: false });

  const focusables = () =>
    [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (element) => !element.closest('[hidden], [inert]') && !(element as HTMLButtonElement).disabled
    );
  // Into the dialog: its first field, once the record is in, or the dialog itself meanwhile.
  const firstField = () => body.querySelector<HTMLElement>('input:not([type="hidden"]), select, textarea, [contenteditable="true"]');
  (firstField() ?? box).focus();
  void handle.form.settled().then(() => {
    if (doc.activeElement === box || !box.contains(doc.activeElement)) firstField()?.focus();
  });

  return new Promise((resolve) => {
    let done = false;
    const close = (saved: boolean) => {
      if (done) return;
      done = true;
      const state = handle.form.getState();
      // The form never changes its values in place, so these are safe to hand back.
      const result: FormDialogResult = { saved, recordId: state.recordId ?? null, values: state.values as Values };
      handle.destroy();
      backdrop.remove();
      opener?.focus();
      resolve(result);
    };
    saveClose.addEventListener('click', async () => {
      saveClose.disabled = true;
      const accepted = options.mode === 'values' ? handle.check() : await handle.save();
      saveClose.disabled = false;
      if (accepted) close(true);
    });
    discard.addEventListener('click', () => close(false));
    closeButton.addEventListener('click', () => close(false));
    box.addEventListener('keydown', (event) => {
      // A key a field used itself (Escape closing a list) is not the dialog's.
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        close(false);
      } else if (event.key === 'Tab') {
        const all = focusables();
        if (!all.length) return;
        const first = all[0];
        const last = all[all.length - 1];
        if (event.shiftKey && doc.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && doc.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
  });
}
