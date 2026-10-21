/**
 * The schedule part (parts.ts): a repeat field (repeat.ts) — how often, on which days, until when, kept as an
 * iCalendar rule and said in words (repeat-rule.ts) — with its stylesheet (styles-schedule.ts). Loaded the first time a
 * page shows one, or a list's column of them, through `schedulePart`, with the date part beside it: its end day is its
 * box. A plain box meanwhile: the rule as written.
 */
export { repeatWidget } from './repeat';
export { readRule, repeatWords, ruleWords, RuleBeyond, weekdayName, weekdayOf, WEEKDAYS, writeRule, type RepeatFrequency, type RepeatRule, type Weekday } from './repeat-rule';
export { installScheduleStyles } from './styles-schedule';
