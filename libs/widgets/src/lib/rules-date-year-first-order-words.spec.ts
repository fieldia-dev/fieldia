import { dateExample, readDateText } from './date-text';

/**
 * Found by the 0.23 input-rules check (dates), MINOR. On a page whose look types dates year first (`dateOrder: 'ymd'`),
 * a date written day first with its year in full, "15/10/2026", is read as the year 15 and refused with "“15” could be
 * 1915 or 2015; write the year in full" — though the year was written in full, last. The words should point to the
 * page's order (its example, 2026-12-31), as a date that does not read otherwise does.
 */
describe('a day-first date with its year in full, on a year-first page', () => {
  it('is refused pointing to the page’s order, never asking for the year in full', () => {
    const reader = { kind: 'date' as const, order: 'ymd' as const, locale: 'en' as const, label: 'Day' };
    const read = readDateText('15/10/2026', reader);
    expect(read.ok).toBe(false);
    const words = read.ok ? '' : read.words;
    expect({ asksForTheYearInFull: /year in full/.test(words), pointsToTheOrder: words.includes(dateExample(reader)) }).toEqual({ asksForTheYearInFull: false, pointsToTheOrder: true });
  });
});
