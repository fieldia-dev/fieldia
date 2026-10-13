import type { Page } from '../format/page';
import { validatePage } from '../format/validate';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';

/**
 * A record head's parts at work: values the server keeps (whether the record
 * is followed, how many comments it has) written without making the record
 * changed, by the app or by its answer to Follow; a toggle pressed while its
 * condition holds; the head's buttons, their menus' items and its link pressed
 * as any button of the record; its row's and band's fields as any field.
 */

const bug: Page = {
  fieldia: '0.1',
  id: 'bug',
  data: { kind: 'record', model: 'work.item' },
  fields: {
    title: { type: 'char', label: 'Title', required: true },
    state: { type: 'selection', label: 'State', options: [{ value: 'new', label: 'New' }, { value: 'active', label: 'Active' }] },
    area: { type: 'char', label: 'Area', required: true },
    following: { type: 'boolean', label: 'Following', readonly: true },
    comment_count: { type: 'integer', label: 'Comments', readonly: true },
    assigned: { type: 'char', label: 'Assigned To' },
  },
  layout: {
    type: 'sheet',
    id: 'sheet',
    title: { field: 'title' },
    head: {
      meta: [
        { type: 'field', id: 'h-assigned', field: 'assigned', labels: 'hidden', invisible: "state == 'new'" },
        { type: 'link', id: 'h-comments', field: 'comment_count', words: { one: 'Comment', other: 'Comments' }, steps: [{ do: 'set', field: 'assigned', value: "'Mona Adel'" }] },
      ],
      actions: [
        { type: 'button', id: 'b-save', label: 'Save and Close', primaryWhenChanged: true, steps: [{ do: 'save' }, { do: 'close' }], menu: [{ id: 'm-save', label: 'Save', steps: [{ do: 'save' }] }] },
        { type: 'button', id: 'b-follow', label: 'Follow', pressedLabel: 'Following', pressed: 'following', action: 'follow', menu: [{ id: 'm-all', label: 'All changes', action: 'follow-all', invisible: 'not following' }] },
        { type: 'button', id: 'b-undo', label: 'Revert changes', icon: 'undo', iconOnly: true, steps: [{ do: 'reset' }] },
      ],
      band: { children: [{ type: 'field', id: 'f-state', field: 'state', hotkey: 'e' }, { type: 'field', id: 'f-area', field: 'area', hotkey: 'a' }] },
    },
    children: [],
  },
};

const source = () => createMemoryDataSource({ records: { 'work.item': { 4127: { title: 'Stock count wrong', state: 'active', area: 'Portal', following: false, comment_count: 1, assigned: null } } } });

async function opened(onAction?: Parameters<typeof createForm>[0]['onAction']) {
  const form = createForm({ page: bug, dataSource: source(), recordId: 4127, onAction });
  await form.load();
  return form;
}

describe('a record head at work', () => {
  it('is a page the format takes', () => {
    expect(validatePage(bug).ok).toBe(true);
  });

  it('writes values the server keeps without making the record changed', async () => {
    const form = await opened();
    const changes: string[] = [];
    form.on('change', (event) => changes.push(`${event.field}:${event.by}`));
    form.setValues({ following: true, comment_count: 2 }, { stored: true });
    expect(form.getState().values).toMatchObject({ following: true, comment_count: 2 });
    expect(form.getState().dirty).toEqual([]);
    expect(changes).toEqual(['following:app', 'comment_count:app']);
    // Undo puts back the person's changes, never what the server keeps.
    form.setValue('state', 'new');
    form.reset();
    expect(form.getState().values).toMatchObject({ state: 'active', following: true, comment_count: 2 });
    // Without `stored`, the app's write is a change to save, as it always was.
    form.setValues({ comment_count: 3 });
    expect(form.getState().dirty).toEqual(['comment_count']);
  });

  it('takes a person’s change of the same field over, leaving the rest of their changes', async () => {
    const form = await opened();
    form.setValue('assigned', 'Karim Fathy');
    form.setValue('state', 'new');
    form.setValues({ assigned: 'Salma Nabil' }, { stored: true });
    expect(form.getState().dirty).toEqual(['state']);
    expect(form.getState().values['assigned']).toBe('Salma Nabil');
    expect(() => form.setValues({ nothing: 1 }, { stored: true })).toThrow(/nothing/);
  });

  it('applies the app’s answer `stored` as kept values: Follow toggles and the record stays unchanged', async () => {
    const form = await opened((request) => ({ stored: { following: !request.values['following'] } }));
    expect(form.node('b-follow').pressed).toBe(false);
    await form.runAction('b-follow');
    expect(form.getState().values['following']).toBe(true);
    expect(form.getState().dirty).toEqual([]);
    expect(form.node('b-follow').pressed).toBe(true);
    await form.runAction('b-follow');
    expect(form.node('b-follow').pressed).toBe(false);
    // Only a toggle says whether it is pressed.
    expect(form.node('b-save').pressed).toBeUndefined();
  });

  it('presses the head’s buttons, their menus’ items and its link as any button of the record', async () => {
    const asked: string[] = [];
    const form = await opened((request) => void asked.push(request.action));
    await form.runAction('h-comments');
    expect(form.getState().values['assigned']).toBe('Mona Adel');
    // An item hidden with its condition, shown once it holds.
    expect(form.node('m-all').invisible).toBe(true);
    form.setValues({ following: true }, { stored: true });
    expect(form.node('m-all').invisible).toBe(false);
    await form.runAction('m-all');
    expect(asked).toEqual(['follow-all']);
    // Save from the menu saves the change.
    form.setValue('state', 'new');
    const result = await form.runAction('m-save');
    expect(result.done).toBe(true);
    expect(form.getState().dirty).toEqual([]);
    expect(form.getState().status).toBe('saved');
  });

  it('shows and checks the row’s and the band’s fields as any field of the page', async () => {
    const form = await opened();
    expect(form.node('h-assigned').invisible).toBe(false);
    form.setValue('state', 'new');
    expect(form.node('h-assigned').invisible).toBe(true);
    form.setValue('area', null);
    expect(form.validate()).toBe(false);
    expect(Object.keys(form.getState().errors)).toEqual(['area']);
  });
});
