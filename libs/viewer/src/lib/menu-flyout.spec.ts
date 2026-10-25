import { createMemoryDataSource, type ActionRequest, type ActionResult, type MenuItem, type Page, type SheetNode } from '@fieldia/core';
import { openFormDialog } from './dialog';
import { until } from './test-list';
import { BUG, VALUES } from './test-head';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';
import { partsFor, headPart } from './viewer-parts';

/**
 * Menus inside menus, and dividers: the record's gear menu, a head's ⋮ and a
 * head button's own menu, each with lines between its items — none first,
 * last or two together, as the items round them hide — and items that open a
 * menu of their own beside them, or the app's, asked for as the menu opens
 * (`menuFrom`). Its items run as the menu's own do. By keys and pointer.
 */

/** The work tracker's ⋮, as its menu reads: the record's own, Templates with the app's, a branch, Customize. */
const TRACKER: MenuItem[] = [
  { id: 'm-new-linked', label: 'New linked work item', icon: 'plus', action: 'new-linked' },
  { id: 'm-change-type', label: 'Change type…', action: 'change-type' },
  { id: 'm-copy-link', label: 'Copy link', icon: 'link', action: 'copy-link' },
  { id: 'm-rule-1', type: 'divider' },
  {
    id: 'm-templates',
    label: 'Templates',
    menuFrom: 'templates',
    params: { kind: 'bug' },
    menu: [
      { id: 'm-capture', label: 'Capture…', action: 'capture-template' },
      { id: 'm-rule-t', type: 'divider' },
    ],
  },
  { id: 'm-rule-2', type: 'divider' },
  { id: 'm-branch', label: 'New branch…', action: 'new-branch', invisible: "state == 'closed'" },
  { id: 'm-rule-3', type: 'divider' },
  { id: 'm-customize', label: 'Customize', action: 'customize', invisible: "state == 'closed'" },
];

const sheet = BUG.layout as SheetNode;
const withMenu = (menu: MenuItem[], more: Partial<SheetNode> = {}): Page => ({ ...BUG, layout: { ...sheet, toolbar: { menu }, ...more } }) as Page;

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function draw(page: Page, options: Partial<ViewerOptions> = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, dataSource: createMemoryDataSource({ records: { 'work.item': { 1: { ...VALUES }, 2: { ...VALUES, number: 4128, title: 'Another' } } } }), recordId: 1, confirm: async () => true, ...options });
  await handle.form.settled();
  await until(() => host.querySelector('.fd-head-more'));
  return host;
}

const more = (host: Element) => host.querySelector('.fd-head-more') as HTMLButtonElement;
const top = (host: Element) => host.querySelector('.fd-head-actions .fd-record-actions > [role="menu"]') as HTMLElement;
/** A menu's own lines, as they show: an item's words, `›` after one that opens a menu, `──` for a divider. */
const read = (menu: HTMLElement) =>
  [...menu.children].flatMap((child) => {
    const el = child as HTMLElement;
    if (el.hidden || (el.getAttribute('role') !== 'menuitem' && el.getAttribute('role') !== 'separator')) return [];
    return [el.getAttribute('role') === 'separator' ? '──' : `${el.textContent}${el.getAttribute('aria-haspopup') ? ' ›' : ''}`];
  });
const node = (host: Element, id: string) => host.querySelector(`[data-node="${id}"]`) as HTMLElement;
const flyout = (host: Element, id: string) => document.getElementById(node(host, id).getAttribute('aria-controls') as string) as HTMLElement;
const key = (target: Element, name: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));

/** The app's answers: its templates for the kind it is asked about, and every action it is asked to run. */
function app(templates: MenuItem[] = [{ id: 'tpl-1', label: 'Crash on checkout', action: 'apply-template', params: { id: 1 } }, { id: 'tpl-2', label: 'Wrong stock count', action: 'apply-template', params: { id: 2 }, confirm: 'Apply it over what is typed?' }]) {
  const asked: ActionRequest[] = [];
  const onAction = (request: ActionRequest): ActionResult | void => {
    asked.push(request);
    if (request.action === 'templates') return { menu: templates };
  };
  return { asked, onAction };
}

describe('dividers in a menu', () => {
  it('stand between the items that show, never first, last or two together', async () => {
    const page = withMenu([
      { id: 'd-0', type: 'divider' },
      { id: 'm-a', label: 'A', action: 'a' },
      { id: 'd-1', type: 'divider' },
      { id: 'm-b', label: 'B', action: 'b', invisible: "state == 'active'" },
      { id: 'd-2', type: 'divider' },
      { id: 'm-c', label: 'C', action: 'c' },
      { id: 'd-3', type: 'divider' },
      { id: 'm-d', label: 'D', action: 'd', invisible: "state == 'active'" },
    ]);
    const host = await draw(page);
    expect(read(top(host))).toEqual(['A', '──', 'C']);
    handle?.form.setValue('state', 'new');
    expect(read(top(host))).toEqual(['A', '──', 'B', '──', 'C', '──', 'D']);
    expect(node(host, 'd-1').getAttribute('role')).toBe('separator');
    // The arrows pass the lines by.
    more(host).click();
    expect(document.activeElement?.textContent).toBe('A');
    key(document.activeElement as Element, 'ArrowDown');
    expect(document.activeElement?.textContent).toBe('B');
  });

  it('take a divider’s own condition, and leave the gear menu of a page with none as it was', async () => {
    const host = await draw(withMenu([{ id: 'm-a', label: 'A', action: 'a' }, { id: 'd-1', type: 'divider', invisible: true }, { id: 'm-b', label: 'B', action: 'b' }]));
    expect(read(top(host))).toEqual(['A', 'B']);
    handle?.destroy();
    const plain = await draw(BUG);
    expect(read(top(plain))).toEqual(['Copy link']);
    expect(top(plain).querySelector('[aria-haspopup], [role="separator"]')).toBeNull();
  });
});

describe('a menu inside a menu', () => {
  it('reads as the tracker’s ⋮: icons, dividers, Templates › with its own items and the app’s after them', async () => {
    const { asked, onAction } = app();
    const host = await draw(withMenu(TRACKER), { onAction });
    expect(read(top(host))).toEqual(['New linked work item', 'Change type…', 'Copy link', '──', 'Templates ›', '──', 'New branch…', '──', 'Customize']);
    const templates = node(host, 'm-templates');
    expect([templates.getAttribute('role'), templates.getAttribute('aria-haspopup'), templates.getAttribute('aria-expanded')]).toEqual(['menuitem', 'menu', 'false']);
    expect(templates.querySelector('.fd-menu-more')?.getAttribute('data-icon')).toBe('chevron-right');
    // The app is asked as the menu opens, with the item's params, the record and its values.
    more(host).click();
    await until(() => asked.some((one) => one.action === 'templates'));
    const ask = asked.find((one) => one.action === 'templates') as ActionRequest;
    expect([ask.id, ask.params, ask.recordId, ask.values['number']]).toEqual(['m-templates', { kind: 'bug' }, 1, 4127]);
    const menu = flyout(host, 'm-templates');
    await until(() => read(menu).length === 4);
    expect(read(menu)).toEqual(['Capture…', '──', 'Crash on checkout', 'Wrong stock count']);
    expect([menu.getAttribute('role'), menu.getAttribute('aria-labelledby'), menu.hidden]).toEqual(['menu', templates.id, true]);
  });

  it('opens on a press, Enter or →, its first item focused; ← and Escape close it, back on its item', async () => {
    const host = await draw(withMenu(TRACKER), app());
    more(host).click();
    const templates = node(host, 'm-templates');
    const menu = flyout(host, 'm-templates');
    await until(() => read(menu).length === 4);
    templates.focus();
    key(templates, 'ArrowRight');
    expect(menu.hidden).toBe(false);
    expect(templates.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement?.textContent).toBe('Capture…');
    key(document.activeElement as Element, 'ArrowDown');
    expect(document.activeElement?.textContent).toBe('Crash on checkout');
    key(document.activeElement as Element, 'End');
    expect(document.activeElement?.textContent).toBe('Wrong stock count');
    key(document.activeElement as Element, 'ArrowLeft');
    expect(menu.hidden).toBe(true);
    expect(document.activeElement).toBe(templates);
    // The menu it is in is still open, and Escape in the inner one closes that one alone.
    expect(top(host).hidden).toBe(false);
    templates.click();
    expect(document.activeElement?.textContent).toBe('Capture…');
    key(document.activeElement as Element, 'Escape');
    expect([menu.hidden, top(host).hidden, document.activeElement === templates]).toEqual([true, false, true]);
    // Escape again: the whole menu, back on ⋮.
    key(templates, 'Escape');
    expect(top(host).hidden).toBe(true);
    expect(document.activeElement).toBe(more(host));
  });

  it('opens toward where the words run: ← opens it right to left, → closes it', async () => {
    const host = await draw(withMenu(TRACKER), { ...app(), locale: 'ar', dir: 'rtl' });
    more(host).click();
    const templates = node(host, 'm-templates');
    const menu = flyout(host, 'm-templates');
    await until(() => read(menu).length === 4);
    templates.focus();
    key(templates, 'ArrowRight');
    expect(menu.hidden).toBe(true);
    key(templates, 'ArrowLeft');
    expect(menu.hidden).toBe(false);
    key(document.activeElement as Element, 'ArrowRight');
    expect(menu.hidden).toBe(true);
  });

  it('opens as a pointer rests on its item, and closes as the pointer goes on to another', async () => {
    const host = await draw(withMenu(TRACKER), app());
    more(host).click();
    const menu = flyout(host, 'm-templates');
    // jsdom has no PointerEvent: a mouse's, as a pointer's with no type of its own.
    node(host, 'm-templates').dispatchEvent(new MouseEvent('pointerenter'));
    expect(menu.hidden).toBe(false);
    node(host, 'm-branch').dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    expect(menu.hidden).toBe(false);
    await until(() => menu.hidden);
  });

  it('runs its own items as the page’s, and the app’s by their own action and params, asking first where they say', async () => {
    const asks: [string, string | undefined][] = [];
    const { asked, onAction } = app();
    const host = await draw(withMenu(TRACKER), { onAction, confirm: async (message, how) => (asks.push([message, how?.yes]), true) });
    more(host).click();
    const menu = flyout(host, 'm-templates');
    await until(() => read(menu).length === 4);
    node(host, 'm-templates').click();
    (menu.querySelector('[data-node="m-capture"]') as HTMLElement).click();
    // The whole menu closes, back on ⋮; the item's action is the page's.
    expect([menu.hidden, top(host).hidden]).toEqual([true, true]);
    await until(() => asked.some((one) => one.action === 'capture-template'));
    expect(asked.find((one) => one.action === 'capture-template')?.id).toBe('m-capture');
    more(host).click();
    await until(() => read(flyout(host, 'm-templates')).length === 4);
    node(host, 'm-templates').click();
    (flyout(host, 'm-templates').querySelector('[data-node="tpl-2"]') as HTMLElement).click();
    await until(() => asked.some((one) => one.action === 'apply-template'));
    const applied = asked.find((one) => one.action === 'apply-template') as ActionRequest;
    expect([applied.id, applied.params, applied.recordId]).toEqual(['tpl-2', { id: 2 }, 1]);
    // Its Yes says what it does: the item's own words.
    expect(asks).toEqual([['Apply it over what is typed?', 'Wrong stock count']]);
  });

  it('is not shown while its menu has nothing to show: its items hidden, or the app giving none', async () => {
    const host = await draw(
      withMenu([
        { id: 'm-a', label: 'A', action: 'a' },
        { id: 'd-1', type: 'divider' },
        { id: 'm-sub', label: 'More', menu: [{ id: 'm-x', label: 'X', action: 'x', invisible: "state == 'active'" }] },
        { id: 'm-from', label: 'From the app', menuFrom: 'nothing' },
      ]),
      { onAction: (request) => (request.action === 'nothing' ? { menu: [] } : undefined) }
    );
    more(host).click();
    await until(() => node(host, 'm-from').hidden);
    expect(read(top(host))).toEqual(['A']);
    handle?.form.setValue('state', 'new');
    expect(read(top(host))).toEqual(['A', '──', 'More ›']);
  });

  it('keeps the app’s items to the record they were asked for, and asks again each time it opens', async () => {
    let round = 0;
    let answer: (result: ActionResult) => void = () => undefined;
    const onAction = (request: ActionRequest): Promise<ActionResult> | void => {
      if (request.action !== 'templates') return;
      round++;
      return new Promise((resolve) => (answer = resolve));
    };
    const host = await draw(withMenu(TRACKER), { onAction });
    more(host).click();
    await until(() => round === 1);
    const menu = flyout(host, 'm-templates');
    node(host, 'm-templates').click();
    // Waiting as every wait is: busy at once, "Loading…" in it after its own items once past the delay.
    expect(menu.getAttribute('aria-busy')).toBe('true');
    expect(menu.querySelector('.fd-loader')).toBeNull();
    await until(() => menu.querySelector('.fd-loader[data-moment="search"]'));
    expect(menu.lastElementChild?.matches('.fd-loader')).toBe(true);
    expect(menu.querySelector('.fd-loader')?.textContent).toBe('Loading…');
    expect(document.activeElement).toBe(node(host, 'm-capture'));
    // Another record shown meanwhile: its answer is not laid in.
    await handle?.form.openRecord(2);
    answer({ menu: [{ id: 'late', label: 'Late', action: 'x' }] });
    await handle?.form.settled();
    expect(document.querySelector('[data-node="late"]')).toBeNull();
    // Opened again: asked again, on the record shown now.
    if (!top(host).hidden) more(host).click();
    more(host).click();
    await until(() => round === 2);
    answer({ menu: [{ id: 'fresh', label: 'Fresh', action: 'x' }] });
    await until(() => flyout(host, 'm-templates').querySelector('[data-node="fresh"]'));
    expect(read(flyout(host, 'm-templates'))).toEqual(['Capture…', '──', 'Fresh']);
  });
});

describe('menus inside a head button’s menu and the gear menu', () => {
  it('opens one inside a split button’s menu', async () => {
    const actions = [...(sheet.head?.actions ?? [])];
    actions[0] = { ...actions[0], menu: [{ id: 'm-save', label: 'Save', steps: [{ do: 'save' }] }, { id: 'd-s', type: 'divider' }, { id: 'm-save-as', label: 'Save as', menu: [{ id: 'm-save-draft', label: 'Draft', action: 'draft' }] }] };
    const asked: string[] = [];
    const host = await draw({ ...BUG, layout: { ...sheet, head: { ...sheet.head, actions } } } as Page, { onAction: (request) => void asked.push(request.action) });
    const chevron = host.querySelector('[data-node="b-save-close"] .fd-split-more') as HTMLButtonElement;
    chevron.click();
    const list = host.querySelector('[data-node="b-save-close"] .fd-button-menu') as HTMLElement;
    expect(read(list)).toEqual(['Save', '──', 'Save as ›']);
    node(host, 'm-save-as').click();
    (flyout(host, 'm-save-as').querySelector('[data-node="m-save-draft"]') as HTMLElement).click();
    expect(list.hidden).toBe(true);
    await until(() => asked.includes('draft'));
  });

  it('opens one in the gear menu over a plain record, which asks for the head part to draw it', async () => {
    const plain: Page = {
      fieldia: '0.13',
      id: 'plain',
      title: 'Bug',
      data: { kind: 'record', model: 'work.item' },
      fields: { title: { type: 'char', label: 'Title' } },
      layout: { type: 'sheet', id: 'sheet', title: { field: 'title' }, toolbar: { menu: [{ id: 'm-a', label: 'A', action: 'a' }, { id: 'm-sub', label: 'More', menu: [{ id: 'm-b', label: 'B', action: 'b' }] }] }, children: [] },
    };
    expect(partsFor(plain)).toContain(headPart);
    // Dividers are the head part's too; a flat menu asks for nothing.
    const menuOnly = (menu: MenuItem[]) => partsFor({ ...plain, layout: { ...plain.layout, toolbar: { menu } } } as Page);
    expect(menuOnly([{ id: 'm-a', label: 'A', action: 'a' }, { id: 'd', type: 'divider' }, { id: 'm-b', label: 'B', action: 'b' }])).toContain(headPart);
    expect(menuOnly([{ id: 'm-a', label: 'A', action: 'a' }, { id: 'm-b', label: 'B', action: 'b' }])).not.toContain(headPart);
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, { page: plain, dataSource: createMemoryDataSource({ records: { 'work.item': { 1: { ...VALUES } } } }), recordId: 1 });
    await handle.form.settled();
    await until(() => host.querySelector('.fd-record-gear'));
    (host.querySelector('.fd-record-gear') as HTMLButtonElement).click();
    expect(read(host.querySelector('.fd-record-menu') as HTMLElement)).toEqual(['A', 'More ›']);
    node(host, 'm-sub').click();
    expect(document.activeElement?.textContent).toBe('B');
  });

  it('opens one in the inset dialog’s head', async () => {
    const { onAction } = app();
    void openFormDialog({ page: withMenu(TRACKER), dataSource: createMemoryDataSource({ records: { 'work.item': { 1: { ...VALUES } } } }), recordId: 1, title: 'Bug 4127', size: 'inset', backdrop: 'clear', onAction });
    await until(() => document.querySelector('[role="dialog"] .fd-head-more'));
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    more(dialog).click();
    await until(() => read(flyout(dialog, 'm-templates')).length === 4);
    node(dialog, 'm-templates').click();
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement?.textContent).toBe('Capture…');
    // Escape closes the inner menu, then the outer one — never the dialog.
    key(document.activeElement as Element, 'Escape');
    key(document.activeElement as Element, 'Escape');
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.activeElement).toBe(more(dialog));
  });
});
