import { expect, test, type Locator, type Page } from '@playwright/test';
import { doubleLines, inAdvanced, watch } from './designer-support';
import { expectNoSidewaysScroll, screen } from './support';

/**
 * A look of one's own, saved by name as SurveyJS and Vueform save named
 * themes, used as a person uses it: a look made by hand on the screen
 * designer's Look tab, named by typing in a box on the page, offered again
 * after a reload and on the survey designer's Look sheet, put on as a preset
 * is and taken back with Undo; renamed and removed from its menu by the
 * keyboard, a removal with Undo at hand. Right to left in Arabic, at a
 * phone's width, and a dark look.
 */

const KEY = 'fieldia.designer.looks';
const panel = (page: Page) => page.locator('.fd-properties');
const presets = (scope: Locator) => scope.getByRole('group', { name: 'Look presets' });
const yours = (scope: Locator) => scope.getByRole('group', { name: 'Your looks' });
const saved = (scope: Locator, name: string) => yours(scope).getByRole('button', { name, exact: true });

/** A screenshot to look at, with no line drawn twice in what is looked at. */
async function shot(page: Page, name: string, options: { viewport?: boolean; scope?: string } = {}) {
  await page.waitForTimeout(150);
  await screen(page, `looks-${name}`, { viewport: options.viewport ?? true });
  expect(await doubleLines(page, options.scope), name).toEqual([]);
}

/** The screen designer in Advanced, nothing picked, on its Look tab. */
async function lookTab(page: Page, options: { width?: number; url?: string } = {}) {
  await page.setViewportSize({ width: options.width ?? 1440, height: 900 });
  await inAdvanced(page);
  await page.goto(options.url ?? '/screen/');
  await openLook(page);
}
async function openLook(page: Page) {
  await expect(page.locator('.fd-canvas:not(.fd-list-canvas)')).toBeVisible();
  await page.evaluate(() => (window.fieldiaDesigner.designer as unknown as { select(id: null): void }).select(null));
  const tab = panel(page).getByRole('tab', { name: 'Look', exact: true });
  await tab.scrollIntoViewIfNeeded();
  await tab.click();
}

/** A look of one's own, by hand: an accent and a font none of the presets has. */
async function makeOwnLook(scope: Locator, accent = 'Orange', font = 'Serif') {
  await scope.getByRole('group', { name: 'Accent colour' }).getByRole('button', { name: accent, exact: true }).click();
  await scope.getByRole('group', { name: 'Font' }).getByRole('button', { name: font, exact: true }).click();
  await expect(presets(scope).locator('.fd-look-own')).toHaveText('Your own');
}

/** Save the look by typing its name and pressing Enter, as a person does. */
async function saveAs(page: Page, scope: Locator, name: string) {
  await scope.getByRole('button', { name: 'Save this look…' }).click();
  const box = scope.getByRole('textbox', { name: 'Name this look' });
  await expect(box).toBeFocused();
  await page.keyboard.type(name);
  await page.keyboard.press('Enter');
}

/** Seed the looks this browser keeps, before the page loads. */
async function keepInBrowser(page: Page, looks: unknown[]) {
  await page.addInitScript(
    ([key, value]) => {
      if (!sessionStorage.getItem('seeded')) localStorage.setItem(key, value);
      sessionStorage.setItem('seeded', '1');
    },
    [KEY, JSON.stringify(looks)] as const
  );
}

const brand = { id: 'brand', name: 'Brand', look: { accent: '#c4320a', font: 'serif', density: 'compact' } };

test('a look saved by typing its name, kept after a reload, and put on the survey designer too', async ({ page }) => {
  const problems = watch(page);
  page.on('dialog', (dialog) => problems.push(`a ${dialog.type()} was opened`));
  await lookTab(page);
  const look = panel(page);
  // A preset, or the skin's: nothing of one's own to save yet.
  await expect(look.getByRole('button', { name: 'Save this look…' })).toBeHidden();
  await makeOwnLook(look);
  await shot(page, '01-own-look');
  await look.getByRole('button', { name: 'Save this look…' }).click();
  await shot(page, '02-name-box');
  // Refused in words where it is typed: a name taken by a preset, then too long.
  await page.keyboard.type('calm');
  await page.keyboard.press('Enter');
  const refusal = look.locator('.fd-look-name-problem');
  await expect(refusal).toHaveText('There is a look named “Calm” already');
  await expect(look.getByRole('textbox', { name: 'Name this look' })).toHaveAttribute('aria-invalid', 'true');
  await shot(page, '03-refused');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('  Brand ');
  await expect(refusal).toBeHidden();
  await page.keyboard.press('Enter');
  const tile = saved(look, 'Brand');
  await expect(tile).toHaveAttribute('aria-pressed', 'true');
  await expect(tile).toBeFocused();
  await expect(presets(look).locator('[aria-pressed="true"]')).toHaveCount(0);
  await expect(look.getByRole('button', { name: 'Save this look…' })).toBeHidden();
  await yours(look).scrollIntoViewIfNeeded();
  await shot(page, '04-saved');
  const kept = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]'), KEY);
  expect(kept).toEqual([{ id: expect.any(String), name: 'Brand', look: { accent: '#c4320a', font: 'serif' } }]);

  // Tomorrow: the page opened afresh, the look as the demo has it, Brand still offered.
  await page.reload();
  await openLook(page);
  await expect(saved(look, 'Brand')).toHaveAttribute('aria-pressed', 'false');
  const canvas = page.locator('.fd-canvas.fd-form');
  await presets(look).getByRole('button', { name: 'Compact' }).click();
  await saved(look, 'Brand').click();
  await expect(saved(look, 'Brand')).toHaveAttribute('aria-pressed', 'true');
  await expect(canvas).toHaveAttribute('data-font', 'serif');
  await expect.poll(() => canvas.evaluate((c) => getComputedStyle(c).getPropertyValue('--fd-accent').trim())).toBe('#c4320a');
  // Put on as a preset is: what Brand leaves unset is the skin's again, and it is one step back to Compact.
  await expect(canvas).not.toHaveAttribute('data-density', 'compact');
  await shot(page, '05-reloaded-worn');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(presets(look).getByRole('button', { name: 'Compact' })).toHaveAttribute('aria-pressed', 'true');
  await expect(canvas).toHaveAttribute('data-density', 'compact');

  // The survey designer, on the same site: the same looks.
  await page.goto('/designer/?start=survey');
  await page.locator('.fd-designer-bar').getByRole('button', { name: 'Look', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Look' });
  await saved(sheet, 'Brand').click();
  const cards = page.locator('.fd-survey-canvas');
  await expect(cards).toHaveAttribute('data-font', 'serif');
  await expect(saved(sheet, 'Brand')).toHaveAttribute('aria-pressed', 'true');
  await sheet.locator('.fd-look-sheet-body').evaluate((body) => body.scrollTo(0, 0));
  await shot(page, '06-survey-sheet');
  expect(problems).toEqual([]);
});

test('renamed and removed from its menu by the keyboard, Undo bringing it back', async ({ page }) => {
  const problems = watch(page);
  page.on('dialog', (dialog) => problems.push(`a ${dialog.type()} was opened`));
  await keepInBrowser(page, [brand, { id: 'ink', name: 'Ink', look: { accent: '#002855', scheme: 'dark' } }]);
  await lookTab(page);
  const look = panel(page);
  await expect(yours(look).locator('.fd-look-preset-name')).toHaveText(['Brand', 'Ink']);
  const more = look.getByRole('button', { name: 'Rename or remove “Brand”' });
  await more.focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('menu', { name: 'Brand' });
  await expect(menu.getByRole('menuitem')).toHaveText(['Rename…', 'Remove']);
  await expect(menu.getByRole('menuitem', { name: 'Rename…' })).toBeFocused();
  // The menu's own keyboard ring sits inside its box, as in every menu of the designer: looked at, not counted.
  await shot(page, '07-menu', { scope: '.fd-properties *, .fd-canvas *' });
  await page.keyboard.press('Enter');
  const box = look.getByRole('textbox', { name: 'New name for “Brand”' });
  await expect(box).toBeFocused();
  await expect(box).toHaveValue('Brand');
  await page.keyboard.type('Brand 2026');
  await shot(page, '08-rename-box');
  await page.keyboard.press('Enter');
  await expect(yours(look).locator('.fd-look-preset-name')).toHaveText(['Brand 2026', 'Ink']);
  await expect(saved(look, 'Brand 2026')).toBeFocused();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]').map((l: { id: string; name: string }) => `${l.id}:${l.name}`), KEY)).toEqual(['brand:Brand 2026', 'ink:Ink']);

  // Removed with no question asked; Undo at hand, and the cursor on it.
  await look.getByRole('button', { name: 'Rename or remove “Brand 2026”' }).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  const status = look.locator('.fd-look-status');
  await expect(status).toContainText('Removed “Brand 2026”.');
  await expect(status.getByRole('button', { name: 'Undo' })).toBeFocused();
  await expect(yours(look).locator('.fd-look-preset-name')).toHaveText(['Ink']);
  await shot(page, '09-removed');
  await page.keyboard.press('Enter');
  await expect(yours(look).locator('.fd-look-preset-name')).toHaveText(['Brand 2026', 'Ink']);
  await expect(saved(look, 'Brand 2026')).toBeFocused();
  await expect(status).toBeHidden();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]').length, KEY)).toBe(2);
  await shot(page, '10-undone');
  expect(problems).toEqual([]);
});

test('right to left, in Arabic: a look named in Arabic, its menu on the tile’s left', async ({ page }) => {
  const problems = watch(page);
  await lookTab(page);
  await page.evaluate(() => {
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'ar';
  });
  const look = panel(page);
  await makeOwnLook(look, 'Teal', 'Rounded');
  await saveAs(page, look, 'هوية الشركة');
  const tile = saved(look, 'هوية الشركة');
  await expect(tile).toHaveAttribute('aria-pressed', 'true');
  const more = look.getByRole('button', { name: 'Rename or remove “هوية الشركة”' });
  const [t, m] = [(await tile.boundingBox())!, (await more.boundingBox())!];
  // At the tile's inline end: its left, right to left.
  expect(m.x - t.x).toBeLessThan(8);
  expect(m.x + m.width).toBeLessThan(t.x + t.width / 2);
  await yours(look).scrollIntoViewIfNeeded();
  await shot(page, '11-rtl');
  await more.click();
  await page.getByRole('menuitem', { name: 'Remove' }).click();
  await expect(look.locator('.fd-look-status')).toContainText('Removed “هوية الشركة”.');
  await shot(page, '12-rtl-removed');
  expect(problems).toEqual([]);
});

test('at a phone’s width: the looks, the box and Undo fit, every target 24px or more', async ({ page }) => {
  const problems = watch(page);
  await keepInBrowser(page, [brand, { id: 'long', name: 'A look with a rather long name for a tile', look: { accent: '#6941c6' } }]);
  await lookTab(page, { width: 390 });
  const look = panel(page);
  await makeOwnLook(look);
  await look.getByRole('button', { name: 'Save this look…' }).scrollIntoViewIfNeeded();
  await look.getByRole('button', { name: 'Save this look…' }).click();
  await page.keyboard.type('Field team');
  await look.locator('.fd-look-name').scrollIntoViewIfNeeded();
  await shot(page, '13-phone-box');
  await expectNoSidewaysScroll(page);
  await page.keyboard.press('Enter');
  await yours(look).scrollIntoViewIfNeeded();
  await shot(page, '14-phone-saved');
  await expectNoSidewaysScroll(page);
  const small = await look.locator('[data-setting="Look presets"]').evaluate((row) =>
    [...row.querySelectorAll<HTMLElement>('button, input')]
      .filter((b) => b.offsetParent !== null)
      .map((b) => ({ name: b.getAttribute('aria-label') ?? b.textContent?.trim(), ...b.getBoundingClientRect().toJSON() }))
      .filter((b) => b.width < 24 || b.height < 24)
      .map((b) => `${b.name} ${Math.round(b.width)}×${Math.round(b.height)}`)
  );
  expect(small).toEqual([]);
  await look.getByRole('button', { name: 'Rename or remove “Field team”' }).click();
  await page.getByRole('menuitem', { name: 'Remove' }).click();
  await look.locator('.fd-look-status').scrollIntoViewIfNeeded();
  await shot(page, '15-phone-removed');
  await expectNoSidewaysScroll(page);
  expect(problems).toEqual([]);
});

test('a dark look of one’s own: its tile on a dark surface, the canvas dark, in a dark system too', async ({ page }) => {
  const problems = watch(page);
  await lookTab(page);
  const look = panel(page);
  await presets(look).getByRole('button', { name: 'Night' }).click();
  await look.getByRole('group', { name: 'Accent colour' }).getByRole('button', { name: 'Teal', exact: true }).click();
  await saveAs(page, look, 'Night shift');
  const tile = saved(look, 'Night shift');
  await expect(tile).toHaveAttribute('aria-pressed', 'true');
  await expect(tile.locator('.fd-look-preset-sample')).toHaveCSS('background-color', 'rgb(31, 35, 41)');
  const canvas = page.locator('.fd-canvas.fd-form');
  await expect(canvas).toHaveAttribute('data-scheme', 'dark');
  await yours(look).scrollIntoViewIfNeeded();
  await shot(page, '16-dark-look');
  await page.emulateMedia({ colorScheme: 'dark' });
  await presets(look).getByRole('button', { name: 'Calm' }).click();
  await tile.click();
  await expect(canvas).toHaveAttribute('data-scheme', 'dark');
  await shot(page, '17-dark-system');
  expect(problems).toEqual([]);
});

test('a store that fails is said in words in the box, the name kept to try again', async ({ page }) => {
  const problems = watch(page);
  await lookTab(page);
  // The app's store, as if its server were away: it rejects.
  await page.evaluate(() => {
    const store = (window.fieldiaDesigner.designer as unknown as { looks(): { save(): Promise<void> } }).looks();
    const save = store.save;
    (window as unknown as { putBack: () => void }).putBack = () => (store.save = save);
    store.save = () => Promise.reject(new Error('The workspace server is away'));
  });
  const look = panel(page);
  await makeOwnLook(look);
  await saveAs(page, look, 'Brand');
  const said = look.locator('.fd-look-name-problem');
  await expect(said).toHaveText('Could not save “Brand”: The workspace server is away');
  await expect(said).toHaveAttribute('role', 'alert');
  await expect(look.getByRole('textbox', { name: 'Name this look' })).toHaveValue('Brand');
  await expect(yours(look)).toHaveCount(0);
  await look.locator('.fd-look-name').scrollIntoViewIfNeeded();
  await shot(page, '18-store-failed');
  // Back again: Enter once more keeps it.
  await page.evaluate(() => (window as unknown as { putBack: () => void }).putBack());
  await page.keyboard.press('Enter');
  await expect(saved(look, 'Brand')).toHaveAttribute('aria-pressed', 'true');
  expect(problems).toEqual([]);
});

test('a browser that keeps nothing keeps the look for the visit', async ({ page }) => {
  const problems = watch(page);
  // Full, for the looks: it takes nothing more under their key.
  await page.addInitScript((key) => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name: string, value: string) {
      if (name === key) throw new Error('QuotaExceededError');
      set.call(this, name, value);
    };
  }, KEY);
  await lookTab(page);
  const look = panel(page);
  await makeOwnLook(look);
  await saveAs(page, look, 'Brand');
  await expect(saved(look, 'Brand')).toHaveAttribute('aria-pressed', 'true');
  await expect(look.locator('.fd-look-name-problem')).toBeHidden();
  expect(problems).toEqual([]);
});
