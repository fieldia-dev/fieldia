import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings } from './a11y-support';
import { node, open, screen } from './support';

/**
 * Endings and the answers in a page's own words, as people meet them: a booking that ends with the reference the
 * clinic's server gave it, and a feedback form that asks of the branch visited by its name, follows it as it changes,
 * and ends by what was answered — the ending read out, its button to start again its own or none. In the survey
 * designer: an ending added, an answer put in its words with the { } button, tried.
 */

const box = (page: Page, id: string) => node(page, id).locator('input, select, textarea').first();
const ending = (page: Page) => page.locator('.fd-done');

test.describe('a booking that ends with its reference', () => {
  // "Now" pinned, on Cairo's clock: Wednesday 14 October 2026, 09:40, so the clinic's free times are the same each run.
  test.use({ timezoneId: 'Africa/Cairo', locale: 'en-GB' });
  const BOOKING = 'page=template-appointment-booking&theme=apple&now=2026-10-14T09:40';
  const slots = (page: Page) => node(page, 'f-when');
  const day = (page: Page, n: number) => slots(page).locator('.fd-slots-days button:not(.fd-outside)').filter({ hasText: new RegExp(`^${n}$`) });
  const chips = (page: Page) => slots(page).locator('.fd-slots-chip');
  /** The month asked of the clinic's schedule: no day still waiting for its state. */
  const settled = (page: Page) => expect(slots(page).locator('.fd-slots-days')).not.toHaveAttribute('aria-busy', 'true');

  /** A service, a day and one of its free times, then who is coming, as a person books: from the times the clinic has free. */
  async function book(page: Page, visit: 'In person' | 'Video call', who = { name: 'Sara Hassan', email: 'sara@example.com' }) {
    await node(page, 'f-service').getByLabel('First consultation, 30 min').check();
    await settled(page);
    await day(page, 15).click();
    await chips(page).filter({ hasText: /^10:00$/ }).click();
    await expect(chips(page).filter({ hasText: /^10:00$/ })).toHaveAttribute('aria-pressed', 'true');
    await node(page, 'f-visit').getByLabel(visit).check();
    await box(page, 'f-name').fill(who.name);
    await box(page, 'f-phone').fill('+20 100 123 4567');
    await box(page, 'f-email').fill(who.email);
    await page.getByRole('button', { name: 'Submit' }).click();
  }

  test('says the reference the server gave, with what was booked, and takes the focus so it is read out', async ({ page }) => {
    await open(page, 'plain', BOOKING);
    await book(page, 'In person');
    await expect(ending(page)).toBeVisible();
    const title = ending(page).locator('.fd-done-title');
    await expect(title).toHaveText('You are booked, Sara Hassan');
    await expect(title).toBeFocused();
    await expect(ending(page).locator('.fd-done-words')).toHaveText(['Your booking is B-1043: First consultation, 30 min.', 'See you on 15 Oct 2026, 10:00. We have sent the details to sara@example.com.']);
    await screen(page, 'endings-booking');
    expect(await axeFindings(page, 'a booking’s ending')).toEqual([]);
    // Its own button starts again: the next booking has the next reference.
    await page.getByRole('button', { name: 'Book another' }).click();
    await expect(ending(page)).toBeHidden();
    await expect(box(page, 'f-name')).toHaveValue('');
  });

  test('says the ending its answers choose: a video call’s', async ({ page }) => {
    await open(page, 'plain', BOOKING);
    await book(page, 'Video call');
    await expect(ending(page).locator('.fd-done-words')).toHaveText(['Your booking is B-1043: First consultation, 30 min, by video call.', 'We call you on 15 Oct 2026, 10:00: the link to join comes to sara@example.com an hour before.']);
  });

  test('books only a time the clinic has free: never a day gone by, never a time already booked', async ({ page }) => {
    const { problems } = await open(page, 'plain', BOOKING);
    await node(page, 'f-service').getByLabel('First consultation, 30 min').check();
    await settled(page);
    // The days before today, and today's times gone by, are not offered.
    await expect(day(page, 13)).toHaveAttribute('data-state', 'past');
    await day(page, 14).click();
    await expect(chips(page).first()).toHaveText('10:00');
    await screen(page, 'endings-booking-free-times');
    // Booked once…
    await page.reload();
    await book(page, 'In person');
    await expect(ending(page).locator('.fd-done-words').first()).toContainText('B-1043');
    // …that time is no one else's: the next booking is never offered it, the times round it still are.
    await page.getByRole('button', { name: 'Book another' }).click();
    await node(page, 'f-service').getByLabel('First consultation, 30 min').check();
    await settled(page);
    await day(page, 15).click();
    await expect(chips(page).filter({ hasText: /^09:30$/ })).toHaveCount(1);
    await expect(chips(page).filter({ hasText: /^10:00$/ })).toHaveCount(0);
    await expect(chips(page).filter({ hasText: /^10:30$/ })).toHaveCount(1);
    // A full review is an hour, its times an hour apart: 10:00 is taken for it too, the hours either side free.
    await node(page, 'f-service').getByLabel('Full review, 60 min').check();
    await settled(page);
    await day(page, 15).click();
    await expect(chips(page).filter({ hasText: /^10:00$/ })).toHaveCount(0);
    await expect(chips(page).filter({ hasText: /^09:00$/ })).toHaveCount(1);
    await expect(chips(page).filter({ hasText: /^11:00$/ })).toHaveCount(1);
    await expect(chips(page).filter({ hasText: /^10:30$/ })).toHaveCount(0);
    await screen(page, 'endings-booking-taken');
    expect(problems).toEqual([]);
  });
});

test.describe('a registration that ends with the ticket and where it goes', () => {
  test('names the ticket and its price, the workshops picked, and the email the ticket goes to', async ({ page }) => {
    await open(page, 'plain', 'page=template-event-registration&theme=material');
    await box(page, 'f-name').fill('Sara Hassan');
    await box(page, 'f-email').fill('sara@example.com');
    await node(page, 'f-ticket').getByLabel('VIP, with the dinner').check();
    await node(page, 'f-sessions').getByLabel('Data you can trust').check();
    await node(page, 'f-sessions').getByLabel('Growing a small team').check();
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(ending(page).locator('.fd-done-title')).toHaveText('You are registered, Sara Hassan');
    await expect(ending(page).locator('.fd-done-words')).toHaveText([
      // Money as its box writes it: the currency's sign, then the amount.
      /^Your ticket: VIP, with the dinner, \$\s250\.00\.$/,
      'Your workshops: Data you can trust, Growing a small team.',
      'Your ticket goes to sara@example.com, with how to get there. See you in Cairo on 14 November.',
    ]);
    await screen(page, 'endings-registration');
    // Someone else registered next: no workshop picked, none said.
    await page.getByRole('button', { name: 'Register someone else' }).click();
    await box(page, 'f-name').fill('Omar Said');
    await box(page, 'f-email').fill('omar@example.com');
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(ending(page).locator('.fd-done-words')).toHaveText([
      /^Your ticket: Standard, \$\s120\.00\.$/,
      'Your ticket goes to omar@example.com, with how to get there. See you in Cairo on 14 November.',
    ]);
  });
});

test.describe('feedback that asks of the branch by its name', () => {
  const rating = (page: Page) => node(page, 'f-overall');

  test('asks how the visit went in its own words until a branch is picked, then by its name, and follows a change', async ({ page }) => {
    await open(page, 'plain', 'page=template-customer-feedback&theme=google-forms');
    // While the branch is empty, the words the page gives for it: in the label's own weight, not a value's.
    await expect(rating(page).locator('.fd-label')).toHaveText('How was your visit to us?');
    await expect(node(page, 'f-better').locator('.fd-label')).toHaveText('What could we do better?');
    await expect(rating(page).locator('.fd-label .fd-value')).toHaveCSS('font-weight', '400');
    await screen(page, 'endings-feedback-empty');
    await node(page, 'f-branch').getByLabel('Riverside').check();
    await expect(rating(page).locator('.fd-label')).toHaveText('How was your visit to Riverside?');
    await expect(rating(page).locator('.fd-label .fd-value')).not.toHaveCSS('font-weight', '400');
    await expect(node(page, 'f-better').locator('.fd-label')).toHaveText('What could Riverside do better?');
    await screen(page, 'endings-feedback-branch');
    expect(await axeFindings(page, 'a label naming the branch')).toEqual([]);
    await node(page, 'f-branch').getByLabel('Hillcrest').check();
    await expect(rating(page).locator('.fd-label')).toHaveText('How was your visit to Hillcrest?');
    // Required, it says so by the label as it reads now.
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(rating(page).locator('.fd-error')).toHaveText('How was your visit to Hillcrest? is required');
  });

  test('a low rating ends in sorry, naming who reads it, with no second response', async ({ page }) => {
    await open(page, 'plain', 'page=template-customer-feedback&theme=google-forms');
    await node(page, 'f-branch').getByLabel('Downtown').check();
    await rating(page).getByRole('radio').first().click();
    await node(page, 'f-recommend').getByRole('radio').nth(3).click();
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(ending(page).locator('.fd-done-title')).toHaveText('We are sorry, and thank you for telling us');
    await expect(ending(page).locator('.fd-done-words')).toHaveText('The team at Downtown reads every answer, and it changes what we do next.');
    await expect(ending(page).getByRole('button')).toBeHidden();
    await screen(page, 'endings-feedback-sorry');
  });

  test('a low rating with a reply asked for says who writes, and where', async ({ page }) => {
    await open(page, 'plain', 'page=template-customer-feedback&theme=google-forms');
    await node(page, 'f-branch').getByLabel('Downtown').check();
    await rating(page).getByRole('radio').nth(1).click();
    await node(page, 'f-recommend').getByRole('radio').nth(2).click();
    await node(page, 'f-follow').getByRole('switch').click();
    await box(page, 'f-email').fill('mona@example.com');
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(ending(page).locator('.fd-done-words')).toHaveText('The manager at Downtown reads every answer, and will write to you at mona@example.com within a day.');
  });

  test('a good rating ends in thanks, and offers another response', async ({ page }) => {
    await open(page, 'plain', 'page=template-customer-feedback&theme=google-forms');
    await node(page, 'f-branch').getByLabel('Hillcrest').check();
    await rating(page).getByRole('radio').nth(4).click();
    await node(page, 'f-recommend').getByRole('radio').nth(9).click();
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(ending(page).locator('.fd-done-title')).toHaveText('Thank you!');
    await expect(ending(page).locator('.fd-done-words')).toHaveText('We are glad you came to Hillcrest. See you again soon.');
    await page.getByRole('button', { name: 'Submit another response' }).click();
    await expect(rating(page).locator('.fd-label')).toHaveText('How was your visit to us?');
  });
});

test.describe('the survey designer', () => {
  test('adds an ending, puts an answer in its words with the { } button, and Try it ends with it', async ({ page }) => {
    await page.goto('/designer/?start=survey');
    const endings = page.locator('.fd-survey-endings');
    await endings.scrollIntoViewIfNeeded();
    await endings.getByRole('button', { name: 'Add an ending' }).click();
    const title = endings.getByRole('textbox', { name: 'Title of ending 1' });
    await expect(title).toHaveValue('Thank you');
    await title.click();
    await title.press('End');
    await title.pressSequentially(', ');
    await endings.getByRole('button', { name: 'Put an answer in: Title of ending 1' }).click();
    // What to say while the name is empty, then the answer.
    const answers = page.getByRole('dialog', { name: 'Put in the answer to' });
    await answers.getByRole('textbox', { name: 'When empty' }).fill('friend');
    await screen(page, 'endings-answer-picker', { viewport: true });
    await answers.getByRole('button', { name: 'Your name' }).click();
    await expect(title).toHaveValue('Thank you, {name|friend}');
    await expect(title).toBeFocused();
    await expect.poll(() => page.evaluate(() => (window as unknown as { fieldiaDesigner: { designer: { getPage(): { endings?: unknown } } } }).fieldiaDesigner.designer.getPage().endings)).toEqual([{ title: 'Thank you, {name|friend}' }]);
    await screen(page, 'endings-designer');
    await page.getByRole('button', { name: 'Try it' }).click();
    const tried = page.locator('.fd-try');
    await tried.getByRole('textbox', { name: 'Your name' }).fill('Sara');
    await tried.getByRole('button', { name: 'Next' }).click();
    await tried.getByRole('radio').nth(1).check();
    await tried.getByRole('button', { name: 'Next' }).click();
    await tried.getByRole('textbox', { name: 'What stops you from using it?' }).fill('Too dear');
    await tried.getByRole('button', { name: 'Next' }).click();
    await tried.getByRole('button', { name: 'Send my answers' }).click();
    await expect(tried.locator('.fd-done-title')).toHaveText('Thank you, Sara');
  });
});
