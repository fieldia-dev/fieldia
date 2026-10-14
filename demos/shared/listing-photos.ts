import { uploadTo, type MemoryDataSourceOptions, type Values } from '@fieldia/core';

/**
 * A home's listing whose photos are stored as they are picked (the
 * listing-photos page): the record the demo opens, the store its photos go
 * to — the memory source's, slowed to a phone's upload on mobile data, the
 * balcony's photo failing on its first try so Retry shows — and the bar over
 * the page that adds ten photos as a phone takes them. Sample data.
 */

/** The listing the demo opens: a flat with no photos yet. */
export const LISTING: Values = {
  name: 'Garden flat with a view of the Nile',
  offer: 'sale',
  price: 9800000,
  district: 'zamalek',
  bedrooms: 3,
  photos: [],
  floor_plan: null,
};

/** The store: 150 KB a second, as a phone sends on mobile data; the balcony's photo fails once. */
export const LISTING_STORAGE: NonNullable<MemoryDataSourceOptions['storage']> = {
  bytesPerSecond: 150000,
  fails: (file, attempt) => /^Balcony/.test(file.name) && attempt === 1,
};

/**
 * `?store=http`: the photos go to a real endpoint instead — POST /api/listing-files,
 * through uploadTo — for the browser tests, which answer it and slow the network
 * as a phone's is. The demo itself has no server to send to.
 */
export const listingUpload = (params: URLSearchParams) => (params.get('store') === 'http' ? uploadTo({ url: '/api/listing-files' }) : null);

const ROOMS = ['Living room', 'Kitchen', 'Master bedroom', 'Balcony view', 'Second bedroom', 'Bathroom', 'Entrance hall', 'Dining room', 'Study', 'Roof terrace'];

/** Grain, drawn once: what makes a drawn photo as heavy as a camera's. */
let grain: HTMLCanvasElement | null = null;
function grainTile(): HTMLCanvasElement {
  if (grain) return grain;
  grain = document.createElement('canvas');
  grain.width = grain.height = 256;
  const context = grain.getContext('2d') as CanvasRenderingContext2D;
  const pixels = context.createImageData(256, 256);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const v = Math.random() * 255;
    pixels.data.set([v, v, v, 34], i);
  }
  context.putImageData(pixels, 0, 0);
  return grain;
}

/** A room as a phone photographs it — 4032 × 3024, a JPEG at 0.92 — drawn: its walls, floor, window and light, and its name. */
export async function roomPhoto(name: string, n: number, width = 4032, height = 3024): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const c = canvas.getContext('2d') as CanvasRenderingContext2D;
  const hue = (n * 37) % 360;
  const wall = c.createLinearGradient(0, 0, width, height);
  wall.addColorStop(0, `hsl(${hue} 30% 86%)`);
  wall.addColorStop(1, `hsl(${(hue + 20) % 360} 25% 62%)`);
  c.fillStyle = wall;
  c.fillRect(0, 0, width, height);
  // The floor, and the window with the sky and the river beyond.
  c.fillStyle = `hsl(${(hue + 30) % 360} 35% 38%)`;
  c.fillRect(0, height * 0.7, width, height * 0.3);
  const sky = c.createLinearGradient(0, height * 0.15, 0, height * 0.55);
  sky.addColorStop(0, 'hsl(205 75% 72%)');
  sky.addColorStop(1, 'hsl(195 60% 88%)');
  c.fillStyle = sky;
  c.fillRect(width * 0.55, height * 0.15, width * 0.32, height * 0.4);
  c.fillStyle = 'hsl(200 45% 40%)';
  c.fillRect(width * 0.55, height * 0.47, width * 0.32, height * 0.08);
  c.strokeStyle = 'hsl(30 20% 96%)';
  c.lineWidth = width / 120;
  c.strokeRect(width * 0.55, height * 0.15, width * 0.32, height * 0.4);
  // A sofa or a table, and the light from the window on the floor.
  c.fillStyle = `hsl(${(hue + 180) % 360} 30% 45%)`;
  c.fillRect(width * 0.08, height * 0.52, width * 0.36, height * 0.2);
  c.fillStyle = 'rgba(255, 244, 214, 0.28)';
  c.beginPath();
  c.moveTo(width * 0.55, height * 0.7);
  c.lineTo(width * 0.87, height * 0.7);
  c.lineTo(width * 0.98, height);
  c.lineTo(width * 0.42, height);
  c.fill();
  c.fillStyle = c.createPattern(grainTile(), 'repeat') as CanvasPattern;
  c.fillRect(0, 0, width, height);
  c.fillStyle = 'rgba(15, 20, 25, 0.75)';
  c.font = `600 ${Math.round(height / 9)}px system-ui, sans-serif`;
  c.fillText(name, width * 0.06, height * 0.2);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((made) => (made ? resolve(made) : reject(new Error('no JPEG'))), 'image/jpeg', 0.92));
  return new File([blob], `${name}.jpg`, { type: 'image/jpeg', lastModified: Date.UTC(2026, 9, 13, 9, n) });
}

/**
 * The bar over the listing: "Add 10 phone photos" takes ten photos of the
 * flat's rooms, as a phone takes them, and hands them to the Photos field as
 * a person picking them does. Pick your own as well, from the field.
 */
export function photosBar(): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'demo-bar demo-photos-bar';
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'fd-button fd-button-primary';
  add.textContent = 'Add 10 phone photos';
  const said = document.createElement('span');
  said.className = 'demo-photos-said';
  said.setAttribute('role', 'status');
  said.textContent = 'Each is 12 megapixels, as a phone takes it, made smaller to 1600 pixels before it goes to a store that takes 150 KB a second. The balcony’s photo fails once.';
  bar.append(add, said);
  add.addEventListener('click', async () => {
    // Taken one after another, as a phone would; the button stays, and says it is busy.
    if (add.getAttribute('aria-busy') === 'true') return;
    add.setAttribute('aria-busy', 'true');
    const was = add.textContent;
    const photos: File[] = [];
    for (const [n, room] of ROOMS.entries()) {
      add.textContent = `Taking photo ${n + 1} of ${ROOMS.length}…`;
      photos.push(await roomPhoto(room, n));
    }
    const input = document.querySelector<HTMLInputElement>('[data-node="f-photos"] input[type=file]');
    if (input) {
      const picked = new DataTransfer();
      for (const photo of photos) picked.items.add(photo);
      input.files = picked.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    add.textContent = was;
    add.removeAttribute('aria-busy');
  });
  return bar;
}
