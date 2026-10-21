import { createMemoryDataSource, type Page } from '@fieldia/core';
import { loadParts, mountViewer, type ViewerHandle } from '@fieldia/viewer';
import { fieldia } from './dom';

/**
 * The DOM helpers on a form the viewer draws, as an app's own tests would use them (Jest, jsdom): typing and leaving,
 * picking, ticking, pressing, and reading back what a person sees — the field's problems and its box.
 */

const page: Page = {
  fieldia: '0.7',
  id: 'enquiry',
  title: 'Enquiry',
  data: { kind: 'record', model: 'crm.enquiry' },
  fields: {
    name: { type: 'char', label: 'Your name', required: true },
    email: { type: 'char', label: 'Email' },
    seats: { type: 'integer', label: 'Workstations', min: 1 },
    kind: { type: 'selection', label: 'Kind', options: [{ value: 'office', label: 'Office' }, { value: 'shop', label: 'Shop' }] },
    floor: { type: 'selection', label: 'Floor', options: [{ value: 'g', label: 'Ground' }, { value: 'u', label: 'Upper' }] },
    extras: { type: 'selection', label: 'Extras', multiple: true, options: [{ value: 'park', label: 'Parking' }, { value: 'kitchen', label: 'Kitchen' }, { value: 'gym', label: 'Gym' }] },
    agree: { type: 'boolean', label: 'I agree to be called' },
    note: { type: 'text', label: 'Note', help: 'Anything we should know' },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-name', field: 'name' },
      { type: 'field', id: 'f-email', field: 'email', widget: 'email' },
      { type: 'field', id: 'f-seats', field: 'seats' },
      { type: 'field', id: 'f-kind', field: 'kind' },
      { type: 'field', id: 'f-floor', field: 'floor', widget: 'radio' },
      { type: 'field', id: 'f-extras', field: 'extras' },
      { type: 'field', id: 'f-agree', field: 'agree' },
      { type: 'field', id: 'f-note', field: 'note' },
    ],
  },
};

let handle: ViewerHandle | undefined;
beforeAll(() => loadParts());
afterEach(() => {
  handle?.destroy();
  handle = undefined;
  document.body.replaceChildren();
});

async function mount() {
  const host = document.createElement('div');
  document.body.append(host);
  const dataSource = createMemoryDataSource();
  handle = mountViewer(host, { page, dataSource });
  await handle.drawn;
  return { host, form: handle.form, dataSource };
}

describe('@fieldia/testing in a DOM', () => {
  it('finds fields by the words of their label, or by name, and says which there are when none fits', async () => {
    const { host } = await mount();
    const form = fieldia(host);
    expect(form.labels()).toEqual(['Your name', 'Email', 'Workstations', 'Kind', 'Floor', 'Extras', 'I agree to be called', 'Note']);
    expect(form.field('Your name').getAttribute('data-field')).toBe('name');
    expect(form.field({ field: 'email' }).getAttribute('data-field')).toBe('email');
    expect(() => form.field('Phone')).toThrow('No field labelled “Phone”. The fields shown: Your name, Email, Workstations, Kind, Floor, Extras, I agree to be called, Note.');
  });

  it('types and leaves a box as a person does: the form holds it, and a problem is said as it is left', async () => {
    const { host, form: state } = await mount();
    const form = fieldia(host);
    await form.fill('Your name', 'Mona Adel');
    expect(state.getState().values['name']).toBe('Mona Adel');
    expect(form.valueOf('Your name')).toBe('Mona Adel');
    // A number under its least: said as the box is left.
    await form.fill('Workstations', '0');
    expect(form.errorsOf('Workstations')).toEqual([expect.stringContaining('1')]);
    await form.fill('Workstations', '12');
    expect(form.errorsOf('Workstations')).toEqual([]);
    expect(state.getState().values['seats']).toBe(12);
    await form.fill('Note', 'Near the metro');
    expect(form.valueOf('Note')).toBe('Near the metro');
  });

  it('picks from a list, a radio and several boxes, and ticks a yes-or-no', async () => {
    const { host, form: state } = await mount();
    const form = fieldia(host);
    await form.pick('Kind', 'Shop');
    await form.pick('Floor', 'Upper');
    await form.pick('Extras', 'Parking', 'Gym');
    await form.check('I agree to be called');
    expect(state.getState().values).toMatchObject({ kind: 'shop', floor: 'u', extras: ['park', 'gym'], agree: true });
    expect([form.valueOf('Kind'), form.valueOf('Floor'), form.valueOf('Extras'), form.valueOf('I agree to be called')]).toEqual(['Shop', 'Upper', ['Parking', 'Gym'], true]);
    await form.pick('Extras', 'Kitchen');
    await form.check('I agree to be called', false);
    expect(state.getState().values).toMatchObject({ extras: ['kitchen'], agree: false });
    await expect(form.pick('Kind', 'Farm')).rejects.toThrow('“Kind” offers');
  });

  it('presses a button by its words, and reads the problems a refused save says', async () => {
    const { host, dataSource } = await mount();
    const form = fieldia(host);
    const saved = jest.spyOn(dataSource, 'save');
    // Save shows once there is something to save.
    expect(() => form.field('Your name')).not.toThrow();
    await form.fill('Email', 'mona@example.com');
    await form.press('Save');
    expect(form.errorsOf('Your name')).toEqual([expect.stringMatching(/Your name/)]);
    expect(saved).not.toHaveBeenCalled();
    await form.fill('Your name', 'Mona Adel');
    await form.press('Save');
    expect(form.errorsOf('Your name')).toEqual([]);
    expect(saved).toHaveBeenCalledTimes(1);
    await expect(form.press('Send to the moon')).rejects.toThrow('No button “Send to the moon”. The buttons shown:');
  });
});
