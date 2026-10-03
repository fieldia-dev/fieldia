import type { Field, FieldNode, Page, SectionNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { screenCanvas, type ScreenCanvas } from './screen-canvas';

const model: Record<string, Field> = { email: { type: 'char', label: 'Email' } };
const nodes = (page: Page) => (page.layout as { children: SectionNode[] }).children.flatMap((s) => s.children.filter((n): n is FieldNode => n.type === 'field'));

let canvas: ScreenCanvas;
function setup(page = blankPage('screen', 'Site visit')) {
  const designer = createDesigner({ page, model });
  const host = document.createElement('div');
  host.className = 'fd-form';
  document.body.append(host);
  const opened: string[] = [];
  const dropped: string[] = [];
  canvas = screenCanvas({ designer, doc: document, more: (part) => opened.push(part), dropTool: (spec, section, index) => dropped.push(`${spec}@${section}:${index}`) });
  host.append(canvas.element);
  designer.subscribe((state) => canvas.update(state));
  canvas.update(designer.getState());
  const card = (id: string) => canvas.element.querySelector(`.fd-canvas-field[data-node="${id}"]`) as HTMLElement;
  return { designer, opened, dropped, card };
}

/** A screen with a section of two fields: a date and a choice, two columns. */
function visit() {
  const s = setup();
  const date = s.designer.addQuestion('date') as string;
  s.designer.updateQuestion(date, { label: 'Visit date', help: 'The day of the visit' });
  const step = s.designer.addQuestion('dropdown') as string;
  s.designer.updateQuestion(step, { label: 'Next step', required: true });
  s.designer.setColspan(step, 2);
  s.designer.select(null);
  return { ...s, date, step };
}

afterEach(() => {
  canvas?.destroy();
  document.body.replaceChildren();
});

describe('the screen canvas — drawn as the viewer draws it', () => {
  it('lays sections and fields out with the viewer’s own grid', () => {
    const { card, date, step } = visit();
    const section = canvas.element.querySelector('fieldset.fd-section') as HTMLElement;
    expect(section.dataset['dropSection']).toBe('section-1');
    expect(section.querySelector('legend')?.textContent).toBe('Section 1');
    const grid = section.querySelector('.fd-grid') as HTMLElement;
    expect(grid.style.getPropertyValue('--fd-columns')).toBe('2');
    expect([...grid.children].map((c) => (c as HTMLElement).dataset['node'])).toEqual([date, step]);
    expect(card(step).style.getPropertyValue('--fd-span')).toBe('2');
    expect(card(step).classList.contains('fd-required')).toBe(true);
    expect(card(date).querySelector('.fd-label')?.textContent).toBe('Visit date');
    expect(card(date).querySelector('.fd-help')?.textContent).toBe('The day of the visit');
  });

  it('draws each field with its real widget, which cannot be typed in on the canvas', () => {
    const { card, date } = visit();
    const widget = card(date).querySelector('.fd-canvas-widget') as HTMLElement;
    expect(widget.hasAttribute('inert')).toBe(true);
    expect(widget.querySelector('input')).not.toBeNull();
  });

  it('says where to drop in a section with no fields yet', () => {
    setup();
    const empty = canvas.element.querySelector('.fd-canvas-empty') as HTMLElement;
    expect(empty.hidden).toBe(false);
    expect(empty.textContent).toBe('Drop a field here, or pick one in the toolbox.');
  });
});

describe('the screen canvas — a field edited where it stands', () => {
  it('opens the field clicked for editing: its bar, its label and its help to type in', () => {
    const { designer, card, date } = visit();
    card(date).click();
    expect(designer.getState().selected).toBe(date);
    const open = card(date);
    expect(open.classList.contains('fd-editing')).toBe(true);
    expect(open.querySelector('.fd-field-bar')).not.toBeNull();
    expect((open.querySelector('[data-inline="label"]') as HTMLInputElement).value).toBe('Visit date');
    expect((open.querySelector('[data-inline="help"]') as HTMLInputElement).value).toBe('The day of the visit');
    // Only one field is open at a time.
    expect(canvas.element.querySelectorAll('.fd-editing')).toHaveLength(1);
  });

  it('puts the cursor in the words clicked, and keeps it there while typing', () => {
    const { designer, card, date } = visit();
    (card(date).querySelector('.fd-label') as HTMLElement).click();
    const label = card(date).querySelector('[data-inline="label"]') as HTMLInputElement;
    expect(document.activeElement).toBe(label);
    label.value = 'Day of the visit';
    label.dispatchEvent(new Event('input', { bubbles: true }));
    expect(designer.getPage().fields[nodes(designer.getPage())[0].field].label).toBe('Day of the visit');
    // Redrawn around it, the box is the same box, still focused.
    expect(card(date).querySelector('[data-inline="label"]')).toBe(label);
    expect(document.activeElement).toBe(label);
    const help = card(date).querySelector('[data-inline="help"]') as HTMLInputElement;
    help.value = '';
    help.dispatchEvent(new Event('input', { bubbles: true }));
    expect(designer.getPage().fields[nodes(designer.getPage())[0].field].help).toBeUndefined();
  });

  it('types a model field’s label onto the page, not into the model', () => {
    const { designer, card } = setup();
    const email = designer.addModelField('email') as string;
    const label = card(email).querySelector('[data-inline="label"]') as HTMLInputElement;
    label.value = 'Work email';
    label.dispatchEvent(new Event('input', { bubbles: true }));
    expect(nodes(designer.getPage())[0].label).toBe('Work email');
    expect(designer.getPage().fields['email'].label).toBe('Email');
  });

  it('types a choice’s options in place: Enter adds the next, Backspace on an empty one takes it away', () => {
    const { designer, card, step } = visit();
    card(step).click();
    const inputs = () => [...card(step).querySelectorAll<HTMLInputElement>('.fd-q-option input')];
    expect(inputs().map((i) => i.value)).toEqual(['Option 1']);
    inputs()[0].value = 'Send a quote';
    inputs()[0].dispatchEvent(new Event('input', { bubbles: true }));
    inputs()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(inputs().map((i) => i.value)).toEqual(['Send a quote', 'Option 2']);
    expect(document.activeElement).toBe(inputs()[1]);
    inputs()[1].value = '';
    inputs()[1].dispatchEvent(new Event('input', { bubbles: true }));
    inputs()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    expect(inputs().map((i) => i.value)).toEqual(['Send a quote']);
    expect(document.activeElement).toBe(inputs()[0]);
    const field = designer.getPage().fields[nodes(designer.getPage())[1].field] as Field & { options: { label: string }[] };
    expect(field.options.map((o) => o.label)).toEqual(['Send a quote']);
  });

  it('puts the next option right under the one Enter is pressed in', () => {
    const { designer, card, step } = visit();
    designer.setOptions(step, ['Send a quote', 'Close']);
    card(step).click();
    const inputs = () => [...card(step).querySelectorAll<HTMLInputElement>('.fd-q-option input')];
    inputs()[0].focus();
    inputs()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(inputs().map((i) => i.value)).toEqual(['Send a quote', 'Option 3', 'Close']);
    expect(document.activeElement).toBe(inputs()[1]);
  });

  it('takes an emptied option out from the middle, the others keeping their words', () => {
    const { designer, card, step } = visit();
    designer.setOptions(step, ['Send a quote', 'Book a visit', 'Close']);
    card(step).click();
    const inputs = () => [...card(step).querySelectorAll<HTMLInputElement>('.fd-q-option input')];
    inputs()[1].focus();
    inputs()[1].value = '';
    inputs()[1].dispatchEvent(new Event('input', { bubbles: true }));
    inputs()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    expect(inputs().map((i) => i.value)).toEqual(['Send a quote', 'Close']);
    expect(document.activeElement).toBe(inputs()[0]);
    const field = designer.getPage().fields[nodes(designer.getPage())[1].field] as Field & { options: { label: string }[] };
    expect(field.options.map((o) => o.label)).toEqual(['Send a quote', 'Close']);
  });

  it('takes an option left empty away once the cursor goes to another, following it there', async () => {
    const { designer, card, step } = visit();
    designer.setOptions(step, ['Send a quote', 'Book a visit', 'Close']);
    card(step).click();
    const inputs = () => [...card(step).querySelectorAll<HTMLInputElement>('.fd-q-option input')];
    inputs()[0].focus();
    inputs()[0].value = '';
    inputs()[0].dispatchEvent(new Event('input', { bubbles: true }));
    inputs()[2].focus();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(inputs().map((i) => i.value)).toEqual(['Book a visit', 'Close']);
    expect(document.activeElement).toBe(inputs()[1]);
  });

  it('puts the field down when the page around it is clicked, and the section when its own space is', () => {
    const { designer, card, date } = visit();
    card(date).click();
    (canvas.element.querySelector('fieldset.fd-section') as HTMLElement).click();
    expect(designer.getState().selected).toBe('section-1');
    canvas.element.click();
    expect(designer.getState().selected).toBeNull();
    expect(canvas.element.querySelector('.fd-editing')).toBeNull();
  });

  it('opens the panel where the bar says', () => {
    const { opened, card, date } = visit();
    card(date).click();
    (card(date).querySelector('[aria-label="More settings"]') as HTMLElement).click();
    expect(opened).toEqual(['field']);
  });
});

describe('the screen canvas — sections, tabs and the title', () => {
  it('renames a section where its title is', () => {
    const { designer } = visit();
    (canvas.element.querySelector('.fd-canvas-section-title') as HTMLElement).click();
    expect(designer.getState().selected).toBe('section-1');
    const title = canvas.element.querySelector('.fd-canvas-section-title-input') as HTMLInputElement;
    expect(document.activeElement).toBe(title);
    title.value = 'Visit';
    title.dispatchEvent(new Event('input', { bubbles: true }));
    expect((designer.getPage().layout as { children: SectionNode[] }).children[0].title).toBe('Visit');
  });

  it('shows a sheet’s tabs as the viewer does, the tab of what is picked open', () => {
    const { designer } = setup(blankPage('sheet', 'Customer'));
    const tabsId = designer.addTabs() as string;
    const second = designer.addTab(tabsId, 'Notes') as string;
    const tabs = () => [...canvas.element.querySelectorAll<HTMLElement>('.fd-tablist .fd-tab')];
    expect(tabs().map((t) => `${t.textContent}:${t.getAttribute('aria-selected')}`)).toEqual(['Tab 1:true', 'Notes:false']);
    const notesSection = (designer.getPage().layout as unknown as { children: { type: string; children: { id: string; children: { id: string }[] }[] }[] }).children
      .find((n) => n.type === 'tabs')!.children.find((t) => t.id === second)!.children[0].id;
    const field = designer.addQuestion('paragraph', { parent: notesSection }) as string;
    expect(tabs().map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true']);
    expect(canvas.element.querySelector(`.fd-canvas-field[data-node="${field}"]`)).not.toBeNull();
    const firstTab = tabs()[0].dataset['node'];
    tabs()[0].click();
    expect(designer.getState().selected).toBe(firstTab);
    expect(tabs().map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(canvas.element.querySelector(`.fd-canvas-field[data-node="${field}"]`)).toBeNull();
  });

  it('puts the bar under a field right below the tabs, so the tabs stay readable', () => {
    const { designer } = setup(blankPage('sheet', 'Customer'));
    designer.addTabs();
    const tabSection = (designer.getPage().layout as unknown as { children: { type: string; children: { children: { id: string }[] }[] }[] }).children.find((n) => n.type === 'tabs')!.children[0].children[0].id;
    const first = designer.addQuestion('amount', { parent: tabSection }) as string;
    const field = (id: string) => canvas.element.querySelector(`.fd-canvas-field[data-node="${id}"]`) as HTMLElement;
    expect(field(first).classList.contains('fd-bar-below')).toBe(true);
    const third = designer.addQuestion('date', { parent: tabSection }) as string;
    designer.addQuestion('date', { parent: tabSection });
    designer.select(third);
    expect(field(third).classList.contains('fd-bar-below')).toBe(true);
    const fourth = designer.addQuestion('date', { parent: tabSection }) as string;
    expect(field(fourth).classList.contains('fd-bar-below')).toBe(false);
  });

  it('shows a sheet’s title big over everything, and picks the page from it', () => {
    const { designer } = setup(blankPage('sheet', 'Customer'));
    const title = canvas.element.querySelector('.fd-canvas-title') as HTMLElement;
    expect(title.hidden).toBe(false);
    expect(title.textContent).toBe('Name');
    designer.select('section-1');
    title.click();
    expect(designer.getState().selected).toBeNull();
  });

  it('lets go of every widget when taken down', () => {
    const { card, date } = visit();
    expect(card(date)).not.toBeNull();
    canvas.destroy();
    expect(canvas.element.querySelectorAll('.fd-canvas-field')).toHaveLength(0);
  });
});

