import type { Page } from '../format/page';
import { createForm } from './form';
import { recordLivePart } from './live-later';
import { createMemoryDataSource } from './memory-data-source';

/** The live part, asked for only by a form whose source tells changes or presence, as it is made. */

const page = {
  fieldia: '0.7',
  id: 'course',
  data: { kind: 'record', model: 'course' },
  fields: { price: { type: 'float', label: 'Price' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-price', field: 'price' }] },
} as unknown as Page;
const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

describe('the live part', () => {
  it('is never asked for by a source that tells neither', async () => {
    const ds = createMemoryDataSource({ records: { course: { 1: { price: 1 } } } });
    const plain = createForm({ page, dataSource: ds, recordId: 1 });
    await plain.load();
    await settle();
    expect(recordLivePart.loaded).toBeUndefined();
  });

  it('comes for a source that tells them, and lays a change made elsewhere once it has', async () => {
    const ds = createMemoryDataSource({ live: true, records: { course: { 1: { price: 1 } } } });
    const form = createForm({ page, dataSource: ds, recordId: 1 });
    await form.load();
    await settle();
    expect(recordLivePart.loaded).toBeDefined();
    ds.changeElsewhere('course', 1, { price: 2 }, { by: 'Mona Adel' });
    await settle();
    expect(form.getState().values['price']).toBe(2);
  });
});
