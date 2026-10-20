import { validatePage } from '@fieldia/core';
import { blankPage, createDesigner, pageChanges } from './designer';
import { mount, openTab } from './test-editor';

/**
 * Approvals, as the designer sets them on a record's screen (`approval`): a tick that its records wait for approval —
 * who is asked, in what order, is the app's to say — whether a record is locked while it waits, and a tick for each
 * field left open meanwhile. A field taken away is no longer one left open. A form of responses has no record to
 * approve: no rows there, and the command refused. In English and in Arabic; each change one undo.
 */

afterEach(() => document.body.replaceChildren());

/** An expense's sheet: what it was for, an amount, and notes for the approvers. */
function expenseSheet(locale?: string) {
  const designer = createDesigner({ page: blankPage('sheet', locale ? 'مصروف' : 'Expense', locale ? { locale } : {}), ...(locale ? { locale } : {}) });
  const ask = (kind: string, label: string) => {
    const id = designer.addQuestion(kind, { parent: 'section-1' }) as string;
    designer.updateQuestion(id, { label });
    return id;
  };
  const amount = ask('number', 'Amount');
  const notes = ask('paragraph', 'Notes for the approvers');
  designer.select(null);
  return { designer, amount, notes };
}

describe('approvals in the designer', () => {
  it('are ticked on the screen’s Rules tab: on, locked while it waits, and the fields left open', () => {
    const { designer } = expenseSheet();
    const { host } = mount(designer, { mode: 'advanced' });
    const panel = host.querySelector('.fd-properties') as HTMLElement;
    openTab(panel, 'Rules');
    const row = (name: string) => panel.querySelector(`[data-setting="${name}"]`) as HTMLElement;
    const on = row('Approvals').querySelector('input') as HTMLInputElement;
    expect(row('Approvals').hidden).toBe(false);
    expect(on.checked).toBe(false);
    expect(row('Locked while it waits').hidden).toBe(true);
    expect(row('Open while it waits').hidden).toBe(true);
    on.click();
    expect(designer.getPage().approval).toEqual({});
    expect(row('Locked while it waits').hidden).toBe(false);
    expect((row('Locked while it waits').querySelector('input') as HTMLInputElement).checked).toBe(true);
    const ticks = () => [...row('Open while it waits').querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    expect(ticks().map((tick) => tick.closest('label')?.textContent)).toEqual(['Name', 'Amount', 'Notes for the approvers']);
    ticks()[2].click();
    const notes = Object.keys(designer.getPage().fields)[2];
    expect(designer.getPage().approval).toEqual({ open: [notes] });
    expect(validatePage(designer.getPage()).ok).toBe(true);
    // Nothing locked: nothing to leave open.
    (row('Locked while it waits').querySelector('input') as HTMLInputElement).click();
    expect(designer.getPage().approval).toEqual({ lock: false });
    expect(row('Open while it waits').hidden).toBe(true);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    // One undo a change; off takes the setting away.
    designer.undo();
    expect(designer.getPage().approval).toEqual({ open: [notes] });
    on.click();
    expect(designer.getPage().approval).toBeUndefined();
    expect(row('Locked while it waits').hidden).toBe(true);
  });

  it('let a field taken away go from those left open', () => {
    const { designer, notes } = expenseSheet();
    const field = Object.keys(designer.getPage().fields)[2];
    expect(designer.setApproval({ open: [field, 'nothing'] })).toBe(true);
    expect(designer.getPage().approval).toEqual({ open: [field] });
    expect(designer.remove([notes])).toBe(true);
    expect(designer.getPage().approval).toEqual({});
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });

  it('are a record screen’s alone: no row on a form of responses, and the command refused there', () => {
    const designer = createDesigner({ page: { ...blankPage('screen', 'Feedback'), data: { kind: 'responses' } } });
    designer.addQuestion('short-answer', { parent: 'section-1' });
    designer.select(null);
    const { host } = mount(designer, { mode: 'advanced' });
    const panel = host.querySelector('.fd-properties') as HTMLElement;
    openTab(panel, 'Rules');
    expect((panel.querySelector('[data-setting="Approvals"]') as HTMLElement).hidden).toBe(true);
    expect(designer.setApproval({ on: true })).toBe(false);
    expect(designer.getPage().approval).toBeUndefined();
  });

  it('are told among a version’s changes', () => {
    const { designer } = expenseSheet();
    const before = designer.getPage();
    designer.setApproval({ on: true });
    expect(pageChanges(before, designer.getPage())).toContain('Its records wait for approval');
    const on = designer.getPage();
    designer.setApproval({ open: [Object.keys(on.fields)[2]] });
    expect(pageChanges(on, designer.getPage())).toContain('What stays open while a record waits for approval changed');
    expect(pageChanges(designer.getPage(), before)).toContain('Its records no longer wait for approval');
  });

  it('speaks Arabic', () => {
    const { designer } = expenseSheet('ar');
    const { host } = mount(designer, { mode: 'advanced' });
    const panel = host.querySelector('.fd-properties') as HTMLElement;
    openTab(panel, 'القواعد');
    const row = panel.querySelector('[data-setting="Approvals"]') as HTMLElement;
    expect(row.querySelector('.fd-prop-name')?.textContent).toBe('الموافقات');
    (row.querySelector('input') as HTMLInputElement).click();
    expect((panel.querySelector('[data-setting="Open while it waits"] .fd-prop-name') as HTMLElement).textContent).toBe('مفتوح أثناء الانتظار');
  });
});
