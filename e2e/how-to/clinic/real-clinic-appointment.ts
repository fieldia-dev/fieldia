import type { Page } from '@playwright/test';
import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';
import { hhmm } from './support';

/** The appointment's status, and a field's words where it is read-only. */
const apptStatus = (page: Page) => page.locator('.fd-header .fd-statusbar [aria-current="step"]');
const apptRead = (page: Page, id: string) => page.locator(`[data-node="${id}"] .fd-read-text`);
/** "26 Oct 2026, 11:30" and so many minutes on: the same, as the page writes it. */
const later = (when: string, minutes: number) => {
  const [, day, mon, year, h, m] = when.match(/^(\d{1,2}) (\w{3}) (\d{4}), (\d{2}):(\d{2})$/)!;
  const at = new Date(`${day} ${mon} ${year} ${h}:${m}`);
  at.setMinutes(at.getMinutes() + minutes);
  return `${at.getDate()} ${at.toLocaleString('en-GB', { month: 'short' })} ${at.getFullYear()}, ${hhmm(at.getHours() * 60 + at.getMinutes())}`;
};

/** The real-clinic-appointment demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Press Confirm, then Check In: the status moves along',
      async run({ page, press, see }) {
        await see(apptStatus(page)).toHaveText('Booked');
        await press(page.getByRole('button', { name: 'Confirm', exact: true }));
        await see(apptStatus(page)).toHaveText('Confirmed');
        await see(page.getByRole('button', { name: 'Confirm', exact: true })).toBeHidden();
        await see(apptRead(page, 'f-arrival')).toHaveText('');
        await press(page.getByRole('button', { name: 'Check In', exact: true }));
        await see(apptStatus(page)).toHaveText('Arrived');
        await see(page.getByRole('combobox', { name: /^Flow Stage/ })).toHaveValue('Checked In');
        await see(apptRead(page, 'f-arrival')).toHaveText(/^\d{1,2} \w{3} \d{4}, \d{2}:\d{2}$/);
        await see(page.getByRole('button', { name: 'Check In', exact: true })).toBeHidden();
        await see(page.getByRole('button', { name: 'Take to Room' })).toBeVisible();
        await see(page.getByRole('button', { name: 'Open Session' })).toBeVisible();
      },
    },
    {
      says: 'Press Take to Room, then Open Session',
      async run({ page, press, see }) {
        await press(page.getByRole('button', { name: 'Take to Room' }));
        // In the room: in progress, its first in-room stage, seen now.
        await see(apptStatus(page)).toHaveText('In Progress');
        await see(page.getByRole('combobox', { name: /^Flow Stage/ })).toHaveValue('Consultation');
        await see(apptRead(page, 'f-seen')).toHaveText(/^\d{1,2} \w{3} \d{4}, \d{2}:\d{2}$/);
        await press(page.getByRole('button', { name: 'Open Session' }));
        await see(page.locator('.fd-say', { hasText: /^Treatment session S-\d{5} is open, with its consent forms\./ })).toBeVisible();
        await see(page.locator('[data-node="f-session"]')).toContainText(/S-\d{5}/);
        await see(page.locator('.fd-status').first()).toHaveText('Saved');
      },
    },
    {
      says: 'Change Duration (min) or Start: End follows',
      async run({ page, press, type, keys, see }) {
        const start = await page.getByRole('textbox', { name: 'Start*' }).inputValue();
        const end = apptRead(page, 'f-stop');
        await see(end).toHaveText(later(start, 45));
        await type(page.getByRole('textbox', { name: 'Duration (min)' }), '60', { clear: true });
        await keys('Tab');
        await see(end).toHaveText(later(start, 60));
        // A service picked: its own length, and the end after it.
        const service = page.getByRole('combobox', { name: 'Service' });
        await type(service, 'Chem', { clear: true });
        await press(page.getByRole('option', { name: 'Chemical peel' }));
        await see(service).toHaveValue('Chemical peel');
        await see(page.getByRole('textbox', { name: 'Duration (min)' })).toHaveValue('30');
        await see(end).toHaveText(later(start, 30));
      },
    },
    {
      says: 'Type a Deposit: Register Deposit appears',
      async run({ page, type, keys, see }) {
        const risk = page.locator('[data-node="f-risk-score"]');
        const before = Number((await risk.innerText()).match(/\d+/)![0]);
        await see(page.getByRole('button', { name: 'Register Deposit' })).toBeHidden();
        await type(page.getByRole('textbox', { name: 'Deposit' }), '300', { clear: true });
        await keys('Tab');
        await see(page.getByRole('button', { name: 'Register Deposit' })).toBeVisible();
        await expect.poll(async () => Number((await risk.innerText()).match(/\d+/)![0])).toBeLessThan(before);
        await see(risk).not.toContainText(String(before));
      },
    },
    {
      says: 'Press Cancel with no reason: it is refused',
      async run({ page, press, type, see }) {
        const status = (await apptStatus(page).innerText()).trim();
        await press(page.getByRole('button', { name: 'Cancel', exact: true }));
        await see(page.locator('.fd-say', { hasText: 'Set a cancellation reason before cancelling.' })).toBeVisible();
        await see(apptStatus(page)).toHaveText(status);
        const reason = page.getByRole('combobox', { name: 'Cancellation Reason' });
        await type(reason, 'Ill');
        await press(page.getByRole('option', { name: 'Illness' }));
        await see(reason).toHaveValue('Illness');
        await press(page.getByRole('button', { name: 'Cancel', exact: true }));
        await see(page.locator('.fd-header .fd-statusbar')).toContainText('Cancelled');
        await see(apptStatus(page)).toHaveText('Cancelled');
      },
    },
  ],
};
