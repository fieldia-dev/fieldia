import type { FieldNode, Page, SheetNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { button, choose, field, mount, openTab } from './test-editor';

/**
 * How a record sheet reads, set in the screen editor: read-only fields as
 * words, a choice as a coloured badge, stat buttons that format what they
 * show, links' pictures and colours, parts on one line, alerts with a field's
 * value and buttons, the statusbar's condition and steps, keys on buttons,
 * parts for editing or reading only, and several ribbons. Each command is
 * one undo step; what cannot be done is refused in words.
 */

function sheet(): Page {
  const page = blankPage('screen', 'Invoice');
  page.data = { kind: 'record', model: 'account.move' };
  page.fields = {
    name: { type: 'char', label: 'Number' },
    risk: { type: 'selection', label: 'Risk', options: [{ value: 'low', label: 'Low' }, { value: 'high', label: 'High' }] },
    state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'posted', label: 'Posted' }] },
    total: { type: 'monetary', label: 'Total', currency: 'EGP' },
    hours: { type: 'float', label: 'Hours' },
    unit: { type: 'char', label: 'Unit' },
    partner: { type: 'many2one', label: 'Customer', relation: 'res.partner' },
    tags: { type: 'many2many', label: 'Tags', relation: 'tag' },
  };
  page.layout = {
    type: 'sheet',
    id: 'root',
    title: { field: 'name' },
    children: [{ type: 'section', id: 'main', children: [
      { type: 'field', id: 'f-risk', field: 'risk' },
      { type: 'field', id: 'f-state', field: 'state' },
      { type: 'field', id: 'f-total', field: 'total' },
      { type: 'field', id: 'f-hours', field: 'hours' },
      { type: 'field', id: 'f-unit', field: 'unit' },
      { type: 'field', id: 'f-partner', field: 'partner' },
      { type: 'field', id: 'f-tags', field: 'tags' },
    ] }],
  };
  return page;
}
const nodeOf = (page: Page, id: string) => ((page.layout as SheetNode).children[0] as { children: FieldNode[] }).children.find((n) => n.id === id) as FieldNode;
const pick = (host: Element, setting: string, words: string) =>
  ([...host.querySelectorAll<HTMLButtonElement>(`[data-setting="${setting}"] button`)].find((b) => b.textContent?.trim() === words) as HTMLButtonElement).click();

describe('read-only fields as words', () => {
  it('is the page’s, on the Look tab, and one undo step', () => {
    const designer = createDesigner({ page: sheet() });
    const { host } = mount(designer, { mode: 'advanced' });
    openTab(host, 'Look');
    pick(host, 'Read-only fields', 'As words');
    expect(designer.getPage().look?.readonlyShown).toBe('text');
    pick(host, 'Read-only fields', 'In boxes');
    expect(designer.getPage().look?.readonlyShown).toBe('box');
    designer.undo();
    designer.undo();
    expect(designer.getPage().look?.readonlyShown).toBeUndefined();
  });
});

describe('a choice as a coloured badge', () => {
  it('turns a dropdown into a badge, a colour for each option, and back', () => {
    const designer = createDesigner({ page: sheet() });
    designer.select('f-risk');
    const { host } = mount(designer, { mode: 'advanced' });
    (button(host, 'Coloured badge') as HTMLButtonElement).click();
    expect(nodeOf(designer.getPage(), 'f-risk').widget).toBe('badge');
    choose(field(host, 'Colour for High'), 'danger');
    choose(field(host, 'Colour for Low'), 'success');
    expect(nodeOf(designer.getPage(), 'f-risk').options).toEqual({ tones: { high: 'danger', low: 'success' } });
    choose(field(host, 'Colour for Low'), '');
    expect(nodeOf(designer.getPage(), 'f-risk').options).toEqual({ tones: { high: 'danger' } });
    designer.undo();
    expect(nodeOf(designer.getPage(), 'f-risk').options).toEqual({ tones: { high: 'danger', low: 'success' } });
    (button(host, 'Coloured badge') as HTMLButtonElement).click();
    expect(nodeOf(designer.getPage(), 'f-risk').widget).toBeUndefined();
    expect(nodeOf(designer.getPage(), 'f-risk').options).toBeUndefined();
  });

  it('refuses a badge on what is not one choice of a list', () => {
    const designer = createDesigner({ page: sheet() });
    expect(designer.setBadge('f-total', true)).toBe(false);
    expect(designer.getState().issues.join(' ')).toMatch(/one choice of a list/i);
  });
});

describe('ribbons', () => {
  it('adds several from the canvas, each with its colour, words from a field and a tooltip, one undo step each', () => {
    const designer = createDesigner({ page: sheet() });
    const { host } = mount(designer, { mode: 'advanced' });
    (host.querySelector('[data-add-part="ribbon"]') as HTMLButtonElement).click();
    (host.querySelector('[data-add-part="ribbon"]') as HTMLButtonElement).click();
    const ribbons = () => (designer.getPage().layout as SheetNode).ribbons ?? [];
    expect(ribbons().map((r) => r.label)).toEqual(['Ribbon', 'Ribbon']);
    const second = ribbons()[1].id;
    expect(designer.getState().selected).toBe(second);
    choose(field(host, 'Tone'), 'danger');
    choose(field(host, 'Words from a field'), 'state');
    const tooltip = field(host, 'Words on pointing at it') as HTMLInputElement;
    tooltip.value = 'Lost to a competitor';
    tooltip.dispatchEvent(new Event('input', { bubbles: true }));
    expect(ribbons()[1]).toEqual({ id: second, label: 'Ribbon', tone: 'danger', labelField: 'state', tooltip: 'Lost to a competitor' });
    designer.undo();
    expect(ribbons()[1].tooltip).toBeUndefined();
    // Its condition, as any part's.
    expect(host.querySelector('.fd-q-when')).not.toBeNull();
  });

  it('takes a page’s one ribbon into the list as it is edited, and says what changed', () => {
    const page = sheet();
    (page.layout as SheetNode).ribbon = { id: 'old', label: 'Archived', tone: 'muted' };
    const designer = createDesigner({ page });
    designer.addHeaderPart('ribbon', 'Paid');
    const root = designer.getPage().layout as SheetNode;
    expect(root.ribbon).toBeUndefined();
    expect(root.ribbons?.map((r) => r.label)).toEqual(['Archived', 'Paid']);
    expect(designer.moveHeaderPart(root.ribbons?.[1].id as string, -1)).toBe(true);
    expect((designer.getPage().layout as SheetNode).ribbons?.map((r) => r.label)).toEqual(['Paid', 'Archived']);
    expect(designer.updateHeaderPart('old', { dismissible: true })).toBe(false);
    expect(designer.getState().issues.join(' ')).toMatch(/only an alert can be closed/i);
  });
});

describe('alerts', () => {
  it('adds one from the canvas with a field’s value in its words, words from a field, a ×, and buttons inside', () => {
    const designer = createDesigner({ page: sheet() });
    const { host } = mount(designer, { mode: 'advanced' });
    (host.querySelector('[data-add-part="alert"]') as HTMLButtonElement).click();
    const alert = () => (designer.getPage().layout as SheetNode).alerts?.[0] as NonNullable<SheetNode['alerts']>[number];
    expect(alert().message).toBe('Something to know about this record.');
    const words = field(host, 'Words') as HTMLInputElement;
    words.value = 'Over the limit by';
    words.dispatchEvent(new Event('input', { bubbles: true }));
    choose(field(host, 'Show a field’s value in the words'), 'total');
    expect(alert().message).toBe('Over the limit by {total}');
    choose(field(host, 'Words from a field'), 'unit');
    (host.querySelector('input[aria-label="Can be closed"]') as HTMLInputElement).click();
    (button(host, 'Add a button inside') as HTMLButtonElement).click();
    expect(alert().messageField).toBe('unit');
    expect(alert().dismissible).toBe(true);
    expect(alert().buttons?.map((b) => [b.label, b.action])).toEqual([['New button', 'new_button']]);
    const action = host.querySelector('.fd-alert-button-row input[aria-label="Action"]') as HTMLInputElement;
    action.value = 'open_duplicate';
    action.dispatchEvent(new Event('change', { bubbles: true }));
    expect(alert().buttons?.[0].action).toBe('open_duplicate');
    (host.querySelector('.fd-alert-button-row [aria-label="Remove New button"]') as HTMLButtonElement).click();
    expect(alert().buttons).toBeUndefined();
    // The canvas draws it as the viewer does.
    expect(host.querySelector(`.fd-canvas-alerts .fd-alert[data-part="${alert().id}"]`)).not.toBeNull();
  });

  it('puts words in an alert’s box among the parts, in a colour', () => {
    const page = sheet();
    ((page.layout as SheetNode).children[0] as { children: unknown[] }).children.push({ type: 'text', id: 't-note', text: 'Top up {total}.' });
    const designer = createDesigner({ page });
    designer.select('t-note');
    const { host } = mount(designer, { mode: 'advanced' });
    pick(host, 'Reads as', 'Alert');
    pick(host, 'Alert colour', 'Amber');
    const text = () => ((designer.getPage().layout as SheetNode).children[0] as { children: { id: string; style?: string; tone?: string }[] }).children.find((n) => n.id === 't-note');
    expect(text()).toMatchObject({ style: 'alert', tone: 'warning' });
    pick(host, 'Reads as', 'Words');
    expect(text()?.tone).toBeUndefined();
    expect(designer.updateBlock('t-note', { tone: 'danger' })).toBe(false);
  });
});

describe('stat buttons that say more', () => {
  it('shows an amount, a date or words, with a unit, words from a field and a second value, each one undo step', () => {
    const designer = createDesigner({ page: sheet() });
    const id = designer.addHeaderPart('stat', 'Hours') as string;
    const { host } = mount(designer, { mode: 'advanced' });
    choose(field(host, 'Number from'), 'total');
    choose(field(host, 'Second value from'), 'hours');
    const words = field(host, 'Second value’s words') as HTMLInputElement;
    words.value = 'Out';
    words.dispatchEvent(new Event('input', { bubbles: true }));
    const unit = field(host, 'Words after the value') as HTMLInputElement;
    unit.value = 'Days';
    unit.dispatchEvent(new Event('input', { bubbles: true }));
    choose(field(host, 'Words after it from a field'), 'unit');
    choose(field(host, 'Its words from a field'), 'state');
    const stat = () => (designer.getPage().layout as SheetNode).statButtons?.find((s) => s.id === id);
    expect(stat()).toMatchObject({ field: 'total', secondField: 'hours', secondLabel: 'Out', unit: 'Days', unitField: 'unit', labelField: 'state' });
    designer.undo();
    expect(stat()?.labelField).toBeUndefined();
    // The second value gone, its words go with it.
    choose(field(host, 'Second value from'), '');
    expect(stat()?.secondField).toBeUndefined();
    expect(stat()?.secondLabel).toBeUndefined();
  });

  it('refuses a value that is no number, amount, date or words, and second words with no second value', () => {
    const designer = createDesigner({ page: sheet() });
    const id = designer.addHeaderPart('stat', 'Tags') as string;
    expect(designer.updateHeaderPart(id, { field: 'tags' })).toBe(false);
    expect(designer.getState().issues.join(' ')).toMatch(/a number, an amount, a date or words/);
    expect(designer.updateHeaderPart(id, { secondLabel: 'Out' })).toBe(false);
    expect(designer.updateHeaderPart('nope', { unit: 'x' })).toBe(false);
  });
});

describe('the status steps', () => {
  function staged() {
    const page = sheet();
    page.fields['stage'] = { type: 'many2one', label: 'Stage', relation: 'crm.stage' };
    page.fields['times'] = { type: 'json', label: 'Time per stage' };
    page.fields['active'] = { type: 'boolean', label: 'Active' };
    ((page.layout as SheetNode).children[0] as { children: unknown[] }).children.push({ type: 'field', id: 'f-active', field: 'active' }, { type: 'field', id: 'f-times', field: 'times', invisible: true });
    return createDesigner({ page });
  }

  it('come from a link’s stages too, folded under More, with the time per step and a click that saves', () => {
    const designer = staged();
    expect(designer.setStatusbar('stage', { clickable: true })).toBe(true);
    designer.select('#statusbar');
    const { host } = mount(designer, { mode: 'advanced' });
    choose(field(host, 'Time per step from'), 'times');
    (host.querySelector('input[aria-label="Folded stages go under More"]') as HTMLInputElement).click();
    (host.querySelector('input[aria-label="A click saves the record"]') as HTMLInputElement).click();
    expect((designer.getPage().layout as SheetNode).statusbar).toEqual({ field: 'stage', clickable: true, durationsField: 'times', fold: true, saves: true });
    designer.undo();
    expect((designer.getPage().layout as SheetNode).statusbar?.saves).toBeUndefined();
  });

  it('show only when a rule holds, as any part does', () => {
    const designer = staged();
    designer.setStatusbar('state');
    expect(designer.setCondition('#statusbar', { field: 'active', equals: false })).toBe(true);
    expect((designer.getPage().layout as SheetNode).statusbar?.invisible).toBeDefined();
    expect(designer.setCondition('#statusbar', null)).toBe(true);
    expect((designer.getPage().layout as SheetNode).statusbar?.invisible).toBeUndefined();
  });

  it('refuse folding a choice’s steps, time from what is not JSON, and a save no click can make', () => {
    const designer = staged();
    expect(designer.setStatusbar('state', { fold: true })).toBe(false);
    expect(designer.setStatusbar('stage', { durationsField: 'name' })).toBe(false);
    expect(designer.getState().issues.join(' ')).toMatch(/JSON/);
    expect(designer.setStatusbar('stage', { saves: true })).toBe(false);
  });
});

describe('a key on a button', () => {
  it('is typed as a person says it, kept as the page writes it, one undo step, on a header’s button and a section’s', () => {
    const page = sheet();
    ((page.layout as SheetNode).children[0] as { children: unknown[] }).children.push({ type: 'button', id: 'b-in', label: 'Update prices', action: 'update' });
    const designer = createDesigner({ page });
    const header = designer.addHeaderPart('button', 'Confirm') as string;
    const { host } = mount(designer, { mode: 'advanced' });
    const key = field(host, 'Key, with Alt') as HTMLInputElement;
    key.value = 'Alt+Shift+G';
    key.dispatchEvent(new Event('change', { bubbles: true }));
    expect((designer.getPage().layout as SheetNode).buttons?.find((b) => b.id === header)?.hotkey).toBe('shift+g');
    expect((field(host, 'Key, with Alt') as HTMLInputElement).value).toBe('Shift+G');
    designer.undo();
    expect((designer.getPage().layout as SheetNode).buttons?.find((b) => b.id === header)?.hotkey).toBeUndefined();
    designer.select('b-in');
    const blockKey = field(host, 'Key, with Alt') as HTMLInputElement;
    blockKey.value = 'u';
    blockKey.dispatchEvent(new Event('change', { bubbles: true }));
    expect(((designer.getPage().layout as SheetNode).children[0] as { children: { id: string; hotkey?: string }[] }).children.find((n) => n.id === 'b-in')?.hotkey).toBe('u');
  });

  it('refuses two letters, a key the browser keeps, and a key on what is not a button', () => {
    const designer = createDesigner({ page: sheet() });
    const button = designer.addHeaderPart('button', 'Confirm') as string;
    expect(designer.updateHeaderPart(button, { hotkey: 'ab' })).toBe(false);
    expect(designer.getState().issues.join(' ')).toMatch(/one letter or digit/);
    expect(designer.updateHeaderPart(button, { hotkey: 'D' })).toBe(false);
    expect(designer.getState().issues.join(' ')).toMatch(/Alt\+D is the browser’s own/);
    const badge = designer.addHeaderPart('badge', 'VIP') as string;
    expect(designer.updateHeaderPart(badge, { hotkey: 'v' })).toBe(false);
  });
});

describe('parts shown only while editing, or only while reading', () => {
  it('is set on a field’s Rules, kept apart from when it shows by a rule, one undo step', () => {
    const designer = createDesigner({ page: sheet() });
    designer.select('f-unit');
    const { host } = mount(designer, { mode: 'advanced' });
    openTab(host, 'Rules');
    pick(host, 'Shown while', 'Editing');
    expect(nodeOf(designer.getPage(), 'f-unit').invisible).toBe('not editing');
    // A rule on another field joins it, and taking the rule away keeps it.
    expect(designer.setCondition('f-unit', { field: 'state', equals: 'draft' })).toBe(true);
    expect(nodeOf(designer.getPage(), 'f-unit').invisible).toBe("(state != 'draft') or not editing");
    pick(host, 'Shown while', 'Reading');
    expect(nodeOf(designer.getPage(), 'f-unit').invisible).toBe("(state != 'draft') or editing");
    expect(designer.setCondition('f-unit', null)).toBe(true);
    expect(nodeOf(designer.getPage(), 'f-unit').invisible).toBe('editing');
    pick(host, 'Shown while', 'Always');
    expect(nodeOf(designer.getPage(), 'f-unit').invisible).toBeUndefined();
    designer.undo();
    expect(nodeOf(designer.getPage(), 'f-unit').invisible).toBe('editing');
  });

  it('is offered for a header’s button and for words among the parts', () => {
    const page = sheet();
    ((page.layout as SheetNode).children[0] as { children: unknown[] }).children.push({ type: 'text', id: 't-warn', text: 'Changes reach every open order.' });
    const designer = createDesigner({ page });
    const button = designer.addHeaderPart('button', 'Create company') as string;
    const { host } = mount(designer, { mode: 'advanced' });
    pick(host, 'Shown while', 'Editing');
    expect((designer.getPage().layout as SheetNode).buttons?.find((b) => b.id === button)?.invisible).toBe('not editing');
    designer.select('t-warn');
    pick(host, 'Shown while', 'Editing');
    expect(((designer.getPage().layout as SheetNode).children[0] as { children: { id: string; invisible?: string }[] }).children.find((n) => n.id === 't-warn')?.invisible).toBe('not editing');
  });
});

describe('how a link shows its record', () => {
  const switchOf = (host: Element, label: string) => host.querySelector(`.fd-properties [role="switch"][aria-label="${label}"]`) as HTMLButtonElement;

  it('takes a picture, lines under it, and no button to open it, one undo step each', () => {
    const designer = createDesigner({ page: sheet() });
    designer.select('f-partner');
    const { host } = mount(designer, { mode: 'advanced' });
    switchOf(host, 'Picture').click();
    switchOf(host, 'Lines under it').click();
    expect(switchOf(host, 'Opens its record').getAttribute('aria-checked')).toBe('true');
    switchOf(host, 'Opens its record').click();
    expect(nodeOf(designer.getPage(), 'f-partner').options).toEqual({ avatar: true, details: true, open: false });
    expect(switchOf(host, 'Opens its record').getAttribute('aria-checked')).toBe('false');
    designer.undo();
    expect(nodeOf(designer.getPage(), 'f-partner').options).toEqual({ avatar: true, details: true });
  });

  it('colours tags by their record, and is the page’s to set even on a field of the model', () => {
    const page = sheet();
    const tags = page.fields['tags'];
    delete page.fields['tags'];
    ((page.layout as SheetNode).children[0] as { children: FieldNode[] }).children = ((page.layout as SheetNode).children[0] as { children: FieldNode[] }).children.filter((n) => n.id !== 'f-tags');
    const designer = createDesigner({ page, model: { tags } });
    const id = designer.addModelField('tags') as string;
    designer.select(id);
    const { host } = mount(designer, { mode: 'advanced' });
    // What it points to is the model's: no box for it.
    expect(host.querySelector('.fd-properties input[aria-label="Links to"]')).toBeNull();
    switchOf(host, 'Colours').click();
    expect(nodeOf(designer.getPage(), id).options).toEqual({ colors: true });
  });
});

describe('parts on one line, and words over the title', () => {
  function lined() {
    const page = sheet();
    const main = (page.layout as SheetNode).children[0] as { children: unknown[] };
    main.children.push({ type: 'section', id: 'price', title: 'Price', columns: 2, children: [{ type: 'field', id: 'f-p', field: 'hours' }, { type: 'text', id: 't-at', text: 'at' }, { type: 'button', id: 'b-up', label: 'Update', action: 'update' }] });
    return createDesigner({ page });
  }
  const section = (designer: ReturnType<typeof createDesigner>, id: string) =>
    ((designer.getPage().layout as SheetNode).children[0] as { children: { id: string; style?: string; columns?: unknown }[] }).children.find((n) => n.id === id);

  it('draws a group on one line from its Look, dropping its columns, one undo step', () => {
    const designer = lined();
    designer.select('price');
    const { host } = mount(designer, { mode: 'advanced' });
    openTab(host, 'Look');
    pick(host, 'Style', 'One line');
    expect(section(designer, 'price')).toMatchObject({ style: 'inline' });
    expect(section(designer, 'price')?.columns).toBeUndefined();
    designer.undo();
    expect(section(designer, 'price')).toMatchObject({ columns: 2 });
  });

  it('refuses a line holding a group', () => {
    const designer = createDesigner({ page: sheet() });
    expect(designer.setSectionLook('main', { style: 'inline' })).toBe(true);
    const page = sheet();
    ((page.layout as SheetNode).children[0] as { children: unknown[] }).children.push({ type: 'section', id: 'inner', children: [] });
    const other = createDesigner({ page });
    expect(other.setSectionLook('main', { style: 'inline' })).toBe(false);
    expect(other.getState().issues.join(' ')).toMatch(/A line holds fields, words and buttons/);
  });

  it('puts words over the title from the screen’s own settings', () => {
    const designer = createDesigner({ page: sheet() });
    const { host } = mount(designer, { mode: 'advanced' });
    const box = field(host, 'Words over the title') as HTMLInputElement;
    box.value = 'Invoice number';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    expect((designer.getPage().layout as SheetNode).title?.label).toBe('Invoice number');
    box.value = '';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    expect((designer.getPage().layout as SheetNode).title?.label).toBeUndefined();
  });
});
