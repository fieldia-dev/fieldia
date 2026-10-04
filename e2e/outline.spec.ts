import { expect, test, type Locator, type Page } from '@playwright/test';
import { doubleLines } from './designer-support';
import { expectNoSidewaysScroll, screen } from './support';

/**
 * The outline, used as a person uses it, in the screen editor and the survey
 * editor: the page as a tree by the keyboard alone, a range picked with Shift
 * and grouped from the bar, rows dragged into another group and onto another
 * page at hand speed, rows moved with Alt and the arrows and the move read
 * back, parts copied and pasted — into another group, and into a second
 * designer through the clipboard — the sheet of shortcuts, right to left, and
 * at a phone's width.
 */

const LAYOUT = '/screen/?start=layout';
const SURVEY = '/designer/?start=survey';

async function openOutline(page: Page, url = LAYOUT, options: { advanced?: boolean; width?: number } = {}) {
  await page.setViewportSize({ width: options.width ?? 1280, height: 900 });
  await page.goto(url);
  if (options.advanced) {
    await page.getByRole('group', { name: 'Editing mode' }).getByRole('button', { name: 'Advanced' }).click();
    await expect(page.locator('.fd-screen-designer')).toHaveAttribute('data-mode', 'advanced');
  }
  await page.locator('.fd-rail [data-rail="outline"]').click();
  await expect(page.getByRole('tree', { name: 'The page’s parts' })).toBeVisible();
}

const row = (page: Page, id: string): Locator => page.locator(`.fd-outline [role="treeitem"][data-pick="${id}"]`);
const said = (page: Page) => page.locator('.fd-outline-said');
const selected = (page: Page) => page.evaluate(() => window.fieldiaDesigner.designer.getState().selected);
const picked = (page: Page) => page.evaluate(() => (window.fieldiaDesigner.designer.getState() as unknown as { picked: string[] }).picked);

/** What holds a part, and what that holds: read from the page being built. */
function where(page: Page, id: string): Promise<{ parent: string; kids: string[]; title?: string } | null> {
  return page.evaluate((id) => {
    type Node = { id: string; title?: string; label?: string; children?: Node[] };
    const walk = (holder: Node): { parent: string; kids: string[]; title?: string } | null => {
      for (const node of holder.children ?? []) {
        if (node.id === id) return { parent: holder.id, kids: (holder.children ?? []).map((c) => c.id), title: holder.title ?? holder.label };
        const deeper = walk(node);
        if (deeper) return deeper;
      }
      return null;
    };
    return walk(window.fieldiaDesigner.designer.getPage().layout as unknown as Node);
  }, id);
}

/** The fields parts show, by the parts' ids. */
function fieldsOf(page: Page, ids: string[]): Promise<(string | undefined)[]> {
  return page.evaluate((ids) => {
    type Node = { id: string; field?: string; children?: Node[] };
    const all: Node[] = [];
    const walk = (node: Node) => (node.children ?? []).forEach((child) => (all.push(child), walk(child)));
    walk(window.fieldiaDesigner.designer.getPage().layout as unknown as Node);
    return ids.map((id) => all.find((n) => n.id === id)?.field);
  }, ids);
}

/** Press on a row and move, at hand speed — steps of 40 to 80 pixels — to a point on another row; let go unless asked not to. */
async function dragRow(page: Page, from: string, to: string, fraction: number, options: { release?: boolean; dx?: number } = {}) {
  await row(page, from).scrollIntoViewIfNeeded();
  const a = (await row(page, from).boundingBox())!;
  const start = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  // Off the row first, then towards where the target is now (it may have moved as the rail scrolled).
  await page.mouse.move(start.x, start.y + 8);
  let at = { x: start.x, y: start.y + 8 };
  for (let look = 0; look < 4; look++) {
    const b = (await row(page, to).boundingBox())!;
    const end = { x: start.x + (options.dx ?? 0), y: b.y + b.height * fraction };
    const steps = Math.max(1, Math.ceil(Math.hypot(end.x - at.x, end.y - at.y) / 60));
    for (let i = 1; i <= steps; i++) await page.mouse.move(at.x + ((end.x - at.x) * i) / steps, at.y + ((end.y - at.y) * i) / steps);
    at = end;
    const again = (await row(page, to).boundingBox())!;
    if (Math.abs(again.y + again.height * fraction - end.y) < 3) break;
  }
  if (options.release !== false) await page.mouse.up();
}

test.describe('the outline by the keyboard alone', () => {
  test('in the screen editor: Tab in, arrows, fold, unfold, letters, Home, End, Enter', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(LAYOUT);
    // The rail's tabs: the one open takes Tab, the arrows open the next.
    await page.getByRole('tab', { name: 'Add' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Outline' })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Tab');
    await expect(row(page, 'personal')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(row(page, 'f-photo')).toBeFocused();
    await expect(row(page, 'f-photo')).toHaveAttribute('aria-selected', 'true');
    expect(await selected(page)).toBe('f-photo');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowLeft');
    await expect(row(page, 'who')).toHaveAttribute('aria-expanded', 'false');
    await expect(row(page, 'f-first-name')).toHaveCount(0);
    await page.keyboard.press('ArrowRight');
    await expect(row(page, 'who')).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(row(page, 'f-first-name')).toBeFocused();
    await page.keyboard.type('co');
    await expect(row(page, 'f-country')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(row(page, 'personal')).toBeFocused();
    await page.keyboard.press('End');
    await expect(row(page, 'b-later')).toBeFocused();
    await page.keyboard.press('Enter');
    expect(await selected(page)).toBe('b-later');
    await expect(page.locator('.fd-canvas-body [data-node="b-later"]')).toBeInViewport();
    // Tab leaves the tree in one step: one row takes it.
    await expect(page.locator('.fd-outline [role="treeitem"][tabindex="0"]')).toHaveCount(1);
    await screen(page, 'outline-01-keyboard', { viewport: true });
    expect(await doubleLines(page)).toEqual([]);
  });

  test('in the survey editor: its pages and questions, a question to the next page with Alt+↓, said aloud', async ({ page }) => {
    await openOutline(page, SURVEY);
    await page.getByRole('tab', { name: 'Outline' }).focus();
    await page.keyboard.press('Tab');
    await expect(row(page, 'step-about')).toBeFocused();
    await expect(row(page, 'step-about')).toHaveAttribute('aria-level', '1');
    await expect(row(page, 'q-email')).toHaveAttribute('aria-level', '2');
    await page.keyboard.press('ArrowLeft');
    await expect(row(page, 'q-name')).toHaveCount(0);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.type('em');
    await expect(row(page, 'q-email')).toBeFocused();
    await page.keyboard.press('Alt+ArrowDown');
    await expect(said(page)).toHaveText('Email: into “Using the product”, before “Do you use the product today?”');
    expect((await where(page, 'q-email'))?.parent).toBe('step-usage');
    await expect(row(page, 'q-email')).toBeFocused();
    await page.keyboard.press('Alt+ArrowUp');
    await expect(said(page)).toHaveText('Email: into “About you”, at the end');
    await screen(page, 'outline-02-survey-keyboard', { viewport: true });
  });
});

test('Shift-click a range in the outline, and group it from the bar', async ({ page }) => {
  await openOutline(page, LAYOUT, { advanced: true });
  await row(page, 'f-first-name').click();
  await row(page, 'f-mobile').click({ modifiers: ['Shift'] });
  expect(await picked(page)).toEqual(['f-first-name', 'f-last-name', 'f-email', 'f-mobile']);
  await expect(page.locator('.fd-outline [aria-selected="true"]')).toHaveCount(4);
  const bar = page.getByRole('toolbar', { name: 'What is picked' });
  await expect(bar.locator('.fd-multi-count')).toHaveText('4 picked');
  await screen(page, 'outline-03-range', { viewport: true });
  await bar.getByRole('button', { name: 'Group' }).click();
  const group = await where(page, 'f-first-name');
  expect(group?.title).toBe('New group');
  expect(group?.kids).toEqual(['f-first-name', 'f-last-name', 'f-email', 'f-mobile']);
  await expect(row(page, group!.parent)).toContainText('New group');
  // ⌘-click lets one go.
  await row(page, 'f-city').click();
  await row(page, 'f-country').click({ modifiers: ['ControlOrMeta'] });
  await row(page, 'f-city').click({ modifiers: ['ControlOrMeta'] });
  expect(await picked(page)).toEqual(['f-country']);
  expect(await doubleLines(page)).toEqual([]);
});

test.describe('dragging rows', () => {
  test('a field into another group, by the group’s middle; then before a field, by a line', async ({ page }) => {
    await openOutline(page);
    await dragRow(page, 'f-email', 'emergency', 0.5, { release: false });
    await expect(row(page, 'emergency')).toHaveClass(/fd-outline-into/);
    await expect(page.locator('.fd-outline-chip')).toContainText('into “Emergency contact”, at the end');
    await screen(page, 'outline-04-drag-into', { viewport: true });
    await page.mouse.up();
    expect((await where(page, 'f-email'))?.kids).toEqual(['f-ec-name', 'f-ec-relation', 'f-ec-phone', 'f-email']);
    await expect(said(page)).toHaveText('Work email: into “Emergency contact”, at the end');
    await dragRow(page, 'f-city', 'f-ec-relation', 0.15, { release: false });
    const line = page.locator('.fd-outline-line');
    await expect(line).toBeVisible();
    await expect(page.locator('.fd-outline-chip')).toContainText('into “Emergency contact”, before “Relation”');
    // The line starts as far in as the rows it lands among.
    const lineBox = (await line.boundingBox())!;
    const label = (await row(page, 'f-ec-relation').locator('.fd-dicon').first().boundingBox())!;
    expect(Math.abs(lineBox.x - label.x)).toBeLessThan(24);
    await screen(page, 'outline-05-drag-line', { viewport: true });
    await page.mouse.up();
    expect((await where(page, 'f-city'))?.kids).toEqual(['f-ec-name', 'f-city', 'f-ec-relation', 'f-ec-phone', 'f-email']);
    // One undo puts it back.
    await page.keyboard.press('ControlOrMeta+z');
    expect((await where(page, 'f-city'))?.parent).toBe('address');
  });

  test('a tab where it cannot go says why, and nothing moves', async ({ page }) => {
    await openOutline(page);
    await dragRow(page, 'tab-pay', 'f-confirm', 0.5, { release: false });
    await expect(page.locator('.fd-outline-chip')).toContainText('A tab moves only among its tabs');
    await expect(page.locator('.fd-outline-chip')).toHaveClass(/fd-outline-refused/);
    await page.mouse.up();
    expect((await where(page, 'tab-pay'))?.parent).toBe('job-tabs');
  });

  test('a survey question to another page', async ({ page }) => {
    await openOutline(page, SURVEY);
    await dragRow(page, 'q-name', 'step-usage', 0.5);
    expect((await where(page, 'q-name'))?.parent).toBe('step-usage');
    await expect(said(page)).toHaveText('Your name: into “Using the product”, at the end');
    // The card is on that page on the canvas too.
    await expect(page.locator('.fd-design-step[data-node="step-usage"] .fd-q[data-node="q-name"]')).toHaveCount(1);
    await screen(page, 'outline-06-survey-drag', { viewport: true });
  });
});

test('Alt and the arrows move what is picked in the screen editor, each move read back', async ({ page }) => {
  await openOutline(page);
  await row(page, 'f-city').click();
  await page.keyboard.press('Alt+ArrowUp');
  await expect(said(page)).toHaveText('City: before “Street and number”');
  await page.keyboard.press('Alt+ArrowUp');
  await expect(said(page)).toHaveText('It is at the top of “Home address”: Alt+← takes it out');
  await page.keyboard.press('Alt+ArrowLeft');
  await expect(said(page)).toHaveText('City: into “Side by side”, before “Emergency contact”');
  await page.keyboard.press('Alt+ArrowRight');
  await expect(said(page)).toHaveText('City: into “Home address”, at the end');
  expect((await where(page, 'f-city'))?.parent).toBe('address');
  await expect(row(page, 'f-city')).toBeFocused();
});

test.describe('copy and paste', () => {
  test('two fields into another group, and into a second designer through the clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openOutline(page, LAYOUT, { advanced: true });
    await row(page, 'f-city').click();
    await row(page, 'f-postcode').click({ modifiers: ['Shift'] });
    await page.keyboard.press('ControlOrMeta+c');
    await expect(page.locator('.fd-clipboard-said')).toHaveText('Copied 2 parts');
    await row(page, 'emergency').click();
    await page.keyboard.press('ControlOrMeta+v');
    await expect(page.locator('.fd-clipboard-said')).toHaveText('Pasted 2 parts');
    const kids = (await where(page, 'f-ec-name'))!.kids;
    expect(kids.slice(0, 3)).toEqual(['f-ec-name', 'f-ec-relation', 'f-ec-phone']);
    expect(kids).toHaveLength(5);
    expect(await fieldsOf(page, kids.slice(3))).toEqual(['city_2', 'postcode_2']);
    await screen(page, 'outline-07-pasted', { viewport: true });

    // A second designer, in another tab of the browser.
    const other = await context.newPage();
    await other.setViewportSize({ width: 1280, height: 900 });
    await other.goto('/screen/?start=blank');
    await other.locator('.fd-rail [data-rail="outline"]').click();
    await row(other, 'section-1').click();
    await other.keyboard.press('ControlOrMeta+v');
    await expect(other.locator('.fd-clipboard-said')).toHaveText('Pasted 2 parts');
    expect(await other.evaluate(() => Object.keys(window.fieldiaDesigner.designer.getPage().fields))).toEqual(['city', 'postcode']);
    await expect(row(other, 'section-1')).toHaveAttribute('aria-expanded', 'true');
    await screen(other, 'outline-08-pasted-other', { viewport: true });
  });

  test('words that are not Fieldia’s paste nothing, and say so; a box keeps its own paste', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openOutline(page);
    await page.evaluate(() => navigator.clipboard.writeText('Just some words'));
    await row(page, 'f-city').click();
    await page.keyboard.press('ControlOrMeta+v');
    await expect(page.locator('.fd-clipboard-said')).toHaveText('There are no Fieldia parts to paste: copy parts in a Fieldia designer first');
    const title = page.getByRole('textbox', { name: 'Screen title' });
    await title.fill('');
    await title.focus();
    await page.keyboard.press('ControlOrMeta+v');
    await expect(title).toHaveValue('Just some words');
  });
});

test('the sheet of shortcuts, by “?” and by ⌘K', async ({ page }) => {
  await openOutline(page);
  await row(page, 'f-city').click();
  await page.keyboard.type('?');
  const sheet = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('heading', { level: 3 })).toHaveText(['Anywhere', 'Canvas', 'Outline', 'Typing']);
  await expect(sheet.getByRole('searchbox', { name: 'Find a key' })).toBeFocused();
  // ⌘ on a Mac, Ctrl elsewhere.
  const mac = await page.evaluate(() => /Mac/.test(navigator.platform));
  await expect(sheet.locator('kbd').first()).toHaveText(mac ? '⌘K' : 'Ctrl+K');
  await screen(page, 'outline-09-shortcuts', { viewport: true });
  expect(await doubleLines(page)).toEqual([]);
  await page.keyboard.type('paste');
  await expect(sheet.getByRole('heading', { level: 3 })).toHaveText(['Anywhere', 'Typing']);
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(row(page, 'f-city')).toBeFocused();
  // From Find anything.
  await page.keyboard.press('ControlOrMeta+k');
  await page.keyboard.type('keyboard');
  await page.keyboard.press('Enter');
  await expect(sheet).toBeVisible();
  await page.keyboard.press('Escape');
  // In the survey editor too, without the canvas's keys.
  await openOutline(page, SURVEY);
  await page.locator('body').click({ position: { x: 4, y: 4 } });
  await page.keyboard.type('?');
  await expect(sheet.getByRole('heading', { level: 3 })).toHaveText(['Anywhere', 'Outline', 'Typing']);
});

test('right to left: the rows indent from the right, and ← opens what → folds', async ({ page }) => {
  await openOutline(page);
  await page.evaluate(() => (document.documentElement.dir = 'rtl'));
  const outer = (await row(page, 'who').locator('.fd-dicon').nth(1).boundingBox())!;
  const inner = (await row(page, 'f-email').locator('.fd-dicon').first().boundingBox())!;
  expect(inner.x + inner.width).toBeLessThan(outer.x + outer.width - 8);
  // An English name on a right-to-left page keeps its start in view, by its icon.
  const name = row(page, 'f-first-name').locator('.fd-outline-name');
  expect(await name.evaluate((e) => getComputedStyle(e).direction)).toBe('ltr');
  const words = (await row(page, 'f-first-name').locator('.fd-outline-label').boundingBox())!;
  expect(words.x).toBeGreaterThanOrEqual((await name.boundingBox())!.x - 1);
  // A short one sits by its icon.
  const icon = (await row(page, 'f-photo').locator('.fd-dicon').first().boundingBox())!;
  const kind = (await row(page, 'f-photo').locator('.fd-outline-kind').boundingBox())!;
  expect(icon.x - (kind.x + kind.width)).toBeLessThan(12);
  await row(page, 'who').click();
  await page.keyboard.press('ArrowRight');
  await expect(row(page, 'who')).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('ArrowLeft');
  await expect(row(page, 'who')).toHaveAttribute('aria-expanded', 'true');
  await row(page, 'f-city').click();
  await page.keyboard.press('Alt+ArrowRight');
  await expect(said(page)).toHaveText('City: into “Side by side”, before “Emergency contact”');
  await screen(page, 'outline-10-rtl', { viewport: true });
  expect(await doubleLines(page)).toEqual([]);
});

test('at a phone’s width: the outline fits, picks, folds and moves', async ({ page }) => {
  await openOutline(page, LAYOUT, { width: 390 });
  await expectNoSidewaysScroll(page);
  const tree = (await page.getByRole('tree', { name: 'The page’s parts' }).boundingBox())!;
  expect(tree.x + tree.width).toBeLessThanOrEqual(390);
  await row(page, 'f-city').click();
  expect(await selected(page)).toBe('f-city');
  await page.keyboard.press('Alt+ArrowDown');
  await expect(said(page)).toHaveText('City: after “Postcode”');
  await row(page, 'personal').locator('[data-twist]').click();
  await expect(row(page, 'personal')).toHaveAttribute('aria-expanded', 'false');
  await dragRow(page, 'f-street', 'emergency', 0.5);
  expect((await where(page, 'f-street'))?.parent).toBe('emergency');
  await expectNoSidewaysScroll(page);
  await screen(page, 'outline-11-phone');
  expect(await doubleLines(page)).toEqual([]);
});
