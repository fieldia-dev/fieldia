import type { Page } from '@playwright/test';
import type { DemoReplay } from '../hand';
import { narrow } from './support';

/** A list's names as a person reads them: the Service column's cells, or each card's title on a phone. */
const listNames = (page: Page, phone: boolean) => page.locator(phone ? '.fd-list-row .fd-list-card-title' : '.fd-list-row td[data-col="name"]');

/** The services-languages demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'The last service, “حشو تجميلي”, has its Arabic name alone',
      async run({ page, phone, see }) {
        const names = listNames(page, phone);
        await see(names).toHaveCount(8);
        await see(names.last()).toContainText('حشو تجميلي');
        await see(names.last().locator('bdi[lang="ar"]')).toHaveText('حشو تجميلي');
        await see(names.last().locator('.fd-lang-mark')).toHaveText('AR (in Arabic)');
        const peel = names.filter({ hasText: 'Chemical peel' });
        await see(peel).toHaveCount(1);
        await see(peel.locator('.fd-lang-mark')).toHaveCount(0);
      },
    },
    {
      says: 'Type تنظيف in the search and press Enter',
      async run({ page, phone, type, keys, press, see }) {
        const search = page.getByRole('combobox', { name: 'Search' });
        await type(search, 'تنظيف');
        await keys('Enter');
        await see(listNames(page, phone)).toHaveText([/^Teeth cleaning/]);
        await press(page.getByRole('button', { name: 'Remove Service: تنظيف' }));
        await see(listNames(page, phone)).toHaveCount(8);
        await type(search, 'whitening');
        await keys('Enter');
        await see(listNames(page, phone)).toHaveText([/^Teeth whitening/]);
        await press(page.getByRole('button', { name: 'Remove Service: whitening' }));
        await see(listNames(page, phone)).toHaveCount(8);
      },
    },
    {
      says: 'Click Teeth cleaning: its page has a switch over its name',
      async run({ page, phone, press, see }) {
        await press(listNames(page, phone).filter({ hasText: 'Teeth cleaning' }));
        const name = page.getByRole('group', { name: 'Service', exact: true });
        await see(name.getByRole('tablist', { name: 'Languages of Service' }).getByRole('tab')).toHaveText(['English', 'العربية']);
        await see(name.getByRole('textbox', { name: 'Service English' })).toHaveValue('Teeth cleaning');
        await press(name.getByRole('tab', { name: 'العربية' }));
        await see(name.getByRole('textbox', { name: 'Service العربية' })).toHaveValue('تنظيف الأسنان');
        const notes = page.getByRole('group', { name: 'What to tell the patient' });
        await see(notes.getByRole('tab')).toHaveText(['English', 'العربية']);
        await see(notes.getByRole('textbox', { name: 'What to tell the patient English' })).toHaveText('Eat as usual before the visit.');
        await press(notes.getByRole('tab', { name: 'العربية' }));
        await see(notes.getByRole('textbox', { name: 'What to tell the patient العربية' })).toHaveText('تناول طعامك كالمعتاد قبل الزيارة.');
      },
    },
    {
      says: 'Open the list in Arabic: each name in Arabic',
      async run({ page, phone, follow, see }) {
        // From the service's own page (which has no steps of its own) back to the list, as the browser's Back goes.
        await page.goBack();
        await see(page.locator('.dh-title')).toHaveText('Services named in English and Arabic');
        await follow('Open the list in Arabic');
        await see(page.locator('.fd-form').first()).toHaveAttribute('dir', 'rtl');
        const names = listNames(page, phone);
        await see(names).toHaveCount(8);
        await see(names.filter({ hasText: 'تنظيف الأسنان' })).toHaveCount(1);
        await see(names.filter({ hasText: 'Teeth cleaning' })).toHaveCount(0);
        await see(names.filter({ hasText: 'Chemical peel' }).locator('.fd-lang-mark')).toHaveText('EN (باللغة الإنجليزية)');
      },
    },
    {
      says: 'Narrow the window, or open it on a phone: each service is a card',
      async run(hand) {
        const { page, see } = hand;
        await narrow(hand);
        await see(page.locator('.fd-list')).toHaveAttribute('data-as', 'cards');
        const titles = listNames(page, true);
        await see(titles.filter({ hasText: 'تنظيف الأسنان' })).toBeVisible();
        await see(titles.filter({ hasText: 'Chemical peel' }).locator('.fd-lang-mark')).toHaveText('EN (باللغة الإنجليزية)');
      },
    },
  ],
};
