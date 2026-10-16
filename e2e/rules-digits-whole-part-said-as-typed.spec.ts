import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open } from './support';

/**
 * Found by the 0.23 input-rules check (number boxes). MINOR. A field's `digits` is [precision, scale], as Flectra's:
 * Floor area [10, 1] holds at most 9 whole digits, an hourly rate [8, 2] at most 6. The box counts the whole part and
 * the places together against the precision (core `couldBeNumber` / `numberMisfit`: whole + places <= digits[0]), so it
 * takes "1234567890" in Floor area as typed and as it is left; check (core check.ts) counts the whole part against
 * precision - scale and refuses it under the box with "takes at most 10 digits" — for a number of 10 digits. The person
 * is told a rule their number keeps. A digit the field can never hold should be refused as it is typed, as the 16th is,
 * or the words should say the whole part's limit.
 */

const formState = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().errors as Record<string, string>);
const boxOf = (page: Page, id: string) => node(page, id).locator('input.fd-number-input').first();

test.describe('a field’s digits as typed', () => {
  let problems: string[] = [];
  test.afterEach(() => expect(problems).toEqual([]));

  for (const [where, id, field, typed, most] of [
    ['fields', 'f-area', 'area', '1234567890', 10],
    ['signup', 'f-rate', 'hourly_rate', '1234567.5', 8],
  ] as const) {
    test(`${where}: "${typed}" in a field of ${most} digits is never taken as typed and then refused for having more than ${most}`, async ({ page }) => {
      ({ problems } = await open(page, 'plain', `page=${where}&skin=outlined`));
      const box = boxOf(page, id);
      await box.click();
      await box.press('Control+A');
      await box.pressSequentially(typed);
      const taken = await box.inputValue();
      await page.keyboard.press('Tab');
      const said = (await formState(page))[field] ?? '';
      // Either refused as typed (a digit the field cannot hold never lands), or no words that the number does not break.
      expect(`box took "${taken}", then said: ${said}`).not.toMatch(new RegExp(`took "${typed.replace('.', '\\.')}".*at most ${most} digits`));
    });
  }
});
