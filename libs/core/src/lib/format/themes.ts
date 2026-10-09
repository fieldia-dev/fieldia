// No zod here: the runtime, and so the one-tag script, takes the themes' names from this module alone.

/**
 * Themes in the style of design systems people already know, so a form looks
 * at home in the app round it: Material, Fluent, Apple's, Bootstrap, shadcn,
 * Ant Design, Odoo's and Google Forms'. Each is a set of the form's tokens
 * over a skin (Odoo's over `underline`, the rest over `outlined`), light and
 * dark; the page's own accent, font, room and corners still win over it.
 */
export const THEMES = ['material', 'fluent', 'apple', 'bootstrap', 'shadcn', 'ant', 'odoo', 'google-forms'] as const;
export type Theme = (typeof THEMES)[number];
