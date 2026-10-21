/**
 * Mounting over a server's first paint (`firstPaint` from `@fieldia/viewer/server`): the first paint stays in sight
 * while the live form is drawn out of sight; once that is drawn and its record in (`ready`), the live form takes its
 * place in one step — no blank between them. What a person typed, ticked or chose in the first paint meanwhile is
 * carried into the live boxes, as typed there (the form reads it as it reads any typing), and the focus and caret are
 * where they were. A host with no first paint is drawn as ever.
 */
export function overFirstPaint(host: HTMLElement, root: HTMLElement, ready: Promise<unknown>): void {
  const paint = host.querySelector<HTMLElement>(':scope > [data-fd-first-paint]');
  if (!paint) return;
  // Out of sight, but laid out: what measures itself as it is drawn measures right. Its style object, as a policy wants.
  root.style.display = 'none';
  const swap = () => {
    if (!paint.isConnected) return;
    const doc = host.ownerDocument;
    const focused = paint.contains(doc.activeElement) ? (doc.activeElement as HTMLElement) : null;
    const boxes = [...paint.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input[name], textarea[name], select[name]')];
    const carried: (() => void)[] = [];
    for (const box of boxes) {
      const wrapper = fieldAt(root, box.name);
      if (!wrapper) continue;
      if (box instanceof HTMLInputElement && (box.type === 'checkbox' || box.type === 'radio')) {
        if (box.checked === box.defaultChecked) continue;
        // Its live twin: the field's one box, else the box of the same option's words.
        const twins = [...wrapper.querySelectorAll<HTMLInputElement>(`input[type="${box.type}"]`)];
        const live = twins.length === 1 ? twins[0] : twins.find((one) => wordsBy(one) === wordsBy(box));
        if (live && live.checked !== box.checked) carried.push(() => live.click());
        continue;
      }
      if (box instanceof HTMLSelectElement) {
        const chosen = box.selectedOptions[0];
        if (!chosen || chosen.defaultSelected) continue;
        const live = wrapper.querySelector('select');
        const option = [...(live?.options ?? [])].find((one) => one.textContent?.trim() === chosen.textContent?.trim());
        if (live && option) {
          carried.push(() => {
            live.value = option.value;
            live.dispatchEvent(new Event('input', { bubbles: true }));
            live.dispatchEvent(new Event('change', { bubbles: true }));
          });
        }
        continue;
      }
      if (box.value === box.defaultValue) continue;
      const live = wrapper.querySelector<HTMLInputElement | HTMLTextAreaElement>('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea');
      if (!live) continue;
      carried.push(() => {
        live.value = box.value;
        live.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: box.value }));
      });
    }
    // The person's place: the live box of the one they were in, the caret where it was.
    const at = focused && 'name' in focused ? fieldAt(root, (focused as HTMLInputElement).name) : null;
    const target = at?.querySelector<HTMLElement>('input:not([type="hidden"]), textarea, select') ?? null;
    const caret = focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement ? [focused.selectionStart, focused.selectionEnd] : null;
    paint.remove();
    root.style.removeProperty('display');
    for (const carry of carried) carry();
    if (target) {
      target.focus();
      if (caret && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
        try {
          target.setSelectionRange(caret[0], caret[1]);
        } catch {
          // A box with no caret.
        }
      }
    }
  };
  // Once drawn and its record in — or, should either fail, at once: never a first paint left over a form that works.
  void ready.then(swap, swap);
}

/** The live form's field at a path (its own, never a saved form's inside it first). */
const fieldAt = (root: HTMLElement, path: string) => [...root.querySelectorAll<HTMLElement>('.fd-field[data-path]')].find((field) => field.getAttribute('data-path') === path) ?? null;

/** The words a box among several goes by: its label's. */
const wordsBy = (box: HTMLInputElement) => (box.labels?.[0] ?? box.closest('label'))?.textContent?.trim() ?? '';
