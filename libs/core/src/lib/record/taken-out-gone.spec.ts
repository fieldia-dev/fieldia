import { createForm, type DataSource, type Line, type Option, type Page, type Values } from '../../index';

/**
 * "X is no longer offered, so it was taken out" is said while it is true. The owner's walk of 0.27: Chemical peel
 * unticked above, then ticked again — the next question offered it again, and the note stayed under it; a listing's
 * "Garden and Private pool are no longer offered" stayed after Villa was picked again. The note goes once what it
 * speaks of is offered again, picked again, or the field is changed by the person; one of several offered again
 * leaves the note naming the rest. However the options came and went: by condition, carried from an earlier
 * question, from the app's list, on a line.
 */

const unit = {
  fieldia: '0.12',
  id: 'unit',
  data: { kind: 'record', model: 'unit' },
  fields: {
    kind: { type: 'selection', label: 'Unit type', options: [{ value: 'villa', label: 'Villa' }, { value: 'flat', label: 'Apartment' }, { value: 'house', label: 'Town house' }] },
    features: {
      type: 'selection',
      label: 'Features',
      multiple: true,
      options: [
        { value: 'garden', label: 'Garden', invisible: "kind not in ('villa', 'house')" },
        { value: 'pool', label: 'Private pool', invisible: "kind != 'villa'" },
        { value: 'lift', label: 'Lift' },
      ],
    },
  },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-kind', field: 'kind' }, { type: 'field', id: 'f-features', field: 'features' }] },
} as Page;

const visit = {
  fieldia: '0.12',
  id: 'visit',
  data: { kind: 'responses' },
  fields: {
    treatments: {
      type: 'selection',
      label: 'Which treatments did you have?',
      multiple: true,
      options: [
        { value: 'botox', label: 'Botox' },
        { value: 'peel', label: 'Chemical peel' },
      ],
    },
    again: { type: 'selection', label: 'Which would you have again?', options: [{ value: 'no_one', label: 'None of them' }], optionsFrom: { field: 'treatments' } },
  },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-treatments', field: 'treatments' }, { type: 'field', id: 'f-again', field: 'again' }] },
} as Page;

describe('a note of options taken out goes once it is no longer true', () => {
  it('a listing: Garden and Private pool taken out for an apartment, said no more once Villa is picked again', () => {
    const form = createForm({ page: unit });
    form.setValue('kind', 'villa');
    form.setValue('features', ['garden', 'pool', 'lift']);
    form.setValue('kind', 'flat');
    expect(form.getState().values['features']).toEqual(['lift']);
    expect(form.getState().takenOut).toEqual({ features: 'Garden and Private pool are no longer offered, so they were taken out' });
    form.setValue('kind', 'villa');
    // Offered again: the note goes; what was taken out stays out, for the person to tick again.
    expect(form.getState().takenOut).toEqual({});
    expect(form.getState().values['features']).toEqual(['lift']);
  });

  it('one of two offered again: the note names the one still not offered', () => {
    const form = createForm({ page: unit });
    form.setValue('kind', 'villa');
    form.setValue('features', ['garden', 'pool']);
    form.setValue('kind', 'flat');
    form.setValue('kind', 'house');
    expect(form.getState().takenOut).toEqual({ features: 'Private pool is no longer offered, so it was taken out' });
    form.setValue('kind', 'villa');
    expect(form.getState().takenOut).toEqual({});
  });

  it('after your visit: Chemical peel unticked above and ticked again — the note under the next question goes', () => {
    const form = createForm({ page: visit });
    form.setValue('treatments', ['botox', 'peel']);
    form.setValue('again', 'peel');
    form.setValue('treatments', ['botox']);
    expect(form.getState().takenOut).toEqual({ again: 'Chemical peel is no longer offered, so it was taken out' });
    form.setValue('treatments', ['botox', 'peel']);
    expect(form.getState().takenOut).toEqual({});
    expect(form.getState().values['again']).toBeNull();
  });

  it('picked again, or another answer picked by the person: the note goes', () => {
    const form = createForm({ page: unit });
    form.setValue('kind', 'villa');
    form.setValue('features', ['garden']);
    form.setValue('kind', 'flat');
    expect(form.getState().takenOut['features']).toBeDefined();
    form.setValue('features', ['lift']);
    expect(form.getState().takenOut).toEqual({});
  });
});

/** A data source whose list requests wait until the test lets each one answer. */
function lists() {
  const asked: { list: string; values: Values; answer(options: Option[]): void }[] = [];
  const source: DataSource = { options: (request) => new Promise<Option[]>((resolve) => asked.push({ ...request, answer: resolve })) };
  return { source, asked };
}

describe('a note of a choice the app’s list no longer offers goes once the list offers it again', () => {
  const CITIES: Record<string, Option[]> = { eg: [{ value: 'cai', label: 'Cairo' }], jo: [{ value: 'amm', label: 'Amman' }] };
  const sites = {
    fieldia: '0.12',
    id: 'sites',
    data: { kind: 'record', model: 'site' },
    fields: {
      country: { type: 'selection', label: 'Country', options: [{ value: 'eg', label: 'Egypt' }, { value: 'jo', label: 'Jordan' }] },
      city: { type: 'selection', label: 'City', options: [], optionsFrom: { list: 'cities', dependsOn: ['country'] } },
    },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'c', field: 'country' }, { type: 'field', id: 'y', field: 'city' }] },
  } as Page;

  it('a city: taken out for Jordan, said until Egypt’s list is back — not while it loads', async () => {
    const { source, asked } = lists();
    const form = createForm({ page: sites, dataSource: source, values: { country: 'eg', city: 'cai' } });
    form.loadChoices('city');
    asked[0].answer(CITIES['eg']);
    await form.settled();
    form.setValue('country', 'jo');
    asked[1].answer(CITIES['jo']);
    await form.settled();
    expect(form.getState().takenOut['city']).toBe('Cairo is no longer offered, so it was taken out');
    form.setValue('country', 'eg');
    // Still Jordan's list on show while Egypt's is asked: still true.
    expect(form.getState().takenOut['city']).toBe('Cairo is no longer offered, so it was taken out');
    asked[2].answer(CITIES['eg']);
    await form.settled();
    expect(form.getState().takenOut).toEqual({});
  });

  it('a line’s tool: taken out as its connection changed, said no more once the first connection is back', async () => {
    const TOOLS: Record<string, Option[]> = { 1: [{ value: 'send_email', label: 'Send email' }], 2: [{ value: 'post_message', label: 'Post message' }] };
    const agent = {
      fieldia: '0.12',
      id: 'agent',
      data: { kind: 'record', model: 'agent' },
      fields: {
        tools: {
          type: 'one2many',
          label: 'Tools',
          relation: 'agent.tool',
          fields: { connection_id: { type: 'many2one', label: 'Connection', relation: 'connection' }, tool: { type: 'selection', label: 'Tool', options: [], optionsFrom: { list: 'tools', dependsOn: ['connection_id'] } } },
        },
      },
      layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 't', field: 'tools' }] },
    } as Page;
    const { source, asked } = lists();
    const gmail = { id: 1, label: 'Gmail' };
    const slack = { id: 2, label: 'Slack' };
    const form = createForm({ page: agent, dataSource: source, values: { tools: [{ key: 'a', values: { connection_id: gmail, tool: 'send_email' } } as Line] } });
    form.loadChoices('tools.a.tool');
    asked[0].answer(TOOLS[1]);
    await form.settled();
    form.updateLine('tools', 'a', 'connection_id', slack);
    asked[1].answer(TOOLS[2]);
    await form.settled();
    expect(form.getState().takenOut['tools.a.tool']).toBe('Send email is no longer offered, so it was taken out');
    form.updateLine('tools', 'a', 'connection_id', gmail);
    asked.at(-1)?.answer(TOOLS[1]);
    await form.settled();
    expect(form.getState().takenOut).toEqual({});
  });
});
