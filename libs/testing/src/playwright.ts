import type { Locator, Page } from '@playwright/test';
import { labelsOf, matchFields, readField, type FieldReading, type FieldRef } from './lib/read';

/**
 * Fieldia's forms in Playwright, as people use them: `@fieldia/testing/playwright`. A field found by its label's
 * words (or `{ field: 'email' }` by its name), typed in and left, picked, ticked; a button pressed by its words; a
 * field's messages and what its box shows read back. Each step is Playwright's own (`fill`, `check`, `selectOption`,
 * `click`), so it waits as Playwright waits; a read is the moment's — wrap it in `expect.poll`, or assert on `error()`.
 *
 *   import { fieldia } from '@fieldia/testing/playwright';
 *   const form = fieldia(page);
 *   await form.fill('Email', 'mona@example.com');
 *   await form.press('Save');
 *   await expect(await form.error('Phone')).toHaveText('Enter a phone number');
 *   await expect.poll(() => form.valueOf('Email')).toBe('mona@example.com');
 *
 * `@playwright/test` is an optional peer of the package: these take its types only.
 */

export type { FieldReading, FieldRef } from './lib/read';

export interface FieldiaForm {
  /** A field's element (`.fd-field`), found as it is now and followed by its place in the page. */
  field(ref: FieldRef): Promise<Locator>;
  /** The box a person types in or picks with. */
  box(ref: FieldRef): Promise<Locator>;
  /** A field's problem, for `expect(…).toHaveText()` and `toBeHidden()`. */
  error(ref: FieldRef): Promise<Locator>;
  /** Type `text` into a field's box in place of what it held, and leave it. */
  fill(ref: FieldRef, text: string): Promise<void>;
  /** Choose by their words: a list's option, a radio, the boxes ticked among several (exactly these), a link's record. */
  pick(ref: FieldRef, ...options: string[]): Promise<void>;
  /** Tick (or, with `false`, untick) a yes-or-no field's box or switch. */
  check(ref: FieldRef, on?: boolean): Promise<void>;
  /** Press a button by its words or its name for a screen reader: Save, Submit, Add a line. */
  press(name: string): Promise<void>;
  errorsOf(ref: FieldRef): Promise<string[]>;
  warningsOf(ref: FieldRef): Promise<string[]>;
  valueOf(ref: FieldRef): Promise<FieldReading['value']>;
  read(ref: FieldRef): Promise<FieldReading>;
  labels(): Promise<string[]>;
}

const TEXT_BOX = 'input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"]';
const named = (ref: FieldRef) => (typeof ref === 'string' ? `“${ref}”` : `{ field: '${ref.field}' }`);
const isPage = (scope: Page | Locator): scope is Page => typeof (scope as Page).goto === 'function';
/** A CSS string, quoted. */
const quoted = (text: string) => `"${text.replace(/["\\]/g, '\\$&')}"`;

/** The forms on a page, or in a part of it (a dialog's locator), as a person meets them. */
export function fieldia(scope: Page | Locator): FieldiaForm {
  const page = isPage(scope) ? scope : scope.page();
  const root = isPage(scope) ? scope.locator(':root') : scope;
  const all = () => root.locator('.fd-field');

  async function field(ref: FieldRef): Promise<Locator> {
    const found = await all().evaluateAll(matchFields, ref);
    if (found.length !== 1) {
      const there = await all().evaluateAll(labelsOf);
      throw new Error(found.length ? `${found.length} fields are labelled ${named(ref)}: name one by its field, { field: '…' }.` : `No field ${typeof ref === 'string' ? 'labelled' : 'named'} ${named(ref)}. The fields shown: ${there.join(', ') || 'none'}.`);
    }
    // Followed by where it stands in the page — its node and its path — so a redraw does not lose it.
    const one = all().nth(found[0]);
    const [node, path] = await Promise.all([one.getAttribute('data-node'), one.getAttribute('data-path')]);
    return node && path ? root.locator(`.fd-field[data-node=${quoted(node)}][data-path=${quoted(path)}]`).first() : one;
  }
  /** Its parts shown, its own first (a field inside it, a line's, comes after them in the page). */
  const own = (at: Locator, selector: string) => at.locator(selector).filter({ visible: true });

  async function box(ref: FieldRef): Promise<Locator> {
    const at = await field(ref);
    for (const selector of [TEXT_BOX, 'select', '[role="combobox"], [role="radiogroup"], [role="group"], [role="listbox"]', 'input, button']) {
      const found = own(at, selector).first();
      if (await found.count()) return found;
    }
    throw new Error(`The field ${named(ref)} shows no box to type in or pick with.`);
  }

  async function fill(ref: FieldRef, text: string): Promise<void> {
    const target = await box(ref);
    await target.fill(text);
    await target.blur();
  }

  async function pick(ref: FieldRef, ...options: string[]): Promise<void> {
    const at = await field(ref);
    const select = own(at, 'select').first();
    if (await select.count()) {
      await select.selectOption(options.map((label) => ({ label })));
      await select.blur();
      return;
    }
    const radios = at.getByRole('radio');
    if (await radios.count()) {
      await radios.filter({ visible: true }).and(at.getByRole('radio', { name: options[0], exact: true })).first().check();
      return;
    }
    const ticks = at.getByRole('checkbox');
    if ((await ticks.count()) > 1) {
      for (const tick of await ticks.all()) {
        const name = ((await tick.getAttribute('aria-label')) ?? (await tick.evaluate((input: HTMLInputElement) => (input.labels?.[0]?.textContent ?? input.closest('label')?.textContent ?? input.parentElement?.textContent ?? '').replace(/\s+/g, ' ').trim()))).trim();
        await tick.setChecked(options.includes(name));
      }
      return;
    }
    // A list of Fieldia's own, a search or a link: the words typed, and the option of those words pressed once it shows.
    for (const option of options) {
      const target = await box(ref);
      if (await target.evaluate((element) => element.matches('input, textarea'))) await target.fill(option);
      else await target.click();
      await page.getByRole('option', { name: option }).filter({ visible: true }).first().click();
    }
  }

  async function check(ref: FieldRef, on = true): Promise<void> {
    const at = await field(ref);
    await at.getByRole('checkbox').or(at.getByRole('switch')).first().setChecked(on);
  }

  async function press(name: string): Promise<void> {
    await root.getByRole('button', { name, exact: true }).filter({ visible: true }).first().click();
  }

  const read = async (ref: FieldRef) => (await field(ref)).evaluate(readField);
  return {
    field,
    box,
    error: async (ref) => (await field(ref)).locator(':scope > .fd-error'),
    fill,
    pick,
    check,
    press,
    read,
    errorsOf: async (ref) => (await read(ref)).errors,
    warningsOf: async (ref) => (await read(ref)).warnings,
    valueOf: async (ref) => (await read(ref)).value,
    labels: () => all().evaluateAll(labelsOf),
  };
}
