import { expect, test, type Locator, type Page } from '@playwright/test';
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

    // The preview walks the branch.
    const preview = page.locator('.fd-designer-preview');
    // The preview of the last change, not the one before it.
    await expect(preview.locator('.fd-designer-preview-host')).not.toHaveAttribute('aria-busy', 'true');
    await expect(preview.locator('.fd-progress-text')).toHaveText('Step 1 of 1');
    await preview.getByLabel('Your name').fill('Sara');
    await preview.getByLabel('No').check();
    await expect(preview.locator('.fd-progress-text')).toHaveText('Step 1 of 2');
    await preview.getByRole('button', { name: 'Next' }).click();
    await expect(preview.getByText('What would change your mind?')).toBeVisible();
    await screen(page, 'designer-preview-branch');

    // Undo and redo from the keyboard, outside any text box.
    await page.locator('.fd-designer-status').click();
    const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${mod}+z`);
    await expect(page.locator('.fd-q').nth(2).locator('.fd-q-kind')).toHaveAttribute('aria-label', 'Kind of question: Short answer');
    await page.keyboard.press(`${mod}+Shift+z`);
    await expect(page.locator('.fd-q').nth(2).locator('.fd-q-kind')).toHaveAttribute('aria-label', 'Kind of question: Paragraph');

    // Publish, change, publish again.
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.locator('.fd-designer-status')).toHaveText('Published · version 1');
    await expect(page.getByRole('button', { name: 'Publish' })).toBeHidden();
    await page.locator('.fd-q').first().locator('.fd-q-text').click();
    await expect(picked(page).locator('.fd-q-label')).toBeFocused();
    await picked(page).locator('.fd-q-label').fill('Your full name');
    await expect(page.locator('.fd-designer-status')).toHaveText('Changes not published yet');
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.locator('.fd-designer-status')).toHaveText('Published · version 2');

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
    await expect(card(0).getByRole('button', { name: 'Show only when…' })).toBeHidden();
    await card(2).click();
    await card(2).getByRole('button', { name: 'Show only when…' }).click();
    await card(2).getByLabel('When the answer is').selectOption({ label: 'is No' });
    await card(2).getByRole('button', { name: 'Add a condition' }).click();
    await card(2).getByLabel('Condition 2', { exact: true }).selectOption({ label: 'Role' });
    await card(2).getByLabel('Answer 2', { exact: true }).selectOption({ label: 'is not Manager' });
    await expect(card(2).getByLabel('Match')).toHaveValue('all');
    await screen(page, 'designer-question-condition', { viewport: true });

    const preview = page.locator('.fd-designer-preview');
    const why = preview.getByText('Why not?');
    await expect(preview.locator('.fd-designer-preview-host')).not.toHaveAttribute('aria-busy', 'true');
    await preview.getByLabel('Role').selectOption({ label: 'Manager' });
    await expect(why).toBeHidden();
    await preview.getByLabel('Role').selectOption({ label: 'Developer' });
    await expect(why).toBeVisible();
    await preview.getByLabel('Coming?').check();
    await expect(why).toBeHidden();

    // Any of them: a developer who is coming is asked too.
    await card(2).getByLabel('Match').selectOption({ label: 'any of these' });
    await expect(preview.locator('.fd-designer-preview-host')).not.toHaveAttribute('aria-busy', 'true');
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
    await expect(page.locator('.fd-drop-marker')).toBeVisible();
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
    // Email, carried by its words into the empty second page.
    const from = (await page.locator('.fd-q').nth(2).locator('.fd-q-text').boundingBox())!;
    const empty = (await page.locator('.fd-design-step').nth(1).locator('.fd-step-cards').boundingBox())!;
    await page.mouse.move(from.x + 10, from.y + 5);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) await page.mouse.move(from.x + 10, from.y + 5 + ((empty.y + 8 - from.y - 5) * i) / 12, { steps: 3 });
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
