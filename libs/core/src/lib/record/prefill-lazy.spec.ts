import type { Page } from '../format/page';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import { formJoins } from './joins';

/**
 * A form whose page fills fields from its link, made before the prefill part came (an app's own form, with no viewer
 * to wait for it): what the link fills is laid as the part comes — where the form starts, never over what the person
 * changed meanwhile or what the app gave.
 */

const enquiry: Page = {
  fieldia: '0.9',
  id: 'enquiry',
  data: { kind: 'responses' },
  fields: { name: { type: 'char', label: 'Your name' }, unit: { type: 'char', label: 'Unit' }, agent_code: { type: 'char', label: 'Agent' }, utm_source: { type: 'char', label: 'Source' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-unit', field: 'unit' }] },
  prefill: { fromUrl: ['unit', 'utm_source', { param: 'agent', field: 'agent_code' }] },
};

/** The prefill part, the one part this page asks to join its form. */
const [prefillPart] = formJoins(enquiry);

describe('a form filled from its link before the prefill part came', () => {
  it('lays what the link fills as the part comes, keeping what was typed and given meanwhile', async () => {
    expect(prefillPart.loaded).toBeUndefined();
    const form = createForm({ page: enquiry, url: '?unit=B-12&agent=mona&utm_source=whatsapp', values: { utm_source: 'web' } });
    expect(form.getState().values['unit']).toBeNull();
    form.setValue('unit', 'C-3');
    await prefillPart.load();
    await form.settle();
    await Promise.resolve();
    expect(form.getState().values).toMatchObject({ unit: 'C-3', agent_code: 'mona', utm_source: 'web' });
    // Laid where the form starts: the hidden field is no change of the person's.
    expect(form.getState().dirty).toEqual(['unit']);
  });

  it('reads the link at once once the part is in, and sends its hidden fields', async () => {
    await prefillPart.load();
    const dataSource = createMemoryDataSource();
    const form = createForm({ page: enquiry, dataSource, url: '?agent=karim' });
    expect(form.getState().values['agent_code']).toBe('karim');
    form.setValue('name', 'Omar');
    expect(await form.save()).toBe(true);
    expect(dataSource.responses[0].values).toEqual({ name: 'Omar', unit: null, agent_code: 'karim', utm_source: null });
    // What the response went with, as its ending reads it ("Your agent will call you"): the hidden fields in it.
    expect(form.getState().sent?.values).toMatchObject({ agent_code: 'karim' });
  });
});
