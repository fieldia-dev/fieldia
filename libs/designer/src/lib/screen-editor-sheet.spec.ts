import type { Field, FieldNode, Page, SectionNode, SheetNode, TabsNode } from '@fieldia/core';
import { blankPage, createDesigner, createMemoryPageStore } from './designer';
import { button, choose, field, mount, press, tile, type, openTab } from './test-editor';

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
    const { host } = mount(designer, { mode: 'simple' });
    const title = host.querySelector('.fd-canvas-title') as HTMLElement;
    expect(title.hidden).toBe(true);
    expect(field(host, 'Title field')).toBeUndefined();
    expect(tile(host, 'layout:tabs').hidden).toBe(true);
    openTab(host, 'Layout');
    choose(field(host, 'Layout'), 'sheet');
    expect(designer.getPage().layout.type).toBe('sheet');
    expect(tile(host, 'layout:tabs').hidden).toBe(false);
    openTab(host, 'Content');
    choose(field(host, 'Title field'), company);
    expect(sheet(designer).title?.placeholder).toBe('Company');
    expect(title.hidden).toBe(false);
    expect(title.textContent).toBe('Company');
    // The field left its section for the title.
    expect(host.querySelector('[data-node="section-1"] .fd-canvas-field')).toBeNull();
    expect((host.querySelector('[data-node="section-1"] .fd-canvas-empty') as HTMLElement).hidden).toBe(false);
  });

  it('adds tabs: a strip of them, each showing its own sections', () => {
    const { designer } = sheetDesigner();
    const { host } = mount(designer, { mode: 'advanced' });
    tile(host, 'layout:tabs').click();
    const tabs = sheet(designer).children.find((n) => n.type === 'tabs') as TabsNode;
    expect(strip(host)).toEqual(['Tab 1 *']);
    expect(shown(host, tabs.children[0].children[0].id)).toBe(true);
    // One set of tabs to a sheet, as a record has.
    expect(tile(host, 'layout:tabs').hidden).toBe(true);
    button(host, 'Add a tab')?.click();
    const second = (sheet(designer).children.find((n) => n.type === 'tabs') as TabsNode).children[1];
    expect(strip(host)).toEqual(['Tab 1', 'Tab 2 *']);
    expect(shown(host, second.children[0].id)).toBe(true);
    expect(shown(host, tabs.children[0].children[0].id)).toBe(false);
    // A field added now goes into the tab on show.
    tile(host, 'kind:paragraph').click();
    const inTab = (second.children[0] as SectionNode).id;
    const fields = ((sheet(designer).children.find((n) => n.type === 'tabs') as TabsNode).children[1].children[0] as SectionNode).children;
    expect(fields).toHaveLength(1);
    expect(host.querySelectorAll(`[data-node="${inTab}"] .fd-canvas-field`)).toHaveLength(1);
    (host.querySelector(`.fd-canvas-tabs [role="tab"][data-node="${tabs.children[0].id}"]`) as HTMLButtonElement).click();
    expect(strip(host)).toEqual(['Tab 1 *', 'Tab 2']);
    expect(shown(host, inTab)).toBe(false);
  });

  it('renames, moves and deletes a tab from its properties', () => {
    const { designer } = sheetDesigner();
    const { host } = mount(designer, { mode: 'advanced' });
    tile(host, 'layout:tabs').click();
    button(host, 'Add a tab')?.click();
    type(field(host, 'Tab label'), 'Notes');
    expect(strip(host)).toEqual(['Tab 1', 'Notes *']);
    button(host.querySelector('.fd-properties') as Element, 'Move left')?.click();
    expect(strip(host)).toEqual(['Notes *', 'Tab 1']);
    button(host.querySelector('.fd-properties') as Element, 'Delete tab')?.click();
    expect(strip(host)).toEqual(['Tab 1 *']);
  });

  it('names the tab a section is in where a field picks its section, and opens the tab of what is picked', () => {
    const { designer, email } = sheetDesigner();
    const { host } = mount(designer, { mode: 'advanced' });
    tile(host, 'layout:tabs').click();
    button(host, 'Add a tab')?.click();
    designer.select(email);
    openTab(host, 'Layout');
    const sections = [...(field(host, 'Section') as HTMLSelectElement).options].map((o) => o.textContent);
    expect(sections).toEqual(['Untitled section', 'Tab 1 › Untitled section', 'Tab 2 › Untitled section']);
    const target = (field(host, 'Section') as HTMLSelectElement).options[1].value;
    choose(field(host, 'Section'), target);
    expect(strip(host)).toEqual(['Tab 1 *', 'Tab 2']);
    expect(shown(host, email)).toBe(true);
  });

  it('moves a section and the tabs up and down the sheet, and deletes the tabs', () => {
    const { designer } = sheetDesigner();
    const { host } = mount(designer, { mode: 'advanced' });
    tile(host, 'layout:tabs').click();
    const tabs = (sheet(designer).children.find((n) => n.type === 'tabs') as TabsNode).id;
    designer.select(tabs);
    button(host.querySelector('.fd-properties') as Element, 'Move up')?.click();
    expect(sheet(designer).children.map((n) => n.type)).toEqual(['tabs', 'section']);
    expect([...host.querySelectorAll('.fd-canvas-body > *')].map((e) => e.getAttribute('data-node'))).toEqual([tabs, 'section-1']);
    button(host.querySelector('.fd-properties') as Element, 'Delete tabs')?.click();
    expect(sheet(designer).children.map((n) => n.type)).toEqual(['section']);
    expect(host.querySelector('.fd-canvas-tabs')).toBeNull();
  });
});

describe('screen editor — the kinds of field for a screen', () => {
  const fieldOf = (page: Page, id: string) => {
    const node = (page.layout as { children: SectionNode[] }).children.flatMap((s) => s.children as FieldNode[]).find((n) => n.id === id) as FieldNode;
    return page.fields[node.field] as Field & { relation?: string; currency?: string; fields?: Record<string, Field> };
  };
  const headers = (host: Element, id: string) => [...(host.querySelector(`.fd-canvas-field[data-node="${id}"]`) as HTMLElement).querySelectorAll('th')].map((th) => th.textContent?.trim()).filter(Boolean);

  it('draws a table of lines with its columns, and edits them from the panel', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Order') });
    const { host } = mount(designer, { mode: 'advanced' });
    tile(host, 'kind:lines').click();
    const lines = designer.getState().selected as string;
    expect(headers(host, lines)).toEqual(['Description', 'Quantity']);
    expect(field(host, 'Shown as')?.value).toBe('lines');
    const properties = host.querySelector('.fd-properties') as HTMLElement;
    button(properties, 'Add column')?.click();
    type(field(host, 'Column 3'), 'Unit price');
    choose(field(host, 'Kind of column 3'), 'number');
    type(field(host, 'Column 1'), 'Item');
    const columns = () => Object.values(fieldOf(designer.getPage(), lines).fields ?? {}).map((f) => `${f.label}:${f.type}`);
    expect(columns()).toEqual(['Item:char', 'Quantity:float', 'Unit price:float']);
    expect(headers(host, lines)).toEqual(['Item', 'Quantity', 'Unit price']);
    button(properties, 'Remove column Quantity')?.click();
    expect(columns()).toEqual(['Item:char', 'Unit price:float']);
  });

  it('points a link at its records, and gives an amount its currency', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Order') });
    const { host } = mount(designer, { mode: 'advanced' });
    tile(host, 'kind:link').click();
    const link = designer.getState().selected as string;
    expect(field(host, 'Links to')?.value).toBe('contact');
    expect(field(host, 'Currency')).toBeUndefined();
    type(field(host, 'Links to'), 'company');
    expect(fieldOf(designer.getPage(), link).relation).toBe('company');
    tile(host, 'kind:amount').click();
    const amount = designer.getState().selected as string;
    expect(field(host, 'Links to')).toBeUndefined();
    type(field(host, 'Currency'), 'eu');
    expect(fieldOf(designer.getPage(), amount).currency).toBe('USD');
    type(field(host, 'Currency'), 'eur');
    expect(fieldOf(designer.getPage(), amount).currency).toBe('EUR');
  });
});

describe('screen editor — a record’s header in the panel', () => {
  const model: Record<string, Field> = {
    state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'blocked', label: 'Blocked' }] },
    invoice_count: { type: 'integer', label: 'Invoices' },
  };
  const setup = () => {
    const designer = createDesigner({ page: blankPage('sheet', 'Customer'), model });
    const { host } = mount(designer, { mode: 'advanced' });
    const panel = () => host.querySelector('.fd-properties') as HTMLElement;
    const part = (id: string) => host.querySelector(`.fd-canvas [data-part="${id}"]`) as HTMLElement;
    const add = (kind: string) => (host.querySelector(`[data-add-part="${kind}"]`) as HTMLButtonElement).click();
    return { designer, host, panel, part, add };
  };

  it('changes a button’s words, action, look and question from the panel, the canvas following', () => {
    const { designer, panel, part, add } = setup();
    add('button');
    const id = sheet(designer).buttons?.[0].id as string;
    expect(panel().querySelector('.fd-panel-title')?.textContent).toBe('Button');
    type(field(panel(), 'Words'), 'Confirm');
    type(field(panel(), 'Action'), 'confirm_order');
    choose(field(panel(), 'Look'), 'primary');
    type(field(panel(), 'Asks first'), 'Confirm this order?');
    expect(sheet(designer).buttons?.[0]).toMatchObject({ label: 'Confirm', action: 'confirm_order', style: 'primary', confirm: 'Confirm this order?' });
    expect(part(id).classList.contains('fd-button-primary')).toBe(true);
    expect((part(id).querySelector('input') as HTMLInputElement).value).toBe('Confirm');
  });

  it('shows a counter’s number from a field, and gives a badge its tone and a rule', () => {
    const { designer, panel, add } = setup();
    designer.setStatusbar('state');
    add('stat');
    expect([...(field(panel(), 'Number from') as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(['Nothing', 'Invoices']);
    choose(field(panel(), 'Number from'), 'invoice_count');
    expect(sheet(designer).statButtons?.[0].field).toBe('invoice_count');
    add('badge');
    // A badge only shows: no look of a button's, and nothing to ask.
    expect(field(panel(), 'Look')).toBeUndefined();
    expect(field(panel(), 'Asks first')).toBeUndefined();
    choose(field(panel(), 'Tone'), 'danger');
    expect(sheet(designer).badges?.[0].tone).toBe('danger');
    button(panel(), 'Show only when…')?.click();
    expect(sheet(designer).badges?.[0].invisible).toBe("state != 'draft'");
  });

  it('sets the status steps from the panel: which field, clickable, where, or none', () => {
    const { designer, panel, part } = setup();
    designer.setStatusbar('state');
    designer.select('#statusbar');
    expect(panel().querySelector('.fd-panel-title')?.textContent).toBe('Status steps');
    field(panel(), 'People can click a step')?.click();
    expect(sheet(designer).statusbar).toEqual({ field: 'state', clickable: true });
    choose(field(panel(), 'Where'), 'title');
    expect(sheet(designer).statusbar).toEqual({ field: 'state', clickable: true, position: 'title' });
    button(panel(), 'Remove the status steps')?.click();
    expect(sheet(designer).statusbar).toBeUndefined();
    expect(part('#statusbar')).toBeNull();
  });

  it('moves a part with Alt and an arrow, and takes it away with Delete', () => {
    const { designer, add } = setup();
    add('button');
    add('button');
    const [first, second] = sheet(designer).buttons?.map((b) => b.id) as string[];
    (document.activeElement as HTMLElement).blur();
    press('ArrowLeft', { altKey: true }, document.body);
    expect(sheet(designer).buttons?.map((b) => b.id)).toEqual([second, first]);
    press('Delete', {}, document.body);
    expect(sheet(designer).buttons?.map((b) => b.id)).toEqual([first]);
  });
});
