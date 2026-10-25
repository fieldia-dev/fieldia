import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMemoryDataSource, decimalsWords, fill, MESSAGES, type Locale, type Page } from '@fieldia/core';
import { unreadWords, WIDGET_LABELS } from '@fieldia/widgets';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * The keys that save, with the input rules in the boxes: typed key by key as a
 * person types, in English, Arabic right to left and French. Enter in a
 * one-line box sends the form as it always did, never judged as typing; a save
 * made while a box still holds what was typed — Ctrl+Enter, the app's own
 * save — reads it first, so it never saves a value passed on the way ("1" of
 * "1.5"): what does not read is refused, with its words, under its box.
 */

const EXAMPLES = join(__dirname, '..', '..', '..', '..', 'examples', 'pages');
const page = (name: string): Page => JSON.parse(readFileSync(join(EXAMPLES, `${name}.page.json`), 'utf8'));

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

const saved = { name: 'Office fit-out', seats: 4, area: 120, margin: 0.2, time_on_site: 6, email: 'site@example.com', phone: '+20 100 123 4567' };

/** Every field's page — its phones read the world over (`phone`), or, `phones: false`, a page saying nothing of them: its phone a box that checks what is typed. */
async function mount(locale: Locale = 'en', { phones = true } = {}) {
  const dataSource = createMemoryDataSource({ records: { project: { 1: { ...saved } } } });
  const host = document.createElement('div');
  if (locale === 'ar') host.dir = 'rtl';
  document.body.append(host);
  const { phone, ...saysNothing } = page('fields');
  handle = mountViewer(host, { page: phones ? { ...saysNothing, phone } : saysNothing, dataSource, recordId: 1, locale });
  await handle.form.settled();
  return { host, form: handle.form, record: () => dataSource.records['project'][1] };
}

const at = (host: Element, node: string) => host.querySelector(`[data-node="${node}"]`) as HTMLElement;
const box = (host: Element, node: string) => at(host, node).querySelector('input.fd-number-input, input') as HTMLInputElement;
const errorOf = (host: Element, node: string) => at(host, node).querySelector('.fd-error') as HTMLElement | null;
const hintOf = (host: Element, node: string) => at(host, node).querySelector('.fd-refusal-hint:not([hidden])') as HTMLElement | null;

/** A box entered as a person enters it, its text all chosen so typing replaces it. */
function enter(input: HTMLInputElement) {
  input.focus();
  input.setSelectionRange(0, input.value.length);
}

/** Keys pressed one by one where the caret is: a beforeinput the box may refuse, then the character, then input. */
function keys(input: HTMLInputElement, text: string) {
  for (const char of [...text]) {
    const before = new InputEvent('beforeinput', { inputType: 'insertText', data: char, cancelable: true, bubbles: true });
    if (!input.dispatchEvent(before)) continue;
    const start = input.selectionStart ?? input.value.length;
    input.setRangeText(char, start, input.selectionEnd ?? start, 'end');
    input.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: char, bubbles: true }));
  }
}

/**
 * Enter as a browser says it in a one-line box: its keydown, then the beforeinput of a line break; when nothing
 * cancelled either, the form is sent (the browser's implicit submission). Whether it was sent.
 */
function pressEnter(input: HTMLInputElement) {
  if (!input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))) return false;
  if (!input.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertLineBreak', cancelable: true, bubbles: true }))) return false;
  input.form?.requestSubmit();
  return true;
}
const ctrlEnter = (input: HTMLInputElement) => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }));

/** The field's own words for a whole number, in the page's language. */
const integerWords = (locale: Locale) => fill((MESSAGES[locale] ?? MESSAGES.en).integer, { label: 'Workstations' });

describe.each(['en', 'ar', 'fr'] as const)('%s: Enter in a one-line box', (locale) => {
  it('saves from a number, an email and a box at its most, as before the input rules, with no hint', async () => {
    const { host, form, record } = await mount(locale);
    const seats = box(host, 'f-seats');
    enter(seats);
    keys(seats, '7');
    expect(pressEnter(seats)).toBe(true);
    await form.settled();
    expect(record()['seats']).toBe(7);
    expect(hintOf(host, 'f-seats')).toBeNull();
    const email = box(host, 'f-email');
    enter(email);
    keys(email, 'office@example.com');
    expect(pressEnter(email)).toBe(true);
    await form.settled();
    expect(record()['email']).toBe('office@example.com');
    expect(hintOf(host, 'f-email')).toBeNull();
    expect(form.getState().status).toBe('saved');
  });

  it('refuses to save "1.5" in a whole number, saying why under it, and keeps what was typed', async () => {
    const { host, form, record } = await mount(locale);
    const seats = box(host, 'f-seats');
    enter(seats);
    keys(seats, '1.5');
    expect(pressEnter(seats)).toBe(true);
    await form.settled();
    expect(record()['seats']).toBe(4);
    expect(seats.value).toBe('1.5');
    expect(errorOf(host, 'f-seats')?.textContent).toBe(integerWords(locale));
  });
});

describe.each(['en', 'ar', 'fr'] as const)('%s: Ctrl+Enter with a box still typed in', (locale) => {
  // Read once the language's words have come (test-parts.ts: each but English's comes in a chunk of its own).
  let words = WIDGET_LABELS.en;
  let messages = MESSAGES.en;
  beforeAll(() => {
    words = WIDGET_LABELS[locale];
    messages = MESSAGES[locale] ?? MESSAGES.en;
  });
  it.each([
    ['Workstations "1.5"', 'f-seats', 'seats', '1.5', () => integerWords(locale)],
    ['Workstations "1e5", its keys held', 'f-seats', 'seats', '1e5', () => fill(words.notANumber, { label: 'Workstations', text: '⁨1e5⁩' })],
    ['Floor area "12.34"', 'f-area', 'area', locale === 'fr' ? '12,34' : '12.34', () => decimalsWords('Floor area (m²)', 1, messages)],
    ['Margin "25.555"', 'f-margin', 'margin', locale === 'fr' ? '25,555' : '25.555', () => decimalsWords('Margin', 2, messages)],
    ['Time on site "6:305"', 'f-time-on-site', 'time_on_site', '6:305', () => unreadWords('6:305', { label: 'Time on site', locale, labels: words, duration: true }) as string],
    ['Time on site "6:3"', 'f-time-on-site', 'time_on_site', '6:3', () => fill(words.minuteDigits, { label: 'Time on site', text: '⁨6:3⁩', times: new Intl.ListFormat(locale, { type: 'disjunction' }).format(['6:03', '6:30']) })],
  ] as const)('%s is never saved as the value passed on the way: refused, with its words', async (_, node, field, typed, said) => {
    const { host, form, record } = await mount(locale);
    const input = box(host, node);
    enter(input);
    keys(input, typed);
    ctrlEnter(input);
    await form.settled();
    expect(record()[field]).toBe(saved[field as keyof typeof saved]);
    expect(input.value).toBe(typed);
    expect(errorOf(host, node)?.textContent).toBe(said());
    expect(form.getState().unread[field]?.text).toBe(typed);
  });

  it.each([
    ['read the world over', true, () => fill(words.phoneLetters, { label: 'Site phone' })],
    ['a box that checks it, on a page saying nothing of its phones', false, () => messages.phone],
  ] as const)('a phone number with a letter in it is saved as typed, never as the digits round the letter: refused (%s)', async (_, phones, said) => {
    const { host, form, record } = await mount(locale, { phones });
    const phone = box(host, 'f-phone');
    enter(phone);
    keys(phone, '01001234567 ext 12');
    ctrlEnter(phone);
    await form.settled();
    expect(record()['phone']).toBe(saved.phone);
    expect(phone.value).toBe('01001234567 ext 12');
    expect(errorOf(host, 'f-phone')?.textContent).toBe(said());
  });

  it('the app’s own save reads the box first too', async () => {
    const { host, form, record } = await mount(locale);
    const seats = box(host, 'f-seats');
    enter(seats);
    keys(seats, '1.5');
    expect(await form.save()).toBe(false);
    expect(record()['seats']).toBe(4);
    expect(form.getState().errors['seats']).toBe(integerWords(locale));
  });

  it('what reads is saved as typed', async () => {
    const { host, form, record } = await mount(locale);
    const area = box(host, 'f-area');
    enter(area);
    keys(area, locale === 'fr' ? '12,5' : '12.5');
    ctrlEnter(area);
    await form.settled();
    expect(record()['area']).toBe(12.5);
  });
});

describe.each(['en', 'ar', 'fr'] as const)('%s: autosave while a box is typed in', (locale) => {
  /** Autosave's pause, moved by hand. */
  function handClock() {
    let now = 0;
    let next = 0;
    const timers = new Map<number, { at: number; run: () => void }>();
    return {
      setTimeout: (run: () => void, ms: number) => (timers.set(++next, { at: now + ms, run }), next),
      clearTimeout: (handle: unknown) => void timers.delete(handle as number),
      advance(ms: number) {
        now += ms;
        for (const [id, timer] of [...timers].sort((a, b) => a[1].at - b[1].at))
          if (timer.at <= now) {
            timers.delete(id);
            timer.run();
          }
      },
    };
  }
  async function mountSaving() {
    const dataSource = createMemoryDataSource({ records: { project: { 1: { ...saved } } } });
    const host = document.createElement('div');
    if (locale === 'ar') host.dir = 'rtl';
    document.body.append(host);
    const clock = handClock();
    handle = mountViewer(host, { page: page('fields'), dataSource, recordId: 1, locale, autosave: { delayMs: 800 }, scheduler: clock });
    await handle.form.settled();
    return { host, form: handle.form, clock, record: () => dataSource.records['project'][1] };
  }

  it('never reads a number under the keys ("12." of "12.5"), nor says it is wrong; it saves once the box is left', async () => {
    const { host, form, clock, record } = await mountSaving();
    const area = box(host, 'f-area');
    enter(area);
    keys(area, locale === 'fr' ? '12,' : '12.');
    clock.advance(800);
    await form.settled();
    clock.advance(800);
    await form.settled();
    expect(area.value).toBe(locale === 'fr' ? '12,' : '12.');
    expect(errorOf(host, 'f-area')?.textContent ?? '').toBe('');
    expect(form.getState().unread['area']).toBeUndefined();
    expect(record()['area']).toBe(120);
    keys(area, '5');
    area.blur();
    clock.advance(800);
    await form.settled();
    expect(record()['area']).toBe(12.5);
  });

  it('never trims a word’s space under the keys: "Office " goes on to "Office Park"', async () => {
    const { host, form, clock, record } = await mountSaving();
    const name = box(host, 'f-name');
    enter(name);
    keys(name, 'Office ');
    clock.advance(800);
    await form.settled();
    keys(name, 'Park');
    expect(name.value).toBe('Office Park');
    name.blur();
    clock.advance(800);
    await form.settled();
    expect(record()['name']).toBe('Office Park');
  });
});
