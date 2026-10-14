import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { addField, editing, inAdvanced, watch } from './designer-support';
import { node, open, screen } from './support';

/**
 * The input rules for dates, times and choices (0.21), typed and pasted as a
 * person does — keys pressed one by one (Arabic-Indic and Persian digits
 * too, with the browser's own menus left in English), a real Ctrl+V from the
 * clipboard, the calendar clicked — on the "Every field", "Office move",
 * "Business", "Customer", "Work item picker" and "Sales order" examples, in
 * English, Arabic right to left, French and German. A date is read in the
 * page's order; what does not read stays in its box, marked, with why; Enter
 * in a link or a choice takes the match or says there is none, and never
 * sends the form.
 */

// The clipboard is the browser's, one for every page a worker has open: these tests take turns with it.
test.describe.configure({ mode: 'default' });

type Values = Record<string, unknown>;
const values = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values as Values);
const valueOf = async (page: Page, field: string) => (await values(page))[field];
const setValue = (page: Page, field: string, value: unknown) => page.evaluate(([name, v]) => (window as any).fieldiaDemo.handle.form.setValue(name, v), [field, value] as const);
const unread = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().unread as Record<string, { text: string; message: string }>);
const boxOf = (page: Page, id: string) => node(page, id).locator('input.fd-input').first();
const hintOf = (page: Page, id: string) => node(page, id).locator('.fd-refusal-hint');
const errorOf = (page: Page, id: string) => node(page, id).locator('.fd-error').first();
const pad = (n: number) => String(n).padStart(2, '0');
/** A day counted from today, the first Sunday to Thursday from then on (the office move's working days). */
function workday(offset: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  while (d.getDay() === 5 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dmy = (d: Date, mark = '/') => `${pad(d.getDate())}${mark}${pad(d.getMonth() + 1)}${mark}${d.getFullYear()}`;
const arabic = (text: string) => text.replace(/\d/g, (d) => String.fromCharCode(0x660 + Number(d)));
const persian = (text: string) => text.replace(/\d/g, (d) => String.fromCharCode(0x6f0 + Number(d)));

/** A box entered as a person enters it, its text all chosen so typing replaces it. */
async function enter(box: Locator) {
  await box.click();
  await box.press('Control+A');
}

/** Text put on the clipboard, then pasted with Ctrl+V. */
async function paste(page: Page, box: Locator, text: string) {
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await box.press('Control+V');
}

/** Keys pressed through the browser's own input pipeline (CDP keyDown with text), as an Arabic keyboard sends them. */
async function keyDown(page: Page, text: string) {
  const cdp = await page.context().newCDPSession(page);
  for (const char of [...text]) {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', text: char, unmodifiedText: char, key: char });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: char });
  }
  await cdp.detach();
}

test.describe('a date, a date and time, a time', () => {
  let problems: string[] = [];
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  });
  test.afterEach(() => expect(problems).toEqual([]));

  for (const [locale, query, shape, words] of [
    ['en', '', 'dd/mm/yyyy', '13 Oct 2026'],
    ['ar', '&locale=ar&dir=rtl', 'يوم/شهر/سنة', '13 أكتوبر 2026'],
    ['fr', '&locale=fr', 'jj/mm/aaaa', '13 oct. 2026'],
    ['de', '&locale=de', 'TT.MM.JJJJ', '13. Okt. 2026'],
  ] as const) {
    test(`${locale}: typed day first, as the placeholder says — 13/10/2026 is 13 October — and shown in words once left`, async ({ page }) => {
      ({ problems } = await open(page, 'plain', `page=fields&skin=outlined${query}`));
      const start = boxOf(page, 'f-start');
      await expect(start).toHaveAttribute('type', 'text');
      await expect(start).toHaveAttribute('placeholder', shape);
      await enter(start);
      await start.pressSequentially(locale === 'de' ? '13.10.2026' : locale === 'ar' ? arabic('13/10/2026') : '13/10/2026');
      expect(await valueOf(page, 'start_date')).toBe('2026-10-13');
      await page.keyboard.press('Tab');
      await expect(start).toHaveValue(words);
    });
  }

  test('ar: Arabic-Indic and Persian digits pressed on an Arabic keyboard are read, the browser’s menus in English', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=fields&skin=outlined&locale=ar&dir=rtl'));
    const start = boxOf(page, 'f-start');
    await enter(start);
    await keyDown(page, arabic('20/10/2026'));
    expect(await valueOf(page, 'start_date')).toBe('2026-10-20');
    await enter(start);
    await keyDown(page, persian('21/10/2026'));
    expect(await valueOf(page, 'start_date')).toBe('2026-10-21');
  });

  for (const [locale, query, typed, why] of [
    ['en', '', '31/02/2026', 'Start date: February 2026 has 28 days'],
    ['ar', '&locale=ar&dir=rtl', arabic('31/02/2026'), 'Start date: في فبراير 2026 28 يومًا'],
    ['fr', '&locale=fr', '31/02/2026', 'Start date : février 2026 compte 28 jours'],
  ] as const) {
    test(`${locale}: a day that does not exist stays in its box, marked, with why; the field keeps its day; Save refuses`, async ({ page }) => {
      ({ problems } = await open(page, 'plain', `page=fields&skin=outlined${query}`));
      const before = await valueOf(page, 'start_date');
      const start = boxOf(page, 'f-start');
      await enter(start);
      await start.pressSequentially(typed);
      // Out of the field: past its calendar button.
      await page.keyboard.press('Tab');
      await expect(start).toHaveValue(typed);
      await expect(start).toHaveAttribute('aria-invalid', 'true');
      await expect(errorOf(page, 'f-start')).toHaveText(why);
      expect(await valueOf(page, 'start_date')).toBe(before);
      expect(await page.evaluate(() => (window as any).fieldiaDemo.handle.form.validate())).toBe(false);
      await screen(page, `input-dates-unread-${locale}`, { viewport: true });
    });
  }

  for (const [locale, query, typed, shown, why] of [
    ['en', '', '1x5/10/2026', '1', 'Start date: “⁨1x5/10/2026⁩” is not a whole date yet; write it like 31/12/YYYY'],
    ['ar', '&locale=ar&dir=rtl', arabic('1') + 'x' + arabic('5/10/2026'), arabic('1'), 'Start date: «⁨' + arabic('1') + 'x' + arabic('5/10/2026') + '⁩» ليس تاريخًا كاملًا بعد؛ اكتبه مثل 31/12/YYYY'],
    ['fr', '&locale=fr', '1x5/10/2026', '1', 'Start date : « ⁨1x5/10/2026⁩ » n’est pas encore une date complète ; écrivez-la comme 31/12/YYYY'],
  ] as const) {
    test(`${locale}: a stray letter never makes a date of the keys around it — 1x5/10/2026 is never 15 October`, async ({ page }) => {
      ({ problems } = await open(page, 'plain', `page=fields&skin=outlined${query}`));
      const before = await valueOf(page, 'start_date');
      const start = boxOf(page, 'f-start');
      const message = why.replace('YYYY', String(new Date().getFullYear()));
      await enter(start);
      await start.pressSequentially(typed);
      // The letter is refused, and the keys after it wait with it: the box never shows a date made without it.
      await expect(start).toHaveValue(shown);
      await expect(hintOf(page, 'f-start')).toBeVisible();
      expect(await valueOf(page, 'start_date')).toBe(before);
      // Left so, all that was typed stays in the box, marked, with why; the field keeps its day.
      await page.keyboard.press('Tab');
      await expect(start).toHaveValue(typed);
      await expect(start).toHaveAttribute('aria-invalid', 'true');
      await expect(errorOf(page, 'f-start')).toHaveText(message);
      expect(await valueOf(page, 'start_date')).toBe(before);
      // Typed again, Backspace takes the waiting keys back one by one, the refused one last; then the day typed is taken.
      await enter(start);
      await start.pressSequentially(typed);
      for (let i = 0; i < [...typed].length - [...shown].length; i++) await start.press('Backspace');
      await expect(hintOf(page, 'f-start')).toBeHidden();
      await expect(start).toHaveValue(shown);
      await start.pressSequentially(locale === 'ar' ? arabic('/10/2026') : '/10/2026');
      await page.keyboard.press('Tab');
      expect(await valueOf(page, 'start_date')).toBe('2026-10-01');
      await expect(errorOf(page, 'f-start')).toBeHidden();
    });
  }

  test('a letter is refused at the keystroke, with words under the box; a paste that is no date too', async ({ page }) => {
    for (const [scheme, dir] of [['light', ''], ['dark', '&locale=ar&dir=rtl']] as const) {
      ({ problems } = await open(page, 'plain', `page=fields&skin=outlined&scheme=${scheme}${dir}`));
      const start = boxOf(page, 'f-start');
      await enter(start);
      await start.pressSequentially('13x');
      await expect(start).toHaveValue('13');
      const hint = hintOf(page, 'f-start');
      await expect(hint).toBeVisible();
      await expect(hint).toHaveAttribute('role', 'status');
      await expect(start).toHaveAttribute('aria-describedby', new RegExp(await hint.getAttribute('id') as string));
      await node(page, 'f-start').scrollIntoViewIfNeeded();
      await screen(page, `input-dates-hint-${scheme}${dir ? '-rtl' : ''}`, { viewport: true });
      await paste(page, start, 'next Tuesday');
      await expect(start).toHaveValue('13');
      await expect(hint).toContainText('next Tuesday');
    }
  });

  test('a date and time corrected digit by digit never holds year 2, and is taken once date and time read whole', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=fields&skin=outlined'));
    await page.evaluate(() => (window as any).fieldiaDemo.handle.form.setValue('kickoff', new Date(2026, 9, 12, 10, 0).toISOString()));
    const kickoff = boxOf(page, 'f-kickoff');
    await expect(kickoff).toHaveValue('12 Oct 2026, 10:00');
    await enter(kickoff);
    await expect(kickoff).toHaveValue('12/10/2026 10:00');
    const seen = new Set<string>();
    for (const char of '13/10/2027 10:00') {
      await kickoff.press(char);
      seen.add(String(await valueOf(page, 'kickoff')));
    }
    const years = [...seen].map((v) => new Date(v).getFullYear());
    expect(years.every((y) => y === 2026 || y === 2027)).toBe(true);
    expect(await page.evaluate(() => new Date((window as any).fieldiaDemo.handle.form.getState().values.kickoff).toString())).toContain('Oct 13 2027 10:00');
  });

  test('pasted: ISO, the page’s order or Arabic digits into a date, a date and time and a time', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=kinds&skin=outlined'));
    const day = workday(9);
    const move = boxOf(page, 'q-move-day');
    await enter(move);
    await paste(page, move, iso(day));
    await expect(move).toHaveValue(dmy(day));
    expect(await valueOf(page, 'move_day')).toBe(iso(day));
    const later = workday(16);
    await enter(move);
    await paste(page, move, arabic(dmy(later)));
    expect(await valueOf(page, 'move_day')).toBe(iso(later));
    const arrival = boxOf(page, 'q-arrival');
    await enter(arrival);
    await paste(page, arrival, '٠٩:٣٠');
    await page.keyboard.press('Tab');
    expect(await valueOf(page, 'arrival')).toBe('09:30');
    await enter(arrival);
    await paste(page, arrival, 'noon');
    await expect(hintOf(page, 'q-arrival')).toHaveText('“⁨noon⁩” is not a date, so it was not pasted');
    expect(await valueOf(page, 'arrival')).toBe('09:30');
  });

  test('a day in the same year as both limits is typed in full — 20/10 is the 20th — and its limits are said on leaving', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=kinds&skin=outlined'));
    const move = boxOf(page, 'q-move-day');
    const day = workday(3);
    await enter(move);
    await move.pressSequentially(dmy(day));
    await page.keyboard.press('Tab');
    expect(await valueOf(page, 'move_day')).toBe(iso(day));
    const far = workday(90);
    await enter(move);
    await move.pressSequentially(dmy(far));
    await page.keyboard.press('Tab');
    await expect(errorOf(page, 'q-move-day')).toContainText('can’t be after');
    // A Friday on the calendar: faint, and picking it says why and picks nothing.
    await node(page, 'q-move-day').locator('.fd-calendar-button').click();
    const friday = node(page, 'q-move-day').locator('.fd-calendar tbody button.fd-off').first();
    await expect(friday).toBeVisible();
  });

  test('a time of day: Arabic digits, am and pm; between its steps it says the steps either side', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=kinds&skin=outlined&locale=ar&dir=rtl'));
    const arrival = boxOf(page, 'q-arrival');
    await enter(arrival);
    await keyDown(page, '٠٩٣٠');
    await page.keyboard.press('Tab');
    expect(await valueOf(page, 'arrival')).toBe('09:30');
    await enter(arrival);
    await arrival.pressSequentially('7:10');
    await page.keyboard.press('Tab');
    expect(await valueOf(page, 'arrival')).toBe('07:10');
    await expect(errorOf(page, 'q-arrival')).toContainText('07:00');
    await expect(errorOf(page, 'q-arrival')).toContainText('07:15');
  });
});

test.describe('a date as Fieldia writes it at rest', () => {
  let problems: string[] = [];
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  });
  test.afterEach(() => expect(problems).toEqual([]));

  for (const [locale, query, day, dayAndTime] of [
    ['en', '', '15 Oct 2026', '15 Oct 2026, 14:30'],
    ['ar', '&locale=ar&dir=rtl', '15 أكتوبر 2026', '15 أكتوبر 2026، 14:30'],
    ['fr', '&locale=fr', '15 oct. 2026', '15 oct. 2026, 14:30'],
    ['de', '&locale=de', '15. Okt. 2026', '15. Okt. 2026, 14:30'],
  ] as const) {
    test(`${locale}: what a box shows once left — “${day}” — pastes back, and can be typed so`, async ({ page }) => {
      ({ problems } = await open(page, 'plain', `page=fields&skin=outlined${query}`));
      // Copied as it is shown at rest (a list, a read-only view, another box left), then pasted with Ctrl+V.
      const start = boxOf(page, 'f-start');
      await setValue(page, 'start_date', '2026-10-15');
      await expect(start).toHaveValue(day);
      const shown = await start.inputValue();
      await setValue(page, 'start_date', null);
      await enter(start);
      await paste(page, start, shown);
      await expect(hintOf(page, 'f-start')).toBeHidden();
      expect(await valueOf(page, 'start_date')).toBe('2026-10-15');
      const kickoff = boxOf(page, 'f-kickoff');
      const at = await page.evaluate(() => new Date(2026, 9, 15, 14, 30).toISOString());
      await setValue(page, 'kickoff', at);
      await expect(kickoff).toHaveValue(dayAndTime);
      const shownTime = await kickoff.inputValue();
      await setValue(page, 'kickoff', null);
      await enter(kickoff);
      await paste(page, kickoff, shownTime);
      await expect(hintOf(page, 'f-kickoff')).toBeHidden();
      expect(await valueOf(page, 'kickoff')).toBe(at);
      // Typed key by key, its month in words: nothing refused on the way, and read as the box is left.
      await setValue(page, 'start_date', null);
      await enter(start);
      await start.pressSequentially(day);
      await expect(hintOf(page, 'f-start')).toBeHidden();
      await page.keyboard.press('Tab');
      expect(await valueOf(page, 'start_date')).toBe('2026-10-15');
      await expect(start).toHaveValue(day);
      await expect(start).toHaveAttribute('aria-invalid', 'false');
    });
  }

  test('en: a date written month first, and an instant as a server writes one, paste too', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=fields&skin=outlined'));
    const start = boxOf(page, 'f-start');
    await enter(start);
    await paste(page, start, 'Oct 15, 2026');
    expect(await valueOf(page, 'start_date')).toBe('2026-10-15');
    const kickoff = boxOf(page, 'f-kickoff');
    await enter(kickoff);
    await paste(page, kickoff, '2026-10-15T14:30:00Z');
    await expect(hintOf(page, 'f-kickoff')).toBeHidden();
    expect(await valueOf(page, 'kickoff')).toBe('2026-10-15T14:30:00.000Z');
    // A date's box takes an instant's day where the person is, its seconds no part of a day; a date and time's keeps to the minute.
    const day = await page.evaluate(() => {
      const at = new Date('2026-10-15T14:30:45Z');
      return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
    });
    await setValue(page, 'start_date', null);
    await enter(start);
    await paste(page, start, '2026-10-15T14:30:45Z');
    await expect(hintOf(page, 'f-start')).toBeHidden();
    expect(await valueOf(page, 'start_date')).toBe(day);
    await enter(kickoff);
    await paste(page, kickoff, '2026-10-15T09:15:45Z');
    await expect(hintOf(page, 'f-kickoff')).toHaveText('Kick-off meeting: “⁨2026-10-15T09:15:45Z⁩” is not a time; write it like 14:30');
    expect(await valueOf(page, 'kickoff')).toBe('2026-10-15T14:30:00.000Z');
  });
});

test.describe('a year of two digits', () => {
  let problems: string[] = [];
  test.afterEach(() => expect(problems).toEqual([]));

  for (const [locale, query, typed, why] of [
    ['en', '', '15/3/85', 'Start date: “⁨85⁩” could be 1985 or 2085; write the year in full'],
    ['ar', '&locale=ar&dir=rtl', arabic('15/3/85'), 'Start date: «⁨85⁩» قد تعني 1985 أو 2085؛ اكتب السنة كاملة'],
    ['fr', '&locale=fr', '15/3/85', 'Start date : « ⁨85⁩ » peut être 1985 ou 2085 ; écrivez l’année en entier'],
  ] as const) {
    test(`${locale}: is never given a century in silence: kept in its box, marked, naming both it could be`, async ({ page }) => {
      ({ problems } = await open(page, 'plain', `page=fields&skin=outlined${query}`));
      const before = await valueOf(page, 'start_date');
      const start = boxOf(page, 'f-start');
      await enter(start);
      await start.pressSequentially(typed);
      await page.keyboard.press('Tab');
      await expect(start).toHaveValue(typed);
      await expect(start).toHaveAttribute('aria-invalid', 'true');
      await expect(errorOf(page, 'f-start')).toHaveText(why);
      expect(await valueOf(page, 'start_date')).toBe(before);
      expect(await page.evaluate(() => (window as any).fieldiaDemo.handle.form.validate())).toBe(false);
      await node(page, 'f-start').scrollIntoViewIfNeeded();
      await screen(page, `input-dates-short-year-${locale}`, { viewport: true });
    });
  }
});

test.describe('a range of dates', () => {
  let problems: string[] = [];
  test.afterEach(() => expect(problems).toEqual([]));

  test('says “Ends can’t be before Starts” as either box is left, marks the end’s box, and Save refuses', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=business&skin=underline'));
    const [from, to] = [node(page, 'f-dates').locator('input').nth(0), node(page, 'f-dates').locator('input').nth(1)];
    await enter(from);
    await from.pressSequentially('11/11/2026');
    await page.keyboard.press('Tab');
    await enter(to);
    await to.pressSequentially('20/10/2026');
    await page.keyboard.press('Tab');
    const endError = node(page, 'f-dates').locator('.fd-range-error');
    await expect(endError).toHaveText('Ends can’t be before Starts');
    await expect(to).toHaveAttribute('aria-invalid', 'true');
    expect(await page.evaluate(() => (window as any).fieldiaDemo.handle.form.validate())).toBe(false);
    await node(page, 'f-dates').scrollIntoViewIfNeeded();
    await screen(page, 'input-dates-range', { viewport: true });
    await enter(from);
    await from.pressSequentially('15/10/2026');
    await page.keyboard.press('Tab');
    await expect(endError).toBeHidden();
  });

  test('ar: reads Arabic digits in either box, and keeps an impossible end’s text with why', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=business&skin=underline&locale=ar&dir=rtl'));
    const [from, to] = [node(page, 'f-dates').locator('input').nth(0), node(page, 'f-dates').locator('input').nth(1)];
    await enter(from);
    await from.pressSequentially(arabic('12/10/2026'));
    await enter(to);
    await to.pressSequentially(arabic('31/02/2027'));
    await page.keyboard.press('Tab');
    expect(await valueOf(page, 'date_from')).toBe('2026-10-12');
    await expect(to).toHaveValue(arabic('31/02/2027'));
    await expect(node(page, 'f-dates').locator('.fd-range-error')).toContainText('فبراير 2027');
    await screen(page, 'input-dates-range-ar', { viewport: true });
  });
});

test.describe('links and choices typed into', () => {
  let problems: string[] = [];
  test.afterEach(() => expect(problems).toEqual([]));

  test('a link: Enter takes the only match and never saves the record; no match is said; leaving puts back what it held', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=customer&skin=underline'));
    const country = boxOf(page, 'f-country');
    const before = await valueOf(page, 'country_id');
    await enter(country);
    await country.press('Delete');
    await country.pressSequentially('Jordan');
    await country.press('Enter');
    await expect.poll(() => valueOf(page, 'country_id')).toMatchObject({ label: 'Jordan' });
    expect(await page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().status)).not.toBe('saved');
    await enter(country);
    await country.press('Delete');
    await country.pressSequentially('Narnia');
    await country.press('Enter');
    await expect(hintOf(page, 'f-country')).toContainText('nothing is called “⁨Narnia⁩”');
    expect(await page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().status)).not.toBe('saved');
    await page.keyboard.press('Tab');
    await expect(country).toHaveValue('Jordan');
    await expect(hintOf(page, 'f-country')).toContainText('still holds Jordan');
    await node(page, 'f-country').scrollIntoViewIfNeeded();
    await screen(page, 'input-dates-link', { viewport: true });
    void before;
  });

  test('ar: a choice’s search box finds Arabic digits, takes an exact name on Tab, and says words that name nothing', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=kinds&skin=outlined&locale=ar&dir=rtl'));
    const floor = boxOf(page, 'q-floor');
    await enter(floor);
    await floor.pressSequentially('Floor 12');
    await page.keyboard.press('Tab');
    expect(await valueOf(page, 'floor')).toBe('floor_12');
    await enter(floor);
    await keyDown(page, '١١');
    await floor.press('Enter');
    expect(await valueOf(page, 'floor')).toBe('floor_11');
    await enter(floor);
    await floor.pressSequentially('Floor 99');
    await page.keyboard.press('Tab');
    expect(await valueOf(page, 'floor')).toBe('floor_11');
    await expect(hintOf(page, 'q-floor')).toBeVisible();
    await screen(page, 'input-dates-choice-ar', { viewport: true });
  });

  test('a path: Tab takes the match typing reached; a path written with / is found', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=wi-picker&skin=underline'));
    const iteration = boxOf(page, 'f-iteration');
    await enter(iteration);
    await iteration.press('Delete');
    await iteration.pressSequentially('Sprint 13');
    await expect(node(page, 'f-iteration').locator('[role=treeitem]').first()).toBeVisible();
    await page.keyboard.press('Tab');
    await expect.poll(async () => ((await valueOf(page, 'iteration')) as { label: string }).label).toContain('Sprint 13');
    await enter(iteration);
    await iteration.press('Delete');
    await iteration.pressSequentially('Portal / Sprint 12');
    await expect(node(page, 'f-iteration').locator('[role=treeitem]')).toHaveCount(1);
  });

  test('a path: words naming one exactly, left by a click once their list came, take it, and nothing false is said', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=wi-picker&skin=underline'));
    const iteration = boxOf(page, 'f-iteration');
    for (const [typed, label] of [
      ['Portal\\Sprint 13', 'Sprint 13'],
      ['Sprint 12', 'Sprint 12'],
      ['portal / sprint 13', 'Sprint 13'],
    ] as const) {
      await enter(iteration);
      await iteration.press('Delete');
      await iteration.pressSequentially(typed);
      await expect(node(page, 'f-iteration').locator('[role=treeitem]')).toHaveCount(1);
      // A click elsewhere on the page: on the field's own label's line, outside the box.
      await page.locator('body').click({ position: { x: 2, y: 2 } });
      await expect.poll(async () => ((await valueOf(page, 'iteration')) as { label: string }).label).toBe(label);
      await expect(iteration).toHaveValue(`Portal\\${label}`);
      await expect(hintOf(page, 'f-iteration')).toBeHidden();
    }
    // Words naming nothing: what it held comes back, and it says so.
    await enter(iteration);
    await iteration.press('Delete');
    await iteration.pressSequentially('Sprint 99');
    await page.locator('body').click({ position: { x: 2, y: 2 } });
    await expect(iteration).toHaveValue('Portal\\Sprint 13');
    await expect(hintOf(page, 'f-iteration')).toContainText('nothing is called “⁨Sprint 99⁩”');
  });

  test('ar: stars and a scale move with the screen right to left; a full Top 3 says why it ranks no more', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=kinds&skin=outlined&locale=ar&dir=rtl'));
    await setValue(page, 'recommend', 3);
    const recommend = node(page, 'q-recommend').locator('[role=radio][aria-checked=true]');
    await recommend.focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    expect(await valueOf(page, 'recommend')).toBe(5);
    const picks = node(page, 'q-miss').locator('.fd-rank-pick');
    for (let i = 0; i < 3; i++) await picks.locator('visible=true').first().click();
    await picks.locator('visible=true').first().click();
    await expect(node(page, 'q-miss').locator('.fd-choice-limit')).not.toHaveText(/^$/);
    expect(((await valueOf(page, 'miss')) as unknown[]).length).toBe(3);
  });
});

test.describe('a date in a table’s cell', () => {
  let problems: string[] = [];
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  });
  test.afterEach(() => expect(problems).toEqual([]));

  test('ar: a milestone’s due date reads Arabic and Persian digits and a paste; Feb 30 keeps the day it had, said at Save', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=fields&skin=outlined&locale=ar&dir=rtl'));
    const due = node(page, 'f-milestones').locator('input.fd-date').first();
    const dues = () => page.evaluate(() => ((window as any).fieldiaDemo.handle.form.getState().values.milestone_ids as { values: { due: string } }[]).map((l) => l.values.due));
    const [first] = await dues();
    await enter(due);
    await due.pressSequentially(arabic('31/12/2026'));
    await page.keyboard.press('Tab');
    expect((await dues())[0]).toBe('2026-12-31');
    await enter(due);
    await due.pressSequentially(persian('01/12/2026'));
    await page.keyboard.press('Tab');
    expect((await dues())[0]).toBe('2026-12-01');
    await enter(due);
    await paste(page, due, '2026-11-03');
    await page.keyboard.press('Tab');
    expect((await dues())[0]).toBe('2026-11-03');
    await enter(due);
    await due.pressSequentially('30/02/2026');
    await page.keyboard.press('Tab');
    expect((await dues())[0]).toBe('2026-11-03');
    await expect(due).toHaveValue('30/02/2026');
    expect(Object.values(await unread(page)).map((u) => u.message)).toContain('Due: في فبراير 2026 28 يومًا');
    expect(await page.evaluate(() => (window as any).fieldiaDemo.handle.form.validate())).toBe(false);
    void first;
  });

  test('the order’s delivery grid: a date typed in a cell, Arabic digits too, and an impossible one keeps the day', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=order&skin=underline'));
    await page.getByRole('tab', { name: 'Other information' }).click();
    const deliveries = () => page.evaluate(() => ((window as any).fieldiaDemo.handle.form.getState().values.delivery_ids as { values: { date: string } }[]).map((l) => l.values.date));
    const cell = node(page, 'f-deliveries').locator('.ag-row[row-index="0"] .ag-cell[col-id="date"]');
    // A click opens the whole line, the date's own box in its cell.
    await cell.click();
    const editor = cell.locator('input.fd-date');
    await expect(editor).toBeFocused();
    await editor.press('Control+A');
    await editor.pressSequentially(arabic('15/11/2026'));
    await editor.press('Enter');
    await expect.poll(async () => (await deliveries())[0]).toBe('2026-11-15');
    await cell.click();
    await expect(editor).toBeFocused();
    await editor.press('Control+A');
    await editor.pressSequentially('30/02/2026');
    await editor.press('Enter');
    expect((await deliveries())[0]).toBe('2026-11-15');
    expect(Object.values(await unread(page)).map((u) => u.message)).toContain('Date: February 2026 has 28 days');
    expect(await page.evaluate(() => (window as any).fieldiaDemo.handle.form.validate())).toBe(false);
  });
});

test.describe('the designer’s dates', () => {
  // The page's fields as the designer holds them, by label.
  const fieldOf = (page: Page, label: string) =>
    page.evaluate((l) => Object.values((window as any).fieldiaDesigner.designer.getPage().fields as Record<string, any>).find((f) => f.label === l), label);
  const nodeOptions = (page: Page, label: string) =>
    page.evaluate((l) => {
      const designer = (window as any).fieldiaDesigner.designer;
      const page = designer.getPage();
      const name = Object.keys(page.fields).find((n) => page.fields[n].label === l);
      const found: any[] = [];
      const walk = (n: any) => {
        if (n?.field === name) found.push(n);
        for (const child of n?.children ?? []) walk(child);
      };
      walk(page.layout);
      return found[0]?.options;
    }, label);
  const hintAfter = (box: Locator) => box.locator('xpath=following-sibling::*[contains(@class,"fd-refusal-hint")][1]');

  for (const [locale, query, digits, words] of [
    ['en', '', (t: string) => t, { earliest: 'Earliest', aDay: 'day', day: 'Earliest day', time: 'Earliest time', rules: 'Rules', setWhen: 'Set when…', setTo: 'Set to', as: 'Set', shape: 'dd/mm/yyyy', rest: '2 Mar 2026', stays: 'Earliest day: February 2026 has 28 days. It stays 2 Mar 2026.', due: '15 Oct 2026' }],
    ['ar', '&locale=ar&dir=rtl', arabic, { earliest: 'الأقرب', aDay: 'day', day: 'أقرب يوم', time: 'أبكر وقت', rules: 'القواعد', setWhen: 'يُضبط عندما…', setTo: 'يُضبط على', as: 'يُضبط', shape: 'يوم/شهر/سنة', rest: '2 مارس 2026', stays: 'أقرب يوم: في فبراير 2026 28 يومًا. تبقى القيمة 2 مارس 2026.', due: '15 أكتوبر 2026' }],
    ['fr', '&locale=fr', (t: string) => t, { earliest: 'Earliest', aDay: 'day', day: 'Earliest day', time: 'Earliest time', rules: 'Rules', setWhen: 'Set when…', setTo: 'Set to', as: 'Set', shape: 'dd/mm/yyyy', rest: '2 Mar 2026', stays: 'Earliest day: February 2026 has 28 days. It stays 2 Mar 2026.', due: '15 Oct 2026' }],
  ] as const) {
    test(`${locale}: a day typed day first in Fieldia’s own box, never the browser’s: a limit, a time, a value set when; 31/02 kept out, said`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await inAdvanced(page);
      const problems = watch(page);
      await page.goto(`/screen/?start=blank${query}`);
      await expect(page.locator('.fd-toolbox')).toBeVisible();
      await addField(page, 'number', 'Quantity');
      await addField(page, 'date', 'Visit day');
      const setting = (name: string) => editing(page).card.getByLabel(name, { exact: true });
      await setting(words.earliest).selectOption(words.aDay);
      const day = setting(words.day);
      await expect(day).toHaveAttribute('type', 'text');
      await expect(day).toHaveAttribute('placeholder', words.shape);
      await day.click();
      await day.pressSequentially(digits('2/3/2026'));
      await day.press('Tab');
      await expect.poll(async () => (await fieldOf(page, 'Visit day'))?.min).toBe('2026-03-02');
      await expect(day).toHaveValue(words.rest);
      // A letter never lands, and why is said under the box.
      await day.click();
      await day.press('ControlOrMeta+a');
      await day.pressSequentially('3x');
      await expect(day).toHaveValue('3');
      await expect(hintAfter(day)).toBeVisible();
      await day.press('Backspace');
      await day.press('Backspace');
      // A day that does not exist: the limit stays, the box shows it again, and says why, in view.
      await day.pressSequentially(digits('31/02/2026'));
      await day.press('Tab');
      await expect(hintAfter(day)).toHaveText(words.stays);
      await expect(hintAfter(day)).toBeInViewport();
      await expect(day).toHaveValue(words.rest);
      expect((await fieldOf(page, 'Visit day'))?.min).toBe('2026-03-02');
      await screen(page, `input-dates-designer-day-${locale}`, { viewport: true });

      // A time's earliest, with am or pm.
      await addField(page, 'time', 'Arrival');
      const time = setting(words.time);
      await expect(time).toHaveAttribute('type', 'text');
      await time.click();
      await time.pressSequentially(digits('9:30') + ' am');
      await time.press('Tab');
      await expect.poll(async () => (await nodeOptions(page, 'Arrival'))?.min).toBe('09:30');

      // A value the date is set to when Quantity changes.
      await page.locator('.fd-canvas-field', { hasText: 'Visit day' }).first().click();
      const panel = page.locator('.fd-properties');
      await panel.getByRole('tab', { name: words.rules, exact: true }).click();
      await panel.getByRole('button', { name: words.setWhen, exact: true }).click();
      const to = panel.getByRole('textbox', { name: words.setTo, exact: true });
      await expect(to).toHaveAttribute('type', 'text');
      const as = panel.getByRole('combobox', { name: words.as, exact: true });
      await as.selectOption((await as.locator('option', { hasText: 'Quantity' }).getAttribute('value')) as string);
      await to.click();
      await to.pressSequentially(digits('15/10/2026'));
      await to.press('Tab');
      await expect.poll(async () => (await fieldOf(page, 'Visit day'))?.setWhen?.[0]?.value).toBe("'2026-10-15'");
      await expect(to).toHaveValue(words.due);
      expect(problems).toEqual([]);
    });
  }
});
