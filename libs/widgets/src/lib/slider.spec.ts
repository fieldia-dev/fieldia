import { mountKind } from './test-kinds';

/** A number picked on a slider: the field's range, a step, and the value shown beside it as the page's readers write numbers. */

const slide = (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
const range = (el: Element) => el.querySelector('input[type=range]') as HTMLInputElement;
const shown = (el: Element) => el.querySelector('output')?.textContent;

describe('slider', () => {
  it('runs over the field’s range, in the page’s steps, its ends written under it', () => {
    const { el } = mountKind({ type: 'integer', min: 1, max: 10 }, { widget: 'slider', options: { step: 3 } });
    const input = range(el);
    expect(input.id).toBe('fd-x');
    expect([input.min, input.max, input.step]).toEqual(['1', '10', '3']);
    expect([...el.querySelectorAll('.fd-slider-ends span')].map((s) => s.textContent)).toEqual(['1', '10']);
  });

  it('runs from 0 to 100 a step at a time when the field and page say nothing', () => {
    const input = range(mountKind({ type: 'integer' }, { widget: 'slider' }).el);
    expect([input.min, input.max, input.step]).toEqual(['0', '100', '1']);
  });

  it('keeps the number slid to, and shows it', () => {
    const { el, value } = mountKind({ type: 'integer', min: 0, max: 10 }, { widget: 'slider' });
    slide(range(el), '7');
    expect(value()).toBe(7);
    expect(shown(el)).toBe('7');
    expect(range(el).getAttribute('aria-valuetext')).toBe('7');
  });

  it('takes halves and the like on a decimal field, written the page’s way', () => {
    const { el, value, form } = mountKind({ type: 'float', min: 0, max: 12, digits: [4, 1] }, { widget: 'slider', options: { step: 0.5 } }, { locale: 'de' });
    slide(range(el), '2.5');
    expect(value()).toBe(2.5);
    expect(shown(el)).toBe('2,5');
    form.setValue('x', 10);
    expect(range(el).value).toBe('10');
    expect(shown(el)).toBe('10,0');
  });

  it('says it is not answered yet, in words and to a screen reader, until it is', () => {
    // The owner's walk of 0.27: an unanswered slider showed its knob halfway beside "–", which looked answered.
    const { el } = mountKind({ type: 'integer', min: 0, max: 10 }, { widget: 'slider' });
    expect(el.classList.contains('fd-slider-empty')).toBe(true);
    expect(shown(el)).toBe('Not answered');
    expect(range(el).getAttribute('aria-valuetext')).toBe('Not answered');
    // No knob halfway: a hollow ring at the start, drawn over a track with nothing filled, and the keys move from there.
    expect(range(el).value).toBe('0');
    expect((el.querySelector('.fd-slider-blank') as HTMLElement).hidden).toBe(false);
    slide(range(el), '3');
    expect(el.classList.contains('fd-slider-empty')).toBe(false);
    expect(shown(el)).toBe('3');
    expect((el.querySelector('.fd-slider-blank') as HTMLElement).hidden).toBe(true);
  });

  it('takes its least as the answer from a press or a key that leaves the knob where it starts', async () => {
    const pressed = mountKind({ type: 'integer', min: 1, max: 5 }, { widget: 'slider' });
    range(pressed.el).dispatchEvent(new Event('pointerup', { bubbles: true }));
    expect(pressed.value()).toBe(1);
    const keyed = mountKind({ type: 'integer', min: 1, max: 5 }, { widget: 'slider' });
    range(keyed.el).dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    await new Promise((done) => setTimeout(done, 0));
    expect(keyed.value()).toBe(1);
    // Read-only, nothing is answered.
    const locked = mountKind({ type: 'integer', min: 1, max: 5 }, { widget: 'slider' });
    locked.refresh({ readonly: true });
    range(locked.el).dispatchEvent(new Event('pointerup', { bubbles: true }));
    expect(locked.value()).toBeNull();
  });

  it('takes the answer back when it need not be given, and not when it must', () => {
    const { el, value, refresh } = mountKind({ type: 'integer', min: 0, max: 10 }, { widget: 'slider' });
    const clear = el.querySelector('.fd-choice-clear') as HTMLButtonElement;
    expect(clear.hidden).toBe(true);
    slide(range(el), '4');
    expect(clear.hidden).toBe(false);
    clear.click();
    expect(value()).toBeNull();
    expect(document.activeElement).toBe(range(el));
    slide(range(el), '4');
    refresh({ required: true });
    expect(clear.hidden).toBe(true);
  });

  it('cannot be moved when read-only, and says when it is wrong', () => {
    const { el, refresh } = mountKind({ type: 'integer' }, { widget: 'slider' });
    refresh({ readonly: true, invalid: true });
    expect(range(el).disabled).toBe(true);
    expect(range(el).getAttribute('aria-invalid')).toBe('true');
  });

  it('reads the same right to left, in Arabic', () => {
    const { el } = mountKind({ type: 'integer', min: 0, max: 10 }, { widget: 'slider' }, { locale: 'ar', dir: 'rtl' });
    slide(range(el), '6');
    expect(shown(el)).toBe('6');
    expect(range(el).getAttribute('aria-valuetext')).toBe('6');
    expect(el.closest('[dir]')?.getAttribute('dir')).toBe('rtl');
  });
});
