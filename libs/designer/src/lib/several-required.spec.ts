import type { Field, FieldNode, SectionNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { mount, openTab } from './test-editor';

/**
 * Several fields picked, made required — or not — at once, as one undo step:
 * Yes, No, or As they are. A field the model always requires stays required,
 * and the panel says so.
 */

const model: Record<string, Field> = { email: { type: 'char', label: 'Email', required: true }, phone: { type: 'char', label: 'Work phone' } };

function form() {
  const designer = createDesigner({ page: blankPage('screen', 'Visit'), model });
  const ids = ['Name', 'Phone', 'Notes'].map((label) => {
    const id = designer.addQuestion('short-answer', { parent: 'section-1' }) as string;
    designer.updateQuestion(id, { label });
    return id;
  });
  const email = designer.addModelField('email', { parent: 'section-1' }) as string;
  const phone = designer.addModelField('phone', { parent: 'section-1' }) as string;
  const node = (id: string) => ((designer.getPage().layout as unknown as { children: SectionNode[] }).children[0].children as FieldNode[]).find((n) => n.id === id) as FieldNode;
  const required = (id: string) => designer.getPage().fields[node(id).field].required === true || node(id).required === true;
  return { designer, ids, email, phone, node, required };
}

describe('several fields made required, in the store', () => {
  it('makes every field picked required, as one undo step', () => {
    const { designer, ids, required } = form();
    expect(designer.setEach(ids, { required: true })).toBe(true);
    expect(ids.map(required)).toEqual([true, true, true]);
    designer.undo();
    expect(ids.map(required)).toEqual([false, false, false]);
  });

  it('takes a rule for when it is required away, as a field’s own Required does', () => {
    const { designer, ids, node, required } = form();
    designer.setRule(ids[1], 'required', { field: node(ids[0]).field, equals: 'x' });
    expect(typeof node(ids[1]).required).toBe('string');
    designer.setEach(ids, { required: true });
    expect(node(ids[1]).required).toBeUndefined();
    expect(required(ids[1])).toBe(true);
    designer.setEach(ids, { required: false });
    expect(ids.map(required)).toEqual([false, false, false]);
  });

  it('leaves a field the model requires required, its place on the page saying no more', () => {
    const { designer, ids, email, node, required } = form();
    designer.setEach([...ids, email], { required: true });
    expect(node(email).required).toBe(true);
    expect(designer.getPage().fields['email']).toEqual(model['email']);
    designer.setEach([...ids, email], { required: false });
    expect(node(email).required).toBeUndefined();
    expect(required(email)).toBe(true);
    expect(ids.map(required)).toEqual([false, false, false]);
  });

  it('is refused, changing none, when a part picked is not a field', () => {
    const { designer, ids, required } = form();
    const line = designer.addBlock('divider', { parent: 'section-1' }) as string;
    expect(designer.setEach([ids[0], line], { required: true })).toBe(false);
    expect(designer.getState().issues).toEqual(['A divider is not answered: only fields are required']);
    expect(required(ids[0])).toBe(false);
  });
});

describe('several fields made required, in the panel', () => {
  function picked(which: (made: ReturnType<typeof form>) => string[]) {
    const made = form();
    const { host } = mount(made.designer, { mode: 'advanced' });
    const ids = which(made);
    made.designer.pickMany(ids);
    const panel = host.querySelector('.fd-properties') as HTMLElement;
    const tabs = () => [...panel.querySelectorAll('[role="tab"]')].map((t) => t.textContent);
    const row = () => panel.querySelector('[data-setting="Required"]') as HTMLElement | null;
    const pressed = () => [...(row()?.querySelectorAll('button[aria-pressed="true"]') ?? [])].map((b) => b.textContent);
    const press = (words: string) => ([...(row()?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find((b) => b.textContent === words) as HTMLButtonElement).click();
    return { ...made, host, panel, tabs, row, pressed, press, picked: ids };
  }

  it('is on the Rules tab when every part picked is a field: Yes, No or As they are', () => {
    const { host, tabs, row, pressed, press, picked: ids, required, designer } = picked((m) => m.ids);
    expect(tabs()).toEqual(['Layout', 'Rules']);
    openTab(host, 'Rules');
    expect([...(row()?.querySelectorAll('button') ?? [])].map((b) => b.textContent)).toEqual(['Yes', 'No', 'As they are']);
    expect(pressed()).toEqual(['No']);
    press('Yes');
    expect(ids.map(required)).toEqual([true, true, true]);
    expect(pressed()).toEqual(['Yes']);
    designer.undo();
    expect(pressed()).toEqual(['No']);
    designer.updateQuestion(ids[0], { required: true });
    expect(pressed()).toEqual(['As they are']);
    // As they are leaves them so.
    press('As they are');
    expect(ids.map(required)).toEqual([true, false, false]);
  });

  it('says a field the model requires stays required — only that one, not one required here', () => {
    const { host, row, press, email, required, designer, ids } = picked((m) => [m.ids[0], m.email]);
    designer.updateQuestion(ids[0], { required: true });
    openTab(host, 'Rules');
    expect(row()?.querySelector('.fd-set-hint')?.textContent).toBe('“Email” stays required: the model requires it.');
    press('No');
    expect(required(email)).toBe(true);
    expect(required(ids[0])).toBe(false);
  });

  it('counts a field of the model required on its place on the page as required', () => {
    const { host, pressed, press, phone, required } = picked((m) => [m.ids[0], m.phone]);
    openTab(host, 'Rules');
    press('Yes');
    expect(required(phone)).toBe(true);
    expect(pressed()).toEqual(['Yes']);
  });

  it('changes nothing when As they are is pressed while they are alike', () => {
    const { host, pressed, press, picked: ids, required } = picked((m) => m.ids);
    openTab(host, 'Rules');
    press('Yes');
    press('As they are');
    expect(ids.map(required)).toEqual([true, true, true]);
    expect(pressed()).toEqual(['Yes']);
  });

  it('is not offered when a part picked is not a field', () => {
    const { tabs, row } = picked((m) => [m.ids[0], m.designer.addBlock('divider', { parent: 'section-1' }) as string]);
    expect(tabs()).toEqual(['Layout']);
    expect(row()).toBeNull();
  });
});
