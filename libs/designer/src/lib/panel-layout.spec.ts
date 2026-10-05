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
  const { host } = mount(designer, { mode: 'advanced' });
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
    expect(choices('Columns on a desktop')).toEqual({ words: ['1', '2', '3', '4', 'Twelfths'], pressed: '3' });
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

describe('the Layout tab — a group in twelfths', () => {
  it('offers Twelfths among a group’s columns: chosen, its rows divide their own way; one to four again, as near as they go', () => {
    const { designer, choices, press, node, hint } = picked('address');
    expect(choices('Columns on a desktop')).toEqual({ words: ['1', '2', '3', '4', 'Twelfths'], pressed: '2' });
    expect(choices('Columns on a tablet').words).toEqual(['Auto', '1', '2']);
    press('Columns on a desktop', 'Twelfths');
    expect(node('address').columns).toEqual({ wide: 12, narrow: 1 });
    expect((node('address').children as { colspan?: number }[]).map((c) => c.colspan ?? 1)).toEqual([12, 6, 6, 12]);
    expect(choices('Columns on a tablet')).toEqual({ words: ['Auto', '1', 'Twelfths'], pressed: 'Auto' });
    expect(choices('Columns on a phone')).toEqual({ words: ['Auto', '1', 'Twelfths'], pressed: '1' });
    expect(hint('Columns')).toBe('Each row divides its own way, in twelfths: drop a part beside another to share its row. Auto keeps a row’s proportions on a tablet, and puts its parts one under another on a phone.');
    press('Columns on a desktop', '2');
    expect(node('address').columns).toEqual({ wide: 2, narrow: 1 });
    designer.undo();
    expect(node('address').columns).toEqual({ wide: 12, narrow: 1 });
  });

  it('sets whether its rows stay full or may leave gaps — only in twelfths', () => {
    const { designer, choices, press, node, shown, hint } = picked('address');
    const rows = () => shown().querySelector('[data-setting="Rows"]') as HTMLElement;
    expect(rows().hidden).toBe(true);
    designer.setColumns('address', 12);
    expect(rows().hidden).toBe(false);
    expect(choices('Rows')).toEqual({ words: ['Keep each row full', 'Allow gaps'], pressed: 'Keep each row full' });
    expect(hint('Rows')).toBe('A part leaving a row widens the rest to fill it; a part alone takes the whole row.');
    press('Rows', 'Allow gaps');
    expect(node('address').rows).toBe('gaps');
    expect(hint('Rows')).toBe('A part keeps its width when a neighbour leaves, and its far edge can be pulled in to leave room.');
    press('Rows', 'Keep each row full');
    expect(node('address')).not.toHaveProperty('rows');
  });

  it('a part’s width as a fraction of its row: those that leave the rest of the row room, and its own when none of them', () => {
    const { designer, choices, press, node, hint } = picked('f-city');
    designer.setColumns('address', 12);
    expect(choices('Width')).toEqual({ words: ['Whole', '¾', '⅔', '½', '⅓', '¼'], pressed: '½' });
    expect(hint('Width')).toBe('Half the row in “Home address”. Its row stays full: the rest of it takes up the difference.');
    press('Width', '⅔');
    expect([node('f-city').colspan, node('f-postcode').colspan]).toEqual([8, 4]);
    designer.setWidths([{ id: 'f-city', span: 7 }, { id: 'f-postcode', span: 5 }]);
    expect(choices('Width')).toEqual({ words: ['Whole', '¾', '⅔', '½', '⅓', '¼', '58%'], pressed: '58%' });
    // Alone in its row, a full row's part is the whole of it.
    designer.select('f-street');
    expect(choices('Width')).toEqual({ words: ['Whole'], pressed: 'Whole' });
    expect(hint('Width')).toBe('The whole row in “Home address”: alone in its row, it fills it. Let the group’s rows leave gaps to make it narrower.');
    designer.setSectionLook('address', { rows: 'gaps' });
    expect(choices('Width').words).toEqual(['Whole', '¾', '⅔', '½', '⅓', '¼']);
    expect(hint('Width')).toBe('The whole row in “Home address”. Narrower, it leaves room in its row.');
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
