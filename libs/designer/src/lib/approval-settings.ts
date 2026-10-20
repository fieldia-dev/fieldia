import type { Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { setting } from './panel-controls';

/**
 * Approvals on a record's screen (`approval`), on the screen's panel (panel-page.ts) beside its possible duplicates:
 * whether its records wait for approval — who is asked, and in what order, is the app's data source's to say — whether
 * a record is locked while it waits, and a tick for each field left open meanwhile, in the page's order. A form of
 * responses, or a list, has no record to approve: no rows there.
 */
export function approvalSettings(el: ElementFactory, designer: Designer): { rows: HTMLElement[]; update(page: Page): void } {
  const w = designer.words.panel;
  const check = (label: string) => el('input', { type: 'checkbox', class: 'fd-check', 'aria-label': label }) as HTMLInputElement;
  const on = check(w.approvalOn);
  on.addEventListener('change', () => designer.setApproval({ on: on.checked }));
  const lock = check(w.approvalLockOn);
  lock.addEventListener('change', () => designer.setApproval({ lock: lock.checked }));
  const open = el('div', { class: 'fd-q-required-row', role: 'group', 'aria-label': w.approvalOpen });
  const onRow = setting(el, 'rules', 'Approvals', on, { hint: w.approvalHint, words: w.approval });
  const lockRow = setting(el, 'rules', 'Locked while it waits', lock, { hint: w.approvalLockHint, words: w.approvalLock });
  const openRow = setting(el, 'rules', 'Open while it waits', open, { hint: w.approvalOpenHint, words: w.approvalOpen });
  return {
    rows: [onRow, lockRow, openRow],
    update(page) {
      onRow.hidden = page.data.kind !== 'record' || page.layout.type === 'list';
      on.checked = !!page.approval;
      lockRow.hidden = onRow.hidden || !page.approval;
      lock.checked = page.approval?.lock !== false;
      openRow.hidden = lockRow.hidden || page.approval?.lock === false;
      // A tick for each field a person types in, in the page's order: one worked out from others is never typed in.
      const fields = Object.entries(page.fields).filter(([, def]) => !def.compute && def.readonly !== true);
      const key = JSON.stringify(fields.map(([name, def]) => [name, def.label]));
      if (open.dataset['choices'] !== key) {
        open.dataset['choices'] = key;
        open.replaceChildren(
          ...fields.map(([name, def]) => {
            const tick = el('input', { type: 'checkbox', 'data-field': name }) as HTMLInputElement;
            tick.addEventListener('change', () => {
              const ticked = new Set([...open.querySelectorAll<HTMLInputElement>('input:checked')].map((box) => box.dataset['field'] as string));
              designer.setApproval({ open: Object.keys(designer.getPage().fields).filter((field) => ticked.has(field)) });
            });
            return el('label', { class: 'fd-q-required' }, tick, el('span', {}, def.label));
          })
        );
      }
      for (const tick of open.querySelectorAll<HTMLInputElement>('input')) tick.checked = !!page.approval?.open?.includes(tick.dataset['field'] as string);
    },
  };
}
