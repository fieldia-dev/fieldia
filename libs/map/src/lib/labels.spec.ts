import { fill, LIST_MAP_LABELS, listMapLabels, MAP_LABELS, mapLabels } from './labels';

describe('the maps’ words', () => {
  const english = MAP_LABELS.en;

  it('are all there, in every language, with the same blanks: the maps’ own and a list map’s', () => {
    for (const table of [MAP_LABELS, LIST_MAP_LABELS] as unknown as Record<string, Record<string, string>>[]) {
      const first = table['en'];
      for (const [locale, words] of Object.entries(table)) {
        expect([locale, Object.keys(words).sort()]).toEqual([locale, Object.keys(first).sort()]);
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
