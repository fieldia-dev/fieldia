import { expect, test, type Page } from '@playwright/test';
import { DEMOS } from '../demos/catalog.mjs';
import { ALLOWED, axeFindings } from './a11y-support';
import { node, screen } from './support';

/**
 * The accessibility sweep: axe, against WCAG 2.2 A and AA, on every demo of
 * the gallery in both skins, in the dark scheme and right to left in Arabic;
 * on the states a person reaches — errors after a failed send, a dialog
 * open, a list's search open. Every page must come back with nothing found.
 */

interface Demo {
  id: string;
  app?: string;
  query: string;
}

/** Each demo's addresses: the plain framework, in each skin, dark, and in Arabic right to left. */
function addresses(): string[] {
  const urls = new Set<string>();
  for (const demo of DEMOS as Demo[]) {
    if (demo.app) {
      urls.add(`/${demo.app}/`);
      continue;
    }
    const own = new URLSearchParams(demo.query);
    for (const skin of ['outlined', 'underline']) {
      const query = new URLSearchParams(own);
      query.set('skin', skin);
      urls.add(`/plain/?${query}`);
    }
    urls.add(`/plain/?${own}&scheme=dark`);
    if (own.get('dir') !== 'rtl') urls.add(`/plain/?${own}&locale=ar&dir=rtl`);
  }
  return [...urls];
}

/** Open a demo and wait for its form, and for what loads after it (a list's rows, a page's choices, from a source that answers after a moment). */
async function visit(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('.fd-form').first()).toBeVisible();
  await page.waitForTimeout(800);
}

// axe reads every element's colours: on a busy machine a page takes a while.
test.describe.configure({ timeout: 120_000 });

test.describe('axe on every demo of the gallery', () => {
  for (const url of addresses()) {
    test(url, async ({ page }) => {
      await visit(page, url);
      expect(await axeFindings(page, url)).toEqual([]);
    });
  }
});

test.describe('axe on what a person reaches', () => {
  for (const look of ['skin=outlined', 'skin=underline', 'skin=outlined&scheme=dark', 'skin=outlined&locale=ar&dir=rtl']) {
    test(`errors after a failed send · ${look}`, async ({ page }) => {
      await visit(page, `/plain/?page=signup&${look}`);
      await page.locator('.fd-form button[type="submit"]:visible').last().click();
      await expect(page.locator('.fd-error:visible').first()).toBeVisible();
      await screen(page, `a11y-errors-${look.replace(/\W+/g, '-')}`, { viewport: true });
      expect(await axeFindings(page, `signup errors ${look}`)).toEqual([]);
    });
  }

  test('answer rules that stop the form, and one that only warns', async ({ page }) => {
    await visit(page, '/plain/?page=rules&skin=outlined');
    await node(page, 'f-email').locator('input').fill('someone@elsewhere.example');
    await node(page, 'f-email').locator('input').blur();
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.locator('.fd-error:visible').first()).toBeVisible();
    expect(await axeFindings(page, 'rules refused')).toEqual([]);
  });

  test('a record that will not save, in Arabic', async ({ page }) => {
    await visit(page, '/plain/?page=customer&skin=underline&locale=ar&dir=rtl');
    await node(page, '#title').locator('input').fill('');
    await page.locator('.fd-form button[type="submit"]:visible').first().click();
    await expect(page.locator('.fd-error:visible').first()).toBeVisible();
    expect(await axeFindings(page, 'customer refused, Arabic')).toEqual([]);
  });

  for (const look of ['skin=outlined', 'skin=underline&scheme=dark']) {
    test(`dialogs open · ${look}`, async ({ page }) => {
      await visit(page, `/plain/?page=fields&${look}`);
      // A linked record, opened over the page.
      await node(page, 'f-client').getByRole('button', { name: 'Open Nile Traders' }).click();
      await expect(page.getByRole('dialog', { name: 'Nile Traders' })).toBeVisible();
      await screen(page, `a11y-dialog-record-${look.replace(/\W+/g, '-')}`, { viewport: true });
      const findings = await axeFindings(page, `record dialog ${look}`);
      await page.keyboard.press('Escape');
      // Search more…, over the page.
      await node(page, 'f-client').getByRole('combobox').click();
      await node(page, 'f-client').getByRole('option', { name: 'Search more…' }).click();
      await expect(page.getByRole('dialog', { name: 'Client' })).toBeVisible();
      findings.push(...(await axeFindings(page, `search more ${look}`)));
      expect(findings).toEqual([]);
    });
  }

  test('a line of an order, open in its dialog', async ({ page }) => {
    await visit(page, '/plain/?page=order&skin=underline');
    await node(page, 'f-lines').locator('.ag-row[row-index="1"] .ag-cell[col-id="__open"]').getByRole('button', { name: 'Open line' }).click();
    await expect(page.getByRole('dialog', { name: 'Order lines' })).toBeVisible();
    expect(await axeFindings(page, 'order line dialog')).toEqual([]);
  });

  for (const look of ['skin=underline', 'skin=outlined&scheme=dark', 'skin=underline&locale=ar&dir=rtl']) {
    test(`a list with its search open · ${look}`, async ({ page }) => {
      await visit(page, `/plain/?page=customers&${look}`);
      const box = page.locator('.fd-search-input');
      await box.pressSequentially('egy');
      await expect(page.getByRole('listbox').getByRole('option').first()).toBeVisible();
      const findings = await axeFindings(page, `search suggestions ${look}`);
      await box.press('Enter');
      await page.locator('.fd-search-toggle').click();
      await expect(page.locator('.fd-search-panel')).toBeVisible();
      await screen(page, `a11y-list-search-${look.replace(/\W+/g, '-')}`, { viewport: true });
      findings.push(...(await axeFindings(page, `search menu ${look}`)));
      expect(findings).toEqual([]);
    });
  }
});

test('the allow-list stays short, and says why for each', () => {
  expect(ALLOWED.length).toBeLessThanOrEqual(3);
  for (const entry of ALLOWED) expect(entry.why.length, `${entry.rule} needs a reason`).toBeGreaterThan(20);
});
