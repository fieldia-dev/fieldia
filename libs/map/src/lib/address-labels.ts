import type { Locale } from '@fieldia/core';
import { MAP_LABELS, type MapLabels } from './labels';

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

export const ADDRESS_LABELS: Record<Locale, Omit<AddressLabels, SaidAfterAPick>> = {
  en: { suggested: 'Suggestions: {n}', addressKind: 'Address search', settingPlace: 'Place goes into', settingParts: 'Parts go into', settingCountry: 'Addresses in', anywhere: 'Any country' },
  ar: { suggested: 'الاقتراحات: {n}', addressKind: 'بحث عن عنوان', settingPlace: 'يُكتب المكان في', settingParts: 'تُكتب أجزاؤه في', settingCountry: 'العناوين في', anywhere: 'أي بلد' },
  fr: { suggested: 'Suggestions : {n}', addressKind: 'Recherche d’adresse', settingPlace: 'Le lieu va dans', settingParts: 'Ses parties vont dans', settingCountry: 'Pays des adresses', anywhere: 'Tous les pays' },
  de: { suggested: 'Vorschläge: {n}', addressKind: 'Adresssuche', settingPlace: 'Ort kommt in', settingParts: 'Teile kommen in', settingCountry: 'Land der Adressen', anywhere: 'Alle Länder' },
  // Turkish, Persian, Urdu and Spanish — UNREVIEWED: machine-assisted, not yet reviewed by a native speaker.
  tr: { suggested: 'Öneriler: {n}', addressKind: 'Adres arama', settingPlace: 'Konumun yazılacağı alan', settingParts: 'Adres parçalarının yazılacağı alan', settingCountry: 'Adreslerin ülkesi', anywhere: 'Tüm ülkeler' },
  fa: { suggested: 'پیشنهادها: {n}', addressKind: 'جستجوی نشانی', settingPlace: 'محل ثبت مکان', settingParts: 'محل ثبت اجزای نشانی', settingCountry: 'کشور نشانی‌ها', anywhere: 'هر کشوری' },
  ur: { suggested: 'تجاویز: {n}', addressKind: 'پتے کی تلاش', settingPlace: 'جگہ کے لیے فیلڈ', settingParts: 'اجزا کے لیے فیلڈ', settingCountry: 'پتوں کا ملک', anywhere: 'کوئی بھی ملک' },
  es: { suggested: 'Sugerencias: {n}', addressKind: 'Búsqueda de dirección', settingPlace: 'El lugar va en', settingParts: 'Las partes van en', settingCountry: 'Direcciones en', anywhere: 'Cualquier país' },
};

/** An address field's words for a page's language, the maps' own with them, and the app's own over both. */
export function addressLabels(locale: Locale | undefined, own?: Partial<MapLabels & AddressLabels>): MapLabels & Omit<AddressLabels, SaidAfterAPick> & Partial<AddressLabels> {
  return { ...MAP_LABELS[locale ?? 'en'], ...ADDRESS_LABELS[locale ?? 'en'], ...own };
}
