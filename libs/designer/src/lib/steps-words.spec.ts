import type { ActionStep, Page } from '@fieldia/core';
import { blankPage } from './designer';
import { ar } from './locales/ar';
import { en } from './locales/en';
import { pageSteps, stepSentence, stepsLines } from './steps-words';

/**
 * Steps read as sentences, the same wherever they are said — the steps
 * editor, the Rules view, the marks on the canvas, the checks — fields by
 * their labels, formulas in words, a page opened by its title.
 */

const page: Page = {
  ...blankPage('screen', 'Order'),
  fields: {
    customer: { type: 'char', label: 'Customer' },
    product: { type: 'char', label: 'Product' },
    price: { type: 'float', label: 'Price' },
    quantity: { type: 'integer', label: 'Quantity' },
    state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'sent', label: 'Sent' }] },
    lines: { type: 'one2many', label: 'Lines', relation: 'order.line', fields: { item: { type: 'char', label: 'Item' } } },
  },
  layout: {
    type: 'sheet',
    id: 'sheet',
    buttons: [{ type: 'button', id: 'send', label: 'Send', steps: [{ do: 'check' }, { do: 'save' }] }],
    children: [
      { type: 'section', id: 'section-1', columns: 2, children: [{ type: 'field', id: 'f-customer', field: 'customer' }, { type: 'field', id: 'f-product', field: 'product' }, { type: 'button', id: 'new', label: 'New customer', steps: [{ do: 'open', page: 'customer', as: 'panel', into: { customer: 'name' }, then: [{ do: 'say', message: 'Customer added', tone: 'success' }] }] }] },
      { type: 'tabs', id: 'tabs', children: [{ type: 'tab', id: 'tab-lines', label: 'Lines', children: [] }] },
    ],
  },
  on: { change: { product: [{ do: 'call', action: 'check_stock' }] }, beforeSave: [{ do: 'check' }, { do: 'ask', message: 'Send the order?' }], show: { 'tab-lines': [{ do: 'reset' }] } },
};

const customer: Page = { ...blankPage('screen', 'Customer'), id: 'customer', title: 'Customer', fields: { name: { type: 'char', label: 'Name' }, phone: { type: 'char', label: 'Phone' } } };
const saved = (id: string) => (id === 'customer' ? customer : undefined);
const say = (step: ActionStep, words = en) => stepSentence(page, step, words, saved);

describe('a step in words, in English', () => {
  it('says each kind of step', () => {
    expect(say({ do: 'open', page: 'customer', as: 'panel', into: { customer: 'name' } })).toBe('Open Customer in a panel, then put its answer in Customer');
    expect(say({ do: 'open', page: 'customer' })).toBe('Open Customer in a dialog');
    expect(say({ do: 'open', page: 'invoice', as: 'page', record: 'customer', values: { name: 'customer', phone: 'product' } })).toBe('Open invoice in its place, on the record Customer, starting with name and phone');
    expect(say({ do: 'open', page: 'customer', values: { name: 'customer' }, into: { customer: 'name', product: 'phone' } })).toBe('Open Customer in a dialog, starting with Name, then put its answers in Customer and Product');
    expect(say({ do: 'set', field: 'price', value: 'quantity * 12.5', when: 'quantity > 0' })).toBe('Set Price to Quantity × 12.5 when Quantity > 0');
    expect(say({ do: 'set', field: 'state', value: "'sent'" })).toBe('Set Status to Sent');
    expect(say({ do: 'set', field: 'customer', value: "'Walk-in'" })).toBe('Set Customer to “Walk-in”');
    expect(say({ do: 'clear', field: 'customer' })).toBe('Empty Customer');
    expect(say({ do: 'addLine', field: 'lines', values: { item: 'product' } })).toBe('Add a line to Lines');
    expect(say({ do: 'check' })).toBe('Check the form');
    expect(say({ do: 'check', fields: ['customer', 'product'] })).toBe('Check Customer and Product');
    expect(say({ do: 'save' })).toBe('Save the record');
    expect(stepSentence({ ...page, data: { kind: 'responses' } }, { do: 'save' })).toBe('Send the answers');
    expect(say({ do: 'reset' })).toBe('Put the form back as it was loaded');
    expect(say({ do: 'goTo', target: 'tab-lines' })).toBe('Go to Lines');
    expect(say({ do: 'say', message: 'Customer added' })).toBe('Say: Customer added');
    expect(say({ do: 'say', message: 'Customer added', tone: 'success' })).toBe('Say as good news: Customer added');
    expect(say({ do: 'ask', message: 'Send the order?' })).toBe('Ask: Send the order?');
    expect(say({ do: 'call', action: 'check_stock' })).toBe('Run the app’s action check_stock');
    expect(say({ do: 'call', action: 'check_stock', params: { warehouse: 'main' } })).toBe('Run the app’s action check_stock, with 1 value');
    expect(say({ do: 'close' })).toBe('Close the dialog or panel it was opened in');
    expect(say({ do: 'save', when: false })).toBe('Save the record — never, for now');
    expect(say({ do: 'open', page: 'customer', as: 'panel', when: "state == 'draft'", into: { customer: 'name' } })).toBe('Open Customer in a panel when Status is Draft, then put its answer in Customer');
  });

  it('says the side a panel comes from, unless it is the end of the line', () => {
    const from = (side?: string) => say({ do: 'open', page: 'customer', as: 'panel', ...(side ? { side } : {}), into: { customer: 'name' } } as ActionStep);
    expect([from(), from('end'), from('start'), from('left'), from('right'), from('top'), from('bottom')]).toEqual([
      'Open Customer in a panel, then put its answer in Customer',
      'Open Customer in a panel, then put its answer in Customer',
      'Open Customer in a panel from the start of the line, then put its answer in Customer',
      'Open Customer in a panel from the left, then put its answer in Customer',
      'Open Customer in a panel from the right, then put its answer in Customer',
      'Open Customer in a panel from the top, then put its answer in Customer',
      'Open Customer in a panel from the bottom, then put its answer in Customer',
    ]);
    expect(say({ do: 'open', page: 'customer', as: 'panel', side: 'left', when: "state == 'draft'" })).toBe('Open Customer in a panel from the left when Status is Draft');
  });

  it('says a list a line a step, the steps once a page is saved under the step that opened it', () => {
    const steps = (page.layout as { children: { children: { id: string; steps?: ActionStep[] }[] }[] }).children[0].children[2].steps as ActionStep[];
    expect(stepsLines(page, steps, en, saved)).toEqual(['Open Customer in a panel, then put its answer in Customer', '↳ Say as good news: Customer added']);
  });
});

describe('a step in words, in Arabic', () => {
  it('says each kind of step, names quoted, the app’s names kept left to right', () => {
    expect(say({ do: 'open', page: 'customer', as: 'panel', into: { customer: 'name' } }, ar)).toBe('افتح «⁨Customer⁩» في لوحة جانبية، ثم ضع إجابتها في «⁨Customer⁩»');
    expect(say({ do: 'set', field: 'price', value: 'quantity * 12.5', when: 'quantity > 0' }, ar)).toBe('اضبط «⁨Price⁩» على Quantity × 12.5 عندما Quantity > 0');
    expect(say({ do: 'ask', message: 'هل تُرسل الطلب؟' }, ar)).toBe('اسأل: هل تُرسل الطلب؟');
    expect(say({ do: 'call', action: 'check_stock' }, ar)).toBe('شغّل إجراء التطبيق ⁦check_stock⁩');
    expect(say({ do: 'check' }, ar)).toBe('تحقّق من النموذج');
    expect(say({ do: 'say', message: 'تمت الإضافة', tone: 'success' }, ar)).toBe('قل بشرى: تمت الإضافة');
  });

  it('says the side a panel comes from: a side panel from the left or right, a panel from the top or bottom', () => {
    const from = (side?: string) => say({ do: 'open', page: 'customer', as: 'panel', ...(side ? { side } : {}) } as ActionStep, ar);
    expect([from(), from('end'), from('start'), from('left'), from('right'), from('top'), from('bottom')]).toEqual([
      'افتح «⁨Customer⁩» في لوحة جانبية',
      'افتح «⁨Customer⁩» في لوحة جانبية',
      'افتح «⁨Customer⁩» في لوحة جانبية من بداية السطر',
      'افتح «⁨Customer⁩» في لوحة جانبية من اليسار',
      'افتح «⁨Customer⁩» في لوحة جانبية من اليمين',
      'افتح «⁨Customer⁩» في لوحة من الأعلى',
      'افتح «⁨Customer⁩» في لوحة من الأسفل',
    ]);
  });
});

describe('every list of steps on the page', () => {
  it('lists the presses, the changes and the moments, each with its part and what it names', () => {
    const entries = pageSteps(page, en, saved);
    expect(entries.map((e) => [e.group, e.part, e.name, e.lines])).toEqual([
      ['clicked', 'send', 'Send', ['Check the form', 'Save the record']],
      ['clicked', 'new', 'New customer', ['Open Customer in a panel, then put its answer in Customer', '↳ Say as good news: Customer added']],
      ['changes', 'f-product', 'Product', ['Run the app’s action check_stock']],
      ['moments', null, 'Before it’s saved or sent', ['Check the form', 'Ask: Send the order?']],
      ['moments', null, 'When Lines is shown', ['Put the form back as it was loaded']],
    ]);
    expect(entries[1].reads).toEqual(['customer']);
  });

  it('leaves out a button with only an app action: that is the app’s, not a step of the form’s', () => {
    const plain: Page = { ...page, on: undefined, layout: { type: 'sections', id: 'sections', children: [{ type: 'section', id: 's', columns: 1, children: [{ type: 'button', id: 'b', label: 'Go', action: 'go' }] }] } };
    expect(pageSteps(plain)).toEqual([]);
  });
});
