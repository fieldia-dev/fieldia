import type { FieldNode } from '@fieldia/core';
import { lazyPart, type Part } from './parts';
import type * as TextModule from './text-part';
import type * as PathModule from './path-part';
import type * as ChoiceModule from './choice-part';
import type * as DateModule from './date-part';
import type * as LinesModule from './lines-part';
import type * as BusinessModule from './business-part';
import type * as FilesModule from './files-part';
import type { ShrinkOptions } from './shrink';
import type * as SurveyModule from './survey-part';
import type * as SlotsModule from './slots-part';
import type { Widget, WidgetContext, WidgetFactory, WidgetState } from './widgets';

/** The text part: a work item's formatted text editor (rich and Markdown), Markdown both ways, its menus and the links box. */
export type TextPart = typeof TextModule;
/** The path part: a path picker, with its suggestions and its tree. */
export type PathPart = typeof PathModule;
/** The choice part: a choice in Fieldia's own list. */
export type ChoicePart = typeof ChoiceModule;
/** The date part: Fieldia's own box for a date, a date and time and a time of day, a date's calendar, a range of dates. */
export type DatePart = typeof DateModule;
/** The lines part: a one2many's table of lines, a many2many's table of records, and their stylesheet. */
export type LinesPart = typeof LinesModule;
/** The business part: a statusbar, priority stars, hours and a per cent's boxes, an analytic distribution, tax totals, payments. */
export type BusinessPart = typeof BusinessModule;
/** The files part: a file field, a picture field, files on their way to the store, photos made smaller, a signature's pad, a PDF under its file box. */
export type FilesPart = typeof FilesModule;
/** The survey part: a ranking, a matrix, a slider, pictures to choose from, a colour, properties, an address and a progress bar. */
export type SurveyPart = typeof SurveyModule;
/** The slots part: a booking's time picked from the times free, on a month shaded by how its days are booked. */
export type SlotsPart = typeof SlotsModule;

/** A work item's formatted text, loaded the first time a page shows one: `await textPart.load()` gives its editor. */
export const textPart: Part<TextPart> = lazyPart('text', () => import('./text-part'));
/** A path picker, loaded the first time a page shows one. */
export const pathPart: Part<PathPart> = lazyPart('path', () => import('./path-part'));
/** A choice in Fieldia's own list, loaded the first time a page shows one. */
export const choicePart: Part<ChoicePart> = lazyPart('choice', () => import('./choice-part'));
/** Fieldia's own date box and its calendar, loaded the first time a page shows a date, a date and time, a time of day or a range. */
export const datePart: Part<DatePart> = lazyPart('date', () => import('./date-part'));
/** A table of lines and a many2many's table of records, loaded the first time a page shows one. */
export const linesPart: Part<LinesPart> = lazyPart('lines', () => import('./lines-part'));
/** Flectra's business widgets — a statusbar, priority stars, hours, a per cent, a distribution, tax totals, payments — loaded the first time a page shows one. */
export const businessPart: Part<BusinessPart> = lazyPart('business', () => import('./business-part'));
/** A file field, a picture field, a signature's pad and a PDF under its file box, loaded the first time a page shows one. */
export const filesPart: Part<FilesPart> = lazyPart('files', () => import('./files-part'));

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

/** A factory whose widget comes in a part, for a field `when` says (every one unless it says). */
export type PartFactory = WidgetFactory & {
  /** The part a field's widget comes in, or undefined when it needs none. */
  partOf(node: FieldNode): Part | undefined;
};

/** A field's widget drawn by `part`'s factory, or `plain` where `when` says it needs no part. */
export function partFactory<M>(part: Part<M>, real: (module: M) => WidgetFactory, plain: WidgetFactory, when: (node: FieldNode) => boolean = () => true): PartFactory {
  const factory: WidgetFactory = (context) => (when(context.node) ? partWidget(part, context, (module) => real(module)(context), plain) : plain(context));
  return Object.assign(factory, { partOf: (node: FieldNode) => (when(node) ? part : undefined) });
}

/**
 * A widget whose code comes in a part. With the part in, it is the part's own, at once. Otherwise — a widget made
 * before its part came, by something that did not wait for it as the viewer does — it is drawn by `plain` and asks for
 * the part; when that comes, the part's widget takes the plain one's place in the page, with the last state the plain
 * one was given, and the focus if the plain one had it. A part that cannot come leaves the plain widget, which works.
 */
export function partWidget<M>(part: Part<M>, context: WidgetContext, real: (module: M) => Widget, plain: WidgetFactory): Widget {
  const loaded = part.loaded;
  if (loaded) return real(loaded);
  let current = plain(context);
  let last: WidgetState | undefined;
  let gone = false;
  part.load().then(
    (module) => {
      if (gone) return;
      const was = current;
      const next = real(module);
      const doc = context.document;
      const focused = !!doc.activeElement && was.element.contains(doc.activeElement);
      was.element.replaceWith(next.element);
      was.destroy?.();
      current = next;
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
    },
    focus: () => current.focus(),
    destroy() {
      gone = true;
      current.destroy?.();
    },
  };
}
