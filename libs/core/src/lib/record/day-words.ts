import type { DateOrder } from './input-rules';
import type { Messages } from './messages';

/**
 * A day a message names, written as the page's date boxes write one: in the page's order (`messages.dateOrder`, set on
 * a form's own messages from its page's `look.dateOrder`: day first unless it says) and its language — "20 Oct 2026",
 * "Oct 20, 2026", "2026-10-20". One rule for every message that names a day: a day's earliest and latest (limits.ts),
 * the days a form opens and closes (form-limits.ts, which writes a time after it on the page's clock). As written
 * where it reads as no day.
 */
export function dayWords(day: string, messages: Pick<Messages, 'locale' | 'dateOrder'>, order: DateOrder = messages.dateOrder ?? 'dmy'): string {
  const at = Date.parse(`${day}T00:00Z`);
  if (order === 'ymd' || Number.isNaN(at)) return day;
  // English as the boxes write it, the day first.
  const format = new Intl.DateTimeFormat(messages.locale === 'en' ? 'en-GB' : messages.locale, { day: 'numeric', month: 'short', year: 'numeric', numberingSystem: 'latn', timeZone: 'UTC' });
  if (order === 'dmy') return format.format(at);
  const parts = format.formatToParts(at);
  const part = (type: string) => parts.find((one) => one.type === type)?.value ?? '';
  return `${part('month')} ${part('day')}, ${part('year')}`;
}
