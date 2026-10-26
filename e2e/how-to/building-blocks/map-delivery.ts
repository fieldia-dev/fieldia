import { expect } from '../../fixtures';
import { mapSettled, stubMaps, type PhotonPlace } from '../../map-support';
import type { DemoReplay } from '../hand';
import { node } from './support';

/** Two places as the map's search finds them (e2e/map-place.spec.ts). */
const TAHRIR: PhotonPlace = { lat: 30.0444, lon: 31.2357, name: 'Tahrir Square', district: 'Downtown', city: 'Cairo', country: 'Egypt' };
const ZAMALEK: PhotonPlace = { lat: 30.0609, lon: 31.2197, name: 'Zamalek', city: 'Cairo', country: 'Egypt' };

/** The map-delivery demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Type an address in the search box and press Enter, then pick a place from the list',
      async run({ page, press, type, keys, see }) {
        // The search's server, a stand-in answering as Photon does (e2e/map-support.ts).
        await stubMaps(page, { search: [TAHRIR, ZAMALEK] });
        const field = node(page, 'deliver_to');
        await see(field.locator('.fd-map-box .leaflet-tile-loaded').first()).toBeVisible();
        await see(field.locator('.fd-map-pin')).toHaveCount(0);
        await type(field.getByRole('combobox', { name: 'Delivery to' }), 'tahrir');
        await keys('Enter');
        const options = field.getByRole('option');
        await see(options).toHaveCount(2);
        await see(options.nth(0)).toContainText('Tahrir Square');
        await press(options.nth(0));
        await see(field.getByRole('listbox')).toBeHidden();
        await see(field.locator('.fd-map-pin')).toBeVisible();
        await see(field.getByRole('textbox', { name: 'Latitude' })).toHaveValue('30.0444');
        await see(field.getByRole('textbox', { name: 'Longitude' })).toHaveValue('31.2357');
        await see(page.getByRole('textbox', { name: 'Address', exact: true })).toHaveValue('Tahrir Square, Downtown, Cairo, Egypt');
      },
    },
    {
      says: 'Press the map anywhere: the pin moves there. Drag it to the door.',
      async run({ page, phone, press, drag, see }) {
        const field = node(page, 'deliver_to');
        const map = field.locator('.fd-map-box');
        const pin = field.locator('.fd-map-pin');
        const latitude = field.getByRole('textbox', { name: 'Latitude' });
        const box = (await map.boundingBox())!;
        const spot = { x: box.width * 0.3, y: box.height * 0.6 };
        await press(map, { position: spot });
        await see(latitude).not.toHaveValue('30.0444');
        // The pin's tip where the map was pressed.
        await expect.poll(async () => {
          const at = (await pin.boundingBox())!;
          return Math.abs(at.x + at.width / 2 - (box.x + spot.x)) <= 3 && Math.abs(at.y + at.height - 1 - (box.y + spot.y)) <= 3;
        }).toBe(true);
        await see(pin).toBeVisible();
        // Dragged by a hand on the pin: a phone's finger drag is one Playwright's WebKit cannot make.
        if (phone) return;
        const pressed = await latitude.inputValue();
        const from = (await pin.boundingBox())!;
        await drag(pin, { x: from.x + from.width / 2 + 90, y: from.y + from.height / 2 + 40 });
        await see(latitude).not.toHaveValue(pressed);
        await expect.poll(async () => {
          const at = (await pin.boundingBox())!;
          return Math.abs(at.x - (from.x + 90)) <= 3 && Math.abs(at.y - (from.y + 40)) <= 3;
        }).toBe(true);
      },
    },
    {
      says: 'Tab to the map and press Enter: the place goes to the cross at its centre.',
      notOnPhone: 'a phone has no Tab, no Enter on a map, no arrow keys and no plus or minus keys',
      async run({ page, press, keys, see }) {
        const field = node(page, 'deliver_to');
        const map = field.locator('.fd-map-box');
        const pin = field.locator('.fd-map-pin');
        await press(field.getByRole('combobox', { name: 'Delivery to' }));
        // Past My location, to the map.
        for (let i = 0; i < 4 && !(await map.evaluate((el) => el === document.activeElement)); i++) await keys('Tab');
        await see(map).toBeFocused();
        await see(map.locator('.fd-map-crosshair')).toBeVisible();
        await keys('Enter');
        const box = (await map.boundingBox())!;
        await expect.poll(async () => {
          const at = (await pin.boundingBox())!;
          return Math.abs(at.x + at.width / 2 - (box.x + box.width / 2)) <= 2 && Math.abs(at.y + at.height - 1 - (box.y + box.height / 2)) <= 2;
        }).toBe(true);
        await see(pin).toBeVisible();
        // The arrow keys move the map: the pin goes with the ground under it.
        const before = (await pin.boundingBox())!;
        await keys('ArrowRight', 'ArrowRight');
        await expect.poll(async () => (await pin.boundingBox())!.x).toBeLessThan(before.x - 20);
        // Plus and minus zoom: the map's images change for the next level, and back.
        const level = () => map.evaluate((el) => {
          const shown = [...el.querySelectorAll<HTMLElement>('.leaflet-tile-container')].filter((one) => one.querySelector('.leaflet-tile-loaded'));
          const top = shown.sort((a, b) => Number(b.style.zIndex || 0) - Number(a.style.zIndex || 0))[0];
          return Number(/\/(\d+)\/\d+\/\d+\.png/.exec(top?.querySelector('.leaflet-tile-loaded')?.getAttribute('src') ?? '')?.[1]);
        });
        const start = await level();
        await keys('+');
        await expect.poll(level).toBe(start + 1);
        // Seen to have zoomed — the map still — as a person sees it before the next key.
        await mapSettled(map);
        await keys('-');
        await expect.poll(level).toBe(start);
        await see(map).toBeFocused();
      },
    },
    {
      says: 'Type a latitude and a longitude under the map: the pin follows.',
      async run({ page, phone, press, type, keys, see }) {
        const field = node(page, 'deliver_to');
        const map = field.locator('.fd-map-box');
        const pin = field.locator('.fd-map-pin');
        await type(field.getByRole('textbox', { name: 'Latitude' }), '30.0609', { clear: true });
        await type(field.getByRole('textbox', { name: 'Longitude' }), '31.2197', { clear: true });
        // Typed, and left: Tab, or a tap away from the box on a phone.
        if (phone) await press(page.getByText('Search for the address, or press the map where the door is.'));
        else await keys('Tab');
        await expect.poll(() => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values['deliver_to'])).toEqual({ type: 'Point', coordinates: [31.2197, 30.0609] });
        // The map came to it: the pin in sight on the map.
        await see(pin).toBeInViewport();
        const [at, box] = [(await pin.boundingBox())!, (await map.boundingBox())!];
        expect(at.x).toBeGreaterThan(box.x);
        expect(at.x + at.width).toBeLessThan(box.x + box.width);
      },
    },
  ],
};
