import type { CalendarView, ListCalendar, Locale, Page, Values } from '@fieldia/core';
import type { CalendarEvent, Resource } from './events';
import type { CalendarLabels } from './labels';

/** A column of the day or the week: a day, and a person or room when the day shows one each. */
export interface Column {
  day: Date;
  resource: (Resource & { label: string }) | null;
}

/** Where the slots' and the days' one stop is: a day, a time, a column. */
export interface Cursor {
  day: Date;
  minutes: number;
  column: number;
}

/** What a calendar shows now, which its drawing, its gestures, its keys and Move to… all read and set. */
export interface CalendarState {
  view: CalendarView;
  /** A day in the span shown. */
  anchor: Date;
  cursor: Cursor;
  /** The day's or the week's columns, as last drawn. */
  columns: Column[];
  /** The hours shown: the page's, stretched to the records outside them. */
  shownHours: { start: number; end: number };
  /** The people or rooms the day shows a column for; null alone when it shows none. */
  resources: Column['resource'][];
}

/** A line of a record's words in the hours, in pixels: the stylesheet's line-height there (styles.ts). */
const LINE = 16;
/** How many whole lines of words a record's block of this height shows under its 2 pixels of padding: one at least. */
export const linesIn = (height: number) => Math.max(1, Math.floor((height - 2) / LINE));

/** An element with its attributes (those undefined left off) and its children. */
export type Make = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Record<string, string | undefined>, ...children: (Node | string)[]) => HTMLElementTagNameMap[K];

export const maker =
  (doc: Document): Make =>
  (tag, attrs = {}, ...children) => {
    const node = doc.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) if (value !== undefined) node.setAttribute(key, value);
    node.append(...children);
    return node;
  };

/**
 * One calendar as its parts in other files reach it (gestures.ts, keys.ts,
 * move-to.ts): what it was made with, what it shows now, and what it does —
 * draw, ask again, open, make, write a move.
 */
export interface CalendarCore {
  /** Its own prefix for ids: "fd-cal-1". */
  readonly id: string;
  readonly doc: Document;
  readonly element: HTMLElement;
  /** Where the day, the week, the month or the agenda is drawn. */
  readonly body: HTMLElement;
  readonly page: Page;
  readonly spec: ListCalendar;
  readonly locale: Locale;
  readonly labels: CalendarLabels;
  /** The minutes a slot holds, and a drag moves by. */
  readonly slot: number;
  /** The pixels an hour takes in the day and the week. */
  readonly hour: number;
  /** The week's first day, 0 Sunday to 6 Saturday. */
  readonly firstDay: number;
  readonly canOpen: boolean;
  readonly state: CalendarState;
  readonly make: Make;
  /** Whether the page reads right to left. */
  rtl(): boolean;
  /** A moment's time, as the calendar writes one: "14:30". */
  time(d: Date): string;
  /** The part of an event on one day; null when it has none there. */
  segment(event: CalendarEvent, day: Date): { start: Date; end: Date } | null;
  /** Minutes kept to a slot's start inside the hours shown. */
  clampMinutes(minutes: number): number;
  draw(): void;
  reload(): Promise<void>;
  open(event: CalendarEvent): void;
  createAt(start: Date, end: Date | null, column: Column | null, wholeDay?: boolean): Promise<void>;
  /** Write a move through the data source's save, with Undo, and say so in these words. */
  commit(event: CalendarEvent, values: Values, words: string): Promise<void>;
  openMove(event: CalendarEvent, target: HTMLElement): void;
}
