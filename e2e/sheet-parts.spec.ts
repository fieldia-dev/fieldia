import { expect, test, type Page } from '@playwright/test';
import { expectNoSidewaysScroll, node, open, screen } from './support';
import { VARIANTS } from './variants';

/** Badges, the title area, closable alerts, header groups, read-only sections, the wizard's step list, page width and Save's place. */
const value = (page: Page, name: string) => page.evaluate((n) => (window as any).fieldiaDemo.handle.form.getState().values[n], name);
const setValue = (page: Page, name: string, to: unknown) =>
  page.evaluate(([n, v]) => (window as any).fieldiaDemo.handle.form.setValue(n, v), [name, to] as const);
const box = async (page: Page, id: string) => (await node(page, id).boundingBox())!;

for (const variant of VARIANTS) {
  test.describe(`${variant} · sheet and layout parts`, () => {
    test('the statusbar fills the current stage, its words in its own colour, either way the page reads', async ({ page }) => {
      for (const [direction, query] of [['ltr', 'page=customer&skin=underline'], ['rtl', 'page=customer&skin=underline&locale=ar&dir=rtl']]) {
        await open(page, variant, query);
        const bar = page.locator('.fd-header .fd-statusbar');
        const current = bar.locator('[aria-current="step"]');
        await expect(current).toHaveText('Active');
        // The stage is the shape and the colour; its words carry neither a box nor a background of their own.
        const look = await current.evaluate((step) => {
          const label = step.firstElementChild as HTMLElement;
          const own = getComputedStyle(step);
          const words = getComputedStyle(label);
          return { stage: own.backgroundColor, text: words.color, wordsBackground: words.backgroundColor, wordsPadding: words.paddingLeft, wordsClip: words.clipPath };
        });
        expect(look, direction).toEqual({ stage: 'rgb(0, 40, 85)', text: 'rgb(255, 255, 255)', wordsBackground: 'rgba(0, 0, 0, 0)', wordsPadding: '0px', wordsClip: 'none' });
        // The other stages: grey, their words muted, with no box of their own either.
        const other = await bar.getByRole('button', { name: 'Draft' }).evaluate((step) => {
          const words = getComputedStyle(step.firstElementChild as HTMLElement);
          return { stage: getComputedStyle(step).backgroundColor, wordsBackground: words.backgroundColor };
        });
        expect(other, direction).toEqual({ stage: 'rgb(242, 243, 245)', wordsBackground: 'rgba(0, 0, 0, 0)' });
        // Right to left, the words still read the right way round, inside their stage.
        const [stageBox, wordsBox] = [await current.boundingBox(), await current.locator('span').boundingBox()];
        expect(wordsBox!.x).toBeGreaterThan(stageBox!.x);
        expect(wordsBox!.x + wordsBox!.width).toBeLessThan(stageBox!.x + stageBox!.width);
        await screen(page, `${variant}-statusbar-${direction}`, { viewport: true });
      }
    });

    test('a sheet shows its badge, then a choice over the title that the onchange follows', async ({ page }) => {
      await open(page, variant, 'page=customer&skin=underline');
      const badge = node(page, 'b-key-account');
      await expect(badge).toHaveText('Key account');
      await expect(badge.locator('svg')).toHaveAttribute('data-icon', 'star');
      await expect(node(page, 'b-new')).toBeHidden();
      const choice = node(page, 'f-company-type');
      await expect(choice.getByRole('radio', { name: 'Company', exact: true })).toBeChecked();
      const [b, c, t] = [await box(page, 'b-key-account'), await box(page, 'f-company-type'), (await page.locator('[data-node="#title"]').boundingBox())!];
      expect(b.y + b.height).toBeLessThanOrEqual(c.y + 1);
      expect(c.y + c.height).toBeLessThanOrEqual(t.y + 1);
      await expect(node(page, 'sales').locator('svg')).toHaveAttribute('data-icon', 'cart');
      await screen(page, `${variant}-sheet-title-area`, { viewport: true });
      await choice.getByRole('radio', { name: 'Individual' }).check();
      await expect.poll(() => value(page, 'is_company')).toBe(false);
      await expect(page.getByRole('tab', { name: 'Contacts' })).toBeHidden();
    });

    test('a dismissible alert closes, and stays closed while the page is open', async ({ page }) => {
      await open(page, variant, 'page=customer&skin=underline');
      await setValue(page, 'over_limit', true);
      const alert = node(page, 'over-limit');
      await expect(alert).toContainText('This customer is over their credit limit.');
      await screen(page, `${variant}-sheet-alert`, { viewport: true });
      await alert.getByRole('button', { name: 'Dismiss' }).click();
      await expect(alert).toBeHidden();
      await setValue(page, 'over_limit', false);
      await setValue(page, 'over_limit', true);
      await expect(alert).toBeHidden();
    });

    test('a blocked customer’s credit section is read-only as a whole', async ({ page }) => {
      await open(page, variant, 'page=customer&skin=outlined');
      await page.getByRole('tab', { name: 'Sales and billing' }).click();
      await expect(node(page, 'billing').locator('legend svg')).toHaveAttribute('data-icon', 'money');
      const limit = node(page, 'f-credit-limit').locator('input');
      const currency = node(page, 'f-currency').getByRole('combobox');
      await expect(limit).toBeEditable();
      await expect(currency).toBeEditable();
      await setValue(page, 'state', 'blocked');
      await expect(limit).not.toBeEditable();
      await expect(currency).not.toBeEditable();
      await screen(page, `${variant}-sheet-readonly-section`, { viewport: true });
    });

    test('an order’s header sits in two groups, side by side until the form is narrow', async ({ page }) => {
      for (const [width, sideBySide] of [[1280, true], [700, true], [390, false]] as const) {
        await page.setViewportSize({ width, height: 900 });
        await open(page, variant, 'page=order&skin=underline');
        const [customer, terms, expiry, date] = [await box(page, 'f-partner'), await box(page, 'f-terms'), await box(page, 'f-validity'), await box(page, 'f-date')];
        // Each group is a column of its own fields.
        expect(Math.abs(customer.x - terms.x)).toBeLessThan(2);
        expect(Math.abs(expiry.x - date.x)).toBeLessThan(2);
        expect(terms.y).toBeGreaterThan(customer.y);
        // However narrow the group, the customer's name fits its box.
        const fits = await node(page, 'f-partner').getByRole('combobox').evaluate((el: HTMLInputElement) => el.scrollWidth <= el.clientWidth + 1);
        expect(fits, `at ${width}px the customer's name is cut off`).toBe(true);
        if (sideBySide) {
          expect(expiry.x, `at ${width}px the groups should sit side by side`).toBeGreaterThanOrEqual(customer.x + customer.width - 1);
          expect(Math.abs(expiry.y - customer.y)).toBeLessThan(2);
        } else {
          expect(expiry.y, `at ${width}px the groups should stack`).toBeGreaterThanOrEqual(terms.y + terms.height - 1);
          await expectNoSidewaysScroll(page);
        }
        await screen(page, `${variant}-order-header-${width}`, { viewport: true });
      }
    });

    test('a confirmed order shows its Locked badge', async ({ page }) => {
      await open(page, variant, 'page=order&skin=underline');
      const locked = node(page, 'b-locked');
      await expect(locked).toBeHidden();
      await page.locator('.fd-header .fd-statusbar').getByRole('button', { name: 'Sales order' }).click();
      await expect(locked).toBeVisible();
      await expect(locked.locator('svg')).toHaveAttribute('data-icon', 'lock');
    });

    test('a survey’s step list goes back and forward, and an optional step skipped is left out', async ({ page }) => {
      const { demo } = await open(page, variant, 'page=survey&skin=outlined');
      const steps = page.getByRole('navigation', { name: 'Steps' });
      await steps.getByRole('button', { name: 'Last thing' }).click();
      await expect(node(page, 'q-name').locator('.fd-error')).toHaveText('Your name is required');
      await node(page, 'q-name').locator('input').fill('Omar');
      await steps.getByRole('button', { name: 'Using the product' }).click();
      await page.getByLabel('Yes').check();
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.getByRole('heading', { name: 'Your experience' })).toBeVisible();
      await page.getByRole('button', { name: 'Skip' }).click();
      await expect(page.getByRole('heading', { name: 'Last thing' })).toBeVisible();
      await expect(steps.getByRole('button', { name: 'Your experience' })).toHaveClass(/fd-step-skipped/);
      await expect(steps.getByRole('button', { name: 'About you' })).toHaveClass(/fd-step-done/);
      await screen(page, `${variant}-survey-step-list`, { viewport: true });
      await steps.getByRole('button', { name: 'About you' }).click();
      await expect(page.getByRole('heading', { name: 'About you' })).toBeVisible();
      await steps.getByRole('button', { name: 'Last thing' }).click();
      await page.getByRole('button', { name: 'Send my answers' }).click();
      await expect(page.locator('.fd-done')).toBeVisible();
      const responses = await demo<{ values: Record<string, unknown> }[]>('dataSource.responses');
      expect(responses[0].values).toMatchObject({ name: 'Omar', uses_product: 'yes' });
      expect(responses[0].values).not.toHaveProperty('rating');
    });

    test('a page can be narrow with its Submit above, and a sheet can keep Save at its foot', async ({ page }) => {
      await open(page, variant, 'page=signup&skin=outlined&maxWidth=narrow&actions=top');
      expect((await page.locator('.fd-content').boundingBox())!.width).toBeLessThanOrEqual(640);
      const submit = (await page.getByRole('button', { name: 'Submit' }).boundingBox())!;
      expect(submit.y + submit.height).toBeLessThan((await box(page, 'about')).y);
      await screen(page, `${variant}-page-narrow-actions-top`, { viewport: true });
      await open(page, variant, 'page=customer&skin=outlined&actions=bottom');
      await node(page, 'f-phone').locator('input').fill('+20 2 1111 2222');
      const save = page.getByRole('button', { name: 'Save' });
      await expect(save).toBeVisible();
      expect(await save.evaluate((el) => !!el.closest('.fd-sheet-foot') && !el.closest('.fd-header'))).toBe(true);
      await save.scrollIntoViewIfNeeded();
      await screen(page, `${variant}-sheet-save-at-foot`, { viewport: true });
    });
  });
}
