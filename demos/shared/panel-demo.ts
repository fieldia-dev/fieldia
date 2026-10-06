import type { Page, PanelSide } from '@fieldia/core';
import { openFormPanel, type FormDialogResult, type FormPanelOptions } from '@fieldia/viewer';

/**
 * A call logged beside the page, in a side panel: the demo's bar has a button
 * that opens this small page with `openFormPanel`, saved through the demo's
 * data source, and beside it the edge it comes from — the end of the line
 * (the right, or the left right to left) until another is picked. Its
 * Customer is a link, so Create and edit… opens the customer's page in a
 * dialog over the panel. What each panel hands back is said in the bar and
 * kept in `results`, for the browser tests.
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

/** The edges a person may pick, as the bar says them. */
const SIDES: [PanelSide, string][] = [
  ['right', 'Right'],
  ['left', 'Left'],
  ['top', 'Top'],
  ['bottom', 'Bottom'],
];

/**
 * The bar over the demo's page: a button that opens the call in a side panel,
 * the edge it comes from — a radio group drawn as segments, the end of the
 * line picked until another is — and what the panel handed back.
 */
export function panelBar(options: Omit<FormPanelOptions, 'page' | 'title'>, results: FormDialogResult[]): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'demo-bar demo-panel-bar fd-theme';
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'fd-button';
  open.textContent = 'Log a call in a side panel';
  // "… from Right": unset, the panel comes from the end of the line, which is where the picked one starts.
  let side: PanelSide | undefined;
  const sides = document.createElement('div');
  sides.className = 'demo-sides';
  sides.setAttribute('role', 'radiogroup');
  sides.setAttribute('aria-labelledby', 'demo-sides-words');
  const words = document.createElement('span');
  words.id = 'demo-sides-words';
  words.className = 'demo-sides-words';
  words.textContent = 'from';
  sides.append(words);
  const end = options.dir === 'rtl' ? 'left' : 'right';
  for (const [value, label] of SIDES) {
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'demo-side';
    radio.value = value;
    radio.checked = value === end;
    radio.addEventListener('change', () => (side = value));
    const segment = document.createElement('label');
    segment.append(radio, label);
    sides.append(segment);
  }
  const said = document.createElement('output');
  said.className = 'demo-panel-result';
  bar.append(open, sides, said);
  open.addEventListener('click', async () => {
    // The panel's title in the page's language, from the page's own words.
    const title = callPage.translations?.[options.locale ?? 'en']?.['Log a call'] ?? 'Log a call';
    const result = await openFormPanel({ ...options, page: callPage, title, recordId: null, side });
    results.push(result);
    said.textContent = result.saved ? `Saved call ${result.recordId}: ${String(result.values['name'])}` : 'Closed without saving';
  });
  return bar;
}
