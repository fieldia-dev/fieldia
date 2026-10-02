import type { SectionNode, SheetNode, TabsNode } from '@fieldia/core';
import { blankPage, createDesigner, createMemoryPageStore } from './designer';
import { button, choose, field, mount, type } from './test-screen';

const sheet = (designer: ReturnType<typeof createDesigner>) => designer.getPage().layout as SheetNode;
const strip = (host: Element) => [...host.querySelectorAll('.fd-canvas-tabs [role="tab"]')].map((tab) => `${tab.textContent}${tab.getAttribute('aria-selected') === 'true' ? ' *' : ''}`);
const shown = (host: Element, id: string) => {
  const element = host.querySelector(`[data-node="${id}"]`) as HTMLElement | null;
  return !!element && element.isConnected && !element.closest('[hidden]');
};

function sheetDesigner() {
  const designer = createDesigner({ page: blankPage('sheet', 'Customer'), store: createMemoryPageStore() });
  const email = designer.addQuestion('email', { parent: 'section-1' }) as string;
  designer.updateQuestion(email, { label: 'Email' });
  designer.select(null);
  return { designer, email };
}

describe('screen editor — a record sheet', () => {
  it('turns a screen into a sheet from the screen’s settings, and shows the title over the canvas', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Visit') });
    const company = designer.addQuestion('short-answer') as string;
    designer.updateQuestion(company, { label: 'Company' });
    designer.select(null);
    const { host, boardOf } = mount(designer);
    const title = host.querySelector('.fd-canvas-title') as HTMLElement;
    expect(title.hidden).toBe(true);
    expect(field(host, 'Title field')).toBeUndefined();
    choose(field(host, 'Layout'), 'sheet');
    expect(designer.getPage().layout.type).toBe('sheet');
    expect(button(host, 'Add tabs')).toBeTruthy();
    choose(field(host, 'Title field'), company);
    expect(sheet(designer).title?.placeholder).toBe('Company');
    expect(title.hidden).toBe(false);
    expect(title.textContent).toBe('Company');
    // The field left its section's board for the title.
    expect(boardOf('section-1')).toBeUndefined();
    expect(host.querySelector('[data-node="section-1"] .fd-canvas-empty')?.closest('[hidden]')).toBeNull();
  });

  it('adds tabs: a strip of them, each showing its own sections', () => {
    const { designer } = sheetDesigner();
    const { host, boardOf } = mount(designer);
    expect(button(host, 'Add tabs')).toBeTruthy();
    button(host, 'Add tabs').click();
    const tabs = sheet(designer).children.find((n) => n.type === 'tabs') as TabsNode;
    expect(strip(host)).toEqual(['Tab 1 *']);
    expect(shown(host, tabs.children[0].children[0].id)).toBe(true);
    // One set of tabs to a sheet, as a record has.
    expect(button(host, 'Add tabs')).toBeUndefined();
    button(host, 'Add tab').click();
    const second = (sheet(designer).children.find((n) => n.type === 'tabs') as TabsNode).children[1];
    expect(strip(host)).toEqual(['Tab 1', 'Tab 2 *']);
    expect(shown(host, second.children[0].id)).toBe(true);
    expect(shown(host, tabs.children[0].children[0].id)).toBe(false);
    // A field added now goes into the tab on show.
    (host.querySelector('.fd-palette-item[data-kind="paragraph"]') as HTMLButtonElement).click();
    const inTab = (second.children[0] as SectionNode).id;
    expect(((sheet(designer).children.find((n) => n.type === 'tabs') as TabsNode).children[1].children[0] as SectionNode).children).toHaveLength(1);
    expect(boardOf(inTab).options.widgets).toHaveLength(1);
    (host.querySelector(`.fd-canvas-tabs [role="tab"][data-node="${tabs.children[0].id}"]`) as HTMLButtonElement).click();
    expect(strip(host)).toEqual(['Tab 1 *', 'Tab 2']);
    expect(shown(host, inTab)).toBe(false);
  });

  it('renames, moves and deletes a tab from its properties', () => {
    const { designer } = sheetDesigner();
    const { host } = mount(designer);
    button(host, 'Add tabs').click();
    button(host, 'Add tab').click();
    type(field(host, 'Tab label'), 'Notes');
    expect(strip(host)).toEqual(['Tab 1', 'Notes *']);
    button(host.querySelector('.fd-properties') as Element, 'Move left').click();
    expect(strip(host)).toEqual(['Notes *', 'Tab 1']);
    button(host.querySelector('.fd-properties') as Element, 'Delete tab').click();
    expect(strip(host)).toEqual(['Tab 1 *']);
  });

  it('names the tab a section is in where a field picks its section, and opens the tab of what is selected', () => {
    const { designer, email } = sheetDesigner();
    const { host } = mount(designer);
    button(host, 'Add tabs').click();
    button(host, 'Add tab').click();
    designer.select(email);
    const sections = [...(field(host, 'Section') as HTMLSelectElement).options].map((o) => o.textContent);
    expect(sections).toEqual(['Untitled section', 'Tab 1 › Untitled section', 'Tab 2 › Untitled section']);
    const target = (field(host, 'Section') as HTMLSelectElement).options[1].value;
    choose(field(host, 'Section'), target);
    expect(strip(host)).toEqual(['Tab 1 *', 'Tab 2']);
    expect(shown(host, email)).toBe(true);
  });

  it('moves a section and the tabs up and down the sheet, and deletes the tabs', () => {
    const { designer } = sheetDesigner();
    const { host } = mount(designer);
    button(host, 'Add tabs').click();
    const tabs = (sheet(designer).children.find((n) => n.type === 'tabs') as TabsNode).id;
    designer.select(tabs);
    const properties = host.querySelector('.fd-properties') as Element;
    button(properties, 'Move up').click();
    expect(sheet(designer).children.map((n) => n.type)).toEqual(['tabs', 'section']);
    expect([...host.querySelectorAll('.fd-canvas-sections > *')].map((e) => e.getAttribute('data-node'))).toEqual([tabs, 'section-1']);
    button(host.querySelector('.fd-properties') as Element, 'Delete tabs').click();
    expect(sheet(designer).children.map((n) => n.type)).toEqual(['section']);
    expect(host.querySelector('.fd-canvas-tabs')).toBeNull();
  });
});
