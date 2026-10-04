import type { Field, FieldNode, Page, SectionNode } from '@fieldia/core';
import { elementFactory } from './chrome';
import { blankPage, createDesigner } from './designer';
import { inspectorShell } from './panel-inspector';
import { button, field, mount, press } from './test-editor';

/**
 * The panel as tabs — Content, Layout, Look, Rules, Data — headed by what is
 * picked, only the tabs that apply to it, one shown at a time; and every
 * setting the panel had before it had tabs, still there in one of them.
 */

const sectionsOf = (page: Page) => (page.layout as { children: SectionNode[] }).children;

/** A visit report: Customer, Date, Notes and Call back? in one section, Next step in another. */
function visitReport(model?: Record<string, Field>) {
  const designer = createDesigner({ page: blankPage('screen', 'Visit report'), model });
  const ids: Record<string, string> = {};
  const add = (key: string, kind: string, label: string, parent: string) => {
    ids[key] = designer.addQuestion(kind, { parent }) as string;
    designer.updateQuestion(ids[key], { label });
  };
  add('customer', 'short-answer', 'Customer', 'section-1');
  add('date', 'date', 'Date', 'section-1');
  add('notes', 'paragraph', 'Notes', 'section-1');
  add('call', 'yes-no', 'Call back?', 'section-1');
  const second = designer.addContainer('Follow-up') as string;
  add('next', 'dropdown', 'Next step', second);
  designer.select(null);
  return { designer, ids, sections: ['section-1', second] };
}

const panel = (host: Element) => host.querySelector('.fd-properties') as HTMLElement;
const tabButtons = (host: Element) => [...panel(host).querySelectorAll<HTMLButtonElement>('[role="tab"]')];
const tabs = (host: Element) => tabButtons(host).map((t) => t.textContent);
const chosen = (host: Element) => tabButtons(host).find((t) => t.getAttribute('aria-selected') === 'true')?.textContent;
const openTab = (host: Element, name: string) => {
  const tab = tabButtons(host).find((t) => t.textContent === name);
  if (!tab) throw new Error(`No tab ${name}: ${tabs(host).join(', ')}`);
  tab.click();
};
/** The panel of the tab chosen. */
const shown = (host: Element) => panel(host).querySelector('[role="tabpanel"]:not([hidden])') as HTMLElement;
const head = (host: Element) => [panel(host).querySelector('.fd-panel-title')?.textContent, panel(host).querySelector('.fd-insp-name')?.textContent];

/** A control on show in the tab chosen, by its name: a box, a button, or a group of choices. */
function control(scope: Element, name: string): Element | undefined {
  return field(scope, name) ?? button(scope, name) ?? [...scope.querySelectorAll('[role="group"]')].find((g) => g.getAttribute('aria-label') === name && !g.closest('[hidden]'));
}

/** The tab a control is in, looking in each tab as a person would. */
function tabOf(host: Element, name: string): string | null {
  for (const tab of tabs(host)) {
    openTab(host, tab as string);
    if (control(shown(host), name)) return tab;
  }
  return null;
}

describe('the panel — tabs', () => {
  it('heads a field with its kind and name, and gives it Content, Layout, Rules and Data', () => {
    const { designer, ids } = visitReport();
    const { host } = mount(designer, { mode: 'advanced' });
    designer.select(ids['next']);
    expect(head(host)).toEqual(['Dropdown', 'Next step']);
    expect(tabs(host)).toEqual(['Content', 'Layout', 'Rules', 'Data']);
    expect(chosen(host)).toBe('Content');
    // One tab's settings at a time, the panel named by its tab.
    const panels = [...panel(host).querySelectorAll('[role="tabpanel"]')];
    expect(panels.filter((p) => !(p as HTMLElement).hidden)).toHaveLength(1);
    expect(shown(host).getAttribute('aria-labelledby')).toBe(tabButtons(host)[0].id);
    expect(control(shown(host), 'Label')).toBeDefined();
    expect(control(shown(host), 'Width')).toBeUndefined();
    openTab(host, 'Layout');
    expect(control(shown(host), 'Width')).toBeDefined();
    expect(control(shown(host), 'Label')).toBeUndefined();
  });

  it('says a field is from the model, and what it is stored under', () => {
    const { designer } = visitReport({ credit_limit: { type: 'monetary', label: 'Credit limit', currency: 'EGP' } });
    const { host } = mount(designer, { mode: 'advanced' });
    const id = designer.addModelField('credit_limit', { parent: 'section-1' }) as string;
    designer.select(id);
    expect(head(host)).toEqual(['Amount', 'Credit limit']);
    expect(panel(host).querySelector('.fd-insp-kind')?.textContent).toBe('Amount · from the model');
    openTab(host, 'Data');
    expect(shown(host).querySelector('[data-setting="Field name"] code')?.textContent).toBe('credit_limit');
    expect(shown(host).querySelector('[data-setting="Stored as"] .fd-insp-chip')?.textContent).toBe('An amount · from your model');
    expect(shown(host).textContent).toContain('Its currency comes from the model.');
  });

  it('gives a group Content, Layout, Look and Rules, and the page Content, Layout and Look', () => {
    const { designer, sections } = visitReport();
    const { host } = mount(designer, { mode: 'advanced' });
    expect(head(host)).toEqual(['Screen', 'Visit report']);
    expect(tabs(host)).toEqual(['Content', 'Layout', 'Look']);
    designer.select(sections[1]);
    expect(head(host)).toEqual(['Group', 'Follow-up']);
    expect(tabs(host)).toEqual(['Content', 'Layout', 'Look', 'Rules']);
  });

  it('keeps the tab when another part of the same kind is picked; a part of another kind keeps its own', () => {
    const { designer, ids, sections } = visitReport();
    const { host } = mount(designer, { mode: 'advanced' });
    designer.select(ids['customer']);
    openTab(host, 'Rules');
    designer.select(ids['date']);
    expect(chosen(host)).toBe('Rules');
    designer.select(sections[1]);
    expect(chosen(host)).toBe('Content');
    openTab(host, 'Layout');
    designer.select(ids['next']);
    expect(chosen(host)).toBe('Rules');
    designer.select(sections[0]);
    expect(chosen(host)).toBe('Layout');
  });

  it('goes along the tabs with the arrow keys, the panel following', () => {
    const { designer, ids } = visitReport();
    const { host } = mount(designer, { mode: 'advanced' });
    designer.select(ids['customer']);
    tabButtons(host)[0].focus();
    press('ArrowRight', {}, tabButtons(host)[0]);
    expect(chosen(host)).toBe('Layout');
    expect(document.activeElement).toBe(tabButtons(host)[1]);
    expect(control(shown(host), 'Width')).toBeDefined();
    press('End', {}, tabButtons(host)[1]);
    expect(chosen(host)).toBe('Data');
    press('Home', {}, tabButtons(host)[3]);
    expect(chosen(host)).toBe('Content');
  });

  it('opens Rules when the bar on a field asks when it shows', () => {
    const { designer, ids } = visitReport();
    const { host } = mount(designer, { mode: 'advanced' });
    const card = () => host.querySelector(`.fd-canvas-field[data-node="${ids['notes']}"]`) as HTMLElement;
    card().click();
    button(card(), 'Show only when…')?.click();
    expect(chosen(host)).toBe('Rules');
    expect(shown(host).querySelector('.fd-when-rule')).not.toBeNull();
  });

  it('says Several, and how many, when several are picked', () => {
    const { designer, ids } = visitReport();
    const { host } = mount(designer, { mode: 'advanced' });
    designer.pick(ids['customer']);
    designer.pick(ids['date'], { add: true });
    expect(head(host)).toEqual(['Several', '2 parts picked']);
    expect(tabs(host)).toEqual(['Layout']);
  });

  it('puts no setting on a tab that does not apply, and shows no empty tab', () => {
    const { designer, ids, sections } = visitReport();
    const { host } = mount(designer, { mode: 'advanced' });
    for (const id of [null, ids['next'], ids['call'], sections[0]]) {
      designer.select(id);
      const names = tabs(host);
      for (const p of panel(host).querySelectorAll<HTMLElement>('[role="tabpanel"]')) {
        expect(names).toContain(panel(host).querySelector(`#${p.getAttribute('aria-labelledby')}`)?.textContent);
        expect(p.querySelector('[data-setting]')).not.toBeNull();
      }
    }
  });
});

describe('the panel — its tabs and what goes on them', () => {
  it('shows a row on its tab, and none for a tab that does not apply to what is picked', () => {
    const el = elementFactory(document);
    const shell = inspectorShell(el, document);
    document.body.append(shell.element);
    const row = (tab: string, name: string) => el('div', { 'data-tab': tab, 'data-setting': name }, el('input', { 'aria-label': name }));
    // A tab has only Content: a row for its look is shown nowhere.
    shell.show('tab', { element: el('div', {}, row('content', 'Label'), row('look', 'Style')), update: () => undefined });
    expect([...shell.element.querySelectorAll('[role="tab"]')].map((t) => t.textContent)).toEqual(['Content']);
    expect(shell.element.querySelector('[data-setting="Style"]')).toBeNull();
    expect(shell.rows().map((r) => r.name)).toEqual(['Label']);
    // A part with Content and Layout, but nothing for its Layout: no Layout tab.
    shell.show('block', { element: el('div', {}, row('content', 'Words')), update: () => undefined });
    expect([...shell.element.querySelectorAll('[role="tab"]')].map((t) => t.textContent)).toEqual(['Content']);
    document.body.replaceChildren();
  });
});

describe('the panel — no setting lost', () => {
  /** Every control the panel had before it had tabs, by name, for each kind of part. */
  const BEFORE: Record<string, string[]> = {
    field: ['Label', 'Shown as', 'Option 1', 'Add option', 'Required', 'Required only when…', 'Read-only when…', 'Help text', 'Width', 'Section', 'Show only when…', 'Duplicate', 'Delete field'],
    lines: ['Add column', 'Column 1', 'Kind of column 1'],
    link: ['Links to'],
    amount: ['Currency'],
    // Columns, a list of counts once, are now a count for each size of screen.
    section: ['Section title', 'Columns on a desktop', 'Move up', 'Delete section'],
    page: ['Layout'],
    sheet: ['Layout', 'Title field'],
    tabs: ['Delete tabs'],
    tab: ['Tab label', 'Delete tab', 'Move right'],
  };

  function reachable(host: Element, names: string[]) {
    return Object.fromEntries(names.map((name) => [name, tabOf(host, name)]));
  }
  const everywhere = (names: string[]) => Object.fromEntries(names.map((name) => [name, expect.any(String)]));

  it('reaches every control a field, a section and the page had, in some tab', () => {
    const { designer, ids, sections } = visitReport();
    const { host } = mount(designer, { mode: 'advanced' });
    // A dropdown picked whose rules can test “Call back?”.
    const next = sectionsOf(designer.getPage())[1].children[0] as FieldNode;
    designer.placeNode(ids['call'], sections[1], 0);
    designer.select(next.id);
    expect(reachable(host, BEFORE['field'])).toEqual(everywhere(BEFORE['field']));
    for (const [kind, key] of [['lines', 'lines'], ['link', 'link'], ['amount', 'amount']]) {
      const id = designer.addQuestion(kind, { parent: sections[0] }) as string;
      designer.select(id);
      expect(reachable(host, BEFORE[key])).toEqual(everywhere(BEFORE[key]));
    }
    designer.select(sections[1]);
    expect(reachable(host, BEFORE['section'])).toEqual(everywhere(BEFORE['section']));
    designer.select(null);
    expect(reachable(host, BEFORE['page'])).toEqual(everywhere(BEFORE['page']));
  });

  it('reaches every control a sheet, its tabs and a tab had, in some tab', () => {
    const designer = createDesigner({ page: blankPage('sheet', 'Customer') });
    const { host } = mount(designer, { mode: 'advanced' });
    expect(reachable(host, BEFORE['sheet'])).toEqual(everywhere(BEFORE['sheet']));
    const tabsId = designer.addTabs() as string;
    designer.addTab(tabsId, 'Tab 2');
    designer.select(tabsId);
    expect(reachable(host, BEFORE['tabs'])).toEqual(everywhere(BEFORE['tabs']));
    const firstTab = (designer.getPage().layout as { children: { id: string; children?: { id: string }[] }[] }).children.find((n) => n.id === tabsId)?.children?.[0].id as string;
    designer.select(firstTab);
    expect(reachable(host, BEFORE['tab'])).toEqual(everywhere(BEFORE['tab']));
  });
});
