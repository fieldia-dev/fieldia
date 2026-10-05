import { expect, test, type Page } from '@playwright/test';
import { boxes, cardOf, centre, doubleLines, dropAt, misalignedOnCanvas } from './designer-support';
import { expectNoSidewaysScroll, screen } from './support';

/**
 * The screen designer's Advanced canvas, used as a person uses it: the page
 * drawn as the form draws it, parts dropped beside, under, into and between,
 * widths dragged, several picked at once, and moves made from the keyboard —
 * on the "New employee" page, at a desktop's width and a phone's.
 */

const LAYOUT = '/screen/?start=layout';

/** The canvas at a size of screen, its parts' boxes; then the form as wide as the canvas, its parts' boxes, compared. */
async function agreeAt(page: Page, size: 'desktop' | 'tablet' | 'phone', viewport: number) {
  await page.setViewportSize({ width: viewport, height: 1000 });
  await page.goto(LAYOUT);
  await page.getByRole('group', { name: 'Editing mode' }).getByRole('button', { name: 'Advanced' }).click();
  await page.getByRole('group', { name: 'Screen size' }).getByRole('button', { name: size[0].toUpperCase() + size.slice(1) }).click();
  await expect(page.locator('.fd-canvas.fd-form')).toHaveAttribute('data-size', size);
  await expect(page.locator('.fd-canvas-body [data-node="who"]')).toBeVisible();
  const width = await page.locator('.fd-canvas-body').evaluate((e) => e.getBoundingClientRect().width);
  const onCanvas = await boxes(page, '.fd-canvas-body');
  await screen(page, `advanced-01-canvas-${size}`);

  // The same page in the form, its parts as wide as the canvas's. The form takes its columns from its own width: on a
  // desktop it is wider than 760px — its parts held to the canvas's width, as the canvas shows a desktop's columns at its own.
  await page.goto('/plain/?page=layout&skin=outlined');
  const sections = page.locator('.fd-sections').first();
  await expect(sections).toBeVisible();
  await page.evaluate(([width, desktop]) => {
    const form = (document.querySelector('.fd-sections') as HTMLElement).closest('.fd-form') as HTMLElement;
    form.style.width = `${desktop ? Math.max(width, 961) : width}px`;
    (form.querySelector('.fd-content') as HTMLElement).style.maxWidth = `${width}px`;
  }, [width, size === 'desktop'] as const);
  // The canvas shows every part, and the first tab open; the form shows "Contract ends" only for a fixed term — shown here as it is.
  await page.evaluate(() => {
    for (const part of document.querySelectorAll<HTMLElement>('.fd-sections [data-node][hidden]')) if (!part.closest('.fd-tabpanel[hidden]')) part.hidden = false;
  });
  await expect.poll(() => sections.evaluate((e) => Math.round(e.getBoundingClientRect().width))).toBe(Math.round(width));
  const inForm = await boxes(page, '.fd-sections');

  const compared = Object.keys(inForm).filter((id) => onCanvas[id]);
  expect(compared.length, 'parts compared').toBeGreaterThan(20);
  const off = compared.filter((id) => ['x', 'y', 'w', 'h'].some((k) => Math.abs(onCanvas[id][k as 'x'] - inForm[id][k as 'x']) > 3)).map((id) => `${id}: canvas ${JSON.stringify(onCanvas[id])} form ${JSON.stringify(inForm[id])}`);
  expect(off, `${size}: parts the canvas draws elsewhere than the form`).toEqual([]);
  return width;
}

test('the canvas draws each part where the form puts it, on a desktop, a tablet and a phone', async ({ page }) => {
  await agreeAt(page, 'desktop', 1280);
  expect(await agreeAt(page, 'tablet', 1280)).toBeLessThanOrEqual(760);
  expect(await agreeAt(page, 'phone', 1280)).toBeLessThanOrEqual(520);
});

test('each size shows its own columns, whatever the canvas’s width; Simple shows a desktop’s', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/screen/');
  // A group with three columns on a desktop, two on a tablet, one on a phone — as the panel sets them.
  await page.evaluate(() => (window as unknown as { fieldiaDesigner: { designer: { setColumns(id: string, c: unknown): boolean } } }).fieldiaDesigner.designer.setColumns('section-1', { wide: 3, medium: 2, narrow: 1 }));
  const across = () => page.locator('.fd-canvas [data-node="section-1"] > .fd-grid').evaluate((g) => getComputedStyle(g).gridTemplateColumns.split(' ').length);
  await expect(page.locator('.fd-screen-designer')).toHaveAttribute('data-mode', 'simple');
  expect(await across()).toBe(3);
  await page.getByRole('group', { name: 'Editing mode' }).getByRole('button', { name: 'Advanced' }).click();
  const sizes = page.getByRole('group', { name: 'Screen size' });
  expect(await across()).toBe(3);
  await sizes.getByRole('button', { name: 'Tablet' }).click();
  await expect.poll(across).toBe(2);
  await screen(page, 'advanced-13-size-tablet', { viewport: true });
  await sizes.getByRole('button', { name: 'Phone' }).click();
  await expect.poll(across).toBe(1);
  expect(await page.locator('.fd-canvas.fd-form').evaluate((c) => Math.round(c.getBoundingClientRect().width))).toBe(390);
  await screen(page, 'advanced-14-size-phone', { viewport: true });
  await sizes.getByRole('button', { name: 'Desktop' }).click();
  await expect.poll(across).toBe(3);
  await screen(page, 'advanced-15-size-desktop', { viewport: true });
  // Kept for the next time, in this browser.
  await sizes.getByRole('button', { name: 'Phone' }).click();
  await page.reload();
  await expect(page.locator('.fd-canvas.fd-form')).toHaveAttribute('data-size', 'phone');
});

// ---- dropping in Advanced ----------------------------------------------------------

async function openAdvanced(page: Page, width = 1280) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(LAYOUT);
  await page.getByRole('group', { name: 'Editing mode' }).getByRole('button', { name: 'Advanced' }).click();
  await expect(page.locator('.fd-screen-designer')).toHaveAttribute('data-mode', 'advanced');
}

const part = (page: Page, id: string) => page.locator(`.fd-canvas-body [data-node="${id}"]`);
const tile = (page: Page, spec: string) => page.locator(`.fd-toolbox [data-tool="${spec}"]`);
async function tileAt(page: Page, spec: string) {
  await tile(page, spec).scrollIntoViewIfNeeded();
  return centre((await tile(page, spec).boundingBox())!);
}

async function box(page: Page, id: string) {
  await part(page, id).scrollIntoViewIfNeeded();
  return (await part(page, id).boundingBox())!;
}

/** Where a part sits in the page being built: what holds it, how that looks, and what is beside it. */
function where(page: Page, id: string) {
  return page.evaluate((id) => {
    type Node = { id: string; type: string; style?: string; title?: string; columns?: unknown; children?: Node[] };
    const built = (window as unknown as { fieldiaDesigner: { designer: { getPage(): { layout: Node } } } }).fieldiaDesigner.designer.getPage();
    const find = (holder: Node): Node | null => {
      for (const child of holder.children ?? []) {
        if (child.id === id) return holder;
        const deeper = find(child);
        if (deeper) return deeper;
      }
      return null;
    };
    const parent = find(built.layout);
    return parent && { parent: parent.id, style: parent.style, title: parent.title, columns: parent.columns, kids: (parent.children ?? []).map((c) => c.id) };
  }, id);
}

test('beside a field in a full row: the two share its cell', async ({ page }) => {
  await openAdvanced(page);
  const first = await box(page, 'f-first-name');
  const { words } = await dropAt(page, centre(await box(page, 'f-nationality')), { x: first.x + first.width - 12, y: first.y + first.height / 2 }, { shot: 'advanced-02-beside' });
  expect(words).toBe('beside “First name”');
  expect(await where(page, 'f-nationality')).toMatchObject({ style: 'plain', kids: ['f-first-name', 'f-nationality'] });
  await expect(part(page, 'f-nationality')).toBeVisible();
});

test('beside a field in a named group’s row: the row divides in twelfths, as the site visit is dragged', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/screen/');
  await page.getByRole('group', { name: 'Editing mode' }).getByRole('button', { name: 'Advanced' }).click();
  await expect(page.locator('.fd-screen-designer')).toHaveAttribute('data-mode', 'advanced');
  const at = async (label: string) => (await (await cardOf(page, label)).boundingBox())!;
  const notes = await (await cardOf(page, 'Notes')).getAttribute('data-node');
  const date = await at('Visit date');
  // Notes, the whole width under the two, put on Visit date's far side.
  const { words, refused } = await dropAt(page, centre(await at('Notes')), { x: date.x + date.width - 12, y: date.y + date.height / 2 }, { shot: 'advanced-third-column-drag' });
  expect([words, refused]).toEqual(['at the end of the row, after “Visit date” — the row in thirds', false]);
  expect(await where(page, notes as string)).toMatchObject({ title: 'Visit', columns: 12 });
  // One row of three, on the group's twelve columns.
  const tops = await Promise.all(['Customer', 'Visit date', 'Notes'].map(async (label) => Math.round((await at(label)).y)));
  expect(new Set(tops).size, `tops ${tops}`).toBe(1);
  const { checked, off } = await misalignedOnCanvas(page);
  expect(checked).toBeGreaterThan(2);
  expect(off).toEqual([]);
  await screen(page, 'advanced-third-column', { viewport: true });
  // A field from the toolbox beside Notes: the row in quarters; then the row holds four, and a fifth is refused.
  // The toolbox scrolls into view first: Notes is measured after it.
  const number = await tileAt(page, 'kind:number');
  const third = await at('Notes');
  expect((await dropAt(page, number, { x: third.x + third.width - 12, y: third.y + third.height / 2 }, { shot: 'advanced-fourth-column-drag' })).words).toBe('at the end of the row, after “Notes” — the row in quarters');
  expect(await where(page, notes as string)).toMatchObject({ columns: 12 });
  const day = await tileAt(page, 'kind:date');
  const last = await at('Notes');
  expect(await dropAt(page, day, { x: last.x + last.width - 12, y: last.y + last.height / 2 }, { release: false })).toEqual({ words: 'A row holds four', refused: true });
  await page.keyboard.press('Escape');
  await page.mouse.up();
});

test('under a field in a grid: its cell becomes a column of two', async ({ page }) => {
  await openAdvanced(page);
  const first = await box(page, 'f-first-name');
  const { words } = await dropAt(page, centre(await box(page, 'f-mobile')), { x: first.x + first.width / 2, y: first.y + first.height * 0.72 });
  expect(words).toBe('under “First name”');
  expect(await where(page, 'f-mobile')).toMatchObject({ kids: ['f-first-name', 'f-mobile'], columns: 1 });
});

test('between two rows of a grid: a new full-width row, from the toolbox', async ({ page }) => {
  await openAdvanced(page);
  const first = await box(page, 'f-first-name');
  const email = await box(page, 'f-email');
  const { words } = await dropAt(page, await tileAt(page, 'kind:paragraph'), { x: first.x + first.width / 2, y: (first.y + first.height + email.y) / 2 }, { shot: 'advanced-03-new-row' });
  expect(words).toBe('new full-width row above “Work email”');
  const built = await where(page, 'f-email');
  expect(built?.kids.length).toBe(7);
  // A new field comes with its name selected, to be typed over where it stands.
  await expect(page.locator('.fd-canvas-field.fd-editing [data-inline="label"]')).toBeFocused();
});

test('on a group’s outer edge in a row of groups: a new column, never a fifth', async ({ page }) => {
  await openAdvanced(page);
  for (const [kind, expected] of [['kind:email', 'new column beside “Emergency contact”'], ['kind:phone', 'new column beside “Emergency contact”']] as const) {
    const emergency = await box(page, 'emergency');
    const { words } = await dropAt(page, await tileAt(page, kind), { x: emergency.x + emergency.width - 4, y: emergency.y + emergency.height / 2 });
    expect(words).toBe(expected);
  }
  expect((await where(page, 'emergency'))?.kids.length).toBe(4);
  const emergency = await box(page, 'emergency');
  const before = await page.evaluate(() => JSON.stringify((window as unknown as { fieldiaDesigner: { designer: { getPage(): unknown } } }).fieldiaDesigner.designer.getPage()));
  const { words, refused } = await dropAt(page, await tileAt(page, 'kind:date'), { x: emergency.x + emergency.width - 4, y: emergency.y + emergency.height / 2 }, { shot: 'advanced-04-refused' });
  expect([words, refused]).toEqual(['A row holds four', true]);
  await expect(page.locator('.fd-drop-bar')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.stringify((window as unknown as { fieldiaDesigner: { designer: { getPage(): unknown } } }).fieldiaDesigner.designer.getPage()))).toBe(before);
});

test('into an empty group, and blocks from the toolbox dropped the same way', async ({ page }) => {
  await openAdvanced(page);
  const confirm = await box(page, 'f-confirm');
  expect((await dropAt(page, await tileAt(page, 'block:group'), { x: confirm.x + confirm.width / 2, y: confirm.y + confirm.height - 8 })).words).toBe('under “I confirm these details are correct”');
  const group = page.locator('.fd-canvas-body fieldset[data-node^="section-"]');
  await expect(group).toHaveCount(1);
  const id = (await group.getAttribute('data-node')) as string;
  await group.scrollIntoViewIfNeeded();
  const empty = (await group.boundingBox())!;
  const { words } = await dropAt(page, centre(await box(page, 'h-send')), { x: empty.x + empty.width / 2, y: empty.y + empty.height / 2 + 10 }, { shot: 'advanced-05-into' });
  expect(words).toBe('into “New group”');
  expect((await where(page, 'h-send'))?.parent).toBe(id);
  const note = await box(page, 't-note');
  expect((await dropAt(page, await tileAt(page, 'block:divider'), { x: note.x + note.width / 2, y: note.y + note.height - 3 })).words).toBe('under “HR goes through every detail…”');
  expect((await where(page, 't-note'))?.kids).toContain('divider-1');
  expect((await where(page, 't-note'))?.kids.indexOf('divider-1')).toBe(((await where(page, 't-note'))?.kids.indexOf('t-note') ?? 0) + 1);
});

test('right to left, a field’s left edge is the side after it', async ({ page }) => {
  await openAdvanced(page);
  await page.evaluate(() => (document.documentElement.dir = 'rtl'));
  const first = await box(page, 'f-first-name');
  const { words } = await dropAt(page, centre(await box(page, 'f-nationality')), { x: first.x + 12, y: first.y + first.height / 2 });
  expect(words).toBe('beside “First name”');
  expect((await where(page, 'f-nationality'))?.kids).toEqual(['f-first-name', 'f-nationality']);
});

test('Simple keeps today’s drag: no drop line, no chip of words', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(LAYOUT);
  await expect(page.locator('.fd-screen-designer')).toHaveAttribute('data-mode', 'simple');
  const first = await box(page, 'f-first-name');
  const from = centre(await box(page, 'f-nationality'));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 4; i++) await page.mouse.move(from.x + ((first.x + 20 - from.x) * i) / 4, from.y + ((first.y + 20 - from.y) * i) / 4);
  await expect(page.locator('.fd-drop-chip')).toHaveCount(0);
  await expect(page.locator('.fd-drop-slot')).toHaveCount(1);
  await page.mouse.up();
  expect((await where(page, 'f-nationality'))?.parent).toBe('who');
});

// ---- widths ---------------------------------------------------------------------------

/** The page being built, read as JSON, for a part's width. */
const spanOf = (page: Page, id: string) =>
  page.evaluate((id) => {
    const text = JSON.stringify((window as unknown as { fieldiaDesigner: { designer: { getPage(): unknown } } }).fieldiaDesigner.designer.getPage());
    const at = text.indexOf(`"id":"${id}"`);
    const own = text.slice(at, text.indexOf('}', at));
    return Number(/"colspan":(\d+)/.exec(own)?.[1] ?? 1);
  }, id);

test('the width handle on a picked part’s end edge snaps to the columns, saying how many — in an arrangement', async ({ page }) => {
  await openAdvanced(page);
  await part(page, 'f-nationality').click({ position: { x: 6, y: 6 } });
  const handle = page.locator('.fd-width-handle');
  await expect(handle).toBeVisible();
  const h = (await handle.boundingBox())!;
  const nationality = (await part(page, 'f-nationality').boundingBox())!;
  // On the end edge of the part, halfway down it.
  expect(Math.abs(h.x + h.width / 2 - (nationality.x + nationality.width))).toBeLessThanOrEqual(10);
  await page.mouse.move(h.x + 4, h.y + 15);
  await page.mouse.down();
  for (const x of [h.x - 60, h.x - 120, nationality.x + 10]) await page.mouse.move(x, h.y + 15);
  await expect(page.locator('.fd-width-chip')).toHaveText('1 of 2 columns');
  await screen(page, 'advanced-06-width-handle', { viewport: true });
  await page.mouse.up();
  expect(await spanOf(page, 'f-nationality')).toBe(1);
});

test('in a group that allows gaps, the width handle snaps to twelfths of the row, saying its share, one undo', async ({ page }) => {
  await openAdvanced(page);
  await page.evaluate(() => (window as unknown as { fieldiaDesigner: { designer: { setSectionLook(id: string, look: unknown): boolean } } }).fieldiaDesigner.designer.setSectionLook('role', { rows: 'gaps' }));
  await part(page, 'f-contract').scrollIntoViewIfNeeded();
  await part(page, 'f-contract').click({ position: { x: 30, y: 10 } });
  const handle = page.locator('.fd-width-handle');
  await expect(handle).toBeVisible();
  const h = (await handle.boundingBox())!;
  const contract = (await part(page, 'f-contract').boundingBox())!;
  await page.mouse.move(h.x + 4, h.y + 15);
  await page.mouse.down();
  for (const x of [h.x - 60, h.x - 120, h.x - 180, contract.x + contract.width / 2 - 10]) await page.mouse.move(x, h.y + 15);
  await expect(page.locator('.fd-width-chip')).toHaveText('33% of the row');
  await screen(page, 'advanced-06-width-handle-twelfths', { viewport: true });
  await page.mouse.up();
  expect(await spanOf(page, 'f-contract')).toBe(4);
  await page.getByRole('button', { name: 'Undo' }).click();
  expect(await spanOf(page, 'f-contract')).toBe(2);
});

test('the gutter between two parts of a group’s row trades twelfths, by the pointer and the keys, one undo each', async ({ page }) => {
  await openAdvanced(page);
  await part(page, 'f-photo').click({ position: { x: 20, y: 10 } });
  const gutter = page.locator('.fd-gutter');
  await expect(gutter).toBeVisible();
  await expect(gutter).toHaveAttribute('aria-label', 'Width between “Photo” and “2 columns”');
  await expect(gutter).toHaveAttribute('aria-valuetext', '33% · 67%');
  const g = (await gutter.boundingBox())!;
  const photo = (await part(page, 'f-photo').boundingBox())!;
  const column = photo.width;
  await page.mouse.move(g.x + 6, g.y + 30);
  await page.mouse.down();
  for (let i = 1; i <= 4; i++) await page.mouse.move(g.x + 6 + (column * i) / 4, g.y + 30);
  await expect(page.locator('.fd-width-chip')).toHaveText('67% · 33%');
  await screen(page, 'advanced-07-gutter', { viewport: true });
  await page.mouse.up();
  // In twelfths now: the photo two thirds, the fields beside it in the third left, still two to a row.
  expect([await spanOf(page, 'f-photo'), await spanOf(page, 'who'), await spanOf(page, 'f-first-name')]).toEqual([8, 4, 2]);
  await page.getByRole('button', { name: 'Undo' }).click();
  expect([await spanOf(page, 'f-photo'), await spanOf(page, 'who'), await spanOf(page, 'f-first-name')]).toEqual([1, 2, 1]);
  await gutter.focus();
  await page.keyboard.press('ArrowRight');
  expect([await spanOf(page, 'f-photo'), await spanOf(page, 'who')]).toEqual([5, 7]);
  await expect(gutter).toBeFocused();
  await expect(gutter).toHaveAttribute('aria-valuetext', '42% · 58%');
  await page.keyboard.press('ArrowLeft');
  expect([await spanOf(page, 'f-photo'), await spanOf(page, 'who')]).toEqual([4, 8]);
  const { off } = await misalignedOnCanvas(page);
  expect(off).toEqual([]);
});

// ---- several picked -----------------------------------------------------------------

test('several picked: Shift adds, the bar puts them side by side, and Ungroup takes them out again', async ({ page }) => {
  await openAdvanced(page);
  await part(page, 'h-send').scrollIntoViewIfNeeded();
  await part(page, 'h-send').click();
  await part(page, 't-note').click({ modifiers: ['Shift'] });
  const bar = page.getByRole('toolbar', { name: 'What is picked' });
  await expect(bar).toBeVisible();
  await expect(bar.locator('.fd-multi-count')).toHaveText('2 picked');
  await screen(page, 'advanced-08-two-picked', { viewport: true });
  await bar.getByRole('button', { name: 'Side by side' }).click();
  const row = (await where(page, 'h-send'))!;
  expect([row.style, row.kids]).toEqual(['plain', ['h-send', 't-note']]);
  // The arrangement just made is picked: it can be ungrouped.
  await expect(bar.getByRole('button', { name: 'Ungroup' })).toBeVisible();
  await screen(page, 'advanced-09-side-by-side', { viewport: true });
  await bar.getByRole('button', { name: 'Ungroup' }).click();
  expect((await where(page, 'h-send'))?.parent).toBe('new-employee');
  await expect(bar.locator('.fd-multi-count')).toHaveText('2 picked');
});

// ---- the keyboard ---------------------------------------------------------------------

/** Pick a field by its box to type in, not by its words: the keys then go to the canvas, not to a box. */
async function pickByBox(page: Page, id: string) {
  await box(page, id);
  const b = (await part(page, id).locator('input, select, textarea').first().boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}

test('keyboard moves, each said aloud in the words of a drop', async ({ page }) => {
  await openAdvanced(page);
  await pickByBox(page, 'f-email');
  const said = page.locator('.fd-canvas-said');
  await expect(said).toHaveAttribute('aria-live', 'polite');
  await page.keyboard.press('Alt+ArrowUp');
  await expect(said).toHaveText('Work email: before “Last name”');
  expect((await where(page, 'f-email'))?.kids.slice(0, 3)).toEqual(['f-first-name', 'f-email', 'f-last-name']);
  await page.keyboard.press('Alt+ArrowRight');
  await expect(said).toHaveText('Work email: beside “Last name”');
  await page.keyboard.press('Alt+Shift+ArrowRight');
  await expect(said).toHaveText('Work email: 2 columns wide');
  await page.keyboard.press('Alt+Shift+ArrowRight');
  await expect(said).toHaveText("A field cannot be wider than its section's 2 columns");
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => (window as unknown as { fieldiaDesigner: { designer: { getState(): { picked: string[] } } } }).fieldiaDesigner.designer.getState().picked)).toEqual([]);
  // The keys, listed in the canvas's help.
  await page.getByRole('button', { name: 'Keys for moving parts' }).click();
  await expect(page.locator('.fd-canvas-keys')).toBeVisible();
  await screen(page, 'advanced-10-keys', { viewport: true });
  await expect(page.locator('.fd-canvas-keys dt').first()).toHaveText('Alt+↑ / Alt+↓');
});

test('right to left, Alt+← puts a part beside the one after it', async ({ page }) => {
  await openAdvanced(page);
  await page.evaluate(() => (document.documentElement.dir = 'rtl'));
  await pickByBox(page, 'f-email');
  await page.keyboard.press('Alt+ArrowLeft');
  await expect(page.locator('.fd-canvas-said')).toHaveText('Work email: beside “Mobile”');
  expect((await where(page, 'f-email'))?.kids).toEqual(['f-mobile', 'f-email']);
});

// ---- the layout gates, on the canvas --------------------------------------------------

async function gates(page: Page, what: string) {
  const { checked, off } = await misalignedOnCanvas(page);
  expect(checked, `${what}: parts looked at`).toBeGreaterThan(8);
  expect(off, `${what}: parts off their grid's columns`).toEqual([]);
  expect(await doubleLines(page, '.fd-canvas *'), `${what}: a box drawn in a box`).toEqual([]);
}

for (const width of [1280, 390]) {
  test(`at ${width}px, every part on the canvas sits on its grid's columns, with no box drawn in a box`, async ({ page }) => {
    await openAdvanced(page, width);
    await gates(page, `Advanced at ${width}px`);
    await expectNoSidewaysScroll(page);
    await screen(page, `advanced-11-gates-${width}`);
  });
}

test('after a run of drops, still every part on its columns, and no box in a box', async ({ page }) => {
  await openAdvanced(page);
  const first = await box(page, 'f-first-name');
  await dropAt(page, centre(await box(page, 'f-nationality')), { x: first.x + first.width - 12, y: first.y + first.height / 2 });
  const last = await box(page, 'f-last-name');
  await dropAt(page, centre(await box(page, 'f-mobile')), { x: last.x + last.width / 2, y: last.y + last.height * 0.72 });
  const email = await box(page, 'f-email');
  const birthday = await box(page, 'f-birthday');
  await dropAt(page, await tileAt(page, 'kind:paragraph'), { x: email.x + email.width / 2, y: (email.y + email.height + birthday.y) / 2 });
  await page.keyboard.press('Escape');
  const emergency = await box(page, 'emergency');
  await dropAt(page, await tileAt(page, 'kind:email'), { x: emergency.x + emergency.width - 4, y: emergency.y + emergency.height / 2 });
  await page.keyboard.press('Escape');
  await page.mouse.click(5, 5);
  await gates(page, 'after four drops');
  await screen(page, 'advanced-12-after-drops');
});

test('Simple and Advanced draw the page alike, and switching changes nothing in it', async ({ page }) => {
  await openAdvanced(page);
  const advanced = await boxes(page, '.fd-canvas-body');
  const built = await page.evaluate(() => JSON.stringify((window as unknown as { fieldiaDesigner: { designer: { getPage(): unknown } } }).fieldiaDesigner.designer.getPage()));
  await page.getByRole('group', { name: 'Editing mode' }).getByRole('button', { name: 'Simple' }).click();
  await expect(page.locator('.fd-screen-designer')).toHaveAttribute('data-mode', 'simple');
  expect(await boxes(page, '.fd-canvas-body')).toEqual(advanced);
  expect(await page.evaluate(() => JSON.stringify((window as unknown as { fieldiaDesigner: { designer: { getPage(): unknown } } }).fieldiaDesigner.designer.getPage()))).toBe(built);
  // Advanced's marks are gone: no help, no handle.
  await expect(page.getByRole('button', { name: 'Keys for moving parts' })).toBeHidden();
  await page.reload();
  // The mode is the person's, kept in this browser.
  await expect(page.locator('.fd-screen-designer')).toHaveAttribute('data-mode', 'simple');
});
