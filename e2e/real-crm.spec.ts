import { expect, test, type Page } from '@playwright/test';
import { expectNoSidewaysScroll, node, open, screen } from './support';
import { VARIANTS } from './variants';

/**
 * The CRM lane's real pages — Sherkety ERP's contact, opportunity and tender
 * forms rebuilt in Fieldia — used by a person in every framework's demo: the
 * contact reshaped by Individual or Company, an opportunity's probability
 * following its stage and its loss recorded through the lost-reason dialog,
 * a tender's compliance following its checklist and its loss analysed.
 */

const WIDE = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const value = (page: Page, name: string) => page.evaluate((n) => (window as any).fieldiaDemo.handle.form.getState().values[n], name);
const tab = (page: Page, id: string) => page.locator(`button[data-node="${id}"]`);

/** Type into a link's box and pick the option named. */
async function pick(scope: ReturnType<Page['locator']>, typed: string, option: string) {
  const box = scope.getByRole('combobox');
  await box.click();
  await box.fill(typed);
  await scope.getByRole('option', { name: option, exact: true }).click();
  await expect(box).toHaveValue(option);
}

for (const variant of VARIANTS) {
  test.describe(variant, () => {
    test('contact: Individual or Company reshapes the page; a company’s person keeps its address and invoicing', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, 'page=real-contact&record=7001&skin=underline');

      // A company: the address under its heading, no job position, title or address type; Industry in Sales & Purchase.
      expect(await value(page, 'name')).toBe('Nile Crest Developments');
      await expect(node(page, 't-address')).toBeVisible();
      await expect(node(page, 'f-function')).toBeHidden();
      await expect(node(page, 'f-title')).toBeHidden();
      await expect(node(page, 'f-type')).toBeHidden();
      await expect(node(page, 'stat-opportunities')).toContainText('3');
      // Contacts & Addresses: the company's people and addresses, as cards.
      const names = node(page, 'f-children').getByRole('textbox', { name: 'Contact Name' });
      await expect(names).toHaveCount(4);
      await expect(names.first()).toHaveValue('Hany Saber');
      await expect(names.last()).toHaveValue('New Capital site office');
      if (variant === 'plain') await screen(page, 'real-crm-contact-company');

      await tab(page, 'tab-sales-purchases').click();
      await expect(node(page, 'f-industry')).toBeVisible();
      await expect(node(page, 'l10n-eg-tax-info')).toBeVisible();

      // Invoicing: the credit limit only while Partner Limit is ticked.
      await tab(page, 'tab-accounting').click();
      await expect(node(page, 'f-credit-limit')).toBeVisible();
      await node(page, 'f-use-credit-limit').locator('input[type="checkbox"]').uncheck();
      await expect(node(page, 'f-credit-limit')).toBeHidden();

      // Individual: the page reshapes — the server's onchange sets is_company.
      await node(page, 'f-company-type').getByRole('radio', { name: 'Individual' }).check();
      await expect.poll(() => value(page, 'is_company')).toBe(false);
      await expect(node(page, 'f-function')).toBeVisible();
      await expect(node(page, 'f-title')).toBeVisible();
      await expect(node(page, 'f-type')).toBeVisible();
      await expect(node(page, 't-address')).toBeHidden();
      await tab(page, 'tab-sales-purchases').click();
      await expect(node(page, 'f-industry')).toBeHidden();
      if (variant === 'plain') await screen(page, 'real-crm-contact-individual');

      // A warning chosen asks for its message.
      await tab(page, 'tab-internal-notes').click();
      await expect(node(page, 'f-invoice-warn-msg')).toBeHidden();
      await node(page, 'f-invoice-warn').locator('select').selectOption({ label: 'Warning' });
      await expect(node(page, 'f-invoice-warn-msg')).toBeVisible();
      expect(problems).toEqual([]);
    });

    test('contact: a company’s person has the company’s address, locked, and invoicing on the parent', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, 'page=real-contact&record=7002&skin=underline');
      await expect(node(page, 'f-parent').getByRole('combobox')).toHaveValue('Nile Crest Developments');
      await expect(node(page, 'f-function')).toBeVisible();
      await expect(node(page, 'f-street').locator('input')).toHaveValue('Plot 112, South 90th Street');
      await expect(node(page, 'f-street').locator('input')).not.toBeEditable();
      await expect(node(page, 'f-vat').locator('input')).not.toBeEditable();
      await expect(tab(page, 'tab-accounting')).toBeHidden();
      await tab(page, 'tab-accounting-disabled').click();
      await expect(node(page, 't-accounting-on-parent')).toBeVisible();
      await tab(page, 'tab-sales-purchases').click();
      await expect(node(page, 'f-pricelist')).toBeHidden();
      await expect(node(page, 't-parent-pricelists')).toBeVisible();
      if (variant === 'plain') {
        await page.setViewportSize(PHONE);
        await expectNoSidewaysScroll(page);
        await screen(page, 'real-crm-contact-person-phone');
      }
      expect(problems).toEqual([]);
    });

    test('opportunity: the probability follows the stage; Lost asks why, then Restore and Won', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, 'page=real-opportunity&record=7701&skin=underline');
      await expect(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText('Proposition');
      expect(await value(page, 'probability')).toBe(70);
      await expect(node(page, 'f-expected-revenue')).toBeVisible();
      await expect(page.locator('button[data-node="convert"]')).toBeHidden();
      await expect(node(page, 'stat-similar-lead')).toBeVisible();
      await expect(node(page, 'stat-next-meeting')).toBeVisible();
      if (variant === 'plain') await screen(page, 'real-crm-opportunity');

      // A stage clicked: the server works the probability out from it.
      await page.locator('.fd-statusbar').getByRole('button', { name: 'Qualified' }).click();
      await expect.poll(() => value(page, 'probability')).toBe(30);
      await expect(node(page, 'f-probability').locator('input')).toHaveValue('30.00');

      // Lost: the reason asked in a dialog, then the record lost — the ribbon, the reason, Restore.
      await page.locator('button[data-node="lost"]').click();
      const dialog = page.getByRole('dialog', { name: 'Mark Lost' });
      await expect(dialog).toBeVisible();
      await pick(dialog.locator('[data-node="f-lost-reason"]'), 'Too', 'Too expensive');
      if (variant === 'plain') await screen(page, 'real-crm-opportunity-lost-dialog', { viewport: true });
      await dialog.getByRole('button', { name: 'Save & Close' }).click();
      await expect(dialog).toBeHidden();
      await expect(node(page, 'ribbon-lost')).toBeVisible();
      await expect.poll(() => value(page, 'active')).toBe(false);
      expect(await value(page, 'probability')).toBe(0);
      expect(((await value(page, 'lost_reason_id')) as { label: string }).label).toBe('Too expensive');
      // Saved as Flectra's action_set_lost writes it: archived, at 0 %, with the reason — fields the page never shows included.
      const stored = await page.evaluate(() => (window as any).fieldiaDemo.dataSource.records['crm.lead']['7701']);
      expect([stored.active, stored.probability, stored.lost_reason_id?.label]).toEqual([false, 0, 'Too expensive']);
      await expect(node(page, 'f-lost-reason').getByRole('combobox')).toHaveValue('Too expensive');
      await expect(page.locator('button[data-node="restore"]')).toBeVisible();
      await expect(page.locator('button[data-node="won"]')).toBeHidden();
      await expect(page.locator('button[data-node="lost"]')).toBeHidden();
      if (variant === 'plain') await screen(page, 'real-crm-opportunity-lost');

      // Restore, then Won: the Won stage at 100 %.
      await page.locator('button[data-node="restore"]').click();
      await expect(node(page, 'ribbon-lost')).toBeHidden();
      await expect.poll(() => value(page, 'probability')).toBe(30);
      await page.locator('button[data-node="won"]').click();
      await expect(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText('Won');
      await expect.poll(() => value(page, 'probability')).toBe(100);
      await expect(node(page, 'badge-won')).toBeVisible();
      await expect(page.locator('button[data-node="won"]')).toBeHidden();
      expect(problems).toEqual([]);
    });

    test('lead: its own groups and tab, and Convert to Opportunity in a dialog', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, 'page=real-opportunity&record=7702&skin=underline');
      await expect(page.locator('button[data-node="convert"]')).toBeVisible();
      await expect(page.locator('button[data-node="won"]')).toBeHidden();
      await expect(node(page, 'f-expected-revenue')).toBeHidden();
      await expect(node(page, 'f-lead-contact-name').locator('input')).toHaveValue('Yasmin Ashraf');
      await expect(tab(page, 'tab-extra')).toBeVisible();
      await expect(tab(page, 'tab-lead')).toBeHidden();
      if (variant === 'plain') await screen(page, 'real-crm-lead');

      await page.locator('button[data-node="convert"]').click();
      const dialog = page.getByRole('dialog', { name: 'Convert to opportunity' });
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('[data-node="f-user"]').getByRole('combobox')).toHaveValue('Karim Fathy');
      await dialog.getByRole('radio', { name: 'Do not link to a customer' }).check();
      await dialog.getByRole('button', { name: 'Save & Close' }).click();
      await expect(dialog).toBeHidden();
      await expect.poll(() => value(page, 'type')).toBe('opportunity');
      await expect(page.locator('button[data-node="won"]')).toBeVisible();
      await expect(node(page, 'f-expected-revenue')).toBeVisible();
      await expect(tab(page, 'tab-lead')).toBeVisible();
      expect(problems).toEqual([]);
    });

    test('tender: a requirement added and ticked moves the compliance; Submit Bid, then Mark Lost with its analysis', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, 'page=real-tender&record=7801&skin=underline');
      await expect(node(page, 'stat-lots')).toContainText('3');
      await expect(node(page, 'stat-documents')).toContainText('2');
      await expect(node(page, 'badge-plenty')).toBeVisible();
      await expect(page.locator('button[data-node="mark-lost"]')).toBeHidden();
      if (variant === 'plain') await screen(page, 'real-crm-tender');

      // Requirements: one added, then ticked — the compliance follows.
      await tab(page, 'tab-requirements').click();
      expect(await value(page, 'compliance_percentage')).toBe(71.43);
      const table = node(page, 'f-requirements');
      await table.getByRole('button', { name: 'Add a line' }).click();
      const added = table.locator('tbody tr').last();
      await added.locator('input').first().fill('Site visit certificate');
      await expect.poll(() => value(page, 'compliance_percentage')).toBe(62.5);
      await added.locator('input[type="checkbox"]').nth(1).check();
      await expect.poll(() => value(page, 'compliance_percentage')).toBe(75);
      if (variant === 'plain') await screen(page, 'real-crm-tender-requirements');

      // Lots: Lot 2 left out of the bid, its quotation leaves our bid.
      await tab(page, 'tab-lots').click();
      await node(page, 'f-lots').locator('tbody tr').nth(1).locator('input[type="checkbox"]').uncheck();
      await expect.poll(() => value(page, 'our_bid_amount')).toBe(18450000);

      // Submit Bid, then Mark Lost: the loss analysis asked in a dialog, kept in Results.
      await page.locator('button[data-node="submit-bid"]').click();
      await expect.poll(() => value(page, 'state')).toBe('submitted');
      await expect(page.locator('button[data-node="mark-won"]')).toBeVisible();
      await page.locator('button[data-node="mark-lost"]').click();
      const dialog = page.getByRole('dialog', { name: 'Loss Analysis' });
      await expect(dialog).toBeVisible();
      await dialog.locator('[data-node="f-loss-reason"] select').selectOption({ label: 'Price Too High' });
      await dialog.locator('[data-node="f-loss-notes"] textarea').fill('Pyramids Contracting came in 9% lower on Lot 1.');
      await pick(dialog.locator('[data-node="f-winning-competitor"]'), 'Pyramids', 'Pyramids Contracting');
      if (variant === 'plain') await screen(page, 'real-crm-tender-loss-dialog', { viewport: true });
      await dialog.getByRole('button', { name: 'Save & Close' }).click();
      await expect(dialog).toBeHidden();
      await expect.poll(() => value(page, 'state')).toBe('lost');
      expect(await value(page, 'loss_reason')).toBe('price');
      await tab(page, 'tab-results').click();
      await expect(node(page, 'f-loss-notes').locator('textarea')).toHaveValue('Pyramids Contracting came in 9% lower on Lot 1.');
      await expect(node(page, 'f-winning-competitor').getByRole('combobox')).toHaveValue('Pyramids Contracting');
      expect(problems).toEqual([]);
    });
  });
}
