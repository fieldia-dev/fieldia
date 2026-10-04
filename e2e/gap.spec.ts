import { expect, test, type Locator, type Page } from '@playwright/test';
import { doubleLines, inAdvanced, watch } from './designer-support';
import { expectNoSidewaysScroll, screen } from './support';

/**
 * What closes the gap with other form builders, used as a person uses it: a
 * rule across fields added with the fields suggested, read in words, and
 * tried — refused with its message, then only warning and still sent; a look
 * preset picked and taken back with Undo; a group made to fold, folding in
 * Try it; three fields made required at once; a row dragged in the outline
 * showing its line on the canvas, and a part dragged on the canvas showing
 * its line in the outline; the Rules view's own icon. Right to left, and at
 * a phone's width.
 */

const LAYOUT = '/screen/?start=layout';
const panel = (page: Page) => page.locator('.fd-properties');
const part = (page: Page, id: string) => page.locator(`.fd-canvas-body [data-node="${id}"]`);
const row = (page: Page, id: string): Locator => page.locator(`.fd-outline [role="treeitem"][data-pick="${id}"]`);

/** A screenshot to look at, with no line drawn twice in what is looked at. */
async function shot(page: Page, name: string, options: { viewport?: boolean; scope?: string } = {}) {
  await page.waitForTimeout(150);
  await screen(page, `gap-${name}`, { viewport: options.viewport ?? true });
  expect(await doubleLines(page, options.scope), name).toEqual([]);
}

/** What the page being built says of a field: whether it is required, on the field or on its place. */
function requiredOf(page: Page, ids: string[]): Promise<boolean[]> {
  return page.evaluate((ids) => {
    type Node = { id: string; field?: string; required?: unknown; children?: Node[] };
    const built = window.fieldiaDesigner.designer.getPage() as unknown as { layout: Node; fields: Record<string, { required?: boolean }> };
    const all: Node[] = [];
    const walk = (node: Node) => (node.children ?? []).forEach((child) => (all.push(child), walk(child)));
    walk(built.layout);
    return ids.map((id) => {
      const node = all.find((n) => n.id === id) as Node;
      return built.fields[node.field as string]?.required === true || node.required === true;
    });
  }, ids);
}

async function openLayout(page: Page, options: { advanced?: boolean; width?: number } = {}) {
  await page.setViewportSize({ width: options.width ?? 1440, height: 900 });
  if (options.advanced) await inAdvanced(page);
  await page.goto(LAYOUT);
  await expect(part(page, 'personal')).toBeVisible();
}

/** Press on a part of the canvas by the room round its box, where a press picks it rather than typing in it. */
const byItsEdge = { x: 3, y: 3 };

test.describe('a rule across fields', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    // Answer rules are Advanced's: Simple keeps a question to when it shows and whether it is required.
    await inAdvanced(page);
  });

  test('added with the fields suggested, read in words, refused when tried, then only warning and sent', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/designer/');
    for (const label of ['Start date', 'Contract ends']) {
      await page.locator('.fd-toolbox [data-tool="kind:date"]').click();
      await page.keyboard.type(label);
    }
    const card = () => page.locator('.fd-q-selected');
    await card().getByRole('button', { name: 'More options' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Answer rules' }).click();
    await card().getByRole('button', { name: 'Add a rule' }).click();
    await page.getByRole('menuitem', { name: 'A rule across fields' }).click();
    const box = card().getByRole('combobox', { name: 'Must hold' });
    await expect(box).toBeFocused();
    await expect(card().locator('.fd-answer-rule-say')).toHaveText(['Must hold: …']);
    // Typed as a person writes it: the fields suggested by their labels, their names put in.
    await page.keyboard.type('con');
    const suggested = card().getByRole('listbox', { name: 'Fields' });
    await expect(suggested.getByRole('option')).toHaveText([/^Contract ends/]);
    await suggested.scrollIntoViewIfNeeded();
    await shot(page, '01-across-suggested');
    await page.keyboard.press('Enter');
    await page.keyboard.type(' >= sta');
    await expect(suggested.getByRole('option')).toHaveText([/^Start date/]);
    await page.keyboard.press('Enter');
    await expect(box).toHaveValue(/^q_\d+ >= q_\d+$/);
    // Read in words above the box, and tried on made-up days under it.
    await expect(card().locator('.fd-answer-rule-across .fd-formula-reads')).toHaveText('Reads: Contract ends ≥ Start date');
    await expect(card().locator('.fd-answer-rule-across .fd-formula-outcome')).toHaveText(/^With Contract ends \d{4}-\d\d-\d\d and Start date \d{4}-\d\d-\d\d: holds$/);
    await expect(card().locator('.fd-answer-rule-say')).toHaveText(['Must hold: Contract ends ≥ Start date']);
    await card().getByRole('textbox', { name: 'Message when it does not fit' }).fill('Contract ends must not be before Start date');
    await shot(page, '02-across-kept');

    // Tried: a contract that ends before it starts is refused, with the message.
    await page.getByRole('button', { name: 'Try it', exact: true }).click();
    const tried = page.locator('.fd-try');
    await tried.getByLabel('Start date').fill('2026-05-01');
    await tried.getByLabel('Contract ends').fill('2026-04-30');
    await tried.getByRole('button', { name: /^(Submit|Send)$/ }).click();
    await expect(tried.locator('.fd-error').filter({ hasText: 'Contract ends must not be before Start date' })).toBeVisible();
    await expect(tried.locator('.fd-done')).toBeHidden();
    await shot(page, '03-across-refused', { scope: '.fd-try-frame *' });

    // Only warning: said, and the answers are sent all the same.
    await page.getByRole('button', { name: 'Design', exact: true }).click();
    // The rule is open as it was left; opened again if not.
    const say = card().locator('.fd-answer-rule-say');
    if ((await say.getAttribute('aria-expanded')) !== 'true') await say.click();
    await card().getByRole('button', { name: 'Only warns' }).click();
    await expect(card().locator('.fd-answer-rule-say')).toHaveText(['Must hold: Contract ends ≥ Start date — only warns']);
    await page.getByRole('button', { name: 'Try it', exact: true }).click();
    await tried.getByLabel('Start date').fill('2026-05-01');
    await tried.getByLabel('Contract ends').fill('2026-04-30');
    // Out of the field — Tab only steps through a date's parts — and the warning shows.
    await tried.getByRole('heading', { name: 'Page 1' }).click();
    await expect(tried.locator('.fd-warning').filter({ hasText: 'Contract ends must not be before Start date' })).toBeVisible();
    await shot(page, '04-across-warns', { scope: '.fd-try-frame *' });
    await tried.getByRole('button', { name: /^(Submit|Send)$/ }).click();
    await expect(tried.locator('.fd-done')).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('in the New employee example, right to left', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/plain/?page=layout&skin=outlined&locale=ar&dir=rtl');
    const form = page.locator('.fd-form');
    await expect(form).toBeVisible();
    await form.locator('[role="tab"][data-node="tab-job"]').click();
    await form.getByLabel('محدد المدة').check();
    await form.getByLabel('تاريخ البدء').fill('2026-05-01');
    await form.getByLabel('نهاية العقد').fill('2026-04-30');
    await form.getByRole('button', { name: 'إرسال', exact: true }).click();
    await expect(form.locator('[data-node="f-end-date"] .fd-error')).toHaveText('يجب ألا تكون نهاية العقد قبل تاريخ البدء');
    expect(await form.evaluate((f) => getComputedStyle(f).direction)).toBe('rtl');
    await form.locator('[data-node="f-end-date"]').scrollIntoViewIfNeeded();
    await shot(page, '05-example-rtl', { scope: '.fd-form *' });
    expect(problems).toEqual([]);
  });
});

test('a look preset, picked, worn by the canvas, and taken back with Undo', async ({ page }) => {
  const problems = watch(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await inAdvanced(page);
  await page.goto('/screen/');
  await page.evaluate(() => window.fieldiaDesigner.designer.getState() && (window.fieldiaDesigner.designer as unknown as { select(id: null): void }).select(null));
  await panel(page).getByRole('tab', { name: 'Look', exact: true }).click();
  const presets = panel(page).getByRole('group', { name: 'Look presets' });
  await expect(presets.locator('.fd-look-own')).toHaveText('As the skin');
  await shot(page, '06-presets');
  const canvas = page.locator('.fd-canvas.fd-form');
  await presets.getByRole('button', { name: 'Calm' }).click();
  await expect(presets.getByRole('button', { name: 'Calm' })).toHaveAttribute('aria-pressed', 'true');
  await expect(presets.locator('.fd-look-own')).toBeHidden();
  await expect(canvas).toHaveAttribute('data-font', 'serif');
  await expect(canvas).toHaveAttribute('data-density', 'roomy');
  await shot(page, '07-preset-calm');
  await presets.getByRole('button', { name: 'Night' }).click();
  await expect(canvas).toHaveAttribute('data-scheme', 'dark');
  await shot(page, '08-preset-night');
  // A setting changed by hand: the look is your own.
  await panel(page).getByRole('group', { name: 'Corners' }).getByRole('button', { name: 'Round' }).click();
  await expect(presets.locator('.fd-look-own')).toHaveText('Your own');
  await expect(presets.locator('[aria-pressed="true"]')).toHaveCount(0);
  // Undo, a step at a time: Night again, then Calm — each pick was one step.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(presets.getByRole('button', { name: 'Night' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(presets.getByRole('button', { name: 'Calm' })).toHaveAttribute('aria-pressed', 'true');
  await expect(canvas).not.toHaveAttribute('data-scheme', 'dark');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(presets.locator('.fd-look-own')).toHaveText('As the skin');
  await expect(canvas).not.toHaveAttribute('data-font', 'serif');
  expect(problems).toEqual([]);
});

test('a group made to fold in Simple, marked on the canvas, folding in Try it', async ({ page }) => {
  const problems = watch(page);
  // A fresh browser: Simple.
  await openLayout(page);
  await expect(page.locator('.fd-screen-designer')).toHaveAttribute('data-mode', 'simple');
  await part(page, 'address').locator('.fd-canvas-section-title').click();
  const folds = panel(page).getByRole('group', { name: 'Folds' });
  await expect(folds.getByRole('button')).toHaveText(['No', 'Starts open', 'Starts folded']);
  await folds.getByRole('button', { name: 'Starts folded' }).click();
  const mark = part(page, 'address').locator('.fd-canvas-fold');
  await expect(mark).toBeVisible();
  await expect(mark).toHaveAttribute('aria-label', 'Folds, starting folded');
  await shot(page, '09-fold-set');
  await page.getByRole('button', { name: 'Try it', exact: true }).click();
  const tried = page.locator('.fd-try');
  const address = tried.locator('[data-node="address"]');
  await expect(address).toHaveClass(/fd-section-folded/);
  await expect(tried.getByLabel('Street')).toBeHidden();
  await shot(page, '10-fold-tried-folded', { scope: '.fd-try-frame *' });
  await address.getByRole('button', { name: 'Home address' }).click();
  await expect(tried.getByLabel('Street')).toBeVisible();
  await shot(page, '11-fold-tried-open', { scope: '.fd-try-frame *' });
  expect(problems).toEqual([]);
});

test('three fields picked, made required at once, and Undo', async ({ page }) => {
  const problems = watch(page);
  await openLayout(page, { advanced: true });
  const ids = ['f-mobile', 'f-birthday', 'f-nationality'];
  await part(page, ids[0]).click({ position: byItsEdge });
  for (const id of ids.slice(1)) await part(page, id).click({ position: byItsEdge, modifiers: ['Shift'] });
  await expect(panel(page).locator('.fd-insp-name')).toHaveText('3 parts picked');
  await panel(page).getByRole('tab', { name: 'Rules', exact: true }).click();
  const required = panel(page).getByRole('group', { name: 'Required' });
  await expect(required.getByRole('button')).toHaveText(['Yes', 'No', 'As they are']);
  const before = await requiredOf(page, ids);
  await required.getByRole('button', { name: 'Yes' }).click();
  expect(await requiredOf(page, ids)).toEqual([true, true, true]);
  await expect(required.getByRole('button', { name: 'Yes' })).toHaveAttribute('aria-pressed', 'true');
  await shot(page, '12-several-required');
  await page.getByRole('button', { name: 'Undo' }).click();
  expect(await requiredOf(page, ids)).toEqual(before);
  expect(problems).toEqual([]);
});

test.describe('one drop line, in the outline and on the canvas', () => {
  async function openOutline(page: Page, width = 1440) {
    await openLayout(page, { advanced: true, width });
    await page.locator('.fd-rail [data-rail="outline"]').click();
    await expect(page.getByRole('tree', { name: 'The page’s parts' })).toBeVisible();
  }

  /** Press on one row and move at hand speed to a point a fraction down another, not letting go. */
  async function holdRowOver(page: Page, from: string, to: string, fraction: number) {
    const a = (await row(page, from).boundingBox())!;
    const start = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    let at = start;
    for (let look = 0; look < 4; look++) {
      const b = (await row(page, to).boundingBox())!;
      const end = { x: start.x, y: b.y + b.height * fraction };
      const steps = Math.max(1, Math.ceil(Math.hypot(end.x - at.x, end.y - at.y) / 60));
      for (let i = 1; i <= steps; i++) await page.mouse.move(at.x + ((end.x - at.x) * i) / steps, at.y + ((end.y - at.y) * i) / steps);
      at = end;
      const again = (await row(page, to).boundingBox())!;
      if (Math.abs(again.y + again.height * fraction - end.y) < 3) break;
    }
  }

  test('a row dragged in the outline shows on the canvas where it lands, the same line and chip', async ({ page }) => {
    const problems = watch(page);
    await openOutline(page);
    await holdRowOver(page, 'f-city', 'f-ec-relation', 0.25);
    const bar = page.locator('.fd-canvas > .fd-drop-bar.fd-drop-echo');
    await expect(bar).toBeVisible();
    // Across the top of Relation, just off it, as a canvas drag draws it.
    const [line, relation] = [(await bar.boundingBox())!, (await part(page, 'f-ec-relation').boundingBox())!];
    expect(Math.abs(line.y + line.height / 2 - (relation.y + 6 - 5))).toBeLessThan(8);
    expect(line.height).toBe(4);
    const words = await page.locator('.fd-outline-chip-where').textContent();
    await expect(page.locator('.fd-canvas > .fd-drop-chip.fd-drop-echo .fd-drop-where')).toHaveText(words ?? '');
    await shot(page, '13-echo-on-canvas');
    await page.mouse.up();
    await expect(bar).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test('a part dragged on the canvas shows in the outline where it lands', async ({ page }) => {
    const problems = watch(page);
    await openOutline(page);
    const from = (await part(page, 'f-postcode').boundingBox())!;
    const to = (await part(page, 'f-ec-relation').boundingBox())!;
    await page.mouse.move(from.x + 4, from.y + 4);
    await page.mouse.down();
    const target = { x: to.x + to.width / 2, y: to.y + 10 };
    const steps = Math.max(2, Math.ceil(Math.hypot(target.x - from.x, target.y - from.y) / 60));
    for (let i = 1; i <= steps; i++) await page.mouse.move(from.x + 4 + ((target.x - from.x - 4) * i) / steps, from.y + 4 + ((target.y - from.y - 4) * i) / steps);
    const line = page.locator('.fd-outline .fd-outline-line.fd-drop-echo');
    await expect(line).toBeVisible();
    // At the row of the part it lands by: Relation, or the gap after Name above it.
    const [drawn, relation] = [(await line.boundingBox())!, (await row(page, 'f-ec-relation').boundingBox())!];
    expect(Math.abs(drawn.y - relation.y)).toBeLessThan(4);
    await shot(page, '14-echo-in-outline');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(line).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test('right to left, the canvas’s line is on the part’s right', async ({ page }) => {
    await openOutline(page);
    await page.evaluate(() => (document.documentElement.dir = 'rtl'));
    await holdRowOver(page, 'f-photo', 'f-last-name', 0.25);
    const bar = page.locator('.fd-canvas > .fd-drop-bar.fd-drop-echo');
    await expect(bar).toBeVisible();
    const [line, last] = [(await bar.boundingBox())!, (await part(page, 'f-last-name').boundingBox())!];
    // Before Last name, in a group of columns: down its leading side — its right, right to left.
    expect(line.height).toBeGreaterThan(line.width);
    expect(line.x).toBeGreaterThan(last.x + last.width / 2);
    await shot(page, '15-echo-rtl');
    await page.mouse.up();
  });
});

test('the Rules view’s own icon, in the bar and in Find anything', async ({ page }) => {
  const problems = watch(page);
  await openLayout(page);
  const toggle = page.locator('.fd-designer-bar .fd-mode-button[data-mode="rules"]');
  const drawn = await toggle.locator('svg').innerHTML();
  expect(drawn).toContain('circle');
  expect(drawn).not.toContain('M3 3l18 18');
  await page.keyboard.press('ControlOrMeta+k');
  const find = page.getByRole('dialog', { name: 'Find anything' });
  await page.keyboard.type('rules');
  const option = find.getByRole('option').filter({ has: page.locator('.fd-find-label', { hasText: /^Rules$/ }) });
  await expect(option.locator('svg')).toHaveCount(1);
  expect(await option.locator('svg').innerHTML()).toBe(drawn);
  await shot(page, '16-rules-icon-find', { scope: '.fd-find *' });
  // Found beside others with no icon of their own: the words still line up.
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('rule');
  await expect(find.getByRole('option')).not.toHaveCount(1);
  const starts = await find.locator('.fd-find-label').evaluateAll((labels) => [...new Set(labels.map((l) => Math.round(l.getBoundingClientRect().left)))]);
  expect(starts).toHaveLength(1);
  await shot(page, '16b-rules-icon-find-several', { scope: '.fd-find *' });
  await page.keyboard.press('Escape');
  await toggle.click();
  await expect(page.getByRole('region', { name: 'Rules', exact: true })).toBeVisible();
  await shot(page, '17-rules-icon-bar');
  expect(problems).toEqual([]);
});

test('at a phone’s width: the presets, the rule across fields and the folds fit', async ({ page }) => {
  const problems = watch(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await inAdvanced(page);
  await page.goto(LAYOUT);
  await expect(part(page, 'personal')).toBeVisible();
  await part(page, 'f-end-date').scrollIntoViewIfNeeded().catch(() => undefined);
  await page.evaluate(() => (window.fieldiaDesigner.designer as unknown as { select(id: string): void }).select('f-end-date'));
  const rules = panel(page).getByRole('tab', { name: 'Rules', exact: true });
  await rules.scrollIntoViewIfNeeded();
  await rules.click();
  await panel(page).locator('.fd-answer-rule-say').first().click();
  await expect(panel(page).getByRole('combobox', { name: 'Must hold' })).toHaveValue('end_date >= start_date');
  await expect(panel(page).locator('.fd-answer-rule-across .fd-formula-reads')).toHaveText('Reads: Contract ends ≥ Start date');
  await panel(page).locator('[data-setting="Answer rules"]').scrollIntoViewIfNeeded();
  await shot(page, '18-phone-across');
  await expectNoSidewaysScroll(page);
  await page.evaluate(() => (window.fieldiaDesigner.designer as unknown as { select(id: null): void }).select(null));
  await panel(page).getByRole('tab', { name: 'Look', exact: true }).click();
  await panel(page).getByRole('group', { name: 'Look presets' }).scrollIntoViewIfNeeded();
  await shot(page, '19-phone-presets');
  await expectNoSidewaysScroll(page);
  await page.evaluate(() => (window.fieldiaDesigner.designer as unknown as { select(id: string): void }).select('bank'));
  await panel(page).getByRole('tab', { name: 'Content', exact: true }).click();
  await panel(page).getByRole('group', { name: 'Folds' }).scrollIntoViewIfNeeded();
  await shot(page, '20-phone-folds');
  await expectNoSidewaysScroll(page);
  expect(problems).toEqual([]);
});
