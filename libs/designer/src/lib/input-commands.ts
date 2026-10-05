import { dayOf, type Field, type FieldNode, type Page } from '@fieldia/core';
import { findNode } from './page-tree';
import { Refusal } from './refusal';
import type { DesignerWords } from './designer-words';

/**
 * The edits the text, number and date kinds need beyond words: the most
 * characters a box takes, a number's range and decimals, a date's earliest
 * and latest day, the days of the week it may fall on and whether it starts
 * on today — and a slider's step, which makes its field a decimal when the
 * step is one. Each goes through the designer's `apply`, so it is validated,
 * undone and saved as every other edit is.
 */

export interface InputLimits {
  /** The most characters a short answer or a paragraph takes; null for any. */
  size?: number | null;
  /** A number's or an amount's least and most; a date's earliest and latest day: "2026-03-02", "today", "today+30". Null takes one away. */
  min?: number | string | null;
  max?: number | string | null;
  /** How many decimals a number or an amount has, 0 to 6; null for the usual. */
  decimals?: number | null;
  /** The days of the week a date may fall on, 1 Monday … 7 Sunday; null for any. */
  days?: number[] | null;
  /** A date that starts on the day the form is opened. */
  startsToday?: boolean;
}

export interface InputCommandsDeps {
  apply(edit: (draft: Page) => void, merge?: string | null): boolean;
  /** Whether a field is the backend's, whose definition the page does not change. */
  fromModel(name: string): boolean;
  /** The designer's words, for the words it writes at a scale's ends. */
  words: DesignerWords;
}

const NUMBERS = ['integer', 'float', 'monetary'];
const DATES = ['date', 'datetime'];
const DAY = /^(\d{4}-\d{2}-\d{2}|today([+-]\d{1,4})?)$/;
/** The usual width of a number, in digits, when the decimals are set and the width is not. */
const WIDTH = 16;

/** How many decimals a number is written with: 0.25 has 2. */
export const decimalsOf = (n: number) => (Number.isInteger(n) ? 0 : (String(n).split('.')[1] ?? '').length);

export function inputCommands({ apply, fromModel, words }: InputCommandsDeps) {
  /** The question's node and its field. */
  function question(draft: Page, id: string): { node: FieldNode; field: Field; owned: boolean } {
    const found = findNode(draft, id);
    if (!found || found.node.type !== 'field') throw new Refusal((w) => w.refusals.noQuestion(id));
    return { node: found.node, field: draft.fields[found.node.field], owned: !fromModel(found.node.field) };
  }

  /** A number's least or most, or a date's earliest or latest day, as the field takes it. */
  function limit(field: Field, value: number | string): number | string {
    if (NUMBERS.includes(field.type)) {
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new Refusal((w) => w.refusals.fromToNumbers);
      if (field.type === 'integer' && !Number.isInteger(value)) throw new Refusal((w) => w.refusals.wholeRange);
      return value;
    }
    if (typeof value !== 'string' || !DAY.test(value) || Number.isNaN(Date.parse(dayOf(value)))) throw new Refusal((w) => w.refusals.dayIs);
    return value;
  }

  return {
    /** A field's limits: the most characters, a range, decimals, a date's days. Null takes one away. */
    setLimits(id: string, limits: InputLimits): boolean {
      return apply(
        (draft) => {
          const { field, owned } = question(draft, id);
          if (!owned) throw new Refusal((w) => w.refusals.limitsFromModel(field.label));
          const own = field as Field & Record<string, unknown>;
          const put = (key: string, value: unknown) => (value === null || value === undefined ? delete own[key] : (own[key] = value));
          if (limits.size !== undefined) {
            if (field.type !== 'char' && field.type !== 'text') throw new Refusal((w) => w.refusals.onlyTextSize);
            if (limits.size !== null && !(Number.isInteger(limits.size) && limits.size > 0)) throw new Refusal((w) => w.refusals.sizeWhole);
            put('size', limits.size);
          }
          for (const key of ['min', 'max'] as const) {
            const value = limits[key];
            if (value === undefined) continue;
            if (![...NUMBERS, ...DATES].includes(field.type)) throw new Refusal((w) => w.refusals.onlyLimits);
            put(key, value === null ? null : limit(field, value));
          }
          if (own['min'] !== undefined && own['max'] !== undefined) {
            const [min, max] = [own['min'], own['max']].map((v) => (typeof v === 'string' ? dayOf(v) : (v as number)));
            const dates = DATES.includes(field.type);
            // A date may be one day only; a number runs from less to more.
            if (dates ? (min as number) > (max as number) : (min as number) >= (max as number)) throw new Refusal((w) => (dates ? w.refusals.earliestAfterLatest : w.refusals.fromNotLess));
          }
          if (limits.decimals !== undefined) {
            if (field.type !== 'float' && field.type !== 'monetary') throw new Refusal((w) => w.refusals.onlyDecimals);
            const d = limits.decimals;
            if (d !== null && !(Number.isInteger(d) && d >= 0 && d <= 6)) throw new Refusal((w) => w.refusals.decimalsRange);
            put('digits', d === null ? null : [field.digits?.[0] ?? WIDTH, d]);
          }
          if (limits.days !== undefined) {
            if (!DATES.includes(field.type)) throw new Refusal((w) => w.refusals.onlyDateDays);
            const days = limits.days === null ? [] : [...new Set(limits.days)].sort();
            if (days.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) throw new Refusal((w) => w.refusals.daysRange);
            if (limits.days !== null && !days.length) throw new Refusal((w) => w.refusals.oneDay);
            put('days', days.length && days.length < 7 ? days : null);
          }
          if (limits.startsToday !== undefined) {
            if (field.type !== 'date') throw new Refusal((w) => w.refusals.onlyDateToday);
            put('default', limits.startsToday ? 'today' : null);
          }
        },
        // Typing in one of a field's limits is one undo step.
        `limits:${id}:${Object.keys(limits).join(',')}`
      );
    },

    /** A list among the widget's settings, such as keywords' suggestions; empty takes it away. Typing in it is one undo step. */
    setWidgetList(id: string, key: string, list: string[]): boolean {
      return apply(
        (draft) => {
          const { node } = question(draft, id);
          const options = { ...(node.options ?? {}) };
          const kept = list.map((item) => item.trim()).filter(Boolean);
          if (kept.length) options[key] = kept;
          else delete options[key];
          if (Object.keys(options).length) node.options = options;
          else delete node.options;
        },
        `widget-list:${id}:${key}`
      );
    },

    /** A linear scale made NPS, as one edit: 0 to 10, "Not at all likely" to "Extremely likely". */
    makeNps(id: string): boolean {
      return apply((draft) => {
        const { node, field, owned } = question(draft, id);
        if (node.widget !== 'scale' || field.type !== 'integer') throw new Refusal((w) => w.refusals.onlyScaleNps);
        if (!owned) throw new Refusal((w) => w.refusals.rangeFromModel(field.label));
        Object.assign(field, { min: 0, max: 10 });
        node.options = { ...(node.options ?? {}), startLabel: words.defaults.npsStart, endLabel: words.defaults.npsEnd };
      });
    },

    /**
     * A slider's step; null or 1 for one at a time. A step with decimals
     * makes the field a decimal with as many, so every value it reaches is
     * one the field takes; a whole step makes it whole again. A field of the
     * model keeps what it holds: one of whole numbers steps by whole numbers.
     */
    setStep(id: string, step: number | null): boolean {
      return apply(
        (draft) => {
          const { node, field, owned } = question(draft, id);
          if (node.widget !== 'slider' || (field.type !== 'integer' && field.type !== 'float')) throw new Refusal((w) => w.refusals.onlySliderStep);
          if (step !== null && !(Number.isFinite(step) && step > 0)) throw new Refusal((w) => w.refusals.stepNumber);
          const whole = step === null || Number.isInteger(step);
          if (!owned && !whole && field.type === 'integer') throw new Refusal((w) => w.refusals.stepWhole(field.label));
          const options = { ...(node.options ?? {}) };
          if (step === null || step === 1) delete options['step'];
          else options['step'] = step;
          if (Object.keys(options).length) node.options = options;
          else delete node.options;
          if (!owned) return;
          const { min, max } = field;
          const { digits: _digits, ...rest } = field as Extract<Field, { type: 'float' }>;
          if (!whole) draft.fields[node.field] = { ...rest, type: 'float', digits: [field.type === 'float' ? (field.digits?.[0] ?? WIDTH) : WIDTH, decimalsOf(step as number)] };
          else if (field.type === 'float' && [min, max].every((n) => n === undefined || Number.isInteger(n))) draft.fields[node.field] = { ...rest, type: 'integer' };
        },
        `step:${id}`
      );
    },
  };
}

export type InputCommands = ReturnType<typeof inputCommands>;
