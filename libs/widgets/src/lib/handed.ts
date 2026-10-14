import type { Form, Value } from '@fieldia/core';

/**
 * The form each field's widget is handed (contain.ts): the page's own, seen through, which notes what the widget
 * writes in its own field — the person's change made in it — so a widget that then fails on that change can put back
 * what it last showed. Kept apart, with no other imports, so what keeps something once a form (shuffle.ts, files.ts)
 * finds the page's form behind it without taking in the rest.
 */

/** What a field's widget wrote in its own field, not yet shown by it: noted by the form it is handed. */
export interface Handed {
  form: Form;
  written: { value: Value } | null;
}

/** The form handed to each field's widget, by form and field. */
const handed = new WeakMap<Form, Map<string, Handed>>();
/** The page's form behind each form handed to a widget. */
const behind = new WeakMap<object, object>();

/**
 * The form a field's widget is handed: the page's own, seen through — what it holds, read as it is now — but what
 * the widget writes in its field is noted: a person's change made in it. One for each form and field, so a widget
 * drawn again is handed the same.
 */
export function handedForm(form: Form, name: string): Handed {
  let fields = handed.get(form);
  if (!fields) handed.set(form, (fields = new Map()));
  let found = fields.get(name);
  if (!found) {
    const made: Handed = { form, written: null };
    const setValue: Form['setValue'] = (field, value, how) => {
      if (field === name) made.written = { value };
      form.setValue(field, value, how);
    };
    // Seen through as it is now: a method the app puts in later is the one called. A frozen form is copied instead.
    made.form = Object.getOwnPropertyDescriptor(form, 'setValue')?.configurable === false
      ? { ...form, setValue }
      : new Proxy(form, { get: (target, key) => (key === 'setValue' ? setValue : Reflect.get(target, key)) });
    behind.set(made.form, form);
    fields.set(name, (found = made));
  }
  return found;
}

/**
 * The page's own form behind one a widget was handed: what is kept once a form — a question's shuffled order, a
 * warning said once — is kept by this.
 */
export function formBehind<T extends object>(form: T): T {
  let found: object = form;
  while (behind.has(found)) found = behind.get(found) as object;
  return found as T;
}
