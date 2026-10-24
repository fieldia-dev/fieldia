import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { screen } from './support';

/**
 * A record's load as a person meets it (audit R-H3, R-H4, R-M4): while its first load is on its way or failed, its
 * fields take no typing — nothing lands on a record nobody saw — and a failure is said over the page in words with a
 * Retry of its own, which loads it; a value its source holds that the page cannot show is said under its field alone,
 * and the rest is typed in and saved.
 */

const PAGE = {
  fieldia: '0.11',
  id: 'customer',
  title: 'Customer',
  data: { kind: 'record', model: 'partner' },
  fields: { name: { type: 'char', label: 'Name' }, amount: { type: 'monetary', label: 'Credit limit', currency: 'EGP' }, tags: { type: 'many2many', label: 'Tags', relation: 'tag' } },
  layout: { type: 'sheet', id: 'main', children: ['name', 'amount', 'tags'].map((field) => ({ type: 'field', id: field, field })) },
};

/** The one-tag demo's page replaced by a customer's record, its source's load answering as `answer` says. */
async function mount(page: Page, answer: 'fail-once' | 'odd-tags') {
  await page.goto('/script/');
  await expect(page.locator('#app .fd-form')).toBeVisible();
  await page.evaluate(
    ([shown, how]) => {
      const fieldia = (window as any).Fieldia;
      const demo = (window as any).fieldiaDemo;
      demo.handle.destroy();
      let tries = 0;
      const saves: unknown[] = [];
      demo.saves = saves;
      const dataSource = {
        async load() {
          tries++;
          if (how === 'fail-once' && tries === 1) throw new Error('Gateway Timeout');
          return how === 'odd-tags' ? { name: 'Nile Traders', amount: '52000.50', tags: 'vip,new' } : { name: 'Nile Traders', amount: 52000 };
        },
        async save(request: unknown) {
          saves.push(JSON.parse(JSON.stringify(request)));
          return { id: 7 };
        },
      };
      demo.handle = fieldia.mountViewer(document.getElementById('app'), { page: shown, dataSource, recordId: 7, skin: 'outlined' });
    },
    [PAGE, answer] as const
  );
}

const name = (page: Page) => page.locator('#app [data-node="name"] input');
const inert = (page: Page) => name(page).evaluate((box) => !!box.closest('[inert]'));

test.describe("a record's load", () => {
  test('failed: said over the page with its own Retry, nothing to type in; Retry loads it', async ({ page }) => {
    await mount(page, 'fail-once');
    const banner = page.locator('#app .fd-load-problem');
    await expect(banner).toBeVisible();
    await expect(banner.locator('.fd-banner-text')).toHaveText('This record could not be loaded: Gateway Timeout');
    expect(await inert(page)).toBe(true);
    // Pressed and typed in anyway: nothing lands in it.
    await name(page).click({ force: true });
    await page.keyboard.type('Typed');
    await expect(name(page)).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeHidden();
    await screen(page, 'load-failed-retry');
    await banner.getByRole('button', { name: 'Retry' }).click();
    await expect(banner).toBeHidden();
    await expect(name(page)).toHaveValue('Nile Traders');
    expect(await inert(page)).toBe(false);
    await name(page).fill('Nile Traders Co');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as any).fieldiaDemo.saves.length)).toBe(1);
    const [saved] = await page.evaluate(() => (window as any).fieldiaDemo.saves);
    expect(saved.values).toMatchObject({ name: 'Nile Traders Co', amount: 52000 });
  });

  test('a value the page cannot show: said under its field alone, the rest typed in and saved without it', async ({ page }) => {
    await mount(page, 'odd-tags');
    await expect(name(page)).toHaveValue('Nile Traders');
    await expect(page.locator('#app [data-node="tags"]')).toContainText('Tags is stored in a way this page cannot show: it is kept as it is');
    await expect(page.locator('#app')).not.toContainText('could not be shown');
    await name(page).fill('Nile Traders Co');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as any).fieldiaDemo.saves.length)).toBe(1);
    const [saved] = await page.evaluate(() => (window as any).fieldiaDemo.saves);
    expect(saved.values).not.toHaveProperty('tags');
    expect(saved.values).toMatchObject({ name: 'Nile Traders Co', amount: 52000.5 });
    await screen(page, 'load-value-unreadable');
  });
});
