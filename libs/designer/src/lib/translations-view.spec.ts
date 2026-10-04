import type { Page } from '@fieldia/core';
import { createDesigner } from './designer';
import { mountSurveyEditor } from './survey-editor';
import { button, mount, press, type } from './test-editor';

/**
 * The Translations view, in place of the editor: a grid of the page's words,
 * the page's language first and a column per language, typed in like a
 * sheet; how far each language has got; only the words not translated;
 * languages added and removed (asking first, in the page); words no longer
 * on the page let go; and the words copied and pasted as CSV.
 */

const start = (): Page => ({
  fieldia: '0.1',
  id: 'signup',
  title: 'Sign up',
  data: { kind: 'record', model: 'signup' },
  fields: {
    name: { type: 'char', label: 'Your name', help: 'As on your ID' },
    role: { type: 'selection', label: 'Your role', options: [{ value: 'dev', label: 'Developer' }, { value: 'pm', label: 'Manager' }] },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [{ type: 'section', id: 's', title: 'About you', columns: 2, children: [{ type: 'field', id: 'n', field: 'name' }, { type: 'field', id: 'r', field: 'role' }] }],
  },
});

function open(page: Page = start()) {
  const designer = createDesigner({ page });
  const { host } = mount(designer);
  const view = () => host.querySelector('.fd-words') as HTMLElement;
  const body = () => host.querySelector('.fd-screen-body') as HTMLElement;
  const modeButton = (name: string) => host.querySelector(`.fd-mode [data-mode="${name}"]`) as HTMLButtonElement;
  modeButton('translations').click();
  return { designer, host, view, body, modeButton };
}

/** The grid's rows: the word, then each language's cell. */
const rows = (view: HTMLElement) =>
  [...view.querySelectorAll<HTMLTableRowElement>('.fd-words-grid tbody tr')].filter((tr) => !tr.hidden).map((tr) => [tr.querySelector('th')?.textContent, ...[...tr.querySelectorAll('textarea')].map((t) => t.value)]);
const cell = (view: HTMLElement, word: string, tag: string) =>
  [...view.querySelectorAll<HTMLTextAreaElement>('.fd-words-grid textarea')].find((t) => t.dataset['word'] === word && t.dataset['lang'] === tag) as HTMLTextAreaElement;
const heads = (view: HTMLElement) => [...view.querySelectorAll('.fd-words-grid thead th')].map((th) => th.getAttribute('aria-label') ?? th.textContent);
function addLanguage(view: HTMLElement, typed: string) {
  type(view.querySelector('.fd-words-add input') as HTMLInputElement, typed);
  (button(view, 'Add') as HTMLButtonElement).click();
}
function typeIn(textarea: HTMLTextAreaElement, text: string) {
  textarea.focus();
  textarea.value = text;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('opening the Translations view', () => {
  it('sits beside Design and Try it, in place of the editor, and Design brings the editor back', () => {
    const { view, body, modeButton } = open();
    expect(view().hidden).toBe(false);
    expect(body().hidden).toBe(true);
    expect(modeButton('translations').getAttribute('aria-pressed')).toBe('true');
    expect(modeButton('design').getAttribute('aria-pressed')).toBe('false');
    modeButton('design').click();
    expect(view().hidden).toBe(true);
    expect(body().hidden).toBe(false);
    expect(modeButton('design').getAttribute('aria-pressed')).toBe('true');
    expect(modeButton('translations').getAttribute('aria-pressed')).toBe('false');
  });

  it('gives way to Try it, and takes over from it', () => {
    const { host, view, body, modeButton } = open();
    modeButton('try').click();
    expect(view().hidden).toBe(true);
    expect(body().hidden).toBe(true);
    expect((host.querySelector('.fd-try') as HTMLElement).hidden).toBe(false);
    modeButton('translations').click();
    expect(view().hidden).toBe(false);
    expect((host.querySelector('.fd-try') as HTMLElement).hidden).toBe(true);
    expect(body().hidden).toBe(true);
    expect(modeButton('try').getAttribute('aria-pressed')).toBe('false');
  });

  it('puts down what was picked, and goes back to the editor when something is picked again', () => {
    const designer = createDesigner({ page: start() });
    designer.select('n');
    const { host } = mount(designer);
    (host.querySelector('.fd-mode [data-mode="translations"]') as HTMLButtonElement).click();
    expect(designer.getState().selected).toBeNull();
    designer.select('r');
    expect((host.querySelector('.fd-words') as HTMLElement).hidden).toBe(true);
  });

  it('opens from Find anything', () => {
    const designer = createDesigner({ page: start() });
    const { host } = mount(designer);
    press('k', { metaKey: true }, document.body);
    const find = document.querySelector('.fd-find-input') as HTMLInputElement;
    type(find, 'translations');
    press('Enter', {}, find);
    expect((host.querySelector('.fd-words') as HTMLElement).hidden).toBe(false);
  });

  it('is in the survey designer too', () => {
    const designer = createDesigner({ page: { ...start(), data: { kind: 'responses' }, layout: { type: 'wizard', id: 'w', children: [{ type: 'step', id: 'one', label: 'About you', children: [{ type: 'field', id: 'n', field: 'name' }] }] } } });
    const host = document.createElement('div');
    document.body.append(host);
    const editor = mountSurveyEditor(host, { designer });
    (host.querySelector('.fd-mode [data-mode="translations"]') as HTMLButtonElement).click();
    expect((host.querySelector('.fd-survey-body') as HTMLElement).hidden).toBe(true);
    expect(rows(host.querySelector('.fd-words') as HTMLElement).map((r) => r[0])).toEqual(['Sign up', 'About you', 'Your name', 'As on your ID', 'Your role', 'Developer', 'Manager']);
    editor.destroy();
  });
});

describe('the grid', () => {
  it('has a row for each word on the page, in reading order, and says how many', () => {
    const { view } = open();
    expect(rows(view()).map((r) => r[0])).toEqual(['Sign up', 'About you', 'Your name', 'As on your ID', 'Your role', 'Developer', 'Manager']);
    expect(heads(view())).toEqual(['English, the page’s own words']);
    expect(view().querySelector('.fd-words-note')?.textContent).toBe('7 words, written in English. Add a language to translate them into it.');
  });

  it('adds a language by its name or tag, as a column right to left for a language written so', () => {
    const { view, designer } = open();
    addLanguage(view(), 'Arabic');
    addLanguage(view(), 'es');
    expect(Object.keys(designer.getPage().translations ?? {})).toEqual(['ar', 'es']);
    expect(heads(view())).toEqual(['English, the page’s own words', 'Arabic, 0 of 7 translated', 'Spanish, 0 of 7 translated']);
    const arabic = cell(view(), 'Your name', 'ar');
    expect(arabic.getAttribute('dir')).toBe('rtl');
    expect(arabic.getAttribute('lang')).toBe('ar');
    expect(cell(view(), 'Your name', 'es').getAttribute('dir')).toBe('ltr');
    expect((view().querySelector('.fd-words-add input') as HTMLInputElement).value).toBe('');
  });

  it('says why a language cannot be added, and adds nothing', () => {
    const { view, host, designer } = open();
    addLanguage(view(), 'Klingon tongue');
    expect(host.querySelector('.fd-designer-issues')?.textContent).toBe('“Klingon tongue” is not a language tag, such as ar, es or pt-BR');
    expect(designer.getPage().translations).toBeUndefined();
  });

  it('keeps what is typed in a cell, one undo step per cell, and counts it', () => {
    const { view, designer } = open();
    addLanguage(view(), 'ar');
    const name = cell(view(), 'Your name', 'ar');
    for (const typed of ['ا', 'اسم', 'اسمك']) typeIn(name, typed);
    typeIn(cell(view(), 'About you', 'ar'), 'عنك');
    expect(designer.getPage().translations).toEqual({ ar: { 'Your name': 'اسمك', 'About you': 'عنك' } });
    expect(heads(view())[1]).toBe('Arabic, 2 of 7 translated');
    // The cell typed in is the same one, still focused, after the edit is drawn.
    expect(cell(view(), 'Your name', 'ar')).toBe(name);
    designer.undo();
    expect(cell(view(), 'About you', 'ar').value).toBe('');
    expect(name.value).toBe('اسمك');
    designer.undo();
    expect(name.value).toBe('');
  });

  it('shows only the words not translated in every language, keeping a row while it is typed in', () => {
    const { view, designer } = open();
    designer.fillTranslations({ ar: { 'Sign up': 'التسجيل', 'Your name': 'اسمك' }, es: { 'Sign up': 'Registro' } });
    const only = view().querySelector('.fd-words-filter [role="switch"]') as HTMLButtonElement;
    only.click();
    expect(only.getAttribute('aria-checked')).toBe('true');
    expect(rows(view()).map((r) => r[0])).toEqual(['About you', 'Your name', 'As on your ID', 'Your role', 'Developer', 'Manager']);
    typeIn(cell(view(), 'Your name', 'es'), 'Tu nombre');
    expect(rows(view()).map((r) => r[0])).toContain('Your name');
    only.click();
    only.click();
    expect(rows(view()).map((r) => r[0])).not.toContain('Your name');
  });

  it('moves between cells like a sheet: Enter and the arrows down and up, along at the ends of the words', () => {
    const { view } = open();
    addLanguage(view(), 'ar');
    addLanguage(view(), 'he');
    const at = (word: string, tag: string) => cell(view(), word, tag);
    at('Sign up', 'ar').focus();
    press('Enter');
    expect(document.activeElement).toBe(at('About you', 'ar'));
    press('ArrowDown');
    expect(document.activeElement).toBe(at('Your name', 'ar'));
    press('Enter', { shiftKey: true });
    press('ArrowUp');
    expect(document.activeElement).toBe(at('Sign up', 'ar'));
    press('ArrowUp');
    expect(document.activeElement).toBe(at('Sign up', 'ar'));
    // Right to left, the end of the words is on the left: the arrow goes on only from there.
    typeIn(at('Sign up', 'he'), 'הרשמה');
    at('Sign up', 'he').setSelectionRange(0, 0);
    press('ArrowLeft');
    expect(document.activeElement).toBe(at('Sign up', 'he'));
    at('Sign up', 'he').setSelectionRange(5, 5);
    press('ArrowLeft');
    expect(document.activeElement).toBe(at('Sign up', 'ar'));
    press('ArrowRight');
    expect(document.activeElement).toBe(at('Sign up', 'he'));
  });
});

describe('removing a language', () => {
  it('asks first, in the page, and keeps it when told to', () => {
    const confirm = jest.spyOn(window, 'confirm');
    const { view, designer } = open();
    designer.fillTranslations({ ar: { 'Sign up': 'التسجيل' } });
    (button(view(), 'Remove Arabic') as HTMLButtonElement).click();
    const ask = view().querySelector('.fd-words-confirm') as HTMLElement;
    expect(ask.hidden).toBe(false);
    expect(ask.textContent).toContain('Remove Arabic? Its 1 translation goes with it.');
    expect(document.activeElement?.textContent).toBe('Keep it');
    (button(ask, 'Keep it') as HTMLButtonElement).click();
    expect(ask.hidden).toBe(true);
    expect(designer.getPage().translations).toEqual({ ar: { 'Sign up': 'التسجيل' } });
    (button(view(), 'Remove Arabic') as HTMLButtonElement).click();
    (button(ask, 'Remove Arabic') as HTMLButtonElement).click();
    expect(designer.getPage().translations).toBeUndefined();
    expect(confirm).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('takes a language with nothing translated yet without asking', () => {
    const { view, designer } = open();
    addLanguage(view(), 'fr');
    (button(view(), 'Remove French') as HTMLButtonElement).click();
    expect(designer.getPage().translations).toBeUndefined();
  });
});

describe('words no longer on the page', () => {
  function stale() {
    const page = start();
    page.translations = { ar: { 'Old question': 'سؤال قديم', 'Gone too': 'ذهب', 'Sign up': 'التسجيل' } };
    return open(page);
  }

  it('lists their translations apart, each to remove, or all at once', () => {
    const { view, designer } = stale();
    const gone = view().querySelector('.fd-words-stale') as HTMLElement;
    expect(gone.hidden).toBe(false);
    expect(gone.querySelector('h3')?.textContent).toBe('No longer on the page');
    expect([...gone.querySelectorAll('tbody th')].map((th) => th.textContent)).toEqual(['Old question', 'Gone too']);
    (button(gone, 'Remove the translations of “Old question”') as HTMLButtonElement).click();
    expect(Object.keys(designer.getPage().translations?.['ar'] ?? {})).toEqual(['Gone too', 'Sign up']);
    (button(gone, 'Remove all') as HTMLButtonElement).click();
    expect(designer.getPage().translations).toEqual({ ar: { 'Sign up': 'التسجيل' } });
    expect(gone.hidden).toBe(true);
  });
});

describe('CSV', () => {
  it('copies the words and their translations as CSV', async () => {
    const writeText = jest.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const { view, designer } = open();
    designer.fillTranslations({ ar: { 'Sign up': 'التسجيل' } });
    (button(view(), 'Copy as CSV') as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/^en,ar\r\nSign up,التسجيل\r\nAbout you,\r\n/));
    expect(view().querySelector('.fd-words-status')?.textContent).toBe('Copied 7 words in 1 language as CSV.');
  });

  it('fills the translations from a CSV pasted in, saying what it left out', () => {
    const { view, designer } = open();
    (button(view(), 'Paste CSV') as HTMLButtonElement).click();
    const box = view().querySelector('.fd-words-paste textarea') as HTMLTextAreaElement;
    expect(document.activeElement).toBe(box);
    typeIn(box, 'en,Arabic,fr\n"Sign up",التسجيل,Inscription\nGone word,كلمة,\nYour name,اسمك,');
    (button(view(), 'Fill the translations') as HTMLButtonElement).click();
    expect(designer.getPage().translations).toEqual({ ar: { 'Sign up': 'التسجيل', 'Your name': 'اسمك' }, fr: { 'Sign up': 'Inscription' } });
    expect(view().querySelector('.fd-words-status')?.textContent).toBe('Filled 3 translations. 1 word no longer on the page was left out.');
    expect((view().querySelector('.fd-words-paste') as HTMLElement).hidden).toBe(true);
  });

  it('says what is wrong with a CSV it cannot read, and keeps it to put right', () => {
    const { view, designer } = open();
    (button(view(), 'Paste CSV') as HTMLButtonElement).click();
    typeIn(view().querySelector('.fd-words-paste textarea') as HTMLTextAreaElement, 'en,Klingon tongue\nSign up,x');
    (button(view(), 'Fill the translations') as HTMLButtonElement).click();
    expect(view().querySelector('.fd-words-paste [role="alert"]')?.textContent).toBe('“Klingon tongue” in the first row is not a language: name it by its tag or name, such as ar or Arabic');
    expect((view().querySelector('.fd-words-paste') as HTMLElement).hidden).toBe(false);
    expect(designer.getPage().translations).toBeUndefined();
  });
});

