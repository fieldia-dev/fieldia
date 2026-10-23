import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings } from './a11y-support';
import { node, open, screen } from './support';

/**
 * A time limit, as a member of staff meets it on the clinic's check: the limit said with Start before any question, the
 * countdown over them once started, a warning as it nears its end, and the answers sent as they stood when it runs out
 * — the page saying so. The browser's clock is the test's.
 */

const CHECK = 'page=training-check&skin=outlined';
const box = (page: Page, id: string) => node(page, id).locator('input, select, textarea').first();

test.describe('a time limit', () => {
  test('says the limit with Start, counts down over the questions, warns, and sends the answers as they stood', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-20T09:00:00Z') });
    await open(page, 'plain', CHECK);
    const start = page.locator('.fd-time-start');
    await expect(start).toBeVisible();
    await expect(start).toContainText('You have 10 minutes to answer, from when you press Start.');
    await expect(node(page, 'q-name')).toBeHidden();
    await screen(page, 'survey-timed-start');
    expect(await axeFindings(page, 'a time limit before Start')).toEqual([]);
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(node(page, 'q-name')).toBeVisible();
    const clock = page.locator('.fd-time-bar');
    await expect(clock).toHaveAttribute('role', 'timer');
    await expect(clock).toContainText('Time left: 10:00');
    await box(page, 'q-name').fill('Mona Adel');
    await page.clock.runFor(8 * 60_000 + 1000);
    await expect(clock).toContainText('Time left: 1:59');
    await expect(clock).toHaveAttribute('data-stage', 'warning');
    await screen(page, 'survey-timed-warning');
    // Run out: the answers go as they stand — a name, no role — and the page says so.
    await page.clock.runFor(2 * 60_000);
    await expect(page.locator('.fd-done')).toBeVisible();
    await expect(page.locator('.fd-time-done')).toHaveText('Time is up: your answers were sent as they were.');
    await screen(page, 'survey-timed-sent');
  });

  /** The walk's steps: Start, a name and a role, Next, the first answer, a while — then the tab reloaded. */
  async function halfWay(page: Page) {
    await page.clock.install({ time: new Date('2026-10-20T09:00:00Z') });
    await open(page, 'plain', CHECK);
    // The page asks before a reload lets typed answers go; the person goes on with it.
    page.on('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Start' }).click();
    await page.getByLabel('Your name').fill('Nadia Samir');
    await page.getByLabel('Nurse').check();
    await page.getByRole('button', { name: /^Next/ }).click();
    await page.getByLabel(/Hyaluronic acid/).check();
    await page.clock.runFor(3 * 60_000);
    await expect(page.locator('.fd-time-bar')).toContainText('Time left: 7:00');
  }

  test('a reload goes on with the time left and the answers given: never a way round the limit', async ({ page }) => {
    await halfWay(page);
    // The clock held still, so what is left reads the same before and after.
    await page.clock.pauseAt(new Date('2026-10-20T09:03:30Z'));
    await expect(page.locator('.fd-time-bar')).toContainText(/Time left: 6:3[01]/);
    await page.reload();
    await expect(page.locator('.fd-form')).toBeVisible();
    // No Start again, no full ten minutes: the clock goes on from where it stood, on the step it was on.
    await expect(page.locator('.fd-time-bar')).toContainText(/Time left: 6:3[01]/);
    await expect(page.locator('.fd-time-start')).toBeHidden();
    await expect(page.getByLabel(/Hyaluronic acid/)).toBeChecked();
    // On again: a screen waits for the page's frames, which a held clock holds too.
    await page.clock.resume();
    await screen(page, 'survey-timed-reloaded');
    await page.getByRole('button', { name: /^Back/ }).click();
    await expect(page.getByLabel('Your name')).toHaveValue('Nadia Samir');
    await expect(page.getByLabel('Nurse')).toBeChecked();
    await page.clock.runFor(7 * 60_000);
    await expect(page.locator('.fd-time-done')).toHaveText('Time is up: your answers were sent as they were.');
  });

  test('a reload after the time ran out says so and sends the answers as they stood', async ({ page }) => {
    await halfWay(page);
    // The tab put away — a phone's browser asleep, the page not running — and opened again long after its ten minutes.
    await page.goto('about:blank');
    await page.clock.setSystemTime(new Date('2026-10-20T09:30:00Z'));
    await open(page, 'plain', CHECK);
    await expect(page.locator('.fd-done')).toBeVisible();
    await expect(page.locator('.fd-time-done')).toHaveText('Time is up: your answers were sent as they were.');
    await expect(page.locator('.fd-time-start')).toBeHidden();
    await screen(page, 'survey-timed-reloaded-late');
  });
});
