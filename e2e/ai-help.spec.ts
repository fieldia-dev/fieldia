import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { expectNoSidewaysScroll, node, open, screen } from './support';

/**
 * AI help, as a person meets it, through the app's own model — here the demos' stand-in, no model and no keys: a new
 * customer filled from an e-mail's signature, a buyer's enquiry read and answered with a drafted and polished reply,
 * and homes searched in plain words. Every value proposed is shown on its field — the old one struck through, the new
 * one — with Accept and Reject, Accept all over the form, nothing written until it is accepted, Undo after; the
 * person's typing wins over a proposal.
 */

const WIDE = { width: 1280, height: 900 };
const PHONE = { width: 390, height: 844 };
const SIGNATURE = 'Lina Haddad · Head of Procurement, Amman Fresh Markets · T: +962 6 461 2200 · M: +962 79 555 0142 · lina.haddad@ammanfresh.example · www.ammanfresh.example · 21 Mecca St, Shmeisani, Amman, Jordan · VAT: 4001-2210';
const values = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values as Record<string, unknown>);
const proposal = (page: Page, id: string) => node(page, id).locator('.fd-proposal');
const review = (page: Page) => page.locator('.fd-assist-review');
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Fill from an e-mail' });

let problems: string[] = [];
test.afterEach(() => expect(problems).toEqual([]));

/** Fill from an e-mail pressed, the signature pasted, Propose values pressed. */
async function fillFrom(page: Page, text = SIGNATURE) {
  await page.getByRole('button', { name: 'Fill from an e-mail' }).click();
  await expect(dialog(page)).toBeVisible();
  await dialog(page).getByRole('textbox', { name: 'Text to fill the form from' }).fill(text);
  await dialog(page).getByRole('button', { name: 'Propose values' }).click();
  await expect(dialog(page)).toBeHidden();
}

for (const variant of ['plain', 'react']) {
  test.describe(`${variant === 'plain' ? '' : `${variant}: `}a customer filled from an e-mail`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(WIDE);
      ({ problems } = await open(page, variant, 'page=customer-from-email&record=new&skin=underline'));
    });

    test('each value read from the signature waits on its field, nothing written until it is accepted', async ({ page }) => {
      await fillFrom(page);
      await expect(review(page)).toContainText('9 values proposed. Review each on its field, or accept them all. Nothing is kept until you accept it.');
      // Said as the stand-in it is.
      await expect(review(page)).toContainText('Stand-in AI, no model: read by its patterns');
      await expect(proposal(page, 'f-website').locator('ins')).toHaveText('https://www.ammanfresh.example');
      await expect(proposal(page, 'f-country').locator('ins')).toHaveText('Jordan');
      await expect(proposal(page, 'f-contacts')).toContainText('1 line to add');
      await expect(proposal(page, 'f-contacts')).toContainText('Lina Haddad · Head of Procurement · lina.haddad@ammanfresh.example · +962 79 555 0142');
      await expect(node(page, '#title').locator('.fd-proposal ins')).toHaveText('Amman Fresh Markets');
      // Nothing written yet.
      expect(await values(page)).toMatchObject({ name: null, website: null, country_id: null, child_ids: [] });
      if (variant === 'plain') await screen(page, 'ai-fill-proposed');
      // One kept, one let go, the rest kept together; Undo puts them all back.
      await proposal(page, 'f-website').getByRole('button', { name: 'Accept' }).click();
      await expect(node(page, 'f-website').locator('input')).toHaveValue('https://www.ammanfresh.example');
      await expect(proposal(page, 'f-website')).toContainText('Proposal kept');
      await proposal(page, 'f-vat').getByRole('button', { name: 'Reject' }).click();
      await expect(proposal(page, 'f-vat')).toHaveCount(0);
      await review(page).getByRole('button', { name: 'Accept all' }).click();
      await expect(review(page)).toContainText('Kept 7 values');
      expect(await values(page)).toMatchObject({ name: 'Amman Fresh Markets', vat: null, city: 'Amman', country_id: { id: 2, label: 'Jordan' }, child_ids: [{ values: { name: 'Lina Haddad', function: 'Head of Procurement', email: 'lina.haddad@ammanfresh.example', mobile: '+962 79 555 0142' } }] });
      await expect(node(page, 'f-contacts').getByRole('textbox').first()).toHaveValue('Lina Haddad');
      if (variant === 'plain') await screen(page, 'ai-fill-kept');
      await review(page).getByRole('button', { name: 'Undo' }).click();
      expect(await values(page)).toMatchObject({ name: null, city: null, country_id: null, child_ids: [] });
      // The website kept on its own keeps its own Undo.
      expect((await values(page))['website']).toBe('https://www.ammanfresh.example');
      await proposal(page, 'f-website').getByRole('button', { name: 'Undo' }).click();
      expect((await values(page))['website']).toBe(null);
    });

    test('typing in a field with a proposal lets the proposal go: the person’s words win', async ({ page }) => {
      await fillFrom(page);
      const phone = node(page, 'f-phone').locator('input');
      await phone.click();
      await phone.pressSequentially('+962 6 000');
      await expect(proposal(page, 'f-phone')).toHaveCount(0);
      await expect(proposal(page, 'f-email')).toHaveCount(1);
      await review(page).getByRole('button', { name: 'Accept all' }).click();
      expect((await values(page))['phone']).toBe('+962 6 000');
    });
  });
}

test.describe('a customer filled from an e-mail, by its keys and its files', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(WIDE);
    ({ problems } = await open(page, 'plain', 'page=customer-from-email&record=new&skin=underline'));
  });

  test('a text file of the e-mail is read as words pasted are; Escape closes the dialog and the focus comes back', async ({ page }) => {
    const opener = page.getByRole('button', { name: 'Fill from an e-mail' });
    await opener.click();
    await expect(dialog(page).getByRole('textbox')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    await expect(opener).toBeFocused();
    await opener.click();
    await dialog(page).locator('input[type=file]').setInputFiles({ name: 'signature.txt', mimeType: 'text/plain', buffer: Buffer.from(['Kind regards,', 'Lina Haddad', 'Head of Procurement | Amman Fresh Markets', 'lina.haddad@ammanfresh.example'].join('\n')) });
    await expect(dialog(page)).toContainText('signature.txt');
    await dialog(page).getByRole('button', { name: 'Propose values' }).click();
    await expect(review(page)).toContainText('3 values proposed');
    // The keyboard goes to the first Accept, and on from one to the next.
    await expect(page.locator('.fd-proposal-accept').first()).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.fd-proposal-accept').first()).toBeFocused();
    expect((await values(page))['name']).toBe('Amman Fresh Markets');
  });

  test('in Arabic, right to left: the dialog, the review and each proposal in its words', async ({ page }) => {
    await page.goto('/plain/?page=customer-from-email&record=new&skin=underline&locale=ar&dir=rtl');
    await page.getByRole('button', { name: 'Fill from an e-mail' }).click();
    const box = page.getByRole('dialog').getByRole('textbox', { name: 'النص الذي يُملأ منه النموذج' });
    await box.fill(SIGNATURE);
    await page.getByRole('dialog').getByRole('button', { name: 'اقترح القيم' }).click();
    await expect(review(page)).toContainText('قيم مقترحة: 9');
    await expect(proposal(page, 'f-city').getByRole('button', { name: 'قبول' })).toBeVisible();
    await expectNoSidewaysScroll(page);
    await screen(page, 'ai-fill-arabic');
  });

  test('on a phone the review and each proposal fit, nothing sideways', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.reload();
    await fillFrom(page);
    await expect(review(page)).toBeVisible();
    await expectNoSidewaysScroll(page);
    await screen(page, 'ai-fill-phone');
  });
});

test.describe('an enquiry answered with a drafted reply', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(WIDE);
    ({ problems } = await open(page, 'plain', 'page=enquiry-reply&record=1&skin=underline'));
  });

  test('what the buyer wants is read from their message, and a reply drafted from it', async ({ page }) => {
    await page.getByRole('button', { name: 'Fill from their message' }).click();
    await expect(review(page)).toContainText('4 values proposed');
    await expect(proposal(page, 'f-kind').locator('ins')).toHaveText('Villa');
    await expect(proposal(page, 'f-district').locator('ins')).toHaveText('New Cairo');
    await expect(proposal(page, 'f-bedrooms').locator('ins')).toHaveText('4');
    await expect(proposal(page, 'f-budget').locator('ins')).toContainText('15,000,000');
    await review(page).getByRole('button', { name: 'Accept all' }).click();
    expect(await values(page)).toMatchObject({ kind: 'villa', district: 'new_cairo', budget: 15_000_000, bedrooms: 4 });
    // Draft: shown under the reply, kept once accepted.
    const reply = node(page, 'f-reply');
    await expect(reply.getByRole('button', { name: 'Polish' })).toBeHidden();
    await reply.getByRole('button', { name: 'Draft' }).click();
    await expect(proposal(page, 'f-reply')).toContainText('Proposed text');
    await expect(proposal(page, 'f-reply').locator('.fd-proposal-text')).toContainText('Thank you for your enquiry about a villa in New Cairo with 4 bedrooms, up to EGP 15,000,000.');
    await expect(proposal(page, 'f-reply')).toContainText('Stand-in AI, no model: written from this record’s fields by a template.');
    expect((await values(page))['reply']).toBe('');
    await screen(page, 'ai-reply-draft');
    await proposal(page, 'f-reply').getByRole('button', { name: 'Accept' }).click();
    await expect(reply.locator('textarea')).toHaveValue(/^Dear Hana,\n\nThank you for your enquiry/);
    await expect(reply.getByRole('button', { name: 'Polish' })).toBeVisible();
  });

  test('words typed in a hurry are polished, shown before they are kept', async ({ page }) => {
    await page.goto('/plain/?page=enquiry-reply&record=2&skin=underline');
    const reply = node(page, 'f-reply');
    await reply.getByRole('button', { name: 'Polish' }).click();
    const text = proposal(page, 'f-reply').locator('.fd-proposal-text');
    await expect(text).toHaveText('Hi Omar,\n\nThanks for your message. We have 2 flats in zamalek that fit your budget, one with a nile view. Can you come on thursday at 5pm? Please let me know as soon as possible.\n\nRegards,\nMona');
    await screen(page, 'ai-reply-polish');
    await proposal(page, 'f-reply').getByRole('button', { name: 'Reject' }).click();
    await expect(reply.locator('textarea')).toHaveValue(/^hi omar/);
  });

  test('a draft asked for while the person types is let go: their words stay', async ({ page }) => {
    const reply = node(page, 'f-reply');
    const box = reply.locator('textarea');
    await page.evaluate(() => {
      // The model takes its time: the person types meanwhile.
      const source = (window as any).fieldiaDemo.dataSource;
      const rewrite = source.rewrite;
      source.rewrite = (request: unknown) => new Promise((done) => setTimeout(() => done(rewrite(request)), 600));
    });
    await reply.getByRole('button', { name: 'Draft' }).click();
    await expect(reply.getByRole('button', { name: 'Writing…' })).toBeVisible();
    await box.click();
    await box.pressSequentially('Dear Hana, thanks!');
    await expect(reply.getByRole('button', { name: 'Draft' })).toBeVisible();
    await expect(proposal(page, 'f-reply')).toHaveCount(0);
    await expect(box).toHaveValue('Dear Hana, thanks!');
  });
});

test.describe('homes searched in plain words', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(WIDE);
    ({ problems } = await open(page, 'plain', 'page=homes-search&skin=underline'));
  });

  test('“villas in New Cairo under 15M” becomes the filters it names, Undo putting the words back', async ({ page }) => {
    const keyword = page.locator('.fd-filter-keyword');
    const words = page.getByRole('button', { name: 'Turn these words into filters' });
    await expect(words).toBeHidden();
    await keyword.fill('villas in New Cairo under 15M');
    await expect(words).toBeVisible();
    await words.click();
    const picked = page.locator('.fd-filter-field button[data-picked]');
    await expect(picked).toHaveText([/^Type: ?Villa$/, /^District: ?New Cairo$/, /^Price: up to E(£|GP)\s?15M$/]);
    await expect(page.locator('.fd-assist-read')).toContainText('Read as filters: Type: Villa · District: New Cairo · Price: up to');
    await expect(page.locator('.fd-assist-read')).toContainText('Stand-in AI, no model');
    await expect(keyword).toHaveValue('');
    // The keyboard back in the box the words were typed in.
    await expect(keyword).toBeFocused();
    // None for sale there at that price: said as any search that finds none.
    await expect(page.locator('.fd-list-empty')).toBeVisible();
    await page.locator('.fd-assist-read').getByRole('button', { name: 'Undo' }).click();
    await expect(picked).toHaveCount(0);
    await expect(keyword).toHaveValue('villas in New Cairo under 15M');
    // Words that find homes: the filters a buyer would have set.
    await keyword.fill('villas in Heliopolis under 25M');
    await words.click();
    await expect(picked).toHaveText([/^Type: ?Villa$/, /^District: ?Heliopolis$/, /^Price: up to E(£|GP)\s?25M$/]);
    await expect(page.locator('.fd-list-found')).toHaveText('2 homes');
    await screen(page, 'ai-search-words');
  });
});
