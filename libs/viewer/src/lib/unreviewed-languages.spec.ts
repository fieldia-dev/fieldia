import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { wordsReady, type Page } from '@fieldia/core';
import { mountViewer, VIEWER_LABELS, type ViewerHandle } from '../index';

/**
 * The viewer's own words in Turkish, Persian, Urdu and Spanish (0.31): machine-assisted, not yet reviewed by a native
 * speaker, as each table's header says. Every word English has but the sentences in a page's words for its records,
 * which each language gives where they read right; a page in Persian or Urdu runs right to left in them, its numbers
 * typed in Persian digits read.
 */

const NEW = ['tr', 'fa', 'ur', 'es'] as const;

// Each in a chunk of its own, fetched where it is spoken: here, at once.
beforeAll(() => Promise.all(NEW.map(wordsReady)));
const NOUN = /Noun(One|Two|Many)?$/;
const RECORDS = new Set(['record', 'records', 'aRecord']);
const blanks = (text: string, key: string) =>
  [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))]
    .filter((blank) => !(NOUN.test(key) && RECORDS.has(blank)))
    .filter((blank) => !(blank === 'n' && key.endsWith('One')))
    .sort();

describe.each(NEW)('the viewer’s words in %s', (locale) => {
  it('are every word English has, with its blanks; a sentence in a page’s words names its records', () => {
    const words = VIEWER_LABELS[locale] as unknown as Record<string, string>;
    const english = VIEWER_LABELS.en as unknown as Record<string, string>;
    for (const key of Object.keys(english)) if (!NOUN.test(key)) expect({ key, given: key in words }).toEqual({ key, given: true });
    for (const [key, text] of Object.entries(words)) {
      expect({ key, english: key in english }).toEqual({ key, english: true });
      expect({ key, text: typeof text === 'string' && text.trim().length > 0 }).toEqual({ key, text: true });
      expect({ key, blanks: blanks(text, key) }).toEqual({ key, blanks: blanks(english[key], key) });
      if (NOUN.test(key)) expect({ key, named: /\{(record|records|aRecord)\}/.test(text) }).toEqual({ key, named: true });
    }
  });

  it('say in their header that they are unreviewed', () => {
    // Its doc comment's words, whatever lines they are written on.
    const head = readFileSync(join(__dirname, 'locales', `${locale}.ts`), 'utf8').split('export const')[0].replace(/\s*\n\s*\*\s*/g, ' ');
    expect(head).toContain('UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.');
  });
});

const page: Page = {
  fieldia: '0.10',
  id: 'order',
  data: { kind: 'responses' },
  fields: { name: { type: 'char', label: 'Name', required: true }, quantity: { type: 'integer', label: 'Quantity' }, price: { type: 'float', label: 'Price', digits: [10, 2] } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'section', id: 's', children: [{ type: 'field', id: 'n', field: 'name' }, { type: 'field', id: 'q', field: 'quantity' }, { type: 'field', id: 'p', field: 'price' }] }] },
};

let handle: ViewerHandle | undefined;
afterEach(() => {
  handle?.destroy();
  handle = undefined;
  document.body.replaceChildren();
});
async function show(locale: string) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, locale });
  await handle.drawn;
  return host;
}

describe.each([
  ['fa', 'rtl'],
  ['ur', 'rtl'],
  ['tr', null],
  ['es', null],
] as const)('a page in %s', (locale, dir) => {
  it('speaks the language’s words, in its direction', async () => {
    const host = await show(locale);
    const form = host.querySelector('.fd-form') as HTMLElement;
    expect(form.getAttribute('lang')).toBe(locale);
    expect(form.getAttribute('dir')).toBe(dir);
    expect(host.querySelector('button[type="submit"]')?.textContent?.trim()).toBe(VIEWER_LABELS[locale].submit);
  });
});

describe('a number typed in Persian digits', () => {
  it.each(['fa', 'ur'])('reads on a page in %s', async (locale) => {
    const host = await show(locale);
    const box = (id: string) => host.querySelector(`[data-node="${id}"] input`) as HTMLInputElement;
    for (const [id, typed] of [['q', '۱۲۵'], ['p', '۱۲٫۵']] as const) {
      box(id).focus();
      box(id).value = typed;
      box(id).dispatchEvent(new Event('input', { bubbles: true }));
      box(id).dispatchEvent(new Event('change', { bubbles: true }));
      box(id).blur();
    }
    expect(handle?.form.getState().values).toMatchObject({ quantity: 125, price: 12.5 });
  });
});
