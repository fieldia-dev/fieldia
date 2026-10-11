import { fill, MAP_LABELS, mapLabels } from './labels';

describe('the maps’ words', () => {
  const english = MAP_LABELS.en;

  it('are all there, in every language, with the same blanks', () => {
    for (const [locale, words] of Object.entries(MAP_LABELS)) {
      expect([locale, Object.keys(words).sort()]).toEqual([locale, Object.keys(english).sort()]);
      for (const [key, text] of Object.entries(words)) {
        expect([locale, key, text.trim().length > 0]).toEqual([locale, key, true]);
        const blanks = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
        expect([locale, key, blanks(text)]).toEqual([locale, key, blanks(english[key as keyof typeof english])]);
      }
    }
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
