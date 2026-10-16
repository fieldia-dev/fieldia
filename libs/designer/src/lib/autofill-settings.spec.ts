import type { FieldNode, Page, SectionNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { pageChanges } from './page-checks';
import { choose, field, mount, openTab, typeAndLeave } from './test-editor';

/**
 * What the browser fills a box in with and the keyboard a phone shows, on a field's Content tab; and a public page's
 * bot check on the page's Rules tab — set as a person sets them.
 */

function screen(kind: 'record' | 'responses' = 'record', locale?: 'ar') {
  const page = blankPage('screen', 'Sign-up');
  if (kind === 'responses') page.data = { kind: 'responses' };
  page.fields = {
    name: { type: 'char', label: 'Name' },
    home: { type: 'json', label: 'Home' },
    agree: { type: 'boolean', label: 'Agree' },
    seats: { type: 'integer', label: 'Seats' },
  } as Page['fields'];
  const section = (page.layout as unknown as { children: SectionNode[] }).children[0];
  section.children = [
    { type: 'field', id: 'f-name', field: 'name' },
    { type: 'field', id: 'f-home', field: 'home', widget: 'address' },
    { type: 'field', id: 'f-agree', field: 'agree' },
    { type: 'field', id: 'f-seats', field: 'seats' },
    { type: 'slot', id: 's-turnstile', name: 'turnstile' },
  ] as SectionNode['children'];
  const designer = createDesigner({ page, ...(locale ? { locale } : {}) });
  const { host } = mount(designer, { mode: 'advanced' });
  const node = (id: string) => (designer.getPage().layout as unknown as { children: SectionNode[] }).children[0].children.find((n) => n.id === id) as FieldNode;
  const row = (name: string) => host.querySelector(`[data-setting="${name}"]`) as HTMLElement;
  return { designer, host, node, row };
}

describe('what the browser fills a field in with, and a phone’s keyboard, in the panel', () => {
  it('a line of words: a purpose chosen, its kind’s own again, and the keyboard', () => {
    const { designer, host, node, row } = screen();
    designer.select('f-name');
    openTab(host, 'Content');
    const purpose = field(row('Filled in by the browser as'), 'Filled in by the browser as');
    expect([...(purpose?.options ?? [])].slice(0, 4).map((o) => o.textContent)).toEqual(['As its kind says', 'Nothing: the browser offers none', 'Full name', 'First name']);
    choose(purpose, 'given-name');
    expect(node('f-name').autocomplete).toBe('given-name');
    choose(field(row('Keyboard on a phone'), 'Keyboard on a phone'), 'numeric');
    expect(node('f-name').inputmode).toBe('numeric');
    choose(field(row('Filled in by the browser as'), 'Filled in by the browser as'), '');
    expect(node('f-name')).not.toHaveProperty('autocomplete');
    designer.undo();
    expect(node('f-name').autocomplete).toBe('given-name');
  });

  it('keeps a purpose the page names that the list does not offer, as written', () => {
    const { designer, host, row } = screen();
    designer.updateQuestion('f-name', { autocomplete: 'shipping work tel' });
    designer.select('f-name');
    openTab(host, 'Content');
    expect(field(row('Filled in by the browser as'), 'Filled in by the browser as')?.value).toBe('shipping work tel');
  });

  it('an address in parts: whose it is, and no keyboard of its own; a tick box: neither', () => {
    const { designer, host, node, row } = screen();
    designer.select('f-home');
    openTab(host, 'Content');
    const purpose = field(row('Filled in by the browser as'), 'Filled in by the browser as');
    expect([...(purpose?.options ?? [])].map((o) => o.value)).toEqual(['', 'shipping', 'billing', 'off']);
    choose(purpose, 'shipping');
    expect(node('f-home').autocomplete).toBe('shipping');
    expect(row('Keyboard on a phone').closest('[hidden]')).not.toBeNull();
    designer.select('f-agree');
    expect(row('Filled in by the browser as').closest('[hidden]')).not.toBeNull();
  });

  it('says what changed, and speaks Arabic', () => {
    const { designer } = screen();
    const before = designer.getPage();
    designer.updateQuestion('f-seats', { autocomplete: 'cc-exp-year', inputmode: 'numeric' });
    expect(pageChanges(before, designer.getPage())).toEqual(['“Seats”: what the browser fills it in with changed', '“Seats”: its keyboard on a phone changed']);
    const ar = screen('record', 'ar');
    ar.designer.select('f-name');
    openTab(ar.host, 'المحتوى');
    expect(ar.row('Filled in by the browser as').querySelector('.fd-prop-name')?.textContent).toBe('يملؤه المتصفح بـ');
    expect(ar.row('Keyboard on a phone').querySelector('.fd-prop-name')?.textContent).toBe('لوحة المفاتيح على الهاتف');
  });
});

describe('a public page’s bot check, in the panel', () => {
  it('is offered on a page of responses only', () => {
    const record = screen('record');
    openTab(record.host, 'Rules');
    expect(record.row('Bot check').closest('[hidden]')).not.toBeNull();
    expect(record.designer.setBotCheck({})).toBe(false);
    expect(record.designer.getPage()).not.toHaveProperty('botCheck');
  });

  it('is ticked on, its hidden box, its seconds and its captcha’s slot set, and said in the changes', () => {
    const { designer, host, row } = screen('responses');
    const before = designer.getPage();
    openTab(host, 'Rules');
    expect(row('Hidden box for bots').closest('[hidden]')).not.toBeNull();
    (field(row('Bot check'), 'Check that a person sends it') as HTMLInputElement).click();
    expect(designer.getPage().botCheck).toEqual({});
    expect(pageChanges(before, designer.getPage())).toContain('The bot check is on');
    (field(row('Hidden box for bots'), 'A hidden box only bots fill') as HTMLInputElement).click();
    expect(designer.getPage().botCheck).toEqual({ honeypot: false });
    typeAndLeave(field(row('Fewest seconds to fill'), 'Fewest seconds to fill it'), '5');
    expect(designer.getPage().botCheck).toEqual({ honeypot: false, minSeconds: 5 });
    const captcha = field(row('Captcha drawn in'), 'Captcha drawn in');
    expect([...(captcha?.options ?? [])].map((o) => o.textContent)).toEqual(['No captcha', 'turnstile']);
    choose(captcha, 'turnstile');
    expect(designer.getPage().botCheck).toEqual({ honeypot: false, minSeconds: 5, captcha: 'turnstile' });
    (field(row('Bot check'), 'Check that a person sends it') as HTMLInputElement).click();
    expect(designer.getPage()).not.toHaveProperty('botCheck');
  });

  it('speaks Arabic', () => {
    const { host, row } = screen('responses', 'ar');
    openTab(host, 'القواعد');
    expect(row('Bot check').querySelector('.fd-prop-name')?.textContent).toBe('التحقق من الروبوتات');
  });
});
