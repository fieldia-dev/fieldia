import type { PageLook } from '@fieldia/core';

/**
 * Looks to start from, as SurveyJS and Vueform name their themes: each a
 * whole set of the page's look — accent, font, spacing, corners, light or
 * dark — and never where labels sit, which is the layout's. Every accent
 * reads on a light page and, as the viewer lightens it, on a dark one.
 */

export interface LookPreset {
  id: string;
  name: string;
  look: Required<Pick<PageLook, 'accent' | 'font' | 'density' | 'corners' | 'scheme'>>;
}

/** What a preset sets, and what a look is matched on. */
export const PRESET_KEYS = ['accent', 'font', 'density', 'corners', 'scheme'] as const;

export const LOOK_PRESETS: readonly LookPreset[] = [
  { id: 'fieldia', name: 'Fieldia', look: { accent: '#2b5fd9', font: 'system', density: 'comfortable', corners: 'soft', scheme: 'light' } },
  { id: 'calm', name: 'Calm', look: { accent: '#0f766e', font: 'serif', density: 'roomy', corners: 'soft', scheme: 'light' } },
  { id: 'compact', name: 'Compact', look: { accent: '#002855', font: 'system', density: 'compact', corners: 'square', scheme: 'light' } },
  { id: 'rounded', name: 'Rounded', look: { accent: '#6941c6', font: 'rounded', density: 'comfortable', corners: 'round', scheme: 'light' } },
  { id: 'night', name: 'Night', look: { accent: '#4f46e5', font: 'system', density: 'comfortable', corners: 'soft', scheme: 'dark' } },
];

/** The preset a look is, value for value (the accent in either case); null when it is none of them. */
export function presetOf(look: PageLook | undefined): LookPreset | null {
  const same = (preset: LookPreset) => PRESET_KEYS.every((key) => (key === 'accent' ? look?.accent?.toLowerCase() === preset.look.accent : look?.[key] === preset.look[key]));
  return LOOK_PRESETS.find(same) ?? null;
}
