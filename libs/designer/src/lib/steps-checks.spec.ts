import type { ButtonNode, Page } from '@fieldia/core';
import { blankPage, createDesigner, pageChanges, pageChecks } from './designer';
import { checkJson, fixJson } from './json-checks';
import { ar } from './locales/ar';

/**
 * What would trip people up in what the page's parts do reaches Checks, with
 * a fix where there is an obvious one: a step naming a field no longer on the
 * page, a field's change steps once it has gone, and — on a page written by
 * hand — the page's own check, said by part and step. And what changed in
 * them is said before publishing.
 */

function order(steps: Page['on'] = undefined, button: Partial<ButtonNode> = {}): Page {
  return {
    ...blankPage('screen', 'Order'),
    id: 'order',
    fields: { customer: { type: 'char', label: 'Customer' }, product: { type: 'char', label: 'Product' }, price: { type: 'float', label: 'Price' } },
    layout: {
      type: 'sections',
      id: 'sections',
      children: [
        {
          type: 'section',
          id: 'section-1',
          columns: 2,
          children: [
            { type: 'field', id: 'f-customer', field: 'customer' },
            { type: 'field', id: 'f-product', field: 'product' },
            { type: 'field', id: 'f-price', field: 'price' },
            { type: 'button', id: 'new', label: 'New customer', action: 'button', ...button } as ButtonNode,
          ],
        },
      ],
    },
    ...(steps ? { on: steps } : {}),
  };
}

describe('what a page’s steps would trip over, in Checks', () => {
  it('says a step names a field no longer on the page, and takes the step away', () => {
    const designer = createDesigner({ page: order() });
    designer.addStep({ press: 'new' }, { do: 'set', field: 'price', value: '12.5' });
    designer.removeNode('f-price');
    const check = designer.checks().find((c) => c.text.includes('names Price'));
    expect(check).toMatchObject({ at: 'new', severity: 'should', text: '“New customer”: “Set Price to 12.5” names Price, which is no longer on the page.', fix: { label: 'Remove the step' } });
    expect(designer.fixCheck(check!)).toBe(true);
    expect(designer.steps({ press: 'new' })).toEqual([{ do: 'call', action: 'button' }]);
    // The field kept only for the step goes with it.
    expect(designer.getPage().fields['price']).toBeUndefined();
  });

  it('offers no fix that would leave a button with nothing to do: the check picks it', () => {
    const designer = createDesigner({ page: order(undefined, { action: undefined, steps: [{ do: 'clear', field: 'price' }] }) });
    designer.removeNode('f-price');
    const check = designer.checks().find((c) => c.at === 'new');
    expect(check?.text).toBe('“New customer”: “Empty Price” names Price, which is no longer on the page.');
    expect(check?.fix).toBeUndefined();
  });

  it('says a field’s change steps never run once it has gone, and takes them away', () => {
    const designer = createDesigner({ page: order() });
    designer.addStep({ change: 'product' }, { do: 'call', action: 'check_stock' });
    designer.removeNode('f-product');
    const check = designer.checks().find((c) => c.text.startsWith('“Product”'));
    expect(check).toMatchObject({ at: null, text: '“Product” is no longer on the page, so its steps when it changes never run.', fix: { label: 'Remove the steps' } });
    expect(designer.fixCheck(check!)).toBe(true);
    expect(designer.getPage().on).toBeUndefined();
    expect(designer.getPage().fields['product']).toBeUndefined();
  });

  it('says the page’s own check of a page written by hand by part and step, once, with a fix', () => {
    const page = order({ beforeSave: [{ do: 'check' }, { do: 'clear', field: 'ghost' }] }, { action: undefined, steps: [{ do: 'check' }, { do: 'open', page: 'customer', then: [{ do: 'set', field: 'nobody', value: '1' }] }] });
    const checks = pageChecks(page);
    expect(checks.map((c) => [c.at, c.text, c.fix?.label])).toEqual([
      ['new', '“New customer”, step 2.1: no field "nobody".', 'Remove the step'],
      [null, '“Before it’s saved or sent”, step 2: no field "ghost".', 'Remove the step'],
    ]);
    // In Arabic, the place and the step, without the check's English.
    expect(pageChecks(page, { words: ar })[0].text).toBe('«⁨New customer⁩»، الخطوة 2.1: لا تطابق صيغة الصفحة.');
    // Fixed one by one, as the designer does them: the page reads again.
    const designer = createDesigner({ page });
    expect(designer.fixCheck(designer.checks()[1])).toBe(false);
  });

  it('fixes them in the JSON view’s text too', () => {
    const text = JSON.stringify(order({ change: { ghost: [{ do: 'save' }] } }), null, 2);
    const row = checkJson(text).rows.find((r) => r.fix);
    // The format's own problem, on its line, takes the fix.
    expect(row).toMatchObject({ severity: 'error', message: 'no field "ghost"', fix: { label: 'Remove the steps' } });
    const fixed = JSON.parse(fixJson(text, row!.fix!.check) as string) as Page;
    expect(fixed.on).toBeUndefined();
  });
});

describe('what changed in the steps, before publishing', () => {
  it('names each part whose steps changed', () => {
    const before = order();
    const designer = createDesigner({ page: before });
    designer.addStep({ press: 'new' }, { do: 'check' });
    designer.addStep({ moment: 'beforeSave' }, { do: 'ask', message: 'Send the order?' });
    expect(pageChanges(before, designer.getPage())).toEqual(['What “New customer” does changed', 'Before it’s saved or sent: its steps changed']);
  });
});
