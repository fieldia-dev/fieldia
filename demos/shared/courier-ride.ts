import type { Form } from '@fieldia/core';

/**
 * The courier on the way to the door, in the order demo: their place sent
 * every two seconds, as a courier's own app sends it, along the road from
 * the kitchen near Tahrir Square to the door in Zamalek. The map does the
 * rest: the pin glides, the route behind fades, the minutes left count down.
 */

/** The road taken, longitude first: OpenStreetMap's route by car, every third point. */
const ROAD: [number, number][] = [
  [31.23531, 30.04432], [31.23543, 30.04413], [31.2358, 30.04404], [31.23611, 30.04423], [31.23616, 30.04445], [31.23603, 30.04469], [31.23592, 30.04506],
  [31.23537, 30.0456], [31.2351, 30.04596], [31.2349, 30.04646], [31.23467, 30.04714], [31.23465, 30.04752], [31.23464, 30.04866], [31.2345, 30.0494],
  [31.23448, 30.0499], [31.23443, 30.0503], [31.23431, 30.05043], [31.23419, 30.05045], [31.23391, 30.05044], [31.23337, 30.05025], [31.23264, 30.05008],
  [31.23171, 30.04999], [31.23144, 30.05005], [31.23123, 30.05021], [31.23095, 30.05123], [31.23008, 30.05334], [31.22977, 30.05402], [31.22894, 30.056],
  [31.22876, 30.05656], [31.22857, 30.05742], [31.22862, 30.05779], [31.22884, 30.05795], [31.22908, 30.05791], [31.22921, 30.05776], [31.22921, 30.05755],
  [31.22901, 30.05739], [31.22874, 30.05735], [31.22837, 30.05735], [31.22793, 30.05747], [31.2259, 30.05824], [31.22546, 30.05845], [31.22452, 30.05887],
  [31.22437, 30.05896], [31.22303, 30.05968], [31.22212, 30.06012], [31.22274, 30.06122], [31.21971, 30.06259],
];

export const KITCHEN = { lat: 30.0443, lng: 31.2353 };
export const DOOR = { lat: 30.06259, lng: 31.21971 };

/** Which way it faces, in degrees from north, going from one point to the next. */
function heading([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]): number {
  const y = Math.sin(((lng2 - lng1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x = Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) - Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(((lng2 - lng1) * Math.PI) / 180);
  return Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
}

/** Sends the courier's place along the road, a point every `every` milliseconds, from `start`; returns what stops it. */
export function rideCourier(form: Form, every = 2000, start = 6): () => void {
  let at = start;
  const send = () => {
    const [lng, lat] = ROAD[at];
    const next = ROAD[Math.min(at + 1, ROAD.length - 1)];
    form.setValues({ courier_lat: lat, courier_lng: lng, courier_heading: heading(ROAD[at], next), ...(at === ROAD.length - 1 ? { state: 'delivered' } : {}) });
    at++;
    if (at >= ROAD.length) clearInterval(timer);
  };
  const timer = setInterval(send, every);
  send();
  return () => clearInterval(timer);
}
