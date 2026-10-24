import { validatePage } from '../format/validate';
import type { Field, LineField } from '../format/field';
import type { Page } from '../format/page';
import { checkValue } from './check';
import { dayWords, hijriWords, precisionOf } from './day-words';
import { MESSAGES } from './messages';

/**
 * A date of a month alone or a year alone (`precision`), and one shown in the Hijri calendar beside its Gregorian day
 * (`hijri`): the format takes them, its limits are kept by the month or the year — this month is within "today" though
 * its first day is past — and said as its box writes it; the Hijri day is written by Intl's Umm al-Qura calendar.
 */

const page = (field: Record<string, unknown>): unknown => ({
  fieldia: '0.12',
  id: 'dates',
  data: { kind: 'responses' },
  fields: { when: { type: 'date', label: 'Billing month', ...field } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-when', field: 'when' }] },
});

describe('a date that keeps a month or a year', () => {
  it('is in the format, its days of the week and a Hijri day refused with it', () => {
    expect(validatePage(page({ precision: 'month' })).ok).toBe(true);
    expect(validatePage(page({ precision: 'year' })).ok).toBe(true);
    expect(validatePage(page({ hijri: true })).ok).toBe(true);
    expect(validatePage(page({ precision: 'week' })).ok).toBe(false);
    const days = validatePage(page({ precision: 'month', days: [1, 2, 3, 4, 5] }));
    expect(days.ok ? [] : days.issues.map((issue) => issue.message)).toContain('the days of the week a date may fall on are a day’s: a month or a year has them all');
    const hijri = validatePage(page({ precision: 'year', hijri: true }));
    expect(hijri.ok ? [] : hijri.issues.map((issue) => issue.message)).toContain('a Hijri date is a day: a month or a year alone is the Gregorian calendar’s');
  });

  it('knows how much of a date a field keeps', () => {
    expect(precisionOf({ type: 'date', precision: 'month' })).toBe('month');
    expect(precisionOf({ type: 'date' })).toBe('day');
    expect(precisionOf({ type: 'datetime', precision: 'month' })).toBe('day');
  });

  it('keeps its limits by the month: the month of "today" is within it', () => {
    const field = { type: 'date', label: 'Billing month', precision: 'month', min: 'today', max: '2027-03-15' } as Field;
    expect(checkValue(field, '2026-10-01', false, MESSAGES.en, '2026-10-21')).toBeUndefined();
    expect(checkValue(field, '2027-03-01', false, MESSAGES.en, '2026-10-21')).toBeUndefined();
    expect(checkValue(field, '2026-09-01', false, MESSAGES.en, '2026-10-21')).toBe('Billing month can’t be before Oct 2026');
    expect(checkValue(field, '2027-04-01', false, MESSAGES.en, '2026-10-21')).toBe('Billing month can’t be after Mar 2027');
    expect(checkValue(field, '2026-09-01', false, MESSAGES.ar, '2026-10-21')).toContain('أكتوبر 2026');
  });

  it('keeps a year’s limits by the year', () => {
    const field = { type: 'date', label: 'Year built', precision: 'year', min: '1950-06-01', max: 'today' } as LineField;
    expect(checkValue(field as Field, '1950-01-01', false, MESSAGES.en, '2026-10-21')).toBeUndefined();
    expect(checkValue(field as Field, '1949-01-01', false, MESSAGES.en, '2026-10-21')).toBe('Year built can’t be before 1950');
    expect(checkValue(field as Field, '2027-01-01', false, MESSAGES.en, '2026-10-21')).toBe('Year built can’t be after 2026');
  });

  it('writes a month alone and a year alone as their boxes do', () => {
    expect(dayWords('2026-10-01', MESSAGES.en, 'dmy', 'month')).toBe('Oct 2026');
    expect(dayWords('2026-10-01', MESSAGES.en, 'mdy', 'month')).toBe('Oct 2026');
    expect(dayWords('2026-10-01', MESSAGES.en, 'ymd', 'month')).toBe('2026-10');
    expect(dayWords('2026-10-01', MESSAGES.fr, 'dmy', 'month')).toBe('oct. 2026');
    expect(dayWords('2026-01-01', MESSAGES.en, 'dmy', 'year')).toBe('2026');
  });
});

describe('a day in the Hijri calendar', () => {
  it('is written by Umm al-Qura’s reckoning, in the page’s language', () => {
    expect(hijriWords('2026-10-13', 'en')).toBe('2 Jumada I 1448 AH');
    expect(hijriWords('2026-10-13', 'ar')).toBe('2 جمادى الأولى 1448 هـ');
    expect(hijriWords('not a day', 'en')).toBe('');
  });

  it('is a page the format takes', () => {
    const checked = validatePage(page({ hijri: true }) as Page);
    expect(checked.ok).toBe(true);
  });
});
