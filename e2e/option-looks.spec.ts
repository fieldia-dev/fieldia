import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * Options that say more than their words: the booking template's services and visits, each with an icon and a second
 * line; the lease's payment plans in Fieldia's own list, a colour beside some; and a link's suggestions showing each
 * agent's role under the name, a colour and the leases held — picked by the keys as by the pointer.
 */

test.describe('options with a second line, an icon or a colour', () => {
  test('radios show each service’s icon and second line, and are named by both', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=template-appointment-booking&theme=apple&now=2026-10-14T09:40');
    const service = node(page, 'f-service');
    await expect(service.locator('.fd-choice .fd-option-icon svg')).toHaveCount(3);
    await expect(service.locator('.fd-option-caption')).toHaveText(['Getting to know you and what you need', 'For patients seen in the last three months', 'Tests, and a full plan to follow']);
    await service.getByLabel('Follow-up, 20 min').check();
    await expect(service.getByRole('radio', { name: 'Follow-up, 20 min For patients seen in the last three months' })).toBeChecked();
    await screen(page, 'option-looks-radios');
    expect(problems).toEqual([]);
  });

  test('a dropdown whose options say more is Fieldia’s own list, by the keys too', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=lease&skin=underline&now=2026-10-21T09:00:00');
    const plan = node(page, 'f-plan');
    await expect(plan.locator('select')).toHaveCount(0);
    await expect(plan.locator('.fd-own-words')).toHaveText('Twice a year');
    await expect(plan.locator('.fd-own-mark .fd-option-icon')).toHaveCount(1);
    await plan.locator('.fd-own-button').focus();
    await page.keyboard.press('ArrowDown');
    // The list floats over the page, out of the field's box.
    const rows = page.getByRole('listbox').getByRole('option');
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(3)).toContainText('1 payment, 3% off the rent');
    await screen(page, 'option-looks-own-list');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(plan.locator('.fd-own-words')).toHaveText('Once a year');
    expect(await page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values.plan)).toBe('yearly');
    expect(problems).toEqual([]);
  });

  test('a link’s suggestions show each agent’s role, colour and leases held', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=lease&skin=underline&now=2026-10-21T09:00:00');
    const agent = node(page, 'f-agent').locator('input');
    await agent.click();
    await agent.fill('al');
    const noura = node(page, 'f-agent').getByRole('option', { name: /Noura Al-Qahtani/ });
    await expect(noura.locator('.fd-option-caption')).toHaveText('Senior leasing agent');
    await expect(noura.locator('.fd-option-dot')).toHaveAttribute('data-color', '7');
    await expect(noura.locator('.fd-option-aside')).toHaveText('12 leases');
    await screen(page, 'option-looks-link');
    await noura.click();
    await expect(agent).toHaveValue('Noura Al-Qahtani');
    expect(problems).toEqual([]);
  });
});
