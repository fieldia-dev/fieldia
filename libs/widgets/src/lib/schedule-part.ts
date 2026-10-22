/**
 * The schedule part (parts.ts): a repeat field (repeat.ts) — how often, on which days, until when, kept as an
 * iCalendar rule and said in words (repeat-rule.ts) — and a week's opening hours (hours.ts), a shape a booking
 * schedule reads; with their stylesheet (styles-schedule.ts). Loaded the first time a page shows either, or a list's
 * column of them, through `schedulePart`, with the date part beside it: their days and times are its boxes. A plain
 * box meanwhile: the rule as written, the hours as JSON.
 */
import { PART_CELL_WORDS } from './display';
import { hoursWords } from './hours';
import { WIDGET_LABELS } from './labels';
import { repeatWords } from './repeat-rule';

export { repeatWidget } from './repeat';
export { hoursWidget, hoursWords, shiftProblem, weekHours, type Shift, type WeekHours } from './hours';
export { readRule, repeatWords, ruleWords, RuleBeyond, weekdayName, weekdayOf, WEEKDAYS, writeRule, type RepeatFrequency, type RepeatRule, type Weekday } from './repeat-rule';
export { installScheduleStyles } from './styles-schedule';

// A list's cells of either, said in words from now on (display.ts).
PART_CELL_WORDS['repeat'] = (value, locale) => repeatWords(value, locale, WIDGET_LABELS[locale] ?? WIDGET_LABELS.en);
PART_CELL_WORDS['hours'] = (value, locale, shown) => (value ? hoursWords(value, locale, WIDGET_LABELS[locale] ?? WIDGET_LABELS.en, Number(shown.options?.['weekStart'] ?? 1)) : '');
