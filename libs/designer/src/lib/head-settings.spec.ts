import { checkPage, validatePage, type ButtonNode, type Field, type MenuItem, type Page, type SheetNode, type TabsNode } from '@fieldia/core';
import { createDesigner, type Designer } from './designer';
import { button, choose, field, mount, openTab, type, typeAndLeave } from './test-editor';

/**
 * A record's head in the designer: turned on with a work item's buttons, its
 * kind from a field with each kind's colour and icon, its number, its row's
 * fields and counts, its band's fields with their access keys and columns,
 * "Updated by"; a button's icon alone, toggle and menu — its dividers and the
 * menus its items open kept as another item is edited; a tab's icon and
 * count, the tabs put in the head; a field's access key. Each edit keeps the
 * page valid, an edit elsewhere never drops a field the head shows, the panel
 * sets them as a person would, and the canvas draws the head.
 */

/** The backend's work items: the fields the head names besides those the sheet shows. */
const MODEL: Record<string, Field> = {
  number: { type: 'integer', label: 'ID', readonly: true },
  work_type: { type: 'selection', label: 'Work Item Type', options: [{ value: 'bug', label: 'Bug' }, { value: 'task', label: 'Task' }] },
  comment_count: { type: 'integer', label: 'Comments', readonly: true },
  following: { type: 'boolean', label: 'Following', readonly: true },
  changed_by: { type: 'char', label: 'Changed By', readonly: true },
  changed_date: { type: 'datetime', label: 'Changed Date', readonly: true },
  related: { type: 'many2many', label: 'Related Work', relation: 'work.item' },
};

function bug(): Page {
  return {
    fieldia: '0.1',
    id: 'bug',
    title: 'Bug',
    data: { kind: 'record', model: 'work.item' },
    fields: {
      title: { type: 'char', label: 'Title' },
      state: { type: 'selection', label: 'State', options: [{ value: 'new', label: 'New' }, { value: 'active', label: 'Active' }] },
      area: { type: 'char', label: 'Area' },
      notes: { type: 'text', label: 'Notes' },
    },
    layout: {
      type: 'sheet',
      id: 'sheet',
      title: { field: 'title' },
      children: [
        {
          type: 'tabs',
          id: 'tabs-1',
          children: [
            { type: 'tab', id: 'tab-details', label: 'Details', children: [{ type: 'section', id: 'section-1', title: 'Notes', children: [{ type: 'field', id: 'f-notes', field: 'notes' }, { type: 'field', id: 'f-state', field: 'state' }, { type: 'field', id: 'f-area', field: 'area' }] }] },
            { type: 'tab', id: 'tab-history', label: 'History', children: [] },
          ],
        },
      ],
    },
  } as Page;
}

const designer = () => createDesigner({ page: bug(), model: MODEL });
const sheet = (d: Designer) => d.getPage().layout as SheetNode;
const valid = (d: Designer) => {
  const checked = validatePage(d.getPage());
  expect(checked.ok ? [] : checked.issues.map((i) => `${i.path}: ${i.message}`)).toEqual([]);
};

describe('a record head’s commands', () => {
  it('turns the head on with a work item’s first buttons, and off again', () => {
    const d = designer();
    expect(d.setHead({})).toBe(true);
    const actions = sheet(d).head?.actions as ButtonNode[];
    expect(actions.map((b) => b.label)).toEqual(['Save and Close', 'Refresh', 'Revert changes']);
    expect(actions[0]).toMatchObject({ primaryWhenChanged: true, steps: [{ do: 'save' }, { do: 'close' }], menu: [{ label: 'Save', steps: [{ do: 'save' }] }] });
    expect(actions[1]).toMatchObject({ iconOnly: true, icon: 'refresh', steps: [{ do: 'reload' }] });
    valid(d);
    expect(d.setHead(null)).toBe(true);
    expect(sheet(d).head).toBeUndefined();
    valid(d);
  });

  it('takes its kind from a choice, each kind’s look, its number; refuses a kind that is no choice and a colour not #rrggbb', () => {
    const d = designer();
    d.setHead({});
    expect(d.setHead({ kindField: 'work_type', numberField: 'number' })).toBe(true);
    expect(d.setHeadKindLook('bug', { colour: '#CC293D', icon: 'bug' })).toBe(true);
    expect(sheet(d).head?.kind).toEqual({ field: 'work_type', numberField: 'number', looks: { bug: { colour: '#cc293d', icon: 'bug' } } });
    valid(d);
    expect(d.setHead({ kindField: 'area' })).toBe(false);
    expect(d.getState().issues).toEqual(['Area holds no kinds: a kind is one of a list, or a link']);
    expect(d.setHeadKindLook('bug', { colour: 'red' })).toBe(false);
    expect(d.setHead({ kindField: null, kindLabel: 'Bug', colour: '#cc293d', icon: 'bug' })).toBe(true);
    expect(sheet(d).head?.kind).toEqual({ numberField: 'number', label: 'Bug', colour: '#cc293d', icon: 'bug' });
    valid(d);
  });

  it('adds the row’s fields and counts, the band’s fields with their access keys, and keeps their fields on any edit', () => {
    const d = designer();
    d.setHead({});
    const assigned = d.addHeadPart('meta', { field: 'area' }) as string;
    const count = d.addHeadPart('meta', { link: 'comment_count' }) as string;
    d.updateHeadLink(count, { one: 'Comment', other: 'Comments', target: 'section-1' });
    expect(d.getState().issues).toEqual([]);
    const band = d.addHeadPart('band', { field: 'state' }) as string;
    expect(d.setFieldHotkey(band, 'E')).toBe(true);
    expect(d.setFieldHotkey(band, 'ee')).toBe(false);
    expect(d.setHead({ tracks: ['274px', '1fr'], labelWidth: 76, updated: { byField: 'changed_by', atField: 'changed_date', opens: 'tab-history' } })).toBe(true);
    const head = sheet(d).head;
    expect(head?.meta).toEqual([
      { type: 'field', id: assigned, field: 'area', labels: 'hidden' },
      { type: 'link', id: count, icon: 'chat', field: 'comment_count', words: { other: 'Comments', one: 'Comment' }, target: 'section-1' },
    ]);
    expect(head?.band).toEqual({ children: [{ type: 'field', id: band, field: 'state', hotkey: 'e' }], tracks: ['274px', '1fr'], labelWidth: 76 });
    expect(head?.updated).toEqual({ byField: 'changed_by', atField: 'changed_date', opens: 'tab-history' });
    valid(d);
    // An edit elsewhere drops the fields nothing shows: never those the head shows.
    expect(d.removeNode('f-notes')).toBe(true);
    expect(Object.keys(d.getPage().fields).sort()).toEqual(['area', 'changed_by', 'changed_date', 'comment_count', 'state', 'title']);
    valid(d);
    expect(d.moveHeadPart(count, -1)).toBe(true);
    expect(sheet(d).head?.meta?.map((p) => p.id)).toEqual([count, assigned]);
    expect(d.removeHeadPart(count)).toBe(true);
    expect(d.removeHeadPart(assigned)).toBe(true);
    expect(sheet(d).head?.meta).toBeUndefined();
    expect(d.getPage().fields['comment_count']).toBeUndefined();
    valid(d);
    expect(d.addHeadPart('meta', { link: 'area' })).toBe(false);
    expect(d.setHead({ tracks: ['wide'] })).toBe(false);
    expect(d.setHead({ updated: { byField: 'changed_by', atField: 'area' } })).toBe(false);
  });

  it('gives a button its icon alone, a toggle with its words, a menu beside it, the primary look while changed', () => {
    const d = designer();
    d.setHead({});
    const follow = d.addHeadPart('actions', { button: 'Follow' }) as string;
    expect(d.getState().selected).toBe(follow);
    expect(d.setButtonParts(follow, { iconOnly: true })).toBe(false);
    expect(d.getState().issues).toEqual(['Shown by its icon alone, it needs an icon']);
    expect(d.setButtonParts(follow, { icon: 'eye', pressed: 'following', pressedLabel: 'Following', menu: [{ label: 'All changes', action: '' }], menuIcon: 'gear', menuLabel: 'Notification settings' })).toBe(true);
    const made = sheet(d).head?.actions?.find((b) => b.id === follow) as ButtonNode;
    expect(made).toMatchObject({ icon: 'eye', pressed: 'following', pressedLabel: 'Following', menuIcon: 'gear', menuLabel: 'Notification settings', menu: [{ label: 'All changes', action: 'all_changes' }] });
    valid(d);
    expect(d.setButtonParts(follow, { pressed: 'area' })).toBe(false);
    expect(d.setButtonParts(follow, { menu: null, pressed: null })).toBe(true);
    expect(sheet(d).head?.actions?.find((b) => b.id === follow)).not.toHaveProperty('menu');
    expect(sheet(d).head?.actions?.find((b) => b.id === follow)).not.toHaveProperty('pressedLabel');
    // A head's button is a header's button: its words and its key, moved and taken away.
    expect(d.updateHeaderPart(follow, { label: 'Watch' })).toBe(true);
    expect(d.removeHeaderPart(follow)).toBe(true);
    valid(d);
  });

  it('puts tabs in the head, an icon alone on a tab and a count after it; refuses them in a head the sheet has not', () => {
    const d = designer();
    expect(d.setTabsInHead('tabs-1', true)).toBe(false);
    d.setHead({});
    expect(d.setTabsInHead('tabs-1', true)).toBe(true);
    expect((sheet(d).children[0] as TabsNode).place).toBe('head');
    expect(d.setTabParts('tab-history', { iconOnly: true })).toBe(false);
    expect(d.setTabParts('tab-history', { icon: 'history', iconOnly: true, count: 'related' })).toBe(true);
    expect((sheet(d).children[0] as TabsNode).children[1]).toMatchObject({ icon: 'history', iconOnly: true, count: 'related' });
    valid(d);
    expect(d.setTabParts('tab-history', { count: 'area' })).toBe(false);
    // Off with the head, the tabs go back over the body.
    d.setHead(null);
    expect((sheet(d).children[0] as TabsNode).place).toBeUndefined();
    valid(d);
  });
});

/** A work item with a head whose Save and Close's menu has a divider and an item that opens a menu, as JSON would bring them. */
function withButtonMenu(menu: MenuItem[]): { d: Designer; id: string } {
  const d = designer();
  d.setHead({});
  const page = JSON.parse(JSON.stringify(d.getPage())) as ReturnType<typeof d.getPage>;
  const save = (page.layout as SheetNode).head?.actions?.[0] as ButtonNode;
  save.menu = menu;
  return { d: createDesigner({ page, model: MODEL }), id: save.id };
}
const menuOfButton = (d: Designer, id: string) => sheet(d).head?.actions?.find((b) => b.id === id)?.menu;
const RULE: MenuItem = { id: 'm-rule', type: 'divider' };
const MORE: MenuItem = { id: 'm-more', label: 'More', menu: [{ id: 'm-link', label: 'Copy link', icon: 'link', action: 'copy_link' }], menuFrom: 'share_targets' };
const checked = (d: Designer) => {
  const found = checkPage(d.getPage());
  expect(found.ok ? [] : found.issues.map((i) => `${i.path}: ${i.message}`)).toEqual([]);
};

describe('a button’s menu with a divider and an item that opens a menu', () => {
  it('keeps the divider a line and the item’s menu as another row is edited, and adds a divider', () => {
    const { d, id } = withButtonMenu([{ id: 'm-all', label: 'All changes', icon: 'eye', action: 'all_changes' }, RULE, MORE]);
    checked(d);
    // Another row's words: the divider stays as it is, the item that opens a menu gets no action and keeps its menu.
    expect(d.setButtonParts(id, { menu: [{ id: 'm-all', label: 'Every change', action: 'all_changes' }, { id: 'm-rule', type: 'divider' }, { id: 'm-more', label: 'More' }] })).toBe(true);
    expect(menuOfButton(d, id)).toEqual([{ id: 'm-all', label: 'Every change', icon: 'eye', action: 'all_changes' }, RULE, MORE]);
    checked(d);
    // Its own words change, its menu kept; a divider added at the end.
    expect(d.setButtonParts(id, { menu: [{ id: 'm-all', label: 'Every change', action: 'all_changes' }, { id: 'm-rule', type: 'divider' }, { id: 'm-more', label: 'Share' }, { type: 'divider' }] })).toBe(true);
    const [, , more, added] = menuOfButton(d, id) as MenuItem[];
    expect(more).toEqual({ ...MORE, label: 'Share' });
    expect(added).toEqual({ id: `${id}-menu-1`, type: 'divider' });
    checked(d);
  });

  it('shows the divider as a line and the item that opens a menu by its words alone in the panel, each kept as a row is left', () => {
    const { d, id } = withButtonMenu([{ id: 'm-all', label: 'All changes', action: 'all_changes' }, RULE, MORE]);
    const { host } = mount(d, { mode: 'advanced' });
    d.select(id);
    const row = (part: string) => host.querySelector(`[data-setting="Menu beside it"] [data-part="${part}"]`) as HTMLElement;
    expect(row('m-rule').querySelector('[role="separator"]')).not.toBeNull();
    expect(row('m-rule').querySelector('input')).toBeNull();
    expect(button(row('m-rule'), 'Remove the divider')).toBeDefined();
    // The item that opens a menu: its words, no action, and a › after them; counted after the first.
    expect([...row('m-more').querySelectorAll('input')].map((box) => box.getAttribute('aria-label'))).toEqual(['Choice’s words 2']);
    expect(row('m-more').textContent).toContain('›');
    typeAndLeave(field(host, 'Choice’s words 1'), 'Every change');
    expect(menuOfButton(d, id)).toEqual([{ id: 'm-all', label: 'Every change', action: 'all_changes' }, RULE, MORE]);
    typeAndLeave(field(host, 'Choice’s words 2'), 'Share');
    expect(menuOfButton(d, id)?.[2]).toEqual({ ...MORE, label: 'Share' });
    checked(d);
    button(host, 'Add a divider')?.click();
    expect(menuOfButton(d, id)?.map((item) => item.type ?? item.id)).toEqual(['m-all', 'divider', 'm-more', 'divider']);
    button(host, 'Add a choice')?.click();
    expect(menuOfButton(d, id)?.[4]).toEqual({ id: `${id}-menu-2`, label: 'New choice', action: 'new_choice' });
    checked(d);
    // A divider's × takes it alone away.
    button(row('m-rule'), 'Remove the divider')?.click();
    expect(menuOfButton(d, id)?.map((item) => item.type ?? item.id)).toEqual(['m-all', 'm-more', 'divider', `${id}-menu-2`]);
    checked(d);
  });
});

describe('a record head in the panel and on the canvas', () => {
  it('turns the head on from the sheet’s panel, sets its kind and adds a band field with its access key', () => {
    const d = designer();
    const { host } = mount(d, { mode: 'advanced' });
    d.select(null);
    const on = field(host, 'A head over the record') as HTMLInputElement;
    on.checked = true;
    on.dispatchEvent(new Event('change', { bubbles: true }));
    expect(sheet(d).head?.actions?.length).toBe(3);
    choose(field(host, 'Kind from'), 'work_type');
    expect(sheet(d).head?.kind?.field).toBe('work_type');
    const colour = field(host, 'Bug’s colour') as HTMLInputElement;
    colour.value = '#cc293d';
    colour.dispatchEvent(new Event('change', { bubbles: true }));
    expect(sheet(d).head?.kind?.looks?.['bug']).toEqual({ colour: '#cc293d' });
    choose(field(host, 'Add a field to the band'), 'area');
    const key = field(host, 'Area: access key') as HTMLInputElement;
    key.value = 'a';
    key.dispatchEvent(new Event('change', { bubbles: true }));
    expect(sheet(d).head?.band?.children).toEqual([expect.objectContaining({ field: 'area', hotkey: 'a' })]);
    // The canvas draws the head: its strip in the kind's colour, its badge, its buttons and its band.
    const canvasHead = host.querySelector('.fd-canvas .fd-canvas-head') as HTMLElement;
    expect(canvasHead.hidden).toBe(false);
    expect(canvasHead.style.getPropertyValue('--fd-kind')).toBe('#cc293d');
    expect(canvasHead.querySelector('.fd-head-badge')?.textContent).toBe('BUG 4127');
    expect([...canvasHead.querySelectorAll('.fd-head-actions [data-pick]')].map((b) => b.getAttribute('aria-label'))).toEqual(['Save and Close', 'Save and Close', 'Refresh', 'Revert changes']);
    expect(canvasHead.querySelector('.fd-head-fields .fd-access-key')?.textContent).toBe('A');
    // A button pressed on the canvas is picked, its own parts in the panel.
    (canvasHead.querySelector('[data-pick][aria-label="Refresh"]') as HTMLButtonElement).click();
    expect(d.getState().selected).toBe(sheet(d).head?.actions?.[1].id);
    expect((field(host, 'Its icon alone') as HTMLInputElement).checked).toBe(true);
    valid(d);
  });

  it('sets a tab’s count and icon, the tabs in the head, and a field’s access key in their panels', () => {
    const d = designer();
    d.setHead({});
    const { host } = mount(d, { mode: 'advanced' });
    d.select('tabs-1');
    openTab(host, 'Layout');
    const inHead = field(host, 'In the record’s head') as HTMLInputElement;
    inHead.checked = true;
    inHead.dispatchEvent(new Event('change', { bubbles: true }));
    expect((sheet(d).children[0] as TabsNode).place).toBe('head');
    d.select('tab-history');
    openTab(host, 'Content');
    choose(field(host, 'Count from'), 'related');
    expect((sheet(d).children[0] as TabsNode).children[1].count).toBe('related');
    d.select('f-state');
    openTab(host, 'Content');
    type(field(host, 'Access key, with Alt'), 'e');
    (field(host, 'Access key, with Alt') as HTMLInputElement).dispatchEvent(new Event('change', { bubbles: true }));
    const state = ((sheet(d).children[0] as TabsNode).children[0].children[0] as { children: { id: string; hotkey?: string }[] }).children.find((n) => n.id === 'f-state');
    expect(state?.hotkey).toBe('e');
    expect(button(host, 'Delete')).toBeDefined();
    valid(d);
  });
});
