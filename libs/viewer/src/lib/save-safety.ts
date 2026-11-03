import { recordSentence, dayTag, listComma, type Form, type FormState, type Locale, type Page, type RecordPermissions, intlFormat } from '@fieldia/core';
import { drawIcon, type IconSet } from '@fieldia/widgets';
import { setAttr, setHidden, setText, type El } from './dom';
import { livePart, withActs } from './viewer-parts';
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
  /** Said over the page: a part of it could not load (the acts part, which draws a save over someone else's). */
  unloaded?(): void;
}

/**
 * The parts of a record that keep a person's work safe, each drawn over the
 * record and hidden until it has something to say:
 *
 * - a save over someone else's, and after Reload the person's changes set
 *   aside (conflict-banner.ts): drawn by the acts part, which no page draws
 *   from, the first time either has something to say — at once where it has
 *   come, else as it does (`withActs`); where it cannot come, the conflict is
 *   said in plain words, who changed the record, and the page says a part of
 *   it could not load;
 * - who else has the record open (the live part's);
 * - a record its source lets the person only read, and why.
 */
export function saveSafety(context: SaveSafetyContext): { readonly elements: HTMLElement[]; update(state: FormState): void } {
  const { el, form, labels } = context;
  const list = listWords(context.tag ?? context.locale);

  // ---- someone else saved first, and the changes Reload set aside: the acts part's, asked for as they first are --------
  let banners: { elements: HTMLElement[]; update(state: FormState): void } | null = null;
  let asked = false;
  /** Where the acts part could not come, and only then: the conflict in plain words. */
  let plain: HTMLElement | null = null;

  // ---- who else has it open (the data source's `presence`): drawn by the live part, once someone else is ------
  // Hidden while nobody else is: an empty band is no part of the form.
  const presence = el('div', { class: 'fd-presence-slot', hidden: '' });
  let strip: { update(state: FormState): void } | null = null;

  // ---- a record the person may only read ------------------------------------------------------------------
  const lock = drawIcon(context.doc, 'lock', context.icons);
  const noteWords = el('span');
  const note = el('div', { class: 'fd-read-only-note', role: 'status', hidden: '' }, ...(lock ? [el('span', { class: 'fd-read-only-icon', 'aria-hidden': 'true' }, lock)] : []), noteWords);

  function update(state: FormState) {
    if (banners) banners.update(state);
    else if (!asked && (state.conflict || state.setAside)) {
      asked = true;
      void withActs((part) => part.conflictBanners(context), context.doc).then(
        (made) => {
          banners = made;
          presence.after(...made.elements);
          made.update(form.getState());
        },
        () => {
          plain = el('div', { class: 'fd-conflict', role: 'alert', hidden: '' });
          presence.after(plain);
          context.unloaded?.();
          update(form.getState());
        }
      );
    }
    if (plain) {
      const found = state.conflict;
      setHidden(plain, !found);
      setText(plain, found ? recordSentence(context.page.records, labels.conflictSinceNoun, labels.conflictSince, context.locale, { name: found.version.by || labels.someoneElse }) : '');
    }

    // Others with the record open: the live part's strip, asked for the first time someone else is.
    setHidden(presence, !state.present?.length);
    if (strip) strip.update(state);
    else if (state.present?.length) void livePart.load().then((part) => (strip ??= part.presenceStrip(el, labels, list, presence)).update(form.getState()), () => undefined);

    // Only to read: the source's reason, else the viewer's words.
    const can: Readonly<RecordPermissions> | null = state.can;
    const readOnly = can?.edit === false;
    setHidden(note, !readOnly);
    setText(noteWords, readOnly ? (can?.reason ?? recordSentence(context.page.records, labels.readOnlyRecordNoun, labels.readOnlyRecord, context.locale)) : '');
    setAttr(note, 'data-reason', readOnly && can?.reason ? '' : null);
  }

  return {
    get elements() {
      return [presence, ...(banners?.elements ?? (plain ? [plain] : [])), note];
    },
    update,
  };
}

/**
 * When someone saved, as the page writes a time: the hour alone the same day,
 * the day with it on another. Numbers in Latin digits, as the form's dates.
 */
export function timeWords(at: string, tag: string | undefined, locale: Locale, now = new Date()): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return '';
  const lang = dayTag(tag && tag.includes('-') ? tag : locale);
  const sameDay = date.toDateString() === now.toDateString();
  const day = sameDay ? {} : { day: 'numeric' as const, month: 'short' as const, ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' as const }) };
  return intlFormat('DateTimeFormat', lang, { ...day, hour: '2-digit', minute: '2-digit', numberingSystem: 'latn' }).format(date);
}

/** Names in a list, as the language joins them: "Stage, Budget", "المرحلة، الميزانية". */
export function listWords(tag: string): (names: string[]) => string {
  const separator = listComma(tag);
  return (names) => names.join(separator);
}

/** The words for the gear menu's built-ins the source does not open to this person, or null when it opens them all, or the record is only to be read (said over the record). */
export function barredWords(can: Readonly<RecordPermissions> | null, builtins: readonly string[], labels: ViewerLabels): string | null {
  if (!can || can.edit === false) return null;
  const barred = (['archive', 'duplicate', 'delete'] as const).filter((right) => can[right] === false && builtins.some((builtin) => (builtin === 'unarchive' ? 'archive' : builtin) === right));
  if (!barred.length) return null;
  return can.reason ?? labels.notOffered.replace('{actions}', barred.map((right) => labels[right]).join(', '));
}
