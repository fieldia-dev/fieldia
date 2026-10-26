import { expect } from '../../fixtures';
import { FILES } from '../../files-support';
import type { DemoReplay } from '../hand';
import { node } from './support';

/** The fields demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Fold a section by its title, and open it again.',
      async run({ page, press, see }) {
        const files = node(page, 's-files');
        const title = files.getByRole('button', { name: 'Files', exact: true });
        await see(title).toHaveAttribute('aria-expanded', 'true');
        await see(files.getByText('Signed contract', { exact: true })).toBeVisible();
        await press(title);
        await see(title).toHaveAttribute('aria-expanded', 'false');
        await see(files.getByText('Signed contract', { exact: true })).toBeHidden();
        await press(title);
        await see(title).toHaveAttribute('aria-expanded', 'true');
        await see(files.getByText('Signed contract', { exact: true })).toBeVisible();
      },
    },
    {
      says: 'Type a number into Budget: it stays plain as you type and is grouped once you leave it',
      async run({ page, press, type, see }) {
        const budget = node(page, 'f-budget');
        const amount = budget.getByRole('textbox', { name: 'Budget' });
        await type(amount, '2500000', { clear: true });
        // Plain while typed in: no marks for a digit typed mid-number to land among.
        await see(amount).toBeFocused();
        await see(amount).toHaveValue('2500000');
        // Left for the currency beside it: grouped, with the money's places.
        const currency = budget.getByRole('combobox', { name: 'Currency' });
        await type(currency, 'jo', { clear: true });
        await see(amount).toHaveValue('2,500,000.00');
        await press(budget.getByRole('option', { name: 'JOD' }));
        await see(currency).toHaveValue('JOD');
        await see(page.getByLabel('Deposit paid')).toHaveText('370,000.00 JOD');
      },
    },
    {
      says: 'Press the flag beside Site phone and type a country',
      async run({ page, press, type, see }) {
        const flag = page.getByRole('button', { name: 'Country of Site phone' });
        await press(flag);
        const search = page.getByRole('combobox', { name: 'Search countries' });
        await see(search).toBeFocused();
        const first = page.getByRole('listbox', { name: 'Countries' }).getByRole('option').first();
        await page.keyboard.type('jordan', { delay: 15 });
        await see(first).toContainText('Jordan');
        await type(search, 'sa', { clear: true });
        await see(first).toContainText('Saudi Arabia');
        await type(search, '+971', { clear: true });
        await see(first).toContainText('United Arab Emirates');
        await press(first);
        await see(flag).toContainText('+971');
      },
    },
    {
      says: 'Open the calendar of the start date: it shows the weeks’ numbers.',
      async run({ page, press, see }) {
        const start = node(page, 'f-start');
        await press(start.getByRole('button', { name: 'Choose a date' }));
        const calendar = page.getByRole('dialog', { name: 'October 2026' });
        await see(calendar).toBeVisible();
        await see(calendar.locator('tbody th')).toHaveText(['40', '41', '42', '43', '44']);
        await press(calendar.getByRole('button', { name: /11 October 2026/ }));
        await see(calendar).toBeHidden();
        await see(start.getByRole('textbox', { name: 'Start date' })).toHaveValue('11 Oct 2026');
      },
    },
    {
      says: 'Add tags to a field of tags, and a new one by its name.',
      async run({ page, press, type, see }) {
        const tags = node(page, 'f-tags');
        const box = tags.getByRole('combobox', { name: 'Tags' });
        await press(box);
        await press(tags.getByRole('option', { name: 'Wholesale' }));
        await see(tags.locator('.fd-chip-label')).toHaveText(['VIP', 'Wholesale']);
        await type(box, 'Rush order');
        await press(tags.getByRole('option', { name: 'Create “Rush order”' }));
        await see(tags.locator('.fd-chip-label')).toHaveText(['VIP', 'Wholesale', 'Rush order']);
      },
    },
    {
      says: 'Format text in the rich text box with its toolbar.',
      async run({ page, press, see }) {
        const brief = node(page, 'f-brief');
        const text = brief.getByRole('textbox', { name: 'Design brief' });
        await press(text.getByText('Oak and white'));
        await press(brief.getByRole('button', { name: 'Bold' }));
        await see(brief.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
        await page.keyboard.type(' Lots of light', { delay: 15 });
        // Typed in bold: the words drawn heavier than the rest of the line.
        const bold = text.locator('b, strong').filter({ hasText: 'Lots of light' });
        await see(bold).toBeVisible();
        await see(bold).toHaveCSS('font-weight', '700');
      },
    },
    {
      says: 'Add files to Documents: each shows as a card, its name under its picture.',
      async run({ page, press, pick, see }) {
        const documents = node(page, 'f-documents');
        // The tile that says so, the last of the cards: a press opens the browser's file dialog.
        await pick(documents.locator('.fd-file-pick').getByText('Add files', { exact: true }), [FILES.photo(), FILES.quote()]);
        await see(documents.locator('.fd-file-item')).toHaveCount(6);
        await see(documents.locator('.fd-file')).toHaveClass(/fd-files-cards/);
        await see(documents.getByRole('button', { name: /^Lobby, north side\.png/ })).toBeVisible();
        // The name under the picture.
        const card = documents.locator('.fd-file-item').filter({ hasText: 'Lobby, north side.png' });
        const [picture, name] = [await card.locator('.fd-file-thumb').boundingBox(), await card.locator('.fd-file-name').boundingBox()];
        expect(name!.y).toBeGreaterThanOrEqual(picture!.y + picture!.height - 1);
        const views = documents.getByRole('group', { name: 'Show files as' });
        await press(views.getByRole('button', { name: 'List' }));
        await see(views.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
        await see(documents.locator('.fd-file')).toHaveClass(/fd-files-list/);
        await see(documents.locator('.fd-file-item')).toHaveCount(6);
      },
    },
  ],
};
