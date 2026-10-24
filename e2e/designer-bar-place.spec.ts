import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { screen } from './support';

/**
 * The bar of a part picked on the screen designer's canvas belongs to the part (the owner's walk of 23 Oct: picking
 * Customer put the bar over the Visit group's name at the canvas's top, over the group's border; Visit date the same,
 * only moved sideways). Just above the part, at its end edge — or below it where above there is no room, the part
 * making room under itself — never over a group's name or another part's words or boxes; going with it as the page
 * scrolls. One rule for every floating bar the designers draw: a field's, a part of a record's head, a list's column.
 */

/** Where the bar of the part picked stands against its part, and what of the canvas it covers, read from the page. */
const barNow = (page: Page) =>
  page.evaluate(() => {
    const bar = [...document.querySelectorAll<HTMLElement>('.fd-canvas .fd-field-bar')].find((b) => b.getClientRects().length);
    if (!bar) return null;
    const part = bar.parentElement as HTMLElement;
    const [b, p] = [bar.getBoundingClientRect(), part.getBoundingClientRect()];
    const canvas = (bar.closest('.fd-canvas') as HTMLElement).getBoundingClientRect();
    const covers: string[] = [];
    const hit = (r: DOMRect) => r.width > 0 && r.right > b.left && r.left < b.right && r.bottom > b.top && r.top < b.bottom;
    const walker = document.createTreeWalker(bar.closest('.fd-canvas') as HTMLElement, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      if (!text.textContent?.trim() || part.contains(text) || bar.contains(text)) continue;
      range.selectNodeContents(text);
      if ([...range.getClientRects()].some(hit)) covers.push(text.textContent.trim());
    }
    for (const box of document.querySelectorAll<HTMLElement>('.fd-canvas :is(input:not([type="hidden"]), textarea, select)')) {
      if (!part.contains(box) && hit(box.getBoundingClientRect())) covers.push(`a box of ${box.closest('[data-node]')?.getAttribute('data-node')}`);
    }
    const side = b.bottom <= p.top + 0.5 ? 'above' : b.top >= p.bottom - 0.5 ? 'below' : 'over';
    return {
      side,
      // Adjacent: its edge within 12px of the part's, and the part's end edge its own (inside the canvas).
      apart: Math.round(side === 'above' ? p.top - b.bottom : side === 'below' ? b.top - p.bottom : -1),
      endEdge: Math.abs((getComputedStyle(part).direction === 'rtl' ? b.left - p.left : b.right - p.right)) < 1.5 || b.left <= canvas.left + 5 || b.right >= canvas.right - 5,
      inCanvas: b.left >= canvas.left - 0.5 && b.right <= canvas.right + 0.5 && b.top >= canvas.top - 0.5,
      covers,
      top: b.top,
      partTop: p.top,
      partBottom: p.bottom,
    };
  });

async function pick(page: Page, label: string) {
  await page.locator('.fd-canvas-field').filter({ has: page.locator('.fd-label', { hasText: label }) }).first().click();
  await expect(page.locator('.fd-canvas-field.fd-editing .fd-canvas-label-input')).toHaveValue(label);
}

/** The bar beside its part, at its end edge, inside the canvas, covering nothing of anything else. */
async function belongs(page: Page, what: string) {
  // Placed in the frame after the canvas drew it.
  await expect
    .poll(async () => {
      const now = await barNow(page);
      return !!now && !now.covers.length && now.side !== 'over' && now.apart >= 0 && now.apart <= 12 && now.endEdge && now.inCanvas;
    }, what)
    .toBe(true)
    .catch(() => undefined);
  const now = (await barNow(page))!;
  expect(now.covers, what).toEqual([]);
  expect(now.side, what).not.toBe('over');
  expect(now.apart, what).toBeGreaterThanOrEqual(0);
  expect(now.apart, what).toBeLessThanOrEqual(12);
  expect(now.endEdge, what).toBe(true);
  expect(now.inCanvas, what).toBe(true);
  return now;
}

test.describe('the bar of the part picked, on the screen designer', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/screen/');
    await expect(page.locator('.fd-canvas-field').first()).toBeVisible();
  });

  test('Customer, under the Visit group’s name: below it, room made, the name and the next row clear', async ({ page }) => {
    const name = page.locator('.fd-canvas-section-title').filter({ hasText: 'Visit' }).first();
    const before = (await name.boundingBox())!;
    await pick(page, 'Customer');
    const now = await belongs(page, 'Customer');
    expect(now.side).toBe('below');
    // Nothing above it moved: the group's name stands where it stood.
    expect((await name.boundingBox())!.y).toBeCloseTo(before.y, 0);
    await screen(page, 'bar-place-customer', { viewport: true });
  });

  test('Visit date, in the second column: above it, the group’s name clear', async ({ page }) => {
    await pick(page, 'Visit date');
    expect((await belongs(page, 'Visit date')).side).toBe('above');
    await screen(page, 'bar-place-visit-date', { viewport: true });
  });

  test('Notes, a row down; Manager to call?, at the canvas’s foot: each beside its own, covering nothing', async ({ page }) => {
    // Tall enough for a part and its bar under it in sight: a bar below its part waits past the foot for the scroll.
    await page.setViewportSize({ width: 1440, height: 1400 });
    for (const label of ['Notes', 'Photos', 'Next step', 'Due by', 'Manager to call?']) {
      await pick(page, label);
      await belongs(page, label);
    }
    await screen(page, 'bar-place-foot', { viewport: true });
  });

  test('a group picked shows no bar over its name', async ({ page }) => {
    await page.locator('.fd-canvas-section-title').filter({ hasText: 'Visit' }).first().click();
    expect(await barNow(page)).toBeNull();
  });

  test('scrolled, the bar goes with its part, beside it wherever the page is', async ({ page }) => {
    await pick(page, 'Visit date');
    const before = (await belongs(page, 'Visit date')).side;
    for (const by of [120, 260, -380]) {
      await page.mouse.wheel(0, by);
      await expect.poll(async () => (await barNow(page))?.side).toBe(before);
      const now = (await barNow(page))!;
      expect(now.apart).toBeGreaterThanOrEqual(0);
      expect(now.apart).toBeLessThanOrEqual(12);
    }
    await screen(page, 'bar-place-scrolled', { viewport: true });
  });

  test('a narrower window and a zoom place it again, beside its part', async ({ page }) => {
    await pick(page, 'Visit date');
    await page.setViewportSize({ width: 1100, height: 900 });
    await belongs(page, 'Visit date at 1100');
    await page.evaluate(() => ((document.body.style as CSSStyleDeclaration & { zoom: string }).zoom = '1.25'));
    await page.setViewportSize({ width: 1101, height: 900 });
    await belongs(page, 'Visit date zoomed');
  });
});

test('a record sheet: a part in a second column, and a part of its head, each bar beside its own', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/screen/?start=layout');
  await expect(page.locator('.fd-canvas-field').first()).toBeVisible();
  await pick(page, 'Last name');
  await belongs(page, 'Last name');
  await pick(page, 'Mobile');
  await belongs(page, 'Mobile');
  await screen(page, 'bar-place-second-column', { viewport: true });
});

test('right to left, the bar lines up with the part’s start edge, on its left', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/screen/?locale=ar&dir=rtl');
  await page.locator('.fd-canvas-field').nth(1).click();
  await expect(page.locator('.fd-canvas-field.fd-editing')).toHaveCount(1);
  await belongs(page, 'the second part, right to left');
  await page.locator('.fd-canvas-field').nth(0).click();
  await belongs(page, 'the first part, right to left');
  await screen(page, 'bar-place-rtl', { viewport: true });
});
