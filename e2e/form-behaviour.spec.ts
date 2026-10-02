import { expect, test, type Page } from '@playwright/test';
import { node, open, screen } from './support';
import { VARIANTS } from './variants';

/** Behaviour around the fields: the ✓ of a field filled in right, a refused save, the save's status. */

/** Makes the demo's data source refuse its saves as told: a refusal by kind, or a fetch that fails. */
const refuse = (page: Page, how: { kind: string; message: string; fields?: Record<string, string> } | 'network') =>
  page.evaluate((how) => {
    const source = (window as any).fieldiaDemo.dataSource;
    source.realSave ??= source.save;
    source.save = async () => {
      if (how === 'network') throw new TypeError('Failed to fetch');
      throw Object.assign(new Error(how.message), { problem: how });
    };
  }, how);
const letSavesThrough = (page: Page) =>
  page.evaluate(() => {
    const source = (window as any).fieldiaDemo.dataSource;
    source.save = source.realSave;
  });
for (const variant of VARIANTS) {
  test.describe(`${variant} · form behaviour`, () => {
    test('a ✓ appears by a field filled in right when the page asks, and goes when it goes wrong', async ({ page }) => {
      await open(page, variant, 'page=signup&skin=outlined&showValid=1');
      const name = node(page, 'f-name');
      const email = node(page, 'f-email');
      await expect(name.locator('.fd-valid-mark')).toBeHidden();
      await name.locator('input').fill('Sara Hassan');
      await expect(name.locator('.fd-valid-mark')).toBeVisible();
      await email.locator('input').fill('sara@');
      await expect(email.locator('.fd-valid-mark')).toBeHidden();
      await email.locator('input').fill('sara@example.com');
      await expect(email.locator('.fd-valid-mark')).toBeVisible();
      // On the label's own line, right after its words.
      const label = (await name.locator('.fd-label').boundingBox())!;
      const mark = (await name.locator('.fd-valid-mark').boundingBox())!;
      expect(Math.abs(mark.y + mark.height / 2 - (label.y + label.height / 2))).toBeLessThan(4);
      expect(mark.x).toBeGreaterThan(label.x);
      await screen(page, `${variant}-valid-marks`, { viewport: true });
      await name.locator('input').fill('');
      await expect(name.locator('.fd-valid-mark')).toBeHidden();
    });

    test('a server’s field errors land on their fields, and the refusal is said and announced', async ({ page }) => {
      await open(page, variant, 'page=customer&skin=underline');
      await refuse(page, { kind: 'fields', message: 'Check the email', fields: { email: 'This email is already a customer’s' } });
      await node(page, 'f-phone').locator('input').fill('+20 2 1111 2222');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(node(page, 'f-email').locator('.fd-error')).toHaveText('This email is already a customer’s');
      await expect(page.locator('.fd-status')).toHaveText('Not saved. Check: Email');
      await expect(page.locator('.fd-announce')).toHaveText('Not saved. Check: Email');
      await expect(node(page, 'f-email').locator('input')).toBeFocused();
      await screen(page, `${variant}-save-refused-fields`, { viewport: true });
      await node(page, 'f-email').locator('input').fill('sales@niletraders.example');
      await expect(node(page, 'f-email').locator('.fd-error')).toBeHidden();
    });

    test('a business rule appears in a dialog', async ({ page }) => {
      await open(page, variant, 'page=customer&skin=underline');
      await refuse(page, { kind: 'rule', message: 'A blocked customer cannot be given more credit.' });
      await node(page, 'f-phone').locator('input').fill('+20 2 1111 2222');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      const notice = page.getByRole('alertdialog');
      await expect(notice).toContainText('A blocked customer cannot be given more credit.');
      await screen(page, `${variant}-save-refused-rule`, { viewport: true });
      await notice.getByRole('button', { name: 'OK' }).click();
      await expect(notice).toBeHidden();
      await expect(page.locator('.fd-status')).toHaveText('Not saved');
    });

    test('a network failure shows a banner, and Retry saves once the server answers', async ({ page }) => {
      const { demo } = await open(page, variant, 'page=customer&skin=underline');
      await refuse(page, 'network');
      await node(page, 'f-phone').locator('input').fill('+20 2 1111 2222');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      const banner = page.locator('.fd-banner');
      await expect(banner).toBeVisible();
      await expect(banner).toContainText('Could not reach the server. Your changes are still here.');
      await screen(page, `${variant}-save-offline`, { viewport: true });
      await letSavesThrough(page);
      await banner.getByRole('button', { name: 'Retry' }).click();
      await expect(banner).toBeHidden();
      await expect(page.locator('.fd-status')).toHaveText('Saved');
      expect(await demo<string>('dataSource.records.partner.1.phone')).toBe('+20 2 1111 2222');
    });

    test('the save’s status can be a toast in a corner, which goes once saved, or a bar across the top', async ({ page }) => {
      await open(page, variant, 'page=customer&skin=underline&saveStatus=toast');
      await node(page, 'f-phone').locator('input').fill('+20 2 1111 2222');
      await page.keyboard.press('ControlOrMeta+Enter');
      const toast = page.locator('.fd-toast');
      await expect(toast.locator('.fd-status')).toHaveText('Saved');
      const box = (await toast.boundingBox())!;
      const view = page.viewportSize()!;
      expect(view.width - (box.x + box.width)).toBeLessThan(40);
      expect(view.height - (box.y + box.height)).toBeLessThan(40);
      // Light words on the toast's dark ground, whatever the status colours them elsewhere.
      const [ink, ground] = await toast.evaluate((el) => [getComputedStyle(el.querySelector('.fd-status')!).color, getComputedStyle(el).backgroundColor]);
      expect(ink).toBe('rgb(255, 255, 255)');
      expect(ground).not.toBe(ink);
      await screen(page, `${variant}-save-toast`, { viewport: true });
      await expect(toast).toBeHidden({ timeout: 5000 });
      await open(page, variant, 'page=customer&skin=underline&saveStatus=bar');
      await node(page, 'f-phone').locator('input').fill('+20 2 3333 4444');
      await page.keyboard.press('ControlOrMeta+Enter');
      const bar = page.locator('.fd-status-bar');
      await expect(bar.locator('.fd-status')).toHaveText('Saved');
      expect((await bar.boundingBox())!.y).toBeLessThan((await page.locator('.fd-header').boundingBox())!.y);
      await screen(page, `${variant}-save-bar`, { viewport: true });
    });

    test('a locked record reads as plain values, and Edit then Done unlocks it, saves and locks it again', async ({ page }) => {
      const { demo } = await open(page, variant, 'page=customer&skin=outlined&readonly=1&editSwitch=1');
      const phone = node(page, 'f-phone').locator('input');
      await expect(phone).not.toBeEditable();
      // No box around a value, and no "Search…" inviting typing where none is allowed.
      expect(await phone.evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).borderTopColor])).toEqual(['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)']);
      expect(await node(page, 'f-region').getByRole('combobox').evaluate((el) => getComputedStyle(el, '::placeholder').color)).toBe('rgba(0, 0, 0, 0)');
      await screen(page, `${variant}-locked-record`, { viewport: true });
      await page.getByRole('button', { name: 'Edit' }).click();
      await expect(phone).toBeEditable();
      await phone.fill('+20 2 1111 2222');
      await page.getByRole('button', { name: 'Done' }).click();
      await expect(phone).not.toBeEditable();
      await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
      expect(await demo<string>('dataSource.records.partner.1.phone')).toBe('+20 2 1111 2222');
    });

    test('a link’s filter with an OR offers only the people either side of it allows', async ({ page }) => {
      await open(page, variant, 'page=fields&skin=outlined');
      const approver = node(page, 'f-approver');
      await approver.getByRole('combobox').click();
      // Heads of a department, or managers: not the site engineer, nor the draughtsperson.
      await expect(approver.getByRole('option')).toHaveText(['Mona Adel', 'Salma Nabil', 'Youssef Kamal']);
      await approver.getByRole('combobox').fill('sal');
      await expect(approver.getByRole('option').first()).toHaveText('Salma Nabil');
      await approver.getByRole('combobox').fill('karim');
      await expect(approver.getByRole('option', { name: 'Karim Fathy' })).toHaveCount(0);
      await approver.getByRole('combobox').fill('');
      await approver.getByRole('combobox').click();
      await expect(approver.getByRole('option')).toHaveCount(3);
      await approver.scrollIntoViewIfNeeded();
      await screen(page, `${variant}-filter-any`, { viewport: true });
    });

    test('the page speaks through the app’s own catalog, in its messages too, and leaves what is typed alone', async ({ page }) => {
      await open(page, variant, 'page=signup&skin=outlined&translate=fr&locale=fr');
      await expect(page.getByRole('heading', { name: 'Inscription à l’atelier' })).toBeVisible();
      await expect(node(page, 'f-name').locator('.fd-label')).toHaveText('Nom complet');
      await expect(node(page, 'f-role').locator('option').nth(1)).toHaveText('Développeur');
      await node(page, 'f-company').locator('input').fill('Full name');
      await page.getByRole('button', { name: 'Envoyer' }).click();
      await expect(node(page, 'f-name').locator('.fd-error')).toContainText('Nom complet');
      await expect(node(page, 'f-company').locator('input')).toHaveValue('Full name');
      await screen(page, `${variant}-translated-page`, { viewport: true });
    });

    test('no ✓ unless the page asks', async ({ page }) => {
      await open(page, variant, 'page=signup&skin=outlined');
      await node(page, 'f-name').locator('input').fill('Sara Hassan');
      await expect(node(page, 'f-name').locator('.fd-valid-mark')).toHaveCount(0);
    });
  });
}
