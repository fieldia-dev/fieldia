import { expect, test, type Page } from '@playwright/test';
import { doubleLines } from './designer-support';
import { expectNoSidewaysScroll, node, open, screen } from './support';

/**
 * The layout as a browser draws it, on the "New employee" page: groups side
 * by side, arrangements on their grid's columns, each group's style, labels
 * beside that go above in a narrow box, and the page's own look — on a
 * desktop, a tablet and a phone, in Arabic and in the dark.
 */

const LAYOUT = 'page=layout&skin=outlined';
const ARABIC = `${LAYOUT}&locale=ar&dir=rtl`;
const DARK = `${LAYOUT}&scheme=dark`;
const WIDTHS = [
  ['desktop', 1280],
  ['tablet', 768],
  ['phone', 390],
] as const;

/**
 * Every part whose edges miss the columns of the grid it sits on, and what
 * sits on it through arrangements on its tracks, which have no columns of
 * their own: a part starts and ends on its grid's columns (a button, as wide
 * as its words, only starts on one). Parts sharing one cell are exempt; the
 * cell they share is not. Says how many it looked at, so a check that found
 * nothing to check cannot pass.
 */
function misaligned(page: Page): Promise<{ checked: number; off: string[] }> {
  return page.evaluate(() => {
    const off: string[] = [];
    let checked = 0;
    const onTracks = (grid: Element | null) => !!grid?.parentElement?.matches('.fd-section[data-place="tracks"]');
    for (const part of document.querySelectorAll<HTMLElement>('.fd-form .fd-grid > [data-node]')) {
      const box = part.getBoundingClientRect();
      if (!box.width) continue;
      const shared = part.parentElement?.closest('.fd-section[data-place="shared"]');
      if (shared && shared !== part) continue;
      let grid: Element | null = part.parentElement;
      while (onTracks(grid)) grid = grid?.parentElement?.parentElement?.closest('.fd-grid') ?? null;
      if (!grid) continue;
      const style = getComputedStyle(grid);
      const tracks = style.gridTemplateColumns.split(' ').map(parseFloat);
      const gap = parseFloat(style.columnGap) || 0;
      const g = grid.getBoundingClientRect();
      const rtl = style.direction === 'rtl';
      // The columns' edges on the screen; right to left, the first column is on the right.
      const lefts: number[] = [];
      const rights: number[] = [];
      let x = rtl ? g.right : g.left;
      for (const width of tracks) {
        const left = rtl ? x - width : x;
        lefts.push(left);
        rights.push(left + width);
        x += rtl ? -(width + gap) : width + gap;
      }
      const near = (value: number, list: number[]) => list.some((edge) => Math.abs(edge - value) <= 1.5);
      checked++;
      const startsOn = rtl ? near(box.right, rights) : near(box.left, lefts);
      const endsOn = part.matches('.fd-button') || (rtl ? near(box.left, lefts) : near(box.right, rights));
      if (!startsOn || !endsOn) off.push(`${part.dataset['node']} in ${grid.parentElement?.getAttribute('data-node')}`);
    }
    return { checked, off };
  });
}

/** Every part on its grid's columns, and at least `least` of them looked at. */
async function onTheColumnsAtLeast(page: Page, least: number) {
  const { checked, off } = await misaligned(page);
  expect(checked, 'parts looked at').toBeGreaterThanOrEqual(least);
  expect(off, "parts off their grid's columns").toEqual([]);
}

async function onTheColumns(page: Page, what: string) {
  const { checked, off } = await misaligned(page);
  expect(checked, `${what}: parts looked at`).toBeGreaterThan(8);
  expect(off, `${what}: parts off their grid's columns`).toEqual([]);
}

/** Where a field's label sits against its box: beside it, before it in the reading direction, or above it. */
async function labelAgainstBox(page: Page, id: string): Promise<'beside' | 'above'> {
  return node(page, id).evaluate((field) => {
    const label = field.querySelector('.fd-label')!.getBoundingClientRect();
    const box = (field.querySelector('input, select, textarea') as HTMLElement).getBoundingClientRect();
    return label.bottom <= box.top + 1 ? 'above' : 'beside';
  });
}

for (const [width, px] of WIDTHS) {
  test(`layout: every part sits on its grid's columns, with no box drawn in a box, on a ${width}`, async ({ page }) => {
    await page.setViewportSize({ width: px, height: 900 });
    const { problems } = await open(page, 'plain', LAYOUT);
    await onTheColumns(page, width);
    expect(await doubleLines(page, '.fd-form *')).toEqual([]);
    await expectNoSidewaysScroll(page);
    await screen(page, `layout-${width}`);
    for (const tab of ['Documents', 'Pay']) {
      await page.getByRole('tab', { name: tab }).click();
      await onTheColumns(page, `${width}, ${tab}`);
      expect(await doubleLines(page, '.fd-form *')).toEqual([]);
      await expectNoSidewaysScroll(page);
    }
    await screen(page, `layout-${width}-pay`);
    expect(problems).toEqual([]);
  });
}

test('layout: the photo beside a block of two columns, whose parts sit on the card’s columns', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, 'plain', LAYOUT);
  const left = async (id: string) => (await node(page, id).boundingBox())!.x;
  const right = async (id: string) => {
    const b = (await node(page, id).boundingBox())!;
    return b.x + b.width;
  };
  // Three columns: the photo, then First name and Last name, then the rest of the block under them.
  expect(await left('f-photo')).toBeLessThan(await left('f-first-name'));
  expect(await left('f-first-name')).toBeLessThan(await left('f-last-name'));
  expect(Math.abs((await left('f-email')) - (await left('f-first-name')))).toBeLessThanOrEqual(1);
  expect(Math.abs((await right('who')) - (await right('f-last-name')))).toBeLessThanOrEqual(1);
  // Home address and Emergency contact side by side, each a card of its own.
  const home = (await node(page, 'address').boundingBox())!;
  const emergency = (await node(page, 'emergency').boundingBox())!;
  expect(emergency.x).toBeGreaterThan(home.x + home.width);
  expect(Math.abs(emergency.y - home.y)).toBeLessThanOrEqual(1);
  for (const id of ['personal', 'address', 'emergency']) {
    await expect(node(page, id), id).toHaveCSS('border-top-style', 'solid');
  }
  // A line under Role's title, and no box round it; nothing drawn round an arrangement.
  await page.getByRole('tab', { name: 'Job' }).click();
  await expect(node(page, 'role')).toHaveCSS('border-top-style', 'none');
  await expect(node(page, 'role').locator('> .fd-section-title')).toHaveCSS('border-bottom-style', 'solid');
  await expect(node(page, 'side-by-side')).toHaveCSS('border-top-style', 'none');
  await expect(node(page, 'who')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});

test('layout: on a tablet the groups keep the columns they ask for there; on a phone, one under another', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await open(page, 'plain', LAYOUT);
  const box = async (id: string) => (await node(page, id).boundingBox())!;
  // Personal details keeps three columns on a tablet; the two groups go one under the other.
  expect((await box('f-first-name')).x).toBeGreaterThan((await box('f-photo')).x + 10);
  expect((await box('emergency')).y).toBeGreaterThan((await box('address')).y + (await box('address')).height);
  await page.setViewportSize({ width: 390, height: 900 });
  await expect.poll(async () => Math.abs((await box('f-first-name')).x - (await box('f-photo')).x)).toBeLessThanOrEqual(1);
  expect((await box('f-last-name')).y).toBeGreaterThan((await box('f-first-name')).y);
  // A part never spans more columns than its grid has: Street and number fills the phone's one column.
  expect(Math.abs((await box('f-street')).width - (await box('f-city')).width)).toBeLessThanOrEqual(1);
  await expectNoSidewaysScroll(page);
});

test('layout: the bank’s labels sit beside their boxes, and go above them once a box is narrow', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, 'plain', LAYOUT);
  await page.getByRole('tab', { name: 'Pay' }).click();
  for (const id of ['f-bank-name', 'f-pay-currency', 'f-iban']) expect(await labelAgainstBox(page, id), id).toBe('beside');
  // The label's column is the group's width, 120px, for every field: their boxes start in line.
  const label = (await node(page, 'f-bank-name').locator('.fd-label').boundingBox())!;
  expect(Math.round(label.width)).toBe(120);
  const boxLeft = async (id: string) => (await node(page, id).locator('input, select').first().boundingBox())!.x;
  expect(Math.abs((await boxLeft('f-bank-name')) - (await boxLeft('f-iban')))).toBeLessThanOrEqual(1);
  // The framed group's title sits on its frame.
  const frame = (await node(page, 'bank').boundingBox())!;
  const title = (await node(page, 'bank').locator('> legend').boundingBox())!;
  expect(title.y).toBeLessThan(frame.y + 1);
  expect(title.y + title.height).toBeGreaterThan(frame.y);
  // 600px wide: still two columns, each too narrow for a label beside its box.
  await page.setViewportSize({ width: 600, height: 900 });
  await expect.poll(() => labelAgainstBox(page, 'f-bank-name')).toBe('above');
  expect(await labelAgainstBox(page, 'f-pay-currency')).toBe('above');
  // The IBAN spans both columns: room again for its label beside it.
  expect(await labelAgainstBox(page, 'f-iban')).toBe('beside');
  await screen(page, 'layout-600-pay');
  // A phone: one column, wide enough again.
  await page.setViewportSize({ width: 390, height: 900 });
  await expect.poll(() => labelAgainstBox(page, 'f-bank-name')).toBe('beside');
});

test('layout: a box that is worked in opens its list over the fields below it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, 'plain', LAYOUT);
  await page.getByRole('tab', { name: 'Pay' }).click();
  const bank = node(page, 'f-bank-name').locator('input');
  await bank.focus();
  const z = await node(page, 'f-bank-name').evaluate((field) => getComputedStyle(field).zIndex);
  expect(Number(z)).toBeGreaterThan(0);
});

test('layout: the page’s look — its accent, room, corners and font — on every part', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, 'plain', LAYOUT);
  const form = page.locator('.fd-form');
  await expect(form).toHaveCSS('--fd-accent', '#1677ff');
  // A band of the accent under the title; boxes as tall as the room asks; soft corners.
  await expect(page.locator('.fd-page-head')).toHaveCSS('border-bottom-color', 'rgb(22, 119, 255)');
  await expect(node(page, 'f-first-name').locator('input')).toHaveCSS('min-height', '36px');
  await expect(node(page, 'personal')).toHaveCSS('border-top-left-radius', '10px');
  await expect(node(page, 'f-first-name').locator('input')).toHaveCSS('border-top-left-radius', '6px');
  await page.getByRole('tab', { name: 'Job' }).click();
  await expect(page.getByRole('tab', { name: 'Job' })).toHaveCSS('color', 'rgb(22, 119, 255)');
});

test('layout: each font, room and corners the look can name reaches the boxes, and no font is fetched', async ({ page }) => {
  const fetched: string[] = [];
  page.on('request', (request) => /font|\.woff2?($|\?)/i.test(request.url()) && fetched.push(request.url()));
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, 'plain', LAYOUT);
  const input = node(page, 'f-first-name').locator('input');
  // The look as another page might name it: written on the form as the viewer writes it.
  const look = (name: string, value: string) => page.locator('.fd-form').evaluate((form, [n, v]) => form.setAttribute(`data-${n}`, v), [name, value]);
  await look('font', 'serif');
  expect(await input.evaluate((box) => getComputedStyle(box).fontFamily)).toMatch(/^"Source Serif 4", Georgia, serif/);
  await look('font', 'rounded');
  expect(await input.evaluate((box) => getComputedStyle(box).fontFamily)).toMatch(/^Nunito, "Varela Round", system-ui/);
  for (const [density, height] of [['compact', '30px'], ['roomy', '42px']]) {
    await look('density', density);
    await expect(input, density).toHaveCSS('min-height', height);
  }
  await look('corners', 'round');
  await expect(node(page, 'personal')).toHaveCSS('border-top-left-radius', '16px');
  await expect(input).toHaveCSS('border-top-left-radius', '12px');
  await look('corners', 'square');
  await expect(input).toHaveCSS('border-top-left-radius', '0px');
  expect(fetched).toEqual([]);
});

test('layout: a label kept out of sight still names its box', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, 'plain', LAYOUT);
  await node(page, 'f-first-name').evaluate((field) => field.setAttribute('data-labels', 'hidden'));
  const label = (await node(page, 'f-first-name').locator('.fd-label').boundingBox())!;
  expect(label.width).toBeLessThanOrEqual(1);
  await expect(page.getByRole('textbox', { name: 'First name' })).toBeVisible();
  // The box moves up to where the label was.
  const field = (await node(page, 'f-first-name').boundingBox())!;
  const box = (await page.getByRole('textbox', { name: 'First name' }).boundingBox())!;
  expect(Math.abs(box.y - field.y)).toBeLessThanOrEqual(1);
});

test('layout: right to left in Arabic, mirrored part for part', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { problems } = await open(page, 'plain', ARABIC);
  await expect(page.locator('.fd-page-title')).toHaveText('موظف جديد');
  const box = async (id: string) => (await node(page, id).boundingBox())!;
  // The photo on the right, the block of fields to its left; Home address on the right of Emergency contact.
  expect((await box('f-photo')).x).toBeGreaterThan((await box('f-first-name')).x);
  expect((await box('f-first-name')).x).toBeGreaterThan((await box('f-last-name')).x);
  expect((await box('address')).x).toBeGreaterThan((await box('emergency')).x);
  await onTheColumns(page, 'Arabic');
  expect(await doubleLines(page, '.fd-form *')).toEqual([]);
  await screen(page, 'layout-arabic');
  await page.getByRole('tab', { name: 'الراتب' }).click();
  // Labels beside: on the right of their boxes; the frame's title at its right.
  const label = (await node(page, 'f-bank-name').locator('.fd-label').boundingBox())!;
  const input = (await node(page, 'f-bank-name').locator('input').boundingBox())!;
  expect(label.x).toBeGreaterThan(input.x + input.width);
  const frame = await box('bank');
  const title = (await node(page, 'bank').locator('> legend').boundingBox())!;
  expect(title.x + title.width).toBeGreaterThan(frame.x + frame.width - 40);
  await onTheColumns(page, 'Arabic, Pay');
  await screen(page, 'layout-arabic-pay');
  await page.setViewportSize({ width: 390, height: 900 });
  await expectNoSidewaysScroll(page);
  await screen(page, 'layout-arabic-phone');
  expect(problems).toEqual([]);
});

test('layout: the dark scheme, with the page’s accent made to read on it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { problems } = await open(page, 'plain', DARK);
  const form = page.locator('.fd-form');
  await expect(form).toHaveCSS('color-scheme', 'dark');
  await expect(node(page, 'personal')).toHaveCSS('background-color', 'rgb(31, 35, 41)');
  await expect(page.locator('.fd-page-title')).toHaveCSS('color', 'rgb(232, 234, 237)');
  await expect(node(page, 'f-first-name').locator('input')).toHaveCSS('background-color', 'rgb(31, 35, 41)');
  await onTheColumns(page, 'dark');
  expect(await doubleLines(page, '.fd-form *')).toEqual([]);
  await screen(page, 'layout-dark');
  await page.getByRole('tab', { name: 'Pay' }).click();
  await screen(page, 'layout-dark-pay');
  expect(problems).toEqual([]);
});

test('layout: a scheme left to the reader follows their system', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await open(page, 'plain', `${LAYOUT}&scheme=auto`);
  await expect(page.locator('.fd-form')).toHaveCSS('color-scheme', 'dark');
  await expect(node(page, 'personal')).toHaveCSS('background-color', 'rgb(31, 35, 41)');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(node(page, 'personal')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});

test('layout: the columns check itself catches a part off its columns', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, 'plain', LAYOUT);
  // Give the block beside the photo columns of its own, as it would have without subgrid.
  await page.addStyleTag({ content: '.fd-form .fd-section[data-place="tracks"] > .fd-grid { grid-template-columns: 1fr 1fr !important; column-gap: 48px !important; }' });
  const { off } = await misaligned(page);
  expect(off.length).toBeGreaterThan(0);
});

// ---- pages built for one check each, mounted with the script bundle -----------------------

/**
 * Mount a page made for one check on the script tag's demo: the `Fieldia`
 * global, its stylesheet minified, as a page with no build step gets it. In
 * the outlined skin unless the check names another.
 */
async function mountBuilt(page: Page, children: unknown[], extra: Record<string, unknown> = {}, options: Record<string, unknown> = {}) {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => message.type() === 'error' && problems.push(message.text()));
  await page.goto('/script/');
  await expect(page.locator('.fd-form').first()).toBeVisible();
  const fields = Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'code', 'number', 'name'].map((name) => [name, { type: 'char', label: `Field ${name}` }]));
  const built = { fieldia: '0.1', id: 'built', data: { kind: 'responses' }, fields, layout: { type: 'sections', id: 'root', children }, ...extra };
  await page.evaluate(([p, o]) => {
    const fieldia = (window as unknown as { Fieldia: { mountViewer: (e: Element, o: object) => unknown; createMemoryDataSource: () => unknown } }).Fieldia;
    const app = document.getElementById('app') as HTMLElement;
    app.replaceChildren();
    fieldia.mountViewer(app, { page: p, dataSource: fieldia.createMemoryDataSource(), skin: 'outlined', ...o });
  }, [built, options] as const);
  await expect(page.locator('.fd-form')).toHaveCount(1);
  return problems;
}
const field = (id: string, extra: Record<string, unknown> = {}) => ({ type: 'field', id, field: id, ...extra });

test('built: parts sharing one cell sit side by side, and one under the other once the cell is narrow', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const problems = await mountBuilt(page, [
    {
      type: 'section', id: 's', title: 'Contact', columns: 2,
      children: [field('name'), { type: 'section', id: 'phone', style: 'plain', columns: 2, children: [field('code'), field('number')] }, field('a'), field('b')],
    },
  ]);
  const box = async (id: string) => (await node(page, id).boundingBox())!;
  expect((await box('number')).x).toBeGreaterThan((await box('code')).x + (await box('code')).width);
  expect(Math.abs((await box('number')).y - (await box('code')).y)).toBeLessThanOrEqual(1);
  // The cell they share is on the group's columns; they are inside it.
  await onTheColumnsAtLeast(page, 3);
  await screen(page, 'built-shared-wide');
  // 600px: the group keeps two columns, each now under 330px: one under the other.
  await page.setViewportSize({ width: 600, height: 900 });
  await expect.poll(async () => (await box('number')).y > (await box('code')).y + (await box('code')).height).toBe(true);
  expect(Math.abs((await box('number')).x - (await box('code')).x)).toBeLessThanOrEqual(1);
  await onTheColumnsAtLeast(page, 3);
  await screen(page, 'built-shared-narrow');
  expect(problems).toEqual([]);
});

test('built: an arrangement inside an arrangement still lays its parts on the outer grid’s columns', async ({ page }) => {
  for (const skin of ['outlined', 'underline']) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mountBuilt(
      page,
      [
        {
          type: 'section', id: 'outer', title: 'Four columns', columns: { wide: 4, medium: 2, narrow: 1 },
          children: [
            field('a'),
            { type: 'section', id: 'three', style: 'plain', colspan: 3, children: [field('b'), { type: 'section', id: 'two', style: 'plain', colspan: 2, children: [field('c'), field('d')] }, field('e', { colspan: 3 })] },
          ],
        },
      ],
      {},
      { skin }
    );
    const left = async (id: string) => (await node(page, id).boundingBox())!.x;
    expect(await left('b')).toBeLessThan(await left('c'));
    expect(await left('c')).toBeLessThan(await left('d'));
    await onTheColumnsAtLeast(page, 6);
    await screen(page, `built-nested-${skin}`);
    // Two columns: the three-wide arrangement covers both, its parts fill them in turn; one column: one under another.
    for (const width of [700, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await onTheColumnsAtLeast(page, 6);
      await expectNoSidewaysScroll(page);
    }
  }
});

test('built: tabs, words and buttons take the columns they are given, never more than there are', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const problems = await mountBuilt(page, [
    {
      type: 'section', id: 's', title: 'Widths', columns: { wide: 3, medium: 2, narrow: 1 },
      children: [
        { type: 'text', id: 'heading', text: 'Across all three', style: 'heading', colspan: 3 },
        { type: 'tabs', id: 'tabs', colspan: 2, children: [{ type: 'tab', id: 'tab', label: 'Details', children: [field('a')] }] },
        { type: 'text', id: 'aside', text: 'A note beside the tabs, in the third column.', style: 'note' },
        { type: 'button', id: 'go', label: 'Go', action: 'go', colspan: 1 },
        field('b', { colspan: 4 }),
      ],
    },
  ]);
  const box = async (id: string) => (await node(page, id).boundingBox())!;
  const grid = (await page.locator('[data-node="s"] > .fd-grid').boundingBox())!;
  expect(Math.round((await box('heading')).width)).toBe(Math.round(grid.width));
  expect((await box('aside')).x).toBeGreaterThan((await box('tabs')).x + (await box('tabs')).width);
  expect(Math.abs((await box('aside')).y - (await box('tabs')).y)).toBeLessThanOrEqual(1);
  // A button stays as wide as its words, at the start of its column.
  expect((await box('go')).width).toBeLessThan(120);
  // A field asking for four of three columns takes the three, and makes no column of its own.
  expect(Math.round((await box('b')).width)).toBe(Math.round(grid.width));
  await onTheColumnsAtLeast(page, 5);
  await screen(page, 'built-widths');
  for (const width of [700, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const narrowGrid = (await page.locator('[data-node="s"] > .fd-grid').boundingBox())!;
    expect(Math.round((await box('b')).width), `${width}px`).toBe(Math.round(narrowGrid.width));
    await onTheColumnsAtLeast(page, 5);
    await expectNoSidewaysScroll(page);
  }
  expect(problems).toEqual([]);
});

test('built: each style of group in the underline skin, with no box drawn in a box', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const problems = await mountBuilt(
    page,
    [
      { type: 'section', id: 'card', title: 'A card', columns: 2, children: [field('a'), field('b')] },
      { type: 'section', id: 'line', title: 'A line', style: 'line', children: [field('c')] },
      { type: 'section', id: 'plain', title: 'Plain', style: 'plain', children: [field('d')] },
      { type: 'section', id: 'framed', title: 'A frame', style: 'framed', children: [field('e')] },
    ],
    {},
    { skin: 'underline' }
  );
  const title = (id: string) => node(page, id).locator('> legend');
  await expect(title('line')).toHaveCSS('border-bottom-style', 'solid');
  await expect(title('plain')).toHaveCSS('border-bottom-style', 'none');
  await expect(node(page, 'framed')).toHaveCSS('border-top-style', 'solid');
  const frame = (await node(page, 'framed').boundingBox())!;
  const legend = (await title('framed').boundingBox())!;
  expect(legend.y).toBeLessThan(frame.y + 1);
  expect(legend.y + legend.height).toBeGreaterThan(frame.y + 1);
  expect(await doubleLines(page, '.fd-form *')).toEqual([]);
  await screen(page, 'built-styles-underline');
  expect(problems).toEqual([]);
});

test('built: labels beside, as the page asks, hold in the underline skin on a phone, and go above in a narrow box', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await mountBuilt(page, [{ type: 'section', id: 's', title: 'Beside', columns: 2, children: [field('a'), field('b')] }, { type: 'section', id: 'pair', columns: { wide: 2, narrow: 2 }, children: [field('c'), field('d')] }], { look: { labels: 'beside', labelWidth: 110 } }, { skin: 'underline' });
  expect(await labelAgainstBox(page, 'a')).toBe('beside');
  expect(Math.round((await node(page, 'a').locator('.fd-label').boundingBox())!.width)).toBe(110);
  // Two columns kept on a phone: each box too narrow for a label beside it.
  expect(await labelAgainstBox(page, 'c')).toBe('above');
  await expectNoSidewaysScroll(page);
  await screen(page, 'built-beside-phone');
});

test('built: a label kept out of sight names its box, and the empty box shows it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mountBuilt(page, [{ type: 'section', id: 's', title: 'Hidden', labels: 'hidden', columns: 2, children: [field('a'), field('b', { placeholder: 'Its own words' })] }]);
  const a = page.getByRole('textbox', { name: 'Field a' });
  await expect(a).toBeVisible();
  await expect(a).toHaveAttribute('placeholder', 'Field a');
  await expect(page.getByRole('textbox', { name: 'Field b' })).toHaveAttribute('placeholder', 'Its own words');
  expect((await node(page, 'a').locator('.fd-label').boundingBox())!.width).toBeLessThanOrEqual(1);
  await a.fill('typed');
  await expect(a).toHaveValue('typed');
  await screen(page, 'built-hidden-labels');
});
