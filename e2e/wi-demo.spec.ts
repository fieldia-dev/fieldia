import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings } from './a11y-support';
import { expectNoSidewaysScroll, screen } from './support';

/**
 * The backlog demo (demos/backlog): a work tracker's page of its own round a
 * Fieldia list, drawn as the tracker draws its backlog — no box to choose a
 * row, a kind's icon before each title, a state's dot, headers cut short with
 * their whole words as a title, a filter bar of a keyword and each field's
 * values — and a bug opened from a row in a large popup over it, kept in the
 * address so a reload opens it again, the focus back on its row once closed.
 * The popup's own parts (its head, its three columns, its discussion and
 * history) are the other work item lanes'; their states are checked here
 * now that they have joined (the tests at the end).
 */

const BACKLOG = '/backlog/';
const rows = (page: Page) => page.locator('.fd-list-row:visible');
const row = (page: Page, id: number) => page.locator(`.fd-list-row[data-id="${id}"]`);
const pick = (page: Page, field: string) => page.locator(`.fd-filter-pick[data-field="${field}"]`);
const dialog = (page: Page) => page.getByRole('dialog');

function watch(page: Page) {
  const problems: string[] = [];
  page.on('console', (message) => message.type() === 'error' && problems.push(`console: ${message.text()}`));
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  return problems;
}

async function openBacklog(page: Page, query = '') {
  const problems = watch(page);
  await page.goto(`${BACKLOG}${query}`);
  await expect(rows(page).first()).toBeVisible();
  return problems;
}

test.describe('the backlog', () => {
  test.use({ viewport: { width: 2044, height: 929 } });

  test('is the tracker’s page round a Fieldia list drawn as its backlog', async ({ page }) => {
    const problems = await openBacklog(page);
    // The app's own chrome: a 48px bar and its line, the project's menu (259px and its line), the team's head with its
    // buttons and pivots — measured on the tracker's backlog (08_18), whose list's card starts at x 292.
    expect((await page.locator('.bl-top').boundingBox())?.height).toBe(49);
    expect((await page.locator('.bl-nav').boundingBox())?.width).toBe(260);
    await expect(page.locator('.bl-team')).toHaveText('Portal Team');
    await expect(page.getByRole('button', { name: 'New Work Item' })).toBeVisible();
    await expect(page.locator('.bl-pivots [aria-current="page"]')).toHaveText('Backlog');
    // No product's name or mark in it: the tracker's own invented name in bold, then the organisation's with no slash.
    await expect(page.locator('#app')).not.toContainText(/Azure|DevOps|Microsoft|Contoso|Fabrikam|Northwind/);
    expect(await page.locator('.bl-product').evaluate((a) => [a.textContent, getComputedStyle(a).fontWeight])).toEqual(['Trackline', '600']);
    await expect(page.getByRole('navigation', { name: 'Where you are' }).getByRole('listitem')).toHaveText(['Harbor Supply', 'Portal', 'Boards', 'Backlogs']);

    // The filter bar: the team's default search, active bugs, its picks in strong words; the rest muted.
    const bar = page.locator('.fd-filter-bar');
    await expect(bar.getByRole('searchbox', { name: 'Filter by keyword' })).toBeVisible();
    await expect(pick(page, 'work_type')).toHaveText('Work Item Type: Bug');
    await expect(pick(page, 'work_type')).toHaveAttribute('data-picked', '');
    await expect(pick(page, 'state')).toHaveText('State: Active');
    for (const field of ['area', 'iteration', 'tags']) await expect(pick(page, field)).not.toHaveAttribute('data-picked', '');
    await expect(bar.getByRole('button', { name: 'Filter settings' })).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Clear filters' })).toBeVisible();
    const picked = await pick(page, 'state').evaluate((b) => getComputedStyle(b).fontWeight);
    const muted = await pick(page, 'area').evaluate((b) => [getComputedStyle(b).fontWeight, getComputedStyle(b).color]);
    expect(picked).toBe('600');
    expect(muted).toEqual(['400', 'rgb(112, 112, 112)']);
    // A card with the callout's shadow, 50px tall at y 176, x 292; the table's card 16px under it, its header 38px and a rule.
    // (y from the app's top: the demos' own header sits above it in a browser test.)
    const top = (await page.locator('#app').boundingBox())!.y;
    const card = await bar.evaluate((b) => ({ box: b.getBoundingClientRect().toJSON(), shadow: getComputedStyle(b).boxShadow }));
    expect([card.box.x, card.box.y - top, card.box.height]).toEqual([292, 176, 50]);
    expect(card.shadow).toContain('rgba(0, 0, 0, 0.133)');
    expect((await page.locator('.fd-list-scroll').boundingBox())!.y - top).toBe(242);
    expect(Math.round((await page.locator('thead tr').boundingBox())!.height)).toBe(39);

    // The table: seventeen active bugs in their order, no box to choose one, Expand all and Collapse all in the header.
    await expect(rows(page)).toHaveCount(17);
    await expect(page.locator('.fd-list-checkbox')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Expand all' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Collapse all' })).toBeVisible();
    const first = row(page, 4127);
    await expect(first.locator('td').nth(1)).toHaveText('17');
    await expect(first.locator('td').nth(2)).toHaveText('Bug');
    await expect(first.locator('td').nth(3)).toHaveText('Stock count shows 12 after releasing 3 of 15 items to order SO-2088');
    // Order keeps to the start, as the tracker draws it; a bug's icon before its title in its colour; a dot before its state.
    expect(await first.locator('td').nth(1).evaluate((td) => getComputedStyle(td).textAlign)).toBe('start');
    expect(await first.locator('.fd-list-lead').evaluate((svg) => [svg.getAttribute('data-icon'), getComputedStyle(svg).color])).toEqual(['bug', 'rgb(204, 41, 61)']);
    expect(await first.locator('.fd-list-dot').evaluate((dot) => [getComputedStyle(dot).backgroundColor, dot.getBoundingClientRect().width])).toEqual(['rgb(0, 122, 204)', 8]);
    // Rows 36px tall, no lines between them; headers small and muted, parted by short rules, cut ones saying themselves whole.
    expect((await row(page, 4131).boundingBox())?.height).toBe(36);
    // The columns as wide as the tracker's (in pixels), their edges where its are; a ranked list: no header sorts it.
    const edges = await page.locator('thead th').evaluateAll((ths) => ths.map((th) => Math.round(th.getBoundingClientRect().right)));
    expect(edges).toEqual([368, 427, 463, 1374, 1442, 1503, 1603, 1803, 2003]);
    // Their rules where the tracker's are: none after Order, the title's 42px in from its end (the room the tracker keeps
    // for a row's tools), the rest at their column's end — in the pixels 463, 1331, 1441, 1502, 1602, 1802 and 2002 (08_18).
    const rules = await page.locator('thead th').evaluateAll((ths) =>
      ths.map((th) => {
        const after = getComputedStyle(th, '::after');
        return after.content === 'none' ? null : Math.round(th.getBoundingClientRect().right - parseFloat(after.right) - 1);
      })
    );
    expect(rules).toEqual([null, null, 462, 1331, 1441, 1502, 1602, 1802, 2002]);
    await expect(page.locator('thead .fd-list-sort')).toHaveCount(0);
    await expect(page.locator('thead th[data-field="order"]')).toHaveAttribute('aria-sort', 'ascending');
    await expect(pick(page, 'iteration')).toHaveText('Iteration');
    expect(await first.locator('td').nth(3).evaluate((td) => getComputedStyle(td).borderBottomWidth)).toBe('0px');
    const kind = page.locator('thead th[data-field="work_type"] .fd-list-head');
    await expect(kind).toHaveAttribute('title', 'Work Item Type');
    expect(await kind.evaluate((head) => head.scrollWidth > head.clientWidth)).toBe(true);
    expect(await kind.evaluate((head) => [getComputedStyle(head).fontSize, getComputedStyle(head).fontWeight])).toEqual(['12px', '600']);
    expect(await page.locator('thead th[data-field="title"]').evaluate((th) => [getComputedStyle(th, '::after').width, getComputedStyle(th, '::after').backgroundColor])).toEqual(['1px', 'rgb(234, 234, 234)']);
    await expectNoSidewaysScroll(page);
    await screen(page, 'wi-demo-backlog', { viewport: true });
    expect(await axeFindings(page, 'backlog')).toEqual([]);
    expect(problems).toEqual([]);
  });

  test('filters by keys: ↓ opens a field’s values, the arrows move, Space ticks, Escape closes; × clears every filter', async ({ page }) => {
    const problems = await openBacklog(page);
    const kinds = pick(page, 'work_type');
    await kinds.focus();
    await page.keyboard.press('ArrowDown');
    const menu = page.getByRole('menu', { name: 'Filter by Work Item Type' });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitemcheckbox')).toHaveText(['Bug', 'Task', 'User Story']);
    await expect(menu.getByRole('menuitemcheckbox', { name: 'Bug' })).toBeFocused();
    await expect(menu.getByRole('menuitemcheckbox', { name: 'Bug' })).toHaveAttribute('aria-checked', 'true');
    await screen(page, 'wi-demo-filter-open', { viewport: true });
    expect(await axeFindings(page, 'a filter’s values open')).toEqual([]);
    // Tasks too: the active one comes nested under the bug it belongs to.
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
    await expect(menu.getByRole('menuitemcheckbox', { name: 'Task' })).toHaveAttribute('aria-checked', 'true');
    await expect(rows(page)).toHaveCount(18);
    await expect(row(page, 4128)).toHaveAttribute('data-depth', '1');
    await expect(row(page, 4127).locator('.fd-list-twisty')).toHaveAttribute('aria-expanded', 'true');
    const ids = await rows(page).evaluateAll((trs) => trs.slice(0, 3).map((tr) => (tr as HTMLElement).dataset['id']));
    expect(ids).toEqual(['4127', '4128', '4131']);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(kinds).toBeFocused();
    await expect(kinds).toHaveText('Work Item Type: Bug, Task');
    // Collapse all folds the tasks under their bug; Expand all brings them back.
    await page.getByRole('button', { name: 'Collapse all' }).click();
    await expect(rows(page)).toHaveCount(17);
    await page.getByRole('button', { name: 'Expand all' }).click();
    await expect(rows(page)).toHaveCount(18);
    // A keyword: the titles that hold it.
    await page.getByRole('searchbox', { name: 'Filter by keyword' }).fill('write a test');
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('Write a test for the stock count');
    // × clears the keyword and every pick: the whole backlog.
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(rows(page)).toHaveCount(19);
    await expect(pick(page, 'state')).toHaveText('State');
    await expect(page.getByRole('searchbox', { name: 'Filter by keyword' })).toHaveValue('');
    expect(problems).toEqual([]);
  });

  test('opens a bug from its row in the popup, keeps it in the address, and gives the focus back to its row', async ({ page }) => {
    const problems = await openBacklog(page);
    await row(page, 4136).click();
    await expect(dialog(page)).toBeVisible();
    await expect(page).toHaveURL(/[?&]workitem=4136\b/);
    await expect(dialog(page).locator('[data-field="title"] textarea')).toHaveValue('The menu link should say Inventory, not Warehouse');
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(page).not.toHaveURL(/workitem=/);
    await expect(row(page, 4136)).toBeFocused();
    // Enter on a row opens it as well.
    await row(page, 4140).focus();
    await page.keyboard.press('Enter');
    await expect(dialog(page)).toBeVisible();
    await expect(page).toHaveURL(/[?&]workitem=4140\b/);
    await page.keyboard.press('Escape');
    await expect(row(page, 4140)).toBeFocused();
    expect(problems).toEqual([]);
  });

  test('opens the bug the address names, as the page loads; closed, its row has the focus', async ({ page }) => {
    const problems = watch(page);
    await page.goto(`${BACKLOG}?workitem=4127`);
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).locator('[data-field="title"] textarea')).toHaveValue('Stock count shows 12 after releasing 3 of 15 items to order SO-2088');
    await page.reload();
    await expect(dialog(page)).toBeVisible();
    await expect(page).toHaveURL(/[?&]workitem=4127\b/);
    // No row was pressed: none is lit behind the popup (the screens from 20.21.54 on, after a reload).
    await expect(row(page, 4127)).toBeVisible();
    await expect(row(page, 4127)).not.toHaveAttribute('aria-current', 'true');
    await screen(page, 'wi-demo-popup', { viewport: true });
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(row(page, 4127)).toBeFocused();
    await expect(row(page, 4127)).not.toHaveAttribute('aria-current', 'true');
    expect(problems).toEqual([]);
  });

  test('New Work Item opens a new bug; once saved it is on the backlog', async ({ page }) => {
    const problems = await openBacklog(page);
    await page.getByRole('button', { name: 'New Work Item' }).click();
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).locator('[data-field="title"] textarea')).toHaveValue('');
    await dialog(page).locator('[data-field="title"] textarea').fill('Printing a pick list cuts its last line');
    await dialog(page).getByRole('button', { name: 'Save and Close', exact: true }).click();
    await expect(dialog(page)).toHaveCount(0);
    // A new bug is New, not Active: it shows once the filter lets every state through.
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.locator('.fd-list-row', { hasText: 'Printing a pick list cuts its last line' })).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('the Code drawer shows the backlog’s page, the bug’s page and the app’s own script', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
    const problems = await openBacklog(page);
    await page.getByRole('button', { name: '‹/› Code' }).click();
    const code = page.locator('#demo-code');
    await expect(code.getByRole('tab')).toHaveText(['Backlog JSON', 'Bug JSON', 'JavaScript']);
    await expect(code.locator('code')).toContainText('"search": "fields"');
    await code.getByRole('tab', { name: 'Bug JSON' }).click();
    await expect(code.locator('code')).toContainText('"id": "work-item-bug"');
    await code.getByRole('tab', { name: 'JavaScript' }).click();
    await expect(code.locator('code')).toContainText("size: 'inset'");
    await expect(code.locator('code')).toContainText('onOpenRecord: (id) => openBug(id)');
    expect(problems).toEqual([]);
  });

  test('User settings offers the languages by keys: ↓ opens on the first, the arrows move, Escape closes, Enter picks', async ({ page }) => {
    const problems = await openBacklog(page);
    const settings = page.getByRole('button', { name: 'User settings' });
    await expect(settings).toHaveAttribute('title', 'User settings');
    for (const name of ['My work items', 'Extensions', 'Help', 'Create']) await expect(page.getByRole('button', { name })).toHaveAttribute('title', name);
    await settings.focus();
    await page.keyboard.press('ArrowDown');
    const menu = page.getByRole('menu', { name: 'Language' });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitemradio')).toHaveText(['English', 'العربية', 'Deutsch', 'Français']);
    await expect(menu.getByRole('menuitemradio', { name: 'English' })).toBeFocused();
    await expect(menu.getByRole('menuitemradio', { name: 'English' })).toHaveAttribute('aria-checked', 'true');
    expect(await axeFindings(page, 'User settings open')).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(settings).toBeFocused();
    await settings.press('Enter');
    await expect(menu.getByRole('menuitemradio', { name: 'English' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/[?&]locale=de\b/);
    await expect(page.getByRole('button', { name: 'Benutzereinstellungen' })).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('a press on a part this demo does not have says so', async ({ page }) => {
    await openBacklog(page);
    await page.getByRole('button', { name: 'View as Board' }).click();
    await expect(page.locator('.bl-note')).toHaveText('Only the backlog and its bugs are in this demo.');
  });
});

test.describe('the backlog in other languages, dark, and on a phone', () => {
  test('right to left in Arabic: the chrome, the list and its filter bar mirrored and in Arabic', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const problems = await openBacklog(page, '?locale=ar');
    await expect(page.locator('#app')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('searchbox', { name: 'تصفية بكلمة' })).toBeVisible();
    await expect(pick(page, 'work_type')).toHaveText('نوع بند العمل: خلل');
    await expect(page.getByRole('button', { name: 'طي الكل' })).toBeVisible();
    await expect(row(page, 4127).locator('td').nth(2)).toHaveText('خلل');
    // The menu at the right, the list's filter fields at the left.
    const nav = await page.locator('.bl-nav').boundingBox();
    expect((nav?.x ?? 0) + (nav?.width ?? 0)).toBeGreaterThan(1400);
    const fields = await page.locator('.fd-filter-fields').boundingBox();
    const keyword = await page.locator('.fd-filter-search').boundingBox();
    expect(fields?.x ?? 0).toBeLessThan(keyword?.x ?? 0);
    await expectNoSidewaysScroll(page);
    await screen(page, 'wi-demo-backlog-arabic', { viewport: true });
    expect(await axeFindings(page, 'backlog in Arabic')).toEqual([]);
    expect(problems).toEqual([]);
  });

  test('in German and French, the filter bar’s words and the page’s', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openBacklog(page, '?locale=de');
    await expect(page.getByRole('searchbox', { name: 'Nach Stichwort filtern' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Filtereinstellungen' })).toBeVisible();
    await expect(pick(page, 'state')).toHaveText('Status: Aktiv');
    await openBacklog(page, '?locale=fr');
    await expect(page.getByRole('searchbox', { name: 'Filtrer par mot-clé' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Effacer les filtres' })).toBeVisible();
    await expect(pick(page, 'state')).toHaveText('État: Actif');
  });

  test('dark: the chrome and the list in the tracker’s dark colours', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const problems = await openBacklog(page, '?scheme=dark');
    expect(await page.locator('.bl-top').evaluate((bar) => getComputedStyle(bar).backgroundColor)).toBe('rgb(37, 36, 35)');
    expect(await page.locator('.fd-list-scroll').evaluate((card) => getComputedStyle(card).backgroundColor)).toBe('rgb(37, 36, 35)');
    expect(await row(page, 4127).locator('td').nth(3).evaluate((td) => getComputedStyle(td).color)).toBe('rgb(243, 242, 241)');
    await screen(page, 'wi-demo-backlog-dark', { viewport: true });
    expect(await axeFindings(page, 'backlog, dark')).toEqual([]);
    expect(problems).toEqual([]);
  });

  test('narrower than the tracker’s screens, 1440 and 1280: every column whole in the card, no state cut to “Ac…”, no header to “W…”', async ({ page }) => {
    for (const [width, height] of [[1440, 900], [1280, 800]] as const) {
      await page.setViewportSize({ width, height });
      const problems = await openBacklog(page);
      const card = page.locator('.fd-list-scroll');
      // The grid fits its card: nothing to scroll sideways, so no column stops at its edge.
      expect(await card.evaluate((c) => c.scrollWidth - c.clientWidth), `${width}: the grid fits its card`).toBeLessThanOrEqual(0);
      const edge = (await card.boundingBox())!;
      const state = (await page.locator('thead th[data-field="state"]').boundingBox())!;
      const tags = (await page.locator('thead th[data-field="tags"]').boundingBox())!;
      expect(state.x + state.width, `${width}: State whole`).toBeLessThanOrEqual(edge.x + edge.width);
      expect(tags.x + tags.width, `${width}: Tags whole`).toBeLessThanOrEqual(edge.x + edge.width + 1);
      await expect(row(page, 4127).locator('td').nth(4)).toContainText('Active');
      // Every header's words whole: Work Item Type and Story Points too.
      const cut = await page.locator('thead .fd-list-head').evaluateAll((heads) => heads.filter((h) => h.scrollWidth > h.clientWidth).map((h) => h.textContent));
      expect(cut, `${width}: headers cut`).toEqual([]);
      await expectNoSidewaysScroll(page);
      await screen(page, `wi-demo-backlog-${width}`, { viewport: true });
      expect(problems).toEqual([]);
    }
  });

  test('390px wide: the page and the list fit, nothing scrolls sideways but the table', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const problems = await openBacklog(page);
    await expect(page.locator('.bl-nav')).toBeHidden();
    await expectNoSidewaysScroll(page);
    // The filter bar wraps inside its card.
    const bar = await page.locator('.fd-filter-bar').boundingBox();
    expect((bar?.x ?? 0) + (bar?.width ?? 0)).toBeLessThanOrEqual(390 - 16 + 1);
    await screen(page, 'wi-demo-backlog-phone', { viewport: true });
    expect(await axeFindings(page, 'backlog, 390px')).toEqual([]);
    expect(problems).toEqual([]);
  });
});

/**
 * The popup's states as the screenshots show them, with the other work item
 * lanes' parts joined: wi-header's head and dialog, wi-picker's pickers,
 * wi-text's groups, editors and discussion, wi-history's history.
 */
test.describe('the popup, once the work item lanes have joined', () => {
  test.use({ viewport: { width: 1920, height: 983 } });

  test('08_19: an inset popup over the backlog, nothing dimmed, its head and three columns', async ({ page }) => {
    // Opened by a press on its row, as the user did.
    await page.goto(BACKLOG);
    await row(page, 4127).click();
    await expect(dialog(page)).toBeVisible();
    const box = (await dialog(page).boundingBox())!;
    expect([box.x, box.width]).toEqual([96, 1728]);
    // Behind it, the bug's row lit while it is open (it was pressed), and the backlog's card scrolling sideways in its own bar: its grid is
    // wider than the window leaves it, the page itself does not scroll.
    await expect(row(page, 4127)).toHaveAttribute('aria-current', 'true');
    expect(await row(page, 4127).locator('td').first().evaluate((td) => getComputedStyle(td).backgroundColor)).toBe('rgb(222, 236, 249)');
    const top = (await page.locator('#app').boundingBox())!.y;
    expect(await page.locator('.fd-list-scroll').evaluate((card) => [card.scrollWidth > card.clientWidth, Math.round(card.getBoundingClientRect().bottom)])).toEqual([true, 966 + Math.round(top)]);
    await expectNoSidewaysScroll(page);
    expect(await page.locator('.fd-form-dialog-backdrop').evaluate((shade) => getComputedStyle(shade).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    await expect(dialog(page).getByText('BUG 4127')).toBeVisible();
    await expect(dialog(page).getByRole('button', { name: 'Save and Close', exact: true })).toBeVisible();
    await expect(dialog(page).getByText('Updated by Mona Adel: Aug 25')).toBeVisible();
    // Add Tag just after the comments' link (08_19: 9px on), a light fill hugging its words.
    const comments = (await dialog(page).getByRole('button', { name: /1 Comment/ }).boundingBox())!;
    const addTag = (await dialog(page).getByRole('button', { name: 'Add Tag' }).boundingBox())!;
    expect(addTag.x - (comments.x + comments.width)).toBeLessThanOrEqual(8);
    expect(addTag.width).toBeLessThanOrEqual(60);
    // Revert changes with nothing changed: idle and lighter, its tooltip saying why; still a usable button.
    const undo = dialog(page).getByRole('button', { name: 'Revert changes' });
    await expect(undo).toHaveAttribute('data-idle', '');
    await expect(undo).toHaveAttribute('title', 'Revert changes — Nothing has changed.');
    await expect(undo).toBeEnabled();
    // Development's help: its branch white on the code's orange tile, 28px by 30.
    const tile = dialog(page).locator('[data-node="f-dev"] .fd-links-help-tile');
    expect(await tile.evaluate((t) => [Math.round(t.getBoundingClientRect().width), Math.round(t.getBoundingClientRect().height), getComputedStyle(t).color])).toEqual([28, 30, 'rgb(255, 255, 255)']);
    await screen(page, 'wi-demo-popup-joined', { viewport: true });
    expect(await axeFindings(page, 'popup')).toEqual([]);
  });

  test('20.20.45 / 20.24.05: State’s list, Area’s and Iteration’s pickers with Suggestions and the tree', async ({ page }) => {
    const problems = watch(page);
    await page.goto(`${BACKLOG}?workitem=4127`);
    // State: its list at the value box's start, a tick on Active, no dots.
    await dialog(page).locator('[data-node="f-state"] .fd-dot-box').click();
    const states = page.locator('.fd-pick-list:visible');
    await expect(states.getByRole('menuitemradio')).toHaveText(['New', 'Active', 'Resolved', 'Closed']);
    await expect(states.getByRole('menuitemradio', { name: 'Active' })).toHaveAttribute('aria-checked', 'true');
    await expect(states.locator('.fd-dot')).toHaveCount(0);
    await page.keyboard.press('Escape');
    // Area: the person's one latest pick, then the tree.
    await dialog(page).locator('[data-node="f-area"] input').click();
    await expect(page.getByRole('group', { name: 'Suggestions' }).getByRole('treeitem')).toHaveText(['Portal']);
    // The tree: the project's one area, nothing under it, so no chevron to open it.
    await expect(page.locator('.fd-path-callout:popover-open [role=tree] > [role=treeitem]')).toHaveText(['Portal']);
    await expect(page.locator('.fd-path-callout:popover-open .fd-path-twist')).toHaveCount(0);
    await page.keyboard.press('Escape');
    // Iteration: the latest picks in the order picked, the current one second as the screenshot has it, each with its dates.
    await dialog(page).locator('[data-node="f-iteration"] input').click();
    await expect(page.getByRole('tree')).toBeVisible();
    // Its box typed into, its tree open: two pixels of the accent and a light halo of it outside (20.24.05).
    const iterationBox = dialog(page).locator('[data-node="f-iteration"] input');
    await expect.poll(() => iterationBox.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe('rgb(0, 120, 212)');
    await expect.poll(() => iterationBox.evaluate((el) => getComputedStyle(el).boxShadow)).toMatch(/^rgb\(0, 120, 212\) 0px 0px 0px 1px, .+ 0px 0px 0px 3px$/);
    const suggestions = page.getByRole('group', { name: 'Suggestions' }).getByRole('treeitem');
    await expect(suggestions.locator('.fd-path-words, .fd-path-name').first()).toBeVisible();
    await expect(suggestions.nth(0)).toContainText('Portal\\Sprint 12');
    await expect(suggestions.nth(0)).toContainText('3/25/2026 - 4/16/2026');
    await expect(suggestions.nth(1)).toContainText('Portal\\Sprint 14');
    await screen(page, 'wi-demo-iteration', { viewport: true });
    expect(await axeFindings(page, 'iteration open')).toEqual([]);
    expect(problems).toEqual([]);
  });

  test('20.21.54 / 20.22.28 / 20.24.05: Repro Steps in Markdown, emptied it takes no room; System Info’s tools', async ({ page }) => {
    await page.goto(`${BACKLOG}?workitem=4127`);
    const repro = dialog(page).locator('[data-node="g-repro"]');
    const systemHead = dialog(page).locator('[data-node="g-system"] > legend');
    const at = async () => (await systemHead.boundingBox())!.y;
    const before = await at();
    await repro.locator(':scope > legend').hover();
    // The heading's tools sit low: their middle 8px under the title's, as measured on the tracker.
    const middle = (box: { y: number; height: number } | null) => box!.y + box!.height / 2;
    const title = middle(await repro.locator(':scope > legend .fd-section-name').boundingBox());
    expect(Math.round(middle(await dialog(page).getByRole('button', { name: 'Maximise Repro Steps' }).boundingBox()) - title)).toBe(8);
    await dialog(page).getByRole('button', { name: 'Edit Repro Steps' }).click();
    const card = repro.locator('.fd-md-card');
    await expect(card.getByRole('switch', { name: 'Preview' })).toBeVisible();
    // The Markdown toolbar's thirteen tools, @ # and ! first, as the screenshot has them.
    const tools = await card.getByRole('toolbar').getByRole('button').evaluateAll((b) => b.filter((x) => !(x as HTMLElement).hidden && !x.matches('[role=switch]')).map((x) => x.getAttribute('aria-label')));
    expect(tools.slice(0, 3)).toEqual(['Mention someone', 'Link work item', 'Link pull request']);
    expect(tools).toHaveLength(13);
    // Emptied and done: an empty Markdown text with no words of its own takes no room, System Info moves up under its heading.
    await card.locator('textarea').fill('');
    await dialog(page).getByRole('button', { name: 'Done' }).click();
    await expect(card).toBeHidden();
    expect(before - (await at())).toBeGreaterThanOrEqual(50);
    await expect(repro.getByRole('button', { name: 'Edit Repro Steps' })).toBeAttached();
    // System Info focused: its twenty tools, @ # and ! among them.
    await dialog(page).locator('[data-node="f-system"] .fd-text-area').click();
    const rich = dialog(page).locator('[data-node="f-system"]').getByRole('toolbar', { name: 'Formatting' });
    await expect(rich.getByRole('button', { name: 'Link pull request' })).toBeVisible();
    await expect(rich.getByRole('button', { name: 'Remove link' })).toBeVisible();
  });

  test('20.22.23 / 20.22.36: the discussion, a comment written and saved, the count in the head following it', async ({ page }) => {
    await page.goto(`${BACKLOG}?workitem=4127`);
    await expect(dialog(page).getByRole('button', { name: /1 Comment/ })).toBeVisible();
    await page.locator('.fd-composer-card .fd-text-area').click();
    // Nothing typed yet: Save idle and lighter, its tooltip saying why (20.22.36), still usable; Remove link too, no link here.
    const save = page.locator('.fd-composer-card').getByRole('button', { name: 'Save' });
    await expect(save).toHaveAttribute('data-idle', '');
    await expect(save).toHaveAttribute('title', 'Write a comment first.');
    await expect(save).toBeEnabled();
    await expect(page.locator('.fd-composer-card [data-tool="unlink"]')).toHaveAttribute('data-idle', '');
    await page.keyboard.type('The scanner is back: 3 of 15 left the shelf twice.');
    await expect(save).not.toHaveAttribute('data-idle', '');
    await save.click();
    await expect(page.locator('li.fd-comment-card')).toHaveCount(2);
    await expect(dialog(page).getByRole('button', { name: /2 Comments/ })).toBeVisible();
    // Kept as the server has it: nothing for Save and Close to save.
    await expect(dialog(page).getByRole('button', { name: 'Save and Close', exact: true })).not.toHaveClass(/fd-button-primary/);
  });

  test('20.23.03: Related Work’s Add link menu, Effort (Hours) folded', async ({ page }) => {
    await page.goto(`${BACKLOG}?workitem=4127`);
    const effort = dialog(page).locator('[data-node="g-effort"] > legend');
    await effort.hover();
    await effort.getByRole('button', { name: 'Collapse Effort (Hours)' }).click();
    await expect(effort.getByRole('button', { name: 'Expand Effort (Hours)' })).toBeVisible();
    await dialog(page).locator('[data-node="f-related"]').getByRole('button', { name: 'Add link' }).click();
    // Existing item, and New item: the app gives a page for a work item.
    await expect(page.getByRole('menuitem')).toHaveText(['Existing item', 'New item']);
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'New item' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menuitem')).toHaveCount(0);
  });

  test('20.24.46: the History tab, its State Graph and the changes', async ({ page }) => {
    await page.goto(`${BACKLOG}?workitem=4127`);
    await dialog(page).getByRole('tab', { name: 'History' }).click();
    await expect(dialog(page).getByText('State Graph')).toBeVisible();
    await expect(dialog(page).getByRole('list', { name: 'State Graph' }).getByRole('listitem').first()).toBeVisible();
    await page.getByRole('option', { name: /1999979534/ }).first().click();
    await expect(dialog(page).locator('.fd-history-detail')).toContainText('Wed 7/22/2026');
    expect(await axeFindings(page, 'history')).toEqual([]);
  });

  test('390px wide: the popup fills the window', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BACKLOG}?workitem=4127`);
    const box = (await dialog(page).boundingBox())!;
    expect([box.x, box.width]).toEqual([0, 390]);
    await expectNoSidewaysScroll(page);
  });

  test('Follow answered by the app: Following, and nothing for Save and Close to save', async ({ page }) => {
    await page.goto(`${BACKLOG}?workitem=4127`);
    await dialog(page).getByRole('button', { name: 'Follow', exact: true }).click();
    await expect(dialog(page).getByRole('button', { name: 'Following' })).toHaveAttribute('aria-pressed', 'true');
  });
});
