import type { FieldNode, SectionNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { settingItems } from './find-anything';
import { mount, press } from './test-editor';

/** Find anything (⌘K) finds the settings of what is picked, and the page's look, and goes to them. */

function editor() {
  const designer = createDesigner({ page: blankPage('screen', 'Visit') });
  const id = designer.addQuestion('short-answer', { parent: 'section-1' }) as string;
  designer.updateQuestion(id, { label: 'Customer' });
  designer.select(null);
  const { host } = mount(designer);
  const panel = host.querySelector('.fd-properties') as HTMLElement;
  /** ⌘K, the words typed, and what it lists. */
  const find = (words: string) => {
    press('k', { metaKey: true }, document.body);
    const box = host.querySelector('.fd-find-input') as HTMLInputElement;
    box.value = words;
    box.dispatchEvent(new Event('input', { bubbles: true }));
    return { box, found: () => [...host.querySelectorAll('.fd-find-option')].map((o) => [o.querySelector('.fd-find-label')?.textContent, o.querySelector('.fd-find-hint')?.textContent]) };
  };
  const chosen = () => panel.querySelector('[role="tab"][aria-selected="true"]')?.textContent;
  const field = () => (designer.getPage().layout as { children: SectionNode[] }).children[0].children[0] as FieldNode;
  return { designer, host, panel, id, find, chosen, field };
}

describe('settings as things to find', () => {
  it('lists a setting by its name, and each of its choices by its name and the choice', () => {
    const button = (words: string, label?: string) => Object.assign(document.createElement('button'), { textContent: words, ...(label ? { ariaLabel: label } : {}) });
    const items = settingItems(
      [
        { name: 'Label', tab: 'Content', choices: [] },
        { name: 'Labels', tab: 'Layout', choices: [{ value: 'above', words: 'Above', group: 'Labels', button: button('Above') }, { value: 'hidden', words: 'In box', group: 'Labels', button: button('In box') }] },
        { name: 'Columns', tab: 'Layout', choices: [{ value: '2', words: '2', group: 'Columns on a desktop', button: button('2') }, { value: '0', words: 'Auto', group: 'Columns on a phone', button: button('Auto') }] },
      ],
      () => undefined,
      'setting'
    );
    expect(items.map((i) => [i.label, i.hint])).toEqual([
      ['Label', 'setting · Content'],
      ['Labels', 'setting · Layout'],
      ['Labels: above', 'setting · Layout'],
      ['Labels: in box', 'setting · Layout'],
      ['Columns', 'setting · Layout'],
      ['Columns on a desktop: 2', 'setting · Layout'],
      ['Columns on a phone: auto', 'setting · Layout'],
    ]);
  });
});

describe('Find anything, for a setting', () => {
  it('finds the page’s accent with nothing picked, and opens its tab with the cursor on it', () => {
    const { host, panel, find, chosen } = editor();
    const { box, found } = find('accent');
    expect(found()[0]).toEqual(['Accent colour', 'setting · Look']);
    press('Enter', {}, box);
    expect(host.querySelector('.fd-find')).toBeNull();
    expect(chosen()).toBe('Look');
    expect(panel.querySelector('[data-setting="Accent colour"]')?.contains(document.activeElement)).toBe(true);
  });

  it('sets a choice of the field picked: “Labels: beside”', () => {
    const { designer, id, find, chosen, field } = editor();
    designer.select(id);
    const { box, found } = find('labels beside');
    expect(found()).toEqual([
      ['Labels: beside', 'setting · Layout'],
      ['The page’s labels: beside', 'setting · the page’s look'],
    ]);
    press('Enter', {}, box);
    expect(field().labels).toBe('beside');
    expect(chosen()).toBe('Layout');
    expect(document.activeElement?.getAttribute('data-choice')).toBe('beside');
  });

  it('finds the page’s look with a field picked, puts the field down and goes to it', () => {
    const { designer, id, find, chosen } = editor();
    designer.select(id);
    const { box, found } = find('spacing roomy');
    expect(found()).toEqual([['Spacing: roomy', 'setting · the page’s look']]);
    press('Enter', {}, box);
    expect(designer.getState().selected).toBeNull();
    expect(designer.getPage().look).toEqual({ density: 'roomy' });
    expect(chosen()).toBe('Look');
    expect(document.activeElement?.getAttribute('data-choice')).toBe('roomy');
  });

  it('names the page’s setting apart when the part picked has one of the same name', () => {
    const { designer, id, find } = editor();
    designer.select(id);
    expect(find('labels above').found()).toEqual([
      ['Labels: above', 'setting · Layout'],
      ['The page’s labels: above', 'setting · the page’s look'],
    ]);
  });
});
