import { expect, test } from '@playwright/test';
import { screen } from './support';

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
    await page.locator('.fd-q').first().getByLabel('Required').check();

    // A multiple choice with two options.
    await step1.getByRole('button', { name: 'Add question' }).click();
    await page.keyboard.type('Will you come back?');
    const second = page.locator('.fd-q').nth(1);
    await second.getByLabel('Kind of question').selectOption({ label: 'Multiple choice' });
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
    await page.locator('.fd-q').nth(2).getByLabel('Kind of question').selectOption({ label: 'Paragraph' });
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
    await expect(page.locator('.fd-q').nth(2).getByLabel('Kind of question')).toHaveValue('short-answer');
    await page.keyboard.press(`${mod}+Shift+z`);
    await expect(page.locator('.fd-q').nth(2).getByLabel('Kind of question')).toHaveValue('paragraph');

    // Publish, change, publish again.
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.locator('.fd-designer-status')).toHaveText('Published · version 1');
    await expect(page.getByRole('button', { name: 'Publish' })).toBeHidden();
    await page.locator('.fd-q-label').first().fill('Your full name');
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

  test('refuses to delete a question a later page depends on, and says why', async ({ page }) => {
    const step1 = page.locator('.fd-design-step').nth(0);
    await step1.getByRole('button', { name: 'Add question' }).click();
    await page.keyboard.type('Coming?');
    await page.locator('.fd-q').first().getByLabel('Kind of question').selectOption({ label: 'Yes or no' });
    await page.getByRole('button', { name: 'Add page' }).click();
    await page.locator('.fd-design-step').nth(1).getByLabel('Show this page').selectOption({ label: 'Coming?' });
    await page.locator('.fd-q').first().getByRole('button', { name: 'Delete' }).click();
    await expect(page.locator('.fd-designer-issues')).toContainText('which is not a field of this page');
    await expect(page.locator('.fd-q')).toHaveCount(1);
  });
});
