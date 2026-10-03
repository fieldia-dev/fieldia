import { expect, test, type Locator, type Page } from '@playwright/test';
import { publish } from './designer-support';
import { screen } from './support';

/** The question picked, open to edit. */
const picked = (page: Page) => page.locator('.fd-q-selected');
/** Switch a question's kind from the menu on it. */
async function kind(card: Locator, name: string) {
  await card.locator('.fd-q-kind').click();
  await card.page().getByRole('menuitemradio', { name, exact: true }).click();
}

/** Build a survey the way a person would: clicks and typing, then publish and reopen. */
test.describe('survey designer', () => {
  test.beforeEach(async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('console', (message) => message.type() === 'error' && problems.push(message.text()));
    await page.goto('/designer/');
    await expect(page.locator('.fd-designer')).toBeVisible();
    (page as unknown as { problems: string[] }).problems = problems;
  });
  test.afterEach(async ({ page }) => {
    expect((page as unknown as { problems: string[] }).problems).toEqual([]);
  });

  test('builds a branching survey, previews it, undoes, publishes and reopens', async ({ page }) => {
    await expect(page.locator('.fd-designer-status')).toHaveText('Draft, not published yet');
    const step1 = page.locator('.fd-design-step').nth(0);

    // A required name question.
    await step1.getByRole('button', { name: 'Add question' }).click();
    await expect(page.locator('.fd-q-label').first()).toBeFocused();
    await page.keyboard.type('Your name');
    await picked(page).getByRole('switch', { name: 'Required' }).click();
    await expect(picked(page).getByRole('switch', { name: 'Required' })).toHaveAttribute('aria-checked', 'true');

    // A multiple choice with two options: the first question closes, as people will see it.
    await step1.getByRole('button', { name: 'Add question' }).click();
    await page.keyboard.type('Will you come back?');
    await expect(page.locator('.fd-q').first().locator('.fd-q-text')).toHaveText('Your name');
    const second = picked(page);
    await kind(second, 'Multiple choice');
    await second.getByLabel('Option 1', { exact: true }).fill('Yes');
    await second.getByRole('button', { name: 'Add option' }).click();
    await second.getByLabel('Option 2', { exact: true }).fill('No');

    // A second page shown only to people who answer No.
    await page.getByRole('button', { name: 'Add page' }).click();
    const step2 = page.locator('.fd-design-step').nth(1);
    await step2.getByLabel('Show this page').selectOption({ label: 'Will you come back?' });
    await step2.getByLabel('When the answer is').selectOption({ label: 'is No' });
    await step2.getByRole('button', { name: 'Add question' }).click();
    await page.keyboard.type('What would change your mind?');
    await kind(picked(page), 'Paragraph');
    await screen(page, 'designer-built');

    // Try it walks the branch.
    await page.getByRole('button', { name: 'Try it' }).click();
    const preview = page.locator('.fd-try');
    await expect(page.locator('.fd-survey-body')).toBeHidden();
    await expect(preview.locator('.fd-progress-text')).toHaveText('Step 1 of 1');
    await preview.getByLabel('Your name').fill('Sara');
    await preview.getByLabel('No').check();
    await expect(preview.locator('.fd-progress-text')).toHaveText('Step 1 of 2');
    await preview.getByRole('button', { name: 'Next' }).click();
    await expect(preview.getByText('What would change your mind?')).toBeVisible();
    await screen(page, 'designer-try-branch');
    await page.getByRole('button', { name: 'Design', exact: true }).click();

    // Undo and redo from the keyboard, outside any text box.
    await page.locator('.fd-designer-status').click();
    const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${mod}+z`);
    await expect(page.locator('.fd-q').nth(2).locator('.fd-q-kind')).toHaveAttribute('aria-label', 'Kind of question: Short answer');
    await page.keyboard.press(`${mod}+Shift+z`);
    await expect(page.locator('.fd-q').nth(2).locator('.fd-q-kind')).toHaveAttribute('aria-label', 'Kind of question: Paragraph');

    // Publish, change, publish again.
    await publish(page, 1);
    await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeHidden();
    await page.locator('.fd-q').first().locator('.fd-q-text').click();
    await expect(picked(page).locator('.fd-q-label')).toBeFocused();
    await picked(page).locator('.fd-q-label').fill('Your full name');
    await expect(page.locator('.fd-designer-status')).toHaveText('Changes not published yet');
    await publish(page, 2);

    // Reopen from the store: the same form comes back.
    const reopened = await page.evaluate(async () => {
      const { store, designer } = (window as any).fieldiaDesigner;
      const saved = await store.load(designer.getPage().id);
      return { versions: saved.versions.length, firstLabel: Object.values(saved.versions[1].page.fields).map((f: any) => f.label)[0] };
    });
    expect(reopened).toEqual({ versions: 2, firstLabel: 'Your full name' });
    await screen(page, 'designer-published');
  });

  test('shows a question only for some answers, all or any of them, live in the preview', async ({ page }) => {
    const step = page.locator('.fd-design-step').first();
    const card = (n: number) => page.locator('.fd-q').nth(n);
    await step.getByRole('button', { name: 'Add question' }).click();
    await page.keyboard.type('Coming?');
    await kind(card(0), 'Yes or no');
    await step.getByRole('button', { name: 'Add question' }).click();
    await page.keyboard.type('Role');
    await kind(card(1), 'Dropdown');
    await card(1).getByLabel('Option 1', { exact: true }).fill('Developer');
    await card(1).getByRole('button', { name: 'Add option' }).click();
    await card(1).getByLabel('Option 2', { exact: true }).fill('Manager');
    await step.getByRole('button', { name: 'Add question' }).click();
    await page.keyboard.type('Why not?');

    // The first question, opened, has nothing before it to depend on.
    await card(0).click();
    await expect(card(0)).toHaveClass(/fd-q-selected/);
    // The rest of a question is under ⋮, as in Google Forms.
    await card(0).getByRole('button', { name: 'More options' }).click();
    await expect(page.getByRole('menuitem', { name: 'Move down' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Show only when…' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await card(2).click();
    await card(2).getByRole('button', { name: 'More options' }).click();
    await page.getByRole('menuitem', { name: 'Show only when…' }).click();
    await card(2).getByLabel('When the answer is').selectOption({ label: 'is No' });
    await card(2).getByRole('button', { name: 'Add a condition' }).click();
    await card(2).getByLabel('Condition 2', { exact: true }).selectOption({ label: 'Role' });
    await card(2).getByLabel('Answer 2', { exact: true }).selectOption({ label: 'is not Manager' });
    await expect(card(2).getByLabel('Match')).toHaveValue('all');
    await screen(page, 'designer-question-condition', { viewport: true });

    await page.getByRole('button', { name: 'Try it' }).click();
    const preview = page.locator('.fd-try');
    const why = preview.getByText('Why not?');
    await preview.getByLabel('Role').selectOption({ label: 'Manager' });
    await expect(why).toBeHidden();
    await preview.getByLabel('Role').selectOption({ label: 'Developer' });
    await expect(why).toBeVisible();
    await preview.getByLabel('Coming?').check();
    await expect(why).toBeHidden();

    // Any of them: a developer who is coming is asked too.
    await page.getByRole('button', { name: 'Design', exact: true }).click();
    await card(2).getByLabel('Match').selectOption({ label: 'any of these' });
    await page.getByRole('button', { name: 'Try it' }).click();
    await preview.getByLabel('Coming?').check();
    await preview.getByLabel('Role').selectOption({ label: 'Developer' });
    await expect(preview.getByText('Why not?')).toBeVisible();
  });

  test('drags a question from the toolbox onto a page, and a question from one page to another', async ({ page }) => {
    const step1 = page.locator('.fd-design-step').nth(0);
    await step1.getByRole('button', { name: 'Add question' }).click();
    await page.keyboard.type('Your name');
    await step1.getByRole('button', { name: 'Add question' }).click();
    await page.keyboard.type('Email');
    await page.getByRole('button', { name: 'Add page' }).click();
    // A rating, dragged from the toolbox between the two questions.
    const rating = (await page.locator('.fd-toolbox [data-tool="kind:rating"]').boundingBox())!;
    const email = (await page.locator('.fd-q').nth(1).boundingBox())!;
    await page.mouse.move(rating.x + rating.width / 2, rating.y + 20);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) await page.mouse.move(rating.x + ((email.x + 100 - rating.x) * i) / 12, rating.y + ((email.y + 12 - rating.y) * i) / 12, { steps: 3 });
    await expect(page.locator('.fd-drop-slot')).toBeVisible();
    await screen(page, 'designer-drag-tile', { viewport: true });
    await page.mouse.up();
    await expect(picked(page).locator('.fd-q-label')).toBeFocused();
    await page.keyboard.type('How was it?');
    const labels = () =>
      page.evaluate(() => {
        const built = (window as any).fieldiaDesigner.designer.getPage();
        return built.layout.children.map((s: any) => s.children.map((n: any) => built.fields[n.field].label));
      });
    expect(await labels()).toEqual([['Your name', 'How was it?', 'Email'], []]);
    // Email, carried by its words into the empty second page — below the fold: held at the window's edge, the page scrolls to it.
    await page.locator('.fd-q').nth(2).scrollIntoViewIfNeeded();
    const from = (await page.locator('.fd-q').nth(2).locator('.fd-q-text').boundingBox())!;
    const cards = page.locator('.fd-design-step').nth(1).locator('.fd-step-cards');
    const height = page.viewportSize()!.height;
    await page.mouse.move(from.x + 10, from.y + 5);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(from.x + 10, from.y + 5 + ((height - 12 - from.y - 5) * i) / 8, { steps: 3 });
    await expect.poll(async () => { const box = await cards.boundingBox(); return !!box && box.y + 8 < height - 60; }, { timeout: 5000 }).toBe(true);
    // Away from the edge, the page stops scrolling; then onto page 2 where it is now, until the gap is there.
    await page.mouse.move(from.x + 10, height / 2, { steps: 4 });
    for (let look = 0; look < 4; look++) {
      const empty = (await cards.boundingBox())!;
      await page.mouse.move(from.x + 10, empty.y + 8, { steps: 4 });
      await page.waitForTimeout(80);
    }
    await expect(page.locator('.fd-design-step').nth(1).locator('.fd-drop-slot')).toHaveCount(1);
    await page.mouse.up();
    await expect.poll(labels).toEqual([['Your name', 'How was it?'], ['Email']]);
  });

  test('refuses to delete a question a later page depends on, and says why', async ({ page }) => {
    const step1 = page.locator('.fd-design-step').nth(0);
    await step1.getByRole('button', { name: 'Add question' }).click();
    await page.keyboard.type('Coming?');
    await kind(picked(page), 'Yes or no');
    await page.getByRole('button', { name: 'Add page' }).click();
    await page.locator('.fd-design-step').nth(1).getByLabel('Show this page').selectOption({ label: 'Coming?' });
    await page.locator('.fd-q').first().click();
    await picked(page).getByRole('button', { name: 'Delete' }).click();
    await expect(page.locator('.fd-designer-issues')).toContainText('which is not a field of this page');
    await expect(page.locator('.fd-q')).toHaveCount(1);
  });
});

/** The cards, as Google Forms draws and moves them: measured in the browser, not read from the stylesheet. */
test.describe('survey designer · the Google Forms way', () => {
  test('quiet cards, the one picked lifted with its bar, its line growing from the middle, the tools level with it', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    await page.goto('/designer/?start=survey');
    const cards = page.locator('.fd-q');
    await expect(cards.first()).toBeVisible();

    // The heading card: a 10px band of the accent over it.
    const band = await page.locator('.fd-survey-head').evaluate((head) => getComputedStyle(head, '::before').height);
    expect(band).toBe('10px');
    // Not picked, a card is flat: no shadow.
    expect(await cards.nth(1).evaluate((card) => getComputedStyle(card).boxShadow)).toBe('none');

    await cards.nth(1).click();
    const open = picked(page);
    await expect(open).toBeVisible();
    expect(await open.evaluate((card) => getComputedStyle(card).boxShadow)).not.toBe('none');
    expect(await open.evaluate((card) => getComputedStyle(card, '::before').width)).toBe('6px');

    // The tools slide to the card picked and stop level with its top.
    const rail = page.locator('.fd-q-rail');
    await expect.poll(async () => Math.abs((await rail.boundingBox())!.y - (await open.boundingBox())!.y), { timeout: 2000 }).toBeLessThanOrEqual(1);
    await screen(page, 'designer-forms-open', { viewport: true });

    // The line under its words grows from the middle once they are typed in.
    const line = open.locator('.fd-q-label-box');
    const scale = () => line.evaluate((box) => new DOMMatrix(getComputedStyle(box, '::after').transform).a);
    expect(await scale()).toBe(0);
    await open.locator('.fd-q-label').click();
    await expect.poll(scale, { timeout: 2000 }).toBe(1);

    // A card further down: the tools follow it there.
    const far = cards.nth(4);
    await far.scrollIntoViewIfNeeded();
    await far.click();
    await expect.poll(async () => Math.abs((await rail.boundingBox())!.y - (await picked(page).boundingBox())!.y), { timeout: 2000 }).toBeLessThanOrEqual(1);
    // A question added from them lands after the card, and takes the cursor.
    const before = await cards.count();
    await rail.getByRole('button', { name: 'Add a question after this one' }).click();
    await expect(cards).toHaveCount(before + 1);
    await expect(picked(page).locator('.fd-q-label')).toBeFocused();
    await page.keyboard.type('Anything else?');
    await expect(picked(page).locator('.fd-q-label')).toHaveValue('Anything else?');
    await screen(page, 'designer-forms-added', { viewport: true });
    expect(problems).toEqual([]);
  });
});

/** Checks before publishing, Publish asking first, and earlier versions one click away. */
test.describe('survey designer · checks and versions', () => {
  test('a check with its fix, Publish listing what changed, and an earlier version made the draft again', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    await page.goto('/designer/?start=survey');
    await expect(page.locator('.fd-q').first()).toBeVisible();
    const checks = page.locator('.fd-designer-bar [data-checks]');
    await expect(checks).toHaveAttribute('aria-label', 'Checks: all clear');

    // An empty page: one thing to look at, and its fix.
    await page.getByRole('button', { name: 'Add page', exact: true }).click();
    await expect(checks).toHaveAttribute('aria-label', 'Checks: 1 to look at');
    await checks.click();
    const list = page.getByRole('dialog', { name: 'Checks before publishing' });
    await expect(list.locator('.fd-check-text')).toHaveText(['“Page 6” has no questions: people would see an empty page.']);
    await screen(page, 'designer-checks', { viewport: true });
    await list.getByRole('button', { name: 'Delete the page' }).click();
    await expect(checks).toHaveAttribute('aria-label', 'Checks: all clear');

    // The first version says what goes out.
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    const ask = page.getByRole('dialog', { name: 'Publish version 1?' });
    await expect(ask.locator('.fd-publish-changes li')).toHaveText([/^The first version: \d+ questions on 5 pages$/]);
    await expect(ask.getByRole('button', { name: 'Publish version 1' })).toBeFocused();
    await screen(page, 'designer-publish-first', { viewport: true });
    await ask.getByRole('button', { name: 'Publish version 1' }).click();
    await expect(page.locator('.fd-designer-status')).toHaveText('Published · version 1');

    // A change, then Publish lists it.
    await page.locator('.fd-q').first().locator('.fd-q-text').click();
    await picked(page).locator('.fd-q-label').fill('Your full name');
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    const again = page.getByRole('dialog', { name: 'Publish version 2?' });
    await expect(again.locator('.fd-publish-changes li')).toHaveText(['Renamed “Your name” to “Your full name”']);
    await screen(page, 'designer-publish-changes', { viewport: true });
    await again.getByRole('button', { name: 'Publish version 2' }).click();
    await expect(page.locator('.fd-designer-status')).toHaveText('Published · version 2');

    // Version 1, one click away: the draft again, and Undo brings version 2 back.
    await page.locator('.fd-designer-status').click();
    await expect(page.getByRole('menuitem')).toHaveCount(2);
    await screen(page, 'designer-versions', { viewport: true });
    await page.getByRole('menuitem', { name: /^Version 1/ }).click();
    // Still picked, its words in its box.
    await expect(picked(page).locator('.fd-q-label')).toHaveValue('Your name');
    await expect(page.locator('.fd-designer-status')).toHaveText('Changes not published yet');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.locator('.fd-designer-status')).toHaveText('Published · version 2');
    expect(problems).toEqual([]);
  });
});

/** Find anything, from the keyboard. */
test.describe('survey designer · find anything', () => {
  test('⌘K, a few letters, Enter: a question added where the cursor was, or the editor at another', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    await page.goto('/designer/?start=survey');
    await page.locator('.fd-q').first().click();
    await page.keyboard.press('Escape');
    await page.keyboard.press('ControlOrMeta+k');
    const box = page.getByRole('combobox', { name: 'Find anything' });
    await expect(box).toBeFocused();
    await page.keyboard.type('scale');
    await expect(page.getByRole('dialog', { name: 'Find anything' }).getByRole('option')).toHaveText([/^Add a question: Linear scale/]);
    await screen(page, 'designer-find', { viewport: true });
    await page.keyboard.press('Enter');
    await expect(box).toHaveCount(0);
    await expect(picked(page).locator('.fd-q-kind')).toHaveAttribute('aria-label', 'Kind of question: Linear scale');
    await expect(picked(page).locator('.fd-q-label')).toBeFocused();
    await page.keyboard.type('How likely are you to come back?');
    await page.keyboard.press('Escape');

    // / when not typing; the words of a question further down.
    await page.keyboard.press('/');
    await page.keyboard.type('go improve');
    await page.keyboard.press('Enter');
    await expect(picked(page).locator('.fd-q-label')).toHaveValue('What should we improve?');
    await expect(picked(page).locator('.fd-q-label')).toBeFocused();
    expect(problems).toEqual([]);
  });
});

test.describe('survey designer · where answers lead', () => {
  test('the pages on one line, those for some answers off it, a page picked from the map', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    await page.goto('/designer/?start=survey');
    const map = page.locator('.fd-branch-map');
    await expect(map.locator('.fd-branch-title')).toHaveText(['About you', 'Using the product', 'Your experience', 'Why not', 'Last thing']);
    await expect(map.locator('.fd-branch-when')).toHaveText(['Yes', 'No']);
    // Drawn inside its card, not past it.
    const card = (await map.boundingBox())!;
    const drawing = (await map.locator('svg').boundingBox())!;
    expect(drawing.x + drawing.width).toBeLessThanOrEqual(card.x + card.width);
    await map.locator('[data-pick]').filter({ hasText: 'Why not' }).click();
    await expect(page.locator('.fd-design-step.fd-step-selected .fd-step-title')).toHaveValue('Why not');
    await expect(map.locator('.fd-branch-page.fd-picked .fd-branch-title')).toHaveText('Why not');
    await screen(page, 'designer-branch-map', { viewport: true });
    // It folds away when not wanted.
    await map.locator('summary').click();
    await expect(map.locator('svg')).toBeHidden();
    expect(problems).toEqual([]);
  });
});

test.describe('survey designer · putting a question down', () => {
  test('a click on the page around the cards closes the open one', async ({ page }) => {
    await page.goto('/designer/?start=survey');
    await page.locator('.fd-q').nth(1).click();
    await expect(picked(page)).toHaveCount(1);
    const column = (await page.locator('.fd-survey-column').boundingBox())!;
    // In the tinted room to the left of the cards.
    await page.mouse.click(column.x - 30, column.y + 400);
    await expect(picked(page)).toHaveCount(0);
    await screen(page, 'designer-put-down', { viewport: true });
  });
});

test.describe('survey designer · “Other”', () => {
  test('added from beside “Add option”, shown as people will see it, and answered in words of one’s own', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    await page.goto('/designer/');
    await page.locator('.fd-toolbox [data-tool="kind:multiple-choice"]').click();
    await page.keyboard.type('How did you hear of us?');
    const card = picked(page);
    await card.getByLabel('Option 1', { exact: true }).fill('A friend');
    await card.getByRole('button', { name: 'Add option' }).click();
    await card.getByLabel('Option 2', { exact: true }).fill('An advert');
    // Pointed at, “Add option” draws no box: only words.
    await card.getByRole('button', { name: 'Add option' }).hover();
    const ghost = await card.getByRole('button', { name: 'Add option' }).evaluate((b) => { const s = getComputedStyle(b); return [s.borderTopWidth, s.outlineStyle, s.boxShadow]; });
    expect(ghost).toEqual(['0px', 'none', 'none']);
    await card.getByRole('button', { name: 'add “Other”' }).click();
    await expect(card.locator('.fd-q-option-other')).toContainText('Other…');
    await expect(card.getByRole('button', { name: 'add “Other”' })).toBeHidden();
    await screen(page, 'designer-other-open', { viewport: true });
    // Closed: “Other:” with its box, as people will see it.
    await page.keyboard.press('Escape');
    await expect(page.locator('.fd-q').first().locator('.fd-choice-other')).toContainText('Other:');
    await screen(page, 'designer-other-closed', { viewport: true });

    // Tried: typing in its box picks “Other”; picking “Other” puts the cursor there.
    await page.getByRole('button', { name: 'Try it' }).click();
    const tried = page.locator('.fd-try');
    const own = tried.getByRole('textbox', { name: 'Your own answer' });
    await own.fill('A podcast');
    await expect(tried.getByRole('radio', { name: 'Other:' })).toBeChecked();
    await tried.getByRole('radio', { name: 'A friend' }).check();
    await expect(tried.getByRole('radio', { name: 'Other:' })).not.toBeChecked();
    await expect(own).toHaveValue('A podcast');
    await tried.getByRole('radio', { name: 'Other:' }).check();
    await expect(own).toBeFocused();
    await screen(page, 'designer-other-tried', { viewport: true });
    expect(problems).toEqual([]);
  });
});
