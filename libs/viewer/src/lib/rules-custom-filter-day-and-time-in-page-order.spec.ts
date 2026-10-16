import { createMemoryDataSource, type Page } from '@fieldia/core';
import { memoryPreferences } from '@fieldia/widgets';
import { customers, until } from './test-list';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * A list's custom filter on a date field, given a day and a time written the page's way — "15/10/2026 14:30", as a
 * person types it, or copies it from a list of dates and times. The input rules (§2, "Not a value: filters"): "a day
 * and time says the time it would leave out before it is taken"; CHANGELOG 0.21.0: "a date filter and the plain
 * date box say the time a day leaves out". Only an ISO instant ("2026-10-15T14:30:00Z") is said so. Written the page's
 * way, it is refused with false words: "“15/10/2026 14:30” is not a whole date yet; write it like 31/12/2026" — a
 * whole date it is, and it is written just like that. The grid's paste says the same text the right way ("the time
 * 14:30 was left out", cell-paste.ts `whyNotPasted`).
 */

const page = { ...customers, fields: { ...customers.fields, since: { type: 'date', label: 'Since' } } } as Page;
let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

it('a day and time in the page’s order, where a day goes, says the time it leaves out — never “not a whole date yet”', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const dataSource = createMemoryDataSource({ records: { partner: { 1: { name: 'Nile Traders', state: 'active', credit_limit: 1, since: '2025-03-01' } } } });
  handle = mountViewer(host, { page, dataSource, preferences: memoryPreferences(), locale: 'en' });
  await until(() => host.querySelector('.fd-list-row'));
  (host.querySelector('.fd-search-toggle, button[aria-controls]') as HTMLButtonElement | null)?.click();
  (host.querySelector('.fd-search-add') as HTMLButtonElement).click();
  const form = host.querySelector('.fd-custom-filter') as HTMLElement;
  const field = form.querySelector('select') as HTMLSelectElement;
  field.value = 'since';
  field.dispatchEvent(new Event('change', { bubbles: true }));
  const condition = form.querySelectorAll('select')[1] as HTMLSelectElement;
  condition.value = '>';
  condition.dispatchEvent(new Event('change', { bubbles: true }));
  const box = form.querySelector('.fd-custom-filter-value input') as HTMLInputElement;
  box.focus();
  box.value = '15/10/2026 14:30';
  box.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: box.value }));
  (form.querySelector('.fd-button-primary') as HTMLButtonElement).click();
  const said = (form.querySelector('.fd-refusal-hint') as HTMLElement | null)?.textContent ?? '';
  expect(said).toBe('Since takes a day only: the time 14:30 was left out');
  expect(box.value).toBe('15/10/2026');
});
