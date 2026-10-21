import type { Field, FieldNode, Page, Value } from '@fieldia/core';
import { lazyPart, type Part } from './parts';
import type * as TextModule from './text-part';
import type * as PathModule from './path-part';
import type * as ChoiceModule from './choice-part';
import type * as DateModule from './date-part';
import type * as LinesModule from './lines-part';
import type * as BusinessModule from './business-part';
import type * as FilesModule from './files-part';
import type * as EvidenceModule from './evidence-part';
import type * as RecordModule from './record-part';
import type * as CodesModule from './codes-part';
import type * as PinsModule from './pins-part';
import type { ShrinkOptions } from './shrink';
import type * as SurveyModule from './survey-part';
import type * as PhoneModule from './phone-part';
import type * as SlotsModule from './slots-part';
import type * as RelationsModule from './relations-part';
import type { TypedText, Widget, WidgetContext, WidgetFactory, WidgetState } from './widgets';

/** The text part: a work item's formatted text editor (rich and Markdown), Markdown both ways, its menus and the links box. */
export type TextPart = typeof TextModule;
/** The path part: a path picker, with its suggestions and its tree. */
export type PathPart = typeof PathModule;
/** The choice part: a choice in Fieldia's own list, a long one searched as it is typed, and several chosen as tags. */
export type ChoicePart = typeof ChoiceModule;
/** The date part: Fieldia's own box for a date, a date and time and a time of day, a date's calendar, a range of dates. */
export type DatePart = typeof DateModule;
/** The lines part: a one2many's table of lines, a many2many's table of records, and their stylesheet. */
export type LinesPart = typeof LinesModule;
/** The business part: a statusbar, priority stars, hours and a per cent's boxes, an analytic distribution, tax totals, payments. */
export type BusinessPart = typeof BusinessModule;
/** The files part: a file field, a picture field, files on their way to the store, photos made smaller, a signature's pad, a PDF under its file box. */
export type FilesPart = typeof FilesModule;
/**
 * The evidence part: a signature's that signs answers (`options.signs`) — the canonical form of the answers it signs,
 * their SHA-256, who and when said under it, whether the answers are still as signed, and Change answers.
 */
export type EvidencePart = typeof EvidenceModule;
/**
 * The record part: a voice note or a short film recorded on the page for a file field that says `options.record` — the
 * recorder's dialog, the microphone and the camera asked for, the time against its limit, the recording played back.
 */
export type RecordPart = typeof RecordModule;
/** The codes part: a value shown as a QR code or a Code 128 barcode, by Fieldia's own encoders. */
export type CodesPart = typeof CodesModule;
/** The pins part: pins with notes on a picture — a face chart, a floor plan, a car's damage. */
export type PinsPart = typeof PinsModule;
/** The survey part: a ranking, a matrix, a slider, pictures to choose from, a colour, properties, an address and a progress bar. */
export type SurveyPart = typeof SurveyModule;
/** The phone part: a phone number read the world over — its country picked or typed, checked, kept as E.164, shown at rest with its links — and every country's numbers. */
export type PhonePart = typeof PhoneModule;
/** The slots part: a booking's time picked from the times free, on a month shaded by how its days are booked. */
export type SlotsPart = typeof SlotsModule;
/** The relations part: links to other records — a many2one's and a reference's box, a many2many's tags and checkboxes, a char field's tags. */
export type RelationsPart = typeof RelationsModule;

/** A work item's formatted text, loaded the first time a page shows one: `await textPart.load()` gives its editor. */
export const textPart: Part<TextPart> = lazyPart('text', () => import('./text-part'));
/** A path picker, loaded the first time a page shows one. */
export const pathPart: Part<PathPart> = lazyPart('path', () => import('./path-part'));
/** A choice in Fieldia's own list, a long one searched as it is typed, or several chosen as tags, loaded the first time a page shows one. */
export const choicePart: Part<ChoicePart> = lazyPart('choice', () => import('./choice-part'));
/** Fieldia's own date box and its calendar, loaded the first time a page shows a date, a date and time, a time of day or a range. */
export const datePart: Part<DatePart> = lazyPart('date', () => import('./date-part'));
/**
 * The date part's code once it has come, for another part (booking slots, whose box it is without the data source's
 * slots): a function, which a part takes from the main script whenever it starts — a const of this module may be unset
 * still as the script bundle's table of shared names is made (tools/script-bundle.mjs).
 */
export function datePartIn(): DatePart | undefined {
  return datePart.loaded;
}
/** A table of lines and a many2many's table of records, loaded the first time a page shows one. */
export const linesPart: Part<LinesPart> = lazyPart('lines', () => import('./lines-part'));
/**
 * The lines part, asked for, for another part: a list's Import reads each cell of a file with its readers. A
 * function, as `datePartIn` is, for a part takes the main script's names as they stood when it started.
 */
export function loadLinesPart(): Promise<LinesPart> {
  return linesPart.load();
}
/** Flectra's business widgets — a statusbar, priority stars, hours, a per cent, a distribution, tax totals, payments — loaded the first time a page shows one. */
export const businessPart: Part<BusinessPart> = lazyPart('business', () => import('./business-part'));
/** A file field, a picture field, a signature's pad and a PDF under its file box, loaded the first time a page shows one. */
export const filesPart: Part<FilesPart> = lazyPart('files', () => import('./files-part'));

/**
 * A signature's evidence, loaded the first time a page shows a signature that signs answers (core's `signsAnswers`):
 * never for a page with uploads or a plain signature. Before it comes, the signature draws and keeps its picture; its
 * signing waits for it.
 */
export const evidencePart: Part<EvidencePart> = lazyPart('evidence', () => import('./evidence-part'));
/**
 * The evidence part, asked for, for another part: the files part's signature that signs answers. A function, as
 * `loadLinesPart` is, for a part takes the main script's names as they stood when it started.
 */
export function loadEvidencePart(): Promise<EvidencePart> {
  return evidencePart.load();
}
/**
 * The recorder, loaded the first time a person presses Record on a file field that records (`options.record`): never
 * for a page that records nothing, nor before someone means to record.
 */
export const recordPart: Part<RecordPart> = lazyPart('record', () => import('./record-part'));
/** The record part, asked for, for another part: the files part's Record. A function, as `loadEvidencePart` is. */
export function loadRecordPart(): Promise<RecordPart> {
  return recordPart.load();
}
/** A value shown as a QR code or a barcode, loaded the first time a page shows one (`"widget": "qrcode"`, `"barcode"`). */
export const codesPart: Part<CodesPart> = lazyPart('codes', () => import('./codes-part'));
/** Pins with notes on a picture, loaded the first time a page shows them (`"widget": "pins"`). */
export const pinsPart: Part<PinsPart> = lazyPart('pins', () => import('./pins-part'));
/** Whether asking for the evidence part again, once it failed, can bring it (`Part.asksAgain`): a function, as above. */
export function evidencePartAsksAgain(): boolean {
  return evidencePart.asksAgain === true;
}

/**
 * A photo made smaller, as `ShrinkOptions` say, or the file itself when it is small already, cannot be read, or would
 * not get smaller (shrink.ts): for an app's own code, as a picture field makes its photos smaller. Its code is the files
 * part's, asked for first.
 */
export const shrinkPhoto = (file: File, options?: ShrinkOptions, doc?: Document): Promise<File> => filesPart.load().then((part) => part.shrinkPhoto(file, options, doc));
/** The survey kinds, loaded the first time a page shows a ranking, a matrix, a slider, pictures to choose from, a colour, properties, an address or a progress bar. */
export const surveyPart: Part<SurveyPart> = lazyPart('survey', () => import('./survey-part'));
/**
 * Booking slots, loaded the first time a page shows a date and time drawn as slots — with the date part, whose box it
 * is where the data source has no `slots`: in when both are.
 */
export const slotsPart: Part<SlotsPart> = lazyPart('slots', () => Promise.all([import('./slots-part'), datePart.load()]).then(([module]) => module));

/**
 * A phone number read the world over, loaded the first time a page shows a phone field it reads so (its page's
 * `phone`, or the field's own `country` or `shown`): every country's numbers, the box with its country, its links.
 */
export const phonePart: Part<PhonePart> = lazyPart('phone', () => import('./phone-part'));
/** The phone part, asked for, for another part: a list's Import reads a phone column so. A function, as `loadLinesPart`. */
export function loadPhonePart(): Promise<PhonePart> {
  return phonePart.load();
}

/**
 * Links to other records — a many2one's and a reference's box, a many2many's tags and checkboxes, a char field's tags —
 * loaded the first time a page shows one.
 */
export const relationsPart: Part<RelationsPart> = lazyPart('relations', () => import('./relations-part'));

/** A factory whose widget comes in a part, for a field `when` says (every one unless it says). */
export type PartFactory = WidgetFactory & {
  /**
   * The part a field's widget comes in, or undefined when it needs none; `page`, the page it is on, and `field`, the field
   * it draws (a page's, or a table's column), where `when` reads them.
   */
  partOf(node: FieldNode, page?: Page, field?: Field): Part | undefined;
};

/**
 * A field's widget drawn by `part`'s factory, or `plain` where `when` says it needs no part — by its node, its page's
 * settings, or the field itself (a choice of many options, searched).
 */
export function partFactory<M>(part: Part<M>, real: (module: M) => WidgetFactory, plain: WidgetFactory, when: (node: FieldNode, page?: Page, field?: Field) => boolean = () => true): PartFactory {
  const factory: WidgetFactory = (context) => (when(context.node, context.form.page, context.field) ? partWidget(part, context, (module) => real(module)(context), plain) : plain(context));
  return Object.assign(factory, { partOf: (node: FieldNode, page?: Page, field?: Field) => (when(node, page, field) ? part : undefined) });
}

/** The inputs nothing is typed in: a tick, a choice, a file, a colour picker, a slider. */
const NOT_TYPED = new Set(['checkbox', 'radio', 'file', 'button', 'submit', 'reset', 'image', 'color', 'range', 'hidden']);
type TypedBox = HTMLInputElement | HTMLTextAreaElement;
const typedBox = (box: EventTarget | null): box is TypedBox =>
  box instanceof Element && (box.tagName === 'TEXTAREA' || (box.tagName === 'INPUT' && !NOT_TYPED.has((box as HTMLInputElement).type)));

/**
 * A box taken out of the page while it has the focus reads nothing as it goes: Chromium sends it a change and a blur
 * (Firefox and Safari send none), which would read what it held as left — under the person's keys. What it held is
 * the part's widget's now (`takeTyped`), in every engine alike.
 */
function goQuietly(box: Element): () => void {
  const stop = (event: Event) => event.stopImmediatePropagation();
  const types = ['change', 'blur', 'focusout'];
  // At the box itself, a listener that captures comes before those that do not: the stand-in's own never hear it.
  for (const type of types) box.addEventListener(type, stop, true);
  return () => types.forEach((type) => box.removeEventListener(type, stop, true));
}

/**
 * A widget whose code comes in a part. With the part in, it is the part's own, at once. Otherwise — a widget made
 * before its part came, by something that did not wait for it as the viewer does — it is drawn by `plain` and asks for
 * the part; when that comes, the part's widget takes the plain one's place in the page, with the last state the plain
 * one was given (the form's unread text with it), and the focus if the plain one had it. A part that cannot come leaves
 * the plain widget, which works.
 *
 * Text typed in the plain one's box and not yet read is never read as it goes, nor dropped: the part's widget takes it
 * as typed (`takeTyped`) — "2." stays "2.", never 2 made "2" under the next key — or, where it cannot take it as it
 * stands, the plain one's box stays beside it, focused, until it is left, and reads what it holds then.
 */
export function partWidget<M>(part: Part<M>, context: WidgetContext, real: (module: M) => Widget, plain: WidgetFactory): Widget {
  const loaded = part.loaded;
  if (loaded) return real(loaded);
  const { form, name, document: doc } = context;
  let current = plain(context);
  /** The plain one, kept beside the part's widget while its box holds what was typed, until it is left. */
  let lingering: Widget | null = null;
  let last: WidgetState | undefined;
  let gone = false;
  // The plain one's box typed in since it was entered or last read (a change, the box left), and what the field held as
  // it was entered.
  let entered: Value | undefined;
  let typedIn: TypedBox | null = null;
  const standIn = current.element;
  standIn.addEventListener('focusin', () => {
    entered = form.getState().values[name];
    typedIn = null;
  }, true);
  standIn.addEventListener('input', (event) => {
    if (typedBox(event.target)) typedIn = event.target;
  }, true);
  const read = (event: Event) => {
    if (event.target === typedIn) typedIn = null;
  };
  standIn.addEventListener('change', read, true);
  standIn.addEventListener('focusout', read, true);

  part.load().then(
    (module) => {
      if (gone) return;
      const was = current;
      const next = real(module);
      const active = doc.activeElement;
      const focused = !!active && was.element.contains(active);
      const box = focused && active === typedIn ? typedIn : null;
      // As typed: keys the plain one's guard holds after a refused one are part of it ("1x" where the box shows "1"), the
      // caret after them.
      const text = box ? (was.typedText?.() ?? box.value) : '';
      const [start, end] = box && text === box.value ? [box.selectionStart ?? text.length, box.selectionEnd ?? text.length] : [text.length, text.length];
      const typed: TypedText | null = box ? { text, start, end, entered } : null;
      current = next;
      if (typed && box) {
        // The part's widget beside the plain one, then asked to take what was typed: the plain one's box, losing the focus
        // to it, reads nothing as it goes.
        was.element.before(next.element);
        if (last) next.update(last);
        const loud = goQuietly(box);
        if (next.takeTyped?.(typed)) {
          was.element.remove();
          was.destroy?.();
          return;
        }
        // Not as it stands: the plain one's box stays where the person types, after the part's widget, until it is left —
        // it reads what it holds then, as it would have, and goes.
        loud();
        lingering = was;
        box.addEventListener('focusout', () => queueMicrotask(() => {
          if (lingering !== was) return;
          lingering = null;
          was.element.remove();
          was.destroy?.();
        }), { once: true });
        return;
      }
      if (focused && active) goQuietly(active);
      was.element.replaceWith(next.element);
      was.destroy?.();
      if (last) next.update(last);
      if (focused) next.focus();
    },
    () => undefined
  );
  return {
    get element() {
      return current.element;
    },
    get tools() {
      return current.tools;
    },
    update(state) {
      last = state;
      current.update(state);
      lingering?.update(state);
    },
    focus: () => current.focus(),
    destroy() {
      gone = true;
      current.destroy?.();
      lingering?.element.remove();
      lingering?.destroy?.();
      lingering = null;
    },
  };
}
