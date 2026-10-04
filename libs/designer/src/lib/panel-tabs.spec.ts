import type { Page } from '@fieldia/core';
import { elementFactory } from './chrome';
import { blankPage, createDesigner } from './designer';
import { partKindOf, tabStrip, tabsFor, TAB_NAMES, type PartKind } from './panel-tabs';
import { employeeDesigner } from './test-layout';

/** Which tabs of the panel apply to what is picked, and the tabs themselves, worked by the keyboard. */

describe('which tabs apply', () => {
  it('gives each kind of part the tabs the approved mockup gives it', () => {
    const cases: [PartKind, string[]][] = [
      ['page', ['Content', 'Layout', 'Look']],
      ['group', ['Content', 'Layout', 'Look', 'Rules']],
      ['field', ['Content', 'Layout', 'Rules', 'Data']],
      ['arrangement', ['Layout']],
      ['tabs', ['Content', 'Layout']],
      ['tab', ['Content']],
      ['block', ['Content', 'Layout']],
      ['several', ['Layout', 'Rules']],
      ['header', ['Content']],
      ['statusbar', ['Content']],
      ['list', ['Content']],
      ['column', ['Content']],
      ['action', ['Content']],
    ];
    for (const [kind, tabs] of cases) expect([kind, tabsFor(kind).map((t) => TAB_NAMES[t])]).toEqual([kind, tabs]);
  });

  it('knows what is picked: nothing, a field, a group, an arrangement, tabs, a tab, a block, or several', () => {
    const designer = employeeDesigner();
    const page = designer.getPage();
    const kind = (picked: string[]) => partKindOf(page, picked);
    expect(kind([])).toBe('page');
    expect(kind(['f-email'])).toBe('field');
    expect(kind(['personal'])).toBe('group');
    // An untitled plain section only holds parts side by side: an arrangement, not a group.
    expect(kind(['who'])).toBe('arrangement');
    expect(kind(['job-tabs'])).toBe('tabs');
    expect(kind(['tab-job'])).toBe('tab');
    expect(kind(['send'])).toBe('block');
    expect(kind(['h-send'])).toBe('block');
    expect(kind(['f-email', 'f-mobile'])).toBe('several');
    // Something no longer on the page is nothing picked.
    expect(kind(['gone'])).toBe('page');
  });

  it('knows a list’s columns and buttons, and a sheet’s header parts', () => {
    const list = createDesigner({ page: blankPage('list', 'Customers') });
    list.addListAction('Archive');
    const action = (list.getPage().layout as { actions: { id: string }[] }).actions[0].id;
    expect(partKindOf(list.getPage(), [])).toBe('list');
    expect(partKindOf(list.getPage(), ['column:name'])).toBe('column');
    expect(partKindOf(list.getPage(), [action])).toBe('action');
    const sheet = createDesigner({ page: blankPage('sheet', 'Customer') });
    const button = sheet.addHeaderPart('button', 'Confirm') as string;
    expect(partKindOf(sheet.getPage(), [button])).toBe('header');
    const withSteps = { ...sheet.getPage(), layout: { ...sheet.getPage().layout, statusbar: { field: 'name' } } } as Page;
    expect(partKindOf(withSteps, ['#statusbar'])).toBe('statusbar');
    expect(partKindOf(sheet.getPage(), ['#statusbar'])).toBe('page');
  });
});

describe('the tabs', () => {
  const el = elementFactory(document);
  afterEach(() => document.body.replaceChildren());

  function strip() {
    const chosen: string[] = [];
    const tabs = tabStrip(el, (tab) => chosen.push(tab));
    document.body.append(tabs.element);
    tabs.show(['content', 'layout', 'rules', 'data'], 'content');
    const buttons = () => [...tabs.element.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    return { tabs, chosen, buttons };
  }
  const key = (target: Element, name: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));

  it('is a tablist whose tabs name the panels they control, one of them in the Tab order', () => {
    const { tabs, buttons } = strip();
    expect(tabs.element.getAttribute('role')).toBe('tablist');
    expect(buttons().map((b) => b.textContent)).toEqual(['Content', 'Layout', 'Rules', 'Data']);
    expect(buttons().map((b) => b.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'false']);
    expect(buttons().map((b) => b.tabIndex)).toEqual([0, -1, -1, -1]);
    for (const b of buttons()) expect(b.getAttribute('aria-controls')).toBe(tabs.panelId(b.dataset['tab'] as never));
  });

  it('moves along with the arrows, round the ends, and to the ends with Home and End', () => {
    const { buttons, chosen } = strip();
    buttons()[0].focus();
    key(buttons()[0], 'ArrowRight');
    expect(chosen).toEqual(['layout']);
    expect(document.activeElement).toBe(buttons()[1]);
    key(buttons()[1], 'ArrowLeft');
    key(buttons()[0], 'ArrowLeft');
    expect(chosen).toEqual(['layout', 'content', 'data']);
    key(buttons()[3], 'ArrowRight');
    expect(chosen[chosen.length - 1]).toBe('content');
    key(buttons()[0], 'End');
    expect(chosen[chosen.length - 1]).toBe('data');
    key(buttons()[3], 'Home');
    expect(chosen[chosen.length - 1]).toBe('content');
  });

  it('goes along the tabs the other way right to left, as the reader sees them', () => {
    const { tabs, buttons, chosen } = strip();
    tabs.element.style.direction = 'rtl';
    buttons()[0].focus();
    key(buttons()[0], 'ArrowLeft');
    expect(chosen).toEqual(['layout']);
    key(buttons()[1], 'ArrowRight');
    expect(chosen).toEqual(['layout', 'content']);
  });

  it('chooses a tab by a click, and draws the one chosen', () => {
    const { tabs, buttons, chosen } = strip();
    buttons()[2].click();
    expect(chosen).toEqual(['rules']);
    tabs.show(['content', 'layout', 'rules', 'data'], 'rules');
    expect(buttons().map((b) => b.tabIndex)).toEqual([-1, -1, 0, -1]);
    expect(buttons()[2].getAttribute('aria-selected')).toBe('true');
    // A strip of other tabs: only those.
    tabs.show(['layout'], 'layout');
    expect(buttons().map((b) => b.textContent)).toEqual(['Layout']);
  });
});
