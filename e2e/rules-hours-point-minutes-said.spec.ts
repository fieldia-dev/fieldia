import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open } from './support';

/**
 * Found by the 0.23 input-rules check (number boxes). MINOR (design). Hours typed with a point are read as decimal hours
 * (core `readDuration`): "6.45" is 6.45 h, shown once left as "06:27"; "6.30" is "06:18". Fieldia's own time of day
 * reads the same keys as a clock does ("6.45" is 06:45, core `readTime`), and core's own words say that after a point
 * "hours with a decimal are as likely as a clock's minutes" — which is why "14.5" in a time and "6:3" in hours are kept
 * unread, naming each time, "never one of them in silence". In hours, "6.45" is taken as one of them in silence.
 *
 * DECIDED (report, 16 Oct): hours stay Flectra's decimal hours — "6.45" is 6.45 h, 06:27 — but never in silence: once
 * the box is read, it says so under the box ("“6.45” is hours with a decimal: 06:27").
 */

const valueOf = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values.time_on_site as number);
const hours = (page: Page) => node(page, 'f-time-on-site').locator('input.fd-number-input').first();
const hintOf = (page: Page) => node(page, 'f-time-on-site').locator('.fd-refusal-hint:not([hidden])').first();

test.describe('hours typed with a point and two digits', () => {
  let problems: string[] = [];
  test.afterEach(() => expect(problems).toEqual([]));

  for (const [typed, decimal, value] of [
    ['6.45', '06:27', 6.45],
    ['6.30', '06:18', 6.3],
  ] as const) {
    test(`"${typed}" is hours with a decimal, ${decimal}, and the box says so — never in silence`, async ({ page }) => {
      ({ problems } = await open(page, 'plain', 'page=fields&skin=outlined'));
      const box = hours(page);
      await box.click();
      await box.press('Control+A');
      await box.pressSequentially(typed);
      await page.keyboard.press('Tab');
      expect({ shown: await box.inputValue(), kept: await valueOf(page) }).toEqual({ shown: decimal, kept: value });
      // (The typed text is set apart by direction isolates inside its quotes.)
      await expect(hintOf(page)).toContainText(new RegExp(`“\\W?${typed.replace('.', '\\.')}\\W?” is hours with a decimal: ${decimal}`));
      // The next key typed lets the words go, as every hint's do.
      await box.click();
      await box.press('End');
      await box.press('Backspace');
      await expect(hintOf(page)).toHaveCount(0);
    });
  }
});
