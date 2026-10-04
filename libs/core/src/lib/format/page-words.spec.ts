import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isRightToLeft, localizePage, pageWords, translatePage, validatePage, type Page } from '../../index';

/**
 * The words of a page, for a translator: every word a person reads, once
 * each, in the order a person reads them — the same words `translatePage`
 * passes through a translator, so a grid of them and the page shown in
 * another language never disagree.
 */

const EXAMPLES = join(__dirname, '..', '..', '..', '..', '..', 'examples', 'pages');
const example = (name: string): Page => JSON.parse(readFileSync(join(EXAMPLES, `${name}.page.json`), 'utf8'));
const examples = readdirSync(EXAMPLES).filter((f) => f.endsWith('.page.json')).map((f) => f.replace('.page.json', ''));

/** The words translatePage hands the translator, as a set. */
function translated(page: Page): Set<string> {
  const seen = new Set<string>();
  translatePage(page, (text) => {
    if (text.trim()) seen.add(text);
    return text;
  });
  return seen;
}

const survey: Page = {
  fieldia: '0.1',
  id: 'p',
  title: 'Sign up',
  description: 'It takes a minute.',
  data: { kind: 'responses' },
  fields: {
    // Defined first, shown last: the words follow the page, not the list of fields.
    days: { type: 'selection', label: 'Delivery days', multiple: true, options: [{ value: 'sun', label: 'Sunday' }, { value: 'mon', label: 'Monday' }] },
    name: { type: 'char', label: 'Your name', help: 'As on your ID' },
    score: { type: 'integer', label: 'How likely?', min: 0, max: 10 },
    // On no page part at all: its words come last.
    unused: { type: 'char', label: 'Kept for later' },
  },
  layout: {
    type: 'wizard',
    id: 'steps',
    nextLabel: 'Onwards',
    finishLabel: 'Send',
    children: [
      {
        type: 'step',
        id: 'one',
        label: 'About you',
        children: [
          { type: 'text', id: 't', text: 'Thanks for coming.' },
          { type: 'field', id: 'n', field: 'name', placeholder: 'Sara Ali', validate: [{ minLength: 2, message: 'Two letters at least' }] },
          { type: 'image', id: 'i', src: 'https://example.com/map.png', alt: 'A map of the venue' },
          { type: 'field', id: 's', field: 'score', widget: 'rating', options: { style: 'scale', startLabel: 'Not at all', endLabel: 'Very' } },
        ],
      },
      { type: 'step', id: 'two', label: 'Delivery', children: [{ type: 'field', id: 'd', field: 'days', label: 'Which days?' }] },
    ],
  },
};

describe('pageWords', () => {
  it('lists every word a person reads, in the order they read it', () => {
    expect(pageWords(survey)).toEqual([
      'Sign up',
      'It takes a minute.',
      'About you',
      'Thanks for coming.',
      // A field where it stands: its label, the words in its box, its help, then the rest.
      'Your name',
      'Sara Ali',
      'As on your ID',
      'Two letters at least',
      'A map of the venue',
      'How likely?',
      'Not at all',
      'Very',
      'Delivery',
      // The label the page gives it first, then the one its definition keeps.
      'Which days?',
      'Delivery days',
      'Sunday',
      'Monday',
      // A wizard's buttons, under its pages.
      'Onwards',
      'Send',
      'Kept for later',
    ]);
  });

  it('lists a word once, however often the page uses it', () => {
    const twice: Page = { ...survey, fields: { ...survey.fields, unused: { type: 'char', label: 'Your name' } } };
    expect(pageWords(twice).filter((w) => w === 'Your name')).toHaveLength(1);
  });

  it('leaves out ids, field names, values, conditions, pictures and empty words', () => {
    const words = pageWords({ ...survey, description: '  ' });
    for (const notWords of ['p', 'steps', 'one', 'name', 'sun', 'mon', 'rating', 'scale', 'https://example.com/map.png', '  ']) expect(words).not.toContain(notWords);
  });

  it('has every word translatePage translates, and nothing else, on every example page', () => {
    for (const name of examples) {
      const page = example(name);
      expect({ name, words: new Set(pageWords(page)) }).toEqual({ name, words: translated(page) });
      expect(pageWords(page).length).toBeGreaterThan(3);
    }
  });

  it('reads a sheet’s header, a table’s columns and an answer rule’s message', () => {
    const words = pageWords(example('customer'));
    for (const word of ['Customer', 'Block', 'Block this customer? New orders will be refused.', 'Sales', 'Blocked', 'Key account', 'Contacts']) expect(words).toContain(word);
    expect(pageWords(example('order'))).toContain('Product');
    expect(pageWords(example('rules'))).toContain('A postcode has five digits, such as 11511.');
  });

  it('keeps the page’s translations out of its words, even one that translates a word such as “label”', () => {
    const page: Page = { ...survey, translations: { ar: { label: 'تسمية', 'Sign up': 'التسجيل' } } };
    expect(pageWords(page)).not.toContain('تسمية');
    expect(pageWords(page)).not.toContain('التسجيل');
    expect(translatePage(page, (t) => `«${t}»`).translations).toEqual(page.translations);
  });
});

describe('a widget’s own words', () => {
  it('translates the words a widget shows, such as a scale’s ends, and leaves its settings alone', () => {
    const out = translatePage(survey, (t) => `«${t}»`);
    const node = (out.layout as { children: { children: { options?: Record<string, unknown> }[] }[] }).children[0].children[3];
    expect(node.options).toEqual({ style: 'scale', startLabel: '«Not at all»', endLabel: '«Very»' });
  });

  it('shows a scale’s ends in the language the page keeps', () => {
    const page: Page = { ...survey, translations: { ar: { 'Not at all': 'إطلاقًا', Very: 'جدًا' } } };
    const node = (localizePage(page, 'ar').layout as { children: { children: { options?: Record<string, unknown> }[] }[] }).children[0].children[3];
    expect(node.options).toEqual({ style: 'scale', startLabel: 'إطلاقًا', endLabel: 'جدًا' });
  });
});

describe('the language a page is written in', () => {
  it('may say the language its own words are in, as a language tag', () => {
    expect(validatePage({ ...survey, language: 'ar' }).ok).toBe(true);
    expect(validatePage({ ...survey, language: 'pt-BR' }).ok).toBe(true);
    expect(validatePage({ ...survey, language: 'Arabic' }).ok).toBe(false);
  });
});

describe('isRightToLeft', () => {
  it('knows the languages written right to left, by their first part', () => {
    for (const tag of ['ar', 'ar-EG', 'he', 'iw', 'fa', 'fa-IR', 'ur', 'ps', 'sd', 'yi', 'dv', 'ckb', 'ug', 'ks', 'syr', 'AR']) expect({ tag, rtl: isRightToLeft(tag) }).toEqual({ tag, rtl: true });
    for (const tag of ['en', 'fr', 'de-AT', 'es-419', 'ku', 'tr', 'zh-Hant', 'hi', 'ja', 'arn', 'hea', '']) expect({ tag, rtl: isRightToLeft(tag) }).toEqual({ tag, rtl: false });
  });

  it('follows the script a tag names over its language', () => {
    for (const tag of ['az-Arab', 'pa-Arab', 'uz-Arab-AF', 'ku-Arab', 'jrb-Hebr', 'ms-arab']) expect({ tag, rtl: isRightToLeft(tag) }).toEqual({ tag, rtl: true });
    for (const tag of ['sd-Deva', 'ks-Deva', 'ar-Latn', 'pa-Guru']) expect({ tag, rtl: isRightToLeft(tag) }).toEqual({ tag, rtl: false });
  });
});
