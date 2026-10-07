import { expect, test, type Page } from '@playwright/test';
import { expectNoSidewaysScroll, node, open, screen } from './support';
import { VARIANTS } from './variants';

/**
 * The legal lane's real pages (demos/shared/real/legal.ts), done by a person
 * in every framework's demo: Sherkety ERP's legal case — the largest record,
 * 15 tabs and 12 tables — gone through tab by tab, a hearing added and the
 * next hearing following it, the budget's progress following its budget,
 * the case closed through its dialog, and Start Work refused by the conflict
 * gate; and the survey's own record, a question added and moved, its type
 * changed and its options following. The case also times itself: opening,
 * switching tabs and a keystroke, measured in the browser.
 */

const WIDE = { width: 1440, height: 900 };
const CASE = 'page=real-legal-case&record=42&skin=underline';
const DRAFT_CASE = 'page=real-legal-case&record=43&skin=underline';
const SURVEY = 'page=real-survey&record=7&skin=underline';

const value = (page: Page, name: string) => page.evaluate((n) => (window as any).fieldiaDemo.handle.form.getState().values[n], name);
const stored = (page: Page, model: string, id: number) => page.evaluate(([m, i]) => (window as any).fieldiaDemo.dataSource.records[m][i], [model, id] as const);
const toast = (page: Page, words: string) => page.locator('.fd-say', { hasText: words });
const tab = (page: Page, label: string) => page.locator('[data-node="notebook"] > .fd-tabbar > .fd-tablist > .fd-tab', { hasText: label });
const shownPanel = (page: Page) => page.locator('[data-node="notebook"] > .fd-tabpanel:not([hidden])');
const gridCell = (page: Page, grid: string, row: number, col: string) => node(page, grid).locator(`.ag-row[row-index="${row}"]:not(.fd-grid-totals) .ag-cell[col-id="${col}"]`);
const gridEditor = (page: Page, grid: string) => node(page, grid).locator('.ag-cell-inline-editing input, .ag-cell-inline-editing select, .ag-popup-editor input').first();
/** A day `n` days from today at a local time, as the datetime field keeps it: ISO in UTC. */
function at(n: number, time: string): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const pad = (x: number) => String(x).padStart(2, '0');
  return new Date(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${time}`).toISOString();
}

/** The same moment as a person types it in a date-and-time box: local, YYYY-MM-DDTHH:MM. */
function local(n: number, time: string): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${time}`;
}

/** The perf harness of e2e/perf.spec.ts, in short: an event's main-thread work, from its handlers to the paint that shows it. */
function harness() {
  const afterMessage = (then: () => void) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = then;
    channel.port2.postMessage(null);
  };
  let pending: Promise<number> | null = null;
  (window as any).legalPerf = {
    arm(type: string) {
      pending = new Promise((resolve) => {
        addEventListener(
          type,
          () => {
            const began = performance.now();
            let handled: number | null = null;
            afterMessage(() => (handled ??= performance.now()));
            requestAnimationFrame(() => {
              const frame = performance.now();
              const done = Math.min(handled ?? frame, frame);
              afterMessage(() => resolve(done - began + (performance.now() - frame)));
            });
          },
          { capture: true, once: true }
        );
      });
    },
    result: () => pending,
  };
}
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const ms = (n: number) => Math.round(n * 10) / 10;

for (const variant of VARIANTS) {
  test.describe(`${variant} · legal`, () => {
    test('the case: every tab gone through, a hearing added and the next hearing following, the budget’s progress following, timed', async ({ page }, info) => {
      await page.setViewportSize(WIDE);
      await page.addInitScript(harness);
      const { problems } = await open(page, variant, CASE);
      await expect(page.locator('.fd-sheet-title, [data-node="#title"]').first()).toBeVisible();
      await expect(node(page, '#title').locator('input')).toHaveValue('LEG/2026/LIT/0042');
      const opened = await page.evaluate(() => (window as any).fieldiaTimings?.viewer?.work as number | undefined);

      // The statusbar, the header buttons a case that is open has, and the stat buttons with their numbers.
      await expect(page.getByRole('button', { name: 'Put On Hold' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Close Case' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Start Work' })).toHaveCount(0);
      await expect(page.locator('[data-node="s-hearings"]')).toContainText('4');
      await expect(page.locator('[data-node="s-invoices"]')).toBeVisible();
      if (variant === 'plain') await screen(page, 'real-legal-case');

      // Every tab, as a person finds it: 14 shown (Outcome waits for a closed case), each opening its own panel, timed.
      const labels = ['Description', 'Parties', 'Hearings', 'Tasks & Deadlines', 'Expenses', 'Documents', 'Compliance', 'Contract Reviews', 'Powers of Attorney', 'Billing', 'Trust', 'Timesheets', 'Correspondence', 'Internal'];
      await expect(tab(page, 'Outcome')).toBeHidden();
      const switches: number[] = [];
      for (const label of labels) {
        const button = tab(page, label);
        await button.scrollIntoViewIfNeeded();
        await page.evaluate(() => (window as any).legalPerf.arm('click'));
        await button.click();
        switches.push(await page.evaluate(() => (window as any).legalPerf.result()));
        await expect(button).toHaveAttribute('aria-selected', 'true');
        await expect(shownPanel(page)).toBeVisible();
      }
      await expect(node(page, 'f-notes').locator('textarea')).toHaveValue(/Delta’s counsel hinted/);

      // A keystroke in a field of the header, timed.
      const court = node(page, 'f-court-name').locator('input');
      await court.click();
      // To the end of the text (End only scrolls on a Mac).
      await court.evaluate((el: HTMLInputElement) => el.setSelectionRange(el.value.length, el.value.length));
      const keys: number[] = [];
      for (const key of ' (Abbassia)') {
        await page.evaluate(() => (window as any).legalPerf.arm('keydown'));
        await page.keyboard.press(key === ' ' ? 'Space' : key);
        keys.push(await page.evaluate(() => (window as any).legalPerf.result()));
      }
      await expect.poll(() => value(page, 'court_name')).toBe('Cairo Economic Court — First Instance, Circuit 4 (Abbassia)');
      const timing = { variant, openMs: opened === undefined ? null : ms(opened), tabSwitchMedianMs: ms(median(switches)), tabSwitchMaxMs: ms(Math.max(...switches)), keyMedianMs: ms(median(keys)), keyMaxMs: ms(Math.max(...keys)) };
      info.annotations.push({ type: 'timing', description: JSON.stringify(timing) });
      console.log(`legal case timing ${JSON.stringify(timing)}`);

      // The Hearings stat button opens the Hearings tab.
      await page.locator('[data-node="s-hearings"]').click();
      await expect(tab(page, 'Hearings')).toHaveAttribute('aria-selected', 'true');

      // A hearing added before the next one: the count and Next Hearing follow, worked out by the server's onchange.
      const before = (await value(page, 'next_hearing_date')) as string;
      await node(page, 'f-hearings').getByRole('button', { name: 'Add a line' }).click();
      await expect(gridEditor(page, 'f-hearings')).toBeFocused();
      await page.keyboard.type('Urgent motion — attachment of Delta’s receivables');
      // Enter on the last line would start another; the person clicks the next cell to fill.
      await gridCell(page, 'f-hearings', 4, 'date_time').click();
      await expect(gridEditor(page, 'f-hearings')).toBeVisible();
      await gridEditor(page, 'f-hearings').fill(local(2, '09:00'));
      await node(page, 'f-court-name').locator('input').click();
      await expect.poll(() => value(page, 'hearing_count')).toBe(5);
      await expect.poll(() => value(page, 'next_hearing_date')).toBe(at(2, '09:00'));
      expect(new Date(at(2, '09:00')) < new Date(before)).toBe(true);
      await expect(page.locator('[data-node="s-hearings"]')).toContainText('5');
      if (variant === 'plain') await screen(page, 'real-legal-case-hearing-added');

      // The budget: a smaller fee budget, and the total and the progress follow, worked out on the page.
      await tab(page, 'Billing').click();
      const fees = node(page, 'f-budget-fees').locator('input');
      await fees.fill('100000');
      await fees.press('Tab');
      await expect.poll(() => value(page, 'budget_total')).toBe(140000);
      await expect.poll(() => value(page, 'budget_progress')).toBe(42.8);
      await expect(node(page, 'f-budget-progress')).toContainText('43%');
      // Flat fee: the matter rate goes, the schedule comes.
      await node(page, 'f-fee-arrangement').getByText('Flat Fee', { exact: true }).click();
      await expect(node(page, 'f-hourly-rate')).toBeHidden();
      await expect(node(page, 'f-flat-fee-lines')).toBeVisible();
      if (variant === 'plain') await screen(page, 'real-legal-case-billing');
      expect(problems).toEqual([]);
    });

    test('the case closed through its dialog: the outcome, the notes, pending tasks cancelled, the Outcome tab', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, CASE);
      await expect(node(page, '#title').locator('input')).toHaveValue('LEG/2026/LIT/0042');
      await page.getByRole('button', { name: 'Close Case' }).click();
      const dialog = page.getByRole('dialog', { name: 'Close Case' });
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('[data-node="w-case"] input')).toHaveValue(/^LEG\/2026\/LIT\/0042 — Nile Cotton Mills/);
      // Contingency waits for a contingency case: this one is hourly.
      await expect(dialog.locator('[data-node="g-contingency"]')).toBeHidden();
      await dialog.locator('[data-node="w-outcome"] select').selectOption({ label: 'Settled' });
      await dialog.locator('[data-node="w-reason"] textarea').fill('Settled at the expert hearing: Delta pays 3.1m EGP in two instalments; each side bears its own costs.');
      if (variant === 'plain') await screen(page, 'real-legal-case-close-dialog', { viewport: true });
      // The wizard's own buttons, as Flectra's footer: Close Case and Cancel.
      await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
      await dialog.getByRole('button', { name: 'Close Case' }).click();
      await expect(dialog).toBeHidden();
      await expect(toast(page, 'Case closed with outcome: Settled.')).toBeVisible();
      await expect.poll(() => value(page, 'state')).toBe('closed');
      await expect.poll(async () => ((await stored(page, 'legal.case', 42)) as { state: string }).state).toBe('closed');
      expect(await value(page, 'outcome')).toBe('settled');
      expect(await value(page, 'stage_id')).toEqual({ id: 7705, label: 'Judgment' });
      const states = ((await value(page, 'task_ids')) as { values: { state: string } }[]).map((l) => l.values.state);
      expect(states).toEqual(['cancelled', 'cancelled', 'completed', 'cancelled', 'cancelled']);
      // The Outcome tab, shown now and opened; the badge; Reopen in place of Close Case.
      await expect(tab(page, 'Outcome')).toHaveAttribute('aria-selected', 'true');
      await expect(node(page, 'f-close-reason').locator('textarea')).toHaveValue(/Settled at the expert hearing/);
      await expect(page.locator('.fd-ribbon:visible')).toHaveText('Settled');
      await expect(page.getByRole('button', { name: 'Reopen' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Close Case' })).toHaveCount(0);
      if (variant === 'plain') await screen(page, 'real-legal-case-closed');
      // Reopened: open again, the outcome gone.
      await page.getByRole('button', { name: 'Reopen' }).click();
      await expect.poll(() => value(page, 'state')).toBe('open');
      expect(await value(page, 'outcome')).toBeNull();
      await expect(tab(page, 'Outcome')).toBeHidden();
      expect(problems).toEqual([]);
    });

    test('time and trust money: a shortcode fills a time entry, the timer logs one, a deposit made in its dialog lands in the ledger', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, CASE);
      await expect(node(page, '#title').locator('input')).toHaveValue('LEG/2026/LIT/0042');
      const consumed = (await value(page, 'budget_consumed_fees')) as number;

      // COURT typed in a new line's Shortcode: the server applies its category, words and rate, and clears the code.
      await tab(page, 'Timesheets').click();
      await node(page, 'f-timesheets').getByRole('button', { name: 'Add a line' }).click();
      await expect(gridEditor(page, 'f-timesheets')).toBeFocused();
      await gridCell(page, 'f-timesheets', 8, 'shortcode').click();
      await expect(gridEditor(page, 'f-timesheets')).toBeFocused();
      await page.keyboard.type('COURT');
      await gridCell(page, 'f-timesheets', 8, 'unit_amount').click();
      await expect(gridEditor(page, 'f-timesheets')).toBeFocused();
      await page.keyboard.type('2');
      await node(page, 'f-court-name').locator('input').click();
      const last = async () => ((await value(page, 'timesheet_ids')) as { values: Record<string, unknown> }[]).at(-1)?.values ?? {};
      await expect.poll(async () => (await last())['activity_category_id']).toEqual({ id: 7902, label: 'Court appearance (COURT)' });
      expect(await last()).toEqual(expect.objectContaining({ shortcode: null, name: 'Court appearance', hourly_rate: 3000, billable_amount: 6000 }));
      await expect.poll(() => value(page, 'budget_consumed_fees')).toBe(consumed + 6000);

      // The timer: started, then stopped and logged as a line.
      await page.getByRole('button', { name: 'Start Timer' }).click();
      await expect(toast(page, 'Timer started on LEG/2026/LIT/0042')).toBeVisible();
      await page.getByRole('button', { name: 'Stop Timer & Log' }).click();
      await expect(toast(page, 'Logged 0.1 h on LEG/2026/LIT/0042')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Start Timer' })).toBeVisible();
      expect(await last()).toEqual(expect.objectContaining({ name: 'Timer entry', unit_amount: 0.1 }));

      // A deposit, made in its dialog, starting from the top-up the matter needs.
      await tab(page, 'Trust').click();
      // The top-up the matter needs, inside the alert's sentence, as Flectra's.
      await expect(node(page, 't-trust-below')).toContainText('75,000');
      await page.getByRole('button', { name: 'Deposit', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Trust Deposit' });
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('[data-node="d-amount"] input')).toHaveValue(/75,000/);
      await dialog.locator('[data-node="d-method"]').getByText('Cheque', { exact: true }).click();
      await dialog.locator('[data-node="d-reference"] input').fill('Banque Misr cheque 004417');
      if (variant === 'plain') await screen(page, 'real-legal-trust-deposit', { viewport: true });
      await dialog.getByRole('button', { name: /Submit|Save/ }).click();
      await expect(dialog).toBeHidden();
      await expect(toast(page, 'Deposit TRD/2026/00137')).toBeVisible();
      const ledger = ((await value(page, 'trust_transaction_ids')) as { values: Record<string, unknown> }[]).map((l) => l.values);
      expect(ledger.at(-1)).toEqual(expect.objectContaining({ transaction_type: 'deposit', method: 'cheque', reference: 'Banque Misr cheque 004417', amount: 75000, state: 'draft' }));
      expect(problems).toEqual([]);
    });

    test('the case as Flectra reads it: formatted stat buttons, badges and tones in its tables, groups, a many2many table, each payer once', async ({ page }) => {
      await page.setViewportSize(WIDE);
      // Someone without the legal officer's and user's groups: no Trust tab or button.
      let { problems } = await open(page, variant, `${CASE}&roles=base.group_user`);
      await expect.poll(() => value(page, 'case_number')).toBe('LEG/2026/LIT/0042');
      await expect(tab(page, 'Trust')).toBeHidden();
      await expect(page.locator('[data-node="s-trust"]')).toBeHidden();
      expect(problems).toEqual([]);
      ({ problems } = await open(page, variant, CASE));
      await expect.poll(() => value(page, 'case_number')).toBe('LEG/2026/LIT/0042');
      // Money and hours on the stat buttons, as their fields write them.
      await expect(page.locator('[data-node="s-expenses"]')).toContainText('6,750.00');
      await expect(page.locator('[data-node="s-hours"]')).toContainText('24.80');
      // Days since opened worked out on the page: days(date_opened, today()).
      await expect(node(page, 'f-days-open')).toContainText('72');
      // Priority as stars, the tags in their colours.
      await expect(node(page, 'f-priority').getByRole('radio')).toHaveCount(3);
      // Tasks: an overdue one red, a done one green; its status as a badge.
      await tab(page, 'Tasks & Deadlines').click();
      await expect(node(page, 'f-tasks').locator('.ag-row[row-index="1"]:not(.fd-grid-totals)').first()).toHaveClass(/fd-tone-danger/);
      await expect(node(page, 'f-tasks').locator('.ag-row[row-index="2"]:not(.fd-grid-totals)').first()).toHaveClass(/fd-tone-success/);
      await expect(gridCell(page, 'f-tasks', 0, 'state').locator('[data-tone]')).toHaveAttribute('data-tone', 'warning');
      // Compliance: the firm's requirements this case is under, as a table; one more found by searching.
      await tab(page, 'Compliance').click();
      await expect(node(page, 'f-compliance')).toContainText('Anti-Money Laundering Law 80/2002');
      // Timesheets: hours as HH:MM.
      await tab(page, 'Timesheets').click();
      await expect(gridCell(page, 'f-timesheets', 0, 'unit_amount')).toHaveText('06:30');
      // Split billing: the second payer made the same as the first is refused, as the model's constraint.
      await tab(page, 'Billing').click();
      await gridCell(page, 'f-split-lines', 1, 'partner_id').click();
      await page.keyboard.type('Nile Cotton Mills');
      await page.getByRole('option', { name: 'Nile Cotton Mills S.A.E.', exact: true }).first().click();
      await node(page, 'f-budget-fees').locator('input').click();
      await expect.poll(async () => ((await value(page, 'split_line_ids')) as { values: { partner_id: { id: number } } }[]).map((l) => l.values.partner_id.id)).toEqual([9001, 9001]);
      await page.keyboard.press('ControlOrMeta+Enter');
      await expect(page.getByText('Each payer can appear only once in the split.').first()).toBeVisible();
      expect(problems).toEqual([]);

    });

    test('a draft case: Start Work refused by the conflict gate, in the server’s words', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, DRAFT_CASE);
      await expect(node(page, '#title').locator('input')).toHaveValue('LEG/2026/LAB/0043');
      await expect(tab(page, 'Contract Reviews')).toBeHidden();
      await page.getByRole('button', { name: 'Start Work' }).click();
      await expect(toast(page, 'no cleared conflict check is attached')).toHaveAttribute('data-tone', 'warning');
      expect(await value(page, 'state')).toBe('draft');
      expect(problems).toEqual([]);
    });

    test('the survey: a question opens its own form, its answers lines held in it', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, SURVEY);
      await expect(node(page, '#title').locator('input, textarea').first()).toHaveValue('Client satisfaction survey, autumn 2026');
      // The table's row never draws a question's answers.
      await expect(node(page, 'f-questions').locator('.ag-header-cell[col-id="suggested_answer_ids"]')).toHaveCount(0);
      await node(page, 'f-questions').locator('.ag-row[row-index="2"] .fd-line-open').click();
      const dialog = page.getByRole('dialog', { name: 'Sections and Questions' });
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('[data-node="question-title"] input')).toHaveValue('Overall, how satisfied are you with our service?');
      // Its answers, in its own form; no scoring on the survey (the parent): no Correct, no Score.
      const answers = dialog.locator('[data-node="question-suggested"]');
      await expect(answers.locator('tbody tr[data-line]')).toHaveCount(4);
      await expect(answers.locator('thead th[data-column="answer_score"]')).toBeHidden();
      if (variant === 'plain') await screen(page, 'real-survey-question-form', { viewport: true });
      await answers.getByRole('button', { name: 'Add a line' }).click();
      await answers.locator('tbody tr[data-line]').last().locator('input').first().fill('Very dissatisfied');
      // Options: the mandatory answer's message, as the question has it.
      await dialog.getByRole('tab', { name: 'Options' }).click();
      await expect(dialog.locator('[data-node="question-mandatory-error"] input')).toHaveValue('This question requires an answer.');
      // A text question has no answers to give: the tab goes.
      await dialog.getByRole('radio', { name: 'Multiple Lines Text Box' }).check();
      await expect(dialog.getByRole('tab', { name: 'Answers' })).toBeHidden();
      await dialog.getByRole('radio', { name: 'Multiple choice: only one answer' }).check();
      await dialog.getByRole('button', { name: 'Save & Close' }).click();
      await expect(dialog).toBeHidden();
      const question = ((await value(page, 'question_and_page_ids')) as { values: Record<string, unknown> }[])[2].values;
      expect((question['suggested_answer_ids'] as { values: { value: string } }[]).map((answer) => answer.values.value)).toEqual(['Very satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very dissatisfied']);

      // Scored: the answers' Correct and Score show.
      await tab(page, 'Options').click();
      await node(page, 'f-survey-type').getByText('Assessment', { exact: true }).click();
      await expect.poll(() => value(page, 'scoring_type')).toBe('scoring_with_answers');
      await tab(page, 'Questions').click();
      await node(page, 'f-questions').locator('.ag-row[row-index="2"] .fd-line-open').click();
      await expect(dialog.locator('[data-node="question-suggested"] thead th[data-column="answer_score"]')).toBeVisible();
      await dialog.getByRole('button', { name: 'Discard' }).click();
      expect(problems).toEqual([]);
    });

    test('the survey: a question added and moved up, the type changed and the options following', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, SURVEY);
      await expect(node(page, '#title').locator('input, textarea').first()).toHaveValue('Client satisfaction survey, autumn 2026');
      const titles = async () => ((await value(page, 'question_and_page_ids')) as { values: { title: string } }[]).map((l) => l.values.title);
      expect((await titles()).length).toBe(13);
      if (variant === 'plain') await screen(page, 'real-survey');

      // A question added at the end, typed in its cell.
      // Named as Flectra names them: Add a question, Add a section.
      await expect(node(page, 'f-questions').locator('.fd-lines-add')).toHaveText(['+ Add a question', '+ Add a section', '+ Add a note']);
      await node(page, 'f-questions').getByRole('button', { name: 'Add a question' }).click();
      await expect(gridEditor(page, 'f-questions')).toBeFocused();
      await page.keyboard.type('Would you recommend us to a colleague?');
      // Done typing, the person clicks away: the line is kept.
      await node(page, 'f-user').click();
      await expect.poll(async () => (await titles()).at(-1)).toBe('Would you recommend us to a colleague?');
      await expect.poll(() => value(page, 'question_count')).toBe(11);
      // Moved up above the follow-up date, by Alt+↑ from its row.
      await expect(gridCell(page, 'f-questions', 13, 'title')).toHaveText('Would you recommend us to a colleague?');
      await gridCell(page, 'f-questions', 13, 'title').click();
      await expect(gridEditor(page, 'f-questions')).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(gridCell(page, 'f-questions', 13, 'title')).toBeFocused();
      await page.keyboard.press('Alt+ArrowUp');
      await expect.poll(async () => (await titles()).slice(-2)).toEqual(['Would you recommend us to a colleague?', 'Best day for a follow-up call']);
      const sequences = ((await value(page, 'question_and_page_ids')) as { values: { sequence: number } }[]).map((l) => l.values.sequence);
      expect(sequences).toEqual([...sequences].sort((a, b) => a - b));
      if (variant === 'plain') await screen(page, 'real-survey-question-moved');

      // Assessment: the server's onchange turns scoring on and invites only; Time & Scoring and Registered appear.
      await expect(node(page, 'scoring')).toBeHidden();
      await expect(page.locator('[data-node="s-registered"]')).toBeHidden();
      await tab(page, 'Options').click();
      await node(page, 'f-survey-type').getByText('Assessment', { exact: true }).click();
      await expect.poll(() => value(page, 'access_mode')).toBe('token');
      await expect.poll(() => value(page, 'scoring_type')).toBe('scoring_with_answers');
      await expect(node(page, 'scoring')).toBeVisible();
      await expect(page.locator('[data-node="s-registered"]')).toBeVisible();
      // A certification, then a login: Give Badge appears; the login off, and it goes, unticked.
      await node(page, 'f-certification').locator('input').check();
      await node(page, 'f-login').locator('input').check();
      await node(page, 'f-give-badge').locator('input').check();
      await expect(node(page, 'f-badge')).toBeVisible();
      await node(page, 'f-login').locator('input').uncheck();
      await expect(node(page, 'f-give-badge')).toBeHidden();
      await expect.poll(() => value(page, 'certification_give_badge')).toBe(false);
      // No scoring: the certification is switched off by the page's own rule.
      await node(page, 'f-scoring').getByText('No scoring', { exact: true }).click();
      await expect.poll(() => value(page, 'certification')).toBe(false);
      expect(await value(page, 'scoring_type')).toBe('no_scoring');
      if (variant === 'plain') await screen(page, 'real-survey-options');

      // Close archives it: the ribbon, and Reopen.
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      await expect.poll(async () => ((await stored(page, 'survey.survey', 7)) as { active: boolean }).active).toBe(false);
      await expect(page.locator('.fd-ribbon', { hasText: 'Archived' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Reopen' })).toBeVisible();
      expect(problems).toEqual([]);
    });

    test('the survey as Flectra lays it out: a question duplicated on its line, limits on one line, the session link to copy', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, SURVEY);
      await expect(node(page, '#title').locator('input, textarea').first()).toHaveValue('Client satisfaction survey, autumn 2026');
      const titles = async () => ((await value(page, 'question_and_page_ids')) as { values: { title: string } }[]).map((l) => l.values.title);
      // Duplicate Question on the second line: its copy right after it.
      const second = (await titles())[1];
      await node(page, 'f-questions').getByRole('button', { name: 'Copy line 2' }).click();
      await expect.poll(async () => (await titles())[2]).toBe(second);
      // Ten questions and three sections: the copy makes eleven questions, sections left out of the count.
      await expect.poll(() => value(page, 'question_count')).toBe(11);
      // Options: Limit Attempts and the time limit each on one line, as Flectra's: "to 1 attempts", "10:00 minutes".
      await tab(page, 'Options').click();
      await node(page, 'f-login').locator('input').check();
      await node(page, 'f-attempts-limited').locator('input').check();
      const attempts = (await node(page, 'f-attempts').boundingBox())!;
      const tick = (await node(page, 'f-attempts-limited').boundingBox())!;
      expect(Math.abs(attempts.y + attempts.height / 2 - (tick.y + tick.height / 2))).toBeLessThan(12);
      await expect(node(page, 'attempts-row')).toContainText('attempts');
      await node(page, 'f-survey-type').getByText('Assessment', { exact: true }).click();
      await node(page, 'f-time-limited').locator('input').check();
      await expect(node(page, 'f-time-limit').locator('input')).toHaveValue('10:00');
      // A live session's link, with a Copy button.
      await node(page, 'f-survey-type').getByText('Live session', { exact: true }).click();
      await expect(node(page, 'f-session-link').getByRole('button', { name: /Copy/ })).toBeVisible();
      expect(problems).toEqual([]);
    });

    test('a table in a tab out of sight rests: nothing redrawn frame after frame while nobody types', async ({ page }) => {
      await page.setViewportSize(WIDE);
      const { problems } = await open(page, variant, CASE);
      await expect(node(page, '#title').locator('input')).toHaveValue('LEG/2026/LIT/0042');
      // The tabs with tables, shown once and left: Expenses, then Billing's two.
      for (const label of ['Expenses', 'Billing', 'Description']) {
        await tab(page, label).scrollIntoViewIfNeeded();
        await tab(page, label).click();
      }
      // Three tables built: Expenses', and Billing's split and flat-fee lines (hidden by its condition).
      await expect(page.locator('.fd-grid-lines')).toHaveCount(3);
      const frames = await page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            const ask = window.requestAnimationFrame.bind(window);
            let asked = 0;
            window.requestAnimationFrame = (callback) => (asked++, ask(callback));
            setTimeout(() => resolve(asked), 1000);
          })
      );
      // A grid hidden as display: none measured itself every frame for ever: 120 frames a second each.
      expect(frames).toBeLessThan(10);
      // Shown again, a table is back as it was, drawn to fit.
      await tab(page, 'Expenses').click();
      await expect(node(page, 'f-expenses').locator('.ag-root-wrapper')).toBeVisible();
      await expect(node(page, 'f-expenses').locator('.ag-header-cell').first()).toBeVisible();
      expect(problems).toEqual([]);
    });

    test('the notebook’s tabs too long for their room: faded at the edge with more, scrolled by its button, the tab chosen in sight', async ({ page }) => {
      const strip = page.locator('[data-node="notebook"] > .fd-tabbar');
      const list = strip.locator('> .fd-tablist');
      /** The selected tab's edges inside the strip's own, less the room the fade and button keep. */
      const inSight = () =>
        list.evaluate((l) => {
          const room = l.getBoundingClientRect();
          const at = (l.querySelector('[aria-selected="true"]') as HTMLElement).getBoundingClientRect();
          return at.left >= room.left - 1 && at.right <= room.right + 1;
        });
      for (const [look, width] of [['', 390], ['&scheme=dark', 390], ['&locale=ar&dir=rtl', 390], ['', 1440], ['&locale=ar&dir=rtl', 1440]] as const) {
        await page.setViewportSize({ width, height: 900 });
        const { problems } = await open(page, variant, `${CASE}${look}`);
        await expect(node(page, '#title').locator('input')).toHaveValue('LEG/2026/LIT/0042');
        const overflows = await list.evaluate((l) => l.scrollWidth > l.clientWidth + 1);
        if (!overflows) {
          // Room for every tab: no fade, no buttons.
          await expect(strip).not.toHaveAttribute('data-more', /./);
          await expect(strip.locator('.fd-tabs-scroll:visible')).toHaveCount(0);
          expect(problems).toEqual([]);
          continue;
        }
        // At the start, more past the end only: its button there, at the end of the line — the left, right to left.
        await expect(strip).toHaveAttribute('data-more', 'end');
        const after = strip.locator('.fd-tabs-after');
        await expect(after).toBeVisible();
        await expect(strip.locator('.fd-tabs-before')).toBeHidden();
        const [bar, button] = [await strip.boundingBox(), await after.boundingBox()];
        const rtl = look.includes('rtl');
        expect(rtl ? button!.x - bar!.x : bar!.x + bar!.width - (button!.x + button!.width)).toBeLessThan(2);
        if (variant === 'plain') await screen(page, `real-legal-case-tabs-${width}${look.replace(/&|=/g, '-')}`);
        // Its button moves the strip along: more at both edges now, or at the start alone.
        await after.click();
        await expect(strip).toHaveAttribute('data-more', /start/);
        await expect(strip.locator('.fd-tabs-before')).toBeVisible();
        if (variant === 'plain') await screen(page, `real-legal-case-tabs-${width}${look.replace(/&|=/g, '-')}-scrolled`);
        // The last tab by the keyboard, then the first: each comes into sight.
        const tabs = list.locator('> .fd-tab:visible');
        await tabs.first().click();
        expect(await inSight()).toBe(true);
        await page.keyboard.press('End');
        await expect(tabs.last()).toHaveAttribute('aria-selected', 'true');
        await expect.poll(inSight).toBe(true);
        await page.keyboard.press('Home');
        await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
        await expect.poll(inSight).toBe(true);
        // A step that shows a tab far along: in sight too.
        const last = await tabs.last().getAttribute('data-node');
        await page.evaluate((target) => (window as any).fieldiaDemo.handle.run([{ do: 'goTo', target }]), last);
        await expect(tabs.last()).toHaveAttribute('aria-selected', 'true');
        await expect.poll(inSight).toBe(true);
        await expectNoSidewaysScroll(page);
        expect(problems).toEqual([]);
      }
    });

    test('at a phone’s width: the case and the survey fit, nothing scrolls sideways', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const { problems } = await open(page, variant, CASE);
      await expect(node(page, '#title').locator('input')).toHaveValue('LEG/2026/LIT/0042');
      await expectNoSidewaysScroll(page);
      if (variant === 'plain') await screen(page, 'real-legal-case-phone');
      await page.goto(`/${variant}/?${SURVEY}`);
      await expect(page.locator('.fd-form')).toBeVisible();
      await expectNoSidewaysScroll(page);
      if (variant === 'plain') await screen(page, 'real-survey-phone');
      expect(problems).toEqual([]);
    });
  });
}
