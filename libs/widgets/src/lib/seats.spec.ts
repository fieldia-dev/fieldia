import { createForm, createMemoryDataSource, type FieldNode, type Form, type Page } from '@fieldia/core';
import { createWidget, type WidgetFactory } from './widgets';
import { ownListWidget } from './own-list';
import { choiceTagsWidget, searchWidget } from './choice-tags';

/**
 * A choice's places, drawn: "2 left" beside an option's words and "Full" on one whose places are all taken, once the
 * data source told how many took them — in a radio group, checkboxes, the browser's list, picture cards, Fieldia's own
 * list, a list that searches and tags alike. A full option is never hidden nor turned off: the form refuses it, said
 * under the field, and every way of drawing a choice keeps what it held.
 */

const page = (multiple = false): Page =>
  ({
    fieldia: '0.11',
    id: 'event-signup',
    data: { kind: 'responses' },
    fields: {
      session: {
        type: 'selection',
        label: 'Session',
        ...(multiple ? { multiple: true } : {}),
        options: [
          { value: 'am', label: 'Morning workshop', seats: 30 },
          { value: 'pm', label: 'Afternoon workshop', seats: 20 },
          { value: 'eve', label: 'Evening talk' },
        ],
      },
    },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'session' }] },
  }) as Page;

const counted = () => createMemoryDataSource({ limits: { 'event-signup': { perChoice: { session: { am: 29, pm: 20 } } } } });

async function draw(widget: string | undefined, form: Form, options?: FieldNode['options']) {
  const node: FieldNode = { type: 'field', id: 'n', field: 'session', ...(widget ? { widget } : {}), ...(options ? { options } : {}) };
  const made = createWidget({ form, name: 'session', field: form.page.fields['session'], node, id: 'fd-session', document });
  document.body.replaceChildren(made.element);
  const refresh = () => made.update({ value: form.getState().values['session'], values: form.getState().values, readonly: false, required: false, invalid: !!form.getState().errors['session'] });
  form.subscribe(refresh);
  refresh();
  await form.settled();
  return made.element;
}

const marks = (element: Element) => [...element.querySelectorAll<HTMLElement>('.fd-seats')].map((mark) => (mark.hidden ? '' : `${mark.textContent}${mark.hasAttribute('data-full') ? '!' : ''}`));

describe('a choice’s places, drawn', () => {
  it('beside a radio’s options, full shown and never turned off; a press on it refused, said under the field', async () => {
    const form = createForm({ page: page(), dataSource: counted() });
    const element = await draw('radio', form);
    expect(marks(element)).toEqual(['1 left', 'Full!', '']);
    const radios = [...element.querySelectorAll<HTMLInputElement>('input[type=radio]')];
    expect(radios.map((radio) => radio.disabled)).toEqual([false, false, false]);
    expect(element.querySelector('label[for="fd-session-1"]')?.textContent).toBe('Afternoon workshopFull');
    radios[1].click();
    expect(radios[1].checked).toBe(false);
    expect(form.getState().values['session']).toBeNull();
    expect(form.getState().errors['session']).toBe('Afternoon workshop is full');
    radios[0].click();
    expect(form.getState().values['session']).toBe('am');
  });

  it('beside checkboxes, the browser’s list and picture cards too', async () => {
    expect(marks(await draw('checkboxes', createForm({ page: page(true), dataSource: counted() })))).toEqual(['1 left', 'Full!', '']);
    const list = await draw(undefined, createForm({ page: page(), dataSource: counted() }));
    expect([...list.querySelectorAll('option')].map((option) => option.textContent)).toEqual(['', 'Morning workshop (1 left)', 'Afternoon workshop (Full)', 'Evening talk']);
    expect(marks(await draw('image-choice', createForm({ page: page(), dataSource: counted() })))).toEqual(['1 left', 'Full!', '']);
    // Cards whose words are out of sight are named with their places.
    const bare = await draw('image-choice', createForm({ page: page(), dataSource: counted() }), { showLabels: false });
    expect([...bare.querySelectorAll('.fd-image-card')].map((card) => card.getAttribute('aria-label'))).toEqual(['Morning workshop, 1 left', 'Afternoon workshop, Full', 'Evening talk']);
  });

  it('shows nothing where the source tells no counts, as before', async () => {
    const { limits: _none, ...source } = createMemoryDataSource();
    const element = await draw('radio', createForm({ page: page(), dataSource: source }));
    expect(marks(element)).toEqual(['', '', '']);
    expect(element.querySelector('label[for="fd-session-1"]')?.textContent).toBe('Afternoon workshop');
  });
});

describe('a choice’s places in the choice part’s lists: its own list, a search, tags', () => {
  /** A widget of the choice part, drawn as the viewer draws it once the part has come. */
  async function drawn(factory: WidgetFactory, form: Form) {
    const node: FieldNode = { type: 'field', id: 'n', field: 'session' };
    const made = factory({ form, name: 'session', field: form.page.fields['session'], node, id: 'fd-session', document });
    document.body.replaceChildren(made.element);
    const refresh = () => made.update({ value: form.getState().values['session'], values: form.getState().values, readonly: false, required: false, invalid: !!form.getState().errors['session'] });
    form.subscribe(refresh);
    await form.settled();
    refresh();
    return made;
  }

  it('beside the own list’s options, a full one picked refused and the box keeping what it held', async () => {
    const form = createForm({ page: page(), dataSource: counted() });
    const { element } = await drawn(ownListWidget, form);
    expect(marks(element)).toEqual(['1 left', 'Full!', '']);
    const rows = [...element.querySelectorAll<HTMLElement>('[role="option"]')];
    expect(rows[1].textContent).toBe('Afternoon workshopFull');
    (element.querySelector('button') as HTMLButtonElement).click();
    rows[1].click();
    expect(form.getState().values['session']).toBeNull();
    expect(form.getState().errors['session']).toBe('Afternoon workshop is full');
    expect(element.querySelector('.fd-own-words')?.textContent).toBe('');
    (element.querySelector('button') as HTMLButtonElement).click();
    rows[0].click();
    expect(element.querySelector('.fd-own-words')?.textContent).toBe('Morning workshop');
  });

  it('beside a searched list’s options, a full one taken refused, the box showing the choice it holds', async () => {
    const form = createForm({ page: page(), dataSource: counted() });
    const { element } = await drawn(searchWidget, form);
    const input = element.querySelector('input') as HTMLInputElement;
    input.focus();
    input.click();
    const items = () => [...element.querySelectorAll<HTMLElement>('[role="option"]')];
    expect(items().map((item) => item.textContent)).toEqual(['Morning workshop1 left', 'Afternoon workshopFull', 'Evening talk']);
    expect(marks(element)).toEqual(['1 left', 'Full!']);
    items()[0].click();
    expect(input.value).toBe('Morning workshop');
    input.click();
    items()[1].click();
    expect(form.getState().values['session']).toBe('am');
    expect(form.getState().errors['session']).toBe('Afternoon workshop is full');
    expect(input.value).toBe('Morning workshop');
  });

  it('beside tags’ options, a full one never added as a tag', async () => {
    const form = createForm({ page: page(true), dataSource: counted() });
    const { element } = await drawn(choiceTagsWidget, form);
    const input = element.querySelector('input') as HTMLInputElement;
    input.focus();
    input.click();
    const items = () => [...element.querySelectorAll<HTMLElement>('[role="option"]')];
    expect(marks(element)).toEqual(['1 left', 'Full!']);
    items()[1].click();
    expect(form.getState().values['session']).toEqual([]);
    expect(element.querySelectorAll('.fd-chip')).toHaveLength(0);
    expect(form.getState().errors['session']).toBe('Afternoon workshop is full');
  });
});
