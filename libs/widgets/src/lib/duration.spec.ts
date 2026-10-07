import { formatDuration, formatPercentage, parseDuration } from './duration';
import { mountKind, typeInto } from './test-kinds';

/** The box: the widget itself, or inside it beside its unit. */
const boxOf = (el: HTMLElement) => (el.matches('input') ? el : el.querySelector('input')) as HTMLInputElement;

/** Hours as HH:MM (Flectra's float_time), and a fraction as a per cent (its percentage). */
describe('a duration', () => {
  it('writes hours as hours and minutes, and reads them back', () => {
    expect(formatDuration(6.5)).toBe('06:30');
    expect(formatDuration(0.25)).toBe('00:15');
    expect(formatDuration(125.999)).toBe('126:00');
    expect(formatDuration(-1.5)).toBe('-01:30');
    expect(parseDuration('6:30')).toBe(6.5);
    expect(parseDuration('06:45')).toBe(6.75);
    expect(parseDuration('2')).toBe(2);
    expect(parseDuration('1,5', 'de')).toBe(1.5);
    expect(parseDuration('-0:30')).toBe(-0.5);
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('6:')).toBeUndefined();
    expect(parseDuration('six')).toBe('six');
    expect(parseDuration('6:75')).toBe('6:75');
  });

  it('shows the hours of a float as HH:MM, and saves what is typed as hours', () => {
    const { el, form, value } = mountKind({ type: 'float' }, { widget: 'duration' });
    const input = boxOf(el);
    expect(input.id).toBe('fd-x');
    form.setValue('x', 6.5);
    expect(input.value).toBe('06:30');
    typeInto(input, '1:15');
    expect(value()).toBe(1.25);
    // While it is typed, what is typed stays; left, it is written as hours and minutes.
    typeInto(input, '1.5');
    expect(input.value).toBe('1.5');
    input.dispatchEvent(new Event('blur'));
    expect(input.value).toBe('01:30');
  });

  it('puts its unit after the time inside the box, and is read-only as the form says', () => {
    const { el, refresh } = mountKind({ type: 'float', default: 2.5 }, { widget: 'duration', options: { suffix: 'hours' } });
    const input = boxOf(el);
    expect(el.querySelector('.fd-unit')?.textContent).toBe('hours');
    expect(input.getAttribute('aria-describedby')).toContain('fd-x-unit2');
    refresh({ readonly: true });
    expect(input.readOnly).toBe(true);
  });
});

describe('a percentage', () => {
  it('writes a fraction as a per cent, in the page’s language', () => {
    expect(formatPercentage(0.25)).toBe('25%');
    expect(formatPercentage(0.125)).toBe('12.5%');
    expect(formatPercentage(1)).toBe('100%');
    expect(formatPercentage(0.333333, 'en', 1)).toBe('33.3%');
    expect(formatPercentage(0.5, 'fr')).toMatch(/^50\s%$/);
  });

  it('shows and takes per cents, and keeps the fraction', () => {
    const { el, form, value } = mountKind({ type: 'float' }, { widget: 'percentage' });
    const input = boxOf(el);
    form.setValue('x', 0.3);
    expect(input.value).toBe('30');
    expect(el.querySelector('.fd-unit')?.textContent).toBe('%');
    typeInto(input, '12.5');
    expect(value()).toBe(0.125);
    typeInto(input, '7');
    expect(value()).toBe(0.07);
    typeInto(input, '');
    expect(value()).toBeNull();
  });
});
