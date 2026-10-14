import type { Form, FormState, LineField, Locale, Page, RecordPermissions, Values } from '@fieldia/core';
import { displayValue, drawIcon, type IconSet } from '@fieldia/widgets';
import { setAttr, setHidden, setText, type El } from './dom';
import type { ViewerLabels } from './labels';

/** What the save-safety parts need of the viewer that draws them. */
export interface SaveSafetyContext {
  doc: Document;
  el: El;
  form: Form;
  page: Page;
  labels: ViewerLabels;
  locale: Locale;
  /** The page's language tag, for the way it writes a time: `en-US` says 10:42 AM. */
  tag?: string;
  icons?: IconSet;
  fill(template: string, values: Record<string, string | number>): string;
  /** Said at once to a screen reader. */
  announce(text: string): void;
  /** The form's own element: a field put back takes the focus there, never in another form on the page. */
  root(): HTMLElement;
  /** "Discard your changes?", the focus on Cancel: true to let the changes set aside go. */
  discard(): Promise<boolean>;
}

/** A field's box that takes the focus: one a person types or chooses in, shown. */
const FIELD_BOX = 'input:not([type="hidden"]):not([hidden]), select:not([hidden]), textarea:not([hidden]), [contenteditable="true"]';

/**
 * The parts of a record that keep a person's work safe, each drawn over the
 * record and hidden until it has something to say:
 *
 * - a save over someone else's: who changed the record and when, what they
 *   changed and what both did, with Reload and Keep mine;
 * - after Reload, the person's own changes set aside, each to put back;
 * - a record its source lets the person only read, and why.
 */
export function saveSafety(context: SaveSafetyContext): { elements: HTMLElement[]; update(state: FormState): void } {
  const { el, form, labels, fill } = context;
  const fieldLabel = (name: string) => context.page.fields[name]?.label ?? name;
  const list = listWords(context.tag ?? context.locale);

  /**
   * After a button here that hid itself, or the part it was in: the focus to the first of these fields shown, so a
   * screen reader says where the person is; else the form's first field; never left on the page's body.
   */
  function focusOn(names: readonly string[]) {
    const root = context.root();
    const shown = (wrapper: Element) => !wrapper.closest('[hidden]');
    for (const name of names) {
      const box = [...root.querySelectorAll<HTMLElement>(`.fd-field[data-field="${name}"]`)].filter(shown).map((wrapper) => wrapper.querySelector<HTMLElement>(FIELD_BOX)).find(Boolean);
      if (box) return box.focus();
    }
    const first = [...root.querySelectorAll<HTMLElement>(FIELD_BOX)].find(shown);
    if (first) return first.focus();
    if (!root.hasAttribute('tabindex')) root.tabIndex = -1;
    root.focus();
  }
  /** Whether the focus went nowhere: to the page's body, or with an element now hidden or gone. */
  const focusLost = () => {
    const active = context.doc.activeElement;
    return !active || active === context.doc.body || !active.isConnected || !!active.closest('[hidden]');
  };

  // ---- someone else saved first --------------------------------------------------------------------
  const title = el('strong', { class: 'fd-conflict-title' });
  const changed = el('span', { class: 'fd-conflict-fields' });
  const choice = el('span', { class: 'fd-conflict-hint' }, labels.conflictChoice);
  // Keep mine could not read their version: nothing was saved over it, said before the choice.
  const unreadWords = el('strong', { class: 'fd-conflict-unread' });
  // Its words are said as it shows, the choice of buttons with them.
  const words = el('div', { class: 'fd-conflict-words', role: 'alert' });
  const reload = el('button', { type: 'button', class: 'fd-button' }, labels.reload);
  const keep = el('button', { type: 'button', class: 'fd-button fd-button-primary' }, labels.keepMine);
  const icon = drawIcon(context.doc, 'warning', context.icons);
  const conflict = el('div', { class: 'fd-conflict', hidden: '' }, ...(icon ? [el('span', { class: 'fd-conflict-icon', 'aria-hidden': 'true' }, icon)] : []), words, el('div', { class: 'fd-conflict-actions' }, reload, keep));
  /** One answer at a time: the buttons busy while it runs. */
  const answer = async (run: () => Promise<boolean>) => {
    if (conflict.hasAttribute('aria-busy')) return;
    conflict.setAttribute('aria-busy', 'true');
    try {
      return await run();
    } finally {
      conflict.removeAttribute('aria-busy');
    }
  };
  reload.addEventListener('click', () =>
    void answer(async () => {
      const before = form.getState();
      const changedNow = [...(before.conflict?.changed ?? []), ...before.dirty];
      const done = await form.reloadTheirs();
      if (!done) return false;
      // The changes set aside take the focus, so the person hears what was kept for them; with none, the first field
      // that changed does, and they are told it reloaded.
      if (form.getState().setAside) asideTitle.focus();
      else {
        focusOn(changedNow);
        context.announce(labels.reloaded);
      }
      return true;
    })
  );
  keep.addEventListener('click', () =>
    void answer(async () => {
      const unread = form.getState().conflict?.unread === true;
      const mine = [...form.getState().dirty];
      const done = await form.keepMine();
      // Their version still unread: the banner's words are the same, so they are said again.
      if (!done && unread && form.getState().conflict?.unread) context.announce(form.getState().saveProblem?.message ?? '');
      // The banner gone with the button that had the focus: to the first of the person's changes, kept.
      if (focusLost()) focusOn(mine);
      return done;
    })
  );

  // ---- the person's changes, set aside by Reload ---------------------------------------------------------
  const asideTitle = el('p', { class: 'fd-set-aside-title', tabindex: '-1' }, labels.setAside);
  const rows = el('ul', { class: 'fd-set-aside-list' });
  const all = el('button', { type: 'button', class: 'fd-button' }, labels.putAllBack);
  // Every change put back, the list goes: the focus to the first of them.
  all.addEventListener('click', () => {
    const names = Object.keys(form.getState().setAside ?? {});
    form.putBack();
    focusOn(names);
  });
  const dismiss = el('button', { type: 'button', class: 'fd-alert-close', 'aria-label': labels.dismiss, title: labels.dismiss }, '×');
  // Letting them go is a discard, asked as every other is: Cancel keeps them, and the focus here.
  let asking = false;
  dismiss.addEventListener('click', async () => {
    if (asking) return;
    asking = true;
    const names = Object.keys(form.getState().setAside ?? {});
    try {
      if (!(await context.discard())) return;
    } finally {
      asking = false;
    }
    form.discardSetAside();
    focusOn(names);
  });
  const asideId = `fd-set-aside-${++drawn}`;
  asideTitle.id = `${asideId}-title`;
  // Named by its words only while shown: hidden, its "not saved" must not answer for a field's label ("No").
  const aside = el('section', { class: 'fd-set-aside', hidden: '' }, el('div', { class: 'fd-set-aside-head' }, asideTitle, dismiss), rows, all);
  let shownAside: Readonly<Values> | null = null;

  // ---- a record the person may only read ------------------------------------------------------------------
  const lock = drawIcon(context.doc, 'lock', context.icons);
  const noteWords = el('span');
  const note = el('div', { class: 'fd-read-only-note', role: 'status', hidden: '' }, ...(lock ? [el('span', { class: 'fd-read-only-icon', 'aria-hidden': 'true' }, lock)] : []), noteWords);

  function update(state: FormState) {
    // Someone else saved first: their name and time, and what each changed, while the person chooses.
    const found = state.conflict;
    setHidden(conflict, !found);
    if (found) {
      const name = found.version.by || labels.someoneElse;
      const time = found.version.at ? timeWords(found.version.at, context.tag, context.locale) : '';
      setText(title, time ? fill(labels.conflictAt, { name, time }) : fill(labels.conflictSince, { name }));
      const theirs = found.changed.length ? fill(labels.conflictChanged, { fields: list(found.changed.map(fieldLabel)) }) : '';
      const both = found.both.length ? fill(labels.conflictBoth, { fields: list(found.both.map(fieldLabel)) }) : '';
      setText(changed, [theirs, both].filter(Boolean).join(' '));
      setText(unreadWords, found.unread ? (state.saveProblem?.message ?? '') : '');
      // Written once each time it shows, so a screen reader says it whole: again when Keep mine could not read theirs.
      const key = `${found.version.token}${found.unread ? ' unread' : ''}`;
      if (!words.firstChild || words.getAttribute('data-for') !== key) {
        words.replaceChildren(title, ' ', changed, ' ', ...(found.unread ? [unreadWords, ' '] : []), choice);
        words.setAttribute('data-for', key);
      }
    } else if (words.firstChild) {
      words.replaceChildren();
      words.removeAttribute('data-for');
    }

    // The changes set aside, drawn again when they change: each with what it held, what the record holds now, and Put back.
    if (state.setAside !== shownAside) {
      shownAside = state.setAside;
      const names = Object.keys(shownAside ?? {});
      rows.replaceChildren(
        ...names.map((name) => {
          const def = context.page.fields[name] as LineField | undefined;
          const shown = (value: unknown) => (def ? displayValue(def, value as Values[string], state.values as Values, context.locale) : String(value ?? ''));
          const mine = shown((shownAside as Values)[name]);
          const now = shown(state.values[name]);
          const put = el('button', { type: 'button', class: 'fd-button fd-button-link', 'aria-label': fill(labels.putBackField, { label: fieldLabel(name) }) }, labels.putBack);
          put.addEventListener('click', () => {
            form.putBack(name);
            // The focus stays in the list while it has more, else goes to the field put back.
            const next = rows.querySelector<HTMLButtonElement>('button');
            if (next) next.focus();
            else focusOn([name]);
          });
          // The words wrap on a phone; Put back keeps to the row's end, beside the change it puts back.
          return el(
            'li',
            {},
            el(
              'span',
              { class: 'fd-set-aside-what' },
              el('span', { class: 'fd-set-aside-label' }, fieldLabel(name)),
              el('bdi', { class: 'fd-set-aside-mine' }, mine || '—'),
              // What it holds now, the value in its own direction: a phone number among Arabic words keeps its order.
              ...(now !== mine ? [el('span', { class: 'fd-set-aside-now' }, ...labels.nowIs.split(/(\{value\})/).map((part) => (part === '{value}' ? el('bdi', {}, now || '—') : part)))] : [])
            ),
            put
          );
        })
      );
      setHidden(all, names.length < 2);
      setHidden(aside, names.length === 0);
      setAttr(aside, 'aria-labelledby', names.length ? asideTitle.id : null);
    }

    // Only to read: the source's reason, else the viewer's words.
    const can: Readonly<RecordPermissions> | null = state.can;
    const readOnly = can?.edit === false;
    setHidden(note, !readOnly);
    setText(noteWords, readOnly ? (can?.reason ?? labels.readOnlyRecord) : '');
    setAttr(note, 'data-reason', readOnly && can?.reason ? '' : null);
  }

  return { elements: [conflict, aside, note], update };
}

let drawn = 0;

/**
 * When someone saved, as the page writes a time: the hour alone the same day,
 * the day with it on another. Numbers in Latin digits, as the form's dates.
 */
export function timeWords(at: string, tag: string | undefined, locale: Locale, now = new Date()): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return '';
  const lang = tag && tag.includes('-') ? tag : locale === 'en' ? 'en-GB' : locale;
  const sameDay = date.toDateString() === now.toDateString();
  const day = sameDay ? {} : { day: 'numeric' as const, month: 'short' as const, ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' as const }) };
  return new Intl.DateTimeFormat(lang, { ...day, hour: '2-digit', minute: '2-digit', numberingSystem: 'latn' }).format(date);
}

/** Names in a list, as the language joins them: "Stage, Budget", "المرحلة، الميزانية". */
function listWords(tag: string): (names: string[]) => string {
  const separator = tag.split('-')[0] === 'ar' ? '، ' : ', ';
  return (names) => names.join(separator);
}

/** The words for the gear menu's built-ins the source does not open to this person, or null when it opens them all, or the record is only to be read (said over the record). */
export function barredWords(can: Readonly<RecordPermissions> | null, builtins: readonly string[], labels: ViewerLabels): string | null {
  if (!can || can.edit === false) return null;
  const barred = (['archive', 'duplicate', 'delete'] as const).filter((right) => can[right] === false && builtins.some((builtin) => (builtin === 'unarchive' ? 'archive' : builtin) === right));
  if (!barred.length) return null;
  return can.reason ?? labels.notOffered.replace('{actions}', barred.map((right) => labels[right]).join(', '));
}
