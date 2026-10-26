import { expect } from '../../fixtures';
import type { DemoReplay, Hand } from '../hand';
import { followLink, part } from './support';

/** Text put on the clipboard, then pasted with Ctrl+V where the focus is (e2e/long-paste.spec.ts's way). */
async function paste({ page, phone }: Hand, text: string) {
  if (!phone) await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate((words) => navigator.clipboard.writeText(words), text);
  await page.keyboard.press('Control+V');
}

export const replay: DemoReplay = {
  steps: [
    {
      says: 'Type 01/06/1448 in the Hijri box beside Starts on',
      async run({ page, press, type, keys, see }) {
        const starts = page.getByRole('textbox', { name: 'Starts on*' });
        const hijri = page.getByRole('textbox', { name: 'Starts on (Hijri)' });
        await see(starts).toHaveValue('13 Oct 2026');
        await see(hijri).toHaveValue('2 Jumada I 1448 AH');
        await press(hijri);
        // Ready to type as it is typed: its digits.
        await see(hijri).toHaveValue('02/05/1448');
        await type(hijri, '01/06/1448', { clear: true });
        await keys('Tab');
        // 1 Jumada II 1448 is 11 November 2026, by Umm al-Qura's reckoning.
        await see(starts).toHaveValue('11 Nov 2026');
        await see(hijri).toHaveValue('1 Jumada II 1448 AH');
        // The other way round: a Gregorian day typed, its Hijri day follows.
        await type(starts, '15/11/2026', { clear: true });
        await keys('Tab');
        await see(hijri).toHaveValue('5 Jumada II 1448 AH');
      },
    },
    {
      says: 'Type 30 in a Hijri month of 29 days and leave the box',
      async run({ page, type, keys, see }) {
        const starts = page.getByRole('textbox', { name: 'Starts on*' });
        const hijri = page.getByRole('textbox', { name: 'Starts on (Hijri)' });
        // Jumada II 1448 has 29 days by Umm al-Qura.
        await type(hijri, '30/06/1448', { clear: true });
        await keys('Tab');
        await see(part(page, 'f-starts').locator('.fd-error, [role="alert"]').first()).toContainText('has 29 days');
        await see(hijri).toHaveAttribute('aria-invalid', 'true');
        await see(starts).toHaveValue('15 Nov 2026');
      },
    },
    {
      says: 'Open the calendar of Ends on: each day shows its Hijri day under it',
      async run({ page, press, see }) {
        const ends = part(page, 'f-ends');
        const button = ends.getByRole('button', { name: 'Choose a date' });
        await press(button);
        const calendar = ends.locator('.fd-calendar');
        await see(calendar).toBeVisible();
        await see(calendar.locator('.fd-calendar-title')).toContainText(/October 2027 · .*1449 AH/);
        const days = calendar.locator('.fd-calendar-grid button, [role="grid"] button');
        const hijriDays = calendar.locator('.fd-calendar-hijri');
        await see(hijriDays.first()).toHaveText(/^\d{1,2}$/);
        expect(await hijriDays.count()).toBe(await days.count());
        await see(calendar.locator('button[aria-selected="true"] .fd-calendar-hijri')).toHaveText('2');
        await press(button);
        await see(calendar).toBeHidden();
      },
    },
    {
      says: 'Type Oct 2026 or 10/2026 in First rent’s month',
      async run({ page, press, type, keys, see }) {
        const month = page.getByRole('textbox', { name: 'First rent’s month' });
        await see(month).toHaveAttribute('placeholder', 'mm/yyyy');
        await type(month, 'Oct 2026');
        await keys('Tab');
        await see(month).toHaveValue('Oct 2026');
        await see(part(page, 'f-first-rent').locator('.fd-error').filter({ hasText: /\S/ })).toHaveCount(0);
        await type(month, '10/2026', { clear: true });
        await keys('Tab');
        await see(month).toHaveValue('Oct 2026');
        // The year its button opens: September, gone by on the demo's clock (21 Oct 2026, pinned by its address),
        // faint, and refused with why; December picked.
        await press(part(page, 'f-first-rent').getByRole('button', { name: 'Choose a month' }));
        const months = part(page, 'f-first-rent').locator('.fd-calendar-periods button');
        await see(months).toHaveCount(12);
        await see(months.nth(8)).toHaveClass(/fd-off/);
        await press(months.nth(8));
        await see(part(page, 'f-first-rent').locator('.fd-calendar-note')).toHaveText('First rent’s month can’t be before Oct 2026');
        await press(months.nth(11));
        await see(month).toHaveValue('Dec 2026');
      },
    },
    {
      says: 'Type 1998 in Building built in: a year alone',
      async run(hand) {
        const { page, type, keys, see } = hand;
        const built = page.getByRole('textbox', { name: 'Building built in' });
        await see(built).toHaveAttribute('placeholder', 'yyyy');
        await type(built, '1998', { clear: true });
        await keys('Tab');
        await see(built).toHaveValue('1998');
        await see(part(page, 'f-built').locator('.fd-error').filter({ hasText: /\S/ })).toHaveCount(0);
        // The language switched by the step's link: the Hijri days in Arabic, the page right to left.
        await followLink(hand, 'Switch the language to Arabic');
        await see(page.locator('.fd-form').first()).toHaveAttribute('dir', 'rtl');
        await see(part(page, 'f-starts').locator('input[data-kind="hijri"]')).toHaveValue('2 جمادى الأولى 1448 هـ');
        await see(part(page, 'f-ends').locator('input[data-kind="hijri"]')).toHaveValue('2 جمادى الأولى 1449 هـ');
        // Back to English, as the steps after this one read it.
        await followLink(hand, 'Back to English');
        await see(page.locator('.fd-form').first()).not.toHaveAttribute('dir', 'rtl');
        await see(page.getByRole('textbox', { name: 'Starts on (Hijri)' })).toHaveValue('2 Jumada I 1448 AH');
      },
    },
    {
      says: 'Type a car plate as 4821rka: the space and the capitals are written in',
      async run({ page, type, see }) {
        const plate = page.getByRole('textbox', { name: 'Car plate for the parking' });
        await type(plate, '4821rka');
        await see(plate).toHaveValue('4821 RKA');
        // A letter where a digit goes: refused, and why said under the box.
        await type(plate, '48a', { clear: true });
        await see(plate).toHaveValue('48');
        await see(part(page, 'f-plate').locator('.fd-refusal-hint')).toHaveText(/Car plate for the parking: a digit goes here, not “.?a.?”/);
      },
    },
    {
      says: 'Paste a code such as 482 913 into the code boxes',
      async run(hand) {
        const { page, press, keys, see } = hand;
        const code = part(page, 'f-code');
        const cells = code.locator('.fd-code-cell');
        await see(cells).toHaveCount(6);
        // A press on the boxes: the one text box drawn over them takes it.
        await press(code.locator('input'));
        await paste(hand, '482 913');
        await see(cells).toHaveText(['4', '8', '2', '9', '1', '3']);
        await keys('Backspace', 'Backspace');
        await see(cells).toHaveText(['4', '8', '2', '9', '', '']);
        // Left at four digits, by a press elsewhere: two still to type.
        await press(page.getByRole('textbox', { name: 'Tenant*' }));
        await see(code.locator('.fd-error')).toHaveText('Code sent to the tenant’s phone is not whole yet: 2 more to type');
      },
    },
    {
      says: 'Type 120k in Yearly rent: it says “120k is 120,000”',
      async run({ page, type, keys, see }) {
        const rent = page.getByRole('textbox', { name: 'Yearly rent' });
        await type(rent, '120k', { clear: true });
        await see(part(page, 'f-rent').locator('.fd-shorthand-said')).toHaveText('120k is 120,000');
        await keys('Tab');
        await see(rent).toHaveValue('120,000');
        await see(part(page, 'f-rent').locator('.fd-shorthand-said')).toBeHidden();
      },
    },
    {
      says: 'Search for an agent: each shows their role under the name',
      async run({ page, press, type, see }) {
        const agent = page.getByRole('combobox', { name: 'Agent' });
        await type(agent, 'al', { clear: true });
        const noura = part(page, 'f-agent').getByRole('option', { name: 'Noura Al-Qahtani', exact: true });
        await see(noura).toBeVisible();
        await see(noura.locator('.fd-option-caption')).toHaveText('Senior leasing agent');
        await see(noura.locator('.fd-option-dot')).toHaveAttribute('data-color', /^\d+$/);
        await see(noura.locator('.fd-option-aside')).toHaveText('12 leases');
        // Each agent found: a role, a colour, and what they hold now (a property manager's in units).
        for (const name of ['Noura Al-Qahtani', 'Omar Al-Shehri', 'Huda Al-Mutairi', 'Saad Al-Dossary']) {
          const option = part(page, 'f-agent').getByRole('option', { name, exact: true });
          await see(option.locator('.fd-option-caption')).toHaveText(/\S/);
          await see(option.locator('.fd-option-dot')).toBeVisible();
          await see(option.locator('.fd-option-aside')).toHaveText(/^\d+ (leases?|units?)$/);
        }
        await press(noura);
        await see(agent).toHaveValue('Noura Al-Qahtani');
      },
    },
  ],
};
