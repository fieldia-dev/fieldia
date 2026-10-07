import { validatePage, type Field, type SheetNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { mount, openTab } from './test-editor';

/**
 * What sits around a record, as the designer edits it: the gear menu's items
 * — the record's own, the app's actions, reports under Print — each with its
 * When clicked like a button's; whether the pager and breadcrumbs the app
 * gives show; the attachment and the side panel beside the sheet. In English
 * and in Arabic, each change one undo step, each refusal in words.
 */

const model: Record<string, Field> = {
  name: { type: 'char', label: 'Name' },
  cv: { type: 'binary', label: 'CV' },
  email: { type: 'char', label: 'Email' },
};
const sheet = (d: ReturnType<typeof createDesigner>) => d.getPage().layout as SheetNode;
const employee = (locale?: 'ar') => createDesigner({ page: blankPage('sheet', locale ? 'موظف' : 'Employee', locale ? { locale } : undefined), model, ...(locale ? { locale } : {}) });

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
    expect(items).toEqual(['Archive', 'Unarchive', 'Duplicate', 'Delete', 'One of the app’s actions', 'A report under Print']);
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
    designer.select(null);
    openTab(panel, 'التخطيط');
    expect(panel.querySelector('[data-setting="Attachment beside the sheet"] .fd-prop-name')?.textContent).toBe('المرفق بجانب الورقة');
  });
});
