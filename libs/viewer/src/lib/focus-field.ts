/** The first box to type or choose in, where a page opened takes the focus: never one hidden, as a read-only value shown as words hides its box. */
export const FIRST_FIELD = 'input:not([type="hidden"]):not([hidden]), select:not([hidden]), textarea:not([hidden]), [contenteditable="true"]';

/** The box of the first field shown that takes the focus as the record opens (a node's `focus`), if there is one. */
export function focusField(scope: Element): HTMLElement | null {
  const wrapper = [...scope.querySelectorAll<HTMLElement>('.fd-field[data-focus]')].find((one) => !one.closest('[hidden]'));
  return wrapper?.querySelector<HTMLElement>(FIRST_FIELD) ?? null;
}
