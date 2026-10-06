import type { SectionNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { mount, openTab, type } from './test-editor';

/**
 * The Look tab: with nothing picked, the page's look — its accent, font,
 * spacing, corners, labels and colours — worn by the canvas as it is set;
 * with a group picked, how the group is drawn.
 */

function screenEditor() {
  const designer = createDesigner({ page: blankPage('screen', 'Visit') });
  designer.addQuestion('short-answer', { parent: 'section-1' });
  designer.select(null);
  const { host } = mount(designer, { mode: 'advanced' });
  const panel = host.querySelector('.fd-properties') as HTMLElement;
  const canvas = host.querySelector('.fd-canvas') as HTMLElement;
  const shown = () => panel.querySelector('[role="tabpanel"]:not([hidden])') as HTMLElement;
  const group = (name: string) => shown().querySelector(`[role="group"][aria-label="${name}"]`) as HTMLElement;
  const press = (name: string, words: string) => {
    const button = [...group(name).querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.textContent || b.getAttribute('aria-label')) === words);
    if (!button) throw new Error(`No “${words}” in ${name}`);
    button.click();
  };
  const pressed = (name: string) => [...group(name).querySelectorAll('button')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent || b.getAttribute('aria-label'));
  return { designer, host, panel, canvas, shown, group, press, pressed, look: () => designer.getPage().look };
}

describe('the Look tab — the page', () => {
  it('is the page’s, with nothing picked', () => {
    const { host, panel } = screenEditor();
    expect([...panel.querySelectorAll('[role="tab"]')].map((t) => t.textContent)).toEqual(['Content', 'Layout', 'Look', 'Rules']);
    openTab(host, 'Look');
    expect([...panel.querySelectorAll('[role="tabpanel"]:not([hidden]) [data-setting]')].map((r) => r.getAttribute('data-setting'))).toEqual(['Look presets', 'Accent colour', 'Font', 'Spacing', 'Corners', 'Labels', 'Label width', 'Help', 'Colours', 'Each kind of part']);
  });

  it('sets the spacing, the font, the corners and the colours, and the canvas wears each as it is set', () => {
    const { host, canvas, press, pressed, look } = screenEditor();
    openTab(host, 'Look');
    expect(pressed('Spacing')).toEqual([]);
    press('Spacing', 'Compact');
    expect(look()).toEqual({ density: 'compact' });
    expect(canvas.classList.contains('fd-form')).toBe(true);
    expect(canvas.getAttribute('data-density')).toBe('compact');
    expect(pressed('Spacing')).toEqual(['Compact']);
    press('Font', 'Serif');
    press('Corners', 'Round');
    press('Colours', 'Dark');
    expect(look()).toEqual({ density: 'compact', font: 'serif', corners: 'round', scheme: 'dark' });
    expect([canvas.getAttribute('data-font'), canvas.getAttribute('data-corners'), canvas.getAttribute('data-scheme')]).toEqual(['serif', 'round', 'dark']);
    // Pressed again, a setting goes back to the skin's own, and the canvas with it.
    press('Spacing', 'Compact');
    expect(look()?.density).toBeUndefined();
    expect(canvas.hasAttribute('data-density')).toBe(false);
  });

  it('sets the accent from a swatch or any colour, and gives it back to the skin', () => {
    const { designer, host, canvas, shown, press, pressed, look } = screenEditor();
    openTab(host, 'Look');
    press('Accent colour', 'Green');
    expect(look()?.accent).toBe('#1f7a4d');
    expect(canvas.hasAttribute('data-accent')).toBe(true);
    expect(canvas.style.getPropertyValue('--fd-look-accent')).toBe('#1f7a4d');
    expect(pressed('Accent colour')).toEqual(['Green']);
    const any = shown().querySelector('input[type="color"]') as HTMLInputElement;
    expect(any.value).toBe('#1f7a4d');
    type(any, '#123456');
    type(any, '#123457');
    expect(look()?.accent).toBe('#123457');
    expect(pressed('Accent colour')).toEqual([]);
    // A run of colours tried, one after another, is one undo step, as typing is.
    designer.undo();
    expect(look()?.accent).toBeUndefined();
    designer.redo();
    expect(look()?.accent).toBe('#123457');
    (shown().querySelector('button[aria-label="Accent as the skin has it"]') as HTMLButtonElement).click();
    expect(look()?.accent).toBeUndefined();
    expect(canvas.hasAttribute('data-accent')).toBe(false);
  });

  it('sets where labels sit across the page, and how wide when they sit beside', () => {
    const { host, canvas, shown, press, look } = screenEditor();
    openTab(host, 'Look');
    const widthRow = () => shown().querySelector('[data-setting="Label width"]') as HTMLElement;
    expect(widthRow().hidden).toBe(true);
    press('Labels', 'Beside');
    expect(widthRow().hidden).toBe(false);
    type(widthRow().querySelector('input[type="number"]') as HTMLInputElement, '180');
    expect(look()).toEqual({ labels: 'beside', labelWidth: 180 });
    expect(canvas.style.getPropertyValue('--fd-label-width')).toBe('180px');
  });
});

describe('the Look tab — a group', () => {
  it('draws a group as a card, plain, with a line under its title, or framed', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Visit') });
    const { host } = mount(designer, { mode: 'advanced' });
    designer.select('section-1');
    openTab(host, 'Look');
    const panel = host.querySelector('.fd-properties [role="tabpanel"]:not([hidden])') as HTMLElement;
    const style = panel.querySelector('[role="group"][aria-label="Style"]') as HTMLElement;
    const chips = () => [...style.querySelectorAll('button')];
    expect(chips().map((b) => b.textContent)).toEqual(['Card', 'Plain', 'Line', 'Framed']);
    expect(chips().every((b) => b.querySelector('svg'))).toBe(true);
    expect(chips().find((b) => b.getAttribute('aria-pressed') === 'true')?.textContent).toBe('Card');
    chips()[3].click();
    const section = () => (designer.getPage().layout as { children: SectionNode[] }).children[0];
    expect(section().style).toBe('framed');
    chips()[0].click();
    expect(section().style).toBeUndefined();
  });
});
