import type { Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import { settingDate } from './date-setting';
import type { Designer } from './designer';
import { settingNumber } from './number-box';
import { setting } from './panel-controls';

/**
 * When a form of responses takes answers, and how many (`limits`), and Continue later (`continueLater`), on the screen's
 * panel (panel-page.ts) beside the bot check: when it opens and closes, on the page's clock, typed in the designer's
 * own date box; the most responses and one per person, counted on the app's server; its words while it takes none,
 * once something says when or how many. Continue later on any screen people type a whole answer in.
 */
export function limitsSettings(el: ElementFactory, designer: Designer): { rows: HTMLElement[]; update(page: Page): void; destroy(): void } {
  const w = designer.words.panel;
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const limits = () => designer.getPage().limits ?? {};
  /** A day alone, as a page may write one: its end, for a close (the form takes answers through it); its start, to open. */
  const asMoment = (written: string | undefined, end: boolean) => (written && /^\d{4}-\d{2}-\d{2}$/.test(written) ? `${written}T${end ? '23:59' : '00:00'}` : written ?? null);
  const opens = settingDate(el, designer, { kind: 'datetime', label: w.limitsOpens, attrs: { class: 'fd-input', 'aria-label': w.limitsOpens }, saved: () => asMoment(limits().opens, false), commit: (value) => designer.setPageLimits({ opens: value }) });
  const closes = settingDate(el, designer, { kind: 'datetime', label: w.limitsCloses, attrs: { class: 'fd-input', 'aria-label': w.limitsCloses }, saved: () => asMoment(limits().closes, true), commit: (value) => designer.setPageLimits({ closes: value }) });
  const most = settingNumber(el, designer, {
    label: w.limitsMost,
    attrs: { class: 'fd-input', 'aria-label': w.limitsMost },
    integer: true,
    min: 1,
    optional: true,
    saved: () => limits().maxResponses ?? null,
    commit: (n) => designer.setPageLimits({ maxResponses: n }),
  });
  const one = el('input', { type: 'checkbox', class: 'fd-check', 'aria-label': w.limitsOne }) as HTMLInputElement;
  one.addEventListener('change', () => designer.setPageLimits({ onePerPerson: one.checked }));
  const message = el('textarea', { class: 'fd-input fd-insp-area', 'aria-label': w.limitsMessage, rows: '2', placeholder: w.optional });
  message.addEventListener('input', () => designer.setPageLimits({ message: message.value }));
  const later = el('input', { type: 'checkbox', class: 'fd-check', 'aria-label': w.continueLaterOn }) as HTMLInputElement;
  later.addEventListener('change', () => designer.setContinueLater(later.checked));
  const opensRow = setting(el, 'rules', 'Opens on', opens.input, { hint: w.limitsOpensHint, words: w.limitsOpens });
  const closesRow = setting(el, 'rules', 'Closes on', closes.input, { hint: w.limitsClosesHint, words: w.limitsCloses });
  const mostRow = setting(el, 'rules', 'Most responses', most.input, { hint: w.limitsMostHint, words: w.limitsMost });
  const oneRow = setting(el, 'rules', 'One response per person', one, { hint: w.limitsOneHint, words: w.limitsOne });
  const messageRow = setting(el, 'rules', 'Words while it takes none', message, { hint: w.limitsMessageHint, words: w.limitsMessage });
  const laterRow = setting(el, 'rules', 'Continue later', later, { hint: w.continueLaterHint, words: w.continueLater });
  return {
    rows: [opensRow, closesRow, mostRow, oneRow, messageRow, laterRow],
    destroy() {
      opens.destroy();
      closes.destroy();
      most.destroy();
    },
    update(page) {
      // A form of responses opens and closes; a screen of records opens and closes with its app.
      const responses = page.data.kind === 'responses';
      opensRow.hidden = closesRow.hidden = mostRow.hidden = oneRow.hidden = !responses;
      // Its words say why it takes none: once something says when or how many.
      messageRow.hidden = !responses || !page.limits;
      laterRow.hidden = page.layout.type === 'list';
      opens.refresh();
      closes.refresh();
      most.refresh();
      one.checked = page.limits?.onePerPerson === true;
      if (!focused(message)) message.value = page.limits?.message ?? '';
      later.checked = page.continueLater === true;
    },
  };
}
