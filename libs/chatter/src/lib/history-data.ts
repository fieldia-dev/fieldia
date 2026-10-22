import type { Page } from '@fieldia/core';
import { firstWeekday } from '@fieldia/core';
import type { ChatterMessage, TrackedChange } from './source';

/**
 * What a record's history is made of, worked out from its chatter: each
 * line's kind and changes, the group by age it falls in, and the colour of
 * the states it moved through.
 */

/** What one line of the history is: the record made, fields changed, or a comment. */
export type HistoryKind = 'created' | 'change' | 'comment';

export interface HistoryEntry {
  key: string;
  kind: HistoryKind;
  message: ChatterMessage;
  at: Date;
  changes: TrackedChange[];
  /** The change to the State Graph's field, when this one moved it. */
  state: TrackedChange | null;
  /** The change to the reason's field made with it. */
  reason: TrackedChange | null;
}

/** The groups by age, newest first. */
export const HISTORY_AGES = ['today', 'yesterday', 'thisWeek', 'lastWeek', 'thisMonth', 'older'] as const;
export type HistoryAge = (typeof HISTORY_AGES)[number];

/** A value a change left empty, or came from empty. */
export const empty = (value: string | null | undefined): boolean => value == null || value === '';

/**
 * The record's history from its messages, newest first: events that changed
 * fields, and comments. The oldest event that only set values, from nothing,
 * is the record being made.
 */
export function historyEntries(messages: readonly ChatterMessage[], stateField?: string, reasonField?: string): HistoryEntry[] {
  const kept = messages.filter((m) => (m.kind === 'event' && (m.tracking?.length ?? 0) > 0) || (m.kind === 'message' && !!m.body));
  const events = kept.filter((m) => m.kind === 'event').sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const first = events[0];
  const made = first && (first.tracking ?? []).every((change) => empty(change.from)) ? first : undefined;
  return kept
    .map((message): HistoryEntry => {
      const changes = message.tracking ?? [];
      const kind: HistoryKind = message.kind === 'message' ? 'comment' : message === made ? 'created' : 'change';
      return {
        key: String(message.id),
        kind,
        message,
        at: new Date(message.date),
        changes,
        state: (stateField && changes.find((change) => change.field === stateField)) || null,
        reason: (reasonField && changes.find((change) => change.field === reasonField)) || null,
      };
    })
    .sort((a, b) => b.at.getTime() - a.at.getTime());
}

/** The first day of the week where `locale` is spoken, as `Date.getDay()` counts (Sunday 0): CLDR's, as @fieldia/core reads it. */
export const firstDayOfWeek = (locale: string): number => firstWeekday(locale);

/** Which group by age a moment falls in, seen from `now`: today, yesterday, this week, last week, this month, or older. */
export function ageOf(at: Date, now: Date, firstDay = 1): HistoryAge {
  // Midnights counted by the calendar, so a day an hour short or long in a clock change is still one day.
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysBack = (days: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
  const intoWeek = (today.getDay() - firstDay + 7) % 7;
  if (at >= today) return 'today';
  if (at >= daysBack(1)) return 'yesterday';
  if (at >= daysBack(intoWeek)) return 'thisWeek';
  if (at >= daysBack(intoWeek + 7)) return 'lastWeek';
  if (at >= new Date(today.getFullYear(), today.getMonth(), 1)) return 'thisMonth';
  return 'older';
}

/** The tones a state's dot may take, in the colours its dot draws them. */
const TONE_COLOURS: Record<string, string> = {
  muted: 'var(--fd-border-strong)',
  danger: 'var(--fd-error)',
  success: 'var(--fd-success)',
  warning: '#d97706',
  info: 'var(--fd-info)',
};
/** Tones known by a state's value, and by its place, as the dot widget knows them. */
const KNOWN_TONES: Record<string, string> = { normal: 'muted', grey: 'muted', blocked: 'danger', red: 'danger', done: 'success', green: 'success', waiting: 'warning' };
const TONES_BY_PLACE = ['muted', 'danger', 'success', 'warning', 'info'];

/** Every field node for `field` anywhere in a layout: its sheet, its head, its tabs and groups. */
function fieldNodes(node: unknown, field: string, found: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(node)) for (const child of node) fieldNodes(child, field, found);
  else if (node && typeof node === 'object') {
    const part = node as Record<string, unknown>;
    if (part['type'] === 'field' && part['field'] === field) found.push(part);
    for (const [key, value] of Object.entries(part)) if (key !== 'options' && value && typeof value === 'object') fieldNodes(value, field, found);
  }
  return found;
}

/**
 * A state's colour by its words, as the page draws its dot: the colour its
 * dot's `options.colours` gives the state's value, else its `options.tones`,
 * else the tone the dot widget knows it by. The words a history keeps are
 * matched to the field's choices by their label, then by their value.
 */
export function stateColours(page: Page, field: string): (words: string) => string | null {
  const definition = page.fields[field];
  const choices = definition?.type === 'selection' ? definition.options : [];
  const nodes = fieldNodes(page.layout, field);
  const node = nodes.find((n) => n['widget'] === 'dot') ?? nodes.find((n) => n['options']) ?? nodes[0];
  const options = (node?.['options'] ?? {}) as Record<string, unknown>;
  const colours = (options['colours'] ?? {}) as Record<string, unknown>;
  const tones = (options['tones'] ?? {}) as Record<string, unknown>;
  return (words) => {
    const typed = words.trim().toLowerCase();
    let at = choices.findIndex((choice) => choice.label === words || String(choice.value) === words);
    if (at < 0) at = choices.findIndex((choice) => choice.label.toLowerCase() === typed || String(choice.value).toLowerCase() === typed);
    if (at < 0) return null;
    const value = String(choices[at].value);
    const colour = colours[value];
    if (typeof colour === 'string' && /^#[0-9a-fA-F]{6}$/.test(colour)) return colour;
    const tone = tones[value];
    if (typeof tone === 'string' && TONE_COLOURS[tone]) return TONE_COLOURS[tone];
    return TONE_COLOURS[KNOWN_TONES[value] ?? TONES_BY_PLACE[at % TONES_BY_PLACE.length]];
  };
}
