import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings } from './a11y-support';
import { open, screen } from './support';

/**
 * A calendar's moves kept safe, driven as a person drives them in the
 * clinic's day: a visit dragged at a hand's pace in a source that saves whole
 * records keeps every other field and another screen's change, through Undo;
 * a visit whose end its source locks offers nothing to move it by; Move to…
 * refuses a year typed short or far on, and keeps the keys' place when the
 * visit leaves the day shown; Escape lets go of a stretch and of slots dragged
 * across; nine visits in one slot read as two or three and "+N more".
 */

const CLINIC = 'page=clinic-calendar&skin=outlined&now=2026-10-14T09:40';

const settled = (page: Page) => expect(page.locator('.fd-cal-body')).not.toHaveAttribute('aria-busy', 'true');
const column = (page: Page, name: string) => page.locator(`.fd-cal-col[aria-label="${name}"]`);
const visit = (page: Page, title: string) => page.locator('.fd-cal-col > .fd-cal-event').filter({ has: page.locator('.fd-cal-event-title', { hasText: title }) }).first();
const said = (page: Page) => page.locator('.fd-cal-said');
const record = (page: Page, id: number) => page.evaluate((i) => (window as any).fieldiaDemo.dataSource.records['clinic.visit'][i], id);
const idOf = (page: Page, patient: string) =>
  page.evaluate((p) => Number(Object.entries((window as any).fieldiaDemo.dataSource.records['clinic.visit']).find(([, r]: [string, any]) => r.patient === p)?.[0]), patient);
const instant = (page: Page, d: number, h: number, mi = 0) => page.evaluate(([a, b, c]) => new Date(2026, 9, a, b, c).toISOString(), [d, h, mi] as const);
const hourOf = (el: Locator) => el.evaluate((e) => parseFloat(getComputedStyle(e).getPropertyValue('--fd-cal-hour')));

async function openClinic(page: Page) {
  const opened = await open(page, 'plain', CLINIC);
  await expect(page.locator('.fd-cal')).toBeVisible();
  await settled(page);
  return opened;
}

/** Ask for the day again as a person would: on a day and back. */
async function againByHand(page: Page) {
  await page.getByRole('button', { name: 'Next day' }).click();
  await settled(page);
  await page.getByRole('button', { name: 'Previous day' }).click();
  await settled(page);
}

/** Nine visits at 16:00 with Dr Nour Adel, put in as the demo's console would: the slot the reviewer crowded. */
const crowdSlot = (page: Page) =>
  page.evaluate(() => {
    const r = (window as any).fieldiaDemo.dataSource.records['clinic.visit'];
    for (let i = 0; i < 9; i++) r[910 + i] = { patient: 'Crowd patient ' + (i + 1), start: new Date(2026, 9, 14, 16).toISOString(), stop: new Date(2026, 9, 14, 16, 30).toISOString(), service: 'scan', state: 'booked', doctor: { id: 4, label: 'Dr Nour Adel' } };
  });

/** Press, move at a hand's pace (a step each frame), let go — or, with `before`, do that first while still holding. */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, before?: () => Promise<void>) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 14; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / 14, from.y + ((to.y - from.y) * i) / 14);
    await page.waitForTimeout(16);
  }
  if (before) await before();
  await page.mouse.up();
}

test.describe("a calendar's moves kept safe", () => {
  test.use({ viewport: { width: 1280, height: 1400 } });

  test('a visit dragged in a source that saves whole records keeps the rest and another screen’s change, and Undo puts back exactly what it held', async ({ page }) => {
    const { problems } = await openClinic(page);
    const id = await idOf(page, 'Yasmine Raafat');
    // The source writes each field a save names, from its values, as a PUT does; told the save is partial, it keeps the rest.
    await page.evaluate(() => {
      const ds = (window as any).fieldiaDemo.dataSource;
      (window as any).saves = [];
      ds.save = async (request: any) => {
        (window as any).saves.push({ partial: request.partial ?? false, fields: Object.keys(request.fields).sort(), values: request.values });
        const table = ds.records[request.model];
        const stored = request.partial ? { ...table[request.id] } : {};
        for (const name of Object.keys(request.fields)) stored[name] = request.values[name] ?? null;
        table[request.id] = stored;
        return { id: request.id };
      };
    });
    // On another screen, after this one listed the day, the front desk corrects her name.
    await page.evaluate((i) => ((window as any).fieldiaDemo.dataSource.records['clinic.visit'][i].patient = 'Yasmine Raafat Ali'), id);
    const before = await record(page, id);
    expect(before).toMatchObject({ phone: '+20 12 5550 1234', state: 'booked', service: 'checkup' });
    const box = (await visit(page, 'Yasmine Raafat').boundingBox())!;
    const nour = column(page, 'Wednesday 14 October, Dr Nour Adel');
    const col = (await nour.boundingBox())!;
    // To 15:00 in Dr Nour Adel's column (9:00 is its top), taken 6px under its top edge.
    await drag(page, { x: box.x + 20, y: box.y + 6 }, { x: col.x + col.width / 2, y: col.y + (6 * 60 * (await hourOf(nour))) / 60 + 6 });
    await expect(said(page)).toContainText('Moved Yasmine Raafat to');
    expect(await record(page, id)).toEqual({ ...before, start: await instant(page, 14, 15), stop: await instant(page, 14, 15, 30), doctor: { id: 4, label: 'Dr Nour Adel' } });
    const saves = await page.evaluate(() => (window as any).saves);
    expect(saves[0]).toMatchObject({ partial: true, fields: ['doctor', 'start', 'stop'] });
    await settled(page);
    await said(page).getByRole('button', { name: 'Undo' }).click();
    await expect(said(page)).toContainText('Put back as it was.');
    expect(await record(page, id)).toEqual(before);
    expect(problems).toEqual([]);
  });

  test('a visit whose end its source locks offers no drag, no stretch, no M and no Move to…, and says why', async ({ page }) => {
    const { problems } = await openClinic(page);
    const id = await idOf(page, 'Yasmine Raafat');
    await page.evaluate((i) => {
      const ds = (window as any).fieldiaDemo.dataSource;
      const list = ds.list.bind(ds);
      ds.list = async (request: any) => {
        const answer = await list(request);
        return { ...answer, records: answer.records.map((r: any) => (r.id === i ? { ...r, can: { readonlyFields: ['stop'], reason: 'Booked by the front desk.' } } : r)) };
      };
      (window as any).saved = 0;
      const save = ds.save.bind(ds);
      ds.save = (request: any) => {
        (window as any).saved++;
        return save(request);
      };
    }, id);
    await againByHand(page);
    const yasmine = visit(page, 'Yasmine Raafat');
    await yasmine.hover();
    await expect(yasmine).toHaveAttribute('title', 'Booked by the front desk.');
    await expect(yasmine.locator('.fd-cal-resize')).toHaveCount(0);
    // No Move to… beside it: the button is beside its block, never in it.
    await expect(page.locator('.fd-cal-event-menu[aria-label*="Yasmine Raafat"]')).toHaveCount(0);
    await yasmine.focus();
    await page.keyboard.press('m');
    await page.keyboard.press('Shift+F10');
    await expect(page.locator('.fd-cal-move')).toHaveCount(0);
    const box = (await yasmine.boundingBox())!;
    // Its middle and its lower edge, each dragged down: it stays, and a drag is no click, so nothing opens either.
    for (const y of [box.y + 6, box.y + box.height - 2]) {
      await drag(page, { x: box.x + box.width / 2, y }, { x: box.x + box.width / 2, y: y + 200 });
      await expect(yasmine).not.toHaveAttribute('data-moving', '');
    }
    await expect(page).toHaveURL(/page=clinic-calendar/);
    expect(await page.evaluate(() => (window as any).saved)).toBe(0);
    expect(await record(page, id)).toMatchObject({ start: await instant(page, 14, 13), stop: await instant(page, 14, 13, 30) });
    // Another visit still moves.
    await expect(visit(page, 'Walk-in: Samir Fouad')).toHaveAttribute('data-moves', '');
    expect(problems).toEqual([]);
  });

  test('Move to… refuses a year typed short or far on, in words, and moves once it is put right', async ({ page }) => {
    const { problems } = await openClinic(page);
    const id = await idOf(page, 'Yasmine Raafat');
    await visit(page, 'Yasmine Raafat').focus();
    await page.keyboard.press('m');
    const dialog = page.getByRole('dialog', { name: 'Move Yasmine Raafat' });
    const day = dialog.getByLabel('Day');
    await expect(day).toBeFocused();
    // The year's part, by Tab, as a person reaches it; then 26.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.type('26');
    await expect(day).toHaveValue('0026-10-14');
    await page.keyboard.press('Enter');
    const problem = dialog.getByRole('alert');
    await expect(problem).toHaveText('Pick a day from 14 Oct 2016 to 14 Oct 2036.');
    await expect(day).toBeFocused();
    await expect(day).toHaveAttribute('aria-invalid', 'true');
    await screen(page, 'calendar-move-to-refused', { viewport: true });
    await day.fill('2062-10-14');
    await day.press('Enter');
    await expect(problem).toHaveText('Pick a day from 14 Oct 2016 to 14 Oct 2036.');
    expect(await record(page, id)).toMatchObject({ start: await instant(page, 14, 13) });
    await day.fill('2026-10-15');
    await day.press('Enter');
    await expect(said(page)).toContainText(/Moved Yasmine Raafat to Thu,? 15 Oct, 13:00\./);
    expect(await record(page, id)).toMatchObject({ start: await instant(page, 15, 13) });
    expect(problems).toEqual([]);
  });

  test('after Move to… sends a visit to a day not shown, the keys stand on the step toward it, and the move is said', async ({ page }) => {
    const { problems } = await openClinic(page);
    const dina = visit(page, 'Dina Magdy');
    const id = Number(await dina.getAttribute('data-id'));
    await dina.focus();
    await page.keyboard.press('m');
    const dialog = page.getByRole('dialog', { name: 'Move Dina Magdy' });
    await dialog.getByLabel('Day').fill('2026-10-31');
    await dialog.getByLabel('Day').press('Enter');
    await expect(said(page)).toContainText(/Moved Dina Magdy to Sat,? 31 Oct/);
    await settled(page);
    await expect(page.getByRole('button', { name: 'Next day' })).toBeFocused();
    expect(new Date((await record(page, id)).start).getDate()).toBe(31);
    // Undo by the keys, Tab on to it; the keys back on the visit where it was.
    const undo = said(page).getByRole('button', { name: 'Undo' });
    for (let i = 0; i < 10 && !(await undo.evaluate((b) => b === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(undo).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(said(page)).toContainText('Put back as it was.');
    await settled(page);
    await expect(page.locator(':focus')).toHaveAttribute('data-focus', `e:${id}:2026-10-14`);
    expect(problems).toEqual([]);
  });

  test('a visit pointed at shows its ⋯ beside its own button, never in it: axe finds nothing, and the ⋯ and M both open Move to…', async ({ page }) => {
    const { problems } = await openClinic(page);
    const dina = visit(page, 'Dina Magdy');
    // Its own: the button right after it, beside it in its column.
    const menu = dina.locator('xpath=following-sibling::*[1]');
    await expect(menu).toHaveClass(/fd-cal-event-menu/);
    await expect(menu).toHaveAttribute('aria-label', 'Move Dina Magdy');
    await dina.hover();
    await expect(menu).toBeVisible();
    // Beside the visit's button, over its end corner: not inside it.
    await expect(dina.locator('.fd-cal-event-menu')).toHaveCount(0);
    const [block, button] = await Promise.all([dina.boundingBox(), menu.boundingBox()]);
    expect(button!.x).toBeGreaterThanOrEqual(block!.x - 1);
    expect(button!.x + button!.width).toBeLessThanOrEqual(block!.x + block!.width + 1);
    expect(Math.abs(button!.y - block!.y)).toBeLessThanOrEqual(1);
    expect(button!.width).toBeGreaterThanOrEqual(24);
    expect(await axeFindings(page, 'a visit pointed at')).toEqual([]);
    // The pointer's way: onto the ⋯ (it stays shown) and press it.
    await menu.hover();
    await expect(menu).toBeVisible();
    await menu.click();
    const dialog = page.getByRole('dialog', { name: 'Move Dina Magdy' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    // The keys' way: the visit focused shows its ⋯ too, and M opens Move to….
    await page.mouse.move(0, 0);
    await dina.focus();
    await expect(menu).toBeVisible();
    expect(await axeFindings(page, 'a visit with the focus')).toEqual([]);
    await page.keyboard.press('m');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    // A day's cell in the month: the same, its ⋯ over the visit's end corner.
    await page.locator('.fd-cal-ranges').getByRole('button', { name: 'Month' }).click();
    await settled(page);
    const inMonth = page.locator('.fd-cal-day .fd-cal-event').filter({ has: page.locator('.fd-cal-event-title', { hasText: 'Dina Magdy' }) }).first();
    await inMonth.hover();
    const monthMenu = inMonth.locator('xpath=following-sibling::*[1]');
    await expect(monthMenu).toHaveAttribute('aria-label', 'Move Dina Magdy');
    await expect(monthMenu).toBeVisible();
    await expect(inMonth.locator('.fd-cal-event-menu')).toHaveCount(0);
    const [day, dayButton] = await Promise.all([inMonth.boundingBox(), monthMenu.boundingBox()]);
    expect(dayButton!.x + dayButton!.width).toBeLessThanOrEqual(day!.x + day!.width + 1);
    expect(dayButton!.y).toBeGreaterThanOrEqual(day!.y - 1);
    expect(dayButton!.y + dayButton!.height).toBeLessThanOrEqual(day!.y + day!.height + 1);
    expect(await axeFindings(page, 'a visit pointed at in the month')).toEqual([]);
    await monthMenu.click();
    await expect(dialog).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('Escape lets go of a stretch and of slots dragged across, saving and making nothing', async ({ page }) => {
    const { problems } = await openClinic(page);
    const id = await idOf(page, 'Yasmine Raafat');
    const yasmine = visit(page, 'Yasmine Raafat');
    const box = (await yasmine.boundingBox())!;
    const hour = await hourOf(yasmine);
    await drag(page, { x: box.x + box.width / 2, y: box.y + box.height - 2 }, { x: box.x + box.width / 2, y: box.y + box.height - 2 + hour }, async () => {
      // Stretched an hour on, still held.
      expect((await yasmine.boundingBox())!.height).toBeGreaterThan(box.height + hour / 2);
      await page.keyboard.press('Escape');
    });
    await expect(said(page)).toBeEmpty();
    expect(await record(page, id)).toMatchObject({ stop: await instant(page, 14, 13, 30) });
    expect(Math.round((await yasmine.boundingBox())!.height)).toBe(Math.round(box.height));
    // Slots dragged across in the column of no one, then Escape: no new visit.
    const nobody = column(page, 'Wednesday 14 October, No one');
    const col = (await nobody.boundingBox())!;
    const from = { x: col.x + col.width / 2, y: col.y + 8 * hour + 5 };
    await drag(page, from, { x: from.x, y: from.y + hour / 2 }, () => page.keyboard.press('Escape'));
    await expect(page.locator('.fd-cal-picking')).toHaveCount(0);
    await page.waitForTimeout(300);
    await expect(page.getByRole('dialog', { name: 'New' })).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test('nine visits in one slot read as two or three side by side and "+N more", which lists them all, by the keys too', async ({ page }) => {
    const { problems } = await openClinic(page);
    await crowdSlot(page);
    await againByHand(page);
    const nour = column(page, 'Wednesday 14 October, Dr Nour Adel');
    const crowd = nour.locator('.fd-cal-event').filter({ hasText: 'Crowd patient' });
    const more = nour.locator('button.fd-cal-more');
    await expect(more).toBeVisible();
    const shown = await crowd.count();
    expect(shown).toBeGreaterThanOrEqual(1);
    expect(shown).toBeLessThan(9);
    await expect(more).toHaveText(/^\+\d+ more$/);
    // Each one wide enough to read its name's start, never a sliver.
    for (const width of await crowd.evaluateAll((blocks) => blocks.map((b) => b.getBoundingClientRect().width))) expect(width).toBeGreaterThanOrEqual(40);
    await screen(page, 'calendar-crowded-slot');
    // By the keys: Tab reaches "+N more", Enter opens the slot's list on its first visit, the arrows go down it. The
    // pointer away from the calendar, as a keyboard's user leaves it (a visit pointed at shows its ⋯ — beside its button
    // since 0.35, no longer nested in it: the test above).
    await page.mouse.move(0, 0);
    await more.focus();
    await page.keyboard.press('Enter');
    const list = page.getByRole('dialog', { name: /^Wednesday 14 October, .*Dr Nour Adel$/ });
    await expect(list).toBeVisible();
    const rows = list.locator('.fd-cal-event-open');
    const names = await list.locator('.fd-cal-event-title').allTextContents();
    for (let i = 1; i <= 9; i++) expect(names).toContain(`Crowd patient ${i}`);
    await expect(rows.first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(rows.nth(1)).toBeFocused();
    // Each name whole in the list.
    for (const cut of await list.locator('.fd-cal-event-title').evaluateAll((titles) => titles.map((t) => t.scrollWidth > t.clientWidth + 1))) expect(cut).toBe(false);
    await screen(page, 'calendar-crowded-list', { viewport: true });
    expect(await axeFindings(page, 'a crowded slot’s list')).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(list).toBeHidden();
    await expect(more).toBeFocused();
    // The week: the same slot, still readable.
    await page.locator('.fd-cal-ranges').getByRole('button', { name: 'Week' }).click();
    await settled(page);
    const wednesday = page.locator('.fd-cal-col[data-day="2026-10-14"]');
    await expect(wednesday.locator('button.fd-cal-more[data-holds~="918"]')).toBeVisible();
    for (const width of await wednesday.locator('.fd-cal-event').evaluateAll((blocks) => blocks.map((b) => b.getBoundingClientRect().width))) expect(width).toBeGreaterThanOrEqual(40);
    expect(problems).toEqual([]);
  });

  test('a crowded slot’s "+N more" and its list read in the dark, and pass the accessibility checks', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    const { problems } = await open(page, 'plain', `${CLINIC}&scheme=dark`);
    await settled(page);
    await crowdSlot(page);
    await againByHand(page);
    const more = column(page, 'Wednesday 14 October, Dr Nour Adel').locator('button.fd-cal-more');
    expect(await axeFindings(page, 'a crowded slot, dark')).toEqual([]);
    await more.click();
    await expect(page.locator('.fd-cal-crowd')).toBeVisible();
    await screen(page, 'calendar-crowded-list-dark', { viewport: true });
    expect(await axeFindings(page, 'a crowded slot’s list, dark')).toEqual([]);
    expect(problems).toEqual([]);
  });
});
