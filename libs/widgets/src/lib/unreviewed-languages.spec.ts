import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { wordsReady } from '@fieldia/core';
import { inPlural, WIDGET_LABELS } from './labels';

/**
 * The widgets' words in Turkish, Persian, Urdu and Spanish (0.31): machine-assisted, not yet reviewed by a native
 * speaker, as each table's header says — every word English has, with its blanks and its parts between `|`.
 */

const NEW = ['tr', 'fa', 'ur', 'es'] as const;

// Each in a chunk of its own, fetched where it is spoken: here, at once.
beforeAll(() => Promise.all(NEW.map(wordsReady)));
const blanks = (text: string) => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();

describe.each(NEW)('the widgets’ words in %s', (locale) => {
  it('are every word English has, with its blanks and its parts', () => {
    const words = WIDGET_LABELS[locale] as unknown as Record<string, string>;
    const english = WIDGET_LABELS.en as unknown as Record<string, string>;
    expect(Object.keys(words)).toEqual(Object.keys(english));
    for (const [key, text] of Object.entries(words)) {
      expect({ key, text: typeof text === 'string' && text.trim().length > 0 }).toEqual({ key, text: true });
      // A count's words for one may write the 1 itself.
      const theirs = blanks(english[key]).filter((blank) => !(blank === 'n' && key.endsWith('One')));
      expect({ key, blanks: blanks(text).filter((blank) => !(blank === 'n' && key.endsWith('One'))) }).toEqual({ key, blanks: theirs });
      expect({ key, parts: text.split('|').length }).toEqual({ key, parts: english[key].split('|').length });
    }
  });

  it('say in their header that they are unreviewed', () => {
    // Its doc comment's words, whatever lines they are written on.
    const head = readFileSync(join(__dirname, 'locales', `${locale}.ts`), 'utf8').split('export const')[0].replace(/\s*\n\s*\*\s*/g, ' ');
    expect(head).toContain('UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.');
  });

  it('write numbers in Latin digits, and Persian and Urdu in their own letters', () => {
    for (const [key, text] of Object.entries(WIDGET_LABELS[locale] as unknown as Record<string, string>)) {
      expect({ key, digits: /[٠-٩۰-۹]/.test(text) }).toEqual({ key, digits: false });
      if (locale === 'fa' || locale === 'ur') expect({ key, arabicYehOrKaf: /[يك]/.test(text) }).toEqual({ key, arabicYehOrKaf: false });
    }
  });
});

describe('a count in the four languages', () => {
  it('takes its words for one as Intl.PluralRules says: Persian 0 and 1, the others 1', () => {
    const say = (locale: string, n: number) => inPlural('{n} other', '{n} one', n, locale);
    expect([say('fa', 0), say('fa', 1), say('fa', 2)]).toEqual(['0 one', '1 one', '2 other']);
    for (const locale of ['tr', 'ur', 'es']) expect([locale, say(locale, 0), say(locale, 1), say(locale, 2)]).toEqual([locale, '0 other', '1 one', '2 other']);
  });
});
