import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Each section is a paint layer of its own (0.36: `position: relative`, widgets' styles.ts), so a key repaints its
 * section rather than the page. What a layer could cost, it must not: a popup opened in a section — a date's calendar,
 * a field's help as its tooltip, Fieldia's own list, a link's list, a button's menu — reaching over the section under
 * it, a press's toast and the question it asks first, each shows whole in every engine: at every point of it, it is
 * what is there (`elementFromPoint`), neither cut at its section's edge (as `contain: paint` cuts it) nor under the next
 * section (as `isolation` puts a popup with a z-index under it). The last test shows the check catches both.
 */

const HEIGHT = 900;
const LONG = 'What the person writes here is kept with the visit: a few words on what was seen, who was met and what is left to do, so the next visit starts where this one ended.';
const UNDER = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`under_${i + 1}`, { type: 'char', label: `Under ${i + 1}` }]));
const PARTNERS = { partner: Object.fromEntries(['Amal Hassan', 'Basma Adel', 'Dalia Fawzy', 'Hala Samir', 'Karim Nabil', 'Laila Amr'].map((name, i) => [i + 1, { name }])) };

interface Case {
  name: string;
  fields?: Record<string, unknown>;
  nodes: unknown[];
  look?: Record<string, unknown>;
  open(page: Page): Promise<unknown>;
  popup(page: Page): Locator;
  /** Opened under its control, it reaches over the section under its own; a toast and a dialog stand where the window says. */
  reaches: boolean;
}

const CASES: Case[] = [
  {
    name: 'a date’s calendar',
    fields: { day: { type: 'date', label: 'Day' } },
    nodes: [{ type: 'field', id: 'f-day', field: 'day' }],
    open: (page) => page.locator('[data-node="f-day"] .fd-calendar-button').click(),
    popup: (page) => page.locator('[data-node="f-day"] .fd-calendar:not([hidden])'),
    reaches: true,
  },
  {
    name: 'a field’s help, as its tooltip',
    look: { helpShown: 'tooltip' },
    fields: { note: { type: 'char', label: 'Note', help: LONG } },
    nodes: [{ type: 'field', id: 'f-note', field: 'note' }],
    open: (page) => page.locator('[data-node="f-note"] .fd-help-tip').click(),
    popup: (page) => page.locator('[data-node="f-note"] .fd-help-bubble:not([hidden])'),
    reaches: true,
  },
  {
    name: 'Fieldia’s own list',
    fields: { severity: { type: 'selection', label: 'Severity', options: ['Minor', 'Moderate', 'Major', 'Critical', 'Blocking', 'Unknown'].map((label) => ({ value: label.toLowerCase(), label })) } },
    nodes: [{ type: 'field', id: 'f-severity', field: 'severity', options: { list: 'own' } }],
    open: (page) => page.locator('[data-node="f-severity"] .fd-own-button').click(),
    popup: (page) => page.locator('.fd-own-list:not([hidden])'),
    reaches: true,
  },
  {
    name: 'a link’s list',
    fields: { client: { type: 'many2one', label: 'Client', relation: 'partner' } },
    nodes: [{ type: 'field', id: 'f-client', field: 'client' }],
    open: async (page) => {
      const box = page.locator('[data-node="f-client"] input').first();
      await box.click();
      await box.fill('a');
    },
    popup: (page) => page.locator('.fd-listbox:not([hidden])'),
    reaches: true,
  },
  {
    name: 'a button’s menu',
    nodes: [{ type: 'button', id: 'b-more', label: 'More', menu: ['Copy the address', 'Send the visit', 'Plan the next one', 'Close the visit'].map((label, i) => ({ id: `m-${i}`, label, steps: [{ do: 'say', message: label }] })) }],
    open: (page) => page.getByRole('button', { name: 'More' }).click(),
    popup: (page) => page.locator('.fd-button-menu:not([hidden])'),
    reaches: true,
  },
  {
    name: 'a press’s toast',
    nodes: [{ type: 'button', id: 'b-say', label: 'Say', steps: [{ do: 'say', message: 'Said from inside a section', tone: 'warning' }] }],
    open: (page) => page.locator('[data-node="b-say"]').click(),
    popup: (page) => page.locator('.fd-say'),
    reaches: false,
  },
  {
    name: 'a press’s question, its dialog',
    nodes: [{ type: 'button', id: 'b-ask', label: 'Close the visit', confirm: 'Close this visit? It can be opened again.', steps: [{ do: 'say', message: 'Closed' }] }],
    open: (page) => page.locator('[data-node="b-ask"]').click(),
    popup: (page) => page.getByRole('alertdialog'),
    reaches: false,
  },
];

/** A form of two sections, as boxes on the page (outlined): the case's own parts alone in the first, twelve fields under it. */
async function mount(page: Page, one: Case, css = '') {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => message.type() === 'error' && problems.push(message.text()));
  await page.goto('/script/');
  await expect(page.locator('.fd-form').first()).toBeVisible();
  const built = {
    fieldia: '0.13',
    id: 'section-popups',
    title: 'A visit',
    data: { kind: 'responses' },
    ...(one.look ? { look: one.look } : {}),
    fields: { ...(one.fields ?? {}), ...UNDER },
    layout: {
      type: 'sections',
      id: 'root',
      children: [
        { type: 'section', id: 'over', title: 'The visit', children: one.nodes },
        { type: 'section', id: 'under', title: 'What was seen', columns: 2, children: Object.keys(UNDER).map((name) => ({ type: 'field', id: `f-${name}`, field: name })) },
      ],
    },
  };
  await page.evaluate(
    ([p, records]) => {
      const fieldia = (window as unknown as { Fieldia: { mountViewer: (e: Element, o: object) => unknown; createMemoryDataSource: (o: object) => unknown } }).Fieldia;
      const app = document.getElementById('app') as HTMLElement;
      app.replaceChildren();
      fieldia.mountViewer(app, { page: p, dataSource: fieldia.createMemoryDataSource({ records }), skin: 'outlined' });
    },
    [built, PARTNERS] as const
  );
  await expect(page.locator('.fd-section[data-node="under"]')).toBeVisible();
  if (css) await page.addStyleTag({ content: css });
  // The first section's foot a third of the way down the window: what opens under its parts has room there, over the next.
  await page.evaluate(() => {
    const room = document.createElement('div');
    room.style.height = '1200px';
    document.body.append(room);
    const foot = (document.querySelector('.fd-section[data-node="over"]') as HTMLElement).getBoundingClientRect().bottom;
    window.scrollBy(0, foot - 300);
  });
  return problems;
}

/** The points of a grid over the popup, in the window, where something else is what is there. */
function notShown(popup: Locator) {
  return popup.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const missed: string[] = [];
    let looked = 0;
    for (let i = 1; i < 8; i++) {
      for (let j = 1; j < 8; j++) {
        const [x, y] = [box.left + (box.width * i) / 8, box.top + (box.height * j) / 8];
        if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
        looked++;
        const there = document.elementFromPoint(x, y);
        if (!there || !element.contains(there)) missed.push(`${Math.round(x)},${Math.round(y)}: ${there ? `${there.tagName.toLowerCase()}.${[...there.classList].join('.')}` : 'nothing'}`);
      }
    }
    return { looked, missed };
  });
}

/** How far the popup reaches past the first section's foot. */
const pastTheFoot = (page: Page, popup: Locator) =>
  popup.evaluate((element) => element.getBoundingClientRect().bottom - (document.querySelector('.fd-section[data-node="over"]') as HTMLElement).getBoundingClientRect().bottom);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: HEIGHT });
});

for (const one of CASES) {
  test(`${one.name}, opened in a section, shows whole`, async ({ page }) => {
    const problems = await mount(page, one);
    // A paint layer each, and nothing that cuts or stacks it.
    expect(await page.locator('.fd-section[data-node="over"]').evaluate((e) => { const s = getComputedStyle(e); return [s.position, s.zIndex, s.contain, s.isolation, s.overflow]; })).toEqual(['relative', 'auto', 'none', 'auto', 'visible']);
    await one.open(page);
    const popup = one.popup(page);
    await expect(popup).toBeVisible();
    // Where it settles (a list placed on the next frame), then looked at.
    await page.waitForTimeout(150);
    if (one.reaches) expect(await pastTheFoot(page, popup), `${one.name} reaches over the next section`).toBeGreaterThan(16);
    const { looked, missed } = await notShown(popup);
    expect(looked).toBeGreaterThan(20);
    expect(missed, `${one.name}: points where something else is shown`).toEqual([]);
    expect(problems).toEqual([]);
  });
}

test('the check sees a popup cut at its section’s edge, or under the next section', async ({ page }) => {
  const calendar = CASES[0];
  for (const css of ['.fd-form .fd-section { contain: paint; }', '.fd-form .fd-section { isolation: isolate; }']) {
    await mount(page, calendar, css);
    await calendar.open(page);
    const popup = calendar.popup(page);
    await expect(popup).toBeVisible();
    expect(await pastTheFoot(page, popup)).toBeGreaterThan(16);
    const { missed } = await notShown(popup);
    expect(missed.length, css).toBeGreaterThan(5);
  }
});
