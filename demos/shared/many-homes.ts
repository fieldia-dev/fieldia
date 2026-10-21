import type { FileValue, Page, Values } from '@fieldia/core';
import manyHomesPage from '../../examples/pages/map-many-homes.page.json';
import mapHome from '../../examples/pages/map-home.page.json';
import { seeded } from './homes';

/**
 * Twenty thousand homes across Egypt, for the map whose data source gathers its records where they crowd
 * (`clusters`): Cairo's districts and new cities, Alexandria, the north coast, the Red Sea and the towns of the
 * Delta and the Nile, each as many as a portal lists there, sixty flats in one tower in the New Capital, and a
 * hundred not placed yet. Made from a seed, so every run, test and screenshot sees the same ones; made only for the
 * pages that show them. Sample data.
 */

/** Where the homes are: each place's middle, how far its homes spread in degrees, and its share of them. */
const PLACES: Record<string, { label: string; lat: number; lng: number; spread: number; share: number; resort?: boolean; perMetre: number }> = {
  new_cairo: { label: 'New Cairo', lat: 30.0074, lng: 31.4913, spread: 0.05, share: 16, perMetre: 60_000 },
  sheikh_zayed: { label: 'Sheikh Zayed', lat: 30.0396, lng: 30.9928, spread: 0.03, share: 8, perMetre: 55_000 },
  october: { label: '6th of October', lat: 29.9381, lng: 30.9135, spread: 0.04, share: 8, perMetre: 32_000 },
  new_capital: { label: 'New Capital', lat: 30.0193, lng: 31.76, spread: 0.05, share: 6, perMetre: 45_000 },
  madinaty: { label: 'Madinaty', lat: 30.107, lng: 31.639, spread: 0.02, share: 4, perMetre: 48_000 },
  shorouk: { label: 'El Shorouk', lat: 30.145, lng: 31.612, spread: 0.02, share: 3, perMetre: 35_000 },
  maadi: { label: 'Maadi', lat: 29.9602, lng: 31.2569, spread: 0.015, share: 5, perMetre: 50_000 },
  heliopolis: { label: 'Heliopolis', lat: 30.0911, lng: 31.3225, spread: 0.02, share: 5, perMetre: 42_000 },
  nasr_city: { label: 'Nasr City', lat: 30.0566, lng: 31.3401, spread: 0.02, share: 5, perMetre: 34_000 },
  zamalek: { label: 'Zamalek', lat: 30.0626, lng: 31.2197, spread: 0.006, share: 2, perMetre: 95_000 },
  mohandessin: { label: 'Mohandessin', lat: 30.0566, lng: 31.2006, spread: 0.008, share: 3, perMetre: 52_000 },
  dokki: { label: 'Dokki', lat: 30.0384, lng: 31.212, spread: 0.007, share: 2, perMetre: 48_000 },
  alexandria: { label: 'Alexandria', lat: 31.215, lng: 29.955, spread: 0.035, share: 7, perMetre: 30_000 },
  agami: { label: 'Agami', lat: 31.095, lng: 29.765, spread: 0.02, share: 2, perMetre: 26_000, resort: true },
  north_coast: { label: 'North Coast', lat: 30.86, lng: 28.95, spread: 0.12, share: 5, perMetre: 80_000, resort: true },
  ain_sokhna: { label: 'Ain Sokhna', lat: 29.6, lng: 32.32, spread: 0.04, share: 3, perMetre: 40_000, resort: true },
  hurghada: { label: 'Hurghada', lat: 27.2579, lng: 33.8116, spread: 0.035, share: 3, perMetre: 28_000, resort: true },
  el_gouna: { label: 'El Gouna', lat: 27.394, lng: 33.678, spread: 0.012, share: 2, perMetre: 90_000, resort: true },
  sharm: { label: 'Sharm El Sheikh', lat: 27.9158, lng: 34.33, spread: 0.03, share: 2, perMetre: 30_000, resort: true },
  mansoura: { label: 'Mansoura', lat: 31.0409, lng: 31.3785, spread: 0.02, share: 2, perMetre: 22_000 },
  tanta: { label: 'Tanta', lat: 30.7865, lng: 31.0004, spread: 0.015, share: 1, perMetre: 18_000 },
  port_said: { label: 'Port Said', lat: 31.2653, lng: 32.3019, spread: 0.015, share: 1, perMetre: 20_000 },
  ismailia: { label: 'Ismailia', lat: 30.5965, lng: 32.2715, spread: 0.02, share: 1, perMetre: 19_000 },
  luxor: { label: 'Luxor', lat: 25.6872, lng: 32.6396, spread: 0.02, share: 1, perMetre: 16_000 },
  aswan: { label: 'Aswan', lat: 24.0889, lng: 32.8998, spread: 0.015, share: 1, perMetre: 15_000 },
};

/** How many homes, and how many of them stand in one tower and have no place yet. */
export const MANY_HOMES = 20_000;
const TOWER = 60;
const UNPLACED_EVERY = 200;
/** The tower: sixty flats on one spot, in the New Capital's business district. */
const TOWER_AT = { lat: 30.0155, lng: 31.7125 };

const KINDS = ['flat', 'flat', 'flat', 'duplex', 'penthouse', 'villa'] as const;
const RESORT_KINDS = ['chalet', 'chalet', 'flat', 'villa'] as const;
const KIND_WORDS: Record<string, string> = { flat: 'flat', duplex: 'duplex', penthouse: 'penthouse', villa: 'villa', chalet: 'chalet' };

/** A home's picture: one of the drawings beside the demos (demos/samples/homes), by its kind. */
const picture = (kind: string, n: number): FileValue => ({ name: `${kind}.svg`, type: 'image/svg+xml', size: 1200, url: `../samples/homes/${kind}-${1 + (n % 3)}.svg` });

/**
 * The homes, by id from 1: each place's share of them, spread round its middle, closer in towards it. Each links to
 * its own page in the demo's look and language (`search`, the demo's address), as a site keeps one for each listing.
 */
export function manyHomes(search = ''): Record<number, Values> {
  const to = new URLSearchParams(search);
  to.set('page', 'map-many-home');
  to.delete('record');
  const link = `?${to}&record=`;
  const random = seeded(20_000);
  const places = Object.entries(PLACES);
  const shares = places.reduce((sum, [, place]) => sum + place.share, 0);
  const pick = () => {
    let at = random() * shares;
    for (const [key, place] of places) if ((at -= place.share) < 0) return [key, place] as const;
    return places[0];
  };
  const homes: Record<number, Values> = {};
  for (let i = 0; i < MANY_HOMES; i++) {
    const tower = i >= MANY_HOMES - TOWER;
    const [district, place] = tower ? (['new_capital', PLACES['new_capital']] as const) : pick();
    const kinds = place.resort ? RESORT_KINDS : KINDS;
    const kind = tower ? 'flat' : kinds[Math.floor(random() * kinds.length)];
    const rent = random() < (place.resort ? 0.5 : 0.35);
    const big = kind === 'villa';
    const bedrooms = big ? 4 + Math.floor(random() * 3) : 1 + Math.floor(random() * 4);
    const area = Math.round((big ? 280 : 55) + bedrooms * (big ? 45 : 32) + random() * 60);
    const pounds = rent ? Math.round((area * place.perMetre) / 250 / 500) * 500 : Math.round((area * place.perMetre * (0.85 + random() * 0.3)) / 50_000) * 50_000;
    const dollars = ['zamalek', 'new_cairo', 'north_coast', 'el_gouna'].includes(district) && (big || pounds > 20_000_000);
    const price = dollars ? Math.round(pounds / 50 / (rent ? 50 : 5_000)) * (rent ? 50 : 5_000) : pounds;
    // Closer in towards the middle, as a city's homes are: two draws added.
    const off = () => (random() + random() - 1) * place.spread;
    // One in every two hundred not placed yet, none of them in the tower.
    const placed = (i + 1) % UNPLACED_EVERY !== UNPLACED_EVERY / 2;
    const [lat, lng] = tower ? [TOWER_AT.lat, TOWER_AT.lng] : [place.lat + off(), place.lng + off() * 1.2];
    const month = 1 + (i % 12);
    homes[i + 1] = {
      name: tower ? `${bedrooms}-bedroom flat, floor ${2 + (i % TOWER)}, Capital Tower` : `${bedrooms}-bedroom ${KIND_WORDS[kind]} in ${place.label}`,
      kind,
      offer: rent ? 'rent' : 'sale',
      price,
      currency: dollars ? 'USD' : 'EGP',
      bedrooms,
      area_m2: area,
      district,
      lat: placed ? Math.round(lat * 1e6) / 1e6 : null,
      lng: placed ? Math.round(lng * 1e6) / 1e6 : null,
      photo: picture(kind, i),
      link: `${link}${i + 1}`,
      listed_on: `${month > 10 ? 2025 : 2026}-${String(month).padStart(2, '0')}-${String(1 + ((i * 7) % 27)).padStart(2, '0')}`,
    };
  }
  return homes;
}

/** The list of them, and the page each opens: a home's own, its type and place among these homes'. */
export const manyHomesPages: Record<string, Page> = {
  'map-many-homes': manyHomesPage as Page,
  'map-many-home': {
    ...(mapHome as Page),
    id: 'map-many-home',
    data: { kind: 'record', model: 'home.egypt' },
    fields: { ...(mapHome as Page).fields, kind: (manyHomesPage as Page).fields['kind'], district: (manyHomesPage as Page).fields['district'] },
  } as Page,
};
