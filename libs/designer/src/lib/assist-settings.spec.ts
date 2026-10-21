import { validatePage } from '@fieldia/core';
import { blankPage, createDesigner, pageChanges } from './designer';
import { mount, openTab } from './test-editor';

/**
 * AI help as the designer sets it: Fill from text on a form's Rules tab — offered or not, its button's words, what it
 * reads (words pasted, or a text field's own words) and the fields it may fill, a tick each — a text field's Draft and
 * Polish beside its other settings, and a list's search in plain words. A field taken away goes from them; a list keeps
 * no Fill from text. Each change one undo; in English and in Arabic.
 */

afterEach(() => document.body.replaceChildren());

const choose = (select: HTMLSelectElement, value: string) => {
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
};

/** An enquiry's sheet: its subject, an email, the buyer's message, a budget and a reply. */
function enquirySheet(locale?: string) {
  const designer = createDesigner({ page: blankPage('sheet', 'Enquiry', locale ? { locale } : {}), ...(locale ? { locale } : {}) });
  const ask = (kind: string, label: string) => {
    const id = designer.addQuestion(kind, { parent: 'section-1' }) as string;
    designer.updateQuestion(id, { label });
    return id;
  };
  const email = ask('email', 'Email');
  const message = ask('paragraph', 'Message');
  ask('amount', 'Budget');
  const reply = ask('paragraph', 'Reply');
  designer.select(null);
  const fieldOf = (id: string) => Object.keys(designer.getPage().fields).find((name) => JSON.stringify(designer.getPage().layout).includes(`"id":"${id}","field":"${name}"`)) as string;
  return { designer, email, message, reply, fieldOf };
}

describe('AI help in the designer', () => {
  it('offers Fill from text on a form’s Rules tab: its words, what it reads, the fields it fills', () => {
    const { designer, message, fieldOf } = enquirySheet();
    const { host } = mount(designer, { mode: 'advanced' });
    const panel = host.querySelector('.fd-properties') as HTMLElement;
    openTab(panel, 'Rules');
    const row = (name: string) => panel.querySelector(`[data-setting="${name}"]`) as HTMLElement;
    const on = row('Fill from text').querySelector('input') as HTMLInputElement;
    expect(row('Fill from text').hidden).toBe(false);
    expect(row('Its button’s words').hidden).toBe(true);
    on.click();
    expect(designer.getPage().suggest).toEqual({});
    expect(row('Its button’s words').hidden).toBe(false);
    const words = row('Its button’s words').querySelector('input') as HTMLInputElement;
    words.value = 'Fill from their message';
    words.dispatchEvent(new Event('change', { bubbles: true }));
    const from = row('Fills from').querySelector('select') as HTMLSelectElement;
    expect([...from.options].map((option) => option.textContent)).toEqual(['Words pasted, or files', 'Name', 'Email', 'Message', 'Reply']);
    choose(from, fieldOf(message));
    // The words read are not filled: no tick for them.
    const ticks = () => [...row('Fields it may fill').querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    expect(ticks().map((tick) => tick.closest('label')?.textContent)).toEqual(['Name', 'Email', 'Budget', 'Reply']);
    ticks()[2].click();
    expect(designer.getPage().suggest).toEqual({ label: 'Fill from their message', fromField: fieldOf(message), fields: [Object.keys(designer.getPage().fields).find((name) => designer.getPage().fields[name].label === 'Budget')] });
    expect(validatePage(designer.getPage()).ok).toBe(true);
    // One undo a change; off takes it all away.
    designer.undo();
    expect(designer.getPage().suggest?.fields).toBeUndefined();
    on.click();
    expect(designer.getPage().suggest).toBeUndefined();
  });

  it('lets a field taken away go from what it fills and reads, and refuses it on a list', () => {
    const { designer, email, message, fieldOf } = enquirySheet();
    expect(designer.setSuggest({ fields: [fieldOf(email)], fromField: fieldOf(message) })).toBe(true);
    expect(designer.remove([email])).toBe(true);
    expect(designer.getPage().suggest).toEqual({ fromField: fieldOf(message) });
    expect(designer.remove([message])).toBe(true);
    expect(designer.getPage().suggest).toEqual({});
    expect(validatePage(designer.getPage()).ok).toBe(true);
    const list = createDesigner({ page: blankPage('list', 'Homes') });
    expect(list.setSuggest({})).toBe(false);
    expect(list.getState().issues).toEqual(['Fill from text fills a form’s fields: a list of records has none to fill']);
  });

  it('gives a text field Draft and Polish beside its other settings, an app’s own tool kept', () => {
    const { designer, reply } = enquirySheet();
    const { host } = mount(designer, { mode: 'advanced' });
    designer.select(reply);
    const switches = () => [...host.querySelectorAll<HTMLButtonElement>('.fd-properties [role="switch"]')].filter((one) => one.getAttribute('aria-label') === 'Draft' || one.getAttribute('aria-label') === 'Polish');
    expect(switches().map((one) => [one.getAttribute('aria-label'), one.getAttribute('aria-checked')])).toEqual([
      ['Draft', 'false'],
      ['Polish', 'false'],
    ]);
    switches()[1].click();
    const node = () => JSON.stringify(designer.getPage().layout);
    expect(node()).toContain('"rewrite":["polish"]');
    switches()[0].click();
    expect(node()).toContain('"rewrite":["draft","polish"]');
    expect(designer.setWidgetOptions(reply, { rewrite: ['polish', { how: 'formal', label: 'More formal' }] })).toBe(true);
    switches()[1].click();
    expect(node()).toContain('"rewrite":[{"how":"formal","label":"More formal"}]');
    switches()[0].click();
    expect(node()).toContain('"rewrite":["draft",{"how":"formal","label":"More formal"}]');
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });

  it('is told among a version’s changes', () => {
    const { designer } = enquirySheet();
    const before = designer.getPage();
    designer.setSuggest({});
    expect(pageChanges(before, designer.getPage())).toContain('It offers Fill from text, by your app’s AI');
    const on = designer.getPage();
    designer.setSuggest({ label: 'Fill from an e-mail' });
    expect(pageChanges(on, designer.getPage())).toContain('How Fill from text fills the form changed');
    expect(pageChanges(designer.getPage(), before)).toContain('It no longer offers Fill from text');
  });

  it('turns a list’s search in plain words on and off', () => {
    const designer = createDesigner({ page: blankPage('list', 'Homes') });
    expect(designer.setListOptions({ searchToFilter: true })).toBe(true);
    expect((designer.getPage().layout as { searchToFilter?: boolean }).searchToFilter).toBe(true);
    expect(designer.setListOptions({ searchToFilter: false })).toBe(true);
    expect((designer.getPage().layout as { searchToFilter?: boolean }).searchToFilter).toBeUndefined();
  });

  it('says it all in Arabic', () => {
    const { designer } = enquirySheet('ar');
    const { host } = mount(designer, { mode: 'advanced' });
    const panel = host.querySelector('.fd-properties') as HTMLElement;
    openTab(panel, 'القواعد');
    const row = panel.querySelector('[data-setting="Fill from text"]') as HTMLElement;
    expect(row.textContent).toContain('الملء من نص');
    (row.querySelector('input') as HTMLInputElement).click();
    expect((panel.querySelector('[data-setting="Fills from"] select') as HTMLSelectElement).options[0].textContent).toBe('كلمات ملصوقة أو ملفات');
  });
});
