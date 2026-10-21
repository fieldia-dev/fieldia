import type { FormState } from '@fieldia/core';
import { setHidden, setText, type El } from './dom';
import type { ViewerLabels } from './labels';
import { installLiveStyles } from './live-styles';

/**
 * Who else has the record open (the data source's `presence`, `FormState.present`), over it: their initials — a ring
 * round whoever is changing it — and their names in words, "Also here: Mona Adel (editing)", said politely as it
 * changes. Drawn into the slot save safety keeps for it (save-safety.ts), the first time someone else is there.
 */
export function presenceStrip(context: { el: El; doc: Document; labels: ViewerLabels; fill(template: string, values: Record<string, string | number>): string; list(names: string[]): string; slot: HTMLElement }): { update(state: FormState): void } {
  const { el, labels, fill } = context;
  installLiveStyles(context.doc);
  const faces = el('span', { class: 'fd-presence-faces', 'aria-hidden': 'true' });
  const words = el('span', { class: 'fd-presence-words' });
  const presence = el('div', { class: 'fd-presence', role: 'status', hidden: '' }, faces, words);
  context.slot.append(presence);
  let key = '';
  const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => [...word][0] ?? '').join('').toUpperCase();
  return {
    update(state) {
      const people = state.present ?? [];
      const now = JSON.stringify(people);
      if (now === key) return;
      key = now;
      setHidden(presence, !people.length);
      faces.replaceChildren(...people.map((one) => el('span', { class: 'fd-presence-face', title: one.name, ...(one.editing ? { 'data-editing': '' } : {}) }, initials(one.name))));
      setText(words, people.length ? fill(labels.presentHere, { names: context.list(people.map((one) => (one.editing ? fill(labels.presentEditing, { name: one.name }) : one.name))) }) : '');
    },
  };
}
