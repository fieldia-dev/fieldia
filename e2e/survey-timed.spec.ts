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
});
