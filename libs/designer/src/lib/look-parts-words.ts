import type { PartLook, PartLookKind } from '@fieldia/core';

/**
 * The words a person sets each kind of part's look by: the kinds as they
 * think of them, and each setting by what it draws on that kind — a table's
 * background is its heading row, a button's accent its colour.
 */

export const KIND_WORDS: Record<PartLookKind, string> = { inputs: 'Text boxes', choices: 'Choices', groups: 'Groups', buttons: 'Buttons', tables: 'Tables' };

/** What each kind covers, under its settings. */
export const KIND_HINTS: Record<PartLookKind, string> = {
  inputs: 'Text, number and date boxes, and dropdowns. The accent is the edge of the box being typed in and the day picked.',
  choices: 'Rings and ticks take the accent; a scale’s points, Yes and No, pictures and a ranking’s lines take the rest.',
  groups: 'Sections and cards. With the underline skin, a group given a background or a border is drawn as a card.',
  buttons: 'Send, Next, Save, Add another.',
  tables: 'Tables of lines, and a matrix’s grid of questions.',
};

const SETTING_WORDS: Record<keyof PartLook, string> = { background: 'Background', border: 'Border', corners: 'Corners', textSize: 'Text size', accent: 'Accent' };
const OWN_WORDS: Partial<Record<PartLookKind, Partial<Record<keyof PartLook, string>>>> = {
  buttons: { accent: 'Colour' },
  tables: { background: 'Heading row', border: 'Lines' },
};

/** A setting's name, as it is on that kind of part. */
export const settingWords = (kind: PartLookKind, setting: keyof PartLook): string => OWN_WORDS[kind]?.[setting] ?? SETTING_WORDS[setting];

/** The words of a setting's values: a colour as written, a choice in words. */
export const VALUE_WORDS: Record<string, string> = { square: 'Square', soft: 'Soft', round: 'Round', small: 'Small', large: 'Large' };
