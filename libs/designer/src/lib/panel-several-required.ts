import type { FieldNode, Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { locate } from './layout-tree';
import { segmented, setting } from './panel-controls';

/**
 * Several fields picked: whether they are required — Yes, No, or As they
 * are, pressed when they differ — set on them all as one undo step, on the
 * Rules tab. Offered only when every part picked is a field. A field the
 * model always requires stays required, and the row says so.
 */

type Choice = 'yes' | 'no' | 'as';

export function severalRequired(el: ElementFactory, designer: Designer, ids: readonly string[]): { rows: HTMLElement[]; update(page: Page): void } {
  const page = designer.getPage();
  if (!ids.every((id) => locate(page, id)?.node.type === 'field')) return { rows: [], update: () => undefined };
  const w = designer.words.panel;
  const choice = segmented<Choice>(
    el,
    w.required,
    [
      { value: 'yes', words: w.yes },
      { value: 'no', words: w.no },
      { value: 'as', words: w.asTheyAre, title: w.eachAsNow },
    ],
    (value) => value && value !== 'as' && designer.setEach([...ids], { required: value === 'yes' })
  );
  const hint = el('p', { class: 'fd-properties-hint fd-set-hint', hidden: '' });
  const row = setting(el, 'rules', 'Required', choice.element, { hint, words: w.required });
  return {
    rows: [row],
    update(now) {
      const nodes = ids.map((id) => locate(now, id)?.node).filter((node): node is FieldNode => node?.type === 'field');
      if (nodes.length !== ids.length) return;
      const required = nodes.map((node) => now.fields[node.field]?.required === true || node.required === true);
      choice.set(required.every(Boolean) ? 'yes' : required.some(Boolean) ? 'as' : 'no');
      // The model's word stands: what it requires stays required, whatever is picked here.
      const kept = nodes.filter((node) => designer.isFromModel(node.id) && now.fields[node.field]?.required === true).map((node) => designer.words.parts.quote(node.label ?? now.fields[node.field].label));
      hint.hidden = !kept.length;
      hint.textContent = w.staysRequired(kept);
    },
  };
}
