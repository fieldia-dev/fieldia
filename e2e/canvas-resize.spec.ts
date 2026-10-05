import { expect, test, type Locator, type Page } from '@playwright/test';
import { axeFindings } from './a11y-support';
import { inAdvanced } from './designer-support';
import { expectNoSidewaysScroll, screen } from './support';

/**
 * The Advanced canvas dragged to any width, as Designable's is, on the "New
 * employee" page: a handle on the canvas's end edge, dragged at hand speed or
 * moved by the keys, a chip saying the width and the size the form takes it
 * for, the switch pressing that size, and each group the columns it has at
 * that width — the columns the form itself has there.
 *
 * The demo holds the designer to 1320px, so its stage — the most the canvas
 * can be — is 780px: a form 714px wide inside the canvas's padding, which is a
 * tablet's by the form's own widths. Where a host gives the designer more
 * room, the canvas is a desktop's until the form inside it is 760px or less.
 */

const LAYOUT = '/screen/?start=layout';

async function openAdvanced(page: Page, width = 1440) {
  await inAdvanced(page);
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(LAYOUT);
  await expect(page.locator('.fd-screen-designer')).toHaveAttribute('data-mode', 'advanced');
}

const canvas = (page: Page) => page.locator('.fd-canvas.fd-form');
const handle = (page: Page) => page.locator('.fd-canvas-resize');
const grip = (page: Page) => page.locator('.fd-canvas-resize-grip');
const chip = (page: Page) => page.locator('.fd-canvas-resize-chip');
const note = (page: Page) => page.locator('.fd-canvas-size-px');
const widthOf = (page: Page) => canvas(page).evaluate((c) => Math.round(c.getBoundingClientRect().width));
const pressed = (page: Page) => page.locator('.fd-canvas-sizes [aria-pressed="true"]').getAttribute('data-size');
/** How many columns a group's grid has, as the browser lays it out. */
const across = (page: Page, id: string) => page.locator(`.fd-canvas-body [data-node="${id}"] > .fd-grid`).evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(' ').length);
const columns = async (page: Page) => [await across(page, 'personal'), await across(page, 'side-by-side'), await across(page, 'address')];

/**
 * Press the grip and move the pointer at hand speed, 50px a step at most, until the canvas would be `width` wide:
 * the canvas stays in the stage's middle, so its edge moves half as far as its width changes.
 */
async function dragTo(page: Page, width: number, options: { press?: boolean; release?: boolean; rtl?: boolean } = {}) {
  const box = (await grip(page).boundingBox())!;
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const by = ((width - (await widthOf(page))) / 2) * (options.rtl ? -1 : 1);
  if (options.press !== false) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
  }
  const steps = Math.max(2, Math.ceil(Math.abs(by) / 50));
  for (let i = 1; i <= steps; i++) await page.mouse.move(from.x + (by * i) / steps, from.y + i);
  await expect.poll(() => widthOf(page)).toBe(width);
  if (options.release !== false) await page.mouse.up();
}

/**
 * The same page in the form, the form as wide as the form on the canvas is — its own width less the canvas's
 * padding — and how many columns each group has there.
 */
async function formColumnsAt(page: Page, inner: number): Promise<number[]> {
  const form = await page.context().newPage();
  await form.setViewportSize({ width: 1280, height: 1000 });
  await form.goto('/plain/?page=layout&skin=outlined');
  await expect(form.locator('.fd-sections').first()).toBeVisible();
  await form.evaluate((width) => {
    const root = (document.querySelector('.fd-sections') as HTMLElement).closest('.fd-form') as HTMLElement;
    root.style.width = `${width}px`;
    (root.querySelector('.fd-content') as HTMLElement).style.maxWidth = `${width}px`;
  }, inner);
  await expect.poll(() => form.locator('.fd-sections').first().evaluate((e) => Math.round(e.getBoundingClientRect().width))).toBe(inner);
  const counts = [];
  for (const id of ['personal', 'side-by-side', 'address']) counts.push(await form.locator(`.fd-sections [data-node="${id}"] > .fd-grid`).evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(' ').length));
  await form.close();
  return counts;
}
/** Where a word of an element's words is drawn, from the left. */
const leftOf = (element: Locator, word: string) =>
  element.evaluate((e, w) => {
    const text = e.firstChild as Text;
    const at = (text.textContent ?? '').indexOf(w);
    const range = document.createRange();
    range.setStart(text, at);
    range.setEnd(text, at + w.length);
    return range.getBoundingClientRect().left;
  }, word);

/** The width of the form on the canvas: what is inside its padding. */
const innerOf = (page: Page) => page.locator('.fd-canvas-body').evaluate((b) => Math.round(b.getBoundingClientRect().width));

test('dragged at hand speed: the chip says the width and the size, the switch follows, each group has the columns the form has there', async ({ page }) => {
  await openAdvanced(page);
  await expect(handle(page)).toBeVisible();
  expect(await pressed(page)).toBe('desktop');
  expect(await widthOf(page)).toBe(780);
  await expect(handle(page)).toHaveAttribute('aria-valuenow', '780');
  await expect(handle(page)).toHaveAttribute('aria-valuemax', '780');
  // Desktop shows a desktop's columns whatever the canvas's width: Personal details three, the row under it two groups.
  expect(await columns(page)).toEqual([3, 2, 2]);
  await expect(chip(page)).toBeHidden();
  await expect(note(page)).toBeHidden();
  await screen(page, 'resize-01-desktop', { viewport: true });

  // To 640px, held: the form inside is 574px, a tablet's.
  await dragTo(page, 640, { release: false });
  await expect(chip(page)).toBeVisible();
  await expect(chip(page)).toHaveText('640 px · Tablet');
  expect(await pressed(page)).toBe('tablet');
  await expect(note(page)).toHaveText('640 px');
  await expect.poll(() => columns(page)).toEqual([3, 1, 2]);
  await screen(page, 'resize-02-drag-640-tablet', { viewport: true });

  // On, past the phone's width — 586px, the form 520 — still held: one column each.
  await dragTo(page, 500, { press: false, release: false });
  await expect(chip(page)).toHaveText('500 px · Phone');
  expect(await pressed(page)).toBe('phone');
  await expect.poll(() => columns(page)).toEqual([1, 1, 1]);
  await screen(page, 'resize-03-drag-500-phone', { viewport: true });
  await page.mouse.up();

  // Let go: the chip goes; the switch and the handle say the width; it is said aloud.
  await expect(chip(page)).toBeHidden();
  await expect(note(page)).toHaveText('500 px');
  await expect(handle(page)).toHaveAttribute('aria-valuenow', '500');
  await expect(handle(page)).toHaveAttribute('aria-valuetext', '500 pixels, phone');
  await expect(page.locator('.fd-canvas-said')).toHaveText('500 pixels, phone');
  await expectNoSidewaysScroll(page);
  await screen(page, 'resize-04-let-go-500');

  // The columns the form itself has at these widths.
  expect(await formColumnsAt(page, await innerOf(page))).toEqual(await columns(page));
  await dragTo(page, 640);
  expect(await formColumnsAt(page, await innerOf(page))).toEqual([3, 1, 2]);
});

test('as narrow as a phone and as wide as the stage, no further, however far the pointer goes', async ({ page }) => {
  await openAdvanced(page);
  const box = (await grip(page).boundingBox())!;
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let x = from.x; x >= from.x - 600; x -= 60) await page.mouse.move(x, from.y);
  await expect.poll(() => widthOf(page)).toBe(320);
  await expect(chip(page)).toHaveText('320 px · Phone');
  for (let x = from.x - 600; x <= from.x + 300; x += 60) await page.mouse.move(x, from.y);
  await expect.poll(() => widthOf(page)).toBe(780);
  await expect(chip(page)).toHaveText('780 px · Tablet');
  await page.mouse.up();
  await expectNoSidewaysScroll(page);
});

test('a fast drag never loses the handle: the pointer flung far past it, then let go outside the canvas', async ({ page }) => {
  await openAdvanced(page);
  const box = (await grip(page).boundingBox())!;
  await page.mouse.move(box.x + 4, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x - 200, box.y + 300, { steps: 2 });
  await page.mouse.move(box.x + 400, box.y + 320, { steps: 2 });
  await page.mouse.move(box.x + 4 - 100, box.y + 20, { steps: 2 });
  await page.mouse.up();
  await expect.poll(() => widthOf(page)).toBe(580);
  expect(await pressed(page)).toBe('phone');
  await expect(note(page)).toHaveText('580 px');
});

test('from the keys: a focusable separator — ← and → ten pixels, with Shift a hundred, Home and End — said aloud', async ({ page }) => {
  await openAdvanced(page);
  const h = handle(page);
  await expect(h).toHaveAttribute('role', 'separator');
  await expect(h).toHaveAttribute('aria-orientation', 'vertical');
  await expect(h).toHaveAccessibleName('Screen width');
  await expect(h).toHaveAttribute('aria-valuemin', '320');
  // A target a finger can hit (WCAG 2.5.8): 24px across at least.
  const box = (await h.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(24);
  expect(box.height).toBeGreaterThanOrEqual(24);
  // Reached with the keyboard: the last stop on the canvas, just before the panel.
  await page.locator('.fd-properties input').first().focus();
  await page.keyboard.press('Shift+Tab');
  await expect(h).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(h).toHaveAttribute('aria-valuenow', '770');
  await expect(h).toHaveAttribute('aria-valuetext', '770 pixels, tablet');
  await expect(page.locator('.fd-canvas-said')).toHaveText('770 pixels, tablet');
  expect(await widthOf(page)).toBe(770);
  await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.press('Shift+ArrowLeft');
  await expect(h).toHaveAttribute('aria-valuenow', '570');
  expect(await pressed(page)).toBe('phone');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(h).toHaveAttribute('aria-valuenow', '590');
  expect(await pressed(page)).toBe('tablet');
  await screen(page, 'resize-05-keys-focused', { viewport: true });
  await page.keyboard.press('Home');
  expect(await widthOf(page)).toBe(320);
  await expect(page.locator('.fd-canvas-said')).toHaveText('320 pixels, phone');
  await page.keyboard.press('End');
  expect(await widthOf(page)).toBe(780);
  expect(await axeFindings(page, 'the canvas at a width of its own, its handle focused')).toEqual([]);
});

test('a double-click on the handle goes back to the pressed size’s own width', async ({ page }) => {
  await openAdvanced(page);
  await dragTo(page, 640);
  expect(await pressed(page)).toBe('tablet');
  const box = (await grip(page).boundingBox())!;
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  // A tablet's 768px, as wide as the stage lets it be.
  await expect.poll(() => widthOf(page)).toBe(768);
  expect(await pressed(page)).toBe('tablet');
  await expect(note(page)).toBeHidden();
  await expect(canvas(page)).not.toHaveAttribute('data-width');
  // A size picked goes to its own width too.
  await dragTo(page, 450);
  await page.getByRole('group', { name: 'Screen size' }).getByRole('button', { name: 'Desktop' }).click();
  await expect.poll(() => widthOf(page)).toBe(780);
  await expect(note(page)).toBeHidden();
  expect(await columns(page)).toEqual([3, 2, 2]);
});

test('the width is kept in this browser: a reload shows it as it was', async ({ page }) => {
  await openAdvanced(page);
  await dragTo(page, 600);
  await page.reload();
  await expect.poll(() => widthOf(page)).toBe(600);
  expect(await pressed(page)).toBe('tablet');
  await expect(note(page)).toHaveText('600 px');
  await expect(handle(page)).toHaveAttribute('aria-valuenow', '600');
  expect(await columns(page)).toEqual([3, 1, 2]);
  await screen(page, 'resize-06-after-reload', { viewport: true });
});

test('right to left (Arabic), the handle is on the canvas’s left edge, and dragging or ← towards the left is wider', async ({ page }) => {
  await openAdvanced(page);
  await page.evaluate(() => {
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'ar';
  });
  const c = (await canvas(page).boundingBox())!;
  const h = (await handle(page).boundingBox())!;
  // Inside the canvas's border, on its left.
  expect(h.x - c.x).toBeGreaterThanOrEqual(0);
  expect(h.x - c.x).toBeLessThanOrEqual(2);
  // Towards the right, narrower: to 560px, a phone's.
  await dragTo(page, 560, { rtl: true, release: false });
  await expect(chip(page)).toHaveText('560 px · Phone');
  // The words drawn the way they are written, the number first, on the chip and beside the switch.
  expect(await leftOf(chip(page), '560')).toBeLessThan(await leftOf(chip(page), 'Phone'));
  expect(await leftOf(note(page), '560')).toBeLessThan(await leftOf(note(page), 'px'));
  const g = (await grip(page).boundingBox())!;
  const k = (await chip(page).boundingBox())!;
  // The chip beside the grip, inside the canvas.
  expect(k.x).toBeGreaterThan(g.x + g.width);
  await screen(page, 'resize-07-rtl-drag', { viewport: true });
  await page.mouse.up();
  await handle(page).focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(handle(page)).toHaveAttribute('aria-valuetext', '590 pixels, tablet');
  expect(await pressed(page)).toBe('tablet');
  await expectNoSidewaysScroll(page);
});

test('where the designer gives the canvas a desktop’s room, a desktop until the form inside is 760px or less', async ({ page }) => {
  await inAdvanced(page);
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.goto(LAYOUT);
  // A host that gives the designer the whole window.
  await page.addStyleTag({ content: '#app:has(.fd-designer) { max-width: none; }' });
  await expect.poll(() => widthOf(page)).toBeGreaterThan(1000);
  await dragTo(page, 900, { release: false });
  await expect(chip(page)).toHaveText('900 px · Desktop');
  expect(await columns(page)).toEqual([3, 2, 2]);
  await dragTo(page, 800, { press: false, release: false });
  await expect(chip(page)).toHaveText('800 px · Tablet');
  await expect.poll(() => columns(page)).toEqual([3, 1, 2]);
  await screen(page, 'resize-08-wide-host-800', { viewport: true });
  await page.mouse.up();
  expect(await formColumnsAt(page, await innerOf(page))).toEqual([3, 1, 2]);
  await dragTo(page, 900);
  expect(await formColumnsAt(page, await innerOf(page))).toEqual([3, 2, 2]);
});

test('Simple shows a desktop: no handle, and no width of its own', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fieldia.designer.width', '500');
    localStorage.setItem('fieldia.designer.size', 'phone');
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(LAYOUT);
  await expect(page.locator('.fd-screen-designer')).toHaveAttribute('data-mode', 'simple');
  await expect(handle(page)).toBeHidden();
  expect(await widthOf(page)).toBe(780);
  expect(await columns(page)).toEqual([3, 2, 2]);
  // Advanced shows the width kept.
  await page.getByRole('group', { name: 'Editing mode' }).getByRole('button', { name: 'Advanced' }).click();
  await expect(handle(page)).toBeVisible();
  await expect.poll(() => widthOf(page)).toBe(500);
});

test('a designer as narrow as a phone shows the canvas as wide as it is: no handle, nothing scrolls sideways', async ({ page }) => {
  // A width kept from a wider window: 500px, a phone's.
  await page.addInitScript(() => {
    localStorage.setItem('fieldia.designer.width', '500');
    localStorage.setItem('fieldia.designer.size', 'phone');
  });
  await openAdvanced(page, 390);
  await expect(page.locator('.fd-canvas-stage')).toBeVisible();
  await expect(handle(page)).toBeHidden();
  await expect(note(page)).toBeHidden();
  expect(await pressed(page)).toBe('phone');
  await expectNoSidewaysScroll(page);
  await page.locator('.fd-canvas-stage').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -16));
  await screen(page, 'resize-09-phone-designer', { viewport: true });
  // A tablet-wide designer has it, and the note.
  await page.setViewportSize({ width: 900, height: 1000 });
  await expect(handle(page)).toBeVisible();
  await expect(note(page)).toHaveText('500 px');
  await expectNoSidewaysScroll(page);
});
