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

  it('has no channels and pushes nothing unless it is told to: a source as 0.28 had', () => {
    const source = chatter();
    expect([source.replyChannels, source.subscribe]).toEqual([undefined, undefined]);
  });

  it('says the channels each record can be written to by, sends by one, delivers, receives and pushes it all to who subscribes', async () => {
    jest.useFakeTimers();
    try {
      const enquiry = { model: 'enquiry', id: 1 };
      const source = createMemoryChatter({
        me: { id: 1, name: 'Salma Nabil' },
        live: true,
        deliverAfter: 1500,
        replyChannels: [{ id: 'whatsapp', to: '+20 100 123 4567' }],
        records: { 'enquiry:2': { replyChannels: [] } },
      });
      expect(await source.replyChannels!(enquiry)).toEqual([{ id: 'whatsapp', to: '+20 100 123 4567' }]);
      expect(await source.replyChannels!({ model: 'enquiry', id: 2 })).toEqual([]);
      const pushed: unknown[] = [];
      const stop = source.subscribe!(enquiry, (change) => pushed.push(change));
      const sent = await source.post(enquiry, { kind: 'message', body: '<p>Thursday at 11?</p>', channel: 'whatsapp', to: '+20 100 123 4567' });
      expect(sent).toEqual(expect.objectContaining({ channel: 'whatsapp', direction: 'out', delivery: 'sent' }));
      // A note by the note channel goes nowhere outside: no ticks.
      const note = await source.post(enquiry, { kind: 'note', body: '<p>Serious buyer.</p>', channel: 'note' });
      expect([note.channel, note.delivery]).toEqual(['note', undefined]);
      jest.advanceTimersByTime(1500);
      expect(pushed).toEqual([{ type: 'delivery', id: sent.id, delivery: 'delivered', failure: null }]);
      source.deliver(enquiry, sent.id, 'read');
      const received = source.receive(enquiry, { author: { id: 2, name: 'Mona Adel' }, body: '<p>Perfect.</p>', channel: 'whatsapp' });
      expect(received).toEqual(expect.objectContaining({ kind: 'message', direction: 'in', channel: 'whatsapp' }));
      expect(pushed.slice(1)).toEqual([{ type: 'delivery', id: sent.id, delivery: 'read', failure: null }, { type: 'message', message: received }]);
      expect((await source.messages(enquiry)).map((message) => [message.id, message.delivery ?? null])).toEqual([[received.id, null], [note.id, null], [sent.id, 'read']]);
      stop();
      source.deliver(enquiry, sent.id, 'failed', 'Blocked');
      expect(pushed).toHaveLength(3);
      expect((await source.messages(enquiry))[2]).toEqual(expect.objectContaining({ delivery: 'failed', failure: 'Blocked' }));
    } finally {
      jest.useRealTimers();
    }
  });
});
