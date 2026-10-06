import { expect, test, type Locator, type Page } from '@playwright/test';
import { axeFindings } from './a11y-support';
import { expectNoSidewaysScroll, open, screen } from './support';

/**
 * A panel from each side (`openFormPanel({ side })`), as a person picks it on
 * "Every field" in the plain demo — Right, Left, Top or Bottom beside “Log a
 * call in a side panel”: where each settles against the screen's edges, the
 * edge each slides in from, right to left (the end of the line is the left,
 * Right and Left stay put), at a phone's width, in the dark scheme, swept by
 * axe; and, from the one-tag script, the start of the line, and a panel over
 * a panel stepping the older one back from its own edge.
 */

const WIDE = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };
const opener = (page: Page) => page.getByRole('button', { name: 'Log a call in a side panel' });
const sides = (page: Page) => page.getByRole('radiogroup', { name: 'from' });
const pick = (page: Page, side: string) => sides(page).getByRole('radio', { name: side }).check();
/** Wait for the panel to finish sliding in, so what is measured is where it settles. */
const slidIn = (panel: Locator) => panel.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)).then(() => undefined));
const place = async (panel: Locator) => {
  const box = (await panel.boundingBox())!;
  return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) };
};
/** Where the panel's slide starts: its animation held at the first frame, then let finish. */
const slideStart = (panel: Locator) =>
  panel.evaluate((el) => {
    const slides = el.getAnimations();
    if (slides.length !== 1 || (slides[0] as CSSAnimation).animationName !== 'fd-slide') return null;
    slides[0].pause();
    slides[0].currentTime = 0;
    const { x, y } = el.getBoundingClientRect();
    slides[0].finish();
    return { x: Math.round(x), y: Math.round(y) };
  });

async function openFrom(page: Page, side: string, name = 'Log a call') {
  await pick(page, side);
  await opener(page).click();
  const panel = page.getByRole('dialog', { name });
  await expect(panel).toBeVisible();
  return panel;
}

test('the bar offers Right, Left, Top and Bottom, the end of the line picked until another is', async ({ page }) => {
  await page.setViewportSize(WIDE);
  await open(page, 'plain', 'page=fields&skin=outlined');
  await expect(sides(page).getByRole('radio')).toHaveCount(4);
  await expect(sides(page).getByRole('radio', { name: 'Right' })).toBeChecked();
  // One stop for Tab, the arrows going round the four.
  await opener(page).focus();
  await page.keyboard.press('Tab');
  await expect(sides(page).getByRole('radio', { name: 'Right' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(sides(page).getByRole('radio', { name: 'Left' })).toBeChecked();
  expect(await axeFindings(page, 'the side picker')).toEqual([]);
  await screen(page, 'panel-sides-bar', { viewport: true });
});

test('each side settles at its own edge: the right and left the whole height, the top and bottom the whole width, 60 in a hundred tall', async ({ page }) => {
  await page.setViewportSize(WIDE);
  await open(page, 'plain', 'page=fields&skin=outlined');
  const expected = {
    Right: { x: WIDE.width - 560, y: 0, width: 560, height: WIDE.height },
    Left: { x: 0, y: 0, width: 560, height: WIDE.height },
    Top: { x: 0, y: 0, width: WIDE.width, height: 480 },
    Bottom: { x: 0, y: WIDE.height - 480, width: WIDE.width, height: 480 },
  };
  for (const [side, box] of Object.entries(expected)) {
    const panel = await openFrom(page, side);
    await slidIn(panel);
    expect(await place(panel), side).toEqual(box);
    // Its own head and foot, the focus in its first field, the page behind dimmed.
    await expect(panel.locator('[data-node="call-name"] input')).toBeFocused();
    await expect(panel.locator('.fd-form-dialog-foot').getByRole('button')).toHaveText(['Discard', 'Save & Close']);
    const foot = (await panel.locator('.fd-form-dialog-foot').boundingBox())!;
    expect(Math.round(foot.y + foot.height), `${side}: its foot at its own bottom`).toBe(box.y + box.height);
    await panel.locator('[data-node="call-name"] input').fill(`Called from the ${side.toLowerCase()}`);
    await screen(page, `panel-side-${side.toLowerCase()}`, { viewport: true });
    // Escape asks first, as from the end; Discard leaves, the focus back on the button.
    await page.keyboard.press('Escape');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Discard' }).click();
    await expect(panel).toBeHidden();
    await expect(opener(page)).toBeFocused();
  }
});

test('each slides in from its own edge, only when motion is welcome', async ({ page }) => {
  await page.setViewportSize(WIDE);
  await open(page, 'plain', 'page=fields&skin=outlined');
  const panel = page.getByRole('dialog', { name: 'Log a call' });
  // Just past its edge, as deep as itself.
  const starts = { Right: { x: WIDE.width, y: 0 }, Left: { x: -560, y: 0 }, Top: { x: 0, y: -480 }, Bottom: { x: 0, y: WIDE.height } };
  for (const [side, start] of Object.entries(starts)) {
    await openFrom(page, side);
    expect(await slideStart(panel), side).toEqual(start);
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openFrom(page, 'Top');
  expect(await panel.evaluate((el) => el.getAnimations().length)).toBe(0);
});

test('right to left in Arabic: the end of the line is the left, picked first; Right and Top stay where they are', async ({ page }) => {
  await page.setViewportSize(WIDE);
  await open(page, 'plain', 'page=fields&skin=outlined&locale=ar&dir=rtl');
  await expect(sides(page).getByRole('radio', { name: 'Left' })).toBeChecked();
  const panel = page.getByRole('dialog', { name: 'تسجيل مكالمة' });
  // Unpicked, the end of the line: the left, from the left.
  await opener(page).click();
  expect(await slideStart(panel)).toEqual({ x: -560, y: 0 });
  expect(await place(panel)).toEqual({ x: 0, y: 0, width: 560, height: WIDE.height });
  await page.keyboard.press('Escape');
  await openFrom(page, 'Right', 'تسجيل مكالمة');
  expect(await slideStart(panel)).toEqual({ x: WIDE.width, y: 0 });
  expect(await place(panel)).toEqual({ x: WIDE.width - 560, y: 0, width: 560, height: WIDE.height });
  // In Arabic, its head right to left: the title at the right, × at the left.
  const [title, close] = [(await panel.locator('.fd-form-dialog-title').boundingBox())!, (await panel.getByRole('button', { name: 'إغلاق', exact: true }).boundingBox())!];
  expect(close.x).toBeLessThan(title.x);
  await screen(page, 'panel-side-arabic-right', { viewport: true });
  await page.keyboard.press('Escape');
  await openFrom(page, 'Top', 'تسجيل مكالمة');
  await slidIn(panel);
  expect(await place(panel)).toEqual({ x: 0, y: 0, width: WIDE.width, height: 480 });
  await screen(page, 'panel-side-arabic-top', { viewport: true });
  expect(await axeFindings(page, 'panel from the top, in Arabic')).toEqual([]);
});

test('at a phone’s width every side fills the screen: the top slides down from above, the rest up from below', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await open(page, 'plain', 'page=fields&skin=outlined');
  // The bar wraps, the picker whole, nothing to scroll sideways.
  await expectNoSidewaysScroll(page);
  const picker = (await sides(page).boundingBox())!;
  expect(picker.x + picker.width).toBeLessThanOrEqual(PHONE.width);
  const panel = page.getByRole('dialog', { name: 'Log a call' });
  const starts = { Right: { x: 0, y: PHONE.height }, Left: { x: 0, y: PHONE.height }, Top: { x: 0, y: -PHONE.height }, Bottom: { x: 0, y: PHONE.height } };
  for (const [side, start] of Object.entries(starts)) {
    await openFrom(page, side);
    expect(await slideStart(panel), side).toEqual(start);
    expect(await place(panel), side).toEqual({ x: 0, y: 0, ...PHONE });
    const foot = (await panel.locator('.fd-form-dialog-foot').boundingBox())!;
    expect(Math.round(foot.y + foot.height), `${side}: its foot on the screen`).toBe(PHONE.height);
    await expectNoSidewaysScroll(page);
    if (side === 'Top') {
      await panel.locator('[data-node="call-name"] input').fill('Prices for the spring order');
      await screen(page, 'panel-side-phone-top', { viewport: true });
      expect(await axeFindings(page, 'panel from the top on a phone')).toEqual([]);
    }
    await page.keyboard.press('Escape');
    if (side === 'Top') await page.getByRole('alertdialog').getByRole('button', { name: 'Discard' }).click();
    await expect(panel).toBeHidden();
  }
  await screen(page, 'panel-sides-phone-bar', { viewport: true });
});

test('in the dark scheme, from the bottom: its box and page dark, and axe finds nothing', async ({ page }) => {
  await page.setViewportSize(WIDE);
  await open(page, 'plain', 'page=fields&skin=outlined&scheme=dark');
  const panel = await openFrom(page, 'Bottom');
  await slidIn(panel);
  expect(await panel.evaluate((el) => [getComputedStyle(el).colorScheme, getComputedStyle(el).backgroundColor])).toEqual(['dark', 'rgb(22, 25, 30)']);
  await panel.locator('[data-node="call-name"] input').fill('Prices for the spring order');
  await screen(page, 'panel-side-dark-bottom', { viewport: true });
  expect(await axeFindings(page, 'panel from the bottom, dark')).toEqual([]);
});

/** From the one-tag script: Fieldia.openFormPanel with the options given, its title its name. */
async function scriptPanel(page: Page, title: string, more: Record<string, unknown>) {
  await page.evaluate(
    ({ title, more }) => {
      const { Fieldia, fieldiaDemo } = window as any;
      Fieldia.openFormPanel({ page: { ...fieldiaDemo.page, title }, title, mode: 'values', skin: 'outlined', ...more });
    },
    { title, more }
  );
  const panel = page.getByRole('dialog', { name: title });
  await expect(panel).toBeVisible();
  await slidIn(panel);
  return panel;
}

test('from the one-tag script: the start of the line is the left, and the right right to left', async ({ page }) => {
  await page.setViewportSize(WIDE);
  await page.goto('/script/');
  await expect(page.locator('.fd-form')).toBeVisible();
  let panel = await scriptPanel(page, 'From the start', { side: 'start', width: 'narrow' });
  expect(await place(panel)).toEqual({ x: 0, y: 0, width: 420, height: WIDE.height });
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  panel = await scriptPanel(page, 'From the start, right to left', { side: 'start', width: 'narrow', dir: 'rtl' });
  expect(await place(panel)).toEqual({ x: WIDE.width - 420, y: 0, width: 420, height: WIDE.height });
  await page.keyboard.press('Escape');
  // A height of its own at the top: short, 40 in a hundred.
  panel = await scriptPanel(page, 'Short', { side: 'top', height: 'short' });
  expect(await place(panel)).toEqual({ x: 0, y: 0, width: WIDE.width, height: 320 });
});

test('from the one-tag script: a panel over a panel steps the older one back from its own edge, and back again as it closes', async ({ page }) => {
  await page.setViewportSize(WIDE);
  await page.goto('/script/');
  await expect(page.locator('.fd-form')).toBeVisible();
  // [the older one's side, the newer one's, where the older one goes while it is behind]
  const cases = [
    ['left', 'top', { x: 48, y: 0, width: 560, height: WIDE.height }],
    ['top', 'bottom', { x: 0, y: 48, width: WIDE.width, height: 480 }],
    ['bottom', 'right', { x: 0, y: WIDE.height - 480 - 48, width: WIDE.width, height: 480 }],
  ] as const;
  for (const [first, second, behind] of cases) {
    const older = await scriptPanel(page, `From the ${first}`, { side: first });
    const settled = await place(older);
    const newer = await scriptPanel(page, `From the ${second}`, { side: second, width: 'narrow', height: 'short' });
    await older.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    expect(await older.getAttribute('data-behind')).toBe('');
    expect(await place(older), `${first} under ${second}`).toEqual(behind);
    if (first === 'left') await screen(page, 'panel-sides-stacked', { viewport: true });
    await page.keyboard.press('Escape');
    await expect(newer).toBeHidden();
    await older.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    expect(await place(older)).toEqual(settled);
    await page.keyboard.press('Escape');
    await expect(older).toBeHidden();
  }
});
