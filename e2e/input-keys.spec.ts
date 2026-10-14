import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * The input rules and the keys that save, typed as a person types — keys one
 * at a time, Enter, Ctrl+Enter, Tab, a real Ctrl+V — in English, Arabic right
 * to left and French, on the plain demo and once on React. Enter in a one-line
 * box saves as it did before the rules came, with no false words; a save made
 * while a box still holds what was typed reads it first, never saving a value
 * passed on the way; the keys typed after a refused one wait in a phone number,
 * an email and a colour too; a time's one-digit minute is never quietly :03; a
 * date and time pasted into a date says its time was left out; a block pasted
 * into an hours column keeps to it, and one cell is "1 cell".
 */

// The clipboard is the browser's, one for every page a worker has open: these tests take turns with it.
test.describe.configure({ mode: 'default' });

const LOCALES = [
  ['en', ''],
  ['ar', '&locale=ar&dir=rtl'],
  ['fr', '&locale=fr'],
] as const;
type LocaleName = (typeof LOCALES)[number][0];

const stored = (page: Page, model: string, field: string) => page.evaluate(([m, f]) => (window as any).fieldiaDemo.dataSource.records[m][1][f], [model, field] as const);
const valueOf = (page: Page, field: string) => page.evaluate((f) => (window as any).fieldiaDemo.handle.form.getState().values[f], field);
/** A field's own box: a number's box (never the currency picked beside it, first in English), else its one box. */
const boxOf = (page: Page, id: string) => node(page, id).locator(/^f-(email|phone)$/.test(id) ? 'input' : 'input.fd-number-input').first();
const errorOf = (page: Page, id: string) => node(page, id).locator('.fd-error').first();
const hintsShown = (page: Page) => page.locator('.fd-refusal-hint:not([hidden])');

/** A box entered as a person enters it, its text all chosen so typing replaces it. */
async function enter(box: Locator) {
  await box.click();
  await box.press('Control+A');
}

/** Text put on the clipboard, then pasted with Ctrl+V. */
async function paste(page: Page, box: Locator, text: string) {
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await box.press('Control+V');
}

/** A number as the page's language writes its decimal mark. */
const decimal = (locale: LocaleName, text: string) => (locale === 'fr' ? text.replace('.', ',') : text);

const WORDS = {
  integer: { en: 'Workstations must be a whole number', ar: 'يجب أن يكون Workstations رقمًا صحيحًا', fr: 'Workstations doit être un nombre entier' },
  sixThree: {
    en: 'Time on site: “⁨6:3⁩” could be 6:03 or 6:30; write the minutes with two digits',
    ar: 'Time on site: «⁨6:3⁩» قد تعني 6:03 أو 6:30؛ اكتب الدقائق برقمين',
    fr: 'Time on site : « ⁨6:3⁩ » peut être 6:03 ou 6:30 ; écrivez les minutes avec deux chiffres',
  },
  kickoff: {
    en: 'Kick-off meeting: “⁨15/10/2026 14:3⁩” could be 14:03 or 14:30; write the minutes with two digits',
    ar: 'Kick-off meeting: «⁨15/10/2026 14:3⁩» قد تعني 14:03 أو 14:30؛ اكتب الدقائق برقمين',
    fr: 'Kick-off meeting : « ⁨15/10/2026 14:3⁩ » peut être 14:03 ou 14:30 ; écrivez les minutes avec deux chiffres',
  },
  timeLeftOut: {
    en: 'Start date takes a day only: the time 14:30 was left out',
    ar: 'Start date: يأخذ يومًا فقط، فتُرك الوقت 14:30',
    fr: 'Start date ne prend qu’un jour : l’heure 14:30 a été laissée de côté',
  },
  phone: { en: 'Enter a phone number, like +20 100 123 4567', ar: 'أدخل رقم هاتف، مثل ⁦+20 100 123 4567⁩', fr: 'Saisissez un numéro de téléphone, par exemple +33 1 23 45 67 89' },
  oneCell: { en: 'Pasted into 1 cell.', ar: 'لُصق في خلية واحدة.', fr: 'Collé dans 1 cellule.' },
} as const;

for (const [locale, query] of LOCALES) {
  test.describe(`${locale}: Enter and Ctrl+Enter with the input rules`, () => {
    let problems: string[] = [];
    test.beforeEach(async ({ context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    });
    test.afterEach(() => expect(problems).toEqual([]));

    test('Enter saves from a number, money, hours, a per cent and an email, and says nothing false', async ({ page }) => {
      ({ problems } = await open(page, 'plain', `page=fields&skin=outlined${query}`));
      for (const [id, field, typed, value] of [
        ['f-seats', 'seats', '7', 7],
        ['f-area', 'area', decimal(locale, '12.5'), 12.5],
        ['f-budget', 'budget', '5000', 5000],
        ['f-time-on-site', 'time_on_site', '6:30', 6.5],
        ['f-margin', 'margin', '25', 0.25],
        ['f-email', 'email', 'office@example.com', 'office@example.com'],
      ] as const) {
        const box = boxOf(page, id);
        await enter(box);
        await box.pressSequentially(typed);
        await box.press('Enter');
        await expect.poll(() => stored(page, 'project', field), `${id} saved by Enter`).toBe(value);
        await expect(hintsShown(page)).toHaveCount(0);
      }
      await screen(page, `input-keys-enter-${locale}`, { viewport: true });
    });

    test('Enter saves a name typed to its most, and says nothing of the most', async ({ page }) => {
      ({ problems } = await open(page, 'plain', `page=customer&skin=outlined${query}`));
      const name = node(page, '#title').locator('input');
      await name.fill('N'.repeat(119));
      await name.press('End');
      await name.pressSequentially('o');
      await name.press('Enter');
      await expect.poll(() => stored(page, 'partner', 'name')).toBe(`${'N'.repeat(119)}o`);
      await expect(hintsShown(page)).toHaveCount(0);
    });

    for (const [what, id, field, typed, key] of [
      ['Workstations "1.5"', 'f-seats', 'seats', '1.5', 'Control+Enter'],
      ['Workstations "1.5"', 'f-seats', 'seats', '1.5', 'Enter'],
      ['Workstations "1e5", its keys held', 'f-seats', 'seats', '1e5', 'Control+Enter'],
      ['Floor area "12.34"', 'f-area', 'area', '12.34', 'Control+Enter'],
      ['Margin "25.555"', 'f-margin', 'margin', '25.555', 'Control+Enter'],
      ['Time on site "6:305"', 'f-time-on-site', 'time_on_site', '6:305', 'Control+Enter'],
      ['Time on site "6:3"', 'f-time-on-site', 'time_on_site', '6:3', 'Enter'],
    ] as const) {
      test(`${key}: ${what} is never saved as a value passed on the way`, async ({ page }) => {
        ({ problems } = await open(page, 'plain', `page=fields&skin=outlined${query}`));
        const before = await stored(page, 'project', field);
        const text = decimal(locale, typed);
        const box = boxOf(page, id);
        await enter(box);
        await box.pressSequentially(text);
        await box.press(key);
        // Refused, with its words under the box; the box keeps what was typed; nothing saved.
        await expect(errorOf(page, id)).toBeVisible();
        await expect(errorOf(page, id)).not.toBeEmpty();
        await expect(box).toHaveValue(text);
        await expect(box).toHaveAttribute('aria-invalid', 'true');
        expect(await stored(page, 'project', field)).toBe(before);
        if (id === 'f-seats' && typed === '1.5') await expect(errorOf(page, id)).toHaveText(WORDS.integer[locale]);
        if (typed === '6:3') await expect(errorOf(page, id)).toHaveText(WORDS.sixThree[locale]);
        if (key === 'Control+Enter' && typed === '1.5') await screen(page, `input-keys-ctrl-enter-${locale}`, { viewport: true });
      });
    }

    test('a phone number and an email are never made of the keys round a refused one', async ({ page }) => {
      ({ problems } = await open(page, 'plain', `page=fields&skin=outlined${query}`));
      const phone = boxOf(page, 'f-phone');
      await enter(phone);
      await phone.pressSequentially('+20 1oo 123 4567');
      await expect(phone).toHaveValue('+20 1');
      await expect(node(page, 'f-phone').locator('.fd-refusal-hint')).toBeVisible();
      await phone.press('Tab');
      await expect(phone).toHaveValue('+20 1oo 123 4567');
      await expect(errorOf(page, 'f-phone')).toHaveText(WORDS.phone[locale]);
      const email = boxOf(page, 'f-email');
      await enter(email);
      await email.pressSequentially('ahmed ali@example.com');
      await email.press('Control+Enter');
      await expect(email).toHaveValue('ahmed ali@example.com');
      await expect(errorOf(page, 'f-email')).toBeVisible();
      expect(await stored(page, 'project', 'phone')).not.toBe('+20 1oo 123 4567');
      expect(await stored(page, 'project', 'email')).not.toBe('ahmedali@example.com');
      await screen(page, `input-keys-phone-${locale}`, { viewport: true });
    });

    test('a colour code is never made of the keys round a refused one', async ({ page }) => {
      ({ problems } = await open(page, 'plain', `page=business&skin=underline${query}`));
      const code = node(page, 'f-epic-color').locator('.fd-colour-code');
      for (const typed of ['#1x23', '2c8 397']) {
        await enter(code);
        await code.pressSequentially(typed);
        await code.press('Tab');
        await expect(code).toHaveValue(typed);
        await expect(code).toHaveAttribute('aria-invalid', 'true');
        await expect(errorOf(page, 'f-epic-color')).toBeVisible();
        expect(await valueOf(page, 'epic_color')).toBe('#2c8397');
      }
    });

    test('a time of one digit of minutes is never quietly :03, and a date’s box says the time it left out', async ({ page }) => {
      ({ problems } = await open(page, 'plain', `page=fields&skin=outlined${query}`));
      const kickoff = node(page, 'f-kickoff').locator('input').first();
      const held = await valueOf(page, 'kickoff');
      await enter(kickoff);
      await kickoff.pressSequentially('15/10/2026 14:3');
      await kickoff.press('Tab');
      await expect(errorOf(page, 'f-kickoff')).toHaveText(WORDS.kickoff[locale]);
      expect(await valueOf(page, 'kickoff')).toBe(held);
      const start = node(page, 'f-start').locator('input').first();
      await enter(start);
      await paste(page, start, '15/10/2026 14:30');
      await expect(node(page, 'f-start').locator('.fd-refusal-hint')).toHaveText(WORDS.timeLeftOut[locale]);
      await screen(page, `input-keys-time-left-out-${locale}`, { viewport: true });
      await start.press('Tab');
      expect(await valueOf(page, 'start_date')).toBe('2026-10-15');
    });

    test('a block pasted into an hours column keeps to it, and one cell is one', async ({ page }) => {
      ({ problems } = await open(page, 'plain', `page=business&skin=underline${query}`));
      const grid = node(page, 'f-subtasks');
      const cell = grid.locator('.ag-row[row-index="0"] .ag-cell[col-id="allocated_hours"]');
      await cell.click();
      await expect(grid.locator('.fd-grid-editor input').first()).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(cell).toBeFocused();
      const before = await page.evaluate(() => ((window as any).fieldiaDemo.handle.form.getState().values.child_ids as { values: Record<string, unknown> }[])[0].values['allocated_hours']);
      await page.evaluate(() => navigator.clipboard.writeText('6:3'));
      await page.keyboard.press('Control+V');
      const note = grid.locator('.fd-grid-paste-note');
      await expect(note).toBeVisible();
      await expect(note).not.toContainText(WORDS.oneCell[locale]);
      expect(await page.evaluate(() => ((window as any).fieldiaDemo.handle.form.getState().values.child_ids as { values: Record<string, unknown> }[])[0].values['allocated_hours'])).toBe(before);
      await page.evaluate(() => navigator.clipboard.writeText('2:15'));
      await page.keyboard.press('Control+V');
      await expect(note).toHaveText(WORDS.oneCell[locale]);
      expect(await page.evaluate(() => ((window as any).fieldiaDemo.handle.form.getState().values.child_ids as { values: Record<string, unknown> }[])[0].values['allocated_hours'])).toBe(2.25);
    });
  });
}

test.describe('react: Enter and Ctrl+Enter with the input rules', () => {
  let problems: string[] = [];
  test.afterEach(() => expect(problems).toEqual([]));

  test('Enter saves from a number box; Ctrl+Enter never saves "1.5" as 1', async ({ page }) => {
    ({ problems } = await open(page, 'react', 'page=fields&skin=outlined'));
    const seats = boxOf(page, 'f-seats');
    await enter(seats);
    await seats.pressSequentially('7');
    await seats.press('Enter');
    await expect.poll(() => stored(page, 'project', 'seats')).toBe(7);
    await expect(hintsShown(page)).toHaveCount(0);
    await enter(seats);
    await seats.pressSequentially('1.5');
    await seats.press('Control+Enter');
    await expect(errorOf(page, 'f-seats')).toHaveText(WORDS.integer.en);
    await expect(seats).toHaveValue('1.5');
    expect(await stored(page, 'project', 'seats')).toBe(7);
    await screen(page, 'input-keys-react', { viewport: true });
  });
});
