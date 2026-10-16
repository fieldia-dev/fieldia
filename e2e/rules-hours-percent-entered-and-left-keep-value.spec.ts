import { existsSync } from 'node:fs';
import { type Browser, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open } from './support';

/**
 * Found by the 0.23 input-rules check (number boxes). The hours box and the per cent box (duration-box.ts `shownBox`)
 * show their value rounded — hours to the minute ("06:31" for 6.51), a per cent to its places ("12.35" for 0.123456) —
 * and, as the box is left, read that rounded text back as the value. So a value with more than the box shows is changed
 * by entering the box and leaving it (Tab through the form), with nothing typed and nothing said; the form is then dirty
 * and Save writes the new value. The number box keeps such a value ("never fewer places than the value has", and "a
 * value the box held as it was entered is let be"); the rule is "never change a value silently". Hours typed as decimal
 * hours ("6.51") are changed the same way the next time the box is passed through.
 */

type State = { values: Record<string, unknown>; dirty: string[] };
const state = (page: Page) =>
  page.evaluate(() => {
    const s = (window as any).fieldiaDemo.handle.form.getState();
    return { values: s.values, dirty: s.dirty } as State;
  });
const stored = (page: Page, field: string) => page.evaluate((f) => (window as any).fieldiaDemo.dataSource.records.project[1][f], field);
const boxOf = (page: Page, id: string) => node(page, id).locator('input.fd-number-input').first();
const saveButton = (page: Page) => page.locator('.fd-form button[type="submit"].fd-button-primary').first();

/** A value with more than the box shows, as a record brings it: set, then saved, so the record holds it. */
async function recordHolds(page: Page, field: string, value: number) {
  await page.evaluate(([f, v]) => (window as any).fieldiaDemo.handle.form.setValue(f, v), [field, value] as const);
  await saveButton(page).click();
  await expect.poll(() => stored(page, field)).toBe(value);
}

/** Into the box with a click, out of it with Tab: nothing typed. */
async function passThrough(page: Page, id: string) {
  await boxOf(page, id).click();
  await page.keyboard.press('Tab');
}

async function sweep(page: Page) {
  await recordHolds(page, 'margin', 0.123456);
  await recordHolds(page, 'time_on_site', 6.51);
  await expect(boxOf(page, 'f-margin')).toHaveValue('12.35');
  await expect(boxOf(page, 'f-time-on-site')).toHaveValue('06:31');
  await passThrough(page, 'f-margin');
  await passThrough(page, 'f-time-on-site');
  const after = await state(page);
  // Nothing typed: the values stay as the record holds them, and nothing is there to save.
  expect({ margin: after.values['margin'], time_on_site: after.values['time_on_site'], dirty: after.dirty }).toEqual({ margin: 0.123456, time_on_site: 6.51, dirty: [] });
}

test.describe('hours and a per cent entered and left with nothing typed', () => {
  let problems: string[] = [];
  test.afterEach(() => expect(problems).toEqual([]));

  test('chromium: a per cent of 0.123456 and 6.51 hours stay as they are, never 0.1235 and 6.5167', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=fields&skin=outlined'));
    await sweep(page);
  });

  test('chromium: hours typed as "6.51" stay 6.51 the next time the box is passed through', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=fields&skin=outlined'));
    const hours = boxOf(page, 'f-time-on-site');
    await hours.click();
    await hours.press('Control+A');
    await hours.pressSequentially('6.51');
    await page.keyboard.press('Tab');
    expect((await state(page)).values['time_on_site']).toBe(6.51);
    await passThrough(page, 'f-time-on-site');
    expect((await state(page)).values['time_on_site']).toBe(6.51);
  });

  for (const engine of ['firefox', 'webkit'] as const) {
    test(`${engine}: a per cent of 0.123456 and 6.51 hours stay as they are`, async ({ playwright, baseURL }) => {
      // Each engine where it is installed: CI's Chromium jobs have Chromium alone; its engine job runs this file too.
      test.skip(!existsSync(playwright[engine].executablePath()), `${engine} is not installed here`);
      const browser: Browser = await playwright[engine].launch();
      try {
        const page = await browser.newPage({ baseURL });
        const found = await open(page, 'plain', 'page=fields&skin=outlined');
        await sweep(page);
        expect(found.problems).toEqual([]);
      } finally {
        await browser.close();
      }
    });
  }
});
