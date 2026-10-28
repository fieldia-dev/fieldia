import { wordsComing, wordsReady, type LeaveHow, type PanelSide, type RelatedRecord, type Values } from '@fieldia/core';
import { drawIcon, settleParts, WIDGET_LABELS } from '@fieldia/widgets';
import type { FormDialogOptions, FormDialogResult, FormPanelOptions, SearchDialogOptions } from './dialog';
import { FIRST_FIELD, focusField } from './focus-field';
import { ownLocale, VIEWER_LABELS, viewerWords } from './labels';
import { keepTabIn } from './focus-trap';
import { stayed } from './discard';
import { applyLook, skinFor, wearTokens } from './look';
import { hotkeyOf, hotkeyOn } from './hotkeys';
import { steadyPresses } from './steady-press';
import type { mountViewer, ViewerHandle } from './viewer';
import { headPart, partsFor } from './viewer-parts';
import { waitWords } from './waiting';

/**
 * The acts part's dialogs (dialog.ts names them and what they take): a page in a dialog or a side panel, and a searchable
 * list for "Search more…" — drawn by no page as it is first drawn, so loaded once it is (viewer-parts.ts, `actsPart`).
 */

let dialogs = 0;

/**
 * What draws the page in the box: the viewer's `mountViewer`, handed over by what opens it (dialog.ts, open.ts) — a part
 * never imports the viewer's own module (an app bundled whole would start it early: duplicates-lazy.spec.ts).
 */
export type Mount = typeof mountViewer;

/** The dialogs' way to make an element of a document: a tag, its attributes, and its words. */
const maker =
  (doc: Document) =>
  <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string) => {
    const element = doc.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
    if (text !== undefined) element.textContent = text;
    return element;
  };
/** A page in a dialog (dialog.ts). */
export function openFormDialog(options: FormDialogOptions, mount: Mount): Promise<FormDialogResult> {
  return openForm(options, mount, `fd-size-${options.size ?? 'medium'}`);
}

/** A page in a side panel (dialog.ts says how it opens and closes): the dialog's box at the edge it names. */
export function openFormPanel(options: FormPanelOptions, mount: Mount): Promise<FormDialogResult> {
  const side = options.side ?? 'end';
  return openForm(options, mount, `fd-form-panel ${side === 'top' || side === 'bottom' ? `fd-height-${options.height ?? 'medium'}` : `fd-width-${options.width ?? 'medium'}`}`, side);
}

/**
 * A dialog or a panel (from its side): a page in a box with a head, a body that
 * scrolls and a foot; `shape` is the box's own classes. A page whose sheet has
 * a head of its own (`SheetHead`) is its own head and foot: the dialog draws
 * neither, its ⤢ and × at the end of the head's badge row, named by the badge
 * and the title, and asks before Escape or × drop changes, as a panel does.
 */
function openForm(options: FormDialogOptions, mount: Mount, shape: string, side?: PanelSide): Promise<FormDialogResult> {
  const doc = options.container?.ownerDocument ?? document;
  // What has the focus as it is asked for gets it back as it closes, though the box waits for its parts.
  const opener = doc.activeElement instanceof doc.defaultView!.HTMLElement ? (doc.activeElement as HTMLElement) : null;
  // The parts its page draws from, and the head part for a work item's window (inset, clear, ⤢, a grip): the box opens
  // once they are in, drawn whole — at once when they are already.
  const windowed = !side && (options.size === 'inset' || options.backdrop === 'clear' || !!options.maximise || !!options.resizable);
  const parts = [...partsFor(options.page, options.widgets, options.slots), ...(windowed ? [headPart] : [])].filter((part) => !part.loaded);
  // And its language's words where they come in a chunk of their own (every language but English, 0.35): its ⤢, its
  // grip and its foot are named in them from the start, as the viewer inside it draws in them.
  const words = wordsComing(options.locale) ? wordsReady(options.locale) : null;
  if (!parts.length && !words) return openNow(options, mount, shape, side, opener);
  return Promise.all([settleParts(parts), words]).then(() => openNow(options, mount, shape, side, opener));
}

function openNow(options: FormDialogOptions, mount: Mount, shape: string, side: PanelSide | undefined, opener: HTMLElement | null): Promise<FormDialogResult> {
  // Its viewer taken away while its parts came: never opened.
  if (options.signal?.aborted) return Promise.resolve({ saved: false, recordId: null, values: {} });
  const panel = !!side;
  const layout = options.page.layout;
  /** The head part's window tools and look; drawn plainly where it could not come. */
  const kit = headPart.loaded;
  const headed = !panel && layout.type === 'sheet' && !!layout.head && !!kit;
  const doc = options.container?.ownerDocument ?? document;
  const container = options.container ?? doc.body;
  // The window's look (inset, clear, ⤢, its grip, a head as its own head) in the page before the box is.
  if (kit && !panel && (headed || options.size === 'inset' || options.backdrop === 'clear' || options.maximise || options.resizable)) kit.installHeadStyles(doc);
  const labels = viewerWords(ownLocale(options.locale), options.labels);
  const id = `fd-dialog-${++dialogs}`;
  const make = maker(doc);

  const title = make('h2', { id: `${id}-title`, class: 'fd-form-dialog-title' }, options.title);
  const closeButton = make('button', { type: 'button', class: 'fd-dialog-close', 'aria-label': labels.close, title: labels.close });
  const closeIcon = headed ? drawIcon(doc, 'close') : null;
  if (closeIcon) closeButton.append(closeIcon);
  else closeButton.textContent = '×';
  // ⤢ fills the window with it, and Restore puts it back.
  const maximise = options.maximise && !panel && kit ? make('button', { type: 'button', class: 'fd-dialog-max', 'aria-label': labels.maximise, title: labels.maximise }) : null;
  const grip = options.resizable && !panel && kit ? make('button', { type: 'button', class: 'fd-dialog-grip', 'aria-label': labels.resize, title: labels.resize, 'aria-keyshortcuts': 'ArrowLeft ArrowRight ArrowUp ArrowDown' }) : null;
  const body = make('div', { class: 'fd-form-dialog-body' });
  const discard = make('button', { type: 'button', class: 'fd-button' }, labels.discard);
  const saveClose = make('button', { type: 'button', class: 'fd-button fd-button-primary' }, panel && options.mode === 'values' ? labels.done : labels.saveClose);
  // One look for the box and the page in it: the page's own, else the opener's; the viewer's theme over either.
  const look = options.page.look ?? options.look;
  const theme = options.theme ?? look?.theme;
  const box = make('div', {
    // Its own tokens and skin: the dialog sits outside the page that opened it.
    class: `fd-theme fd-form-dialog ${shape}`,
    'data-fd-skin': skinFor(options.skin ?? look?.skin, theme),
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': title.id,
    tabindex: '-1',
  });
  if (side) box.setAttribute('data-side', side);
  if (options.dir) box.setAttribute('dir', options.dir);
  if (headed) box.setAttribute('data-headed', '');
  applyLook(box, theme ? { ...look, theme } : look);
  wearTokens(box, options.tokens);
  // A page with a head of its own is the dialog's head and foot: the dialog draws neither.
  if (headed) box.append(body);
  else {
    box.append(make('div', { class: 'fd-form-dialog-head' }), body, make('div', { class: 'fd-actions fd-actions-end fd-form-dialog-foot' }));
    box.firstElementChild?.append(title, ...(maximise ? [maximise] : []), closeButton);
  }
  if (grip) box.append(grip);
  // A page's own buttons at its foot, as a wizard's, stand in place of Discard and Save & Close.
  const footer = options.page.layout.type === 'sections' || options.page.layout.type === 'sheet' ? (options.page.layout.footer ?? []) : [];
  const own = footer.map((node) => ({ node, button: make('button', { type: 'button', class: `fd-button fd-button-${node.style ?? 'secondary'}`, 'data-node': node.id }, node.label) }));
  for (const { node, button } of own) if (node.hotkey) hotkeyOn(button, node.hotkey, node.label);
  if (!headed) box.querySelector('.fd-form-dialog-foot')?.append(...(own.length ? own.map((b) => b.button) : [discard, saveClose]));
  // What a way out waits for — the save on its way, files on theirs — said at its foot (a head of its own: under it).
  const waiting = make('div', { class: 'fd-status fd-dialog-waiting', role: 'status', 'aria-live': 'polite', hidden: '' });
  if (headed) box.append(waiting);
  else box.querySelector('.fd-form-dialog-foot')?.prepend(waiting);
  const backdrop = make('div', { class: `fd-dialog-backdrop fd-form-dialog-backdrop${panel ? ' fd-form-panel-backdrop' : ''}${options.backdrop === 'clear' ? ' fd-backdrop-clear' : ''}` });
  backdrop.append(box);
  // The panel this one opens over steps back while it is open.
  const under = panel ? [...doc.querySelectorAll('.fd-form-panel')].pop() : undefined;
  under?.setAttribute('data-behind', '');
  container.append(backdrop);
  // Its own buttons — Save & Close, Discard, × — take only presses aimed at them, as the form's do.
  const steady = steadyPresses(box);

  // A host of its own, so its steps run here too. Its form takes this close once, and puts its one check before it:
  // a `close` step closes it once nothing of the person's is at risk, or they let it go — saved, when a save went through.
  let handle: ViewerHandle;
  try {
    handle = mount(body, {
      ...options,
      page: look && !options.page.look ? { ...options.page, look } : options.page,
      showActions: false,
      // A dialog has no pager or breadcrumbs: they belong to the record under it.
      records: undefined,
      breadcrumbs: undefined,
      host: { ...options.host, close: () => close(false) },
    });
  } catch {
    // A page the viewer refuses (refused.ts): its words stay where the form would be, and × or Escape lets the box go —
    // never a box nothing closes, nor a failure left to whoever opened it (0.36.1).
    if (!closeButton.isConnected) box.prepend(closeButton);
    closeButton.focus();
    return new Promise((resolve) => {
      const shut = (event: Event) => {
        if (event.type !== 'click' && (event as KeyboardEvent).key !== 'Escape') return;
        backdrop.remove();
        under?.removeAttribute('data-behind');
        opener?.focus();
        resolve({ saved: false, recordId: null, values: {} });
      };
      box.onkeydown = closeButton.onclick = shut;
    });
  }
  // A panel runs the way its page does, its language's way unless told: the inline end it sits at is the left, right to left.
  if (panel && handle.element.dir) backdrop.dir = handle.element.dir;
  // A dialog round a page with a head: its ⤢ and × at the end of the head's badge row, and named by the badge and the title.
  if (headed) {
    if (handle.element.dir && !options.dir) box.dir = handle.element.dir;
    const slot = body.querySelector('.fd-head-window');
    slot?.append(...(maximise ? [maximise] : []), closeButton);
    const names = [...body.querySelectorAll<HTMLElement>('[data-head-name]')].map((part) => part.id).filter(Boolean);
    if (names.length) box.setAttribute('aria-labelledby', names.join(' '));
    else box.setAttribute('aria-label', options.title);
  }
  // A record its source lets the person only read has nothing to save: no Save & Close, and Close in place of Discard.
  // Nor has a list of records (an `open` step's, a related list's View all): its records open on their own.
  const listing = options.page.layout.type === 'list';
  const mayEdit = () => {
    const may = !listing && (options.mode === 'values' || handle.form.getState().can?.edit !== false);
    saveClose.hidden = !may;
    discard.textContent = may ? labels.discard : labels.close;
  };
  mayEdit();
  handle.form.subscribe(mayEdit);
  const fill = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
  const sayWaiting = () => {
    const words = waitWords(handle.form.getState(), labels, options.page.data.kind === 'responses', fill);
    if (waiting.textContent !== words) waiting.textContent = words;
    waiting.hidden = !words;
  };
  handle.form.subscribe(sayWaiting);
  if (maximise) kit?.wireMaximise(box, maximise, labels, doc);
  if (grip) kit?.wireGrip(box, grip, doc);
  let done = false;
  /** Once a save or a send in it went through, every way it closes says saved: the record it made is the caller's. */
  let savedAny = false;
  handle.on('save', () => (savedAny = true));
  handle.on('send', () => (savedAny = true));
  let close = (saved: boolean) => void saved;
  if (options.recompute) recalculate(handle.form, options.page.fields, options.recompute, () => done);

  // Into the dialog: its field that takes the focus (focus) or its first, once the record is in, or the dialog itself meanwhile.
  // A page with a head of its own opens at rest, as a work item does: the dialog holds the focus until the page names a field for it.
  const firstField = () => focusField(body) ?? (headed ? null : body.querySelector<HTMLElement>(FIRST_FIELD));
  (firstField() ?? box).focus();
  void handle.form.settled().then(() => {
    if (doc.activeElement === box || !box.contains(doc.activeElement)) firstField()?.focus();
  });

  return new Promise((resolve) => {
    // The viewer that opened it taken away: it goes with it, as not saved — the app took the page away, nothing asked.
    const gone = () => close(false);
    options.signal?.addEventListener('abort', gone, { once: true });
    close = (saved: boolean) => {
      if (done) return;
      done = true;
      options.signal?.removeEventListener('abort', gone);
      const state = handle.form.getState();
      // The form never changes its values in place, so these are safe to hand back. A change let go after a save (Discard
      // on "Discard your changes?") went back to the record as saved as it was let go: it is no value handed back.
      const result: FormDialogResult = { saved: saved || savedAny, recordId: state.recordId ?? null, values: state.values as Values };
      handle.destroy();
      steady();
      backdrop.remove();
      under?.removeAttribute('data-behind');
      opener?.focus();
      resolve(result);
    };
    /**
     * Close once the form's one check lets its values go (`form.leave()`): it waits for a save on its way and files on
     * theirs — the dialog saying so — then asks "Discard your changes?" when the person's work is at risk, and keeps the
     * dialog open on Cancel. Escape and × count every change not saved, in every dialog and panel: nothing else saves
     * what was typed in it (0.25 asked so only in a panel, a dialog round a page with a head and a line's own; a
     * related list's New or row, a calendar's New and an `open` step's dialog let the typing go unasked). Discard asks
     * nothing, but waits too: a save that went through meanwhile closes it saved.
     */
    const closeChecked = async (saved: boolean, how?: LeaveHow): Promise<void> => {
      if (done) return;
      // Nothing to wait for and nothing at risk: closed at once, as it always has been.
      if (handle.form.leaveNow(how)) return close(saved);
      if ((await handle.form.leave(how)) && !done) close(saved);
    };
    // A dialog or a panel holds what was typed and nothing else saves it: every change counts.
    const leave = () => closeChecked(false, { changes: true });
    saveClose.addEventListener('click', async () => {
      const had = doc.activeElement === saveClose;
      saveClose.disabled = true;
      // Values checked, not saved: a name still being looked up in a box is waited for first, as a save waits for it.
      if (options.mode === 'values') {
        const waiting = handle.form.settle();
        if (handle.form.reading()) await waiting;
      }
      const accepted = options.mode === 'values' ? handle.check() : await handle.save();
      saveClose.disabled = false;
      // Disabled while it saved, it let go of the focus: it takes it back, unless the person went on elsewhere in the box.
      if (had && !box.contains(doc.activeElement)) saveClose.focus();
      if (accepted) await closeChecked(true);
    });
    // Discard is the person's own answer: no question.
    discard.addEventListener('click', () => void closeChecked(false, { discard: true }));
    // A footer button runs its steps; once they saved or sent, the dialog closes with the answers.
    let saved = false;
    handle.on('save', () => (saved = true));
    handle.on('send', () => (saved = true));
    const shown = () => {
      for (const { node, button } of own) button.hidden = handle.form.node(node.id).invisible;
    };
    if (own.length) {
      shown();
      handle.form.subscribe(shown);
    }
    for (const { node, button } of own) {
      button.addEventListener('click', async () => {
        if (button.hasAttribute('aria-busy')) return;
        button.setAttribute('aria-busy', 'true');
        saved = false;
        const result = await handle.form.runAction(node.id);
        button.removeAttribute('aria-busy');
        if (done) return;
        // Saved, it closes — unless a step of the same run took a way out and the person chose to stay: asked once.
        if (saved && !stayed(result)) await closeChecked(true);
        // A check or a save that stopped them shows its problems, as Save & Close does.
        else if (result.reason === 'check' || result.reason === 'save') handle.check();
      });
    }
    closeButton.addEventListener('click', leave);
    // A footer button's key, with Alt, and the keys shown while Alt is held.
    box.addEventListener('keyup', (event) => event.key === 'Alt' && box.removeAttribute('data-hotkeys'));
    box.addEventListener('keydown', (event) => {
      if (event.key === 'Alt') box.setAttribute('data-hotkeys', '');
      const key = hotkeyOf(event);
      const pressed = key ? own.find(({ node, button }) => node.hotkey === key && !button.hidden && !(button as HTMLButtonElement).disabled)?.button : undefined;
      if (pressed) {
        event.preventDefault();
        box.removeAttribute('data-hotkeys');
        pressed.click();
        return;
      }
      // Ctrl+Enter is Save & Close from wherever the cursor is, even after a field used the Enter
      // (a tag box adding its tag), taking what is still being typed. The grid keeps its own keys.
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing) {
        if ((event.target as Element).closest('.ag-root-wrapper')) return;
        event.preventDefault();
        doc.activeElement?.dispatchEvent(new Event('change', { bubbles: true }));
        // With buttons of its own, the page's primary one; else Save & Close.
        if (own.length) own.find(({ node, button }) => node.style === 'primary' && !button.hidden)?.button.click();
        else if (!saveClose.hidden) saveClose.click();
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
        // The answer is the app's change, not a person's: the page's change steps do not run for it.
        const changed = Object.fromEntries(Object.entries(next).filter(([name, value]) => name in fields && JSON.stringify(values[name] ?? null) !== JSON.stringify(value ?? null)));
        if (Object.keys(changed).length) form.setValues(changed);
        writing = false;
        seen = JSON.stringify(form.getState().values);
      },
      () => undefined
    );
  });
}
/** A searchable list in a dialog, for "Search more…" (dialog.ts): the record picked, or null when closed. */
export function openSearchDialog(options: SearchDialogOptions): Promise<RelatedRecord | null> {
  const doc = options.container?.ownerDocument ?? document;
  const container = options.container ?? doc.body;
  const opener = doc.activeElement instanceof doc.defaultView!.HTMLElement ? (doc.activeElement as HTMLElement) : null;
  const locale = ownLocale(options.locale);
  const labels = VIEWER_LABELS[locale];
  const words = WIDGET_LABELS[locale];
  const id = `fd-dialog-${++dialogs}`;
  const make = maker(doc);
  const title = make('h2', { id: `${id}-title`, class: 'fd-form-dialog-title' }, options.title);
  const closeButton = make('button', { type: 'button', class: 'fd-dialog-close', 'aria-label': labels.close }, '×');
  const query = make('input', { type: 'search', class: 'fd-input', 'aria-label': words.search, placeholder: words.search, 'aria-controls': `${id}-list`, autocomplete: 'off' });
  const list = make('ul', { id: `${id}-list`, class: 'fd-search-list', role: 'listbox', 'aria-labelledby': title.id });
  const cancel = make('button', { type: 'button', class: 'fd-button' }, labels.cancel);
  const box = make('div', {
    class: `fd-theme fd-form-dialog fd-search-dialog fd-size-small`,
    'data-fd-skin': skinFor(options.skin ?? options.look?.skin, options.theme ?? options.look?.theme),
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': title.id,
  });
  if (options.dir) box.setAttribute('dir', options.dir);
  const searchTheme = options.theme ?? options.look?.theme;
  applyLook(box, searchTheme ? { ...options.look, theme: searchTheme } : options.look);
  wearTokens(box, options.tokens);
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
      options.signal?.removeEventListener('abort', gone);
      backdrop.remove();
      opener?.focus();
      resolve(picked);
    };
    const gone = () => close(null);
    options.signal?.addEventListener('abort', gone, { once: true });
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
