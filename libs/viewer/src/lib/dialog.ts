import type { PageLook, RecordId, RelatedRecord, Values } from '@fieldia/core';
import { WIDGET_LABELS } from '@fieldia/widgets';
import { ownLocale } from './labels';
import { keepTabIn } from './focus-trap';
import { applyLook } from './look';
import { mountViewer, VIEWER_LABELS, type Skin, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * A page in a dialog: a new related record, a line to edit, a quick task. The
 * dialog saves (Save & Close) or closes without saving (Discard, ×, Escape);
 * the page's own Save and Discard stay hidden. The focus moves into the dialog,
 * Tab stays inside it, and the focus goes back where it was when it closes.
 * A side panel (`openFormPanel`) is the same box at the edge of the screen.
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
  /**
   * Recalculates the values as they change, for a dialog with no data source of
   * its own: a line's subtotal following its quantity. What comes back is shown.
   */
  recompute?: (values: Values) => Promise<Values>;
  /** Where the dialog goes: the document's body by default. */
  container?: HTMLElement;
  /** The look of the page that opened it, worn by the dialog and the page in it, unless that page has a look of its own. */
  look?: PageLook;
}

export interface FormDialogResult {
  /** True when Save & Close (Done, in a panel in "values" mode) was pressed and the form accepted. */
  saved: boolean;
  recordId: RecordId | null;
  values: Values;
}

/** A page in a side panel: the dialog's options, with a width in place of its size. */
export interface FormPanelOptions extends Omit<FormDialogOptions, 'size'> {
  /** About 420, 560 (the default) or 720 pixels wide on a wide screen; the whole screen on a phone. */
  width?: 'narrow' | 'medium' | 'wide';
}

let dialogs = 0;

export function openFormDialog(options: FormDialogOptions): Promise<FormDialogResult> {
  return openForm(options, `fd-size-${options.size ?? 'medium'}`);
}

/**
 * A page in a side panel: the dialog's twin, at full height along the
 * inline-end edge (the left, right to left), the page behind dimmed but in
 * sight; a full-screen sheet on a phone. It saves, or in "values" mode hands
 * back its values with Done, as the dialog does; Escape and × ask first when
 * there are changes to lose. A dialog opened from it sits above it, and a
 * panel opened from it stacks over it, this one stepped back.
 */
export function openFormPanel(options: FormPanelOptions): Promise<FormDialogResult> {
  return openForm(options, `fd-form-panel fd-width-${options.width ?? 'medium'}`, true);
}

/** A dialog or a panel: a page in a box with a head, a body that scrolls and a foot; `shape` is the box's own classes. */
function openForm(options: FormDialogOptions, shape: string, panel = false): Promise<FormDialogResult> {
  const doc = options.container?.ownerDocument ?? document;
  const container = options.container ?? doc.body;
  const opener = doc.activeElement instanceof doc.defaultView!.HTMLElement ? (doc.activeElement as HTMLElement) : null;
  const labels = { ...VIEWER_LABELS[ownLocale(options.locale)], ...options.labels };
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
  const saveClose = make('button', { type: 'button', class: 'fd-button fd-button-primary' }, panel && options.mode === 'values' ? labels.done : labels.saveClose);
  const box = make('div', {
    // Its own tokens and skin: the dialog sits outside the page that opened it.
    class: `fd-theme fd-form-dialog ${shape}`,
    'data-fd-skin': options.skin ?? 'underline',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': title.id,
    tabindex: '-1',
  });
  if (options.dir) box.setAttribute('dir', options.dir);
  // One look for the box and the page in it: the page's own, else the opener's.
  const look = options.page.look ?? options.look;
  applyLook(box, look);
  box.append(make('div', { class: 'fd-form-dialog-head' }), body, make('div', { class: 'fd-actions fd-actions-end fd-form-dialog-foot' }));
  box.firstElementChild?.append(title, closeButton);
  box.lastElementChild?.append(discard, saveClose);
  const backdrop = make('div', { class: `fd-dialog-backdrop fd-form-dialog-backdrop${panel ? ' fd-form-panel-backdrop' : ''}` });
  // A panel's backdrop runs its way too: the inline end it holds the panel at is the left, right to left.
  if (panel && options.dir) backdrop.setAttribute('dir', options.dir);
  backdrop.append(box);
  // The panel this one opens over steps back while it is open.
  const under = panel ? [...doc.querySelectorAll('.fd-form-panel')].pop() : undefined;
  under?.setAttribute('data-behind', '');
  container.append(backdrop);

  const handle = mountViewer(body, { ...options, page: look && !options.page.look ? { ...options.page, look } : options.page, showActions: false });
  let done = false;
  if (options.recompute) recalculate(handle.form, options.page.fields, options.recompute, () => done);

  // Into the dialog: its first field, once the record is in, or the dialog itself meanwhile.
  const firstField = () => body.querySelector<HTMLElement>('input:not([type="hidden"]), select, textarea, [contenteditable="true"]');
  (firstField() ?? box).focus();
  void handle.form.settled().then(() => {
    if (doc.activeElement === box || !box.contains(doc.activeElement)) firstField()?.focus();
  });

  return new Promise((resolve) => {
    const close = (saved: boolean) => {
      if (done) return;
      done = true;
      const state = handle.form.getState();
      // The form never changes its values in place, so these are safe to hand back.
      const result: FormDialogResult = { saved, recordId: state.recordId ?? null, values: state.values as Values };
      handle.destroy();
      backdrop.remove();
      under?.removeAttribute('data-behind');
      opener?.focus();
      resolve(result);
    };
    /** "Discard your changes?" over the panel, the focus on Cancel; true for Discard. Its keys are its own. */
    const ask = () =>
      new Promise<boolean>((answer) => {
        const was = doc.activeElement as HTMLElement | null;
        const text = make('p', { id: `${id}-ask` }, labels.discardChanges);
        const no = make('button', { type: 'button', class: 'fd-button' }, labels.cancel);
        const yes = make('button', { type: 'button', class: 'fd-button fd-button-primary' }, labels.discard);
        const buttons = make('div', { class: 'fd-actions fd-actions-end' });
        const question = make('div', { class: 'fd-dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': text.id });
        const shade = make('div', { class: 'fd-dialog-backdrop' });
        buttons.append(no, yes);
        question.append(text, buttons);
        shade.append(question);
        const end = (discarding: boolean) => {
          shade.remove();
          was?.focus();
          answer(discarding);
        };
        no.addEventListener('click', () => end(false));
        yes.addEventListener('click', () => end(true));
        shade.addEventListener('keydown', (event) => {
          event.stopPropagation();
          if (event.key === 'Escape') end(false);
          else keepTabIn(question, event);
        });
        box.append(shade);
        no.focus();
      });
    /** Escape and ×: a panel with changes in it asks first; a dialog closes at once, as it always has. */
    const leave = async () => {
      if (!panel || !handle.form.getState().dirty.length || (await ask())) close(false);
    };
    saveClose.addEventListener('click', async () => {
      saveClose.disabled = true;
      const accepted = options.mode === 'values' ? handle.check() : await handle.save();
      saveClose.disabled = false;
      if (accepted) close(true);
    });
    discard.addEventListener('click', () => close(false));
    closeButton.addEventListener('click', leave);
    box.addEventListener('keydown', (event) => {
      // Ctrl+Enter is Save & Close from wherever the cursor is, even after a field used the Enter
      // (a tag box adding its tag), taking what is still being typed. The grid keeps its own keys.
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing) {
        if ((event.target as Element).closest('.ag-root-wrapper')) return;
        event.preventDefault();
        doc.activeElement?.dispatchEvent(new Event('change', { bubbles: true }));
        saveClose.click();
        return;
      }
      // A key a field used itself (Escape closing a list) is not the dialog's.
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        void leave();
      } else keepTabIn(box, event);
    });
  });
}

/** Each change of the values asks for them recalculated, and shows the answer unless they changed again meanwhile. */
function recalculate(form: ViewerHandle['form'], fields: Record<string, unknown>, recompute: (values: Values) => Promise<Values>, closed: () => boolean) {
  let seen = JSON.stringify(form.getState().values);
  let writing = false;
  form.subscribe(() => {
    const values = form.getState().values as Values;
    const now = JSON.stringify(values);
    if (writing || now === seen) return;
    seen = now;
    recompute(values).then(
      (next) => {
        if (closed() || JSON.stringify(form.getState().values) !== now) return; // a newer answer is on its way
        writing = true;
        for (const [name, value] of Object.entries(next)) {
          if (name in fields && JSON.stringify(values[name] ?? null) !== JSON.stringify(value ?? null)) form.setValue(name, value);
        }
        writing = false;
        seen = JSON.stringify(form.getState().values);
      },
      () => undefined
    );
  });
}

export interface SearchDialogOptions {
  title: string;
  /** Finds records for what is typed: the field's own search, filter and all. */
  search(query: string, limit: number): Promise<RelatedRecord[]>;
  /** A language tag; the dialog's words are in it when Fieldia has them, English otherwise. */
  locale?: string;
  skin?: Skin;
  dir?: 'ltr' | 'rtl';
  /** Where the dialog goes: the document's body by default. */
  container?: HTMLElement;
  /** The look of the page that opened it: its accent, scheme, font, room and corners. */
  look?: PageLook;
}

/**
 * A searchable list in a dialog, for "Search more…": every record the field may
 * point to, narrowed as the person types, picked with a click or the keyboard.
 * Resolves with the record picked, or null when closed.
 */
export function openSearchDialog(options: SearchDialogOptions): Promise<RelatedRecord | null> {
  const doc = options.container?.ownerDocument ?? document;
  const container = options.container ?? doc.body;
  const opener = doc.activeElement instanceof doc.defaultView!.HTMLElement ? (doc.activeElement as HTMLElement) : null;
  const locale = ownLocale(options.locale);
  const labels = VIEWER_LABELS[locale];
  const words = WIDGET_LABELS[locale];
  const id = `fd-dialog-${++dialogs}`;
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string) => {
    const element = doc.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const title = make('h2', { id: `${id}-title`, class: 'fd-form-dialog-title' }, options.title);
  const closeButton = make('button', { type: 'button', class: 'fd-dialog-close', 'aria-label': labels.close }, '×');
  const query = make('input', { type: 'search', class: 'fd-input', 'aria-label': words.search, placeholder: words.search, 'aria-controls': `${id}-list`, autocomplete: 'off' });
  const list = make('ul', { id: `${id}-list`, class: 'fd-search-list', role: 'listbox', 'aria-labelledby': title.id });
  const cancel = make('button', { type: 'button', class: 'fd-button' }, labels.cancel);
  const box = make('div', {
    class: `fd-theme fd-form-dialog fd-search-dialog fd-size-small`,
    'data-fd-skin': options.skin ?? 'underline',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': title.id,
  });
  if (options.dir) box.setAttribute('dir', options.dir);
  applyLook(box, options.look);
  const head = make('div', { class: 'fd-form-dialog-head' });
  head.append(title, closeButton);
  const body = make('div', { class: 'fd-form-dialog-body fd-search-body' });
  body.append(query, list);
  const foot = make('div', { class: 'fd-actions fd-actions-end fd-form-dialog-foot' });
  foot.append(cancel);
  box.append(head, body, foot);
  const backdrop = make('div', { class: 'fd-dialog-backdrop fd-form-dialog-backdrop' });
  backdrop.append(box);
  container.append(backdrop);
  query.focus();

  return new Promise((resolve) => {
    let found: RelatedRecord[] = [];
    let active = -1;
    let asked = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const close = (picked: RelatedRecord | null) => {
      clearTimeout(timer);
      asked++;
      backdrop.remove();
      opener?.focus();
      resolve(picked);
    };
    const draw = () => {
      list.replaceChildren(
        ...found.map((record, i) => {
          const option = make('li', { id: `${id}-option-${i}`, role: 'option', class: `fd-option${i === active ? ' fd-active' : ''}`, 'aria-selected': String(i === active) }, record.label);
          option.addEventListener('click', () => close(record));
          return option;
        })
      );
      if (!found.length) list.append(make('li', { class: 'fd-empty' }, words.noResults));
      if (active >= 0) query.setAttribute('aria-activedescendant', `${id}-option-${active}`);
      else query.removeAttribute('aria-activedescendant');
    };
    const look = () => {
      clearTimeout(timer);
      const mine = ++asked;
      timer = setTimeout(async () => {
        const records = await options.search(query.value, 80).catch(() => [] as RelatedRecord[]);
        if (mine !== asked) return; // a newer search, or the dialog closed
        found = records;
        active = -1;
        draw();
      }, 180);
    };
    query.addEventListener('input', look);
    query.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!found.length) return;
        active = (active + (event.key === 'ArrowDown' ? 1 : -1) + found.length) % found.length;
        draw();
        list.children[active]?.scrollIntoView?.({ block: 'nearest' });
      } else if (event.key === 'Enter' && active >= 0) {
        event.preventDefault();
        close(found[active]);
      }
    });
    cancel.addEventListener('click', () => close(null));
    closeButton.addEventListener('click', () => close(null));
    box.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(null);
      } else keepTabIn(box, event);
    });
    look();
  });
}
