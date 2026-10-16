import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open } from './support';

/**
 * Found by the 0.23 input-rules check (number boxes). MINOR (design). Hours typed with a point are read as decimal hours
 * (core `readDuration`): "6.45" is 6.45 h, shown once left as "06:27"; "6.30" is "06:18". Fieldia's own time of day
 * reads the same keys as a clock does ("6.45" is 06:45, core `readTime`), and core's own words say that after a point
 * "hours with a decimal are as likely as a clock's minutes" — which is why "14.5" in a time and "6:3" in hours are kept
 * unread, naming each time, "never one of them in silence". In hours, "6.45" is taken as one of them in silence.
 */

const valueOf = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values.time_on_site as number);
const hours = (page: Page) => node(page, 'f-time-on-site').locator('input.fd-number-input').first();
const errorOf = (page: Page) => node(page, 'f-time-on-site').locator('.fd-error').first();

test.describe('hours typed with a point and two digits', () => {
  let problems: string[] = [];
  test.afterEach(() => expect(problems).toEqual([]));

  for (const [typed, clock] of [
    ['6.45', '06:45'],
    ['6.30', '06:30'],
  ] as const) {
    test(`"${typed}" is ${clock}, or the box names both ways it reads — never the other one in silence`, async ({ page }) => {
      ({ problems } = await open(page, 'plain', 'page=fields&skin=outlined'));
      const box = hours(page);
      await box.click();
      await box.press('Control+A');
      await box.pressSequentially(typed);
      await page.keyboard.press('Tab');
      const said = (await errorOf(page).isVisible()) ? await errorOf(page).textContent() : '';
      expect(said ? 'said why' : `shown ${await box.inputValue()}, kept ${await valueOf(page)}`).toMatch(new RegExp(`said why|shown ${clock}`));
    });
  }
});
