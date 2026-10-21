import { checkPage, validatePage, type Field, type MenuItem, type SheetNode } from '@fieldia/core';
import { blankPage, createDesigner, type Designer } from './designer';
import { button, field, mount, openTab, typeAndLeave } from './test-editor';

/**
 * What sits around a record, as the designer edits it: the gear menu's items
 * — the record's own, the app's actions, reports under Print — each with its
 * When clicked like a button's; an item that opens a menu of its own, its
 * items set on its panel, and a line between items; whether the pager and
 * breadcrumbs the app gives show; the attachment and the side panel beside
 * the sheet. In English and in Arabic, each change one undo step, each
 * refusal in words, the page valid after each.
 */

const model: Record<string, Field> = {
  name: { type: 'char', label: 'Name' },
  cv: { type: 'binary', label: 'CV' },
  email: { type: 'char', label: 'Email' },
};
const sheet = (d: ReturnType<typeof createDesigner>) => d.getPage().layout as SheetNode;
const employee = (locale?: 'ar') => createDesigner({ page: blankPage('sheet', locale ? 'موظف' : 'Employee', locale ? { locale } : undefined), model, ...(locale ? { locale } : {}) });
/** An employee's page with this gear menu, as its JSON would bring it. */
const withMenu = (menu: MenuItem[]) => {
  const page = blankPage('sheet', 'Employee');
  return createDesigner({ page: { ...page, layout: { ...(page.layout as SheetNode), toolbar: { menu } } }, model });
};
const menuOf = (d: Designer) => sheet(d).toolbar?.menu ?? [];
/** The page as the viewer checks it as it is shown: nothing found. */
const valid = (d: Designer) => {
  const checked = checkPage(d.getPage());
  expect(checked.ok ? [] : checked.issues.map((i) => `${i.path}: ${i.message}`)).toEqual([]);
};

afterEach(() => document.body.replaceChildren());

describe('the gear menu, as the designer edits it', () => {
  it('adds the record’s own items in no words of their own, the app’s action and a report under Print, each picked', () => {
    const designer = employee();
    const archive = designer.addMenuItem('archive') as string;
    const debit = designer.addMenuItem('action', 'Debit Note') as string;
    const badge = designer.addMenuItem('print', 'Badge') as string;
    expect(designer.getState().selected).toBe(badge);
    expect(sheet(designer).toolbar).toEqual({
      menu: [
        { id: archive, builtin: 'archive' },
        { id: debit, label: 'Debit Note', action: 'debit_note' },
        { id: badge, label: 'Badge', group: 'print', action: 'badge' },
      ],
    });
    expect(validatePage(designer.getPage()).ok).toBe(true);
    // One undo takes the report away again.
    designer.undo();
    expect(sheet(designer).toolbar?.menu).toHaveLength(2);
  });

  it('edits an item like a button: its words, its question, the group it is in; a built-in’s words may go, another’s may not', () => {
    const designer = employee();
    const archive = designer.addMenuItem('archive') as string;
    expect(designer.updateHeaderPart(archive, { label: 'Leave' })).toBe(true);
    expect(designer.updateHeaderPart(archive, { label: '' })).toBe(true);
    expect(sheet(designer).toolbar?.menu?.[0]).toEqual({ id: archive, builtin: 'archive' });
    expect(designer.updateHeaderPart(archive, { confirm: 'Archive this employee?', group: 'print' })).toBe(true);
    expect(sheet(designer).toolbar?.menu?.[0]).toEqual({ id: archive, builtin: 'archive', confirm: 'Archive this employee?', group: 'print' });
    const debit = designer.addMenuItem('action', 'Debit Note') as string;
    expect(designer.updateHeaderPart(debit, { label: ' ' })).toBe(false);
    expect(designer.getState().issues).toEqual(['An item of the gear menu needs words, unless it is one of the record’s own (Archive, Duplicate, Delete)']);
    // A button has no built-in, nor a group.
    const button = designer.addHeaderPart('button', 'Confirm') as string;
    expect(designer.updateHeaderPart(button, { builtin: 'delete' })).toBe(false);
    expect(designer.getState().issues).toEqual(['Only an item of the gear menu archives, duplicates or deletes the record itself']);
  });

  it('turns a built-in into the app’s action of its words, and back', () => {
    const designer = employee();
    const item = designer.addMenuItem('duplicate', 'Copy it') as string;
    expect(designer.updateHeaderPart(item, { builtin: '' })).toBe(true);
    expect(sheet(designer).toolbar?.menu?.[0]).toEqual({ id: item, label: 'Copy it', action: 'copy_it' });
    expect(designer.updateHeaderPart(item, { builtin: 'delete' })).toBe(true);
    expect(sheet(designer).toolbar?.menu?.[0]).toEqual({ id: item, label: 'Copy it', action: 'copy_it', builtin: 'delete' });
  });

  it('gives an item steps as a button’s When clicked: an Archive that opens the departure wizard, and back to its own', () => {
    const designer = employee();
    const archive = designer.addMenuItem('archive') as string;
    // A built-in shows the step it runs.
    expect(designer.steps({ press: archive })).toEqual([{ do: 'archive' }]);
    expect(designer.setSteps({ press: archive }, [{ do: 'open', page: 'departure-wizard' }])).toBe(true);
    expect(sheet(designer).toolbar?.menu?.[0]).toEqual({ id: archive, builtin: 'archive', steps: [{ do: 'open', page: 'departure-wizard' }] });
    // Left with its own step alone, it runs its built-in again, asking first.
    expect(designer.setSteps({ press: archive }, [{ do: 'archive' }])).toBe(true);
    expect(sheet(designer).toolbar?.menu?.[0]).toEqual({ id: archive, builtin: 'archive' });
  });

  it('adds a line between items and an item that opens a menu of its own, its menu starting with an item', () => {
    const designer = employee();
    const archive = designer.addMenuItem('archive') as string;
    const rule = designer.addMenuItem('divider') as string;
    valid(designer);
    const templates = designer.addMenuItem('submenu', 'Templates') as string;
    expect(designer.getState().selected).toBe(templates);
    expect(menuOf(designer)).toEqual([
      { id: archive, builtin: 'archive' },
      { id: 'menu-divider-1', type: 'divider' },
      { id: 'submenu-1', label: 'Templates', menu: [{ id: 'submenu-1-item-1', label: 'New action', action: 'new_action' }] },
    ]);
    expect([rule, templates]).toEqual(['menu-divider-1', 'submenu-1']);
    valid(designer);
    // A divider takes no words; an item that opens a menu needs some.
    expect(designer.addMenuItem('divider', 'A line')).toBe(false);
    expect(designer.getState().issues).toEqual(['A divider is a line between items: it has no words and does nothing']);
    expect(designer.addMenuItem('submenu', ' ')).toBe(false);
    expect(designer.getState().issues).toEqual(['An item that opens a menu needs words']);
    // One undo takes the menu of its own away again.
    designer.undo();
    expect(menuOf(designer).map((item) => item.id)).toEqual([archive, rule]);
    valid(designer);
  });

  it('never gives a new item an id an item inside another’s menu has', () => {
    const designer = withMenu([{ id: 'more', label: 'More', menu: [{ id: 'menu-1', label: 'Copy link', action: 'copy_link' }, { id: 'submenu-1', type: 'divider' }, { id: 'submenu-2', label: 'Share', action: 'share' }] }]);
    valid(designer);
    expect(designer.addMenuItem('action', 'Debit Note')).toBe('menu-2');
    expect(designer.addMenuItem('submenu', 'Templates')).toBe('submenu-3');
    valid(designer);
  });

  it('sets the items of the menu an item opens, each item’s own keys kept, and the app’s items as it opens', () => {
    const designer = withMenu([
      { id: 'letters', label: 'Letters', menu: [{ id: 'offer', label: 'Offer', icon: 'mail', confirm: 'Send it?', action: 'send_offer' }, { id: 'rule', type: 'divider', invisible: true }] },
    ]);
    valid(designer);
    // A row's words changed; a divider and an item added: the kept ones keep their icon, question and condition.
    expect(designer.updateHeaderPart('letters', { menu: [{ id: 'offer', label: 'Offer letter', action: 'send_offer' }, { id: 'rule', type: 'divider' }, { type: 'divider' }, { label: 'Contract', action: '' }] })).toBe(true);
    expect(menuOf(designer)[0].menu).toEqual([
      { id: 'offer', label: 'Offer letter', icon: 'mail', confirm: 'Send it?', action: 'send_offer' },
      { id: 'rule', type: 'divider', invisible: true },
      { id: 'letters-item-1', type: 'divider' },
      { id: 'letters-item-2', label: 'Contract', action: 'contract' },
    ]);
    valid(designer);
    // The app gives more as it opens; its own may then all go, and come back.
    expect(designer.updateHeaderPart('letters', { menuFrom: ' letter_templates ' })).toBe(true);
    expect(menuOf(designer)[0].menuFrom).toBe('letter_templates');
    expect(designer.updateHeaderPart('letters', { menu: [] })).toBe(true);
    expect(menuOf(designer)[0]).toEqual({ id: 'letters', label: 'Letters', menuFrom: 'letter_templates' });
    valid(designer);
    // Left with nothing to open, it is refused.
    expect(designer.updateHeaderPart('letters', { menuFrom: '' })).toBe(false);
    expect(designer.getState().issues).toEqual(['An item that opens a menu needs an item in it, or the app’s action that gives its items']);
    expect(designer.updateHeaderPart('letters', { menu: [{ label: 'Offer', action: 'send_offer' }] })).toBe(true);
    expect(menuOf(designer)[0].menu).toEqual([{ id: 'letters-item-1', label: 'Offer', action: 'send_offer' }]);
    valid(designer);
  });

  it('takes the app’s params away with the app’s items, the item’s own menu staying', () => {
    const designer = withMenu([{ id: 'letters', label: 'Letters', menuFrom: 'letter_templates', params: { kind: 'hr' }, menu: [{ id: 'offer', label: 'Offer', action: 'send_offer' }] }]);
    valid(designer);
    expect(designer.updateHeaderPart('letters', { menuFrom: '' })).toBe(true);
    expect(menuOf(designer)).toEqual([{ id: 'letters', label: 'Letters', menu: [{ id: 'offer', label: 'Offer', action: 'send_offer' }] }]);
    valid(designer);
  });

  it('refuses words for a divider, nothing to do for an item that opens a menu, and a menu for any other', () => {
    const designer = employee();
    const rule = designer.addMenuItem('divider') as string;
    const templates = designer.addMenuItem('submenu', 'Templates') as string;
    const debit = designer.addMenuItem('action', 'Debit Note') as string;
    const refused = (id: string, patch: Parameters<Designer['updateHeaderPart']>[1], issue: string) => {
      expect(designer.updateHeaderPart(id, patch)).toBe(false);
      expect(designer.getState().issues).toEqual([issue]);
    };
    const line = 'A divider is a line between items: it has no words and does nothing';
    refused(rule, { label: 'Line' }, line);
    refused(rule, { confirm: 'Sure?' }, line);
    refused(rule, { menuFrom: 'templates' }, line);
    refused(rule, { builtin: 'delete' }, line);
    refused(templates, { label: ' ' }, 'An item that opens a menu needs words');
    const nothing = 'An item that opens a menu does nothing of its own: each item in its menu does';
    refused(templates, { action: 'templates' }, nothing);
    refused(templates, { builtin: 'duplicate' }, nothing);
    refused(templates, { confirm: 'Open them?' }, nothing);
    refused(templates, { menu: null }, 'An item that opens a menu needs an item in it, or the app’s action that gives its items');
    const own = 'Only an item that opens a menu has items of its own: add one from Add to the gear menu';
    refused(debit, { menu: [{ label: 'Copy', action: 'copy' }] }, own);
    refused(debit, { menuFrom: 'templates' }, own);
    // Neither does anything: no steps for either.
    expect(designer.setSteps({ press: rule }, [{ do: 'save' }])).toBe(false);
    expect(designer.getState().issues).toEqual(['There is nothing here to give steps to.']);
    expect(designer.setSteps({ press: templates }, [{ do: 'save' }])).toBe(false);
    // Each moves and goes as any item; the page stays as it was, and valid.
    expect(designer.updateHeaderPart(templates, { label: 'Letters' })).toBe(true);
    expect(designer.moveHeaderPart(rule, 1)).toBe(true);
    expect(menuOf(designer).map((item) => item.id)).toEqual([templates, rule, debit]);
    valid(designer);
    expect(designer.removeHeaderPart(rule)).toBe(true);
    expect(designer.removeHeaderPart(templates)).toBe(true);
    expect(menuOf(designer)).toEqual([{ id: debit, label: 'Debit Note', action: 'debit_note' }]);
    valid(designer);
  });

  it('takes an item away, and the menu with its last one', () => {
    const designer = employee();
    const item = designer.addMenuItem('delete') as string;
    designer.setRecordToolbar({ pager: false });
    expect(designer.removeHeaderPart(item)).toBe(true);
    expect(sheet(designer).toolbar).toEqual({ pager: false });
    designer.setRecordToolbar({ pager: true });
    expect(sheet(designer).toolbar).toBeUndefined();
  });
});

describe('the pager, the trail, the attachment and the side panel, as the designer sets them', () => {
  it('turns the pager and the breadcrumbs off and on, writing only a no', () => {
    const designer = employee();
    expect(designer.setRecordToolbar({ breadcrumbs: false })).toBe(true);
    expect(sheet(designer).toolbar).toEqual({ breadcrumbs: false });
    expect(designer.setRecordToolbar({ breadcrumbs: true })).toBe(true);
    expect(sheet(designer).toolbar).toBeUndefined();
  });

  it('shows the app’s attachments or a file field’s beside the sheet, and refuses what is no file', () => {
    const designer = employee();
    expect(designer.setAttachmentPreview('')).toBe(true);
    expect(sheet(designer).attachmentPreview).toEqual({});
    expect(designer.setAttachmentPreview('cv')).toBe(true);
    expect(sheet(designer).attachmentPreview).toEqual({ field: 'cv' });
    // The field joins the page, and stays while the preview shows it.
    expect(designer.getPage().fields['cv']).toEqual(model['cv']);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(designer.setAttachmentPreview('email')).toBe(false);
    expect(designer.getState().issues).toEqual(['The attachment beside the sheet comes from a file or a picture; Email holds text']);
    expect(designer.setAttachmentPreview(null)).toBe(true);
    expect(sheet(designer).attachmentPreview).toBeUndefined();
    expect(designer.getPage().fields['cv']).toBeUndefined();
  });

  it('keeps the side panel beside the sheet always, only once there is one', () => {
    const designer = employee();
    expect(designer.setSidePanelBeside('always')).toBe(false);
    expect(designer.getState().issues).toEqual(['The sheet has no side panel to keep beside it']);
    const page = designer.getPage();
    const withSide = createDesigner({ page: { ...page, layout: { ...(page.layout as SheetNode), sidePanel: { type: 'slot', id: 'chatter', name: 'chatter' } } }, model });
    expect(withSide.setSidePanelBeside('always')).toBe(true);
    expect(sheet(withSide).sidePanelBeside).toBe('always');
    expect(withSide.setSidePanelBeside('wide')).toBe(true);
    expect(sheet(withSide).sidePanelBeside).toBeUndefined();
  });
});

describe('on the canvas and the panel', () => {
  it('adds to the gear menu from its own Add, and sets an item on the panel', () => {
    const designer = employee();
    const { host } = mount(designer, { mode: 'advanced' });
    (host.querySelector('[data-add-part="menu"]') as HTMLButtonElement).click();
    const items = [...document.querySelectorAll<HTMLButtonElement>('.fd-menu [role="menuitem"]')].map((b) => b.textContent);
    expect(items).toEqual(['Archive', 'Unarchive', 'Duplicate', 'Delete', 'This record, printed', 'One of the app’s actions', 'A report under Print', 'A menu of its own', 'A line between items']);
    // The menu's own shape after a line: a menu inside it, a line between items.
    expect(document.querySelector('.fd-menu [data-item="submenu"]')?.previousElementSibling?.getAttribute('role')).toBe('separator');
    (document.querySelector('.fd-menu [data-item="delete"]') as HTMLButtonElement).click();
    const [item] = sheet(designer).toolbar?.menu ?? [];
    expect(item).toEqual({ id: item.id, builtin: 'delete' });
    const panel = host.querySelector('.fd-properties') as HTMLElement;
    expect(panel.querySelector('.fd-panel-title')?.textContent).toBe('Gear menu item');
    const builtin = panel.querySelector('[data-setting="The record’s own"] select') as HTMLSelectElement;
    expect(builtin.value).toBe('delete');
    expect(panel.querySelector('[data-setting="When clicked"]')).not.toBeNull();
    builtin.value = 'archive';
    builtin.dispatchEvent(new Event('change'));
    expect(sheet(designer).toolbar?.menu?.[0]).toEqual({ id: item.id, builtin: 'archive' });
    // The canvas names it as the record's own.
    expect(host.querySelector(`.fd-canvas-menu [data-part="${item.id}"] input`)?.getAttribute('placeholder')).toBe('Archive');
  });

  it('adds a menu of its own from the canvas and sets its items, and the app’s, on its panel', () => {
    const designer = employee();
    const { host } = mount(designer, { mode: 'advanced' });
    (host.querySelector('[data-add-part="menu"]') as HTMLButtonElement).click();
    (document.querySelector('.fd-menu [data-item="submenu"]') as HTMLButtonElement).click();
    const [opener] = menuOf(designer);
    expect(opener).toEqual({ id: 'submenu-1', label: 'New menu', menu: [{ id: 'submenu-1-item-1', label: 'New action', action: 'new_action' }] });
    const panel = host.querySelector('.fd-properties') as HTMLElement;
    const shown = (name: string) => !(panel.querySelector(`[data-setting="${name}"]`) as HTMLElement).hidden;
    // Its words and its menu; nothing it does itself.
    expect(field(panel, 'Words')?.value).toBe('New menu');
    expect(['Its menu', 'Items the app gives as it opens', 'The record’s own', 'Under', 'When clicked'].map(shown)).toEqual([true, true, false, false, false]);
    expect(field(panel, 'Asks first')).toBeUndefined();
    expect(field(panel, 'Item’s words 1')?.value).toBe('New action');
    expect(field(panel, 'Its action 1')?.value).toBe('new_action');
    typeAndLeave(field(panel, 'Item’s words 1'), 'Offer letter');
    expect(menuOf(designer)[0].menu).toEqual([{ id: 'submenu-1-item-1', label: 'Offer letter', action: 'new_action' }]);
    button(panel, 'Add a divider')?.click();
    button(panel, 'Add an item')?.click();
    expect(menuOf(designer)[0].menu?.map((item) => item.type ?? item.label)).toEqual(['Offer letter', 'divider', 'New action']);
    // The divider a line in the list, with its ×; the next item numbered after the first.
    expect(panel.querySelector('[data-setting="Its menu"] [role="separator"]')).not.toBeNull();
    expect(field(panel, 'Item’s words 2')?.value).toBe('New action');
    valid(designer);
    button(panel, 'Remove the divider')?.click();
    expect(menuOf(designer)[0].menu?.map((item) => item.type ?? item.label)).toEqual(['Offer letter', 'New action']);
    typeAndLeave(field(panel, 'Items the app gives as it opens'), 'letter_templates');
    expect(menuOf(designer)[0].menuFrom).toBe('letter_templates');
    valid(designer);
    // On the canvas, its words then ›.
    expect(host.querySelector(`.fd-canvas-menu [data-part="${opener.id}"] .fd-canvas-menu-more`)?.textContent).toBe('›');
  });

  it('adds a line between items from the canvas, its panel only when it shows, moved or taken away', () => {
    const designer = employee();
    designer.addMenuItem('archive');
    const { host } = mount(designer, { mode: 'advanced' });
    (host.querySelector('[data-add-part="menu"]') as HTMLButtonElement).click();
    (document.querySelector('.fd-menu [data-item="divider"]') as HTMLButtonElement).click();
    const rule = menuOf(designer)[1];
    expect(rule).toEqual({ id: 'menu-divider-1', type: 'divider' });
    expect(designer.getState().selected).toBe(rule.id);
    const panel = host.querySelector('.fd-properties') as HTMLElement;
    expect(panel.querySelector('.fd-panel-title')?.textContent).toBe('Divider');
    expect(field(panel, 'Words')).toBeUndefined();
    expect(field(panel, 'Asks first')).toBeUndefined();
    const hidden = (name: string) => (panel.querySelector(`[data-setting="${name}"]`) as HTMLElement).hidden;
    expect(['The record’s own', 'Under', 'When clicked', 'Its menu', 'Items the app gives as it opens'].map(hidden)).toEqual([true, true, true, true, true]);
    // When it shows, to whom, while editing or reading: as any item.
    expect(['Shown only to', 'Shown while'].map(hidden)).toEqual([false, false]);
    expect((panel.querySelector('.fd-prop-when') as HTMLElement).hidden).toBe(false);
    button(panel, 'Move left')?.click();
    expect(menuOf(designer).map((item) => item.id)).toEqual([rule.id, expect.stringMatching(/^menu-archive/)]);
    button(panel, 'Delete')?.click();
    expect(menuOf(designer).map((item) => item.builtin)).toEqual(['archive']);
    valid(designer);
  });

  it('sets what sits around the record on the screen’s Layout tab', () => {
    const designer = employee();
    designer.select(null);
    const { host } = mount(designer, { mode: 'advanced' });
    const panel = host.querySelector('.fd-properties') as HTMLElement;
    openTab(panel, 'Layout');
    const pager = panel.querySelector('[data-setting="Pager over the record"] input') as HTMLInputElement;
    expect(pager.checked).toBe(true);
    pager.click();
    expect(sheet(designer).toolbar).toEqual({ pager: false });
    const preview = panel.querySelector('[data-setting="Attachment beside the sheet"] select') as HTMLSelectElement;
    expect([...preview.options].map((o) => o.textContent)).toEqual(['None', 'The record’s attachments, from the app', 'CV']);
    preview.value = 'cv';
    preview.dispatchEvent(new Event('change'));
    expect(sheet(designer).attachmentPreview).toEqual({ field: 'cv' });
    // No side panel, no setting for it.
    expect((panel.querySelector('[data-setting="Side panel beside the sheet"]') as HTMLElement).hidden).toBe(true);
  });

  it('says it all in Arabic: the canvas, the item’s settings, the record’s own words', () => {
    const designer = employee('ar');
    const { host } = mount(designer, { mode: 'advanced' });
    expect(host.querySelector('[data-add-part="menu"]')?.textContent).toBe('إضافة إلى قائمة الترس');
    designer.addMenuItem('duplicate');
    const panel = host.querySelector('.fd-properties') as HTMLElement;
    expect(panel.querySelector('.fd-panel-title')?.textContent).toBe('عنصر قائمة الترس');
    expect(panel.querySelector('[data-setting="The record’s own"] .fd-prop-name')?.textContent).toBe('من عناصر السجل');
    expect([...(panel.querySelector('[data-setting="Under"] select') as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(['الإجراءات', 'الطباعة']);
    expect(designer.addMenuItem('action', ' ')).toBe(false);
    expect(designer.getState().issues).toEqual(['يحتاج عنصر قائمة الترس إلى نص، إلا إذا كان من عناصر السجل نفسه (أرشفة، استنساخ، حذف)']);
    // A menu of its own, its first item in the designer's words; a line between items; their refusals.
    expect(designer.addMenuItem('submenu', ' ')).toBe(false);
    expect(designer.getState().issues).toEqual(['يحتاج العنصر الذي يفتح قائمة إلى نص']);
    const rule = designer.addMenuItem('divider') as string;
    expect(designer.updateHeaderPart(rule, { label: 'خط' })).toBe(false);
    expect(designer.getState().issues).toEqual(['الخط الفاصل خطٌّ بين العناصر: لا كلمات له ولا يفعل شيئًا']);
    const letters = designer.addMenuItem('submenu', 'خطابات') as string;
    expect(menuOf(designer).find((item) => item.id === letters)?.menu).toEqual([{ id: `${letters}-item-1`, label: 'إجراء جديد', action: 'action' }]);
    expect(panel.querySelector('[data-setting="Its menu"] .fd-prop-name')?.textContent).toBe('قائمته');
    expect(panel.querySelector('[data-setting="Items the app gives as it opens"] .fd-prop-name')?.textContent).toBe('عناصر يعطيها التطبيق عند فتحها');
    expect(button(panel, 'إضافة عنصر')).toBeDefined();
    expect(button(panel, 'إضافة خط فاصل')).toBeDefined();
    (host.querySelector('[data-add-part="menu"]') as HTMLButtonElement).click();
    const kinds = [...document.querySelectorAll<HTMLButtonElement>('.fd-menu [role="menuitem"]')].map((b) => b.textContent);
    expect(kinds.slice(-2)).toEqual(['قائمة فرعية خاصة به', 'خط فاصل بين العناصر']);
    valid(designer);
    designer.select(null);
    openTab(panel, 'التخطيط');
    expect(panel.querySelector('[data-setting="Attachment beside the sheet"] .fd-prop-name')?.textContent).toBe('المرفق بجانب الورقة');
  });
});
