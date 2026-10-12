import type { Values } from '@fieldia/core';

/**
 * Districts of central Cairo for the delivery-zone demos: NOT their real
 * borders, which come from a city's own data or OpenStreetMap, but rough
 * shapes drawn here, each the land nearer its middle than any other's, inside
 * a box round the city. Each has a delivery fee from the Downtown kitchen,
 * more the farther it is. The orders of the week are made up around them,
 * each in the district it falls in.
 */

const MIDDLES: { code: string; name: string; lat: number; lng: number; weight: number }[] = [
  { code: 'downtown', name: 'Downtown', lat: 30.0478, lng: 31.2422, weight: 5 },
  { code: 'zamalek', name: 'Zamalek', lat: 30.0626, lng: 31.2197, weight: 4 },
  { code: 'garden_city', name: 'Garden City', lat: 30.0366, lng: 31.2316, weight: 2 },
  { code: 'dokki', name: 'Dokki', lat: 30.0384, lng: 31.212, weight: 4 },
  { code: 'mohandessin', name: 'Mohandessin', lat: 30.0566, lng: 31.2006, weight: 5 },
  { code: 'imbaba', name: 'Imbaba', lat: 30.0805, lng: 31.2075, weight: 1 },
  { code: 'shubra', name: 'Shubra', lat: 30.0905, lng: 31.2445, weight: 2 },
  { code: 'abbasia', name: 'Abbasia', lat: 30.0705, lng: 31.2825, weight: 2 },
  { code: 'heliopolis', name: 'Heliopolis', lat: 30.0911, lng: 31.3225, weight: 4 },
  { code: 'nasr_city', name: 'Nasr City', lat: 30.0566, lng: 31.3401, weight: 3 },
  { code: 'mokattam', name: 'Mokattam', lat: 30.0205, lng: 31.3005, weight: 1 },
  { code: 'old_cairo', name: 'Old Cairo', lat: 30.0065, lng: 31.2305, weight: 1 },
  { code: 'giza', name: 'Giza', lat: 30.0135, lng: 31.2045, weight: 2 },
  { code: 'maadi', name: 'Maadi', lat: 29.9602, lng: 31.2569, weight: 3 },
];
const BOX = { south: 29.935, north: 30.115, west: 31.165, east: 31.375 };
const KITCHEN = { lat: 30.0443, lng: 31.2353 };

/** The districts as a select's options, by their code. */
export const DISTRICT_OPTIONS = MIDDLES.map(({ code, name }) => ({ value: code, label: name }));

// Distances on a flat map, a degree of longitude shorter than one of latitude at Cairo's.
const SQUASH = Math.cos((30.03 * Math.PI) / 180);
type Point = [number, number];
const flat = (lng: number, lat: number): Point => [lng * SQUASH, lat];

/** What of a polygon lies on `a`'s side of the line halfway between `a` and `b`: one pass of Sutherland–Hodgman. */
function nearerTo(polygon: Point[], a: Point, b: Point): Point[] {
  const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const normal: Point = [b[0] - a[0], b[1] - a[1]];
  const side = (p: Point) => (p[0] - mid[0]) * normal[0] + (p[1] - mid[1]) * normal[1];
  const out: Point[] = [];
  polygon.forEach((p, i) => {
    const q = polygon[(i + 1) % polygon.length];
    const [sp, sq] = [side(p), side(q)];
    if (sp <= 0) out.push(p);
    if (sp <= 0 !== sq <= 0) {
      const t = sp / (sp - sq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  });
  return out;
}

const round = (n: number) => Math.round(n * 1e5) / 1e5;
const metres = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => Math.hypot((a.lng - b.lng) * SQUASH, a.lat - b.lat) * 111_320;

/** The districts' borders, as an app hands a map its regions: a GeoJSON FeatureCollection, each with its code, name and fee. */
export function cairoDistricts() {
  const box: Point[] = [flat(BOX.west, BOX.south), flat(BOX.east, BOX.south), flat(BOX.east, BOX.north), flat(BOX.west, BOX.north)];
  return {
    type: 'FeatureCollection' as const,
    features: MIDDLES.map((district) => {
      const own = flat(district.lng, district.lat);
      const cell = MIDDLES.filter((other) => other !== district).reduce((polygon, other) => nearerTo(polygon, own, flat(other.lng, other.lat)), box);
      const ring = cell.map(([x, y]) => [round(x / SQUASH), round(y)]);
      ring.push(ring[0]);
      // EGP 15 at the kitchen's door, 5 more for each two kilometres.
      const fee = 15 + 5 * Math.round(metres(district, KITCHEN) / 2000);
      return { type: 'Feature' as const, properties: { code: district.code, name: district.name, fee }, geometry: { type: 'Polygon' as const, coordinates: [ring] } };
    }),
  };
}

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const CUSTOMERS = ['Mona Adel', 'Karim Samir', 'Salma Fathy', 'Omar Hany', 'Nour El-Din', 'Laila Mostafa', 'Youssef Ali', 'Hana Ibrahim', 'Tarek Nabil', 'Dina Magdy', 'Ahmed Zaki', 'Rana Sherif'];

/** The week's orders: 180, more where more people order, each in the district it falls in. */
export function sampleWeekOrders(): Record<number, Values> {
  const random = seeded(2026);
  const pool = MIDDLES.flatMap((district) => Array.from({ length: district.weight }, () => district));
  const orders: Record<number, Values> = {};
  for (let i = 1; i <= 180; i++) {
    const near = pool[Math.floor(random() * pool.length)];
    const lat = Math.min(BOX.north, Math.max(BOX.south, near.lat + (random() + random() - 1) * 0.012));
    const lng = Math.min(BOX.east, Math.max(BOX.west, near.lng + (random() + random() - 1) * 0.014));
    // The district it falls in: the one whose middle is nearest, as the borders are drawn.
    const district = MIDDLES.reduce((best, d) => (metres(d, { lat, lng }) < metres(best, { lat, lng }) ? d : best));
    orders[i] = {
      name: `#${1040 + i}`,
      customer: CUSTOMERS[Math.floor(random() * CUSTOMERS.length)],
      district: district.code,
      place: { type: 'Point', coordinates: [round(lng), round(lat)] },
      total: Math.round(120 + random() * random() * 1600),
      status: (['delivered', 'delivered', 'delivered', 'on_the_way', 'new'] as const)[Math.floor(random() * 5)],
    };
  }
  return orders;
}

/** The Downtown kitchen's evening: its place, the drop-off zone round tonight's next door, and its courier at the kitchen. */
export function sampleKitchen(): Values {
  return {
    name: 'Downtown kitchen',
    kitchen: { type: 'Point', coordinates: [KITCHEN.lng, KITCHEN.lat] },
    offer_district: 'zamalek',
    drop_zone: {
      type: 'Feature',
      properties: { shape: 'polygon' },
      geometry: { type: 'Polygon', coordinates: [[[31.2165, 30.0598], [31.2262, 30.0581], [31.2268, 30.0652], [31.2172, 30.0668], [31.2165, 30.0598]]] },
    },
    courier_lat: KITCHEN.lat,
    courier_lng: KITCHEN.lng,
    courier_heading: 0,
    state: 'on_the_way',
    arriving: false,
  };
}

/**
 * A made-up reachable area for the demos, which use OpenStreetMap: a ring
 * round the place, wider for more minutes, uneven as roads make it. Azure Maps
 * and Mapbox work it out along the roads.
 */
export async function madeUpReach({ at, minutes }: { at: { lat: number; lng: number }; minutes: number }) {
  const reach = minutes * 300;
  const ring = Array.from({ length: 36 }, (_, i) => {
    const angle = (i / 36) * Math.PI * 2;
    const r = reach * (0.78 + 0.16 * Math.sin(angle * 3 + 1) + 0.08 * Math.cos(angle * 5));
    return { lat: round(at.lat + (Math.cos(angle) * r) / 111_320), lng: round(at.lng + (Math.sin(angle) * r) / (111_320 * SQUASH)) };
  });
  return { rings: [ring] };
}
