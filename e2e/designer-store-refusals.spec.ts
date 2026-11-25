import type { Page } from '@playwright/test';
import { installZonePromises } from '../testing/zone-promises';
import { fromToolbox } from './designer-support';
import { expect, test } from './fixtures';
import { screen } from './support';

/**
 * The designer's app answers, refused (0.37): the page's promises kept as Angular's zone keeps them
 * (testing/zone-promises.ts: a refusal with no handler by the zone's look is said, as `NgZone.onError` hears it), and
 * the engine's own `unhandledrejection` listened to as well. The app's page store refuses at once, as it is asked, a
 * draft's save, a publish and the saved forms it lists: each is said in the designer's words, Try again does it once
 * the store answers, and nothing is left unhandled. In each engine.
 */

const FAILED = 'The server did not answer';

/** The editor at `address`, its store refusing — at once, as an app's server that does not answer — what `refuse` names. */
async function open(page: Page, address: string) {
  // Before any script of the page: its promises are the zone's from the start, as an Angular app's are.
  await page.addInitScript(installZonePromises);
  await page.addInitScript(() => {
    const W = window as any;
    W.__native = [];
    window.addEventListener('unhandledrejection', (event) => W.__native.push(String((event.reason as Error)?.message ?? event.reason)));
  });
  await page.goto(address);
  await expect(page.locator('.fd-designer')).toBeVisible();
  await page.waitForFunction(() => !!(window as any).fieldiaDesigner?.store);
  await page.evaluate((failed) => {
    const W = window as any;
    const store = W.fieldiaDesigner.store;
    W.__refusing = new Set<string>();
    for (const member of ['saveDraft', 'publish', 'list']) {
      const own = store[member].bind(store);
      store[member] = (...args: unknown[]) => (W.__refusing.has(member) ? Promise.reject(new Error(failed)) : own(...args));
    }
  }, FAILED);
}
const refuse = (page: Page, members: string[]) => page.evaluate((names) => void ((window as any).__refusing = new Set(names)), members);
/** Neither the zone nor the engine heard a refusal left unhandled, a turn past the last. */
async function nothingUnhandled(page: Page) {
  await page.evaluate(() => new Promise((done) => setTimeout(done, 100)));
  expect(await page.evaluate(() => ((window as any).__zoneSaid as unknown[]).map((reason) => String((reason as Error)?.message ?? reason)))).toEqual([]);
  expect(await page.evaluate(() => (window as any).__native)).toEqual([]);
}

test('a draft’s save the store refused: said under the bar with Try again, saved once tried again', async ({ page }) => {
  await open(page, '/designer/');
  await refuse(page, ['saveDraft']);
  await page.locator('.fd-designer-title').fill('Event feedback');
  const line = page.locator('.fd-designer-unsaved');
  await expect(line).toBeVisible();
  await expect(line).toHaveAttribute('role', 'alert');
  await expect(line.locator('bdi')).toHaveText(`Your changes could not be saved: ${FAILED}`);
  await nothingUnhandled(page);
  await screen(page, 'designer-not-saved', { viewport: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(line).toBeVisible();
  await screen(page, 'designer-not-saved-phone', { viewport: true });
  await refuse(page, []);
  await line.getByRole('button', { name: 'Try again' }).click();
  await expect(line).toBeHidden();
  expect(await page.evaluate(() => {
    const { designer, store } = (window as any).fieldiaDesigner;
    return store.pages.get(designer.getPage().id)?.draft?.title;
  })).toBe('Event feedback');
  await nothingUnhandled(page);
});

test('a publish the store refused: the dialog says why with Try again, published once tried again', async ({ page }) => {
  await open(page, '/designer/');
  await page.locator('.fd-designer-title').fill('Event feedback');
  await page.locator('.fd-design-step').nth(0).getByRole('button', { name: 'Add question' }).click();
  await refuse(page, ['publish']);
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Publish version 1?' });
  await dialog.getByRole('button', { name: 'Publish version 1' }).click();
  const failed = dialog.locator('.fd-publish-failed');
  await expect(failed).toHaveText(`Version 1 could not be published: ${FAILED}`);
  await expect(dialog.getByRole('button', { name: 'Publish version 1' })).toHaveCount(0);
  await nothingUnhandled(page);
  await screen(page, 'designer-not-published', { viewport: true });
  await refuse(page, []);
  await dialog.getByRole('button', { name: 'Try again' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.fd-designer-status')).toHaveText('Published · version 1');
  await nothingUnhandled(page);
});

test('the saved forms the store would not list: the toolbox’s menu says why, and the next press lists them', async ({ page }) => {
  await open(page, '/screen/');
  await refuse(page, ['list']);
  await (await fromToolbox(page, 'form:saved')).click();
  const menu = page.locator('.fd-menu');
  await expect(menu.locator('.fd-menu-note')).toHaveText(`The saved forms could not be listed: ${FAILED}`);
  await expect(menu.locator('[data-item]')).toHaveCount(0);
  await nothingUnhandled(page);
  await screen(page, 'designer-saved-forms-not-listed', { viewport: true });
  await page.keyboard.press('Escape');
  await refuse(page, []);
  await (await fromToolbox(page, 'form:saved')).click();
  await expect(page.locator('.fd-menu [data-item="address"]')).toBeVisible();
  await nothingUnhandled(page);
});
