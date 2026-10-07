import { expect, test, type Page } from '@playwright/test';
import { expectNoSidewaysScroll, node, open, screen } from './support';
import { VARIANTS } from './variants';

/**
 * The people lane's real pages — Sherkety ERP's clinic appointment, time off
 * request, employee and maintenance request, rebuilt from their Flectra views —
 * used by a person in every framework's demo: an appointment confirmed and the
 * patient checked in; a half-day leave that hides its end date while the
 * duration follows; a leave approved through its two approvals; an employee's
 * family status and badge; a maintenance request's priority, duration and
 * stage. No page may log an error or throw.
 */

const WIDE = { width: 1280, height: 900 };
const PHONE = { width: 390, height: 844 };
const current = (page: Page) => page.locator('.fd-header .fd-statusbar [aria-current="step"]');
const button = (page: Page, id: string) => page.locator(`button[data-node="${id}"]`);
const toast = (page: Page, words: string) => page.locator('.fd-say', { hasText: words });
const value = (page: Page, name: string) => page.evaluate((n) => (window as any).fieldiaDemo.handle.form.getState().values[n], name);
/** What the in-memory server holds for a record now, after its saves. */
const stored = (page: Page, model: string, id: number) => page.evaluate(([m, i]) => (window as any).fieldiaDemo.dataSource.records[m][i], [model, id] as const);
const settled = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.settled());
/** Pick a choice in a long list, which is searched as it is typed. */
async function choose(page: Page, id: string, label: string) {
  const box = node(page, id).getByRole('combobox');
  await box.click();
  await box.fill(label);
  await node(page, id).getByRole('option', { name: label, exact: true }).click();
  await expect(box).toHaveValue(label);
}

for (const variant of VARIANTS) {
  test.describe(variant, () => {
    test('clinic appointment: confirmed, then the patient checked in; a cancel without a reason refused', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, 'page=real-clinic-appointment&record=4001&skin=underline');
      await expect(current(page)).toHaveText('Booked');
      // Booked: Confirm and Check In, No Show and Cancel; nothing that needs the patient in the building.
      for (const id of ['action_confirm', 'action_check_in', 'action_no_show', 'action_cancel']) await expect(button(page, id)).toBeVisible();
      for (const id of ['action_start', 'action_create_session', 'action_done', 'action_register_deposit']) await expect(button(page, id)).toBeHidden();
      if (variant === 'plain') await screen(page, 'real-clinic-appointment');

      // Cancel with no reason: refused with Flectra's own words, and the status stays.
      await button(page, 'action_cancel').click();
      await expect(toast(page, 'Set a cancellation reason before cancelling.')).toBeVisible();
      await expect(current(page)).toHaveText('Booked');

      // Confirm: the status moves on and Confirm goes; Check In stays.
      await button(page, 'action_confirm').click();
      await expect(current(page)).toHaveText('Confirmed');
      await expect(button(page, 'action_confirm')).toBeHidden();
      await expect(button(page, 'action_check_in')).toBeVisible();
      await settled(page);
      expect((await stored(page, 'clinic.appointment', 4001)).state).toBe('confirmed');

      // Check In: arrived now, in the first flow stage; Take to Room and Open Session take over.
      await button(page, 'action_check_in').click();
      await expect(current(page)).toHaveText('Arrived');
      await expect(node(page, 'f-stage').getByRole('combobox')).toHaveValue('Checked In');
      expect(await value(page, 'arrival_time')).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
      await expect(button(page, 'action_check_in')).toBeHidden();
      await expect(button(page, 'action_start')).toBeVisible();
      await expect(button(page, 'action_create_session')).toBeVisible();
      await settled(page);
      expect((await stored(page, 'clinic.appointment', 4001)).state).toBe('arrived');

      // A longer duration moves the end, as the server works it out.
      const box = node(page, 'f-duration').locator('input');
      await box.fill('60');
      await box.press('Tab');
      await expect.poll(() => value(page, 'stop')).toMatch(/T12:30$/);

      // A deposit: Register Deposit appears.
      await node(page, 'f-deposit').locator('input').fill('300');
      await node(page, 'f-deposit').locator('input').press('Tab');
      await expect(button(page, 'action_register_deposit')).toBeVisible();
      expect(problems).toEqual([]);
    });

    test('time off: half a day hides the end date, and the duration follows', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, 'page=real-time-off&record=4172&skin=underline');
      // Compensatory Days are taken in hours: two full days, their hours beside them.
      await expect(node(page, 'f-dates-from')).toBeVisible();
      await expect(node(page, 'f-dates-to')).toBeVisible();
      await expect(node(page, 'f-duration-days').locator('input')).toHaveValue('2.00');
      await expect(node(page, 'f-duration-hours-beside').locator('input')).toHaveValue('(16 Hours)');
      await expect(node(page, 'f-date')).toBeHidden();
      await expect(node(page, 'f-period')).toBeHidden();

      // Half Day: one date and its half; the end date and the day count go; the hours read 4.
      await node(page, 'f-half').locator('input').check();
      await expect(node(page, 'f-dates-to')).toBeHidden();
      await expect(node(page, 'f-dates-from')).toBeHidden();
      await expect(node(page, 'f-date')).toBeVisible();
      await expect(node(page, 'f-period')).toBeVisible();
      await expect(node(page, 'f-duration-days')).toBeHidden();
      await expect(node(page, 'f-duration-hours').locator('input')).toHaveValue('4 Hours');
      // Custom Hours and Half Day are one or the other.
      await node(page, 'f-hours').locator('input').check();
      await expect(node(page, 'f-half').locator('input')).not.toBeChecked();
      await expect(node(page, 'f-hour-from')).toBeVisible();
      await choose(page, 'f-hour-from', '9:00 AM');
      await choose(page, 'f-hour-to', '1:30 PM');
      await expect(node(page, 'f-duration-hours').locator('input')).toHaveValue('4.5 Hours');
      if (variant === 'plain') await screen(page, 'real-time-off-custom-hours');

      // Back to whole days: the end date returns, and the count of working days follows it.
      await node(page, 'f-hours').locator('input').uncheck();
      await expect(node(page, 'f-dates-to')).toBeVisible();
      const from = (await value(page, 'request_date_from')) as string;
      // From a Wednesday to the Sunday after: Wednesday, Thursday and Sunday, Friday and Saturday off.
      const sunday = new Date(`${from}T12:00`);
      sunday.setDate(sunday.getDate() + 4);
      const iso = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;
      await node(page, 'f-dates-to').locator('input').fill(iso);
      await node(page, 'f-dates-to').locator('input').press('Tab');
      await expect(node(page, 'f-duration-days').locator('input')).toHaveValue('3.00');
      await expect(node(page, 'f-duration-hours-beside').locator('input')).toHaveValue('(24 Hours)');
      expect(problems).toEqual([]);
    });

    test('time off: approved by the manager, then validated by the officer', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, 'page=real-time-off&record=4171&skin=underline');
      if (variant === 'plain') await screen(page, 'real-time-off');
      await expect(current(page)).toHaveText('To Approve');
      await expect(button(page, 'action_confirm')).toBeHidden();
      await expect(button(page, 'action_validate')).toBeHidden();

      // Paid Time Off takes two approvals: the first leaves it in Second Approval.
      await button(page, 'action_approve').click();
      await expect(current(page)).toHaveText('Second Approval');
      await expect(toast(page, 'First approval given')).toBeVisible();
      await expect(button(page, 'action_approve')).toBeHidden();
      await expect(button(page, 'action_validate')).toBeVisible();
      await expect(button(page, 'action_refuse')).toBeVisible();
      await settled(page);
      expect((await stored(page, 'hr.leave', 4171)).state).toBe('validate1');

      await button(page, 'action_validate').click();
      await expect(current(page)).toHaveText('Approved');
      await expect(toast(page, 'Approved: Salma Adel, Paid Time Off.')).toBeVisible();
      await expect(button(page, 'action_validate')).toBeHidden();
      await settled(page);
      const saved = await stored(page, 'hr.leave', 4171);
      expect(saved.state).toBe('validate');
      expect(saved.first_approver_id).toEqual({ id: 4125, label: 'Mona Khalil' });
      expect(saved.second_approver_id).toEqual({ id: 4125, label: 'Mona Khalil' });
      // Approved, the request is locked: its type and dates read only.
      await expect(node(page, 'f-type').getByRole('combobox')).toHaveAttribute('readonly', '');
      expect(problems).toEqual([]);
    });

    test('time off: cancelled with a reason, in the wizard', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, 'page=real-time-off&record=4174&skin=underline');
      await expect(page.locator('.fd-ribbon')).toBeHidden();
      await button(page, 'action_cancel').click();
      const dialog = page.getByRole('dialog', { name: 'Cancel Time Off' });
      await expect(dialog).toBeVisible();
      await dialog.locator('[data-node="f-reason"] textarea').fill('The Sahel booking fell through.');
      if (variant === 'plain') await screen(page, 'real-time-off-cancel', { viewport: true });
      await page.keyboard.press('ControlOrMeta+Enter');
      await expect(dialog).toBeHidden();
      await expect(page.locator('.fd-ribbon')).toHaveText('Canceled');
      await expect(button(page, 'action_cancel')).toBeHidden();
      await settled(page);
      expect((await stored(page, 'hr.leave', 4174)).active).toBe(false);
      expect(problems).toEqual([]);
    });

    test('employee: the spouse goes with a single status; a badge generated', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, 'page=real-employee&record=4122&skin=underline');
      await expect(page.locator('[data-node="stat-time-off"]')).toContainText('12.5/21 Days');
      await expect(page.locator('[data-node="presence-present"]')).toBeVisible();
      if (variant === 'plain') await screen(page, 'real-employee');

      await page.getByRole('tab', { name: 'Private Information' }).click();
      await expect(node(page, 'f-spouse-name')).toBeVisible();
      await node(page, 'f-marital').locator('select').selectOption({ label: 'Single' });
      await expect(node(page, 'f-spouse-name')).toBeHidden();
      await expect(node(page, 'f-spouse-birthdate')).toBeHidden();
      if (variant === 'plain') await screen(page, 'real-employee-private');

      await page.getByRole('tab', { name: 'HR Settings' }).click();
      await expect(button(page, 'generate_random_barcode')).toBeVisible();
      await expect(button(page, 'print_badge')).toBeHidden();
      await button(page, 'generate_random_barcode').click();
      await expect(node(page, 'f-barcode').locator('input')).toHaveValue(/^041\d{9}$/);
      await expect(button(page, 'generate_random_barcode')).toBeHidden();
      await expect(button(page, 'print_badge')).toBeVisible();

      // Launch Plan: the plan's activities, listed once one is picked.
      await button(page, 'launch_plan').click();
      const dialog = page.getByRole('dialog', { name: 'Launch Plan' });
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('[data-node="f-summary"]')).toBeHidden();
      const plan = dialog.locator('[data-node="f-plan"]').getByRole('combobox');
      await plan.click();
      await plan.fill('Onb');
      await dialog.getByRole('option', { name: 'Onboarding', exact: true }).click();
      await expect(dialog.locator('[data-node="f-summary"]')).toContainText('Setup IT materials: Ahmed Tawfik');
      if (variant === 'plain') await screen(page, 'real-employee-plan', { viewport: true });
      await dialog.getByRole('button', { name: 'Save & Close' }).click();
      await expect(dialog).toBeHidden();
      await expect(toast(page, 'The plan is launched')).toBeVisible();

      // Time Off: her request, opened in the employee's place.
      await page.locator('.fd-header').getByRole('button', { name: 'Save' }).click();
      await settled(page);
      await page.locator('[data-node="stat-time-off"]').click();
      await expect(page.locator('[data-node="f-display-name"] input')).toHaveValue(/^Salma Adel on Paid Time Off/);
      expect(problems).toEqual([]);
    });

    test('maintenance request: priority, duration and stage set, then saved', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, 'page=real-maintenance-request&record=4371&skin=underline');
      await expect(current(page)).toHaveText('In Progress');
      await expect(node(page, 'f-close-date')).toBeHidden();
      if (variant === 'plain') await screen(page, 'real-maintenance-request');

      // Two stars of three: Normal.
      await node(page, 'f-priority').locator('button[data-value="2"]').click();
      expect(await value(page, 'priority')).toBe(2);
      // No "Clear selection", as Flectra has none (clear: false): the star picked, clicked again, goes back to Very Low.
      await expect(node(page, 'f-priority').locator('.fd-choice-clear')).toBeHidden();
      await expect(node(page, 'f-type').locator('.fd-choice-clear')).toBeHidden();
      await node(page, 'f-priority').locator('button[data-value="2"]').click();
      expect(await value(page, 'priority')).toBeNull();
      await node(page, 'f-priority').locator('button[data-value="2"]').click();
      expect(await value(page, 'priority')).toBe(2);
      const duration = node(page, 'f-duration').locator('input');
      await duration.fill('3.75');
      await duration.press('Tab');
      expect(await value(page, 'duration')).toBe(3.75);

      // Repaired closes it: the close date appears, today's.
      await page.locator('.fd-header .fd-statusbar').getByRole('button', { name: 'Repaired' }).click();
      await expect(current(page)).toHaveText('Repaired');
      await expect(node(page, 'f-close-date')).toBeVisible();
      // The step clicked keeps the focus, so the keys still save: Ctrl+Enter, as Flectra's Alt+S.
      await expect(page.locator('.fd-header .fd-statusbar').getByRole('button', { name: 'Repaired' })).toBeFocused();
      await page.keyboard.press('ControlOrMeta+Enter');
      await settled(page);
      const saved = await stored(page, 'maintenance.request', 4371);
      expect(saved.priority).toBe(2);
      expect(saved.duration).toBe(3.75);
      expect(saved.stage_id).toEqual({ id: 4333, label: 'Repaired' });
      expect(saved.close_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Preventive work may repeat: Recurrent shows, and the rule under it.
      await node(page, 'f-type').getByRole('radio', { name: 'Preventive' }).check();
      await expect(node(page, 'f-recurring')).toBeVisible();
      await expect(node(page, 'f-repeat-interval')).toBeHidden();
      await node(page, 'f-recurring').locator('input').check();
      await expect(node(page, 'f-repeat-interval')).toBeVisible();
      await expect(node(page, 'f-repeat-until')).toBeHidden();
      await node(page, 'f-repeat-type').locator('select').selectOption({ label: 'Until' });
      await expect(node(page, 'f-repeat-until')).toBeVisible();
      expect(problems).toEqual([]);
    });

    test('maintenance request: Repeat Every on one row in its column, its label with the others, at any width', async ({ page }) => {
      const box = async (selector: string) => (await page.locator(selector).first().boundingBox())!;
      for (const [width, look] of [[1440, ''], [1100, ''], [900, ''], [1440, '&locale=ar&dir=rtl'], [390, '']] as const) {
        await page.setViewportSize({ width, height: 900 });
        const { problems } = await open(page, variant, `page=real-maintenance-request&record=4372&skin=underline${look}`);
        await expect(node(page, 'g-repeat')).toBeVisible();
        const column = await box('[data-node="g-main-right"]');
        const parts = await Promise.all(['f-repeat-interval', 'f-repeat-unit', 'f-repeat-type'].map((id) => box(`[data-node="${id}"] :is(input, select)`)));
        // Inside the column, every part: nothing past either edge.
        for (const part of parts) {
          expect(part.x).toBeGreaterThanOrEqual(column.x - 1);
          expect(part.x + part.width).toBeLessThanOrEqual(column.x + column.width + 1);
        }
        const label = await box('[data-node="f-repeat-interval"] .fd-label');
        const team = await box('[data-node="f-team"] .fd-label');
        const teamValue = await box('[data-node="f-team"] input');
        if (width === 390) {
          // A phone: the label above, the parts one under another.
          expect(label.y + label.height).toBeLessThanOrEqual(parts[0].y + 1);
          expect(parts[1].y).toBeGreaterThan(parts[0].y);
        } else {
          // One row, in the values' room, its label where the column's labels are.
          expect(new Set(parts.map((p) => Math.round(p.y))).size).toBe(1);
          expect(Math.abs(label.x - team.x)).toBeLessThan(2);
          const rtl = look.includes('rtl');
          const valueEdge = rtl ? teamValue.x + teamValue.width : teamValue.x;
          const first = rtl ? parts[0].x + parts[0].width : parts[0].x;
          expect(Math.abs(first - valueEdge)).toBeLessThan(2);
          // Level with its boxes, as the column's other labels are with theirs.
          const level = (l: { y: number; height: number }, b: { y: number; height: number }) => Math.abs(l.y + l.height / 2 - (b.y + b.height / 2));
          expect(Math.abs(level(label, parts[0]) - level(team, teamValue))).toBeLessThan(3);
        }
        if (variant === 'plain') await screen(page, `real-maintenance-repeat-${width}${look.replace(/[&=]/g, '-')}`);
        await expectNoSidewaysScroll(page);
        expect(problems).toEqual([]);
      }
    });
  });
}

test('the people pages at a phone’s width: nothing scrolls sideways', async ({ page }) => {
  await page.setViewportSize(PHONE);
  for (const query of [
    'page=real-time-off&record=4171&skin=underline',
    'page=real-clinic-appointment&record=4002&skin=underline',
    'page=real-employee&record=4122&skin=underline',
    'page=real-maintenance-request&record=4372&skin=underline',
  ]) {
    const { problems } = await open(page, 'plain', query);
    await expectNoSidewaysScroll(page);
    expect(problems).toEqual([]);
  }
  await open(page, 'plain', 'page=real-time-off&record=4171&skin=underline');
  await screen(page, 'real-time-off-phone');
});

test('an empty read-only field draws empty: no “Search…”, no date mask', async ({ page }) => {
  await page.setViewportSize(WIDE);
  const { problems } = await open(page, 'plain', 'page=real-clinic-appointment&record=4001&skin=underline');
  const link = node(page, 'f-deposit-payment').locator('input');
  const date = node(page, 'f-arrival').locator('input');
  await expect(link).toHaveJSProperty('readOnly', true);
  await expect(link).toHaveValue('');
  await expect(date).toHaveJSProperty('readOnly', true);
  await expect(date).toHaveValue('');
  const transparent = 'rgba(0, 0, 0, 0)';
  expect(await link.evaluate((el) => getComputedStyle(el, '::placeholder').color)).toBe(transparent);
  // The date's dd.mm.yyyy is drawn in the box's own colour.
  expect(await date.evaluate((el) => getComputedStyle(el).color)).toBe(transparent);
  await screen(page, 'real-clinic-appointment-empty-read-only');
  // A read-only date with a value keeps its look.
  const set = node(page, 'f-stop').locator('input');
  await expect(set).toHaveJSProperty('readOnly', true);
  await expect(set).not.toHaveValue('');
  expect(await set.evaluate((el) => getComputedStyle(el).color)).not.toBe(transparent);
  expect(problems).toEqual([]);
});
