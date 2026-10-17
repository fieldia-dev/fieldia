import type { PagePhone } from '@fieldia/core';
import { phonePart } from './widget-parts';

/**
 * How a phone field's numbers are read and shown, from its page's `phone` and its node's `options` (the field's own
 * win): the country a number typed without its + is read in, null when none is said — never assumed — and whether a
 * number is shown at rest abroad's way or at home's. Null when neither says anything: the field is a text box, as
 * before 0.24, and its page asks for no part.
 */
export interface PhoneSettings {
  readonly country: string | null;
  readonly shown: 'international' | 'national';
}

export function phoneSettings(page: { readonly phone?: PagePhone } | undefined, options: Readonly<Record<string, unknown>> | undefined): PhoneSettings | null {
  const own = options ?? {};
  const country = typeof own['country'] === 'string' && own['country'] ? own['country'] : undefined;
  const shown = own['shown'] === 'national' || own['shown'] === 'international' ? own['shown'] : undefined;
  if (!page?.phone && country === undefined && shown === undefined) return null;
  return { country: country ?? page?.phone?.country ?? null, shown: shown ?? page?.phone?.shown ?? 'international' };
}

/**
 * A field's number as people read it, as `settings` show it — by the phone part, once it has come (a page that reads
 * its phones so waits for it): undefined before. A function, for a part to take from the main script (a list's
 * column): a part takes the main script's names as they stood when it started, and only a function is there then.
 */
export function phoneWritten(value: string, settings: PhoneSettings): string | undefined {
  return phonePart.loaded?.shownPhone(value, settings.shown, settings.country);
}

/**
 * Where a field's number's links go — a call and a WhatsApp chat — and the number as written for anyone anywhere, by
 * the phone part once it has come (a list's phone column with its links: the page waited for it); undefined before,
 * or for text that is no number. A function, for a part to take from the main script, as `phoneWritten` is.
 */
export function phoneLinksOf(value: string): { call: string; whatsapp: string; number: string } | undefined {
  const part = phonePart.loaded;
  const to = part?.phoneLinks(value);
  return part && to ? { ...to, number: part.writePhone(value, 'international') } : undefined;
}
