import { expect, test, type Page } from '@playwright/test';
import { doubleLines, watch } from './designer-support';
import { expectNoSidewaysScroll, screen } from './support';

/**
 * Translating a form as a person does: the Translations view beside Design
 * and Try it, Arabic added and typed in right to left, only the words left
 * to translate, a translator's CSV pasted back, a word no longer on the
 * form let go, and the form tried in Arabic.
 */

const view = (page: Page) => page.locator('.fd-words');
const cell = (page: Page, word: string, language = 'Arabic') => page.getByRole('textbox', { name: `${language} for “${word}”`, exact: true });
const rowWords = (page: Page) => view(page).locator('.fd-words-grid tbody tr:not([hidden]) th');

async function openTranslations(page: Page, path = '/designer/?start=survey') {
  const problems = watch(page);
  await page.goto(path);
  await expect(page.locator('.fd-designer')).toBeVisible();
  await page.getByRole('button', { name: 'Translations', exact: true }).click();
  await expect(view(page)).toBeVisible();
  return problems;
}

async function addLanguage(page: Page, name: string) {
  await page.getByRole('combobox', { name: 'Add a language' }).fill(name);
  await page.getByRole('combobox', { name: 'Add a language' }).press('Enter');
}

test('translates a survey into Arabic: typed right to left, filtered, pasted as CSV, a gone word let go', async ({ page }) => {
  const problems = await openTranslations(page);
  await expect(page.locator('.fd-survey-body')).toBeHidden();
  await expect(rowWords(page).first()).toHaveText('Product feedback');
  await expect(view(page).locator('.fd-words-note')).toHaveText(/^\d+ words, written in English\. Add a language to translate them into it\.$/);
  await screen(page, 'translations-empty', { viewport: true });

  // Arabic, by its name: a column whose cells run right to left.
  await addLanguage(page, 'Arabic');
  await expect(view(page).locator('.fd-words-grid thead th').nth(1)).toContainText('Arabic');
  await expect(cell(page, 'Product feedback')).toBeFocused();
  await page.keyboard.type('رأيك في المنتج');
  await page.keyboard.press('Enter');
  await expect(cell(page, 'Five minutes, and it shapes what we build next.')).toBeFocused();
  await page.keyboard.type('خمس دقائق، وتشكّل ما نبنيه بعد ذلك.');
  await cell(page, 'Your name').fill('اسمك');
  await cell(page, 'Email').fill('البريد الإلكتروني');
  const looks = await cell(page, 'Your name').evaluate((box) => ({ dir: box.getAttribute('dir'), direction: getComputedStyle(box).direction, align: getComputedStyle(box).textAlign }));
  expect(looks).toEqual({ dir: 'rtl', direction: 'rtl', align: 'start' });
  await expect(view(page).locator('.fd-words-grid thead th').nth(1)).toHaveAttribute('aria-label', /^Arabic, 4 of \d+ translated$/);
  await screen(page, 'translations-arabic', { viewport: true });

  // Only what is left to translate: the rows filled step aside.
  await page.getByRole('switch', { name: 'Only words not translated' }).click();
  await expect(rowWords(page).filter({ hasText: /^Your name$/ })).toHaveCount(0);
  await expect(rowWords(page).first()).toHaveText('About you');
  await screen(page, 'translations-only-missing', { viewport: true });
  await page.getByRole('switch', { name: 'Only words not translated' }).click();
  await expect(rowWords(page).filter({ hasText: /^Your name$/ })).toHaveCount(1);

  // A translator's CSV, pasted back: a comma inside quotes, a word the form no longer has.
  await page.getByRole('button', { name: 'Paste CSV' }).click();
  await page.getByLabel(/^Paste a CSV/).fill(['en,ar', 'About you,عنك', '"Thanks for taking part. Every answer is read by the product team.","شكرًا لمشاركتك، يقرأ فريق المنتج كل إجابة."', 'Gone question,سؤال قديم', 'Send my answers,أرسل إجاباتي'].join('\n'));
  await screen(page, 'translations-paste', { viewport: true });
  await page.getByRole('button', { name: 'Fill the translations' }).click();
  await expect(view(page).locator('.fd-words-status')).toHaveText('Filled 3 translations. 1 word no longer on the page was left out.');
  await expect(cell(page, 'About you')).toHaveValue('عنك');
  await expect(cell(page, 'Send my answers')).toHaveValue('أرسل إجاباتي');

  // A question renamed: its old words' translation is no longer on the form, and goes.
  await page.getByRole('button', { name: 'Design', exact: true }).click();
  await expect(page.locator('.fd-survey-body')).toBeVisible();
  await page.locator('.fd-q').filter({ hasText: 'Email' }).first().locator('.fd-q-text').click();
  await page.locator('.fd-q-selected .fd-q-label').fill('Work email');
  await page.getByRole('button', { name: 'Translations', exact: true }).click();
  const gone = view(page).locator('.fd-words-stale');
  await expect(gone.getByRole('heading', { name: 'No longer on the page' })).toBeVisible();
  await expect(gone.locator('tbody th')).toHaveText(['Email']);
  await expect(cell(page, 'Work email')).toHaveValue('');
  await gone.scrollIntoViewIfNeeded();
  await screen(page, 'translations-stale', { viewport: true });
  await gone.getByRole('button', { name: 'Remove the translations of “Email”' }).click();
  await expect(gone).toBeHidden();
  expect(await doubleLines(page)).toEqual([]);
  await expectNoSidewaysScroll(page);

  // Tried in Arabic: the form in its Arabic words, right to left.
  await page.getByRole('button', { name: 'Try it', exact: true }).click();
  await expect(view(page)).toBeHidden();
  const tried = page.locator('.fd-try-frame form.fd-form');
  await expect(tried).toHaveAttribute('dir', 'ltr');
  await page.getByRole('combobox', { name: 'Words in' }).selectOption({ label: 'Arabic' });
  await expect(tried).toHaveAttribute('dir', 'rtl');
  await expect(tried).toHaveAttribute('lang', 'ar');
  await expect(page.locator('.fd-try').getByRole('button', { name: 'العربية' })).toHaveAttribute('aria-pressed', 'true');
  await expect(tried.getByText('رأيك في المنتج')).toBeVisible();
  await expect(tried.getByText('شكرًا لمشاركتك، يقرأ فريق المنتج كل إجابة.')).toBeVisible();
  await expect(tried.locator('[data-node="q-name"] .fd-label')).toHaveText(/^اسمك/);
  // Right to left: the label starts at the right of the form.
  const formBox = (await tried.boundingBox())!;
  const labelBox = (await tried.locator('[data-node="q-name"] .fd-label').boundingBox())!;
  expect(formBox.x + formBox.width - (labelBox.x + labelBox.width)).toBeLessThan(40);
  await screen(page, 'translations-try-arabic', { viewport: true });
  // Back to the words as written.
  await page.getByRole('combobox', { name: 'Words in' }).selectOption({ label: 'English, as written' });
  await expect(tried).toHaveAttribute('dir', 'ltr');
  await expect(tried.getByText('Product feedback')).toBeVisible();
  expect(problems).toEqual([]);
});

test('asks in the page before a language with translations goes, and Undo brings it back', async ({ page }) => {
  const problems = await openTranslations(page);
  await addLanguage(page, 'es');
  await cell(page, 'Your name', 'Spanish').fill('Tu nombre');
  page.on('dialog', () => problems.push('a browser dialog opened'));
  await view(page).getByRole('button', { name: 'Remove Spanish' }).click();
  const ask = view(page).getByRole('group', { name: 'Remove a language' });
  await expect(ask).toContainText('Remove Spanish? Its 1 translation goes with it.');
  await expect(ask.getByRole('button', { name: 'Keep it' })).toBeFocused();
  await screen(page, 'translations-remove-ask', { viewport: true });
  await ask.getByRole('button', { name: 'Remove Spanish' }).click();
  await expect(view(page).locator('.fd-words-grid thead th')).toHaveCount(1);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(cell(page, 'Your name', 'Spanish')).toHaveValue('Tu nombre');
  expect(problems).toEqual([]);
});

test('on a phone, the grid scrolls inside its own box, never the page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const problems = await openTranslations(page, '/screen/');
  await addLanguage(page, 'Arabic');
  await addLanguage(page, 'French');
  await cell(page, 'Customer').fill('العميل');
  await cell(page, 'Customer', 'French').fill('Client');
  const box = view(page).locator('.fd-words-scroll').first();
  const sizes = await box.evaluate((b) => ({ scroll: b.scrollWidth, client: b.clientWidth }));
  expect(sizes.scroll).toBeGreaterThan(sizes.client);
  await expectNoSidewaysScroll(page);
  await box.evaluate((b) => (b.scrollLeft = b.scrollWidth));
  // The page's own words stay in sight as the languages scroll by.
  const first = await view(page).locator('.fd-words-grid tbody th').first().boundingBox();
  const scroller = await box.boundingBox();
  expect(Math.abs(first!.x - scroller!.x)).toBeLessThan(3);
  await screen(page, 'translations-phone', { viewport: true });
  expect(await doubleLines(page)).toEqual([]);
  expect(problems).toEqual([]);
});

test('the viewer demo still shows the rules page in Arabic, right to left', async ({ page }) => {
  await page.goto('/plain/?page=rules&locale=ar');
  const form = page.locator('.fd-form').first();
  await expect(form).toHaveAttribute('dir', 'rtl');
  await expect(page.getByText('طلب مستلزمات مكتبية')).toBeVisible();
  await expect(form).toHaveAttribute('lang', 'ar');
});
