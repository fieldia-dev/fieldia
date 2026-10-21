import { WIDGET_LABELS } from './labels';
import { readRule, repeatWords, RuleBeyond, ruleWords, writeRule } from './repeat-rule';

/** A repeat rule read from and written as iCalendar's RRULE, and said in words in the four languages. */

const en = WIDGET_LABELS.en;

describe('a repeat rule', () => {
  it('reads and writes the rules a repeat field keeps, the same both ways', () => {
    for (const text of ['FREQ=DAILY', 'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH;COUNT=6', 'FREQ=MONTHLY;BYMONTHDAY=15;UNTIL=20261231', 'FREQ=MONTHLY;BYMONTHDAY=-1', 'FREQ=MONTHLY;BYDAY=1MO', 'FREQ=MONTHLY;BYDAY=-1FR', 'FREQ=YEARLY;INTERVAL=3']) {
      expect(writeRule(readRule(text) as NonNullable<ReturnType<typeof readRule>>)).toBe(text);
    }
    expect(readRule('RRULE:FREQ=WEEKLY;BYDAY=TH,MO')).toEqual({ freq: 'WEEKLY', interval: 1, days: ['MO', 'TH'] });
    expect(readRule('FREQ=WEEKLY;UNTIL=20261231T235959Z')).toEqual({ freq: 'WEEKLY', interval: 1, until: '2026-12-31' });
    expect(readRule('')).toBeNull();
    expect(readRule(null)).toBeNull();
  });

  it('refuses what it cannot write again, so the field keeps it as it is', () => {
    for (const text of ['FREQ=HOURLY', 'FREQ=WEEKLY;BYHOUR=9', 'FREQ=MONTHLY;BYMONTHDAY=1,15', 'FREQ=WEEKLY;COUNT=3;UNTIL=20261231', 'nonsense']) expect(() => readRule(text)).toThrow(RuleBeyond);
  });

  it('says a rule as people say it', () => {
    const said = (text: string) => ruleWords(readRule(text) as NonNullable<ReturnType<typeof readRule>>, 'en', en);
    expect(said('FREQ=DAILY')).toBe('Every day');
    expect(said('FREQ=DAILY;INTERVAL=3')).toBe('Every 3 days');
    expect(said('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH;COUNT=6')).toBe('Every 2 weeks on Tuesday and Thursday, 6 times');
    expect(said('FREQ=WEEKLY;BYDAY=MO,WE,FR')).toBe('Every week on Monday, Wednesday, and Friday');
    expect(said('FREQ=MONTHLY;BYMONTHDAY=1')).toBe('Every month on the 1st');
    expect(said('FREQ=MONTHLY;BYMONTHDAY=22')).toBe('Every month on the 22nd');
    expect(said('FREQ=MONTHLY;BYMONTHDAY=13;UNTIL=20261231')).toBe('Every month on the 13th, until 31 Dec 2026');
    expect(said('FREQ=MONTHLY;BYMONTHDAY=-1')).toBe('Every month on the last day');
    expect(said('FREQ=MONTHLY;INTERVAL=3;BYDAY=1MO')).toBe('Every 3 months on the first Monday');
    expect(said('FREQ=MONTHLY;BYDAY=-1FR;COUNT=1')).toBe('Every month on the last Friday, once');
    expect(said('FREQ=YEARLY')).toBe('Every year');
  });

  it('says it in Arabic, German and French, each day and number as the language writes it', () => {
    const rule = readRule('FREQ=MONTHLY;BYMONTHDAY=1;COUNT=6') as NonNullable<ReturnType<typeof readRule>>;
    expect(ruleWords(rule, 'de', WIDGET_LABELS.de)).toBe('Monatlich am 1., 6-mal');
    expect(ruleWords(rule, 'fr', WIDGET_LABELS.fr)).toBe('Chaque mois le 1er, 6 fois');
    expect(ruleWords(readRule('FREQ=WEEKLY;BYDAY=SA') as NonNullable<ReturnType<typeof readRule>>, 'ar', WIDGET_LABELS.ar)).toBe('كل أسبوع في السبت');
  });

  it('says a value at rest: none for no rule, and one it cannot read as it is written', () => {
    expect(repeatWords('FREQ=WEEKLY;BYDAY=MO', 'en', en)).toBe('Every week on Monday');
    expect(repeatWords('', 'en', en)).toBe('');
    expect(repeatWords('FREQ=WEEKLY;BYHOUR=9', 'en', en)).toBe('FREQ=WEEKLY;BYHOUR=9');
  });
});
