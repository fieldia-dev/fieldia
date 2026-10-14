import type { Page } from '../format/page';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';

/**
 * A box reads what is typed in it as it is left. A save, a check or a step
 * forward made while it still has the focus — Ctrl+Enter, a button's key, the
 * app's own save — reads it first, through the readers its widget gives the
 * form (`settling`), so what is saved is what the box shows, and text that does
 * not read is refused with its words.
 */

const page: Page = {
  fieldia: '0.1',
  id: 'settle',
  data: { kind: 'record', model: 'project' },
  fields: { seats: { type: 'integer', label: 'Workstations' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-seats', field: 'seats' }] },
} as Page;

/** A box that has "1.5" typed in it and set 1 on the way, as a whole-number box does: its reader keeps the text unread. */
function typedBox(form: ReturnType<typeof createForm>) {
  const read = jest.fn(() => {
    form.setValue('seats', 4);
    form.setUnread('seats', { text: '1.5', message: 'Workstations takes whole numbers' });
  });
  form.setValue('seats', 1);
  const off = form.settling(read);
  return { read, off };
}

describe('text typed and not yet read', () => {
  it('is read before a save, which then refuses it with its words and saves nothing', async () => {
    const dataSource = createMemoryDataSource({ records: { project: { 1: { seats: 4 } } } });
    const form = createForm({ page, dataSource, recordId: 1 });
    await form.load();
    const { read } = typedBox(form);
    expect(await form.save()).toBe(false);
    expect(read).toHaveBeenCalledTimes(1);
    expect(form.getState().errors['seats']).toBe('Workstations takes whole numbers');
    expect(dataSource.records['project'][1]['seats']).toBe(4);
  });

  it('is read before a check and a step forward too', () => {
    const form = createForm({ page: { ...page, data: { kind: 'responses' } } as Page });
    const { read } = typedBox(form);
    expect(form.validate()).toBe(false);
    expect(read).toHaveBeenCalledTimes(1);
    expect(form.getState().errors['seats']).toBe('Workstations takes whole numbers');
  });

  it('stops being read once its box goes', async () => {
    const dataSource = createMemoryDataSource({ records: { project: { 1: { seats: 4 } } } });
    const form = createForm({ page, dataSource, recordId: 1 });
    await form.load();
    const { read, off } = typedBox(form);
    off();
    expect(await form.save()).toBe(true);
    expect(read).not.toHaveBeenCalled();
    expect(dataSource.records['project'][1]['seats']).toBe(1);
  });

  it('is read in a saved form placed on the page, before the page round it sends', async () => {
    const inner: Page = { fieldia: '0.1', id: 'inner', data: { kind: 'responses' }, fields: { n: { type: 'integer', label: 'Nights' } }, layout: { type: 'sections', id: 'r', children: [{ type: 'field', id: 'f-n', field: 'n' }] } } as Page;
    const outer = {
      fieldia: '0.1',
      id: 'outer',
      data: { kind: 'responses' },
      fields: {},
      layout: { type: 'sections', id: 'root', children: [{ type: 'form', id: 'stay', page: 'inner', name: 'stay' }] },
    } as unknown as Page;
    const form = createForm({ page: outer, dataSource: createMemoryDataSource() });
    const placed = form.embed('stay', inner);
    const read = jest.fn(() => placed.setUnread('n', { text: '2.5', message: 'Nights takes whole numbers' }));
    placed.settling(read);
    expect(await form.save()).toBe(false);
    expect(read).toHaveBeenCalled();
  });
});
