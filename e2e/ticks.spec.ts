import { expect, test } from './fixtures';
import { node, open, screen } from './support';
import type { Locator, Page } from '@playwright/test';

/**
 * Radios and tick boxes are Fieldia's own, never the browser's small grey circles (the owner's walk of 23 Oct: the
 * kinds page's "which floor is the kitchen on?" in the quiet and outlined looks). Every one a page draws — a field's
 * tick box, a group's options, a matrix's, a table's tick cells, a list's rows, a dialog's — is drawn over the
 * browser's input, which stays: 18px or more, pressed anywhere in 24px round it, the accent filled in when chosen,
 * ringed when the keys reach it, filled grey when it cannot be changed; its words in the body's colour in every look.
 * With no colours of its own (forced colours), the browser's again; on paper, a chosen one prints chosen.
 */

/** How a radio or a tick box is drawn: what the person sees of it, read from the page. */
async function drawn(box: Locator) {
  return box.evaluate((input: HTMLInputElement) => {
    const style = getComputedStyle(input);
    const tick = getComputedStyle(input, '::before');
    const rect = input.getBoundingClientRect();
    // The press target: the point 11px out from its middle, on each side, still lands on it (or on its own label).
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const lands = [
      [cx - 11, cy],
      [cx + 11, cy],
      [cx, cy - 11],
      [cx, cy + 11],
    ].every(([x, y]) => {
      const hit = document.elementFromPoint(x, y);
      return hit === input || (!!hit && !!input.labels && [...input.labels].some((label) => label.contains(hit)));
    });
    return {
      appearance: style.appearance,
      width: rect.width,
      height: rect.height,
      lands,
      background: style.backgroundColor,
      border: style.borderTopColor,
      tick: tick.visibility === 'visible' && tick.content !== 'none' ? tick.borderRightColor || tick.borderTopColor : null,
      outline: `${style.outlineStyle} ${style.outlineWidth}`,
    };
  });
}

/** A token of the form's, as a colour the browser computes. */
const token = (page: Page, name: string) =>
  page.locator('.fd-form').first().evaluate((form, name) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    form.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  }, name);

/** Every radio and tick box drawn on a page: where each is, and whether it is the browser's or under 18px. */
const everyOne = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLInputElement>('.fd-form input[type="checkbox"], .fd-form input[type="radio"], .fd-theme input[type="checkbox"], .fd-theme input[type="radio"]')]
      .filter((input) => input.getClientRects().length && !input.matches('.fd-switch, [role="switch"]'))
      .map((input) => ({ where: input.closest('[data-node]')?.getAttribute('data-node') ?? input.className, own: getComputedStyle(input).appearance === 'none' && input.getBoundingClientRect().width >= 18 }))
  );

for (const look of ['underline', 'outlined', 'quiet'] as const) {
  test(`${look}: the kitchen's floor and the guide are Fieldia's own radios and tick box, their words the body's`, async ({ page }) => {
    const { problems } = await open(page, 'plain', `page=kinds&skin=${look}`);
    const floor = node(page, 'q-kitchen-floor');
    await floor.scrollIntoViewIfNeeded();
    const radio = floor.getByRole('radio').first();
    const guide = node(page, 'q-guide').getByRole('checkbox');
    const [text, accent] = [await token(page, '--fd-text'), await token(page, '--fd-accent')];

    for (const box of [radio, guide]) {
      const rest = await drawn(box);
      expect(rest.appearance).toBe('none');
      expect(rest.width).toBeGreaterThanOrEqual(18);
      expect(rest.height).toBeGreaterThanOrEqual(18);
      expect(rest.lands).toBe(true);
      expect(rest.tick).toBeNull();
    }
    // Its words — an option's, and the tick box's own after it — read in the body's colour, never a placeholder's grey.
    await expect(floor.locator('.fd-choice > span').first()).toHaveCSS('color', text);
    await expect(node(page, 'q-guide').locator('.fd-label')).toHaveCSS('color', text);

    // Picked by the pointer, as the owner would: the accent filled in, a dot or a tick in it.
    await floor.locator('.fd-choice').nth(1).click();
    await guide.click();
    for (const box of [floor.getByRole('radio').nth(1), guide]) {
      await expect(box).toBeChecked();
      await expect.poll(async () => (await drawn(box)).background).toBe(accent);
      expect((await drawn(box)).tick).not.toBeNull();
    }
    // Reached by the keys: a ring round it.
    await guide.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(guide).toBeFocused();
    expect((await drawn(guide)).outline).toBe('solid 2px');
    await screen(page, `ticks-${look}`);
    expect(problems).toEqual([]);
  });
}

test('a theme and the dark reshape them: the theme’s accent, in the dark scheme and right to left', async ({ page }) => {
  for (const query of ['theme=material&scheme=dark', 'theme=bootstrap', 'skin=outlined&scheme=dark&dir=rtl&locale=ar']) {
    const { problems } = await open(page, 'plain', `page=kinds&${query}`);
    const floor = node(page, 'q-kitchen-floor');
    await floor.scrollIntoViewIfNeeded();
    await floor.locator('.fd-choice').first().click();
    const box = floor.getByRole('radio').first();
    await expect(box).toBeChecked();
    const accent = await token(page, '--fd-accent');
    await expect.poll(async () => (await drawn(box)).background).toBe(accent);
    await expect(floor.locator('.fd-choice > span').first()).toHaveCSS('color', await token(page, '--fd-text'));
    await screen(page, `ticks-${query.replace(/[=&]/g, '-')}`);
    expect(problems).toEqual([]);
  }
});

test('read-only, they look unlike those at rest, a chosen one still chosen', async ({ page }) => {
  const { problems } = await open(page, 'plain', 'page=kinds&skin=outlined');
  const floor = node(page, 'q-kitchen-floor');
  await floor.scrollIntoViewIfNeeded();
  await floor.locator('.fd-choice').first().click();
  const [picked, other] = [floor.getByRole('radio').first(), floor.getByRole('radio').nth(1)];
  await expect.poll(async () => (await drawn(picked)).background).toBe(await token(page, '--fd-accent'));
  const before = [await drawn(picked), await drawn(other)];
  // The record locked, as an app's Edit switch locks it.
  await page.evaluate(() => (window as any).fieldiaDemo.handle.setReadonly(true));
  await expect(picked).toBeDisabled();
  await expect.poll(async () => (await drawn(picked)).background).not.toBe(before[0].background);
  await expect.poll(async () => (await drawn(other)).background).not.toBe(before[1].background);
  expect((await drawn(picked)).tick).not.toBeNull();
  expect(problems).toEqual([]);
});

test('on paper a chosen option prints chosen; with forced colours, the system draws them', async ({ page }) => {
  const { problems } = await open(page, 'plain', 'page=kinds&skin=quiet');
  const floor = node(page, 'q-kitchen-floor');
  await floor.scrollIntoViewIfNeeded();
  await floor.locator('.fd-choice').first().click();
  const box = floor.getByRole('radio').first();
  await page.emulateMedia({ media: 'print' });
  const inked = await drawn(box);
  // Ink alone: a page printed without backgrounds keeps the dot, in the words' colour.
  expect(inked.tick).toBe(await token(page, '--fd-text'));
  await page.emulateMedia({ media: 'screen', forcedColors: 'active' });
  expect((await drawn(box)).appearance).toBe('auto');
  await page.emulateMedia({ forcedColors: 'none' });
  expect(problems).toEqual([]);
});

test('every place that draws them draws Fieldia’s own: groups, a matrix, a table’s cells, a list’s rows', async ({ page }) => {
  const pages = [
    ['plain', 'page=kinds&skin=underline'],
    ['plain', 'page=kinds&skin=quiet&theme=google-forms'],
    ['plain', 'page=order&skin=outlined'],
    ['plain', 'page=contacts&skin=underline&theme=fluent'],
    ['designer', 'start=survey'],
  ];
  for (const [variant, query] of pages) {
    if (variant === 'designer') {
      // The survey designer: its cards draw each question's real answer, and its own settings tick and pick.
      await page.goto(`/designer/?${query}`);
      await page.locator('.fd-q').nth(3).click();
      await expect(page.locator('.fd-q-selected')).toBeVisible();
      expect((await everyOne(page)).filter((box) => !box.own), query).toEqual([]);
      continue;
    }
    const { problems } = await open(page, variant, query);
    await expect.poll(async () => (await everyOne(page)).length, query).toBeGreaterThan(0);
    expect((await everyOne(page)).filter((box) => !box.own), query).toEqual([]);
    expect(problems).toEqual([]);
  }
});
