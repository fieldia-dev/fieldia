import { FLECTRA_COLOURS } from './colour';
import { mountKind, press } from './test-kinds';

/** Flectra's tag colours: an integer from 0 (none) to 11, picked from a palette; or a colour as #rrggbb text. */
const swatch = (el: HTMLElement) => el.querySelector('button.fd-colour-button') as HTMLButtonElement;
const palette = (el: HTMLElement) => el.querySelector('[role="radiogroup"]') as HTMLElement;
const colours = (el: HTMLElement) => [...el.querySelectorAll<HTMLButtonElement>('[role="radio"]')];

describe('a colour from the palette', () => {
  it('shows the colour picked as a swatch named by the field and the colour', () => {
    const { el } = mountKind({ type: 'integer', label: 'Colour', default: 1 }, { widget: 'color' });
    expect(swatch(el).id).toBe('fd-x');
    expect(swatch(el).getAttribute('aria-label')).toBe('Colour: Red');
    expect(swatch(el).style.getPropertyValue('--fd-swatch')).toBe(FLECTRA_COLOURS[1]);
    expect(palette(el).hidden).toBe(true);
  });

  it('opens twelve colours, the first none, and picking one keeps its number', () => {
    const { el, value } = mountKind({ type: 'integer', label: 'Colour' }, { widget: 'color' });
    swatch(el).click();
    expect(palette(el).hidden).toBe(false);
    expect(colours(el)).toHaveLength(12);
    expect(colours(el)[0].getAttribute('aria-label')).toBe('No colour');
    expect(document.activeElement).toBe(colours(el)[0]);
    colours(el)[10].click();
    expect(value()).toBe(10);
    expect(palette(el).hidden).toBe(true);
    expect(swatch(el).getAttribute('aria-label')).toBe('Colour: Green');
  });

  it('moves between the colours with the arrow keys, mirrored right to left, and Escape closes it', () => {
    const { el, value } = mountKind({ type: 'integer', label: 'Colour', default: 3 }, { widget: 'color' }, { dir: 'rtl' });
    swatch(el).click();
    expect(document.activeElement).toBe(colours(el)[3]);
    press(colours(el)[3], 'ArrowLeft');
    expect(document.activeElement).toBe(colours(el)[4]);
    press(colours(el)[4], 'Enter');
    expect(value()).toBe(4);
    swatch(el).click();
    press(document.activeElement as Element, 'Escape');
    expect(palette(el).hidden).toBe(true);
    expect(document.activeElement).toBe(swatch(el));
  });

  it('is said in the page’s language', () => {
    const { el } = mountKind({ type: 'integer', label: 'اللون', default: 10 }, { widget: 'color' }, { locale: 'ar' });
    expect(swatch(el).getAttribute('aria-label')).toBe('اللون: أخضر');
  });
});

describe('a colour as text', () => {
  it('picks a colour with the browser’s own picker and keeps it as #rrggbb', () => {
    const { el, value, form } = mountKind({ type: 'char', label: 'Epic colour' }, { widget: 'color' });
    const input = el.querySelector('input[type="color"]') as HTMLInputElement;
    expect(input.id).toBe('fd-x');
    input.value = '#2c8397';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(value()).toBe('#2c8397');
    form.setValue('x', '#F06050');
    expect(input.value).toBe('#f06050');
    expect(el.querySelector('.fd-colour-code')?.textContent).toBe('#F06050');
  });
});
