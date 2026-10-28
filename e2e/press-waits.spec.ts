import type { Locator, Page, Route } from '@playwright/test';
import { expect, test } from './fixtures';
import { node } from './support';

/**
 * A press that waits — for the acts part on its way, then for the app's answer (a linked record's page) — LOOKS busy
 * where it was pressed, whatever the control (the 0.37 walk: a link's ↗, a line's ↗, a line card's head on a phone and
 * Search more… showed nothing for 0.6–1.7 s, `aria-busy` alone, while Confirm turned its ring). One rule (press.ts,
 * `pressWait`): `aria-busy`, and a ring turning from the press — over an icon's glyph, at the end of a name or of a box,
 * a button's own at once — never a page overlay; gone as the dialog shows; a second press meanwhile asks nothing more.
 * Each kind is pressed with the part held, and looked at one frame after its click: the ring there, seen, turning. And
 * where the part cannot come, the press says so with Retry, which opens what was asked for (Confirm's rule, for every
 * press that waits on a part). In each engine.
 */

/** The acts part's chunks held until `release`, as a slow network holds them; or refused (`fail`) until let through. */
async function hold(page: Page) {
  let release!: () => void;
  let failing = false;
  const held = new Promise<void>((resolve) => (release = resolve));
  // Asked anew too (Retry's `?fd-again=1`).
  await page.route(/\/chunks\/acts-part-[^/?]*\.js(\?.*)?$/, async (route: Route) => {
    if (failing) return route.abort();
    await held;
    await route.continue();
  });
  return {
    release,
    fail(now: boolean) {
      failing = now;
    },
  };
}

/** How a control looks one frame after its click's own handlers ran: busy, its ring (or a button's own) seen and turning. */
interface Look {
  busy: string | null;
  ring: boolean;
  seen: boolean;
  turning: string;
  inside: boolean;
  glyph: string;
}

/**
 * Press `pressed` and read `control` (itself unless said: a box for its list's Search more…) one frame after the click.
 * The look is taken in the page, at the frame after the click's handlers ran — what the eye sees first.
 */
async function pressAndLook(page: Page, pressed: Locator, control: Locator = pressed, tap = false): Promise<Look> {
  await control.evaluate((element) => {
    const w = window as unknown as { looked: unknown };
    w.looked = null;
    document.addEventListener(
      'click',
      () =>
        requestAnimationFrame(() => {
          const holder = element.matches('input, [role="combobox"]') ? (element.parentElement as Element) : element;
          const ring = holder.querySelector(':scope > .fd-pressing');
          const style = ring ? getComputedStyle(ring) : getComputedStyle(element, '::after');
          const at = holder.getBoundingClientRect();
          const box = (ring ?? holder).getBoundingClientRect();
          w.looked = {
            busy: element.getAttribute('aria-busy'),
            ring: !!ring || style.content !== 'none',
            seen: style.visibility === 'visible' && style.display !== 'none' && Number(style.opacity) > 0.5 && (!ring || (box.width >= 8 && box.height >= 8)),
            turning: style.animationName,
            inside: box.left >= at.left - 1 && box.right <= at.right + 1 && box.top >= at.top - 1 && box.bottom <= at.bottom + 1,
            glyph: getComputedStyle(element).color,
          };
        }),
      { once: true }
    );
  });
  await (tap ? pressed.tap() : pressed.click());
  await page.waitForFunction(() => (window as unknown as { looked: unknown }).looked);
  return page.evaluate(() => (window as unknown as { looked: Look }).looked);
}

function expectBusy(look: Look, what: string) {
  expect(look.busy, `${what}: aria-busy`).toBe('true');
  expect(look.ring, `${what}: a ring drawn`).toBe(true);
  expect(look.seen, `${what}: the ring seen within a frame of the press`).toBe(true);
  expect(look.turning.split(',').map((name) => name.trim()), `${what}: turning, at once`).toEqual(['fd-spin']);
  expect(look.inside, `${what}: at the control, not over the page`).toBe(true);
}

const ORDER = 'page=real-sale-order&record=7101&skin=underline';
/** A demo opened, its form drawn: never waiting for the page's load, which a held part holds in Firefox. */
async function open(page: Page, variant: string, query: string) {
  await page.goto(`/${variant}/?${query}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.fd-form').first()).toBeVisible();
}
const dialogs = (page: Page) => page.locator('[role="dialog"]').filter({ visible: true });

test.describe('a press that waits looks busy where it was pressed', () => {
  /** Each kind on the sales order, pressed with the part held; where the busy state should be (Search more…: its box). */
  const KINDS: { name: string; query?: string; press(page: Page): Promise<{ pressed: Locator; control?: Locator; glyph?: boolean }> }[] = [
    // A stat button draws no ring of its own: it waits as the icons do, its ring at its end.
    { name: 'a stat button, Sales', query: 'page=customer&skin=underline', press: async (page) => ({ pressed: node(page, 'sales') }) },
    { name: 'Confirm, a button with steps', press: async (page) => ({ pressed: page.getByRole('button', { name: 'Confirm', exact: true }) }) },
    { name: 'the customer’s ↗', press: async (page) => ({ pressed: node(page, 'f-partner').getByRole('button', { name: 'Open Dar El Shifa Hospital' }), glyph: true }) },
    { name: 'a line’s ↗ in the grid', press: async (page) => ({ pressed: node(page, 'f-order-line').locator('.ag-row[row-index="1"] .ag-cell[col-id="__open"]').getByRole('button', { name: 'Open line' }), glyph: true }) },
    {
      name: 'Search more…, its box busy, its ring where its ↗ and × were',
      press: async (page) => {
        const box = node(page, 'f-partner').getByRole('combobox');
        await box.click();
        await box.fill('a');
        const more = node(page, 'f-partner').getByRole('option', { name: 'Search more…' });
        await expect(more).toBeVisible();
        return { pressed: more, control: box };
      },
    },
  ];
  for (const kind of KINDS) {
    test(`${kind.name}: busy and turning within a frame of the press, the part held; free once its dialog shows`, async ({ page }) => {
      const acts = await hold(page);
      await open(page, 'plain', kind.query ?? ORDER);
      const { pressed, control = pressed, glyph } = await kind.press(page);
      const look = await pressAndLook(page, pressed, control);
      expectBusy(look, kind.name);
      if (glyph) expect(look.glyph, 'the ↗ gives its place to the ring').toBe('rgba(0, 0, 0, 0)');
      if (control !== pressed) await expect(node(page, 'f-partner').locator('.fd-combo-open')).toBeHidden();
      // Nothing over the page meanwhile; the part lands, what was asked for comes, and the control is free again.
      await expect(dialogs(page)).toHaveCount(0);
      acts.release();
      await expect(dialogs(page).or(page.locator('.fd-say')).first()).toBeVisible();
      await expect(page.locator('.fd-pressing, [data-fd-pressing]')).toHaveCount(0);
    });
  }

  test('pressed twice while it waits, the ↗ opens one dialog', async ({ page }) => {
    const acts = await hold(page);
    await open(page, 'plain', ORDER);
    const open1 = node(page, 'f-partner').getByRole('button', { name: 'Open Dar El Shifa Hospital' });
    await open1.click();
    await expect(open1).toHaveAttribute('aria-busy', 'true');
    await open1.click();
    acts.release();
    await expect(page.getByRole('dialog', { name: 'Dar El Shifa Hospital' })).toBeVisible();
    // A moment for a second dialog that would come.
    await page.waitForTimeout(500);
    await expect(dialogs(page)).toHaveCount(1);
  });

  test('a line card’s head on a phone: busy and turning within a frame, the part held', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const acts = await hold(page);
    await open(page, 'plain', ORDER);
    const head = node(page, 'f-order-line').locator('.fd-line-card-title').filter({ hasText: 'Patient monitor' }).first();
    await head.scrollIntoViewIfNeeded();
    expectBusy(await pressAndLook(page, head), 'a line card’s head');
    acts.release();
    await expect(dialogs(page)).toHaveCount(1);
    await expect(head).not.toHaveAttribute('aria-busy', 'true');
  });

  test('a plain table’s line ↗: busy and turning within a frame, the part held', async ({ page }) => {
    const acts = await hold(page);
    await open(page, 'plain', 'page=real-tender&record=7801&skin=underline');
    await page.getByRole('tab', { name: 'Requirements' }).click();
    const opener = node(page, 'f-requirements').locator('tbody tr[data-line]').first().getByRole('button', { name: 'Open line' });
    expectBusy(await pressAndLook(page, opener), 'a table line’s ↗');
    acts.release();
    await expect(dialogs(page)).toHaveCount(1);
  });

  test('a line’s ↗ whose part cannot come says so with Retry, which opens the line', async ({ page }) => {
    const acts = await hold(page);
    acts.fail(true);
    await open(page, 'plain', ORDER);
    const line = node(page, 'f-order-line').locator('.ag-row[row-index="1"] .ag-cell[col-id="__open"]').getByRole('button', { name: 'Open line' });
    await line.click();
    // Confirm's words and its Retry: try again where the engine names the module that failed, else reload (WebKit).
    const said = page.locator('.fd-say').filter({ hasText: /^This action could not load, so nothing was done\. (Try again|Reload the page and try again)\./ });
    await expect(said).toBeVisible();
    await expect(said.getByRole('button', { name: 'Retry' })).toBeVisible();
    await expect(dialogs(page)).toHaveCount(0);
    await expect(line).not.toHaveAttribute('aria-busy', 'true');
    if (/Reload the page/.test(await said.innerText())) return;
    acts.fail(false);
    acts.release();
    await said.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByRole('dialog', { name: '[PM-12] Patient monitor PM-12' })).toBeVisible();
  });
});
