import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { cardOf, centre, dragToward, dropAt, editing, inAdvanced, inBar, layout, watch } from './designer-support';
import { expectNoSidewaysScroll, screen } from './support';

/**
 * The designers on a phone, as the walk of 0.29 met them (390×844, WebKit): the survey designer's bar was about 210px
 * tall and stayed on screen, the whole toolbox came first — the first question some 2,100px down — and a page's title
 * was cut to "Your ex". Now the bar is one row that keeps to its height — the title, Publish and More, the rest under
 * More — the toolbox waits behind the + of the bar at the foot and comes up in a sheet, so the form starts near the
 * top, and a title's box wraps its words, its buttons under it where there is no room. The screen designer the same.
 * At a phone's 390px and a small one's 360px, light, in every engine.
 */

const PHONES = [
  { width: 390, height: 844 },
  { width: 360, height: 780 },
];
const bar = (page: Page) => page.locator('.fd-designer-bar');
const height = async (page: Page, selector: string) => (await page.locator(selector).first().boundingBox())!.height;

/** Whether a box shows all its words: nothing scrolled out of sight across or down. */
const whole = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((box) => (box as HTMLElement).scrollWidth <= box.clientWidth + 1 && (box as HTMLElement).scrollHeight <= box.clientHeight + 1);

for (const phone of PHONES) {
  test.describe(`at ${phone.width}px`, () => {
    test.beforeEach(async ({ page }) => page.setViewportSize(phone));

    test('the survey designer: one row of bar, the form near the top, the toolbox behind the +, every title whole', async ({ page }) => {
      const problems = watch(page);
      // The walk's way in: the Designer page's "A survey, the Google Forms way".
      await page.goto('/designer/?start=survey');
      await expect(page.locator('.fd-q').first()).toBeVisible();
      // One row: the title, Publish and More; nothing else of the bar is on show.
      expect(await height(page, '.fd-designer-bar')).toBeLessThanOrEqual(76);
      for (const name of ['Publish', 'More']) await expect(bar(page).getByRole('button', { name, exact: true })).toBeInViewport();
      for (const name of ['Try it', 'Checks', 'Find anything']) await expect(bar(page).getByRole('button', { name, exact: false }).first()).toBeHidden();
      expect(await whole(page, '.fd-designer-title')).toBe(true);
      // No toolbox above the form: the first question in the first screen, not 2,100px down.
      await expect(page.locator('.fd-rail')).toBeHidden();
      const first = (await page.locator('.fd-q').first().boundingBox())!;
      expect(first.y).toBeLessThan(phone.height);
      await expectNoSidewaysScroll(page);
      await screen(page, `designer-phone-${phone.width}-survey`, { viewport: true });

      // Scrolled, the bar that stays is that one row.
      await page.mouse.wheel(0, 1500);
      await expect.poll(async () => (await bar(page).boundingBox())!.y).toBeLessThanOrEqual(1);
      expect(await height(page, '.fd-designer-bar')).toBeLessThanOrEqual(76);

      // The page's title the walk saw cut: whole, its buttons under it where the row has no room.
      const step = page.locator('.fd-design-step').filter({ has: page.locator('.fd-step-title') }).nth(2);
      await expect(step.locator('.fd-step-title')).toHaveValue('Your experience');
      await step.locator('.fd-step-title').scrollIntoViewIfNeeded();
      expect(await step.locator('.fd-step-title').evaluate((box) => box.scrollWidth <= box.clientWidth + 1 && box.scrollHeight <= box.clientHeight + 1)).toBe(true);
      const title = (await step.locator('.fd-step-title-box').boundingBox())!;
      const tools = (await step.locator('.fd-step-tools').boundingBox())!;
      expect(tools.x >= title.x + title.width - 1 || tools.y >= title.y + title.height - 1, 'beside the title, or under it').toBe(true);
      // The form's own heading and description: wrapped, never cut.
      for (const box of ['.fd-survey-head-title', '.fd-survey-head-description']) expect(await whole(page, box), box).toBe(true);
      await screen(page, `designer-phone-${phone.width}-page-title`, { viewport: true });

      // Its endings, under the pages: each card as wide as the column, nothing of it past its edge.
      await page.getByRole('button', { name: 'Add an ending' }).click();
      const ending = page.locator('.fd-ending').first();
      await ending.scrollIntoViewIfNeeded();
      const edge = await ending.evaluate((card) => card.getBoundingClientRect().right);
      const past = await ending.locator('*').evaluateAll((all, right) => all.filter((e) => e.getClientRects().length > 0 && e.getBoundingClientRect().right > right + 1).map((e) => `${e.tagName.toLowerCase()}.${e.className}`), edge);
      expect(past).toEqual([]);
      await expectNoSidewaysScroll(page);
      await screen(page, `designer-phone-${phone.width}-endings`, { viewport: true });

      // The + at the foot opens the toolbox as a sheet over the page; a kind picked is added, the sheet gone.
      await page.locator('.fd-q-closed').filter({ hasText: 'How would you rate it?' }).click();
      const plus = page.locator('.fd-q-rail').getByRole('button', { name: 'Open the toolbox' });
      await expect(plus).toBeInViewport();
      await plus.click();
      const sheet = page.getByRole('dialog', { name: 'Add, outline and data' });
      await expect(sheet).toBeVisible();
      await expect(plus).toHaveAttribute('aria-expanded', 'true');
      await expect(sheet.getByRole('tab', { name: 'Add' })).toBeFocused();
      await expectNoSidewaysScroll(page);
      await screen(page, `designer-phone-${phone.width}-toolbox`, { viewport: true });
      const before = await page.locator('.fd-q').count();
      await sheet.getByRole('button', { name: /^Dropdown/ }).click();
      await expect(sheet).toBeHidden();
      await expect(page.locator('.fd-q')).toHaveCount(before + 1);
      await expect(page.locator('.fd-q-selected .fd-q-kind')).toContainText('Dropdown');
      await expect(page.locator('.fd-q-selected .fd-q-label')).toBeFocused();
      await page.keyboard.type('Which plan are you on?');
      await expect(page.locator('.fd-q-selected .fd-q-label')).toHaveValue('Which plan are you on?');
      // Escape puts it away, the keys back on the +.
      await plus.click();
      await expect(sheet).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(sheet).toBeHidden();
      await expect(plus).toBeFocused();
      await expect(plus).toHaveAttribute('aria-expanded', 'false');

      // The rest of the bar, under More: a view picked puts it away.
      await (await inBar(page, 'Try it')).click();
      await expect(page.locator('.fd-try')).toBeVisible();
      await expect(bar(page).getByRole('button', { name: 'Try it' })).toBeHidden();
      await expect(bar(page).getByRole('button', { name: 'More', exact: true })).toHaveAttribute('aria-expanded', 'false');
      await (await inBar(page, 'Design')).click();
      await expect(page.locator('.fd-q').first()).toBeVisible();
      expect(problems).toEqual([]);
    });

    test('the bar’s More: everything else of the bar, the keys going in and back out, a press elsewhere putting it away', async ({ page }) => {
      await page.goto('/designer/?start=survey');
      const more = bar(page).getByRole('button', { name: 'More', exact: true });
      await more.click();
      await expect(more).toHaveAttribute('aria-expanded', 'true');
      for (const name of ['Find anything', 'Design', 'Try it', 'JSON', 'Translations', 'Rules', 'Look']) await expect(bar(page).getByRole('button', { name, exact: true })).toBeInViewport();
      await expect(bar(page).locator('[data-checks]')).toBeInViewport();
      await expect(bar(page).locator('.fd-designer-status')).toBeFocused();
      await expectNoSidewaysScroll(page);
      await screen(page, `designer-phone-${phone.width}-more`, { viewport: true });
      // Escape: put away, the keys on More.
      await page.keyboard.press('Escape');
      await expect(bar(page).getByRole('button', { name: 'Try it' })).toBeHidden();
      await expect(more).toBeFocused();
      // A press beside it, on the page, puts it away.
      await more.click();
      await expect(bar(page).getByRole('button', { name: 'Try it' })).toBeVisible();
      await page.mouse.click(6, phone.height - 200);
      await expect(bar(page).getByRole('button', { name: 'Try it' })).toBeHidden();
      // Checks opened from it: its popover over it, the bar's parts kept until it is done.
      await (await inBar(page, 'Find anything')).click();
      await expect(page.getByRole('dialog', { name: 'Find anything' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(bar(page).getByRole('button', { name: 'Find anything', exact: true })).toBeFocused();
    });

    test('the screen designer: one row of bar, the screen near the top, the toolbox behind the + at the foot', async ({ page }) => {
      const problems = watch(page);
      await page.goto('/screen/');
      await expect(page.locator('.fd-canvas-field').first()).toBeVisible();
      expect(await height(page, '.fd-designer-bar')).toBeLessThanOrEqual(76);
      for (const name of ['Simple', 'Try it', 'Checks']) await expect(bar(page).getByRole('button', { name, exact: false }).first()).toBeHidden();
      await expect(page.locator('.fd-rail')).toBeHidden();
      expect((await page.locator('.fd-canvas-field').first().boundingBox())!.y).toBeLessThan(phone.height / 2);
      const plus = page.locator('.fd-foot-bar').getByRole('button', { name: 'Open the toolbox' });
      await expect(plus).toBeInViewport();
      // At the foot of the screen, wherever it is scrolled to.
      const foot = (await plus.boundingBox())!;
      expect(foot.y + foot.height).toBeGreaterThan(phone.height - 80);
      await expectNoSidewaysScroll(page);
      await screen(page, `designer-phone-${phone.width}-screen`, { viewport: true });
      await plus.click();
      const sheet = page.getByRole('dialog', { name: 'Add, outline and data' });
      await expect(sheet).toBeVisible();
      await sheet.getByRole('button', { name: /^Email/ }).click();
      await expect(sheet).toBeHidden();
      const label = page.locator('.fd-canvas-field.fd-editing [data-inline="label"]');
      await expect(label).toBeFocused();
      // Typed where it stands, clear of the bar at the foot.
      await page.keyboard.type('Contact email');
      await expect(label).toHaveValue('Contact email');
      const typed = (await label.boundingBox())!;
      expect(typed.y + typed.height).toBeLessThanOrEqual((await plus.boundingBox())!.y);
      // The rest of the bar under More, Simple and Advanced among it.
      await (await inBar(page, 'Advanced')).click();
      await expect(page.locator('.fd-screen-designer')).toHaveAttribute('data-mode', 'advanced');
      expect(problems).toEqual([]);
    });
  });
}

test('wider than a phone, the bar is as it was: no More, the views on their own row; and the toolbox beside the page', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/designer/?start=survey');
  await expect(bar(page).getByRole('button', { name: 'More', exact: true })).toBeHidden();
  await expect(bar(page).getByRole('button', { name: 'Try it' })).toBeVisible();
  await expect(page.locator('.fd-rail')).toBeVisible();
  await expect(page.locator('.fd-q-rail').getByRole('button', { name: 'Open the toolbox' })).toBeHidden();
  await expect(page.locator('.fd-q-rail').getByRole('button', { name: 'Add a question after this one' })).toBeVisible();
  await page.goto('/screen/');
  await expect(page.locator('.fd-rail')).toBeVisible();
  await expect(page.locator('.fd-foot-bar')).toBeHidden();
});

/**
 * The toolbox's sheet where a mouse is: a laptop's 1280px with an app's menu open beside the designer — the demos' own
 * frame opens one — leaves the designer under 1,000px, too narrow for the toolbox beside the page, so it waits behind the
 * + and comes up in a sheet over the page. A tile was only picked there: dragged, it opened no gap and added nothing.
 * Now the sheet steps aside as the drag begins, and the page it covered takes the drop, as from the toolbox beside it.
 */
test.describe('a tile dragged out of the toolbox’s sheet at a laptop’s width', () => {
  // A designer under 1,000px however it comes to be: here a window of 960px.
  test.beforeEach(async ({ page }) => page.setViewportSize({ width: 960, height: 720 }));
  const sheetOf = (page: Page) => page.getByRole('dialog', { name: 'Add, outline and data' });

  test('the screen designer, as a visitor opens its demo at 1280px, the menu open beside it: the sheet steps aside, a gap opens where it will land, and it lands there', async ({ page }) => {
    const problems = watch(page);
    // A person, not a test browser: the demos' frame draws its menu — its links under the sheet, where a tile is pressed.
    await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/screen/');
    await expect(page.locator('.fd-canvas-field')).toHaveCount(7);
    await expect(page.getByRole('button', { name: 'All demos' })).toHaveAttribute('aria-expanded', 'true');
    // Under 1,000px beside the menu: the toolbox behind the + at the foot.
    await expect(page.locator('.fd-screen-body > .fd-rail')).toBeHidden();
    const plus = page.locator('.fd-foot-bar').getByRole('button', { name: 'Open the toolbox' });
    await plus.click();
    const email = sheetOf(page).locator('[data-tool="kind:email"]');
    await expect(email).toBeVisible();
    // Pressed on Email in the sheet, carried at a hand's pace to the top of Photos — under Notes — and held there.
    const photosTop = async () => {
      const photos = (await (await cardOf(page, 'Photos')).boundingBox())!;
      return { x: photos.x + photos.width / 2, y: photos.y + 24 };
    };
    await dragToward(page, centre((await email.boundingBox())!), photosTop, { release: false });
    await expect(sheetOf(page)).toBeHidden();
    // The keys with its +, as when the sheet is put away, until what is dropped takes them.
    await expect(plus).toBeFocused();
    await expect(plus).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.fd-drag-chip')).toHaveText('Email');
    await expect(page.locator('.fd-drop-slot + .fd-canvas-field .fd-label')).toHaveText('Photos');
    await screen(page, 'designer-sheet-drag-screen', { viewport: true });
    await page.mouse.up();
    await expect(editing(page).label).toBeFocused();
    await page.keyboard.type('Contact email');
    await expect.poll(async () => (await layout(page))[0].map((one) => one.split(':')[0])).toEqual(['Customer', 'Visit date', 'Notes', 'Contact email', 'Photos']);
    expect(problems).toEqual([]);
  });

  test('the screen designer’s Advanced canvas: what is under the pointer is the screen’s once the sheet has stepped aside', async ({ page }) => {
    const problems = watch(page);
    await inAdvanced(page);
    await page.goto('/screen/');
    await expect(page.locator('.fd-canvas-field')).toHaveCount(7);
    await page.locator('.fd-foot-bar').getByRole('button', { name: 'Open the toolbox' }).click();
    const email = sheetOf(page).locator('[data-tool="kind:email"]');
    await expect(email).toBeVisible();
    const notes = (await (await cardOf(page, 'Notes')).boundingBox())!;
    const { words, refused } = await dropAt(page, centre((await email.boundingBox())!), { x: notes.x + notes.width / 2, y: notes.y + notes.height * 0.75 }, { release: false });
    expect([words, refused]).toEqual(['above “Photos”', false]);
    await expect(sheetOf(page)).toBeHidden();
    await page.mouse.up();
    await expect(editing(page).label).toBeFocused();
    await page.keyboard.type('Contact email');
    await expect(editing(page).label).toHaveValue('Contact email');
    await expect(page.locator('.fd-canvas-field')).toHaveCount(8);
    // Where the chip said: under Notes, above Photos.
    const [made, above, below] = [(await editing(page).card.boundingBox())!, (await (await cardOf(page, 'Notes')).boundingBox())!, (await (await cardOf(page, 'Photos')).boundingBox())!];
    expect(made.y).toBeGreaterThanOrEqual(above.y + above.height - 2);
    expect(made.y + made.height).toBeLessThanOrEqual(below.y + 2);
    expect(problems).toEqual([]);
  });

  test('the survey designer: from the sheet beside the question picked, a question lands where it is let go', async ({ page }) => {
    const problems = watch(page);
    await page.setViewportSize({ width: 860, height: 800 });
    await page.goto('/designer/?start=survey');
    const card = (id: string) => page.locator(`.fd-q[data-node="${id}"]`);
    const ids = () =>
      page.evaluate(() => {
        type Node = { id: string; children?: Node[] };
        const built = (window as unknown as { fieldiaDesigner: { designer: { getPage(): { layout: Node } } } }).fieldiaDesigner.designer.getPage();
        return (built.layout.children?.find((step) => step.id === 'step-experience')?.children ?? []).map((n) => n.id);
      });
    expect(await ids()).toEqual(['q-rating', 'q-parts', 'q-liked', 'q-improve']);
    await card('q-rating').click();
    const plus = page.locator('.fd-q-rail').getByRole('button', { name: 'Open the toolbox' });
    await expect(plus).toBeVisible();
    await plus.click();
    const dropdown = sheetOf(page).locator('[data-tool="kind:dropdown"]');
    await expect(dropdown).toBeVisible();
    // Held over the top of the question picked, under the sheet a moment ago: the gap before it.
    await dragToward(page, centre((await dropdown.boundingBox())!), async () => {
      const at = (await card('q-rating').boundingBox())!;
      return { x: at.x + at.width / 2, y: at.y + 12 };
    }, { release: false });
    await expect(sheetOf(page)).toBeHidden();
    await expect(page.locator('.fd-drop-slot + .fd-q')).toHaveAttribute('data-node', 'q-rating');
    await page.mouse.up();
    await expect.poll(async () => (await ids()).length).toBe(5);
    const now = await ids();
    expect(now.slice(1)).toEqual(['q-rating', 'q-parts', 'q-liked', 'q-improve']);
    await expect(page.locator('.fd-q-selected')).toHaveAttribute('data-node', now[0]);
    await expect(page.locator('.fd-q-selected .fd-q-kind')).toContainText('Dropdown');
    expect(problems).toEqual([]);
  });
});
