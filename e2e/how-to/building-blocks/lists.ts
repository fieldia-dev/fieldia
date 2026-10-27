import type { DemoReplay } from '../hand';

/** The lists demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Watch the countries load as the form opens',
      async run({ page, see }) {
        const country = page.locator('[data-field="country"]');
        await see(country).toContainText('Loading choices…');
        await see(country).not.toContainText('Loading choices…');
        await see(page.getByRole('combobox', { name: 'Country' }).getByRole('option')).toHaveText(['', 'Egypt', 'Jordan', 'Saudi Arabia', 'United Arab Emirates']);
      },
    },
    {
      says: 'Pick Egypt: its cities load. Pick Alexandria.',
      async run({ page, press, see }) {
        const city = page.locator('[data-field="city"]');
        // The browser's own list of a select: picked from it as the browser offers it.
        await page.getByRole('combobox', { name: 'Country' }).selectOption({ label: 'Egypt' });
        await see(city).toContainText('Loading choices…');
        await see(city.getByRole('radio')).toHaveCount(4);
        await see(city.getByRole('radio', { name: 'Alexandria' })).toBeVisible();
        await press(city.getByRole('radio', { name: 'Alexandria' }));
        await see(city.getByRole('radio', { name: 'Alexandria' })).toBeChecked();
      },
    },
    {
      says: 'Change the country to Jordan: Jordan’s cities load',
      async run({ page, press, see }) {
        const city = page.locator('[data-field="city"]');
        await page.getByRole('combobox', { name: 'Country' }).selectOption({ label: 'Jordan' });
        await see(city).toContainText('Loading choices…');
        await see(city.getByRole('radio', { name: 'Amman' })).toBeVisible();
        await see(city.getByRole('radio', { name: 'Alexandria' })).toHaveCount(0);
        await see(city).toContainText('Alexandria is no longer offered, so it was taken out');
        for (const one of await city.getByRole('radio').all()) await see(one).not.toBeChecked();
        await press(city.getByRole('radio', { name: 'Amman' }));
        await see(city).not.toContainText('no longer offered');
      },
    },
  ],
};
