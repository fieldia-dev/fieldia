import { validatePage, type Page } from '@fieldia/core';
import { createDesigner, pageChanges, type Designer } from './designer';
import { languageName, languageTag, staleWords, translationChanges, translationProgress } from './translations';

/**
 * The page's words in other languages, kept in the page word for word:
 * languages added and removed, a word translated, many filled at once, and
 * the translations of words no longer on the page let go — each one undo
 * step, typing in one cell too, and each named for Publish.
 */

const start = (): Page => ({
  fieldia: '0.1',
  id: 'signup',
  title: 'Sign up',
  data: { kind: 'responses' },
  fields: {
    name: { type: 'char', label: 'Your name', help: 'As on your ID' },
    role: { type: 'selection', label: 'Your role', options: [{ value: 'dev', label: 'Developer' }, { value: 'pm', label: 'Manager' }] },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [{ type: 'section', id: 's', title: 'About you', children: [{ type: 'field', id: 'n', field: 'name' }, { type: 'field', id: 'r', field: 'role' }] }],
  },
});

function designerWith(page: Page = start()): Designer {
  return createDesigner({ page });
}
const kept = (d: Designer) => d.getPage().translations;
const issue = (d: Designer) => d.getState().issues;

describe('languages', () => {
  it('adds a language, as one undo step, and the page still checks', () => {
    const d = designerWith();
    expect(d.addLanguage('ar')).toBe(true);
    expect(kept(d)).toEqual({ ar: {} });
    expect(validatePage(d.getPage()).ok).toBe(true);
    d.undo();
    expect(kept(d)).toBeUndefined();
  });

  it('writes a tag the way tags are written', () => {
    const d = designerWith();
    expect(d.addLanguage(' AR-eg ')).toBe(true);
    expect(d.addLanguage('zh-hant')).toBe(true);
    expect(Object.keys(kept(d) ?? {})).toEqual(['ar-EG', 'zh-Hant']);
  });

  it('refuses what is not a language tag, saying what one is', () => {
    const d = designerWith();
    for (const wrong of ['Klingon tongue', 'english', '', 'a', 'ar_EG!']) {
      expect(d.addLanguage(wrong)).toBe(false);
      expect(issue(d)).toEqual([`“${wrong.trim()}” is not a language tag, such as ar, es or pt-BR`]);
    }
    expect(kept(d)).toBeUndefined();
  });

  it('refuses the page’s own language, and one it has already', () => {
    const d = designerWith();
    expect(d.addLanguage('en')).toBe(false);
    expect(issue(d)).toEqual(['The page is written in English: its words are the English already']);
    d.addLanguage('ar');
    expect(d.addLanguage('ar')).toBe(false);
    expect(issue(d)).toEqual(['The page has Arabic already']);
    const arabic = designerWith({ ...start(), language: 'ar' });
    expect(arabic.addLanguage('ar')).toBe(false);
    expect(arabic.addLanguage('en')).toBe(true);
  });

  it('removes a language with its words, as one undo step', () => {
    const d = designerWith();
    d.addLanguage('ar');
    d.addLanguage('es');
    d.setTranslation('ar', 'Sign up', 'التسجيل');
    expect(d.removeLanguage('ar')).toBe(true);
    expect(kept(d)).toEqual({ es: {} });
    expect(d.removeLanguage('es')).toBe(true);
    expect(d.getPage()).not.toHaveProperty('translations');
    d.undo();
    d.undo();
    expect(kept(d)).toEqual({ ar: { 'Sign up': 'التسجيل' }, es: {} });
    expect(d.removeLanguage('fr')).toBe(false);
    expect(issue(d)).toEqual(['The page has no French']);
  });
});

describe('a word translated', () => {
  it('keeps the translation by the words it translates', () => {
    const d = designerWith();
    d.addLanguage('ar');
    expect(d.setTranslation('ar', 'Your name', 'اسمك')).toBe(true);
    expect(kept(d)).toEqual({ ar: { 'Your name': 'اسمك' } });
    expect(validatePage(d.getPage()).ok).toBe(true);
  });

  it('is one undo step for a run of typing in one cell, and another for the next cell', () => {
    const d = designerWith();
    d.addLanguage('ar');
    for (const typed of ['ا', 'اس', 'اسم', 'اسمك']) d.setTranslation('ar', 'Your name', typed);
    for (const typed of ['ع', 'عن', 'عنك']) d.setTranslation('ar', 'About you', typed);
    expect(kept(d)).toEqual({ ar: { 'Your name': 'اسمك', 'About you': 'عنك' } });
    d.undo();
    expect(kept(d)).toEqual({ ar: { 'Your name': 'اسمك' } });
    d.undo();
    expect(kept(d)).toEqual({ ar: {} });
    d.undo();
    expect(kept(d)).toBeUndefined();
  });

  it('makes no undo step for an edit that changes nothing', () => {
    const d = designerWith();
    d.addLanguage('ar');
    d.setTranslation('ar', 'Your name', 'اسمك');
    expect(d.setTranslation('ar', 'About you', '')).toBe(true);
    d.undo();
    expect(kept(d)).toEqual({ ar: {} });
  });

  it('takes a translation away when it is emptied', () => {
    const d = designerWith();
    d.addLanguage('ar');
    d.setTranslation('ar', 'Your name', 'اسمك');
    d.select(null);
    expect(d.setTranslation('ar', 'Your name', '')).toBe(true);
    expect(kept(d)).toEqual({ ar: {} });
    d.setTranslation('ar', 'About you', 'عنك');
    expect(d.setTranslation('ar', 'About you', null)).toBe(true);
    expect(d.setTranslation('ar', 'Sign up', '   ')).toBe(true);
    expect(kept(d)).toEqual({ ar: {} });
  });

  it('refuses a language the page has not got, and words not on the page', () => {
    const d = designerWith();
    expect(d.setTranslation('ar', 'Your name', 'اسمك')).toBe(false);
    expect(issue(d)).toEqual(['Add Arabic first']);
    d.addLanguage('ar');
    expect(d.setTranslation('ar', 'Nowhere', 'لا')).toBe(false);
    expect(issue(d)).toEqual(['“Nowhere” is not on the page']);
  });
});

describe('many translations filled at once', () => {
  it('fills every language given, adding those the page has not got, as one undo step', () => {
    const d = designerWith();
    d.addLanguage('ar');
    expect(d.fillTranslations({ ar: { 'Your name': 'اسمك', 'About you': 'عنك' }, es: { 'Your name': 'Tu nombre', Developer: 'Desarrollador' } })).toBe(4);
    expect(kept(d)).toEqual({ ar: { 'Your name': 'اسمك', 'About you': 'عنك' }, es: { 'Your name': 'Tu nombre', Developer: 'Desarrollador' } });
    d.undo();
    expect(kept(d)).toEqual({ ar: {} });
  });

  it('leaves out words not on the page and empty cells, keeping what is there', () => {
    const d = designerWith();
    d.addLanguage('ar');
    d.setTranslation('ar', 'Your name', 'اسمك');
    expect(d.fillTranslations({ ar: { 'Your name': '', 'Gone word': 'كلمة', 'Sign up': 'التسجيل' } })).toBe(1);
    expect(kept(d)).toEqual({ ar: { 'Your name': 'اسمك', 'Sign up': 'التسجيل' } });
  });

  it('refuses a column that is not a language, or is the page’s own, filling nothing', () => {
    const d = designerWith();
    expect(d.fillTranslations({ Arabic: { 'Your name': 'اسمك' } })).toBe(false);
    expect(issue(d)).toEqual(['“Arabic” is not a language tag, such as ar, es or pt-BR']);
    expect(d.fillTranslations({ en: { 'Your name': 'Name' }, ar: { 'Your name': 'اسمك' } })).toBe(false);
    expect(kept(d)).toBeUndefined();
  });

  it('says so when there was nothing to fill', () => {
    const d = designerWith();
    expect(d.fillTranslations({ ar: { 'Gone word': 'كلمة' } })).toBe(false);
    expect(issue(d)).toEqual(['None of these words is on the page']);
  });
});

describe('words no longer on the page', () => {
  function withStale() {
    const d = designerWith();
    d.fillTranslations({ ar: { 'Your role': 'دورك', Developer: 'مطور', Manager: 'مدير' }, es: { Manager: 'Gerente', 'Your name': 'Tu nombre' } });
    d.removeNode('r');
    return d;
  }

  it('lists the words translated that the page no longer shows, in the order kept', () => {
    expect(staleWords(withStale().getPage())).toEqual(['Your role', 'Developer', 'Manager']);
    expect(staleWords(start())).toEqual([]);
  });

  it('lets them go from every language, as one undo step', () => {
    const d = withStale();
    expect(d.forgetWords(['Developer'])).toBe(true);
    expect(staleWords(d.getPage())).toEqual(['Your role', 'Manager']);
    expect(d.forgetWords(staleWords(d.getPage()))).toBe(true);
    expect(kept(d)).toEqual({ ar: {}, es: { 'Your name': 'Tu nombre' } });
    d.undo();
    expect(staleWords(d.getPage())).toEqual(['Your role', 'Manager']);
    expect(d.forgetWords(['Nothing like it'])).toBe(false);
    expect(issue(d)).toEqual(['No language has those words']);
  });
});

describe('how far each language has got', () => {
  it('counts the page’s words translated, of all of them', () => {
    const d = designerWith();
    d.fillTranslations({ ar: { 'Your name': 'اسمك', 'About you': 'عنك' } });
    expect(translationProgress(d.getPage(), 'ar')).toEqual({ done: 2, total: 7 });
    expect(translationProgress(d.getPage(), 'es')).toEqual({ done: 0, total: 7 });
  });

  it('does not count an empty translation a page brings with it', () => {
    expect(translationProgress({ ...start(), translations: { ar: { 'Your name': '', 'Sign up': 'التسجيل' } } }, 'ar')).toEqual({ done: 1, total: 7 });
  });
});

describe('what Publish says about translations', () => {
  it('names languages added and removed, and words translated, changed and taken out', () => {
    const d = designerWith();
    d.fillTranslations({ es: { 'Your name': 'Tu nombre', Developer: 'Desarrollador' } });
    const before = d.getPage();
    d.addLanguage('ar');
    d.fillTranslations({ ar: { 'Your name': 'اسمك', 'About you': 'عنك', 'Sign up': 'التسجيل' } });
    expect(pageChanges(before, d.getPage())).toEqual(['Added Arabic', 'Arabic: 3 words translated']);
    const middle = d.getPage();
    d.setTranslation('ar', 'Sign up', 'سجّل');
    d.setTranslation('ar', 'About you', null);
    d.removeLanguage('es');
    d.setTranslation('ar', 'Developer', 'مطور');
    expect(pageChanges(middle, d.getPage())).toEqual(['Removed Spanish', 'Arabic: 1 word translated', 'Arabic: 1 translation changed', 'Arabic: 1 translation taken out']);
    expect(translationChanges(middle, middle)).toEqual([]);
  });
});

describe('language names and tags', () => {
  it('names a language in English, by its tag', () => {
    expect(languageName('ar')).toBe('Arabic');
    expect(languageName('es')).toBe('Spanish');
    expect(languageName('pt-BR')).toMatch(/Portuguese/);
  });

  it('still names the common languages without the browser’s names, and gives the tag for the rest', () => {
    const names = Intl.DisplayNames;
    (Intl as { DisplayNames?: unknown }).DisplayNames = undefined;
    try {
      expect(languageName('ar')).toBe('Arabic');
      expect(languageName('ar-EG')).toBe('Arabic (EG)');
      expect(languageName('tlh')).toBe('tlh');
    } finally {
      (Intl as { DisplayNames?: unknown }).DisplayNames = names;
    }
  });

  it('reads a tag, or a common language by its name, as a tag', () => {
    expect(languageTag('ar')).toBe('ar');
    expect(languageTag(' pt-br ')).toBe('pt-BR');
    expect(languageTag('Arabic')).toBe('ar');
    expect(languageTag('spanish')).toBe('es');
    expect(languageTag('Klingon tongue')).toBeNull();
    expect(languageTag('english')).toBe('en');
  });
});
