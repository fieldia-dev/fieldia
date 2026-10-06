import type { Page } from '../format/page';
import { createForm, type FormEvents } from './form';
import { later, orderPage, orderSource, recordingHost, wizardPage } from './test-steps';

/**
 * The moments of a form that run steps — opened, a person's change, before and
 * after saving, a step or tab shown — and the events an app listens to.
 */

describe('moments — open', () => {
  it('a new form runs `open` once, as soon as it is made, and tells the app', async () => {
    const host = recordingHost();
    const page = orderPage({ on: { open: [{ do: 'say', message: 'Welcome' }, { do: 'set', field: 'note', value: "'opened'" }] } });
    const form = createForm({ page, host });
    const opened: FormEvents['open'][] = [];
    form.on('open', (event) => opened.push(event));
    await form.settled();
    expect(host.calls).toEqual([['say', 'Welcome', 'info']]);
    expect(form.getState().values['note']).toBe('opened');
    expect(opened).toEqual([{ recordId: null, values: expect.objectContaining({ note: null }) }]);
    await form.settled();
    expect(host.calls).toHaveLength(1);
  });

  it('a record runs `open` once it is loaded, and again each time it is loaded', async () => {
    const page = orderPage({ on: { open: [{ do: 'set', field: 'note', value: "'Opened ' + name" }] } });
    const form = createForm({ page, dataSource: orderSource(), recordId: 7 });
    const opened: unknown[] = [];
    form.on('open', (event) => opened.push(event.recordId));
    await form.settled();
    expect(opened).toEqual([]);
    await form.load();
    await form.settled();
    expect(form.getState().values['note']).toBe('Opened SO007');
    await form.load();
    await form.settled();
    expect(opened).toEqual([7, 7]);
  });
});

describe('moments — a person’s change', () => {
  const watched = () =>
    orderPage({
      on: {
        change: {
          quantity: [{ do: 'say', message: 'Quantity changed' }],
          price: [{ do: 'say', message: 'Price changed' }],
          total: [{ do: 'say', message: 'Total changed' }],
          lines: [{ do: 'say', message: 'Lines changed' }],
        },
      },
    });

  it('runs for a person’s change of the field — never for a step’s, the app’s or a worked-out value’s', async () => {
    const host = recordingHost();
    const form = createForm({ page: watched(), host });
    form.setValue('quantity', 2);
    await form.settled();
    expect(host.calls).toEqual([['say', 'Quantity changed', 'info']]);
    form.setValue('quantity', 3, { by: 'app' });
    form.setValues({ quantity: 4, price: 5 });
    await form.run([{ do: 'set', field: 'price', value: '6' }, { do: 'addLine', field: 'lines' }]);
    await form.settled();
    // The total was worked out from both: nobody changed it.
    expect(form.getState().values['total']).toBe(24);
    expect(host.calls).toEqual([['say', 'Quantity changed', 'info']]);
  });

  it('a person’s edit of the lines is a change of their field', async () => {
    const host = recordingHost();
    const form = createForm({ page: watched(), host });
    const key = form.addLine('lines', { name: 'Dates' });
    await form.settled();
    form.updateLine('lines', key, 'qty', 2);
    await form.settled();
    form.removeLine('lines', key);
    await form.settled();
    expect(host.calls).toEqual([
      ['say', 'Lines changed', 'info'],
      ['say', 'Lines changed', 'info'],
      ['say', 'Lines changed', 'info'],
    ]);
  });

  it('a step setting the field it changed runs once, never round again', async () => {
    const page = orderPage({ on: { change: { quantity: [{ do: 'set', field: 'quantity', value: 'quantity * 2' }] } } });
    const form = createForm({ page });
    form.setValue('quantity', 3);
    await form.settled();
    expect(form.getState().values['quantity']).toBe(6);
  });

  it('tells the app every change, and whose it was', async () => {
    const form = createForm({ page: orderPage() });
    const changes: unknown[][] = [];
    form.on('change', (event) => changes.push([event.field, event.value, event.by, event.values['total']]));
    form.setValue('quantity', 2);
    form.setValue('price', 3, { by: 'app' });
    form.setValues({ quantity: 4, note: 'x' });
    await form.run([{ do: 'set', field: 'ref', value: "'R1'" }]);
    expect(changes).toEqual([
      ['quantity', 2, 'person', null],
      ['price', 3, 'app', 6],
      ['quantity', 4, 'app', 12],
      ['note', 'x', 'app', 12],
      ['ref', 'R1', 'step', 12],
    ]);
  });

  it('runs one at a time: changes made while it runs make one more run, with the values as they are then', async () => {
    const gate = later();
    const seen: unknown[] = [];
    let running = 0;
    let most = 0;
    const page = orderPage({ on: { change: { quantity: [{ do: 'call', action: 'stock' }] } } });
    const form = createForm({
      page,
      onAction: async (request) => {
        most = Math.max(most, ++running);
        seen.push(request.values['quantity']);
        if (seen.length === 1) await gate.promise;
        running--;
      },
    });
    form.setValue('quantity', 1);
    form.setValue('quantity', 2);
    form.setValue('quantity', 3);
    gate.resolve();
    await form.settled();
    expect(seen).toEqual([1, 3]);
    expect(most).toBe(1);
  });
});

describe('moments — before and after saving', () => {
  it('a stop before saving keeps it unsaved, and the state says why', async () => {
    const source = orderSource();
    const host = recordingHost({ ask: [false, true] });
    const form = createForm({ page: orderPage({ on: { beforeSave: [{ do: 'ask', message: 'Send the order?' }] } }), dataSource: source, host });
    form.setValue('name', 'SO8');
    expect(await form.save()).toBe(false);
    expect(source.calls.filter((call) => call.method === 'save')).toEqual([]);
    expect(form.getState()).toEqual(expect.objectContaining({ status: 'error', saveProblem: { kind: 'stopped', reason: 'no', message: 'Send the order?' } }));
    expect(await form.save()).toBe(true);
    expect(form.getState()).toEqual(expect.objectContaining({ status: 'saved', saveProblem: null }));
  });

  it('a check before saving shows its problems, as the save’s own would', async () => {
    const source = orderSource();
    const form = createForm({ page: orderPage({ on: { beforeSave: [{ do: 'check', fields: ['ref'] }] } }), dataSource: source, values: { quantity: 5 } });
    expect(await form.save()).toBe(false);
    expect(form.getState()).toEqual(expect.objectContaining({ errors: { ref: 'Reference is required' }, saveProblem: null }));
    expect(source.calls.filter((call) => call.method === 'save')).toEqual([]);
  });

  it('runs before the save’s own check, so it can fill in what is asked for', async () => {
    const source = orderSource();
    const form = createForm({ page: orderPage({ on: { beforeSave: [{ do: 'set', field: 'ref', value: "'R-' + quantity" }] } }), dataSource: source, values: { quantity: 5 } });
    expect(await form.save()).toBe(true);
    expect(Object.values(source.records['sale.order']).at(-1)).toEqual(expect.objectContaining({ ref: 'R-5', quantity: 5 }));
  });

  it('runs afterSave once saved — not when refused — and tells the app what was saved', async () => {
    const host = recordingHost();
    const source = orderSource();
    const form = createForm({ page: orderPage({ on: { afterSave: [{ do: 'say', message: 'Order saved', tone: 'success' }] } }), dataSource: source, host, values: { quantity: 5 } });
    const saved: FormEvents['save'][] = [];
    form.on('save', (event) => saved.push(event));
    expect(await form.save()).toBe(false);
    await form.settled();
    expect(host.calls).toEqual([]);
    form.setValue('ref', 'R5');
    expect(await form.save()).toBe(true);
    await form.settled();
    expect(host.calls).toEqual([['say', 'Order saved', 'success']]);
    expect(saved).toEqual([{ recordId: expect.anything(), values: expect.objectContaining({ ref: 'R5' }) }]);
    expect(saved[0].recordId).toBe(form.getState().recordId);
  });

  it('tells the app what a page of responses sent', async () => {
    const form = createForm({ page: wizardPage(), dataSource: orderSource(), values: { name: 'Sara' } });
    const sent: FormEvents['send'][] = [];
    form.on('send', (event) => sent.push(event));
    expect(await form.save()).toBe(true);
    expect(sent).toEqual([{ values: expect.objectContaining({ name: 'Sara' }) }]);
  });

  it('a save the app makes while beforeSave runs goes ahead without it, so nothing waits on itself', async () => {
    const source = orderSource();
    const answers: boolean[] = [];
    const actions: string[] = [];
    const form = createForm({
      page: orderPage({ on: { beforeSave: [{ do: 'call', action: 'prepare' }] } }),
      dataSource: source,
      onAction: async (request) => {
        actions.push(request.action);
        answers.push(await form.save());
      },
    });
    form.setValue('name', 'SO9');
    expect(await form.save()).toBe(true);
    expect(answers).toEqual([true]);
    expect(actions).toEqual(['prepare']);
    expect(source.calls.filter((call) => call.method === 'save')).toHaveLength(2);
  });

  it('a save step of afterSave saves without running afterSave again', async () => {
    const source = orderSource();
    const actions: string[] = [];
    const form = createForm({
      page: orderPage({ on: { afterSave: [{ do: 'call', action: 'after' }, { do: 'save' }] } }),
      dataSource: source,
      onAction: (request) => void actions.push(request.action),
    });
    form.setValue('name', 'SO9');
    expect(await form.save()).toBe(true);
    await form.settled();
    expect(actions).toEqual(['after']);
    expect(source.calls.filter((call) => call.method === 'save')).toHaveLength(2);
  });
});

describe('moments — a step or tab shown', () => {
  it('runs `show` for the first step once the form opens, then for each step entered, and tells the app', async () => {
    const host = recordingHost();
    const page = wizardPage({
      open: [{ do: 'say', message: 'open' }],
      show: { about: [{ do: 'say', message: 'about' }], last: [{ do: 'say', message: 'last' }] },
    });
    const form = createForm({ page, host });
    const entered: string[] = [];
    form.on('step', (event) => entered.push(event.step));
    await form.settled();
    expect(host.calls).toEqual([
      ['say', 'open', 'info'],
      ['say', 'about', 'info'],
    ]);
    form.setValue('name', 'Sara');
    form.next();
    form.next();
    await form.settled();
    expect(host.calls.at(-1)).toEqual(['say', 'last', 'info']);
    form.back();
    expect(entered).toEqual(['about', 'usage', 'last', 'usage']);
  });

  it('runs `show` for a tab the viewer says is shown', async () => {
    const host = recordingHost();
    const form = createForm({ page: orderPage({ on: { show: { more: [{ do: 'say', message: 'More' }] } } }), host });
    form.shown('more');
    form.shown('main');
    await form.settled();
    expect(host.calls).toEqual([['say', 'More', 'info']]);
  });

  it('steps shown that send each other back and forth stop where they began', async () => {
    const page = wizardPage({ show: { about: [{ do: 'goTo', target: 'last' }], last: [{ do: 'goTo', target: 'about' }] } });
    const form = createForm({ page, values: { name: 'Sara' } });
    const entered: string[] = [];
    form.on('step', (event) => entered.push(event.step));
    await form.settled();
    expect(entered).toEqual(['about', 'last', 'about']);
    expect(form.getState().step).toBe('about');
  });
});

describe('events for the app', () => {
  it('tells each call the app answered, and each run with how it ended; a listener can stop listening', async () => {
    const page = orderPage({ buttons: [{ type: 'button', id: 'go', label: 'Go', steps: [{ do: 'set', field: 'note', value: "'x'" }], action: 'go' }] });
    const form = createForm({ page, onAction: () => ({ say: 'hi' }) });
    const actions: FormEvents['action'][] = [];
    const runs: FormEvents['run'][] = [];
    form.on('action', (event) => actions.push(event));
    const off = form.on('run', (event) => runs.push(event));
    await form.runAction('go');
    expect(actions).toEqual([{ request: expect.objectContaining({ id: 'go', action: 'go' }), result: { say: 'hi' } }]);
    expect(runs).toEqual([{ id: 'go', steps: [{ do: 'set', field: 'note', value: "'x'" }, { do: 'call', action: 'go' }], result: { done: true } }]);
    off();
    await form.run([{ do: 'clear', field: 'note' }]);
    expect(runs).toHaveLength(1);
  });

  it('setValues writes several at once, worked out once, as no person’s change', () => {
    const host = recordingHost();
    const form = createForm({ page: orderPage({ on: { change: { quantity: [{ do: 'say', message: 'changed' }] } } }), host });
    const states: unknown[] = [];
    form.subscribe((state) => states.push(state.values));
    form.setValues({ quantity: 2, price: 3 });
    expect(states).toHaveLength(1);
    expect(form.getState().values['total']).toBe(6);
    expect(form.getState().dirty).toEqual(expect.arrayContaining(['quantity', 'price']));
    expect(host.calls).toEqual([]);
    expect(() => form.setValues({ colour: 'red' })).toThrow(/colour/);
  });

  it('a person’s change inside a saved form placed here is told as a change of its answers', () => {
    const address: Page = {
      fieldia: '0.1',
      id: 'address',
      data: { kind: 'responses' },
      fields: { street: { type: 'char', label: 'Street' } },
      layout: { type: 'sections', id: 'root', children: [{ type: 'section', id: 's', children: [{ type: 'field', id: 'street', field: 'street' }] }] },
    };
    const outer = createForm({
      page: {
        fieldia: '0.1',
        id: 'delivery',
        data: { kind: 'responses' },
        fields: { name: { type: 'char', label: 'Name' } },
        layout: { type: 'sections', id: 'root', children: [{ type: 'form', id: 'home', page: 'address', name: 'home_address' }] },
      },
    });
    const changes: unknown[][] = [];
    outer.on('change', (event) => changes.push([event.field, event.by, event.value]));
    const inner = outer.embed('home', address);
    inner.setValue('street', '12 Nile Street');
    expect(changes).toEqual([['home_address', 'person', { street: '12 Nile Street' }]]);
  });
});
