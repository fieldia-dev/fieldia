import type { Page } from '../format/page';
import { validatePage } from '../format/validate';
import type { DataSource, OnchangeRequest, SaveRequest } from './data-source';
import { createForm, type Form, type FormOptions } from './form';
import type { ActionHost } from './run';
import type { RecordId, Values } from './values';

/**
 * Answers that come back after the record they were asked for has gone (docs/plans/wave1-contract.md, section 10,
 * part 2: a late answer for a record replaced is dropped from the form and never lands on another record). Each test
 * holds one call of the source, replaces the record, then lets the call answer.
 */

const lead = {
  fieldia: '0.1',
  id: 'lead',
  title: 'Lead',
  data: { kind: 'record', model: 'lead' },
  fields: {
    name: { type: 'char', label: 'Name', required: true },
    phone: { type: 'char', label: 'Phone' },
    stage: { type: 'char', label: 'Stage' },
    probability: { type: 'float', label: 'Probability' },
  },
  layout: {
    type: 'sheet',
    id: 'sheet',
    title: { field: 'name' },
    children: [
      {
        type: 'section',
        id: 'main',
        children: [
          { type: 'field', id: 'f-phone', field: 'phone' },
          { type: 'field', id: 'f-stage', field: 'stage' },
          { type: 'field', id: 'f-probability', field: 'probability' },
        ],
      },
    ],
  },
} as Page;

type Held = 'onchange' | 'copy' | 'archive';

/** Two leads, a source with only 0.20's members, each call of `hold(method)` kept until `release(method)`. */
function source() {
  const records: Record<string, Values> = {
    1: { name: 'Villa in Sheikh Zayed', phone: '+201001234567', stage: 'new', probability: 10, active: true },
    2: { name: 'Flat in Maadi', phone: '+201112223334', stage: 'won', probability: 90, active: true },
  };
  const holds = new Map<Held, number>();
  const waiting = new Map<Held, (() => void)[]>();
  async function gate(method: Held) {
    const count = holds.get(method) ?? 0;
    if (!count) return;
    holds.set(method, count - 1);
    await new Promise<void>((go) => (waiting.get(method) ?? waiting.set(method, []).get(method)!).push(go));
  }
  return {
    records,
    hold: (method: Held) => void holds.set(method, (holds.get(method) ?? 0) + 1),
    release: (method: Held) => waiting.get(method)?.shift()?.(),
    async load({ id }: { id: RecordId }) {
      return { ...records[id as number] };
    },
    async save(request: SaveRequest) {
      const id = (request.id ?? 3) as number;
      records[id] = { ...(records[id] ?? {}), ...request.values };
      return { id };
    },
    // As a server's onchange: what the stage changes, worked out from the record it was changed on.
    async onchange(request: OnchangeRequest) {
      await gate('onchange');
      if (request.changed !== 'stage') return {};
      return { values: { probability: request.values['stage'] === 'lost' ? 0 : 50, name: `${request.values['name']} (${request.values['stage']})` } };
    },
    async copy({ id }: { id: RecordId }) {
      await gate('copy');
      records[5] = { ...records[id as number], name: `${records[id as number]['name']} (copy)` };
      return { id: 5 };
    },
    async archive({ id, archive }: { id: RecordId; archive: boolean }) {
      await gate('archive');
      records[id as number] = { ...records[id as number], active: !archive };
    },
  } satisfies DataSource & Record<string, unknown>;
}

/** A host that answers every question No, and keeps them. */
function host() {
  const asked: string[] = [];
  const made: ActionHost = {
    open: async () => ({ saved: false }),
    say: () => undefined,
    ask: (message) => {
      asked.push(message);
      return Promise.resolve(false);
    },
    close: () => undefined,
  };
  return { host: made, asked };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function opened(ds: DataSource, more: Partial<FormOptions> = {}): Promise<Form> {
  const form = createForm({ page: lead, dataSource: ds, recordId: 1, ...more });
  await form.load();
  await form.settled();
  return form;
}

beforeAll(() => expect(validatePage(lead)).toMatchObject({ ok: true }));

describe('a change’s answer (onchange) that comes after its record was replaced', () => {
  it('lead 1’s answer, come once the form shows lead 2, is not laid on lead 2', async () => {
    const ds = source();
    const form = await opened(ds, { host: host().host });
    ds.hold('onchange');
    form.setValue('stage', 'lost');
    await tick();
    // Before lead 1's first save nothing typed is at risk: the form moves on at once, as in 0.20.
    expect(await form.openRecord(2)).toBe(true);
    ds.release('onchange');
    await tick();
    await tick();
    expect(form.getState()).toMatchObject({ recordId: 2, dirty: [], values: { name: 'Flat in Maadi', probability: 90 } });
    expect(await form.save()).toBe(true);
    expect(ds.records[2]).toMatchObject({ name: 'Flat in Maadi', probability: 90 });
  });

  it('the answer to a change a reload let go is not laid on the record loaded again', async () => {
    const ds = source();
    const form = await opened(ds, { host: host().host });
    ds.hold('onchange');
    form.setValue('stage', 'lost');
    await tick();
    await form.load();
    ds.release('onchange');
    await tick();
    await tick();
    expect(form.getState()).toMatchObject({ recordId: 1, dirty: [], values: { name: 'Villa in Sheikh Zayed', stage: 'new', probability: 10 } });
  });
});

describe('a record step whose call answers after the record it ran on was replaced', () => {
  it('Duplicate: the copy made for lead 1 does not take the form from lead 2, nor what was typed in it', async () => {
    const ds = source();
    const form = await opened(ds, { host: host().host });
    ds.hold('copy');
    const run = form.run([{ do: 'duplicate' }]);
    await tick();
    expect(await form.openRecord(2)).toBe(true);
    form.setValue('phone', '+201110000000');
    ds.release('copy');
    const result = await run;
    await form.settled();
    expect(ds.records[5]).toMatchObject({ name: 'Villa in Sheikh Zayed (copy)' });
    expect(form.getState()).toMatchObject({ recordId: 2, dirty: ['phone'], values: { phone: '+201110000000' } });
    expect(result.done).toBe(false);
  });

  it('Archive: lead 1 archived does not load lead 2 again over what was typed in it', async () => {
    const ds = source();
    const form = await opened(ds, { host: host().host });
    ds.hold('archive');
    const run = form.run([{ do: 'archive' }]);
    await tick();
    expect(await form.openRecord(2)).toBe(true);
    form.setValue('phone', '+201110000000');
    ds.release('archive');
    await run;
    await form.settled();
    expect(ds.records[1]).toMatchObject({ active: false });
    expect(form.getState()).toMatchObject({ recordId: 2, dirty: ['phone'], values: { phone: '+201110000000' } });
  });
});
