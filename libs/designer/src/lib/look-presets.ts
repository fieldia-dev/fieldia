import type { PageLook } from '@fieldia/core';
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
 * A whole look, as a preset or a look of one's own holds it: the values a
 * preset sets, any of them left to the skin. Where labels sit, and how wide
 * beside their boxes, is the layout's, so no look carries it.
 */
export type LookValues = Pick<PageLook, (typeof PRESET_KEYS)[number]>;

export interface LookPreset {
  id: string;
  name: string;
  look: Required<LookValues>;
}

export const LOOK_PRESETS: readonly LookPreset[] = [
  { id: 'fieldia', name: 'Fieldia', look: { accent: '#2b5fd9', font: 'system', density: 'comfortable', corners: 'soft', scheme: 'light' } },
  { id: 'calm', name: 'Calm', look: { accent: '#0f766e', font: 'serif', density: 'roomy', corners: 'soft', scheme: 'light' } },
  { id: 'compact', name: 'Compact', look: { accent: '#002855', font: 'system', density: 'compact', corners: 'square', scheme: 'light' } },
  { id: 'rounded', name: 'Rounded', look: { accent: '#6941c6', font: 'rounded', density: 'comfortable', corners: 'round', scheme: 'light' } },
  { id: 'night', name: 'Night', look: { accent: '#4f46e5', font: 'system', density: 'comfortable', corners: 'soft', scheme: 'dark' } },
];

/** Two looks are the same by the values a preset sets, value for value (the accent in either case); one unset matches only unset. */
export function sameLook(a: PageLook | undefined, b: PageLook | undefined): boolean {
  return PRESET_KEYS.every((key) => (key === 'accent' ? a?.accent?.toLowerCase() === b?.accent?.toLowerCase() : a?.[key] === b?.[key]));
}

/** The preset a look is; null when it is none of them. */
export function presetOf(look: PageLook | undefined): LookPreset | null {
  return LOOK_PRESETS.find((preset) => sameLook(look, preset.look)) ?? null;
}

/** The look of one's own a look is, among those kept; null when it is none of them. */
export function savedLookOf<T extends { look: LookValues }>(look: PageLook | undefined, kept: readonly T[]): T | null {
  return kept.find((saved) => sameLook(look, saved.look)) ?? null;
}

/** Only the values a look holds: what a preset sets, and nothing of where labels sit. */
export function lookValuesOf(look: PageLook | undefined): LookValues {
  const values: LookValues = {};
  for (const key of PRESET_KEYS) if (look?.[key] !== undefined) (values as Record<string, string>)[key] = look[key] as string;
  return values;
}

/** A whole look as a change to the page: each value it holds, and each it leaves unset given back to the skin. */
export function wholeLook(look: LookValues): LookPatch {
  return Object.fromEntries(PRESET_KEYS.map((key) => [key, look[key] ?? null])) as LookPatch;
}
