import { expect, test, type Page } from '@playwright/test';
import { inAdvanced } from './designer-support';
import { card, kids, spanOf } from './keyboard-support';

/**
 * WCAG 2.2's pointer criteria, checked in a browser: every drag has a way to
 * do it without dragging (2.5.7), and every target is 24 by 24 pixels or has
 * that much room round it (2.5.8).
 */

test.describe.configure({ timeout: 180_000 });

const DESKTOP = { width: 1280, height: 720 };
const PHONE = { width: 390, height: 844 };

// ---- 2.5.7 dragging movements: each drag, done without one ----------------------------

test.describe('2.5.7 every drag has a way without dragging', () => {
  test('into the canvas: a tile of the toolbox, pressed by Enter, adds its field', async ({ page }) => {
    await page.goto('/screen/');
    const before = await page.locator('.fd-canvas-body .fd-canvas-field').count();
    await page.locator('.fd-toolbox [data-tool="kind:email"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.fd-canvas-body .fd-canvas-field')).toHaveCount(before + 1);
    await page.goto('/designer/?start=survey');
    const questions = await page.locator('.fd-q').count();
    await page.locator('.fd-toolbox [data-tool="kind:email"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.fd-q')).toHaveCount(questions + 1);
  });

  for (const mode of ['Simple', 'Advanced']) {
    test(`about the canvas, ${mode}: a field reached by Tab, picked by Enter, moved by Alt+↓`, async ({ page }) => {
      if (mode === 'Advanced') await inAdvanced(page);
      await page.goto('/screen/?start=layout');
      const first = (await kids(page, 'personal'))[0];
      const order = await kids(page, 'personal');
      await card(page, first).focus();
      await page.keyboard.press('Enter');
      await expect(card(page, first)).toHaveClass(/fd-editing/);
      // From the label it is typed in, back a step to the bar on it: the keys there move it.
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Alt+ArrowDown');
      await expect.poll(() => kids(page, 'personal')).not.toEqual(order);
    });
  }

  test('a width, Advanced: Alt+Shift+→ in place of the handle, and the panel’s Width', async ({ page }) => {
    await inAdvanced(page);
    await page.goto('/screen/?start=layout');
    const id = 'f-email';
    await card(page, id).focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Shift+Tab');
    const start = await spanOf(page, id);
    await page.keyboard.press('Alt+Shift+ArrowRight');
    await expect.poll(() => spanOf(page, id)).toBe(start + 1);
    await page.locator('.fd-properties').getByRole('tab', { name: 'Layout', exact: true }).click();
    await page.locator('.fd-properties').getByRole('group', { name: 'Width', exact: true }).getByRole('button').first().click();
    await expect.poll(() => spanOf(page, id)).toBe(1);
  });

  test('the gutter between two parts, Advanced: a separator in the Tab order, moved by ←/→', async ({ page }) => {
    await inAdvanced(page);
    await page.goto('/screen/?start=layout');
    await card(page, 'f-photo').focus();
    await page.keyboard.press('Enter');
    const gutter = page.locator('.fd-gutter');
    await expect(gutter).toHaveAttribute('role', 'separator');
    await expect(gutter).toHaveAttribute('tabindex', '0');
    await gutter.focus();
    const before = [await spanOf(page, 'f-photo'), await spanOf(page, 'who')];
    await page.keyboard.press('ArrowRight');
    expect([await spanOf(page, 'f-photo'), await spanOf(page, 'who')]).toEqual([before[0] + 1, before[1] - 1]);
  });

  test('the outline: a row moved by Alt+↓', async ({ page }) => {
    await page.goto('/screen/?start=layout');
    await page.locator('.fd-rail').getByRole('tab', { name: 'Outline', exact: true }).click();
    const row = page.locator('.fd-outline [role="treeitem"][data-pick="f-first-name"]');
    const order = await kids(page, 'who');
    // Reached in the tree, picked by Enter, moved by its keys.
    await row.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Alt+ArrowDown');
    await expect.poll(() => kids(page, 'who')).not.toEqual(order);
    await expect(row).toBeFocused();
  });

  test('a question of a survey: Ctrl+Shift+J and Alt+↓ move it down', async ({ page }) => {
    await page.goto('/designer/?start=survey');
    // The example survey's "Your experience": four questions, nothing else.
    const step = 'step-experience';
    const order = await kids(page, step);
    await page.locator(`.fd-q[data-node="${order[0]}"]`).focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('ControlOrMeta+Shift+J');
    await expect.poll(() => kids(page, step)).toEqual([order[1], order[0], ...order.slice(2)]);
    // Back from its words to its grip, out of the box typed in: Alt+↓ moves it on.
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Alt+ArrowDown');
    await expect.poll(() => kids(page, step)).toEqual([order[1], order[2], order[0], ...order.slice(3)]);
  });

  test('a column of a list: Alt+→ moves it along the row', async ({ page }) => {
    await page.goto('/screen/?start=list');
    const columns = () => page.evaluate(() => (window as any).fieldiaDesigner.designer.getPage().layout.columns as string[]);
    const before = await columns();
    await page.locator(`.fd-list-table th[data-node="${before[0]}"]`).focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Alt+ArrowRight');
    await expect.poll(columns).toEqual([before[1], before[0], ...before.slice(2)]);
  });

  test('the ranking a person answers: the line’s buttons, or Alt+↓', async ({ page }) => {
    await page.goto('/plain/?page=kinds&skin=outlined');
    const ranking = page.locator('.fd-ranking').first();
    const words = ranking.locator('.fd-rank-words');
    const start = await words.allTextContents();
    await ranking.getByRole('button', { name: `Move ${start[0]} down` }).focus();
    await page.keyboard.press('Enter');
    await expect(words).toHaveText([start[1], start[0], ...start.slice(2)]);
    await page.keyboard.press('Alt+ArrowUp');
    await expect(words).toHaveText(start);
  });

  test('a line of an order: Alt+↑ moves the focused line', async ({ page }) => {
    await page.goto('/plain/?page=order&skin=underline');
    const grid = page.locator('[data-node="f-lines"]');
    const product = (row: number) => grid.locator(`.ag-row[row-index="${row}"] .ag-cell[col-id="product_id"]`);
    const [a, b] = [await product(1).textContent(), await product(2).textContent()];
    await grid.locator('.ag-row[row-index="2"] .ag-cell[col-id="taxed"]').click({ position: { x: 4, y: 4 } });
    await page.keyboard.press('Alt+ArrowUp');
    await expect(product(1)).toHaveText(b ?? '');
    await expect(product(2)).toHaveText(a ?? '');
  });
});

// ---- 2.5.8 target size, measured ---------------------------------------------------------

/**
 * Every target at least 24 by 24, or — WCAG's spacing exception — a 24px
 * circle on its centre that touches no other target and no other small
 * target's circle. Links inside a sentence are excepted, as WCAG excepts them.
 */
function smallTargets(page: Page, scope: string): Promise<string[]> {
  return page.evaluate((scopeSelector) => {
    const root = document.querySelector(scopeSelector) ?? document.body;
    const targets = [...root.querySelectorAll<HTMLElement>('button, a[href], select, input:not([type="hidden"]), textarea, [role="button"], [role="tab"], [role="checkbox"], [role="switch"], [role="menuitem"], [role="treeitem"], [role="separator"][tabindex]')].filter((e) => {
      if (e.closest('[hidden], [inert], [aria-hidden="true"]') || (e as HTMLButtonElement).disabled) return false;
      const r = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      if (r.width === 0 || r.height === 0 || s.visibility === 'hidden' || s.pointerEvents === 'none') return false;
      // A link in a run of words is excepted.
      return !(e.tagName === 'A' && getComputedStyle(e).display === 'inline' && (e.parentElement?.textContent ?? '').trim().length > (e.textContent ?? '').trim().length + 10);
    });
    const boxes = targets.map((e) => ({ e, r: e.getBoundingClientRect() }));
    const small = boxes.filter(({ r }) => r.width < 23.5 || r.height < 23.5);
    const centre = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    const touchesBox = (c: { x: number; y: number }, r: DOMRect) => {
      const dx = Math.max(r.left - c.x, 0, c.x - r.right);
      const dy = Math.max(r.top - c.y, 0, c.y - r.bottom);
      return Math.hypot(dx, dy) < 12;
    };
    const name = (e: HTMLElement) => `${e.tagName.toLowerCase()}${typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''} "${e.getAttribute('aria-label') ?? e.getAttribute('title') ?? (e.textContent ?? '').trim().slice(0, 24)}"`;
    return small
      .filter(({ e, r }) => {
        const c = centre(r);
        return boxes.some((o) => o.e !== e && !o.e.contains(e) && !e.contains(o.e) && (touchesBox(c, o.r) || (small.some((s) => s.e === o.e) && Math.hypot(centre(o.r).x - c.x, centre(o.r).y - c.y) < 24)));
      })
      .map(({ e, r }) => `${name(e)} ${Math.round(r.width)}×${Math.round(r.height)}`);
  }, scope);
}

test.describe('2.5.8 targets 24 by 24, or room round them', () => {
  for (const [size, viewport] of [['desktop', DESKTOP], ['phone', PHONE]] as const) {
    for (const url of ['/screen/?start=layout', '/designer/?start=survey', '/screen/?start=list']) {
      test(`${url} · ${size}, a part picked`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await inAdvanced(page);
        await page.goto(url);
        await page.locator('.fd-canvas-field, .fd-q-closed, .fd-list-table th[data-node]').first().click();
        await page.waitForTimeout(200);
        expect(await smallTargets(page, '.fd-designer')).toEqual([]);
      });
    }
  }
  for (const url of ['/plain/?page=fields&skin=outlined', '/plain/?page=customer&skin=underline', '/plain/?page=customers&skin=underline', '/plain/?page=kinds&skin=outlined']) {
    test(`${url} · phone`, async ({ page }) => {
      await page.setViewportSize(PHONE);
      await page.goto(url);
      await expect(page.locator('.fd-form').first()).toBeVisible();
      await page.waitForTimeout(800);
      expect(await smallTargets(page, '.fd-form')).toEqual([]);
    });
  }
});
