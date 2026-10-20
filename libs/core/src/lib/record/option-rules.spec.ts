import Ajv2020 from 'ajv/dist/2020';
import { createForm, pageJsonSchema, validatePage, type Page, type Values } from '../../index';

/**
 * Options that react to the record's other answers without a server: an
 * option shown or hidden by a condition (`options[].invisible`) — "Garden"
 * only for villas — and a later question offering the choices picked in an
 * earlier one (`optionsFrom: { field }`). A chosen option a change no longer
 * offers is taken out and said, never silently kept.
 */

const unit = {
  fieldia: '0.5',
  id: 'unit',
  data: { kind: 'record', model: 'unit' },
  fields: {
    kind: { type: 'selection', label: 'Unit type', options: [{ value: 'villa', label: 'Villa' }, { value: 'flat', label: 'Apartment' }] },
    outside: {
      type: 'selection',
      label: 'Outside',
      options: [
        { value: 'garden', label: 'Garden', invisible: "kind != 'villa'" },
        { value: 'balcony', label: 'Balcony' },
        { value: 'roof', label: 'Roof terrace', invisible: "kind == 'villa'" },
      ],
    },
    features: {
      type: 'selection',
      label: 'Features',
      multiple: true,
      options: [
        { value: 'pool', label: 'Pool', invisible: "kind != 'villa'" },
        { value: 'garage', label: 'Garage', invisible: "kind != 'villa'" },
        { value: 'lift', label: 'Lift' },
      ],
    },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-kind', field: 'kind' },
      { type: 'field', id: 'f-outside', field: 'outside' },
      { type: 'field', id: 'f-features', field: 'features' },
    ],
  },
} as Page;

const visit = {
  fieldia: '0.5',
  id: 'visit',
  data: { kind: 'responses' },
  fields: {
    treatments: {
      type: 'selection',
      label: 'Which treatments did you have?',
      multiple: true,
      options: [
        { value: 'botox', label: 'Botox' },
        { value: 'filler', label: 'Filler' },
        { value: 'peel', label: 'Chemical peel' },
        { value: 'none', label: 'None of these', exclusive: true },
      ],
    },
    again: { type: 'selection', label: 'Which would you have again?', options: [{ value: 'no_one', label: 'None of them' }], optionsFrom: { field: 'treatments' } },
    curious: { type: 'selection', label: 'Which would you like to try?', multiple: true, options: [], optionsFrom: { field: 'treatments', picked: false } },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-treatments', field: 'treatments' },
      { type: 'field', id: 'f-again', field: 'again' },
      { type: 'field', id: 'f-curious', field: 'curious' },
    ],
  },
} as Page;

const labels = (options: readonly { label: string }[] | null) => options?.map((o) => o.label);
const issues = (page: unknown) => {
  const result = validatePage(page);
  return result.ok ? [] : result.issues.map((issue) => `${issue.path}: ${issue.message}`);
};

describe('an option shown by a condition', () => {
  it('is offered only while its condition lets it be', () => {
    const form = createForm({ page: unit });
    expect(labels(form.offered('outside'))).toEqual(['Balcony', 'Roof terrace']);
    form.setValue('kind', 'villa');
    expect(labels(form.offered('outside'))).toEqual(['Garden', 'Balcony']);
    expect(labels(form.offered('features'))).toEqual(['Pool', 'Garage', 'Lift']);
    expect(form.offersChange('outside')).toBe(true);
    expect(form.offersChange('kind')).toBe(false);
    expect(form.offered('kind')).toEqual(unit.fields['kind'].type === 'selection' ? unit.fields['kind'].options : null);
  });

  it('is taken out when a change hides it, and said', () => {
    const form = createForm({ page: unit });
    form.setValue('kind', 'villa');
    form.setValue('outside', 'garden');
    form.setValue('features', ['pool', 'lift', 'garage']);
    form.setValue('kind', 'flat');
    expect(form.getState().values).toMatchObject({ outside: null, features: ['lift'] });
    expect(form.getState().takenOut).toEqual({ outside: 'Garden is no longer offered, so it was taken out', features: 'Pool and Garage are no longer offered, so they were taken out' });
  });

  it('says it until the choice is written again', () => {
    const form = createForm({ page: unit });
    form.setValue('kind', 'villa');
    form.setValue('outside', 'garden');
    form.setValue('kind', 'flat');
    expect(form.getState().takenOut['outside']).toBeDefined();
    form.setValue('kind', 'villa');
    expect(form.getState().takenOut['outside']).toBeDefined();
    form.setValue('outside', 'balcony');
    expect(form.getState().takenOut).toEqual({});
  });

  it('stays chosen, unsaid, on a record opened holding it: only a change takes one out', async () => {
    const stored: Values = { kind: 'flat', outside: 'garden', features: ['pool'] };
    const form = createForm({ page: unit, recordId: 1, dataSource: { load: async () => ({ ...stored }) } });
    await form.load();
    expect(form.getState().values).toMatchObject(stored);
    form.setValue('features', ['pool', 'lift']);
    expect(form.getState().values).toMatchObject({ outside: 'garden', features: ['pool', 'lift'] });
    expect(form.getState().takenOut).toEqual({});
    expect(form.getState().dirty).toEqual(['features']);
  });

  it('is checked as the page is read, and kept to a page’s own choices', () => {
    const broken = structuredClone(unit) as unknown as { fields: Record<string, { options: { invisible?: string }[] }> };
    broken.fields['outside'].options[0].invisible = "type != 'villa'";
    expect(issues(broken)).toEqual([`fields.outside.options[0].invisible: "type != 'villa'" reads "type", which is not a field of this page`]);
    const inLines = { ...unit, fields: { ...unit.fields, rooms: { type: 'one2many', label: 'Rooms', relation: 'unit.room', fields: { use: { type: 'selection', label: 'Use', options: [{ value: 'bed', label: 'Bedroom', invisible: 'parent.kind' }] } } } } };
    expect(issues(inLines)).toEqual([expect.stringMatching(/^fields\.rooms\.fields\.use\.options\[0\]: Unrecognized key: "invisible"/)]);
  });
});

describe('options carried from an earlier question', () => {
  it('offer what was picked there, by its labels, the question’s own after them; never its None of these', () => {
    const form = createForm({ page: visit });
    expect(labels(form.offered('again'))).toEqual(['None of them']);
    form.setValue('treatments', ['peel', 'botox']);
    expect(labels(form.offered('again'))).toEqual(['Botox', 'Chemical peel', 'None of them']);
    expect(labels(form.offered('curious'))).toEqual(['Filler']);
    form.setValue('treatments', ['none']);
    expect(labels(form.offered('again'))).toEqual(['None of them']);
    expect(labels(form.offered('curious'))).toEqual(['Botox', 'Filler', 'Chemical peel']);
  });

  it('take out an answer no longer picked there, and say so', () => {
    const form = createForm({ page: visit });
    form.setValue('treatments', ['botox', 'filler']);
    form.setValue('again', 'filler');
    form.setValue('curious', ['peel']);
    form.setValue('treatments', ['botox', 'peel']);
    expect(form.getState().values).toMatchObject({ again: null, curious: [] });
    expect(form.getState().takenOut).toEqual({ again: 'Filler is no longer offered, so it was taken out', curious: 'Chemical peel is no longer offered, so it was taken out' });
  });

  it('check an answer among the options carried, as a choice’s are', async () => {
    const sent: Values[] = [];
    const form = createForm({ page: visit, dataSource: { submit: async ({ values }) => (sent.push(values), {}) } });
    form.setValue('treatments', ['botox']);
    form.setValue('again', 'botox');
    expect(await form.save()).toBe(true);
    form.setValue('again', 'laser');
    expect(await form.save()).toBe(false);
    expect(form.getState().errors['again']).toBe('Must be one of: Botox, Filler, Chemical peel, None of them');
  });

  it('are checked as the page is read: another choice of the page, never itself or a circle', () => {
    const page = (again: unknown, extra: Record<string, unknown> = {}) => ({ ...visit, fields: { ...visit.fields, again: { ...visit.fields['again'], optionsFrom: again }, ...extra } });
    expect(issues(page({ field: 'treatment' }))).toEqual(['fields.again.optionsFrom.field: no field "treatment"']);
    expect(issues(page({ field: 'again' }))).toEqual(['fields.again.optionsFrom.field: "again" cannot carry its options from itself']);
    expect(issues(page({ field: 'note' }, { note: { type: 'char', label: 'Note' } }))).toEqual(['fields.again.optionsFrom.field: "note" is a char; options are carried from a choice']);
    expect(issues(page({ field: 'curious' }, { curious: { ...visit.fields['curious'], optionsFrom: { field: 'again' } } }))).toEqual([
      'fields.again.optionsFrom.field: "again" and "curious" carry their options from each other',
      'fields.curious.optionsFrom.field: "curious" and "again" carry their options from each other',
    ]);
  });

  it('are in the JSON Schema too', () => {
    const ajv = new Ajv2020({ strict: false });
    const valid = ajv.compile(pageJsonSchema());
    expect(valid(visit)).toBe(true);
    expect(valid(unit)).toBe(true);
    expect(valid({ ...visit, fields: { ...visit.fields, again: { ...visit.fields['again'], optionsFrom: { field: 'treatments', list: 'x' } } } })).toBe(false);
  });
});
