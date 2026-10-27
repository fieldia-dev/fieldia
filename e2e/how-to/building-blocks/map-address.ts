import { stubMaps, type PhotonPlace } from '../../map-support';
import type { DemoReplay } from '../hand';
import { node } from './support';

/** An address's suggestions as Photon gives them (e2e/map-address.spec.ts): two streets in Cairo, one in Mecca. */
const STREETS: PhotonPlace[] = [
  { lat: 30.0487, lon: 31.2391, type: 'house', street: 'Tahrir Street', housenumber: '12', district: 'Downtown', city: 'Cairo', state: 'Cairo Governorate', postcode: '11511', country: 'Egypt', countrycode: 'EG' },
  { lat: 21.4225, lon: 39.8262, type: 'street', name: 'Tahrir Street', city: 'Mecca', state: 'Makkah Region', country: 'Saudi Arabia', countrycode: 'SA' },
  { lat: 30.0626, lon: 31.2197, type: 'street', name: '26 July Street', district: 'Zamalek', city: 'Cairo', state: 'Cairo Governorate', country: 'Egypt', countrycode: 'EG' },
];

/** The map-address demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Type a street in Egypt, such as Tahrir: the suggestions come as the typing pauses.',
      async run({ page, type, see }) {
        await stubMaps(page, { search: STREETS });
        const field = node(page, 'address');
        const box = field.getByRole('combobox');
        await see(box).toHaveAttribute('aria-expanded', 'false');
        await type(box, 'tahr');
        // No Enter: the list comes as the typing pauses, the street in Mecca left out.
        const options = field.getByRole('option');
        await see(options).toHaveCount(2);
        await see(options.nth(0)).toContainText('Tahrir Street 12');
        await see(options.nth(0)).toContainText('Downtown, Cairo, Egypt');
        await see(options.nth(1)).toContainText('26 July Street');
        await see(box).toHaveAttribute('aria-expanded', 'true');
      },
    },
    {
      says: 'Press the down arrow to move through them and Enter to pick one',
      async run({ page, phone, press, keys, see }) {
        const field = node(page, 'address');
        const box = field.getByRole('combobox');
        const options = field.getByRole('option');
        if (phone) {
          // A phone's keyboard has no arrow keys: the suggestion is picked by a tap, as a finger picks one.
          await press(options.nth(0));
        } else {
          await keys('ArrowDown');
          await see(options.nth(0)).toHaveAttribute('aria-selected', 'true');
          await keys('ArrowDown');
          await see(options.nth(1)).toHaveAttribute('aria-selected', 'true');
          await keys('ArrowUp');
          await see(options.nth(0)).toHaveAttribute('aria-selected', 'true');
          await keys('Enter');
        }
        await see(field.getByRole('listbox')).toBeHidden();
        await see(box).toHaveValue('Tahrir Street 12, Downtown, Cairo, Egypt');
        // The address in its parts, and the place on its map.
        const parts = node(page, 'parts');
        await see(parts.locator('[data-part="street"]')).toHaveValue('Tahrir Street 12');
        await see(parts.locator('[data-part="city"]')).toHaveValue('Cairo');
        await see(parts.locator('[data-part="region"]')).toHaveValue('Cairo Governorate');
        await see(parts.locator('[data-part="postcode"]')).toHaveValue('11511');
        await see(node(page, 'spot').locator('.fd-map-pin')).toBeVisible();
      },
    },
    {
      says: 'Type an address of your own and press Escape: the list closes and your words stay.',
      notOnPhone: 'a phone’s keyboard has no Escape key',
      async run({ page, type, keys, see }) {
        const field = node(page, 'address');
        const box = field.getByRole('combobox');
        await type(box, '7 Tahrir Street, flat 3', { clear: true });
        await see(field.getByRole('option')).toHaveCount(2);
        await keys('Escape');
        await see(field.getByRole('listbox')).toBeHidden();
        await see(box).toHaveAttribute('aria-expanded', 'false');
        await see(box).toHaveValue('7 Tahrir Street, flat 3');
        await see(box).toBeFocused();
      },
    },
  ],
};
