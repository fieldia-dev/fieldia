import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings } from './a11y-support';
import { expectNoSidewaysScroll, open, screen } from './support';

/**
 * A list's calendar (@fieldia/calendar, `calendar` on a list): the clinic's
 * day by doctor and the booking desk's week, driven as a person drives them —
 * a visit dragged to another doctor and time by the mouse and stretched by its
 * edge, Undo; a booking moved from the keyboard with Move to…; a new visit
 * from an empty slot, clicked or dragged across; right to left; and the
 * agenda on a phone. "Now" is pinned (`now=`), so the records the demo makes
 * round it are the same on every run.
 */

const NOW = 'now=2026-10-14T09:40';
const CLINIC = `page=clinic-calendar&skin=outlined&${NOW}`;
const DESK = `page=booking-week&skin=outlined&${NOW}`;

const calendar = (page: Page) => page.locator('.fd-cal');
const settled = (page: Page) => expect(page.locator('.fd-cal-body')).not.toHaveAttribute('aria-busy', 'true');
const column = (page: Page, name: string) => page.locator(`.fd-cal-col[aria-label="${name}"]`);
const visit = (page: Page, title: string) => page.locator('.fd-cal-event').filter({ has: page.locator('.fd-cal-event-title', { hasText: title }) }).first();
const said = (page: Page) => page.locator('.fd-cal-said');
/** A record of the demo's in-memory source, by model and id. */
const record = (page: Page, model: string, id: number) => page.evaluate(([m, i]) => (window as any).fieldiaDemo.dataSource.records[m][i], [model, id] as const);
/** An instant as the date widgets write one, in the browser's own time. */
const instant = (page: Page, y: number, mo: number, d: number, h: number, mi = 0) => page.evaluate(([a, b, c, e, f]) => new Date(a, b - 1, c, e, f).toISOString(), [y, mo, d, h, mi] as const);
/** The id of a record of the clinic's by its patient. */
const idOf = (page: Page, model: string, field: string, value: string) =>
  page.evaluate(([m, f, v]) => Number(Object.entries((window as any).fieldiaDemo.dataSource.records[m]).find(([, r]: [string, any]) => r[f] === v)?.[0]), [model, field, value] as const);

async function openCalendar(page: Page, query: string, variant = 'plain') {
  const opened = await open(page, variant, query);
  await expect(calendar(page)).toBeVisible();
  await settled(page);
  return opened;
}

/** Press, move at a hand's pace, let go: as a person drags. */
async function dragTo(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / 12, from.y + ((to.y - from.y) * i) / 12);
  await page.mouse.up();
}

/** Pixels an hour takes: 48, or 96 where a quarter of an hour's slot would be under 24 pixels. */
const hourOf = (col: Locator) => col.evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue('--fd-cal-hour')));

/** Where a time falls in a column: so many pixels under its top for each minute after the first hour shown. */
async function pointAt(col: Locator, minutesFromTop: number, x = 0.5) {
  const box = (await col.boundingBox())!;
  return { x: box.x + box.width * x, y: box.y + (minutesFromTop * (await hourOf(col))) / 60 };
}

test.describe("a list's calendar", () => {
  // Tall enough for a whole working day: a drag is let go where a person sees it.
  test.use({ viewport: { width: 1280, height: 1400 } });

  test('a visit dragged by the mouse to another doctor and a later time is saved there, and Undo puts it back', async ({ page }) => {
    const { problems } = await openCalendar(page, CLINIC);
    await expect(page.locator('.fd-list')).toHaveAttribute('data-view', 'calendar');
    await expect(page.locator('.fd-cal-title')).toHaveText(/14 October 2026/);
    const id = await idOf(page, 'clinic.visit', 'patient', 'Walk-in: Samir Fouad');
    const walkIn = visit(page, 'Walk-in: Samir Fouad');
    const box = (await walkIn.boundingBox())!;
    // Taken 6px under its top edge; let go 6px under where 15:00 is in Dr Hany Mostafa's column (9:00 is its top).
    const target = await pointAt(column(page, 'Wednesday 14 October, Dr Hany Mostafa'), 6 * 60);
    await dragTo(page, { x: box.x + 20, y: box.y + 6 }, { x: target.x, y: target.y + 6 });
    // The day as the browser's language data writes it: "Wed 14 Oct" or "Wed, 14 Oct".
    await expect(said(page)).toContainText(/Moved Walk-in: Samir Fouad to Wed,? 14 Oct, 15:00\./);
    expect(await record(page, 'clinic.visit', id)).toMatchObject({ start: await instant(page, 2026, 10, 14, 15), stop: await instant(page, 2026, 10, 14, 15, 45), doctor: { id: 3, label: 'Dr Hany Mostafa' } });
    await settled(page);
    await expect(column(page, 'Wednesday 14 October, Dr Hany Mostafa').locator('.fd-cal-event', { hasText: 'Walk-in: Samir Fouad' })).toBeVisible();
    await screen(page, 'calendar-dragged');
    await said(page).getByRole('button', { name: 'Undo' }).click();
    await expect(said(page)).toHaveText(/Put back as it was\./);
    expect(await record(page, 'clinic.visit', id)).toMatchObject({ start: await instant(page, 2026, 10, 14, 11, 15), doctor: { id: 1, label: 'Dr Karim Fawzy' } });
    await settled(page);
    await expect(column(page, 'Wednesday 14 October, Dr Karim Fawzy').locator('.fd-cal-event', { hasText: 'Walk-in: Samir Fouad' })).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('a visit stretched by its lower edge ends later; a drag let go with Escape stays where it was', async ({ page }) => {
    await openCalendar(page, CLINIC);
    const id = await idOf(page, 'clinic.visit', 'patient', 'Yasmine Raafat');
    const yasmine = visit(page, 'Yasmine Raafat');
    const box = (await yasmine.boundingBox())!;
    const hour = await hourOf(yasmine);
    // Its lower edge, from 13:30 down to 14:15.
    await dragTo(page, { x: box.x + box.width / 2, y: box.y + box.height - 2 }, { x: box.x + box.width / 2, y: box.y + box.height - 2 + (45 * hour) / 60 });
    await expect(said(page)).toContainText('Yasmine Raafat now ends at 14:15.');
    expect(await record(page, 'clinic.visit', id)).toMatchObject({ start: await instant(page, 2026, 10, 14, 13), stop: await instant(page, 2026, 10, 14, 14, 15) });
    await settled(page);
    // Taken away, then Escape: nothing saved, the visit where it was.
    const again = (await visit(page, 'Yasmine Raafat').boundingBox())!;
    await page.mouse.move(again.x + 20, again.y + 6);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(again.x + 20, again.y + 6 + i * 20);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    expect(await record(page, 'clinic.visit', id)).toMatchObject({ start: await instant(page, 2026, 10, 14, 13) });
    expect(Math.round((await visit(page, 'Yasmine Raafat').boundingBox())!.y)).toBe(Math.round(again.y));
  });

  test('a booking moved from the keyboard with Move to…: its day, its time, its agent; Escape, and the arrows between slots', async ({ page }) => {
    const { problems } = await openCalendar(page, DESK);
    await expect(page.locator('.fd-cal-title')).toHaveText('10–16 Oct 2026');
    // Today's first booking, reached by Tab from the slots' one stop, which stands on today.
    const first = page.locator('.fd-cal-col[data-day="2026-10-14"] .fd-cal-event[tabindex="0"]').first();
    const id = Number(await first.getAttribute('data-id'));
    const name = (await first.locator('.fd-cal-event-title').textContent())!;
    await page.locator('.fd-cal-slot[tabindex="0"]').focus();
    await page.keyboard.press('Tab');
    await expect(first).toBeFocused();
    await page.keyboard.press('m');
    const dialog = page.getByRole('dialog', { name: `Move ${name}` });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Day')).toBeFocused();
    await screen(page, 'calendar-move-to', { viewport: true });
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(first).toBeFocused();
    await page.keyboard.press('Shift+F10');
    await dialog.getByLabel('Day').fill('2026-10-15');
    await dialog.getByLabel('Starts at').fill('18:30');
    await dialog.getByLabel('With').selectOption({ label: 'Omar Fathy' });
    await dialog.getByLabel('Starts at').press('Enter');
    await expect(said(page)).toContainText(new RegExp(`Moved ${name} to Thu,? 15 Oct, 18:30\\.`));
    expect(await record(page, 'desk.booking', id)).toMatchObject({ start: await instant(page, 2026, 10, 15, 18, 30), host: { id: 2, label: 'Omar Fathy' } });
    await settled(page);
    // The focus stays on the booking, now on Thursday: its block, or the "+N more" that holds it where Thursday is crowded.
    await expect(page.locator(`.fd-cal-col[data-day="2026-10-15"] :is([data-focus="e:${id}:2026-10-15"], [data-holds~="${id}"])`)).toBeFocused();
    // The arrows move between slots: one stop, a slot down, a day on.
    const stop = page.locator('.fd-cal-slot[tabindex="0"]');
    await stop.focus();
    const before = (await stop.getAttribute('aria-label'))!;
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    const after = (await page.locator(':focus').getAttribute('aria-label'))!;
    expect(after).not.toBe(before);
    expect(after.split(', ')[0]).not.toBe(before.split(', ')[0]);
    await expect(page.locator('.fd-cal-slot[tabindex="0"]')).toHaveCount(1);
    expect(problems).toEqual([]);
  });

  test('a click on an empty slot opens a new visit with its doctor, start and end; a drag across slots sets its length', async ({ page }) => {
    const { problems } = await openCalendar(page, CLINIC);
    const nour = column(page, 'Wednesday 14 October, Dr Nour Adel');
    // The first slot from 15:00 that is free for the hour after it.
    const minutes = await nour.evaluate((col) => {
      const free = new Set([...col.querySelectorAll('.fd-cal-slot')].filter((s) => s.getAttribute('aria-label')!.endsWith(', free')).map((s) => Number((s as HTMLElement).dataset['minutes'])));
      return [...free].find((m) => m >= 900 && [0, 15, 30, 45].every((d) => free.has(m + d)));
    });
    expect(minutes).toBeDefined();
    const free = nour.locator(`.fd-cal-slot[data-minutes="${minutes}"]`);
    await free.click();
    const dialog = page.getByRole('dialog', { name: 'New' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-node="f-doctor"] input')).toHaveValue('Dr Nour Adel');
    const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    await expect(dialog.locator('[data-node="f-start"] input')).toHaveValue(`2026-10-14T${hhmm(minutes!)}`);
    await expect(dialog.locator('[data-node="f-stop"] input')).toHaveValue(`2026-10-14T${hhmm(minutes! + 60)}`);
    await dialog.locator('[data-node="f-patient"] input').fill('Farida Selim');
    await screen(page, 'calendar-new-visit', { viewport: true });
    await dialog.getByRole('button', { name: 'Save & Close' }).click();
    await expect(dialog).toBeHidden();
    await settled(page);
    await expect(nour.locator('.fd-cal-event', { hasText: 'Farida Selim' })).toBeVisible();
    // Dragged down from 17:00 across to 17:30 in the column of no one: a visit of 45 minutes, to the end of the last slot.
    const nobody = column(page, 'Wednesday 14 October, No one');
    const from = await pointAt(nobody, 8 * 60 + 5);
    await dragTo(page, from, { x: from.x, y: from.y + (await hourOf(nobody)) / 2 });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-node="f-start"] input')).toHaveValue('2026-10-14T17:00');
    await expect(dialog.locator('[data-node="f-stop"] input')).toHaveValue('2026-10-14T17:45');
    await expect(dialog.locator('[data-node="f-doctor"] input')).toHaveValue('');
    await dialog.getByRole('button', { name: 'Discard' }).click();
    expect(problems).toEqual([]);
  });

  test('right to left: Saturday at the right, a drag lands on the day it is let go over, the arrows flipped', async ({ page }) => {
    const { problems } = await openCalendar(page, `${DESK}&locale=ar&dir=rtl`);
    await expect(page.locator('.fd-cal-nav button').first()).toHaveText('اليوم');
    const heads = page.locator('.fd-cal-head');
    const [saturday, sunday] = [(await heads.nth(0).boundingBox())!, (await heads.nth(1).boundingBox())!];
    expect(saturday.x).toBeGreaterThan(sunday.x);
    await expect(heads.nth(0)).toContainText('السبت');
    // A booking on Tuesday, dragged one column to the left: Wednesday.
    const tuesday = page.locator('.fd-cal-col[data-day="2026-10-13"]');
    const booking = tuesday.locator('.fd-cal-event').first();
    const id = Number(await booking.getAttribute('data-id'));
    const was = await record(page, 'desk.booking', id);
    const box = (await booking.boundingBox())!;
    const wednesday = (await page.locator('.fd-cal-col[data-day="2026-10-14"]').boundingBox())!;
    await dragTo(page, { x: box.x + box.width / 2, y: box.y + 6 }, { x: wednesday.x + wednesday.width / 2, y: box.y + 6 });
    await expect(said(page)).toContainText('نُقل');
    const now = await record(page, 'desk.booking', id);
    expect(new Date(now.start).getDate()).toBe(14);
    expect(new Date(now.start).getHours()).toBe(new Date(was.start).getHours());
    await settled(page);
    await screen(page, 'calendar-rtl');
    // ArrowLeft goes on to the next day, as the line reads.
    const stop = page.locator('.fd-cal-slot[tabindex="0"]');
    await stop.focus();
    const day = Number((await stop.getAttribute('data-focus'))!.split(':')[1]);
    await page.keyboard.press('ArrowLeft');
    expect(Number((await page.locator(':focus').getAttribute('data-focus'))!.split(':')[1])).toBe(day + 1);
    expect(problems).toEqual([]);
  });

  test('on a phone: the agenda of the week to come, nothing sideways, and Move to… from a row’s own button', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { problems } = await openCalendar(page, CLINIC);
    await expect(calendar(page)).toHaveAttribute('data-range', 'agenda');
    await expect(page.locator('.fd-cal-agenda-head').first()).toHaveText('Wednesday 14 October');
    await expectNoSidewaysScroll(page);
    await screen(page, 'calendar-phone', { viewport: true });
    const row = page.locator('.fd-cal-agenda-list .fd-cal-event').first();
    const id = Number(await row.getAttribute('data-id'));
    const name = (await row.locator('.fd-cal-event-title').textContent())!;
    await row.getByRole('button', { name: `Move ${name}` }).click();
    const dialog = page.getByRole('dialog', { name: `Move ${name}` });
    await expect(dialog).toBeInViewport();
    await dialog.getByLabel('Starts at').fill('16:45');
    await dialog.getByRole('button', { name: 'Move', exact: true }).click();
    await expect(said(page)).toContainText('16:45');
    expect(new Date((await record(page, 'clinic.visit', id)).start).getHours()).toBe(16);
    await expectNoSidewaysScroll(page);
    expect(problems).toEqual([]);
  });

  test('reads well in the dark, in the month, and passes the accessibility checks', async ({ page }) => {
    // The clinic's day: slots of a quarter of an hour, each 24 pixels tall.
    await openCalendar(page, CLINIC);
    expect(await axeFindings(page, 'day by doctor')).toEqual([]);
    await page.emulateMedia({ colorScheme: 'dark' });
    await openCalendar(page, `${DESK}&scheme=dark`);
    await screen(page, 'calendar-week-dark');
    expect(await axeFindings(page, 'week')).toEqual([]);
    await page.locator('.fd-cal-ranges').getByRole('button', { name: 'Month' }).click();
    await settled(page);
    // October 2026 from Saturday 26 September to Friday 6 November: six whole weeks.
    await expect(page.locator('.fd-cal-day')).toHaveCount(42);
    await screen(page, 'calendar-month-dark');
    expect(await axeFindings(page, 'month')).toEqual([]);
    await page.locator('.fd-cal-ranges').getByRole('button', { name: 'Agenda' }).click();
    await settled(page);
    expect(await axeFindings(page, 'agenda')).toEqual([]);
  });

  test('shows a record’s words in whole lines, never a line cut through, however narrow its block', async ({ page }) => {
    /** Each line of words in a block of the hours that its clipping edge cuts through: its words, and by how much. */
    const cutLines = () =>
      page.locator('.fd-cal').evaluate((root) => {
        const cut: string[] = [];
        for (const block of root.querySelectorAll<HTMLElement>('.fd-cal-col > .fd-cal-event')) {
          const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
          for (let text = walker.nextNode(); text; text = walker.nextNode()) {
            if (!text.textContent?.trim() || text.parentElement?.closest('button')) continue;
            // The lowest edge anything between the words and the block clips them at.
            let clip = Infinity;
            for (let el: HTMLElement | null = text.parentElement; el && block.contains(el); el = el.parentElement) {
              if (getComputedStyle(el).overflowY !== 'visible') clip = Math.min(clip, el.getBoundingClientRect().bottom);
            }
            const range = document.createRange();
            range.selectNodeContents(text);
            for (const line of range.getClientRects()) if (line.top < clip - 0.5 && line.bottom > clip + 0.5) cut.push(`${text.textContent} (${Math.round(clip - line.top)} of ${Math.round(line.height)}px)`);
          }
        }
        return cut;
      });
    for (const query of [DESK, `${DESK}&locale=ar&dir=rtl`, CLINIC]) {
      await openCalendar(page, query);
      expect(await page.locator('.fd-cal-col > .fd-cal-event').count()).toBeGreaterThan(10);
      expect(await cutLines(), query).toEqual([]);
    }
    // A narrow booking of several lines, shortened by its edge to one slot: its words keep to the one line it now holds.
    await openCalendar(page, DESK);
    const lobna = visit(page, 'Lobna Said');
    const box = (await lobna.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 2);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(box.x + box.width / 2, box.y + box.height - 2 - (i * box.height) / 6);
    expect((await lobna.boundingBox())!.height).toBeLessThan(25);
    expect(await cutLines()).toEqual([]);
    await page.keyboard.press('Escape');
    await page.mouse.up();
  });

  test('a crowded week keeps each word whole, cut with “…” rather than broken, and leaves the time to the hours where it cannot fit', async ({ page }) => {
    await openCalendar(page, CLINIC);
    await page.locator('.fd-cal-ranges button[data-range="week"]').click();
    await settled(page);
    const faults = await page.locator('.fd-cal').evaluate((root) => {
      const found: string[] = [];
      for (const block of root.querySelectorAll<HTMLElement>('.fd-cal-col > .fd-cal-event')) {
        const words = block.querySelector<HTMLElement>('.fd-cal-event-text') ?? block;
        const box = words.getBoundingClientRect();
        // Too narrow for its time: the name alone.
        if (block.getBoundingClientRect().width <= 56) {
          for (const part of block.querySelectorAll<HTMLElement>('.fd-cal-event-time, .fd-cal-event-who')) if (getComputedStyle(part).display !== 'none') found.push(`${part.textContent} in a narrow block`);
        }
        // A time shown whole, or not at all.
        const time = block.querySelector<HTMLElement>('.fd-cal-event-time');
        if (time && getComputedStyle(time).display !== 'none') {
          const r = time.getBoundingClientRect();
          if (r.left < box.left - 0.5 || r.right > box.right + 0.5) found.push(`${time.textContent} cut`);
        }
        // Each word of the name on one line (a hyphen may end one: "Walk-" "in"): a word broken across two has two boxes.
        const title = block.querySelector('.fd-cal-event-title')?.firstChild;
        if (!title?.textContent) continue;
        for (const [word, at = 0] of [...title.textContent.matchAll(/[^\s-]+-?/g)].map((m) => [m[0], m.index] as const)) {
          const range = document.createRange();
          range.setStart(title, at);
          range.setEnd(title, at + word.length);
          const lines = new Set([...range.getClientRects()].filter((r) => r.width > 0 && r.top < box.bottom).map((r) => Math.round(r.top)));
          if (lines.size > 1) found.push(`${word} broken`);
        }
      }
      return found;
    });
    expect(await page.locator('.fd-cal-col > .fd-cal-event').count()).toBeGreaterThan(40);
    expect(faults).toEqual([]);
    await screen(page, 'calendar-crowded-week');
  });

  test('cuts a name too long for its line at its own end, so it keeps its start, a Latin name on an Arabic page too', async ({ page }) => {
    /** Each one-line record whose name's first letter is out of sight. */
    const lostStarts = () =>
      page.locator('.fd-cal').evaluate((root) => {
        const lost: string[] = [];
        for (const title of root.querySelectorAll<HTMLElement>('.fd-cal-col > .fd-cal-event[data-short] .fd-cal-event-title, .fd-cal-day > .fd-cal-event .fd-cal-event-title, .fd-cal-allday > .fd-cal-event .fd-cal-event-title')) {
          const block = title.closest('.fd-cal-event') as HTMLElement;
          const text = document.createTreeWalker(title, NodeFilter.SHOW_TEXT).nextNode();
          if (!text?.textContent) continue;
          const range = document.createRange();
          range.setStart(text, 0);
          range.setEnd(text, 1);
          const first = range.getBoundingClientRect();
          // What is in sight: inside every box between the name and its block that clips what overflows it.
          let [left, right] = [-Infinity, Infinity];
          for (let el: HTMLElement | null = title; el && block.contains(el); el = el.parentElement) {
            if (getComputedStyle(el).overflowX === 'visible') continue;
            const box = el.getBoundingClientRect();
            [left, right] = [Math.max(left, box.left), Math.min(right, box.right)];
          }
          if (first.left < left - 0.5 || first.right > right + 0.5) lost.push(text.textContent);
        }
        return lost;
      });
    for (const query of [`${DESK}&locale=ar&dir=rtl`, DESK]) {
      await openCalendar(page, query);
      // Some names are cut short here: the narrow ones beside another.
      expect(await page.locator('.fd-cal-col > .fd-cal-event[data-short] .fd-cal-event-title').evaluateAll((titles) => titles.some((t) => [t, t.parentElement!].some((el) => el.scrollWidth > el.clientWidth)))).toBe(true);
      expect(await lostStarts(), query).toEqual([]);
      await page.locator('.fd-cal-ranges button[data-range="month"]').click();
      await settled(page);
      expect(await lostStarts(), `${query}, the month`).toEqual([]);
    }
  });

  test('keeps to the list’s search, and works in every framework', async ({ page }) => {
    for (const variant of ['react', 'vue', 'angular']) {
      await openCalendar(page, CLINIC, variant);
      await expect(page.locator('.fd-cal-col').first()).toBeVisible();
    }
    await openCalendar(page, CLINIC);
    const all = await page.locator('.fd-cal-event').count();
    await page.locator('.fd-search-toggle').click();
    await page.locator('.fd-search-option[data-filter="scans"]').click();
    await settled(page);
    await expect.poll(() => page.locator('.fd-cal-event').count()).toBeLessThan(all);
    for (const title of await page.locator('.fd-cal-event').evaluateAll((blocks) => blocks.map((b) => b.getAttribute('title') ?? ''))) expect(title).toMatch(/^\d\d:\d\d to/);
    // Each one a scan: their colour is the same.
    const colours = await page.locator('.fd-cal-event').evaluateAll((blocks) => new Set(blocks.map((b) => (b as HTMLElement).style.getPropertyValue('--fd-cal-c'))).size);
    expect(colours).toBe(1);
  });
});

test.describe('a list on a calendar, in the screen designer', () => {
  test('its Calendar in the list’s panel, beside Map, and Try it shows the records on the calendar', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    await page.goto('/screen/?start=clinic');
    const part = page.locator('[data-part="calendar"]');
    await expect(part.getByLabel('Show the records on a calendar too')).toBeChecked();
    await expect(part.getByLabel('Starts', { exact: true })).toHaveValue('start');
    await expect(part.getByLabel('A column for each')).toHaveValue('doctor');
    await part.getByLabel('Shows first').selectOption({ label: 'Week' });
    await part.getByRole('checkbox', { name: 'Month' }).uncheck();
    const layout = () => page.evaluate(() => (window as any).fieldiaDesigner.designer.getPage().layout.calendar);
    expect(await layout()).toMatchObject({ view: 'week', views: ['day', 'week', 'agenda'] });
    await part.scrollIntoViewIfNeeded();
    await screen(page, 'calendar-designer', { viewport: true });
    await page.getByRole('button', { name: 'Try it' }).click();
    const tried = page.locator('.fd-try-frame');
    await expect(tried.locator('.fd-list-views').getByRole('button', { name: 'Calendar', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(tried.locator('.fd-cal-ranges').getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true');
    await expect(tried.locator('.fd-cal-ranges').getByRole('button', { name: 'Month' })).toHaveCount(0);
    // Made-up visits in the week round today.
    await expect.poll(() => tried.locator('.fd-cal-event').count()).toBeGreaterThan(5);
    expect(problems).toEqual([]);
  });

  test('a list with no date says why it has no calendar, in place of the switch', async ({ page }) => {
    await page.goto('/screen/?start=list');
    const part = page.locator('[data-part="calendar"]');
    await expect(part.locator('[data-why="no-date"]')).toHaveText('A calendar needs a date, or a date and time, for when each record starts.');
    await expect(part.getByLabel('Show the records on a calendar too')).toBeHidden();
  });
});
