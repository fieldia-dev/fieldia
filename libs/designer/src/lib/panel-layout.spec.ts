import type { SectionNode } from '@fieldia/core';
import { mount, openTab, type } from './test-editor';
import { employeeDesigner, nodeOf } from './test-layout';

/**
 * The Layout tab: a group's columns on a desktop, a tablet and a phone, where
 * its labels sit and how wide, and how wide it is where it sits; a field's
 * width and its label's place; parts side by side, their columns and width.
 */

function picked(id: string) {
  const designer = employeeDesigner();
  const { host } = mount(designer);
  designer.select(id);
  const panel = host.querySelector('.fd-properties') as HTMLElement;
  if ([...panel.querySelectorAll('[role="tab"]')].some((t) => t.textContent === 'Layout')) openTab(host, 'Layout');
  const shown = () => panel.querySelector('[role="tabpanel"]:not([hidden])') as HTMLElement;
  const group = (name: string) => [...shown().querySelectorAll<HTMLElement>('[role="group"]')].find((g) => g.getAttribute('aria-label') === name && !g.closest('[hidden]'));
  /** A choice of a group: its words on show, and the one pressed. */
  const choices = (name: string) => {
    const buttons = [...(group(name)?.querySelectorAll<HTMLButtonElement>('button') ?? [])].filter((b) => !b.hidden);
    return { words: buttons.map((b) => b.textContent), pressed: buttons.find((b) => b.getAttribute('aria-pressed') === 'true')?.textContent ?? null };
  };
  const press = (name: string, words: string) => {
    const button = [...(group(name)?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find((b) => b.textContent === words && !b.hidden);
    if (!button) throw new Error(`No “${words}” in ${name}`);
    button.click();
  };
  const hint = (name: string) => shown().querySelector(`[data-setting="${name}"] .fd-set-hint`)?.textContent;
  const page = () => designer.getPage();
  const node = (part: string) => nodeOf(page(), part) as unknown as SectionNode & { labels?: string; colspan?: number };
  return { designer, host, panel, shown, group, choices, press, hint, page, node };
}

describe('the Layout tab — a group', () => {
  it('sets its columns on a desktop, a tablet and a phone, never more on a smaller one', () => {
    const { designer, choices, press, node } = picked('personal');
    expect(choices('Columns on a desktop')).toEqual({ words: ['1', '2', '3', '4'], pressed: '3' });
    expect(choices('Columns on a tablet')).toEqual({ words: ['Auto', '1', '2', '3'], pressed: '3' });
    expect(choices('Columns on a phone')).toEqual({ words: ['Auto', '1', '2', '3'], pressed: '1' });
    press('Columns on a desktop', '2');
    expect(node('personal').columns).toEqual({ wide: 2, medium: 2, narrow: 1 });
    expect(choices('Columns on a tablet').words).toEqual(['Auto', '1', '2']);
    press('Columns on a tablet', '1');
    expect(node('personal').columns).toEqual({ wide: 2, medium: 1, narrow: 1 });
    // A phone shows no more than a tablet.
    expect(choices('Columns on a phone').words).toEqual(['Auto', '1']);
    press('Columns on a tablet', 'Auto');
    press('Columns on a phone', 'Auto');
    expect(node('personal').columns).toBe(2);
    // Each press, one undo step.
    designer.undo();
    expect(node('personal').columns).toEqual({ wide: 2, narrow: 1 });
  });

  it('sets where its labels sit, and how wide, only when they sit beside', () => {
    const { designer, host, press, choices, shown, node } = picked('bank');
    expect(choices('Labels').pressed).toBe('Beside');
    const width = shown().querySelector('input[type="number"][aria-label="Label width"]') as HTMLInputElement;
    const slider = shown().querySelector('input[type="range"][aria-label="Label width"]') as HTMLInputElement;
    expect([width.value, slider.value, slider.min, slider.max]).toEqual(['120', '120', '60', '320']);
    type(width, '200');
    expect(node('bank').labelWidth).toBe(200);
    expect(slider.value).toBe('200');
    // Too narrow to keep, while it is typed: nothing changes yet.
    type(width, '6');
    expect(node('bank').labelWidth).toBe(200);
    slider.value = '240';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    expect(node('bank').labelWidth).toBe(240);
    press('Labels', 'As page');
    expect(node('bank').labels).toBeUndefined();
    // The page puts them above: no width to set.
    expect(shown().querySelector('[data-setting="Label width"]')?.closest('[hidden]')).not.toBeNull();
    designer.setLook({ labels: 'beside' });
    expect(shown().querySelector('[data-setting="Label width"]')?.closest('[hidden]')).toBeNull();
    expect(host.querySelector('.fd-properties')).not.toBeNull();
  });

  it('sets how wide it is in the group round it, or says why it takes the whole row', () => {
    const { designer, choices, press, hint, node } = picked('address');
    expect(choices('Width')).toEqual({ words: ['1', 'All 2'], pressed: '1' });
    expect(hint('Width')).toBe('1 of the 2 columns it shares with “Emergency contact”.');
    press('Width', 'All 2');
    expect(node('address').colspan).toBe(2);
    designer.select('personal');
    expect(choices('Width').words).toEqual([]);
    expect(hint('Width')).toBe('It sits on the page, so it takes the full width. Put it in a group with columns, or side by side with another part, to give it a width.');
  });
});

describe('the Layout tab — a field', () => {
  it('sets its width, and where its label sits — as its group, or its own', () => {
    const { press, choices, node } = picked('f-email');
    expect(choices('Width')).toEqual({ words: ['1', 'All 2'], pressed: '1' });
    expect(choices('Labels')).toEqual({ words: ['As group', 'Above', 'Beside', 'In box'], pressed: 'As group' });
    press('Labels', 'Beside');
    expect(node('f-email').labels).toBe('beside');
    press('Labels', 'As group');
    expect(node('f-email').labels).toBeUndefined();
    press('Width', 'All 2');
    expect(node('f-email').colspan).toBe(2);
  });
});

describe('the Layout tab — parts side by side', () => {
  it('heads parts side by side by what they hold, with only their layout', () => {
    const { panel, choices } = picked('side-1');
    expect(panel.querySelector('.fd-panel-title')?.textContent).toBe('Side by side');
    expect(panel.querySelector('.fd-insp-name')?.textContent).toBe('“Home address” and “Emergency contact”');
    expect([...panel.querySelectorAll('[role="tab"]')].map((t) => t.textContent)).toEqual(['Layout']);
    expect(choices('Columns on a desktop').pressed).toBe('2');
    expect(choices('Columns on a tablet').pressed).toBe('1');
    expect(choices('Columns on a phone').pressed).toBe('Auto');
  });

  it('says parts on the columns of the group round them line up with it, and sets how many they cover', () => {
    const { choices, hint, press, node, group } = picked('who');
    expect(group('Columns on a desktop')).toBeUndefined();
    expect(hint('Columns')).toBe('Its parts sit on the 2 columns it covers in “Personal details”, so they line up with everything above and below. Make it wider or narrower to change that.');
    expect(choices('Width')).toEqual({ words: ['1', '2', 'All 3'], pressed: '2' });
    expect(hint('Width')).toBe('2 of the 3 columns of “Personal details”.');
    press('Width', 'All 3');
    expect(node('who').colspan).toBe(3);
  });
});

describe('the Layout tab — tabs and blocks', () => {
  it('gives a divider no Layout tab: it runs across the whole row', () => {
    const { panel } = picked('div-1');
    expect([...panel.querySelectorAll('[role="tab"]')].map((t) => t.textContent)).toEqual(['Content']);
  });

  it('gives tabs and a block on the page the full width, and says so', () => {
    for (const id of ['job-tabs', 'send']) {
      const { hint } = picked(id);
      expect(hint('Width')).toBe('It sits on the page, so it takes the full width. Put it in a group with columns, or side by side with another part, to give it a width.');
    }
  });
});
