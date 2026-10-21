import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * A property enquiry opened from a broker's link (its page's `prefill`): the unit the link names in its box, for the
 * person to keep or change, and who sent them — the campaign, the source, the broker's code — in hidden fields seen by
 * no one and sent with the answers.
 */

const MONA = 'page=unit-enquiry&skin=outlined&utm_source=whatsapp&utm_campaign=autumn-launch&agent=mona&unit=B-12';
const sent = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.dataSource.responses.map((response: { values: unknown }) => response.values));

let problems: string[] = [];
test.afterEach(() => expect(problems).toEqual([]));

for (const variant of ['plain', 'react']) {
  test.describe(`${variant === 'plain' ? '' : `${variant}: `}an enquiry from a broker’s link`, () => {
    test('fills the unit from the link and sends who sent the person in hidden fields', async ({ page }) => {
      ({ problems } = await open(page, variant, MONA));
      const unit = node(page, 'f-unit').locator('input');
      await expect(unit).toHaveValue('B-12');
      // The hidden fields are drawn nowhere.
      await expect(page.locator('[data-field="utm_source"], [data-field="agent_code"]')).toHaveCount(0);
      await node(page, 'f-name').locator('input').fill('Hana Fouad');
      await node(page, 'f-phone').locator('input').fill('010 1234 5678');
      await node(page, 'f-visit').getByRole('radio', { name: 'Book a viewing' }).check();
      await page.getByRole('button', { name: 'Submit', exact: true }).click();
      await expect(page.locator('.fd-done-words')).toHaveText(['Your agent will call you within the hour about B-12.']);
      expect(await sent(page)).toEqual([expect.objectContaining({ full_name: 'Hana Fouad', unit: 'B-12', utm_source: 'whatsapp', utm_campaign: 'autumn-launch', agent_code: 'mona' })]);
      if (variant === 'plain') {
        await expect(page.locator('.demo-sent-log dt', { hasText: 'Agent (hidden)' }).locator('xpath=following-sibling::dd[1]')).toHaveText('mona');
        await screen(page, 'prefill-sent');
      }
    });

    test('what the person types is theirs: a unit changed is sent, the link’s broker kept', async ({ page }) => {
      ({ problems } = await open(page, variant, 'page=unit-enquiry&skin=outlined&utm_source=instagram&agent=karim&unit=C-3'));
      const unit = node(page, 'f-unit').locator('input');
      await expect(unit).toHaveValue('C-3');
      await unit.fill('C-4');
      await node(page, 'f-name').locator('input').fill('Omar Said');
      await node(page, 'f-phone').locator('input').fill('012 2222 3333');
      await node(page, 'f-visit').getByRole('radio', { name: 'A call about prices and plans' }).check();
      if (variant === 'plain') await screen(page, 'prefill-unit-changed');
      await page.getByRole('button', { name: 'Submit', exact: true }).click();
      await expect(page.locator('.fd-done-title')).toHaveText('Thank you, Omar Said');
      expect(await sent(page)).toEqual([expect.objectContaining({ unit: 'C-4', utm_source: 'instagram', agent_code: 'karim', utm_campaign: null })]);
      // Submit another starts again from the link: its unit, its broker.
      await page.getByRole('button', { name: 'Submit another response' }).click();
      await expect(unit).toHaveValue('C-3');
    });
  });
}
