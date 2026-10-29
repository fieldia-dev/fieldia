import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMemoryDataSource, literalPage, literalWords, translatePage, type AppFunctions, type Page } from '@fieldia/core';
import { placesOfWords, schemaPlaces, wordsAt } from '../../../core/src/lib/format/test-words-slots';
import { GATE_PAGES, GATE_RECORDS, GATE_SAVED } from './test-literal-pages';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * The gate of literal words. Every word a person reads, in every place the page format has for one (the one list of a
 * page's words, `wordsAt`: what `translatePage` and `literalPage` go through), written with `literalWords` — braces,
 * doubled braces, backslashes, a bar, Arabic — is shown exactly as it is written, wherever the viewer draws it: never
 * with its backslash, never read as a value, never eaten by one of Fieldia's own sentences. The pages are every example
 * page and template, and the gate's own (test-literal-pages.ts), which hold the places no example does; each is drawn,
 * its tabs opened, its confirmations asked, its menus opened, its wizard walked, it is checked, sent, and printed. A
 * place the format gains is held by no page until one is written for it: the gate fails until it is, drawn.
 */

const TRICKY = ['{list} \\{x} {{customer}} a\\b |: عميل', '={{ $json.customer }} \\\\{name} {a|b}', '… {{customer}} في القالب \u200f{method:value}', 'C:\\files\\{name} {placeholders} | ‏'];
/** The words a place holds in the gate: its number, then a tricky text. */
const said = (n: number) => `⟦${n}⟧ ${TRICKY[n % TRICKY.length]}`;

/**
 * Places the viewer does not draw where the format lets a page put them — a page may hold them, a person never reads
 * them there — each with why. One drawn later must leave this list: the gate fails while it shows here.
 */
const NOT_DRAWN: Record<string, string> = {
  ...Object.fromEntries(
    ['FieldNode.controlButtons[]', 'FieldNode.rowButtons[]', 'FieldNode.selectedButtons[]', 'layout>ListNode.actions[]', 'layout>ListNode.rowButtons[]', 'children>RelatedNode.rowButtons[]'].flatMap((owner) =>
      ['menuLabel', 'pressedLabel'].map((key) => [`${owner}:button.${key}`, 'a table’s or a list’s button is a plain press: its label, asked first where it says; no menu, never pressed'])
    )
  ),
  ...Object.fromEntries(['columns', 'rows', 'models'].flatMap((owner) => ['alt', 'caption'].map((key) => [`${owner}>Option.${key}`, 'a matrix’s rows and columns and a reference’s kinds are their words alone']))),
  'tones>ToneWhen.label': 'a cell’s tone is its colour: only a list’s row tones say their words, in the key over its rows',
  'InnerLineField.help': 'a table of lines heads its columns with their labels, never their help',
  'LinkedField.help': 'a table of links heads its columns with their labels, never their help',
  'LinkedField.patternHint': 'a link’s own fields are shown, never typed in: nothing is held to their pattern',
  'options>Option.alt': 'a line’s choices are its words in its cell and its dialog: no picture, no caption',
  'options>Option.caption': 'a line’s choices are its words in its cell and its dialog: no picture, no caption',
};

/**
 * The words a widget's settings hold (`options` on a field's part), which the format leaves to each widget: every one a
 * widget reads, found in their source — a new one fails the gate until a page here shows it.
 */
const WIDGET_WORDS = ['addLabel', 'addNoteLabel', 'addSectionLabel', 'alt', 'emptyLabel', 'emptyLink', 'endLabel', 'footerLabel', 'help', 'itemLabel', 'noLabel', 'noteLabel', 'startLabel', 'yesLabel'];

/** The words keys widgets read from their settings, as their source reads them. */
function widgetWordsRead(): string[] {
  const found = new Set<string>();
  const roots = ['widgets', 'viewer', 'map', 'grid', 'calendar', 'gantt'].map((lib) => join(__dirname, '../../..', lib, 'src/lib'));
  for (const root of roots)
    for (const file of readdirSync(root).filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts') && !name.startsWith('test-'))) {
      const code = readFileSync(join(root, file), 'utf8');
      for (const [, key] of code.matchAll(/\boptions(?:\?\.|\.)(?:\[')?(\w+(?:Label|Link)|help|alt)\b/g)) found.add(key);
      for (const [, key] of code.matchAll(/(?:options|own)(?:\?\.)?\[(?:[^\]]*\? )?'(\w+(?:Label|Link))'/g)) found.add(key);
      for (const [, one, other] of code.matchAll(/\?\.\[\w+ \? '(\w+Label)' : '(\w+Label)'\]/g)) [one, other].forEach((key) => found.add(key));
      for (const [, key] of code.matchAll(/\bwords\('(\w+(?:Label|Link)|help)'\)/g)) found.add(key);
    }
  return [...found].sort();
}

/** A page made for its timing, not its words: 500 fields of the kinds the others hold. Its words are checked, not drawn. */
const UNDRAWN_PAGES = new Set(['pages/big.page.json']);

/** Places drawn by another package, each checked by that package's own gate. */
const ELSEWHERE: Record<string, string> = {
  'children>MapNode:map.label': '@fieldia/map (libs/map/src/lib/literal-words.spec.ts)',
  'layers>MapLayer.label': '@fieldia/map (libs/map/src/lib/literal-words.spec.ts)',
};

/** Places whose words the viewer shows in capitals on purpose: a record's kind on its head. */
const CAPITALS = new Set(['kind>SheetKind.label']);

/** A page's words written with literalWords, each place its own: what each word should show as, and where it is. */
function marked(page: Page, from: number) {
  const at = wordsAt(page);
  const places = placesOfWords(page);
  let n = from;
  const literal = translatePage({ ...page, translations: undefined }, () => literalWords(said(n++)));
  return { page: literal, words: at.map((word, i) => ({ n: from + i, path: word.path, place: places.get(word.path) ?? `? ${word.path}` })) };
}

const examples = (): { name: string; page: Page }[] =>
  ['pages', 'templates'].flatMap((folder) =>
    readdirSync(join(__dirname, '../../../../examples', folder))
      .filter((file) => file.endsWith('.json') && file !== 'index.json')
      .map((file) => ({ name: `${folder}/${file}`, page: JSON.parse(readFileSync(join(__dirname, '../../../../examples', folder, file), 'utf8')) as Page }))
  );

/** The demos' own function a listing calls, as they give it. */
const FUNCTIONS: AppFunctions = { districtPrice: { takes: [1, 1], call: () => 0 } };

const flush = async (times = 4) => {
  for (let i = 0; i < times; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

/**
 * Everything a person may read or hear now: the document's text and every attribute (its markup: no word here holds a
 * character markup writes otherwise), every box's value, the tab's title.
 */
function readNow(): string {
  const texts = [document.title, document.documentElement.outerHTML];
  for (const el of document.querySelectorAll<HTMLInputElement>('input, textarea')) texts.push(el.value);
  return texts.join('\n');
}

const press = (el: Element | null | undefined) => el?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
const escape = () => (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

/**
 * A page drawn in each of its states, and what was read in each: drawn, each tab shown, checked, on paper, sent. A page
 * of the gate's own (`every`) is walked further: each menu opened, a row of each table ticked, each press that asks
 * first asked, a line opened in its dialog and saved, AI help's box opened, its wizard walked to its end.
 */
async function drawn(page: Page, every: boolean): Promise<string[]> {
  const read: string[] = [];
  const host = document.createElement('div');
  document.body.append(host);
  const model = page.data?.kind === 'record' ? page.data.model : undefined;
  const records = every ? JSON.parse(JSON.stringify(GATE_RECORDS)) : model ? { [model]: { 1: {}, 2: {} } } : {};
  const dataSource = createMemoryDataSource({ records, submitted: () => ({ id: 'R-1' }), assist: { suggest: async () => ({ values: {} }) } } as never);
  let handle: ViewerHandle | null = null;
  const now = async (times = 4) => {
    await flush(times);
    read.push(readNow());
  };
  try {
    handle = mountViewer(host, { page, dataSource, pages: GATE_SAVED, functions: FUNCTIONS, ...(model && page.layout.type !== 'list' ? { recordId: 1 } : {}) });
    await now(8);
    for (const tab of host.querySelectorAll<HTMLElement>('[role="tab"]')) {
      press(tab);
      await now();
    }
    if (every) {
      for (const opener of host.querySelectorAll<HTMLElement>('[aria-haspopup="menu"]')) {
        press(opener);
        await now();
        escape();
        await flush();
      }
      // The buttons for the rows chosen.
      press(host.querySelector('tbody input[type="checkbox"]'));
      await now();
      // Its question asked, then not answered.
      for (const { id } of confirms(page)) {
        const own = JSON.stringify(id);
        for (const button of host.querySelectorAll<HTMLElement>(`[data-node=${own}], [data-row-button=${own}], [data-action=${own}]`)) {
          press(button.matches('button') ? button : button.querySelector('button'));
          await now();
          const no = [...(document.querySelector('[role="dialog"], [role="alertdialog"]')?.querySelectorAll('button') ?? [])].pop();
          if (no) press(no);
          else escape();
          await flush();
        }
      }
      // A line in its own dialog — its every field, its own lines — then its Save: what they do not fit, said.
      const line = host.querySelector('.fd-line-open');
      if (line) {
        press(line);
        await now(8);
        // Its own Save & Close, at its foot: never a button of the page in it, shown or hidden (Keep mine, Restore).
        press(document.querySelector('[role="dialog"] .fd-form-dialog-foot .fd-button-primary'));
        await now(8);
        escape();
        await flush();
      }
      for (const fill of host.querySelectorAll<HTMLElement>('.fd-assist-fill')) {
        press(fill);
        await now();
        escape();
        await flush();
      }
      for (let step = 0; step < 12 && host.querySelector('.fd-wizard-nav button[type="submit"]'); step++) {
        press(host.querySelector('.fd-wizard-nav button[type="submit"]'));
        await now();
      }
    }
    handle.check();
    await now();
    window.dispatchEvent(new Event('beforeprint'));
    await now();
    window.dispatchEvent(new Event('afterprint'));
    if (page.data?.kind === 'responses') {
      // Sent, as far as it goes without a person: a payment it asks for is never made.
      await Promise.race([handle.save(), flush(40)]);
      await now(8);
    }
  } catch (error) {
    read.push(`THROWN ${(error as Error).message} ${(error as Error).stack?.split('\n').slice(1, 6).join(' | ')}`);
  }
  handle?.destroy();
  document.body.replaceChildren();
  return read;
}

/** The buttons of a page that ask before they run, by id. */
function confirms(page: Page): { id: string }[] {
  const found: { id: string }[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') {
      const own = value as Record<string, unknown>;
      if (typeof own['confirm'] === 'string' && typeof own['id'] === 'string') found.push({ id: own['id'] });
      Object.values(own).forEach(visit);
    }
  };
  visit(page.layout);
  return found;
}

describe('the gate of literal words', () => {
  const pages = [...examples(), ...GATE_PAGES.map((page) => ({ name: `gate/${page.id}`, page }))];

  it('holds every place the format has for words, on an example page or one of its own', () => {
    const held = new Set(pages.flatMap(({ page }) => [...placesOfWords(page).values()]));
    const missing = [...schemaPlaces()].filter((place) => !held.has(place) && !(place in NOT_DRAWN) && !(place in ELSEWHERE));
    expect(missing).toEqual([]);
  });

  it('knows every word a widget reads from its settings, each a word of the one list', () => {
    expect(widgetWordsRead()).toEqual(WIDGET_WORDS);
    // The one list takes each as words: in a widget's settings, a key ending in Label, and these.
    const words = wordsAt({ layout: { type: 'field', options: Object.fromEntries(WIDGET_WORDS.map((key) => [key, key])) } } as never).map((at) => at.words);
    expect(words.sort()).toEqual(WIDGET_WORDS);
  });

  it('leaves every name, id, value, condition and address byte for byte as it was', () => {
    for (const { name, page } of pages) {
      const blank = (given: Page) => JSON.stringify({ ...translatePage(given, () => '·'), translations: undefined });
      expect(`${name}: ${blank(literalPage(page)) === blank(page)}`).toBe(`${name}: true`);
    }
  });

  it('shows every word exactly as written with literalWords, wherever it is drawn', async () => {
    const shown = new Map<string, 'shown' | 'absent'>();
    const wrong: string[] = [];
    let from = 0;
    for (const { name, page } of pages.filter(({ name }) => !UNDRAWN_PAGES.has(name))) {
      const { page: literal, words } = marked(page, from);
      from += words.length + 1;
      const byNumber = new Map(words.map((word) => [word.n, word]));
      const seen = new Set<number>();
      // Each time a word's number is read, what follows it is the word as written, or it is wrong there.
      for (const read of await drawn(literal, name.startsWith('gate/'))) {
        if (read.startsWith('THROWN')) wrong.push(`${name}: ${read.slice(0, 900)}`);
        for (const found of read.matchAll(/⟦(\d+)⟧/g)) {
          const word = byNumber.get(Number(found[1]));
          if (!word) continue;
          const s = said(word.n);
          if (read.startsWith(s, found.index) || (CAPITALS.has(word.place) && read.startsWith(s.toLocaleUpperCase('en'), found.index))) seen.add(word.n);
          else wrong.push(`${name} ${word.path} [${word.place}]: ${JSON.stringify(read.slice(found.index, found.index + 70))}`);
        }
      }
      for (const word of words) {
        if (seen.has(word.n)) shown.set(word.place, 'shown');
        else if (!shown.has(word.place)) shown.set(word.place, 'absent');
      }
    }
    expect(wrong).toEqual([]);
    const places = [...schemaPlaces()];
    // Every place a page holds is shown on one, but those the viewer does not draw, which none shows.
    expect(places.filter((place) => shown.get(place) !== 'shown' && !(place in NOT_DRAWN) && !(place in ELSEWHERE))).toEqual([]);
    expect(Object.keys(NOT_DRAWN).filter((place) => shown.get(place) === 'shown')).toEqual([]);
    // Every word a widget reads from its settings is shown, by one widget that reads it.
    expect(WIDGET_WORDS.filter((key) => ![...shown].some(([place, how]) => how === 'shown' && place.endsWith(`FieldNode.options.${key}`)))).toEqual([]);
  }, 900000);
});
