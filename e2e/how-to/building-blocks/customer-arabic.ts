import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';

/** The customer-arabic demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Notice the page mirrored: the title, the stages and the tabs start on the right.',
      async run({ page, see }) {
        const form = page.locator('.fd-form').first();
        await see(form).toHaveAttribute('dir', 'rtl');
        const box = (await form.boundingBox())!;
        // The title, written from the right.
        const title = page.locator('.fd-title textarea');
        await see(title).toHaveValue('Nile Traders');
        await see(title).toHaveCSS('direction', 'rtl');
        const named = (await title.boundingBox())!;
        expect(named.x + named.width).toBeGreaterThan(box.x + box.width * 0.75);
        // The stages from the right: the first, Draft, rightmost.
        const stages = page.getByRole('list', { name: 'Status' }).getByRole('listitem');
        await see(stages).toHaveText(['Draft', 'Active', 'Blocked']);
        const xs = await stages.evaluateAll((all) => all.map((one) => one.getBoundingClientRect().x));
        expect(xs[0]).toBeGreaterThan(xs[1]);
        expect(xs[1]).toBeGreaterThan(xs[2]);
        // The tabs from the right: Contacts first.
        const tabs = page.getByRole('tab');
        await see(tabs.first()).toHaveText('Contacts');
        const tx = await tabs.evaluateAll((all) => all.map((one) => one.getBoundingClientRect().x));
        expect(tx[0]).toBeGreaterThan(tx[1]);
        expect(tx[1]).toBeGreaterThan(tx[2]);
      },
    },
    {
      says: 'Empty a required field and save: the message comes in Arabic.',
      async run({ page, press, type, see }) {
        const name = page.locator('.fd-title textarea');
        await type(name, '', { clear: true });
        await see(name).toHaveValue('');
        await press(page.getByRole('button', { name: 'حفظ', exact: true }));
        // Under the title, and said for the whole form: Fieldia's words in Arabic, the app's label as it wrote it.
        await see(page.getByText('Name مطلوب', { exact: true })).toBeVisible();
        await see(page.getByRole('alert').filter({ hasText: 'لم يُحفظ' })).toHaveText('لم يُحفظ. راجِع: Name');
        await see(page.getByText(/is required/)).toHaveCount(0);
      },
    },
  ],
};
