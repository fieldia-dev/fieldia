import { createMemoryChatter } from './memory';

const me = { id: 1, name: 'Ramy Fathi' };
const mona = { id: 2, name: 'Mona Adel' };
const order = { model: 'sale.order', id: 7 };

function chatter() {
  return createMemoryChatter({
    me,
    people: [me, mona, { id: 3, name: 'Karim Fathy' }],
    activityTypes: [{ id: 'call', name: 'Call', icon: 'phone', daysUntilDue: 2 }],
    now: () => new Date('2026-10-02T09:30:00Z'),
    records: {
      'sale.order:7': {
        messages: [{ id: 1, kind: 'event', author: mona, date: '2026-10-01T08:00:00Z', body: '', tracking: [{ field: 'state', label: 'Status', from: 'Quotation', to: 'Quotation sent' }] }],
        followers: [{ id: 1, person: mona }],
      },
    },
  });
}

describe('createMemoryChatter', () => {
  it('posts a message as the person using it, newest first', async () => {
    const source = chatter();
    await source.post(order, { kind: 'note', body: '<p>Call the client first.</p>' });
    const messages = await source.messages(order);
    expect(messages.map((m) => m.kind)).toEqual(['note', 'event']);
    expect(messages[0]).toEqual(expect.objectContaining({ author: me, date: '2026-10-02T09:30:00.000Z', body: '<p>Call the client first.</p>' }));
  });

  it('keeps each record’s conversation apart', async () => {
    const source = chatter();
    await source.post({ model: 'sale.order', id: 8 }, { kind: 'message', body: '<p>Hello</p>' });
    expect(await source.messages(order)).toHaveLength(1);
    expect(await source.messages({ model: 'sale.order', id: 8 })).toHaveLength(1);
  });

  it('turns a reaction on and off for the person using it', async () => {
    const source = chatter();
    const [first] = await source.messages(order);
    expect(await source.react!(order, first.id, '👍')).toEqual([{ emoji: '👍', count: 1, mine: true }]);
    expect(await source.react!(order, first.id, '👍')).toEqual([]);
  });

  it('finds people by name, whatever the case', async () => {
    expect((await chatter().people!('fath')).map((p) => p.name)).toEqual(['Ramy Fathi', 'Karim Fathy']);
  });

  it('schedules, finishes and cancels activities; a finished one is posted as a message', async () => {
    const source = chatter();
    const call = await source.schedule!(order, { typeId: 'call', summary: 'Confirm the delivery date', due: '2026-10-04', assigneeId: 2 });
    expect(call).toEqual(expect.objectContaining({ summary: 'Confirm the delivery date', due: '2026-10-04', assignee: mona, type: expect.objectContaining({ name: 'Call' }) }));
    const second = await source.schedule!(order, { typeId: 'call', due: '2026-10-05', assigneeId: 1 });
    expect(await source.activities!(order)).toHaveLength(2);
    await source.markDone!(order, call.id, 'They want it on the 11th.');
    await source.cancel!(order, second.id);
    expect(await source.activities!(order)).toEqual([]);
    const [done] = await source.messages(order);
    expect(done.body).toContain('Call');
    expect(done.body).toContain('They want it on the 11th.');
  });

  it('adds and takes away followers', async () => {
    const source = chatter();
    const karim = await source.follow!(order, 3);
    expect((await source.followers!(order)).map((f) => f.person.name)).toEqual(['Mona Adel', 'Karim Fathy']);
    await source.unfollow!(order, karim.id);
    expect((await source.followers!(order)).map((f) => f.person.name)).toEqual(['Mona Adel']);
  });

  it('stores an uploaded file and hands back where to find it', async () => {
    const source = chatter();
    const file = new File(['hello'], 'floor plan.pdf', { type: 'application/pdf' });
    const stored = await source.upload!(order, file);
    expect(stored).toEqual(expect.objectContaining({ name: 'floor plan.pdf', type: 'application/pdf', size: 5 }));
    expect(stored.url).toMatch(/^data:application\/pdf;base64,/);
  });
});
