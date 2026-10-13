import type { Locale } from '@fieldia/core';
import type { AddressParts } from './address-parts';
import type { MapProvider, PlaceFound } from './providers';

/**
 * Scores an address search against what people mean
 * (fixtures/azure-corpus-cases.json): the row a person would pick, as an
 * address field lists them; the city and region it writes; and whether the
 * place it writes is where the place is: a street within 1.5 km, a district
 * within 4 km, a city within 15 km, or said to be only near
 * (`precise: false`), or not written at all, when it is not.
 */

export type Kind = 'street' | 'district' | 'city';
type At = [number, number];

export interface CorpusCase {
  id: string;
  text: string;
  locale: Locale;
  near?: string;
  countries: string[];
  pick: { label: string | string[]; in?: string };
  kind: Kind;
  truth: { city: string; region: string; street?: string[]; at: At | At[] };
}

/** Where an address field's `near` puts the search, by name. */
export const NEAR: Record<string, { lat: number; lng: number }> = {
  cairo: { lat: 30.0444, lng: 31.2357 },
  alexandria: { lat: 31.2001, lng: 29.9187 },
  riyadh: { lat: 24.7136, lng: 46.6753 },
  jeddah: { lat: 21.4858, lng: 39.1925 },
  dubai: { lat: 25.2048, lng: 55.2708 },
  abuDhabi: { lat: 24.4539, lng: 54.3773 },
  sharjah: { lat: 25.3463, lng: 55.4209 },
  alAin: { lat: 24.2075, lng: 55.7447 },
  amman: { lat: 31.9539, lng: 35.9106 },
};

/** The names a city or region goes by, in English and Arabic, as a person or a provider may write it. */
export const NAMES: Record<string, string[]> = {
  cairo: ['Cairo', 'Cairo Governorate', 'Al Qahirah', 'القاهرة', 'محافظة القاهرة'],
  giza: ['Giza', 'Al Jizah', 'Giza Governorate', 'Gizeh', 'الجيزة', 'محافظة الجيزة'],
  newCairo: ['New Cairo', 'New Cairo City', 'Al Qahirah al Jadidah', 'القاهرة الجديدة', 'مدينة القاهرة الجديدة'],
  sheikhZayed: ['Sheikh Zayed', 'Sheikh Zayed City', 'El Sheikh Zayed', 'El Sheikh Zayed City', 'الشيخ زايد', 'مدينة الشيخ زايد'],
  october: ['6th of October', '6th of October City', '6 October', '6th October', 'Sixth of October', 'October', 'السادس من أكتوبر', '6 أكتوبر', 'مدينة 6 أكتوبر', 'مدينة السادس من أكتوبر'],
  alexandria: ['Alexandria', 'Al Iskandariyah', 'Alexandria Governorate', 'الإسكندرية', 'الاسكندرية', 'محافظة الإسكندرية'],
  riyadh: ['Riyadh', 'Ar Riyad', 'Riyadh Province', 'Riyadh Region', 'الرياض', 'منطقة الرياض'],
  jeddah: ['Jeddah', 'Jiddah', 'Jedda', 'جدة'],
  mecca: ['Mecca', 'Makkah', 'Makkah Al Mukarramah', 'مكة', 'مكة المكرمة'],
  makkah: ['Makkah', 'Mecca', 'Makkah Province', 'Makkah Region', 'Makkah Al Mukarramah', 'مكة', 'مكة المكرمة', 'منطقة مكة المكرمة'],
  dammam: ['Dammam', 'Ad Dammam', 'الدمام'],
  khobar: ['Al Khobar', 'Al Khubar', 'Khobar', 'الخبر'],
  eastern: ['Eastern', 'Eastern Province', 'Eastern Region', 'Ash Sharqiyah', 'الشرقية', 'المنطقة الشرقية'],
  dubai: ['Dubai', 'Dubai Emirate', 'دبي', 'إمارة دبي'],
  abuDhabi: ['Abu Dhabi', 'Abu Dhabi Emirate', 'Abu Zabi', 'أبو ظبي', 'أبوظبي', 'إمارة أبو ظبي', 'إمارة أبوظبي'],
  sharjah: ['Sharjah', 'Sharjah Emirate', 'Ash Shariqah', 'الشارقة', 'إمارة الشارقة'],
  alAin: ['Al Ain', 'Al Ayn', 'العين'],
  amman: ['Amman', 'Amman Governorate', 'Capital Governorate', 'عمان', 'عمّان', 'محافظة العاصمة', 'العاصمة'],
};

/** How near counts as there, by kind. */
export const WITHIN_KM: Record<Kind, number> = { street: 1.5, district: 4, city: 15 };

/** Words as compared here: without accents, vowel marks and tatweel, Arabic's alif, ta marbuta and ya each one letter, digits as numbers. */
export const plain = (words: unknown) =>
  String(words ?? '')
    .normalize('NFD')
    .replace(/[\p{M}ـ]/gu, '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const RADIUS = 6371;
const rad = (d: number) => (d * Math.PI) / 180;
function km([lat1, lng1]: At, [lat2, lng2]: At) {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * RADIUS * Math.asin(Math.sqrt(a));
}
/** How far a point is from a place: a point, or the nearest stretch of a road's line. */
export function kmFrom(point: At, at: At | At[]): number {
  if (typeof at[0] === 'number') return km(point, at as At);
  const line = at as At[];
  if (line.length === 1) return km(point, line[0]);
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const [a, b] = [line[i - 1], line[i]];
    // On a plane around the point: a few km of road is flat enough.
    const k = Math.cos(rad(point[0]));
    const [ax, ay, bx, by, px, py] = [a[1] * k, a[0], b[1] * k, b[0], point[1] * k, point[0]];
    const len = (bx - ax) ** 2 + (by - ay) ** 2;
    const t = len ? Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / len)) : 0;
    best = Math.min(best, km(point, [ay + t * (by - ay), (ax + t * (bx - ax)) / k]));
  }
  return best;
}

export interface Located {
  lat: number;
  lng: number;
  address?: string;
  parts?: AddressParts;
  precise?: false;
}

export interface CaseScore {
  id: string;
  /** A row the person would pick is listed. */
  listed: boolean;
  /** The row says the city it is in (its name, or the line under it). */
  rowCity: boolean;
  city: boolean;
  region: boolean;
  /** The street as it is written, where the case says it, never with a house number made up. */
  street?: boolean;
  /** Where it is, within the kind's distance. */
  placed: boolean;
  /** Placed, or said to be only near, or not written: never a wrong place said to be right. */
  honest: boolean;
  /** What was picked and written, to read. */
  row?: string;
  parts?: AddressParts;
  km?: number;
  precise?: false;
  error?: string;
}

const isName = (key: string, value: unknown) => !!value && (NAMES[key] ?? [key]).some((name) => plain(name) === plain(value));
const names = (key: string, text: string) => (NAMES[key] ?? [key]).some((name) => ` ${plain(text)} `.includes(` ${plain(name)} `));

/** Whether a line names a city or region of the corpus other than these. */
const namesOther = (keys: string[], line: string) => Object.keys(NAMES).some((key) => !keys.includes(key) && names(key, line));

/**
 * The row a person would pick: one with the words they look for, and of
 * those the first whose second line says it is where they mean (`in`, or
 * the city they mean), or that is that city itself, nowhere else; else the
 * first with the words.
 */
export function pickRow(found: PlaceFound[], c: Pick<CorpusCase, 'pick' | 'truth'>): PlaceFound | undefined {
  const { pick, truth } = c;
  const labels = (Array.isArray(pick.label) ? pick.label : [pick.label]).map(plain);
  const matching = found.filter((place) => labels.some((label) => plain(place.label).includes(label)));
  const there = pick.in
    ? (place: PlaceFound) => plain(place.detail).includes(plain(pick.in))
    : (place: PlaceFound) => names(truth.city, place.detail ?? '') || (isName(truth.city, place.label) && !namesOther([truth.city, truth.region], place.detail ?? ''));
  return matching.find(there) ?? matching[0];
}

/** One case: searched as an address field searches (its parts asked for, addresses first), its row picked and located. */
export async function scoreCase(provider: MapProvider, c: CorpusCase): Promise<CaseScore> {
  const found = await provider.search!({ text: c.text, near: c.near ? NEAR[c.near] : undefined, locale: c.locale, countries: c.countries, parts: true, addresses: true });
  const row = pickRow(found, c);
  const none: CaseScore = { id: c.id, listed: false, rowCity: false, city: false, region: false, placed: false, honest: true, ...(c.truth.street ? { street: false } : {}) };
  if (!row) return none;
  let located: Located | null = null;
  let error: string | undefined;
  if (row.lat !== undefined && row.lng !== undefined) located = { lat: row.lat, lng: row.lng };
  else if (row.locate) {
    try {
      located = await row.locate();
    } catch (e) {
      error = (e as Error).message;
    }
  }
  const parts = located?.parts ?? row.parts;
  const distance = located ? kmFrom([located.lat, located.lng], c.truth.at) : undefined;
  const placed = distance !== undefined && distance <= WITHIN_KM[c.kind];
  return {
    id: c.id,
    listed: true,
    rowCity: names(c.truth.city, `${row.label} ${row.detail ?? ''}`),
    city: isName(c.truth.city, parts?.city),
    region: isName(c.truth.region, parts?.region),
    ...(c.truth.street ? { street: c.truth.street.some((name) => plain(name) === plain(parts?.street)) } : {}),
    placed,
    honest: placed || !located || located.precise === false,
    row: [row.label, row.detail].filter(Boolean).join(' | '),
    ...(parts ? { parts } : {}),
    ...(distance !== undefined ? { km: Math.round(distance * 100) / 100 } : {}),
    ...(located?.precise === false ? { precise: false as const } : {}),
    ...(error ? { error } : {}),
  };
}

/** How many cases pass each test, of all. */
export function tally(scores: CaseScore[]) {
  const count = (test: (s: CaseScore) => boolean | undefined) => scores.filter(test).length;
  const streets = scores.filter((s) => s.street !== undefined);
  return {
    cases: scores.length,
    listed: count((s) => s.listed),
    rowCity: count((s) => s.rowCity),
    city: count((s) => s.city),
    region: count((s) => s.region),
    placed: count((s) => s.placed),
    honest: count((s) => s.honest),
    street: `${count((s) => s.street)}/${streets.length}`,
    allRight: count((s) => s.listed && s.rowCity && s.city && s.region && s.placed && s.street !== false),
  };
}
