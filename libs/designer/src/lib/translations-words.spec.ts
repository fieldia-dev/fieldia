import { pageWords } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { languageName, staleWords, translationProgress, wordsOf } from './translations';

/**
 * The page's words, as the translations' grid lists them: the same as
 * `pageWords`, worked out once while only the translations change — as they
 * do at each key typed into the grid — and again when a word does.
 */

function survey() {
  const designer = createDesigner({ page: blankPage('survey', 'Visit') });
  for (const words of ['Name', 'Email']) designer.updateQuestion(designer.addQuestion('short-answer') as string, { label: words });
  return designer;
}

describe('the words to translate', () => {
  it('are the page’s words, kept while only the translations change', () => {
    const designer = survey();
    const first = wordsOf(designer.getPage());
    expect(first).toEqual(pageWords(designer.getPage()));
    designer.addLanguage('ar');
    designer.setTranslation('ar', 'Name', 'الاسم');
    expect(wordsOf(designer.getPage())).toBe(first);
    expect(translationProgress(designer.getPage(), 'ar')).toEqual({ done: 1, total: first.length });
  });

  it('follow a word changed, and say which translations it left behind', () => {
    const designer = survey();
    designer.addLanguage('ar');
    designer.setTranslation('ar', 'Email', 'البريد');
    const q = (designer.getPage().layout as unknown as { children: { children: { id: string }[] }[] }).children[0].children[1].id;
    designer.updateQuestion(q, { label: 'Work email' });
    expect(wordsOf(designer.getPage())).toEqual(pageWords(designer.getPage()));
    expect(wordsOf(designer.getPage())).toContain('Work email');
    expect(staleWords(designer.getPage())).toEqual(['Email']);
  });

  it('names languages as before', () => {
    expect(languageName('ar')).toBe('Arabic');
    expect(languageName('ar')).toBe('Arabic');
    expect(languageName('pt-BR')).toMatch(/Portuguese/);
  });
});
