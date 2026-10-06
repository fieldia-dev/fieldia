import type { Page } from '@fieldia/core';
import { openFormPanel, type FormDialogResult, type FormPanelOptions } from '@fieldia/viewer';

/**
 * A call logged beside the page, in a side panel: the demo's bar has a button
 * that opens this small page with `openFormPanel`, saved through the demo's
 * data source. Its Customer is a link, so Create and edit… opens the
 * customer's page in a dialog over the panel. What each panel hands back is
 * said in the bar and kept in `results`, for the browser tests.
 */
export const callPage: Page = {
  fieldia: '0.1',
  id: 'call',
  title: 'Log a call',
  data: { kind: 'record', model: 'call' },
  fields: {
    name: { type: 'char', label: 'Subject', required: true },
    partner_id: { type: 'many2one', label: 'Customer', relation: 'partner' },
    date: { type: 'date', label: 'Date' },
    outcome: {
      type: 'selection',
      label: 'Outcome',
      options: [
        { value: 'interested', label: 'Interested' },
        { value: 'later', label: 'Call again later' },
        { value: 'no', label: 'Not interested' },
      ],
    },
    note: { type: 'text', label: 'Notes' },
  },
  layout: {
    type: 'sections',
    id: 'call',
    children: [
      {
        type: 'section',
        id: 'call-section',
        children: [
          { type: 'field', id: 'call-name', field: 'name', placeholder: 'Prices for the spring order' },
          { type: 'field', id: 'call-partner', field: 'partner_id' },
          { type: 'field', id: 'call-date', field: 'date' },
          { type: 'field', id: 'call-outcome', field: 'outcome', widget: 'radio' },
          { type: 'field', id: 'call-note', field: 'note' },
        ],
      },
    ],
  },
  translations: {
    ar: {
      'Log a call': 'تسجيل مكالمة',
      Subject: 'الموضوع',
      Customer: 'العميل',
      Date: 'التاريخ',
      Outcome: 'النتيجة',
      Interested: 'مهتم',
      'Call again later': 'الاتصال لاحقًا',
      'Not interested': 'غير مهتم',
      Notes: 'ملاحظات',
      'Prices for the spring order': 'أسعار طلبية الربيع',
    },
  },
};

/** The bar over the demo's page: a button that opens the call in a side panel, and what the panel handed back. */
export function panelBar(options: Omit<FormPanelOptions, 'page' | 'title'>, results: FormDialogResult[]): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'demo-bar demo-panel-bar fd-theme';
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'fd-button';
  open.textContent = 'Log a call in a side panel';
  const said = document.createElement('output');
  said.className = 'demo-panel-result';
  bar.append(open, said);
  open.addEventListener('click', async () => {
    // The panel's title in the page's language, from the page's own words.
    const title = callPage.translations?.[options.locale ?? 'en']?.['Log a call'] ?? 'Log a call';
    const result = await openFormPanel({ ...options, page: callPage, title, recordId: null });
    results.push(result);
    said.textContent = result.saved ? `Saved call ${result.recordId}: ${String(result.values['name'])}` : 'Closed without saving';
  });
  return bar;
}
