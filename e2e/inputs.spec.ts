import { expect, test, type Locator, type Page } from '@playwright/test';
import { addField, editing, tile, watch } from './designer-support';
import { expectNoSidewaysScroll, node, open, screen } from './support';

/**
 * The text, number and date kinds' details, used as a person uses them: web
 * addresses, phones and emails that say what to type; a count of characters;
 * a unit inside a number's box and a currency's symbol; hearts and an NPS
 * scale; a day, a date and time and a time that keep their limits — on the
 * "Office move" and "Every field" examples, at a phone's width and right to
 * left; then each setting in the screen designer and the survey designer,
 * seen on the card and in Try it.
 */

const valueOf = (page: Page, field: string) => page.evaluate((name) => (window as any).fieldiaDemo.handle.form.getState().values[name], field);
const errorOf = (page: Page, id: string) => node(page, id).locator('.fd-error');
const pad = (n: number) => String(n).padStart(2, '0');
/** A day counted from today, as a date input takes it; with `weekday` (0 Sunday … 6 Saturday), the first such day from then on. */
function dayFrom(offset: number, weekday?: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  while (weekday !== undefined && d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
async function box(locator: Locator) {
  const found = await locator.boundingBox();
  if (!found) throw new Error('not on screen');
  return found;
}

test.describe('the inputs’ details in the viewer', () => {
  let problems: string[] = [];
  test.beforeEach(async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=kinds&skin=outlined'));
  });
  test.afterEach(() => expect(problems).toEqual([]));

  /** Send the page, so every answer is checked and its problem shown. */
  const send = (page: Page) => page.getByRole('button', { name: 'Submit' }).click();

  test('a day keeps its limits and its working days, the picker too, and says which', async ({ page }) => {
    const day = node(page, 'q-move-day').locator('input');
    await expect(day).toHaveAttribute('min', dayFrom(0));
    await expect(day).toHaveAttribute('max', dayFrom(60));
    await day.fill(dayFrom(1, 5));
    await send(page);
    await expect(errorOf(page, 'q-move-day')).toHaveText('Which day shall we move your things? can’t be on a Friday or Saturday');
    await day.fill(dayFrom(90, 1));
    await expect(errorOf(page, 'q-move-day')).toContainText('Which day shall we move your things? can’t be after ');
    await day.fill(dayFrom(1, 0));
    await expect(errorOf(page, 'q-move-day')).toBeHidden();
    await node(page, 'q-move-day').scrollIntoViewIfNeeded();
    await screen(page, 'inputs-date', { viewport: true });
  });

  test('a time of day steps by a quarter hour between its earliest and latest', async ({ page }) => {
    const time = node(page, 'q-arrival').locator('input');
    await expect(time).toHaveAttribute('type', 'time');
    await expect(time).toHaveAttribute('step', '900');
    await time.fill('06:30');
    await send(page);
    await expect(errorOf(page, 'q-arrival')).toHaveText('What time will you arrive on your first day? can’t be before 07:00');
    await time.fill('08:45');
    await expect(errorOf(page, 'q-arrival')).toBeHidden();
    expect(await valueOf(page, 'arrival')).toBe('08:45');
  });

  test('a phone number with too few digits says how to write one, and the browser may fill it', async ({ page }) => {
    const phone = node(page, 'q-mobile').locator('input');
    await expect(phone).toHaveAttribute('autocomplete', 'tel');
    await phone.fill('0100 12');
    await send(page);
    await expect(errorOf(page, 'q-mobile')).toHaveText('Enter a phone number, like +20 100 123 4567');
    await phone.fill('+20 100 123 4567');
    await expect(errorOf(page, 'q-mobile')).toBeHidden();
    // What was typed is kept as typed.
    expect(await valueOf(page, 'mobile')).toBe('+20 100 123 4567');
  });

  test('a weight shows its unit inside its box, after the number', async ({ page }) => {
    const input = node(page, 'q-boxes').locator('input');
    const unit = node(page, 'q-boxes').locator('.fd-unit');
    await expect(unit).toHaveText('kg');
    await input.fill('12.5');
    await input.blur();
    expect(await valueOf(page, 'boxes')).toBe(12.5);
    const [field, kg] = [await box(input), await box(unit)];
    // Inside, at its end, and clear of the number.
    expect(kg.x).toBeGreaterThan(field.x + field.width / 2);
    expect(kg.x + kg.width).toBeLessThanOrEqual(field.x + field.width);
    expect(kg.y).toBeGreaterThanOrEqual(field.y);
    expect(kg.y + kg.height).toBeLessThanOrEqual(field.y + field.height);
    await node(page, 'q-boxes').scrollIntoViewIfNeeded();
    await screen(page, 'inputs-number-unit', { viewport: true });
  });

  test('hearts fill up to the one picked, with words at each end', async ({ page }) => {
    const mood = node(page, 'q-mood');
    await mood.getByRole('radio', { name: '4 of 5' }).click();
    expect(await valueOf(page, 'mood')).toBe(4);
    await expect(mood.locator('.fd-rating-heart .fd-on')).toHaveCount(4);
    await expect(mood.locator('.fd-scale-ends span')).toHaveText(['Worried', 'Can’t wait']);
    const [on, off] = [await mood.locator('.fd-on').first().evaluate((b) => getComputedStyle(b).color), await mood.locator('button[role=radio]:not(.fd-on)').first().evaluate((b) => getComputedStyle(b).color)];
    expect(on).not.toBe(off);
  });

  test('an NPS scale tells its three groups apart by colour and by a gap', async ({ page }) => {
    const nps = node(page, 'q-recommend');
    await nps.scrollIntoViewIfNeeded();
    const point = (n: number) => nps.locator(`[data-value="${n}"]`);
    const ground = (n: number) => point(n).evaluate((b) => getComputedStyle(b).backgroundColor);
    expect(new Set([await ground(0), await ground(7), await ground(9)]).size).toBe(3);
    expect(await ground(6)).toBe(await ground(0));
    // Not by colour alone: a wider gap between the groups.
    const gap = async (a: number, b: number) => (await box(point(b))).x - ((await box(point(a))).x + (await box(point(a))).width);
    expect(await gap(6, 7)).toBeGreaterThan((await gap(5, 6)) + 4);
    await point(9).click();
    await expect(point(9)).toHaveAttribute('aria-checked', 'true');
    await expect(nps.locator('.fd-scale-ends span')).toHaveText(['Not at all likely', 'Extremely likely']);
    await screen(page, 'inputs-rating-nps', { viewport: true });
  });

  test('a paragraph counts its characters, near its most in the warning colour, and grows as it is typed in', async ({ page }) => {
    const wishes = node(page, 'q-wishes');
    const area = wishes.locator('textarea');
    const count = wishes.locator('.fd-count');
    await expect(count).toHaveText('0 / 300');
    await expect(area).toHaveAttribute('rows', '2');
    await expect(area).toHaveAttribute('maxlength', '300');
    const before = (await box(area)).height;
    await area.fill('Fragile: the plants.\nThe big monitor.\nThe chair with the cushion.\nMy books, in four boxes.');
    await expect(count).toHaveText('90 / 300');
    expect((await box(area)).height).toBeGreaterThan(before + 20);
    const plain = await count.evaluate((c) => getComputedStyle(c).color);
    await area.fill('x'.repeat(280));
    await expect(count).toHaveText('280 / 300');
    expect(await count.evaluate((c) => getComputedStyle(c).color)).not.toBe(plain);
    // The box stops at the most.
    await area.press('End');
    await page.keyboard.type('y'.repeat(40));
    expect(((await valueOf(page, 'wishes')) as string).length).toBe(300);
    // Said to a screen reader once typing pauses.
    await expect(wishes.locator('[aria-live=polite]')).toHaveText('Characters left: 0');
    await wishes.scrollIntoViewIfNeeded();
    await screen(page, 'inputs-paragraph-count', { viewport: true });
  });

  test('a slider has words under its ends', async ({ page }) => {
    await expect(node(page, 'q-commute').locator('.fd-slider-word')).toHaveText(['Next door', 'Three hours']);
  });

  test('the moving day fits a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await expectNoSidewaysScroll(page);
    await page.locator('[data-node="s-day"], .fd-section:has([data-node="q-move-day"])').first().scrollIntoViewIfNeeded();
    await screen(page, 'inputs-phone');
    await page.setViewportSize({ width: 390, height: 1400 });
    await node(page, 'q-move-day').scrollIntoViewIfNeeded();
    await screen(page, 'inputs-phone-moving-day', { viewport: true });
  });

  test('reads well in the dark scheme', async ({ page }) => {
    await open(page, 'plain', 'page=kinds&skin=outlined&scheme=dark');
    await node(page, 'q-recommend').getByRole('radio', { name: '8' }).click().catch(() => node(page, 'q-recommend').locator('[data-value="8"]').click());
    await node(page, 'q-mood').scrollIntoViewIfNeeded();
    await screen(page, 'inputs-dark', { viewport: true });
  });
});

test.describe('the inputs’ details right to left, in Arabic', () => {
  let problems: string[] = [];
  test.beforeEach(async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=kinds&skin=outlined&locale=ar&dir=rtl'));
  });
  test.afterEach(() => expect(problems).toEqual([]));

  test('the unit sits at the box’s end, on the left; the scale runs from the right; the checks speak Arabic', async ({ page }) => {
    const weight = node(page, 'q-boxes');
    const [field, unit] = [await box(weight.locator('input')), await box(weight.locator('.fd-unit'))];
    expect(unit.x + unit.width).toBeLessThan(field.x + field.width / 2);
    const nps = node(page, 'q-recommend');
    expect((await box(nps.locator('[data-value="0"]'))).x).toBeGreaterThan((await box(nps.locator('[data-value="10"]'))).x);
    await expect(nps.locator('[data-value="3"]')).toHaveAttribute('data-tone', 'low');
    await node(page, 'q-mood').getByRole('radio', { name: '3 من 5' }).click();
    await node(page, 'q-mobile').locator('input').fill('12');
    await page.getByRole('button', { name: /إرسال|Submit/ }).click();
    await expect(node(page, 'q-mobile').locator('.fd-error')).toHaveText('أدخل رقم هاتف، مثل ⁦+20 100 123 4567⁩');
    await expectNoSidewaysScroll(page);
    await node(page, 'q-move-day').scrollIntoViewIfNeeded();
    await screen(page, 'inputs-ar-moving-day', { viewport: true });
    await node(page, 'q-wishes').scrollIntoViewIfNeeded();
    await screen(page, 'inputs-ar-ratings', { viewport: true });
  });
});

test.describe('web addresses, phones, emails and money', () => {
  test('a record’s web address, phone and email say what to type', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=fields&skin=outlined');
    await node(page, 'f-portal').locator('input').fill('the client portal');
    await node(page, 'f-phone').locator('input').fill('call me');
    await node(page, 'f-email').locator('input').fill('site@');
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(errorOf(page, 'f-portal')).toHaveText('Enter a web address, like example.com');
    await expect(errorOf(page, 'f-phone')).toHaveText('Enter a phone number, like +20 100 123 4567');
    await expect(errorOf(page, 'f-email')).toHaveText('Enter an email address, like name@example.com');
    await node(page, 'f-email').scrollIntoViewIfNeeded();
    await screen(page, 'inputs-web-phone-email', { viewport: true });
    await node(page, 'f-portal').locator('input').fill('portal.niletraders.example');
    await node(page, 'f-phone').locator('input').fill('(02) 2345-6700');
    await node(page, 'f-email').locator('input').fill('site@niletraders.example');
    await expect(page.locator('[data-node="f-portal"] .fd-error, [data-node="f-phone"] .fd-error, [data-node="f-email"] .fd-error')).toHaveCount(3);
    for (const id of ['f-portal', 'f-phone', 'f-email']) await expect(errorOf(page, id)).toBeHidden();
    await expect(node(page, 'f-portal').locator('input')).toHaveAttribute('autocomplete', 'url');
    await expect(node(page, 'f-email').locator('input')).toHaveAttribute('autocomplete', 'email');
    expect(problems).toEqual([]);
  });

  test('an amount shows its currency’s symbol, inside its box', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=signup&skin=outlined');
    const ticket = node(page, 'f-ticket');
    await expect(ticket.locator('.fd-currency')).toHaveText('E£');
    const [field, symbol] = [await box(ticket.locator('input')), await box(ticket.locator('.fd-currency'))];
    expect(symbol.x).toBeGreaterThanOrEqual(field.x);
    expect(symbol.x + symbol.width).toBeLessThanOrEqual(field.x + field.width);
    await ticket.scrollIntoViewIfNeeded();
    await screen(page, 'inputs-amount-symbol', { viewport: true });
    expect(problems).toEqual([]);
  });
});

/** The screen designer: each setting set in the field itself, seen on its card, then in Try it. */
test.describe('the inputs’ settings in the screen designer', () => {
  let problems: string[] = [];
  const card = (page: Page) => editing(page).card;
  const setting = (page: Page, name: string) => card(page).getByLabel(name, { exact: true });
  test.beforeEach(async ({ page }) => {
    problems = watch(page);
    await page.goto('/screen/?start=blank');
    await expect(page.locator('.fd-toolbox')).toBeVisible();
  });
  test.afterEach(() => expect(problems).toEqual([]));

  test('text: most characters with a count, a paragraph’s rows; a number’s range, decimals and unit; an amount’s', async ({ page }) => {
    await addField(page, 'short-answer', 'Project name');
    await setting(page, 'Most characters').fill('40');
    await setting(page, 'Most characters').press('Tab');
    await expect(card(page).locator('.fd-count')).toHaveText('0 / 40');
    await screen(page, 'inputs-designer-short-answer', { viewport: true });

    await addField(page, 'paragraph', 'Scope of work');
    await setting(page, 'Most characters').fill('500');
    await setting(page, 'Most characters').press('Tab');
    await setting(page, 'Rows').selectOption('5');
    await expect(card(page).locator('textarea')).toHaveAttribute('rows', '5');
    await screen(page, 'inputs-designer-paragraph', { viewport: true });

    await addField(page, 'number', 'Floor area');
    await setting(page, 'From').fill('10');
    await setting(page, 'To').fill('5000');
    await setting(page, 'To').press('Tab');
    await setting(page, 'Decimals').selectOption('1');
    await setting(page, 'Unit after').fill('m²');
    await expect(card(page).locator('.fd-unit')).toHaveText('m²');
    await screen(page, 'inputs-designer-number', { viewport: true });

    await addField(page, 'amount', 'Budget');
    await setting(page, 'Currency').fill('EUR');
    await setting(page, 'Decimals').selectOption('0');
    await expect(card(page).locator('.fd-currency')).toHaveText('€');
    await screen(page, 'inputs-designer-amount', { viewport: true });

    await page.getByRole('button', { name: 'Try it' }).click();
    const tried = page.locator('.fd-try');
    await expect(tried.locator('.fd-count')).toHaveText(['0 / 40', '0 / 500']);
    await tried.getByLabel('Project name').fill('Nile Towers fit-out');
    await expect(tried.locator('.fd-count').first()).toHaveText('19 / 40');
    await tried.getByLabel('Floor area').fill('5200');
    await tried.getByLabel('Budget').fill('12000');
    await expect(tried.locator('.fd-unit')).toHaveText(['m²', '€']);
    await screen(page, 'inputs-designer-text-numbers-try', { viewport: true });
  });

  test('ratings, scales, dates, times, keywords and progress, each on its card and in Try it', async ({ page }) => {
    await addField(page, 'rating', 'Site visit');
    await setting(page, 'Icon').selectOption('thumb');
    await setting(page, 'Words at the start').fill('Poor');
    await setting(page, 'Words at the end').fill('Great');
    await expect(card(page).locator('.fd-rating-thumb svg')).toHaveCount(5);
    await screen(page, 'inputs-designer-rating', { viewport: true });

    await addField(page, 'scale', 'Recommend us');
    await card(page).getByRole('button', { name: 'Make it NPS' }).click();
    await card(page).getByRole('switch', { name: 'Colour as NPS' }).click();
    await expect(card(page).locator('.fd-nps [data-tone="high"]')).toHaveCount(2);
    await screen(page, 'inputs-designer-nps', { viewport: true });

    await addField(page, 'date', 'Visit day');
    await setting(page, 'Earliest').selectOption('today');
    await setting(page, 'Latest').selectOption('after');
    await setting(page, 'Days after today, latest').fill('30');
    await setting(page, 'Days after today, latest').press('Tab');
    await setting(page, 'Weekends').selectOption('fri-sat');
    await card(page).getByRole('switch', { name: 'Starts on today' }).click();
    await expect(card(page).locator('.fd-canvas-widget input[type=date]')).toHaveAttribute('max', dayFrom(30));
    await screen(page, 'inputs-designer-date', { viewport: true });

    await addField(page, 'date-time', 'Meeting');
    await setting(page, 'Minutes').selectOption('15');
    await expect(card(page).locator('.fd-canvas-widget input[type=datetime-local]')).toHaveAttribute('step', '900');

    await addField(page, 'time', 'Arrival');
    await setting(page, 'Earliest time').fill('09:00');
    await setting(page, 'Latest time').fill('17:00');
    await setting(page, 'Minutes').selectOption('30');
    await expect(card(page).locator('.fd-canvas-widget input[type=time]')).toHaveAttribute('min', '09:00');
    await screen(page, 'inputs-designer-time', { viewport: true });

    await addField(page, 'keywords', 'Materials');
    await setting(page, 'Suggestions, one a line').fill('oak\nglass\nsteel');
    await setting(page, 'At most').fill('2');
    await setting(page, 'At most').press('Tab');
    await screen(page, 'inputs-designer-keywords', { viewport: true });

    await addField(page, 'progress', 'Hours used');
    await setting(page, 'Most').fill('320');
    await setting(page, 'Most').press('Tab');
    await setting(page, 'Colour').selectOption('info');
    await expect(card(page).locator('[role=progressbar]')).toHaveAttribute('data-tone', 'info');
    await screen(page, 'inputs-designer-progress', { viewport: true });

    await page.getByRole('button', { name: 'Try it' }).click();
    const tried = page.locator('.fd-try');
    await expect(tried.locator('.fd-rating-thumb')).toBeVisible();
    await expect(tried.locator('.fd-nps')).toBeVisible();
    // Starts on today, and a Friday is refused once the answers are checked.
    await expect(tried.getByLabel('Visit day')).toHaveValue(dayFrom(0));
    await tried.getByLabel('Visit day').fill(dayFrom(1, 5));
    await tried.getByLabel('Arrival').fill('08:00');
    const materials = tried.getByRole('combobox');
    await materials.click();
    await expect(tried.getByRole('option')).toHaveText(['oak', 'glass', 'steel']);
    await tried.getByRole('option', { name: 'oak' }).click();
    await materials.fill('walnut,');
    await expect(materials).toBeHidden();
    await page.getByRole('button', { name: 'Problems' }).click().catch(() => undefined);
    await expect(tried.getByText('Visit day can’t be on a Friday or Saturday').first()).toBeVisible();
    await expect(tried.getByText('Arrival can’t be before 09:00').first()).toBeVisible();
    await screen(page, 'inputs-designer-try', { viewport: true });
  });

  test('the side panel has a field’s settings too, the same ones', async ({ page }) => {
    await addField(page, 'short-answer', 'Reference');
    const panel = page.locator('.fd-properties');
    await panel.getByLabel('Most characters', { exact: true }).fill('12');
    await panel.getByLabel('Most characters', { exact: true }).press('Tab');
    await expect(card(page).locator('.fd-count')).toHaveText('0 / 12');
    await expect(setting(page, 'Most characters')).toHaveValue('12');
    await screen(page, 'inputs-designer-panel', { viewport: true });
  });
});

test.describe('the inputs’ settings in the survey designer', () => {
  test('adds a Time from Numbers and dates, makes a scale NPS, and Try it keeps them', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/designer/');
    await expect(page.locator('.fd-designer')).toBeVisible();
    await expect(page.locator('.fd-toolbox [data-tool="kind:time"]')).toBeVisible();
    await tile(page, 'kind:time').click();
    await page.keyboard.type('When will you arrive?');
    const picked = page.locator('.fd-q-selected');
    await picked.getByLabel('Earliest time', { exact: true }).fill('08:00');
    await picked.getByLabel('Minutes', { exact: true }).selectOption('15');
    await screen(page, 'inputs-survey-time', { viewport: true });
    await tile(page, 'kind:scale').click();
    await page.keyboard.type('How likely are you to recommend us?');
    await picked.getByRole('button', { name: 'Make it NPS' }).click();
    await picked.getByRole('switch', { name: 'Colour as NPS' }).click();
    await screen(page, 'inputs-survey-nps', { viewport: true });
    await page.keyboard.press('Escape');
    await expect(page.locator('.fd-q').last().locator('.fd-nps')).toBeVisible();
    await page.getByRole('button', { name: 'Try it' }).click();
    const tried = page.locator('.fd-try');
    await tried.getByLabel('When will you arrive?').fill('07:30');
    await tried.locator('.fd-nps [data-value="10"]').click();
    await tried.getByRole('button', { name: /Send|Submit|Finish|Next/ }).last().click();
    await expect(tried.getByText('When will you arrive? can’t be before 08:00').first()).toBeVisible();
    await screen(page, 'inputs-survey-try', { viewport: true });
    expect(problems).toEqual([]);
  });
});
