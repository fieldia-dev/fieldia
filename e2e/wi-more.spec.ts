import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings, settle } from './a11y-support';
import { expectNoSidewaysScroll, screen } from './support';

/**
 * A bug's tags, menus and texts (demos/shared/wi-more.ts), as an app moving to
 * Fieldia asked for them, in a page mounted (`mountViewer`) and in the inset
 * dialog (`openFormDialog`): tags inline in the head's row with 0, 2 and 8 of
 * them, the assignee and the comments' link on its first line and what adds a
 * tag after the last chip; the ⋮ menu's dividers and Templates › with the
 * app's templates, by pointer and by keys, its menu on the screen at the
 * window's edge; a Description read first, edited from its heading's Edit,
 * Done, a press outside, Escape, ⤢ while it is edited. And the backlog's own
 * bug with all three. In Chromium, Firefox and WebKit.
 */

type Where = 'page' | 'dialog';
const WHERE: Where[] = ['page', 'dialog'];
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

/** The form looked at: the page's own, or the dialog's over it. */
const scope = (page: Page, where: Where) => (where === 'dialog' ? page.getByRole('dialog') : page.locator('#app'));
const part = (root: Locator, id: string) => root.locator(`[data-node="${id}"]`).first();
/** Where an element is in the window, to the pixel, and its middle. */
const box = (element: Locator) =>
  element.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom), cy: Math.round(r.y + r.height / 2) };
  });

/** The bug, mounted or in the dialog over it: failing on any console error or uncaught exception; the demo's own handle. */
async function visit(page: Page, where: Where, record: number, more = '') {
  const problems: string[] = [];
  page.on('console', (message) => message.type() === 'error' && problems.push(`console: ${message.text()}`));
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  await page.goto(`/plain/?page=wi-more&record=${record}${where === 'dialog' ? '&open=dialog' : ''}${more}`);
  await expect(page.locator('#app .fd-form')).toBeVisible();
  const root = scope(page, where);
  await expect(root.locator('.fd-head-row')).toBeVisible();
  await expect(part(root, '#title').locator('textarea')).not.toHaveValue('');
  await settle(page);
  const demo = <T>(read: string) => page.evaluate((path) => path.split('.').reduce((value: any, key) => value?.[key], (window as any).fieldiaDemo), read) as Promise<T>;
  return { problems, root, demo };
}
const saveAndClose = (root: Locator) => part(root, 'b-save-close').getByRole('button', { name: 'Save and Close', exact: true });

test.describe('tags inline in the head’s row', () => {
  test.use({ viewport: DESKTOP });

  for (const where of WHERE) {
    test(`${where}: with 0, 2 and 8 tags the assignee and the comments' link keep the first line, the box typed in after the last chip`, async ({ page }) => {
      const heights: Record<number, number> = {};
      for (const [record, count] of [[2, 0], [1, 2], [3, 8]] as const) {
        const { problems, root } = await visit(page, where, record);
        const tags = part(root, 'h-tags');
        const chips = tags.locator('.fd-chip');
        await expect(chips).toHaveCount(count);
        const [assigned, comments, slot, row] = await Promise.all([box(part(root, 'h-assigned')), box(part(root, 'h-comments')), box(tags), box(root.locator('.fd-head-row'))]);
        // One line: the assignee, the comments' link and the tags' first line share its middle; the slot starts on it.
        expect(Math.abs(assigned.cy - comments.cy), `${count} tags: assignee and comments on one line`).toBeLessThanOrEqual(1);
        expect(Math.abs(slot.y - row.y), `${count} tags: the tags start on the row's first line`).toBeLessThanOrEqual(1);
        expect(assigned.y - row.y).toBeLessThanOrEqual(1);
        if (count) {
          const first = await box(chips.first());
          expect(Math.abs(first.cy - assigned.cy), `${count} tags: the first chip on the assignee's line`).toBeLessThanOrEqual(2);
          expect(first.x).toBeGreaterThan(comments.right);
        }
        // What adds a tag follows the last chip: on its line after it, or first on the next.
        const input = await box(tags.locator('input[role="combobox"]'));
        if (count) {
          const last = await box(chips.last());
          const sameLine = Math.abs(input.cy - last.cy) <= 4 && input.x >= last.right;
          const nextLine = input.y >= last.bottom - 1 && input.x <= slot.x + 16;
          expect(sameLine || nextLine, `${count} tags: the box after the last chip`).toBe(true);
        } else expect(input.x).toBeGreaterThan(comments.right);
        // Its words say what it adds, chips or none (the placeholder's own colour read where the engine gives it).
        await expect(tags.locator('input[role="combobox"]')).toHaveAttribute('placeholder', 'Add Tag');
        if (test.info().project.name === 'chromium') expect(await tags.locator('input[role="combobox"]').evaluate((el) => getComputedStyle(el, '::placeholder').color)).not.toBe('rgba(0, 0, 0, 0)');
        heights[count] = row.height;
        await screen(page, `wi-more-tags-${count}-${where}`, { viewport: true });
        expect(problems).toEqual([]);
      }
      // As tall with two tags as with none; eight take more lines of their own.
      expect(heights[2]).toBe(heights[0]);
      expect(heights[0]).toBe(32);
      expect(heights[8]).toBeGreaterThan(heights[2]);
    });

    test(`${where}: a tag added by typing, with its suggestions and Create, taken away by × and Backspace — the row as tall throughout`, async ({ page }) => {
      const { root } = await visit(page, where, 2);
      const tags = part(root, 'h-tags');
      const row = root.locator('.fd-head-row');
      expect((await box(row)).height).toBe(32);
      const input = tags.locator('input[role="combobox"]');
      await input.click();
      await page.keyboard.type('Stoc');
      await page.getByRole('option', { name: 'Stock' }).click();
      await expect(tags.locator('.fd-chip-label')).toHaveText(['Stock']);
      expect((await box(row)).height).toBe(32);
      await expect(input).toBeFocused();
      // A name no tag has: Create it.
      await page.keyboard.type('Cart');
      await page.getByRole('option', { name: 'Create “Cart”' }).click();
      await expect(tags.locator('.fd-chip-label')).toHaveText(['Stock', 'Cart']);
      expect((await box(row)).height).toBe(32);
      // The box typed in after the last chip, on its line.
      const [last, typed] = await Promise.all([box(tags.locator('.fd-chip').last()), box(input)]);
      expect(typed.x).toBeGreaterThan(last.right);
      await page.keyboard.type('Mobile');
      await page.getByRole('option', { name: 'Mobile' }).click();
      await tags.getByRole('button', { name: 'Remove Cart' }).click();
      await expect(tags.locator('.fd-chip-label')).toHaveText(['Stock', 'Mobile']);
      await input.focus();
      await page.keyboard.press('Backspace');
      await expect(tags.locator('.fd-chip-label')).toHaveText(['Stock']);
      expect((await box(row)).height).toBe(32);
      await expect(saveAndClose(root)).toHaveClass(/fd-button-primary/);
    });
  }

  test('on a phone and dark: the row’s parts each on their own line, the chips wrapping in theirs', async ({ page }) => {
    await page.setViewportSize(PHONE);
    const { root, problems } = await visit(page, 'dialog', 3, '&scheme=dark');
    const [assigned, slot] = await Promise.all([box(part(root, 'h-assigned')), box(part(root, 'h-tags'))]);
    expect(slot.y).toBeGreaterThan(assigned.y);
    expect(slot.right).toBeLessThanOrEqual(PHONE.width);
    await expectNoSidewaysScroll(page);
    await screen(page, 'wi-more-tags-8-phone-dark', { viewport: true });
    expect(await axeFindings(page, 'tags, phone, dark')).toEqual([]);
    expect(problems).toEqual([]);
  });

  test('the backlog’s bug: Pricing and Currency after its comments’ link, Add Tag after them, on one line', async ({ page }) => {
    await page.goto('/backlog/?workitem=4142');
    const dialog = page.getByRole('dialog');
    const tags = part(dialog, 'h-tags');
    await expect(tags.locator('.fd-chip-label')).toHaveText(['Pricing', 'Currency']);
    const [comments, last, add, row] = await Promise.all([box(part(dialog, 'h-comments')), box(tags.locator('.fd-chip').last()), box(tags.getByRole('button', { name: 'Add Tag' })), box(dialog.locator('.fd-head-row'))]);
    expect((await box(tags.locator('.fd-chip').first())).x).toBeGreaterThan(comments.right);
    expect(add.x).toBeGreaterThan(last.right);
    expect(Math.abs(add.cy - last.cy)).toBeLessThanOrEqual(2);
    expect(row.height).toBe(32);
    await screen(page, 'wi-more-backlog-tags', { viewport: true });
  });
});

test.describe('dividers and a menu inside the ⋮ menu', () => {
  test.use({ viewport: DESKTOP });
  const more = (root: Locator) => root.getByRole('button', { name: 'More actions' });

  for (const where of WHERE) {
    test(`${where}: reads as the tracker's ⋮; Templates › opens by the arrow, Enter and a pointer resting on it, the app's templates in it`, async ({ page }) => {
      const { root, problems } = await visit(page, where, 1);
      await more(root).click();
      const menu = page.getByRole('menu', { name: 'More actions' });
      await expect(menu).toBeVisible();
      await expect(menu.locator(':scope > [role="menuitem"]:visible')).toHaveText(['New linked work item', 'Change type…', 'Move to team project…', 'Create copy of work item…', 'Email work item', 'Delete', 'Copy link', 'Templates', 'New branch…', 'Customize']);
      await expect(menu.locator(':scope > [role="separator"]:visible')).toHaveCount(3);
      await expect(page.getByRole('menuitem', { name: 'New linked work item' })).toBeFocused();
      const templates = page.getByRole('menuitem', { name: 'Templates' });
      await expect(templates).toHaveAttribute('aria-haspopup', 'menu');
      await expect(templates).toHaveAttribute('aria-expanded', 'false');
      // By the keys: down to Templates, → opens it on its first item; ← back.
      for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowDown');
      await expect(templates).toBeFocused();
      await page.keyboard.press('ArrowRight');
      const inner = page.getByRole('menu', { name: 'Templates' });
      await expect(inner).toBeVisible();
      await expect(templates).toHaveAttribute('aria-expanded', 'true');
      await expect(inner.getByRole('menuitem')).toHaveText(['Capture…', 'Crash report', 'Wrong figures']);
      await expect(inner.getByRole('separator')).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Capture…' })).toBeFocused();
      await page.keyboard.press('ArrowDown');
      await expect(page.getByRole('menuitem', { name: 'Crash report' })).toBeFocused();
      await page.keyboard.press('ArrowLeft');
      await expect(inner).toBeHidden();
      await expect(templates).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('menuitem', { name: 'Capture…' })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(inner).toBeHidden();
      await expect(menu).toBeVisible();
      await expect(templates).toBeFocused();
      // At the window's end, ⋮'s menu its end under ⋮: Templates opens on the side with room, wholly on the screen.
      await templates.hover();
      await expect(inner).toBeVisible();
      const [outer, flyout] = await Promise.all([box(menu), box(inner)]);
      expect(flyout.right).toBeLessThanOrEqual(DESKTOP.width);
      expect(flyout.x).toBeGreaterThanOrEqual(0);
      expect(flyout.bottom).toBeLessThanOrEqual(DESKTOP.height);
      expect(flyout.right <= outer.x + 2 || flyout.x >= outer.right - 2, 'beside the menu, not over it').toBe(true);
      expect(Math.abs(flyout.y + 5 - (await box(templates)).y)).toBeLessThanOrEqual(2);
      await screen(page, `wi-more-menu-${where}`, { viewport: true });
      expect(await axeFindings(page, `${where}: Templates open`)).toEqual([]);
      // Moving on to another item: it closes.
      await page.getByRole('menuitem', { name: 'New branch…' }).hover();
      await expect(inner).toBeHidden();
      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
      await expect(more(root)).toBeFocused();
      expect(problems).toEqual([]);
    });

    test(`${where}: a template picked fills what it says; an item of the page's own runs its action; a button's menu holds a menu`, async ({ page }) => {
      const { root, demo } = await visit(page, where, 1);
      await more(root).click();
      await page.getByRole('menuitem', { name: 'Templates' }).click();
      await page.getByRole('menuitem', { name: 'Crash report' }).click();
      await expect(page.getByRole('menu', { name: 'More actions' })).toBeHidden();
      await expect(part(root, 'f-severity')).toContainText('1 - Critical');
      await expect(saveAndClose(root)).toHaveClass(/fd-button-primary/);
      // The page's own item inside: its action, by its id.
      await more(root).click();
      await page.getByRole('menuitem', { name: 'Templates' }).click();
      await page.getByRole('menuitem', { name: 'Capture…' }).click();
      await expect.poll(() => demo<string[]>('actions')).toContain('capture-template');
      // Save and Close's own menu: Save, a line, Save as ›.
      await part(root, 'b-save-close').getByRole('button', { name: 'Save and Close options' }).click();
      await expect(page.getByRole('menuitem', { name: 'Save as' })).toHaveAttribute('aria-haspopup', 'menu');
      await page.getByRole('menuitem', { name: 'Save as' }).click();
      await page.getByRole('menuitem', { name: 'Draft' }).click();
      await expect.poll(() => demo<string[]>('actions')).toContain('save-draft');
    });
  }

  test('right to left: ← opens Templates, → closes it, and it stays on the screen', async ({ page }) => {
    const { root } = await visit(page, 'dialog', 1, '&locale=ar&dir=rtl');
    await root.getByRole('button', { name: 'إجراءات أخرى' }).click();
    const templates = page.getByRole('menuitem', { name: 'القوالب' });
    await templates.focus();
    await page.keyboard.press('ArrowRight');
    const inner = page.getByRole('menu', { name: 'القوالب' });
    await expect(inner).toBeHidden();
    await page.keyboard.press('ArrowLeft');
    await expect(inner).toBeVisible();
    const flyout = await box(inner);
    expect(flyout.x).toBeGreaterThanOrEqual(0);
    expect(flyout.right).toBeLessThanOrEqual(DESKTOP.width);
    expect(await templates.locator('.fd-menu-more').evaluate((el) => getComputedStyle(el).transform)).not.toBe('none');
    await screen(page, 'wi-more-menu-rtl', { viewport: true });
    await page.keyboard.press('ArrowRight');
    await expect(inner).toBeHidden();
    await expect(templates).toBeFocused();
  });

  test('dark, and on a phone: the inner menu on the screen', async ({ page }) => {
    await page.setViewportSize(PHONE);
    const { root } = await visit(page, 'dialog', 1, '&scheme=dark');
    await more(root).click();
    await page.getByRole('menuitem', { name: 'Templates' }).click();
    const flyout = await box(page.getByRole('menu', { name: 'Templates' }));
    expect(flyout.x).toBeGreaterThanOrEqual(0);
    expect(flyout.right).toBeLessThanOrEqual(PHONE.width);
    await screen(page, 'wi-more-menu-phone-dark', { viewport: true });
  });
});

test.describe('a Description read first, edited from its Edit', () => {
  test.use({ viewport: DESKTOP });
  const group = (root: Locator) => part(root, 'g-description');
  const edit = (root: Locator) => group(root).getByRole('button', { name: 'Edit Description' });
  const done = (root: Locator) => group(root).getByRole('button', { name: 'Done' });
  const view = (root: Locator) => group(root).locator('.fd-md-view');
  const area = (root: Locator) => group(root).locator('.fd-text-area');

  for (const where of WHERE) {
    test(`${where}: reads formatted with Edit, ⤢ and ^ in its heading; Edit opens the editor, its toolbar on top, Done keeps what was typed`, async ({ page }) => {
      const { root, problems } = await visit(page, where, 1);
      await expect(view(root).locator('strong').first()).toHaveText('12');
      const link = view(root).getByRole('link', { name: 'order SO-2088' });
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(view(root).locator('li')).toHaveText(['Release 3 of 15', 'Open the product']);
      await expect(area(root)).toBeHidden();
      // Its heading's tools, Edit last; named for the text.
      await group(root).locator(':scope > legend').hover();
      await expect(group(root).locator('.fd-section-tools > button:visible')).toHaveCount(3);
      expect(await group(root).locator('.fd-section-tools > button:visible').evaluateAll((all) => all.map((b) => b.getAttribute('aria-label')))).toEqual(['Maximise Description', 'Collapse Description', 'Edit Description']);
      await screen(page, `wi-more-description-read-${where}`, { viewport: true });
      await edit(root).click();
      await expect(area(root)).toBeFocused();
      await expect(view(root)).toBeHidden();
      await expect(edit(root)).toBeHidden();
      await expect(done(root)).toBeVisible();
      const toolbar = group(root).getByRole('toolbar', { name: 'Formatting' });
      await expect(toolbar).toBeVisible();
      expect((await box(toolbar)).y).toBeLessThan((await box(area(root))).y);
      // Nothing typed: Done changes nothing.
      await done(root).click();
      await expect(view(root)).toBeVisible();
      await expect(saveAndClose(root)).not.toHaveClass(/fd-button-primary/);
      await expect(view(root)).toBeFocused();
      // Enter on its words opens it again; typed and Done, the record changed.
      await page.keyboard.press('Enter');
      await expect(area(root)).toBeFocused();
      await page.keyboard.press('Control+End');
      await page.keyboard.type(' Fixed in build 14.');
      await screen(page, `wi-more-description-edit-${where}`, { viewport: true });
      expect(await axeFindings(page, `${where}: Description edited`)).toEqual([]);
      await done(root).click();
      await expect(view(root)).toContainText('Fixed in build 14.');
      await expect(saveAndClose(root)).toHaveClass(/fd-button-primary/);
      expect(problems).toEqual([]);
    });

    test(`${where}: Escape puts back what it held; a press outside keeps what was typed; ⤢ works while it is edited`, async ({ page }) => {
      const { root } = await visit(page, where, 1);
      const before = await view(root).innerText();
      await edit(root).click();
      await page.keyboard.press('Control+End');
      await page.keyboard.type(' Not kept.');
      await page.keyboard.press('Escape');
      await expect(view(root)).toBeVisible();
      expect(await view(root).innerText()).toBe(before);
      await expect(saveAndClose(root)).not.toHaveClass(/fd-button-primary/);
      // ⤢ while it is edited: the group alone, the editor still open with what was typed.
      await edit(root).click();
      await page.keyboard.press('Control+End');
      await page.keyboard.type(' Kept.');
      await group(root).getByRole('button', { name: 'Maximise Description' }).click();
      await expect(group(root)).toHaveAttribute('data-maximised', '');
      await expect(area(root)).toBeVisible();
      await expect(area(root)).toContainText('Kept.');
      await area(root).click();
      await page.keyboard.press('Control+End');
      await page.keyboard.type(' Twice.');
      await screen(page, `wi-more-description-maximised-${where}`, { viewport: true });
      // A press outside it — the title — keeps what was typed, read as text again.
      await group(root).getByRole('button', { name: /Restore Description|Maximise Description/ }).click();
      await expect(group(root)).not.toHaveAttribute('data-maximised', '');
      await expect(area(root)).toBeVisible();
      await part(root, '#title').locator('textarea').click();
      await expect(view(root)).toBeVisible();
      await expect(view(root)).toContainText('Kept. Twice.');
      await expect(saveAndClose(root)).toHaveClass(/fd-button-primary/);
    });

    test(`${where}: empty, it is its editor at rest saying what to add; written and left, it reads with Edit`, async ({ page }) => {
      const { root } = await visit(page, where, 2);
      await expect(view(root)).toBeHidden();
      await expect(area(root)).toHaveAttribute('data-placeholder', 'Click to add Description.');
      await expect(edit(root)).toBeHidden();
      await area(root).click();
      await page.keyboard.type('Counts twice on the night shift.');
      await expect(done(root)).toBeVisible();
      await part(root, 'h-assigned').locator('input').click();
      await expect(view(root)).toHaveText('Counts twice on the night shift.');
      await expect(edit(root)).toBeAttached();
    });
  }

  test('dark, and on a phone: read and edited', async ({ page }) => {
    await page.setViewportSize(PHONE);
    const { root } = await visit(page, 'dialog', 1, '&scheme=dark');
    await group(root).scrollIntoViewIfNeeded();
    await screen(page, 'wi-more-description-read-phone-dark', { viewport: true });
    await edit(root).click();
    await expect(area(root)).toBeFocused();
    await expectNoSidewaysScroll(page);
    await screen(page, 'wi-more-description-edit-phone-dark', { viewport: true });
    expect(await axeFindings(page, 'Description edited, phone, dark')).toEqual([]);
  });

  test('the backlog’s bug: System Info reads with its picture and link; Templates › gives the bug’s templates', async ({ page }) => {
    await page.goto('/backlog/?workitem=4142');
    const dialog = page.getByRole('dialog');
    const system = part(dialog, 'f-system');
    const picture = system.locator('.fd-md-view img');
    await expect(picture).toBeVisible();
    expect(await picture.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBe(160);
    await expect(system.locator('.fd-md-view').getByRole('link', { name: 'EGP 2026' })).toHaveAttribute('target', '_blank');
    await expect(part(dialog, 'g-system').getByRole('button', { name: 'Edit System Info' })).toBeAttached();
    await dialog.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Templates' }).click();
    await expect(page.getByRole('menu', { name: 'Templates' }).getByRole('menuitem')).toHaveText(['Capture…', 'Crash report', 'Wrong figures']);
    await screen(page, 'wi-more-backlog-menu', { viewport: true });
    await page.getByRole('menuitem', { name: 'Wrong figures' }).click();
    await expect(part(dialog, 'f-severity')).toContainText('2 - High');
  });
});
