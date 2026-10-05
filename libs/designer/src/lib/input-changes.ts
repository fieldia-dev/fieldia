import type { Field, FieldNode } from '@fieldia/core';
import { kindOfField } from './kinds';
import type { DesignerWords } from './designer-words';
import { en } from './locales/en';

/**
 * What changed in a field's text, number and date settings from one version
 * of a page to the next, in words: "“Bio”: takes at most 200 characters". A
 * field's own settings are said only while it stays the same kind of data —
 * a field made another kind says so on its own. It hands back the keys of its
 * widget's settings it does not say (`unsaid`), for other words to say.
 */

interface Placed {
  field: Field;
  node: FieldNode;
}

/** The words for a setting's new value, or null where these words have none for it. */
type Words = (value: unknown, now: Placed, kind: string | null, w: DesignerWords['settingsChanges']) => string | null;

const DATES = ['date', 'datetime'];

/** "today", "30 days after today", "7 days before today", "2026-03-02". */
function dayWords(limit: string, w: DesignerWords['settingsChanges']): string {
  if (limit === 'today') return w.today;
  const counted = /^today([+-])(\d+)$/.exec(limit);
  if (!counted) return limit;
  return counted[1] === '+' ? w.daysAfter(Number(counted[2])) : w.daysBefore(Number(counted[2]));
}

/** A range in words: "from 0 to 300", "at least 0", "between today and …", "no later than …". */
function range(field: Field, w: DesignerWords['settingsChanges']): string {
  const { min, max } = field as { min?: unknown; max?: unknown };
  if (DATES.includes(field.type)) {
    const [a, b] = [min, max].map((v) => (typeof v === 'string' ? dayWords(v, w) : undefined));
    return a && b ? w.between(a, b) : a ? w.noEarlier(a) : b ? w.noLater(b) : w.anyDay;
  }
  if (min !== undefined && max !== undefined) return w.fromTo(min as number, max as number);
  return min !== undefined ? w.atLeast(min as number) : max !== undefined ? w.atMost(max as number) : w.anyNumber;
}

/** The field's own settings, by key: those said together, under the first. */
const FIELD_WORDS: Record<string, Words> = {
  size: (v, _now, _kind, w) => (v === undefined ? w.anySize : w.size(v as number)),
  'min,max': (_v, now, _kind, w) => range(now.field, w),
  digits: (v, _now, _kind, w) => (v === undefined ? w.usualDecimals : w.decimals((v as number[])[1])),
  days: (v, _now, _kind, w) => (Array.isArray(v) ? w.notOn(w.dayNames.filter((_, i) => !v.includes(i + 1))) : w.anyWeekday),
  default: (v, now, _kind, w) => (now.field.type !== 'date' ? null : v === 'today' ? w.startsToday : w.startsEmpty),
};

const ICONS = ['heart', 'thumb', 'number'];
const COLOURS = ['success', 'warning', 'danger', 'info'];

/** The widget's settings, by key. */
const OPTION_WORDS: Record<string, Words> = {
  rows: (v, _now, _kind, w) => w.rows((v as number | undefined) ?? 3),
  autoGrow: (v, _now, _kind, w) => (v === false ? w.keepsHeight : w.grows),
  prefix: (v, _now, _kind, w) => (v ? w.before(String(v)) : w.noBefore),
  suffix: (v, _now, _kind, w) => (v ? w.after(String(v)) : w.noAfter),
  startLabel: (v, _now, _kind, w) => (v ? w.atStart(String(v)) : w.noStart),
  endLabel: (v, _now, _kind, w) => (v ? w.atEnd(String(v)) : w.noEnd),
  nps: (v, _now, _kind, w) => (v ? w.nps : w.noNps),
  icon: (v, _now, _kind, w) => w.icons[ICONS.includes(v as string) ? (v as 'heart' | 'thumb' | 'number') : 'star'],
  min: (v, _now, kind, w) => (kind !== 'time' ? null : v ? w.timeFrom(String(v)) : w.anyTimeFrom),
  max: (v, _now, kind, w) => (kind === 'time' ? (v ? w.timeUntil(String(v)) : w.anyTimeUntil) : kind === 'keywords' ? (v ? w.takesAtMost(v as number) : w.takesAny) : null),
  color: (v, _now, kind, w) => (kind !== 'progress' ? null : w.colours[COLOURS.includes(v as string) ? (v as 'success' | 'warning' | 'danger' | 'info') : 'none']),
  showPercent: (v, _now, kind, w) => (kind !== 'progress' ? null : v === false ? w.noPercent : w.percent),
  separator: (v, _now, kind, w) => (kind === 'keywords' ? w.apart(String(v ?? ',')) : null),
  suggestions: (v, _now, kind, w) => (kind !== 'keywords' ? null : Array.isArray(v) ? w.suggests(v as string[]) : w.suggestsNothing),
  step: (v, _now, kind, w) => (kind === 'time' || kind === 'date-time' ? (v ? w.everyMinutes(v as number) : w.anyMinute) : kind === 'slider' ? w.stepsBy((v as number | undefined) ?? 1) : null),
};

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function inputChanges(name: string, was: Placed, now: Placed, words: DesignerWords = en): { lines: string[]; unsaid: string[] } {
  const w = words.settingsChanges;
  const lines: string[] = [];
  const say = (said: string | null) => said !== null && lines.push(w.line(name, said));
  const kind = kindOfField(now.field, now.node);
  const own = (p: Placed, key: string) => (p.field as Record<string, unknown>)[key];
  if (was.field.type === now.field.type) {
    for (const [keys, wordsFor] of Object.entries(FIELD_WORDS)) {
      const read = (p: Placed) => keys.split(',').map((key) => own(p, key));
      if (!same(read(was), read(now))) say(wordsFor(own(now, keys), now, kind, w));
    }
  }
  const [before, after] = [was.node.options ?? {}, now.node.options ?? {}];
  const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => !same(before[key], after[key]));
  const unsaid: string[] = [];
  for (const key of changed) {
    const said = OPTION_WORDS[key]?.(after[key], now, kind, w) ?? null;
    if (said === null) unsaid.push(key);
    say(said);
  }
  return { lines, unsaid };
}
