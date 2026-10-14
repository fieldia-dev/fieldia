import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings, settle } from './a11y-support';
import { inAdvanced } from './designer-support';
import { expectNoSidewaysScroll, node, open, screen } from './support';

/**
 * The quiet look, used as a person uses it, on the work item (a bug, as Azure
 * DevOps draws one): at rest each value reads as words, no box and no
 * arrow; pointed at, a light box and its sign, nothing moving; clicked or
 * tabbed into, its editor ringed in the focus colour — a choice's options, a
 * state's dots with the one picked ticked, a date's calendar. Escape puts back
 * what the field held, leaving keeps the change, Save saves it. A field the
 * workflow locks shows a lock that says why. A finger goes straight to the
 * editor. Right to left, dark, in the themes, with labels above, beside and
 * in the box, at a phone's width — and axe finds nothing.
 */

const QUIET = '/plain/?page=work-item&skin=quiet';
const MIXED = '/plain/?page=work-item-mixed&skin=outlined';

/** What the browser draws for each property named. */
const drawn = (element: Locator, ...names: string[]) =>
  element.evaluate((el, names) => Object.fromEntries(names.map((name) => [name, getComputedStyle(el).getPropertyValue(name)])), names);
/** Where an element is on the page, however far it is scrolled. */
const at = (element: Locator) => element.evaluate((el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x + scrollX), y: Math.round(r.y + scrollY), width: Math.round(r.width), height: Math.round(r.height) }; });
/** The ring a box being worked in has, once its transition is over: two pixels of the focus colour, its edge and a shadow of one. */
const ringed = (box: Locator) => expect.poll(async () => (await drawn(box, 'box-shadow'))['box-shadow']).toMatch(/ 0px 0px 0px 1px$/);
const transparent = (colour: string) => colour === 'rgba(0, 0, 0, 0)' || colour === 'transparent';

async function visit(page: Page, url: string) {
  const { problems } = await open(page, 'plain', url.replace('/plain/?', ''));
  await expect(node(page, 'f-title').locator('input')).toHaveValue('Stock count wrong after a partial release');
  await settle(page);
  return problems;
}

test.describe('at rest, pointed at, worked in', () => {
  test('a value reads as words at rest: no box, no arrow, its label quieter than it', async ({ page }) => {
    const problems = await visit(page, QUIET);
    const area = node(page, 'f-area').locator('select');
    const box = await drawn(area, 'border-top-color', 'background-color', 'appearance', 'background-image');
    expect(transparent(box['border-top-color'])).toBe(true);
    expect(transparent(box['background-color'])).toBe(true);
    expect([box['appearance'], box['background-image']]).toEqual(['none', 'none']);
    const [label, value] = await Promise.all([drawn(node(page, 'f-area').locator('.fd-label'), 'color'), drawn(area, 'color')]);
    expect(label['color']).not.toBe(value['color']);
    // A state keeps its coloured dot, and its words.
    await expect(node(page, 'f-state').locator('.fd-dot-label')).toHaveText('Resolved');
    await expect(node(page, 'f-state').locator('.fd-dot-button')).toHaveAttribute('data-tone', 'warning');
    await screen(page, 'quiet-rest', { viewport: true });
    expect(problems).toEqual([]);
  });

  test('pointed at, a light box and the control’s sign show, and nothing moves', async ({ page }) => {
    await visit(page, QUIET);
    const area = node(page, 'f-area').locator('select');
    const before = { area: await at(area), next: await at(node(page, 'f-iteration').locator('select')), label: await at(node(page, 'f-area').locator('.fd-label')) };
    await area.hover();
    await expect.poll(async () => transparent((await drawn(area, 'border-top-color'))['border-top-color'])).toBe(false);
    expect((await drawn(area, 'background-image'))['background-image']).toContain('linear-gradient');
    expect({ area: await at(area), next: await at(node(page, 'f-iteration').locator('select')), label: await at(node(page, 'f-area').locator('.fd-label')) }).toEqual(before);
    // Nothing opens on hover.
    await expect(area).not.toBeFocused();
    // A date shows its calendar, a link its ×.
    const due = node(page, 'f-due').locator('input');
    await expect(node(page, 'f-due').locator('.fd-calendar-button')).toBeHidden();
    await due.hover();
    await expect(node(page, 'f-due').locator('.fd-calendar-button')).toBeVisible();
    const assigned = node(page, 'f-assigned');
    await expect(assigned.locator('.fd-combo-clear')).toBeHidden();
    await assigned.locator('input').hover();
    await expect(assigned.locator('.fd-combo-clear')).toBeVisible();
    await screen(page, 'quiet-pointed', { viewport: true });
  });

  test('clicked, a choice opens its options; a state its dots with the one picked ticked; a date its calendar', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { pickers: string[] }).pickers = [];
      HTMLInputElement.prototype.showPicker = function () {
        (window as unknown as { pickers: string[] }).pickers.push(this.closest('[data-node]')?.getAttribute('data-node') ?? '');
      };
    });
    await visit(page, QUIET);
    // The state: its words pressed open the menu, as its dot does.
    await node(page, 'f-state').locator('.fd-dot-box').click({ position: { x: 90, y: 12 } });
    const menu = page.getByRole('menu', { name: 'State' });
    await expect(menu).toBeVisible();
    const picked = menu.getByRole('menuitemradio', { name: 'Resolved' });
    await expect(picked).toHaveAttribute('aria-checked', 'true');
    expect(await picked.evaluate((el) => getComputedStyle(el, '::after').content)).toBe('"✓"');
    await expect(menu.locator('.fd-dot')).toHaveCount(4);
    // The box is ringed while its menu is open.
    await ringed(node(page, 'f-state').locator('.fd-dot-box'));
    await screen(page, 'quiet-state-open', { viewport: true });
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    // A date opens its calendar at the click — Fieldia's own, beside its own box; tabbed into, it is typed in.
    await node(page, 'f-due').locator('input').click();
    await expect(node(page, 'f-due').getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(node(page, 'f-due').getByRole('dialog')).toBeHidden();
    expect(await page.evaluate(() => (window as unknown as { pickers: string[] }).pickers)).toEqual([]);
    // A link: its list.
    await node(page, 'f-assigned').locator('input').click();
    await expect(node(page, 'f-assigned').getByRole('listbox')).toBeVisible();
    await expect(node(page, 'f-assigned').getByRole('option', { name: 'Karim Fathy' })).toBeVisible();
    await screen(page, 'quiet-link-open', { viewport: true });
  });

  test('tabbed into, each field is its editor with a ring two pixels wide; nothing is reached only by pointing', async ({ page }) => {
    await visit(page, QUIET);
    await node(page, 'f-title').locator('input').focus();
    const reached: string[] = [];
    for (let i = 0; i < 8; i++) {
      const where = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement;
        return `${active.closest('[data-node]')?.getAttribute('data-node')}:${active.tagName.toLowerCase()}${active.classList.contains('fd-lock') ? '.lock' : ''}`;
      });
      reached.push(where);
      await page.keyboard.press('Tab');
    }
    expect(reached).toEqual(['f-title:input', 'f-state:button', 'f-area:select', 'f-reason:button.lock', 'f-iteration:select', 'f-assigned:input', 'f-assigned:button', 'f-priority:select']);
    // The select tabbed into: its box, its chevron, a ring.
    await node(page, 'f-area').locator('select').focus();
    await ringed(node(page, 'f-area').locator('select'));
    const ring = await drawn(node(page, 'f-area').locator('select'), 'border-top-color', 'background-image');
    expect(transparent(ring['border-top-color'])).toBe(false);
    expect(ring['background-image']).toContain('linear-gradient');
    await screen(page, 'quiet-tabbed', { viewport: true });
  });
});

test.describe('Escape, leaving, and Save', () => {
  test('Escape puts back what the field held as it was entered; leaving keeps the change, and Save saves it', async ({ page }) => {
    await visit(page, QUIET);
    const found = node(page, 'f-found').locator('input');
    await found.click();
    await found.fill('Build 2026.10.5');
    await page.keyboard.press('Escape');
    await expect(found).toHaveValue('Build 2026.10.4');
    await expect(found).toBeFocused();
    // A choice too, picked from its list and put back.
    const severity = node(page, 'f-severity').locator('select');
    await severity.focus();
    await severity.selectOption({ label: '1 - Critical' });
    await page.keyboard.press('Escape');
    await expect(severity.locator('option:checked')).toHaveText('3 - Medium');
    // Left, the change stays, and saves.
    await found.click();
    await found.fill('Build 2026.10.5');
    await page.keyboard.press('Tab');
    await expect(found).toHaveValue('Build 2026.10.5');
    await page.keyboard.press('Control+Enter');
    await expect(page.locator('.fd-status')).toHaveText('Saved');
    const stored = await page.evaluate(() => (window as unknown as { fieldiaDemo: { dataSource: { records: Record<string, Record<number, Record<string, unknown>>> } } }).fieldiaDemo.dataSource.records['work.item'][1]['found_in']);
    expect(stored).toBe('Build 2026.10.5');
  });
});

test.describe('a date typed with its calendar open', () => {
  for (const [locale, url, why] of [
    ['en', QUIET, 'February 2026 has 28 days'],
    ['ar', `${QUIET}&locale=ar&dir=rtl`, 'فبراير 2026 28 يومًا'],
  ] as const) {
    test(`${locale}: Tab out of a date that does not read closes the calendar, and why is in sight, said by the month too`, async ({ page }) => {
      const problems = await visit(page, url);
      const due = node(page, 'f-due');
      const box = due.locator('input');
      const calendar = due.getByRole('dialog');
      const button = due.locator('.fd-calendar-button');
      // Clicked, the calendar opens; clicked again, the box is typed in, the month still open beside it.
      await box.click();
      await expect(calendar).toBeVisible();
      await box.click();
      await expect(box).toBeFocused();
      await expect(calendar).toBeVisible();
      await box.press('Control+A');
      await box.pressSequentially('31/02/2026');
      await page.keyboard.press('Tab');
      await expect(button).toBeFocused();
      await expect(calendar).toBeHidden();
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      const error = due.locator(':scope > .fd-error');
      await expect(error).toContainText(why);
      // Nothing is drawn over the words: their middle and their end are their own.
      const covered = await error.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return [r.left + r.width / 2, r.right - 6, r.left + 6].map((x) => {
          const top = document.elementFromPoint(x, r.top + r.height / 2);
          return top && !el.contains(top) ? (top as HTMLElement).className : null;
        });
      });
      expect(covered).toEqual([null, null, null]);
      await screen(page, `quiet-date-unread-${locale}`, { viewport: true });
      // Opened again over them, the month says them too.
      await button.click();
      await expect(calendar.locator('.fd-calendar-note')).toContainText(why);
      expect(problems).toEqual([]);
    });
  }
});

test.describe('a field the workflow locks', () => {
  test('shows a lock that says why, pointed at or focused, and opens with the workflow', async ({ page }) => {
    await visit(page, QUIET);
    const reason = node(page, 'f-reason');
    const lock = reason.locator('button.fd-lock');
    const why = reason.getByRole('tooltip');
    await expect(lock).toBeVisible();
    await expect(lock).toHaveAccessibleName('Locked: Reason');
    await expect(lock).toHaveAccessibleDescription('Set by the workflow when the bug is resolved');
    await expect(why).toBeHidden();
    await lock.hover();
    await expect(why).toBeVisible();
    await expect(why).toHaveText('Set by the workflow when the bug is resolved');
    await page.mouse.move(2, 2);
    await expect(why).toBeHidden();
    // Pointing at its value says it too; there is no box to point at.
    const value = reason.locator('select');
    await value.hover();
    await expect(why).toBeVisible();
    expect(transparent((await drawn(value, 'border-top-color'))['border-top-color'])).toBe(true);
    await screen(page, 'quiet-locked-why', { viewport: true });
    await page.mouse.move(2, 2);
    // Reached by the keyboard, the lock says it.
    await lock.focus();
    await expect(why).toBeVisible();
    // The bug active again, its reason can be changed.
    await node(page, 'f-state').locator('.fd-dot-button').click();
    await page.getByRole('menuitemradio', { name: 'Active' }).click();
    await expect(lock).toBeHidden();
    await expect(value).toBeEnabled();
  });

  test('a whole form read shows no locks, and Edit moves no word', async ({ page }) => {
    await visit(page, `${QUIET}&readonly=1&editSwitch=1`);
    await expect(page.locator('.fd-lock')).toHaveCount(0);
    const words = async () => Promise.all(['f-title', 'f-area', 'f-points', 'f-found'].map((id) => at(node(page, id).locator('input, select').first())));
    const before = await words();
    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
    expect(await words()).toEqual(before);
    // Editing, the workflow's lock is back.
    await expect(node(page, 'f-reason').locator('button.fd-lock')).toBeVisible();
  });
});

test.describe('where it is worn', () => {
  test('a page in boxes keeps its quiet header: the header’s fields read as words, the rest in boxes', async ({ page }) => {
    await visit(page, MIXED);
    await expect(page.locator('.fd-form')).toHaveAttribute('data-fd-skin', 'outlined');
    for (const id of ['f-title', 'f-state', 'f-area', 'f-reason', 'f-iteration', 'f-assigned']) await expect(node(page, id)).toHaveAttribute('data-quiet', '');
    for (const id of ['f-priority', 'f-severity', 'f-points', 'f-due', 'f-repro']) await expect(node(page, id)).not.toHaveAttribute('data-quiet');
    expect(transparent((await drawn(node(page, 'f-severity').locator('select'), 'border-top-color'))['border-top-color'])).toBe(false);
    await screen(page, 'quiet-header-only');
  });

  test('the work item demo wears the look the switch picks, its header too: boxes in Underline and Outlined, words in Quiet', async ({ page }) => {
    for (const skin of ['underline', 'outlined'] as const) {
      await visit(page, `/plain/?page=work-item&skin=${skin}`);
      await expect(page.locator('.fd-form')).toHaveAttribute('data-fd-skin', skin);
      for (const id of ['f-state', 'f-area', 'f-iteration', 'f-priority']) await expect(node(page, id)).not.toHaveAttribute('data-quiet');
    }
    await visit(page, '/plain/?page=work-item&skin=quiet');
    for (const id of ['f-state', 'f-area', 'f-iteration', 'f-priority']) await expect(node(page, id)).toHaveAttribute('data-quiet', '');
  });

  test('with no pointer, a tap goes straight to the editor', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await page.goto(QUIET);
    await expect(node(page, 'f-title').locator('input')).toHaveValue('Stock count wrong after a partial release');
    expect(await page.evaluate(() => matchMedia('(hover: hover)').matches)).toBe(false);
    await node(page, 'f-found').locator('input').tap();
    await expect(node(page, 'f-found').locator('input')).toBeFocused();
    await ringed(node(page, 'f-found').locator('input'));
    await node(page, 'f-state').locator('.fd-dot-button').tap();
    await expect(page.getByRole('menu', { name: 'State' })).toBeVisible();
    await screen(page, 'quiet-phone-tap', { viewport: true });
    await expectNoSidewaysScroll(page);
    await context.close();
  });

  for (const labels of ['above', 'beside', 'hidden']) {
    test(`labels ${labels}: pointing moves nothing`, async ({ page }) => {
      await visit(page, `${QUIET}&labels=${labels}`);
      const points = node(page, 'f-points').locator('input');
      const before = [await at(points), await at(node(page, 'f-activity').locator('select'))];
      await points.hover();
      await expect.poll(async () => transparent((await drawn(points, 'border-top-color'))['border-top-color'])).toBe(false);
      expect([await at(points), await at(node(page, 'f-activity').locator('select'))]).toEqual(before);
    });
  }

  for (const theme of ['material', 'fluent', 'odoo', 'google-forms']) {
    test(`in the ${theme} theme, quiet at rest and boxed when pointed at`, async ({ page }) => {
      await visit(page, `${QUIET}&theme=${theme}`);
      const found = node(page, 'f-found').locator('input');
      const rest = await drawn(found, 'border-top-color', 'border-bottom-color', 'background-color');
      expect([transparent(rest['border-top-color']), transparent(rest['border-bottom-color']), transparent(rest['background-color'])]).toEqual([true, true, true]);
      await found.hover();
      await expect.poll(async () => transparent((await drawn(found, 'border-top-color'))['border-top-color'])).toBe(false);
      await found.click();
      await ringed(found);
      await screen(page, `quiet-theme-${theme}`, { viewport: true });
    });
  }
});

test.describe('in the designer', () => {
  test('the Look tab’s Quiet skin: the canvas’s fields read as words, and Try it wears it', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await inAdvanced(page);
    await page.goto('/screen/');
    await expect(page.locator('.fd-canvas:not(.fd-list-canvas)')).toBeVisible();
    await page.evaluate(() => (window as unknown as { fieldiaDesigner: { designer: { select(id: null): void } } }).fieldiaDesigner.designer.select(null));
    const panel = page.locator('.fd-properties');
    await panel.getByRole('tab', { name: 'Look', exact: true }).click();
    await panel.getByRole('group', { name: 'Skin' }).getByRole('button', { name: 'Quiet', exact: true }).click();
    const canvas = page.locator('.fd-canvas:not(.fd-list-canvas)');
    await expect(canvas).toHaveAttribute('data-fd-skin', 'quiet');
    await expect(canvas.locator('.fd-canvas-field[data-quiet]').first()).toBeVisible();
    await screen(page, 'quiet-designer-canvas', { viewport: true });
    await page.getByRole('button', { name: 'Try it' }).click();
    await expect(page.locator('.fd-try .fd-form, .fd-try-frame .fd-form').first()).toHaveAttribute('data-fd-skin', 'quiet');
  });
});

test.describe('axe on the quiet look, as a person leaves it', () => {
  for (const look of ['', '&scheme=dark', '&locale=ar&dir=rtl', '&locale=ar&dir=rtl&scheme=dark']) {
    test(`pointed at, a menu open, a lock saying why${look}`, async ({ page }) => {
      await visit(page, `${QUIET}${look}`);
      await node(page, 'f-area').locator('select').hover();
      expect(await axeFindings(page, `quiet pointed ${look}`)).toEqual([]);
      await node(page, 'f-state').locator('.fd-dot-button').click();
      await expect(page.getByRole('menu')).toBeVisible();
      expect(await axeFindings(page, `quiet menu ${look}`)).toEqual([]);
      await page.keyboard.press('Escape');
      await node(page, 'f-reason').locator('button.fd-lock').focus();
      await expect(node(page, 'f-reason').getByRole('tooltip')).toBeVisible();
      expect(await axeFindings(page, `quiet lock ${look}`)).toEqual([]);
      await screen(page, `quiet-axe${look.replace(/\W+/g, '-')}`, { viewport: true });
    });
  }
});
