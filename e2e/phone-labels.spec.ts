import { type Browser, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * The owner's walk of 0.24 on a phone: a record's labels took half the width beside their values, and the values
 * were cut — "+20 100 912 4…", "salma.adel@glo…", "17 Oct 20…", "Nour El-…". On a narrow form (the form's own
 * narrow, 520px or less, as its columns and `hideOn` count it) every label goes above its value, a page's "beside"
 * too, in every theme: the value has the whole width.
 */

const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };

async function onPhone(browser: Browser, query: string): Promise<{ page: Page; problems: string[]; close: () => Promise<void> }> {
  // Firefox has no phone to be: its width alone.
  const context = await browser.newContext(browser.browserType().name() === 'firefox' ? { viewport: PHONE.viewport } : PHONE);
  const page = await context.newPage();
  const { problems } = await open(page, 'plain', query);
  return { page, problems, close: () => context.close() };
}

/** Every field shown with a label in sight: whether its label sits above its value, and the value as wide as the field. */
const laidOut = (page: Page) =>
  page.locator('.fd-form .fd-field[data-labels="beside"]:visible').evaluateAll((fields) =>
    fields.flatMap((field) => {
      const label = field.querySelector(':scope > .fd-label') as HTMLElement | null;
      const value = [...field.children].find((child) => !child.matches('.fd-label, .fd-help, .fd-error, .fd-warning, [hidden]')) as HTMLElement | undefined;
      if (!label || !value || !label.offsetWidth || !value.offsetWidth) return [];
      const l = label.getBoundingClientRect();
      const v = value.getBoundingClientRect();
      const f = field.getBoundingClientRect();
      // Its value starts where the field starts: nothing beside it before it.
      const start = getComputedStyle(field).direction === 'rtl' ? Math.abs(v.right - f.right) : Math.abs(v.left - f.left);
      return [{ field: field.getAttribute('data-node'), above: l.bottom <= v.top + 1, wide: start <= 2 }];
    })
  );
/** A box whose words are wider than it shows: cut. */
const cut = (page: Page, id: string) => node(page, id).locator('input').first().evaluate((box: HTMLInputElement) => box.scrollWidth > box.clientWidth + 1);

test.describe('a record on a phone: labels above their values, values whole', () => {
  for (const [what, query, named] of [
    ['an employee', 'page=real-employee&record=4122&skin=underline', []],
    ['a maintenance request', 'page=real-maintenance-request&record=4371&skin=underline', []],
    ['a clinic appointment', 'page=real-clinic-appointment&record=4001&skin=underline', []],
  ] as const) {
    test(`${what}: every label above its value, the value from the field’s start`, async ({ browser }) => {
      const { page, problems, close } = await onPhone(browser, query);
      const fields = await laidOut(page);
      expect(fields.length, 'fields with their labels beside on the page').toBeGreaterThan(4);
      expect(fields.filter((one) => !one.above).map((one) => one.field), 'labels beside their values').toEqual([]);
      expect(fields.filter((one) => !one.wide).map((one) => one.field), 'values set in from their field’s start').toEqual([]);
      for (const id of named) expect(await cut(page, id), `${id} cut`).toBe(false);
      await screen(page, `phone-labels-${what.replace(/\W+/g, '-')}`, { viewport: true });
      await page.evaluate(() => window.scrollBy(0, 700));
      await screen(page, `phone-labels-${what.replace(/\W+/g, '-')}-scrolled`, { viewport: true });
      expect(problems).toEqual([]);
      await close();
    });
  }

  test('the walk’s values in full: the work mobile and email, the scheduled date, the patient', async ({ browser }) => {
    const employee = await onPhone(browser, 'page=real-employee&record=4122&skin=underline');
    for (const label of ['Work Mobile', 'Work Email']) {
      const box = employee.page.locator('.fd-form .fd-field', { has: employee.page.locator('.fd-label', { hasText: new RegExp(`^${label}`) }) }).locator('input').first();
      await box.scrollIntoViewIfNeeded();
      expect(await box.evaluate((el: HTMLInputElement) => el.scrollWidth <= el.clientWidth + 1), `${label} cut`).toBe(true);
    }
    await employee.close();
    const request = await onPhone(browser, 'page=real-maintenance-request&record=4371&skin=underline');
    const date = request.page.locator('.fd-form .fd-field', { has: request.page.locator('.fd-label', { hasText: /^Scheduled Date/ }) }).locator('input').first();
    expect(await date.evaluate((el: HTMLInputElement) => el.scrollWidth <= el.clientWidth + 1), 'Scheduled Date cut').toBe(true);
    await request.close();
  });

  test('in a theme and dark, the same', async ({ browser }) => {
    for (const look of ['theme=bootstrap', 'theme=material&scheme=dark', 'theme=odoo']) {
      const { page, problems, close } = await onPhone(browser, `page=real-employee&record=4122&skin=underline&${look}`);
      const fields = await laidOut(page);
      expect(fields.length).toBeGreaterThan(4);
      expect(fields.filter((one) => !one.above).map((one) => one.field), `${look}: labels beside`).toEqual([]);
      // The name has the room its words need: the photo goes under it, never "Salm / a Adel".
      expect((await node(page, '#title').boundingBox())!.width, `${look}: the title squeezed`).toBeGreaterThan(250);
      await screen(page, `phone-labels-employee-${look.replace(/\W+/g, '-')}`, { viewport: true });
      expect(problems).toEqual([]);
      await close();
    }
  });

  test('on a desktop the labels stay beside their values', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const { problems } = await open(page, 'plain', 'page=real-employee&record=4122&skin=underline');
    const fields = await laidOut(page);
    expect(fields.length).toBeGreaterThan(4);
    expect(fields.filter((one) => one.above).map((one) => one.field), 'labels above on a desktop').toEqual([]);
    expect(problems).toEqual([]);
  });
});
