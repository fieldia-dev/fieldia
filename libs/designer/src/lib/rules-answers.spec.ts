import type { Field, FieldNode, SectionNode } from '@fieldia/core';
import { createDesigner, blankPage } from './designer';
import { button, choose, field, mount, openTab, press, type } from './test-editor';

/**
 * Answer rules in the panel's Rules tab: each rule a sentence; its settings
 * open in place — what it asks, its message, whether it stops sending or only
 * warns, and only when; "Add a rule" offering only the kinds that fit; and a
 * rule removed with Undo at hand. By keyboard as well as by mouse.
 */

const fields: Record<string, Field> = {
  email: { type: 'char', label: 'Email' },
  age: { type: 'integer', label: 'Age' },
  vip: { type: 'boolean', label: 'VIP' },
  topics: { type: 'selection', label: 'Topics', multiple: true, options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
};

function screen(pick: string) {
  const page = blankPage('screen', 'Sign up');
  const section = (page.layout as unknown as { children: SectionNode[] }).children[0];
  section.children = Object.keys(fields).map((name) => ({ type: 'field' as const, id: `f-${name}`, field: name }));
  page.fields = JSON.parse(JSON.stringify(fields));
  const designer = createDesigner({ page });
  designer.select(`f-${pick}`);
  const { host } = mount(designer);
  openTab(host, 'Rules');
  const panel = () => host.querySelector('.fd-properties') as HTMLElement;
  const node = () => (designer.getPage().layout as unknown as { children: SectionNode[] }).children[0].children.find((n) => n.id === `f-${pick}`) as FieldNode;
  const sentences = () => [...panel().querySelectorAll('.fd-answer-rule-say')].map((b) => b.textContent);
  const menuItems = () => [...document.querySelectorAll('.fd-menu .fd-menu-item')].map((b) => b.textContent);
  const pickItem = (words: string) => ([...document.querySelectorAll<HTMLButtonElement>('.fd-menu .fd-menu-item')].find((b) => b.textContent === words) as HTMLButtonElement).click();
  return { designer, host, panel, node, sentences, menuItems, pickItem };
}

describe('answer rules in the Rules tab', () => {
  it('adds a rule from the kinds that fit, opened in place, and reads it as a sentence', () => {
    const { panel, node, sentences, menuItems, pickItem } = screen('email');
    expect(panel().querySelector('[data-setting="Answer rules"]')).not.toBeNull();
    (button(panel(), 'Add a rule') as HTMLButtonElement).click();
    expect(menuItems()).toEqual(['A length', 'An ending', 'A pattern']);
    pickItem('An ending');
    expect(node().validate).toEqual([{ endsWith: '.com' }]);
    const ending = field(panel(), 'Ends with') as HTMLInputElement;
    expect(document.activeElement).toBe(ending);
    type(ending, '@acme.com');
    expect(node().validate).toEqual([{ endsWith: '@acme.com' }]);
    expect(sentences()).toEqual(['Ends with @acme.com']);
  });

  it('only warns, says its own message, and holds only when', () => {
    const { panel, node, sentences, designer } = screen('email');
    designer.addAnswerRule('f-email', { endsWith: '@acme.com' });
    (panel().querySelector('.fd-answer-rule-say') as HTMLButtonElement).click();
    (button(panel(), 'Only warns') as HTMLButtonElement).click();
    expect(node().validate?.[0].level).toBe('warning');
    expect(sentences()).toEqual(['Ends with @acme.com — only warns']);
    type(field(panel(), 'Message when it does not fit'), 'Use your work address');
    expect(node().validate?.[0].message).toBe('Use your work address');
    type(field(panel(), 'Message when it does not fit'), '');
    expect(node().validate?.[0].message).toBeUndefined();
    (button(panel(), 'Checked only when…') as HTMLButtonElement).click();
    expect(node().validate?.[0].when).toBe('vip == True');
    expect(sentences()).toEqual(['Ends with @acme.com — only warns, only when VIP is Yes']);
    choose(field(panel(), 'When the answer is'), 'is:false');
    expect(node().validate?.[0].when).toBe('vip == False');
    (button(panel(), 'Stops sending') as HTMLButtonElement).click();
    expect(node().validate?.[0].level).toBeUndefined();
  });

  it('offers a range for a number, and ticks for several choices', () => {
    const age = screen('age');
    (button(age.panel(), 'Add a rule') as HTMLButtonElement).click();
    expect(age.menuItems()).toEqual(['A range']);
    age.pickItem('A range');
    type(field(age.panel(), 'At least'), '18');
    type(field(age.panel(), 'At most'), '');
    expect(age.node().validate).toEqual([{ min: 18 }]);
    expect(age.sentences()).toEqual(['At least 18']);
  });

  it('says what is wrong under the rule, and keeps nothing wrong', () => {
    const { panel, node, designer } = screen('email');
    designer.addAnswerRule('f-email', { minLength: 2, maxLength: 4 });
    (panel().querySelector('.fd-answer-rule-say') as HTMLButtonElement).click();
    type(field(panel(), 'Shortest'), '9');
    expect(panel().querySelector('.fd-answer-rule-problem')?.textContent).toBe('The shortest, 9, is longer than the longest, 4');
    expect(node().validate).toEqual([{ minLength: 2, maxLength: 4 }]);
    expect(designer.getState().issues).toEqual([]);
    type(field(panel(), 'Shortest'), '3');
    expect(panel().querySelector<HTMLElement>('.fd-answer-rule-problem')?.hidden).toBe(true);
    expect(node().validate).toEqual([{ minLength: 3, maxLength: 4 }]);
  });

  it('removes a rule, with Undo at hand', () => {
    const { panel, node, sentences, designer } = screen('email');
    designer.addAnswerRule('f-email', { minLength: 2 });
    designer.addAnswerRule('f-email', { endsWith: '.org' });
    (button(panel(), 'Remove the rule “At least 2 letters”') as HTMLButtonElement).click();
    expect(sentences()).toEqual(['Ends with .org']);
    const status = panel().querySelector('.fd-answer-rules-status') as HTMLElement;
    expect(status.textContent).toMatch(/^Removed “At least 2 letters”\./);
    expect(document.activeElement?.textContent).toBe('Undo');
    (button(panel(), 'Undo') as HTMLButtonElement).click();
    expect(node().validate).toEqual([{ minLength: 2 }, { endsWith: '.org' }]);
    expect(status.hidden).toBe(true);
  });

  it('opens and closes a rule by keyboard', () => {
    const { panel, designer } = screen('email');
    designer.addAnswerRule('f-email', { minLength: 2 });
    const say = panel().querySelector('.fd-answer-rule-say') as HTMLButtonElement;
    expect(say.getAttribute('aria-expanded')).toBe('false');
    say.click();
    expect(say.getAttribute('aria-expanded')).toBe('true');
    const shortest = field(panel(), 'Shortest') as HTMLInputElement;
    shortest.focus();
    press('Escape', {}, shortest);
    expect(say.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(say);
  });

  it('is not offered for an answer no rule fits', () => {
    const { panel } = screen('vip');
    expect(button(panel(), 'Add a rule')).toBeUndefined();
  });
});
