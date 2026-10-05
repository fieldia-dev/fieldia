import { PART_LOOKS, type PageLook, type PartLook } from '@fieldia/core';
import type { LookPatch } from './layout-settings';

/**
 * Looks to start from, as SurveyJS and Vueform name their themes: each a
 * whole set of the page's look — accent, font, spacing, corners, light or
 * dark — and never where labels sit, which is the layout's. Every accent
 * reads on a light page and, as the viewer lightens it, on a dark one.
 */

/** What a preset sets, and what a look is matched on. */
export const PRESET_KEYS = ['accent', 'font', 'density', 'corners', 'scheme'] as const;

/**
 * What a whole look holds — a look of one's own, or one put on the page: the
 * values a preset sets, and each kind of part's own look, which is look too,
 * as a SurveyJS theme carries its components'. Where labels sit, and how wide
 * beside their boxes, is the layout's, so no look carries it.
 */
export const LOOK_KEYS = [...PRESET_KEYS, 'parts'] as const;

/** A whole look: any of its values left to the skin, and any kind of part to the page. */
export type LookValues = Pick<PageLook, (typeof LOOK_KEYS)[number]>;

export interface LookPreset {
  id: string;
  name: string;
  /** The five values it sets; it gives each kind of part back to the page. */
  look: Required<Pick<PageLook, (typeof PRESET_KEYS)[number]>>;
}

export const LOOK_PRESETS: readonly LookPreset[] = [
  { id: 'fieldia', name: 'Fieldia', look: { accent: '#2b5fd9', font: 'system', density: 'comfortable', corners: 'soft', scheme: 'light' } },
  { id: 'calm', name: 'Calm', look: { accent: '#0f766e', font: 'serif', density: 'roomy', corners: 'soft', scheme: 'light' } },
  { id: 'compact', name: 'Compact', look: { accent: '#002855', font: 'system', density: 'compact', corners: 'square', scheme: 'light' } },
  { id: 'rounded', name: 'Rounded', look: { accent: '#6941c6', font: 'rounded', density: 'comfortable', corners: 'round', scheme: 'light' } },
  { id: 'night', name: 'Night', look: { accent: '#4f46e5', font: 'system', density: 'comfortable', corners: 'soft', scheme: 'dark' } },
];

/** Each kind of part's look, in one order and colours in one case, to compare: none set reads as none. */
function partsKey(look: PageLook | undefined): string {
  const parts = (look?.parts ?? {}) as Record<string, PartLook | undefined>;
  return JSON.stringify(Object.entries(PART_LOOKS).map(([kind, settings]) => settings.map((name: keyof PartLook) => parts[kind]?.[name]?.toLowerCase() ?? null)));
}

/** Two looks are the same by the values a preset sets, value for value (the accent in either case), and each kind of part's; one unset matches only unset. */
export function sameLook(a: PageLook | undefined, b: PageLook | undefined): boolean {
  return PRESET_KEYS.every((key) => (key === 'accent' ? a?.accent?.toLowerCase() === b?.accent?.toLowerCase() : a?.[key] === b?.[key])) && partsKey(a) === partsKey(b);
}

/** The preset a look is; null when it is none of them. */
export function presetOf(look: PageLook | undefined): LookPreset | null {
  return LOOK_PRESETS.find((preset) => sameLook(look, preset.look)) ?? null;
}

/** The look of one's own a look is, among those kept; null when it is none of them. */
export function savedLookOf<T extends { look: LookValues }>(look: PageLook | undefined, kept: readonly T[]): T | null {
  return kept.find((saved) => sameLook(look, saved.look)) ?? null;
}

/** Only the values a look holds: what a preset sets and each kind of part's, and nothing of where labels sit. */
export function lookValuesOf(look: PageLook | undefined): LookValues {
  const values: Record<string, unknown> = {};
  for (const key of LOOK_KEYS) if (look?.[key] !== undefined) values[key] = key === 'parts' ? JSON.parse(JSON.stringify(look.parts)) : look[key];
  return values as LookValues;
}

/** A whole look as a change to the page: each value it holds, and each it leaves unset given back to the skin; each kind of part it has none for, to the page. */
export function wholeLook(look: LookValues): LookPatch {
  return Object.fromEntries(LOOK_KEYS.map((key) => [key, (key === 'parts' && !Object.keys(look.parts ?? {}).length ? null : look[key]) ?? null])) as LookPatch;
}
