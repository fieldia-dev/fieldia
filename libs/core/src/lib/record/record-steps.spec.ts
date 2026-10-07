import type { Page } from '../format/page';
import { validatePage } from '../format/validate';
import { createForm, type FormEvents } from './form';
import { createMemoryDataSource } from './memory-data-source';
import { MESSAGES } from './messages';
import type { PostedMessage } from './run';

/**
 * What sits around one record: the gear menu's Archive, Duplicate and Delete
 * (through the data source, or the app's actions of those names), another
 * record shown in the form's place, and words posted in its conversation.
 */

const employee: Page = {
  fieldia: '0.1',
  id: 'employee',
  title: 'Employee',
  data: { kind: 'record', model: 'hr.employee' },
  fields: {
    name: { type: 'char', label: 'Name' },
    active: { type: 'boolean', label: 'Active' },
    job: { type: 'many2one', label: 'Job', relation: 'hr.job' },
    note: { type: 'html', label: 'Closing note' },
    state: { type: 'selection', label: 'Status', options: [{ value: 'open', label: 'Open' }, { value: 'lost', label: 'Lost' }] },
  },
  layout: {
    type: 'sheet',
    id: 'sheet',
    toolbar: {
      menu: [
        { id: 'm-archive', builtin: 'archive' },
        { id: 'm-unarchive', builtin: 'unarchive' },
        { id: 'm-duplicate', builtin: 'duplicate' },
        { id: 'm-delete', builtin: 'delete' },
        { id: 'm-print', label: 'Badge', group: 'print', action: 'print_badge' },
        { id: 'm-depart', label: 'Departure', builtin: 'archive', steps: [{ do: 'set', field: 'name', value: "'leaving'" }] },
      ],
    },
    children: [{ type: 'field', id: 'f-name', field: 'name' }],
  },
};

const people = () =>
  createMemoryDataSource({
    records: {
      'hr.employee': {
        1: { name: 'Mona Adel', active: true, job: { id: 4, label: 'Nurse' }, state: 'open' },
        2: { name: 'Karim Fathy', active: true, state: 'open' },
        3: { name: 'Salma Nabil', active: false, state: 'lost' },
      },
    },
  });

/** Every event of a kind the form tells, in order. */
function heard<E extends keyof FormEvents>(form: ReturnType<typeof createForm>, event: E): FormEvents[E][] {
  const seen: FormEvents[E][] = [];
  form.on(event, (payload) => seen.push(payload));
  return seen;
}

describe('the page format: a record toolbar and an attachment preview', () => {
  it('reads a sheet with a gear menu, the pager and breadcrumbs turned off, a preview and the side panel beside', () => {
    const page: Page = {
      ...employee,
      fields: { ...employee.fields, cv: { type: 'binary', label: 'CV' } },
      layout: {
        ...(employee.layout as Extract<Page['layout'], { type: 'sheet' }>),
        toolbar: { menu: [{ id: 'm-dup', builtin: 'duplicate' }], pager: false, breadcrumbs: false },
        attachmentPreview: { field: 'cv' },
        sidePanel: { type: 'slot', id: 'chatter', name: 'chatter' },
        sidePanelBeside: 'always',
      },
    };
    expect(validatePage(page)).toEqual({ ok: true, page });
  });

  it('reads the steps a record runs on itself, and a post', () => {
    const page: Page = {
      ...employee,
      on: { afterSave: [{ do: 'archive' }, { do: 'unarchive' }, { do: 'duplicate' }, { do: 'delete' }, { do: 'post', message: 'Closed: {note}', kind: 'message' }] },
    };
    expect(validatePage(page).ok).toBe(true);
  });

  it('refuses a menu item that does nothing, one without words, and a preview of what is not a file', () => {
    const page = {
      ...employee,
      layout: {
        type: 'sheet',
        id: 'sheet',
        toolbar: { menu: [{ id: 'm-none', label: 'Nothing' }, { id: 'm-dumb', action: 'go' }, { id: 'f-name', builtin: 'delete' }] },
        attachmentPreview: { field: 'name' },
        children: [{ type: 'field', id: 'f-name', field: 'name' }],
      },
    } as unknown as Page;
    const result = validatePage(page);
    expect(result.ok).toBe(false);
    const issues = result.ok ? [] : result.issues.map((issue) => `${issue.path}: ${issue.message}`);
    expect(issues).toEqual(
      expect.arrayContaining([
        'layout.toolbar.menu[0]: a menu item needs steps, an action, or a built-in',
        'layout.toolbar.menu[1].label: a menu item needs words, unless it is a built-in',
        expect.stringMatching(/^layout\.children\[0\]: duplicate id "f-name"/),
        'layout.attachmentPreview.field: "name" is a char; the preview shows a file (binary or image)',
      ])
    );
  });
});

describe('a gear menu’s built-in items', () => {
  it('archives through the data source, asking first, and loads the record again', async () => {
    const source = people();
    const asked: string[] = [];
    const form = createForm({ page: employee, dataSource: source, recordId: 1, confirm: (message) => (asked.push(message), true) });
    const archived = heard(form, 'archive');
    await form.load();
    expect(form.node('m-archive').invisible).toBe(false);
    expect(form.node('m-unarchive').invisible).toBe(true);
    const result = await form.runAction('m-archive');
    expect(result).toEqual({ done: true });
    expect(asked).toEqual([MESSAGES.en.archiveConfirm]);
    expect(source.records['hr.employee'][1]['active']).toBe(false);
    expect(form.getState().values['active']).toBe(false);
    expect(archived).toEqual([{ recordId: 1, archived: true }]);
    // Archived, the menu offers to bring it back instead.
    expect(form.node('m-archive').invisible).toBe(true);
    expect(form.node('m-unarchive').invisible).toBe(false);
    await form.runAction('m-unarchive');
    expect(source.records['hr.employee'][1]['active']).toBe(true);
    expect(asked).toHaveLength(1);
  });

  it('archives nothing when the question is answered No', async () => {
    const source = people();
    const form = createForm({ page: employee, dataSource: source, recordId: 1, confirm: () => false });
    await form.load();
    expect((await form.runAction('m-archive')).reason).toBe('no');
    expect(source.records['hr.employee'][1]['active']).toBe(true);
  });

  it('runs an item’s own steps in place of its built-in, without the built-in’s question: Archive opening a departure wizard', async () => {
    const source = people();
    const confirm = jest.fn(() => true);
    const form = createForm({ page: employee, dataSource: source, recordId: 1, confirm });
    await form.load();
    await form.runAction('m-depart');
    expect(confirm).not.toHaveBeenCalled();
    expect(form.getState().values['name']).toBe('leaving');
    expect(source.records['hr.employee'][1]['active']).toBe(true);
  });

  it('asks the app’s action of the step’s name when the data source cannot: archive, then reload as it answers', async () => {
    const source = people();
    const { archive: _, ...withoutArchive } = source;
    const requests: string[] = [];
    const form = createForm({
      page: employee,
      dataSource: withoutArchive,
      recordId: 1,
      onAction: (request) => {
        requests.push(`${request.action}:${request.recordId}`);
        source.records['hr.employee'][1]['active'] = false;
        return { reload: true };
      },
    });
    await form.load();
    expect(await form.run([{ do: 'archive' }])).toEqual({ done: true });
    expect(requests).toEqual(['archive:1']);
    expect(form.getState().values['active']).toBe(false);
  });

  it('cannot archive a new record, nor one with neither a data source nor an app to do it', async () => {
    const form = createForm({ page: employee, dataSource: people() });
    expect(await form.run([{ do: 'archive' }])).toEqual(expect.objectContaining({ done: false, reason: 'cannot', message: 'A new record cannot be archived: it is not saved yet' }));
    const alone = createForm({ page: employee, dataSource: { load: people().load }, recordId: 1 });
    await alone.load();
    expect((await alone.run([{ do: 'delete' }])).message).toBe('Nothing can delete this record here: the data source has no delete, and the app takes no actions');
  });

  it('duplicates through the data source, saving what changed first, and shows the copy', async () => {
    const source = people();
    const form = createForm({ page: employee, dataSource: source, recordId: 1 });
    const copied = heard(form, 'duplicate');
    const opened = heard(form, 'open');
    await form.load();
    form.setValue('name', 'Mona A. Adel');
    expect(await form.runAction('m-duplicate')).toEqual({ done: true });
    expect(source.records['hr.employee'][1]['name']).toBe('Mona A. Adel');
    expect(form.getState().recordId).toBe(4);
    expect(form.getState().values['name']).toBe('Mona A. Adel (copy)');
    expect(form.getState().dirty).toEqual([]);
    expect(copied).toEqual([{ from: 1, recordId: 4 }]);
    expect(opened.map((event) => event.recordId)).toEqual([1, 4]);
  });

  it('duplicates through the app, which answers with the copy to show', async () => {
    const source = people();
    const { copy: _, ...withoutCopy } = source;
    const form = createForm({
      page: employee,
      dataSource: withoutCopy,
      recordId: 1,
      onAction: (request) => (request.action === 'duplicate' ? { record: 2 } : undefined),
    });
    const copied = heard(form, 'duplicate');
    await form.load();
    await form.runAction('m-duplicate');
    expect(form.getState().recordId).toBe(2);
    expect(form.getState().values['name']).toBe('Karim Fathy');
    expect(copied).toEqual([{ from: 1, recordId: 2 }]);
  });

  it('deletes through the data source, asking first; with nobody moving it on, the form starts a new record', async () => {
    const source = people();
    const asked: string[] = [];
    const form = createForm({ page: employee, dataSource: source, recordId: 2, confirm: (message) => (asked.push(message), true) });
    const deleted = heard(form, 'delete');
    await form.load();
    expect(await form.runAction('m-delete')).toEqual({ done: true });
    await form.settled();
    expect(asked).toEqual([MESSAGES.en.deleteConfirm]);
    expect(source.records['hr.employee'][2]).toBeUndefined();
    expect(deleted).toEqual([{ recordId: 2 }]);
    expect(form.getState()).toEqual(expect.objectContaining({ recordId: null, status: 'ready', dirty: [] }));
    expect(form.getState().values['name']).toBeNull();
  });

  it('lets a listener to delete show the next record, as a pager moves on', async () => {
    const source = people();
    const form = createForm({ page: employee, dataSource: source, recordId: 1 });
    form.on('delete', () => void form.openRecord(3));
    await form.load();
    await form.run([{ do: 'delete' }]);
    await form.settled();
    expect(form.getState().recordId).toBe(3);
    expect(form.getState().values['name']).toBe('Salma Nabil');
  });

  it('asks in the page’s language', async () => {
    const asked: string[] = [];
    const form = createForm({ page: employee, dataSource: people(), recordId: 1, messages: MESSAGES.ar, confirm: (message) => (asked.push(message), false) });
    await form.load();
    await form.runAction('m-delete');
    expect(asked).toEqual(['هل أنت متأكد من حذف هذا السجل؟']);
  });
});

describe('another record in the form’s place', () => {
  it('loads it, drops what was changed, and runs the page’s open steps for it', async () => {
    const page: Page = { ...employee, on: { open: [{ do: 'set', field: 'state', value: "'open'", when: 'not active' }] } };
    const form = createForm({ page, dataSource: people(), recordId: 1 });
    await form.load();
    form.setValue('name', 'changed');
    await form.openRecord(3);
    await form.settled();
    expect(form.getState()).toEqual(expect.objectContaining({ recordId: 3, status: 'ready' }));
    expect(form.getState().values['name']).toBe('Salma Nabil');
    expect(form.getState().values['state']).toBe('open');
    expect(form.getState().dirty).toEqual(['state']);
  });

  it('shows the record it ended on when two loads cross', async () => {
    const source = people();
    const slow = { ...source, load: (request: Parameters<typeof source.load>[0]) => new Promise<Awaited<ReturnType<typeof source.load>>>((resolve) => setTimeout(() => resolve(source.load(request)), request.id === 2 ? 30 : 0)) };
    const form = createForm({ page: employee, dataSource: slow, recordId: 1 });
    await form.load();
    const first = form.openRecord(2);
    const second = form.openRecord(3);
    await Promise.all([first, second]);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(form.getState().recordId).toBe(3);
    expect(form.getState().values['name']).toBe('Salma Nabil');
  });
});

describe('words posted in the record’s conversation', () => {
  it('posts a note with each field’s value as words: a link’s name, a choice’s label, an html field as it is', async () => {
    const form = createForm({ page: employee, dataSource: people(), recordId: 1 });
    const posts = heard(form, 'post');
    await form.load();
    form.setValue('note', '<p>Moved to <b>Alex</b></p>');
    expect(await form.run([{ do: 'post', message: 'Lost by {job} <{state}>: {note}' }])).toEqual({ done: true });
    expect(posts).toEqual([
      {
        recordId: 1,
        message: {
          kind: 'note',
          text: 'Lost by Nurse <Open>: Moved to Alex',
          body: '<p>Lost by Nurse &lt;Open&gt;: <p>Moved to <b>Alex</b></p></p>',
        },
      },
    ]);
  });

  it('cannot post where nothing listens', async () => {
    const form = createForm({ page: employee });
    expect(await form.run([{ do: 'post', message: 'Hello' }])).toEqual(expect.objectContaining({ done: false, reason: 'cannot', message: 'Nothing can post a message here: no conversation is beside this record' }));
  });

  it('posts through its host when it has one: a page opened over a record posts in that record’s', async () => {
    const posted: PostedMessage[] = [];
    const host = { open: jest.fn(), say: jest.fn(), ask: jest.fn(), post: (message: PostedMessage) => void posted.push(message) };
    const form = createForm({ page: employee, host });
    const own = heard(form, 'post');
    await form.run([{ do: 'post', message: 'Hello\nthere', kind: 'message' }]);
    expect(posted).toEqual([{ kind: 'message', text: 'Hello\nthere', body: '<p>Hello<br>there</p>' }]);
    expect(own).toEqual([]);
  });

  it('posts what the app answers, and shows the record it answers with', async () => {
    const form = createForm({ page: employee, dataSource: people(), recordId: 1, onAction: () => ({ post: { message: 'Debit note DN/0001 made', kind: 'message' }, record: 3 }) });
    const posts = heard(form, 'post');
    await form.load();
    await form.run([{ do: 'call', action: 'action_debit_note' }]);
    expect(posts.map((event) => event.message)).toEqual([{ kind: 'message', text: 'Debit note DN/0001 made', body: '<p>Debit note DN/0001 made</p>' }]);
    expect(form.getState().recordId).toBe(3);
  });
});

describe('the memory data source’s record operations', () => {
  it('archives, copies with new lines, deletes, and gives each record’s attachments', async () => {
    const source = createMemoryDataSource({
      records: { order: { 1: { name: 'S1', active: true, lines: [{ key: 'a', id: 5, values: { qty: 1 } }] } } },
      attachments: { 'order:1': [{ name: 'bill.pdf', type: 'application/pdf', size: 10, url: '/bill.pdf' }] },
    });
    await source.archive({ model: 'order', id: 1, fields: {}, archive: true });
    expect(source.records['order'][1]['active']).toBe(false);
    const copy = await source.copy({ model: 'order', id: 1, fields: {} });
    expect(copy.id).toBe(2);
    expect(source.records['order'][2]['name']).toBe('S1 (copy)');
    expect((source.records['order'][2]['lines'] as { id: number }[])[0].id).not.toBe(5);
    await source.delete({ model: 'order', id: 1, fields: {} });
    expect(source.records['order'][1]).toBeUndefined();
    expect(await source.attachments({ model: 'order', id: 1, fields: {} })).toEqual([{ name: 'bill.pdf', type: 'application/pdf', size: 10, url: '/bill.pdf' }]);
    expect(await source.attachments({ model: 'order', id: 2, fields: {} })).toEqual([]);
  });
});
