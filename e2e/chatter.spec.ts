import { expect, test, type Page } from '@playwright/test';
import { node, open, screen } from './support';
import { VARIANTS } from './variants';

/** The chatter beside the customer sheet, in every framework. */
const chatter = (page: Page) => page.locator('.fd-slot[data-slot="chatter"] .fd-chatter');
const posted = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.chatter.posted as { kind: string; body: string; parentId?: number; mentions?: { name: string }[]; attachments?: { name: string }[] }[]);

for (const variant of VARIANTS) {
  test.describe(`${variant} · chatter`, () => {
    test('sits beside the sheet without stretching it, and lays its parts out to read', async ({ page }) => {
      await open(page, variant, 'page=customer&skin=underline');
      await expect(chatter(page).locator('.fd-activity')).toHaveCount(3);
      // The sheet keeps its own height: a badge stays a badge, the title follows close behind.
      const badge = (await node(page, 'b-key-account').boundingBox())!;
      expect(badge.height, 'the badge is stretched').toBeLessThan(40);
      // An activity's summary has room to read: never broken word by word.
      const summary = (await chatter(page).locator('.fd-activity-summary').nth(1).boundingBox())!;
      expect(summary.width, 'the summary is squeezed').toBeGreaterThan(150);
      await screen(page, `${variant}-chatter`, { viewport: true });
    });

    test('sends a message mentioning someone, with a file, and logs a note with Ctrl+Enter, the record staying unsaved', async ({ page }) => {
      const { demo } = await open(page, variant, 'page=customer&skin=underline');
      const panel = chatter(page);
      await panel.getByRole('button', { name: 'Send message' }).click();
      const box = panel.locator('.fd-composer textarea');
      await expect(box).toBeFocused();
      await box.pressSequentially('Over to you @mo');
      await expect(panel.locator('.fd-mentions [role=option]')).toHaveText(['Mona Adel']);
      await box.press('Enter');
      await expect(box).toHaveValue('Over to you @Mona Adel ');
      await panel.locator('.fd-composer input[type=file]').setInputFiles({ name: 'quote.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
      await expect(panel.locator('.fd-composer .fd-attachment')).toHaveCount(1);
      await screen(page, `${variant}-chatter-composing`, { viewport: true });
      await panel.getByRole('button', { name: 'Send', exact: true }).click();
      await expect(panel.locator('.fd-message').first()).toContainText('Over to you @Mona Adel');
      await expect(panel.locator('.fd-message').first().locator('.fd-attachment-file')).toContainText('quote.pdf');
      await panel.getByRole('button', { name: 'Log note' }).click();
      await box.fill('Client prefers mornings.');
      await box.press('ControlOrMeta+Enter');
      await expect(panel.locator('.fd-message').first()).toHaveClass(/fd-message-note/);
      const sent = await posted(page);
      expect(sent.map((m) => m.kind)).toEqual(['message', 'note']);
      expect(sent[0].mentions?.map((p) => p.name)).toEqual(['Mona Adel']);
      // Ctrl+Enter in the chatter posted the note; the record itself was not saved.
      expect(await demo<unknown[]>('dataSource.calls').then((calls) => (calls as { method: string }[]).filter((c) => c.method === 'save'))).toEqual([]);
    });

    test('reacts, and answers a message', async ({ page }) => {
      await open(page, variant, 'page=customer&skin=underline');
      const panel = chatter(page);
      const mona = panel.locator('.fd-message', { hasText: 'Here is the 12th floor' });
      await mona.getByRole('button', { name: 'Add a reaction' }).click();
      await mona.locator('.fd-reaction-picker').getByRole('button', { name: '👍' }).click();
      await expect(mona.locator('.fd-reaction')).toHaveText('👍 1');
      await expect(mona.locator('.fd-reaction')).toHaveAttribute('aria-pressed', 'true');
      await mona.getByRole('button', { name: 'Reply' }).click();
      await expect(panel.locator('.fd-replying')).toHaveText('Replying to Mona Adel');
      await panel.locator('.fd-composer textarea').fill('Yes: the reception can move.');
      await panel.getByRole('button', { name: 'Send', exact: true }).click();
      await expect(panel.locator('.fd-message').first().locator('.fd-message-parent')).toHaveText('Replying to Mona Adel');
      await screen(page, `${variant}-chatter-reply`, { viewport: true });
    });

    test('schedules an activity, marks one done, cancels another', async ({ page }) => {
      await open(page, variant, 'page=customer&skin=underline');
      const panel = chatter(page);
      await panel.getByRole('button', { name: 'Schedule activity' }).click();
      const form = panel.locator('.fd-activity-form');
      await form.getByLabel('Activity', { exact: true }).selectOption({ label: 'Meeting' });
      await form.getByLabel('Summary').fill('Walk the floor with the electrician');
      await form.getByLabel('Assigned to').selectOption({ label: 'Karim Fathy' });
      await screen(page, `${variant}-chatter-schedule`, { viewport: true });
      await form.getByRole('button', { name: 'Schedule' }).click();
      await expect(panel.locator('.fd-activity')).toHaveCount(4);
      const call = panel.locator('.fd-activity', { hasText: 'Confirm the delivery day' });
      await call.getByRole('button', { name: 'Mark done' }).click();
      await call.locator('textarea').fill('Sunday the 11th, morning.');
      await call.getByRole('button', { name: 'Done', exact: true }).click();
      await expect(panel.locator('.fd-activity')).toHaveCount(3);
      await expect(panel.locator('.fd-message').first()).toContainText('Sunday the 11th, morning.');
      await panel.locator('.fd-activity', { hasText: 'Site visit with Mona' }).getByRole('button', { name: 'Cancel activity' }).click();
      await expect(panel.locator('.fd-activity')).toHaveCount(2);
    });

    test('lists followers, adds one and takes one away', async ({ page }) => {
      await open(page, variant, 'page=customer&skin=underline');
      const panel = chatter(page);
      const toggle = panel.locator('.fd-followers-toggle');
      await expect(toggle).toHaveAccessibleName('Followers: 2');
      await toggle.click();
      const followers = panel.locator('.fd-followers');
      await followers.getByRole('searchbox').fill('you');
      await followers.getByRole('option', { name: 'Youssef Kamal' }).click();
      await expect(toggle).toHaveAccessibleName('Followers: 3');
      await screen(page, `${variant}-chatter-followers`, { viewport: true });
      await followers.getByRole('button', { name: 'Stop Karim Fathy following' }).click();
      await expect(followers.locator('.fd-follower-name')).toHaveText(['Mona Adel', 'Youssef Kamal']);
    });
  });
}
