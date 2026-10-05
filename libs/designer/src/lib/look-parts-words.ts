import type { PartLook, PartLookKind } from '@fieldia/core';
import type { DesignerWords } from './designer-words';
import { en } from './locales/en';

/**
 * The words a person sets each kind of part's look by: the kinds as they
 * think of them, and each setting by what it draws on that kind — a table's
 * background is its heading row, a button's accent its colour. In the
 * designer's words (`words.partLooks`); these are the English ones.
 */

export const KIND_WORDS: Record<PartLookKind, string> = en.partLooks.kinds;

/** What each kind covers, under its settings. */
export const KIND_HINTS: Record<PartLookKind, string> = en.partLooks.hints;

/** A setting's name, as it is on that kind of part. */
export const settingWords = (kind: PartLookKind, setting: keyof PartLook, words: DesignerWords = en): string => words.partLooks.own[kind]?.[setting] ?? words.partLooks.settings[setting];

/** The words of a setting's values: a colour as written, a choice in words. */
export const VALUE_WORDS: Record<string, string> = en.partLooks.values;
