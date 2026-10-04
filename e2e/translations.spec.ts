import { expect, test, type Locator, type Page } from '@playwright/test';
import { doubleLines, publish, watch } from './designer-support';
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

/** The rows of the held column of words whose line under them is not on the screen, by where it should be. */
async function missingRowLines(page: Page): Promise<number[]> {
  const bounds = await view(page)
    .locator('.fd-words-grid tbody th')
    .evaluateAll((cells) => cells.map((th) => ({ x: Math.round(th.getBoundingClientRect().left + 8), y: th.getBoundingClientRect().bottom })).filter((b) => b.y < innerHeight - 2));
  const shot = (await page.screenshot()).toString('base64');
  return page.evaluate(
    async ({ shot, bounds }) => {
      const picture = new Image();
      picture.src = `data:image/png;base64,${shot}`;
      await picture.decode();
      const canvas = document.createElement('canvas');
      [canvas.width, canvas.height] = [picture.width, picture.height];
      const pixels = canvas.getContext('2d')!;
      pixels.drawImage(picture, 0, 0);
      const drawn = (x: number, y: number) => pixels.getImageData(x, y, 1, 1).data[0] < 235;
      return bounds.filter((b) => ![-2, -1, 0, 1].some((d) => drawn(b.x, Math.round(b.y) + d))).map((b) => Math.round(b.y));
    },
    { shot, bounds }
  );
}

async function addLanguage(page: Page, name: string) {
  await page.getByRole('combobox', { name: 'Add a language' }).fill(name);
  await page.getByRole('combobox', { name: 'Add a language' }).press('Enter');
}

test('translates a survey into Arabic: typed right to left, filtered, pasted as CSV, a gone word let go', async ({ page }) => {
  const problems = await openTranslations(page);
  await expect(page.locator('.fd-survey-body')).toBeHidden();
  await expect(rowWords(page).first()).toHaveText('Product feedback');
  await expect(view(page).locator('.fd-words-note > span').first()).toHaveText(/^\d+ words, written in $/);
  await expect(page.getByRole('combobox', { name: 'The page’s own language' })).toHaveValue('en');
  await expect(view(page).locator('.fd-words-note > span').last()).toHaveText('. Add a language to translate them into it.');
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
  // A help left in English among the Arabic: its full stop stays at its end, and it lines up with the rest.
  const reply = await sentence(tried.locator('[data-node="q-email"] .fd-help'));
  expect(reply.lastX).toBeGreaterThan(reply.firstX);
  expect(Math.abs(reply.rightGap)).toBeLessThan(2);
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

test('says which language the page is written in, refusing one it is translated into, and Publish says so', async ({ page }) => {
  const problems = await openTranslations(page);
  await publish(page, 1);
  const own = page.getByRole('combobox', { name: 'The page’s own language' });
  await expect(own).toHaveValue('en');
  await own.selectOption({ label: 'French' });
  await expect(view(page).locator('.fd-words-grid thead th').first()).toHaveAttribute('aria-label', 'French, the page’s own words');
  await addLanguage(page, 'Arabic');
  await own.selectOption({ label: 'Arabic' });
  await expect(page.locator('.fd-designer-issues')).toHaveText('The page keeps a translation into Arabic: remove Arabic first to write the page in it');
  await expect(own).toHaveValue('fr');
  // Every line between the rows is drawn under the held column of words too, as the screen shows it.
  expect(await missingRowLines(page)).toEqual([]);
  await screen(page, 'translations-own-language', { viewport: true });
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Publish version 2?' });
  await expect(dialog.locator('.fd-publish-changes li')).toHaveText(['The page is now written in French', 'Added Arabic']);
  await screen(page, 'translations-publish-words', { viewport: true });
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

test('on a phone, each language is a whole column beside the English, swiped one at a time inside the grid’s box', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const problems = await openTranslations(page, '/screen/');
  await addLanguage(page, 'Arabic');
  await addLanguage(page, 'French');
  await cell(page, 'Customer').fill('العميل');
  await cell(page, 'Customer', 'French').fill('Client');
  await page.locator('.fd-words-bar').click({ position: { x: 4, y: 4 } });
  const box = view(page).locator('.fd-words-scroll').first();
  const held = view(page).locator('.fd-words-grid thead th').first();
  const heads = view(page).locator('.fd-words-grid thead th:not(:first-child)');
  /** Where a language's header and its name sit, and how much of the name its header shows. */
  const header = (n: number) =>
    heads.nth(n).evaluate((th) => {
      const name = th.querySelector('.fd-words-lang') as HTMLElement;
      const r = th.getBoundingClientRect();
      const words = name.getBoundingClientRect();
      return { x: r.x, width: r.width, name: name.textContent, nameX: words.x, nameRight: words.right, clipped: name.scrollWidth > name.clientWidth };
    });

  // The sheet scrolls sideways inside its own box; the page never does.
  const sizes = await box.evaluate((b) => ({ scroll: b.scrollWidth, client: b.clientWidth }));
  expect(sizes.scroll).toBeGreaterThan(sizes.client);
  await expectNoSidewaysScroll(page);

  // Typing in French brought French into view; back to the first language.
  await box.evaluate((b) => (b.scrollLeft = 0));
  // Every language column as wide as the next, never narrower than its name, progress and × need.
  const [arabic, french] = [await header(0), await header(1)];
  expect([arabic.name, french.name]).toEqual(['Arabic', 'French']);
  expect(arabic.width).toBeGreaterThanOrEqual(160);
  expect(Math.abs(arabic.width - french.width)).toBeLessThan(1);
  expect([arabic.clipped, french.clipped]).toEqual([false, false]);
  // Arabic, whole, beside the English held at the start.
  const start = (await held.boundingBox())!;
  expect(Math.abs(arabic.x - (start.x + start.width))).toBeLessThan(2);
  expect(arabic.nameX).toBeGreaterThan(start.x + start.width);
  await screen(page, 'translations-phone', { viewport: true });

  // Swiped on: French, whole, in Arabic's place; the English stays.
  await box.evaluate((b) => (b.scrollLeft = b.scrollWidth));
  const after = await header(1);
  const stays = (await held.boundingBox())!;
  const scroller = (await box.boundingBox())!;
  expect(Math.abs(stays.x - scroller.x)).toBeLessThan(2);
  expect(Math.abs(after.x - (stays.x + stays.width))).toBeLessThan(2);
  expect(after.nameRight).toBeLessThan(scroller.x + scroller.width);
  await screen(page, 'translations-phone-swiped', { viewport: true });
  await expectNoSidewaysScroll(page);
  expect(await doubleLines(page)).toEqual([]);
  expect(problems).toEqual([]);
});

/**
 * Where a block's words sit: the first and the last letter, and the words'
 * ends against the block's own, for its sentence's order and its alignment.
 */
function sentence(locator: Locator) {
  return locator.evaluate((block) => {
    const text = [...block.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) as Text;
    const words = text.textContent ?? '';
    const letter = (at: number) => {
      const range = document.createRange();
      range.setStart(text, at);
      range.setEnd(text, at + 1);
      return range.getBoundingClientRect();
    };
    const all = document.createRange();
    all.selectNodeContents(text);
    const [box, inside] = [block.getBoundingClientRect(), all.getBoundingClientRect()];
    const style = getComputedStyle(block);
    return {
      firstX: letter(words.search(/\S/)).x,
      lastX: letter(words.trimEnd().length - 1).x,
      rightGap: box.right - parseFloat(style.paddingRight) - inside.right,
      leftGap: inside.left - box.left - parseFloat(style.paddingLeft),
    };
  });
}

test('words left in English on a right-to-left page keep their own order, and still line up on the right', async ({ page }) => {
  const problems = watch(page);
  // A page with no Arabic of its own, shown in Arabic: every word of it left as written.
  await page.goto('/plain/?page=survey&skin=outlined&locale=ar');
  await expect(page.locator('.fd-form').first()).toHaveAttribute('dir', 'rtl');
  const help = page.locator('[data-node="q-email"] .fd-help');
  await expect(help).toHaveText('Only if you want a reply.');
  const english = await sentence(help);
  // “Only … reply.”: the full stop after the words, on their right, not before them.
  expect(english.lastX).toBeGreaterThan(english.firstX);
  expect(Math.abs(english.rightGap)).toBeLessThan(2);
  const label = await sentence(page.locator('[data-node="q-email"] .fd-label'));
  expect(Math.abs(label.rightGap)).toBeLessThan(2);
  await screen(page, 'bidi-english-in-arabic', { viewport: true });

  // A page in Arabic: its sentences end on the left, as Arabic does, lined up on the right.
  await page.goto('/plain/?page=rules&skin=outlined&locale=ar');
  const description = page.locator('.fd-page-description');
  await expect(description).toHaveText(/يمكنك تغييره\.$/);
  const arabic = await sentence(description);
  expect(arabic.lastX).toBeLessThan(arabic.firstX);
  expect(Math.abs(arabic.rightGap)).toBeLessThan(2);
  await screen(page, 'bidi-arabic', { viewport: true });

  // An English page keeps its words on the left.
  await page.goto('/plain/?page=survey&skin=outlined');
  const left = await sentence(page.locator('[data-node="q-email"] .fd-help'));
  expect(left.lastX).toBeGreaterThan(left.firstX);
  expect(Math.abs(left.leftGap)).toBeLessThan(2);
  expect(problems).toEqual([]);
});

test('the viewer demo still shows the rules page in Arabic, right to left', async ({ page }) => {
  await page.goto('/plain/?page=rules&locale=ar');
  const form = page.locator('.fd-form').first();
  await expect(form).toHaveAttribute('dir', 'rtl');
  await expect(page.getByText('طلب مستلزمات مكتبية')).toBeVisible();
  await expect(form).toHaveAttribute('lang', 'ar');
});
