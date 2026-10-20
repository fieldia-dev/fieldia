import type { DateOrder } from './input-rules';
import type { Messages } from './messages';

/**
 * A day a message names, written as the page's date boxes write one: in the page's order (`messages.dateOrder`, set on
 * a form's own messages from its page's `look.dateOrder`: day first unless it says) and its language — "20 Oct 2026",
 * "Oct 20, 2026", "2026-10-20". One rule for every message that names a day: a day's earliest and latest (limits.ts),
 * the days a form opens and closes (form-limits.ts, which writes a time after it on the page's clock). With `time`,
 * that instant's day and clock on `zone`'s clock, the zone's short name after it where it is not the reader's.
 */
export function dayWords(day: string, messages: Pick<Messages, 'locale' | 'dateOrder'>, order: DateOrder = messages.dateOrder ?? 'dmy', time?: { at: number; zone?: string; named: boolean }): string {
  if (order === 'ymd' && !time) return day;
  const at = time ? time.at : Date.parse(`${day}T00:00Z`);
  if (Number.isNaN(at)) return day;
  // English as the boxes write it, the day first.
  const parts = new Intl.DateTimeFormat(messages.locale === 'en' ? 'en-GB' : messages.locale, {
    day: order === 'ymd' ? '2-digit' : 'numeric',
    month: order === 'ymd' ? '2-digit' : 'short',
    year: 'numeric',
    numberingSystem: 'latn',
    timeZone: time ? time.zone : 'UTC',
    ...(time ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', ...(time.named ? { timeZoneName: 'short' } : {}) } : {}),
  } as Intl.DateTimeFormatOptions).formatToParts(at);
  const part = (type: string) => parts.find((one) => one.type === type)?.value ?? '';
  const clock = time ? `${part('hour')}:${part('minute')}` : '';
  const named = time?.named ? ` ${part('timeZoneName')}` : '';
  if (order === 'ymd') return `${part('year')}-${part('month')}-${part('day')} ${clock}${named}`;
  if (order === 'mdy') return `${part('month')} ${part('day')}, ${part('year')}${clock ? `, ${clock}` : ''}${named}`;
  // Day first, as the language joins its parts: its own text.
  return parts.map((one) => one.value).join('');
}
