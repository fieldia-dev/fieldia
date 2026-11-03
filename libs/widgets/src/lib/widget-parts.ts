import { formLanguagesPart, formUploadsPart, type Field, type FieldNode, type Page, type Value } from '@fieldia/core';
import { lazyPart, type Part } from './parts';
import type * as TextModule from './text-part';
import type * as HtmlModule from './html-part';
import type * as PathModule from './path-part';
import type * as ChoiceModule from './choice-part';
import type * as DateModule from './date-part';
import type * as MonthsModule from './months-part';
import type * as TypedModule from './typed-part';
import type * as LinesModule from './lines-part';
import type * as BusinessModule from './business-part';
import type * as FilesModule from './files-part';
import type * as EvidenceModule from './evidence-part';
import type * as PhotosModule from './photos-part';
import type * as RecordModule from './record-part';
import type * as CodesModule from './codes-part';
import type * as PinsModule from './pins-part';
import type { ShrinkOptions } from './shrink';
import type * as SurveyModule from './survey-part';
import type * as PhoneModule from './phone-part';
import type * as SlotsModule from './slots-part';
import type * as ScheduleModule from './schedule-part';
import type * as RelationsModule from './relations-part';
import type * as LanguagesModule from './languages-part';
import type * as ScanModule from './scan-part';
import type * as DecodeModule from './decode-part';
import type { TypedText, Widget, WidgetContext, WidgetFactory, WidgetState } from './widgets';

/** The text part: a work item's formatted text editor (rich and Markdown), Markdown both ways, its menus and the links box. */
export type TextPart = typeof TextModule;
/** The html part: the classic formatted text's toolbar, and its paste put in plain. */
export type HtmlPart = typeof HtmlModule;
/** The path part: a path picker, with its suggestions and its tree; a checkbox tree of several records of a tree. */
export type PathPart = typeof PathModule;
/** The choice part: a choice in Fieldia's own list, a long one searched as it is typed, and several chosen as tags. */
export type ChoicePart = typeof ChoiceModule;
/** The date part: Fieldia's own box for a date, a date and time and a time of day, a date's calendar, a range of dates. */
export type DatePart = typeof DateModule;
/** The months part: a date of a month alone or a year alone, and the Hijri calendar beside a day — their boxes, calendars and sheet. */
export type MonthsPart = typeof MonthsModule;
/** The typed part: a text box typed to a mask (a national ID, an IBAN, a plate) and a one-time code's boxes. */
export type TypedPart = typeof TypedModule;
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
 * The photos part: a photo set (`"widget": "photos"`) — its tiles in the order a person puts them, the cover, captions,
 * a photo cropped and turned in its dialog.
 */
export type PhotosPart = typeof PhotosModule;
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
/** The schedule part: a repeat field — its rule, its words — and a week's opening hours. */
export type SchedulePart = typeof ScheduleModule;
/** The relations part: links to other records — a many2one's and a reference's box, a many2many's tags and checkboxes, a char field's tags. */
export type RelationsPart = typeof RelationsModule;
/** The languages part: a text kept in several languages — its switch between them over its box, and a list's cell of it, marked. */
export type LanguagesPart = typeof LanguagesModule;
/** The scan part: a field's Scan button, the camera's sheet, a code read written into the field, a table's lines counted. */
export type ScanPart = typeof ScanModule;
/** The decode part: codes read in a camera's picture where the browser reads none itself (ZXing's readers). */
export type DecodePart = typeof DecodeModule;

/** A work item's formatted text, loaded the first time a page shows one: `await textPart.load()` gives its editor. */
export const textPart: Part<TextPart> = lazyPart('text', () => import('./text-part'));
/**
 * The classic formatted text's toolbar, loaded with a page's parts where it shows one: its box drawn plainly until it
 * comes (`htmlBox`, extras.ts) — its words cleaned, typed in place — and where it cannot.
 */
export const htmlPart: Part<HtmlPart> = lazyPart('html', () => import('./html-part'));
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
/**
 * A month alone, a year alone and the Hijri calendar (a date's `precision`, `hijri`), loaded with the date part the first
 * time a page shows such a date: never for a date of days alone.
 */
export const monthsPart: Part<MonthsPart> = lazyPart('months', () => import('./months-part'));
/**
 * The months part's code once it has come, for the date part's box and calendar (a field that has one asked for both):
 * a function, as `datePartIn` is.
 */
export function monthsPartIn(): MonthsPart | undefined {
  return monthsPart.loaded;
}
/**
 * A text box typed to a mask (`options.mask` on a char field) and a one-time code's boxes (`"widget": "one-time-code"`),
 * loaded the first time a page shows one.
 */
export const typedPart: Part<TypedPart> = lazyPart('typed', () => import('./typed-part'));
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
/**
 * A file field, a picture field, a signature's pad and a PDF under its file box, loaded the first time a page shows one
 * — with @fieldia/core's uploads' work (`formUploadsPart`), which sends the files it takes to the app's store.
 */
export const filesPart: Part<FilesPart> = lazyPart('files', () => Promise.all([import('./files-part'), formUploadsPart.load()]).then(([module]) => module));

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
 * A photo set (`"widget": "photos"` on a picture field of several photos), loaded the first time a page shows one —
 * with the files part, whose taking of photos, files on their way, dialog and sheet it draws with: in when both are.
 * Never for a plain picture field.
 */
export const photosPart: Part<PhotosPart> = lazyPart('photos', () => Promise.all([import('./photos-part'), filesPart.load()]).then(([module]) => module));
/**
 * The files part's code once it has come, for the photos part, which comes with it: a function, as `datePartIn` is, for
 * a part takes the main script's names as they stood when it started.
 */
export function filesPartIn(): FilesPart | undefined {
  return filesPart.loaded;
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
 * A repeat field and a week's opening hours, loaded the first time a page shows one, or a list's column of them — with
 * the date part, whose boxes their days and times are: in when both are.
 */
export const schedulePart: Part<SchedulePart> = lazyPart('schedule', () => Promise.all([import('./schedule-part'), datePart.load()]).then(([module]) => module));

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

/**
 * A text kept in several languages (`translate`), each typed by a person: its switch between them over its box, and a
 * list's cell or card of it in the reader's language, else another's, marked — loaded the first time a page shows one,
 * with the form's code that checks it in each language and reads it in the reader's (@fieldia/core's `formLanguagesPart`).
 */
export const languagesPart: Part<LanguagesPart> = lazyPart('languages', () => Promise.all([import('./languages-part'), formLanguagesPart.load()]).then(([module]) => module));

/** A text in several languages as one, before its part has come: the first language typed in. */
export const anyText = (value: Value | undefined): string =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? ((Object.values(value).find((text) => typeof text === 'string' && text.trim()) as string | undefined) ?? '') : value === null || value === undefined ? '' : String(value);

/**
 * A code scanned with the camera (`options.scan`): a field's Scan button, the camera's sheet, the code read written into
 * the field — a link's record found by its code — and a table's lines counted, loaded the first time a page shows a
 * field scanned into (the viewer asks for it before it draws such a page). Meanwhile its box is typed in, as a scanner
 * gun types into it.
 */
export const scanPart: Part<ScanPart> = lazyPart('scan', () => import('./scan-part'));
/**
 * Codes read in a camera's picture where the browser has no reader of its own (`BarcodeDetector`) — Safari, Firefox, a
 * computer's Chrome — loaded only as Scan is pressed in such a browser: about 40 KB, never for a page no one scans on.
 */
export const decodePart: Part<DecodePart> = lazyPart('decode', () => import('./decode-part'));
/** The decode part, asked for, for the scan part as Scan is pressed. A function, as `loadLinesPart` is. */
export function loadDecodePart(): Promise<DecodePart> {
  return decodePart.load();
}

/** Whether a field is scanned into with the camera: its node's `options.scan` — true, or its settings. */
export const scans = (node: FieldNode): boolean => !!node.options?.['scan'];

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
 * the plain widget, which works, and tells the field so (`WidgetContext.unloaded`), with a way to ask for it again: as
 * it then comes, its widget takes the plain one's place just the same, what was typed in the plain one with it.
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

  /** Whether the part's widget has taken the plain one's place. */
  let came = false;
  /**
   * The part asked for, its widget put in the plain one's place as it comes: true once it has; false where it could not
   * come. A part that cannot come leaves the plain widget, which works — and the field is told (`unloaded`), so it says
   * that part of it could not load, with a way to ask again (this, once more) where asking again can bring it.
   */
  const bring = (): Promise<boolean> =>
    came || gone
      ? Promise.resolve(came)
      : part.load().then(
          (module) => {
            if (gone || came) return came;
            came = true;
            swap(module);
            return true;
          },
          () => {
            if (!gone) context.unloaded?.(part, bring);
            return false;
          }
        );
  void bring();

  function swap(module: M): void {
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
  }
  return {
    get element() {
      return current.element;
    },
    get tools() {
      return current.tools;
    },
    // What the widget shown now draws from; while the plain one lingers beside it, everything.
    get reads() {
      return lingering ? undefined : current.reads;
    },
    update(state) {
      last = state;
      current.update(state);
      lingering?.update(state);
    },
    focus: (options?: FocusOptions) => current.focus(options),
    destroy() {
      gone = true;
      current.destroy?.();
      lingering?.element.remove();
      lingering?.destroy?.();
      lingering = null;
    },
  };
}
