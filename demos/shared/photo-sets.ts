import type { FileValue, Page, Values } from '@fieldia/core';
import listingPhotoSet from '../../examples/pages/listing-photo-set.page.json';
import agentListings from '../../examples/pages/agent-listings.page.json';
import clinicBeforeAfter from '../../examples/pages/clinic-before-after.page.json';

/**
 * Photo sets (`"widget": "photos"`): an agent's listings, each with its photos in the order a buyer sees them — the
 * first the cover, which the agent's gallery and map show — and a clinic's treatment photos before and after, one of
 * them taken sideways to be turned upright. The photos are drawn here as the page opens, as stored files (a `data:`
 * link, as the memory store gives one), so a crop reads them as it reads any stored photo. Sample data.
 */
export const photoSetPages: Record<string, Page> = {
  'listing-photo-set': listingPhotoSet as Page,
  'agent-listings': agentListings as Page,
  'clinic-before-after': clinicBeforeAfter as Page,
};

/** A picture drawn, kept as a stored JPEG: its name, size and a `data:` link. */
function drawn(name: string, width: number, height: number, draw: (c: CanvasRenderingContext2D) => void): FileValue {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const c = canvas.getContext('2d');
  if (c) draw(c);
  const url = canvas.toDataURL('image/jpeg', 0.8);
  return { name, type: 'image/jpeg', size: Math.round(((url.length - url.indexOf(',') - 1) * 3) / 4), url };
}

/** A room as a phone photographs it, at 960 × 720: its walls, floor, window and light, its furniture, and its name. */
function room(name: string, hue: number): FileValue {
  return drawn(`${name}.jpg`, 960, 720, (c) => {
    const [w, h] = [960, 720];
    const wall = c.createLinearGradient(0, 0, w, h);
    wall.addColorStop(0, `hsl(${hue} 30% 86%)`);
    wall.addColorStop(1, `hsl(${(hue + 20) % 360} 25% 62%)`);
    c.fillStyle = wall;
    c.fillRect(0, 0, w, h);
    c.fillStyle = `hsl(${(hue + 30) % 360} 35% 38%)`;
    c.fillRect(0, h * 0.7, w, h * 0.3);
    const sky = c.createLinearGradient(0, h * 0.15, 0, h * 0.55);
    sky.addColorStop(0, 'hsl(205 75% 72%)');
    sky.addColorStop(1, 'hsl(195 60% 88%)');
    c.fillStyle = sky;
    c.fillRect(w * 0.55, h * 0.15, w * 0.32, h * 0.4);
    c.fillStyle = 'hsl(200 45% 40%)';
    c.fillRect(w * 0.55, h * 0.47, w * 0.32, h * 0.08);
    c.strokeStyle = 'hsl(30 20% 96%)';
    c.lineWidth = 8;
    c.strokeRect(w * 0.55, h * 0.15, w * 0.32, h * 0.4);
    c.fillStyle = `hsl(${(hue + 180) % 360} 30% 45%)`;
    c.fillRect(w * 0.08, h * 0.52, w * 0.36, h * 0.2);
    c.fillStyle = 'rgba(255, 244, 214, 0.28)';
    c.beginPath();
    c.moveTo(w * 0.55, h * 0.7);
    c.lineTo(w * 0.87, h * 0.7);
    c.lineTo(w * 0.98, h);
    c.lineTo(w * 0.42, h);
    c.fill();
    c.fillStyle = 'rgba(15, 20, 25, 0.75)';
    c.font = `600 ${Math.round(h / 12)}px system-ui, sans-serif`;
    c.fillText(name, w * 0.12, h * 0.3);
  });
}

/**
 * A face as a clinic photographs it for a treatment's record, drawn plainly: from the front or a side, on the clinic's
 * grey ground, its angle written at its foot. `sideways`: taken with the phone on its side, so it stands turned a
 * quarter, to be turned upright.
 */
function face(name: string, angle: 'front' | 'left' | 'right', sideways = false): FileValue {
  const [w, h] = sideways ? [1200, 900] : [900, 1200];
  return drawn(`${name}.jpg`, w, h, (c) => {
    if (sideways) {
      // The phone on its side: the picture drawn a quarter turned back.
      c.translate(0, h);
      c.rotate(-Math.PI / 2);
    }
    const [pw, ph] = [900, 1200];
    const ground = c.createLinearGradient(0, 0, 0, ph);
    ground.addColorStop(0, 'hsl(210 12% 82%)');
    ground.addColorStop(1, 'hsl(210 10% 68%)');
    c.fillStyle = ground;
    c.fillRect(0, 0, pw, ph);
    const turn = angle === 'front' ? 0 : angle === 'left' ? -1 : 1;
    const cx = pw / 2 + turn * 40;
    // Shoulders and neck.
    c.fillStyle = 'hsl(200 25% 32%)';
    c.beginPath();
    c.ellipse(pw / 2, ph * 1.02, pw * 0.48, ph * 0.22, 0, Math.PI, 0);
    c.fill();
    c.fillStyle = 'hsl(25 45% 66%)';
    c.fillRect(cx - 70, ph * 0.55, 140, ph * 0.2);
    // The face, the hair over it.
    c.beginPath();
    c.ellipse(cx, ph * 0.42, angle === 'front' ? 190 : 160, 250, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'hsl(20 35% 22%)';
    c.beginPath();
    c.ellipse(cx - turn * 30, ph * 0.3, 205, 150, 0, Math.PI, 0);
    c.fill();
    // Eyes, brows and mouth: both seen from the front, the near ones from a side.
    c.fillStyle = 'hsl(20 30% 20%)';
    const eyes = angle === 'front' ? [-70, 70] : [turn * 70];
    for (const dx of eyes) {
      c.beginPath();
      c.ellipse(cx + dx, ph * 0.41, 22, 12, 0, 0, Math.PI * 2);
      c.fill();
      c.fillRect(cx + dx - 40, ph * 0.37, 80, 10);
    }
    c.strokeStyle = 'hsl(355 40% 42%)';
    c.lineWidth = 10;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(cx + turn * 50 - 55, ph * 0.53);
    c.quadraticCurveTo(cx + turn * 50, ph * 0.555, cx + turn * 50 + 55, ph * 0.53);
    c.stroke();
    c.fillStyle = 'rgba(15, 20, 25, 0.78)';
    c.font = '600 64px system-ui, sans-serif';
    c.fillText(name, 48, ph - 56);
  });
}

/** Where each listing stands on the map: its district's middle, a little off. */
const PLACES: Record<string, [number, number]> = { zamalek: [30.0626, 31.2197], maadi: [29.9602, 31.2569], new_cairo: [30.0301, 31.4659], sheikh_zayed: [30.0444, 30.9765] };

/** The agent's listings and the clinic's treatment photos, by model: drawn once, as the page that shows them opens. */
export function photoSetRecords(): Record<string, Record<string, Values>> {
  const listing = (name: string, offer: string, price: number, district: string, bedrooms: number, photos: FileValue[]): Values => ({
    name,
    offer,
    price,
    district,
    bedrooms,
    photos,
    lat: PLACES[district][0],
    lng: PLACES[district][1],
  });
  return {
    'agent.listing': {
      1: listing('Garden flat with a view of the Nile', 'sale', 9800000, 'zamalek', 3, [
        { ...room('Living room', 30), caption: 'Light all day from the river side' },
        room('Kitchen', 140),
        room('Master bedroom', 260),
        { ...room('Balcony view', 200), caption: 'The Nile from the balcony' },
        room('Bathroom', 180),
      ]),
      2: listing('Family villa with a pool', 'sale', 24500000, 'new_cairo', 5, [room('Pool', 190), room('Garden', 110), room('Living room', 40)]),
      3: listing('Studio near the metro', 'rent', 14000, 'maadi', 1, [room('Studio', 320), room('Kitchenette', 150)]),
      4: listing('Townhouse by the park', 'sale', 12750000, 'sheikh_zayed', 4, [room('Front garden', 95), room('Dining room', 15), room('Roof terrace', 220)]),
    },
    'clinic.photos': {
      1: {
        patient: 'Mona Adel',
        treatment: 'filler',
        visit_on: '2026-10-14',
        before: [{ ...face('Front', 'front'), caption: 'Front' }, { ...face('Left side', 'left'), caption: 'Left side' }, { ...face('Right side', 'right', true), caption: 'Right side' }],
        after: [],
      },
    },
  };
}
