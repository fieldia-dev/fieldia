import { expect, test, type Page } from '@playwright/test';
import { screen } from './support';

/**
 * The screen designer's Advanced canvas, used as a person uses it: the page
 * drawn as the form draws it, parts dropped beside, under, into and between,
 * widths dragged, several picked at once, and moves made from the keyboard —
 * on the "New employee" page, at a desktop's width and a phone's.
 */

const LAYOUT = '/screen/?start=layout';

/** Each part's box, against the box of what holds the page's parts: on the canvas without the ring a part is picked by. */
function boxes(page: Page, root: string): Promise<Record<string, { x: number; y: number; w: number; h: number }>> {
  return page.evaluate((root) => {
    const holder = document.querySelector(root) as HTMLElement;
    const o = holder.getBoundingClientRect();
    const out: Record<string, { x: number; y: number; w: number; h: number }> = {};
    for (const part of holder.querySelectorAll<HTMLElement>('[data-node]:not([role="tab"])')) {
      const r = part.getBoundingClientRect();
      if (!r.width || part.closest('[hidden]')) continue;
      // A field on the canvas reaches into the gap round it, so a ring can show; its own box is inside that.
      const s = getComputedStyle(part);
      const inset = part.classList.contains('fd-canvas-field') ? { x: parseFloat(s.paddingLeft), y: parseFloat(s.paddingTop) } : { x: 0, y: 0 };
      out[part.dataset['node'] as string] = { x: Math.round(r.left - o.left + inset.x), y: Math.round(r.top - o.top + inset.y), w: Math.round(r.width - 2 * inset.x), h: Math.round(r.height - 2 * inset.y) };
    }
    return out;
  }, root);
}

test('the canvas draws each part where the form puts it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(LAYOUT);
  await expect(page.locator('.fd-canvas-body [data-node="who"]')).toBeVisible();
  const width = await page.locator('.fd-canvas-body').evaluate((e) => e.getBoundingClientRect().width);
  const onCanvas = await boxes(page, '.fd-canvas-body');
  await screen(page, 'advanced-01-canvas');

  // The same page in the form, the form as wide as the canvas: its widths are measured against the form's own.
  await page.goto('/plain/?page=layout&skin=outlined');
  const sections = page.locator('.fd-sections').first();
  await expect(sections).toBeVisible();
  await page.evaluate((width) => {
    const form = (document.querySelector('.fd-sections') as HTMLElement).closest('.fd-form') as HTMLElement;
    form.style.width = `${width}px`;
  }, width);
  // The canvas shows every part, and the first tab open; the form shows "Contract ends" only for a fixed term — shown here as it is.
  await page.evaluate(() => {
    for (const part of document.querySelectorAll<HTMLElement>('.fd-sections [data-node][hidden]')) if (!part.closest('.fd-tabpanel[hidden]')) part.hidden = false;
  });
  await expect.poll(() => sections.evaluate((e) => Math.round(e.getBoundingClientRect().width))).toBe(Math.round(width));
  const inForm = await boxes(page, '.fd-sections');

  const compared = Object.keys(inForm).filter((id) => onCanvas[id]);
  expect(compared.length, 'parts compared').toBeGreaterThan(20);
  const off = compared.filter((id) => ['x', 'y', 'w', 'h'].some((k) => Math.abs(onCanvas[id][k as 'x'] - inForm[id][k as 'x']) > 3)).map((id) => `${id}: canvas ${JSON.stringify(onCanvas[id])} form ${JSON.stringify(inForm[id])}`);
  expect(off, 'parts the canvas draws elsewhere than the form').toEqual([]);
});
