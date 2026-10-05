import { expect, test, type Page } from '@playwright/test';
import { axeFindings } from './a11y-support';
import { boxes, cardOf, centre, doubleLines, dropAt, inAdvanced, layout, misalignedOnCanvas } from './designer-support';
import { screen } from './support';

/**
 * Rows in twelfths on the Advanced canvas, as the user asked for them on the
 * site visit: a field dropped at a row's end or between two fields re-divides
 * only that row; the divider between two fields moves in twelfths, said as
 * percentages; a group keeps its rows full, or allows gaps. Every gesture at
 * hand speed, the chip read before letting go.
 */

async function openVisit(page: Page, width = 1280) {
  await inAdvanced(page);
  await page.setViewportSize({ width, height: 1000 });
  await page.goto('/screen/');
  await expect(page.locator('.fd-screen-designer')).toHaveAttribute('data-mode', 'advanced');
}

const at = async (page: Page, label: string) => (await (await cardOf(page, label)).boundingBox())!;
const group = (page: Page, id: string) => page.locator(`.fd-canvas-body [data-node="${id}"]`);
/** A field's own box on the canvas, inside the room it keeps round it for its ring. */
async function own(page: Page, label: string) {
  return (await cardOf(page, label)).evaluate((e) => {
    const r = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    const x = parseFloat(s.paddingLeft);
    const y = parseFloat(s.paddingTop);
    return { left: r.left + x, right: r.right - x, top: r.top + y, bottom: r.bottom - y, width: r.width - 2 * x, height: r.height - 2 * y };
  });
}
const built = (page: Page) => page.evaluate(() => (window as unknown as { fieldiaDesigner: { designer: { getPage(): unknown } } }).fieldiaDesigner.designer.getPage() as { layout: { children: { id: string; columns?: unknown; rows?: string }[] } });

test('(a) a field dropped in the padding just past Visit date: the end of that row, the row in thirds, nothing else moving', async ({ page }) => {
  await openVisit(page);
  const notesBefore = await own(page, 'Notes');
  const date = await own(page, 'Visit date');
  const visit = (await group(page, 'section-1').boundingBox())!;
  // The padding past Visit date, 14px past its edge — short of the group's border.
  const to = { x: date.right + 14, y: date.top + date.height / 2 };
  expect(to.x).toBeLessThan(visit.x + visit.width - 4);
  const { words, refused } = await dropAt(page, centre(await at(page, 'Next step')), to, { shot: 'twelfths-a-drag' });
  expect([words, refused]).toEqual(['at the end of the row, after “Visit date” — the row in thirds', false]);
  expect(await layout(page)).toEqual([
    ['Customer:4', 'Visit date:4', 'Next step:4', 'Notes:12'],
    ['Due by:1', 'Manager to call?:1'],
  ]);
  expect((await built(page)).layout.children[0].columns).toBe(12);
  // One row of three equal parts; Notes where it was, as wide as it was.
  const row = await Promise.all(['Customer', 'Visit date', 'Next step'].map((label) => own(page, label)));
  expect(new Set(row.map((r) => Math.round(r.top))).size, 'one row').toBe(1);
  const widths = row.map((r) => r.width);
  expect(Math.max(...widths) - Math.min(...widths), `thirds: ${widths}`).toBeLessThanOrEqual(2);
  const notes = await own(page, 'Notes');
  expect([Math.round(notes.left), Math.round(notes.width)]).toEqual([Math.round(notesBefore.left), Math.round(notesBefore.width)]);
  // Follow-up closes up: its two left side by side, in its first row.
  const due = await own(page, 'Due by');
  const call = await own(page, 'Manager to call?');
  expect(Math.round(due.top)).toBe(Math.round(call.top));
  expect((await misalignedOnCanvas(page)).off).toEqual([]);
  await page.mouse.click(5, 5);
  await screen(page, 'twelfths-a-after', { viewport: true });
});

test('(b) dropped in the gap between Customer and Visit date: between them, the row in thirds', async ({ page }) => {
  await openVisit(page);
  const customer = await own(page, 'Customer');
  const date = await own(page, 'Visit date');
  const to = { x: (customer.right + date.left) / 2, y: customer.top + customer.height / 2 };
  const { words } = await dropAt(page, centre(await at(page, 'Due by')), to, { shot: 'twelfths-b-drag' });
  expect(words).toBe('between “Customer” and “Visit date” — the row in thirds');
  expect((await layout(page))[0]).toEqual(['Customer:4', 'Due by:4', 'Visit date:4', 'Notes:12']);
  // The line was drawn in the gap: on the edge the part went to.
  expect((await misalignedOnCanvas(page)).off).toEqual([]);
  await page.mouse.click(5, 5);
  await screen(page, 'twelfths-b-after', { viewport: true });
});

/** Pick a field by its card's corner, as a person does, not its words: the keys then go to the canvas. */
async function pick(page: Page, label: string) {
  await (await cardOf(page, label)).click({ position: { x: 6, y: 6 } });
}
/** Pick a group by its padding. */
async function pickGroup(page: Page, id: string) {
  const b = (await group(page, id).boundingBox())!;
  await page.mouse.click(b.x + b.width - 8, b.y + 8);
}
const undo = (page: Page) => page.getByRole('button', { name: 'Undo' }).click();
const gutter = (page: Page) => page.locator('.fd-gutter');

/** The site visit with Next step dropped at the end of the first row: the group in twelfths, Customer | Visit date | Next step. */
async function inThirds(page: Page) {
  const date = await own(page, 'Visit date');
  await dropAt(page, centre(await at(page, 'Next step')), { x: date.right + 14, y: date.top + date.height / 2 });
  await page.mouse.click(5, 5);
  expect((await layout(page))[0]).toEqual(['Customer:4', 'Visit date:4', 'Next step:4', 'Notes:12']);
}

test('(c) the gutter between Customer and Visit date: twelfths by the pointer and by the keys, said as percentages, one undo each', async ({ page }) => {
  await openVisit(page);
  await pick(page, 'Customer');
  await expect(gutter(page)).toBeVisible();
  await expect(gutter(page)).toHaveAttribute('aria-label', 'Width between “Customer” and “Visit date”');
  await expect(gutter(page)).toHaveAttribute('aria-valuetext', '50% · 50%');
  const g = (await gutter(page).boundingBox())!;
  const customer = await own(page, 'Customer');
  // One twelfth of the row, and a gap: about one column of the twelve.
  const twelfth = (await group(page, 'section-1').locator('> .fd-grid').evaluate((e) => e.getBoundingClientRect().width)) / 12;
  const from = { x: g.x + g.width / 2, y: g.y + g.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  // At hand speed: 40 to 80 px a step.
  for (const dx of [45, 90, twelfth * 1.1]) await page.mouse.move(from.x + Math.min(dx, twelfth * 1.1), from.y);
  await expect(page.locator('.fd-width-chip')).toHaveText('58% · 42%');
  // Shown in twelfths while it is dragged, the guides' twelve tracks under it.
  await expect(group(page, 'section-1').locator('> .fd-grid')).toHaveCSS('grid-template-columns', /^(\S+\s){11}\S+$/);
  await screen(page, 'twelfths-c-gutter-drag', { viewport: true });
  await page.mouse.up();
  expect((await layout(page))[0]).toEqual(['Customer:7', 'Visit date:5', 'Notes:12']);
  expect((await built(page)).layout.children[0].columns).toBe(12);
  const wider = await own(page, 'Customer');
  expect(wider.width).toBeGreaterThan(customer.width + twelfth / 2);
  await expect(gutter(page)).toHaveAttribute('aria-valuetext', '58% · 42%');
  await screen(page, 'twelfths-c-gutter-after', { viewport: true });
  // One undo: the two columns as they were, the group too.
  await undo(page);
  expect((await layout(page))[0]).toEqual(['Customer:1', 'Visit date:1', 'Notes:2']);
  // By the keys, a twelfth a press, each its own undo.
  await pick(page, 'Customer');
  await gutter(page).focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  expect((await layout(page))[0]).toEqual(['Customer:8', 'Visit date:4', 'Notes:12']);
  await expect(gutter(page)).toBeFocused();
  await expect(gutter(page)).toHaveAttribute('aria-valuetext', '67% · 33%');
  await screen(page, 'twelfths-c-gutter-keys', { viewport: true });
  await undo(page);
  expect((await layout(page))[0]).toEqual(['Customer:7', 'Visit date:5', 'Notes:12']);
  expect((await misalignedOnCanvas(page)).off).toEqual([]);
});

test('(d) rows that allow gaps: a part moved out leaves its room, and the width handle pulls a far edge in', async ({ page }) => {
  await openVisit(page);
  await inThirds(page);
  await pickGroup(page, 'section-1');
  await page.getByRole('tab', { name: 'Layout' }).click();
  const rows = page.getByRole('group', { name: 'Rows' });
  await expect(rows.getByRole('button', { name: 'Keep each row full' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('group', { name: 'Columns on a desktop' }).getByRole('button', { name: 'Twelfths' })).toHaveAttribute('aria-pressed', 'true');
  await screen(page, 'twelfths-d-panel-rows', { viewport: true });
  await rows.getByRole('button', { name: 'Allow gaps' }).click();
  expect((await built(page)).layout.children[0].rows).toBe('gaps');
  // Next step moved out to Follow-up's end: its room stays in Visit's first row.
  const call = await own(page, 'Manager to call?');
  await dropAt(page, centre(await at(page, 'Next step')), { x: call.right + 14, y: call.top + call.height / 2 });
  await page.mouse.click(5, 5);
  expect((await layout(page))[0]).toEqual(['Customer:4', 'Visit date:4', 'Notes:12']);
  const date = await own(page, 'Visit date');
  const notes = await own(page, 'Notes');
  expect(notes.right - date.right, 'a gap at the row’s end').toBeGreaterThan(notes.width / 4);
  await screen(page, 'twelfths-d-gap', { viewport: true });
  // Visit date's far edge, pulled in a twelfth, then out into the room its row has.
  await pick(page, 'Visit date');
  const handle = page.locator('.fd-width-handle');
  await expect(handle).toBeVisible();
  await expect(gutter(page)).toBeHidden();
  const h = (await handle.boundingBox())!;
  const twelfth = (await group(page, 'section-1').locator('> .fd-grid').evaluate((e) => e.getBoundingClientRect().width)) / 12;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  for (const dx of [-40, -twelfth * 1.1]) await page.mouse.move(h.x + h.width / 2 + dx, h.y + h.height / 2);
  await expect(page.locator('.fd-width-chip')).toHaveText('25% of the row');
  await screen(page, 'twelfths-d-handle-in', { viewport: true });
  await page.mouse.up();
  expect((await layout(page))[0]).toEqual(['Customer:4', 'Visit date:3', 'Notes:12']);
  await pick(page, 'Visit date');
  const again = (await handle.boundingBox())!;
  await page.mouse.move(again.x + again.width / 2, again.y + again.height / 2);
  await page.mouse.down();
  for (let x = 60; x <= 420; x += 60) await page.mouse.move(again.x + again.width / 2 + x, again.y + again.height / 2);
  // No further than the room the row has: the rest of it.
  await expect(page.locator('.fd-width-chip')).toHaveText('67% of the row');
  await page.mouse.up();
  expect((await layout(page))[0]).toEqual(['Customer:4', 'Visit date:8', 'Notes:12']);
  expect((await misalignedOnCanvas(page)).off).toEqual([]);
  await page.mouse.click(5, 5);
  await screen(page, 'twelfths-d-after', { viewport: true });
});

/** The parts' boxes on the canvas at a size of screen, and in the form drawn as wide by the script bundle's viewer. */
async function canvasAndForm(page: Page, size: 'Desktop' | 'Tablet' | 'Phone', built: unknown) {
  await page.getByRole('group', { name: 'Screen size' }).getByRole('button', { name: size }).click();
  await expect(page.locator('.fd-canvas.fd-form')).toHaveAttribute('data-size', size.toLowerCase());
  const width = await page.locator('.fd-canvas-body').evaluate((e) => e.getBoundingClientRect().width);
  const onCanvas = await boxes(page, '.fd-canvas-body');
  await screen(page, `twelfths-e-canvas-${size.toLowerCase()}`);
  const form = await page.context().newPage();
  await form.setViewportSize({ width: 1280, height: 1000 });
  await form.goto('/script/');
  await form.evaluate(
    ([page, width, desktop]) => {
      const demo = (window as unknown as { fieldiaDemo: { handle: { destroy(): void } } }).fieldiaDemo;
      demo.handle.destroy();
      const app = document.getElementById('app') as HTMLElement;
      const fieldia = (window as unknown as { Fieldia: { mountViewer(e: HTMLElement, o: unknown): unknown; createMemoryDataSource(): unknown } }).Fieldia;
      fieldia.mountViewer(app, { page, dataSource: fieldia.createMemoryDataSource(), skin: 'outlined' });
      const root = app.querySelector('.fd-form') as HTMLElement;
      root.style.width = `${desktop ? Math.max(width as number, 961) : width}px`;
      (root.querySelector('.fd-content') as HTMLElement).style.maxWidth = `${width}px`;
    },
    [built, width, size === 'Desktop'] as const
  );
  await expect.poll(() => form.locator('.fd-sections').evaluate((e) => Math.round(e.getBoundingClientRect().width))).toBe(Math.round(width));
  const inForm = await boxes(form, '.fd-sections');
  await screen(form, `twelfths-e-form-${size.toLowerCase()}`);
  await form.close();
  const compared = Object.keys(inForm).filter((id) => onCanvas[id]);
  const off = compared.filter((id) => (['x', 'y', 'w', 'h'] as const).some((k) => Math.abs(onCanvas[id][k] - inForm[id][k]) > 3)).map((id) => `${id}: canvas ${JSON.stringify(onCanvas[id])} form ${JSON.stringify(inForm[id])}`);
  return { compared: compared.length, off, onCanvas };
}

test('(e) after a run of drops, every part on its tracks; the canvas draws each part where the form does — a tablet keeps proportions, a phone stacks', async ({ page }) => {
  await openVisit(page);
  await inThirds(page);
  // Customer a twelfth wider, by the keys; Manager to call? beside Due by: Follow-up in twelfths too.
  await pick(page, 'Customer');
  await gutter(page).focus();
  await page.keyboard.press('ArrowRight');
  const due = await own(page, 'Due by');
  await dropAt(page, centre(await at(page, 'Manager to call?')), { x: due.right + 14, y: due.top + due.height / 2 });
  await page.mouse.click(5, 5);
  expect(await layout(page)).toEqual([
    ['Customer:5', 'Visit date:3', 'Next step:4', 'Notes:12'],
    ['Due by:6', 'Manager to call?:6'],
  ]);
  const { checked, off } = await misalignedOnCanvas(page);
  expect(checked).toBeGreaterThan(5);
  expect(off).toEqual([]);
  const page_ = await built(page);
  for (const size of ['Desktop', 'Tablet', 'Phone'] as const) {
    const { compared, off: elsewhere, onCanvas } = await canvasAndForm(page, size, page_);
    expect(compared, `${size}: parts compared`).toBeGreaterThan(6);
    expect(elsewhere, `${size}: parts the canvas draws elsewhere than the form`).toEqual([]);
    const ids = await page.evaluate(() => {
      const visit = (window as unknown as { fieldiaDesigner: { designer: { getPage(): { layout: { children: { children: { id: string }[] }[] } } } } }).fieldiaDesigner.designer.getPage().layout.children[0];
      return visit.children.map((c) => c.id);
    });
    const [c, d, n] = ids.map((id) => onCanvas[id]);
    if (size === 'Phone') expect(new Set([c.y, d.y, n.y]).size, 'a phone stacks them').toBe(3);
    else {
      expect(new Set([c.y, d.y, n.y]).size, `${size}: one row`).toBe(1);
      // 5 : 3 : 4, as near as whole pixels and the gaps between them go.
      expect(Math.abs(c.w / n.w - 5 / 4), `${size}: Customer to Next step`).toBeLessThan(0.08);
      expect(Math.abs(d.w / n.w - 3 / 4), `${size}: Visit date to Next step`).toBeLessThan(0.08);
    }
  }
});

test('(f) no box drawn in a box, and axe clean on the gutter, Twelfths, Rows and the fractions of a row', async ({ page }) => {
  await openVisit(page);
  await inThirds(page);
  await pick(page, 'Customer');
  await expect(gutter(page)).toBeVisible();
  expect(await doubleLines(page)).toEqual([]);
  await page.getByRole('tab', { name: 'Layout' }).click();
  await expect(page.getByRole('group', { name: 'Width' }).getByRole('button', { name: '⅓ of the row' })).toHaveAttribute('aria-pressed', 'true');
  await screen(page, 'twelfths-f-field-width', { viewport: true });
  expect(await axeFindings(page, 'a field in twelfths, its gutter and widths')).toEqual([]);
  await pickGroup(page, 'section-1');
  await page.getByRole('tab', { name: 'Layout' }).click();
  await expect(page.getByRole('group', { name: 'Rows' })).toBeVisible();
  expect(await doubleLines(page)).toEqual([]);
  expect(await axeFindings(page, 'a group in twelfths, its columns and rows')).toEqual([]);
  expect(await doubleLines(page, '.fd-canvas *')).toEqual([]);
});
