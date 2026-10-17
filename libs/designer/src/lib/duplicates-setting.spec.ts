import { validatePage } from '@fieldia/core';
import { blankPage, createDesigner, pageChanges } from './designer';
import { mount, openTab } from './test-editor';

/**
 * Possible duplicates, as the designer sets them on a record's screen (`duplicates`): a tick for each field records
 * like the one typed are found by — words, a number, a date, a choice or a link — and when they are asked for, as typed
 * or only as saved. A field taken away is no longer one; the last taken away takes the setting with it. A form of
 * responses keeps no records to compare with: there is no such row. In English and in Arabic; each change one undo.
 */

afterEach(() => document.body.replaceChildren());

const choose = (select: HTMLSelectElement, value: string) => {
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
};

/** A customer's sheet: its name, a phone, an email, a paragraph of notes and a file. */
function customerSheet(locale?: string) {
  const designer = createDesigner({ page: blankPage('sheet', locale ? 'عميل' : 'Customer', locale ? { locale } : {}), ...(locale ? { locale } : {}) });
  const ask = (kind: string, label: string) => {
    const id = designer.addQuestion(kind, { parent: 'section-1' }) as string;
    designer.updateQuestion(id, { label });
    return id;
  };
  const phone = ask('phone', 'Phone');
  const email = ask('email', 'Email');
  ask('file', 'Contract');
  designer.select(null);
  return { designer, phone, email };
}

describe('possible duplicates in the designer', () => {
  it('are ticked on the screen’s Rules tab, field by field, and asked for as typed or only as saved', () => {
    const { designer } = customerSheet();
    const { host } = mount(designer, { mode: 'advanced' });
    const panel = host.querySelector('.fd-properties') as HTMLElement;
    openTab(panel, 'Rules');
    const row = (name: string) => panel.querySelector(`[data-setting="${name}"]`) as HTMLElement;
    const ticks = () => [...row('Possible duplicates').querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    // The fields records are compared by — never the file — none ticked; when, only once one is.
    expect(ticks().map((tick) => tick.closest('label')?.textContent)).toEqual(['Name', 'Phone', 'Email']);
    expect(ticks().map((tick) => tick.checked)).toEqual([false, false, false]);
    expect(row('Duplicates asked for').hidden).toBe(true);
    ticks()[2].click();
    ticks()[1].click();
    const [, phone, email] = Object.keys(designer.getPage().fields);
    expect(designer.getPage().duplicates).toEqual({ fields: [phone, email] });
    expect(row('Duplicates asked for').hidden).toBe(false);
    const when = row('Duplicates asked for').querySelector('select') as HTMLSelectElement;
    expect([...when.options].map((o) => o.textContent)).toEqual(['As they are typed, and as saved', 'Only as the record is saved']);
    choose(when, 'save');
    expect(designer.getPage().duplicates).toEqual({ fields: [phone, email], on: 'save' });
    expect(validatePage(designer.getPage()).ok).toBe(true);
    // One undo a change; none ticked takes the setting away.
    designer.undo();
    expect(designer.getPage().duplicates).toEqual({ fields: [phone, email] });
    ticks()[1].click();
    ticks()[2].click();
    expect(designer.getPage().duplicates).toBeUndefined();
    expect(row('Duplicates asked for').hidden).toBe(true);
  });

  it('lets a field taken away go from them, and the setting with the last one', () => {
    const { designer, phone, email } = customerSheet();
    const fieldOf = (id: string) => Object.keys(designer.getPage().fields).find((name) => JSON.stringify(designer.getPage().layout).includes(`"id":"${id}","field":"${name}"`)) as string;
    const [phoneField, emailField] = [fieldOf(phone), fieldOf(email)];
    expect(designer.setDuplicates({ fields: [phoneField, emailField] })).toBe(true);
    expect(designer.remove([phone])).toBe(true);
    expect(designer.getPage().duplicates).toEqual({ fields: [emailField] });
    expect(designer.remove([email])).toBe(true);
    expect(designer.getPage().duplicates).toBeUndefined();
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });

  it('are a record screen’s alone: no row on a form of responses, and the command refused there', () => {
    const designer = createDesigner({ page: { ...blankPage('screen', 'Feedback'), data: { kind: 'responses' } } });
    designer.addQuestion('short-answer', { parent: 'section-1' });
    designer.select(null);
    const { host } = mount(designer, { mode: 'advanced' });
    const panel = host.querySelector('.fd-properties') as HTMLElement;
    openTab(panel, 'Rules');
    expect((panel.querySelector('[data-setting="Possible duplicates"]') as HTMLElement).hidden).toBe(true);
    const [field] = Object.keys(designer.getPage().fields);
    expect(designer.setDuplicates({ fields: [field] })).toBe(false);
    expect(designer.getPage().duplicates).toBeUndefined();
  });

  it('are told among a version’s changes', () => {
    const { designer } = customerSheet();
    const before = designer.getPage();
    designer.setDuplicates({ fields: ['name'] });
    expect(pageChanges(before, designer.getPage())).toContain('Possible duplicates are found as records are typed');
    const on = designer.getPage();
    designer.setDuplicates({ on: 'save' });
    expect(pageChanges(on, designer.getPage())).toContain('How possible duplicates are found changed');
    expect(pageChanges(designer.getPage(), before)).toContain('Possible duplicates are no longer found');
  });

  it('speaks Arabic', () => {
    const { designer } = customerSheet('ar');
    const { host } = mount(designer, { mode: 'advanced' });
    const panel = host.querySelector('.fd-properties') as HTMLElement;
    openTab(panel, 'القواعد');
    const row = panel.querySelector('[data-setting="Possible duplicates"]') as HTMLElement;
    expect(row.querySelector('.fd-prop-name')?.textContent).toBe('السجلات المكررة المحتملة');
    (row.querySelector('input[type="checkbox"]') as HTMLInputElement).click();
    const when = panel.querySelector('[data-setting="Duplicates asked for"] select') as HTMLSelectElement;
    expect(when.selectedOptions[0].textContent).toBe('أثناء الكتابة وعند الحفظ');
  });
});
