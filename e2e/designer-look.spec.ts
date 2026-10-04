import { expect, test, type Page } from '@playwright/test';
import { doubleLines, watch } from './designer-support';
import { screen } from './support';

/** The designer's look, state by state: no line drawn twice, a box in a box. */

async function check(page: Page, name: string) {
  await page.waitForTimeout(200);
  await screen(page, `look-${name}`, { viewport: true });
  expect(await doubleLines(page), name).toEqual([]);
}

test.describe('designer look', () => {
  test('a screen: a field picked, its words typed in, a dropdown’s options, a section picked', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/screen/');
    await page.locator('.fd-canvas-field').first().click();
    await check(page, 'screen-picked');
    await page.locator('.fd-canvas-field.fd-editing [data-inline="label"]').click();
    await check(page, 'screen-label-typing');
    await page.locator('.fd-toolbox [data-tool="kind:dropdown"]').click();
    await page.locator('.fd-canvas-field.fd-editing .fd-q-option input').first().click();
    await check(page, 'screen-option-typing');
    await page.locator('.fd-canvas-section-title').first().click();
    await check(page, 'screen-section-picked');
    // The kinds with settings of their own, each picked.
    for (const kind of ['rating', 'scale', 'amount', 'link', 'lines']) {
      await page.locator(`.fd-toolbox [data-tool="kind:${kind}"]`).click();
      await check(page, `screen-${kind}-picked`);
    }
    expect(problems).toEqual([]);
  });

  test('a sheet: its header’s parts picked and named, the outline and the data', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/screen/?start=sheet');
    await page.getByRole('button', { name: 'Add a button' }).click();
    await check(page, 'sheet-button-typing');
    await page.getByRole('button', { name: 'Add a badge' }).click();
    await check(page, 'sheet-badge-typing');
    await page.getByRole('tab', { name: 'Outline' }).click();
    await check(page, 'sheet-outline');
    await page.getByRole('tab', { name: 'Data' }).click();
    await check(page, 'sheet-data');
    expect(problems).toEqual([]);
  });

  test('a list: a column picked, a button named', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/screen/?start=list');
    await page.locator('.fd-list-table th[data-node="email"]').click();
    await check(page, 'list-column');
    await page.getByRole('button', { name: 'Add a button' }).click();
    await check(page, 'list-button-typing');
    expect(problems).toEqual([]);
  });

  test('a survey: a card open, its options typed, the menus, Find, Checks and Publish', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/designer/?start=survey');
    await page.locator('.fd-q').nth(1).click();
    await check(page, 'survey-open');
    await page.locator('.fd-q-selected .fd-q-label').click();
    await check(page, 'survey-label-typing');
    await page.keyboard.press('ControlOrMeta+k');
    await check(page, 'survey-find');
    await page.keyboard.press('Escape');
    await page.locator('.fd-designer-bar [data-checks]').click();
    await check(page, 'survey-checks');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await check(page, 'survey-publish');
    expect(problems).toEqual([]);
  });
});

test('the double-line check catches a box hugging its card, and leaves a floating bar alone', async ({ page }) => {
  await page.goto('/screen/');
  await expect(page.locator('.fd-canvas-section').first()).toBeVisible();
  // A bordered box 4px inside a card on every side: drawn twice, as a person sees it.
  await page.locator('.fd-canvas-section').first().evaluate((card) => {
    const box = document.createElement('div');
    box.id = 'probe';
    box.style.cssText = 'position: absolute; inset: 4px; border: 1px solid #888; pointer-events: none';
    (card as HTMLElement).style.position = 'relative';
    card.append(box);
  });
  expect(await doubleLines(page)).toEqual(expect.arrayContaining([expect.stringMatching(/^div in fieldset\.fd-section/)]));
  // The same box lifted by a shadow, as a toolbar or a menu is: an overlay, not a box in a box.
  await page.locator('#probe').evaluate((box) => ((box as HTMLElement).style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.14)'));
  expect(await doubleLines(page)).toEqual([]);
});

/**
 * The bar over a picked field covers nothing a person reads or clicks next:
 * not its group's name above a first row, nor the label of the field below,
 * nor its own label, nor the canvas's screen sizes; and it stays inside the
 * canvas. Each is looked at point by point: the topmost thing there must be
 * the name, the label or the button itself.
 */
async function covered(page: Page, what: string): Promise<string[]> {
  return page.locator(what).evaluateAll((all) =>
    all.flatMap((target) => {
      const r = target.getBoundingClientRect();
      if (!r.width || !r.height) return [];
      for (let y = r.top + 2; y < r.bottom - 1; y += 3) {
        for (let x = r.left + 2; x < r.right - 1; x += 4) {
          const top = document.elementFromPoint(x, y);
          if (top && top !== target && !target.contains(top) && top.closest('.fd-field-bar')) return [`${target.textContent?.trim() || target.getAttribute('aria-label')} under the bar`];
        }
      }
      return [];
    })
  );
}

for (const mode of ['simple', 'advanced'] as const) {
  for (const [size, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]] as const) {
    test(`a picked field’s bar leaves its group’s name and the next label clear · ${mode} · ${size}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      if (mode === 'advanced') {
        await page.addInitScript(() => {
          try {
            localStorage.setItem('fieldia.designer.mode', 'advanced');
          } catch {
            // A browser that keeps nothing opens Simple.
          }
        });
      }
      await page.goto('/screen/');
      const names = '.fd-canvas-section:not(.fd-canvas-arrangement) > legend .fd-canvas-section-title';
      const labels = '.fd-canvas-field:not(.fd-editing) > .fd-label, .fd-canvas-field.fd-editing [data-inline="label"]';
      // Each field of the first group in turn: the first row, then the rows below it.
      const fields = page.locator('.fd-canvas-section').first().locator('.fd-canvas-field');
      const count = await fields.count();
      expect(count).toBeGreaterThan(2);
      for (let i = 0; i < count; i++) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await fields.nth(i).click({ position: { x: 6, y: 6 } });
        await expect(fields.nth(i)).toHaveClass(/fd-editing/);
        await page.waitForTimeout(120);
        expect([...(await covered(page, names)), ...(await covered(page, labels)), ...(await covered(page, '.fd-canvas-sizes button'))], `field ${i + 1} picked`).toEqual([]);
        // All of the bar inside the canvas, however narrow the field is.
        const bar = (await page.locator('.fd-canvas-field.fd-editing > .fd-field-bar').boundingBox())!;
        const canvas = await page.locator('.fd-canvas-field.fd-editing').evaluate((card) => {
          const r = card.closest('.fd-canvas.fd-form')!.getBoundingClientRect();
          return { x: r.left, width: r.width };
        });
        expect(bar.x, `field ${i + 1}: the bar's start`).toBeGreaterThanOrEqual(canvas.x);
        expect(bar.x + bar.width, `field ${i + 1}: the bar's end`).toBeLessThanOrEqual(canvas.x + canvas.width);
      }
      await fields.first().click({ position: { x: 6, y: 6 } });
      await screen(page, `look-bar-over-name-${mode}-${size}`, { viewport: true });
    });
  }
}
