import { blankPage, createDesigner } from './designer';
import { DESIGNER_WORDS, designerLocale, type DesignerWords } from './designer-words';
import { ar } from './locales/ar';
import { en } from './locales/en';
import { plural } from './locales/speak';
import { Refusal } from './refusal';
import { mountScreenEditor, type ScreenEditorHandle } from './screen-editor';
import { mountSurveyEditor } from './survey-editor';

/**
 * The designer's own words: English unless a language is given, Arabic when
 * it is, every word of the English table there in Arabic — and the editor
 * running its own language's way while the page drawn in it runs the host's.
 */

/**
 * Latin words an Arabic sentence keeps, as Arabic software keeps them: keys
 * on a keyboard, the names of formats and currencies, and names in code an
 * example gives (an action's, a model's) — typed as they are, in Latin.
 * Anything else in Latin letters is English left behind.
 */
export const LATIN_KEPT = [
  // Keys, and the letters of shortcuts.
  ...['Ctrl', 'Shift', 'Alt', 'Enter', 'Esc', 'Tab', 'Home', 'End', 'Delete', 'Backspace', 'K', 'J', 'Z', 'Y', 'D', 'C', 'V', 'X', 'A', 'G'],
  // Formats and currencies.
  ...['JSON', 'CSV', 'PDF', 'USD', 'EGP', 'IBAN', 'URL', 'https'],
  // JSON's own words, as they are typed in it.
  ...['true', 'false', 'null'],
  // Language tags, as examples of what to type.
  ...['ar', 'es', 'pt-BR'],
  // Fieldia's own name, as its look's.
  'Fieldia',
  // Names in code, in examples.
  ...['contact', 'confirm', 'open_invoices', 'archive', 'active', 'home', 'street'],
];

/** Code an example writes as it is typed: a formula's function and the fields it reads, as in round(price * qty, 2); an escape; and a place in a sentence that something is drawn in, as {language}. */
const CODE = /\b[a-z_]+\([^)]*\)|#\w+|https?:\/\/\S*|mailto:\S*|\\[a-z]|\{[a-z]+\}/g;

/** Latin letters left in Arabic words, besides those kept on purpose and code. */
export function latinIn(text: string): string[] {
  return (text.replace(CODE, '').match(/[A-Za-z][A-Za-z0-9_'’-]*/g) ?? []).filter((word) => !LATIN_KEPT.includes(word));
}

type Table = Record<string, unknown>;

/**
 * Values to say a sentence with, for one that takes a choice of a few (a
 * kind of part, a style): said with each. Any other is said with counts in
 * every plural form Arabic has, a name in Arabic letters, and a list of names.
 */
const SAMPLES: Record<string, unknown[][]> = {
  'changes.addedPart': ['page', 'tab', 'section'].map((kind) => [kind, 'س', 'بجانب «ص»']),
  'changes.removedPart': ['page', 'tab', 'section'].map((kind) => [kind, 'س']),
  'changes.renamedPart': ['page', 'tab', 'section'].map((kind) => [kind, 'س', 'ص']),
  'changes.addedHeader': ['button', 'counter', 'badge', 'ribbon', 'alert'].map((kind) => [kind, 'س']),
  'changes.removedHeader': ['button', 'counter', 'badge', 'ribbon', 'alert'].map((kind) => [kind, 'س']),
  'changes.renamedHeader': ['button', 'counter', 'badge', 'ribbon', 'alert'].map((kind) => [kind, 'س', 'ص']),
  'changes.drawn': ['card', 'plain', 'line', 'framed'].map((style) => ['س', style]),
  'changes.folds': ['no', 'open', 'folded'].map((fold) => ['س', fold]),
  'changes.filesShownAs': ['list', 'thumbnails', 'cards'].map((as) => ['س', as]),
  'changes.filesSwitch': [['س', true], ['س', false]],
  'questions.size': [[512], [1024 * 1024], [7.3 * 1024 * 1024], [2 * 1024 ** 3]],
  'outline.atEdgeOfPage': [[true, 'top'], [false, 'bottom']],
  'outline.atEdgeOfSurvey': [[true, 'top'], [false, 'bottom']],
  'outline.atEdgeOf': [[true, 'top', '«س»', '←'], [false, 'bottom', '«س»', '→']],
  'outline.into': [[null, null], ['«س»', '«ص»']],
  'outline.columnsAt': [[3, 2, 1], [3, undefined, undefined]],
  'outline.tookOff': [['س'], [1], [2], [11]],
  'clipboard.pasted': [['س', 0], ['س', 1], ['س', 2], ['س', 3]],
  'steps.open': ['dialog', 'panel', 'page'].map((as) => ['س', as]),
  'steps.sayTone': ['success', 'warning', 'danger', 'muted'].map((tone) => ['س', tone]),
  'changes.lookValue': [['font', 'serif'], ['density', 'compact'], ['corners', 'round'], ['scheme', 'auto'], ['labels', 'beside'], ['labelWidth', 120], ['accent', null]],
};
const GENERIC: unknown[] = [0, 1, 2, 3, 11, 100, 'س', ['س', 'ص']];

/** Every word of a table, each with its path: a sentence that names or counts is said with sample values. */
function everyWord(table: Table, path = ''): { path: string; words: string }[] {
  return Object.entries(table).flatMap(([key, value]) => {
    const at = path ? `${path}.${key}` : key;
    if (typeof value === 'string') return [{ path: at, words: value }];
    if (typeof value === 'function') {
      const said: { path: string; words: string }[] = [];
      const fn = value as (...args: unknown[]) => unknown;
      for (const args of SAMPLES[at] ?? GENERIC.map((sample) => Array(fn.length).fill(sample))) {
        try {
          said.push({ path: `${at}(${args.join(', ')})`, words: String(fn(...args)) });
        } catch {
          // A sentence that takes a name, said with a number: the name's turn comes.
        }
      }
      if (!said.length) throw new Error(`${at} could not be said`);
      return said;
    }
    return everyWord(value as Table, at);
  });
}

/** The same keys, at every depth, and the same number of values to fill in. */
function shapeOf(table: Table): string[] {
  return Object.entries(table).flatMap(([key, value]) =>
    typeof value === 'string' ? [key] : typeof value === 'function' ? [`${key}/${value.length}`] : shapeOf(value as Table).map((inner) => `${key}.${inner}`)
  );
}

describe('the designer’s language', () => {
  it('is English unless one is given, and none is said', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Visit') });
    expect(designer.words).toBe(en);
    expect(designer.locale).toBeNull();
  });

  it('is Arabic for any Arabic tag, and English for a language it does not speak', () => {
    expect(createDesigner({ page: blankPage('screen', 'Visit'), locale: 'ar' }).words).toBe(ar);
    expect(designerLocale('ar-EG')).toBe('ar');
    expect(designerLocale('AR')).toBe('ar');
    expect(designerLocale('en-GB')).toBe('en');
    const french = createDesigner({ page: blankPage('screen', 'Visit'), locale: 'fr' });
    expect(french.words).toBe(en);
    expect(french.locale).toBe('en');
    expect(DESIGNER_WORDS.ar).toBe(ar);
  });
});

describe('the Arabic table', () => {
  it('has every word the English one has, each taking what it takes', () => {
    expect(shapeOf(ar as unknown as Table)).toEqual(shapeOf(en as unknown as Table));
  });

  it('is Arabic throughout: no English left behind', () => {
    const left = everyWord(ar as unknown as Table).filter(({ words }) => latinIn(words).length || /undefined|NaN|\[object/.test(words));
    expect(left).toEqual([]);
  });

  it('says nothing empty', () => {
    expect(everyWord(ar as unknown as Table).filter(({ words }) => !words.trim())).toEqual([]);
    expect(everyWord(en as unknown as Table).filter(({ words }) => !words.trim())).toEqual([]);
  });

  it('counts in Arabic’s six plural forms, in Latin digits', () => {
    const forms = { zero: 'zero #', one: 'one #', two: 'two #', few: 'few #', many: 'many #', other: 'other #' };
    expect([0, 1, 2, 3, 10, 11, 99, 100, 102, 103].map((n) => plural('ar', n, forms))).toEqual([
      'zero 0',
      'one 1',
      'two 2',
      'few 3',
      'few 10',
      'many 11',
      'many 99',
      'other 100',
      'other 102',
      'few 103',
    ]);
    expect([1, 2, 3, 11, 100].map((n) => ar.bar.changesSince(n, 4))).toEqual([
      'تغيير واحد منذ الإصدار 4:',
      'تغييران منذ الإصدار 4:',
      '3 تغييرات منذ الإصدار 4:',
      '11 تغييرًا منذ الإصدار 4:',
      '100 تغيير منذ الإصدار 4:',
    ]);
    expect([1, 2].map((n) => en.bar.changesSince(n, 4))).toEqual(['1 change since version 4:', '2 changes since version 4:']);
  });

  it('gives a refusal in the designer’s language, its message staying English', () => {
    const refusal = new Refusal((w: DesignerWords) => w.bar.publishFailed);
    expect(refusal.message).toBe('It could not be published.');
    expect(refusal.in(ar)).toBe('تعذّر النشر.');
    expect(new Refusal('As written').in(ar)).toBe('As written');
  });
});

describe('which way the editor runs', () => {
  let handle: ScreenEditorHandle | null = null;
  afterEach(() => {
    handle?.destroy();
    handle = null;
    document.body.replaceChildren();
    document.documentElement.removeAttribute('dir');
    document.documentElement.removeAttribute('lang');
  });
  const mount = (locale?: string, host: { dir?: string; lang?: string } = {}) => {
    if (host.dir) document.documentElement.dir = host.dir;
    if (host.lang) document.documentElement.lang = host.lang;
    const element = document.createElement('div');
    document.body.append(element);
    const designer = createDesigner({ page: blankPage('screen', 'Visit'), locale });
    handle = mountScreenEditor(element, { designer });
    return { designer, root: handle.element, canvas: handle.element.querySelector('.fd-canvas') as HTMLElement };
  };

  it('in Arabic, right to left, on a page left to right; the screen drawn as the page runs', () => {
    const { root, canvas } = mount('ar', { dir: 'ltr', lang: 'en' });
    expect([root.dir, root.lang]).toEqual(['rtl', 'ar']);
    expect([canvas.dir, canvas.lang]).toEqual(['ltr', 'en']);
  });

  it('in English, left to right, on a page right to left: its sentences end where English ends them', () => {
    const { root, canvas } = mount('en', { dir: 'rtl', lang: 'ar' });
    expect([root.dir, root.lang]).toEqual(['ltr', 'en']);
    expect([canvas.dir, canvas.lang]).toEqual(['rtl', 'ar']);
  });

  it('with no language given, takes the page’s direction as before', () => {
    const { root, canvas } = mount(undefined, { dir: 'rtl', lang: 'ar' });
    expect(root.hasAttribute('dir') || root.hasAttribute('lang')).toBe(false);
    expect(canvas.hasAttribute('dir')).toBe(false);
  });

  it('follows the page around it when its direction changes', () => {
    const { designer, canvas } = mount('en');
    expect(canvas.dir).toBe('ltr');
    document.documentElement.dir = 'rtl';
    // The next time it is drawn.
    designer.setPageInfo({ title: 'Visit report' });
    expect(canvas.dir).toBe('rtl');
  });

  it('opens its menus its own way, even from what draws the page', () => {
    const { root } = mount('ar', { dir: 'ltr' });
    (root.querySelector('.fd-designer-status') as HTMLButtonElement).click();
    const menu = root.querySelector('.fd-menu') as HTMLElement;
    expect([menu.dir, menu.lang]).toEqual(['rtl', 'ar']);
  });

  it('the survey editor too: its cards are its own', () => {
    document.documentElement.dir = 'rtl';
    const element = document.createElement('div');
    document.body.append(element);
    const survey = mountSurveyEditor(element, { designer: createDesigner({ page: blankPage('survey', 'Feedback'), locale: 'en' }) });
    expect([survey.element.dir, survey.element.lang]).toEqual(['ltr', 'en']);
    survey.destroy();
  });
});

describe('the bar, in Arabic', () => {
  afterEach(() => document.body.replaceChildren());

  it('says its buttons, its status and its checks in Arabic', () => {
    const element = document.createElement('div');
    document.body.append(element);
    const designer = createDesigner({ page: blankPage('screen', 'Visit'), locale: 'ar' });
    const handle = mountScreenEditor(element, { designer });
    designer.setPageInfo({ title: 'زيارة' });
    const bar = handle.element.querySelector('.fd-designer-bar') as HTMLElement;
    const shown = [...bar.querySelectorAll('button')].filter((b) => !b.hidden).map((b) => b.textContent?.trim());
    expect(shown).toEqual(expect.arrayContaining(['تراجع', 'نشر']));
    expect(bar.querySelector('.fd-designer-status')?.textContent).toBe('مسودة، لم تُنشر بعد');
    expect(bar.querySelector('.fd-designer-title')?.getAttribute('aria-label')).toBe('عنوان الشاشة');
    expect(bar.querySelector('[data-mode="simple"]')?.textContent).toBe('بسيط');
    handle.destroy();
  });
});
