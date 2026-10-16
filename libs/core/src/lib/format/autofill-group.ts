/**
 * What the quick check of a page (`checkPage`) keeps of a box's autocomplete purpose (autofill.ts): a box names what
 * it holds, an address in parts only whose it is. Whether a purpose is one the HTML standard lists is the format's own
 * check (`validatePage`), as every other shape is: a browser passes over one it does not know.
 */

/** The keyboards a phone shows for a box: words, digits alone, digits with a decimal mark, a phone's, an email's, a web address's, a search's. */
export const INPUT_MODES = ['text', 'numeric', 'decimal', 'tel', 'email', 'url', 'search'] as const;
export type InputMode = (typeof INPUT_MODES)[number];

/** Whose it is, with no purpose — `shipping`, `section-home billing` — which only an address in parts takes. */
export const AUTOFILL_GROUP = /^(?:section-\S*(?: +(?:shipping|billing))?|shipping|billing)$/;

/** Why a field placed on a page cannot name this purpose — a box with whose it is alone, an address in parts (`parts`) with a purpose — or null. */
export function autofillGroupProblem(value: string, parts: boolean): string | null {
  const group = AUTOFILL_GROUP.test(value);
  if (parts && !group && value !== 'on' && value !== 'off') return 'an address in parts names each part’s own purpose: give only whose address it is, such as "shipping", or "off"';
  if (!parts && group) return `"${value}" says whose it is, not what the box holds: add its purpose, such as "${value} postal-code"`;
  return null;
}
