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
/** A read-only value drawn as words (look.readonlyShown: "text"), as Flectra draws it. */
const words = (page: Page, id: string) => node(page, id).locator('.fd-read-text');
const bar = (page: Page) => page.locator('.fd-record-bar');
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

    test('clinic appointment: the risk as a toned badge, help behind a (?), and the record’s menu, pager and trail', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, 'page=real-clinic-appointment&record=4001&skin=underline');
      // Risk Band is Flectra's badge: Medium, in amber; it turns red as the risk rises.
      const band = node(page, 'f-risk-band').locator('.fd-value-badge');
      await expect(band).toHaveText('Medium');
      await expect(band).toHaveAttribute('data-tone', 'warning');
      // Flectra's help, behind a (?) by the label rather than under the field.
      const tip = node(page, 'f-walk-in').locator('.fd-help-tip');
      await expect(tip).toBeVisible();
      await tip.hover();
      await expect(page.getByText('Unplanned patient registered straight into the waiting room.')).toBeVisible();
      // The gear menu, the pager and the trail back to the appointments, as Flectra's control panel.
      await expect(bar(page).locator('nav')).toContainText('Appointments');
      await expect(bar(page).locator('.fd-record-pager-text')).toHaveText('1 / 3');
      await bar(page).locator('.fd-record-gear').click();
      // No active field on an appointment: Duplicate and Delete, no Archive.
      await expect(page.getByRole('menu').getByRole('menuitem')).toHaveText(['Duplicate', 'Delete']);
      await page.keyboard.press('Escape');
      await bar(page).getByRole('button', { name: 'Next record' }).click();
      await expect(bar(page).locator('.fd-record-pager-text')).toHaveText('2 / 3');
      await expect(page.locator('.fd-title')).toContainText('APT-00409');
      await expect(node(page, 'f-risk-band').locator('.fd-value-badge')).toHaveAttribute('data-tone', 'success');
      expect(problems).toEqual([]);
    });

    test('time off: what an officer sees, and what someone without the group does not', async ({ page }) => {
      await page.setViewportSize(WIDE);
      let { problems } = await open(page, variant, 'page=real-time-off&record=4172&skin=underline');
      // A saved draft can be confirmed (Flectra's "id == False" part, read as "not id").
      await expect(button(page, 'action_confirm')).toBeVisible();
      // The manager's view: Mode and Employees, each with a face.
      await expect(node(page, 'f-mode')).toBeVisible();
      await expect(node(page, 'f-employees').locator('.fd-link-avatar').first()).toBeVisible();
      // Extra hours as Flectra's float_time, in green: 06:30 hours.
      await expect(words(page, 'f-overtime')).toHaveText('06:30 hours');
      await expect(node(page, 'f-overtime')).toHaveAttribute('data-tone', 'success');
      expect(problems).toEqual([]);

      // Someone without hr_holidays.group_hr_holidays_user: no Mode, no Employees, and no Validate on a request waiting for its second approval.
      ({ problems } = await open(page, variant, 'page=real-time-off&record=4171&skin=underline&roles='));
      await expect(node(page, 'f-type')).toBeVisible();
      await expect(node(page, 'f-mode')).toBeHidden();
      await expect(node(page, 'f-employees')).toBeHidden();
      await button(page, 'action_approve').click();
      await expect(current(page)).toHaveText('Second Approval');
      await expect(button(page, 'action_validate')).toBeHidden();
      expect(problems).toEqual([]);
    });

    test('time off: the doctor’s note beside the sick leave, and the list’s pager', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, 'page=real-time-off&record=4173&skin=underline');
      await expect(page.locator('.fd-attachment-preview .fd-attachment-name')).toHaveText("Doctor's note, Dr. Hesham Ali.pdf");
      await expect(bar(page).locator('.fd-record-pager-text')).toHaveText('3 / 4');
      await bar(page).locator('.fd-record-gear').click();
      await expect(page.getByRole('menu').getByRole('menuitem')).toHaveText(['Archive', 'Duplicate', 'Delete']);
      await page.keyboard.press('Escape');
      // The next request has no attachment: nothing beside it.
      await bar(page).getByRole('button', { name: 'Next record' }).click();
      await expect(bar(page).locator('.fd-record-pager-text')).toHaveText('4 / 4');
      await expect(page.locator('.fd-attachment-preview')).toBeHidden();
      expect(problems).toEqual([]);
    });

    test('time off: half a day hides the end date, and the duration follows', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, 'page=real-time-off&record=4172&skin=underline');
      // Compensatory Days are taken in hours: two full days in one box, from → to, as Flectra's daterange, their hours beside them.
      await expect(node(page, 'f-dates-from')).toBeVisible();
      await expect(node(page, 'f-dates-from').locator('input')).toHaveCount(2);
      await expect(words(page, 'f-duration-days')).toHaveText('2.00 Days');
      await expect(words(page, 'f-duration-hours-beside')).toHaveText('(16 Hours)');
      await expect(node(page, 'f-date')).toBeHidden();
      await expect(node(page, 'f-period')).toBeHidden();

      // Half Day: one date and its half; the end date and the day count go; the hours read 4.
      await node(page, 'f-half').locator('input').check();
      await expect(node(page, 'f-dates-from')).toBeHidden();
      await expect(node(page, 'f-date')).toBeVisible();
      await expect(node(page, 'f-period')).toBeVisible();
      await expect(node(page, 'f-duration-days')).toBeHidden();
      await expect(words(page, 'f-duration-hours')).toHaveText('4 Hours');
      // Custom Hours and Half Day are one or the other.
      await node(page, 'f-hours').locator('input').check();
      await expect(node(page, 'f-half').locator('input')).not.toBeChecked();
      await expect(node(page, 'f-hour-from')).toBeVisible();
      await choose(page, 'f-hour-from', '9:00 AM');
      await choose(page, 'f-hour-to', '1:30 PM');
      await expect(words(page, 'f-duration-hours')).toHaveText('4.5 Hours');
      if (variant === 'plain') await screen(page, 'real-time-off-custom-hours');

      // Back to whole days: the end date returns, and the count of working days follows it.
      await node(page, 'f-hours').locator('input').uncheck();
      await expect(node(page, 'f-dates-from')).toBeVisible();
      const from = (await value(page, 'request_date_from')) as string;
      // From a Wednesday to the Sunday after: Wednesday, Thursday and Sunday, Friday and Saturday off.
      const sunday = new Date(`${from}T12:00`);
      sunday.setDate(sunday.getDate() + 4);
      const iso = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;
      const end = node(page, 'f-dates-from').locator('input').nth(1);
      await end.fill(iso);
      await end.press('Tab');
      await expect(words(page, 'f-duration-days')).toHaveText('3.00 Days');
      await expect(words(page, 'f-duration-hours-beside')).toHaveText('(24 Hours)');
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
      // Approved, the request is locked: its type reads as words, as Flectra's.
      await expect(node(page, 'f-type').getByRole('combobox')).toBeHidden();
      await expect(words(page, 'f-type')).toHaveText(/^Paid Time Off/);
      expect(problems).toEqual([]);
    });

    test('time off: cancelled with a reason, in the wizard', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, 'page=real-time-off&record=4174&skin=underline');
      await expect(page.locator('.fd-ribbon')).toBeHidden();
      await button(page, 'action_cancel').click();
      const dialog = page.getByRole('dialog', { name: 'Cancel Time Off' });
      await expect(dialog).toBeVisible();
      // The wizard's own buttons, as Flectra's footer: Delete Time Off and Discard, in place of Save & Close.
      await expect(dialog.getByRole('button', { name: 'Delete Time Off' })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Discard' })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Save & Close' })).toHaveCount(0);
      await dialog.locator('[data-node="f-reason"] textarea').fill('The Sahel booking fell through.');
      if (variant === 'plain') await screen(page, 'real-time-off-cancel', { viewport: true });
      await page.keyboard.press('ControlOrMeta+Enter');
      await expect(dialog).toBeHidden();
      await expect(page.locator('.fd-ribbon')).toHaveText('Canceled');
      await expect(button(page, 'action_cancel')).toBeHidden();
      // An archived request has no statusbar (invisible="not active").
      await expect(page.locator('.fd-header .fd-statusbar')).toBeHidden();
      await settled(page);
      expect((await stored(page, 'hr.leave', 4174)).active).toBe(false);
      expect(problems).toEqual([]);
    });

    test('employee: the spouse goes with a single status; a badge generated', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, 'page=real-employee&record=4122&skin=underline');
      // Flectra's "12.5/21 Days": the remaining days, then the allocated ones and the unit.
      await expect(page.locator('[data-node="stat-time-off"]')).toContainText(/12\.5\s*\/\s*21\s*Days/);
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
      // The wizard's own footer, as Flectra's: Schedule and Cancel.
      await expect(dialog.getByRole('button', { name: 'Save & Close' })).toHaveCount(0);
      await dialog.getByRole('button', { name: 'Schedule' }).click();
      await expect(dialog).toBeHidden();
      await expect(toast(page, 'The plan is launched')).toBeVisible();

      // Time Off: her request, opened in the employee's place.
      await page.locator('.fd-header').getByRole('button', { name: 'Save' }).click();
      await settled(page);
      await page.locator('[data-node="stat-time-off"]').click();
      await expect(words(page, 'f-display-name')).toHaveText(/^Salma Adel on Paid Time Off/);
      expect(problems).toEqual([]);
    });

    test('employee: Archive asks why she leaves; Equipment lists hers; colours, faces and properties', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, 'page=real-employee&record=4122&skin=underline');
      // Tags and companies in their records' colours, the manager with his face.
      await expect(node(page, 'f-tags').locator('[data-color="10"]')).toContainText('Clinical');
      await expect(node(page, 'f-companies').locator('[data-color]')).toHaveCount(2);
      await expect(node(page, 'f-manager').locator('.fd-link-avatar')).toBeVisible();
      // The branch's properties, in two columns, one more addable in place.
      await expect(node(page, 'f-properties')).toContainText('Syndicate licence no.');
      await expect(node(page, 'f-properties').getByRole('button', { name: /Add a property/ })).toBeVisible();
      // Skills' levels as bars.
      await expect(node(page, 'f-skills').locator('[role="progressbar"]').first()).toBeVisible();

      // Equipment: the list of what is hers, opened in the employee's place.
      await expect(page.locator('[data-node="stat-equipment"]')).toContainText('2');
      await page.locator('[data-node="stat-equipment"]').click();
      await expect(page.locator('.fd-list-row')).toHaveCount(2);
      await expect(page.locator('.fd-list-row').first()).toContainText('DermLite DL5 dermatoscope');
      await page.getByRole('button', { name: 'Back' }).first().click();
      await expect(page.locator('.fd-title [data-field="name"] input')).toHaveValue('Salma Adel');

      // Archive, as hr_employee_form's: the departure wizard first, then archived.
      await bar(page).locator('.fd-record-gear').click();
      await page.getByRole('menuitem', { name: 'Archive' }).click();
      const dialog = page.getByRole('dialog', { name: 'Register Departure' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Apply' })).toBeVisible();
      const reason = dialog.locator('[data-node="f-reason"]').getByRole('combobox');
      await reason.click();
      await reason.fill('Resig');
      await dialog.getByRole('option', { name: 'Resigned', exact: true }).click();
      await dialog.getByRole('button', { name: 'Apply' }).click();
      await expect(dialog).toBeHidden();
      await expect(page.locator('.fd-ribbon:visible')).toHaveText('Archived');
      await settled(page);
      const saved = await stored(page, 'hr.employee', 4122);
      expect(saved.active).toBe(false);
      expect(saved.departure_reason_id).toEqual({ id: 4244, label: 'Resigned' });
      expect(problems).toEqual([]);
    });

    test('employee: someone without the HR groups sees no private tabs, no plan and no equipment', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, 'page=real-employee&record=4122&skin=underline&roles=base.group_user');
      await expect(page.getByRole('tab', { name: 'Work Information' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Private Information' })).toHaveCount(0);
      await expect(page.getByRole('tab', { name: 'HR Settings' })).toHaveCount(0);
      await expect(button(page, 'launch_plan')).toBeHidden();
      await expect(page.locator('[data-node="stat-equipment"]')).toBeHidden();
      await expect(node(page, 'f-companies')).toBeHidden();
      await expect(page.locator('[data-node="stat-time-off"]')).toBeVisible();
      expect(problems).toEqual([]);
    });

    test('maintenance request: priority, duration and stage set, then saved', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, 'page=real-maintenance-request&record=4371&skin=underline');
      await expect(current(page)).toHaveText('In Progress');
      await expect(node(page, 'f-close-date')).toBeHidden();
      if (variant === 'plain') await screen(page, 'real-maintenance-request');

      // Flectra's priority: three stars over '0'…'3'. Two stars: Normal.
      const stars = node(page, 'f-priority').getByRole('radio');
      await expect(stars).toHaveCount(3);
      await stars.nth(1).click();
      expect(await value(page, 'priority')).toBe('2');
      // No "Clear selection", as Flectra has none: the star picked, clicked again, goes back to Very Low.
      await expect(node(page, 'f-type').locator('.fd-choice-clear')).toBeHidden();
      await stars.nth(1).click();
      expect(await value(page, 'priority')).toBe('0');
      await stars.nth(1).click();
      expect(await value(page, 'priority')).toBe('2');
      // Hours as Flectra's float_time: 02:30, typed as 3.75.
      const duration = node(page, 'f-duration').locator('input');
      await expect(duration).toHaveValue('02:30');
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
      expect(saved.priority).toBe('2');
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

    test('maintenance request: its state’s dot, the manual inline, and a cancelled request without its stages', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, 'page=real-maintenance-request&record=4371&skin=underline');
      // "Request" over the title; the kanban state as Flectra's coloured dot on its line.
      await expect(page.locator('.fd-title')).toContainText('Request');
      await expect(node(page, 'f-kanban-state').getByRole('button', { name: /Blocked/ })).toBeVisible();
      // Created By with a face, and no Email cc outside developer mode (base.group_no_one).
      await expect(node(page, 'f-employee').locator('.fd-link-avatar')).toBeVisible();
      await expect(node(page, 'f-email-cc')).toBeHidden();
      // The service manual shown inline, as pdf_viewer.
      await page.getByRole('tab', { name: 'Instructions' }).click();
      await expect(node(page, 'f-instruction-pdf').locator('iframe')).toBeVisible();
      // Cancelled: no stages (invisible="archive"), and Reopen Request.
      await button(page, 'archive_equipment_request').click();
      await expect(page.locator('.fd-header .fd-statusbar')).toBeHidden();
      await expect(button(page, 'reset_equipment_request')).toBeVisible();
      // The gear: Duplicate and Delete — a request has no active field.
      await bar(page).locator('.fd-record-gear').click();
      await expect(page.getByRole('menu').getByRole('menuitem')).toHaveText(['Duplicate', 'Delete']);
      await page.keyboard.press('Escape');
      expect(problems).toEqual([]);

      // The air conditioner's slides, embedded as embed_viewer.
      await open(page, variant, 'page=real-maintenance-request&record=4372&skin=underline');
      await page.getByRole('tab', { name: 'Instructions' }).click();
      await expect(node(page, 'f-instruction-slide').locator('iframe')).toHaveAttribute('src', /docs\.google\.com/);
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
  // The date range keeps each date whole: its calendar button goes under rather than cut a year off.
  for (const input of await node(page, 'f-dates-from').locator('input').all()) expect((await input.boundingBox())!.width).toBeGreaterThanOrEqual(120);
  await screen(page, 'real-time-off-phone');
});

test('an empty read-only field draws empty: no “Search…”, no date mask', async ({ page }) => {
  await page.setViewportSize(WIDE);
  const { problems } = await open(page, 'plain', 'page=real-clinic-appointment&record=4001&skin=underline');
  // Read-only values are drawn as words (look.readonlyShown: "text"): empty, nothing at all — no box, no "Search…", no mask.
  for (const id of ['f-deposit-payment', 'f-arrival']) {
    await expect(node(page, id).locator('input')).toBeHidden();
    await expect(words(page, id)).toHaveText('');
  }
  await screen(page, 'real-clinic-appointment-empty-read-only');
  // One with a value reads as a person writes it.
  await expect(node(page, 'f-stop').locator('input')).toBeHidden();
  await expect(words(page, 'f-stop')).toHaveText(/\d{4}, 12:15$/);
  expect(problems).toEqual([]);
});
