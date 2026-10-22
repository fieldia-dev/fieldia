import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { firstWeekday, isRightToLeft, listComma } from '../format/translate';
import { dayTag, dayWords, monthWords } from './day-words';
import { couldBeNumber, readDate, readNumber } from './input-rules';
import { MESSAGES } from './messages';
import { quotedLabel } from './record-words';
import { wordsComing, wordsReady } from './words-chunks';

/**
 * Turkish, Persian, Urdu and Spanish (0.31): the owner's decision is to ship them now, machine-assisted and not yet
 * reviewed by a native speaker — each table says so. They have every message English has, with its blanks; Persian and
 * Urdu run right to left, their digits read as numbers; their days are written by Intl on the Gregorian calendar a
 * date's value is kept in, Intl's Persian default being the Solar Hijri.
 */

const NEW = ['tr', 'fa', 'ur', 'es'] as const;

// Each in a chunk of its own, fetched where it is spoken: here, at once.
beforeAll(async () => {
  expect(NEW.map(wordsComing)).toEqual([true, true, true, true]);
  await Promise.all(NEW.map(wordsReady));
  expect(NEW.map(wordsComing)).toEqual([false, false, false, false]);
});
const blanks = (text: string, key: string) =>
  [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))]
    // A model's or a type's name with its article or without, the language's choice; {n} in a sentence for one, or a literal 1.
    .map((blank) => (blank === 'aModels' ? 'models' : blank === 'aTypes' ? 'types' : blank))
    .filter((blank) => !(blank === 'n' && key.endsWith('One')))
    .sort();

describe.each(NEW)('the messages in %s', (locale) => {
  it('have every message English has, with its blanks, and none it has not', () => {
    const words = MESSAGES[locale] as unknown as Record<string, string>;
    const english = MESSAGES.en as unknown as Record<string, string>;
    for (const key of Object.keys(english)) if (!key.endsWith('Noun')) expect({ key, given: key in words }).toEqual({ key, given: true });
    for (const [key, text] of Object.entries(words)) {
      expect({ key, english: key in english }).toEqual({ key, english: true });
      if (key === 'locale') continue;
      expect({ key, text: typeof text === 'string' && text.trim().length > 0 }).toEqual({ key, text: true });
      if (!key.endsWith('Noun')) expect({ key, blanks: blanks(text, key) }).toEqual({ key, blanks: blanks(english[key], key) });
    }
    expect(MESSAGES[locale].locale).toBe(locale);
  });

  it('say in their header that they are unreviewed', () => {
    // Its doc comment's words, whatever lines they are written on.
    const head = readFileSync(join(__dirname, 'locales', `${locale}.ts`), 'utf8').split('export const')[0].replace(/\s*\n\s*\*\s*/g, ' ');
    expect(head).toContain('UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.');
  });
});

describe('Persian and Urdu', () => {
  it('run right to left, with the Arabic comma between names, and their weeks where CLDR starts them', () => {
    expect([isRightToLeft('fa'), isRightToLeft('ur'), isRightToLeft('tr'), isRightToLeft('es')]).toEqual([true, true, false, false]);
    expect([listComma('fa'), listComma('ur-PK'), listComma('ar'), listComma('tr'), listComma('es')]).toEqual(['، ', '، ', '، ', ', ', ', ']);
    // Iran's and Egypt's from Saturday, Pakistan's and the United States' from Sunday, Turkey's, Spain's and Britain's from Monday.
    expect(['fa', 'ar', 'ur', 'tr', 'es', 'en', 'en-GB', 'ar-SA'].map(firstWeekday)).toEqual([6, 6, 0, 1, 1, 0, 1, 0]);
  });

  it('read a number typed in Persian or Urdu digits, with either script’s marks', () => {
    expect(readNumber('۱۲۳۴۵', 'fa')).toMatchObject({ ok: true, value: 12345 });
    expect(readNumber('۱۲٬۳۴۵٫۶', 'fa')).toMatchObject({ ok: true, value: 12345.6 });
    expect(readNumber('۱۲٫۵', 'ur')).toMatchObject({ ok: true, value: 12.5 });
    expect(readNumber('-۷', 'fa')).toMatchObject({ ok: true, value: -7 });
    // Each key of a number in Persian digits may be typed, and a letter may not.
    for (const typed of ['۱', '۱۲', '۱۲٫', '۱۲٫۵']) expect({ typed, refused: couldBeNumber(typed, 'fa') }).toEqual({ typed, refused: null });
    expect(couldBeNumber('۱۲ب', 'fa')).toEqual({ problem: 'numbersOnly' });
  });

  it('quote a question in Persian with its own marks, in Urdu with the common ones', () => {
    expect(quotedLabel('چند روز؟', 'fa')).toBe('«چند روز؟»');
    expect(quotedLabel('کتنے دن؟', 'ur')).toBe('“کتنے دن؟”');
  });
});

describe('a day in the four languages', () => {
  it('is written by Intl on the Gregorian calendar, never Persian’s Solar Hijri', () => {
    expect([dayTag('en'), dayTag('fa'), dayTag('ar-EG'), dayTag('ar-u-nu-latn')]).toEqual(['en-GB', 'fa-u-ca-gregory', 'ar-EG-u-ca-gregory', 'ar-u-nu-latn']);
    expect(dayWords('2026-10-15', MESSAGES.fa)).toBe('15 اکتبر 2026');
    expect(dayWords('2026-10-15', MESSAGES.ur)).toBe('15 اکتوبر، 2026');
    expect(dayWords('2026-10-15', MESSAGES.tr)).toBe('15 Eki 2026');
    expect(dayWords('2026-10-15', MESSAGES.es)).toBe('15 oct 2026');
    expect(monthWords(Date.UTC(2026, 9, 1), 'fa')).toContain('2026');
    // The words for days in English, Arabic, German and French are as they were.
    expect([dayWords('2026-10-15', MESSAGES.en), dayWords('2026-10-15', MESSAGES.ar), dayWords('2026-10-15', MESSAGES.de), dayWords('2026-10-15', MESSAGES.fr)]).toEqual([
      '15 Oct 2026',
      '15 أكتوبر 2026',
      '15. Okt. 2026',
      '15 oct. 2026',
    ]);
  });

  it('reads back as the day it says, typed in the language’s digits too', () => {
    for (const locale of NEW) {
      const words = dayWords('2026-10-15', MESSAGES[locale]);
      expect({ locale, words, read: readDate(words, { locale }) }).toEqual({ locale, words, read: { ok: true, value: '2026-10-15' } });
    }
    expect(readDate('۱۵/۱۰/۲۰۲۶', { locale: 'fa' })).toEqual({ ok: true, value: '2026-10-15' });
    expect(readDate('15.10.2026', { locale: 'tr' })).toEqual({ ok: true, value: '2026-10-15' });
  });
});

describe('the week’s first day, where an engine’s Intl does not say', () => {
  it('is CLDR’s for the tag’s region, or the one its language is most spoken in', () => {
    const proto = Intl.Locale.prototype as unknown as Record<string, unknown>;
    const [getWeekInfo, weekInfo] = [Object.getOwnPropertyDescriptor(proto, 'getWeekInfo'), Object.getOwnPropertyDescriptor(proto, 'weekInfo')];
    delete proto['getWeekInfo'];
    delete proto['weekInfo'];
    try {
      expect(['fa', 'ar', 'ur', 'tr', 'es', 'en', 'en-GB', 'ar-SA', 'dv'].map(firstWeekday)).toEqual([6, 6, 0, 1, 1, 0, 1, 0, 5]);
    } finally {
      if (getWeekInfo) Object.defineProperty(proto, 'getWeekInfo', getWeekInfo);
      if (weekInfo) Object.defineProperty(proto, 'weekInfo', weekInfo);
    }
  });
});
