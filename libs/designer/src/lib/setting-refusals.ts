import type { DesignerWords } from './designer-words';

/**
 * The page's own number settings the designer has boxes for, by where they
 * sit in a page: their names in the designer's words, and the whole numbers
 * the page's format takes for them. A refusal by the format for one of them
 * is said in those words — "Minutes is a whole number from 1 to 120" — never
 * as its path into the page and the format's own English.
 */
const SETTINGS: { at: RegExp; name: (w: DesignerWords) => string; min: number; max: number }[] = [
  { at: /(^|\.)live\.staleAfter$/, name: (w) => w.mapPart.staleAfter, min: 5, max: 86400 },
  { at: /(^|\.)reachable\.minutes$/, name: (w) => w.mapPart.minutes, min: 1, max: 120 },
  { at: /(^|\.)band\.labelWidth$/, name: (w) => w.head.labelWidth, min: 48, max: 320 },
  { at: /(^|\.)labelWidth$/, name: (w) => w.panel.labelWidth, min: 60, max: 320 },
  { at: /(^|\.)gap$/, name: (w) => w.workText.gap, min: 0, max: 48 },
  { at: /(^|\.)fitZoom$/, name: (w) => w.list.fitZoom, min: 1, max: 22 },
  { at: /(^|\.)pageSize$/, name: (w) => w.list.rowsOnPage, min: 1, max: 500 },
];

/** The format's refusal at `path` in the setting's own words, or null for a path that is no such setting. */
export function settingRefusal(path: string, words: DesignerWords): string | null {
  const setting = SETTINGS.find((s) => s.at.test(path));
  return setting ? words.inputs.settingRange(setting.name(words), setting.min, setting.max) : null;
}
