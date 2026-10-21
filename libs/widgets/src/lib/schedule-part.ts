/**
 * The schedule part (parts.ts): a repeat field (repeat.ts) — how often, on which days, until when, kept as an
 * iCalendar rule and said in words (repeat-rule.ts) — and a week's opening hours (hours.ts), a shape a booking
 * schedule reads; with their stylesheet (styles-schedule.ts). Loaded the first time a page shows either, or a list's
 * column of them, through `schedulePart`, with the date part beside it: their days and times are its boxes. A plain
 * box meanwhile: the rule as written, the hours as JSON.
 */
export { repeatWidget } from './repeat';
export { hoursWidget, hoursWords, shiftProblem, weekHours, type Shift, type WeekHours } from './hours';
export { readRule, repeatWords, ruleWords, RuleBeyond, weekdayName, weekdayOf, WEEKDAYS, writeRule, type RepeatFrequency, type RepeatRule, type Weekday } from './repeat-rule';
export { installScheduleStyles } from './styles-schedule';
