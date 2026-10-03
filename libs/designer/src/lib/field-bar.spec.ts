import type { Field, FieldNode, Page, SectionNode } from '@fieldia/core';
import { elementFactory } from './chrome';
import { blankPage, createDesigner } from './designer';
import { fieldBar } from './field-bar';

const model: Record<string, Field> = { credit_limit: { type: 'monetary', label: 'Credit limit', currency: 'EGP' } };
const nodes = (page: Page) => (page.layout as { children: SectionNode[] }).children.flatMap((s) => s.children as FieldNode[]);

function setup() {
  const designer = createDesigner({ page: blankPage('screen', 'Customer'), model });
  const email = designer.addQuestion('email') as string;
  const credit = designer.addModelField('credit_limit') as string;
  const opened: string[] = [];
  const form = document.createElement('div');
  form.className = 'fd-form';
  document.body.append(form);
  const bar = (id: string) => {
    const b = fieldBar({ el: elementFactory(document), doc: document, designer, id, more: (part) => opened.push(part) });
    form.append(b.element);
    b.update(designer.getPage());
    return b;
  };
  const button = (b: { element: HTMLElement }, name: string) => b.element.querySelector(`[aria-label="${name}"]`) as HTMLButtonElement;
  return { designer, email, credit, opened, bar, button };
}

afterEach(() => document.body.replaceChildren());

describe('the bar on the field being edited', () => {
  it('shows how the field is shown, and switches it from a menu of the editors that suit it', () => {
    const { designer, email, bar, button } = setup();
    const b = bar(email);
    const kind = button(b, 'Show as: Email');
    expect(kind.textContent).toBe('Email');
    expect(kind.querySelector('svg')).not.toBeNull();
    kind.click();
    const items = [...document.querySelectorAll<HTMLElement>('.fd-menu [role="menuitemradio"]')];
    // Made on this page, so it may become anything: grouped as the toolbox groups them.
    expect(items.length).toBeGreaterThan(20);
    expect(document.querySelector('.fd-menu-note')?.textContent).toBe('Made on this page, so it can be any kind: what it holds follows.');
    (document.querySelector('.fd-menu [data-item="phone"]') as HTMLElement).click();
    const node = nodes(designer.getPage()).find((n) => n.id === email) as FieldNode;
    expect(node.widget).toBe('phone');
  });

  it('offers a model field only what fits it, and says why', () => {
    const { credit, bar, button } = setup();
    button(bar(credit), 'Show as: Amount').click();
    expect([...document.querySelectorAll('.fd-menu [role="menuitemradio"]')].map((i) => i.textContent)).toEqual(['Amount']);
    expect(document.querySelector('.fd-menu-note')?.textContent).toBe('Credit limit is stored as an amount in the model, so this is the one way to show it.');
  });

  it('makes the field required and optional again', () => {
    const { designer, email, bar, button } = setup();
    const b = bar(email);
    const required = button(b, 'Required');
    expect(required.getAttribute('aria-pressed')).toBe('false');
    required.click();
    b.update(designer.getPage());
    expect(required.getAttribute('aria-pressed')).toBe('true');
    const field = () => designer.getPage().fields[(nodes(designer.getPage()).find((n) => n.id === email) as FieldNode).field];
    expect(field().required).toBe(true);
    required.click();
    expect(field().required).toBeUndefined();
  });

  it('sets the width from a menu, as wide as its section allows', () => {
    const { designer, email, bar, button } = setup();
    const b = bar(email);
    button(b, 'Width').click();
    expect([...document.querySelectorAll('.fd-menu [role="menuitemradio"]')].map((i) => `${i.textContent}:${i.getAttribute('aria-checked')}`)).toEqual(['One column:true', 'Full width:false']);
    (document.querySelector('.fd-menu [data-item="2"]') as HTMLElement).click();
    expect((nodes(designer.getPage()).find((n) => n.id === email) as FieldNode).colspan).toBe(2);
    designer.setColumns('section-1', 1);
    b.update(designer.getPage());
    expect(button(b, 'Width').hidden).toBe(true);
  });

  it('opens the panel where the rest is: when it shows, and more', () => {
    const { designer, email, opened, bar, button } = setup();
    const b = bar(email);
    expect(button(b, 'Show only when…').getAttribute('aria-pressed')).toBe('false');
    button(b, 'Show only when…').click();
    button(b, 'More settings').click();
    expect(opened).toEqual(['when', 'field']);
    const other = designer.addQuestion('yes-no') as string;
    designer.setCondition(email, { field: (nodes(designer.getPage()).find((n) => n.id === other) as FieldNode).field, equals: true });
    b.update(designer.getPage());
    expect(button(b, 'Show only when…').getAttribute('aria-pressed')).toBe('true');
  });

  it('duplicates the field, picking the copy, and deletes it', () => {
    const { designer, email, credit, bar, button } = setup();
    designer.select(email);
    button(bar(email), 'Duplicate').click();
    const copy = designer.getState().selected as string;
    expect(copy).not.toBe(email);
    // Right after the field it copies, and picked.
    expect(nodes(designer.getPage()).map((n) => n.id)).toEqual([email, copy, credit]);
    button(bar(copy), 'Delete').click();
    expect(nodes(designer.getPage()).map((n) => n.id)).not.toContain(copy);
  });

  it('has a grip to drag the field by', () => {
    const { email, bar } = setup();
    const grip = bar(email).element.querySelector('[data-grip]') as HTMLElement;
    expect(grip.getAttribute('aria-label')).toBe('Drag to move');
  });
});
