import { orderedDay, sentenceValue } from './sentence-value';

/**
 * A value as a sentence of the page's says it: a day in the page's order — day first as a box at rest writes it, month
 * first by its name, year first as it is typed — on its zone's clock, its zone named where the box would name it; a
 * yes or no in words; anything else as its field shows it.
 */
describe('a value inside a sentence', () => {
  it('writes a day in the page’s order', () => {
    expect(orderedDay('2026-10-15', 'date', 'dmy', 'en')).toBe('15 Oct 2026');
    expect(orderedDay('2026-10-15', 'date', 'mdy', 'en')).toBe('Oct 15, 2026');
    expect(orderedDay('2026-10-15', 'date', 'ymd', 'en')).toBe('2026-10-15');
    expect(orderedDay('2026-10-15', 'date', 'mdy', 'fr')).toBe('oct. 15, 2026');
  });

  it('writes a day and time on its zone’s clock, the zone named where the browser’s is another', () => {
    // Six in the evening in Tokyo, seen from a browser elsewhere; on the browser's own clock, no zone named.
    expect(orderedDay('2026-10-15T09:00:00Z', 'datetime', 'mdy', 'en', 'Asia/Tokyo')).toBe('Oct 15, 2026, 18:00 GMT+9');
    expect(orderedDay('2026-10-15T09:00:00Z', 'datetime', 'ymd', 'en', 'Asia/Tokyo')).toBe('2026-10-15 18:00 GMT+9');
    const own = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(orderedDay('2026-10-15T09:00:00Z', 'datetime', 'ymd', 'en', own)).toMatch(/^2026-10-1[456] \d\d:\d\d$/);
    expect(orderedDay('not a day', 'date', 'mdy', 'en')).toBe('not a day');
  });

  it('says a yes or no in words, in the page’s, and nothing for none', () => {
    const yes = { type: 'boolean', label: 'First visit' } as const;
    expect(sentenceValue(yes, true, {}, 'en', {})).toBe('Yes');
    expect(sentenceValue(yes, false, {}, 'en', { no: 'Non' })).toBe('Non');
    expect(sentenceValue(yes, null, {}, 'en', {})).toBe('');
  });

  it('writes anything else as its field shows it at rest: a choice by its label, money with its currency', () => {
    expect(sentenceValue({ type: 'selection', label: 'Branch', options: [{ value: 'cc', label: 'City Centre' }] }, 'cc', {}, 'en', { order: 'mdy' })).toBe('City Centre');
    expect(sentenceValue({ type: 'monetary', label: 'Price', currency: 'USD' }, 1500, {}, 'en', {})).toBe('$ 1,500.00');
    expect(sentenceValue({ type: 'date', label: 'Day' }, '2026-10-15', {}, 'en', { order: 'mdy' })).toBe('Oct 15, 2026');
  });
});
