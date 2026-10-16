import { validatePage, type FieldNode, type SectionNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { mount, openTab } from './test-editor';

/**
 * Phone numbers the world over, as the designer sets them: the screen's own — as typed, or checked by their country,
 * with the country they start on and how they are shown — and a phone field's own country and way of showing, which
 * win over the page's. In English and in Arabic; each change one undo step.
 */

afterEach(() => document.body.replaceChildren());

const choose = (select: HTMLSelectElement, value: string) => {
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
};

describe('a page’s phone numbers in the designer', () => {
  it('are set on the screen’s Content tab: checked by their country, the country they start on and how they show', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Contact') });
    designer.select(null);
    const { host } = mount(designer, { mode: 'advanced' });
    const panel = host.querySelector('.fd-properties') as HTMLElement;
    openTab(panel, 'Content');
    const row = (name: string) => panel.querySelector(`[data-setting="${name}"]`) as HTMLElement;
    const phones = row('Phone numbers').querySelector('select') as HTMLSelectElement;
    expect([...phones.options].map((o) => o.textContent)).toEqual(['As typed', 'Checked by their country']);
    expect(phones.value).toBe('');
    // As typed: nothing more to set.
    expect(row('Phone country to start on').hidden).toBe(true);
    expect(row('Phone numbers shown').hidden).toBe(true);
    choose(phones, 'checked');
    expect(designer.getPage().phone).toEqual({});
    expect(row('Phone country to start on').hidden).toBe(false);
    const country = row('Phone country to start on').querySelector('select') as HTMLSelectElement;
    expect(country.options[0].textContent).toBe('None: written with + and the country code');
    choose(country, 'EG');
    choose(row('Phone numbers shown').querySelector('select') as HTMLSelectElement, 'national');
    expect(designer.getPage().phone).toEqual({ country: 'EG', shown: 'national' });
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(country.selectedOptions[0].textContent).toBe('Egypt');
    // One undo each; back to as typed takes the setting away.
    designer.undo();
    expect(designer.getPage().phone).toEqual({ country: 'EG' });
    choose(phones, '');
    expect(designer.getPage().phone).toBeUndefined();
  });

  it('a phone field sets its own country and way of showing, the page’s unless it says', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Contact') });
    const id = designer.addQuestion('phone', { parent: 'section-1' }) as string;
    designer.select(id);
    const { host } = mount(designer, { mode: 'simple' });
    const card = host.querySelector('.fd-canvas-field.fd-editing') as HTMLElement;
    const box = (name: string) => card.querySelector(`[aria-label="${name}"]`) as HTMLSelectElement;
    const node = () => (designer.getPage().layout as { children: SectionNode[] }).children[0].children.find((n) => n.id === id) as FieldNode;
    expect(box('Country to start on').value).toBe('');
    expect(box('Country to start on').options[0].textContent).toBe('The page’s');
    choose(box('Country to start on'), 'AE');
    choose(box('Shown'), 'national');
    expect(node().options).toEqual({ country: 'AE', shown: 'national' });
    expect(node().widget).toBe('phone');
    choose(box('Shown'), '');
    expect(node().options).toEqual({ country: 'AE' });
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });

  it('speaks Arabic', () => {
    const designer = createDesigner({ page: blankPage('screen', 'جهة اتصال', { locale: 'ar' }), locale: 'ar' });
    designer.select(null);
    const { host } = mount(designer, { mode: 'advanced' });
    const panel = host.querySelector('.fd-properties') as HTMLElement;
    openTab(panel, 'المحتوى');
    const row = panel.querySelector('[data-setting="Phone numbers"]') as HTMLElement;
    expect(row.querySelector('.fd-prop-name')?.textContent).toBe('أرقام الهواتف');
    choose(row.querySelector('select') as HTMLSelectElement, 'checked');
    const country = panel.querySelector('[data-setting="Phone country to start on"] select') as HTMLSelectElement;
    choose(country, 'EG');
    expect(country.selectedOptions[0].textContent).toBe('مصر');
  });
});
