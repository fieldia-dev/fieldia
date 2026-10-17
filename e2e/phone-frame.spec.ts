import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { expectNoSidewaysScroll } from './support';

/**
 * A phone, in every engine (this file is in the Firefox and WebKit smoke set): a demo's frame keeps one row over the
 * form — the demo's name and Options — with the framework, the look and the links folded under Options; fieldia.dev's
 * bar keeps its links under Menu, none off the screen; and the front page's story is drawn at a phone's own size, one
 * caption at a time.
 */
const SITE = process.env['SITE_URL'] ?? `http://127.0.0.1:${process.env['FIELDIA_SITE_PORT'] ?? 4322}`;
const PHONE = { width: 390, height: 844 };

async function asVisitor(page: Page) {
  await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
}

test('a demo on a phone: one row over the form, the framework, the look and the links under Options', async ({ page }) => {
  await asVisitor(page);
  await page.setViewportSize(PHONE);
  await page.goto('/plain/?page=customers&skin=underline');
  await expect(page.locator('.fd-form').first()).toBeVisible();
  expect((await page.locator('#demo-head').boundingBox())!.height).toBeLessThanOrEqual(64);
  await expect(page.locator('.dh-title')).toHaveText('Customer list');
  await expect(page.locator('.dh-title')).toBeInViewport();
  await expect(page.getByRole('navigation', { name: 'Look' })).toBeHidden();
  const options = page.getByRole('button', { name: 'Framework, look and links' });
  await options.click();
  await expect(options).toHaveAttribute('aria-expanded', 'true');
  for (const name of ['Framework', 'Look', 'Scheme']) await expect(page.getByRole('navigation', { name })).toBeInViewport();
  await expect(page.locator('#demo-head').getByRole('link', { name: 'GitHub', exact: true })).toBeInViewport();
  await expectNoSidewaysScroll(page);
  await page.getByRole('navigation', { name: 'Look' }).getByRole('link', { name: 'Outlined' }).click();
  await expect(page).toHaveURL(/skin=outlined/);
  await expect(page.locator('.fd-form').first()).toHaveAttribute('data-fd-skin', 'outlined');
  // Folded again by Escape, the keys back on Options.
  await page.getByRole('button', { name: 'Framework, look and links' }).click();
  await expect(page.getByRole('navigation', { name: 'Look' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('navigation', { name: 'Look' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Framework, look and links' })).toBeFocused();
});

test('fieldia.dev on a phone: every link of the bar under Menu, each whole on the screen', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto(SITE + '/');
  const nav = page.locator('.top-nav');
  await expect(nav).toBeHidden();
  const menu = page.getByRole('button', { name: 'Menu' });
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  for (const name of ['Docs', 'Features', 'Demos', 'Maps', 'Templates', 'Designer', 'GitHub', 'npm']) {
    await expect(nav.getByRole('link', { name, exact: true })).toBeInViewport({ ratio: 1 });
  }
  await expectNoSidewaysScroll(page);
  await page.keyboard.press('Escape');
  await expect(nav).toBeHidden();
  await expect(menu).toBeFocused();
});

test('the front page’s story on a phone: the record at a phone’s size, under the bar with its caption, one caption at a time', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto(SITE + '/');
  const steps = await page.locator('.story-caption').count();
  expect(steps).toBeGreaterThan(5);
  /** Scroll to the middle of a chapter's stretch. */
  const chapter = (step: number) =>
    page.evaluate(([at, of]) => {
      const scroller = document.querySelector('.story-scroll') as HTMLElement;
      const top = scroller.getBoundingClientRect().top + scrollY;
      scrollTo(0, top + (scroller.offsetHeight - innerHeight) * ((at + 0.5) / of));
    }, [step, steps] as const);
  const shownCaptions = () => page.locator('.story-caption').evaluateAll((all) => all.filter((c) => getComputedStyle(c).visibility === 'visible').map((c) => c.querySelector('h3')?.textContent));
  await chapter(1);
  await expect.poll(shownCaptions).toHaveLength(1);
  // Drawn at a phone's size: shrunk by a fifth or so, not to two fifths of a desktop's.
  const fit = await page.locator('.story-stage').evaluate((stage) => Number(getComputedStyle(stage).getPropertyValue('--fit')));
  expect(fit).toBeGreaterThan(0.7);
  // The stage and its caption both on the screen, under the bar.
  const stage = (await page.locator('.story-stage').boundingBox())!;
  const caption = (await page.locator('.story-caption.is-on').boundingBox())!;
  expect(stage.y).toBeGreaterThanOrEqual(59);
  expect(caption.y + caption.height).toBeLessThanOrEqual(PHONE.height);
  // Moving on, the caption going goes at once: never two over each other, even while the next comes in.
  for (const step of [2, 6, 7]) {
    await chapter(step);
    await page.waitForTimeout(120);
    expect((await shownCaptions()).length).toBe(1);
  }
  await expectNoSidewaysScroll(page);
});

test('a demo’s long name on a phone: whole, on a second line, never “A customer or suppl…”', async ({ page }) => {
  await asVisitor(page);
  await page.setViewportSize(PHONE);
  await page.goto('/plain/?page=real-contact&record=7001&skin=underline');
  await expect(page.locator('.fd-form').first()).toBeVisible();
  const title = page.locator('.dh-title');
  await expect(title).toHaveText('A customer or supplier');
  // Every word of it shows: nothing clipped sideways, and on more than one line where it is long.
  const [fits, overflow, lines] = await title.evaluate((h) => [h.scrollWidth <= h.clientWidth, getComputedStyle(h).textOverflow, Math.round(h.getBoundingClientRect().height / parseFloat(getComputedStyle(h).lineHeight))] as const);
  expect([fits, overflow]).toEqual([true, 'clip']);
  expect(lines).toBeGreaterThanOrEqual(2);
  // Still one row over the form, Options beside the name.
  const head = (await page.locator('#demo-head').boundingBox())!;
  expect(head.height).toBeLessThanOrEqual(64);
  await expect(page.getByRole('button', { name: 'Framework, look and links' })).toBeInViewport();
  await expectNoSidewaysScroll(page);
  await page.screenshot({ path: `test-results/screens/${test.info().project.name === 'chromium' ? '' : `${test.info().project.name}/`}demo-frame-phone-long-name.png` });
  // Under Options: the first thing to try, and its source on GitHub.
  await page.getByRole('button', { name: 'Framework, look and links' }).click();
  await expect(page.locator('#demo-head .dh-try')).toBeInViewport();
  await expect(page.locator('#demo-head').getByRole('link', { name: 'Its source on GitHub' })).toBeInViewport();
});

test('the front page’s story on a phone: “Quote confirmed” comes up at the window’s foot, never over its buttons and stages', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto(SITE + '/');
  const steps = await page.locator('.story-caption').count();
  // Chapter 4, "Buttons that act": the toast it shows.
  await page.evaluate(([at, of]) => {
    const scroller = document.querySelector('.story-scroll') as HTMLElement;
    const top = scroller.getBoundingClientRect().top + scrollY;
    scrollTo(0, top + (scroller.offsetHeight - innerHeight) * ((at + 0.5) / of));
  }, [3, steps] as const);
  const toast = page.locator('.story-toast');
  await expect(toast).toBeVisible();
  await expect.poll(() => toast.evaluate((t) => getComputedStyle(t).transform)).toMatch(/matrix\(1, 0, 0, 1, -?[\d.]+, 0\)|none/);
  const said = (await toast.boundingBox())!;
  const head = (await page.locator('#story-form .fd-header').first().boundingBox())!;
  expect(said.y, 'the toast is under the buttons and the stages').toBeGreaterThan(head.y + head.height);
  await page.screenshot({ path: `test-results/screens/${test.info().project.name === 'chromium' ? '' : `${test.info().project.name}/`}story-phone-toast.png` });
});
