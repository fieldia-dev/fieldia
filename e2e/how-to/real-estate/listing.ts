import type { Locator } from '@playwright/test';
import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';
import { part } from './support';

/** A choice's options as a person reads them beside their boxes. */
const offered = (choice: Locator) => choice.locator('label.fd-choice');
/** A day as the page writes it: 26 Apr 2028. */
const dayWords = (day: Date) => day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export const replay: DemoReplay = {
  steps: [
    {
      says: 'Pick Villa: Garden, Private pool and Garage are offered, Balcony and Lift are not',
      async run({ page, press, see }) {
        const type = part(page, 'f-unit-type');
        const features = part(page, 'f-features');
        await press(type.locator('label.fd-choice', { hasText: 'Villa' }));
        await see(offered(features)).toHaveText(['Garden', 'Private pool', 'Garage', '24-hour security']);
        await press(features.locator('label.fd-choice', { hasText: 'Garden' }));
        await see(features.getByRole('checkbox', { name: 'Garden' })).toBeChecked();
        await press(type.locator('label.fd-choice', { hasText: 'Apartment' }));
        await see(offered(features)).toHaveText(['Balcony', 'Roof terrace', 'Lift', '24-hour security']);
        await see(features.getByRole('checkbox', { name: 'Garden' })).toHaveCount(0);
        await see(features.locator(':scope > .fd-warning')).toHaveText('Garden is no longer offered, so it was taken out');
      },
    },
    {
      says: 'Type an area of 123 and a price of 6m, as agents write it (or 6,000,000)',
      async run({ page, press, keys, see }) {
        const area = page.getByRole('textbox', { name: 'Area (m²)' });
        const price = page.getByRole('textbox', { name: 'Price', exact: true });
        await press(area);
        await page.keyboard.type('123', { delay: 15 });
        await press(price);
        await page.keyboard.type('6m', { delay: 15 });
        await see(part(page, 'f-price').locator('.fd-shorthand-said')).toHaveText('6m is 6,000,000');
        await keys('Tab');
        await see(price).toHaveValue('6,000,000');
        const perMetre = page.getByRole('textbox', { name: 'Price per m²' });
        await see(perMetre).toHaveValue('48,780.49');
        await see(part(page, 'f-price-per-meter')).toContainText('E£');
      },
    },
    {
      says: 'Pick a district: its average per m² shows “…” while the app’s server is asked',
      async run({ page, see }) {
        await page.getByRole('combobox', { name: 'District' }).selectOption({ label: 'New Cairo' });
        const average = part(page, 'f-district-price');
        // While it is asked: an ellipsis in its place, the comparison waiting with it.
        await see(average.locator('.fd-value-waits')).toBeVisible();
        await see(average.locator('.fd-value-waits')).toContainText('…');
        await see(part(page, 'f-against-district')).toHaveAttribute('data-asking', '');
        await see(page.getByRole('textbox', { name: 'The district’s average per m²' })).toHaveValue('52,000.00');
        await see(average).not.toHaveAttribute('data-asking', '');
        // 48,780.49 a metre against the district's 52,000: 6% under.
        await see(page.getByRole('textbox', { name: 'Against the district (%)' })).toHaveValue(/^[−-]6$/);
      },
    },
    {
      says: 'Type 18 in Handover in (months): Handed over by is a year and a half after today',
      async run({ page, type, keys, see }) {
        const listed = new Date(`${await page.getByRole('textbox', { name: 'Listed on' }).inputValue()} UTC`);
        expect(Number.isNaN(listed.getTime()), 'Listed on holds today').toBe(false);
        await type(page.getByRole('textbox', { name: 'Handover in (months)' }), '18');
        await keys('Tab');
        // A year and a half on, on the same day of the month — the month's last where it has fewer days, as addMonths
        // counts (31 October on 18 months is 30 April): a day written as the overflowing Date.UTC made it ran out on the
        // 29th to the 31st of every month whose month 18 on is shorter.
        const last = new Date(Date.UTC(listed.getUTCFullYear(), listed.getUTCMonth() + 19, 0)).getUTCDate();
        const handover = new Date(Date.UTC(listed.getUTCFullYear(), listed.getUTCMonth() + 18, Math.min(listed.getUTCDate(), last)));
        await see(page.getByRole('textbox', { name: 'Handed over by' })).toHaveValue(dayWords(handover));
        await type(page.getByRole('textbox', { name: 'Built on' }), '01/06/2015');
        await keys('Tab');
        const age = listed.getUTCFullYear() - 2015 - (listed.getUTCMonth() < 5 ? 1 : 0);
        await see(page.getByRole('textbox', { name: 'The building’s age (years)' })).toHaveValue(String(age));
      },
    },
    {
      says: 'Save while the district’s average is still asked: the save waits for it',
      async run({ page, press, type, see, demo }) {
        await type(page.getByRole('textbox', { name: 'Listing', exact: true }), 'Maadi flat by the club');
        await page.getByRole('combobox', { name: 'District' }).selectOption({ label: 'Maadi' });
        const average = part(page, 'f-district-price');
        await see(average.locator('.fd-value-waits')).toBeVisible();
        await press(page.getByRole('button', { name: 'Save', exact: true }));
        await see(page.getByRole('textbox', { name: 'The district’s average per m²' })).toHaveValue('61,000.00');
        await see(page.getByRole('textbox', { name: 'Against the district (%)' })).toHaveValue(/^[−-]20$/);
        await see(page.locator('.fd-status').first()).toHaveText('Saved');
        // What was kept: the answer waited for, never an empty average.
        await expect.poll(async () => Object.values(await demo<Record<string, { name: string; district_price: number | null; against_district: number | null }>>('dataSource.records.listing') ?? {}).map((listing) => [listing.name, listing.district_price, listing.against_district])).toContainEqual(['Maadi flat by the club', 61000, -20]);
      },
    },
  ],
};
