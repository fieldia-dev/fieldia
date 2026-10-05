import { blankPage, createDesigner } from './designer';
import { rankSettings } from './panel-search';
import { mount, press } from './test-editor';

/** Searching the panel's settings by name, across all its tabs, and going to the one found. */

describe('ranking the settings found', () => {
  const rows = (...names: string[]) => names.map((name, order) => ({ name, order, words: '' }));

  it('puts the name itself first, then names that start with it, then a word of it, then anywhere in it', () => {
    const found = rankSettings(rows('Help text', 'Label width', 'Labels', 'Label', 'Placeholder', 'Shown as'), 'label');
    expect(found.map((r) => r.name)).toEqual(['Label', 'Label width', 'Labels']);
    expect(rankSettings(rows('Label width', 'Width', 'Widths of all'), 'width').map((r) => r.name)).toEqual(['Width', 'Widths of all', 'Label width']);
    expect(rankSettings(rows('Placeholder', 'Help text'), 'hold').map((r) => r.name)).toEqual(['Placeholder']);
  });

  it('puts a word of the name that starts so before letters in the middle of one, and those before a choice', () => {
    expect(rankSettings(rows('Bandwidth', 'Label width'), 'width').map((r) => r.name)).toEqual(['Label width', 'Bandwidth']);
    const list = [
      { name: 'Labels', order: 0, words: 'above beside' },
      { name: 'Inside', order: 1, words: '' },
    ];
    expect(rankSettings(list, 'side').map((r) => r.name)).toEqual(['Inside', 'Labels']);
  });

  it('keeps the panel’s order between names that match as well', () => {
    expect(rankSettings(rows('Section', 'Shown as', 'Stored as'), 's').map((r) => r.name)).toEqual(['Section', 'Shown as', 'Stored as']);
  });

  it('finds a setting by one of its choices, after those found by name, and needs every word typed', () => {
    const list = [
      { name: 'Labels', order: 0, words: 'above beside in the box' },
      { name: 'Beside the title', order: 1, words: '' },
      { name: 'Width', order: 2, words: '1 2 all' },
    ];
    expect(rankSettings(list, 'beside').map((r) => r.name)).toEqual(['Beside the title', 'Labels']);
    expect(rankSettings(list, 'labels box').map((r) => r.name)).toEqual(['Labels']);
    expect(rankSettings(list, 'labels wide').map((r) => r.name)).toEqual([]);
    expect(rankSettings(list, '   ')).toEqual([]);
    expect(rankSettings(list, 'WIDTH').map((r) => r.name)).toEqual(['Width']);
  });
});

describe('the search box over the settings', () => {
  function picked() {
    const designer = createDesigner({ page: blankPage('screen', 'Visit') });
    const id = designer.addQuestion('email', { parent: 'section-1' }) as string;
    designer.updateQuestion(id, { label: 'Customer' });
    designer.select(id);
    const { host } = mount(designer, { mode: 'advanced' });
    const panel = host.querySelector('.fd-properties') as HTMLElement;
    const box = panel.querySelector('input[aria-label="Search settings"]') as HTMLInputElement;
    const search = (text: string) => {
      box.focus();
      box.value = text;
      box.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const groups = () =>
      [...panel.querySelectorAll<HTMLElement>('.fd-insp-found [role="group"]')].filter((g) => !g.hidden).map((g) => [g.getAttribute('aria-label'), ...[...g.querySelectorAll('[role="option"]')].map((o) => o.querySelector('.fd-insp-found-name')?.textContent)]);
    const chosen = () => panel.querySelector('[role="tab"][aria-selected="true"]')?.textContent;
    return { designer, host, panel, box, search, groups, chosen };
  }

  it('lists what it finds in every tab, grouped by tab, the best first', () => {
    const { panel, search, groups } = picked();
    search('s');
    expect(groups()).toEqual([
      ['Content', 'Shown as'],
      // In a tab's group, the best first: a name with an s anywhere in it last.
      ['Layout', 'Section', 'Labels'],
      ['Rules', 'Set when', 'When it shows', 'Answer rules'],
      ['Data', 'Stored as'],
    ]);
    // The tabs make way while it lists them.
    expect((panel.querySelector('[role="tablist"]') as HTMLElement).hidden).toBe(true);
    expect((panel.querySelector('.fd-insp-panels') as HTMLElement).hidden).toBe(true);
  });

  it('goes to the setting found with Enter: its tab chosen, its control focused, the list gone', () => {
    const { panel, box, search, chosen } = picked();
    search('section');
    press('Enter', {}, box);
    expect(chosen()).toBe('Layout');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Section');
    expect(box.value).toBe('');
    expect((panel.querySelector('[role="tablist"]') as HTMLElement).hidden).toBe(false);
    expect((panel.querySelector('.fd-insp-found') as HTMLElement).hidden).toBe(true);
  });

  it('moves down the list with the arrows, and goes to one clicked', () => {
    const { panel, box, search, chosen } = picked();
    search('s');
    const active = () => panel.querySelector(`#${box.getAttribute('aria-activedescendant')}`)?.querySelector('.fd-insp-found-name')?.textContent;
    expect(active()).toBe('Shown as');
    // Down the list as it is drawn, tab by tab.
    const drawn: (string | null | undefined)[] = [active()];
    for (let i = 0; i < 6; i++) {
      press('ArrowDown', {}, box);
      drawn.push(active());
    }
    expect(drawn).toEqual([...panel.querySelectorAll('.fd-insp-found-name')].map((n) => n.textContent));
    press('ArrowDown', {}, box);
    expect(active()).toBe('Shown as');
    press('ArrowDown', {}, box);
    press('ArrowDown', {}, box);
    press('ArrowUp', {}, box);
    expect(active()).toBe('Section');
    press('Enter', {}, box);
    expect(chosen()).toBe('Layout');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Section');
    search('help');
    (panel.querySelector('.fd-insp-found [role="option"]') as HTMLElement).click();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Help text');
  });

  it('says so when nothing is called that, and Escape empties the box', () => {
    const { panel, box, search } = picked();
    search('zebra');
    expect((panel.querySelector('.fd-insp-none') as HTMLElement).hidden).toBe(false);
    expect(panel.querySelector('.fd-insp-none')?.textContent).toBe('No setting called “zebra”.');
    press('Escape', {}, box);
    expect(box.value).toBe('');
    expect((panel.querySelector('.fd-insp-none') as HTMLElement).hidden).toBe(true);
    expect((panel.querySelector('[role="tablist"]') as HTMLElement).hidden).toBe(false);
  });

  it('looks again when something else is picked while it lists', () => {
    const { designer, search, groups } = picked();
    search('title');
    expect(groups()).toEqual([]);
    designer.select('section-1');
    expect(groups()).toEqual([['Content', 'Title']]);
  });
});
