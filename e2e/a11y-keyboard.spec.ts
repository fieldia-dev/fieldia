import { expect, test, type Locator, type Page } from '@playwright/test';
import { inAdvanced } from './designer-support';
import { card, controls, markRest, tabWalk } from './keyboard-support';
import { screen } from './support';

/**
 * What axe cannot check, checked by keyboard in a browser: WCAG 2.2's focus
 * not hidden under the designer's sticky bar (2.4.11); a ring on every stop
 * (2.4.7); every control reached by Tab, in the page's order, and no trap
 * (2.1.1, 2.1.2, 2.4.3); dialogs that keep focus, close on Escape and give it
 * back; and live regions that say a move or an error once. The pointer's
 * criteria (2.5.7, 2.5.8) are in a11y-pointer.spec.ts.
 */

test.describe.configure({ timeout: 180_000 });

const BAR = '.fd-designer-bar';
const DESKTOP = { width: 1280, height: 720 };
const PHONE = { width: 390, height: 844 };

/** Focus on the last thing the Tab order reaches, the page scrolled to it, to walk back up with Shift+Tab. */
async function fromTheEnd(page: Page) {
  await page.evaluate(() => {
    const tabbable = [...document.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')].filter(
      (e) => e.tabIndex >= 0 && !(e as HTMLButtonElement).disabled && e.getClientRects().length > 0 && !e.closest('[inert], [hidden]')
    );
    tabbable[tabbable.length - 1]?.focus();
  });
}

test.describe('2.4.11 focus not hidden under the designer’s sticky bar', () => {
  for (const [size, viewport] of [['desktop', DESKTOP], ['phone', PHONE]] as const) {
    for (const url of ['/screen/', '/designer/?start=survey']) {
      test(`${url} · ${size}: walking back up by Shift+Tab, nothing stops under the bar`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await inAdvanced(page);
        await page.goto(url);
        await expect(page.locator(BAR)).toBeVisible();
        await fromTheEnd(page);
        const { stops } = await tabWalk(page, { back: true, bar: BAR, limit: 250 });
        // The walk went the length of the page, up past the canvas into the bar.
        expect(stops.length).toBeGreaterThan(20);
        expect(stops.some((s) => s.name.includes('Publish') || s.name.includes('fd-designer-title'))).toBe(true);
        const under = stops.filter((s) => s.covered > 0).map((s) => `${s.name}: ${Math.round(s.covered * 100)}% under the bar`);
        if (under.length) await screen(page, `a11y-under-the-bar-${size}-${url.replace(/\W+/g, '-')}`, { viewport: true });
        expect(under).toEqual([]);
      });
    }
  }
});

test.describe('2.4.7 focus visible: a ring on every stop', () => {
  for (const url of ['/screen/', '/designer/?start=survey', '/screen/?start=list', '/plain/?page=signup&skin=outlined', '/plain/?page=customer&skin=underline', '/plain/?page=customers&skin=underline']) {
    test(`${url}: every stop by Tab looks focused`, async ({ page }) => {
      await page.setViewportSize(DESKTOP);
      await inAdvanced(page);
      await page.goto(url);
      await expect(page.locator('.fd-form').first()).toBeVisible();
      await page.waitForTimeout(800);
      await markRest(page);
      await page.mouse.move(0, 0);
      const { stops } = await tabWalk(page, { bar: url.startsWith('/plain') ? null : BAR, limit: 400 });
      expect(stops.length).toBeGreaterThan(5);
      expect(stops.filter((s) => !s.ringed).map((s) => s.name)).toEqual([]);
    });
  }
});

// ---- dialogs ------------------------------------------------------------------------

/** Focus is inside the dialog. */
const inside = (dialog: Locator) => dialog.evaluate((d) => d.contains(document.activeElement));

/**
 * A dialog opened from the keyboard: focus goes in; a modal one keeps it
 * there through Tab and Shift+Tab, both ways round; Escape closes it, and
 * focus goes back to what opened it.
 */
async function behaves(page: Page, opener: Locator, dialog: Locator, options: { modal: boolean; open?: () => Promise<void> }) {
  await opener.focus();
  if (options.open) await options.open();
  else await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  await expect.poll(() => inside(dialog), 'focus went into the dialog').toBe(true);
  if (options.modal) {
    for (const key of ['Tab', 'Shift+Tab']) {
      for (let i = 0; i < 25; i++) {
        await page.keyboard.press(key);
        expect(await inside(dialog), `${key} ×${i + 1} left the dialog`).toBe(true);
      }
    }
  }
  // A code editor or a box in the dialog may take Escape first; then the dialog does.
  await page.keyboard.press('Escape');
  if (await dialog.isVisible()) await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
}

test.describe('dialogs keep focus, close on Escape and give it back', () => {
  test('the designer’s: find anything, checks, publish, the shortcuts, versions, the look', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/designer/?start=survey');
    const bar = page.locator(BAR);
    await behaves(page, bar.getByRole('button', { name: 'Find anything' }), page.getByRole('dialog', { name: 'Find anything' }), { modal: true });
    await behaves(page, bar.locator('.fd-checks-button'), page.getByRole('dialog', { name: 'Checks before publishing' }), { modal: false });
    await behaves(page, bar.getByRole('button', { name: 'Publish', exact: true }), page.getByRole('dialog', { name: /^Publish version/ }), { modal: true });
    await behaves(page, bar.getByRole('button', { name: 'Look', exact: true }), page.getByRole('dialog', { name: 'Look' }), { modal: false });
    await behaves(page, bar.locator('.fd-designer-status'), page.locator('.fd-menu'), { modal: false });
    // The shortcuts, by "?" from a button of the bar.
    await behaves(page, bar.getByRole('button', { name: 'Undo', exact: true }).or(bar.locator('.fd-checks-button')).first(), page.getByRole('dialog', { name: 'Keyboard shortcuts' }), {
      modal: true,
      open: () => page.keyboard.type('?'),
    });
  });

  test('the assistant’s, over a screen', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/screen/?assistant-delay=50');
    const find = page.locator(BAR).getByRole('button', { name: 'Find anything' });
    await behaves(page, find, page.getByRole('dialog').filter({ hasText: /assistant/i }), {
      modal: true,
      open: async () => {
        await page.keyboard.press('Enter');
        await page.keyboard.type('assistant');
        await page.keyboard.press('Enter');
      },
    });
  });

  test('the viewer’s: a record over the page, Search more…, and a rule that refuses a save', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/plain/?page=fields&skin=outlined');
    await behaves(page, page.getByRole('button', { name: 'Open Nile Traders' }), page.getByRole('dialog', { name: 'Nile Traders' }), { modal: true });
    // Search more…, the last of the link's choices, reached by the arrows.
    const client = page.locator('[data-node="f-client"]').getByRole('combobox');
    await behaves(page, client, page.getByRole('dialog', { name: 'Client' }), {
      modal: true,
      open: async () => {
        // Emptied, the box offers every choice; the arrows go down them to Search more….
        await page.keyboard.press('ControlOrMeta+a');
        await page.keyboard.press('Backspace');
        await page.keyboard.press('ArrowDown');
        const more = page.locator('[data-node="f-client"]').getByRole('option', { name: 'Search more…' });
        await expect(more).toBeVisible();
        const id = await more.getAttribute('id');
        for (let i = 0; i < 15 && (await client.getAttribute('aria-activedescendant')) !== id; i++) await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
      },
    });
    // A business rule refusing the save: an alert dialog, closed by Escape, focus back on Save.
    await page.goto('/plain/?page=customer&skin=underline');
    await page.evaluate(() => {
      const source = (window as any).fieldiaDemo.dataSource;
      source.save = async () => {
        throw Object.assign(new Error('No more credit'), { problem: { kind: 'rule', message: 'A blocked customer cannot be given more credit.' } });
      };
    });
    await page.locator('[data-node="f-phone"] input').fill('+20 2 1111 2222');
    await behaves(page, page.getByRole('button', { name: 'Save', exact: true }), page.getByRole('alertdialog'), { modal: true });
  });
});

// ---- live regions: a move or an error said once ---------------------------------------

/** Listen to every live region on the page: each time words appear in one, they are noted. */
async function listen(page: Page) {
  await page.evaluate(() => {
    const said: string[] = [];
    const live = (e: Element | null): Element | null => {
      for (let at = e; at; at = at.parentElement) {
        const politeness = at.getAttribute('aria-live');
        if (politeness === 'off') return null;
        if (politeness === 'polite' || politeness === 'assertive' || ['status', 'alert', 'log'].includes(at.getAttribute('role') ?? '')) return at;
      }
      return null;
    };
    new MutationObserver((changes) => {
      const regions = new Set<Element>();
      for (const change of changes) {
        const region = live(change.target instanceof Element ? change.target : change.target.parentElement);
        if (region && !region.closest('[hidden], [aria-hidden="true"]')) regions.add(region);
      }
      for (const region of regions) if ((region.textContent ?? '').trim()) said.push((region.textContent ?? '').trim());
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
    (window as unknown as { __said: string[] }).__said = said;
  });
}
/** How many times words holding `words` were said. */
const timesSaid = (page: Page, words: string) => page.evaluate((w) => (window as unknown as { __said: string[] }).__said.filter((s) => s.includes(w)).length, words);

test.describe('live regions say a move or an error once', () => {
  test('a refused save, in the viewer', async ({ page }) => {
    await page.goto('/plain/?page=customer&skin=underline');
    await page.evaluate(() => {
      const source = (window as any).fieldiaDemo.dataSource;
      source.save = async () => {
        throw Object.assign(new Error('Check the email'), { problem: { kind: 'fields', message: 'Check the email', fields: { email: 'This email is already a customer’s' } } });
      };
    });
    await page.locator('[data-node="f-phone"] input').fill('+20 2 1111 2222');
    await listen(page);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('.fd-announce')).toHaveText('Not saved. Check: Email');
    await page.waitForTimeout(300);
    expect(await timesSaid(page, 'Not saved')).toBe(1);
  });

  test('a send the page’s own checks stop', async ({ page }) => {
    await page.goto('/plain/?page=signup&skin=outlined');
    await listen(page);
    await page.locator('.fd-form button[type="submit"]').last().click();
    await expect(page.locator('.fd-announce')).toContainText('Check:');
    await page.waitForTimeout(300);
    expect(await timesSaid(page, 'Check:')).toBe(1);
  });

  test('a part moved on the canvas by its keys, with the outline open beside it', async ({ page }) => {
    await inAdvanced(page);
    await page.goto('/screen/?start=layout');
    await page.locator('.fd-rail').getByRole('tab', { name: 'Outline', exact: true }).click();
    await card(page, 'f-email').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Shift+Tab');
    await listen(page);
    await page.keyboard.press('Alt+ArrowUp');
    await expect(page.locator('.fd-canvas-said')).toContainText('Work email:');
    await page.waitForTimeout(300);
    expect(await timesSaid(page, 'Work email:')).toBe(1);
  });

  test('a row moved in the outline', async ({ page }) => {
    await page.goto('/screen/?start=layout');
    await page.locator('.fd-rail').getByRole('tab', { name: 'Outline', exact: true }).click();
    // Reached in the tree, picked by Enter, moved by its keys.
    await page.locator('.fd-outline [role="treeitem"][data-pick="f-email"]').focus();
    await page.keyboard.press('Enter');
    await listen(page);
    await page.keyboard.press('Alt+ArrowUp');
    await expect(page.locator('.fd-outline-said')).toContainText('Work email:');
    await page.waitForTimeout(300);
    expect(await timesSaid(page, 'Work email:')).toBe(1);
  });

  test('a line of a ranking moved', async ({ page }) => {
    await page.goto('/plain/?page=kinds&skin=outlined');
    const ranking = page.locator('.fd-ranking').first();
    const first = (await ranking.locator('.fd-rank-words').first().textContent()) ?? '';
    await listen(page);
    await ranking.getByRole('button', { name: `Move ${first} down` }).click();
    await page.waitForTimeout(300);
    expect(await timesSaid(page, `${first} moved to place 2`)).toBe(1);
  });
});

// ---- Tab: every control reached, in the page's order, and no trap -----------------------

test.describe('Tab reaches every control, in the page’s order, and lets go', () => {
  for (const url of ['/plain/?page=signup&skin=outlined', '/plain/?page=customer&skin=underline', '/plain/?page=customers&skin=underline', '/screen/', '/designer/?start=survey', '/screen/?start=list']) {
    test(url, async ({ page }) => {
      await page.setViewportSize(DESKTOP);
      await page.goto(url);
      await expect(page.locator('.fd-form').first()).toBeVisible();
      await page.waitForTimeout(800);
      await page.locator('body').click({ position: { x: 1, y: 1 } });
      const { stops, trapped } = await tabWalk(page, { limit: 500 });
      expect(trapped, 'Tab never came round: a trap').toBe(false);
      const want = await controls(page);
      const reachedGroups = new Set(want.filter((c) => c.group !== null && stops.some((s) => s.order === c.order)).map((c) => c.group));
      const missed = want.filter((c) => !stops.some((s) => s.order === c.order) && !(c.group !== null && reachedGroups.has(c.group))).map((c) => c.name);
      expect(missed, 'controls Tab never reaches').toEqual([]);
      // In the page's order: each stop after the one before it, but for a walk that came round to the start.
      const backwards = stops.slice(1).filter((s, i) => s.order < stops[i].order).map((s, i) => `${stops[i].name} → ${s.name}`);
      expect(backwards, 'Tab went back up the page').toEqual([]);
    });
  }

  test('the JSON view’s code editor takes Tab to indent, and Escape then Tab leaves it', async ({ page }) => {
    await page.goto('/screen/');
    await page.locator(BAR).getByRole('button', { name: 'JSON', exact: true }).click();
    const box = page.locator('.fd-json textarea');
    await box.focus();
    await page.keyboard.press('Tab');
    await expect(box).toBeFocused();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Tab');
    await expect(box).not.toBeFocused();
    // And a walk of the whole view, through the box, comes round.
    await box.focus();
    const { trapped } = await tabWalk(page, { limit: 300 });
    expect(trapped).toBe(false);
  });
});
