import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings } from './a11y-support';
import { node, open, screen } from './support';

/**
 * A time limit, as a member of staff meets it on the clinic's check: the limit said with Start before any question, the
 * countdown over them once started, a warning as it nears its end, and the answers sent as they stood when it runs out
 * — the page saying so. The browser's clock is the test's, held still between its steps: the time left moves only as
 * the test moves it.
 */

const CHECK = 'page=training-check&skin=outlined';
const box = (page: Page, id: string) => node(page, id).locator('input, select, textarea').first();
/**
 * The page's clock held still from here, a moment on from its own now: the time left moves only as the test moves it
 * (`runFor`), never by how long the runner took between its steps. Installed, the fake clock runs in real time until
 * it is paused — and a slow runner (WebKit under load) read "6:55" where three minutes on from Start left 7:00.
 */
const hold = async (page: Page) => page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 1000));
/** A screen of a page whose clock is held: its frames wait on the clock, so it runs while the screen is taken, then is held again. */
async function heldScreen(page: Page, name: string) {
  await page.clock.resume();
  await screen(page, name);
  await hold(page);
}

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
    await hold(page);
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(node(page, 'q-name')).toBeVisible();
    const clock = page.locator('.fd-time-bar');
    await expect(clock).toHaveAttribute('role', 'timer');
    await expect(clock).toContainText('Time left: 10:00');
    await box(page, 'q-name').fill('Mona Adel');
    await page.clock.runFor(8 * 60_000 + 1000);
    await expect(clock).toContainText('Time left: 1:59');
    await expect(clock).toHaveAttribute('data-stage', 'warning');
    await heldScreen(page, 'survey-timed-warning');
    // Run out: the answers go as they stand — a name, no role — and the page says so.
    await page.clock.runFor(2 * 60_000);
    await expect(page.locator('.fd-done')).toBeVisible();
    await expect(page.locator('.fd-time-done')).toHaveText('Time is up: your answers were sent as they were.');
    await heldScreen(page, 'survey-timed-sent');
  });

  /** The walk's steps: Start, a name and a role, Next, the first answer, a while — then the tab reloaded. */
  async function halfWay(page: Page) {
    await page.clock.install({ time: new Date('2026-10-20T09:00:00Z') });
    await open(page, 'plain', CHECK);
    // The page asks before a reload lets typed answers go; the person goes on with it.
    page.on('dialog', (dialog) => void dialog.accept());
    await hold(page);
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
    // The clock held still since Start, so what is left reads the same before and after: seven minutes, to the second.
    const bar = page.locator('.fd-time-bar');
    await expect(bar).toContainText('Time left: 7:00');
    const left = ((await bar.textContent()) ?? '').match(/Time left: \d+:\d\d/)?.[0] ?? '';
    await page.reload();
    await expect(page.locator('.fd-form')).toBeVisible();
    // No Start again, no full ten minutes: the clock goes on from where it stood, on the step it was on.
    await expect(bar).toContainText(left);
    await expect(page.locator('.fd-time-start')).toBeHidden();
    await expect(page.getByLabel(/Hyaluronic acid/)).toBeChecked();
    await heldScreen(page, 'survey-timed-reloaded');
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
    // Running again as it is opened, long after: what it asks of its timers then — the answers sent — runs.
    await page.clock.resume();
    await page.clock.setSystemTime(new Date('2026-10-20T09:30:00Z'));
    await open(page, 'plain', CHECK);
    await expect(page.locator('.fd-done')).toBeVisible();
    await expect(page.locator('.fd-time-done')).toHaveText('Time is up: your answers were sent as they were.');
    await expect(page.locator('.fd-time-start')).toBeHidden();
    await screen(page, 'survey-timed-reloaded-late');
  });
});
