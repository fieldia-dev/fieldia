import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * The input rules (0.21) for text, typed and pasted as a person does — keys
 * pressed one by one, a real Ctrl+V from the clipboard, text inserted as a
 * phone keyboard inserts it — on the "Every field", "Sign-up", "Kinds",
 * "Business", "Delivery" and "Rules" examples and the employee record, in
 * English, Arabic right to left with Arabic digits, French and German. A box
 * never cuts what was pasted; a phone number never takes a letter; an
 * address copied from Arabic text is taken without its marks; a pattern and
 * a postcode read Arabic digits; tags, JSON, a property and a colour say why
 * they refuse, and nothing typed goes without a word.
 */

// The clipboard is the browser's, one for every page a worker has open: these tests take turns with it.
test.describe.configure({ mode: 'default' });

type Values = Record<string, unknown>;
const values = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values as Values);
const valueOf = async (page: Page, field: string) => (await values(page))[field];
const hintOf = (scope: Locator) => scope.locator('.fd-refusal-hint');
const errorOf = (page: Page, id: string) => node(page, id).locator(':scope > .fd-error');

/** Text put on the clipboard, then pasted with Ctrl+V. */
async function paste(page: Page, box: Locator, text: string) {
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await box.press('Control+V');
}

/** A page of the test's own, in the one-tag script, in `locale`. */
async function mountOwn(page: Page, fields: Record<string, unknown>, children: unknown[], locale = 'en') {
  await page.goto(`/script/${locale === 'en' ? '' : `?locale=${locale}`}`);
  await page.waitForFunction(() => 'Fieldia' in window);
  await page.evaluate(
    ([fields, children, locale]) => {
      const W = window as any;
      document.body.replaceChildren();
      const host = document.createElement('div');
      if (locale === 'ar') host.setAttribute('dir', 'rtl');
      document.body.append(host);
      const page = { fieldia: '0.1', id: 'own', title: 'Own', data: { kind: 'responses' }, fields, layout: { type: 'sections', id: 'r', children: [{ type: 'section', id: 's', columns: 1, children }] } };
      W.handle = W.Fieldia.mountViewer(host, { page, dataSource: W.Fieldia.createMemoryDataSource(), locale, skin: 'outlined' });
    },
    [fields, children, locale] as const
  );
  await expect(page.locator('.fd-form')).toBeVisible();
}
const ownValues = (page: Page) => page.evaluate(() => (window as any).handle.form.getState().values as Values);

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

test.describe('a text’s most characters', () => {
  for (const [locale, query, over] of [
    ['en', '', '4920 characters too many'],
    ['ar', '&locale=ar&dir=rtl', 'أحرف زائدة: 4920'],
    ['fr', '&locale=fr', '4920 caractères en trop'],
  ] as const) {
    test(`${locale}: a name pasted past its most is kept whole and told; a key at the most is refused, with words`, async ({ page }) => {
      const { problems } = await open(page, 'plain', `page=signup&skin=outlined${query}`);
      const name = node(page, 'f-name');
      const box = name.locator('input');
      await box.click();
      await paste(page, box, 'a'.repeat(5000));
      await expect(box).toHaveValue('a'.repeat(5000));
      expect(((await valueOf(page, 'full_name')) as string).length).toBe(5000);
      await expect(name.locator('.fd-count')).toHaveText('5000 / 80');
      await expect(name.locator('.fd-count-over')).toHaveText(over);
      await expect(name.locator('.fd-count')).toHaveClass(/fd-count-past/);
      // Left, the field says how far over it is and that it must be shortened to save, in its own words.
      await box.press('Tab');
      await expect(errorOf(page, 'f-name')).toContainText('4920');
      await expect(errorOf(page, 'f-name')).toHaveAttribute('aria-live', 'polite');
      await expect(box).toHaveAttribute('aria-invalid', 'true');
      await name.scrollIntoViewIfNeeded();
      await screen(page, `text-rules-over-${locale}`, { viewport: true });
      // Typed past the most, the keys never land, and a hint says why.
      await box.click();
      await box.press('Control+A');
      await box.press('Delete');
      await box.pressSequentially(`${'x'.repeat(78)}EXTRA`);
      await expect(box).toHaveValue(`${'x'.repeat(78)}EX`);
      await expect(hintOf(name)).toBeVisible();
      await expect(hintOf(name)).toContainText('80');
      await expect(hintOf(name)).toHaveAttribute('role', 'status');
      await screen(page, `text-rules-most-${locale}`, { viewport: true });
      expect(problems).toEqual([]);
    });
  }

  test('a paragraph keeps a paste past its most whole, and counts an emoji as one', async ({ page }) => {
    await open(page, 'plain', 'page=signup&skin=outlined');
    await page.evaluate(() => (window as any).fieldiaDemo.handle.form.setValue('attends_dinner', true));
    const dietary = node(page, 'f-dietary');
    const area = dietary.locator('textarea');
    await area.click();
    await paste(page, area, 'No nuts.\n'.repeat(60));
    expect(((await valueOf(page, 'dietary')) as string).length).toBe(540);
    await expect(dietary.locator('.fd-count')).toHaveText('540 / 300');
    const name = node(page, 'f-name').locator('input');
    await name.click();
    await paste(page, name, `a${'😀'.repeat(50)}`);
    await expect(node(page, 'f-name').locator('.fd-count')).toHaveText('51 / 80');
    await expect(name).toHaveValue(`a${'😀'.repeat(50)}`);
  });
});

test.describe('a phone number, an email and a web address', () => {
  for (const [locale, query, said] of [
    ['en', '', 'A phone number takes digits, spaces and + ( ) . - only'],
    ['ar', '&locale=ar&dir=rtl', 'رقم الهاتف أرقام ومسافات و+ ( ) . - فقط'],
    ['fr', '&locale=fr', 'Un numéro de téléphone ne contient que des chiffres, des espaces et + ( ) . -'],
  ] as const) {
    test(`${locale}: a phone number refuses letters as they are typed, and keeps its digits in 0-9 once left`, async ({ page }) => {
      const { problems } = await open(page, 'plain', `page=fields&skin=outlined${query}`);
      const phone = node(page, 'f-phone');
      const box = phone.locator('input');
      await box.fill('');
      await box.pressSequentially('call');
      await expect(box).toHaveValue('');
      await expect(hintOf(phone)).toHaveText(said);
      await expect(box).toHaveAttribute('aria-describedby', new RegExp(`${await hintOf(phone).getAttribute('id')}`));
      await phone.scrollIntoViewIfNeeded();
      await screen(page, `text-rules-phone-${locale}`, { viewport: true });
      // The keys after the refused one wait with it: Backspace takes them back one by one, and the words go with the last.
      for (let i = 0; i < 'call'.length; i++) await box.press('Backspace');
      await expect(hintOf(phone)).toBeHidden();
      await box.pressSequentially(locale === 'ar' ? '٠١٠١٢٣٤٥٦٧٨' : '+20 (10) 1234-5678');
      await expect(hintOf(phone)).toBeHidden();
      await box.press('Tab');
      expect(await valueOf(page, 'phone')).toBe(locale === 'ar' ? '01012345678' : '+20 (10) 1234-5678');
      await expect(errorOf(page, 'f-phone')).toBeHidden();
      expect(problems).toEqual([]);
    });
  }

  test('ar: a phone number pasted with direction marks — from a chat, from Fieldia’s own message — is taken without them', async ({ page }) => {
    await open(page, 'plain', 'page=fields&skin=outlined&locale=ar&dir=rtl');
    const box = node(page, 'f-phone').locator('input');
    for (const pasted of ['\u200e+20 10 1234 5678', '\u202a+20 10 1234 5678\u202c', '\u2066+20 100 123 4567\u2069']) {
      await box.fill('');
      await paste(page, box, pasted);
      await box.press('Tab');
      expect(await valueOf(page, 'phone')).toBe(pasted.replace(/[\u200e\u202a\u202c\u2066\u2069]/g, ''));
      await expect(errorOf(page, 'f-phone')).toBeHidden();
    }
  });

  test('an email or a web address is said as soon as it is left, not only at Save', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=fields&skin=outlined');
    const email = node(page, 'f-email').locator('input');
    await email.fill('name.example.com');
    await email.press('Tab');
    await expect(errorOf(page, 'f-email')).toHaveText('Enter an email address, like name@example.com');
    await expect(email).toHaveAttribute('aria-invalid', 'true');
    const portal = node(page, 'f-portal').locator('input');
    await portal.fill('javascript:alert(1)');
    await portal.press('Tab');
    await expect(errorOf(page, 'f-portal')).toHaveText('Only a web address (http or https) can go here');
    await portal.fill('http://localhost:3000');
    await portal.press('Tab');
    await expect(errorOf(page, 'f-portal')).toBeHidden();
    await portal.fill('192.168.1.10/admin');
    await portal.press('Tab');
    await expect(errorOf(page, 'f-portal')).toBeHidden();
    expect(problems).toEqual([]);
  });

  test('an email refuses a space, drops pasted marks, and keeps an international domain as typed', async ({ page }) => {
    await open(page, 'plain', 'page=fields&skin=outlined&locale=ar&dir=rtl');
    const email = node(page, 'f-email');
    const box = email.locator('input');
    await expect(box).toHaveAttribute('type', 'text');
    await expect(box).toHaveAttribute('inputmode', 'email');
    await box.fill('');
    await box.pressSequentially('ali ');
    await expect(hintOf(email)).toHaveText('لا مسافات في البريد الإلكتروني');
    // The refused space waits, held: Backspace takes it back, and what is typed then is the address's.
    await box.press('Backspace');
    await expect(hintOf(email)).toBeHidden();
    await box.pressSequentially('@مثال.مصر');
    await box.press('Tab');
    expect(await valueOf(page, 'email')).toBe('ali@مثال.مصر');
    await box.fill('');
    await paste(page, box, '\u200fname@example.com\u200f');
    await box.press('Tab');
    expect(await valueOf(page, 'email')).toBe('name@example.com');
    await expect(errorOf(page, 'f-email')).toBeHidden();
  });

  for (const [locale, query, colon] of [
    ['en', '', 'An email address has no “:” before its @'],
    ['ar', '&locale=ar&dir=rtl', 'لا يأتي «:» قبل @ في البريد الإلكتروني'],
  ] as const) {
    test(`${locale}: a link’s “mailto:” pasted is the address it links to, a zero-width character goes, and a “:” typed before the @ is refused`, async ({ page }) => {
      const { problems } = await open(page, 'plain', `page=fields&skin=outlined${query}`);
      const email = node(page, 'f-email');
      const box = email.locator('input');
      await box.fill('');
      await paste(page, box, 'mailto:ahmed@example.com');
      await expect(box).toHaveValue('ahmed@example.com');
      await box.press('Tab');
      expect(await valueOf(page, 'email')).toBe('ahmed@example.com');
      await expect(errorOf(page, 'f-email')).toBeHidden();
      await box.fill('');
      await paste(page, box, 'sara\u200b@example.com');
      await expect(box).toHaveValue('sara@example.com');
      await box.press('Tab');
      expect(await valueOf(page, 'email')).toBe('sara@example.com');
      await expect(errorOf(page, 'f-email')).toBeHidden();
      await box.fill('');
      await box.pressSequentially('mailto:');
      await expect(box).toHaveValue('mailto');
      await expect(hintOf(email)).toHaveText(colon);
      await expect(box).toHaveAttribute('aria-describedby', new RegExp(await hintOf(email).getAttribute('id') as string));
      expect(problems).toEqual([]);
    });
  }

  test('ar: the employee’s mobile in Arabic digits is dialled in 0-9, and an international email reads as typed', async ({ page }) => {
    await open(page, 'plain', 'page=real-employee&record=4122&skin=underline&locale=ar&dir=rtl');
    const mobile = node(page, 'f-mobile').locator('input');
    await mobile.fill('');
    await mobile.pressSequentially('٠١٠١٢٣٤٥٦٧٨');
    await mobile.press('Tab');
    const email = node(page, 'f-work-email').locator('input');
    await email.fill('');
    await email.pressSequentially('ali@مثال.مصر');
    await email.press('Tab');
    expect(await valueOf(page, 'mobile_phone')).toBe('01012345678');
    expect(await valueOf(page, 'work_email')).toBe('ali@مثال.مصر');
    // Read-only, as a record is read.
    await page.evaluate(() => (window as any).fieldiaDemo.handle.setReadonly(true));
    await expect(node(page, 'f-mobile').locator('a')).toHaveAttribute('href', 'tel:01012345678');
    await expect(node(page, 'f-work-email').locator('a')).toHaveText('ali@مثال.مصر');
  });
});

test.describe('one line of text', () => {
  test('is trimmed once left, spaces alone being nothing; a pasted line break is a space, and dropped from a password', async ({ page }) => {
    await open(page, 'plain', 'page=fields&skin=outlined');
    const project = node(page, 'f-name').locator('input');
    await project.fill('');
    await project.pressSequentially('  Cairo office  ');
    await project.press('Tab');
    expect(await valueOf(page, 'name')).toBe('Cairo office');
    const phone = node(page, 'f-phone').locator('input');
    await phone.fill('');
    await phone.pressSequentially('   ');
    await phone.press('Tab');
    expect(await valueOf(page, 'phone')).toBeNull();
    const password = node(page, 'f-password').locator('input');
    await password.fill('');
    await paste(page, password, '\nS3cret!');
    await password.press('Tab');
    expect(await valueOf(page, 'portal_password')).toBe('S3cret!');
  });

  test('a copy box is trimmed once left, and copies its value trimmed', async ({ page }) => {
    await open(page, 'plain', 'page=business&skin=underline');
    const link = node(page, 'f-session-link');
    const box = link.locator('input');
    await box.fill('');
    await box.pressSequentially('   ');
    await expect(link.getByRole('button', { name: 'Copy' })).toBeHidden();
    await box.pressSequentially('ABC-123  ');
    await link.getByRole('button', { name: 'Copy' }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('ABC-123');
    await box.click();
    await box.press('Tab');
    expect(await valueOf(page, 'session_link')).toBe('ABC-123');
  });
});

test.describe('a pattern', () => {
  test('is about the whole answer, read with its digits in 0-9, and says the page’s own reason', async ({ page }) => {
    await mountOwn(
      page,
      {
        zip: { type: 'char', label: 'Zip', pattern: '[0-9]{5}' },
        code: { type: 'char', label: 'Code', pattern: '^\\d{5}$', patternHint: '{label} is five digits, like 11511' },
      },
      [{ type: 'field', id: 'f-zip', field: 'zip' }, { type: 'field', id: 'f-code', field: 'code' }],
      'ar'
    );
    const zip = page.locator('[data-node="f-zip"] input');
    await zip.pressSequentially('ab12345cd');
    await zip.press('Tab');
    await expect(page.locator('[data-node="f-zip"] > .fd-error')).toBeVisible();
    const code = page.locator('[data-node="f-code"] input');
    await code.pressSequentially(' ١١٥١١');
    await code.press('Tab');
    await expect(page.locator('[data-node="f-code"] > .fd-error')).toBeHidden();
    expect((await ownValues(page))['code']).toBe('11511');
    await code.fill('115');
    await code.press('Tab');
    await expect(page.locator('[data-node="f-code"] > .fd-error')).toHaveText('Code is five digits, like 11511');
  });

  test('ar: a postcode typed in Arabic or Persian digits passes its answer rule, and is kept in 0-9', async ({ page }) => {
    await open(page, 'plain', 'page=rules&skin=outlined&locale=ar&dir=rtl');
    const postcode = node(page, 'f-postcode').locator('input');
    for (const typed of ['١١٥١١', '۱۱۵۱۱']) {
      await postcode.fill('');
      await postcode.pressSequentially(typed);
      await postcode.press('Tab');
      await expect(errorOf(page, 'f-postcode')).toBeHidden();
      expect(await valueOf(page, 'postcode')).toBe('11511');
    }
  });

  test('ar: the delivery address’s postcode in Arabic digits is taken at Save', async ({ page }) => {
    await open(page, 'plain', 'page=delivery&skin=outlined&locale=ar&dir=rtl');
    const part = page.locator('[data-title="عنوان التوصيل"], .fd-form-part').first();
    const postcode = part.locator('[data-node="postcode"] input');
    await postcode.pressSequentially('١١٥١١');
    await postcode.press('Tab');
    await expect(part.locator('[data-node="postcode"] > .fd-error')).toBeHidden();
    const address = (await valueOf(page, 'delivery_address')) as Values;
    expect(address['postcode']).toBe('11511');
  });

  test('the employee template’s own IBAN example is taken, spaced, in either case', async ({ page }) => {
    const template = JSON.parse(readFileSync(join(__dirname, '..', 'examples', 'templates', 'employee-onboarding.page.json'), 'utf8'));
    await mountOwn(page, { iban: template.fields.iban }, [{ type: 'field', id: 'f-iban', field: 'iban' }]);
    const iban = page.locator('[data-node="f-iban"] input');
    const error = page.locator('[data-node="f-iban"] > .fd-error');
    for (const typed of ['EG38 0019 0005 0000 0000 2631 8000 2', 'eg38 0019 0005 0000 0000 2631 8000 2']) {
      await iban.fill('');
      await iban.pressSequentially(typed);
      await iban.press('Tab');
      await expect(error).toBeHidden();
    }
    await iban.fill('EG38');
    await iban.press('Tab');
    await expect(error).toHaveText('IBAN: two letters, two digits, then the account, like EG38 0019 0005 0000 0000 2631 8000 2');
  });

  test('one that does not read is the page’s to fix: checkPage names it, and the page is never shown to fail at Save', async ({ page }) => {
    await page.goto('/script/');
    await page.waitForFunction(() => 'Fieldia' in window);
    const said = await page.evaluate(() => {
      const W = window as any;
      const broken = { fieldia: '0.1', id: 'p', data: { kind: 'responses' }, fields: { zip: { type: 'char', label: 'Zip', pattern: '[0-9' } }, layout: { type: 'sections', id: 'r', children: [{ type: 'field', id: 'n', field: 'zip' }] } };
      const checked = W.Fieldia.checkPage(broken);
      let shown = '';
      try {
        W.Fieldia.mountViewer(document.createElement('div'), { page: broken, dataSource: W.Fieldia.createMemoryDataSource() });
      } catch (error) {
        shown = (error as Error).message;
      }
      return { issues: checked.ok ? [] : checked.issues, shown };
    });
    expect(said.issues).toEqual([{ path: 'fields.zip.pattern', message: expect.stringMatching(/^The pattern of Zip is not a valid pattern: /) }]);
    expect(said.shown).toContain('fields.zip.pattern');
  });
});

test.describe('tags', () => {
  test('ar: the Arabic comma ends a tag, a list pasted on lines is a tag a line, and the box says “Add a tag”', async ({ page }) => {
    await open(page, 'plain', 'page=fields&skin=outlined&locale=ar&dir=rtl');
    const tags = node(page, 'f-materials');
    const box = tags.getByRole('combobox');
    await expect(box).toHaveAttribute('placeholder', 'أضف وسمًا');
    await box.click();
    await box.pressSequentially('خشب، زجاج،');
    await paste(page, box, 'steel\nbrass\nwalnut');
    await expect(tags.locator('.fd-chip-label')).toHaveText(['oak', 'glass', 'خشب', 'زجاج', 'steel', 'brass', 'walnut']);
  });

  test('cells copied side by side from a spreadsheet, pasted, are a tag a cell: never a tag with a tab inside', async ({ page }) => {
    await open(page, 'plain', 'page=fields&skin=outlined');
    const tags = node(page, 'f-materials');
    const box = tags.getByRole('combobox');
    await box.click();
    await paste(page, box, 'walnut\tbrass');
    await expect(tags.locator('.fd-chip-label')).toHaveText(['oak', 'glass', 'walnut', 'brass']);
    expect(await valueOf(page, 'materials')).toBe('oak, glass, walnut, brass');
    await expect(box).toHaveValue('');
  });

  test('a tag there already, in any case, is not added twice: said, and its chip marked', async ({ page }) => {
    await open(page, 'plain', 'page=fields&skin=outlined');
    const tags = node(page, 'f-materials');
    const box = tags.getByRole('combobox');
    await box.click();
    await box.pressSequentially('Oak');
    await box.press('Enter');
    await expect(hintOf(tags)).toHaveText('“Oak” is already there');
    await expect(tags.locator('.fd-chip-there .fd-chip-label')).toHaveText('oak');
    expect(await valueOf(page, 'materials')).toBe('oak, glass');
    await screen(page, 'text-rules-tag-there', { viewport: true });
  });

  for (const [locale, said] of [
    ['en', 'Keywords takes at most 3. Not added: brass'],
    ['ar', 'Keywords: 3 على الأكثر. لم يُضف: brass'],
  ] as const) {
    test(`${locale}: at the most the box stays, the focus with it, and says which tags were not added`, async ({ page }) => {
      await mountOwn(page, { keywords: { type: 'char', label: 'Keywords' } }, [{ type: 'field', id: 'f-keywords', field: 'keywords', widget: 'tags', options: { max: 3 } }], locale);
      const tags = page.locator('[data-node="f-keywords"]');
      const box = tags.getByRole('combobox');
      await box.click();
      await page.keyboard.type('oak, glass, steel, brass');
      await expect(box).toBeFocused();
      await expect(tags.locator('.fd-chip-label')).toHaveText(['oak', 'glass', 'steel']);
      await page.keyboard.type(',');
      await expect(hintOf(tags)).toHaveText(said);
      await expect(box).toHaveValue('brass');
      await screen(page, `text-rules-tags-most-${locale}`, { viewport: true });
      // Left so, it is the field's to say, and Save waits.
      await box.press('Tab');
      await expect(tags.locator(':scope > .fd-error')).toHaveText(said);
      expect((await ownValues(page))['keywords']).toBe('oak, glass, steel');
      expect(await page.evaluate(() => (window as any).handle.form.validate())).toBe(false);
    });
  }

  test('a list pasted past the most adds up to it and names the rest', async ({ page }) => {
    await mountOwn(page, { keywords: { type: 'char', label: 'Keywords' } }, [{ type: 'field', id: 'f-keywords', field: 'keywords', widget: 'tags', options: { max: 3 } }]);
    const tags = page.locator('[data-node="f-keywords"]');
    const box = tags.getByRole('combobox');
    await box.click();
    await paste(page, box, 'oak, glass, steel, brass, walnut');
    await expect(tags.locator('.fd-chip-label')).toHaveText(['oak', 'glass', 'steel']);
    await expect(hintOf(tags)).toHaveText('Keywords takes at most 3. Not added: brass, walnut');
  });
});

test.describe('JSON', () => {
  test('keeps what is typed while it is not JSON, says why in words, and Save says so', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=fields&skin=outlined');
    await node(page, 's-structured').getByRole('button', { name: 'Structured data' }).click().catch(() => undefined);
    const settings = node(page, 'f-settings');
    const area = settings.locator('textarea');
    const before = await valueOf(page, 'settings');
    await area.click();
    await area.press('Control+A');
    await page.keyboard.insertText('{"doors": 4, "zone": "B",}');
    await area.press('Tab');
    await expect(area).toHaveValue('{"doors": 4, "zone": "B",}');
    expect(await valueOf(page, 'settings')).toEqual(before);
    await expect(errorOf(page, 'f-settings')).toHaveText('Not valid JSON, so not saved: a comma with nothing after it (line 1, column 26)');
    await expect(area).toHaveAttribute('aria-invalid', 'true');
    await expect(area).toHaveAttribute('aria-describedby', /f-settings-error|-error/);
    await settings.scrollIntoViewIfNeeded();
    await screen(page, 'text-rules-json', { viewport: true });
    // Curly quotes, as a word processor types them.
    await area.click();
    await area.press('Control+A');
    await page.keyboard.insertText('{“a”: 1}');
    await area.press('Tab');
    await expect(errorOf(page, 'f-settings')).toHaveText('Not valid JSON, so not saved: use straight quotes " instead of “ ” (line 1, column 2)');
    expect(await page.evaluate(() => (window as any).fieldiaDemo.handle.form.validate())).toBe(false);
    expect(problems).toEqual([]);
  });
});

test.describe('a property’s number', () => {
  for (const [locale, query, said] of [
    ['en', '', 'Floor: numbers only'],
    ['fr', '&locale=fr', 'Floor : des nombres uniquement'],
  ] as const) {
    test(`${locale}: refuses text as any number box does, and text left that does not read is said on its row, Save waiting`, async ({ page }) => {
      await open(page, 'plain', `page=fields&skin=outlined${query}`);
      await node(page, 's-structured').getByRole('button').first().click().catch(() => undefined);
      const details = node(page, 'f-extra');
      const floor = details.locator('#' + (await details.locator('label', { hasText: 'Floor' }).getAttribute('for')));
      await floor.click();
      await floor.press('Control+A');
      await floor.press('Delete');
      await floor.pressSequentially('twelve');
      await expect(floor).toHaveValue('');
      await expect(hintOf(details)).toHaveText(said);
      // The keys after the refused one wait with it: "twelve12" is never 12. Backspace takes them back.
      await floor.pressSequentially('12');
      await expect(floor).toHaveValue('');
      for (let i = 0; i < 8; i++) await floor.press('Backspace');
      await expect(hintOf(details)).toBeHidden();
      await floor.pressSequentially('12');
      expect(((await valueOf(page, 'extra')) as Values)['floor']).toBe(12);
      await floor.press('Control+A');
      await floor.press('Delete');
      await floor.pressSequentially('12 34');
      await floor.press('Tab');
      const rowError = details.locator(`#${await floor.getAttribute('id')}-error`);
      await expect(rowError).toBeVisible();
      await expect(rowError).toHaveText(locale === 'fr' ? /^Les chiffres se groupent par trois/ : /^Digits are grouped in threes/);
      await expect(floor).toHaveAttribute('aria-describedby', new RegExp(`${await floor.getAttribute('id')}-error`));
      await expect(floor).toHaveAttribute('aria-invalid', 'true');
      // The property keeps what it held as its box was entered; the text stays, marked, for the person to fix.
      expect(((await valueOf(page, 'extra')) as Values)['floor']).toBe(12);
      await expect(floor).toHaveValue('12 34');
      expect(await page.evaluate(() => (window as any).fieldiaDemo.handle.form.validate())).toBe(false);
      await details.scrollIntoViewIfNeeded();
      await screen(page, `text-rules-property-${locale}`, { viewport: true });
    });
  }
});

test.describe('an address’s postcode', () => {
  test('is checked by its country as the address is left, in Arabic digits too, and kept in 0-9', async ({ page }) => {
    await open(page, 'plain', 'page=kinds&skin=outlined&locale=ar&dir=rtl');
    const address = node(page, 'q-address');
    await address.locator('[data-part="street"]').fill('12 شارع النيل');
    await address.locator('[data-part="city"]').fill('القاهرة');
    const postcode = address.locator('[data-part="postcode"]');
    await postcode.pressSequentially('ABCDE');
    await postcode.press('Tab');
    await page.locator('body').click({ position: { x: 2, y: 2 } });
    await expect(address.locator(':scope > .fd-error')).toContainText('مصر');
    await expect(postcode).toHaveAttribute('aria-invalid', 'true');
    await address.scrollIntoViewIfNeeded();
    await screen(page, 'text-rules-postcode-ar', { viewport: true });
    await postcode.fill('');
    await postcode.pressSequentially(' ١١٥١١ ');
    await postcode.press('Tab');
    expect(((await valueOf(page, 'badge_address')) as Values)['postcode']).toBe('11511');
  });
});

test.describe('a colour as text', () => {
  test('takes a code typed or pasted, refuses anything else with words, and shows none when it has none', async ({ page }) => {
    await open(page, 'plain', 'page=business&skin=underline');
    const colour = node(page, 'f-epic-color');
    const code = colour.locator('.fd-colour-code');
    await code.click();
    await code.press('Control+A');
    await code.pressSequentially('#FF0000');
    expect(await valueOf(page, 'epic_color')).toBe('#ff0000');
    await code.press('Control+A');
    await paste(page, code, '1F2937');
    expect(await valueOf(page, 'epic_color')).toBe('#1f2937');
    await code.pressSequentially('z');
    await expect(hintOf(colour)).toHaveText('Enter a colour code, like #1f2937');
    await colour.scrollIntoViewIfNeeded();
    await screen(page, 'text-rules-colour', { viewport: true });
    await page.evaluate(() => (window as any).fieldiaDemo.handle.form.setValue('epic_color', null));
    await expect(colour.locator('.fd-colour-swatch')).toHaveClass(/fd-colour-none/);
  });
});

test.describe('a colour code that does not read', () => {
  for (const [locale, query, why] of [
    ['en', '', 'Enter a colour code, like #1f2937'],
    ['ar', '&locale=ar&dir=rtl', 'أدخل رمز لون، مثل #1f2937'],
  ] as const) {
    test(`${locale}: never changes the colour held: #12345 typed over #2c8397 leaves it, the box marked, why said as Tab reaches its ×`, async ({ page }) => {
      const { problems } = await open(page, 'plain', `page=business&skin=underline${query}`);
      const colour = node(page, 'f-epic-color');
      const code = colour.locator('.fd-colour-code');
      const swatch = colour.locator('.fd-colour-swatch');
      await page.evaluate(() => (window as any).fieldiaDemo.handle.form.setValue('epic_color', '#2c8397'));
      for (const typed of ['#12345', '#1234', '12345']) {
        await code.click();
        await code.press('Control+A');
        await code.pressSequentially(typed);
        // "#123" read on the way, then one digit more: the colour held comes back at once.
        expect(await valueOf(page, 'epic_color')).toBe('#2c8397');
        await page.keyboard.press('Tab');
        await expect(colour.locator('.fd-colour-clear')).toBeFocused();
        expect(await valueOf(page, 'epic_color')).toBe('#2c8397');
        expect(await swatch.evaluate((el) => el.style.getPropertyValue('--fd-swatch'))).toBe('#2c8397');
        await expect(code).toHaveValue(typed);
        await expect(code).toHaveAttribute('aria-invalid', 'true');
        // Still in the field, on its ×: why is shown, and the box is described by it.
        await expect(errorOf(page, 'f-epic-color')).toHaveText(why);
        const described = (await code.getAttribute('aria-describedby')) ?? '';
        expect(described).not.toBe('');
        expect(await page.evaluate((ids) => ids.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' '), described)).toContain(why);
      }
      await colour.scrollIntoViewIfNeeded();
      await screen(page, `text-rules-colour-unread-${locale}`, { viewport: true });
      expect(problems).toEqual([]);
    });
  }
});

test.describe('the hints in the dark and right to left', () => {
  test('read in the dark scheme, ltr and rtl', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    for (const [query, name] of [['', 'ltr'], ['&locale=ar&dir=rtl', 'rtl']] as const) {
      await open(page, 'plain', `page=fields&skin=outlined${query}`);
      const phone = node(page, 'f-phone');
      await phone.locator('input').click();
      await phone.locator('input').pressSequentially('x');
      await expect(hintOf(phone)).toBeVisible();
      const [color, background] = await hintOf(phone).evaluate((hint) => [getComputedStyle(hint).color, getComputedStyle(hint).backgroundColor]);
      expect(color).not.toBe(background);
      await phone.scrollIntoViewIfNeeded();
      await screen(page, `text-rules-hint-dark-${name}`, { viewport: true });
    }
  });
});
