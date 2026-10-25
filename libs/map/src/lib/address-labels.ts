import type { Locale } from '@fieldia/core';
import { inChunks, MAP_LABELS, type MapLabels } from './labels';

/**
 * The words of an address field that suggests addresses
 * (`char.address-search`), and of its kind in the designer: in a module of
 * their own, so a page that shows forms (and no designer) loads them with
 * the field's suggestions, not before.
 */
export interface AddressLabels {
  /** Said to screen readers as suggestions come: `{n}` how many. */
  suggested: string;
  /**
   * Shown under the box when the address picked is not found on the map, and
   * no place is written for it; when it is placed only near it (`precise:
   * false`); when its place could not be asked for, the map not answering (a
   * line dropped). Their words come with the suggestions.
   */
  notPlaced: string;
  placedNear: string;
  locateFailed: string;
  addressKind: string;
  /** The designer's settings: the field a picked address's place goes into, the field its parts go into, the country it keeps to. */
  settingPlace: string;
  settingParts: string;
  settingCountry: string;
  anywhere: string;
}

/** The words said under the box, which come with the suggestions' code (address-suggest.ts). */
type SaidAfterAPick = 'notPlaced' | 'placedNear' | 'locateFailed';

/** Every language but English in chunks of their own (locales/, `inChunks`): Turkish, Persian, Urdu and Spanish UNREVIEWED, machine-assisted. */
export const ADDRESS_LABELS = /* @__PURE__ */ inChunks<Omit<AddressLabels, SaidAfterAPick>>({
  en: { suggested: 'Suggestions: {n}', addressKind: 'Address search', settingPlace: 'Place goes into', settingParts: 'Parts go into', settingCountry: 'Addresses in', anywhere: 'Any country' },
}, 'address');

/** An address field's words for a page's language, the maps' own with them, and the app's own over both. */
export function addressLabels(locale: Locale | undefined, own?: Partial<MapLabels & AddressLabels>): MapLabels & Omit<AddressLabels, SaidAfterAPick> & Partial<AddressLabels> {
  return { ...MAP_LABELS[locale ?? 'en'], ...(ADDRESS_LABELS[locale ?? 'en'] ?? ADDRESS_LABELS.en), ...own };
}
