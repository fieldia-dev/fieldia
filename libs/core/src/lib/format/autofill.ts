/**
 * What a box is filled in with by the browser — its autocomplete purpose,
 * from the WHATWG HTML standard's list ("Autofilling form controls: the
 * autocomplete attribute") — and the keyboard a phone shows for it.
 *
 * A field placed on a page may name its purpose (`autocomplete`): one of the
 * names below, after which `section-…` and `shipping` or `billing` may come
 * first, `home`, `work`, `mobile`, `fax` or `pager` before a phone, an email
 * or an `impp`, and `webauthn` last — "shipping postal-code", "work email" —
 * or `off`, so the browser offers nothing. An address in parts names each
 * part's own purpose, so its field gives only the group: "shipping",
 * "section-home billing", or `off`. Written in small letters.
 */
import { autofillGroupProblem } from './autofill-group';
export { INPUT_MODES, type InputMode } from './autofill-group';

/** The purposes a box may name, but a phone's, an email's and an instant messenger's (`AUTOFILL_CONTACT`). */
export const AUTOFILL_NAMES = [
  'name', 'honorific-prefix', 'given-name', 'additional-name', 'family-name', 'honorific-suffix', 'nickname',
  'username', 'new-password', 'current-password', 'one-time-code', 'organization-title', 'organization',
  'street-address', 'address-line1', 'address-line2', 'address-line3', 'address-level4', 'address-level3',
  'address-level2', 'address-level1', 'country', 'country-name', 'postal-code',
  'cc-name', 'cc-given-name', 'cc-additional-name', 'cc-family-name', 'cc-number', 'cc-exp', 'cc-exp-month',
  'cc-exp-year', 'cc-csc', 'cc-type', 'transaction-currency', 'transaction-amount',
  'language', 'bday', 'bday-day', 'bday-month', 'bday-year', 'sex', 'url', 'photo',
] as const;

/** The purposes that may say whose they are (`home`, `work`, `mobile`, `fax`, `pager` before them). */
export const AUTOFILL_CONTACT = ['tel', 'tel-country-code', 'tel-national', 'tel-area-code', 'tel-local', 'tel-local-prefix', 'tel-local-suffix', 'tel-extension', 'email', 'impp'] as const;

const GROUP = '(?:section-\\S*(?: +(?:shipping|billing))?|shipping|billing)';
const PURPOSE = `(?:${AUTOFILL_NAMES.join('|')}|(?:(?:home|work|mobile|fax|pager) +)?(?:${AUTOFILL_CONTACT.join('|')}))`;

/** A purpose as a page may write it: `on`, `off`, a group alone (an address's), or a purpose with its group first and `webauthn` last. */
export const AUTOFILL = new RegExp(`^(?:on|off|${GROUP}|(?:${GROUP} +)?${PURPOSE}(?: +webauthn)?)$`);

/**
 * Why a field placed on a page cannot name this purpose, or null when it can: one the standard does not list, a group
 * with no purpose on a box, a purpose on an address in parts (`parts`), which names each part's own.
 */
export function autofillProblem(value: string, parts = false): string | null {
  if (!AUTOFILL.test(value)) {
    return `"${value}" is no purpose a browser fills in: use one of the HTML standard's, in small letters, such as "email", "given-name", "shipping postal-code" or "off"`;
  }
  return autofillGroupProblem(value, parts);
}

/** The purpose itself, its group and whose it is left out: "shipping work tel" is "tel"; empty for `on`, `off` and a group alone. */
export function autofillPurpose(value: string): string {
  const words = value.split(/ +/).filter((word) => word !== 'webauthn');
  const last = words[words.length - 1] ?? '';
  return (AUTOFILL_NAMES as readonly string[]).includes(last) || (AUTOFILL_CONTACT as readonly string[]).includes(last) ? last : '';
}
