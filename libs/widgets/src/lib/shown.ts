import type { Form } from '@fieldia/core';

/**
 * Whether the record the form shows now is still the one shown, as it was, once an answer asked for it comes
 * (`form.recordShown`): taken as the question is asked. A form without `recordShown` (an app's own) always is.
 */
export function stillShown(form: Partial<Pick<Form, 'recordShown'>> | undefined): () => boolean {
  const shown = form?.recordShown?.();
  return shown ?? (() => true);
}

/**
 * What a part does once an answer comes — a record made from a typed name, a dialog closed, a name found — done
 * only while the record it was asked for is still the one the form shows, as it was (`stillShown`): an answer for a
 * record gone, or for values the person's Discard let go, is laid on no other. Made as the question is asked; the
 * function it gives says whether it acted.
 */
export function whileShown<A extends unknown[]>(form: Partial<Pick<Form, 'recordShown'>> | undefined, act: (...args: A) => void): (...args: A) => boolean {
  const shown = stillShown(form);
  return (...args: A) => {
    if (!shown()) return false;
    act(...args);
    return true;
  };
}
