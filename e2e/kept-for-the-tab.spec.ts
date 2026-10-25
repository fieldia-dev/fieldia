import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, screen } from './support';

/**
 * What a demo saved stays while its tab is open — "What you save here stays while this tab is open", its frame says — in
 * every store a demo saves to, as an app's server keeps it: records, record templates, a list's saved views, properties
 * added in place, responses sent, a conversation. A link the demo's how-to gives, Back and Reload show it, never the
 * samples again; the frame's Start over takes it all away. The how-to's links are a visitor's: the frame hides its menu
 * and how-to from a test browser (navigator.webdriver), so these tests say they are none.
 */
async function asVisitor(page: Page) {
  await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
}

/** The how-to's steps, open: by itself at this width, else by its "?" in the header. */
async function howTo(page: Page) {
  const panel = page.locator('#demo-howto');
  if (!(await page.evaluate(() => document.body.classList.contains('ht-open')))) await page.locator('#demo-head .dh-help').click();
  await expect(panel).toBeVisible();
  return panel;
}

const kept = (page: Page) => page.locator('#demo-head .dh-kept');
/** Start over, in the kept line's place from the start: seen once something is saved. */
const startOver = (page: Page) => page.locator('#demo-head .dh-start-over');
const templates = (page: Page) => page.getByRole('button', { name: 'Templates', exact: true });

test.describe('plain · kept while the tab is open', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('a template saved is offered on the course the how-to’s Start a new course opens, and after a reload', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    await asVisitor(page);
    await page.goto('/plain/?page=treatment-course&record=1&skin=outlined');
    await expect(page.locator('.fd-form')).toBeVisible();
    await expect(startOver(page)).toBeHidden();
    // The walk: change the price, then Templates ▸ Save as template… "Morning package".
    const price = node(page, 'f-price').locator('input');
    await price.fill('9800');
    await price.press('Tab');
    await templates(page).click();
    await page.getByRole('menuitem', { name: 'Save as template…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Save as template…' });
    await dialog.getByRole('textbox', { name: 'Template name' }).fill('Morning package');
    await dialog.getByRole('button', { name: 'Save template' }).click();
    await expect(page.locator('.fd-say').filter({ hasText: 'Template “Morning package” saved.' })).toBeVisible();
    // Kept as the clinic's server keeps it: the frame says so at once.
    await expect(kept(page)).toHaveText('What you save here stays while this tab is open. Start over');
    await expect(startOver(page)).toBeVisible();
    // The how-to's own "Start a new course": a new page, the template among those to start from.
    await (await howTo(page)).getByRole('link', { name: 'Start a new course' }).click();
    await expect(page).toHaveURL(/[?&]record=new(&|$)/);
    await expect(page.locator('.fd-form')).toBeVisible();
    await templates(page).click();
    await expect(page.getByRole('menuitem')).toContainText(['Botox package', 'Laser course: 6 sessions', 'Morning package']);
    await screen(page, 'kept-template-new-course', { viewport: true });
    await page.getByRole('menuitem', { name: 'Morning package' }).click();
    await expect(page.locator('.fd-say').filter({ hasText: 'Started from “Morning package”.' })).toBeVisible();
    await expect(node(page, 'f-price').locator('input')).toHaveValue(/9,800/);
    // A reload, as the next visit: still there.
    await page.reload();
    await expect(page.locator('.fd-form')).toBeVisible();
    await templates(page).click();
    await expect(page.getByRole('menuitem', { name: 'Morning package' })).toBeVisible();
    // Deleted, it stays deleted.
    await page.getByRole('menuitem', { name: 'Delete templates…' }).click();
    const gone = page.getByRole('dialog', { name: 'Delete templates…' });
    await gone.getByRole('checkbox', { name: 'Morning package' }).check();
    await gone.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.locator('.fd-say').filter({ hasText: 'Templates deleted: 1' })).toBeVisible();
    await page.reload();
    await expect(page.locator('.fd-form')).toBeVisible();
    await templates(page).click();
    await expect(page.getByRole('menuitem', { name: 'Botox package' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Morning package' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    // Start over: the clinic's two again, nothing said kept.
    await page.locator('#demo-head').getByRole('button', { name: 'Start over' }).click();
    await expect(page).toHaveURL(/[?&]page=treatment-course&record=1&skin=outlined$/);
    await expect(page.locator('.fd-form')).toBeVisible();
    await expect(startOver(page)).toBeHidden();
    expect(problems).toEqual([]);
  });

  test('every store a demo saves to keeps it through a reload: a note and a to-do, a property, a response, a backlog’s bug and comment, a lead', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    // A customer's conversation: a note logged, a to-do marked done.
    await page.goto('/plain/?page=customer&skin=underline');
    const chatter = page.locator('.fd-slot[data-slot="chatter"] .fd-chatter');
    await expect(chatter.locator('.fd-activity')).toHaveCount(3);
    await chatter.getByRole('button', { name: 'Log note' }).click();
    await chatter.locator('.fd-composer textarea').fill('Kept while the tab is open.');
    await chatter.locator('.fd-composer textarea').press('ControlOrMeta+Enter');
    await expect(chatter.locator('.fd-message').first()).toContainText('Kept while the tab is open.');
    const call = chatter.locator('.fd-activity', { hasText: 'Confirm the delivery day' });
    await call.getByRole('button', { name: 'Mark done' }).click();
    await call.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(chatter.locator('.fd-activity')).toHaveCount(2);
    await expect(kept(page)).toBeVisible();
    await page.reload();
    await expect(chatter.locator('.fd-activity')).toHaveCount(2);
    await expect(chatter.locator('.fd-message', { hasText: 'Kept while the tab is open.' })).toHaveCount(1);
    // Another note after the reload is a message of its own, never the kept one's twin.
    await chatter.getByRole('button', { name: 'Log note' }).click();
    await chatter.locator('.fd-composer textarea').fill('And one more.');
    await chatter.locator('.fd-composer textarea').press('ControlOrMeta+Enter');
    await expect(chatter.locator('.fd-message').first()).toContainText('And one more.');
    await expect(chatter.locator('.fd-message', { hasText: 'Kept while the tab is open.' })).toHaveCount(1);

    // A property added in place: the project's next record offers it too.
    await page.goto('/plain/?page=business&skin=underline');
    const props = node(page, 'f-properties');
    await props.getByRole('button', { name: '+ Add a property' }).click();
    await props.getByLabel('Property name').fill('Locker number');
    await props.getByLabel('Kind').selectOption('integer');
    await props.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(props.getByLabel('Locker number')).toBeFocused();
    await page.reload();
    await expect(props.locator('.fd-property > label')).toHaveText(['Floor', 'Lift booked', 'Site contact', 'Handover', 'Locker number']);

    // A response sent: counted again, as the server counts it — one place fewer, one response from each person.
    await page.goto('/plain/?page=event-signup&skin=outlined');
    const session = node(page, 'f-session');
    await expect(session.locator('.fd-seats:not([hidden])')).toHaveText(['2 left', 'Full', '26 left']);
    await node(page, 'f-name').locator('input').fill('Karim Nabil');
    await node(page, 'f-email').locator('input').fill('karim@example.com');
    await session.getByRole('radio', { name: /Morning workshop/ }).check();
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(page.locator('.fd-done-title')).toHaveText('You are signed up, Karim Nabil');
    await page.reload();
    await expect(page.locator('.fd-closed-title')).toHaveText('You have sent your answers to this form already.');
    await screen(page, 'kept-response-reloaded', { viewport: true });

    // The backlog's own source: a new bug, and a comment on 4127.
    await page.goto('/backlog/');
    await expect(page.locator('.fd-list-row').first()).toBeVisible();
    await page.getByRole('button', { name: 'New Work Item' }).click();
    await page.getByRole('dialog').locator('[data-field="title"] textarea').fill('Printing a pick list cuts its last line');
    await page.getByRole('dialog').getByRole('button', { name: 'Save and Close', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.goto('/backlog/?workitem=4127');
    await expect(page.getByRole('dialog').getByRole('button', { name: /1 Comment/ })).toBeVisible();
    await page.locator('.fd-composer-card .fd-text-area').click();
    await page.keyboard.type('The scanner is back.');
    await page.locator('.fd-composer-card').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('dialog').getByRole('button', { name: /2 Comments/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('dialog').getByRole('button', { name: /2 Comments/ })).toBeVisible();
    await page.goto('/backlog/');
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.locator('.fd-list-row', { hasText: 'Printing a pick list cuts its last line' })).toBeVisible();

    // One record in two tabs: Sara's phone saved, Mona's stage from her tab — both the server's.
    await page.goto('/save-safety/');
    const yours = page.locator('.ss-tab[data-who="you"] .fd-form');
    const phone = yours.locator('.fd-field[data-field="phone"] input').first();
    await expect(phone).toHaveValue('+20 100 123 4567');
    await phone.fill('+20 100 999 8887');
    await yours.locator('.fd-header button[type="submit"]').click();
    await expect(yours.locator('.fd-status')).toHaveText('Saved');
    await page.reload();
    await expect(phone).toHaveValue('+20 100 999 8887');
    // Its leads are its own: the sales team's queue still has its own leads, never these.
    await page.goto('/plain/?page=leads-queue&skin=underline');
    await expect(page.locator('.fd-list-row').first()).toBeVisible();
    expect(await page.evaluate(() => Object.values((window as any).fieldiaDemo.dataSource.records['lead'] ?? {}).some((lead: any) => lead.phone === '+20 100 999 8887'))).toBe(false);
    expect(problems).toEqual([]);
  });
});
