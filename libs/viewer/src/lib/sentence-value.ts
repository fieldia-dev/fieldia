import { instantsAt, isOwnZone, wallClock, wallTime, type DateOrder, type LineField, type Locale, type Value } from '@fieldia/core';
import { displayValue, restingText, typingText, zoneName } from '@fieldia/widgets';

/** How a value is written inside a sentence of the page's: its days in the page's order, and its words for yes and no. */
export interface SentenceWords {
  order?: DateOrder;
  yes?: string;
  no?: string;
}

/**
 * A value as words inside a sentence of the page's own — a `{field}` in a label, a help, a choice, a step's title, a
 * button, an ending: as its field shows it at rest (`displayValue`) — a choice by its label, a link by its name, money
 * with its currency — a day in the page's order (`orderedDay`), and a yes or no in words ("Yes", "No"), where a cell
 * shows a tick.
 */
export function sentenceValue(def: LineField, value: Value | undefined, values: Record<string, Value>, locale: Locale, how: SentenceWords): string {
  if (def.type === 'boolean') return value === true ? (how.yes ?? 'Yes') : value === false ? (how.no ?? 'No') : '';
  if ((def.type === 'date' || def.type === 'datetime') && how.order && how.order !== 'dmy' && typeof value === 'string' && value) {
    return orderedDay(value, def.type, how.order, locale, def.type === 'datetime' ? def.timeZone : undefined);
  }
  return displayValue(def, value, values, locale);
}

/**
 * A day in words in the page's order, as a sentence says it ("See you on {date}"): month first with its name (Oct
 * 15, 2026), or year first as it is typed (2026-10-15) — a date and time with its time after it, on its zone's clock,
 * the zone's short name after it where a box at rest shows it (`restingText`); day first, as the box at rest writes it.
 */
export function orderedDay(value: string, kind: 'date' | 'datetime', order: DateOrder, locale: Locale, zone?: string): string {
  if (order === 'dmy') return restingText(value, kind, locale, zone);
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = kind === 'date' ? (day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : null) : new Date(value);
  if (!d || Number.isNaN(d.getTime())) return value;
  const at = d.getTime();
  // Marked where its zone is not the browser's, or its time comes twice there.
  const twice = kind === 'datetime' && !!zone && instantsAt(wallTime(at, zone), zone).length > 1;
  const marked = kind === 'datetime' && !!zone && (twice || !isOwnZone(zone));
  const mark = (text: string) => (marked && zone ? `${text} ${zoneName(at, zone, locale)}` : text);
  // As it is typed (which names the zone itself where the time comes twice).
  if (order === 'ymd') return twice ? typingText(value, kind, 'ymd', locale, zone) : mark(typingText(value, kind, 'ymd', locale, zone));
  const parts = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, { day: 'numeric', month: 'short', year: 'numeric', numberingSystem: 'latn', ...(kind === 'datetime' && zone ? { timeZone: zone } : {}) }).formatToParts(d);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const words = `${part('month')} ${part('day')}, ${part('year')}`;
  return kind === 'date' ? words : mark(`${words}, ${wallClock(wallTime(at, zone))}`);
}
