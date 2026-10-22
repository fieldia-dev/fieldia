import type { Page } from '../format/page';
import type { AppFunctions } from '../expression/app-functions';
import type { SaveRequest } from './data-source';
import { createForm } from './form';
import type { RecordId, Values } from './values';

/**
 * A form calling the app's own functions (`functions`): a value worked out
 * with one, a condition reading one, and one that asks the app's server —
 * the value waiting while it is asked, asked once for the same values, a save
 * waiting for it, a failure said and asked again, and an answer for a record
 * no longer shown laid on none.
 */

const booking = {
  fieldia: '0.10',
  id: 'booking',
  data: { kind: 'record', model: 'stay' },
  fields: {
    guest: { type: 'char', label: 'Guest' },
    country: { type: 'char', label: 'Country' },
    nights: { type: 'integer', label: 'Nights' },
    rate: { type: 'monetary', label: 'Night rate', currency: 'EGP', compute: 'nightRate(country)' },
    total: { type: 'monetary', label: 'Total', currency: 'EGP', compute: 'nights * rate' },
    tax: { type: 'monetary', label: 'Tax', currency: 'EGP', compute: 'total * taxShare(country)' },
    passport: { type: 'char', label: 'Passport' },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-guest', field: 'guest' },
      { type: 'field', id: 'f-country', field: 'country' },
      { type: 'field', id: 'f-nights', field: 'nights' },
      { type: 'field', id: 'f-rate', field: 'rate' },
      { type: 'field', id: 'f-total', field: 'total' },
      { type: 'field', id: 'f-tax', field: 'tax' },
      { type: 'field', id: 'f-passport', field: 'passport', invisible: 'not foreigner(country)' },
    ],
  },
} as Page;

/** The app's server, its answers held until the test lets each one come. */
function server() {
  const asked: { country: string; answer(rate: number): void; fail(why: string): void }[] = [];
  const functions: AppFunctions = {
    nightRate: {
      takes: [1, 1],
      values: ['text'],
      gives: 'number',
      call: (country: string) =>
        new Promise<number>((answer, fail) => asked.push({ country, answer, fail: (why) => fail(new Error(why)) })),
    },
    taxShare: (country: string) => (country === 'EG' ? 0.14 : 0),
    foreigner: (country: string) => !!country && country !== 'EG',
  };
  return { functions, asked };
}

const tick = () => new Promise((go) => setTimeout(go, 0));

describe('the app’s functions on a form', () => {
  it('work a value out with one that answers at once, and read one in a condition', () => {
    const form = createForm({ page: booking, functions: { nightRate: () => 1000, taxShare: () => 0.14, foreigner: (c: string) => c !== 'EG' } });
    form.setValue('country', 'EG');
    form.setValue('nights', 3);
    expect(form.getState().values).toMatchObject({ rate: 1000, total: 3000, tax: 420 });
    expect(form.node('f-passport').invisible).toBe(true);
    form.setValue('country', 'DE');
    expect(form.node('f-passport').invisible).toBe(false);
  });

  it('refuse a name a page cannot call as the form is made', () => {
    expect(() => createForm({ page: booking, functions: { round: () => 1 } })).toThrow(/"round" is Fieldia's own function/);
  });

  it('wait for one that asks: empty and said meanwhile, its answer worked into what follows', async () => {
    const { functions, asked } = server();
    const form = createForm({ page: booking, functions });
    form.setValue('nights', 2);
    form.setValue('country', 'EG');
    expect(asked.map((a) => a.country)).toEqual([null, 'EG']);
    expect(form.getState().values['rate']).toBeNull();
    expect(form.getState().asked).toEqual({ rate: {}, total: {}, tax: {} });
    expect(form.waitsFor('total')).toEqual({ field: 'total', asking: true });
    asked[1].answer(1500);
    await tick();
    expect(form.getState().values).toMatchObject({ rate: 1500, total: 3000, tax: 420 });
    expect(form.getState().asked).toEqual({});
    expect(form.waitsFor('total')).toBeNull();
  });

  it('ask once for the same values, and keep each answer for the record shown', async () => {
    const { functions, asked } = server();
    const form = createForm({ page: booking, functions });
    form.setValue('country', 'EG');
    form.setValue('guest', 'Mona');
    form.setValue('nights', 4);
    expect(asked.map((a) => a.country)).toEqual([null, 'EG']);
    asked[1].answer(900);
    await tick();
    form.setValue('country', 'DE');
    form.setValue('country', 'EG');
    expect(asked.map((a) => a.country)).toEqual([null, 'EG', 'DE']);
    expect(form.getState().values['total']).toBe(3600);
  });

  it('make a save wait for the answer, so what is saved is worked out', async () => {
    const { functions, asked } = server();
    const saved: SaveRequest[] = [];
    const form = createForm({ page: booking, functions, dataSource: { save: async (request) => (saved.push(request), { id: 7 }) } });
    form.setValue('country', 'EG');
    form.setValue('nights', 2);
    const saving = form.save();
    await tick();
    expect(saved).toEqual([]);
    expect(form.getState().status).toBe('saving');
    asked[0].answer(0);
    asked[1].answer(500);
    expect(await saving).toBe(true);
    expect(saved[0].values).toMatchObject({ rate: 500, total: 1000, tax: 140 });
  });

  it('say an answer that did not come, ask it again as the person saves, and stop the save when it fails again', async () => {
    const { functions, asked } = server();
    const saved: SaveRequest[] = [];
    const form = createForm({ page: booking, functions, dataSource: { save: async (request) => (saved.push(request), { id: 7 }) } });
    form.setValue('country', 'EG');
    asked[0].answer(0);
    asked[1].fail('The rates server is down');
    await tick();
    expect(form.getState().asked['rate']).toEqual({ failed: 'The rates server is down' });
    expect(form.waitsFor('rate')).toEqual({ field: 'rate', asking: true, failed: 'The rates server is down' });
    const first = form.save();
    await tick();
    expect(asked.map((a) => a.country)).toEqual([null, 'EG', 'EG']);
    asked[2].fail('The rates server is down');
    expect(await first).toBe(false);
    expect(saved).toEqual([]);
    expect(form.getState().errors['rate']).toBe('Night rate could not be worked out: The rates server is down');
    const second = form.save();
    await tick();
    asked[3].answer(800);
    expect(await second).toBe(true);
    expect(saved[0].values).toMatchObject({ rate: 800 });
  });

  it('lay an answer for a record no longer shown on none, and leave a loaded record unchanged by its answer', async () => {
    const { functions, asked } = server();
    const records: Record<string, Values> = { 1: { guest: 'Mona', country: 'EG', nights: 2 }, 2: { guest: 'Hans', country: 'DE', nights: 1 } };
    const form = createForm({ page: booking, functions, recordId: 1, dataSource: { load: async ({ id }: { id: RecordId }) => ({ ...records[id as number] }) } });
    await form.load();
    const forOne = asked.find((a) => a.country === 'EG');
    await form.openRecord(2);
    expect(form.getState().values['guest']).toBe('Hans');
    forOne?.answer(1500);
    await tick();
    expect(form.getState().values['rate']).toBeNull();
    asked.find((a) => a.country === 'DE')?.answer(2000);
    await tick();
    expect(form.getState().values).toMatchObject({ rate: 2000, total: 2000 });
    // Its answer is no change of the person's.
    expect(form.getState().dirty).toEqual([]);
  });
});
