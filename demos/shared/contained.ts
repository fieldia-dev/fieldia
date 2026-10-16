import type { Page, Values } from '@fieldia/core';
import type { PartFailure, WidgetFactory } from '@fieldia/widgets';
import type { SlotRenderer } from '@fieldia/viewer';

/**
 * "A part that fails": a quote whose price is drawn by the app's own price tag, which fails for four-digit prices, and
 * a slot the app fills with a delivery planner that fails as it loads. Each shows a small box in its place; the rest of
 * the form works and saves; and what the viewer's onError was told is listed under the form. Every framework's demo
 * writes the two parts as its own components (main.ts / main.tsx), from the rules here.
 */
export const containedPage: Page = {
  fieldia: '0.1',
  id: 'contained',
  title: 'A part that fails',
  description: 'The app’s own price tag fails for four-digit prices, and its delivery planner fails as it loads: each shows a small box, and the rest of the form works and saves.',
  data: { kind: 'record', model: 'quote' },
  fields: {
    customer: { type: 'char', label: 'Customer', required: true },
    price: { type: 'monetary', label: 'Price', currency: 'EGP', money: { currency: 'code', at: 'before' }, help: 'Type 1200: the app’s price tag cannot draw four-digit prices.' },
    delivery: { type: 'date', label: 'Delivery date' },
    notes: { type: 'text', label: 'Notes' },
  },
  layout: {
    type: 'sections',
    id: 'quote',
    children: [
      {
        type: 'section',
        id: 's-quote',
        title: 'Quote',
        columns: 2,
        children: [
          { type: 'field', id: 'f-customer', field: 'customer' },
          { type: 'field', id: 'f-price', field: 'price', widget: 'tag' },
          { type: 'field', id: 'f-delivery', field: 'delivery' },
        ],
      },
      { type: 'slot', id: 'n-planner', name: 'planner' },
      { type: 'field', id: 'f-notes', field: 'notes' },
    ],
  },
  translations: {
    ar: {
      'A part that fails': 'جزء يتعطّل',
      'The app’s own price tag fails for four-digit prices, and its delivery planner fails as it loads: each shows a small box, and the rest of the form works and saves.':
        'بطاقة السعر في التطبيق تتعطّل مع الأسعار المكوّنة من أربعة أرقام، ومخطِّط التسليم يتعطّل وهو يُحمَّل: يظهر مكان كلٍّ منهما مربّع صغير، ويبقى باقي النموذج يعمل ويُحفَظ.',
      Customer: 'العميل',
      Price: 'السعر',
      'Type 1200: the app’s price tag cannot draw four-digit prices.': 'اكتب 1200: لا تستطيع بطاقة السعر في التطبيق رسم سعر من أربعة أرقام.',
      'Delivery date': 'تاريخ التسليم',
      Notes: 'ملاحظات',
      Quote: 'عرض السعر',
    },
  },
};

/** The quote the demo opens. */
export const CONTAINED_RECORDS: Record<string, Record<number, Values>> = {
  quote: { 1: { customer: 'Nile Traders', price: 450, delivery: '2026-10-20', notes: 'Deliver to the back door.' } },
};

/** The price tag's bug, the same in every framework's own version of it: no four-digit price. */
export function checkPrice(value: unknown): void {
  if (typeof value === 'number' && value >= 1000) throw new Error(`The price tag cannot draw ${value}: four-digit prices are not supported yet`);
}

/** What the price tag shows beside its box. */
export const priceWords = (value: unknown) => (typeof value === 'number' ? `EGP ${value.toFixed(2)}` : '—');

/** The delivery planner's bug: it fails as it loads. */
export function loadPlanner(): never {
  throw new Error('The delivery planner could not load its calendar');
}

/** The price tag, as a plain-DOM widget: a box to type the price in, and the price as a tag. */
export const priceTag: WidgetFactory = ({ form, name, id, document: doc }) => {
  const input = doc.createElement('input');
  input.id = id;
  input.className = 'fd-input';
  input.inputMode = 'decimal';
  const tag = doc.createElement('output');
  const element = doc.createElement('span');
  element.className = 'demo-price';
  element.append(input, tag);
  input.addEventListener('input', () => form.setValue(name, input.value === '' ? null : Number(input.value)));
  return {
    element,
    focus: () => input.focus(),
    update(state) {
      checkPrice(state.value);
      const text = state.value === null || state.value === undefined ? '' : String(state.value);
      if (input.value !== text && doc.activeElement !== input) input.value = text;
      input.readOnly = state.readonly;
      tag.textContent = priceWords(state.value);
    },
  };
};

/** The delivery planner, as a plain-DOM slot: it throws before it draws anything. */
export const plannerSlot: SlotRenderer = () => loadPlanner();

/** A failing part in a reader's words: which part it was, and when it failed. */
function partWords(where: PartFailure, page: Page = containedPage): string {
  const label = where.field ? page.fields[where.field]?.label ?? where.field : null;
  const what = label ? `The ${label} field’s own widget` : where.part === 'slot' ? `The app’s ${where.name ?? 'own'} panel` : `A ${where.part}`;
  const when = { draw: 'as it was drawn', update: 'as its value changed', focus: 'as it took the focus', remove: 'as it was taken away' }[where.stage];
  return `${what} failed ${when}`;
}

/**
 * Under the form, what the viewer's onError was told — the app's own log of what broke: each failure in words (which
 * part, when, and the error's own message), with exactly what onError was handed beside it, for the developer. A
 * plain-DOM box every framework's demo puts after its form, and the `onError` to give the viewer.
 */
export function errorLog(doc: Document): { element: HTMLElement; onError: (error: unknown, where: PartFailure) => void } {
  const element = doc.createElement('section');
  element.className = 'demo-error-log';
  element.setAttribute('aria-labelledby', 'demo-error-log-title');
  const title = doc.createElement('h2');
  title.id = 'demo-error-log-title';
  title.textContent = 'What your app’s error log was told';
  const about = doc.createElement('p');
  about.className = 'demo-error-log-about';
  about.textContent = 'Each part that fails tells the app, through the viewer’s onError, so it can log it or report it. Nothing has failed yet.';
  const list = doc.createElement('ol');
  element.append(title, about, list);
  return {
    element,
    onError(error, where) {
      about.textContent = 'Each part that fails tells the app, through the viewer’s onError, so it can log it or report it. The rest of the form goes on working.';
      const item = doc.createElement('li');
      const said = doc.createElement('p');
      const words = doc.createElement('strong');
      words.textContent = `${partWords(where)}: `;
      said.append(words, error instanceof Error ? error.message : String(error));
      const handed = doc.createElement('details');
      const summary = doc.createElement('summary');
      summary.textContent = 'What onError was handed';
      const code = doc.createElement('code');
      code.textContent = JSON.stringify(where);
      handed.append(summary, code);
      item.append(said, handed);
      list.append(item);
    },
  };
}
