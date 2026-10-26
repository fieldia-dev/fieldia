import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkPage, createForm, fillValues, literalPage, literalWords, plainWords, splitValues, translatePage, validatePage, valuesIn, type Page } from '../../index';
import { wordsAt } from './test-words-slots';

/**
 * The one reader of a page's words: `{field}` a value, `{field|words}` its words while empty, and a backslash right
 * before a brace that brace as written — a run of them halved, an odd one leaving the brace written. Words with no
 * backslash before a brace read as they did in 0.35.1, and `literalWords` writes any text so that every reader shows it
 * exactly, with nothing for the page check to refuse.
 */

/** 0.35.1's reader, as it was: what words without an escaped brace still read as. */
const OLD = /\{([A-Za-z_][A-Za-z0-9_]*)(?:\|([^{}]*))?\}/g;
const old = {
  valuesIn: (words: string) => [...words.matchAll(OLD)].map((match) => match[1]),
  fillValues: (words: string, value: (field: string) => string) => words.replace(OLD, (_, name: string, empty?: string) => value(name) || (empty ?? '')),
  splitValues(words: string) {
    const parts: { text: string; field?: string; fallback?: string }[] = [];
    let at = 0;
    for (const match of words.matchAll(OLD)) {
      if (match.index > at) parts.push({ text: words.slice(at, match.index) });
      parts.push({ text: '', field: match[1], ...(match[2] !== undefined ? { fallback: match[2] } : {}) });
      at = match.index + match[0].length;
    }
    if (at < words.length) parts.push({ text: words.slice(at) });
    return parts;
  },
};

/** A field's value as these tests show it: `<name>`, and nothing for `empty`. */
const shown = (name: string) => (name === 'empty' ? '' : `<${name}>`);

/** Flowyard's step studio's words, verbatim: braces it quotes, never values. */
const FLOWYARD = ['Written from its settings: {list} is a setting in words, {method:value} as it is stored.', 'Such as "{added:member} added · {failed} failed".'];
/** amlak's step packs' words, put into pages as labels, help and choices. */
const AMLAK = ["Values for the {placeholders} in the action's address", 'اكتب {{placeholder}} مكان القيمة', '… {{customer}} في القالب', '={{ $json.customer }}'];

/** Strings of braces, backslashes, bars, colons, dollars, spaces, Arabic and the marks of right-to-left text. */
function tricky(count: number, seed = 7): string[] {
  const pieces = ['{', '}', '\\', '\\\\', '|', ':', '$', ' ', 'a', 'list', '_x1', '{list}', '{empty|none}', '{{', '}}', 'عميل', '\u200f', '\u202b', '\u202c', '\n', '"', "'", '·'];
  let state = seed;
  const next = () => (state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  return Array.from({ length: count }, () => Array.from({ length: Math.floor(next() * 12) }, () => pieces[Math.floor(next() * pieces.length)]).join(''));
}

describe('the one reader of a page’s words', () => {
  // words, filled (values `<name>`, `empty` empty), as written where words show no values, the fields named.
  const CASES: [string, string, string, string[]][] = [
    [String.raw`{list}`, '<list>', '{list}', ['list']],
    [String.raw`\{list}`, '{list}', '{list}', []],
    [String.raw`\\{list}`, '\\<list>', String.raw`\{list}`, ['list']],
    [String.raw`\\\{list}`, String.raw`\{list}`, String.raw`\{list}`, []],
    [String.raw`\\\\{list}`, '\\\\<list>', String.raw`\\{list}`, ['list']],
    [String.raw`\{method:value}`, '{method:value}', '{method:value}', []],
    ['{method:value}', '{method:value}', '{method:value}', []],
    ['{empty|this branch}', 'this branch', '{empty|this branch}', ['empty']],
    ['{name|}', '<name>', '{name|}', ['name']],
    [String.raw`\{empty|this branch}`, '{empty|this branch}', '{empty|this branch}', []],
    ['{{ index }}', '{{ index }}', '{{ index }}', []],
    ['{{customer}}', '{<customer>}', '{{customer}}', ['customer']],
    [String.raw`\{\{customer}}`, '{{customer}}', '{{customer}}', []],
    [String.raw`\{{customer}}`, '{<customer>}', '{{customer}}', ['customer']],
    [String.raw`{a|{b}}`, '{a|<b>}', '{a|{b}}', ['b']],
    [String.raw`{a|\{b}}`, '{a|{b}}', '{a|{b}}', []],
    ['}{x}{', '}<x>{', '}{x}{', ['x']],
    [String.raw`C:\Users\name`, String.raw`C:\Users\name`, String.raw`C:\Users\name`, []],
    [String.raw`C:\files\{name}.pdf`, 'C:\\files{name}.pdf', 'C:\\files{name}.pdf', []],
    [String.raw`C:\files\\{name}.pdf`, 'C:\\files\\<name>.pdf', String.raw`C:\files\{name}.pdf`, ['name']],
    [String.raw`{empty|C:\}`, 'C:\\', String.raw`{empty|C:\}`, ['empty']],
    [String.raw`a\b \n`, String.raw`a\b \n`, String.raw`a\b \n`, []],
    ['ends with {', 'ends with {', 'ends with {', []],
    [String.raw`ends with \{`, 'ends with {', 'ends with {', []],
    [String.raw`ends with \\{`, String.raw`ends with \{`, String.raw`ends with \{`, []],
    ['ends with \\', 'ends with \\', 'ends with \\', []],
    ['{x}\\', '<x>\\', '{x}\\', ['x']],
    ['', '', '', []],
  ];

  it.each(CASES)('reads %s', (words, filled, plain, fields) => {
    expect(fillValues(words, shown)).toBe(filled);
    expect(plainWords(words)).toBe(plain);
    expect(valuesIn(words)).toEqual(fields);
    // Cut at its values, it is the same words: each piece as shown, each value in turn.
    expect(
      splitValues(words)
        .map((piece) => (piece.field ? shown(piece.field) || (piece.fallback ?? '') : piece.text))
        .join('')
    ).toBe(filled);
  });

  it('reads words with no backslash before a brace as 0.35.1 did, piece for piece', () => {
    const words = [...tricky(3000), ...tricky(3000, 11)].filter((text) => !/\\\{/.test(text));
    expect(words.length).toBeGreaterThan(2000);
    for (const text of words) {
      expect(fillValues(text, shown)).toBe(old.fillValues(text, shown));
      expect(splitValues(text)).toEqual(old.splitValues(text));
      expect(valuesIn(text)).toEqual(old.valuesIn(text));
      expect(plainWords(text)).toBe(text);
    }
  });

  it('reads every example page’s and template’s words as 0.35.1 did', () => {
    const root = join(__dirname, '../../../../../examples');
    const files = ['pages', 'templates'].flatMap((folder) => readdirSync(join(root, folder)).filter((name) => name.endsWith('.json')).map((name) => join(root, folder, name)));
    expect(files.length).toBeGreaterThan(100);
    let read = 0;
    for (const file of files) {
      const page = JSON.parse(readFileSync(file, 'utf8'));
      if (!page.fields || !page.layout) continue;
      for (const { path, words } of wordsAt(page)) {
        // None of them escapes a brace: each reads exactly as before.
        expect(`${file}: ${path}: ${/\\\{/.test(words)}`).toBe(`${file}: ${path}: false`);
        expect(fillValues(words, shown)).toBe(old.fillValues(words, shown));
        expect(splitValues(words)).toEqual(old.splitValues(words));
        expect(plainWords(words)).toBe(words);
        read++;
      }
    }
    expect(read).toBeGreaterThan(3000);
  });
});

describe('the one reader, alone', () => {
  it('is the only source that reads a value’s braces: a new way to show a page’s words goes through it', () => {
    const libs = join(__dirname, '../../../../');
    const sources = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? (entry.name === 'node_modules' ? [] : sources(join(dir, entry.name))) : /\.ts$/.test(entry.name) && !/\.spec\.ts$|^test-/.test(entry.name) ? [join(dir, entry.name)] : []));
    // A pattern for `{name}` or `{name|words}` — a brace, then a name's first letter — written anywhere but the reader.
    const own = sources(libs).filter((file) => !file.endsWith('format/words.ts') && /\\\{\(?\[A-Za-z_\]/.test(readFileSync(file, 'utf8')));
    expect(own.map((file) => file.slice(libs.length))).toEqual([]);
  });
});

describe('literalWords', () => {
  it('writes the escape: each brace escaped, each run of backslashes before one doubled, other backslashes as they are', () => {
    expect(literalWords('{list}')).toBe(String.raw`\{list}`);
    expect(literalWords(String.raw`\{list}`)).toBe(String.raw`\\\{list}`);
    expect(literalWords(String.raw`\\{x}`)).toBe(String.raw`\\\\\{x}`);
    expect(literalWords('{{customer}}')).toBe(String.raw`\{\{customer}}`);
    expect(literalWords(String.raw`C:\Users\name`)).toBe(String.raw`C:\Users\name`);
    expect(literalWords('no braces')).toBe('no braces');
  });

  it('is shown exactly as written by every reader, with no value: any text of braces, backslashes, bars, Arabic', () => {
    for (const text of [...FLOWYARD, ...AMLAK, ...tricky(4000, 3)]) {
      const literal = literalWords(text);
      expect(fillValues(literal, shown)).toBe(text);
      expect(plainWords(literal)).toBe(text);
      expect(valuesIn(literal)).toEqual([]);
      expect(splitValues(literal)).toEqual(text ? [{ text }] : []);
    }
  });

  it('gives the page check nothing to refuse, wherever words take values, and the form shows it as written', () => {
    for (const text of [...FLOWYARD, ...AMLAK, ...tricky(150, 5)].filter((text) => text.trim())) {
      const literal = literalWords(text);
      const page = {
        fieldia: '0.13',
        id: 'steps',
        data: { kind: 'responses' },
        fields: {
          method: { type: 'char', label: literal, help: literal },
          kind: { type: 'selection', label: 'Kind', options: [{ value: 'a', label: literal }] },
        },
        layout: {
          type: 'sections',
          id: 'root',
          children: [
            { type: 'field', id: 'f-method', field: 'method', placeholder: literal },
            { type: 'field', id: 'f-kind', field: 'kind' },
            { type: 'text', id: 't', text: literal },
            { type: 'button', id: 'b', label: literal, confirm: literal, steps: [{ do: 'say', message: literal }] },
          ],
        },
      } as unknown as Page;
      const checked = checkPage(page);
      expect(checked.ok ? [] : checked.issues).toEqual([]);
      const valid = validatePage(page);
      expect(valid.ok ? [] : valid.issues).toEqual([]);
      const form = createForm({ page });
      expect(form.words(literal)).toBe(text);
    }
  });
});

describe('Flowyard’s step studio’s help', () => {
  const page = (help: [string, string]) =>
    ({
      fieldia: '0.13',
      id: 'step-studio',
      data: { kind: 'responses' },
      fields: {
        list: { type: 'char', label: 'List' },
        method: { type: 'char', label: 'Method', help: help[0] },
        report: { type: 'text', label: 'Report', help: help[1] },
      },
      layout: {
        type: 'sections',
        id: 'root',
        children: ['list', 'method', 'report'].map((field) => ({ type: 'field', id: `f-${field}`, field })),
      },
    }) as unknown as Page;
  const ESCAPED: [string, string] = [String.raw`Written from its settings: \{list} is a setting in words, \{method:value} as it is stored.`, String.raw`Such as "\{added:member} added · \{failed} failed".`];

  it('passes the page check and the whole check, and reads as written', () => {
    const checked = checkPage(page(ESCAPED));
    expect(checked.ok ? [] : checked.issues).toEqual([]);
    const valid = validatePage(page(ESCAPED));
    expect(valid.ok ? [] : valid.issues).toEqual([]);
    const form = createForm({ page: page(ESCAPED) });
    form.setValue('list', 'Customers');
    expect(ESCAPED.map((help) => form.words(help))).toEqual(FLOWYARD);
    // literalWords writes them so.
    expect(FLOWYARD.map(literalWords)).toEqual(ESCAPED);
  });

  it('as written, unescaped, its {failed} is still refused as a field the page has not', () => {
    const valid = validatePage(page(FLOWYARD as [string, string]));
    expect(valid.ok ? [] : valid.issues.map((issue) => `${issue.path}: ${issue.message}`)).toEqual(['fields.report.help: no field "failed"']);
  });
});

describe('literalPage', () => {
  const words = (page: Page) => wordsAt(page).map((at) => `${at.path}=${at.words}`);
  const page = {
    fieldia: '0.13',
    id: 'steps',
    data: { kind: 'responses' },
    title: 'Step {list}',
    fields: {
      method: { type: 'char', label: 'Method {method:value}', help: '={{ $json.customer }}', patternHint: 'Like {x}' },
      kind: { type: 'selection', label: 'Kind', options: [{ value: '{a}', label: 'A {placeholders}' }], quiz: { feedback: { right: 'Yes {x}', wrong: 'No {y}' } } },
    },
    layout: {
      type: 'sections',
      id: 'root',
      children: [
        { type: 'field', id: 'f-method', field: 'method', placeholder: '{{placeholder}}', readonlyReason: 'Locked {x}', options: { yesLabel: 'Yes {x}', mask: '{9}' } },
        { type: 'field', id: 'f-kind', field: 'kind', invisible: 'method == "{x}"' },
        { type: 'button', id: 'b', label: 'Go {x}', steps: [{ do: 'open', url: 'https://example.com/{x}' }, { do: 'say', message: 'Done {x}' }] },
      ],
    },
    translations: { ar: { 'Step {list}': 'خطوة {list}', Kind: 'النوع' } },
  } as unknown as Page;

  it('writes every word a person reads to show as written, and the translations so they still find them', () => {
    const literal = literalPage(page);
    expect(words(literal)).toEqual(words(page).map((at) => at.replace(/=([\s\S]*)$/, (_, text: string) => `=${literalWords(text)}`)));
    expect(literal.translations).toEqual({ ar: { [String.raw`Step \{list}`]: String.raw`خطوة \{list}`, Kind: 'النوع' } });
    expect(words(literal)).toContain(String.raw`fields.kind.quiz.feedback.right=Yes \{x}`);
    expect(words(literal)).toContain(String.raw`layout.children[0].options.yesLabel=Yes \{x}`);
  });

  it('leaves every name, id, value, condition, address and setting byte for byte as it was', () => {
    const literal = literalPage(page);
    const blank = (given: Page) => JSON.stringify({ ...translatePage(given, () => '·'), translations: undefined });
    expect(blank(literal)).toBe(blank(page));
    const kept = literal as unknown as typeof page & { fields: { kind: { options: { value: string }[] } }; layout: { children: Record<string, unknown>[] } };
    expect(kept.fields.kind.options[0].value).toBe('{a}');
    expect(kept.layout.children[0]['options']).toEqual({ yesLabel: String.raw`Yes \{x}`, mask: '{9}' });
    expect(kept.layout.children[1]['invisible']).toBe('method == "{x}"');
    expect((kept.layout.children[2]['steps'] as Record<string, unknown>[])[0]).toEqual({ do: 'open', url: 'https://example.com/{x}' });
    // The page given is left as it was.
    expect((page.fields['method'] as { label: string }).label).toBe('Method {method:value}');
  });
});
