import { createMemoryDataSource, type Locale, type Page } from '@fieldia/core';
import { memoryPreferences } from '@fieldia/widgets';
import { customers, until } from './test-list';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * A custom filter's value is read as every box reads one (FIELDIA INPUT
 * RULES, 8): a number in the page's language, Arabic and Persian digits too,
 * never by the browser's own number box; a date in the page's order. Apply with
 * a value that does not read keeps it, and says beside it what goes there.
 */

const page = {
  ...customers,
  fields: { ...customers.fields, since: { type: 'date', label: 'Since' }, code: { type: 'char', label: 'Code' }, orders: { type: 'integer', label: 'Sales' } },
} as Page;
const records = () =>
  createMemoryDataSource({
    records: {
      partner: {
        1: { name: 'Nile Traders', state: 'active', credit_limit: 250000, since: '2025-03-01', code: 'N1', orders: 12 },
        2: { name: 'Amira Clinics', state: 'draft', credit_limit: 50000, since: '2026-02-10', code: 'A2', orders: 3 },
        3: { name: 'Petra Tours', state: 'active', credit_limit: 80000.5, since: '2024-11-20', code: 'P3', orders: 7 },
      },
    },
  });

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function open(locale: Locale = 'en') {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource: records(), preferences: memoryPreferences(), locale });
  await until(() => host.querySelector('.fd-list-row'));
  (host.querySelector('.fd-search-toggle, button[aria-controls]') as HTMLButtonElement | null)?.click();
  const add = host.querySelector('.fd-search-add') as HTMLButtonElement;
  add.click();
  const form = host.querySelector('.fd-custom-filter') as HTMLElement;
  const choose = (name: string, op: string) => {
    const field = form.querySelector('select') as HTMLSelectElement;
    field.value = name;
    field.dispatchEvent(new Event('change', { bubbles: true }));
    const condition = form.querySelectorAll('select')[1] as HTMLSelectElement;
    condition.value = op;
    condition.dispatchEvent(new Event('change', { bubbles: true }));
    return form.querySelector('.fd-custom-filter-value input') as HTMLInputElement;
  };
  const apply = () => (form.querySelector('.fd-button-primary') as HTMLButtonElement).click();
  const chips = () => [...host.querySelectorAll('.fd-facet .fd-facet-text')].map((chip) => chip.textContent);
  const names = () => [...host.querySelectorAll('.fd-list-row')].map((row) => row.querySelectorAll('td')[1].textContent);
  const hint = () => form.querySelector('.fd-refusal-hint') as HTMLElement | null;
  return { host, form, choose, apply, chips, names, hint };
}
function type(box: HTMLInputElement, text: string) {
  box.focus();
  box.value = text;
  box.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
}

/** Typed a key at a time, as a keyboard does: each key judged before it lands. */
function keys(box: HTMLInputElement, text: string) {
  box.focus();
  for (const key of text) {
    const typing = new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: key });
    box.dispatchEvent(typing);
    if (typing.defaultPrevented) continue;
    const at = box.selectionStart ?? box.value.length;
    box.setRangeText(key, at, box.selectionEnd ?? at, 'end');
    box.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: key }));
  }
}

describe('a custom filter’s number, never made of what was typed by dropping a key', () => {
  for (const [locale, typed, shows, said] of [
    ['en', '1.5', '1.5', 'Sales must be a whole number'],
    ['ar', '١٫٥', '١٫', 'يجب أن يكون Sales رقمًا صحيحًا'],
    ['en', '1e5', '1', 'Sales: numbers only'],
    ['fr', '1,5', '1,5', 'Sales doit être un nombre entier'],
  ] as const) {
    it(`${locale}: "${typed}" for a whole number is never 15: Apply keeps it as typed, and says why`, async () => {
      const { choose, apply, chips, hint } = await open(locale);
      const box = choose('orders', '>');
      keys(box, typed);
      expect(box.value).toBe(shows);
      // Left for Apply with keys held, the hint stays: nothing under the pointer moves as the box is left.
      box.blur();
      if (shows !== typed) expect(hint()?.hidden).toBe(false);
      apply();
      expect(chips()).toEqual([]);
      expect(box.value).toBe(typed);
      expect(hint()?.hidden).toBe(false);
      expect(hint()?.textContent).toBe(said);
    });
  }

  it('reads 0,500, led by 0, as a half: never 500', async () => {
    const { choose, apply, chips } = await open();
    keys(choose('credit_limit', '>'), '0,500');
    apply();
    expect(chips()).toEqual(['Credit limit greater than 0.5']);
  });
});

describe('a custom filter’s number', () => {
  it('is no browser number box: a text box with a number keyboard, read in the page’s language', async () => {
    const { choose } = await open();
    const box = choose('credit_limit', '>');
    expect(box.type).toBe('text');
    expect(box.inputMode).toBe('decimal');
  });

  for (const typed of ['٦٠٠٠٠', '۶۰۰۰۰', '60,000']) {
    it(`reads "${typed}" as 60000, and its chip writes it the page’s way`, async () => {
      const { choose, apply, chips, names } = await open();
      type(choose('credit_limit', '>'), typed);
      apply();
      expect(chips()).toEqual(['Credit limit greater than 60,000']);
      await until(() => names()[0] === 'Nile Traders');
      expect(names()).toEqual(['Nile Traders', 'Petra Tours']);
    });
  }

  it('fr: reads a decimal comma and a narrow space, never ten times larger', async () => {
    const { choose, apply, chips, names } = await open('fr');
    type(choose('credit_limit', '>'), '80 000,25');
    apply();
    expect(chips()[0]?.replace(/\s/g, ' ')).toMatch(/80 000,25$/);
    await until(() => names()[0] === 'Nile Traders');
    expect(names()).toEqual(['Nile Traders', 'Petra Tours']);
  });

  it('refuses a letter as it is typed, with words under the box, said politely', async () => {
    const { choose, hint } = await open();
    const box = choose('credit_limit', '>');
    box.focus();
    const typing = new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: 'e' });
    box.dispatchEvent(typing);
    expect(typing.defaultPrevented).toBe(true);
    expect(hint()?.textContent).toBe('Credit limit: numbers only');
    expect(hint()?.getAttribute('role')).toBe('status');
  });

  for (const [locale, said] of [
    ['en', 'Enter a number'],
    ['ar', 'أدخل رقمًا'],
    ['de', 'Geben Sie eine Zahl ein'],
  ] as const) {
    it(`${locale}: Apply with what does not read keeps it, and says what goes there`, async () => {
      const { choose, apply, chips, hint } = await open(locale);
      const box = choose('credit_limit', '>');
      type(box, '-');
      apply();
      expect(chips()).toEqual([]);
      expect(box.value).toBe('-');
      expect(hint()?.hidden).toBe(false);
      expect(hint()?.textContent).toBe(said);
      expect(box.getAttribute('aria-describedby')).toContain(hint()?.id);
      expect(document.activeElement).toBe(box);
    });
  }
});

describe('a custom filter’s date', () => {
  it('is typed in the page’s order, Arabic digits too, and its chip says the day in words', async () => {
    const { choose, apply, chips, names } = await open();
    const box = choose('since', '>');
    expect(box.type).toBe('text');
    expect(box.placeholder).toBe('dd/mm/yyyy');
    type(box, '١/١/٢٠٢٥');
    apply();
    expect(chips()).toEqual(['Since greater than 1 Jan 2025']);
    await until(() => JSON.stringify(names()) === JSON.stringify(['Amira Clinics', 'Nile Traders']));
    expect(names()).toEqual(['Amira Clinics', 'Nile Traders']);
  });

  it('says why a date typed is no day, as a date box does, and keeps it', async () => {
    const { choose, apply, chips, hint } = await open();
    const box = choose('since', '>');
    type(box, '30/02/2026');
    apply();
    expect(chips()).toEqual([]);
    expect(box.value).toBe('30/02/2026');
    expect(hint()?.textContent).toBe('Since: February 2026 has 28 days');
    type(box, '1/1/0002');
    apply();
    expect(chips()).toEqual([]);
    expect(hint()?.textContent).toBe('Since: the year has 4 digits, like 2026');
  });

  it('says what a date looks like when none is typed', async () => {
    const { choose, apply, chips, hint } = await open();
    choose('since', '>');
    apply();
    expect(chips()).toEqual([]);
    expect(hint()?.textContent).toMatch(/^Enter a date, like 31\/12\/\d{4}$/);
  });
});

describe('a custom filter’s words', () => {
  it('asks for a value rather than doing nothing', async () => {
    const { choose, apply, chips, hint } = await open();
    choose('code', 'ilike');
    apply();
    expect(chips()).toEqual([]);
    expect(hint()?.textContent).toBe('Enter a value to filter by');
  });
});
