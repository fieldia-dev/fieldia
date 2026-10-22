import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { blankPage, createDesigner } from './designer';
import { DESIGNER_WORDS, designerLocale, designerWordsReady, DATE_TAGS, designerDirection } from './designer-words';
import { en } from './locales/en';
import { es } from './locales/es';
import { fa } from './locales/fa';
import { plural } from './locales/speak';
import { tr } from './locales/tr';
import { ur } from './locales/ur';
import { mountScreenEditor } from './screen-editor';
import { everyWord, latinIn, shapeOf, type Table } from './test-words';

/**
 * The designer's words in Turkish, Persian, Urdu and Spanish (0.31): machine-assisted, not yet reviewed by a native
 * speaker, as every file of theirs says. Every word English has, each taking what it takes, none empty or broken;
 * Persian and Urdu in their own letters and right to left, their dates on the Gregorian calendar.
 */

const TABLES = { tr, fa, ur, es } as const;

describe.each(Object.keys(TABLES) as (keyof typeof TABLES)[])('the designer’s words in %s', (locale) => {
  const table = TABLES[locale] as unknown as Table;

  it('have every word the English ones have, each taking what it takes', () => {
    expect(shapeOf(table)).toEqual(shapeOf(en as unknown as Table));
  });

  it('say nothing empty or broken', () => {
    const words = everyWord(table);
    expect(words.length).toBeGreaterThan(1000);
    expect(words.filter(({ words }) => !words.trim() || /undefined|NaN|\[object/.test(words))).toEqual([]);
  });

  it('say in every file’s header that they are unreviewed', () => {
    const folder = join(__dirname, 'locales', locale);
    for (const file of readdirSync(folder)) {
      const head = readFileSync(join(folder, file), 'utf8').split(/^export /m)[0].replace(/\s*\n\s*\*\s*/g, ' ');
      expect({ file, unreviewed: head.includes('UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.') }).toEqual({ file, unreviewed: true });
    }
  });

  it('are the designer’s for the language’s tag, fetched in a chunk of their own first', async () => {
    expect(designerLocale(`${locale}-XX`)).toBe(locale);
    // Not fetched yet: the designer speaks English, and the console says once what to await.
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(DESIGNER_WORDS[locale]).toBeUndefined();
    const early = createDesigner({ page: blankPage('screen', 'Visit'), locale });
    expect([early.words, early.locale]).toEqual([en, 'en']);
    createDesigner({ page: blankPage('screen', 'Visit'), locale });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain(`designerWordsReady('${locale}')`);
    warn.mockRestore();
    await designerWordsReady(`${locale}-XX`);
    expect(DESIGNER_WORDS[locale]).toBe(TABLES[locale]);
    const designer = createDesigner({ page: blankPage('screen', 'Visit'), locale });
    expect([designer.words, designer.locale]).toEqual([TABLES[locale], locale]);
  });
});

/**
 * Latin a Persian or Urdu sentence keeps besides the Arabic table's: names of products and standards (NPS, QR, IANA, a
 * zone's name, Azure DevOps, Typeform, Excel, WhatsApp, Fluent, DataMatrix, MB, S/M/L sizes) and the names in code a
 * developer's hint gives (a data source's members, a field's name, a role's id) — the rest, isolated left to right, is
 * code by its marks.
 */
const RTL_KEPT = [
  ...['QR', 'IANA', 'Africa', 'Cairo', 'Europe', 'Berlin', 'NPS', 'P', 'Planning', 'Azure', 'DevOps', 'DataMatrix', 'Typeform', 'EUR', 'WhatsApp', 'Fluent', 'MB', 'S', 'M', 'L', 'Excel'],
  ...['user', 'sales_team', 'group_sale_manager', 'base', 'group_portal', 'limits', 'saveDraft', 'loadDraft', 'pay', 'suggest', 'searchToFilter', 'totals', 'lost_reason', 'is_done', 'manual_consumption', 'desc', 'sequence', 'parent', 'id'],
];
const englishIn = (words: string) => latinIn(words.replace(/\u2066[^\u2069]*\u2069/g, '')).filter((word) => !RTL_KEPT.includes(word));

describe.each(['fa', 'ur'] as const)('the designer in %s', (locale) => {
  it('is in its own letters throughout, no English left behind, numbers in Latin digits', () => {
    const left = everyWord(TABLES[locale] as unknown as Table).filter(({ words }) => englishIn(words).length || /[يك٠-٩۰-۹]/.test(words));
    expect(left).toEqual([]);
  });

  it('runs right to left, its dates on the Gregorian calendar', async () => {
    await designerWordsReady(locale);
    expect(designerDirection(locale)).toBe('rtl');
    expect(new Intl.DateTimeFormat(DATE_TAGS[locale], { year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(2026, 9, 15))).toBe('2026');
    const element = document.createElement('div');
    document.body.append(element);
    document.documentElement.dir = 'ltr';
    const handle = mountScreenEditor(element, { designer: createDesigner({ page: blankPage('screen', 'Visit'), locale }) });
    expect([handle.element.dir, handle.element.lang]).toEqual(['rtl', locale]);
    handle.destroy();
    document.body.replaceChildren();
    document.documentElement.removeAttribute('dir');
  });
});

describe('counts in the four languages', () => {
  it('take the forms Intl.PluralRules gives each: Persian’s one for 0 and 1, Spanish’s many for a million', () => {
    const forms = { one: 'one #', many: 'many #', other: 'other #' };
    expect([0, 1, 2].map((n) => plural('fa', n, forms))).toEqual(['one 0', 'one 1', 'other 2']);
    for (const locale of ['tr', 'ur'] as const) expect([0, 1, 2].map((n) => plural(locale, n, forms))).toEqual(['other 0', 'one 1', 'other 2']);
    expect([1, 2, 1_000_000].map((n) => plural('es', n, forms))).toEqual(['one 1', 'other 2', 'many 1000000']);
    expect([designerDirection('tr'), designerDirection('es')]).toEqual(['ltr', 'ltr']);
  });
});
