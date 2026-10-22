import { labelsOf, matchFields, readField, type FieldReading, type FieldRef } from './read';

/**
 * Fieldia's forms tested as people use them, in any DOM a test runs in — jsdom or happy-dom under Jest or Vitest with
 * Testing Library, or a browser: a field found by its label's words, typed in, picked, ticked and left; a button
 * pressed by its words; a field's messages and what its box shows read back. No dependency: each step sends the events
 * a person's would (focus, `beforeinput`, `input`, `change`, leaving), and a box that refuses a key (a letter in a
 * number) refuses it here too.
 *
 *   const form = fieldia(container);
 *   await form.fill('Email', 'mona@example.com');
 *   await form.pick('Country', 'Egypt');
 *   await form.press('Save');
 *   expect(form.errorsOf('Phone')).toEqual(['Enter a phone number']);
 *   expect(form.valueOf('Email')).toBe('mona@example.com');
 *
 * With Testing Library's user-event, hand it the box: `await user.type(form.box('Email'), 'mona@example.com')`.
 */

export type { FieldReading, FieldRef } from './read';

export interface FieldiaOptions {
  /**
   * What waits for the form between steps — its answers, its redraws: a turn of the event loop by default. Under fake
   * timers, give one that moves them on: `() => jest.advanceTimersByTimeAsync(0)`.
   */
  settle?: () => Promise<unknown>;
  /** How long `pick` waits for a list's option to show (a list that asks the app for its choices): 2000 ms by default. */
  timeout?: number;
}

export interface FieldiaForm {
  /** A field's element (`.fd-field`) by its label's words, or `{ field: 'email' }` by its field's name. Throws, naming the fields there are, when none or several match. */
  field(ref: FieldRef): HTMLElement;
  /** The box a person types in or picks with: its input, text area, list, editable text or group. */
  box(ref: FieldRef): HTMLElement;
  /** Type `text` into a field's box in place of what it held, and leave it — as a person does, a key at a time. */
  fill(ref: FieldRef, text: string): Promise<void>;
  /** Choose by their words: a list's option, a radio, the boxes ticked among several (exactly these), a link's record. */
  pick(ref: FieldRef, ...options: string[]): Promise<void>;
  /** Tick (or, with `false`, untick) a yes-or-no field's box or switch. */
  check(ref: FieldRef, on?: boolean): Promise<void>;
  /** Press a button by its words or its name for a screen reader: Save, Submit, Add a line. */
  press(name: string): Promise<void>;
  /** The problems a field says, each in its words; none, an empty list. */
  errorsOf(ref: FieldRef): string[];
  /** A field's warnings (an answer rule's, the app's). */
  warningsOf(ref: FieldRef): string[];
  /** What a field's box shows: see `FieldReading.value`. */
  valueOf(ref: FieldRef): FieldReading['value'];
  /** Everything a field shows at once: its label, value, errors and warnings. */
  read(ref: FieldRef): FieldReading;
  /** The words of every field's label shown, in order. */
  labels(): string[];
}

const TEXT_BOX = 'input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"]';
const named = (ref: FieldRef) => (typeof ref === 'string' ? `“${ref}”` : `{ field: '${ref.field}' }`);
const words = (element: Element | null | undefined) => (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** The forms drawn in `root` (the element the viewer was mounted in, or the whole document), as a person meets them. */
export function fieldia(root: ParentNode = document, options: FieldiaOptions = {}): FieldiaForm {
  const settle = options.settle ?? (() => new Promise((resolve) => setTimeout(resolve, 0)));
  const doc = (root as Node).ownerDocument ?? (root as Document);
  const fields = () => Array.from(root.querySelectorAll<HTMLElement>('.fd-field'));

  function field(ref: FieldRef): HTMLElement {
    const all = fields();
    const found = matchFields(all, ref);
    if (found.length === 1) return all[found[0]];
    if (!found.length) throw new Error(`No field ${typeof ref === 'string' ? 'labelled' : 'named'} ${named(ref)}. The fields shown: ${labelsOf(all).join(', ') || 'none'}.`);
    throw new Error(`${found.length} fields are labelled ${named(ref)}: name one by its field, { field: '${all[found[0]].getAttribute('data-field')}' }.`);
  }

  function box(ref: FieldRef): HTMLElement {
    const at = field(ref);
    const own = (selector: string) => Array.from(at.querySelectorAll<HTMLElement>(selector)).find((element) => element.closest('.fd-field') === at && !element.closest('[hidden]'));
    const found = own(TEXT_BOX) ?? own('select') ?? own('[role="combobox"], [role="radiogroup"], [role="group"], [role="listbox"]') ?? own('input, button');
    if (!found) throw new Error(`The field ${named(ref)} shows no box to type in or pick with.`);
    return found;
  }

  /** The value a box holds, set as the browser's own typing would set it — a framework's input sees it. */
  const setValue = (input: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    const own = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value');
    if (own?.set) own.set.call(input, value);
    else input.value = value;
  };
  const caret = (input: HTMLInputElement | HTMLTextAreaElement): [number, number] => {
    try {
      return [input.selectionStart ?? input.value.length, input.selectionEnd ?? input.value.length];
    } catch {
      return [input.value.length, input.value.length];
    }
  };
  const putCaret = (input: HTMLInputElement | HTMLTextAreaElement, at: number) => {
    try {
      input.setSelectionRange(at, at);
    } catch {
      // A box with no caret to place (a number's, an email's in some DOMs).
    }
  };
  /** One edit, as a key or a deletion sends it: `beforeinput` (which a box may refuse), the change, `input`. */
  function edit(input: HTMLInputElement | HTMLTextAreaElement, inputType: string, data: string | null, next: () => [string, number]) {
    const asked = new InputEvent('beforeinput', { inputType, data, bubbles: true, cancelable: true, composed: true });
    if (!input.dispatchEvent(asked)) return;
    const [value, at] = next();
    setValue(input, value);
    putCaret(input, at);
    input.dispatchEvent(new InputEvent('input', { inputType, data, bubbles: true, composed: true }));
  }
  function leave(element: HTMLElement) {
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.blur();
    // A DOM that blurs without saying so (focusout) is told, as a browser would.
    if (doc.activeElement === element) element.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  }

  async function fill(ref: FieldRef, text: string): Promise<void> {
    const target = box(ref);
    target.focus();
    if (target.isContentEditable) {
      target.textContent = text;
      target.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: text, bubbles: true }));
      leave(target);
      await settle();
      return;
    }
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) throw new Error(`The field ${named(ref)} takes no typing: pick from it (pick) or tick it (check).`);
    // What it held taken away, as a select-all and a delete would.
    if (target.value) edit(target, 'deleteContentBackward', null, () => ['', 0]);
    for (const key of Array.from(text)) {
      edit(target, 'insertText', key, () => {
        const [start, end] = caret(target);
        return [target.value.slice(0, start) + key + target.value.slice(end), start + key.length];
      });
    }
    leave(target);
    await settle();
  }

  /** A press as a mouse makes it: down, up, click. */
  function click(element: HTMLElement) {
    const at = { bubbles: true, cancelable: true, composed: true, button: 0 };
    const Pointer = (doc.defaultView as (Window & typeof globalThis) | null)?.PointerEvent;
    if (Pointer) element.dispatchEvent(new Pointer('pointerdown', { ...at, pointerType: 'mouse', isPrimary: true }));
    element.dispatchEvent(new MouseEvent('mousedown', at));
    if (Pointer) element.dispatchEvent(new Pointer('pointerup', { ...at, pointerType: 'mouse', isPrimary: true }));
    element.dispatchEvent(new MouseEvent('mouseup', at));
    element.click();
  }

  /** What names a box among several: its label's words, else its own. */
  const nameOf = (input: HTMLInputElement) => words(input.labels?.[0]) || input.getAttribute('aria-label') || words(input.closest('label')) || words(input.parentElement);

  async function pick(ref: FieldRef, ...options: string[]): Promise<void> {
    const at = field(ref);
    const own = <T extends Element>(selector: string) => Array.from(at.querySelectorAll<T>(selector)).filter((element) => element.closest('.fd-field') === at && !element.closest('[hidden]'));
    const select = own<HTMLSelectElement>('select')[0];
    if (select) {
      const wanted = Array.from(select.options).filter((option) => options.includes(words(option)));
      if (wanted.length !== options.length) throw new Error(`${named(ref)} offers ${Array.from(select.options).map(words).filter(Boolean).join(', ')}, not ${options.join(', ')}.`);
      select.focus();
      for (const option of Array.from(select.options)) option.selected = wanted.includes(option);
      select.dispatchEvent(new Event('input', { bubbles: true }));
      leave(select);
      await settle();
      return;
    }
    const radios = own<HTMLInputElement>('input[type="radio"]');
    const ticks = own<HTMLInputElement>('input[type="checkbox"]');
    if (radios.length || ticks.length > 1) {
      const boxes = radios.length ? radios : ticks;
      const missing = options.filter((option) => !boxes.some((one) => nameOf(one) === option));
      if (missing.length) throw new Error(`${named(ref)} offers ${boxes.map(nameOf).join(', ')}, not ${missing.join(', ')}.`);
      for (const one of boxes) if (one.checked !== options.includes(nameOf(one)) && (radios.length === 0 || !one.checked)) click(one);
      await settle();
      return;
    }
    // A list of Fieldia's own, a search or a link: the words typed, and the option of those words pressed once it shows.
    for (const option of options) {
      await fill(ref, option).catch(() => click(box(ref)));
      const target = box(ref);
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) target.focus();
      const found = await waitFor(() => Array.from(doc.querySelectorAll<HTMLElement>('[role="option"]')).find((one) => !one.closest('[hidden]') && (words(one) === option || words(one).startsWith(`${option} `))));
      if (!found) throw new Error(`${named(ref)} showed no option “${option}” within ${timeout} ms.`);
      click(found);
      await settle();
    }
  }
  const timeout = options.timeout ?? 2000;
  async function waitFor<T>(find: () => T | undefined): Promise<T | undefined> {
    const until = Date.now() + timeout;
    for (;;) {
      const found = find();
      if (found || Date.now() > until) return found;
      await settle();
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  async function check(ref: FieldRef, on = true): Promise<void> {
    const at = field(ref);
    const tick = Array.from(at.querySelectorAll<HTMLElement>('input[type="checkbox"], [role="switch"], [role="checkbox"]')).find((element) => element.closest('.fd-field') === at);
    if (!tick) throw new Error(`The field ${named(ref)} has no box to tick.`);
    const ticked = tick instanceof HTMLInputElement ? tick.checked : tick.getAttribute('aria-checked') === 'true';
    if (ticked !== on) click(tick);
    await settle();
  }

  async function press(name: string): Promise<void> {
    const wanted = name.replace(/\s+/g, ' ').trim();
    const buttons = Array.from(root.querySelectorAll<HTMLElement>('button, [role="button"], input[type="submit"], input[type="button"]')).filter((button) => !button.closest('[hidden]') && !(button as HTMLButtonElement).disabled);
    const nameOfButton = (button: HTMLElement) => (button.getAttribute('aria-label') ?? (button instanceof HTMLInputElement ? button.value : words(button))).replace(/\s+/g, ' ').trim();
    const found = buttons.find((button) => nameOfButton(button) === wanted);
    if (!found) throw new Error(`No button “${name}”. The buttons shown: ${buttons.map(nameOfButton).filter(Boolean).join(', ') || 'none'}.`);
    click(found);
    await settle();
  }

  const read = (ref: FieldRef) => readField(field(ref));
  return {
    field,
    box,
    fill,
    pick,
    check,
    press,
    read,
    errorsOf: (ref) => read(ref).errors,
    warningsOf: (ref) => read(ref).warnings,
    valueOf: (ref) => read(ref).value,
    labels: () => labelsOf(fields()),
  };
}
