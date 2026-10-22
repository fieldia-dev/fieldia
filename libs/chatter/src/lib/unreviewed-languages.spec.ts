import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { wordsReady } from '@fieldia/core';
import { CHATTER_LABELS } from './labels';

/**
 * The chatter's words in Turkish, Persian, Urdu and Spanish (0.31): machine-assisted, not yet reviewed by a native speaker, as each
 * table's header says — every word English has but the sentences in a page's words for its records (given where they
 * read right), with English's blanks.
 */

const NEW = ['tr', 'fa', 'ur', 'es'] as const;

// Each in a chunk of its own, fetched where it is spoken: here, at once.
beforeAll(() => Promise.all(NEW.map(wordsReady)));
const NOUN = /Noun(One|Two|Many)?$/;
const blanks = (text: string, key: string) =>
  [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].filter((blank) => !(NOUN.test(key) && ['record', 'records', 'aRecord'].includes(blank))).sort();

/** Every word of `english` in `words`, nested ones too, with its blanks. */
function sameWords(words: Record<string, unknown>, english: Record<string, unknown>, path = ''): void {
  for (const key of Object.keys(english)) if (!NOUN.test(key)) expect({ key: path + key, given: key in words }).toEqual({ key: path + key, given: true });
  for (const [key, text] of Object.entries(words)) {
    expect({ key: path + key, english: key in english }).toEqual({ key: path + key, english: true });
    const theirs = english[key];
    if (theirs && typeof theirs === 'object') sameWords(text as Record<string, unknown>, theirs as Record<string, unknown>, `${path}${key}.`);
    else {
      expect({ key: path + key, text: typeof text === 'string' && text.trim().length > 0 }).toEqual({ key: path + key, text: true });
      expect({ key: path + key, blanks: blanks(text as string, key) }).toEqual({ key: path + key, blanks: blanks(theirs as string, key) });
    }
  }
}

describe.each(NEW)('the chatter’s words in %s', (locale) => {
  it('are every word English has, with its blanks', () => {
    sameWords(CHATTER_LABELS[locale] as unknown as Record<string, unknown>, CHATTER_LABELS.en as unknown as Record<string, unknown>);
  });

  it('say in their header that they are unreviewed', () => {
    // Its doc comment's words, whatever lines they are written on.
    const head = readFileSync(join(__dirname, 'locales', `${locale}.ts`), 'utf8').split('export const')[0].replace(/\s*\n\s*\*\s*/g, ' ');
    expect(head).toContain('UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.');
  });
});
