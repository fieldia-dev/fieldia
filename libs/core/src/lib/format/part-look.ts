/**
 * A look for each kind of part, over the page's own, as SurveyJS and Vueform
 * theme each component: text boxes, choices, groups, buttons and tables, each
 * with the few settings the skins can draw on it. A setting left out is the
 * page's; a kind left out is drawn as the page draws it.
 */

/** Every setting a kind of part may have. Which a kind has is `PART_LOOKS`. */
export interface PartLook {
  /** Its ground, inside its edge: kept light on a light page and dark on a dark one, so the page's words read on it. `#rrggbb`. */
  background?: string;
  /** Its edge: a box's, a card's, a table's lines. `#rrggbb`. */
  border?: string;
  corners?: 'square' | 'soft' | 'round';
  /** Its words, smaller or larger than the page's. */
  textSize?: 'small' | 'large';
  /** Its own accent: a box's edge as it is typed in, what is picked, a button's colour. `#rrggbb`. */
  accent?: string;
}

/** The kinds of part, each with the settings its look can have, in the order a person sets them. */
export const PART_LOOKS = {
  /** Boxes typed in or picked from: text, numbers, dates, dropdowns. */
  inputs: ['background', 'border', 'corners', 'textSize', 'accent'],
  /** Options picked: rings, ticks, a scale's points, Yes and No, pictures. */
  choices: ['accent', 'background', 'border', 'corners', 'textSize'],
  /** Groups drawn as cards or frames: sections, a record's sheet, a repeating group's cards. */
  groups: ['background', 'border', 'corners'],
  /** Buttons: Send, Next, Save, Add another. */
  buttons: ['accent', 'corners', 'textSize'],
  /** Tables of lines and a matrix's grid: their heading row, their lines and their words. */
  tables: ['background', 'border', 'textSize'],
} as const satisfies Record<string, readonly (keyof PartLook)[]>;

export type PartLookKind = keyof typeof PART_LOOKS;

/** The look of each kind of part the page gives one. */
export type PartsLook = { [K in PartLookKind]?: Pick<PartLook, (typeof PART_LOOKS)[K][number]> };
