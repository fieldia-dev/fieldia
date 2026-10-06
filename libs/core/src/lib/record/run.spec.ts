import type { ActionStep } from '../format/actions';
import { createForm, type ActionRequest } from './form';
import type { ActionResult, OpenResult } from './run';
import { orderPage, orderSource, recordingHost, wizardPage } from './test-steps';
import type { Line } from './values';

/**
 * Steps, run by the form: in order, each only `when` it holds, the first that
 * fails or is refused stopping the rest — and the run says which and why.
 */

describe('form.run — steps in order', () => {
  it('sets and empties fields from expressions, each reading what the step before wrote', async () => {
    const form = createForm({ page: orderPage(), values: { note: 'old' } });
    const result = await form.run([
      { do: 'set', field: 'quantity', value: '2.6' },
      { do: 'set', field: 'price', value: 'quantity * 2.5' },
      { do: 'set', field: 'name', value: "'Order for ' + quantity" },
      { do: 'clear', field: 'note' },
    ]);
    expect(result).toEqual({ done: true });
    // A whole number is rounded as its field holds it; the worked-out total follows.
    expect(form.getState().values).toEqual(expect.objectContaining({ quantity: 3, price: 7.5, total: 22.5, name: 'Order for 3', note: null }));
  });

  it('skips a step whose condition does not hold, and goes on', async () => {
    const form = createForm({ page: orderPage(), values: { quantity: 1 } });
    const result = await form.run([
      { do: 'set', field: 'price', value: '100', when: 'quantity > 5' },
      { do: 'set', field: 'note', value: "'small'", when: 'quantity <= 5' },
      { do: 'set', field: 'ref', value: "'never'", when: false },
    ]);
    expect(result.done).toBe(true);
    expect(form.getState().values).toEqual(expect.objectContaining({ price: null, note: 'small', ref: null }));
  });

  it('adds a line, its fields from expressions — a link taken whole, with its name', async () => {
    const form = createForm({ page: orderPage(), values: { product_id: { id: 5, label: 'Dates' }, quantity: 4 } });
    await form.run([{ do: 'addLine', field: 'lines', values: { name: "'Dates, boxed'", qty: 'quantity * 2', product_id: 'product_id' } }]);
    const lines = form.getState().values['lines'] as Line[];
    expect(lines).toHaveLength(1);
    expect(lines[0].values).toEqual(expect.objectContaining({ name: 'Dates, boxed', qty: 8, product_id: { id: 5, label: 'Dates' } }));
  });

  it('checks the form as sending does: problems are shown, and stop the steps after', async () => {
    const form = createForm({ page: orderPage(), values: { quantity: 6 } });
    const result = await form.run([{ do: 'set', field: 'note', value: "'checked'" }, { do: 'check' }, { do: 'set', field: 'note', value: "'after'" }]);
    expect(result).toEqual({ done: false, stoppedAt: 1, step: { do: 'check' }, reason: 'check', message: 'Reference is required' });
    expect(form.getState().errors).toEqual({ ref: 'Reference is required' });
    expect(form.getState().values['note']).toBe('checked');
  });

  it('checks only the fields named, and shows only theirs', async () => {
    const form = createForm({ page: orderPage(), values: { quantity: 6 } });
    expect((await form.run([{ do: 'check', fields: ['quantity', 'price'] }])).done).toBe(true);
    expect(form.getState().errors).toEqual({});
    const stopped = await form.run([{ do: 'check', fields: ['ref'] }]);
    expect(stopped.reason).toBe('check');
    expect(form.getState().errors).toEqual({ ref: 'Reference is required' });
  });

  it('saves through the data source, and a refused save stops the rest', async () => {
    const source = orderSource();
    const form = createForm({ page: orderPage(), dataSource: source, recordId: 7 });
    await form.load();
    form.setValue('quantity', 3);
    expect(await form.run([{ do: 'save' }])).toEqual({ done: true });
    expect(source.records['sale.order'][7]['quantity']).toBe(3);

    const refusing = createForm({
      page: orderPage(),
      dataSource: { ...source, save: () => Promise.reject(new Error('The warehouse is closed')) },
    });
    const result = await refusing.run([{ do: 'save' }, { do: 'set', field: 'note', value: "'saved'" }]);
    expect(result).toEqual(expect.objectContaining({ done: false, stoppedAt: 0, reason: 'save', message: 'The warehouse is closed' }));
    expect(refusing.getState().values['note']).toBeNull();
  });

  it('a save that the page’s own checks refuse stops with the first problem', async () => {
    const form = createForm({ page: orderPage(), dataSource: orderSource(), values: { quantity: 5 } });
    const result = await form.run([{ do: 'save' }]);
    expect(result).toEqual(expect.objectContaining({ done: false, reason: 'save', message: 'Reference is required' }));
  });

  it('a page of responses sends its answers', async () => {
    const source = orderSource();
    const form = createForm({ page: wizardPage(), dataSource: source, values: { name: 'Sara' } });
    expect((await form.run([{ do: 'save' }])).done).toBe(true);
    expect(source.responses).toEqual([expect.objectContaining({ pageId: 'join', values: expect.objectContaining({ name: 'Sara' }) })]);
  });

  it('puts the form back as it was', async () => {
    const form = createForm({ page: orderPage(), values: { quantity: 1 } });
    form.setValue('quantity', 9);
    await form.run([{ do: 'reset' }]);
    expect(form.getState().values['quantity']).toBe(1);
    expect(form.getState().dirty).toEqual([]);
  });

  it('goes to a wizard’s step: back at once, forward only past steps that are complete', async () => {
    const form = createForm({ page: wizardPage() });
    const refused = await form.run([{ do: 'goTo', target: 'last' }]);
    expect(refused).toEqual(expect.objectContaining({ done: false, reason: 'check', message: 'Name is required' }));
    expect(form.getState().step).toBe('about');
    form.setValue('name', 'Sara');
    expect((await form.run([{ do: 'goTo', target: 'last' }])).done).toBe(true);
    expect(form.getState().step).toBe('last');
    expect((await form.run([{ do: 'goTo', target: 'about' }])).done).toBe(true);
    expect(form.getState().step).toBe('about');
  });

  it('cannot go to a wizard’s step that does not apply now', async () => {
    const form = createForm({ page: wizardPage() });
    const result = await form.run([{ do: 'goTo', target: 'usage' }]);
    expect(result).toEqual(expect.objectContaining({ done: false, reason: 'cannot' }));
    expect(result.message).toMatch(/usage/);
  });

  it('shows a tab through the host, and cannot without one', async () => {
    const host = recordingHost();
    const form = createForm({ page: orderPage(), host });
    expect((await form.run([{ do: 'goTo', target: 'more' }])).done).toBe(true);
    expect(host.calls).toEqual([['show', 'more']]);
    const alone = createForm({ page: orderPage() });
    expect(await alone.run([{ do: 'goTo', target: 'more' }])).toEqual(expect.objectContaining({ done: false, reason: 'cannot' }));
  });

  it('says things in a tone, asks, and stops on No with the question', async () => {
    const host = recordingHost({ ask: [true, false] });
    const form = createForm({ page: orderPage(), host });
    const result = await form.run([
      { do: 'say', message: 'Checking stock' },
      { do: 'ask', message: 'Price it now?' },
      { do: 'say', message: 'Priced', tone: 'success' },
      { do: 'ask', message: 'Send it?' },
      { do: 'say', message: 'Sent' },
    ]);
    expect(host.calls).toEqual([
      ['say', 'Checking stock', 'info'],
      ['ask', 'Price it now?'],
      ['say', 'Priced', 'success'],
      ['ask', 'Send it?'],
    ]);
    expect(result).toEqual({ done: false, stoppedAt: 3, step: { do: 'ask', message: 'Send it?' }, reason: 'no', message: 'Send it?' });
  });

  it('closes the dialog or panel it was opened in, through the host', async () => {
    const host = recordingHost();
    expect((await createForm({ page: orderPage(), host }).run([{ do: 'close' }])).done).toBe(true);
    expect(host.calls).toEqual([['close']]);
    expect(await createForm({ page: orderPage() }).run([{ do: 'close' }])).toEqual(expect.objectContaining({ done: false, reason: 'cannot' }));
  });

  it('with no host: says nothing, asks the app’s confirm — or goes on as though answered Yes — and cannot open', async () => {
    const asked: string[] = [];
    const confirming = createForm({ page: orderPage(), confirm: (message) => (asked.push(message), false) });
    expect(await confirming.run([{ do: 'say', message: 'Hello' }, { do: 'ask', message: 'Sure?' }])).toEqual(expect.objectContaining({ done: false, stoppedAt: 1, reason: 'no' }));
    expect(asked).toEqual(['Sure?']);

    const alone = createForm({ page: orderPage() });
    expect(await alone.run([{ do: 'ask', message: 'Sure?' }, { do: 'set', field: 'note', value: "'yes'" }])).toEqual({ done: true });
    expect(alone.getState().values['note']).toBe('yes');
    const opening = await alone.run([{ do: 'open', page: 'customer' }]);
    expect(opening).toEqual(expect.objectContaining({ done: false, stoppedAt: 0, reason: 'cannot' }));
    expect(opening.message).toMatch(/customer/);
  });

  it('a step the page cannot run — a field it does not have — stops, and says why', async () => {
    const form = createForm({ page: orderPage() });
    const result = await form.run([{ do: 'set', field: 'colour', value: "'red'" }]);
    expect(result).toEqual(expect.objectContaining({ done: false, stoppedAt: 0, reason: 'cannot' }));
    expect(result.message).toMatch(/colour/);
  });
});

describe('form.run — the app’s own actions', () => {
  it('hands a call to the app with the record, and goes on when it answers nothing', async () => {
    const requests: ActionRequest[] = [];
    const form = createForm({ page: orderPage(), recordId: null, values: { quantity: 2 }, onAction: (request) => void requests.push(request) });
    const result = await form.run([{ do: 'call', action: 'check_stock', params: { warehouse: 'main' } }, { do: 'set', field: 'note', value: "'checked'" }], { id: 'stock' });
    expect(result).toEqual({ done: true });
    expect(requests).toEqual([{ id: 'stock', action: 'check_stock', params: { warehouse: 'main' }, recordId: null, values: expect.objectContaining({ quantity: 2 }) }]);
    expect(form.getState().values['note']).toBe('checked');
  });

  it('the app may answer values to set, words to say, a page to open, or stop', async () => {
    const host = recordingHost({ open: [{ saved: true, recordId: 2, values: { name: 'Delta Foods' } }] });
    const answers: ActionResult[] = [
      { values: { price: 12.5, customer_id: 1, colour: 'ignored' }, say: 'Priced' },
      { say: { message: 'Pick a customer', tone: 'warning' }, open: { page: 'customer', as: 'panel', into: { customer_id: 'id' } } },
      { stop: 'Out of stock' },
    ];
    const form = createForm({ page: orderPage(), values: { quantity: 2, customer_id: { id: 1, label: 'Nile Traders' } }, host, onAction: () => answers.shift() });
    const result = await form.run([
      { do: 'call', action: 'price' },
      { do: 'call', action: 'pick' },
      { do: 'call', action: 'reserve' },
      { do: 'say', message: 'Reserved' },
    ]);
    // Values set as a step sets them: a link given by its id keeps the name the form knows it by.
    expect(form.getState().values).toEqual(expect.objectContaining({ price: 12.5, total: 25, customer_id: { id: 2, label: 'Delta Foods' } }));
    expect(host.calls).toEqual([
      ['say', 'Priced', 'info'],
      ['say', 'Pick a customer', 'warning'],
      ['open', 'customer'],
      ['say', 'Out of stock', 'warning'],
    ]);
    expect(host.opened[0]).toEqual({ page: 'customer', as: 'panel', recordId: null });
    expect(result).toEqual({ done: false, stoppedAt: 2, step: { do: 'call', action: 'reserve' }, reason: 'app', message: 'Out of stock' });
  });

  it('a stop without words stops quietly', async () => {
    const host = recordingHost();
    const form = createForm({ page: orderPage(), host, onAction: () => ({ stop: true }) });
    expect(await form.run([{ do: 'call', action: 'x' }, { do: 'say', message: 'never' }])).toEqual({ done: false, stoppedAt: 0, step: { do: 'call', action: 'x' }, reason: 'app' });
    expect(host.calls).toEqual([]);
  });

  it('an app action that throws stops the run, with its words and what it threw', async () => {
    const thrown = new Error('No connection');
    const form = createForm({ page: orderPage(), onAction: async () => Promise.reject(thrown) });
    const result = await form.run([{ do: 'call', action: 'x' }, { do: 'set', field: 'note', value: "'after'" }]);
    expect(result).toEqual(expect.objectContaining({ done: false, stoppedAt: 0, reason: 'app', message: 'No connection', error: thrown }));
    expect(form.getState().values['note']).toBeNull();
  });

  it('a call with no app to answer goes on', async () => {
    const form = createForm({ page: orderPage() });
    expect(await form.run([{ do: 'call', action: 'x' }, { do: 'set', field: 'note', value: "'after'" }])).toEqual({ done: true });
  });
});

describe('form.run — opening another page', () => {
  it('starts it on a record or with values from this form, and takes its answers back', async () => {
    const host = recordingHost({ open: [{ saved: true, recordId: 9, values: { name: 'Delta Foods', city: 'Cairo' } }] });
    const form = createForm({ page: orderPage(), host, values: { name: 'Delta', customer_id: { id: 1, label: 'Nile Traders' }, quantity: 3 } });
    const result = await form.run([
      {
        do: 'open',
        page: 'customer',
        as: 'panel',
        title: 'New customer',
        version: 2,
        values: { name: "name + ' Foods'", parent_id: 'customer_id', count: 'quantity + 1' },
        into: { customer_id: 'id', note: "'Customer from ' + city" },
        then: [{ do: 'say', message: 'Customer added', tone: 'success' }],
      },
    ]);
    expect(result).toEqual({ done: true });
    expect(host.opened).toEqual([
      // A link named alone goes whole, with its name, as the opened form holds one.
      { page: 'customer', version: 2, as: 'panel', title: 'New customer', recordId: null, values: { name: 'Delta Foods', parent_id: { id: 1, label: 'Nile Traders' }, count: 4 } },
    ]);
    // A link set from the record it saved takes that record's name.
    expect(form.getState().values).toEqual(expect.objectContaining({ customer_id: { id: 9, label: 'Delta Foods' }, note: 'Customer from Cairo' }));
    expect(host.calls.at(-1)).toEqual(['say', 'Customer added', 'success']);
  });

  it('opens a record by an expression, in a dialog unless told otherwise', async () => {
    const host = recordingHost({ open: [{ saved: true, recordId: 1, values: {} }] });
    const form = createForm({ page: orderPage(), host, values: { customer_id: { id: 1, label: 'Nile Traders' } } });
    await form.run([{ do: 'open', page: 'customer', record: 'customer_id' }]);
    expect(host.opened).toEqual([{ page: 'customer', as: 'dialog', recordId: 1 }]);
  });

  it('names a link it saved by the host’s label first, then display_name, then name, then its id', async () => {
    const labels: (string | undefined)[] = [];
    const answers: OpenResult[] = [
      { saved: true, recordId: 3, label: 'Shown title', values: { display_name: 'Display', name: 'Name' } },
      { saved: true, recordId: 3, values: { display_name: 'Display', name: 'Name' } },
      { saved: true, recordId: 3, values: { name: 'Name' } },
      { saved: true, recordId: 3 },
    ];
    for (const answer of answers) {
      const form = createForm({ page: orderPage(), host: recordingHost({ open: [answer] }) });
      await form.run([{ do: 'open', page: 'customer', into: { customer_id: 'id' } }]);
      labels.push((form.getState().values['customer_id'] as { label: string }).label);
    }
    expect(labels).toEqual(['Shown title', 'Display', 'Name', '3']);
  });

  it('closed without saving: the steps after it and its own do not run', async () => {
    const host = recordingHost({ open: [{ saved: false }] });
    const form = createForm({ page: orderPage(), host });
    const result = await form.run([
      { do: 'open', page: 'customer', into: { customer_id: 'id' }, then: [{ do: 'say', message: 'then' }] },
      { do: 'say', message: 'after' },
    ]);
    expect(result).toEqual(expect.objectContaining({ done: false, stoppedAt: 0, reason: 'closed' }));
    expect(host.calls).toEqual([['open', 'customer']]);
  });

  it('a step of its `then` that stops is told, at the open step’s place', async () => {
    const host = recordingHost({ open: [{ saved: true, recordId: 4, values: {} }], ask: [false] });
    const form = createForm({ page: orderPage(), host });
    const ask: ActionStep = { do: 'ask', message: 'Keep it?' };
    const result = await form.run([{ do: 'say', message: 'first' }, { do: 'open', page: 'customer', then: [ask, { do: 'say', message: 'kept' }] }, { do: 'say', message: 'after' }]);
    expect(result).toEqual({ done: false, stoppedAt: 1, step: ask, reason: 'no', message: 'Keep it?' });
  });

  it('a host that fails to open stops the run, with its words', async () => {
    const host = { ...recordingHost(), open: () => Promise.reject(new Error('No such page')) };
    const result = await createForm({ page: orderPage(), host }).run([{ do: 'open', page: 'nowhere' }]);
    expect(result).toEqual(expect.objectContaining({ done: false, reason: 'cannot', message: 'No such page' }));
  });
});

describe('buttons', () => {
  it('runs a button’s steps, then its action as a final call, with its params', async () => {
    const requests: ActionRequest[] = [];
    const page = orderPage({
      buttons: [{ type: 'button', id: 'confirm', label: 'Confirm', steps: [{ do: 'set', field: 'note', value: "'confirmed'" }], action: 'action_confirm', params: { notify: true } }],
    });
    const form = createForm({ page, onAction: (request) => void requests.push(request) });
    expect(await form.runAction('confirm')).toEqual({ done: true });
    expect(requests).toEqual([{ id: 'confirm', action: 'action_confirm', params: { notify: true }, recordId: null, values: expect.objectContaining({ note: 'confirmed' }) }]);
  });

  it('a step that stops keeps the action from being called; the stop is told at the call’s place for the action', async () => {
    const requests: string[] = [];
    const page = orderPage({ buttons: [{ type: 'button', id: 'go', label: 'Go', steps: [{ do: 'check' }], action: 'go' }] });
    const form = createForm({ page, values: { quantity: 9 }, onAction: (request) => void requests.push(request.action) });
    expect(await form.runAction('go')).toEqual(expect.objectContaining({ done: false, stoppedAt: 0, reason: 'check' }));
    expect(requests).toEqual([]);
    const stopping = createForm({ page, onAction: () => ({ stop: 'No' }) });
    expect(await stopping.runAction('go')).toEqual({ done: false, stoppedAt: 1, step: { do: 'call', action: 'go' }, reason: 'app', message: 'No' });
  });

  it('a list’s button hands every call the records chosen', async () => {
    const requests: ActionRequest[] = [];
    const page = orderPage({ buttons: [{ type: 'button', id: 'archive', label: 'Archive', steps: [{ do: 'call', action: 'log' }], action: 'archive' }] });
    const form = createForm({ page, onAction: (request) => void requests.push(request) });
    await form.runAction('archive', { recordIds: [4, 'b7'] });
    expect(requests.map((r) => [r.action, r.recordIds])).toEqual([
      ['log', [4, 'b7']],
      ['archive', [4, 'b7']],
    ]);
  });

  it('asks a button’s confirm first, through the host: No runs nothing', async () => {
    const host = recordingHost({ ask: [false, true] });
    const requests: string[] = [];
    const page = orderPage({ buttons: [{ type: 'button', id: 'block', label: 'Block', confirm: 'Block this order?', steps: [{ do: 'say', message: 'Blocked' }], action: 'block' }] });
    const form = createForm({ page, host, onAction: (request) => void requests.push(request.action) });
    expect(await form.runAction('block')).toEqual({ done: false, reason: 'no', message: 'Block this order?' });
    expect(requests).toEqual([]);
    expect(await form.runAction('block')).toEqual({ done: true });
    expect(requests).toEqual(['block']);
    expect(host.calls).toEqual([['ask', 'Block this order?'], ['ask', 'Block this order?'], ['say', 'Blocked', 'info']]);
  });

  it('a hidden button runs nothing', async () => {
    const requests: string[] = [];
    const page = orderPage({ buttons: [{ type: 'button', id: 'go', label: 'Go', action: 'go', invisible: 'quantity > 1' }] });
    const form = createForm({ page, values: { quantity: 2 }, onAction: (request) => void requests.push(request.action) });
    expect(await form.runAction('go')).toEqual(expect.objectContaining({ done: false, reason: 'cannot' }));
    expect(requests).toEqual([]);
  });

  it('a stat button runs its steps too', async () => {
    const host = recordingHost();
    const page = orderPage({ stats: [{ id: 'lines', label: 'Lines', steps: [{ do: 'goTo', target: 'more' }] }] });
    expect(await createForm({ page, host }).runAction('lines')).toEqual({ done: true });
    expect(host.calls).toEqual([['show', 'more']]);
  });
});
