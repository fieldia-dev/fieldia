import { fill, FORM_MAP_LABELS, LIST_MAP_LABELS, listMapLabels, MAP_LABELS, mapLabels } from './labels';

describe('the maps’ words', () => {
  const english = MAP_LABELS.en;

  it('are all there, in every language, with the same blanks: the maps’ own and a list map’s — a sentence for a page’s records where the language has one', () => {
    const plain = (keys: string[]) => keys.filter((key) => !key.endsWith('Noun')).sort();
    for (const table of [MAP_LABELS, LIST_MAP_LABELS, FORM_MAP_LABELS] as unknown as Record<string, Record<string, string>>[]) {
      const first = table['en'];
      for (const [locale, words] of Object.entries(table)) {
        expect([locale, plain(Object.keys(words))]).toEqual([locale, plain(Object.keys(first))]);
        for (const key of Object.keys(words)) expect([locale, key, key in first]).toEqual([locale, key, true]);
        for (const [key, text] of Object.entries(words)) {
          expect([locale, key, text.trim().length > 0]).toEqual([locale, key, true]);
          const blanks = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
          expect([locale, key, blanks(text)]).toEqual([locale, key, blanks(first[key])]);
        }
      }
    }
  });

  it('give a list map the maps’ own words and its own, the app’s over both', () => {
    const words = listMapLabels('fr', { choose: 'Retenir', zoomIn: 'Plus près' });
    expect([words.clear, words.searchThisArea, words.choose, words.zoomIn]).toEqual(['Effacer', 'Rechercher dans cette zone', 'Retenir', 'Plus près']);
  });

  it('say the app’s own sentence, given without one for a page’s records, on such a page too', () => {
    expect(listMapLabels('en').mapFailedNoun).toBe('The map could not load the {records}.');
    expect(listMapLabels('ar').mapFailedNoun).toBeUndefined();
    expect(listMapLabels('en', { mapFailed: 'No map today.' }).mapFailedNoun).toBeUndefined();
  });

  it('are the page’s language, with the app’s own over them', () => {
    expect(mapLabels('ar').clear).toBe('مسح');
    expect(mapLabels(undefined).clear).toBe('Clear');
    expect(mapLabels('fr', { clear: 'Vider' }).clear).toBe('Vider');
  });

  it('fill their blanks', () => {
    expect(fill(english.mapOf, { label: 'Delivery to' })).toBe('Delivery to, map');
    expect(fill(english.points, { n: 3 })).toBe('3 points');
  });
});
