import { FILE_YES_NO } from './locales/yes-no';

/**
 * A file brought in reads yes and no in every language Fieldia speaks, whose words come in chunks of their own (0.35):
 * the words it reads them by are each language's own, never a second spelling of them.
 */
const LANGUAGES = ['ar', 'de', 'fr', 'tr', 'fa', 'ur', 'es'] as const;

describe('yes and no in a file brought in', () => {
  it.each(LANGUAGES)('are %s’s own words, as the viewer and the widgets say them', async (locale) => {
    const [viewer, widgets] = await Promise.all([import(`./locales/${locale}`), import(`../../../widgets/src/lib/locales/${locale}`)]);
    for (const words of [viewer[locale], widgets[locale]]) {
      expect(FILE_YES_NO.yes).toContain(words.yes);
      expect(FILE_YES_NO.no).toContain(words.no);
    }
  });

  it('hold no other', () => {
    expect(FILE_YES_NO.yes).toHaveLength(LANGUAGES.length);
    expect(FILE_YES_NO.no).toHaveLength(LANGUAGES.length);
  });
});
