import type { FileValue, Values } from '@fieldia/core';

/**
 * Homes for sale and to rent across Cairo, and the couriers out delivering
 * there: the records the map demos (map-homes, map-couriers) show on a list's
 * map. Made from a seed, so every run, test and screenshot sees the same
 * ones. Sample data.
 */

/** A seeded random number in [0, 1): mulberry32. */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cairo's districts: where each is, and how far its homes spread, in degrees. */
const DISTRICTS: Record<string, { lat: number; lng: number; spread: number }> = {
  zamalek: { lat: 30.0626, lng: 31.2197, spread: 0.006 },
  garden_city: { lat: 30.0366, lng: 31.2316, spread: 0.004 },
  dokki: { lat: 30.0384, lng: 31.212, spread: 0.007 },
  mohandessin: { lat: 30.0566, lng: 31.2006, spread: 0.008 },
  maadi: { lat: 29.9602, lng: 31.2569, spread: 0.012 },
  heliopolis: { lat: 30.0911, lng: 31.3225, spread: 0.014 },
  nasr_city: { lat: 30.0566, lng: 31.3401, spread: 0.014 },
  new_cairo: { lat: 30.0074, lng: 31.4913, spread: 0.03 },
  sheikh_zayed: { lat: 30.0396, lng: 30.9928, spread: 0.02 },
  october: { lat: 29.9381, lng: 30.9135, spread: 0.025 },
};
export const DISTRICT_LABELS: Record<string, string> = {
  zamalek: 'Zamalek',
  garden_city: 'Garden City',
  dokki: 'Dokki',
  mohandessin: 'Mohandessin',
  maadi: 'Maadi',
  heliopolis: 'Heliopolis',
  nasr_city: 'Nasr City',
  new_cairo: 'New Cairo',
  sheikh_zayed: 'Sheikh Zayed',
  october: '6th of October',
};

const KINDS = ['flat', 'flat', 'flat', 'duplex', 'penthouse', 'villa'] as const;
const KIND_WORDS: Record<(typeof KINDS)[number], string> = { flat: 'flat', duplex: 'duplex', penthouse: 'penthouse', villa: 'villa' };

/** A home's picture, drawn: its walls, roof and windows in colours of its own. */
function picture(kind: string, hue: number): FileValue {
  const wall = `hsl(${hue} 32% 82%)`;
  const roof = `hsl(${(hue + 190) % 360} 30% 38%)`;
  const sky = `hsl(${(hue + 160) % 360} 60% 88%)`;
  const glass = `hsl(${(hue + 200) % 360} 45% 46%)`;
  const villa = `<path d="M70 170V96l90-52 90 52v74z" fill="${wall}"/><path d="M56 102l104-64 104 64" fill="none" stroke="${roof}" stroke-width="12" stroke-linejoin="round"/><rect x="142" y="122" width="36" height="48" fill="${roof}"/><rect x="92" y="110" width="30" height="26" fill="${glass}"/><rect x="198" y="110" width="30" height="26" fill="${glass}"/>`;
  const windows = Array.from({ length: 12 }, (_, i) => `<rect x="${112 + (i % 3) * 34}" y="${42 + Math.floor(i / 3) * 30}" width="20" height="18" fill="${glass}"/>`).join('');
  const block = `<rect x="98" y="28" width="124" height="142" fill="${wall}"/><rect x="92" y="22" width="136" height="10" fill="${roof}"/>${windows}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="${sky}"/><rect y="164" width="320" height="16" fill="hsl(100 25% 62%)"/>${kind === 'villa' ? villa : block}</svg>`;
  return { name: `${kind}.svg`, type: 'image/svg+xml', size: svg.length, url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` };
}

/** What a home has besides its rooms, as a buyer filters by it: the records its amenities link to. */
export const AMENITIES: Record<number, string> = { 1: 'Garden', 2: 'Pool', 3: 'Parking', 4: 'Nile view', 5: 'Security' };
const NILE: ReadonlySet<string> = new Set(['zamalek', 'garden_city', 'maadi']);
/** A home's amenities, from what it is and where — never from the seed, so every other value stays as it was. */
function amenitiesOf(i: number, kind: string, district: string) {
  const ids = [
    ...(kind === 'villa' || i % 5 === 0 ? [1] : []),
    ...(kind === 'villa' && i % 2 === 0 ? [2] : []),
    ...(kind !== 'flat' || i % 3 !== 0 ? [3] : []),
    ...(NILE.has(district) && i % 2 === 1 ? [4] : []),
    ...(i % 4 === 0 ? [5] : []),
  ];
  return ids.map((id) => ({ id, label: AMENITIES[id] }));
}

/**
 * Sixty-four homes: most with their place, two without one yet. Priced in
 * pounds, but for villas and the dearest homes in Zamalek and New Cairo,
 * whose owners ask in dollars, as some do. Each with its amenities.
 */
export function sampleHomes(): Record<number, Values> {
  const random = seeded(2026);
  const names = Object.keys(DISTRICTS);
  const homes: Record<number, Values> = {};
  for (let i = 0; i < 64; i++) {
    const district = names[Math.floor(random() * names.length)];
    const { lat, lng, spread } = DISTRICTS[district];
    const kind = KINDS[Math.floor(random() * KINDS.length)];
    const rent = random() < 0.35;
    const bedrooms = kind === 'villa' ? 4 + Math.floor(random() * 3) : 1 + Math.floor(random() * 4);
    const area = Math.round((kind === 'villa' ? 280 : 55) + bedrooms * (kind === 'villa' ? 45 : 32) + random() * 60);
    const perMetre = { zamalek: 95_000, garden_city: 80_000, new_cairo: 60_000, sheikh_zayed: 55_000 }[district] ?? 42_000;
    const pounds = rent ? Math.round((area * perMetre) / 250 / 500) * 500 : Math.round((area * perMetre * (0.85 + random() * 0.3)) / 50_000) * 50_000;
    const dollars = (district === 'zamalek' || district === 'new_cairo') && (kind === 'villa' || pounds > 20_000_000);
    // About fifty pounds to the dollar, rounded as an owner rounds a price.
    const price = dollars ? Math.round(pounds / 50 / (rent ? 50 : 5_000)) * (rent ? 50 : 5_000) : pounds;
    const placed = i !== 17 && i !== 41;
    homes[i + 1] = {
      name: `${bedrooms}-bedroom ${KIND_WORDS[kind]} in ${DISTRICT_LABELS[district]}`,
      kind,
      offer: rent ? 'rent' : 'sale',
      price,
      currency: dollars ? 'USD' : 'EGP',
      bedrooms,
      area_m2: area,
      district,
      lat: placed ? Math.round((lat + (random() - 0.5) * spread * 2) * 1e6) / 1e6 : null,
      lng: placed ? Math.round((lng + (random() - 0.5) * spread * 2) * 1e6) / 1e6 : null,
      photo: picture(kind, Math.floor(random() * 360)),
      listed_on: `2026-${String(1 + (i % 9)).padStart(2, '0')}-${String(1 + ((i * 7) % 27)).padStart(2, '0')}`,
      amenities: amenitiesOf(i, kind, district),
    };
  }
  return homes;
}

/** A face, drawn: a courier's picture, in colours of their own. */
function face(hue: number, initials: string): FileValue {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="hsl(${hue} 45% 78%)"/><circle cx="20" cy="15" r="8" fill="hsl(${hue} 30% 36%)"/><rect x="8" y="26" width="24" height="14" rx="7" fill="hsl(${hue} 30% 36%)"/></svg>`;
  return { name: `${initials}.svg`, type: 'image/svg+xml', size: svg.length, url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` };
}

const COURIERS = ['Ahmed Fathy', 'Mona Adel', 'Karim Samir', 'Youssef Nabil', 'Salma Hany', 'Omar Tarek', 'Nour Hassan', 'Hassan Ali', 'Laila Mostafa', 'Tamer Said', 'Mariam Ezz', 'Ziad Kamal', 'Hana Wael', 'Mahmoud Reda', 'Dina Sherif', 'Amr Gamal', 'Rana Fouad', 'Sherif Emad'];

/** An order on its way from a kitchen near Tahrir Square to a door in Zamalek, its courier a few streets along. */
export function sampleOrder(): Values {
  return {
    name: 'Order 2048',
    state: 'on_the_way',
    restaurant: 'Koshary Tahrir',
    kitchen_lat: 30.0443,
    kitchen_lng: 31.2353,
    door: { type: 'Point', coordinates: [31.21971, 30.06259] },
    address: '14 Shagaret El Dor, Zamalek',
    courier: 'Mona Adel',
    courier_photo: face(28, 'MA'),
    courier_lat: 30.04506,
    courier_lng: 31.23592,
    courier_heading: 330,
    eta_seconds: null,
    distance_m: null,
    route_line: null,
  };
}

/** A van's round from Tahrir Square through five stops in Zamalek and Dokki, two of them done: far enough apart that their pins stand clear of each other with the whole round in view. */
export function sampleRound(): Values {
  const stop = (sequence: number, name: string, address: string, lng: number, lat: number, done: boolean) => ({
    key: `s${sequence}`,
    id: sequence,
    values: { sequence, name, address, place: { type: 'Point', coordinates: [lng, lat] }, done },
  });
  return {
    name: 'Round 14 · Zamalek and Dokki',
    driver: 'Karim Samir',
    van_lat: 30.0443,
    van_lng: 31.2353,
    seconds: null,
    distance_m: null,
    stop_ids: [
      stop(1, 'Nile Traders', '12 Abu El Feda, Zamalek', 31.2218, 30.0659, true),
      stop(2, 'Zamalek Studio', '4 Hassan Sabry, Zamalek', 31.2165, 30.0606, true),
      stop(3, 'Bayt Interiors', '26 July Street, Zamalek', 31.2238, 30.0577, false),
      stop(4, 'Delta Foods', '33 Mossadak, Dokki', 31.2091, 30.0389, false),
      stop(5, 'Amira Clinics', '7 Tahrir Street, Dokki', 31.2205, 30.0388, false),
    ],
  };
}

/** Eighteen couriers out across the city, each on a car, a scooter or a bike, facing the way they go. */
export function sampleCouriers(): Record<number, Values> {
  const random = seeded(77);
  const names = Object.keys(DISTRICTS);
  const couriers: Record<number, Values> = {};
  COURIERS.forEach((name, i) => {
    const { lat, lng, spread } = DISTRICTS[names[i % names.length]];
    const vehicle = (['scooter', 'scooter', 'car', 'bike'] as const)[Math.floor(random() * 4)];
    const status = (['free', 'busy', 'busy', 'off'] as const)[Math.floor(random() * 4)];
    couriers[i + 1] = {
      name,
      vehicle,
      status,
      heading: Math.round(random() * 360),
      orders_today: Math.floor(random() * 14),
      phone: `+20 10 ${String(1000 + Math.floor(random() * 9000))} ${String(1000 + Math.floor(random() * 9000))}`,
      face: face(Math.floor(random() * 360), name.split(' ').map((w) => w[0]).join('')),
      place: { type: 'Point', coordinates: [Math.round((lng + (random() - 0.5) * spread * 3) * 1e6) / 1e6, Math.round((lat + (random() - 0.5) * spread * 3) * 1e6) / 1e6] },
    };
  });
  return couriers;
}
