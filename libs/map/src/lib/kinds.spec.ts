import type { FieldNode, Page } from '@fieldia/core';
import { mapKinds } from './kinds';

/** Place's settings in the designer: where the address found is written, among the page's text fields. */

const page = {
  fieldia: '0.1',
  id: 'delivery',
  data: { kind: 'responses' },
  fields: { to: { type: 'json', label: 'Delivery to' }, street: { type: 'char', label: 'Street' }, notes: { type: 'text', label: 'Notes' }, count: { type: 'integer', label: 'Count' } },
  layout: { type: 'sections', id: 's', children: [] },
} as unknown as Page;

describe('Place’s settings in the designer', () => {
  it('offers the page’s text fields for the address, and keeps the one chosen on the field’s place', () => {
    const [place] = mapKinds();
    const set = jest.fn(() => true);
    const settings = place.settings({ document, set });
    document.body.replaceChildren(settings.element);
    const node: FieldNode = { type: 'field', id: 'to', field: 'to', widget: 'place' };
    settings.refresh(page, node);
    const address = [...settings.element.querySelectorAll('label')].find((l) => l.textContent?.startsWith('Address goes into'))!.querySelector('select')!;
    expect([...address.options].map((o) => [o.value, o.textContent])).toEqual([
      ['', 'Nowhere'],
      ['street', 'Street'],
      ['notes', 'Notes'],
    ]);
    expect(address.value).toBe('');
    address.value = 'street';
    address.dispatchEvent(new Event('change'));
    expect(set).toHaveBeenLastCalledWith({ addressField: 'street' });
    settings.refresh(page, { ...node, options: { addressField: 'street' } });
    expect(address.value).toBe('street');
    address.value = '';
    address.dispatchEvent(new Event('change'));
    expect(set).toHaveBeenLastCalledWith({ addressField: null });
  });

  it('is in the designer’s language', () => {
    const [place] = mapKinds({ locale: 'ar' });
    const settings = place.settings({ document, set: () => true });
    settings.refresh(page, { type: 'field', id: 'to', field: 'to', widget: 'place' });
    expect(settings.element.textContent).toContain('يُكتب العنوان في');
  });
});
