import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * A question bank, as a member of staff meets it on the clinic's check: two of its four questions drawn for each person,
 * in an order drawn, the others never asked; the same two again from the draft on the same device; and the answers sent
 * with the order shown.
 */

const CHECK = 'page=training-check&skin=outlined';
const box = (page: Page, id: string) => node(page, id).locator('input, select, textarea').first();

test.describe('a question bank', () => {
  test('asks two of its four questions, in an order drawn, the same again from the draft on the same device', async ({ page }) => {
    await open(page, 'plain', `${CHECK}&drafts=1`);
    await page.evaluate(() => localStorage.clear());
    await page.getByRole('button', { name: 'Start' }).click();
    await box(page, 'q-name').fill('Mona Adel');
    await node(page, 'q-role').getByLabel('Nurse').check();
    const asked = node(page, 'step-bank').locator('[data-node^="q-bank-"]:visible');
    await page.getByRole('button', { name: 'Next' }).click();
    // The fillers' and the care's steps answered, to reach the bank.
    await node(page, 'q-reversible').getByLabel('Hyaluronic acid').check();
    await box(page, 'q-enzyme').fill('Hyaluronidase');
    await node(page, 'q-signs').getByLabel('Blanching of the skin').check();
    await page.getByRole('button', { name: 'Next' }).click();
    await box(page, 'q-wait').fill('30');
    await node(page, 'q-consent').getByLabel('Before the treatment, after the risks are explained').check();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(asked).toHaveCount(2);
    const first = await asked.evaluateAll((parts) => parts.map((part) => part.getAttribute('data-node')));
    await screen(page, 'survey-bank-drawn');
    // The draw is kept in the browser's draft with the answers.
    await expect
      .poll(() => page.evaluate(() => Object.entries(localStorage).find(([key]) => key.startsWith('fieldia:draft:training-check'))?.[1] ?? ''))
      .toContain('"step-bank"');
    // The same device, the page opened again: its draft restored, the same two, in the same order (kept in the draft) —
    // at once, never offered to be let go, as its clock started: a draft let go would start it again.
    await page.reload();
    await expect(asked).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Restore' })).toHaveCount(0);
    expect(await asked.evaluateAll((parts) => parts.map((part) => part.getAttribute('data-node')))).toEqual(first);
    // Reviewed in the order shown: the bank's two after the care's.
    await page.getByRole('button', { name: 'Review your answers' }).click();
    const reviewed = await page.locator('.fd-review-row[data-field^="bank_"]').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-node')?.replace('~review', '')));
    expect(reviewed).toEqual(first);
  });
});
