import { validatePage, type Option } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { mount } from './test-editor';

/**
 * What each option of a choice shows besides its words, as the designer sets it: started from a link, then a second
 * line, an icon and a colour for each option in a block of its own; a colour taken away; a matrix's columns refused.
 */

afterEach(() => document.body.replaceChildren());

describe('an option’s second line, icon and colour in the designer', () => {
  it('starts from a link, then sets each option’s second line, icon and colour', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Booking') });
    const id = designer.addQuestion('dropdown', { parent: 'section-1' }) as string;
    designer.select(id);
    const { host } = mount(designer, { mode: 'simple' });
    const card = host.querySelector('.fd-canvas-field.fd-editing') as HTMLElement;
    const start = card.querySelector('.fd-kind-give-looks') as HTMLButtonElement;
    expect(start.hidden).toBe(false);
    start.click();
    const options = () => (Object.values(designer.getPage().fields)[0] as { options: Option[] }).options;
    expect(options()[0].caption).toBe('Second line');
    const label = options()[0].label;
    const caption = card.querySelector(`[aria-label="Second line of ${label}"]`) as HTMLInputElement;
    caption.value = '30 min · EGP 4,500';
    caption.dispatchEvent(new Event('input', { bubbles: true }));
    const icon = card.querySelector(`[aria-label="Icon of ${label}"]`) as HTMLSelectElement;
    icon.value = 'star';
    icon.dispatchEvent(new Event('change', { bubbles: true }));
    const colour = card.querySelector(`[aria-label="Colour of ${label}"]`) as HTMLInputElement;
    colour.value = '#d6145f';
    colour.dispatchEvent(new Event('change', { bubbles: true }));
    expect(options()[0]).toMatchObject({ caption: '30 min · EGP 4,500', icon: 'star', color: '#d6145f' });
    expect(validatePage(designer.getPage()).ok).toBe(true);
    (card.querySelector(`[aria-label="No colour for ${label}"]`) as HTMLButtonElement).click();
    expect(options()[0].color).toBeUndefined();
    expect(start.hidden).toBe(true);
  });

  it('refuses a colour that is no #rrggbb', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Booking') });
    const id = designer.addQuestion('multiple-choice', { parent: 'section-1' }) as string;
    expect(designer.setOptionDetails(id, 0, { color: 'red' })).toBe(false);
    expect(designer.setOptionDetails(id, 0, { color: '#00aa55' })).toBe(true);
  });
});
