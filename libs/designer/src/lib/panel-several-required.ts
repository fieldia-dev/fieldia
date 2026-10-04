import type { FieldNode, Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { andList, locate } from './layout-tree';
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
  const choice = segmented<Choice>(
    el,
    'Required',
    [
      { value: 'yes', words: 'Yes' },
      { value: 'no', words: 'No' },
      { value: 'as', words: 'As they are', title: 'Each as it is now' },
    ],
    (value) => value && value !== 'as' && designer.setEach([...ids], { required: value === 'yes' })
  );
  const hint = el('p', { class: 'fd-properties-hint fd-set-hint', hidden: '' });
  const row = setting(el, 'rules', 'Required', choice.element, { hint });
  return {
    rows: [row],
    update(now) {
      const nodes = ids.map((id) => locate(now, id)?.node).filter((node): node is FieldNode => node?.type === 'field');
      if (nodes.length !== ids.length) return;
      const required = nodes.map((node) => now.fields[node.field]?.required === true || node.required === true);
      choice.set(required.every(Boolean) ? 'yes' : required.some(Boolean) ? 'as' : 'no');
      // The model's word stands: what it requires stays required, whatever is picked here.
      const kept = nodes.filter((node) => designer.isFromModel(node.id) && now.fields[node.field]?.required === true).map((node) => `“${node.label ?? now.fields[node.field].label}”`);
      hint.hidden = !kept.length;
      hint.textContent = kept.length === 1 ? `${kept[0]} stays required: the model requires it.` : `${andList(kept)} stay required: the model requires them.`;
    },
  };
}
