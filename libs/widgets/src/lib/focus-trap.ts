/** What Tab can reach in a box. */
const FOCUSABLE = 'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/**
 * Keep Tab inside a modal dialog (WCAG 2.4.3, and what aria-modal promises):
 * past its last stop Tab goes round to the first, and Shift+Tab before the
 * first goes to the last. Call it from the dialog's keydown; it does nothing
 * for any other key.
 */
export function keepTabIn(box: HTMLElement, event: KeyboardEvent): void {
  if (event.key !== 'Tab') return;
  const all = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((e) => !e.closest('[hidden], [inert]') && !(e as HTMLButtonElement).disabled);
  if (!all.length) return;
  const first = all[0];
  const last = all[all.length - 1];
  const at = box.ownerDocument.activeElement;
  if (event.shiftKey ? at === first || !box.contains(at) : at === last) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }
}
