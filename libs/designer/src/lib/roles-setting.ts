import type { Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { findHeaderPart } from './header-commands';
import { setting } from './panel-controls';
import { findContainer, findNode } from './page-tree';

/** The roles a part — a field, a group, a tab, a button — is shown to, as the page has them. */
export function rolesOf(page: Page, id: string): readonly string[] {
  const part = findContainer(page, id) ?? findNode(page, id)?.node ?? findHeaderPart(page, id)?.part;
  return (part as { roles?: string[] } | null | undefined)?.roles ?? [];
}

/** Role names typed apart by commas or spaces. */
export function rolesTyped(text: string): string[] {
  return text.split(/[\s,]+/).map((role) => role.trim()).filter(Boolean);
}

/**
 * "Shown only to": the roles a part shows to, as Flectra's groups=, typed
 * apart by commas — `!` before one hides it from people holding that one.
 * Who holds which is the app's to say, as the person using the form.
 */
export function rolesSetting(el: ElementFactory, designer: Designer, id: string, options: { tabbed?: boolean } = {}): { element: HTMLElement; update(page: Page): void } {
  const w = designer.words.rulesUi;
  const box = el('input', { class: 'fd-input fd-answer-rule-code', 'aria-label': w.shownOnlyTo, placeholder: w.rolesPlaceholder, spellcheck: 'false', autocomplete: 'off' }) as HTMLInputElement;
  // Kept once it is left or Enter is pressed: a role half typed is no role.
  const keep = () => {
    const typed = rolesTyped(box.value);
    if (typed.join(',') === rolesOf(designer.getPage(), id).join(',')) return;
    if (!designer.setRoles(id, typed.length ? typed : null)) box.value = rolesOf(designer.getPage(), id).join(', ');
  };
  box.addEventListener('change', keep);
  box.addEventListener('keydown', (event) => event.key === 'Enter' && (event.preventDefault(), keep()));
  const element = setting(el, 'rules', 'Shown only to', box, { hint: w.rolesHint, words: w.shownOnlyTo });
  // A panel without tabs shows it with the rest.
  if (options.tabbed === false) element.removeAttribute('data-tab');
  return {
    element,
    update(page) {
      if (box.ownerDocument.activeElement !== box) box.value = rolesOf(page, id).join(', ');
    },
  };
}
