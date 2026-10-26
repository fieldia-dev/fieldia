import { expect, test } from './fixtures';
import { node, open, screen } from './support';
import { axeFindings } from './a11y-support';

/** A repeat field, as a person sets it: how often, which days, when it ends — kept as an iCalendar rule, said in words. */
const sessionsOf = (page: import('@playwright/test').Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values.sessions as string);

test.describe('plain · a repeat field', () => {
  test('every week on Tuesday and Thursday, six times, said in words and kept as a rule', async ({ page }) => {
    await open(page, 'plain', 'page=treatment-course&record=1&skin=outlined');
    const field = node(page, 'f-sessions');
    await field.getByRole('combobox', { name: 'Repeats' }).selectOption('WEEKLY');
    await field.getByRole('button', { name: 'Thursday' }).click();
    await expect(field.getByRole('button', { name: 'Thursday' })).toHaveAttribute('aria-pressed', 'true');
    await field.getByRole('combobox', { name: 'Ends' }).selectOption('count');
    await expect(field.locator('.fd-repeat-words')).toHaveText(/^Every week on \w+day(, \w+day)* and Thursday, 6 times$/);
    expect(await sessionsOf(page)).toMatch(/^FREQ=WEEKLY;BYDAY=.*TH;COUNT=6$/);
    // How many times, a number's box as wide as every how many's.
    const widths = await Promise.all(['.fd-repeat-every input', '.fd-repeat-count input'].map(async (box) => (await field.locator(box).boundingBox())?.width ?? 0));
    expect(Math.abs(widths[0] - widths[1])).toBeLessThan(2);
    const every = field.locator('input').first();
    await every.fill('2');
    await every.press('Tab');
    await expect(field.locator('.fd-repeat-words')).toHaveText(/^Every 2 weeks on .*Thursday, 6 times$/);
    await screen(page, 'repeat-weekly');
    // Every 0 weeks reads as no rule: kept as typed, said, the rule as it was.
    await every.fill('0');
    await every.press('Tab');
    await expect(field.locator('.fd-repeat-error')).toHaveText('A whole number, 1 or more');
    expect(await sessionsOf(page)).toMatch(/INTERVAL=2/);
  });

  /**
   * Its boxes cleared as a person clears one, key by key, and a new number typed: an emptied Every was put back to 1 at
   * once, so the 1 typed after read "11" ("Every 11 weeks"); an emptied count took the count away, Ends flipped to
   * Never, the box went from under the caret and the 6 typed after was lost. (`fill` never empties a box: it misses it.)
   */
  test('a box emptied key by key stays empty while typed in, and takes the number typed after', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=treatment-course&record=1&skin=outlined');
    const field = node(page, 'f-sessions');
    const words = field.locator('.fd-repeat-words');
    await expect(words).toHaveText('Every 2 weeks on Tuesday, 3 times');
    const every = field.getByRole('textbox', { name: 'Every' });
    const times = field.getByRole('textbox', { name: 'times', exact: true });
    for (const [box, typed] of [[every, '1'], [times, '6']] as const) {
      await box.click();
      await page.keyboard.press('End');
      for (const _ of await box.inputValue()) await page.keyboard.press('Backspace');
      await expect(box).toHaveValue('');
      await expect(box).toBeFocused();
      await page.keyboard.type(typed);
      await expect(box).toHaveValue(typed);
      await page.keyboard.press('Tab');
    }
    await expect(field.getByRole('combobox', { name: 'Ends' })).toHaveValue('count');
    await expect(words).toHaveText('Every week on Tuesday, 6 times');
    expect(await sessionsOf(page)).toBe('FREQ=WEEKLY;BYDAY=TU;COUNT=6');
    expect(problems).toEqual([]);
  });

  test('a month on its first weekday, until a day', async ({ page }) => {
    await open(page, 'plain', 'page=treatment-course&record=2&skin=outlined');
    const field = node(page, 'f-sessions');
    await expect(field.locator('.fd-repeat-words')).toHaveText(/^Every month on the first Saturday, 6 times$/);
    await field.getByRole('combobox', { name: 'Ends' }).selectOption('until');
    await expect(field.locator('.fd-repeat-words')).toHaveText(/^Every month on the first Saturday, until \d{1,2} \w{3} \d{4}$/);
    await screen(page, 'repeat-monthly');
    // Every box of it named, the last day's too.
    expect(await axeFindings(page, 'a repeat field ending on a day', '[data-node="f-sessions"]')).toEqual([]);
  });
});
